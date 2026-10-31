"use client";

import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/account-menu";
import { Brand } from "@/components/brand";
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

export function Library({ locale }: { locale: UiLocale }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [items, setItems] = useState<Item[] | null>(null);

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

  const date = new Intl.DateTimeFormat(locale === "es" ? "es" : "en", { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="page">
      <div className="frame">
        <header className="bar">
          <Brand />
          <AccountMenu locale={locale} user={user} onSignIn={() => { window.location.href = "/api/auth/google?next=/library"; }} />
        </header>
        {user && items && items.length === 0 && <p className="library-empty">{t(locale, "libraryEmpty")}</p>}
        {user && items && items.length > 0 && (
          <div className="library-list">
            {items.map((item) => (
              <a key={item.id} className="library-row" href={`/?id=${item.id}`}>
                <span>
                  <span className="library-title">{item.title}</span>
                  <span className="library-meta">
                    {languageName(item.from, locale)} → {languageName(item.to, locale)}
                    <span aria-hidden="true"> · </span>
                    {segmentCount(locale, item.segmentCount)}
                  </span>
                </span>
                <time className="library-date" dateTime={item.updatedAt}>{date.format(new Date(item.updatedAt))}</time>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
