"use client";

// Profile: staged upload -> sequential parsing -> review. The user sees the
// expected documents before selecting files, then each rounded document card
// fills from left to right as parsing runs.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/pipeline/state";
import type { DocumentRecord, DocumentType, ExtractedField, NormBox, PayFrequency } from "@/lib/pipeline/types";
import { useCopy, fmt, type Copy } from "@/lib/pipeline/copy";
import { CURRENCY_WINDOW_START, LOW_CONFIDENCE } from "@/lib/pipeline/calc";
import { confidenceColor } from "@/lib/pipeline/confidence";
import { useDocumentGuides } from "@/lib/pipeline/documentGuides";
import { useDocLabels, useFieldExplain, useFieldLabel } from "@/lib/pipeline/labels";
import DocumentPreview from "./DocumentPreview";
import IncomeContributionChart from "./IncomeContributionChart";
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

const MISSING_FIELD_BOXES: Partial<Record<DocumentType, Record<string, NormBox>>> = {
  application_summary: {
    person_name: [0.06, 0.15, 0.34, 0.2],
    household_size: [0.58, 0.15, 0.79, 0.2],
    address: [0.06, 0.23, 0.55, 0.28],
    application_date: [0.06, 0.32, 0.34, 0.37],
  },
};

function placeholderBox(type: DocumentType, key: string, index: number): NormBox {
  const exact = MISSING_FIELD_BOXES[type]?.[key];
  if (exact) return exact;
  const top = Math.min(0.14 + index * 0.075, 0.8);
  return [0.08, top, 0.55, Math.min(top + 0.045, 0.9)];
}

function expectedKeysFor(type: DocumentType, documentFields: readonly ExtractedField[]): string[] {
  if (type === "unknown") return [];
  if (type !== "benefit_letter") return EXPECTED_FIELDS[type];
  const amountKey = BENEFIT_AMOUNT_FIELDS.find((key) =>
    documentFields.some((field) => field.key === key),
  );
  return [...EXPECTED_FIELDS.benefit_letter, amountKey ?? "monthly_benefit"];
}

function reviewFieldsForDocument(
  document: DocumentRecord,
  allFields: readonly ExtractedField[],
): ExtractedField[] {
  const documentFields = allFields.filter((field) => field.documentId === document.id);
  const expected = expectedKeysFor(document.documentType, documentFields);
  const used = new Set<string>();
  const ordered = expected.map((key, index) => {
    const extracted = documentFields.find((field) => field.key === key);
    if (extracted) {
      used.add(extracted.id);
      return extracted;
    }
    return {
      id: `missing:${document.id}:${key}`,
      documentId: document.id,
      key,
      value: "",
      page: 1,
      bbox: placeholderBox(document.documentType, key, index),
      confidence: 0,
      reviewStatus: "extracted" as const,
    };
  });
  return [...ordered, ...documentFields.filter((field) => !used.has(field.id))];
}

function manualIncomeOptions(
  document: DocumentRecord,
  field: ExtractedField,
  documentFields: readonly ExtractedField[],
): { isIncome?: boolean; incomeFrequency?: PayFrequency } {
  if (document.documentType === "pay_stub" && field.key === "gross_pay") {
    const raw = documentFields.find((item) => item.key === "pay_frequency")?.value;
    const candidate = raw?.toLowerCase().replace(/[^a-z]/g, "");
    const normalized = (["weekly", "biweekly", "semimonthly", "monthly", "annual"] as const)
      .find((frequency) => frequency === candidate);
    return { isIncome: Boolean(normalized), incomeFrequency: normalized };
  }
  const benefitFrequency = field.key.match(/^(weekly|biweekly|semimonthly|monthly|annual)_benefit$/)?.[1];
  if (document.documentType === "benefit_letter" && benefitFrequency) {
    return { isIncome: true, incomeFrequency: benefitFrequency as PayFrequency };
  }
  if (document.documentType === "gig_statement" && field.key === "gross_receipts") {
    return { isIncome: true, incomeFrequency: "monthly" };
  }
  return {};
}

function expectedSlots(labels: Record<DocumentType, string>, t: Copy): UploadSlot[] {
  return [
    {
      type: "application_summary",
      label: labels.application_summary,
      required: true,
      description: t.slotDescApplication,
    },
    {
      type: "pay_stub",
      label: labels.pay_stub,
      required: true,
      description: t.slotDescPayStub,
    },
    {
      type: "employment_letter",
      label: labels.employment_letter,
      required: true,
      description: t.slotDescEmployment,
    },
    {
      type: "benefit_letter",
      label: labels.benefit_letter,
      required: false,
      description: t.slotDescBenefit,
    },
    {
      type: "gig_statement",
      label: labels.gig_statement,
      required: false,
      description: t.slotDescGig,
    },
  ];
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
  t: Copy;
  docLabels: Record<DocumentType, string>;
  fieldLabel: (key: string) => string;
}): ConsistencyWarning[] {
  const { documents, fields, slots, slotDocumentIds, t, docLabels, fieldLabel } = args;
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
          title: fmt(t.wMissingRequiredTitle, { doc: slot.label }),
          detail: t.wMissingRequiredDetail,
          slotType: slot.type,
        });
      }
      continue;
    }

    if (document.documentType !== slot.type) {
      add({
        id: `type-mismatch-${slot.type}-${document.id}`,
        tone: "danger",
        title: t.wTypeMismatchTitle,
        detail: fmt(t.wTypeMismatchDetail, { slot: slot.label, parsed: docLabels[document.documentType] }),
        documentId: document.id,
      });
    }

    if (document.classifyConfidence < LOW_CONFIDENCE) {
      add({
        id: `low-classify-${document.id}`,
        tone: "warning",
        title: t.wLowDocTitle,
        detail: fmt(t.wLowDocDetail, { slot: slot.label, pct: Math.round(document.classifyConfidence * 100) }),
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
        title: t.wMissingFieldsTitle,
        detail: fmt(t.wMissingFieldsDetail, { slot: slot.label, list: missingFields.map(fieldLabel).join(", ") }),
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
      title: t.wDupFileTitle,
      detail: fmt(t.wDupFileDetail, { n: group.length, name: group[0].fileName }),
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
      title: t.wDupTypeTitle,
      detail: fmt(t.wDupTypeDetail, { n: group.length, doc: docLabels[type] }),
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
      title: t.wNameMismatchTitle,
      detail: fmt(t.wNameMismatchDetail, { names: names.join(", ") }),
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
        title: t.wExtractErrorTitle,
        detail: document.extractionError.includes("tesseract")
          ? t.wExtractErrorOcr
          : document.extractionError,
        documentId: document.id,
      });
    }

    const lowFields = documentFieldsForDoc.filter((field) => field.confidence < LOW_CONFIDENCE);
    if (lowFields.length > 0) {
      add({
        id: `low-fields-${document.id}`,
        tone: "warning",
        title: t.wLowFieldsTitle,
        detail: fmt(t.wLowFieldsDetail, { doc: docLabels[document.documentType], list: lowFields.map((field) => fieldLabel(field.key)).join(", ") }),
        documentId: document.id,
        fieldId: lowFields[0].id,
      });
    }

    if (document.quarantinedText) {
      add({
        id: `quarantine-${document.id}`,
        tone: "danger",
        title: t.wQuarantineTitle,
        detail: t.wQuarantineDetail,
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
          title: t.wPayTotalTitle,
          detail: fmt(t.wPayTotalDetail, {
            hours: regularHours,
            rate: `$${hourlyRate.toFixed(2)}`,
            total: `$${computedGross.toFixed(2)}`,
          }),
          documentId: document.id,
          fieldId: fieldByKey(document.id, "gross_pay")?.id,
        });
      }
    }
    if (grossPay !== null && netPay !== null && netPay > grossPay) {
      add({
        id: `net-over-gross-${document.id}`,
        tone: "danger",
        title: t.wNetOverTitle,
        detail: t.wNetOverDetail,
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
        title: t.wPeriodOrderTitle,
        detail: t.wPeriodOrderDetail,
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
          title: t.wEmploymentStaleTitle,
          detail: t.wEmploymentStaleDetail,
          documentId: document.id,
          fieldId: dateField?.id,
        });
      }
    }

    if (document.documentType === "gig_statement" && hasValue(document.id, "gross_receipts")) {
      add({
        id: `gig-corroboration-${document.id}`,
        tone: "warning",
        title: t.wGigTitle,
        detail: t.wGigDetail,
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
    addManualField,
    confirmField,
    editFieldForReview,
    goToStep,
    pendingReviewFieldId,
    clearReviewRequest,
  } = useApp();

  const slots = useMemo(
    () => expectedSlots(docLabels, c),
    [
      c,
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
  const [parseFailed, setParseFailed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(documents.length > 0);
  const [reviewDocumentId, setReviewDocumentId] = useState<string | null>(null);
  const [activeGuideType, setActiveGuideType] = useState<Exclude<DocumentType, "unknown"> | null>(null);
  const [index, setIndex] = useState(0);
  const [correcting, setCorrecting] = useState(false);
  const [draft, setDraft] = useState("");
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const fieldHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!reviewFeedback) return;
    const timer = window.setTimeout(() => setReviewFeedback(null), 1400);
    return () => window.clearTimeout(timer);
  }, [reviewFeedback]);

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
  const canParse = Object.values(queuedFiles).some(Boolean) && !busy && !isParsing;

  const reviewDocuments = documents;
  const currentDocumentIndex = Math.max(
    0,
    reviewDocuments.findIndex((document) => document.id === reviewDocumentId),
  );
  const doc = reviewDocuments[currentDocumentIndex] ?? reviewDocuments[0];
  const nextDocument = reviewDocuments[currentDocumentIndex + 1];
  const reviewFields = doc ? reviewFieldsForDocument(doc, fields) : [];
  const safeIndex = Math.min(index, Math.max(0, reviewFields.length - 1));
  const field = reviewFields[safeIndex];
  const needsConfirmation = (item: ExtractedField) =>
    item.reviewStatus === "extracted" || item.reviewStatus === "edited";
  const confirmedCount = reviewFields.filter((item) => !needsConfirmation(item)).length;
  const currentDocumentConfirmed = reviewFields.every((item) => !needsConfirmation(item));
  const allDocumentsConfirmed = reviewDocuments.every((document) =>
    reviewFieldsForDocument(document, fields).every((item) => !needsConfirmation(item)),
  );
  const isLastReviewDocument = currentDocumentIndex >= reviewDocuments.length - 1;
  const canProceed = isLastReviewDocument
    ? allDocumentsConfirmed && reviewDocuments.length > 0
    : currentDocumentConfirmed;
  const proceedLabel = isLastReviewDocument || !nextDocument ? c.goUnderstand : c.goNextDocument;
  const fieldIsMissing = Boolean(field?.id.startsWith("missing:"));
  const fieldStatusLabel = field
    ? fieldIsMissing
      ? c.parameterNotPresent
      : field.reviewStatus === "extracted" || field.reviewStatus === "edited"
      ? c.stExtracted
      : field.reviewStatus === "corrected"
        ? c.stCorrected
        : field.reviewStatus === "renter_entered"
          ? c.stRenterEntered
          : c.stConfirmed
    : "";
  const consistencyWarnings = useMemo(
    () => buildConsistencyWarnings({ documents, fields, slots, slotDocumentIds, t: c, docLabels, fieldLabel }),
    [documents, fields, slots, slotDocumentIds, c, docLabels, fieldLabel],
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
    setParseFailed(false);
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

    const animateProgress = (type: DocumentType) =>
      new Promise<void>((resolve) => {
        const duration = 1000;
        const startedAt = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(100, ((now - startedAt) / duration) * 100);
          setSlotProgress((prev) => ({ ...prev, [type]: progress }));
          if (progress < 100) window.requestAnimationFrame(tick);
          else resolve();
        };
        window.requestAnimationFrame(tick);
      });

    for (const { slot } of uploadedSlots) {
      setSlotStatus((prev) => ({ ...prev, [slot.type]: "parsing" }));
      setSlotProgress((prev) => ({ ...prev, [slot.type]: 0 }));
      await animateProgress(slot.type);
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
      setParseFailed(true);
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
    setCorrectError(null);
    setCorrecting(true);
  };

  const go = (next: number) => {
    setCorrecting(false);
    setCorrectError(null);
    setIndex(next);
  };

  const confirmAndGoNext = () => {
    if (!field) return;
    if (!needsConfirmation(field)) return;
    confirmField(field.id);
    setReviewFeedback(`✓ ${c.stConfirmed}`);
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
          aria-label={c.wAriaStartParsing}
        >
          <span aria-hidden="true" />
        </button>
      </div>

      {parseFailed && (
        <p className={s.parseFailedBanner} role="alert">
          {c.wParseFailed}
        </p>
      )}

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
            <section className={s.card} aria-label={c.wAriaReviewer} ref={reviewSectionRef}>
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
                <section className={s.warningPanel} aria-label={c.wAriaPanel}>
                  <div className={s.warningPanelHead}>
                    <div>
                      <p className={s.warningEyebrow}>{c.wEyebrow}</p>
                      <h3>{c.wTitle}</h3>
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
                          {warning.documentId || warning.fieldId ? c.wOpen : c.wUpload}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {field ? (
                <>
              <div className={s.fieldNavBar}>
                <div className={s.reviewMeta} aria-label={c.wAriaProgress}>
                  <span>{fmt(c.fieldOf, { n: safeIndex + 1, total: reviewFields.length })}</span>
                  <span aria-hidden="true">·</span>
                  <span>{fmt(c.fieldsConfirmed, { n: confirmedCount, total: reviewFields.length })}</span>
                  <span
                    className={`${s.statusChip} ${
                      needsConfirmation(field) ? s.chipExtracted : s.chipConfirmed
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
                        aria-invalid={correctError ? true : undefined}
                        aria-describedby={correctError ? "correct-error" : undefined}
                        onChange={(event) => {
                          setDraft(event.target.value);
                          setCorrectError(null);
                        }}
                        autoFocus
                      />
                      {correctError && (
                        <p id="correct-error" className={s.correctError} role="alert">
                          {correctError}
                        </p>
                      )}
                      <div className={s.actions}>
                        <button
                          type="button"
                          className={`primary-button ${s.reviewActionButton}`}
                          onClick={() => {
                            const trimmed = draft.trim();
                            if (fieldIsMissing && !trimmed) {
                              setCorrectError(c.valueRequired);
                              return;
                            }
                            // Money/number fields must never go negative (the math
                            // layer rejects negatives by design — validate here).
                            const numericKey =
                              field.isIncome ||
                              /_benefit$/.test(field.key) ||
                              [
                                "gross_pay", "hourly_rate", "regular_hours", "weekly_hours",
                                "gross_receipts", "household_size", "net_pay", "platform_fees",
                                "declared_income", "monthly_benefit",
                              ].includes(field.key);
                            if (numericKey) {
                              const parsed = Number(trimmed.replace(/[^0-9.-]/g, ""));
                              if (Number.isFinite(parsed) && parsed < 0) {
                                setCorrectError(c.errNegative);
                                return;
                              }
                            }
                            if (fieldIsMissing) {
                              addManualField(doc.id, field.key, trimmed, {
                                ...manualIncomeOptions(doc, field, reviewFields),
                                bbox: field.bbox,
                                page: field.page,
                                requiresConfirmation: true,
                              });
                            } else {
                              editFieldForReview(field.id, trimmed);
                            }
                            setReviewFeedback(`✓ ${fieldIsMissing ? c.stRenterEntered : c.stCorrected}`);
                            setCorrecting(false);
                            setCorrectError(null);
                          }}
                        >
                          {c.saveCorrection}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setCorrecting(false);
                            setCorrectError(null);
                          }}
                        >
                          {c.cancel}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className={`${s.fieldValue} ${fieldIsMissing ? s.fieldValueMissing : ""}`} aria-live="polite">
                        {fieldIsMissing ? c.parameterNotPresent : field.value}
                      </p>
                      <div className={s.actions}>
                        {fieldIsMissing ? (
                          <button type="button" className={`primary-button ${s.reviewActionButton}`} onClick={startCorrect}>
                            {c.insertManually}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={`primary-button ${s.reviewActionButton}`}
                              onClick={confirmAndGoNext}
                              disabled={!needsConfirmation(field)}
                            >
                              {c.confirm}
                            </button>
                            <button type="button" className={`secondary-button ${s.reviewActionButton}`} onClick={startCorrect}>
                              {c.correct}
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                  {reviewFeedback && (
                    <p className={s.reviewFeedback} role="status" aria-live="polite">
                      {reviewFeedback}
                    </p>
                  )}
                  <IncomeContributionChart activeDocumentId={doc.id} />
                </div>

                <DocumentPreview
                  doc={doc}
                  field={field}
                  fields={reviewFields}
                />
              </div>
                </>
              ) : (
                <div className={s.reviewGrid}>
                  <div>
                    <h3 className={s.fieldKey} ref={fieldHeadingRef} tabIndex={-1}>
                      {c.wAriaReviewer}
                    </h3>
                    <p className={s.hint}>{c.wNoFields}</p>
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
