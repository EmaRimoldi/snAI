"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { useI18n } from "@/lib/i18n";

const INITIAL_MOTTO_MS = 3000;
const TYPE_SPEED_MS = 60;
const DELETE_SPEED_MS = 35;
const FULL_PHRASE_PAUSE_MS = 2100;
const BETWEEN_PHRASES_PAUSE_MS = 350;

type HeroSellingPointsProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
};

export default function HeroSellingPoints({ headingRef }: HeroSellingPointsProps) {
  const { language, t, tList } = useI18n();
  const [text, setText] = useState(() => t("hero.headline"));
  const [isTyping, setIsTyping] = useState(false);
  const [motionPreferenceVersion, setMotionPreferenceVersion] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setMotionPreferenceVersion((version) => version + 1);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const motto = t("hero.headline");
    const points = tList("hero.sellingPoints");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let timer: number | undefined;

    setText(motto);
    setIsTyping(false);

    const startCycle = () => {
      if (cancelled || points.length === 0) return;

      if (reduceMotion) {
        setText(points[0]);
        return;
      }

      let phraseIndex = 0;
      let characterIndex = 0;
      let isDeleting = false;
      setText("");
      setIsTyping(true);

      const tick = () => {
        if (cancelled) return;
        const phrase = points[phraseIndex] ?? points[0];
        let delay = TYPE_SPEED_MS;

        if (!isDeleting && characterIndex < phrase.length) {
          characterIndex += 1;
        } else if (!isDeleting) {
          isDeleting = true;
          delay = FULL_PHRASE_PAUSE_MS;
        } else if (characterIndex > 0) {
          characterIndex -= 1;
          delay = DELETE_SPEED_MS;
        } else {
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % points.length;
          delay = BETWEEN_PHRASES_PAUSE_MS;
        }

        setText(phrase.slice(0, characterIndex));
        timer = window.setTimeout(tick, delay);
      };

      tick();
    };

    timer = window.setTimeout(startCycle, INITIAL_MOTTO_MS);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [language, motionPreferenceVersion, t, tList]);

  return (
    <h1
      id="hero-heading"
      ref={headingRef}
      className={isTyping ? "hero-heading is-typing" : "hero-heading"}
      tabIndex={-1}
      aria-live="off"
    >
      {text}
    </h1>
  );
}
