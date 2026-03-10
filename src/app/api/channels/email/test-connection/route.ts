/**
 * /api/channels/email/test-connection
 *
 * POST — Test SMTP connection with provided credentials.
 * Returns { success: boolean, error?: string }
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { testSmtpConnection, deriveSecure } from "@/lib/email-sender";

interface TestConnectionBody {
  host: string;
  port: number;
  username: string;
  password: string;
  secure?: boolean;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: TestConnectionBody;
  try {
    body = (await request.json()) as TestConnectionBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { host, port, username, password } = body;

  if (!host || !port || !username || !password) {
    return NextResponse.json(
      { success: false, error: "Missing required fields: host, port, username, password" },
      { status: 400 }
    );
  }

  const secure = body.secure ?? deriveSecure(port);
  const result = await testSmtpConnection(host, port, secure, username, password);

  return NextResponse.json(result);
}
