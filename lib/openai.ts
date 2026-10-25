import "server-only";

import OpenAI, { APIError } from "openai";
import { languageName, type LanguageId } from "@/lib/languages";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

const EMPTY_NOTE =
  /^(none|n\/a|no note|no clarification(?: needed)?|nothing to (?:clarify|note)|not applicable|ninguna|ninguno|aucune|aucun|pas de note|rien à signaler|no hay nota|없음|없습니다|해당 없음)\.?$/i;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  if (!client) {
    client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 2 });
  }
  return client;
}

export function publicModelError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Translation failed.";
  const message = raw.replace(/sk-[A-Za-z0-9_-]+/g, "[key]");
  if (error instanceof APIError && error.status === 401) return "OpenAI refused the API key.";
  if (error instanceof APIError && error.status === 429) {
    return "OpenAI is rate limiting requests. Wait a moment, then retry.";
  }
  if (/model/i.test(message) && /not found|does not exist|invalid|unavailable/i.test(message)) {
    return "The configured model is unavailable. Set OPENAI_MODEL and try again.";
  }
  return message.length > 280 ? `${message.slice(0, 277)}…` : message;
}

function cleanNote(note: string): string {
  const trimmed = note.trim();
  if (!trimmed || EMPTY_NOTE.test(trimmed)) return "";
  if (trimmed.length > 500) return `${trimmed.slice(0, 497).trimEnd()}…`;
  return trimmed;
}

function parseTranslation(raw: string): { translation: string; note: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("The model returned an unreadable response.");
    data = JSON.parse(match[0]);
  }

  if (!data || typeof data !== "object") {
    throw new Error("The model returned an unreadable response.");
  }

  const record = data as { translation?: unknown; note?: unknown };
  const translation = typeof record.translation === "string" ? record.translation.trim() : "";
  const note = typeof record.note === "string" ? cleanNote(record.note) : "";
  if (!translation) throw new Error("The model returned an empty translation.");
  return { translation, note };
}

function systemPrompt(fromName: string, toName: string): string {
  return [
    "You are a precise translator working through a document one segment at a time.",
    `Translate from ${fromName} into ${toName}.`,
    "The previous segment is context only. Use it to keep tone, terminology, pronouns, and unfinished thoughts consistent. Translate the current segment alone. Do not repeat or summarize the previous segment.",
    `Preserve line breaks, lists, names, numbers, dates, and citations. Do not add headings, quotation marks, or commentary inside the translation. If a passage is already in ${toName}, leave it unchanged.`,
    `Include a note when the segment has an idiom or metaphor, when a pronoun or gender is not specified, when a proper name or cultural reference would be opaque, or when you chose between two plausible meanings. Name the source wording and the choice you made. Write that note in ${toName}, in one or two sentences. If none of these apply, return an empty note.`,
    'Respond as JSON with the shape {"translation":"...","note":"..."}.',
  ].join("\n\n");
}

function userPrompt(input: {
  current: string;
  previousOriginal: string;
  previousTranslation: string;
}): string {
  const blocks: string[] = [];
  if (input.previousOriginal.trim()) {
    blocks.push(`PREVIOUS SEGMENT, SOURCE\n${input.previousOriginal.trim()}`);
    if (input.previousTranslation.trim()) {
      blocks.push(`PREVIOUS SEGMENT, TRANSLATION\n${input.previousTranslation.trim()}`);
    }
  }
  blocks.push(`CURRENT SEGMENT\n${input.current.trim()}`);
  return blocks.join("\n\n");
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "APIUserAbortError");
}

export async function translateSegment(input: {
  from: LanguageId;
  to: LanguageId;
  current: string;
  previousOriginal?: string;
  previousTranslation?: string;
  signal?: AbortSignal;
}): Promise<{ translation: string; note: string }> {
  const fromName = languageName(input.from);
  const toName = languageName(input.to);
  const tokenLimit =
    MODEL.startsWith("gpt-5") || MODEL.startsWith("gpt-6") || MODEL.startsWith("o")
      ? { max_completion_tokens: 2500 }
      : { max_tokens: 2500 };

  try {
    const completion = await getClient().chat.completions.create(
      {
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        ...tokenLimit,
        messages: [
          { role: "system", content: systemPrompt(fromName, toName) },
          {
            role: "user",
            content: userPrompt({
              current: input.current,
              previousOriginal: input.previousOriginal ?? "",
              previousTranslation: input.previousTranslation ?? "",
            }),
          },
        ],
      },
      { signal: input.signal },
    );

    const raw = completion.choices[0]?.message?.content ?? "";
    return parseTranslation(raw);
  } catch (error) {
    if (isAbort(error)) throw error;
    if (error instanceof Error && /empty translation|unreadable response/.test(error.message)) {
      throw error;
    }
    throw new Error(publicModelError(error));
  }
}
