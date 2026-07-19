"use client";

import { useI18n } from "@/lib/i18n";

const PHASES = ["profile", "understand", "prepare"] as const;

function splitDescription(description: string): string[] {
  const sentences = description.match(/^(.+?[.!?。！？])\s*(.+)$/u);
  return sentences ? [sentences[1], sentences[2]] : [description];
}

export default function PhaseCards() {
  const { t } = useI18n();

  return (
    <section className="phase-section" aria-label={t("phases.ariaLabel")}>
      {PHASES.map((phase, index) => (
        <article key={phase} className="phase-card">
          <span className="phase-number">{index + 1}</span>
          <h2>{t(`phases.${phase}.name`)}</h2>
          <p>
            {splitDescription(t(`phases.${phase}.description`)).map((sentence) => (
              <span key={sentence}>{sentence}</span>
            ))}
          </p>
        </article>
      ))}
    </section>
  );
}
