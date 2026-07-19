// HTTP adapter for the real RealDoor engine (engine/server.py, uvicorn :8787).
// Opt in with NEXT_PUBLIC_ENGINE=http://127.0.0.1:8787 — the mock stays the
// default so the deployed site works standalone.
//
// This module is ALSO the single shared bbox-conversion point (CLAUDE.md §7):
// the engine emits (x1, y1, x2, y2) in PDF points with a BOTTOM-LEFT origin;
// the UI's NormBox is (x1, yTop, x2, yBottom) normalized 0..1 with a TOP-LEFT
// origin. All conversions must go through engineBoxToNormBox().

import type {
  DocumentType,
  ExtractedField,
  NormBox,
  PayFrequency,
} from "@/lib/pipeline/types";
import type { ClassifyResult, ExtractResult } from "@/lib/engine/extract";

type EngineField = {
  field: string;
  value: unknown;
  page: number;
  bbox: [number, number, number, number];
  confidence?: number;
  source?: string;
};

type EngineDocument = {
  document_id: string;
  document_type: string;
  file_name: string;
  page_size_points?: [number, number];
  contains_adversarial_text?: boolean | null;
  fields: EngineField[];
};

const DOC_TYPES: readonly DocumentType[] = [
  "application_summary",
  "pay_stub",
  "employment_letter",
  "benefit_letter",
  "gig_statement",
];

const QUARANTINE_FIELD = "untrusted_instruction_text";

/** Bottom-left-origin PDF points -> top-left-origin normalized box (§7). */
export function engineBoxToNormBox(
  bbox: [number, number, number, number],
  pageSizePoints: [number, number],
): NormBox {
  const [width, height] = pageSizePoints;
  const [x1, y1, x2, y2] = bbox;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clamp(x1 / width),
    clamp((height - y2) / height),
    clamp(x2 / width),
    clamp((height - y1) / height),
  ];
}

function normalizeFrequency(raw: unknown): PayFrequency | undefined {
  const value = String(raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (value === "weekly") return "weekly";
  if (value === "biweekly") return "biweekly";
  if (value === "semimonthly") return "semimonthly";
  if (value === "monthly") return "monthly";
  if (value === "annual" || value === "annually" || value === "yearly") return "annual";
  return undefined;
}

/** Which extracted field carries income for each document type, and where
 *  its frequency comes from. Abstain (no income flag) when the frequency
 *  cannot be read — the renter can still correct it. */
function incomeFrequencyFor(
  doc: EngineDocument,
  fieldName: string,
): PayFrequency | undefined {
  const fieldValue = (name: string) =>
    doc.fields.find((f) => f.field === name)?.value;
  if (doc.document_type === "pay_stub" && fieldName === "gross_pay") {
    return normalizeFrequency(fieldValue("pay_frequency"));
  }
  // The engine names the benefit amount by its frequency (monthly_benefit,
  // annual_benefit, weekly_benefit, …) — any of them is the income field.
  const benefitMatch = fieldName.match(/^(weekly|biweekly|semimonthly|monthly|annual)_benefit$/);
  if (doc.document_type === "benefit_letter" && benefitMatch) {
    return (
      normalizeFrequency(fieldValue("benefit_frequency")) ??
      (benefitMatch[1] as PayFrequency)
    );
  }
  if (doc.document_type === "gig_statement" && fieldName === "gross_receipts") {
    return "monthly"; // §5: gig gross_receipts × 12
  }
  return undefined;
}

function toDocumentType(raw: string): DocumentType {
  return (DOC_TYPES as readonly string[]).includes(raw)
    ? (raw as DocumentType)
    : "unknown";
}

// classifyDocument(file) runs the real extraction once; extractFields() only
// receives the file NAME, so the parsed record is cached here in between.
const pending = new Map<string, EngineDocument>();

export async function httpClassify(baseUrl: string, file: File): Promise<ClassifyResult> {
  const body = new FormData();
  body.append("files", file, file.name);
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/extract`, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    throw new Error(`engine /extract failed (${response.status})`);
  }
  const artifact = (await response.json()) as { documents: EngineDocument[] };
  const doc = artifact.documents[0];
  if (!doc) throw new Error("engine returned no document");
  pending.set(file.name, doc);

  const confidences = doc.fields
    .filter((f) => f.field !== QUARANTINE_FIELD)
    .map((f) => f.confidence ?? 1);
  const confidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0.9;
  return { documentType: toDocumentType(doc.document_type), confidence };
}

export function httpExtract(doc: {
  id: string;
  fileName: string;
  documentType: DocumentType;
}): ExtractResult {
  const record = pending.get(doc.fileName);
  if (!record) {
    throw new Error(`no extraction cached for ${doc.fileName} — classify first`);
  }
  pending.delete(doc.fileName);

  const pageSize = record.page_size_points ?? [612, 792];
  const quarantined = record.fields.find((f) => f.field === QUARANTINE_FIELD);

  const fields: ExtractedField[] = record.fields
    .filter((f) => f.field !== QUARANTINE_FIELD)
    .map((f) => ({
      id: `${doc.id}:${f.field}`,
      documentId: doc.id,
      key: f.field,
      value: String(f.value ?? ""),
      page: f.page,
      bbox: engineBoxToNormBox(f.bbox, pageSize),
      confidence: Math.min(1, Math.max(0, f.confidence ?? 1)),
      reviewStatus: "extracted",
      isIncome: incomeFrequencyFor(record, f.field) !== undefined,
      incomeFrequency: incomeFrequencyFor(record, f.field),
    }));

  return {
    fields,
    quarantinedText: quarantined ? String(quarantined.value ?? "") : undefined,
  };
}
