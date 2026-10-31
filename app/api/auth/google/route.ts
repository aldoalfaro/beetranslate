import { NextResponse } from "next/server";
import { googleClient, isSecure, oauthCookie, safeNext } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const secure = isSecure(request);
  let clientId: string;
  try {
    clientId = (await googleClient()).id;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(new URL("/?auth=error", url.origin));
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${url.origin}/api/auth/callback/google`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.headers.append("Set-Cookie", await oauthCookie(state, safeNext(url.searchParams.get("next")), secure));
  return response;
}
