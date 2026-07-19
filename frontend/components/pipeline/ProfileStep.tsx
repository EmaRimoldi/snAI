"use client";

// Profile: upload synthetic PDFs, auto-classify against a checklist, then confirm
// or correct each extracted field one at a time — with its source region, page,
// and confidence. Only confirmed values flow downstream. Injected text is quarantined.

import { useRef, useState } from "react";
import { useApp, REQUIRED_CHECKLIST } from "@/lib/pipeline/state";
import type { DocumentType } from "@/lib/pipeline/types";
import { useCopy, fmt, FIELD_EXPLAIN } from "@/lib/pipeline/copy";
import { LOW_CONFIDENCE } from "@/lib/pipeline/calc";
import DocumentPreview from "./DocumentPreview";
import s from "./pipeline.module.css";

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function ProfileStep() {
  const c = useCopy();
  const { documents, fields, busy, addFiles, confirmField, correctField, goToStep } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [index, setIndex] = useState(0);
  const [correcting, setCorrecting] = useState(false);
  const [draft, setDraft] = useState("");

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

  const onFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    await addFiles(files);
    setIndex(0);
  };

  const present = new Set(documents.map((d) => d.documentType));
  const safeIndex = Math.min(index, Math.max(0, fields.length - 1));
  const field = fields[safeIndex];
  const doc = field ? documents.find((d) => d.id === field.documentId) : undefined;
  const confirmedCount = fields.filter((f) => f.reviewStatus !== "extracted").length;

  const startCorrect = () => {
    if (!field) return;
    setDraft(field.value);
    setCorrecting(true);
  };
  const go = (next: number) => {
    setCorrecting(false);
    setIndex(next);
  };

  return (
    <>
      {/* Upload */}
      <section className={s.card} aria-labelledby="upload-h">
        <h2 id="upload-h" className={s.cardTitle}>
          {c.uploadTitle}
        </h2>
        <div
          className={dragging ? `${s.dropzone} ${s.dropzoneDragging}` : s.dropzone}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void onFiles(e.dataTransfer.files);
          }}
        >
          <p className={s.hint}>{c.uploadHint}</p>
          <button type="button" className="primary-button" onClick={() => fileInputRef.current?.click()}>
            {c.chooseFiles}
          </button>
          {busy && (
            <p className={s.spinner} role="status">
              {c.reading}
            </p>
          )}
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".pdf,image/*"
            multiple
            tabIndex={-1}
            onChange={(e) => void onFiles(e.target.files)}
          />
        </div>

        <ul className={s.checklist}>
          {REQUIRED_CHECKLIST.map((t) => {
            const has = present.has(t);
            return (
              <li key={t} className={has ? `${s.checkItem} ${s.checkPresent}` : `${s.checkItem} ${s.checkMissing}`}>
                <span className={s.checkMark} aria-hidden="true">
                  {has ? "✓" : "○"}
                </span>
                <span>{docLabel(t)}</span>
                <span style={{ marginLeft: "auto", fontSize: "0.8rem", fontWeight: 700 }}>
                  {has ? c.present : c.missing}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Quarantine */}
      {documents
        .filter((d) => d.quarantinedText)
        .map((d) => (
          <div key={d.id} className={s.quarantine} role="note">
            <p className={s.quarantineHead}>
              {c.quarantineTitle} · {d.fileName}
            </p>
            <p className={s.quarantineHint}>{c.quarantineHint}</p>
            <p className={s.quarantineText}>“{d.quarantinedText}”</p>
          </div>
        ))}

      {/* Field review */}
      {field && doc ? (
        <section className={s.card} aria-labelledby="review-h">
          <h2 id="review-h" className={s.cardTitle}>
            {c.reviewTitle}
          </h2>
          <p className={s.hint}>{c.reviewHint}</p>

          <div className={s.fieldNavBar}>
            <span className={s.fieldCount}>{fmt(c.fieldOf, { n: safeIndex + 1, total: fields.length })}</span>
            <span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => go(Math.max(0, safeIndex - 1))}
                disabled={safeIndex === 0}
              >
                ← {c.back}
              </button>{" "}
              <button
                type="button"
                className="secondary-button"
                onClick={() => go(Math.min(fields.length - 1, safeIndex + 1))}
                disabled={safeIndex >= fields.length - 1}
              >
                {c.next} →
              </button>
            </span>
          </div>

          <div className={s.reviewGrid}>
            <div>
              <h3 className={s.fieldKey}>{humanize(field.key)}</h3>
              <p className={s.fieldExplain}>
                <strong>{c.whyNeeded}: </strong>
                {FIELD_EXPLAIN[field.key] ?? `${humanize(field.key)} — extracted from ${docLabel(doc.documentType)}.`}
              </p>

              <div className={`${s.confidenceWrap} ${field.confidence < LOW_CONFIDENCE ? s.confidenceLow : ""}`}>
                <div className={s.confidenceHead}>
                  <span>{c.confidence}</span>
                  <span>{Math.round(field.confidence * 100)}%</span>
                </div>
                <div className={s.confidenceBar}>
                  <div className={s.confidenceFill} style={{ width: `${Math.round(field.confidence * 100)}%` }} />
                </div>
              </div>

              {correcting ? (
                <>
                  <label className="visually-hidden" htmlFor="correct-input">
                    {humanize(field.key)}
                  </label>
                  <input
                    id="correct-input"
                    className={s.fieldValue}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoFocus
                  />
                  <div className={s.actions}>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => {
                        correctField(field.id, draft.trim());
                        setCorrecting(false);
                      }}
                    >
                      {c.saveCorrection}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => setCorrecting(false)}>
                      {c.cancel}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className={s.fieldValue} aria-live="polite">
                    {field.value}
                  </p>
                  <p style={{ margin: "0.6rem 0 0" }}>
                    <span
                      className={`${s.statusChip} ${
                        field.reviewStatus === "extracted" ? s.chipExtracted : s.chipConfirmed
                      }`}
                    >
                      {field.reviewStatus === "extracted"
                        ? c.stExtracted
                        : field.reviewStatus === "corrected"
                          ? c.stCorrected
                          : c.stConfirmed}
                    </span>
                  </p>
                  <div className={s.actions}>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => confirmField(field.id)}
                      disabled={field.reviewStatus !== "extracted"}
                    >
                      {c.confirm}
                    </button>
                    <button type="button" className="secondary-button" onClick={startCorrect}>
                      {c.correct}
                    </button>
                  </div>
                </>
              )}
            </div>

            <DocumentPreview doc={doc} field={field} />
          </div>

          <p className={s.hint} style={{ marginTop: "1rem" }}>
            {fmt(c.fieldsConfirmed, { n: confirmedCount, total: fields.length })}
          </p>
          <div className={s.actions}>
            <button type="button" className="primary-button" onClick={() => goToStep("understand")}>
              {c.goUnderstand} →
            </button>
          </div>
        </section>
      ) : (
        <p className={s.hint}>{c.noDocs}</p>
      )}
    </>
  );
}
