"use client";

// Prepare: file-level readiness (READY_TO_REVIEW / NEEDS_REVIEW — never eligibility)
// with coded reasons, a summary of collected info, and renter controls: edit,
// preview, download (download-only), delete session (with proof), and lock.

import { useState } from "react";
import { useApp } from "@/lib/pipeline/state";
import type { DeletionProof } from "@/lib/pipeline/state";
import type { ReviewReasonCode } from "@/lib/pipeline/types";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import { formatMoneyCents, compareToThreshold, thresholdCentsForSize } from "@/lib/pipeline/calc";
import { thresholdForSize } from "@/lib/data/mtsp2026";
import s from "./pipeline.module.css";

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function PrepareStep() {
  const c = useCopy();
  const {
    documents,
    fields,
    readiness,
    grossIncomeCents,
    householdSize,
    locked,
    lock,
    unlock,
    deleteSession,
    buildSubmission,
    goToStep,
    applicationId,
  } = useApp();

  const [proof, setProof] = useState<DeletionProof | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const reasonText: Record<ReviewReasonCode, string> = {
    PAY_STUB_TOTAL_CONFLICT: c.rc_PAY_STUB_TOTAL_CONFLICT,
    GIG_INCOME_UNCORROBORATED: c.rc_GIG_INCOME_UNCORROBORATED,
    EMPLOYMENT_LETTER_EXPIRED: c.rc_EMPLOYMENT_LETTER_EXPIRED,
    UNCONFIRMED_FIELDS: c.rc_UNCONFIRMED_FIELDS,
    LOW_CONFIDENCE_FIELDS: c.rc_LOW_CONFIDENCE_FIELDS,
    MISSING_REQUIRED_DOCUMENT: c.rc_MISSING_REQUIRED_DOCUMENT,
  };

  const confirmed = fields.filter((f) => f.reviewStatus !== "extracted");
  const submission = buildSubmission();
  const thresholdDollars = thresholdForSize(householdSize);
  const comparison = compareToThreshold(grossIncomeCents, thresholdCentsForSize(householdSize));
  const isReady = readiness.status === "READY_TO_REVIEW";

  const download = () => {
    const blob = new Blob([JSON.stringify(submission, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `realdoor-${applicationId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const doDelete = () => {
    const p = deleteSession();
    setProof(p);
    setConfirmingDelete(false);
  };

  if (proof) {
    return (
      <section className={s.card} role="status">
        <h2 className={s.cardTitle}>{c.deleteBtn}</h2>
        <p className={s.proof}>
          {fmt(c.deletedProof, { docs: proof.documentsRemoved, fields: proof.fieldsRemoved, at: proof.at })}
        </p>
        <div className={s.actions}>
          <button type="button" className="primary-button" onClick={() => setProof(null)}>
            {c.step1}
          </button>
        </div>
      </section>
    );
  }

  if (documents.length === 0) {
    return (
      <section className={s.card}>
        <h2 className={s.cardTitle}>{c.readinessTitle}</h2>
        <p className={s.hint}>{c.noDocs}</p>
        <div className={s.actions}>
          <button type="button" className="primary-button" onClick={() => goToStep("profile")}>
            {c.step1}
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* Readiness */}
      <section className={s.card} aria-labelledby="ready-h">
        <h2 id="ready-h" className={s.cardTitle}>
          {c.readinessTitle}
        </h2>
        <p>
          <span className={`${s.verdict} ${isReady ? s.verdictReady : s.verdictNeeds}`}>
            {isReady ? c.statusReady : c.statusNeeds}
          </span>
        </p>
        <p className={s.hint}>{c.verdictNote}</p>

        <h3 style={{ margin: "1rem 0 0", fontSize: "1rem" }}>{c.reasonsTitle}</h3>
        {readiness.reasons.length === 0 ? (
          <p className={s.hint}>{c.noReasons}</p>
        ) : (
          <ul className={s.reasonList}>
            {readiness.reasons.map((r, i) => (
              <li key={`${r.code}-${i}`} className={r.blocking ? `${s.reason} ${s.reasonBlocking}` : s.reason}>
                <span className={s.reasonCode}>{r.code}</span>
                <span>
                  {reasonText[r.code]}
                  {r.detail && r.code === "MISSING_REQUIRED_DOCUMENT" ? ` (${humanize(r.detail)})` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Summary */}
      <section className={s.card} aria-labelledby="summary-h">
        <h2 id="summary-h" className={s.cardTitle}>
          {c.summaryTitle}
        </h2>
        <ul className={s.summaryList}>
          {confirmed.map((f) => (
            <li key={f.id} className={s.summaryRow}>
              <span className={s.summaryKey}>{humanize(f.key)}</span>
              <span className={s.summaryVal}>{f.value}</span>
            </li>
          ))}
          <li className={s.summaryRow}>
            <span className={s.summaryKey}>{c.annualizedIncome}</span>
            <span className={s.summaryVal}>{formatMoneyCents(grossIncomeCents)}</span>
          </li>
          <li className={s.summaryRow}>
            <span className={s.summaryKey}>{c.threshold60}</span>
            <span className={s.summaryVal}>
              {thresholdDollars === null ? c.cmpNone : formatMoneyCents(thresholdDollars * 100)}
            </span>
          </li>
          <li className={s.summaryRow}>
            <span className={s.summaryKey}>{c.comparison}</span>
            <span className={s.summaryVal}>
              {comparison === "below_or_equal" ? c.cmpBelow : comparison === "above" ? c.cmpAbove : c.cmpNone}
            </span>
          </li>
        </ul>

        {showPreview && (
          <pre
            className={s.formula}
            style={{ marginTop: "1rem", whiteSpace: "pre-wrap", overflowX: "auto" }}
            aria-label="submission.json"
          >
            {JSON.stringify(submission, null, 2)}
          </pre>
        )}
      </section>

      {/* Controls */}
      <section className={s.card} aria-labelledby="controls-h">
        <h2 id="controls-h" className={s.cardTitle}>
          {c.controlsTitle}
        </h2>
        <div className={s.actions}>
          <button type="button" className="secondary-button" onClick={() => goToStep("profile")}>
            {c.editBtn}
          </button>
          <button type="button" className="secondary-button" onClick={() => setShowPreview((v) => !v)}>
            {c.previewBtn}
          </button>
          <button type="button" className="primary-button" onClick={download}>
            {c.downloadBtn}
          </button>
          {locked ? (
            <button type="button" className="secondary-button" onClick={unlock}>
              {c.unlockBtn}
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={lock}>
              {c.lockBtn}
            </button>
          )}
        </div>
        {locked && <p className={s.hint} style={{ marginTop: "0.6rem" }}>{c.lockedNote}</p>}

        <div style={{ marginTop: "1rem" }}>
          {confirmingDelete ? (
            <div className={s.actions}>
              <span className={s.hint}>{c.deleteConfirm}</span>
              <button type="button" className="primary-button" onClick={doDelete}>
                {c.deleteBtn}
              </button>
              <button type="button" className="secondary-button" onClick={() => setConfirmingDelete(false)}>
                {c.cancel}
              </button>
            </div>
          ) : (
            <button type="button" className="secondary-button" onClick={() => setConfirmingDelete(true)}>
              {c.deleteBtn}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
