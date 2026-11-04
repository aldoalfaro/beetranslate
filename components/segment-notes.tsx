"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { noteOnQuote, t, type UiLocale } from "@/lib/i18n";
import type { NoteAnchor } from "@/lib/note-anchors";

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M12 10.75v5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.8" fill="currentColor" />
    </svg>
  );
}

function FloatingNote({
  anchorRef,
  mode,
  text,
  lang,
  locale,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  mode: "phrase" | "block";
  text: string;
  lang: string;
  locale: UiLocale;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const anchor = anchorRef.current;
    const column = anchor?.closest(".cell");
    if (!card || !anchor || !(column instanceof HTMLElement)) return;

    const place = () => {
      const avoid = mode === "block" ? column.getBoundingClientRect() : anchor.getBoundingClientRect();
      const box = column.getBoundingClientRect();
      const prose = anchor.closest(".prose");
      const proseBox = prose instanceof HTMLElement ? prose.getBoundingClientRect() : avoid;
      const width = Math.min(box.width, window.innerWidth - 24);
      const left = Math.min(Math.max(12, box.left), window.innerWidth - width - 12);
      card.style.width = `${width}px`;
      const height = card.offsetHeight;
      const gap = 8;
      const header = document.querySelector(".top");
      const limit = header instanceof HTMLElement ? header.getBoundingClientRect().bottom + 8 : 8;
      const above = avoid.top - height - gap;
      const phraseAtTop = mode === "phrase" && avoid.top - proseBox.top < 6;
      let top = above;
      if (mode === "block") {
        top = above >= limit ? above : avoid.bottom + gap;
      } else if (!(phraseAtTop && above >= limit)) {
        top = Math.max(avoid.bottom, proseBox.bottom) + gap;
      }
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      card.style.visibility = "visible";
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(anchor);
    observer.observe(column);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [anchorRef, mode, text]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div ref={cardRef} className="note note-float" role="note" lang={lang} data-note-root="" style={{ visibility: "hidden" }}>
      <p className="note-kicker">{t(locale, "note")}</p>
      <p className="note-body">{text}</p>
    </div>,
    document.body,
  );
}

export function AnchoredProse({
  original,
  lang,
  noteLang,
  locale,
  anchors,
  openNote,
  onToggle,
}: {
  original: string;
  lang: string;
  noteLang: string;
  locale: UiLocale;
  anchors: NoteAnchor[];
  openNote: string | null;
  onToggle: (id: string) => void;
}) {
  const ranges = anchors.filter((anchor) => anchor.start >= 0).sort((a, b) => a.start - b.start);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const anchor of ranges) {
    if (anchor.start < cursor) continue;
    if (anchor.start > cursor) nodes.push(original.slice(cursor, anchor.start));
    const quote = original.slice(anchor.start, anchor.end);
    nodes.push(
      <NoteSpot
        key={anchor.id}
        quote={quote}
        text={anchor.text}
        open={openNote === anchor.id}
        lang={noteLang}
        locale={locale}
        onToggle={() => onToggle(anchor.id)}
      />,
    );
    cursor = anchor.end;
  }

  if (cursor < original.length) nodes.push(original.slice(cursor));

  return (
    <p className="prose" lang={lang}>
      {nodes}
    </p>
  );
}

function NoteSpot({
  quote,
  text,
  open,
  lang,
  locale,
  onToggle,
}: {
  quote: string;
  text: string;
  open: boolean;
  lang: string;
  locale: UiLocale;
  onToggle: () => void;
}) {
  const spotRef = useRef<HTMLSpanElement>(null);

  return (
    <span ref={spotRef} className="note-spot" data-note-root="">
      <button
        type="button"
        className={open ? "source-note is-open" : "source-note"}
        aria-expanded={open}
        aria-label={noteOnQuote(locale, quote)}
        onClick={onToggle}
      >
        {quote}
      </button>
      {open && <FloatingNote anchorRef={spotRef} mode="phrase" text={text} lang={lang} locale={locale} />}
    </span>
  );
}

export function LooseNote({
  text,
  lang,
  locale,
  open,
  label,
  onToggle,
}: {
  text: string;
  lang: string;
  locale: UiLocale;
  open: boolean;
  label: string;
  onToggle: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div data-note-root="">
      <button type="button" className="info" ref={buttonRef} aria-label={label} aria-expanded={open} onClick={onToggle}>
        <InfoIcon />
      </button>
      {open && <FloatingNote anchorRef={buttonRef} mode="block" text={text} lang={lang} locale={locale} />}
    </div>
  );
}
