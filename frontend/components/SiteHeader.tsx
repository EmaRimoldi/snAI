"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { SUPPORTED_LANGUAGES, useI18n } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";

const LANGUAGE_CODES = new Set<string>(SUPPORTED_LANGUAGES.map((entry) => entry.code));

function isLanguage(value: string): value is Language {
  return LANGUAGE_CODES.has(value);
}

type SiteHeaderProps = {
  view: "landing" | "login";
  session: Session | null;
  onShowLanding: (moveFocus: boolean) => void;
  onShowLogin: () => void;
  onSignOut: () => void;
};

export default function SiteHeader({
  view,
  session,
  onShowLanding,
  onShowLogin,
  onSignOut,
}: SiteHeaderProps) {
  const { language, setLanguage, t } = useI18n();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const accountBtnRef = useRef<HTMLButtonElement>(null);

  const showLoginLink = view === "landing" && !session;
  const showAccountButton = view === "landing" && Boolean(session);

  useEffect(() => {
    if (!panelOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanelOpen(false);
        accountBtnRef.current?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !accountBtnRef.current?.contains(target)) {
        setPanelOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
    };
  }, [panelOpen]);

  // Close the panel whenever the view or session changes (mirrors closeAccountPanel calls).
  useEffect(() => {
    setPanelOpen(false);
  }, [view, session]);

  return (
    <header className="site-header">
      <a
        id="brand-link"
        className="brand-link"
        href="#top"
        aria-label={t("nav.homeLabel")}
        onClick={(event) => {
          event.preventDefault();
          onShowLanding(view === "login");
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/logo.svg" alt="" />
        <span className="brand-name">RealDoor</span>
      </a>

      <div className="nav-actions">
        <label className="language-control">
          <span className="visually-hidden">{t("nav.languageLabel")}</span>
          <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M21.54 15H17a2 2 0 0 0-2 2v4.54" />
            <path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17" />
            <path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <select
            id="language-select"
            className="language-select"
            aria-label={t("nav.languageLabel")}
            value={language}
            onChange={(event) => {
              const next = event.target.value;
              if (isLanguage(next)) setLanguage(next);
            }}
          >
            {SUPPORTED_LANGUAGES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
          <svg className="select-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </label>

        <a
          id="login-link"
          className="login-link"
          href="#login"
          hidden={!showLoginLink}
          onClick={(event) => {
            event.preventDefault();
            onShowLogin();
          }}
        >
          {t("nav.login")}
        </a>

        <button
          id="account-button"
          ref={accountBtnRef}
          className="icon-button"
          type="button"
          aria-expanded={panelOpen}
          aria-controls="account-panel"
          aria-label={t("nav.account")}
          hidden={!showAccountButton}
          onClick={() => setPanelOpen((open) => !open)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path d="M4 20.5 a8 8 0 0 1 16 0 Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div id="account-panel" ref={panelRef} className="account-panel" hidden={!panelOpen}>
        <p id="account-email">{session?.user.email ?? ""}</p>
        <button id="signout" className="secondary-button" type="button" onClick={onSignOut}>
          {t("nav.signout")}
        </button>
      </div>
    </header>
  );
}
