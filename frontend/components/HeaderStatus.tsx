"use client";

// Status + error chips for the site header, shown while the pipeline is active.
// Errors = detected inconsistencies / rule flags on CONFIRMED values only —
// independent of confirmation progress. Traffic light: red = errors found,
// yellow = no errors but values still unconfirmed, green = all confirmed & ok.
// The errors chip expands into a scrollable menu explaining each item; choosing
// one jumps to (and focuses) the matching field or the upload checklist.
// Color-coded, but shape/text always carries the meaning (never color-only).
// Readiness/accuracy/completeness signals only — never an eligibility verdict.

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/pipeline/state";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import type {
  DisplayStatus,
  DocumentType,
  ExtractedField,
  ReviewReasonCode,
} from "@/lib/pipeline/types";

const TONE: Record<DisplayStatus, string> = {
  NOT_STARTED: "is-neutral",
  PROCESSING: "is-neutral",
  AWAITING_CONFIRMATION: "is-warn",
  EVIDENCE_ISSUES: "is-danger",
  DOCUMENTS_MISSING: "is-warn",
  READY: "is-ok",
  PACKET_LOCKED: "is-ok",
};

/** Field to jump to for each evidence error code. */
const ERROR_TARGET_FIELD: Partial<Record<ReviewReasonCode, string>> = {
  PAY_STUB_TOTAL_CONFLICT: "gross_pay",
  EMPLOYMENT_LETTER_EXPIRED: "document_date",
  GIG_INCOME_UNCORROBORATED: "gross_receipts",
};

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function isResolved(f: ExtractedField): boolean {
  return f.reviewStatus !== "extracted";
}

export default function HeaderStatus() {
  const c = useCopy();
  const {
    displayStatus,
    unresolvedCount,
    readiness,
    errorCount,
    fields,
    documents,
    missingRequired,
    requestReviewField,
    goToStep,
    stepUnlocked,
  } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Move focus to the first entry so keyboard users land on the right part.
    menuRef.current?.querySelector("button")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const statusText: Record<DisplayStatus, string> = {
    NOT_STARTED: c.statusEmpty,
    PROCESSING: c.reading,
    AWAITING_CONFIRMATION: fmt(c.statusAwaiting, { n: unresolvedCount }),
    EVIDENCE_ISSUES: fmt(c.statusIssues, { n: errorCount }),
    DOCUMENTS_MISSING: c.statusMissingDocs,
    READY: c.statusReady,
    PACKET_LOCKED: c.statusLocked,
  };

  const docLabel = (t: DocumentType): string => {
    const map: Record<DocumentType, string> = {
      application_summary: c.docApplication_summary,
      pay_stub: c.docPay_stub,
      employment_letter: c.docEmployment_letter,
      benefit_letter: c.docBenefit_letter,
      gig_statement: c.docGig_statement,
      unknown: c.docUnknown,
    };
    return map[t];
  };

  const reasonText: Partial<Record<ReviewReasonCode, string>> = {
    PAY_STUB_TOTAL_CONFLICT: c.rc_PAY_STUB_TOTAL_CONFLICT,
    EMPLOYMENT_LETTER_EXPIRED: c.rc_EMPLOYMENT_LETTER_EXPIRED,
    GIG_INCOME_UNCORROBORATED: c.rc_GIG_INCOME_UNCORROBORATED,
  };

  // Errors first (they set the red state), then pending confirmations, then
  // missing documents (informational).
  const errorEntries = readiness.reasons
    .filter((r) => r.blocking && r.code !== "UNCONFIRMED_FIELDS")
    .map((r, i) => {
      const doc = documents.find((d) => d.id === r.documentId);
      const targetKey = ERROR_TARGET_FIELD[r.code];
      const target =
        doc && targetKey
          ? fields.find((f) => f.documentId === doc.id && f.key === targetKey)
          : undefined;
      return {
        key: `err-${r.code}-${r.documentId ?? i}`,
        label: target
          ? `${humanize(target.key)} · ${doc ? docLabel(doc.documentType) : ""}`
          : (doc ? docLabel(doc.documentType) : humanize(r.code)),
        explain: reasonText[r.code] ?? humanize(r.code),
        onSelect: () => {
          setOpen(false);
          if (target) requestReviewField(target.id);
          else goToStep(stepUnlocked.prepare ? "prepare" : "understand");
        },
      };
    });
  const pendingEntries = fields
    .filter((f) => !isResolved(f))
    .map((f) => {
      const doc = documents.find((d) => d.id === f.documentId);
      return {
        key: `pending-${f.id}`,
        label: `${humanize(f.key)} · ${doc ? docLabel(doc.documentType) : ""}`,
        explain: c.stExtracted,
        onSelect: () => {
          setOpen(false);
          requestReviewField(f.id);
        },
      };
    });
  const docEntries = missingRequired.map((t) => ({
    key: `missing-${t}`,
    label: docLabel(t),
    explain: `${c.missing} — ${c.rc_MISSING_REQUIRED_DOCUMENT}`,
    onSelect: () => {
      setOpen(false);
      goToStep("profile");
    },
  }));
  const entries = [...errorEntries, ...pendingEntries, ...docEntries];

  const hasErrors = errorCount > 0;
  const errorTone = hasErrors ? "is-danger" : unresolvedCount > 0 ? "is-warn" : "is-ok";

  return (
    <div className="header-status">
      <span className={`status-chip ${TONE[displayStatus]}`} aria-live="polite">
        <span className="status-dot" aria-hidden="true" />
        <span className="visually-hidden">{c.statusLabel}: </span>
        <span className="status-chip-text">{statusText[displayStatus]}</span>
      </span>

      <div className="error-menu-wrap" ref={wrapRef}>
        <button
          ref={triggerRef}
          type="button"
          className={`status-chip status-chip-button ${errorTone}`}
          aria-expanded={open}
          aria-controls="error-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {hasErrors ? (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.5" />
                <path d="M12 16.4v.1" />
              </>
            ) : unresolvedCount > 0 ? (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4l2.6 2" />
              </>
            ) : (
              <path d="m5 13 4 4L19 7" />
            )}
          </svg>
          <span className="visually-hidden">{c.errorsLabel}: </span>
          {errorCount}
        </button>

        {open && (
          <div id="error-menu" className="error-menu" ref={menuRef}>
            <p className="error-menu-title">{c.errorsMenuTitle}</p>
            {entries.length === 0 ? (
              <p className="error-empty">{c.noReasons}</p>
            ) : (
              entries.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className="error-item"
                  onClick={entry.onSelect}
                >
                  <span className="error-item-label">{entry.label}</span>
                  <span className="error-item-explain">{entry.explain}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
