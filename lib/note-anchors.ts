export type NoteRange = {
  start: number;
  end: number;
};

export type NoteAnchor = {
  id: string;
  text: string;
  start: number;
  end: number;
  translation: NoteRange[];
};

const QUOTE =
  /“([^”]{1,200})”|「([^」]{1,200})」|『([^』]{1,200})』|«([^»]{1,200})»|"([^"\n]{1,200})"|‘([^’]{1,200})’/g;

const OPENERS: Record<string, string> = {
  "“": "”",
  "「": "」",
  "『": "』",
  "«": "»",
  '"': '"',
  "‘": "’",
};

export function noteAnchors(segmentId: string, original: string, note: string, translation = ""): NoteAnchor[] {
  const trimmed = note.trim();
  if (!trimmed) return [];

  const pieces: Array<{ text: string; quote: string | null }> = [];
  let loose = "";

  for (const sentence of splitSentences(trimmed)) {
    const quotes = quoted(sentence).filter((quote) => quote.length >= 2 && original.includes(quote));
    if (quotes.length === 0) {
      loose = loose ? `${loose} ${sentence}` : sentence;
      continue;
    }
    const parts = splitOnQuotes(sentence, quotes);
    if (loose) {
      parts[0] = `${loose} ${parts[0]}`;
      loose = "";
    }
    parts.forEach((text, index) => pieces.push({ text, quote: quotes[index] ?? null }));
  }

  if (loose) pieces.push({ text: loose, quote: null });

  const used: Array<[number, number]> = [];
  const anchors: Array<{ text: string; start: number; end: number; quote: string | null }> = [];
  const pending: string[] = [];

  for (const piece of pieces) {
    const range = piece.quote ? takeRange(original, piece.quote, used) : null;
    if (!range) {
      pending.push(piece.text);
      continue;
    }
    const text = [...pending, piece.text].join(" ");
    pending.length = 0;
    used.push(range);
    anchors.push({ text, start: range[0], end: range[1], quote: piece.quote });
  }

  if (pending.length > 0) {
    const text = pending.join(" ");
    if (anchors.length === 0) anchors.push({ text, start: -1, end: -1, quote: null });
    else anchors[anchors.length - 1].text = `${anchors[anchors.length - 1].text} ${text}`;
  }

  const usedTranslation: Array<[number, number]> = [];
  return anchors.map((anchor, index) => {
    const translationRanges = hitsInTranslation(translation, anchor.text, anchor.quote, usedTranslation);
    for (const range of translationRanges) usedTranslation.push([range.start, range.end]);
    return {
      id: `${segmentId}:${index}`,
      text: anchor.text,
      start: anchor.start,
      end: anchor.end,
      translation: translationRanges,
    };
  });
}

function quoted(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(QUOTE)) {
    const value = match.slice(1).find((part) => part != null)?.trim().replace(/^[\s,.;:!?…]+|[\s,.;:!?…]+$/g, "");
    if (value) found.push(value);
  }
  return found;
}

function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  let opener: string | null = null;

  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (opener) {
      if (ch === OPENERS[opener]) opener = null;
      continue;
    }
    if (OPENERS[ch]) {
      opener = ch;
      continue;
    }
    if (!".!?…。".includes(ch)) continue;
    const next = text[index + 1];
    if (next !== undefined && !/\s/u.test(next)) continue;
    const sentence = text.slice(start, index + 1).trim();
    if (sentence) sentences.push(sentence);
    start = index + 1;
  }

  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}

function splitOnQuotes(sentence: string, quotes: string[]): string[] {
  if (quotes.length <= 1) return [sentence];
  const spans: Array<{ start: number; end: number }> = [];
  let from = 0;
  for (const quote of quotes) {
    const start = sentence.indexOf(quote, from);
    if (start < 0) return [sentence];
    spans.push({ start, end: start + quote.length });
    from = start + quote.length;
  }

  const parts: string[] = [];
  let cursor = 0;
  for (let index = 0; index < spans.length; index += 1) {
    const end = index === spans.length - 1 ? sentence.length : cutBetween(sentence, spans[index].end, spans[index + 1].start);
    const part = sentence.slice(cursor, end).trim();
    if (part) parts.push(part);
    cursor = end;
  }
  return parts.length === quotes.length ? parts : [sentence];
}

function cutBetween(sentence: string, left: number, right: number): number {
  const gap = sentence.slice(left, right);
  const semi = gap.indexOf(";");
  if (semi >= 0) return left + semi + 1;
  let lastSpace = -1;
  for (let index = 0; index < gap.length; index += 1) {
    if (/\s/u.test(gap[index])) lastSpace = index;
  }
  return lastSpace >= 0 ? left + lastSpace : right;
}

function hitsInTranslation(
  translation: string,
  piece: string,
  sourceQuote: string | null,
  used: Array<[number, number]>,
): NoteRange[] {
  if (!translation.trim()) return [];
  const quotes = quoted(piece)
    .filter((quote) => quote.length >= 2 && quote !== sourceQuote)
    .sort((a, b) => b.length - a.length);
  const ranges: NoteRange[] = [];
  for (const quote of quotes) {
    const range = findRange(translation, quote, [...used, ...ranges.map((item) => [item.start, item.end] as [number, number])]);
    if (range) ranges.push({ start: range[0], end: range[1] });
  }
  return ranges.sort((a, b) => a.start - b.start);
}

function findRange(text: string, quote: string, used: Array<[number, number]>): [number, number] | null {
  const exact = takeRange(text, quote, used);
  if (exact) return exact;
  const folded = text.toLocaleLowerCase();
  const needle = quote.toLocaleLowerCase();
  if (folded.length !== text.length || needle.length !== quote.length) return null;
  return takeRange(folded, needle, used);
}

function takeRange(original: string, quote: string, used: Array<[number, number]>): [number, number] | null {
  let from = 0;
  while (from <= original.length) {
    const start = original.indexOf(quote, from);
    if (start < 0) return null;
    const end = start + quote.length;
    if (!used.some(([usedStart, usedEnd]) => start < usedEnd && end > usedStart)) return [start, end];
    from = start + 1;
  }
  return null;
}
