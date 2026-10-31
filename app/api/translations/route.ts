import { NextResponse } from "next/server";
import { createTranslation, listTranslations, parseSegments } from "@/lib/documents";
import { isLanguageId } from "@/lib/languages";
import { readSession } from "@/lib/session";
import { MAX_INSTRUCTIONS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await readSession(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const translations = await listTranslations(user.id);
  return NextResponse.json({ translations });
}

export async function POST(request: Request) {
  const user = await readSession(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The request could not be read." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "The translation could not be saved." }, { status: 400 });
  const record = body as { title?: unknown; from?: unknown; to?: unknown; instructions?: unknown; segments?: unknown };
  if (typeof record.from !== "string" || !isLanguageId(record.from) || typeof record.to !== "string" || !isLanguageId(record.to) || record.from === record.to) {
    return NextResponse.json({ error: "The translation could not be saved." }, { status: 400 });
  }
  const segments = parseSegments(record.segments);
  const title = typeof record.title === "string" ? record.title.trim().slice(0, 120) : "";
  if (!segments || !title) return NextResponse.json({ error: "The translation could not be saved." }, { status: 400 });
  const instructions = typeof record.instructions === "string" ? record.instructions.trim().slice(0, MAX_INSTRUCTIONS) : "";
  try {
    const id = await createTranslation(user.id, { title, from: record.from, to: record.to, instructions, segments });
    return NextResponse.json({ id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "The translation could not be saved." }, { status: 500 });
  }
}
