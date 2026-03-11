/**
 * /api/webhooks/whatsapp
 *
 * Handles the two sides of the WhatsApp Cloud API webhook contract:
 *
 *  GET  — Verification handshake (Meta calls this once when you register the webhook).
 *  POST — Incoming events (messages, status updates).
 *         MUST respond 200 within 5 s or Meta retries (causing duplicates).
 *         Heavy processing runs in after() — keeps the function alive but
 *         sends 200 immediately.
 *
 * Environment variables required:
 *   WHATSAPP_VERIFY_TOKEN   — Must match the token configured in Meta Business Manager.
 *   WHATSAPP_APP_SECRET     — Used to validate X-Hub-Signature-256 on POST requests.
 *                             Optional: if not set, signature validation is skipped
 *                             (not recommended for production).
 */

import { type NextRequest, NextResponse, after } from "next/server";
import {
  verifyHandshake,
  verifySignature,
  parseWhatsAppPayload,
  extractPhoneNumberId,
} from "@/lib/whatsapp-webhook";
import { lookupByPhoneNumberId, lookupByCompanyId } from "@/lib/credential-lookup";
import type { MessageReceivedEvent } from "@/types/webhook-event";
import type { ActiveConversation } from "@/lib/message-processor";
import { processInboundMessage } from "@/lib/message-processor";
import { buildServerSendFn } from "@/lib/server-send-fn";

// Allow up to 55s for cold-start backends (Render free tier sleeps after 15 min)
export const maxDuration = 55;

const API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

/** Fetch with timeout + single retry (handles backend cold starts). */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs = 25_000
): Promise<globalThis.Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      if (attempt === 0) {
        console.warn(`[WhatsApp Webhook] Backend fetch attempt 1 failed, retrying in 3s...`);
        await new Promise((r) => setTimeout(r, 3_000));
      } else {
        throw err;
      }
    }
  }
  throw new Error("fetchWithRetry: unreachable");
}

// ─── GET — Webhook verification handshake ───────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Log GET hits for debugging
  void saveBreadcrumbs([{
    step: "GET_hit",
    ts: 0,
    detail: { mode, hasToken: !!token, hasChallenge: !!challenge, url: request.url },
  }]);

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expectedToken) {
    console.error(
      "[WhatsApp Webhook] WHATSAPP_VERIFY_TOKEN is not configured."
    );
    return new NextResponse("Webhook not configured", { status: 503 });
  }

  const challengeResponse = verifyHandshake(mode, token, challenge, expectedToken);

  if (challengeResponse !== null) {
    // Meta requires the challenge echoed as plain text with 200
    return new NextResponse(challengeResponse, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[WhatsApp Webhook] Handshake failed — token mismatch or missing params.", {
    mode,
    tokenMatch: token === expectedToken,
    hasChallenge: !!challenge,
  });
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── Breadcrumb logging (persists to backend for debugging) ─────────────────

interface Breadcrumb {
  step: string;
  ts: number;
  detail?: unknown;
}

async function saveBreadcrumbs(crumbs: Breadcrumb[]): Promise<void> {
  try {
    // Read existing log to append (keep last 10 hits)
    let history: Array<{ time: string; crumbs: Breadcrumb[] }> = [];
    try {
      const existing = await fetch(
        `${API_URL}/processing-config/__webhook_log__`,
        { signal: AbortSignal.timeout(3_000) }
      );
      if (existing.ok) {
        const data = (await existing.json()) as { config?: { hits?: typeof history } };
        if (data.config?.hits) {
          history = data.config.hits;
        }
      }
    } catch {
      // Ignore — start fresh
    }

    history.push({ time: new Date().toISOString(), crumbs });
    // Keep only last 30
    if (history.length > 30) history = history.slice(-30);

    await fetch(`${API_URL}/processing-config/__webhook_log__`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: { hits: history },
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Best effort — don't block the webhook
  }
}

// ─── POST — Incoming events ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  // ── Phase 1: Validate & parse (must be fast — respond 200 within 5s) ─────

  // Read raw body
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }

  // Parse JSON
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad Request: invalid JSON", { status: 400 });
  }

  // Multi-tenant: extract phone_number_id and lookup company credentials
  const phoneNumberId = extractPhoneNumberId(payload);
  let companyId: string | undefined;

  if (phoneNumberId) {
    const credentials = await lookupByPhoneNumberId(phoneNumberId);
    if (credentials) {
      companyId = credentials.companyId;

      // Use company-specific app_secret for signature validation if available
      if (credentials.appSecret) {
        const signatureHeader = request.headers.get("X-Hub-Signature-256") ?? "";
        if (!verifySignature(rawBody, signatureHeader, credentials.appSecret)) {
          console.warn(`[WhatsApp Webhook] Signature validation failed for company=${companyId}`);
          return new NextResponse("Unauthorized", { status: 401 });
        }
      }
    }
  }

  // Fallback: global signature validation via env var
  if (!companyId) {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const signatureHeader = request.headers.get("X-Hub-Signature-256") ?? "";
      if (!verifySignature(rawBody, signatureHeader, appSecret)) {
        console.warn("[WhatsApp Webhook] Signature validation failed — possible spoofed request.");
        return new NextResponse("Unauthorized", { status: 401 });
      }
    }
  }

  // Normalize to internal channel events
  const events = parseWhatsAppPayload(payload);

  // Attach companyId to events
  if (companyId) {
    for (const event of events) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event as any).companyId = companyId;
    }
  }

  // ── Phase 2: Respond 200 immediately, process in background ──────────────
  // Meta retries if it doesn't get 200 within ~5s.
  // Processing (ingest + flow execution + LLM calls) takes 5-15s.
  // after() keeps the function alive but sends the response immediately.

  const capturedCompanyId = companyId;
  const capturedPhoneNumberId = phoneNumberId;

  after(async () => {
    const crumbs: Breadcrumb[] = [];
    const t0 = Date.now();

    crumbs.push({
      step: "after_start",
      ts: 0,
      detail: {
        eventCount: events.length,
        types: events.map(e => e.type),
        companyId: capturedCompanyId,
        phoneNumberId: capturedPhoneNumberId,
      },
    });

    // ── Step 1: Ingest events into backend DB ─────────────────────────────
    let ingested = 0;
    for (const event of events) {
      try {
        const res = await fetchWithRetry(`${API_URL}/events/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });

        if (res.ok) {
          const data = (await res.json()) as { stored: boolean };
          if (data.stored) ingested++;
        } else {
          console.warn(`[WhatsApp Webhook] Backend ingest failed: ${res.status}`);
        }
      } catch (err) {
        console.error("[WhatsApp Webhook] Failed to send event to backend:", err);
      }
    }

    if (ingested > 0) {
      console.info(
        `[WhatsApp Webhook] Ingested ${ingested} event(s) for company=${capturedCompanyId ?? "unknown"}:`,
        events.map((e) => `${e.type}(${e.id.slice(0, 8)})`).join(", ")
      );
    }

    // ── Step 2: Server-side processing of message events ──────────────────
    const messageEvents = events.filter(
      (e): e is MessageReceivedEvent => e.type === "channel.message.received"
    );

    crumbs.push({ step: "message_events", ts: Date.now() - t0, detail: { count: messageEvents.length } });

    if (messageEvents.length === 0) {
      crumbs.push({ step: "done_no_messages", ts: Date.now() - t0 });
      await saveBreadcrumbs(crumbs);
      return;
    }

    // Resolve company for config + credentials
    const resolvedCompanyId = capturedCompanyId ?? process.env.FREIA_COMPANY_ID ?? "default";

    // Fetch processing config from backend (try resolved companyId, then fallbacks)
    let configBlob: Record<string, unknown> | null = null;
    let configCompanyId = resolvedCompanyId;

    const companyIdsToTry = [resolvedCompanyId];
    const envCompanyId = process.env.FREIA_COMPANY_ID;
    if (envCompanyId && envCompanyId !== resolvedCompanyId) {
      companyIdsToTry.push(envCompanyId);
    }
    if (!companyIdsToTry.includes("default")) {
      companyIdsToTry.push("default");
    }

    for (const tryId of companyIdsToTry) {
      try {
        const configRes = await fetchWithRetry(
          `${API_URL}/processing-config/${encodeURIComponent(tryId)}`,
          { method: "GET" }
        );
        if (configRes.ok) {
          const configData = (await configRes.json()) as {
            config: Record<string, unknown> | null;
          };
          if (configData.config) {
            configBlob = configData.config;
            configCompanyId = tryId;
            break;
          }
        }
      } catch (err) {
        console.warn(`[WhatsApp Webhook] Failed to fetch config for ${tryId}:`, err);
      }
    }

    crumbs.push({ step: "config_fetched", ts: Date.now() - t0, detail: { hasConfig: !!configBlob, configCompanyId, triedIds: companyIdsToTry } });

    if (!configBlob) {
      console.warn(
        `[WhatsApp Webhook] No processing config found (tried: ${companyIdsToTry.join(", ")}), skipping`
      );
      crumbs.push({ step: "done_no_config", ts: Date.now() - t0 });
      await saveBreadcrumbs(crumbs);
      return;
    }

    // Resolve WhatsApp credentials for sending
    let waPhoneNumberId = capturedPhoneNumberId ?? "";
    let waAccessToken = "";

    // 1. Try multi-tenant lookup from backend channel_configs table
    if (capturedCompanyId) {
      const creds = await lookupByCompanyId(capturedCompanyId);
      if (creds) {
        waPhoneNumberId = creds.phoneNumberId;
        waAccessToken = creds.accessToken;
      }
    }

    // 2. Fallback: credentials synced in config blob (from browser localStorage)
    if (!waAccessToken && configBlob.waCredentials) {
      const synced = configBlob.waCredentials as { phoneNumberId?: string; accessToken?: string };
      if (synced.phoneNumberId && synced.accessToken) {
        waPhoneNumberId = synced.phoneNumberId;
        waAccessToken = synced.accessToken;
      }
    }

    // 3. Fallback: env vars
    if (!waAccessToken) {
      waPhoneNumberId = waPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "";
      waAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
    }

    crumbs.push({ step: "wa_creds", ts: Date.now() - t0, detail: { hasPhone: !!waPhoneNumberId, hasToken: !!waAccessToken } });

    if (!waPhoneNumberId || !waAccessToken) {
      console.warn("[WhatsApp Webhook] No WA credentials for server-side send, skipping");
      crumbs.push({ step: "done_no_creds", ts: Date.now() - t0 });
      await saveBreadcrumbs(crumbs);
      return;
    }

    // Fetch active conversations from backend
    const activeConversations = new Map<string, ActiveConversation>();
    try {
      const convRes = await fetchWithRetry(
        `${API_URL}/conversations/active/${encodeURIComponent(configCompanyId)}`,
        { method: "GET" }
      );
      if (convRes.ok) {
        const convData = (await convRes.json()) as {
          conversations: Array<{ contactPhone: string; snapshot: ActiveConversation }>;
        };
        for (const c of convData.conversations) {
          if (c.contactPhone && c.snapshot) {
            activeConversations.set(c.contactPhone, c.snapshot);
          }
        }
      }
    } catch (err) {
      console.warn("[WhatsApp Webhook] Failed to fetch conversations:", err);
    }

    const sendFn = buildServerSendFn(waPhoneNumberId, waAccessToken);

    crumbs.push({
      step: "conversations_loaded",
      ts: Date.now() - t0,
      detail: {
        count: activeConversations.size,
        phones: [...activeConversations.keys()].map(p => p.slice(-4)),
        hasOpenaiKeyInConfig: !!configBlob.openaiApiKey,
        codeVersion: "v3",
      },
    });

    // Process each message event
    for (const event of messageEvents) {
      // Atomically claim the event so no other processor handles it
      let claimed = false;
      try {
        const claimRes = await fetchWithRetry(
          `${API_URL}/events/claim/${encodeURIComponent(event.messageId)}`,
          { method: "POST", headers: { "Content-Type": "application/json" } }
        );
        if (claimRes.ok) {
          const claimData = (await claimRes.json()) as { claimed: boolean };
          claimed = claimData.claimed;
        }
      } catch (err) {
        crumbs.push({ step: "claim_error", ts: Date.now() - t0, detail: String(err) });
      }

      crumbs.push({ step: "claim", ts: Date.now() - t0, detail: { claimed, messageId: event.messageId.slice(0, 20) } });

      if (!claimed) {
        console.info(`[WhatsApp Webhook] Could not claim event ${event.messageId.slice(0, 12)}, skipping`);
        continue;
      }

      try {
        const result = await processInboundMessage({
          event,
          activeConversations,
          routingConfig: configBlob.routingConfig as import("@/types/routing").RoutingConfig,
          agents: (configBlob.agents ?? []) as import("@/types/agent").Agent[],
          flows: (configBlob.flows ?? []) as import("@/types/flow").Flow[],
          policies: (configBlob.policies ?? []) as import("@/types/policy").Policy[],
          tools: (configBlob.tools ?? []) as import("@/types/tool-registry").ToolDefinition[],
          products: (configBlob.products ?? []) as Record<string, unknown>[],
          openaiApiKey: (configBlob.openaiApiKey as string) || undefined,
          waCredentials: {
            phoneNumberId: waPhoneNumberId,
            accessToken: waAccessToken,
            companyId: capturedCompanyId,
          },
          testMode: false,
          sendFn,
          businessHoursConfig: configBlob.businessHoursConfig as
            | import("@/types/business-hours").BusinessHoursConfig
            | undefined,
          calendarData: configBlob.calendarData as
            | { calendars: unknown[]; resources: unknown[]; bookings: unknown[]; blocks: unknown[]; minStayRules: unknown[] }
            | undefined,
        });

        // Check if conversation was resumed (had existing state)
        const convForPhone = activeConversations.get(event.from);

        crumbs.push({
          step: "process_result",
          ts: Date.now() - t0,
          detail: {
            codeVersion: "v3",
            openaiKeyPassed: (configBlob.openaiApiKey as string) ? "from_config" : "none",
            hasCalendarData: !!(configBlob.calendarData as Record<string, unknown> | undefined),
            hadExistingConv: !!convForPhone,
            existingConvAgent: convForPhone?.simulationOptions?.agent ? "SET" : "none",
            existingConvApiKey: convForPhone?.simulationOptions?.agentApiKey ? "SET" : "none",
            success: result.success,
            error: result.error,
            agentName: result.agentName,
            flowId: result.flowId?.slice(0, 12),
            responses: result.responseTexts.length,
            responseSnippets: result.responseTexts.map(t => t.slice(0, 80)),
            conversationEnded: result.conversationEnded,
            hasUpdatedConversation: !!result.updatedConversation,
            simStatus: result.updatedConversation?.simulationState?.status,
          },
        });

        if (result.success) {
          // Save updated conversation to backend
          if (result.updatedConversation) {
            activeConversations.set(event.from, result.updatedConversation);
            try {
              await fetchWithRetry(
                `${API_URL}/conversations/active/${encodeURIComponent(configCompanyId)}/${encodeURIComponent(event.from)}`,
                {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ snapshot: result.updatedConversation }),
                }
              );
            } catch (err) {
              console.warn("[WhatsApp Webhook] Failed to save conversation:", err);
            }
          } else if (result.conversationEnded) {
            activeConversations.delete(event.from);
            try {
              await fetchWithRetry(
                `${API_URL}/conversations/active/${encodeURIComponent(configCompanyId)}/${encodeURIComponent(event.from)}`,
                { method: "DELETE" }
              );
            } catch {
              // Best effort
            }
          }

          // Mark event as processed
          try {
            await fetchWithRetry(
              `${API_URL}/events/mark-processed/${encodeURIComponent(event.messageId)}`,
              { method: "POST", headers: { "Content-Type": "application/json" } }
            );
          } catch {
            // Best effort
          }

          console.info(
            `[WhatsApp Webhook] Server processed: from=${event.from}, ` +
              `agent=${result.agentName ?? "none"}, ` +
              `responses=${result.responseTexts.length}, ` +
              `ended=${result.conversationEnded ?? false}`
          );
        } else {
          console.warn(`[WhatsApp Webhook] Server processing failed: ${result.error}`);
          // Release claim
          try {
            await fetchWithRetry(
              `${API_URL}/events/release/${encodeURIComponent(event.messageId)}`,
              { method: "POST", headers: { "Content-Type": "application/json" } }
            );
          } catch {
            // Best effort
          }
        }
      } catch (err) {
        console.error("[WhatsApp Webhook] Server processing error:", err);
        // Release claim on error
        try {
          await fetchWithRetry(
            `${API_URL}/events/release/${encodeURIComponent(event.messageId)}`,
            { method: "POST", headers: { "Content-Type": "application/json" } }
          );
        } catch {
          // Best effort
        }
      }
    }

    crumbs.push({ step: "done", ts: Date.now() - t0 });
    await saveBreadcrumbs(crumbs);
  });

  // Respond 200 immediately — Meta won't retry
  return new NextResponse("OK v3", { status: 200 });
}
