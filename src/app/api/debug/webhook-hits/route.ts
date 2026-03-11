/**
 * GET /api/debug/webhook-hits
 * Reads the breadcrumb log stored by the webhook POST handler.
 * Shows whether Meta is actually hitting our endpoint and where
 * the request fails (if at all).
 */

import { NextResponse } from "next/server";

const API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(
      `${API_URL}/processing-config/__webhook_log__`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) {
      return NextResponse.json({
        message: "No webhook hits recorded yet (or backend unreachable)",
        status: res.status,
      });
    }

    const data = (await res.json()) as { config: unknown };
    return NextResponse.json({
      message: "Last webhook hit breadcrumbs",
      log: data.config,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
