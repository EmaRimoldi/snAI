// Core pipeline types. These mirror the organizer schemas (document_gold /
// submission) plus two product-only fields the gold data doesn't carry:
// `confidence` and a review `status`. No eligibility concepts exist here — by design.

export type DocumentType =
  | "application_summary"
  | "pay_stub"
  | "employment_letter"
  | "benefit_letter"
  | "gig_statement"
  | "unknown";

export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly" | "annual";

export type FieldReviewStatus = "extracted" | "confirmed" | "corrected" | "renter_entered";

/** Normalized bounding box, top-left origin, each value in [0,1] of the page. */
export type NormBox = readonly [number, number, number, number];

export type ExtractedField = {
  id: string;
  documentId: string;
  key: string; // allowlisted field name, e.g. "gross_pay"
  value: string; // string form; parsed in calc
  page: number;
  bbox: NormBox;
  confidence: number; // 0..1
  reviewStatus: FieldReviewStatus;
  // Income modelling (only for income-bearing fields):
  isIncome?: boolean;
  incomeFrequency?: PayFrequency;
};

export type DocumentRecord = {
  id: string;
  fileName: string;
  fileUrl: string; // object URL (client) or storage signed URL
  mimeType: string;
  documentType: DocumentType;
  classifyConfidence: number;
  pageCount: number;
  /** Untrusted / injected text found in the document — quarantined, never a field. */
  quarantinedText?: string;
};

export type Comparison = "below_or_equal" | "above" | "no_frozen_threshold";
export type ReadinessStatus = "READY_TO_REVIEW" | "NEEDS_REVIEW";

export type ReviewReasonCode =
  | "PAY_STUB_TOTAL_CONFLICT"
  | "GIG_INCOME_UNCORROBORATED"
  | "EMPLOYMENT_LETTER_EXPIRED"
  | "UNCONFIRMED_FIELDS"
  | "LOW_CONFIDENCE_FIELDS"
  | "MISSING_REQUIRED_DOCUMENT";

export type ReviewReason = {
  code: ReviewReasonCode;
  blocking: boolean;
  documentId?: string;
  detail?: string; // e.g. a doc-type name; never document contents
};

export type Citation =
  | { kind: "document"; documentId: string; fileName: string; page: number; bbox: NormBox }
  | { kind: "rule"; ruleId: string; sourceLocator: string; effectiveDate: string | null };

/** Matches the organizer submission.schema.json. */
export type Submission = {
  household_id: string;
  annualized_income: number; // whole dollars with cents, e.g. 56316.00
  comparison: Comparison;
  readiness_status: ReadinessStatus;
  citations: Citation[];
};

export type ReadinessResult = {
  status: ReadinessStatus;
  reasons: ReviewReason[];
};
