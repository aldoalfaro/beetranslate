"use client";

import { useEffect, useRef, useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { Brand } from "@/components/brand";
import { downloadName } from "@/lib/download-name";
import { segmentCount, t, type UiLocale } from "@/lib/i18n";
import { languageName, type LanguageId } from "@/lib/languages";
import type { SessionUser } from "@/lib/types";

type Item = {
  id: string;
  title: string;
  from: LanguageId;
  to: LanguageId;
  segmentCount: number;
  updatedAt: string;
};

type Stored = {
  title: string;
  from: LanguageId;
  to: LanguageId;
  segments: { translation: string; note: string }[];
};

export function Library({ locale }: { locale: UiLocale }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [items, setItems] = useState<Item[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const docs = useRef(new Map<string, Stored>());
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
    document.title = `${t(locale, "library")} · Bee Translate`;
    let cancel = false;
    void (async () => {
      const session = (await fetch("/api/auth/session").then((response) => response.json()).catch(() => ({ user: null }))) as { user?: SessionUser | null };
      if (cancel) return;
      const nextUser = session.user ?? null;
      setUser(nextUser);
      if (!nextUser) return;
      const payload = (await fetch("/api/translations").then((response) => response.json()).catch(() => ({ translations: [] }))) as { translations?: Item[] };
      if (!cancel) setItems(payload.translations ?? []);
    })();
    return () => { cancel = true; };
  }, [locale]);

  useEffect(() => () => {
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
  }, []);

  useEffect(() => {
    if (!openId) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(`[data-library-menu="${openId}"]`)) setOpenId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  const date = new Intl.DateTimeFormat(locale === "es" ? "es" : "en", { day: "numeric", month: "short", year: "numeric" });

  async function load(item: Item): Promise<Stored | null> {
    const cached = docs.current.get(item.id);
    if (cached) return cached;
    const response = await fetch(`/api/translations/${item.id}`);
    if (!response.ok) return null;
    const document = (await response.json()) as Stored;
    docs.current.set(item.id, document);
    return document;
  }

  async function copyItem(item: Item) {
    const document = await load(item);
    const text = document?.segments.map((segment) => segment.translation.trim()).filter(Boolean).join("\n\n") ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopiedId(item.id);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1600);
  }

  async function downloadItem(item: Item, kind: "pdf" | "docx") {
    if (busyId) return;
    const stored = await load(item);
    if (!stored) return;
    setBusyId(item.id);
    setOpenId(null);
    try {
      const response = await fetch(kind === "pdf" ? "/api/export/pdf" : "/api/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: stored.title || item.title,
          from: stored.from,
          to: stored.to,
          segments: stored.segments.map((segment) => ({ translation: segment.translation, note: segment.note })),
        }),
      });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName(stored.title || item.title, kind === "pdf" ? "pdf" : "docx");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page">
      <div className="frame">
        <header className="bar library-bar">
          <Brand />
          {user !== undefined && <a className="text-btn library-new" href="/">{t(locale, "new")}</a>}
          <AccountMenu locale={locale} user={user} onSignIn={() => { window.location.href = "/api/auth/google?next=/library"; }} />
        </header>
        {user && items && items.length === 0 && <p className="library-empty">{t(locale, "libraryEmpty")}</p>}
        {user && items && items.length > 0 && (
          <div className="library-list">
            {items.map((item) => (
              <div key={item.id} className={openId === item.id ? "library-row is-open" : "library-row"}>
                <a className="library-link" href={`/?id=${item.id}`}>
                  <span className="library-title">{item.title}</span>
                  <span className="library-meta">
                    {languageName(item.from, locale)} → {languageName(item.to, locale)}
                    <span aria-hidden="true"> · </span>
                    {segmentCount(locale, item.segmentCount)}
                  </span>
                </a>
                <div className="library-end">
                  <time className="library-date" dateTime={item.updatedAt}>{date.format(new Date(item.updatedAt))}</time>
                  <div className="download" data-library-menu={item.id}>
                    <button
                      type="button"
                      className="text-btn library-more"
                      aria-haspopup="menu"
                      aria-expanded={openId === item.id}
                      aria-label={t(locale, "actions")}
                      onClick={() => setOpenId((current) => (current === item.id ? null : item.id))}
                    >
                      ···
                    </button>
                    {openId === item.id && (
                      <div className="download-menu" role="menu">
                        <button type="button" role="menuitem" disabled={busyId === item.id} onClick={() => void downloadItem(item, "pdf")}>
                          {t(locale, "downloadPdf")}
                        </button>
                        <button type="button" role="menuitem" disabled={busyId === item.id} onClick={() => void downloadItem(item, "docx")}>
                          {t(locale, "downloadDoc")}
                        </button>
                        <button type="button" role="menuitem" onClick={() => void copyItem(item)}>
                          {copiedId === item.id ? t(locale, "copied") : t(locale, "copyTranslation")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
