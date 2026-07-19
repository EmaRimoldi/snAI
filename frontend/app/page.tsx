"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import SiteHeader from "@/components/SiteHeader";
import PromptShell from "@/components/PromptShell";
import PhaseCards from "@/components/PhaseCards";
import LoginView from "@/components/LoginView";
import PipelineApp from "@/components/pipeline/PipelineApp";

export default function Page() {
  return (
    <I18nProvider>
      <RealDoorApp />
    </I18nProvider>
  );
}

type View = "landing" | "login";

function RealDoorApp() {
  const { language, t } = useI18n();
  const [view, setView] = useState<View>("landing");
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState("");

  const heroHeadingRef = useRef<HTMLHeadingElement>(null);
  const loginHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocusRef = useRef<"hero" | "login" | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t(view === "login" ? "titles.login" : "titles.landing");
  }, [language, view, t]);

  // Move focus after the requested view has rendered.
  useEffect(() => {
    if (pendingFocusRef.current === "hero") heroHeadingRef.current?.focus();
    if (pendingFocusRef.current === "login") loginHeadingRef.current?.focus();
    pendingFocusRef.current = null;
  }, [view]);

  const showLanding = (moveFocus: boolean) => {
    pendingFocusRef.current = moveFocus ? "hero" : null;
    setView("landing");
  };

  const showLogin = () => {
    pendingFocusRef.current = "login";
    setView("login");
  };

  const handleSignedIn = (newSession: Session) => {
    setSession(newSession);
    pendingFocusRef.current = "hero";
    setView("landing");
    setStatus(t("login.signedIn"));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setView("landing");
    setStatus(t("login.signedOut"));
    // The landing view is already rendered when signing out, so the
    // view-change effect won't fire — focus the hero directly.
    heroHeadingRef.current?.focus();
  };

  return (
    <>
      <a className="skip-link" href="#main">
        {t("accessibility.skip")}
      </a>

      <SiteHeader
        view={view}
        session={session}
        onShowLanding={showLanding}
        onShowLogin={showLogin}
        onSignOut={handleSignOut}
      />

      <main id="main" className="site-main">
        <section
          id="view-landing"
          className="landing-view"
          aria-labelledby="hero-heading"
          hidden={view !== "landing"}
        >
          {session ? (
            <PipelineApp headingRef={heroHeadingRef} headingId="hero-heading" />
          ) : (
            <>
              <div id="top" className="hero-section">
                <h1 id="hero-heading" className="hero-heading" ref={heroHeadingRef} tabIndex={-1}>
                  {t("hero.headline")}
                </h1>
                <p className="hero-subheadline">{t("hero.subheadline")}</p>
              </div>

              <PromptShell />
              <PhaseCards />
            </>
          )}
        </section>

        <LoginView
          hidden={view !== "login"}
          headingRef={loginHeadingRef}
          announce={setStatus}
          onBack={() => showLanding(true)}
          onSignedIn={handleSignedIn}
        />

        <p id="status" role="status" aria-live="polite" className="visually-hidden">
          {status}
        </p>
      </main>
    </>
  );
}
