"use client";

// Profile: upload synthetic PDFs, auto-classify against a checklist, then confirm
// or correct each extracted field one at a time — with its source region, page,
// and confidence. Only confirmed values flow downstream. Injected text is quarantined.

import { useEffect, useRef, useState } from "react";
import { useApp, REQUIRED_CHECKLIST } from "@/lib/pipeline/state";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import { LOW_CONFIDENCE } from "@/lib/pipeline/calc";
import { useDocLabels, useFieldLabel, useFieldExplain } from "@/lib/pipeline/labels";
import DocumentPreview from "./DocumentPreview";
import s from "./pipeline.module.css";

export default function ProfileStep() {
  const c = useCopy();
  const {
    documents, fields, busy, addFiles, confirmField, correctField, goToStep,
    pendingReviewFieldId, clearReviewRequest,
  } = useApp();
  const docLabels = useDocLabels();
  const fieldLabel = useFieldLabel();
  const fieldExplain = useFieldExplain();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [index, setIndex] = useState(0);
  const [correcting, setCorrecting] = useState(false);
  const [draft, setDraft] = useState("");

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
    scrollAfterNavRef.current = true;
  };

  // After confirming/correcting a value, move on to the next field that still
  // needs a check (searching forward, wrapping); stay put when none remain.
  const advanceAfterResolve = (fromIndex: number) => {
    for (let offset = 1; offset < fields.length; offset += 1) {
      const i = (fromIndex + offset) % fields.length;
      if (fields[i].reviewStatus === "extracted") {
        go(i);
        return;
      }
    }
  };

  // The header error menu can ask Profile to show a specific field; after the
  // jump, move focus onto the field heading so keyboard/AT users land there.
  const fieldHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewSectionRef = useRef<HTMLElement>(null);
  const focusAfterJumpRef = useRef(false);
  const scrollAfterNavRef = useRef(false);
  useEffect(() => {
    if (!pendingReviewFieldId) return;
    const i = fields.findIndex((f) => f.id === pendingReviewFieldId);
    if (i >= 0) {
      setCorrecting(false);
      setIndex(i);
      focusAfterJumpRef.current = true;
      scrollAfterNavRef.current = true;
    }
    clearReviewRequest();
  }, [pendingReviewFieldId, fields, clearReviewRequest]);
  // After any field navigation (confirm auto-advance, prev/next, menu jump),
  // center the review card — with the PDF preview — in the viewport.
  useEffect(() => {
    if (focusAfterJumpRef.current) {
      focusAfterJumpRef.current = false;
      fieldHeadingRef.current?.focus({ preventScroll: true });
    }
    if (scrollAfterNavRef.current) {
      scrollAfterNavRef.current = false;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      reviewSectionRef.current?.scrollIntoView({
        block: "center",
        behavior: reduce ? "auto" : "smooth",
      });
    }
  }, [safeIndex]);

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
                <span>{docLabels[t]}</span>
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
        <section className={s.card} aria-labelledby="review-h" ref={reviewSectionRef}>
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
              <h3 className={s.fieldKey} ref={fieldHeadingRef} tabIndex={-1}>
                {fieldLabel(field.key)}
              </h3>
              <p className={s.fieldExplain}>
                <strong>{c.whyNeeded}: </strong>
                {fieldExplain(field.key) ??
                  fmt(c.fieldExplainFallback, {
                    field: fieldLabel(field.key),
                    doc: docLabels[doc.documentType],
                  })}
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
                    {fieldLabel(field.key)}
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
                        advanceAfterResolve(safeIndex);
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
                      onClick={() => {
                        confirmField(field.id);
                        advanceAfterResolve(safeIndex);
                      }}
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
