import { NextResponse } from "next/server";
import { clearSessionCookie, isSecure } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookie(isSecure(request)));
  return response;
}
