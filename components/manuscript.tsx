"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Brand } from "@/components/brand";
import { FittedTextarea } from "@/components/fitted-textarea";
import { languageName, type LanguageId } from "@/lib/languages";
import type { Segment } from "@/lib/types";

type Props = {
  from: LanguageId;
  to: LanguageId;
  segments: Segment[];
  translating: boolean;
  error: string | null;
  exporting: "pdf" | "docx" | null;
  retrying: boolean;
  armNew: boolean;
  openNote: string | null;
  onEdit: (index: number, value: string) => void;
  onRetry: (index: number) => void;
  onRetryFailed: () => void;
  onToggleNote: (id: string) => void;
  onDownload: (kind: "pdf" | "docx") => void;
  onNew: () => void;
};

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M12 10.75v5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function Manuscript({
  from,
  to,
  segments,
  translating,
  error,
  exporting,
  retrying,
  armNew,
  openNote,
  onEdit,
  onRetry,
  onRetryFailed,
  onToggleNote,
  onDownload,
  onNew,
}: Props) {
  const fromName = languageName(from);
  const toName = languageName(to);
  const done = segments.filter((segment) => segment.status === "done" || segment.status === "error").length;
  const failed = segments.filter((segment) => segment.status === "error").length;
  const ready = segments.length > 0 && segments.every((segment) => segment.status === "done");
  const activeIndex = segments.findIndex((segment) => segment.status === "translating");
  const ratio = segments.length === 0 ? 0 : done / segments.length;
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<number | null>(null);
  const downloadDisabled = !ready || Boolean(exporting) || retrying;
  const translationText = segments
    .map((segment) => segment.translation.trim())
    .filter(Boolean)
    .join("\n\n");

  useEffect(() => () => {
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
  }, []);

  async function copyTranslation() {
    if (!translationText) return;
    try {
      await navigator.clipboard.writeText(translationText);
    } catch {
      return;
    }
    setCopied(true);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
  }

  useEffect(() => {
    if (!downloadOpen) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !downloadRef.current?.contains(target)) setDownloadOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDownloadOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [downloadOpen]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const row = document.querySelector(".pair.is-active");
    if (!row) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    row.scrollIntoView({ block: "nearest", behavior });
  }, [activeIndex]);

  return (
    <div className="frame wide">
      <div className="manuscript">
        <div className={translating ? "top" : "top rules"}>
          <header className="bar">
            <Brand />
            <p className="bar-flow">{fromName} → {toName}</p>
            <div className="bar-actions">
              {translating && (
                <span className="count" aria-live="polite">{done} / {segments.length}</span>
              )}
              {failed > 0 && !translating && (
                <button type="button" className="text-btn" onClick={onRetryFailed} disabled={retrying}>
                  {retrying ? "Retrying" : "Retry"}
                </button>
              )}
              <button
                type="button"
                className="text-btn"
                disabled={!translationText}
                onClick={() => void copyTranslation()}
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <div className="download" ref={downloadRef}>
                <button
                  type="button"
                  className="text-btn"
                  aria-haspopup="menu"
                  aria-expanded={downloadOpen}
                  disabled={downloadDisabled}
                  onClick={() => setDownloadOpen((open) => !open)}
                >
                  {exporting ? "Preparing" : "Download"}
                </button>
                {downloadOpen && !downloadDisabled && (
                  <div className="download-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setDownloadOpen(false); onDownload("pdf"); }}>
                      PDF
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setDownloadOpen(false); onDownload("docx"); }}>
                      DOC
                    </button>
                  </div>
                )}
              </div>
              <button type="button" className={armNew ? "text-btn is-danger" : "text-btn"} onClick={onNew}>
                {armNew ? "Discard" : "New"}
              </button>
            </div>
          </header>
          {translating && (
            <div className="progress" style={{ "--p": String(ratio) } as CSSProperties}>
              <span />
            </div>
          )}
          {error && <p className="banner">{error}</p>}
          <div className="columns-head">
            <p className="col-name" id="col-source">{fromName}</p>
            <span />
            <p className="col-name" id="col-target">{toName}</p>
          </div>
        </div>

        {segments.map((segment, index) => (
          <article
            key={segment.id}
            className={segment.status === "translating" ? "pair is-active" : "pair"}
          >
            <div className="cell source">
              <span className="cell-label">{fromName}</span>
              <p className="prose" lang={from}>{segment.original}</p>
            </div>
            <div className="gutter">
              <p className="num">{String(index + 1).padStart(2, "0")}</p>
            </div>
            <div className="cell target">
              <span className="cell-label">{toName}</span>
              {segment.status === "done" ? (
                <div className="target-body">
                  <label className="sr-only" htmlFor={segment.id}>Translation {index + 1}</label>
                  <FittedTextarea
                    id={segment.id}
                    className="translation"
                    lang={to}
                    value={segment.translation}
                    onChange={(event) => onEdit(index, event.target.value)}
                  />
                  {segment.note && (
                    <div data-note-root="">
                      <button
                        type="button"
                        className="info"
                        aria-label={`Note on segment ${index + 1}`}
                        aria-expanded={openNote === segment.id}
                        onClick={() => onToggleNote(segment.id)}
                      >
                        <InfoIcon />
                      </button>
                      {openNote === segment.id && (
                        <div className="note" role="dialog" aria-label="Translation note" lang={to}>
                          <p className="note-kicker">Note</p>
                          <p className="note-body">{segment.note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className={segment.status === "error" ? "status-line is-error" : segment.status === "translating" ? "status-line is-translating" : "status-line"}>
                  {segment.status === "error" ? (
                    segment.error || "This segment did not translate."
                  ) : segment.status === "translating" ? (
                    <>
                      <span className="translating-word">Translating</span>
                      <span className="translating-dots" aria-hidden="true">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    </>
                  ) : (
                    "Waiting"
                  )}
                  {segment.status === "error" && (
                    <button type="button" className="inline-retry" onClick={() => onRetry(index)}>Retry</button>
                  )}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
