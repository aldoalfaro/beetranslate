import "server-only";

import { existsSync } from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { languageName } from "@/lib/languages";
import { isHangul } from "@/lib/script";
import type { ExportRequest } from "@/lib/types";

type PdfDoc = InstanceType<typeof PDFDocument>;
type FontName = "NotoSerif" | "NotoSerif-Bold" | "Nanum";

const MARGIN_X = 68;
const TOP = 64;
const BOTTOM_LIMIT = 84;

type Piece = { text: string; font: FontName; width: number };

function fontFile(name: string): string {
  const full = path.join(process.cwd(), "fonts", name);
  if (!existsSync(full)) throw new Error(`The font ${name} is missing.`);
  return full;
}

function measure(doc: PdfDoc, font: FontName, size: number, text: string): number {
  return doc.font(font).fontSize(size).widthOfString(text);
}

function fontFor(char: string, bold: boolean): FontName {
  if (isHangul(char)) return "Nanum";
  return bold ? "NotoSerif-Bold" : "NotoSerif";
}

function piecesFor(doc: PdfDoc, text: string, size: number, bold: boolean, width: number): Piece[] {
  const tokens = text.split(/(\s+)/).filter((token) => token.length > 0);
  const pieces: Piece[] = [];

  for (const token of tokens) {
    let buffer = "";
    let font: FontName | null = null;
    const flush = () => {
      if (!buffer || !font) return;
      const tokenWidth = measure(doc, font, size, buffer);
      if (tokenWidth <= width) {
        pieces.push({ text: buffer, font, width: tokenWidth });
      } else {
        pieces.push(...breakWide(doc, buffer, font, size, width));
      }
      buffer = "";
    };

    for (const char of token) {
      const nextFont = fontFor(char, bold);
      if (font && nextFont !== font) flush();
      font = nextFont;
      buffer += char;
    }
    flush();
  }

  return pieces;
}

function breakWide(doc: PdfDoc, text: string, font: FontName, size: number, width: number): Piece[] {
  const pieces: Piece[] = [];
  let buffer = "";
  let bufferWidth = 0;

  for (const char of text) {
    const charWidth = measure(doc, font, size, char);
    if (buffer && bufferWidth + charWidth > width) {
      pieces.push({ text: buffer, font, width: measure(doc, font, size, buffer) });
      buffer = char;
      bufferWidth = charWidth;
    } else {
      buffer += char;
      bufferWidth += charWidth;
    }
  }

  if (buffer) pieces.push({ text: buffer, font, width: measure(doc, font, size, buffer) });
  return pieces;
}

function isSpace(piece: Piece): boolean {
  return /^\s+$/.test(piece.text);
}

function layoutLines(pieces: Piece[], width: number): Piece[][] {
  const lines: Piece[][] = [];
  let line: Piece[] = [];
  let used = 0;

  const commit = () => {
    while (line.length > 0 && isSpace(line[line.length - 1])) line.pop();
    if (line.length > 0) lines.push(line);
    line = [];
    used = 0;
  };

  for (const piece of pieces) {
    if (isSpace(piece) && line.length === 0) continue;

    if (line.length > 0 && used + piece.width > width) {
      let breakAt = -1;
      for (let index = line.length - 1; index >= 0; index -= 1) {
        if (isSpace(line[index])) {
          breakAt = index;
          break;
        }
      }

      if (breakAt > 0) {
        const overflow = line.slice(breakAt + 1);
        line = line.slice(0, breakAt);
        commit();
        for (const item of overflow) {
          if (isSpace(item) && line.length === 0) continue;
          line.push(item);
          used += item.width;
        }
      } else {
        commit();
      }

      if (isSpace(piece) && line.length === 0) continue;
      if (line.length > 0 && used + piece.width > width) commit();
    }

    line.push(piece);
    used += piece.width;
  }

  commit();
  return lines;
}

function paintLine(doc: PdfDoc, line: Piece[], x: number, y: number, size: number, color: string) {
  let cursor = x;
  let text = "";
  let font = line[0]?.font;
  let width = 0;

  const flush = () => {
    if (!text || !font) return;
    doc.font(font).fontSize(size).fillColor(color).text(text, cursor, y, { lineBreak: false });
    cursor += width;
    text = "";
    width = 0;
  };

  for (const piece of line) {
    if (piece.font !== font) {
      flush();
      font = piece.font;
    }
    text += piece.text;
    width += piece.width;
  }
  flush();
}

function drawBlock(
  doc: PdfDoc,
  text: string,
  y: number,
  options: { size: number; color: string; bold?: boolean; gap: number },
): number {
  const width = doc.page.width - MARGIN_X * 2;
  const lineHeight = options.size * 1.45;
  let cursor = y;
  const paragraphs = text.split("\n");

  const ensure = (next: number) => {
    if (next + lineHeight > doc.page.height - BOTTOM_LIMIT) {
      doc.addPage();
      return TOP;
    }
    return next;
  };

  paragraphs.forEach((paragraph, index) => {
    if (!paragraph.trim()) {
      cursor = ensure(cursor);
      cursor += lineHeight * 0.65;
      return;
    }

    const lines = layoutLines(
      piecesFor(doc, paragraph, options.size, Boolean(options.bold), width),
      width,
    );

    for (const line of lines) {
      cursor = ensure(cursor);
      paintLine(doc, line, MARGIN_X, cursor, options.size, options.color);
      cursor += lineHeight;
    }

    if (index < paragraphs.length - 1 && paragraphs[index + 1]?.trim()) {
      cursor += options.size * 0.2;
    }
  });

  return cursor + options.gap;
}

function drawRule(doc: PdfDoc, y: number): number {
  let cursor = y;
  if (cursor + 16 > doc.page.height - BOTTOM_LIMIT) {
    doc.addPage();
    cursor = TOP;
  }
  doc.save();
  doc
    .moveTo(MARGIN_X, cursor)
    .lineTo(doc.page.width - MARGIN_X, cursor)
    .lineWidth(0.6)
    .strokeColor("#d9d3c7")
    .stroke();
  doc.restore();
  return cursor + 18;
}

function stampFooters(doc: PdfDoc) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const y = doc.page.height - 52;
    doc.font("NotoSerif").fontSize(9).fillColor("#7a7368");
    doc.text("Bee Translate", MARGIN_X, y, { lineBreak: false });
    const label = String(index + 1);
    const labelWidth = doc.widthOfString(label);
    doc.text(label, doc.page.width - MARGIN_X - labelWidth, y, { lineBreak: false });
  }
}

export function renderPdf(request: ExportRequest): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: TOP, bottom: 40, left: MARGIN_X, right: MARGIN_X },
    bufferPages: true,
    info: {
      Title: request.title,
      Author: "Bee Translate",
    },
  });

  doc.registerFont("NotoSerif", fontFile("NotoSerif-Regular.ttf"));
  doc.registerFont("NotoSerif-Bold", fontFile("NotoSerif-Bold.ttf"));
  doc.registerFont("Nanum", fontFile("NanumMyeongjo-Regular.ttf"));

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  let y = TOP;
  y = drawBlock(doc, request.title, y, { size: 18, color: "#1c1915", bold: true, gap: 8 });
  y = drawBlock(doc, `${languageName(request.from)} – ${languageName(request.to)}`, y, {
    size: 11,
    color: "#5c564c",
    gap: 8,
  });
  y = drawRule(doc, y);

  request.segments.forEach((segment) => {
    const text = segment.translation.trim() ? segment.translation : " ";
    y = drawBlock(doc, text, y, { size: 11.5, color: "#1c1915", gap: 14 });
  });

  const notes = request.segments.flatMap((segment, index) =>
    segment.note.trim() ? [{ number: String(index + 1).padStart(2, "0"), note: segment.note.trim() }] : [],
  );

  if (notes.length > 0) {
    y += 8;
    y = drawRule(doc, y);
    y = drawBlock(doc, "Notes", y, { size: 13, color: "#1c1915", bold: true, gap: 10 });
    for (const note of notes) {
      y = drawBlock(doc, `${note.number}  ${note.note}`, y, { size: 10.5, color: "#1c1915", gap: 8 });
    }
  }

  stampFooters(doc);
  doc.end();
  return done;
}
