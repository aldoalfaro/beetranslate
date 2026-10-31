import "server-only";

import { database } from "@/lib/db";
import { isLanguageId, type LanguageId } from "@/lib/languages";
import { MAX_SEGMENTS, SEGMENT_HARD_MAX } from "@/lib/segment";
import { MAX_INSTRUCTIONS, type SegmentStatus, type SessionUser } from "@/lib/types";

const STATUSES = new Set<SegmentStatus>(["waiting", "translating", "done", "error"]);

export type StoredSegment = {
  id: string;
  original: string;
  translation: string;
  note: string;
  status: SegmentStatus;
  error: string;
};

export type TranslationDocument = {
  id: string;
  title: string;
  from: LanguageId;
  to: LanguageId;
  instructions: string;
  segments: StoredSegment[];
  updatedAt: string;
};

export type TranslationSummary = {
  id: string;
  title: string;
  from: LanguageId;
  to: LanguageId;
  segmentCount: number;
  updatedAt: string;
};

type SummaryRow = {
  id: string;
  title: string;
  from_lang: string;
  to_lang: string;
  segment_count: number;
  updated_at: string;
};
type DocumentRow = SummaryRow & { instructions: string; segments: string };

export function parseSegments(value: unknown): StoredSegment[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SEGMENTS) return null;
  const segments: StoredSegment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || !row.id || row.id.length > 80) return null;
    if (typeof row.original !== "string" || !row.original.trim() || row.original.length > SEGMENT_HARD_MAX) return null;
    if (typeof row.translation !== "string" || row.translation.length > 20_000) return null;
    const status = typeof row.status === "string" && STATUSES.has(row.status as SegmentStatus) ? (row.status as SegmentStatus) : "done";
    segments.push({
      id: row.id,
      original: row.original,
      translation: row.translation,
      note: typeof row.note === "string" ? row.note.slice(0, 500) : "",
      status,
      error: typeof row.error === "string" ? row.error.slice(0, 500) : "",
    });
  }
  return segments;
}

export async function upsertGoogleUser(input: { sub: string; email: string; name: string; picture: string }): Promise<SessionUser> {
  const db = await database();
  const existing = await db.get<{ id: string }>("SELECT id FROM users WHERE google_sub = ?", [input.sub]);
  if (existing) {
    await db.run("UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?", [input.email, input.name, input.picture, existing.id]);
    return { id: existing.id, email: input.email, name: input.name, picture: input.picture };
  }
  const id = crypto.randomUUID();
  await db.run(
    "INSERT INTO users (id, google_sub, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, input.sub, input.email, input.name, input.picture, new Date().toISOString()],
  );
  return { id, email: input.email, name: input.name, picture: input.picture };
}

export async function createTranslation(userId: string, input: {
  title: string;
  from: LanguageId;
  to: LanguageId;
  instructions: string;
  segments: StoredSegment[];
}): Promise<string> {
  const db = await database();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO translations (id, user_id, title, from_lang, to_lang, instructions, segments, segment_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, input.title, input.from, input.to, input.instructions, JSON.stringify(input.segments), input.segments.length, now, now],
  );
  return id;
}

export async function updateTranslation(userId: string, id: string, input: {
  title: string;
  instructions: string;
  segments: StoredSegment[];
}): Promise<boolean> {
  const db = await database();
  const existing = await db.get<{ id: string; title: string }>("SELECT id, title FROM translations WHERE id = ? AND user_id = ?", [id, userId]);
  if (!existing) return false;
  const title = input.title.trim().slice(0, 120) || existing.title;
  await db.run(
    `UPDATE translations SET title = ?, instructions = ?, segments = ?, segment_count = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    [title, input.instructions, JSON.stringify(input.segments), input.segments.length, new Date().toISOString(), id, userId],
  );
  return true;
}

export async function deleteTranslation(userId: string, id: string): Promise<void> {
  const db = await database();
  await db.run("DELETE FROM translations WHERE id = ? AND user_id = ?", [id, userId]);
}

export async function listTranslations(userId: string): Promise<TranslationSummary[]> {
  const db = await database();
  const rows = await db.all<SummaryRow>(
    `SELECT id, title, from_lang, to_lang, segment_count, updated_at
     FROM translations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200`,
    [userId],
  );
  return rows.flatMap((row) => {
    if (!isLanguageId(row.from_lang) || !isLanguageId(row.to_lang)) return [];
    return [{
      id: row.id,
      title: row.title,
      from: row.from_lang,
      to: row.to_lang,
      segmentCount: row.segment_count,
      updatedAt: row.updated_at,
    }];
  });
}

export async function getTranslation(userId: string, id: string): Promise<TranslationDocument | null> {
  const db = await database();
  const row = await db.get<DocumentRow>(
    `SELECT id, title, from_lang, to_lang, instructions, segments, segment_count, updated_at
     FROM translations WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
  if (!row || !isLanguageId(row.from_lang) || !isLanguageId(row.to_lang)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.segments);
  } catch {
    return null;
  }
  const segments = parseSegments(parsed);
  if (!segments) return null;
  return {
    id: row.id,
    title: row.title,
    from: row.from_lang,
    to: row.to_lang,
    instructions: row.instructions,
    segments,
    updatedAt: row.updated_at,
  };
}

export function readDocumentInput(value: unknown): { title: string; instructions: string; segments: StoredSegment[] } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { title?: unknown; instructions?: unknown; segments?: unknown };
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  const instructions = typeof body.instructions === "string" ? body.instructions.trim().slice(0, MAX_INSTRUCTIONS) : "";
  const segments = parseSegments(body.segments);
  if (!segments) return null;
  return { title, instructions, segments };
}
