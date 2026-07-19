"use client";

// Understand: deterministic annualized income, the correct MTSP 2026 threshold with
// formula/effective-date/sources, and rules Q&A answered only from the frozen corpus
// (with citations) — refusing decision requests, abstaining out of corpus.

import { useState } from "react";
import { useApp } from "@/lib/pipeline/state";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import {
  FREQUENCY,
  annualizeCents,
  toCents,
  formatMoneyCents,
  compareToThreshold,
  thresholdCentsForSize,
} from "@/lib/pipeline/calc";
import { MTSP_2026, thresholdForSize } from "@/lib/data/mtsp2026";
import { answerRulesQuestion, AUTHORITY_LABEL, SAMPLE_QUESTIONS } from "@/lib/pipeline/rules";
import type { RulesAnswer } from "@/lib/pipeline/rules";
import type { Rule } from "@/lib/data/ruleCorpus";
import s from "./pipeline.module.css";

function badgeClass(authority: Rule["authority"]): string {
  if (authority === "official_hud") return `${s.badge} ${s.badgeHud}`;
  if (authority === "official_federal") return `${s.badge} ${s.badgeFederal}`;
  return `${s.badge} ${s.badgeConvention}`;
}

export default function UnderstandStep() {
  const c = useCopy();
  const { fields, householdSize, householdSizeConfirmed, grossIncomeCents, goToStep } = useApp();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<RulesAnswer | null>(null);

  const incomeFields = fields.filter(
    (f) => f.isIncome && f.reviewStatus !== "extracted",
  );
  const thresholdDollars = thresholdForSize(householdSize);
  const comparison = compareToThreshold(grossIncomeCents, thresholdCentsForSize(householdSize));
  const cmpText =
    comparison === "below_or_equal" ? c.cmpBelow : comparison === "above" ? c.cmpAbove : c.cmpNone;

  const runAsk = (q: string) => {
    setQuery(q);
    setAnswer(answerRulesQuestion(q));
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
            if (query.trim()) setAnswer(answerRulesQuestion(query));
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
          <button type="submit" className="primary-button">
            {c.ask}
          </button>
        </form>

        <div className={s.sampleRow}>
          <span className={s.hint}>{c.tryAsking}:</span>
          {SAMPLE_QUESTIONS.map((q) => (
            <button key={q} type="button" className={s.sampleChip} onClick={() => runAsk(q)}>
              {q}
            </button>
          ))}
        </div>

        {answer && (
          <div className={s.qaAnswer} aria-live="polite">
            {answer.kind === "refusal" && <p>{c.refusal}</p>}
            {answer.kind === "abstain" && <p>{c.abstain}</p>}
            {answer.kind === "answer" && (
              <>
                <p>
                  <strong>{c.answerIntro}</strong>
                </p>
                {answer.rules.map((r) => (
                  <div key={r.ruleId} className={s.citation}>
                    <div className={s.citationHead}>
                      <span className={s.ruleId}>{r.ruleId}</span>
                      <span className={badgeClass(r.authority)}>{AUTHORITY_LABEL[r.authority]}</span>
                      {r.effectiveDate && (
                        <span className={s.hint} style={{ fontSize: "0.8rem" }}>
                          {c.effective} {r.effectiveDate}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0 }}>{r.text}</p>
                    <a
                      className={s.docLink}
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-block", marginTop: "0.4rem" }}
                    >
                      {r.sourceLocator} ↗
                    </a>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
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
