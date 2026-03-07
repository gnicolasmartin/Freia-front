/**
 * whatsapp-sender.ts
 *
 * WhatsApp Cloud API outbound message sender.
 * - Token bucket rate limiter (50 messages/sec per phone_number_id)
 * - Exponential backoff retries for transient errors (429, 5xx, network)
 * - Pure async functions — no React dependencies, safe for API routes
 *
 * Environment variables (server-side):
 *   WHATSAPP_PHONE_NUMBER_ID — WhatsApp Business phone number ID
 *   WHATSAPP_ACCESS_TOKEN    — System user access token
 */

// ─── Rate limiter ─────────────────────────────────────────────────────────────

interface TokenBucket {
  tokens: number;
  lastRefillMs: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __freiaRateBuckets: Map<string, TokenBucket> | undefined;
}

const BUCKET_CAPACITY = 50; // max burst
const REFILL_RATE = 50; // tokens per second
const REFILL_INTERVAL_MS = 1000;

function getBucket(phoneNumberId: string): TokenBucket {
  globalThis.__freiaRateBuckets ??= new Map();
  if (!globalThis.__freiaRateBuckets.has(phoneNumberId)) {
    globalThis.__freiaRateBuckets.set(phoneNumberId, {
      tokens: BUCKET_CAPACITY,
      lastRefillMs: Date.now(),
    });
  }
  return globalThis.__freiaRateBuckets.get(phoneNumberId)!;
}

function consumeToken(phoneNumberId: string): boolean {
  const bucket = getBucket(phoneNumberId);
  const now = Date.now();
  const elapsed = now - bucket.lastRefillMs;

  if (elapsed >= REFILL_INTERVAL_MS) {
    const cycles = Math.floor(elapsed / REFILL_INTERVAL_MS);
    bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + cycles * REFILL_RATE);
    bucket.lastRefillMs = now;
  }

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class WhatsAppSendError extends Error {
  readonly code:
    | "rate_limited"
    | "api_error"
    | "network_error"
    | "retries_exhausted";
  readonly httpStatus?: number;
  readonly waErrorCode?: number;
  readonly attempts: number;

  constructor(
    message: string,
    code: WhatsAppSendError["code"],
    attempts: number,
    httpStatus?: number,
    waErrorCode?: number
  ) {
    super(message);
    this.name = "WhatsAppSendError";
    this.code = code;
    this.attempts = attempts;
    this.httpStatus = httpStatus;
    this.waErrorCode = waErrorCode;
  }
}

// ─── WhatsApp Cloud API types ─────────────────────────────────────────────────

const GRAPH_API_VERSION = "v18.0";

interface WAMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface WAErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id?: string;
  };
}

function isRetryableStatus(httpStatus: number): boolean {
  return httpStatus === 429 || httpStatus >= 500;
}

// ─── Single send ──────────────────────────────────────────────────────────────

/**
 * Sends a single text message via the WhatsApp Cloud API.
 * Throws `WhatsAppSendError` on any failure.
 */
export async function sendWhatsAppText(
  to: string,
  text: string,
  phoneNumberId: string,
  accessToken: string
): Promise<{ messageId: string }> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
  } catch (err) {
    throw new WhatsAppSendError(
      `Network error: ${err instanceof Error ? err.message : "unknown"}`,
      "network_error",
      1
    );
  }

  if (!response.ok) {
    let errorBody: WAErrorResponse | null = null;
    try {
      errorBody = (await response.json()) as WAErrorResponse;
    } catch {
      // ignore parse error
    }

    throw new WhatsAppSendError(
      errorBody?.error?.message ?? `HTTP ${response.status}`,
      response.status === 429 ? "rate_limited" : "api_error",
      1,
      response.status,
      errorBody?.error?.code
    );
  }

  const body = (await response.json()) as WAMessageResponse;
  const messageId = body.messages?.[0]?.id;

  if (!messageId) {
    throw new WhatsAppSendError(
      "No message ID in API response",
      "api_error",
      1,
      response.status
    );
  }

  return { messageId };
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [1000, 2000, 4000]; // exponential backoff

export interface SendResult {
  messageId: string;
  attempts: number;
}

/**
 * Sends a WhatsApp text message with exponential backoff retries.
 *
 * Retries on: HTTP 429, HTTP 5xx, network errors.
 * Does NOT retry on: HTTP 4xx (except 429), token bucket empty.
 *
 * @throws {WhatsAppSendError} when all attempts are exhausted or a non-retryable error occurs
 */
export async function sendWhatsAppTextWithRetry(
  to: string,
  text: string,
  phoneNumberId: string,
  accessToken: string,
  maxRetries = 3
): Promise<SendResult> {
  if (!consumeToken(phoneNumberId)) {
    throw new WhatsAppSendError(
      "Rate limit exceeded — token bucket empty",
      "rate_limited",
      0
    );
  }

  const delays = RETRY_DELAYS_MS.slice(0, maxRetries - 1);
  let lastError: WhatsAppSendError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendWhatsAppText(to, text, phoneNumberId, accessToken);
      return { messageId: result.messageId, attempts: attempt };
    } catch (err) {
      const sendError =
        err instanceof WhatsAppSendError
          ? err
          : new WhatsAppSendError(
              err instanceof Error ? err.message : "unknown error",
              "api_error",
              attempt
            );

      lastError = new WhatsAppSendError(
        sendError.message,
        sendError.code,
        attempt,
        sendError.httpStatus,
        sendError.waErrorCode
      );

      const shouldRetry =
        attempt < maxRetries &&
        (sendError.code === "rate_limited" ||
          sendError.code === "network_error" ||
          (sendError.httpStatus !== undefined &&
            isRetryableStatus(sendError.httpStatus)));

      if (!shouldRetry) break;

      const delay = delays[attempt - 1] ?? 4000;
      console.warn(
        `[WhatsApp Sender] Attempt ${attempt}/${maxRetries} failed (${sendError.code}). Retrying in ${delay}ms…`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new WhatsAppSendError(
    lastError?.message ?? "All retries exhausted",
    "retries_exhausted",
    maxRetries,
    lastError?.httpStatus,
    lastError?.waErrorCode
  );
}

// ─── Template messaging ───────────────────────────────────────────────────────

/** A single variable substitution inside a template component. */
export interface WATemplateParameter {
  type: "text";
  text: string;
}

/**
 * A template component (header, body, or button) with its resolved parameters.
 * Each {{n}} variable in the template must be filled via a "text" parameter.
 */
export interface WATemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url";
  /** Required for button components — 0-based index of the button */
  index?: number;
  parameters: WATemplateParameter[];
}

/**
 * Sends a WhatsApp template message via the Cloud API.
 *
 * Use this for conversations that are outside the 24-hour window —
 * the template must be pre-approved by Meta before it can be sent.
 *
 * Unlike sendWhatsAppTextWithRetry, this function makes a single attempt.
 * Template sends rarely fail transiently; callers should handle errors explicitly.
 *
 * @throws {WhatsAppSendError} on any API or network failure
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  components: WATemplateComponent[],
  phoneNumberId: string,
  accessToken: string
): Promise<{ messageId: string }> {
  if (!consumeToken(phoneNumberId)) {
    throw new WhatsAppSendError(
      "Rate limit exceeded — token bucket empty",
      "rate_limited",
      0
    );
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });
  } catch (err) {
    throw new WhatsAppSendError(
      `Network error: ${err instanceof Error ? err.message : "unknown"}`,
      "network_error",
      1
    );
  }

  if (!response.ok) {
    let errorBody: WAErrorResponse | null = null;
    try {
      errorBody = (await response.json()) as WAErrorResponse;
    } catch {
      // ignore
    }
    throw new WhatsAppSendError(
      errorBody?.error?.message ?? `HTTP ${response.status}`,
      response.status === 429 ? "rate_limited" : "api_error",
      1,
      response.status,
      errorBody?.error?.code
    );
  }

  const body = (await response.json()) as WAMessageResponse;
  const messageId = body.messages?.[0]?.id;

  if (!messageId) {
    throw new WhatsAppSendError(
      "No message ID in API response",
      "api_error",
      1,
      response.status
    );
  }

  return { messageId };
}
