/**
 * email-sender.ts
 *
 * SMTP outbound email sender.
 * - Token bucket rate limiter (10 emails/sec per SMTP account)
 * - Exponential backoff retries for transient SMTP errors
 * - Pure async functions — no React dependencies, safe for API routes
 *
 * Environment variables (server-side):
 *   EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASS,
 *   EMAIL_FROM_ADDRESS, EMAIL_SENDER_NAME
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// ─── Rate limiter ────────────────────────────────────────────────────────────

interface TokenBucket {
  tokens: number;
  lastRefillMs: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __freiaEmailRateBuckets: Map<string, TokenBucket> | undefined;
}

const BUCKET_CAPACITY = 10;
const REFILL_RATE = 10;
const REFILL_INTERVAL_MS = 1000;

function getBucket(accountKey: string): TokenBucket {
  globalThis.__freiaEmailRateBuckets ??= new Map();
  if (!globalThis.__freiaEmailRateBuckets.has(accountKey)) {
    globalThis.__freiaEmailRateBuckets.set(accountKey, {
      tokens: BUCKET_CAPACITY,
      lastRefillMs: Date.now(),
    });
  }
  return globalThis.__freiaEmailRateBuckets.get(accountKey)!;
}

function consumeToken(accountKey: string): boolean {
  const bucket = getBucket(accountKey);
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

// ─── Transport cache ─────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __freiaEmailTransports: Map<string, Transporter> | undefined;
}

function getOrCreateTransport(
  host: string,
  port: number,
  secure: boolean,
  user: string,
  pass: string
): Transporter {
  const key = `${host}:${port}:${user}`;
  globalThis.__freiaEmailTransports ??= new Map();
  if (!globalThis.__freiaEmailTransports.has(key)) {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
    });
    globalThis.__freiaEmailTransports.set(key, transport);
  }
  return globalThis.__freiaEmailTransports.get(key)!;
}

// ─── Error type ──────────────────────────────────────────────────────────────

export class EmailSendError extends Error {
  readonly code:
    | "rate_limited"
    | "smtp_error"
    | "network_error"
    | "retries_exhausted"
    | "auth_error";
  readonly attempts: number;
  readonly smtpCode?: string;

  constructor(
    message: string,
    code: EmailSendError["code"],
    attempts: number,
    smtpCode?: string
  ) {
    super(message);
    this.name = "EmailSendError";
    this.code = code;
    this.attempts = attempts;
    this.smtpCode = smtpCode;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Derive `secure` from port number. 465 uses implicit TLS; other ports use STARTTLS. */
export function deriveSecure(port: number): boolean {
  return port === 465;
}

function isRetryableSmtpError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // Transient: connection reset, timeout, temporary failure
  if (msg.includes("econnreset") || msg.includes("timeout") || msg.includes("etimedout")) return true;
  // SMTP 4xx codes are transient
  const codeMatch = msg.match(/\b(4\d{2})\b/);
  if (codeMatch) return true;
  return false;
}

function isAuthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes("535") || msg.includes("auth") || msg.includes("credential");
}

// ─── Single send ─────────────────────────────────────────────────────────────

export interface SendEmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromAddress: string;
  senderName: string;
}

export async function sendEmail(
  params: SendEmailParams
): Promise<{ messageId: string }> {
  const transport = getOrCreateTransport(
    params.host,
    params.port,
    params.secure,
    params.username,
    params.password
  );

  try {
    const info = await transport.sendMail({
      from: `"${params.senderName}" <${params.fromAddress}>`,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      replyTo: params.replyTo,
    });
    return { messageId: info.messageId };
  } catch (err) {
    if (isAuthError(err)) {
      throw new EmailSendError(
        err instanceof Error ? err.message : "Authentication failed",
        "auth_error",
        1
      );
    }
    throw new EmailSendError(
      err instanceof Error ? err.message : "SMTP error",
      "smtp_error",
      1,
      (err as { code?: string }).code
    );
  }
}

// ─── Retry wrapper ───────────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [1000, 2000, 4000];

export interface EmailSendResult {
  messageId: string;
  attempts: number;
}

export async function sendEmailWithRetry(
  params: SendEmailParams,
  maxRetries = 3
): Promise<EmailSendResult> {
  const accountKey = `${params.host}:${params.username}`;
  if (!consumeToken(accountKey)) {
    throw new EmailSendError(
      "Rate limit exceeded — token bucket empty",
      "rate_limited",
      0
    );
  }

  const delays = RETRY_DELAYS_MS.slice(0, maxRetries - 1);
  let lastError: EmailSendError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendEmail(params);
      return { messageId: result.messageId, attempts: attempt };
    } catch (err) {
      const sendError =
        err instanceof EmailSendError
          ? err
          : new EmailSendError(
              err instanceof Error ? err.message : "unknown error",
              "smtp_error",
              attempt
            );

      lastError = new EmailSendError(
        sendError.message,
        sendError.code,
        attempt,
        sendError.smtpCode
      );

      // Don't retry auth errors or non-transient SMTP errors
      const shouldRetry =
        attempt < maxRetries &&
        sendError.code !== "auth_error" &&
        (sendError.code === "rate_limited" ||
          sendError.code === "network_error" ||
          isRetryableSmtpError(err));

      if (!shouldRetry) break;

      const delay = delays[attempt - 1] ?? 4000;
      console.warn(
        `[Email Sender] Attempt ${attempt}/${maxRetries} failed (${sendError.code}). Retrying in ${delay}ms…`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new EmailSendError(
    lastError?.message ?? "All retries exhausted",
    "retries_exhausted",
    maxRetries,
    lastError?.smtpCode
  );
}

// ─── Test connection ─────────────────────────────────────────────────────────

export async function testSmtpConnection(
  host: string,
  port: number,
  secure: boolean,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user: username, pass: password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
    });
    await transport.verify();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}
