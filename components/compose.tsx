"use client";

import { useEffect, useRef, useState } from "react";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={open ? "chevron is-open" : "chevron"} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4.2 2.3 8 6 4.2 9.7" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h7.1L19 8.3V20.5H7V3.5z" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M14 3.8V8.4h4.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
import { Brand } from "@/components/brand";
import { FittedTextarea } from "@/components/fitted-textarea";
import { segmentCount as segmentCountLabel, t, type UiLocale } from "@/lib/i18n";
import { LANGUAGES, languageName, type LanguageId } from "@/lib/languages";
import { MAX_INPUT_CHARS, MAX_SEGMENTS } from "@/lib/segment";
import { MAX_INSTRUCTIONS } from "@/lib/types";

type Props = {
  locale: UiLocale;
  from: LanguageId;
  to: LanguageId;
  text: string;
  instructions: string;
  fileName: string | null;
  reading: boolean;
  error: string | null;
  segmentCount: number;
  onFrom: (value: LanguageId) => void;
  onTo: (value: LanguageId) => void;
  onText: (value: string) => void;
  onInstructions: (value: string) => void;
  onFile: (file: File) => void;
  onClearFile: () => void;
  onTranslate: () => void;
};

export function Compose({
  locale,
  from,
  to,
  text,
  instructions,
  fileName,
  reading,
  error,
  segmentCount,
  onFrom,
  onTo,
  onText,
  onInstructions,
  onFile,
  onClearFile,
  onTranslate,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);
  const [dragging, setDragging] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const tooLong = text.length > MAX_INPUT_CHARS;
  const tooMany = segmentCount > MAX_SEGMENTS;
  const sameLanguage = from === to;
  const canTranslate = text.trim().length > 0 && !sameLanguage && !tooLong && !tooMany && !reading;

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) textRef.current?.focus();
  }, []);

  useEffect(() => {
    if (instructionsOpen) instructionsRef.current?.focus();
  }, [instructionsOpen]);

  const hint = sameLanguage
    ? t(locale, "differentLanguages")
    : tooLong
      ? t(locale, "tooLong")
      : tooMany
        ? `${segmentCountLabel(locale, segmentCount)}. ${MAX_SEGMENTS} ${t(locale, "maximum")} ${t(locale, "shorten")}`
        : text.trim()
          ? segmentCountLabel(locale, segmentCount)
          : "";

  return (
    <div className="frame">
      <section
        className={dragging ? "compose is-dragging" : "compose"}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
      >
        <header className="bar">
          <Brand />
        </header>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
        />

        <div className="lang-row">
          <div>
            <label className="lang-kicker" htmlFor="source-language">{t(locale, "from")}</label>
            <select
              id="source-language"
              className="lang-select"
              value={from}
              onChange={(event) => onFrom(event.target.value as LanguageId)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>{languageName(language.id, locale)}</option>
              ))}
            </select>
          </div>
          <p className="lang-arrow" aria-hidden="true">→</p>
          <div>
            <label className="lang-kicker" htmlFor="target-language">{t(locale, "to")}</label>
            <select
              id="target-language"
              className="lang-select"
              value={to}
              onChange={(event) => onTo(event.target.value as LanguageId)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>{languageName(language.id, locale)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="source-block">
          {dragging && <p className="drop-hint">{t(locale, "dropFile")}</p>}
          {fileName ? (
            <div className="file-sheet">
              <FileIcon />
              <div className="file-sheet-copy">
                <p className="file-sheet-name">{fileName}</p>
                <p className={tooLong || tooMany ? "file-sheet-meta is-over" : "file-sheet-meta"}>
                  {reading ? t(locale, "reading") : hint}
                </p>
              </div>
              <button type="button" className="text-btn" onClick={onClearFile}>{t(locale, "remove")}</button>
            </div>
          ) : (
            <>
              <label className="sr-only" htmlFor="source-text">{t(locale, "sourceText")}</label>
              <FittedTextarea
                ref={textRef}
                id="source-text"
                className="source-input"
                minHeight={280}
                value={text}
                placeholder={t(locale, "sourcePlaceholder")}
                onChange={(event) => onText(event.target.value)}
              />
            </>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}
        {!fileName && hint && (
          <p className={tooLong || tooMany || sameLanguage ? "count is-over field-count" : "count field-count"}>{hint}</p>
        )}

        <div className="instructions">
          <button
            type="button"
            className={instructions.trim() ? "text-btn instructions-toggle is-set" : "text-btn instructions-toggle"}
            aria-expanded={instructionsOpen}
            aria-controls="instructions"
            onClick={() => setInstructionsOpen((open) => !open)}
          >
            <Chevron open={instructionsOpen} />
            {t(locale, "customInstructions")}
          </button>
          {instructionsOpen && (
            <textarea
              ref={instructionsRef}
              id="instructions"
              className="instructions-input"
              aria-label={t(locale, "customInstructions")}
              value={instructions}
              maxLength={MAX_INSTRUCTIONS}
              rows={3}
              placeholder={t(locale, "instructionsPlaceholder")}
              onChange={(event) => onInstructions(event.target.value)}
            />
          )}
        </div>

        <div className="action-row">
          <button type="button" className="text-btn" onClick={() => fileRef.current?.click()}>
            {t(locale, "upload")}
          </button>
          <button type="button" className="translate" disabled={!canTranslate} onClick={onTranslate}>
            {t(locale, "translate")}
            <span className="arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </div>
  );
}
