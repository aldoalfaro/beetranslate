import "server-only";

import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import WordExtractor from "word-extractor";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export class ExtractError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function detect(buffer: Buffer, name: string): "pdf" | "docx" | "doc" | "txt" | null {
  if (buffer.subarray(0, 5).toString("latin1").startsWith("%PDF")) return "pdf";
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) return "docx";
  if (
    buffer.length >= 4 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return "doc";
  }

  const lower = name.toLowerCase();
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".doc")) return "doc";
  return null;
}

function decodeText(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf8");
  }
  return buffer.toString("utf8");
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  try {
    const { text } = await extractText(pdf, { mergePages: false });
    return text
      .map((page) => page.trim())
      .filter(Boolean)
      .join("\n\n");
  } finally {
    await pdf.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractDoc(buffer: Buffer): Promise<string> {
  const extractor = new WordExtractor();
  const document = await extractor.extract(buffer);
  return [document.getBody(), document.getFootnotes(), document.getEndnotes()]
    .filter((part) => part && part.trim())
    .join("\n\n");
}

export async function extractFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ExtractError("That file is larger than 15 MB.", 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = detect(buffer, file.name);
  if (!kind) {
    throw new ExtractError("Use a PDF or Word file.", 415);
  }

  let text = "";
  try {
    if (kind === "pdf") text = await extractPdf(buffer);
    else if (kind === "docx") text = await extractDocx(buffer);
    else if (kind === "doc") text = await extractDoc(buffer);
    else text = decodeText(buffer);
  } catch (error) {
    if (error instanceof ExtractError) throw error;
    throw new ExtractError("This file could not be read. Try a PDF or Word file with selectable text.", 422);
  }

  const cleaned = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!cleaned) {
    throw new ExtractError("No selectable text was found. Scanned pages need to be pasted instead.", 422);
  }
  return cleaned;
}
