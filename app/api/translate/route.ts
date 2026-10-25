import { isLanguageId } from "@/lib/languages";
import { translateSegment } from "@/lib/openai";
import { SEGMENT_HARD_MAX } from "@/lib/segment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Body = {
  from?: unknown;
  to?: unknown;
  current?: unknown;
  previousOriginal?: unknown;
  previousTranslation?: unknown;
};

function textField(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "The request could not be read." }, { status: 400 });
  }

  if (typeof body.from !== "string" || !isLanguageId(body.from) || typeof body.to !== "string" || !isLanguageId(body.to)) {
    return Response.json({ error: "Choose Spanish, French, English, or Korean." }, { status: 400 });
  }
  if (body.from === body.to) {
    return Response.json({ error: "Choose two different languages." }, { status: 400 });
  }

  const current = textField(body.current, SEGMENT_HARD_MAX);
  if (!current) {
    return Response.json({ error: "That segment cannot be translated." }, { status: 400 });
  }

  const previousOriginal = typeof body.previousOriginal === "string" ? body.previousOriginal.slice(0, SEGMENT_HARD_MAX) : "";
  const previousTranslation = typeof body.previousTranslation === "string" ? body.previousTranslation.slice(0, 8_000) : "";

  try {
    const result = await translateSegment({
      from: body.from,
      to: body.to,
      current,
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
    return Response.json({ error: message }, { status: 502 });
  }
}
