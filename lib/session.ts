import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { SessionUser } from "@/lib/types";

const SESSION = "bt_session";
const OAUTH = "bt_oauth";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = SessionUser & { exp: number };
type OAuthPayload = { state: string; next: string; exp: number };

const encoder = new TextEncoder();

async function secret(name: string): Promise<string> {
  const direct = process.env[name];
  if (direct) return direct;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const value = (env as Record<string, unknown>)[name];
    if (typeof value === "string" && value) return value;
  } catch {
    // Local Next has the values on process.env.
  }
  throw new Error(`${name} is not set.`);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sign(data: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data)));
  return bytesToBase64Url(signature);
}

async function seal(payload: object, key: string): Promise<string> {
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await sign(body, key)}`;
}

async function open<T>(token: string, key: string): Promise<T | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await sign(body, key);
  if (expected.length !== signature.length) return null;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  if (mismatch !== 0) return null;
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as T;
  } catch {
    return null;
  }
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function cookie(name: string, value: string, maxAge: number, secure: boolean): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function isSecure(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

export async function sessionCookie(user: SessionUser, secure: boolean): Promise<string> {
  const token = await seal({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }, await secret("AUTH_SECRET"));
  return cookie(SESSION, token, SESSION_SECONDS, secure);
}

export function clearSessionCookie(secure: boolean): string {
  return cookie(SESSION, "", 0, secure);
}

export async function readSession(request: Request): Promise<SessionUser | null> {
  const token = readCookie(request, SESSION);
  if (!token) return null;
  let key: string;
  try {
    key = await secret("AUTH_SECRET");
  } catch {
    return null;
  }
  const payload = await open<SessionPayload>(token, key);
  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.id || !payload.email) return null;
  return { id: payload.id, email: payload.email, name: payload.name || payload.email, picture: payload.picture || "" };
}

export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return "/";
  return value;
}

export async function oauthCookie(state: string, next: string, secure: boolean): Promise<string> {
  const token = await seal({ state, next, exp: Date.now() + 10 * 60 * 1000 }, await secret("AUTH_SECRET"));
  return cookie(OAUTH, token, 600, secure);
}

export function clearOauthCookie(secure: boolean): string {
  return cookie(OAUTH, "", 0, secure);
}

export async function readOauth(request: Request): Promise<OAuthPayload | null> {
  const token = readCookie(request, OAUTH);
  if (!token) return null;
  const payload = await open<OAuthPayload>(token, await secret("AUTH_SECRET"));
  if (!payload || payload.exp < Date.now() || !payload.state) return null;
  return payload;
}

export async function googleClient(): Promise<{ id: string; secret: string }> {
  return { id: await secret("GOOGLE_CLIENT_ID"), secret: await secret("GOOGLE_CLIENT_SECRET") };
}
