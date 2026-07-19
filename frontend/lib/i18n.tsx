"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { dictionaries } from "@/lib/dictionaries";
import type { Language } from "@/lib/dictionaries";
import { supabase } from "@/lib/supabase";

export { SUPPORTED_LANGUAGES } from "@/lib/dictionaries";
export type { Language } from "@/lib/dictionaries";

// Flat "lang -> dot.key -> value" overrides loaded from the Supabase
// i18n_translations table. The bundled dictionaries always remain the
// offline-safe fallback, so a failed fetch changes nothing.
type RemoteTranslations = Partial<Record<Language, Record<string, unknown>>>;

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (path: string) => string;
  tList: (path: string) => readonly string[];
};

const I18nContext = createContext<I18nValue | null>(null);

function resolveBundled(language: Language, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined,
      dictionaries[language],
    );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  const [remote, setRemote] = useState<RemoteTranslations>({});

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("i18n_translations")
      .select("lang_code, key, value")
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const byLanguage: RemoteTranslations = {};
        for (const row of data) {
          if (typeof row.lang_code !== "string" || typeof row.key !== "string") continue;
          const lang = row.lang_code as Language;
          byLanguage[lang] = { ...(byLanguage[lang] ?? {}), [row.key]: row.value };
        }
        setRemote(byLanguage);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const t = useCallback(
    (path: string) => {
      const override = remote[language]?.[path];
      if (typeof override === "string") return override;
      const value = resolveBundled(language, path);
      return typeof value === "string" ? value : path;
    },
    [language, remote],
  );

  const tList = useCallback(
    (path: string) => {
      const override = remote[language]?.[path];
      if (isStringArray(override)) return override;
      const value = resolveBundled(language, path);
      return isStringArray(value) ? value : [];
    },
    [language, remote],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, tList }),
    [language, t, tList],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
