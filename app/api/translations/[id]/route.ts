import { NextResponse } from "next/server";
import { deleteTranslation, getTranslation, readDocumentInput, updateTranslation } from "@/lib/documents";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const user = await readSession(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const document = await getTranslation(user.id, id);
  if (!document) return NextResponse.json({ error: "That translation could not be found." }, { status: 404 });
  return NextResponse.json(document);
}

export async function PUT(request: Request, context: Context) {
  const user = await readSession(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The translation could not be saved." }, { status: 400 });
  }
  const input = readDocumentInput(body);
  if (!input) return NextResponse.json({ error: "The translation could not be saved." }, { status: 400 });
  const saved = await updateTranslation(user.id, id, input);
  if (!saved) return NextResponse.json({ error: "That translation could not be found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: Context) {
  const user = await readSession(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  await deleteTranslation(user.id, id);
  return NextResponse.json({ ok: true });
}
