"use client";

// Prepare: one simple surface. The rail on the left holds guidance, readiness
// status + lock, reasons, and the two actions (save PDF / edit); the SAMPLE
// receipt document fills the right pane; delete-with-confirm sits last, out of
// the happy path. Readiness describes the file (READY_TO_REVIEW / NEEDS_REVIEW)
// — never eligibility.

import { useState } from "react";
import { useApp } from "@/lib/pipeline/state";
import { useCopy } from "@/lib/pipeline/copy";
import { humanize, useDocLabels, useReasonTexts, useReasonTitles } from "@/lib/pipeline/labels";
import ReceiptDocument from "./ReceiptDocument";
import s from "./pipeline.module.css";

export default function PrepareStep() {
  const c = useCopy();
  const { documents, readiness, locked, lock, unlock, deleteSession, goToStep } = useApp();

  const reasonText = useReasonTexts();
  const reasonTitle = useReasonTitles();
  const docLabels = useDocLabels();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isReady = readiness.status === "READY_TO_REVIEW";

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
            <div className={s.railGroup}>
              <h3 className={s.railHeading}>{c.reasonsTitle}</h3>
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
            </div>
          )}

          <div className={s.railActions}>
            <button type="button" className="primary-button" onClick={() => window.print()}>
              {c.receiptPrint}
            </button>
            <button type="button" className="secondary-button" onClick={() => goToStep("profile")}>
              {c.editBtn}
            </button>
          </div>

          {/* Delete — destructive, out of the happy path */}
          <div className={s.deleteZone}>
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
        </div>

        {/* Right pane: the big document preview */}
        <div className={s.prepareDoc}>
          <ReceiptDocument />
        </div>
      </div>
    </section>
  );
}
