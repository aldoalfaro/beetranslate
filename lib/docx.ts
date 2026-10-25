import "server-only";

import {
  BorderStyle,
  Document,
  Footer,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { languageName } from "@/lib/languages";
import { isHangul } from "@/lib/script";
import type { ExportRequest } from "@/lib/types";

function scriptRuns(text: string, size: number, bold = false): TextRun[] {
  const chunks: { korean: boolean; text: string }[] = [];
  for (const char of text) {
    const korean = isHangul(char);
    const last = chunks[chunks.length - 1];
    if (last && last.korean === korean) last.text += char;
    else chunks.push({ korean, text: char });
  }

  if (chunks.length === 0) return [new TextRun({ text: "", size })];

  return chunks.map(
    (chunk) =>
      new TextRun({
        text: chunk.text,
        bold: bold && !chunk.korean,
        italics: false,
        size,
        font: chunk.korean ? "Malgun Gothic" : "Times New Roman",
      }),
  );
}

function textParagraphs(text: string, size: number, afterLast: number, bold = false): Paragraph[] {
  const lines = text.split("\n");
  return lines.map((line, index) => {
    const last = index === lines.length - 1;
    return new Paragraph({
      spacing: { after: last ? afterLast : 60, line: 336, lineRule: "auto" },
      children: line.length > 0 ? scriptRuns(line, size, bold) : [new TextRun({ text: "", size })],
    });
  });
}

export async function renderDocx(request: ExportRequest): Promise<Buffer> {
  const fromName = languageName(request.from);
  const toName = languageName(request.to);
  const children: Paragraph[] = [
    ...textParagraphs(request.title, 36, 80, true),
    new Paragraph({
      spacing: { after: 280 },
      children: [
        new TextRun({
          text: `${fromName} – ${toName}`,
          italics: true,
          size: 22,
          color: "5C564C",
          font: "Times New Roman",
        }),
      ],
    }),
  ];

  request.segments.forEach((segment) => {
    children.push(...textParagraphs(segment.translation.trim() ? segment.translation : " ", 24, 280));
  });

  const notes = request.segments.flatMap((segment, index) =>
    segment.note.trim() ? [{ number: String(index + 1).padStart(2, "0"), note: segment.note.trim() }] : [],
  );

  if (notes.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 280, after: 160 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, color: "D9D3C7", space: 16 },
        },
        children: [new TextRun({ text: "Notes", bold: true, size: 26, font: "Times New Roman" })],
      }),
    );
    for (const note of notes) {
      children.push(
        new Paragraph({
          spacing: { after: 140, line: 312, lineRule: "auto" },
          children: [
            new TextRun({ text: `${note.number}  `, italics: true, size: 21, font: "Times New Roman" }),
            ...scriptRuns(note.note, 21),
          ],
        }),
      );
    }
  }

  const document = new Document({
    creator: "Bee Translate",
    title: request.title,
    description: `${fromName} to ${toName}`,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Bee Translate",
                    italics: true,
                    size: 16,
                    color: "7A7368",
                    font: "Times New Roman",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
