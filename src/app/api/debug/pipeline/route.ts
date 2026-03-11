/**
 * GET /api/debug/pipeline
 * Diagnostic endpoint to verify the server-side processing pipeline.
 * Tests each step: config fetch, credentials, conversations, claim.
 */

import { NextResponse } from "next/server";

const API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function GET(): Promise<Response> {
  const companyId = process.env.FREIA_COMPANY_ID ?? "default";
  const steps: Record<string, unknown> = {
    companyId,
    backendUrl: API_URL,
    envVars: {
      FREIA_COMPANY_ID: process.env.FREIA_COMPANY_ID ?? "(not set)",
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ? "SET" : "(not set)",
      WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ? "SET" : "(not set)",
      BACKEND_API_URL: process.env.BACKEND_API_URL ?? "(not set)",
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "(not set)",
    },
  };

  // Step 1: Check backend health
  try {
    const res = await fetch(`${API_URL}/events/pending`, { cache: "no-store" });
    steps.backendHealth = { status: res.status, ok: res.ok };
  } catch (err) {
    steps.backendHealth = { error: String(err) };
  }

  // Step 2: Fetch processing config
  try {
    const res = await fetch(
      `${API_URL}/processing-config/${encodeURIComponent(companyId)}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = (await res.json()) as { config: unknown; configHash: string };
      if (data.config && typeof data.config === "object") {
        const config = data.config as Record<string, unknown>;
        steps.processingConfig = {
          found: true,
          configHash: data.configHash,
          hasAgents: Array.isArray(config.agents) ? config.agents.length : false,
          hasFlows: Array.isArray(config.flows) ? config.flows.length : false,
          hasRoutingConfig: !!config.routingConfig,
          hasWaCredentials: !!config.waCredentials,
          hasOpenaiApiKey: !!config.openaiApiKey,
          waCredentials: config.waCredentials
            ? {
                phoneNumberId: (config.waCredentials as Record<string, string>).phoneNumberId ?? "(missing)",
                accessToken: (config.waCredentials as Record<string, string>).accessToken ? "SET" : "(missing)",
              }
            : null,
        };
      } else {
        steps.processingConfig = { found: false, rawResponse: data };
      }
    } else {
      steps.processingConfig = { found: false, status: res.status };
    }
  } catch (err) {
    steps.processingConfig = { error: String(err) };
  }

  // Step 3: Check active conversations
  try {
    const res = await fetch(
      `${API_URL}/conversations/active/${encodeURIComponent(companyId)}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = (await res.json()) as { conversations: unknown[] };
      steps.activeConversations = {
        count: data.conversations?.length ?? 0,
      };
    } else {
      steps.activeConversations = { status: res.status };
    }
  } catch (err) {
    steps.activeConversations = { error: String(err) };
  }

  // Step 4: Check recent events
  try {
    const res = await fetch(`${API_URL}/events/pending`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { count: number; events: unknown[] };
      steps.pendingEvents = { count: data.count };
    } else {
      steps.pendingEvents = { status: res.status };
    }
  } catch (err) {
    steps.pendingEvents = { error: String(err) };
  }

  return NextResponse.json(steps, { status: 200 });
}
