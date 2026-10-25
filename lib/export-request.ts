import { isLanguageId, type LanguageId } from "@/lib/languages";
import { MAX_SEGMENTS } from "@/lib/segment";
import type { ExportRequest, ExportSegment } from "@/lib/types";

export class ExportInputError extends Error {}

export function readExportRequest(value: unknown): ExportRequest {
  if (!value || typeof value !== "object") {
    throw new ExportInputError("The document could not be read.");
  }

  const body = value as {
    title?: unknown;
    from?: unknown;
    to?: unknown;
    segments?: unknown;
  };

  if (typeof body.from !== "string" || !isLanguageId(body.from)) {
    throw new ExportInputError("The source language is missing.");
  }
  if (typeof body.to !== "string" || !isLanguageId(body.to)) {
    throw new ExportInputError("The target language is missing.");
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    throw new ExportInputError("The document needs a title.");
  }
  if (!Array.isArray(body.segments) || body.segments.length === 0 || body.segments.length > MAX_SEGMENTS) {
    throw new ExportInputError("There is nothing to export.");
  }

  const segments: ExportSegment[] = body.segments.map((segment) => {
    if (!segment || typeof segment !== "object") {
      throw new ExportInputError("A segment is missing.");
    }
    const item = segment as { translation?: unknown; note?: unknown };
    if (typeof item.translation !== "string") {
      throw new ExportInputError("A translation is missing.");
    }
    const translation = item.translation.replace(/\u0000/g, "");
    if (translation.length > 20_000) {
      throw new ExportInputError("A translation is too long to export.");
    }
    const note = typeof item.note === "string" ? item.note.replace(/\u0000/g, "").slice(0, 1000) : "";
    return { translation, note };
  });

  if (segments.every((segment) => !segment.translation.trim())) {
    throw new ExportInputError("There is nothing to export.");
  }

  return {
    title: body.title.trim().slice(0, 120),
    from: body.from as LanguageId,
    to: body.to as LanguageId,
    segments,
  };
}
