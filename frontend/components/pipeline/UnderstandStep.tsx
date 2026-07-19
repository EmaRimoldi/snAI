"use client";

// Understand: deterministic annualized income, the correct MTSP 2026 threshold with
// formula/effective-date/sources, and rules Q&A answered only from the frozen corpus
// (with citations) — refusing decision requests, abstaining out of corpus.

import { useMemo, useState } from "react";
import { useApp } from "@/lib/pipeline/state";
import { useCopy } from "@/lib/pipeline/copy";
import { useI18n } from "@/lib/i18n";
import {
  FREQUENCY,
  annualizeCents,
  toCents,
  formatMoneyCents,
  compareToThreshold,
  thresholdCentsForSize,
} from "@/lib/pipeline/calc";
import { MTSP_2026, thresholdForSize } from "@/lib/data/mtsp2026";
import { SAMPLE_QUESTIONS } from "@/lib/pipeline/rules";
import { askRealDoor } from "@/lib/ai/client";
import { buildSafeUnderstandingContext } from "@/lib/ai/context";
import { localRulesFallback } from "@/lib/ai/fallback";
import type { AiChatResponse } from "@/lib/ai/types";
import AiAnswer from "@/components/ai/AiAnswer";
import s from "./pipeline.module.css";

export default function UnderstandStep() {
  const c = useCopy();
  const { language } = useI18n();
  const {
    documents,
    fields,
    householdSize,
    householdSizeConfirmed,
    grossIncomeCents,
    missingRequired,
    readiness,
    goToStep,
  } = useApp();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AiChatResponse | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const aiContext = useMemo(
    () => buildSafeUnderstandingContext({
      documents,
      fields,
      householdSize,
      householdSizeConfirmed,
      grossIncomeCents,
      missingRequired,
      readiness,
    }),
    [documents, fields, householdSize, householdSizeConfirmed, grossIncomeCents, missingRequired, readiness],
  );

  const incomeFields = fields.filter(
    (f) => f.isIncome && f.reviewStatus !== "extracted",
  );
  const thresholdDollars = thresholdForSize(householdSize);
  const comparison = compareToThreshold(grossIncomeCents, thresholdCentsForSize(householdSize));
  const cmpText =
    comparison === "below_or_equal" ? c.cmpBelow : comparison === "above" ? c.cmpAbove : c.cmpNone;

  const runAsk = async (q: string) => {
    const question = q.trim();
    if (!question || asking) return;
    setQuery(question);
    setAsking(true);
    setAskError(null);
    try {
      setAnswer(await askRealDoor({
        mode: "personalized",
        locale: language,
        question,
        context: aiContext,
      }));
    } catch {
      setAnswer(localRulesFallback(question));
      setAskError(c.aiFallback);
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      <section className={s.card} aria-labelledby="income-h">
        <h2 id="income-h" className={s.cardTitle}>
          {c.incomeCalcTitle}
        </h2>

        <div className={s.formula}>
          <div className={s.confidenceHead} style={{ fontSize: "0.9rem", marginBottom: "0.4rem" }}>
            <span>{c.formulaHead}</span>
          </div>
          {incomeFields.length === 0 ? (
            <p className={s.hint} style={{ margin: 0 }}>
              {c.confirmSizeNote}
            </p>
          ) : (
            incomeFields.map((f) => {
              const freq = f.incomeFrequency ?? "monthly";
              const per = toCents(f.value);
              const annual = annualizeCents(per, freq);
              return (
                <div key={f.id}>
                  {f.key.replace(/_/g, " ")}: {formatMoneyCents(per)} × {FREQUENCY[freq]}/yr ={" "}
                  <strong>{formatMoneyCents(annual)}</strong>
                </div>
              );
            })
          )}
          <div style={{ marginTop: "0.5rem" }}>
            {c.annualizedIncome}: <strong>{formatMoneyCents(grossIncomeCents)}</strong>
          </div>
        </div>

        <ul className={s.summaryList} style={{ marginTop: "1rem" }}>
          <li className={s.summaryRow}>
            <span className={s.summaryKey}>{c.householdSize}</span>
            <span className={s.summaryVal}>
              {householdSize}
              {!householdSizeConfirmed && ` — ${c.confirmSizeNote}`}
            </span>
          </li>
          <li className={s.summaryRow}>
            <span className={s.summaryKey}>{c.threshold60}</span>
            <span className={s.summaryVal}>
              {thresholdDollars === null ? c.cmpNone : formatMoneyCents(thresholdDollars * 100)}
            </span>
          </li>
          <li className={s.summaryRow}>
            <span className={s.summaryKey}>{c.comparison}</span>
            <span className={s.summaryVal}>{cmpText}</span>
          </li>
        </ul>

        <p className={s.sourceLine}>
          {c.effective} {MTSP_2026.effectiveDate} · {MTSP_2026.hudArea} ·{" "}
          <a className={s.docLink} href={MTSP_2026.sourceUrl} target="_blank" rel="noopener noreferrer">
            {MTSP_2026.ruleId} ({MTSP_2026.sourceLocator}) ↗
          </a>
        </p>
        <p className={s.hint}>{c.notDecision}</p>
      </section>

      <section className={s.card} aria-labelledby="rules-h">
        <h2 id="rules-h" className={s.cardTitle}>
          {c.rulesTitle}
        </h2>
        <p className={s.hint}>{c.rulesHint}</p>

        <form
          className={s.qaForm}
          onSubmit={(e) => {
            e.preventDefault();
            void runAsk(query);
          }}
        >
          <label className="visually-hidden" htmlFor="rules-q">
            {c.rulesTitle}
          </label>
          <input
            id="rules-q"
            className={s.qaInput}
            value={query}
            placeholder={c.askPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="primary-button" disabled={asking || !query.trim()}>
            {asking ? c.aiThinking : c.ask}
          </button>
        </form>

        <div className={s.sampleRow}>
          <span className={s.hint}>{c.tryAsking}:</span>
          {SAMPLE_QUESTIONS.map((q) => (
            <button key={q} type="button" className={s.sampleChip} onClick={() => void runAsk(q)} disabled={asking}>
              {q}
            </button>
          ))}
        </div>

        <p className={s.aiPrivacy}>{c.aiPrivacy}</p>
        {askError && <p className={s.aiNotice} role="status">{askError}</p>}
        {answer && <AiAnswer response={answer} documents={documents} />}
      </section>

      <div className={s.actions}>
        <button type="button" className="secondary-button" onClick={() => goToStep("profile")}>
          ← {c.step1}
        </button>
        <button type="button" className="primary-button" onClick={() => goToStep("prepare")}>
          {c.step3} →
        </button>
      </div>
    </>
  );
}
