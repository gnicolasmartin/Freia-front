/**
 * POST /api/debug/test-send
 * Sends a REAL WhatsApp message using the server-side sendFn
 * to verify credentials and API connectivity.
 *
 * Body: { to: string, text?: string }
 */

import { type NextRequest, NextResponse } from "next/server";
import { buildServerSendFn } from "@/lib/server-send-fn";

const API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function POST(request: NextRequest): Promise<Response> {
  const steps: Record<string, unknown> = {};

  try {
    const body = (await request.json()) as { to?: string; text?: string };
    const to = body.to ?? "5491160527827";
    const text = body.text ?? "Test from Freia server-side pipeline";

    const companyId = process.env.FREIA_COMPANY_ID ?? "default";

    // Resolve credentials from config blob
    let phoneNumberId = "";
    let accessToken = "";

    try {
      const configRes = await fetch(
        `${API_URL}/processing-config/${encodeURIComponent(companyId)}`
      );
      if (configRes.ok) {
        const configData = (await configRes.json()) as { config: Record<string, unknown> | null };
        if (configData.config?.waCredentials) {
          const creds = configData.config.waCredentials as { phoneNumberId?: string; accessToken?: string };
          phoneNumberId = creds.phoneNumberId ?? "";
          accessToken = creds.accessToken ?? "";
          steps.credentialSource = "config blob";
        }
      }
    } catch (err) {
      steps.configError = String(err);
    }

    // Fallback to env vars
    if (!accessToken) {
      phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
      accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
      steps.credentialSource = "env vars";
    }

    steps.credentials = {
      phoneNumberId: phoneNumberId || "(missing)",
      accessToken: accessToken ? `${accessToken.slice(0, 10)}...` : "(missing)",
    };

    if (!phoneNumberId || !accessToken) {
      steps.error = "No WA credentials available";
      return NextResponse.json(steps, { status: 200 });
    }

    // Build sendFn and send
    const sendFn = buildServerSendFn(phoneNumberId, accessToken);
    steps.sending = { to, text: text.slice(0, 100) };

    const result = await sendFn(to, text, null, false);
    steps.result = result;

    return NextResponse.json(steps, { status: 200 });
  } catch (err) {
    steps.error = String(err);
    steps.stack = (err as Error).stack?.slice(0, 500);
    return NextResponse.json(steps, { status: 500 });
  }
}
