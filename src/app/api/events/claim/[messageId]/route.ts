/**
 * POST /api/events/claim/:messageId
 * Proxy to backend — atomically claims a pending event for processing.
 */

import { type NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
): Promise<Response> {
  const { messageId } = await params;
  try {
    const res = await fetch(
      `${API_URL}/events/claim/${encodeURIComponent(messageId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ claimed: false }, { status: 502 });
  }
}
