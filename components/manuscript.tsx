"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AccountMenu } from "@/components/account-menu";
import { Brand } from "@/components/brand";
import { AnchoredProse, LooseNote, TranslationField } from "@/components/segment-notes";
import { noteOnSegment, t, translationField, type UiLocale } from "@/lib/i18n";
import { languageName, type LanguageId } from "@/lib/languages";
import { noteAnchors } from "@/lib/note-anchors";
import type { Segment, SessionUser } from "@/lib/types";

type Props = {
  locale: UiLocale;
  from: LanguageId;
  to: LanguageId;
  segments: Segment[];
  translating: boolean;
  error: string | null;
  exporting: "pdf" | "docx" | null;
  retrying: boolean;
  openNote: string | null;
  user: SessionUser | null | undefined;
  saveState: "saving" | "saved" | "error" | null;
  title: string;
  onSignIn: () => void;
  onTitle: (value: string) => void;
  onEdit: (index: number, value: string) => void;
  onRetry: (index: number) => void;
  onRetryFailed: () => void;
  onToggleNote: (id: string) => void;
  onDownload: (kind: "pdf" | "docx") => void;
};

export function Manuscript({
  locale,
  from,
  to,
  segments,
  translating,
  error,
  exporting,
  retrying,
  openNote,
  user,
  saveState,
  title,
  onSignIn,
  onTitle,
  onEdit,
  onRetry,
  onRetryFailed,
  onToggleNote,
  onDownload,
}: Props) {
  const fromName = languageName(from, locale);
  const toName = languageName(to, locale);
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
            <input
              className="bar-title"
              value={title}
              maxLength={120}
              aria-label={t(locale, "titleLabel")}
              spellCheck={false}
              onChange={(event) => onTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <div className="bar-actions">
              {translating && (
                <span className="count" aria-live="polite">{done} / {segments.length}</span>
              )}
              {user && saveState && (
                <span className={saveState === "error" ? "count save-state is-error" : "count save-state"} aria-live="polite">
                  {saveState === "saving" ? t(locale, "saving") : saveState === "error" ? t(locale, "saveFailed") : t(locale, "saved")}
                </span>
              )}
              {!user && (
                <button type="button" className="text-btn" onClick={onSignIn}>{t(locale, "signInToSave")}</button>
              )}
              {failed > 0 && !translating && (
                <button type="button" className="text-btn" onClick={onRetryFailed} disabled={retrying}>
                  {retrying ? t(locale, "retrying") : t(locale, "retry")}
                </button>
              )}
              <div className="download" ref={downloadRef}>
                <button
                  type="button"
                  className="text-btn"
                  aria-haspopup="menu"
                  aria-expanded={downloadOpen}
                  disabled={!translationText && downloadDisabled}
                  onClick={() => setDownloadOpen((open) => !open)}
                >
                  {exporting ? t(locale, "preparing") : t(locale, "download")}
                </button>
                {downloadOpen && (translationText || !downloadDisabled) && (
                  <div className="download-menu" role="menu">
                    <button type="button" role="menuitem" disabled={downloadDisabled} onClick={() => { setDownloadOpen(false); onDownload("pdf"); }}>
                      PDF
                    </button>
                    <button type="button" role="menuitem" disabled={downloadDisabled} onClick={() => { setDownloadOpen(false); onDownload("docx"); }}>
                      DOC
                    </button>
                    <button type="button" role="menuitem" disabled={!translationText} onClick={() => void copyTranslation()}>
                      {copied ? t(locale, "copied") : t(locale, "copy")}
                    </button>
                  </div>
                )}
              </div>
              <a className="text-btn" href="/library">{t(locale, "exit")}</a>
              <AccountMenu locale={locale} user={user} onSignIn={onSignIn} />
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

        {segments.map((segment, index) => {
          const anchors = segment.status === "done" ? noteAnchors(segment.id, segment.original, segment.note, segment.translation) : [];
          const located = anchors.filter((anchor) => anchor.start >= 0);
          const openAnchor = anchors.find((anchor) => anchor.id === openNote);
          const noted = openNote === segment.id || (openNote?.startsWith(`${segment.id}:`) ?? false);
          return (
          <article
            key={segment.id}
            className={segment.status === "translating" ? "pair is-active" : noted ? "pair is-noted" : "pair"}
          >
            <div className="cell source">
              <span className="cell-label">{fromName}</span>
              {located.length > 0 ? (
                <AnchoredProse
                  original={segment.original}
                  lang={from}
                  noteLang={to}
                  locale={locale}
                  anchors={located}
                  openNote={openNote}
                  onToggle={onToggleNote}
                />
              ) : (
                <p className="prose" lang={from}>{segment.original}</p>
              )}
            </div>
            <div className="gutter">
              <p className="num">{String(index + 1).padStart(2, "0")}</p>
            </div>
            <div className="cell target">
              <span className="cell-label">{toName}</span>
              {segment.status === "done" ? (
                <div className="target-body">
                  <label className="sr-only" htmlFor={segment.id}>{translationField(locale, index + 1)}</label>
                  <TranslationField
                    id={segment.id}
                    className={located.length > 0 ? "translation is-clear" : "translation"}
                    lang={to}
                    value={segment.translation}
                    ranges={openAnchor?.translation ?? []}
                    onChange={(event) => onEdit(index, event.target.value)}
                  />
                  {segment.note && located.length === 0 && (
                    <LooseNote
                      text={segment.note}
                      lang={to}
                      locale={locale}
                      open={openNote === `${segment.id}:0`}
                      label={noteOnSegment(locale, index + 1)}
                      onToggle={() => onToggleNote(`${segment.id}:0`)}
                    />
                  )}
                </div>
              ) : (
                <p className={segment.status === "error" ? "status-line is-error" : segment.status === "translating" ? "status-line is-translating" : "status-line"}>
                  {segment.status === "error" ? (
                    segment.error || t(locale, "segmentFailed")
                  ) : segment.status === "translating" ? (
                    <>
                      <span className="translating-word">{t(locale, "translating")}</span>
                      <span className="translating-dots" aria-hidden="true">
                        <span>.</span>
                        <span>.</span>
                        <span>.</span>
                      </span>
                    </>
                  ) : (
                    t(locale, "waiting")
                  )}
                  {segment.status === "error" && (
                    <button type="button" className="inline-retry" onClick={() => onRetry(index)}>{t(locale, "retry")}</button>
                  )}
                </p>
              )}
            </div>
          </article>
          );
        })}
      </div>
    </div>
  );
}
