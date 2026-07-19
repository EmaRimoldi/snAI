"use client";

// Profile: staged upload -> sequential parsing -> review. The user sees the
// expected documents before selecting files, then each rounded document card
// fills from left to right as parsing runs.

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/pipeline/state";
import type { DocumentRecord, DocumentType } from "@/lib/pipeline/types";
import { useCopy, fmt, useFieldExplain } from "@/lib/pipeline/copy";
import { LOW_CONFIDENCE } from "@/lib/pipeline/calc";
import { confidenceColor } from "@/lib/pipeline/confidence";
import DocumentPreview from "./DocumentPreview";
import s from "./pipeline.module.css";

type UploadSlot = {
  type: Exclude<DocumentType, "unknown">;
  label: string;
  required: boolean;
  description: string;
};

type SlotState = "empty" | "queued" | "parsing" | "parsed" | "error";

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function docLabel(t: DocumentType): string {
  const map: Record<DocumentType, string> = {
    application_summary: "Application summary",
    pay_stub: "Pay stub",
    employment_letter: "Employment letter",
    benefit_letter: "Benefit letter",
    gig_statement: "Gig statement",
    unknown: "Document",
  };
  return map[t];
}

function expectedSlots(): UploadSlot[] {
  return [
    {
      type: "application_summary",
      label: "Application summary",
      required: true,
      description: "Identity, household size, address, application date.",
    },
    {
      type: "pay_stub",
      label: "Pay stub",
      required: true,
      description: "Gross pay, cadence, hours, rate, period dates.",
    },
    {
      type: "employment_letter",
      label: "Employment letter",
      required: true,
      description: "Employer rate, schedule, document date.",
    },
    {
      type: "benefit_letter",
      label: "Benefit letter",
      required: false,
      description: "If applicable: recurring benefit amount and frequency.",
    },
    {
      type: "gig_statement",
      label: "Gig statement",
      required: false,
      description: "If applicable: monthly gross receipts and platform fees.",
    },
  ];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function ProfileStep() {
  const c = useCopy();
  const fieldExplain = useFieldExplain();
  const {
    documents,
    fields,
    busy,
    addFiles,
    confirmField,
    correctField,
    goToStep,
    pendingReviewFieldId,
    clearReviewRequest,
  } = useApp();

  const slots = useMemo(() => expectedSlots(), []);
  const [queuedFiles, setQueuedFiles] = useState<Partial<Record<DocumentType, File>>>({});
  const [slotDocumentIds, setSlotDocumentIds] = useState<Partial<Record<DocumentType, string>>>({});
  const [slotStatus, setSlotStatus] = useState<Partial<Record<DocumentType, SlotState>>>({});
  const [slotProgress, setSlotProgress] = useState<Partial<Record<DocumentType, number>>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(documents.length > 0);
  const [index, setIndex] = useState(0);
  const [correcting, setCorrecting] = useState(false);
  const [draft, setDraft] = useState("");
  const fieldHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (documents.length > 0 && !isParsing) setReviewOpen(true);
  }, [documents.length, isParsing]);

  useEffect(() => {
    if (!pendingReviewFieldId) return;
    const requestedIndex = fields.findIndex((item) => item.id === pendingReviewFieldId);
    if (requestedIndex >= 0) {
      setReviewOpen(true);
      setCorrecting(false);
      setIndex(requestedIndex);
      window.requestAnimationFrame(() => {
        fieldHeadingRef.current?.focus({ preventScroll: true });
        reviewSectionRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
    clearReviewRequest();
  }, [pendingReviewFieldId, fields, clearReviewRequest]);

  const documentsById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  );
  const assignedDocumentIds = useMemo(
    () => new Set(Object.values(slotDocumentIds).filter((id): id is string => Boolean(id))),
    [slotDocumentIds],
  );
  const documentForSlot = (type: DocumentType): DocumentRecord | undefined => {
    const assignedId = slotDocumentIds[type];
    if (assignedId) return documentsById.get(assignedId);
    return documents.find((document) => document.documentType === type && !assignedDocumentIds.has(document.id));
  };
  const canParse = Object.values(queuedFiles).some(Boolean) && !busy && !isParsing;

  const reviewFields = fields;
  const safeIndex = Math.min(index, Math.max(0, reviewFields.length - 1));
  const field = reviewFields[safeIndex];
  const doc = field ? documents.find((document) => document.id === field.documentId) : documents[0];
  const confirmedCount = reviewFields.filter((item) => item.reviewStatus !== "extracted").length;

  const setSlotFile = (type: DocumentType, file: File | undefined) => {
    if (!file) return;
    setReviewOpen(false);
    setQueuedFiles((prev) => ({ ...prev, [type]: file }));
    setSlotDocumentIds((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    setSlotStatus((prev) => ({ ...prev, [type]: "queued" }));
    setSlotProgress((prev) => ({ ...prev, [type]: 0 }));
  };

  const startParsing = async () => {
    if (!canParse) return;
    setIsParsing(true);
    setReviewOpen(false);

    let successCount = 0;
    for (const slot of slots) {
      const file = queuedFiles[slot.type];
      setSlotStatus((prev) => ({ ...prev, [slot.type]: "parsing" }));
      setSlotProgress((prev) => ({ ...prev, [slot.type]: 0 }));
      window.requestAnimationFrame(() => {
        setSlotProgress((prev) => ({ ...prev, [slot.type]: 100 }));
      });

      try {
        const [addedRecords] = await Promise.all([file ? addFiles([file]) : Promise.resolve([]), sleep(1000)]);
        const addedDocument = addedRecords[0];
        if (file && addedDocument) {
          setSlotDocumentIds((prev) => ({ ...prev, [slot.type]: addedDocument.id }));
          successCount += 1;
          setSlotStatus((prev) => ({ ...prev, [slot.type]: "parsed" }));
        } else if (file) {
          setSlotStatus((prev) => ({ ...prev, [slot.type]: "error" }));
        } else if (slot.required) {
          setSlotStatus((prev) => ({ ...prev, [slot.type]: "error" }));
        } else {
          setSlotStatus((prev) => ({ ...prev, [slot.type]: "empty" }));
          setSlotProgress((prev) => ({ ...prev, [slot.type]: 0 }));
        }
      } catch {
        setSlotProgress((prev) => ({ ...prev, [slot.type]: 100 }));
        setSlotStatus((prev) => ({ ...prev, [slot.type]: "error" }));
      }
    }
    setIsParsing(false);
    setReviewOpen(successCount > 0);
    setIndex(0);
  };

  const startCorrect = () => {
    if (!field) return;
    setDraft(field.value);
    setCorrecting(true);
  };

  const go = (next: number) => {
    setCorrecting(false);
    setIndex(next);
  };

  const confirmAndGoNext = () => {
    if (!field) return;
    confirmField(field.id);
    if (safeIndex < reviewFields.length - 1) go(safeIndex + 1);
  };

  const uploadStage = (
    <section className={s.card} aria-labelledby="upload-h">
      <div className={s.uploadHero}>
        <div>
          <p className={s.kicker}>Upload document</p>
          <h2 id="upload-h" className={s.cardTitle}>
            {c.uploadTitle}
          </h2>
          <p className={s.hint}>{c.uploadHint}</p>
          <p className={s.requiredLegend}>
            <span aria-hidden="true">*</span> required
          </p>
        </div>
        <button
          type="button"
          className={s.playButton}
          onClick={startParsing}
          disabled={!canParse}
          aria-label="Start parsing"
        >
          <span aria-hidden="true" />
        </button>
      </div>

      <div className={s.uploadStack}>
        {slots.map((slot, slotIndex) => {
          const file = queuedFiles[slot.type];
          const status = slotStatus[slot.type] ?? "empty";
          const progress = slotProgress[slot.type] ?? 0;
          const parsedDocument = documentForSlot(slot.type);
          const hasFile = Boolean(file) || Boolean(parsedDocument);
          const isDone = status === "parsed" || Boolean(parsedDocument);
          const isError =
            status === "error" ||
            (reviewOpen && slot.required && !parsedDocument);
          const statusLabel = isError
            ? "Needs attention"
            : isDone
              ? "Parsed"
              : status === "parsing"
                ? "Parsing"
                : hasFile
                  ? "Uploaded"
                  : "Not uploaded";

          return (
            <article
              key={slot.type}
              className={`${s.uploadSlot} ${hasFile ? s.uploadSlotHasFile : ""} ${
                isDone ? s.uploadSlotDone : ""
              } ${isError ? s.uploadSlotError : ""}`}
            >
              <div
                className={s.uploadSlotFill}
                style={{ width: `${Math.max(isDone ? 100 : 0, progress)}%` }}
                aria-hidden="true"
              />
              <div className={s.uploadSlotBody}>
                <div className={s.uploadSlotMain}>
                  <span className={s.uploadSlotNumber}>{slotIndex + 1}</span>
                  <div>
                    <h3>
                      {slot.label}
                      {slot.required && (
                        <span className={s.requiredStar} aria-label="required">
                          *
                        </span>
                      )}
                    </h3>
                    <p>{slot.description}</p>
                    {(file || parsedDocument) && (
                      <p className={s.fileName}>
                        {file?.name ?? parsedDocument?.fileName}
                        {parsedDocument && parsedDocument.documentType !== slot.type
                          ? ` · parsed as ${docLabel(parsedDocument.documentType)}`
                          : ""}
                      </p>
                    )}
                  </div>
                </div>

                <div className={s.uploadSlotActions}>
                  <label className={s.uploadIconButton} title={`Upload ${slot.label}`}>
                    <span className="visually-hidden">Upload {slot.label}</span>
                    <span className={s.uploadGlyph} aria-hidden="true">
                      ↑
                    </span>
                    <span className={s.uploadTray} aria-hidden="true" />
                    <input
                      className="visually-hidden"
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(event) => setSlotFile(slot.type, event.target.files?.[0])}
                    />
                  </label>
                  <span
                    className={`${s.uploadStatusIcon} ${
                      isError ? s.uploadStatusAlert : isDone ? s.uploadStatusDone : status === "parsing" ? s.uploadStatusParsing : ""
                    }`}
                    aria-label={statusLabel}
                    title={statusLabel}
                  >
                    {isError ? "!" : isDone ? "✓" : status === "parsing" ? "…" : ""}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {isParsing && !reviewOpen && (
        <p className={s.spinner} role="status">
          Parsing documents sequentially…
        </p>
      )}
    </section>
  );

  return (
    <>
      {!reviewOpen && uploadStage}

      {reviewOpen && documents.length > 0 && (
        <>
          {doc ? (
            <section className={s.card} aria-label="Reviewer" ref={reviewSectionRef}>
              {doc?.quarantinedText && (
                <div className={s.quarantine} role="note">
                  <p className={s.quarantineHead}>
                    {c.quarantineTitle} · {doc.fileName}
                  </p>
                  <p className={s.quarantineHint}>{c.quarantineHint}</p>
                  <p className={s.quarantineText}>“{doc.quarantinedText}”</p>
                </div>
              )}

              {field ? (
                <>
              <div className={s.fieldNavBar}>
                <span className={s.fieldCount}>{fmt(c.fieldOf, { n: safeIndex + 1, total: reviewFields.length })}</span>
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
                    onClick={() => go(Math.min(reviewFields.length - 1, safeIndex + 1))}
                    disabled={safeIndex >= reviewFields.length - 1}
                  >
                    {c.next} →
                  </button>
                </span>
              </div>

              <div className={s.reviewGrid}>
                <div>
                  <h3 className={s.fieldKey} ref={fieldHeadingRef} tabIndex={-1}>
                    {humanize(field.key)}
                  </h3>
                  <p className={s.fieldExplain}>
                    <strong>{c.whyNeeded}: </strong>
                    {fieldExplain[field.key] ?? `${humanize(field.key)} — ${docLabel(doc.documentType)}`}
                  </p>

                  <div className={`${s.confidenceWrap} ${field.confidence < LOW_CONFIDENCE ? s.confidenceLow : ""}`}>
                    <div className={s.confidenceHead}>
                      <span>{c.confidence}</span>
                      <span style={{ color: confidenceColor(field.confidence) }}>
                        {Math.round(field.confidence * 100)}%
                      </span>
                    </div>
                    <div className={s.confidenceBar}>
                      <div
                        className={s.confidenceFill}
                        style={{
                          width: `${Math.round(field.confidence * 100)}%`,
                          background: confidenceColor(field.confidence),
                        }}
                      />
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
                        onChange={(event) => setDraft(event.target.value)}
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
                          onClick={confirmAndGoNext}
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

                <DocumentPreview
                  doc={doc}
                  field={field}
                  fields={fields.filter((item) => item.documentId === doc.id)}
                />
              </div>

              <p className={s.hint} style={{ marginTop: "1rem" }}>
                {fmt(c.fieldsConfirmed, { n: confirmedCount, total: reviewFields.length })}
              </p>
                </>
              ) : (
                <p className={s.hint}>No extracted fields for this document yet.</p>
              )}
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
      )}

    </>
  );
}
