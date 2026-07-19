"use client";

import { SUPPORTED_LANGUAGES, useI18n } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";

const LANGUAGE_CODES = new Set<string>(SUPPORTED_LANGUAGES.map((entry) => entry.code));

function isLanguage(value: string): value is Language {
  return LANGUAGE_CODES.has(value);
}

type SiteHeaderProps = {
  onHome: () => void;
};

export default function SiteHeader({ onHome }: SiteHeaderProps) {
  const { language, setLanguage, t } = useI18n();

  return (
    <header className="site-header">
      <a
        id="brand-link"
        className="brand-link"
        href="#top"
        aria-label={t("nav.homeLabel")}
        onClick={(event) => {
          event.preventDefault();
          onHome();
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
      </div>
    </header>
  );
}
