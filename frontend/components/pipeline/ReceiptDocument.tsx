"use client";

// The renter's readiness receipt, rendered as a stacked SAMPLE "paper" document.
// Data sections mirror the parsed-document schema: one section per uploaded
// document listing every expected field for its type — real parsed values only
// (confirmed ones editable in place unless locked), with red "still missing" /
// "needs your check" markers for absent or unconfirmed entries. Nothing is ever
// invented. Readiness vocabulary only: never an eligibility decision.

import { useEffect, useRef, useState } from "react";
import { useApp, REQUIRED_CHECKLIST } from "@/lib/pipeline/state";
import type { DocumentRecord, DocumentType, ExtractedField } from "@/lib/pipeline/types";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import { useI18n } from "@/lib/i18n";
import { formatMoneyCents, compareToThreshold, thresholdCentsForSize } from "@/lib/pipeline/calc";
import { MTSP_2026 } from "@/lib/data/mtsp2026";
import {
  humanize,
  useDocLabels,
  useFieldLabel,
  useReasonTexts,
  useReasonTitles,
} from "@/lib/pipeline/labels";
import s from "./pipeline.module.css";
import r from "./receipt.module.css";

/** One expected receipt entry; `keys` lists the parser field names that satisfy it. */
type ExpectedEntry = { keys: readonly string[]; label: string; optional?: boolean };

const field = (key: string, optional?: boolean): ExpectedEntry => ({ keys: [key], label: key, optional });

/** The benefit amount is dynamic: any one of these keys satisfies the entry. */
const BENEFIT_AMOUNT_KEYS = [
  "weekly_benefit",
  "biweekly_benefit",
  "semimonthly_benefit",
  "monthly_benefit",
  "annual_benefit",
] as const;

/** Fields the parser is expected to produce per document type (organizer schema).
 * The receipt never invents values: an absent required entry renders as a red
 * marker; quarantined instruction text is flagged but never rendered as data. */
const EXPECTED_DOC_FIELDS: Record<DocumentType, readonly ExpectedEntry[]> = {
  application_summary: [
    field("person_name"),
    field("household_size"),
    field("address"),
    field("application_date"),
    field("declared_income", true),
  ],
  pay_stub: [
    field("person_name"),
    field("pay_date"),
    field("pay_frequency"),
    field("pay_period_start"),
    field("pay_period_end"),
    field("regular_hours"),
    field("hourly_rate"),
    field("gross_pay"),
    field("net_pay"),
  ],
  employment_letter: [field("person_name"), field("document_date"), field("weekly_hours"), field("hourly_rate")],
  benefit_letter: [
    field("person_name"),
    field("document_date"),
    field("benefit_frequency"),
    { keys: BENEFIT_AMOUNT_KEYS, label: "benefit_amount" },
  ],
  gig_statement: [field("person_name"), field("statement_month"), field("gross_receipts"), field("platform_fees")],
  unknown: [],
};

type RowSpec =
  | { kind: "present"; id: string; label: string; field: ExtractedField }
  | { kind: "unconfirmed"; id: string; label: string }
  | { kind: "missing"; id: string; label: string };

/** Resolve a document's expected entries against its actually-parsed fields;
 * parsed-but-unexpected extras are appended so no real data is hidden.
 * `fieldLabel` supplies the localized display label for a field key. */
function buildDocRows(
  doc: DocumentRecord,
  docFields: readonly ExtractedField[],
  fieldLabel: (key: string) => string,
): RowSpec[] {
  const rows: RowSpec[] = [];
  const used = new Set<string>();
  for (const entry of EXPECTED_DOC_FIELDS[doc.documentType]) {
    const match = docFields.find((f) => entry.keys.includes(f.key));
    const label = fieldLabel(entry.label);
    if (match) {
      used.add(match.id);
      rows.push(
        match.reviewStatus === "extracted"
          ? { kind: "unconfirmed", id: match.id, label }
          : { kind: "present", id: match.id, label, field: match },
      );
    } else if (!entry.optional) {
      rows.push({ kind: "missing", id: `${doc.id}-${entry.label}`, label });
    }
  }
  for (const f of docFields) {
    if (used.has(f.id)) continue;
    rows.push(
      f.reviewStatus === "extracted"
        ? { kind: "unconfirmed", id: f.id, label: fieldLabel(f.key) }
        : { kind: "present", id: f.id, label: fieldLabel(f.key), field: f },
    );
  }
  return rows;
}

/** Income-tagged corrections must parse to a non-negative finite amount. */
function isValidAmount(value: string): boolean {
  if (!/\d/.test(value) || value.includes("-")) return false;
  const n = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0;
}

export default function ReceiptDocument() {
  const c = useCopy();
  const { language } = useI18n();
  const {
    documents,
    fields,
    readiness,
    grossIncomeCents,
    householdSize,
    locked,
    correctField,
    applicationId,
    presentTypes,
  } = useApp();
  const docLabels = useDocLabels();
  const fieldLabel = useFieldLabel();
  const reasonTexts = useReasonTexts();
  const reasonTitles = useReasonTitles();
  const money = (cents: number): string => formatMoneyCents(cents, language);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftInvalid, setDraftInvalid] = useState(false);
  const refocusIdRef = useRef<string | null>(null);

  // Locking closes any in-flight edit; nothing on the receipt may change while locked.
  useEffect(() => {
    if (locked) setEditingId(null);
  }, [locked]);

  // Return focus to the row's Correct button after saving or canceling an edit.
  useEffect(() => {
    if (editingId === null && refocusIdRef.current) {
      document.getElementById(`receipt-correct-${refocusIdRef.current}`)?.focus();
      refocusIdRef.current = null;
    }
  }, [editingId]);

  const checklistTypes: DocumentType[] = [
    ...REQUIRED_CHECKLIST,
    ...presentTypes.filter((t) => !REQUIRED_CHECKLIST.includes(t)),
  ];
  const thresholdCents = thresholdCentsForSize(householdSize);
  const comparison = compareToThreshold(grossIncomeCents, thresholdCents);
  const comparisonLabel =
    comparison === "below_or_equal" ? c.cmpBelow : comparison === "above" ? c.cmpAbove : c.cmpNone;
  const isReady = readiness.status === "READY_TO_REVIEW";
  const generatedDate = new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(new Date());

  const startEdit = (f: ExtractedField) => {
    if (locked) return;
    setDraft(f.value);
    setDraftInvalid(false);
    setEditingId(f.id);
  };
  const cancelEdit = (id: string) => {
    refocusIdRef.current = id;
    setDraftInvalid(false);
    setEditingId(null);
  };
  const saveEdit = (f: ExtractedField) => {
    if (locked) return;
    const value = draft.trim();
    if (f.isIncome && !isValidAmount(value)) {
      setDraftInvalid(true);
      return;
    }
    correctField(f.id, value);
    refocusIdRef.current = f.id;
    setDraftInvalid(false);
    setEditingId(null);
  };

  const renderPresent = (spec: Extract<RowSpec, { kind: "present" }>) => (
    <li key={spec.id} className={r.row}>
      <span className={r.rowKey}>{spec.label}</span>
      {editingId === spec.field.id && !locked ? (
        <span className={r.editArea}>
          <label className="visually-hidden" htmlFor={`receipt-edit-${spec.field.id}`}>
            {spec.label}
          </label>
          <input
            id={`receipt-edit-${spec.field.id}`}
            className={r.editInput}
            value={draft}
            maxLength={120}
            aria-invalid={draftInvalid || undefined}
            aria-describedby={draftInvalid ? `receipt-edit-err-${spec.field.id}` : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setDraftInvalid(false);
            }}
            autoFocus
          />
          <button type="button" className="primary-button" onClick={() => saveEdit(spec.field)}>
            {c.saveCorrection}
          </button>
          <button type="button" className="secondary-button" onClick={() => cancelEdit(spec.field.id)}>
            {c.cancel}
          </button>
          {draftInvalid && (
            <span id={`receipt-edit-err-${spec.field.id}`} role="alert" className={r.errorText}>
              {c.invalidAmount}
            </span>
          )}
        </span>
      ) : (
        <>
          <span className={r.rowVal} aria-live="polite">
            {spec.field.value}
          </span>
          {!locked && (
            <button
              type="button"
              id={`receipt-correct-${spec.field.id}`}
              className={r.editBtn}
              onClick={() => startEdit(spec.field)}
            >
              {c.correct}
              <span className="visually-hidden"> — {spec.label}</span>
            </button>
          )}
        </>
      )}
    </li>
  );

  const renderFlag = (spec: RowSpec, text: string) => (
    <li key={spec.id} className={r.row}>
      <span className={r.rowKey}>{spec.label}</span>
      <span className={`${r.rowVal} ${r.missingVal}`}>{text}</span>
    </li>
  );

  return (
    <>
      <p className={r.banner} role="note">
        {c.sampleBanner}
      </p>
      <div className={r.stack} data-print-region>
        <article className={r.page} aria-labelledby="receipt-doc-h">
          <span className={r.watermark} aria-hidden="true">
            {c.sampleWord}
          </span>
          <div className={r.inner}>
            <header className={r.docHeader}>
              <div className={r.docHeadText}>
                <p className={r.kicker}>{c.receiptKicker}</p>
                <h3 id="receipt-doc-h" className={r.docTitle}>
                  {c.receiptDocTitle}
                </h3>
                <p className={r.meta}>
                  {c.receiptFileLabel}: {applicationId} · {fmt(c.receiptGenerated, { date: generatedDate })}
                </p>
              </div>
              <div className={r.brand}>
                <img className={r.brandLogo} src="/logo.svg" alt="" />
                <span className={r.brandName}>RealDoor</span>
              </div>
            </header>

            <section className={r.section}>
              <h4 className={r.secTitle}>{c.receiptSecDocs}</h4>
              <ul className={r.rows}>
                {checklistTypes.map((t) => {
                  const has = presentTypes.includes(t);
                  return (
                    <li key={t} className={r.checkRow}>
                      <span className={has ? r.checkOn : r.checkOff} aria-hidden="true">
                        {has ? "✓" : "○"}
                      </span>
                      <span>{docLabels[t]}</span>
                      <span className={has ? r.checkState : `${r.checkState} ${r.missingVal}`}>
                        {has ? c.present : c.missing}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            {documents.map((doc) => {
              const rows = buildDocRows(doc, fields.filter((f) => f.documentId === doc.id), fieldLabel);
              return (
                <section key={doc.id} className={r.section}>
                  <h4 className={r.secTitle}>
                    {docLabels[doc.documentType]} <span className={r.fileName}>· {doc.fileName}</span>
                  </h4>
                  <ul className={r.rows}>
                    {rows.map((spec) =>
                      spec.kind === "present"
                        ? renderPresent(spec)
                        : renderFlag(spec, spec.kind === "unconfirmed" ? c.stExtracted : c.missing),
                    )}
                  </ul>
                  {doc.quarantinedText && (
                    <p className={`${r.note} ${r.quarantineNote}`}>⚠ {c.quarantineTitle}</p>
                  )}
                </section>
              );
            })}
            {!locked && <p className={`${r.note} ${r.screenOnly}`}>{c.receiptEditNote}</p>}

            <section className={r.section}>
              <h4 className={r.secTitle}>{c.receiptSecIncome}</h4>
              <ul className={r.rows}>
                <li className={r.row}>
                  <span className={r.rowKey}>{c.annualizedIncome}</span>
                  <span className={r.rowVal} aria-live="polite">
                    {money(grossIncomeCents)}
                  </span>
                </li>
                <li className={r.row}>
                  <span className={r.rowKey}>{c.threshold60}</span>
                  <span className={r.rowVal}>
                    {thresholdCents === null ? c.cmpNone : money(thresholdCents)}
                  </span>
                </li>
                <li className={r.row}>
                  <span className={r.rowKey}>{c.comparison}</span>
                  <span className={r.rowVal} aria-live="polite">
                    {comparisonLabel}
                  </span>
                </li>
                <li className={r.row}>
                  <span className={r.rowKey}>{c.effective}</span>
                  <span className={r.rowVal}>{MTSP_2026.effectiveDate}</span>
                </li>
              </ul>
            </section>

            <section className={r.section}>
              <h4 className={r.secTitle}>{c.receiptSecReadiness}</h4>
              <p className={r.verdictLine}>
                <span className={`${s.verdict} ${isReady ? s.verdictReady : s.verdictNeeds}`}>
                  {isReady ? c.statusReady : c.statusNeeds}
                </span>
              </p>
              {readiness.reasons.length > 0 && (
                <ul className={r.reasonNotes}>
                  {readiness.reasons.map((reason, i) => (
                    <li key={`${reason.code}-${i}`} className={r.note}>
                      <strong>{reasonTitles[reason.code]}</strong> — {reasonTexts[reason.code]}
                      {reason.detail && reason.code === "MISSING_REQUIRED_DOCUMENT"
                        ? ` (${(docLabels as Record<string, string | undefined>)[reason.detail] ?? humanize(reason.detail)})`
                        : ""}
                    </li>
                  ))}
                </ul>
              )}
              <p className={r.note}>{c.verdictNote}</p>
            </section>

            <footer className={r.docFooter}>{c.receiptFooter}</footer>
          </div>
        </article>
      </div>
    </>
  );
}
