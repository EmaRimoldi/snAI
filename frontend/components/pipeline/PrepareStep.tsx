"use client";

// Prepare: one simple surface. Readiness status + lock at the top, a single
// visible actions row (save PDF / download packet / edit / raw data), then the
// SAMPLE receipt document itself; delete-with-confirm sits last, out of the
// happy path. Readiness describes the file (READY_TO_REVIEW / NEEDS_REVIEW) —
// never eligibility.

import { useState } from "react";
import { useApp } from "@/lib/pipeline/state";
import type { DocumentType } from "@/lib/pipeline/types";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import { humanize, useDocLabels, useReasonTexts, useReasonTitles } from "@/lib/pipeline/labels";
import ReceiptDocument from "./ReceiptDocument";
import s from "./pipeline.module.css";

export default function PrepareStep() {
  const c = useCopy();
  const {
    documents,
    readiness,
    locked,
    lock,
    unlock,
    deleteSession,
    buildSubmission,
    goToStep,
    applicationId,
  } = useApp();

  const reasonText = useReasonTexts();
  const reasonTitle = useReasonTitles();
  const docLabels = useDocLabels();
  const [showRaw, setShowRaw] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const submission = buildSubmission();
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

  // The proof itself is stored in the provider and rendered by PipelineApp —
  // deleteSession navigates back to Profile, which unmounts this component.
  const doDelete = () => {
    deleteSession();
    setConfirmingDelete(false);
  };

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
    <section className={s.card} aria-labelledby="receipt-h">
      <h2 id="receipt-h" className={s.cardTitle}>
        {c.receiptTitle}
      </h2>

      <div className={s.prepareGrid}>
        {/* Left rail: guidance, status + lock, reasons, actions, delete */}
        <div className={s.prepareControls}>
          <p className={s.hint}>{c.prepareIntro}</p>

          <div className={s.statusRow}>
            <span className={`${s.verdict} ${isReady ? s.verdictReady : s.verdictNeeds}`}>
              {isReady ? c.statusReady : c.statusNeeds}
            </span>
            {locked ? (
              <button type="button" className="secondary-button" onClick={unlock}>
                {c.unlockBtn}
              </button>
            ) : (
              <button type="button" className="secondary-button" onClick={lock}>
                {c.lockBtn}
              </button>
            )}
          </div>
          {locked && <p className={s.hint}>{c.lockedNote}</p>}
          {readiness.reasons.length > 0 && (
            <>
              <h3 style={{ margin: "1rem 0 0", fontSize: "1rem" }}>{c.reasonsTitle}</h3>
              <ul className={s.reasonList}>
                {readiness.reasons.map((r, i) => (
                  <li key={`${r.code}-${i}`} className={r.blocking ? `${s.reason} ${s.reasonBlocking}` : s.reason}>
                    <span className={s.reasonCode}>{reasonTitle[r.code]}</span>
                    <span>
                      {reasonText[r.code]}
                      {r.detail && r.code === "MISSING_REQUIRED_DOCUMENT"
                        ? ` (${(docLabels as Record<string, string | undefined>)[r.detail] ?? humanize(r.detail)})`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className={s.actions}>
            <button type="button" className="primary-button" onClick={() => window.print()}>
              {c.receiptPrint}
            </button>
            <button type="button" className="secondary-button" onClick={download}>
              {c.downloadBtn}
            </button>
            <button type="button" className="secondary-button" onClick={() => goToStep("profile")}>
              {c.editBtn}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowRaw((v) => !v)}
              aria-expanded={showRaw}
              aria-controls="receipt-raw"
            >
              {showRaw ? c.rawHide : c.rawShow}
            </button>
          </div>
          {showRaw && (
            <pre
              id="receipt-raw"
              className={s.formula}
              style={{ marginTop: "1rem", whiteSpace: "pre-wrap", overflowX: "auto" }}
              aria-label="submission.json"
            >
              {JSON.stringify(submission, null, 2)}
            </pre>
          )}

          {/* Delete — destructive, out of the happy path */}
          <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--input)", paddingTop: "1rem" }}>
            {confirmingDelete ? (
              <div className={s.actions} style={{ marginTop: 0 }}>
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
        </div>

        {/* Right pane: the big document preview */}
        <div className={s.prepareDoc}>
          <ReceiptDocument />
        </div>
      </div>
    </section>
  );
}
