import { NextResponse } from "next/server";
import { upsertGoogleUser } from "@/lib/documents";
import { clearOauthCookie, googleClient, isSecure, readOauth, safeNext, sessionCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TokenResponse = { access_token?: string };
type UserInfo = { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = isSecure(request);
  const fail = NextResponse.redirect(new URL("/?auth=error", url.origin));
  fail.headers.append("Set-Cookie", clearOauthCookie(secure));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail;

  try {
    const pending = await readOauth(request);
    if (!pending || pending.state !== state) return fail;
    const client = await googleClient();
    const redirectUri = `${url.origin}/api/auth/callback/google`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: client.id,
        client_secret: client.secret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const token = (await tokenResponse.json()) as TokenResponse;
    if (!tokenResponse.ok || !token.access_token) return fail;

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const profile = (await profileResponse.json()) as UserInfo;
    if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified === false) return fail;

    const user = await upsertGoogleUser({
      sub: profile.sub,
      email: profile.email,
      name: (profile.name || profile.email).slice(0, 120),
      picture: (profile.picture || "").slice(0, 500),
    });
    const response = NextResponse.redirect(new URL(safeNext(pending.next), url.origin));
    response.headers.append("Set-Cookie", await sessionCookie(user, secure));
    response.headers.append("Set-Cookie", clearOauthCookie(secure));
    return response;
  } catch (error) {
    console.error(error);
    return fail;
  }
}
