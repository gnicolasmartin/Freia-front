/**
 * POST /api/debug/test-process
 * Runs the server-side processing pipeline synchronously (no after())
 * to diagnose where it fails.
 *
 * Body: { messageText: string, from: string }
 */

import { type NextRequest, NextResponse } from "next/server";
import { lookupByCompanyId } from "@/lib/credential-lookup";
import type { MessageReceivedEvent } from "@/types/webhook-event";
import type { ActiveConversation } from "@/lib/message-processor";
import { processInboundMessage } from "@/lib/message-processor";
import { buildServerSendFn } from "@/lib/server-send-fn";

const API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function POST(request: NextRequest): Promise<Response> {
  const steps: Record<string, unknown> = {};
  const companyId = process.env.FREIA_COMPANY_ID ?? "default";

  try {
    const body = (await request.json()) as { messageText?: string; from?: string };
    const messageText = body.messageText ?? "Hola";
    const from = body.from ?? "5491100000000";
    steps.input = { messageText, from, companyId };

    // Step 1: Fetch config
    steps.step1 = "Fetching config...";
    const configRes = await fetch(
      `${API_URL}/processing-config/${encodeURIComponent(companyId)}`
    );
    if (!configRes.ok) {
      steps.step1 = { error: `Config fetch failed: HTTP ${configRes.status}` };
      return NextResponse.json(steps, { status: 200 });
    }
    const configData = (await configRes.json()) as { config: Record<string, unknown> | null };
    if (!configData.config) {
      steps.step1 = { error: "Config is null" };
      return NextResponse.json(steps, { status: 200 });
    }
    const configBlob = configData.config;
    steps.step1 = {
      ok: true,
      agents: Array.isArray(configBlob.agents) ? (configBlob.agents as unknown[]).length : 0,
      flows: Array.isArray(configBlob.flows) ? (configBlob.flows as unknown[]).length : 0,
      hasRouting: !!configBlob.routingConfig,
    };

    // Step 2: Resolve WA credentials
    steps.step2 = "Resolving WA credentials...";
    let waPhoneNumberId = "";
    let waAccessToken = "";

    if (configBlob.waCredentials) {
      const synced = configBlob.waCredentials as { phoneNumberId?: string; accessToken?: string };
      if (synced.phoneNumberId && synced.accessToken) {
        waPhoneNumberId = synced.phoneNumberId;
        waAccessToken = synced.accessToken;
      }
    }
    if (!waAccessToken) {
      waPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
      waAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
    }

    steps.step2 = {
      phoneNumberId: waPhoneNumberId || "(missing)",
      accessToken: waAccessToken ? "SET" : "(missing)",
      source: configBlob.waCredentials ? "config blob" : "env vars",
    };

    if (!waPhoneNumberId || !waAccessToken) {
      steps.step2 = { ...steps.step2 as object, error: "No WA credentials" };
      return NextResponse.json(steps, { status: 200 });
    }

    // Step 3: Fetch conversations
    steps.step3 = "Fetching conversations...";
    const activeConversations = new Map<string, ActiveConversation>();
    try {
      const convRes = await fetch(
        `${API_URL}/conversations/active/${encodeURIComponent(companyId)}`
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
      steps.step3 = { ok: true, count: activeConversations.size };
    } catch (err) {
      steps.step3 = { error: String(err) };
    }

    // Step 4: Build mock event and process (DRY RUN - no actual WA send)
    steps.step4 = "Processing message (dry run, no actual send)...";
    const mockEvent: MessageReceivedEvent = {
      id: `test_${Date.now()}`,
      type: "channel.message.received",
      channel: "whatsapp",
      timestamp: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      messageId: `wamid.test.${Date.now()}`,
      from,
      phoneNumberId: waPhoneNumberId,
      wabaId: "",
      contactName: "Test User",
      content: { type: "text", text: messageText },
      raw: {},
    };

    // Dry-run sendFn: captures what would be sent
    const sentMessages: Array<{ to: string; text: string; interactive?: unknown }> = [];
    const dryRunSendFn = async (
      to: string,
      text: string,
      _creds: unknown,
      _testMode: boolean,
      interactive?: unknown
    ) => {
      sentMessages.push({ to, text: text.slice(0, 200), interactive });
      return { success: true, messageId: `dry_${Date.now()}` };
    };

    try {
      const result = await processInboundMessage({
        event: mockEvent,
        activeConversations,
        routingConfig: configBlob.routingConfig as import("@/types/routing").RoutingConfig,
        agents: (configBlob.agents ?? []) as import("@/types/agent").Agent[],
        flows: (configBlob.flows ?? []) as import("@/types/flow").Flow[],
        policies: (configBlob.policies ?? []) as import("@/types/policy").Policy[],
        tools: (configBlob.tools ?? []) as import("@/types/tool-registry").ToolDefinition[],
        products: (configBlob.products ?? []) as Record<string, unknown>[],
        openaiApiKey: (configBlob.openaiApiKey as string) ?? undefined,
        waCredentials: { phoneNumberId: waPhoneNumberId, accessToken: waAccessToken },
        testMode: false,
        sendFn: dryRunSendFn,
        businessHoursConfig: configBlob.businessHoursConfig as
          | import("@/types/business-hours").BusinessHoursConfig
          | undefined,
      });

      steps.step4 = {
        success: result.success,
        error: result.error,
        agentName: result.agentName,
        flowId: result.flowId,
        responseCount: result.responseTexts.length,
        responses: result.responseTexts.map((t) => t.slice(0, 200)),
        conversationEnded: result.conversationEnded,
        sentMessages,
        routingDecision: result.routingDecision,
      };
    } catch (err) {
      steps.step4 = { error: String(err), stack: (err as Error).stack?.slice(0, 500) };
    }

    return NextResponse.json(steps, { status: 200 });
  } catch (err) {
    steps.fatalError = { error: String(err), stack: (err as Error).stack?.slice(0, 500) };
    return NextResponse.json(steps, { status: 500 });
  }
}
