"use client";

// Profile: staged upload -> sequential parsing -> review. The user sees the
// expected documents before selecting files, then each rounded document card
// fills from left to right as parsing runs.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/pipeline/state";
import type { DocumentRecord, DocumentType, ExtractedField } from "@/lib/pipeline/types";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import { CURRENCY_WINDOW_START, LOW_CONFIDENCE } from "@/lib/pipeline/calc";
import { confidenceColor } from "@/lib/pipeline/confidence";
import { useDocumentGuides } from "@/lib/pipeline/documentGuides";
import { useDocLabels, useFieldExplain, useFieldLabel } from "@/lib/pipeline/labels";
import DocumentPreview from "./DocumentPreview";
import s from "./pipeline.module.css";

type UploadSlot = {
  type: Exclude<DocumentType, "unknown">;
  label: string;
  required: boolean;
  description: string;
};

type SlotState = "empty" | "queued" | "parsing" | "parsed" | "warning" | "error";

type ConsistencyWarning = {
  id: string;
  tone: "warning" | "danger";
  title: string;
  detail: string;
  documentId?: string;
  fieldId?: string;
  slotType?: DocumentType;
};

const EXPECTED_FIELDS: Record<Exclude<DocumentType, "unknown">, string[]> = {
  application_summary: ["person_name", "household_size", "address", "application_date"],
  pay_stub: [
    "person_name",
    "pay_date",
    "pay_frequency",
    "pay_period_start",
    "pay_period_end",
    "regular_hours",
    "hourly_rate",
    "gross_pay",
    "net_pay",
  ],
  employment_letter: ["person_name", "document_date", "weekly_hours", "hourly_rate"],
  benefit_letter: ["person_name", "document_date", "benefit_frequency"],
  gig_statement: ["person_name", "statement_month", "gross_receipts", "platform_fees"],
};

const BENEFIT_AMOUNT_FIELDS = [
  "weekly_benefit",
  "biweekly_benefit",
  "semimonthly_benefit",
  "monthly_benefit",
  "annual_benefit",
];

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

function expectedSlots(labels: Record<DocumentType, string>): UploadSlot[] {
  return [
    {
      type: "application_summary",
      label: labels.application_summary,
      required: true,
      description: "Identity, household size, address, application date.",
    },
    {
      type: "pay_stub",
      label: labels.pay_stub,
      required: true,
      description: "Gross pay, cadence, hours, rate, period dates.",
    },
    {
      type: "employment_letter",
      label: labels.employment_letter,
      required: true,
      description: "Employer rate, schedule, document date.",
    },
    {
      type: "benefit_letter",
      label: labels.benefit_letter,
      required: false,
      description: "If applicable: recurring benefit amount and frequency.",
    },
    {
      type: "gig_statement",
      label: labels.gig_statement,
      required: false,
      description: "If applicable: monthly gross receipts and platform fees.",
    },
  ];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function readNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function readDate(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildConsistencyWarnings(args: {
  documents: DocumentRecord[];
  fields: ExtractedField[];
  slots: UploadSlot[];
  slotDocumentIds: Partial<Record<DocumentType, string>>;
}): ConsistencyWarning[] {
  const { documents, fields, slots, slotDocumentIds } = args;
  const warnings: ConsistencyWarning[] = [];
  const seen = new Set<string>();
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const assignedDocumentIds = new Set(
    Object.values(slotDocumentIds).filter((id): id is string => Boolean(id)),
  );
  const fieldsByDocument = new Map<string, ExtractedField[]>();

  for (const field of fields) {
    const group = fieldsByDocument.get(field.documentId) ?? [];
    group.push(field);
    fieldsByDocument.set(field.documentId, group);
  }

  const add = (warning: ConsistencyWarning) => {
    if (seen.has(warning.id)) return;
    seen.add(warning.id);
    warnings.push(warning);
  };

  const slotDocument = (type: DocumentType): DocumentRecord | undefined => {
    const assignedId = slotDocumentIds[type];
    if (assignedId) return documentsById.get(assignedId);
    return documents.find(
      (document) => document.documentType === type && !assignedDocumentIds.has(document.id),
    );
  };

  const documentFields = (documentId: string) => fieldsByDocument.get(documentId) ?? [];
  const fieldByKey = (documentId: string, key: string) =>
    documentFields(documentId).find((field) => field.key === key);
  const hasValue = (documentId: string, key: string) => {
    const field = fieldByKey(documentId, key);
    return Boolean(field && field.value.trim());
  };

  for (const slot of slots) {
    const document = slotDocument(slot.type);
    if (!document) {
      if (slot.required) {
        add({
          id: `missing-required-${slot.type}`,
          tone: "danger",
          title: `${slot.label} missing`,
          detail: "Upload this required document before final review.",
          slotType: slot.type,
        });
      }
      continue;
    }

    if (document.documentType !== slot.type) {
      add({
        id: `type-mismatch-${slot.type}-${document.id}`,
        tone: "danger",
        title: "Document type mismatch",
        detail: `${slot.label} was parsed as ${docLabel(document.documentType)}. Check that the uploaded file is in the right slot.`,
        documentId: document.id,
      });
    }

    if (document.classifyConfidence < LOW_CONFIDENCE) {
      add({
        id: `low-classify-${document.id}`,
        tone: "warning",
        title: "Low document confidence",
        detail: `${slot.label} classification is ${Math.round(document.classifyConfidence * 100)}%. Check the document type before continuing.`,
        documentId: document.id,
      });
    }

    const missingFields = EXPECTED_FIELDS[slot.type].filter((key) => !hasValue(document.id, key));
    if (slot.type === "benefit_letter" && !BENEFIT_AMOUNT_FIELDS.some((key) => hasValue(document.id, key))) {
      missingFields.push("benefit_amount");
    }
    if (missingFields.length > 0) {
      add({
        id: `missing-fields-${slot.type}-${document.id}`,
        tone: "warning",
        title: "Missing extracted fields",
        detail: `${slot.label}: ${missingFields.map(humanize).join(", ")}. Review or enter manually if needed.`,
        documentId: document.id,
      });
    }
  }

  const fileNames = new Map<string, DocumentRecord[]>();
  for (const document of documents) {
    const key = document.fileName.trim().toLowerCase();
    const group = fileNames.get(key) ?? [];
    group.push(document);
    fileNames.set(key, group);
  }
  for (const group of fileNames.values()) {
    if (group.length <= 1) continue;
    add({
      id: `duplicate-file-${group[0].fileName}`,
      tone: "warning",
      title: "Possible duplicate file",
      detail: `${group.length} uploads use the same file name: ${group[0].fileName}.`,
      documentId: group[0].id,
    });
  }

  const documentsByType = new Map<DocumentType, DocumentRecord[]>();
  for (const document of documents) {
    if (document.documentType === "unknown") continue;
    const group = documentsByType.get(document.documentType) ?? [];
    group.push(document);
    documentsByType.set(document.documentType, group);
  }
  for (const [type, group] of documentsByType) {
    if (group.length <= 1) continue;
    add({
      id: `duplicate-type-${type}`,
      tone: "warning",
      title: "Possible duplicate document type",
      detail: `${group.length} ${docLabel(type)} documents were uploaded. Check whether all are intended.`,
      documentId: group[0].id,
    });
  }

  const identityFields = fields.filter((field) => field.key === "person_name" && field.value.trim());
  const identities = new Map<string, ExtractedField[]>();
  for (const field of identityFields) {
    const key = normalizeIdentity(field.value);
    if (!key) continue;
    const group = identities.get(key) ?? [];
    group.push(field);
    identities.set(key, group);
  }
  if (identities.size > 1) {
    const names = [...identities.values()].map((group) => group[0].value);
    const firstField = [...identities.values()][0]?.[0];
    add({
      id: "name-mismatch",
      tone: "warning",
      title: "Applicant name mismatch",
      detail: `Different names detected: ${names.join(", ")}. Check that all documents belong to the same file.`,
      documentId: firstField?.documentId,
      fieldId: firstField?.id,
    });
  }

  for (const document of documents) {
    const documentFieldsForDoc = documentFields(document.id);
    if (document.extractionError) {
      add({
        id: `extraction-error-${document.id}`,
        tone: "danger",
        title: "Parser could not extract this document",
        detail: document.extractionError.includes("tesseract")
          ? "OCR is unavailable locally, so this scanned/rasterized document needs Tesseract or manual review."
          : document.extractionError,
        documentId: document.id,
      });
    }

    const lowFields = documentFieldsForDoc.filter((field) => field.confidence < LOW_CONFIDENCE);
    if (lowFields.length > 0) {
      add({
        id: `low-fields-${document.id}`,
        tone: "warning",
        title: "Low confidence fields",
        detail: `${docLabel(document.documentType)}: ${lowFields.map((field) => humanize(field.key)).join(", ")}.`,
        documentId: document.id,
        fieldId: lowFields[0].id,
      });
    }

    if (document.quarantinedText) {
      add({
        id: `quarantine-${document.id}`,
        tone: "danger",
        title: "Untrusted instruction detected",
        detail: "The parser quarantined adversarial or unrelated instruction text from this document.",
        documentId: document.id,
      });
    }

    const grossPay = readNumber(fieldByKey(document.id, "gross_pay")?.value);
    const hourlyRate = readNumber(fieldByKey(document.id, "hourly_rate")?.value);
    const regularHours = readNumber(fieldByKey(document.id, "regular_hours")?.value);
    const netPay = readNumber(fieldByKey(document.id, "net_pay")?.value);
    if (grossPay !== null && hourlyRate !== null && regularHours !== null) {
      const computedGross = hourlyRate * regularHours;
      const tolerance = Math.max(2, computedGross * 0.03);
      if (Math.abs(grossPay - computedGross) > tolerance) {
        add({
          id: `pay-total-${document.id}`,
          tone: "danger",
          title: "Pay stub total mismatch",
          detail: `Gross pay does not match hours × rate (${regularHours} × $${hourlyRate.toFixed(2)} ≈ $${computedGross.toFixed(2)}).`,
          documentId: document.id,
          fieldId: fieldByKey(document.id, "gross_pay")?.id,
        });
      }
    }
    if (grossPay !== null && netPay !== null && netPay > grossPay) {
      add({
        id: `net-over-gross-${document.id}`,
        tone: "danger",
        title: "Net pay exceeds gross pay",
        detail: "Net pay should not be higher than gross pay. Check the extraction.",
        documentId: document.id,
        fieldId: fieldByKey(document.id, "net_pay")?.id,
      });
    }

    const periodStart = readDate(fieldByKey(document.id, "pay_period_start")?.value);
    const periodEnd = readDate(fieldByKey(document.id, "pay_period_end")?.value);
    if (periodStart !== null && periodEnd !== null && periodStart > periodEnd) {
      add({
        id: `pay-period-order-${document.id}`,
        tone: "danger",
        title: "Pay period dates look reversed",
        detail: "Pay period start is after pay period end.",
        documentId: document.id,
        fieldId: fieldByKey(document.id, "pay_period_start")?.id,
      });
    }

    if (document.documentType === "employment_letter") {
      const dateField = fieldByKey(document.id, "document_date");
      const documentDate = readDate(dateField?.value);
      if (documentDate !== null && documentDate < Date.parse(CURRENCY_WINDOW_START)) {
        add({
          id: `employment-stale-${document.id}`,
          tone: "danger",
          title: "Employment letter may be stale",
          detail: "The document date is outside the 60-day currency window.",
          documentId: document.id,
          fieldId: dateField?.id,
        });
      }
    }

    if (document.documentType === "gig_statement" && hasValue(document.id, "gross_receipts")) {
      add({
        id: `gig-corroboration-${document.id}`,
        tone: "warning",
        title: "Gig income needs corroboration",
        detail: "Gig receipts are annualized, but should be reviewed against supporting evidence.",
        documentId: document.id,
        fieldId: fieldByKey(document.id, "gross_receipts")?.id,
      });
    }
  }

  return warnings;
}

export default function ProfileStep() {
  const c = useCopy();
  const docLabels = useDocLabels();
  const fieldLabel = useFieldLabel();
  const fieldExplain = useFieldExplain();
  const { guides: documentGuides, ui: guideCopy } = useDocumentGuides();
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

  const slots = useMemo(
    () => expectedSlots(docLabels),
    [
      docLabels.application_summary,
      docLabels.pay_stub,
      docLabels.employment_letter,
      docLabels.benefit_letter,
      docLabels.gig_statement,
      docLabels.unknown,
    ],
  );
  const [queuedFiles, setQueuedFiles] = useState<Partial<Record<DocumentType, File>>>({});
  const [slotDocumentIds, setSlotDocumentIds] = useState<Partial<Record<DocumentType, string>>>({});
  const [slotStatus, setSlotStatus] = useState<Partial<Record<DocumentType, SlotState>>>({});
  const [slotProgress, setSlotProgress] = useState<Partial<Record<DocumentType, number>>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(documents.length > 0);
  const [reviewDocumentId, setReviewDocumentId] = useState<string | null>(null);
  const [activeGuideType, setActiveGuideType] = useState<Exclude<DocumentType, "unknown"> | null>(null);
  const [index, setIndex] = useState(0);
  const [correcting, setCorrecting] = useState(false);
  const [draft, setDraft] = useState("");
  const fieldHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (documents.length > 0 && !isParsing) setReviewOpen(true);
  }, [documents.length, isParsing]);

  useEffect(() => {
    if (documents.length === 0) {
      setReviewDocumentId(null);
      setIndex(0);
      return;
    }
    if (!reviewDocumentId || !documents.some((document) => document.id === reviewDocumentId)) {
      setReviewDocumentId(documents[0]?.id ?? null);
      setIndex(0);
    }
  }, [documents, reviewDocumentId]);

  useEffect(() => {
    if (!pendingReviewFieldId) return;
    const requestedField = fields.find((item) => item.id === pendingReviewFieldId);
    if (requestedField) {
      const requestedFields = fields.filter((item) => item.documentId === requestedField.documentId);
      const requestedIndex = requestedFields.findIndex((item) => item.id === pendingReviewFieldId);
      setReviewOpen(true);
      setReviewDocumentId(requestedField.documentId);
      setCorrecting(false);
      setIndex(Math.max(0, requestedIndex));
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
  const labelForDocument = (document: DocumentRecord | undefined): string => {
    if (!document) return docLabels.unknown;
    const slot = slots.find((item) => slotDocumentIds[item.type] === document.id);
    return slot?.label ?? docLabels[document.documentType];
  };
  const canParse = Object.values(queuedFiles).some(Boolean) && !busy && !isParsing;

  const reviewDocuments = documents;
  const currentDocumentIndex = Math.max(
    0,
    reviewDocuments.findIndex((document) => document.id === reviewDocumentId),
  );
  const doc = reviewDocuments[currentDocumentIndex] ?? reviewDocuments[0];
  const nextDocument = reviewDocuments[currentDocumentIndex + 1];
  const reviewFields = doc ? fields.filter((item) => item.documentId === doc.id) : [];
  const safeIndex = Math.min(index, Math.max(0, reviewFields.length - 1));
  const field = reviewFields[safeIndex];
  const confirmedCount = reviewFields.filter((item) => item.reviewStatus !== "extracted").length;
  const currentDocumentConfirmed = reviewFields.every((item) => item.reviewStatus !== "extracted");
  const allDocumentsConfirmed = fields.every((item) => item.reviewStatus !== "extracted");
  const isLastReviewDocument = currentDocumentIndex >= reviewDocuments.length - 1;
  const canProceed = isLastReviewDocument
    ? allDocumentsConfirmed && reviewDocuments.length > 0
    : currentDocumentConfirmed;
  const proceedLabel =
    isLastReviewDocument || !nextDocument
      ? c.goUnderstand
      : fmt(c.goNextDocument, { name: labelForDocument(nextDocument) });
  const fieldStatusLabel = field
    ? field.reviewStatus === "extracted"
      ? c.stExtracted
      : field.reviewStatus === "corrected"
        ? c.stCorrected
        : c.stConfirmed
    : "";
  const consistencyWarnings = useMemo(
    () => buildConsistencyWarnings({ documents, fields, slots, slotDocumentIds }),
    [documents, fields, slots, slotDocumentIds],
  );
  const activeGuide = activeGuideType ? documentGuides[activeGuideType] : null;
  const orderedSlots = useMemo(() => {
    if (!activeGuideType) return slots;
    return [
      ...slots.filter((slot) => slot.type === activeGuideType),
      ...slots.filter((slot) => slot.type !== activeGuideType),
    ];
  }, [activeGuideType, slots]);

  const setSlotFile = (type: DocumentType, file: File | undefined) => {
    if (!file) return;
    setReviewOpen(false);
    setActiveGuideType(null);
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

    for (const slot of slots) {
      if (queuedFiles[slot.type]) continue;
      setSlotProgress((prev) => ({ ...prev, [slot.type]: 0 }));
      setSlotStatus((prev) => ({ ...prev, [slot.type]: slot.required ? "error" : "warning" }));
    }

    const uploadedSlots = slots.flatMap((slot) => {
      const file = queuedFiles[slot.type];
      return file ? [{ slot, file }] : [];
    });
    const parseResult = addFiles(uploadedSlots.map(({ file }) => file))
      .then((records) => ({ ok: true as const, records }))
      .catch(() => ({ ok: false as const, records: [] }));

    for (const { slot } of uploadedSlots) {
      setSlotStatus((prev) => ({ ...prev, [slot.type]: "parsing" }));
      setSlotProgress((prev) => ({ ...prev, [slot.type]: 0 }));
      window.requestAnimationFrame(() => {
        setSlotProgress((prev) => ({ ...prev, [slot.type]: 100 }));
      });
      await sleep(1000);
    }

    const result = await parseResult;
    let successCount = 0;
    let firstDocumentId: string | null = null;

    if (result.ok) {
      const nextSlotDocumentIds: Partial<Record<DocumentType, string>> = {};
      const nextStatuses: Partial<Record<DocumentType, SlotState>> = {};
      result.records.forEach((addedDocument, index) => {
        const slot = uploadedSlots[index]?.slot;
        if (!slot) return;
        if (addedDocument) {
          nextSlotDocumentIds[slot.type] = addedDocument.id;
          nextStatuses[slot.type] = "parsed";
          firstDocumentId ??= addedDocument.id;
          successCount += 1;
        } else {
          nextStatuses[slot.type] = "error";
        }
      });
      setSlotDocumentIds((prev) => ({ ...prev, ...nextSlotDocumentIds }));
      setSlotStatus((prev) => ({ ...prev, ...nextStatuses }));
    } else {
      setSlotStatus((prev) => {
        const next = { ...prev };
        for (const { slot } of uploadedSlots) next[slot.type] = "error";
        return next;
      });
    }

    setIsParsing(false);
    setReviewOpen(successCount > 0);
    setReviewDocumentId(firstDocumentId);
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
    if (field.reviewStatus === "extracted") confirmField(field.id);
    if (safeIndex < reviewFields.length - 1) go(safeIndex + 1);
  };

  const proceedReview = () => {
    if (!canProceed) return;
    if (!isLastReviewDocument && nextDocument) {
      setReviewDocumentId(nextDocument.id);
      setIndex(0);
      setCorrecting(false);
      window.requestAnimationFrame(() => {
        fieldHeadingRef.current?.focus({ preventScroll: true });
        reviewSectionRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }
    goToStep("understand");
  };

  const openConsistencyWarning = (warning: ConsistencyWarning) => {
    const targetField = warning.fieldId
      ? fields.find((item) => item.id === warning.fieldId)
      : undefined;
    const targetDocumentId = targetField?.documentId ?? warning.documentId;

    if (!targetDocumentId) {
      setReviewOpen(false);
      return;
    }

    const targetFields = fields.filter((item) => item.documentId === targetDocumentId);
    const targetIndex = targetField
      ? targetFields.findIndex((item) => item.id === targetField.id)
      : 0;

    setReviewOpen(true);
    setReviewDocumentId(targetDocumentId);
    setCorrecting(false);
    setIndex(Math.max(0, targetIndex));
    window.requestAnimationFrame(() => {
      fieldHeadingRef.current?.focus({ preventScroll: true });
      reviewSectionRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
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
        {orderedSlots.map((slot) => {
          const slotIndex = slots.findIndex((item) => item.type === slot.type);
          const file = queuedFiles[slot.type];
          const status = slotStatus[slot.type] ?? "empty";
          const progress = slotProgress[slot.type] ?? 0;
          const parsedDocument = documentForSlot(slot.type);
          const hasFile = Boolean(file) || Boolean(parsedDocument);
          const isDone = status === "parsed" || Boolean(parsedDocument);
          const isWarning = status === "warning";
          const isFocused = activeGuideType === slot.type;
          const isDimmed = Boolean(activeGuideType && activeGuideType !== slot.type);
          const isError =
            status === "error" ||
            (reviewOpen && slot.required && !parsedDocument);
          const statusLabel = isError
            ? "Needs attention"
            : isWarning
              ? "Optional not uploaded"
            : isDone
              ? "Parsed"
              : status === "parsing"
                ? "Parsing"
                  : hasFile
                  ? "Uploaded"
                  : "Not uploaded";

          return (
            <Fragment key={slot.type}>
            <article
              className={`${s.uploadSlot} ${hasFile ? s.uploadSlotHasFile : ""} ${
                isDone ? s.uploadSlotDone : ""
              } ${isWarning ? s.uploadSlotWarning : ""} ${isError ? s.uploadSlotError : ""} ${
                isFocused ? s.uploadSlotFocused : ""
              } ${isDimmed ? s.uploadSlotDimmed : ""}`}
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
                          ? ` · parsed as ${docLabels[parsedDocument.documentType]}`
                          : ""}
                      </p>
                    )}
                  </div>
                </div>

                <div className={s.uploadSlotActions}>
                  <button
                    type="button"
                    className={s.findDocumentButton}
                    title={fmt(guideCopy.findLabel, { name: slot.label })}
                    aria-label={fmt(guideCopy.findLabel, { name: slot.label })}
                    aria-expanded={activeGuideType === slot.type}
                    onClick={() =>
                      setActiveGuideType((prev) => (prev === slot.type ? null : slot.type))
                    }
                  >
                    ?
                  </button>
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
                      isError
                        ? s.uploadStatusAlert
                        : isWarning
                          ? s.uploadStatusWarning
                          : isDone
                            ? s.uploadStatusDone
                            : status === "parsing"
                              ? s.uploadStatusParsing
                              : hasFile
                                ? s.uploadStatusQueued
                                : ""
                    }`}
                    aria-label={statusLabel}
                    title={statusLabel}
                  >
                    {isError || isWarning ? "!" : isDone ? "✓" : status === "parsing" ? "…" : ""}
                  </span>
                </div>
              </div>
            </article>
            {isFocused && activeGuide && (
              <section
                className={`${s.documentGuideCard} ${s.documentGuideInline}`}
                aria-label={fmt(guideCopy.howToGet, { name: docLabels[slot.type] })}
              >
                <div className={s.documentGuideHeader}>
                  <div>
                    <p className={s.kicker}>{guideCopy.findDocument}</p>
                    <h3>{activeGuide.title}</h3>
                  </div>
                  <button
                    type="button"
                    className={s.documentGuideClose}
                    aria-label={guideCopy.closeGuide}
                    onClick={() => setActiveGuideType(null)}
                  >
                    ×
                  </button>
                </div>
                <p className={s.documentGuideIssuer}>
                  <strong>{guideCopy.whereToGetIt}:</strong> {activeGuide.issuer}
                </p>
                <p className={s.hint}>{activeGuide.summary}</p>
                <ol className={s.documentGuideSteps}>
                  {activeGuide.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <div className={s.documentGuideLinks}>
                  {activeGuide.links.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                      <span>{link.label} ↗</span>
                      {link.note && <small>{link.note}</small>}
                    </a>
                  ))}
                </div>
              </section>
            )}
            </Fragment>
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

              {consistencyWarnings.length > 0 && (
                <section className={s.warningPanel} aria-label="Upload consistency warnings">
                  <div className={s.warningPanelHead}>
                    <div>
                      <p className={s.warningEyebrow}>Warnings</p>
                      <h3>Consistency checks</h3>
                    </div>
                    <span>{consistencyWarnings.length}</span>
                  </div>
                  <ul className={s.warningList}>
                    {consistencyWarnings.map((warning) => (
                      <li
                        key={warning.id}
                        className={`${s.warningItem} ${
                          warning.tone === "danger" ? s.warningItemDanger : ""
                        }`}
                      >
                        <div>
                          <strong>{warning.title}</strong>
                          <span>{warning.detail}</span>
                        </div>
                        <button
                          type="button"
                          className={s.warningOpenButton}
                          onClick={() => openConsistencyWarning(warning)}
                        >
                          {warning.documentId || warning.fieldId ? "Open" : "Upload"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {field ? (
                <>
              <div className={s.fieldNavBar}>
                <div className={s.reviewMeta} aria-label="Review progress">
                  <span className={s.documentChip}>{labelForDocument(doc)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{fmt(c.documentOf, { n: currentDocumentIndex + 1, total: reviewDocuments.length })}</span>
                  <span aria-hidden="true">·</span>
                  <span>{fmt(c.fieldOf, { n: safeIndex + 1, total: reviewFields.length })}</span>
                  <span aria-hidden="true">·</span>
                  <span>{fmt(c.fieldsConfirmed, { n: confirmedCount, total: reviewFields.length })}</span>
                  <span
                    className={`${s.statusChip} ${
                      field.reviewStatus === "extracted" ? s.chipExtracted : s.chipConfirmed
                    }`}
                  >
                    {fieldStatusLabel}
                  </span>
                </div>
                <span className={s.navActions}>
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
                    {fieldLabel(field.key)}
                  </h3>
                  <p className={s.fieldExplain}>
                    <strong>{c.whyNeeded}: </strong>
                    {fieldExplain(field.key) ?? `${fieldLabel(field.key)} — ${docLabels[doc.documentType]}`}
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
                        {fieldLabel(field.key)}
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
                      <div className={s.actions}>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={confirmAndGoNext}
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
                </>
              ) : (
                <div className={s.reviewGrid}>
                  <div>
                    <h3 className={s.fieldKey} ref={fieldHeadingRef} tabIndex={-1}>
                      {labelForDocument(doc)}
                    </h3>
                    <p className={s.hint}>No extracted fields for this document yet.</p>
                  </div>
                  <DocumentPreview doc={doc} field={undefined} fields={[]} />
                </div>
              )}
              <div className={s.actions}>
                <button
                  type="button"
                  className={canProceed ? "primary-button" : "secondary-button"}
                  onClick={proceedReview}
                  disabled={!canProceed}
                >
                  {proceedLabel} →
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
