import type { LanguageId } from "@/lib/languages";

export const MAX_INSTRUCTIONS = 2_000;

export type SegmentStatus = "waiting" | "translating" | "done" | "error";

export type Segment = {
  id: string;
  original: string;
  translation: string;
  note: string;
  status: SegmentStatus;
  error?: string;
};

export type TranslateEvent =
  | { type: "working"; index: number }
  | { type: "segment"; index: number; translation: string; note: string }
  | { type: "segment-error"; index: number; message: string }
  | { type: "fatal"; message: string }
  | { type: "done" };

export type ExportSegment = {
  translation: string;
  note: string;
};

export type ExportRequest = {
  title: string;
  from: LanguageId;
  to: LanguageId;
  segments: ExportSegment[];
};
