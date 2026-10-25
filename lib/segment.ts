export const SEGMENT_TARGET = 900;
export const SEGMENT_HARD_MAX = 1800;
export const MAX_SEGMENTS = 80;
export const MAX_INPUT_CHARS = 100_000;

export function segmentText(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return [];

  const segments: string[] = [];

  const pushLongLine = (line: string) => {
    if (line.length <= SEGMENT_HARD_MAX) {
      segments.push(line);
      return;
    }

    const sentences = line.split(/(?<=[.!?…。？！])\s+/).map((part) => part.trim()).filter(Boolean);
    const pieces = sentences.length > 0 ? sentences : [line];
    let buffer = "";

    const flush = () => {
      if (buffer.trim()) segments.push(buffer.trim());
      buffer = "";
    };

    for (const sentence of pieces) {
      if (sentence.length > SEGMENT_HARD_MAX) {
        flush();
        segments.push(...splitByWords(sentence, SEGMENT_TARGET));
        continue;
      }
      const next = buffer ? `${buffer} ${sentence}` : sentence;
      if (buffer && next.length > SEGMENT_TARGET) {
        flush();
        buffer = sentence;
      } else {
        buffer = next;
      }
    }

    flush();
  };

  for (const block of normalized.split(/\n\s*\n/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.length <= SEGMENT_TARGET) {
      segments.push(trimmed);
      continue;
    }

    if (!trimmed.includes("\n")) {
      pushLongLine(trimmed);
      continue;
    }

    const lines = trimmed.split(/\n/).map((line) => line.trim()).filter(Boolean);
    let group: string[] = [];
    let length = 0;

    const flushGroup = () => {
      if (group.length > 0) segments.push(group.join("\n"));
      group = [];
      length = 0;
    };

    for (const line of lines) {
      if (line.length > SEGMENT_TARGET) {
        flushGroup();
        pushLongLine(line);
        continue;
      }
      if (length > 0 && length + line.length + 1 > SEGMENT_TARGET) flushGroup();
      group.push(line);
      length += line.length + 1;
    }

    flushGroup();
  }

  return segments;
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
