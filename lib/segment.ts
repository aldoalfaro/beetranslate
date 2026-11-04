export const SEGMENT_MIN = 100;
export const SEGMENT_MAX = 300;
export const SEGMENT_HARD_MAX = 1_800;
export const MAX_SEGMENTS = 80;
export const MAX_INPUT_CHARS = 100_000;

const SENTENCE_END = /[.!?…]["'”’)\]]*(?=\s)|[。？！]["'”’)\]]*(?=\S)/g;

export function segmentText(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks = paragraphs.flatMap((paragraph) => splitToMax(paragraph));
  return pack(chunks);
}

function pack(chunks: string[]): string[] {
  const segments: string[] = [];
  let buffer = "";

  for (const chunk of chunks) {
    if (!buffer) {
      buffer = chunk;
      continue;
    }
    if (buffer.length >= SEGMENT_MIN) {
      segments.push(buffer);
      buffer = chunk;
      continue;
    }
    const parts = splitToMax(`${buffer}\n\n${chunk}`);
    segments.push(...parts.slice(0, -1));
    buffer = parts[parts.length - 1] ?? "";
  }

  if (buffer) segments.push(buffer);
  return segments;
}

function splitToMax(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= SEGMENT_MAX) return [trimmed];

  const at = periodSplitPoint(trimmed);
  if (at == null) {
    return trimmed.length <= SEGMENT_HARD_MAX ? [trimmed] : splitByWords(trimmed, SEGMENT_MAX);
  }

  const left = trimmed.slice(0, at).trim();
  const right = trimmed.slice(at).trim();
  if (!left || !right || left.length >= trimmed.length) {
    return trimmed.length <= SEGMENT_HARD_MAX ? [trimmed] : splitByWords(trimmed, SEGMENT_MAX);
  }

  return [...splitToMax(left), ...splitToMax(right)];
}

function periodSplitPoint(text: string): number | null {
  const points: number[] = [];
  for (const match of text.matchAll(SENTENCE_END)) {
    const at = match.index + match[0].length;
    const left = text.slice(0, at).trim();
    const right = text.slice(at).trim();
    if (left && right) points.push(at);
  }
  if (points.length === 0) return null;

  const half = text.length / 2;
  const fitting = points.filter((at) => text.slice(0, at).trim().length <= SEGMENT_MAX);
  const pool = fitting.length > 0 ? fitting : points;
  return pool.reduce((best, at) => (Math.abs(at - half) < Math.abs(best - half) ? at : best));
}

function splitByWords(text: string, target: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  let buffer = "";

  for (const word of words) {
    if (!buffer) {
      buffer = word;
      continue;
    }
    if (buffer.length + word.length + 1 > target) {
      parts.push(buffer);
      buffer = word;
    } else {
      buffer = `${buffer} ${word}`;
    }
  }

  if (buffer) parts.push(buffer);
  return parts.length > 0 ? parts : [text];
}

export function segmentCountLabel(count: number): string {
  return count === 1 ? "1 segment" : `${count} segments`;
}
