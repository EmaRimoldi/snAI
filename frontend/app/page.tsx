"use client";

import { useEffect, useRef, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { useCopy } from "@/lib/pipeline/copy";
import { AppStateProvider } from "@/lib/pipeline/state";
import SiteHeader from "@/components/SiteHeader";
import HeroSellingPoints from "@/components/HeroSellingPoints";
import PhaseCards from "@/components/PhaseCards";
import PipelineApp from "@/components/pipeline/PipelineApp";
import DiscoverView from "@/components/discovery/DiscoverView";

export default function Page() {
  return (
    <I18nProvider>
      <RealDoorApp />
    </I18nProvider>
  );
}

type View = "landing" | "app" | "discover";

const AUTOLOAD_DEMO =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD === "HH-001";

function RealDoorApp() {
  const { language, t } = useI18n();
  const c = useCopy();
  const [view, setView] = useState<View>(AUTOLOAD_DEMO ? "app" : "landing");

  const heroHeadingRef = useRef<HTMLHeadingElement>(null);
  const appHeadingRef = useRef<HTMLHeadingElement>(null);
  const discoverHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocusRef = useRef<"hero" | "app" | "discover" | null>(null);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = view === "discover" ? "Discover properties — RealDoor" : t("titles.landing");
  }, [language, t, view]);

  useEffect(() => {
    if (window.location.hash === "#app") {
      pendingFocusRef.current = null;
      setView("app");
    } else if (window.location.hash === "#discover") {
      pendingFocusRef.current = null;
      setView("discover");
    }
  }, []);

  // Move focus to the destination view's heading after it renders.
  useEffect(() => {
    if (pendingFocusRef.current === "hero") heroHeadingRef.current?.focus();
    if (pendingFocusRef.current === "app") appHeadingRef.current?.focus();
    if (pendingFocusRef.current === "discover") discoverHeadingRef.current?.focus();
    pendingFocusRef.current = null;
  }, [view]);

  const showLanding = () => {
    pendingFocusRef.current = "hero";
    window.history.pushState(null, "", "#top");
    setView("landing");
  };

  const showApp = () => {
    pendingFocusRef.current = "app";
    window.history.pushState(null, "", "#app");
    setView("app");
  };

  const showDiscover = () => {
    pendingFocusRef.current = "discover";
    window.history.pushState(null, "", "#discover");
    setView("discover");
  };

  return (
    <AppStateProvider>
      <a className="skip-link" href="#main">
        {t("accessibility.skip")}
      </a>

      <SiteHeader
        onHome={showLanding}
        onDiscover={showDiscover}
        activeView={view}
        showStatus={view === "app"}
      />

      <main id="main" className={`site-main ${view === "discover" ? "site-main-discover" : ""}`}>
        <section
          id="view-landing"
          className="landing-view"
          aria-labelledby="hero-heading"
          hidden={view !== "landing"}
        >
          <div id="top" className="hero-section">
            <HeroSellingPoints headingRef={heroHeadingRef} />
            <p className="hero-subheadline">{t("hero.subheadline")}</p>
            <div className="hero-cta">
              <button type="button" className="primary-button" onClick={showApp}>
                {c.getStarted}
              </button>
            </div>
          </div>

          <PhaseCards />
        </section>

        <section id="view-app" aria-label={c.appTitle} hidden={view !== "app"}>
          <PipelineApp headingRef={appHeadingRef} />
        </section>

        {view === "discover" && <DiscoverView headingRef={discoverHeadingRef} />}
      </main>
    </AppStateProvider>
  );
}
