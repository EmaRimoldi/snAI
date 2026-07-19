"use client";

// Prepare: one vertical surface. Guidance, review links, and compact actions sit
// above the SAMPLE receipt so the paperwork can use the full available width.
// Readiness describes the file (READY_TO_REVIEW / NEEDS_REVIEW) — never
// eligibility.

import { useState } from "react";
import { useApp } from "@/lib/pipeline/state";
import { useCopy } from "@/lib/pipeline/copy";
import { humanize, useDocLabels, useFieldLabel, useReasonTexts, useReasonTitles } from "@/lib/pipeline/labels";
import ReceiptDocument from "./ReceiptDocument";
import s from "./pipeline.module.css";

export default function PrepareStep() {
  const c = useCopy();
  const { documents, fields, readiness, deleteSession, goToStep, requestReviewField } = useApp();

  const reasonText = useReasonTexts();
  const reasonTitle = useReasonTitles();
  const docLabels = useDocLabels();
  const fieldLabel = useFieldLabel();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isReady = readiness.status === "READY_TO_REVIEW";
  const pendingFields = fields.filter(
    (field) => field.reviewStatus === "extracted" || field.reviewStatus === "edited",
  );
  const displayedReasons = readiness.reasons.filter(
    (reason) => reason.code !== "UNCONFIRMED_FIELDS" && reason.code !== "MISSING_HOUSEHOLD_SIZE",
  );
  const blockingReasons = displayedReasons.filter((reason) => reason.blocking);

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
    <section className={s.card} aria-label={c.receiptTitle}>
      <div className={s.prepareGrid}>
        {/* Compact controls above the full-width document. */}
        <div className={s.prepareControls}>
          <div className={s.prepareToolbar}>
            <div className={s.reviewSummary}>
              <span className={`${s.verdict} ${isReady ? s.verdictReady : s.verdictNeeds}`}>
                {isReady ? c.statusReady : `${c.statusNeeds}:`}
              </span>

              {!isReady && (pendingFields.length > 0 || blockingReasons.length > 0) && (
                <div className={s.pendingFieldLinks} aria-label={c.fieldsNeedReview}>
                  {blockingReasons.map((reason, index) => (
                    <span key={`${reason.code}-${index}`} className={s.reviewIssueTag}>
                      {reasonTitle[reason.code]}
                    </span>
                  ))}
                  {pendingFields.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      className={s.pendingFieldButton}
                      onClick={() => requestReviewField(field.id)}
                    >
                      {fieldLabel(field.key)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={s.railActions}>
              <button type="button" className="primary-button" onClick={() => window.print()}>
                {c.receiptPrint}
              </button>
              <button type="button" className="secondary-button" onClick={() => goToStep("profile")}>
                {c.editBtn}
              </button>

              {/* Delete — destructive, kept compact with the other actions. */}
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
          </div>

          {displayedReasons.length > 0 && (
            <div className={s.railGroup}>
              <ul className={s.reasonList}>
                {displayedReasons.map((r, i) => (
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

        </div>

        {/* Full-width document preview. */}
        <div className={s.prepareDoc}>
          <ReceiptDocument />
        </div>
      </div>
    </section>
  );
}
