import type { DocumentRecord, ExtractedField, ReadinessResult } from "@/lib/pipeline/types";
import type { SafeUnderstandingContext } from "@/lib/ai/types";
import {
  centsToDollars,
  deriveIncomeSources,
  thresholdCentsForSize,
} from "@/lib/pipeline/calc";

type ContextInput = {
  documents: readonly DocumentRecord[];
  fields: readonly ExtractedField[];
  householdSize: number | null;
  householdSizeConfirmed: boolean;
  grossIncomeCents: number;
  missingRequired: readonly string[];
  readiness: ReadinessResult;
};

function confirmed(field: ExtractedField): boolean {
  return field.reviewStatus === "confirmed" ||
    field.reviewStatus === "corrected" ||
    field.reviewStatus === "renter_entered";
}

function safeEvidenceId(id: string): string {
  return id.replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 120);
}

export function buildSafeUnderstandingContext(input: ContextInput): SafeUnderstandingContext {
  const confirmedFields = input.fields.filter(confirmed);
  const evidence = confirmedFields.map((field) => ({
    evidenceId: safeEvidenceId(field.id),
    documentId: field.documentId,
    page: field.page,
    bbox: field.bbox,
    field: field.key,
  }));
  const evidenceByDocument = new Map<string, string[]>();
  for (const item of evidence) {
    evidenceByDocument.set(item.documentId, [...(evidenceByDocument.get(item.documentId) ?? []), item.evidenceId]);
  }

  // COUNTED sources only — same corroborated derivation as the UI total, so
  // the per-source sum always equals annualizedIncome (the server-side
  // integrity gate rejects the request otherwise).
  const incomeSources = deriveIncomeSources(input.documents, input.fields)
    .filter((source) => source.counted)
    .map((source) => ({
      field: source.key,
      periodAmount: centsToDollars(source.periodCents),
      frequency: source.frequency,
      annualAmount: centsToDollars(source.annualCents),
      evidenceRef: safeEvidenceId(source.fieldId),
    }));

  const thresholdCents = input.householdSizeConfirmed
    ? thresholdCentsForSize(input.householdSize)
    : null;
  const hasConfirmedIncome = incomeSources.length > 0;

  return {
    householdSize: input.householdSizeConfirmed ? input.householdSize : null,
    annualizedIncome: hasConfirmedIncome ? centsToDollars(input.grossIncomeCents) : null,
    frozenThreshold: thresholdCents === null ? null : centsToDollars(thresholdCents),
    comparison: !hasConfirmedIncome
      ? null
      : thresholdCents === null
        ? input.householdSizeConfirmed ? "no_frozen_threshold" : null
        : input.grossIncomeCents <= thresholdCents ? "below_or_equal" : "above",
    readinessStatus: input.readiness.status,
    documents: input.documents.map((document) => ({
      documentId: document.id,
      documentType: document.documentType,
    })),
    missingDocumentTypes: [...input.missingRequired],
    incomeSources,
    reviewReasons: input.readiness.reasons.map((reason) => ({
      code: reason.code,
      blocking: reason.blocking,
      documentId: reason.documentId ?? null,
      evidenceRefs: reason.documentId ? (evidenceByDocument.get(reason.documentId) ?? []).slice(0, 8) : [],
    })),
    evidence,
  };
}
