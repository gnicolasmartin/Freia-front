/**
 * /api/webhooks/whatsapp/status
 *
 * GET — Returns which required environment variables are configured.
 *       Used by the Channels settings page to show configuration health.
 *
 * Does NOT return the actual values — only boolean presence flags.
 */

import { NextResponse } from "next/server";

export async function GET(): Promise<Response> {
  return NextResponse.json({
    verifyTokenConfigured: !!process.env.WHATSAPP_VERIFY_TOKEN,
    appSecretConfigured: !!process.env.WHATSAPP_APP_SECRET,
    queueDepth: 0,
  });
}
