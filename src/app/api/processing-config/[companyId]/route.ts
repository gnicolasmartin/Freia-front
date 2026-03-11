/**
 * Proxy for processing-config CRUD to the backend.
 * PUT — upsert config blob
 * GET — fetch config blob
 */

import { type NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
): Promise<Response> {
  const { companyId } = await params;
  try {
    const body = await request.json();
    const res = await fetch(`${API_URL}/processing-config/${encodeURIComponent(companyId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[ProcessingConfig Proxy] PUT error:", err);
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
): Promise<Response> {
  const { companyId } = await params;
  try {
    const res = await fetch(`${API_URL}/processing-config/${encodeURIComponent(companyId)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[ProcessingConfig Proxy] GET error:", err);
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }
}
