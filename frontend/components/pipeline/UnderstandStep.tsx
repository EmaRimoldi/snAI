"use client";

// Understand: deterministic annualized income, the correct MTSP 2026 threshold with
// formula/effective-date/sources, and rules Q&A answered only from the frozen corpus
// (with citations) — refusing decision requests, abstaining out of corpus.

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/pipeline/state";
import { useCopy } from "@/lib/pipeline/copy";
import { useI18n } from "@/lib/i18n";
import {
  FREQUENCY,
  deriveIncomeSources,
  formatMoneyCents,
  compareToThreshold,
  thresholdCentsForSize,
} from "@/lib/pipeline/calc";
import type { PayFrequency } from "@/lib/pipeline/types";
import { useFieldLabel } from "@/lib/pipeline/labels";
import { MTSP_2026, thresholdForSize } from "@/lib/data/mtsp2026";
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
  const [thread, setThread] = useState<
    Array<{ question: string; response: AiChatResponse; fellBack: boolean }>
  >([]);
  const [asking, setAsking] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Keep the newest exchange in view — scrollable area, pinned to the bottom.
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [thread, asking]);

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

  const incomeSources = useMemo(
    () => deriveIncomeSources(documents, fields),
    [documents, fields],
  );
  const countedSources = incomeSources.filter((src) => src.counted);
  const fieldLabel = useFieldLabel();
  const money = (cents: number): string => formatMoneyCents(cents, language);
  const srcName = (key: string): string =>
    key === "gross_pay"
      ? c.srcPay
      : key === "monthly_benefit"
        ? c.srcBenefit
        : key === "gross_receipts"
          ? c.srcGig
          : fieldLabel(key);
  const freqLabel: Record<PayFrequency, string> = {
    weekly: c.freqWeekly,
    biweekly: c.freqBiweekly,
    semimonthly: c.freqSemimonthly,
    monthly: c.freqMonthly,
    annual: c.freqAnnual,
  };
  const thresholdDollars = thresholdForSize(householdSize);
  const comparison = compareToThreshold(grossIncomeCents, thresholdCentsForSize(householdSize));
  const cmpText =
    comparison === "below_or_equal" ? c.cmpBelow : comparison === "above" ? c.cmpAbove : c.cmpNone;
  const sampleQuestions = [c.sampleQ1, c.sampleQ2, c.sampleQ3, c.sampleQ4];

  const runAsk = async (q: string) => {
    const question = q.trim();
    if (!question || asking) return;
    setQuery("");
    setAsking(true);
    try {
      const response = await askRealDoor({
        mode: "personalized",
        locale: language,
        question,
        context: aiContext,
      });
      setThread((prev) => [...prev, { question, response, fellBack: false }]);
    } catch {
      setThread((prev) => [
        ...prev,
        { question, response: localRulesFallback(question, { refusal: c.refusal, abstain: c.abstain }), fellBack: true },
      ]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      <div className={s.understandGrid}>
      <section className={s.card} aria-labelledby="income-h">
        <h2 id="income-h" className={s.cardTitle}>
          {c.incomeCalcTitle}
        </h2>

        <div className={`${s.formula} ${s.formulaFlat}`}>
          <div className={s.confidenceHead} style={{ fontSize: "0.9rem", marginBottom: "0.4rem" }}>
            <span>{c.formulaHead}</span>
          </div>
          {countedSources.length === 0 ? (
            <p className={s.hint} style={{ margin: 0 }}>
              {c.confirmSizeNote}
            </p>
          ) : (
            <div className={s.mathTable}>
              <div className={`${s.mathRow} ${s.mathHead}`} aria-hidden="true">
                <span className={s.mathSrcCell}>{c.source}</span>
                <span className={s.mathCalcCell}>{c.mathCalc}</span>
                <span className={s.mathNum}>{c.mathPerYear}</span>
              </div>
              {countedSources.map((src) => (
                <div key={src.fieldId} className={s.mathRow}>
                  <span className={s.mathSrcCell}>
                    {srcName(src.key)}
                    <span className={s.mathSrcSub}>{freqLabel[src.frequency]}</span>
                  </span>
                  <span className={s.mathCalcCell}>
                    {money(src.periodCents)} × {FREQUENCY[src.frequency]}
                  </span>
                  <span className={s.mathNum}>
                    <strong>{money(src.annualCents)}</strong>
                  </span>
                </div>
              ))}
              <div className={`${s.mathRow} ${s.mathTotalRow}`}>
                <span className={s.mathSrcCell}>{c.mathTotal}</span>
                <span className={s.mathCalcCell} />
                <span className={s.mathNum}>
                  <strong>{money(grossIncomeCents)}</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        <ul className={s.flatList}>
          <li className={s.flatRow}>
            <span className={s.summaryKey}>{c.householdSize}</span>
            <span className={s.summaryVal}>
              {householdSize}
              {!householdSizeConfirmed && ` — ${c.confirmSizeNote}`}
            </span>
          </li>
          <li className={s.flatRow}>
            <span className={s.summaryKey}>{c.threshold60}</span>
            <span className={s.summaryVal}>
              {thresholdDollars === null ? c.cmpNone : money(thresholdDollars * 100)}
            </span>
          </li>
        </ul>

        {/* Comparison result — green/red, but the text always carries the
            meaning, and it describes the published limit, never eligibility. */}
        <p
          className={`${s.resultBanner} ${
            comparison === "below_or_equal"
              ? s.resultOk
              : comparison === "above"
                ? s.resultBad
                : s.resultNone
          }`}
          role="status"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {comparison === "below_or_equal" ? (
              <path d="m5 13 4 4L19 7" />
            ) : comparison === "above" ? (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.5" />
                <path d="M12 16.4v.1" />
              </>
            ) : (
              <circle cx="12" cy="12" r="4" />
            )}
          </svg>
          <span className={s.resultText}>
            <strong>{cmpText}</strong>
            {thresholdDollars !== null && (
              <span className={s.resultAmounts}>
                {money(grossIncomeCents)} / {money(thresholdDollars * 100)}
              </span>
            )}
          </span>
        </p>

        <p className={s.sourceLine}>
          {c.effective} {MTSP_2026.effectiveDate} · {MTSP_2026.hudArea} ·{" "}
          <a className={s.docLink} href={MTSP_2026.sourceUrl} target="_blank" rel="noopener noreferrer">
            {MTSP_2026.ruleId} ({MTSP_2026.sourceLocator}) ↗
          </a>
        </p>
        <p className={s.hint}>{c.notDecision}</p>
      </section>

      <section className={`${s.card} ${s.qaCard}`} aria-labelledby="rules-h">
        <div className={s.chatHeader}>
          <span className={s.chatHeaderDot} aria-hidden="true" />
          <div>
            <h2 id="rules-h" className={s.chatHeaderTitle}>
              {c.rulesTitle}
            </h2>
            <p className={s.chatHeaderHint}>{c.rulesHint}</p>
          </div>
        </div>

        {thread.length === 0 && !asking && (
          <div className={s.sampleRow}>
            <span className={s.hint}>{c.tryAsking}:</span>
            {sampleQuestions.map((q) => (
              <button key={q} type="button" className={s.sampleChip} onClick={() => void runAsk(q)} disabled={asking}>
                {q}
              </button>
            ))}
          </div>
        )}

        <div className={s.qaAnswerArea} ref={chatRef}>
          {thread.map((entry, index) => (
            <div key={index} className={s.chatEntry}>
              <p className={s.chatQuestion}>{entry.question}</p>
              {entry.fellBack && (
                <p className={s.aiNotice} role="status">
                  {c.aiFallback}
                </p>
              )}
              <div className={s.chatAnswer}>
                <AiAnswer response={entry.response} documents={documents} />
              </div>
            </div>
          ))}
          {asking && (
            <p className={s.hint} role="status">
              {c.aiThinking}
            </p>
          )}
        </div>

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
        <p className={s.aiPrivacy}>{c.aiPrivacy}</p>
      </section>
      </div>

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
