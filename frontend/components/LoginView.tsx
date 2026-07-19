"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

type LoginViewProps = {
  hidden: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  announce: (message: string) => void;
  onBack: () => void;
  onSignedIn: (session: Session) => void;
};

export default function LoginView({
  hidden,
  headingRef,
  announce,
  onBack,
  onSignedIn,
}: LoginViewProps) {
  const { language, t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const busyRef = useRef(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const clearErrors = () => {
    setFormError("");
    setEmailError("");
    setPasswordError("");
  };

  // Mirror the original applyTranslations(): switching language clears errors.
  useEffect(() => {
    clearErrors();
  }, [language]);

  // Clear errors whenever the view is (re)opened, like the original showLogin().
  useEffect(() => {
    if (!hidden) clearErrors();
  }, [hidden]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current) return;
    clearErrors();

    let firstInvalid: HTMLInputElement | null = null;
    if (!email.trim()) {
      setEmailError(t("login.emailRequired"));
      firstInvalid = emailRef.current;
    }
    if (!password) {
      setPasswordError(t("login.passwordRequired"));
      firstInvalid = firstInvalid ?? passwordRef.current;
    }
    if (firstInvalid) {
      announce("");
      firstInvalid.focus();
      return;
    }

    busyRef.current = true;
    announce(t("login.signingIn"));
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    busyRef.current = false;

    if (error) {
      announce("");
      setFormError(
        error.message === "Invalid login credentials"
          ? t("login.incorrect")
          : t("login.genericError"),
      );
      emailRef.current?.focus();
      return;
    }

    setPassword("");
    if (data.session) onSignedIn(data.session);
  };

  return (
    <section id="view-login" className="login-view" aria-labelledby="login-heading" hidden={hidden}>
      <a
        id="back-link"
        className="back-link"
        href="#top"
        onClick={(event) => {
          event.preventDefault();
          onBack();
        }}
      >
        <span aria-hidden="true">←</span>
        <span>{t("login.back")}</span>
      </a>
      <h1 id="login-heading" ref={headingRef} tabIndex={-1}>
        {t("login.heading")}
      </h1>
      <p className="login-tagline">{t("login.tagline")}</p>
      <form id="login-form" className="login-form" noValidate onSubmit={handleSubmit}>
        <p id="form-error" className="error" role="alert" hidden={!formError}>
          {formError}
        </p>
        <div>
          <label htmlFor="email">{t("login.emailLabel")}</label>
          <input
            id="email"
            ref={emailRef}
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby="email-error"
            aria-invalid={emailError ? true : undefined}
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <p id="email-error" className="field-error" hidden={!emailError}>
            {emailError}
          </p>
        </div>
        <div>
          <label htmlFor="password">{t("login.passwordLabel")}</label>
          <input
            id="password"
            ref={passwordRef}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-describedby="password-error"
            aria-invalid={passwordError ? true : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p id="password-error" className="field-error" hidden={!passwordError}>
            {passwordError}
          </p>
        </div>
        <button type="submit" id="submit" className="primary-button">
          {t("login.submit")}
        </button>
      </form>
    </section>
  );
}
