import { localizeKnownError, uiLocaleFromHeader } from "@/lib/i18n";
import { isLanguageId } from "@/lib/languages";
import { suggestTitle } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const locale = uiLocaleFromHeader(request.headers.get("accept-language"));
  let body: { to?: unknown; text?: unknown };
  try {
    body = (await request.json()) as { to?: unknown; text?: unknown };
  } catch {
    return Response.json({ error: localizeKnownError(locale, "The request could not be read.") }, { status: 400 });
  }
  if (typeof body.to !== "string" || !isLanguageId(body.to) || typeof body.text !== "string" || !body.text.trim()) {
    return Response.json({ error: localizeKnownError(locale, "That segment cannot be translated.") }, { status: 400 });
  }
  try {
    const title = await suggestTitle({ to: body.to, text: body.text });
    return Response.json({ title });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    return Response.json({ error: localizeKnownError(locale, message) }, { status: 502 });
  }
}
