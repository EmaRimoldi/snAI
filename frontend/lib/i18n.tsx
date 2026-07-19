"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Language = "en" | "es";

const dictionaries = {
  en: {
    accessibility: { skip: "Skip to main content" },
    nav: {
      homeLabel: "RealDoor home",
      languageLabel: "Choose language",
      login: "Log in",
      account: "Account",
      signout: "Sign out",
    },
    hero: {
      headline: "Preparing your documents has never been this easy.",
      subheadline: "Housing paperwork, made clear.",
    },
    input: {
      sectionLabel: "Document assistant",
      ariaLabel: "Upload or describe your documents",
      uploadLabel: "Upload files",
      sendLabel: "Send message",
      attachmentStatus: "{count} files attached",
      placeholders: [
        "Drag your documents here",
        "Ready when you are",
        "One step at a time",
        "Nothing is decided without you",
      ],
    },
    phases: {
      ariaLabel: "How RealDoor helps",
      profile: {
        name: "Profile",
        description: "Upload your documents. Confirm what's true.",
      },
      understand: {
        name: "Understand",
        description: "Ask about the rules. Get the answer, with its source.",
      },
      prepare: {
        name: "Prepare",
        description: "See what's missing. Export when you're ready.",
      },
    },
    login: {
      back: "Back to RealDoor",
      heading: "Log in",
      tagline: "Application-readiness assistant",
      emailLabel: "Email address",
      passwordLabel: "Password",
      submit: "Log in",
      emailRequired: "Error: Enter your email address.",
      passwordRequired: "Error: Enter your password.",
      incorrect: "Error: Incorrect email or password.",
      genericError: "Error: We couldn't sign you in. Please try again.",
      signingIn: "Signing in, please wait.",
      signedIn: "Signed in successfully.",
      signedOut: "Signed out.",
    },
    titles: {
      landing: "RealDoor — Housing paperwork, made clear",
      login: "Log in — RealDoor",
    },
  },
  es: {
    accessibility: { skip: "Saltar al contenido principal" },
    nav: {
      homeLabel: "Inicio de RealDoor",
      languageLabel: "Elegir idioma",
      login: "Iniciar sesión",
      account: "Cuenta",
      signout: "Cerrar sesión",
    },
    hero: {
      headline: "Preparar tus documentos nunca había sido tan fácil.",
      subheadline: "Los trámites de vivienda, más claros.",
    },
    input: {
      sectionLabel: "Asistente de documentos",
      ariaLabel: "Sube o describe tus documentos",
      uploadLabel: "Subir archivos",
      sendLabel: "Enviar mensaje",
      attachmentStatus: "{count} archivos adjuntos",
      placeholders: [
        "Arrastra tus documentos aquí",
        "Cuando tú quieras",
        "Un paso a la vez",
        "Nada se decide sin ti",
      ],
    },
    phases: {
      ariaLabel: "Cómo ayuda RealDoor",
      profile: {
        name: "Perfil",
        description: "Sube tus documentos. Confirma qué es correcto.",
      },
      understand: {
        name: "Entender",
        description: "Pregunta sobre las reglas. Recibe la respuesta con su fuente.",
      },
      prepare: {
        name: "Preparar",
        description: "Revisa qué falta. Exporta cuando estés listo.",
      },
    },
    login: {
      back: "Volver a RealDoor",
      heading: "Iniciar sesión",
      tagline: "Asistente para preparar tu solicitud",
      emailLabel: "Correo electrónico",
      passwordLabel: "Contraseña",
      submit: "Iniciar sesión",
      emailRequired: "Error: Introduce tu correo electrónico.",
      passwordRequired: "Error: Introduce tu contraseña.",
      incorrect: "Error: El correo o la contraseña son incorrectos.",
      genericError: "Error: No pudimos iniciar sesión. Inténtalo de nuevo.",
      signingIn: "Iniciando sesión, espera un momento.",
      signedIn: "Sesión iniciada correctamente.",
      signedOut: "Sesión cerrada.",
    },
    titles: {
      landing: "RealDoor — Los trámites de vivienda, más claros",
      login: "Iniciar sesión — RealDoor",
    },
  },
} as const;

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (path: string) => string;
  tList: (path: string) => readonly string[];
};

const I18nContext = createContext<I18nValue | null>(null);

function resolve(language: Language, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined,
      dictionaries[language],
    );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  const t = useCallback(
    (path: string) => {
      const value = resolve(language, path);
      return typeof value === "string" ? value : path;
    },
    [language],
  );

  const tList = useCallback(
    (path: string) => {
      const value = resolve(language, path);
      return Array.isArray(value) ? (value as readonly string[]) : [];
    },
    [language],
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
