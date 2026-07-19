"use client";

// The three always-visible, reactive global values: Status, Gross Income, Errors.
// Readiness/accuracy/completeness signals only — never an eligibility verdict.

import { useApp } from "@/lib/pipeline/state";
import { useCopy } from "@/lib/pipeline/copy";
import { formatMoneyCents } from "@/lib/pipeline/calc";
import s from "./pipeline.module.css";

export default function GlobalValues() {
  const c = useCopy();
  const { documents, step, readiness, grossIncomeCents, errorCount } = useApp();

  const stepName = step === "profile" ? c.step1 : step === "understand" ? c.step2 : c.step3;
  const statusText =
    documents.length === 0
      ? c.statusEmpty
      : `${stepName} · ${readiness.status === "READY_TO_REVIEW" ? c.statusReady : c.statusNeeds}`;

  return (
    <section className={s.globals} aria-live="polite" aria-label={c.statusLabel}>
      <div className={s.globalCard}>
        <p className={s.globalLabel}>{c.statusLabel}</p>
        <p className={s.globalValue}>{statusText}</p>
      </div>
      <div className={s.globalCard}>
        <p className={s.globalLabel}>{c.incomeLabel}</p>
        <p className={s.globalValue}>{formatMoneyCents(grossIncomeCents)}</p>
      </div>
      <div className={s.globalCard}>
        <p className={s.globalLabel}>{c.errorsLabel}</p>
        <p className={`${s.globalValue} ${errorCount > 0 ? s.globalValueWarn : ""}`}>{errorCount}</p>
      </div>
    </section>
  );
}
