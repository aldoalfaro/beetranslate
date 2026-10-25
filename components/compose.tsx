"use client";

import { useEffect, useRef, useState } from "react";

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
import { LANGUAGES, type LanguageId } from "@/lib/languages";
import { MAX_INPUT_CHARS, MAX_SEGMENTS, segmentCountLabel } from "@/lib/segment";

type Props = {
  from: LanguageId;
  to: LanguageId;
  text: string;
  fileName: string | null;
  reading: boolean;
  error: string | null;
  segmentCount: number;
  onFrom: (value: LanguageId) => void;
  onTo: (value: LanguageId) => void;
  onText: (value: string) => void;
  onFile: (file: File) => void;
  onClearFile: () => void;
  onTranslate: () => void;
};

export function Compose({
  from,
  to,
  text,
  fileName,
  reading,
  error,
  segmentCount,
  onFrom,
  onTo,
  onText,
  onFile,
  onClearFile,
  onTranslate,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [dragging, setDragging] = useState(false);
  const tooLong = text.length > MAX_INPUT_CHARS;
  const tooMany = segmentCount > MAX_SEGMENTS;
  const sameLanguage = from === to;
  const canTranslate = text.trim().length > 0 && !sameLanguage && !tooLong && !tooMany && !reading;

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) textRef.current?.focus();
  }, []);

  const hint = sameLanguage
    ? "Choose two different languages."
    : tooLong
      ? "This text is too long to translate in one pass."
      : tooMany
        ? `${segmentCountLabel(segmentCount)}. ${MAX_SEGMENTS} is the maximum. Shorten the text and try again.`
        : text.trim()
          ? segmentCountLabel(segmentCount)
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
            <label className="lang-kicker" htmlFor="source-language">From</label>
            <select
              id="source-language"
              className="lang-select"
              value={from}
              onChange={(event) => onFrom(event.target.value as LanguageId)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>{language.name}</option>
              ))}
            </select>
          </div>
          <p className="lang-arrow" aria-hidden="true">→</p>
          <div>
            <label className="lang-kicker" htmlFor="target-language">To</label>
            <select
              id="target-language"
              className="lang-select"
              value={to}
              onChange={(event) => onTo(event.target.value as LanguageId)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.id} value={language.id}>{language.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="source-block">
          {dragging && <p className="drop-hint">Drop the file</p>}
          {fileName ? (
            <div className="file-sheet">
              <FileIcon />
              <div className="file-sheet-copy">
                <p className="file-sheet-name">{fileName}</p>
                <p className={tooLong || tooMany ? "file-sheet-meta is-over" : "file-sheet-meta"}>
                  {reading ? "Reading" : hint}
                </p>
              </div>
              <button type="button" className="text-btn" onClick={onClearFile}>Remove</button>
            </div>
          ) : (
            <>
              <label className="sr-only" htmlFor="source-text">Source text</label>
              <FittedTextarea
                ref={textRef}
                id="source-text"
                className="source-input"
                minHeight={280}
                value={text}
                placeholder="Paste text, or drop a PDF or Word file."
                onChange={(event) => onText(event.target.value)}
              />
            </>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}
        {!fileName && hint && (
          <p className={tooLong || tooMany || sameLanguage ? "count is-over field-count" : "count field-count"}>{hint}</p>
        )}

        <div className="action-row">
          <button type="button" className="text-btn" onClick={() => fileRef.current?.click()}>
            Upload
          </button>
          <button type="button" className="translate" disabled={!canTranslate} onClick={onTranslate}>
            Translate
            <span className="arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </div>
  );
}
