"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Compose } from "@/components/compose";
import { Manuscript } from "@/components/manuscript";
import { downloadName } from "@/lib/download-name";
import { isFatalTranslationError, t, type UiLocale } from "@/lib/i18n";
import type { LanguageId } from "@/lib/languages";
import { MAX_INPUT_CHARS, MAX_SEGMENTS, segmentText } from "@/lib/segment";
import { MAX_INSTRUCTIONS, type Segment, type SessionUser } from "@/lib/types";

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

function fallbackTitle(text: string): string {
  const line = text.split("\n").map((part) => part.trim()).find(Boolean) ?? "";
  const words = line.split(/\s+/).filter(Boolean);
  const short = words.length > 1 ? words.slice(0, 5).join(" ") : line.slice(0, 40);
  return short.trim().slice(0, 120);
}

function documentBody(title: string, instructions: string, segments: Segment[]) {
  return {
    title,
    instructions,
    segments: segments.map((segment) => ({
      id: segment.id,
      original: segment.original,
      translation: segment.translation,
      note: segment.note,
      status: segment.status,
      error: segment.error ?? "",
    })),
  };
}

type Draft =
  | { kind: "compose"; from: LanguageId; to: LanguageId; instructions: string; text: string; fileName: string | null }
  | { kind: "manuscript"; from: LanguageId; to: LanguageId; instructions: string; fileName: string | null; title: string; segments: Segment[] };

export function App({ locale, initialId, authError }: { locale: UiLocale; initialId: string | null; authError: boolean }) {
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
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [translationId, setTranslationId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error" | null>(null);
  const [title, setTitle] = useState("");
  const segmentsRef = useRef<Segment[]>([]);
  const translationIdRef = useRef<string | null>(null);
  const instructionsRef = useRef("");
  const titleRef = useRef("");
  const titleTouched = useRef(false);
  const userRef = useRef<SessionUser | null | undefined>(undefined);
  const lastSaved = useRef("");
  instructionsRef.current = instructions;
  userRef.current = user;
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

  async function persist() {
    const id = translationIdRef.current;
    if (!id || !userRef.current) return;
    const body = documentBody(titleRef.current, instructionsRef.current, segmentsRef.current);
    const snapshot = JSON.stringify(body);
    if (snapshot === lastSaved.current) return;
    setSaveState("saving");
    const response = await fetch(`/api/translations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: snapshot,
      keepalive: true,
    });
    if (!response.ok) {
      setSaveState("error");
      return;
    }
    lastSaved.current = snapshot;
    setSaveState("saved");
  }

  async function createDocument(nextSegments: Segment[], source?: { from: LanguageId; to: LanguageId; fileName: string | null }) {
    if (!userRef.current) return;
    const sourceFrom = source?.from ?? from;
    const sourceTo = source?.to ?? to;
    const chosen = titleRef.current.trim() || fallbackTitle(nextSegments[0]?.original ?? "") || t(locale, "translationTitle");
    const body = documentBody(chosen, instructionsRef.current, nextSegments);
    const response = await fetch("/api/translations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: sourceFrom, to: sourceTo, ...body }),
    });
    if (!response.ok) {
      setSaveState("error");
      return;
    }
    const payload = (await response.json()) as { id?: string };
    if (!payload.id) return;
    translationIdRef.current = payload.id;
    setTranslationId(payload.id);
    lastSaved.current = JSON.stringify(body);
    setSaveState("saved");
    window.history.replaceState(null, "", `/?id=${payload.id}`);
  }

  function signIn() {
    const draft: Draft = phase === "compose"
      ? { kind: "compose", from, to, instructions, text, fileName }
      : { kind: "manuscript", from, to, instructions, fileName, title: titleRef.current, segments: segmentsRef.current };
    sessionStorage.setItem("bt-draft", JSON.stringify(draft));
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`;
  }

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const session = (await fetch("/api/auth/session").then((response) => response.json()).catch(() => ({ user: null }))) as { user?: SessionUser | null };
      if (cancel) return;
      const nextUser = session.user ?? null;
      userRef.current = nextUser;
      setUser(nextUser);
      if (authError) setError(t(locale, "signInFailed"));
      if (initialId && nextUser) {
        const response = await fetch(`/api/translations/${initialId}`);
        if (cancel) return;
        if (!response.ok) {
          setError(t(locale, "translationMissing"));
          return;
        }
        const document = (await response.json()) as { title?: string; from: LanguageId; to: LanguageId; instructions: string; segments: Segment[] };
        if (cancel) return;
        const restored = document.segments.map((segment) => (
          segment.status === "done" || segment.status === "error"
            ? segment
            : { ...segment, status: "error" as const, error: segment.error || t(locale, "segmentFailed") }
        ));
        setFrom(document.from);
        setTo(document.to);
        setInstructions(document.instructions);
        instructionsRef.current = document.instructions;
        titleTouched.current = true;
        titleRef.current = document.title ?? "";
        setTitle(titleRef.current);
        setFileName(null);
        translationIdRef.current = initialId;
        setTranslationId(initialId);
        lastSaved.current = JSON.stringify(documentBody(titleRef.current, document.instructions, restored));
        commit(restored);
        setPhase("done");
        return;
      }
      const raw = sessionStorage.getItem("bt-draft");
      if (!raw || !nextUser) return;
      sessionStorage.removeItem("bt-draft");
      let draft: Draft;
      try {
        draft = JSON.parse(raw) as Draft;
      } catch {
        return;
      }
      if (cancel) return;
      setFrom(draft.from);
      setTo(draft.to);
      setInstructions(draft.instructions);
      instructionsRef.current = draft.instructions;
      setFileName(draft.fileName);
      if (draft.kind === "manuscript" && draft.title) {
        titleTouched.current = true;
        titleRef.current = draft.title;
        setTitle(draft.title);
      }
      if (draft.kind === "compose") {
        setText(draft.text);
        return;
      }
      commit(draft.segments);
      setPhase(draft.segments.some((segment) => segment.translation || segment.status === "done") ? "done" : "translating");
      const naming = draft.title ? Promise.resolve() : nameTitle(draft.to, draft.segments[0]?.original ?? "");
      await createDocument(draft.segments, { from: draft.from, to: draft.to, fileName: draft.fileName });
      await naming;
      await persist();
    })();
    return () => { cancel = true; };
  }, [initialId, authError, locale]);

  useEffect(() => {
    if (!translationId || !user) return;
    const snapshot = JSON.stringify(documentBody(title, instructions, segments));
    if (snapshot === lastSaved.current) return;
    const timer = window.setTimeout(() => { void persist(); }, 3000);
    return () => window.clearTimeout(timer);
  }, [segments, instructions, title, translationId, user]);

  useEffect(() => {
    const onHide = () => { void persist(); };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  useEffect(() => {
    if (phase === "translating") {
      const done = segments.filter((segment) => segment.status === "done" || segment.status === "error").length;
      document.title = `${done} ${t(locale, "of")} ${segments.length} · Bee Translate`;
      return;
    }
    document.title = phase === "done" && title.trim() ? `${title.trim()} · Bee Translate` : "Bee Translate";
  }, [phase, segments, title, locale]);

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

  async function nameTitle(target: LanguageId, source: string) {
    try {
      const response = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: target, text: source }),
      });
      const payload = (await response.json().catch(() => ({}))) as { title?: string };
      const next = typeof payload.title === "string" ? payload.title.trim() : "";
      if (!response.ok || !next || titleTouched.current) return;
      titleRef.current = next;
      setTitle(next);
    } catch {
      if (titleTouched.current || titleRef.current.trim()) return;
      const fallback = fallbackTitle(source) || t(locale, "translationTitle");
      titleRef.current = fallback;
      setTitle(fallback);
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
    titleTouched.current = false;
    titleRef.current = "";
    setTitle("");
    commit(parts.map((original, index) => ({
      id: `seg-${index}`,
      original,
      translation: "",
      note: "",
      status: "waiting",
    })));
    setPhase("translating");
    if (userRef.current === undefined) {
      const session = (await fetch("/api/auth/session").then((response) => response.json()).catch(() => ({ user: null }))) as { user?: SessionUser | null };
      userRef.current = session.user ?? null;
      setUser(userRef.current);
    }
    const titlePromise = nameTitle(to, parts[0] ?? "");
    if (userRef.current) await createDocument(segmentsRef.current);
    void titlePromise.then(() => persist());

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
            const id = translationIdRef.current;
            if (id) {
              translationIdRef.current = null;
              setTranslationId(null);
              void fetch(`/api/translations/${id}`, { method: "DELETE" });
            }
            commit([]);
            setPhase("compose");
            setError(message);
            window.history.replaceState(null, "", "/");
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

      if (!controller.signal.aborted) {
        setPhase("done");
        await persist();
      }
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
    const exportTitle = (titleRef.current.trim() || t(locale, "translationTitle")).slice(0, 120);
    try {
      const response = await fetch(kind === "pdf" ? "/api/export/pdf" : "/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: exportTitle,
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
      anchor.download = downloadName(exportTitle, kind === "pdf" ? "pdf" : "docx");
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

  function editTitle(value: string) {
    titleTouched.current = true;
    titleRef.current = value;
    setTitle(value);
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
          user={user}
          onSignIn={signIn}
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
          openNote={openNote}
          user={user}
          saveState={saveState}
          title={title}
          onSignIn={signIn}
          onTitle={editTitle}
          onEdit={(index, value) => patch(index, { translation: value })}
          onRetry={(index) => void retry(index)}
          onRetryFailed={() => void retryFailed()}
          onToggleNote={(id) => setOpenNote((current) => (current === id ? null : id))}
          onDownload={(kind) => void download(kind)}
        />
      )}
    </main>
  );
}
