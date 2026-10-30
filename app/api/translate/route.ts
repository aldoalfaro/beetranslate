import { isFatalTranslationError, localizeKnownError, uiLocaleFromHeader } from "@/lib/i18n";
import { isLanguageId } from "@/lib/languages";
import { translateSegment } from "@/lib/openai";
import { SEGMENT_HARD_MAX } from "@/lib/segment";
import { MAX_INSTRUCTIONS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  from?: unknown;
  to?: unknown;
  current?: unknown;
  previousOriginal?: unknown;
  previousTranslation?: unknown;
  instructions?: unknown;
};

function textField(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export async function POST(request: Request) {
  const locale = uiLocaleFromHeader(request.headers.get("accept-language"));
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: localizeKnownError(locale, "The request could not be read.") }, { status: 400 });
  }

  if (typeof body.from !== "string" || !isLanguageId(body.from) || typeof body.to !== "string" || !isLanguageId(body.to)) {
    return Response.json({ error: localizeKnownError(locale, "Choose Spanish, French, English, or Korean.") }, { status: 400 });
  }
  if (body.from === body.to) {
    return Response.json({ error: localizeKnownError(locale, "Choose two different languages.") }, { status: 400 });
  }

  const current = textField(body.current, SEGMENT_HARD_MAX);
  if (!current) {
    return Response.json({ error: localizeKnownError(locale, "That segment cannot be translated.") }, { status: 400 });
  }

  const previousOriginal = typeof body.previousOriginal === "string" ? body.previousOriginal.slice(0, SEGMENT_HARD_MAX) : "";
  const previousTranslation = typeof body.previousTranslation === "string" ? body.previousTranslation.slice(0, 8_000) : "";
  const instructions = typeof body.instructions === "string" ? body.instructions.trim().slice(0, MAX_INSTRUCTIONS) : "";

  try {
    const result = await translateSegment({
      from: body.from,
      to: body.to,
      current,
      instructions,
      previousOriginal,
      previousTranslation,
      signal: request.signal,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "APIUserAbortError")) {
      return new Response(null, { status: 499 });
    }
    const message = error instanceof Error ? error.message : "This segment did not translate.";
    return Response.json(
      { error: localizeKnownError(locale, message), fatal: isFatalTranslationError(message) },
      { status: 502 },
    );
  }
}
