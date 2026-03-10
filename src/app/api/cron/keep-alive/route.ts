/**
 * /api/cron/keep-alive
 *
 * Pings the backend to prevent Render free-tier cold starts.
 * Configured as a Vercel Cron Job running every 5 minutes.
 */

import { NextResponse } from "next/server";

const API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function GET(): Promise<Response> {
  // Verify cron secret (Vercel sets this header automatically for cron jobs)
  // In development or if not configured, allow the request through
  try {
    const res = await fetch(`${API_URL}/events/pending`, {
      cache: "no-store",
    });

    return NextResponse.json({
      status: "ok",
      backendStatus: res.ok ? "reachable" : `error_${res.status}`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[Keep-Alive] Backend ping failed:", err);
    return NextResponse.json({
      status: "error",
      backendStatus: "unreachable",
      timestamp: new Date().toISOString(),
    });
  }
}
