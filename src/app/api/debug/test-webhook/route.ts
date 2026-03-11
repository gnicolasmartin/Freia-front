/**
 * POST /api/debug/test-webhook
 * Simulates a Meta webhook POST with a real-looking payload,
 * calling our own webhook handler internally to see what happens.
 *
 * Body: { from: string, text?: string }
 */

import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest): Promise<Response> {
  const body = (await request.json()) as { from?: string; text?: string };
  const from = body.from ?? "5491160527827";
  const text = body.text ?? "Hola";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "955634967642142";
  const wamid = `wamid.test.${Date.now()}`;

  // Build a Meta-like webhook payload
  const metaPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "test_waba",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15551234567",
                phone_number_id: phoneNumberId,
              },
              contacts: [
                {
                  profile: { name: "Test User" },
                  wa_id: from,
                },
              ],
              messages: [
                {
                  from,
                  id: wamid,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: text },
                  type: "text",
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };

  // Call our own webhook POST handler
  const origin = request.nextUrl.origin;
  const webhookUrl = `${origin}/api/webhooks/whatsapp`;

  const startTime = Date.now();
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metaPayload),
    });

    const elapsed = Date.now() - startTime;
    const responseText = await res.text();

    return NextResponse.json({
      webhookUrl,
      status: res.status,
      response: responseText,
      elapsed: `${elapsed}ms`,
      payload: {
        from,
        text,
        wamid,
        phoneNumberId,
      },
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    return NextResponse.json({
      webhookUrl,
      error: String(err),
      elapsed: `${elapsed}ms`,
    }, { status: 500 });
  }
}
