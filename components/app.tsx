"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Compose } from "@/components/compose";
import { Manuscript } from "@/components/manuscript";
import { downloadName } from "@/lib/download-name";
import { isFatalTranslationError, t, type UiLocale } from "@/lib/i18n";
import { languageName, type LanguageId } from "@/lib/languages";
import { MAX_INPUT_CHARS, MAX_SEGMENTS, segmentText } from "@/lib/segment";
import { MAX_INSTRUCTIONS, type Segment } from "@/lib/types";

type Phase = "compose" | "translating" | "done";

class SegmentError extends Error {
  fatal: boolean;

  constructor(message: string, fatal = false) {
    super(message);
    this.name = "SegmentError";
    this.fatal = fatal;
  }
}

function isFatal(error: unknown): boolean {
  if (error instanceof SegmentError && error.fatal) return true;
  const message = error instanceof Error ? error.message : "";
  return isFatalTranslationError(message);
}

async function requestSegment(input: {
  locale: UiLocale;
  from: LanguageId;
  to: LanguageId;
  current: string;
  instructions: string;
  previousOriginal: string;
  previousTranslation: string;
  signal?: AbortSignal;
}): Promise<{ translation: string; note: string }> {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      current: input.current,
      instructions: input.instructions,
      previousOriginal: input.previousOriginal,
      previousTranslation: input.previousTranslation,
    }),
    signal: input.signal,
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; translation?: string; note?: string; fatal?: boolean };
  if (!response.ok) {
    throw new SegmentError(payload.error || t(input.locale, "segmentFailed"), Boolean(payload.fatal));
  }
  if (typeof payload.translation !== "string" || !payload.translation.trim()) {
    throw new SegmentError(t(input.locale, "segmentEmpty"));
  }
  return {
    translation: payload.translation.trim(),
    note: typeof payload.note === "string" ? payload.note.trim() : "",
  };
}

export function App({ locale }: { locale: UiLocale }) {
  const [phase, setPhase] = useState<Phase>("compose");
  const [from, setFrom] = useState<LanguageId>("ko");
  const [to, setTo] = useState<LanguageId>("es");
  const [text, setText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [armNew, setArmNew] = useState(false);
  const segmentsRef = useRef<Segment[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const inflightRef = useRef(new Set<number>());
  const preview = useMemo(() => segmentText(text), [text]);

  function commit(next: Segment[]) {
    segmentsRef.current = next;
    setSegments(next);
  }

  function patch(index: number, partial: Partial<Segment>) {
    commit(segmentsRef.current.map((segment, i) => (i === index ? { ...segment, ...partial } : segment)));
  }

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (phase === "translating") {
      const done = segments.filter((segment) => segment.status === "done" || segment.status === "error").length;
      document.title = `${done} ${t(locale, "of")} ${segments.length} · Bee Translate`;
      return;
    }
    document.title = phase === "done" ? `${languageName(from, locale)} → ${languageName(to, locale)} · Bee Translate` : "Bee Translate";
  }, [phase, segments, from, to, locale]);

  useEffect(() => {
    if (!armNew) return;
    const timer = window.setTimeout(() => setArmNew(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armNew]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && phase === "compose") {
        event.preventDefault();
        void translate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!openNote) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-note-root]")) setOpenNote(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenNote(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openNote]);

  async function takeFile(file: File) {
    setReading(true);
    setError(null);
    setFileName(file.name);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/extract", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; text?: string };
      if (!response.ok || typeof payload.text !== "string") {
        throw new Error(payload.error || t(locale, "fileUnreadable"));
      }
      setText(payload.text);
    } catch (caught) {
      setFileName(null);
      setError(caught instanceof Error ? caught.message : t(locale, "fileUnreadable"));
    } finally {
      setReading(false);
    }
  }

  async function translate() {
    const parts = segmentText(text);
    if (
      runningRef.current ||
      parts.length === 0 ||
      from === to ||
      parts.length > MAX_SEGMENTS ||
      text.length > MAX_INPUT_CHARS ||
      reading ||
      phase !== "compose"
    ) {
      return;
    }

    runningRef.current = true;

    setError(null);
    setOpenNote(null);
    setArmNew(false);
    commit(parts.map((original, index) => ({
      id: `seg-${index}`,
      original,
      translation: "",
      note: "",
      status: "waiting",
    })));
    setPhase("translating");

    const controller = new AbortController();
    abortRef.current = controller;
    let succeeded = 0;

    try {
      for (let index = 0; index < parts.length; index += 1) {
        if (controller.signal.aborted) return;
        patch(index, { status: "translating", error: undefined });
        const previous = index > 0 ? segmentsRef.current[index - 1] : undefined;
        try {
          const result = await requestSegment({
            locale,
            from,
            to,
            current: parts[index],
            instructions: instructions.trim().slice(0, MAX_INSTRUCTIONS),
            previousOriginal: previous?.original ?? "",
            previousTranslation: previous?.status === "done" ? previous.translation : "",
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          succeeded += 1;
          patch(index, { translation: result.translation, note: result.note, status: "done", error: undefined });
        } catch (caught) {
          if (controller.signal.aborted) return;
          const message = caught instanceof Error ? caught.message : t(locale, "segmentFailed");
          const fatal = isFatal(caught);
          if (fatal && succeeded === 0) {
            commit([]);
            setPhase("compose");
            setError(message);
            return;
          }
          patch(index, { status: "error", error: message });
          if (fatal) {
            commit(segmentsRef.current.map((segment, i) => (
              i > index && segment.status === "waiting"
                ? { ...segment, status: "error", error: message }
                : segment
            )));
            break;
          }
        }
      }

      if (!controller.signal.aborted) setPhase("done");
    } finally {
      runningRef.current = false;
    }
  }

  async function retry(index: number) {
    if (inflightRef.current.has(index)) return;
    const current = segmentsRef.current[index];
    if (!current || current.status === "translating") return;
    const previous = segmentsRef.current[index - 1];
    inflightRef.current.add(index);
    patch(index, { status: "translating", error: undefined });
    try {
      const result = await requestSegment({
        locale,
        from,
        to,
        current: current.original,
        instructions: instructions.trim().slice(0, MAX_INSTRUCTIONS),
        previousOriginal: previous?.original ?? "",
        previousTranslation: previous?.translation ?? "",
      });
      patch(index, { translation: result.translation, note: result.note, status: "done", error: undefined });
    } catch (caught) {
      patch(index, {
        status: "error",
        error: caught instanceof Error ? caught.message : t(locale, "segmentFailed"),
      });
    } finally {
      inflightRef.current.delete(index);
    }
  }

  async function retryFailed() {
    if (retrying) return;
    setRetrying(true);
    setError(null);
    try {
      const indexes = segmentsRef.current.flatMap((segment, index) => (segment.status === "error" ? [index] : []));
      for (const index of indexes) await retry(index);
    } finally {
      setRetrying(false);
    }
  }

  async function download(kind: "pdf" | "docx") {
    const ready = segmentsRef.current.length > 0 && segmentsRef.current.every((segment) => segment.status === "done");
    if (!ready || exporting) return;
    setExporting(kind);
    setError(null);
    const title = (fileName ? fileName.replace(/\.[^.]+$/, "") : t(locale, "translationTitle")).slice(0, 120);
    try {
      const response = await fetch(kind === "pdf" ? "/api/export/pdf" : "/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          from,
          to,
          segments: segmentsRef.current.map((segment) => ({
            translation: segment.translation,
            note: segment.note,
          })),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || t(locale, "fileUnprepared"));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName(title, kind === "pdf" ? "pdf" : "docx");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t(locale, "fileUnprepared"));
    } finally {
      setExporting(null);
    }
  }

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    commit([]);
    setText("");
    setFileName(null);
    setError(null);
    setOpenNote(null);
    setArmNew(false);
    setExporting(null);
    setRetrying(false);
    setPhase("compose");
  }

  function requestNew() {
    const dirty = segmentsRef.current.some((segment) => segment.translation || segment.status === "done");
    if (dirty && !armNew) {
      setArmNew(true);
      return;
    }
    reset();
  }

  return (
    <main className="page">
      {phase === "compose" ? (
        <Compose
          locale={locale}
          from={from}
          to={to}
          text={text}
          fileName={fileName}
          reading={reading}
          error={error}
          segmentCount={preview.length}
          onFrom={setFrom}
          onTo={setTo}
          instructions={instructions}
          onInstructions={setInstructions}
          onText={setText}
          onFile={(file) => void takeFile(file)}
          onClearFile={() => {
            setFileName(null);
            setText("");
          }}
          onTranslate={() => void translate()}
        />
      ) : (
        <Manuscript
          locale={locale}
          from={from}
          to={to}
          segments={segments}
          translating={phase === "translating" || retrying}
          error={error}
          exporting={exporting}
          retrying={retrying}
          armNew={armNew}
          openNote={openNote}
          onEdit={(index, value) => patch(index, { translation: value })}
          onRetry={(index) => void retry(index)}
          onRetryFailed={() => void retryFailed()}
          onToggleNote={(id) => setOpenNote((current) => (current === id ? null : id))}
          onDownload={(kind) => void download(kind)}
          onNew={requestNew}
        />
      )}
    </main>
  );
}
