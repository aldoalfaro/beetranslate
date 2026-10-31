"use client";

import { useEffect, useRef, useState } from "react";
import { t, type UiLocale } from "@/lib/i18n";
import type { SessionUser } from "@/lib/types";

type Props = {
  locale: UiLocale;
  user: SessionUser | null | undefined;
  onSignIn: () => void;
};

export function AccountMenu({ locale, user, onSignIn }: Props) {
  const [open, setOpen] = useState(false);
  const [pictureFailed, setPictureFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !rootRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (user === undefined) return <span className="account" />;
  if (!user) {
    return (
      <div className="account">
        <button type="button" className="text-btn" onClick={onSignIn}>{t(locale, "signIn")}</button>
      </div>
    );
  }

  const initial = (user.name || user.email).slice(0, 1);

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="account" ref={rootRef}>
      <button
        type="button"
        className="account-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user.name || user.email}
        onClick={() => setOpen((value) => !value)}
      >
        {user.picture && !pictureFailed ? (
          <img src={user.picture} alt="" referrerPolicy="no-referrer" onError={() => setPictureFailed(true)} />
        ) : (
          <span>{initial}</span>
        )}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <p className="account-name">{user.name || user.email}</p>
          <p className="account-email">{user.email}</p>
          <a role="menuitem" href="/library">{t(locale, "library")}</a>
          <button type="button" role="menuitem" onClick={() => void logOut()}>{t(locale, "logOut")}</button>
        </div>
      )}
    </div>
  );
}
