"use client";

import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LANGUAGES, useI18n } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import LanguageFlag from "@/components/LanguageFlag";

type SiteHeaderProps = {
  onHome: () => void;
  onDiscover: () => void;
  activeView: "landing" | "app" | "discover";
};

export default function SiteHeader({ onHome, onDiscover, activeView }: SiteHeaderProps) {
  const { language, setLanguage, t } = useI18n();
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState(language);
  const languageControlRef = useRef<HTMLDivElement>(null);
  const languageButtonRef = useRef<HTMLButtonElement>(null);
  const languageOptionRefs = useRef<Partial<Record<Language, HTMLButtonElement>>>({});

  const openLanguageMenu = (focusLanguage: Language = language) => {
    setActiveLanguage(focusLanguage);
    setIsLanguageMenuOpen(true);
  };

  const closeLanguageMenu = (restoreFocus = false) => {
    setIsLanguageMenuOpen(false);
    if (restoreFocus) languageButtonRef.current?.focus();
  };

  const chooseLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    setActiveLanguage(nextLanguage);
    closeLanguageMenu(true);
  };

  const moveOptionFocus = (direction: 1 | -1) => {
    const currentIndex = SUPPORTED_LANGUAGES.findIndex(
      (entry) => entry.code === activeLanguage,
    );
    const nextIndex =
      (currentIndex + direction + SUPPORTED_LANGUAGES.length) % SUPPORTED_LANGUAGES.length;
    setActiveLanguage(SUPPORTED_LANGUAGES[nextIndex].code);
  };

  useEffect(() => {
    if (!isLanguageMenuOpen) return;
    languageOptionRefs.current[activeLanguage]?.focus();
  }, [activeLanguage, isLanguageMenuOpen]);

  useEffect(() => {
    if (!isLanguageMenuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!languageControlRef.current?.contains(event.target as Node)) {
        closeLanguageMenu();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isLanguageMenuOpen]);

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
        <button
          type="button"
          className="nav-link-button"
          aria-current={activeView === "discover" ? "page" : undefined}
          onClick={onDiscover}
        >
          Discover
        </button>
        <div className="language-control" ref={languageControlRef}>
          <button
            ref={languageButtonRef}
            type="button"
            id="language-select"
            className="language-button"
            aria-label={`${t("nav.languageLabel")}: ${
              SUPPORTED_LANGUAGES.find((entry) => entry.code === language)?.nativeName
            }`}
            aria-haspopup="menu"
            aria-expanded={isLanguageMenuOpen}
            aria-controls="language-menu"
            onClick={() => {
              if (isLanguageMenuOpen) closeLanguageMenu();
              else openLanguageMenu();
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              const selectedIndex = SUPPORTED_LANGUAGES.findIndex(
                (entry) => entry.code === language,
              );
              const offset = event.key === "ArrowDown" ? 1 : -1;
              const nextIndex =
                (selectedIndex + offset + SUPPORTED_LANGUAGES.length) %
                SUPPORTED_LANGUAGES.length;
              openLanguageMenu(SUPPORTED_LANGUAGES[nextIndex].code);
            }}
          >
            <LanguageFlag language={language} />
            <span>{SUPPORTED_LANGUAGES.find((entry) => entry.code === language)?.label}</span>
            <svg
              className="select-chevron"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {isLanguageMenuOpen && (
            <ul
              id="language-menu"
              className="language-menu"
              role="menu"
              aria-labelledby="language-select"
            >
              {SUPPORTED_LANGUAGES.map((entry) => (
                <li key={entry.code} role="none">
                  <button
                    ref={(node) => {
                      if (node) languageOptionRefs.current[entry.code] = node;
                      else delete languageOptionRefs.current[entry.code];
                    }}
                    type="button"
                    className="language-option"
                    role="menuitemradio"
                    aria-checked={entry.code === language}
                    tabIndex={entry.code === activeLanguage ? 0 : -1}
                    onClick={() => chooseLanguage(entry.code)}
                    onFocus={() => setActiveLanguage(entry.code)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        moveOptionFocus(1);
                      } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        moveOptionFocus(-1);
                      } else if (event.key === "Home") {
                        event.preventDefault();
                        setActiveLanguage(SUPPORTED_LANGUAGES[0].code);
                      } else if (event.key === "End") {
                        event.preventDefault();
                        setActiveLanguage(SUPPORTED_LANGUAGES.at(-1)!.code);
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        closeLanguageMenu(true);
                      } else if (event.key === "Tab") {
                        closeLanguageMenu();
                      }
                    }}
                  >
                    <LanguageFlag language={entry.code} />
                    <span className="language-option-name">{entry.nativeName}</span>
                    {entry.code === language && (
                      <svg
                        className="language-option-check"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="m5 12 4 4 10-10" />
                      </svg>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
}
