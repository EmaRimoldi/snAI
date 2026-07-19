// Deterministic challenge math — ported from the starter pack's calculate.py.
// NOT an eligibility engine: it annualizes income, compares to a published
// threshold, and derives file-level readiness. Money is handled in INTEGER CENTS
// (never floats) to keep the math exact.

import type {
  DocumentRecord,
  DocumentType,
  ExtractedField,
  Comparison,
  DisplayStatus,
  ReadinessResult,
  ReviewReason,
  ReviewReasonCode,
} from "@/lib/pipeline/types";
import type { PayFrequency } from "@/lib/pipeline/types";
import { thresholdForSize } from "@/lib/data/mtsp2026";

export const FREQUENCY: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
  annual: 1,
};

/** Event/"today" date for the challenge; the 60-day currency window ends here. */
export const EVENT_DATE = "2026-07-18";
export const CURRENCY_WINDOW_START = "2026-05-19"; // >= this is "current"
const LOW_CONFIDENCE = 0.75;

/** Parse a dollar string/number into integer cents (rounded). */
export function toCents(dollars: string | number): number {
  const n = typeof dollars === "number" ? dollars : Number(String(dollars).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Annualize an amount (in cents) by its pay frequency; rejects unknown freq / negatives. */
export function annualizeCents(amountCents: number, frequency: PayFrequency): number {
  const mult = FREQUENCY[frequency];
  if (mult === undefined) throw new Error(`Unsupported frequency: ${frequency}`);
  if (amountCents < 0) throw new Error("Amount must be non-negative");
  return amountCents * mult;
}

/** Inclusive boundary: <= threshold => below_or_equal (pinned by the organizer test). */
export function compareToThreshold(annualCents: number, thresholdCents: number | null): Comparison {
  if (thresholdCents === null) return "no_frozen_threshold";
  return annualCents <= thresholdCents ? "below_or_equal" : "above";
}

export function thresholdCentsForSize(size: number | null): number | null {
  if (size === null) return null;
  const dollars = thresholdForSize(size);
  return dollars === null ? null : dollars * 100;
}

export function formatMoneyCents(cents: number, locale: string = "en-US"): string {
  return (cents / 100).toLocaleString(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Plain number with 2 decimals (for submission.json annualized_income). */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/** One documented income source in the formula breakdown. `counted: false`
 *  means it corroborates an already-counted source and is NOT added (§8). */
export type IncomeSourceEntry = {
  fieldId: string;
  documentId: string;
  key: string;
  documentType: DocumentType;
  periodCents: number;
  frequency: PayFrequency;
  annualCents: number;
  counted: boolean;
};

/**
 * Derive the income sources from CONFIRMED/CORRECTED fields only.
 * Domain law (§8): multiple pay stubs from the same recurring wage source
 * corroborate — the stub with the latest pay_date is counted once, the others
 * confirm it. Benefit letters and gig statements each stand on their own
 * (gig receipts are monthly, ×12).
 */
export function deriveIncomeSources(
  documents: readonly DocumentRecord[],
  fields: readonly ExtractedField[],
): IncomeSourceEntry[] {
  const resolvedIncome = fields.filter((f) => f.isIncome && isResolved(f));
  const docType = (id: string): DocumentType =>
    documents.find((d) => d.id === id)?.documentType ?? "unknown";

  // Wages: pick the pay stub with the latest confirmed pay_date as THE source.
  const stubs = resolvedIncome.filter((f) => docType(f.documentId) === "pay_stub");
  const payDate = (f: ExtractedField): number => {
    const raw = fields.find((x) => x.documentId === f.documentId && x.key === "pay_date")?.value;
    const parsed = Date.parse(raw ?? "");
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const countedStubId =
    stubs.length > 0 ? [...stubs].sort((a, b) => payDate(b) - payDate(a))[0].id : undefined;

  // §8: a stub's recurring basis is regular_hours × hourly_rate when both are
  // confirmed (the internally consistent figure — on a printed-total conflict
  // this basis wins, never the printed gross, never an average or max).
  // Stubs without hours/rate fall back to the printed gross.
  const stubBasisCents = (f: ExtractedField): number => {
    const rate = fields.find((x) => x.documentId === f.documentId && x.key === "hourly_rate");
    const hours = fields.find((x) => x.documentId === f.documentId && x.key === "regular_hours");
    if (rate && hours && isResolved(rate) && isResolved(hours)) {
      const hoursNum = Number(hours.value);
      const rateCents = toCents(rate.value);
      if (Number.isFinite(hoursNum) && hoursNum > 0 && rateCents > 0) {
        return Math.round(rateCents * hoursNum);
      }
    }
    return toCents(f.value);
  };

  const entries: IncomeSourceEntry[] = [];
  for (const f of resolvedIncome) {
    const documentType = docType(f.documentId);
    const frequency = f.incomeFrequency ?? "monthly";
    const periodCents = documentType === "pay_stub" ? stubBasisCents(f) : toCents(f.value);
    // Defense in depth: a negative/unparseable amount is invalid input, never a
    // source (the UI also rejects negative corrections at the boundary) — and
    // it must never reach annualizeCents, which throws on negatives.
    if (periodCents < 0) continue;
    const counted = documentType !== "pay_stub" || f.id === countedStubId;
    entries.push({
      fieldId: f.id,
      documentId: f.documentId,
      key: f.key,
      documentType,
      periodCents,
      frequency,
      annualCents: annualizeCents(periodCents, frequency),
      counted,
    });
  }

  // No pay stub at all: an employment letter's confirmed weekly_hours ×
  // hourly_rate stands as the recurring wage source (weekly). With stubs
  // present the letter only corroborates — it is never added on top.
  if (stubs.length === 0) {
    const letterDocs = documents.filter((d) => d.documentType === "employment_letter");
    const letterDate = (docId: string): number => {
      const raw = fields.find((x) => x.documentId === docId && x.key === "document_date")?.value;
      const parsed = Date.parse(raw ?? "");
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const candidates = letterDocs
      .map((d) => {
        const hours = fields.find(
          (x) => x.documentId === d.id && x.key === "weekly_hours" && isResolved(x),
        );
        const rate = fields.find(
          (x) => x.documentId === d.id && x.key === "hourly_rate" && isResolved(x),
        );
        return hours && rate ? { doc: d, hours, rate } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => letterDate(b.doc.id) - letterDate(a.doc.id));
    const pick = candidates[0];
    if (pick) {
      const hoursNum = Number(pick.hours.value);
      const rateCents = toCents(pick.rate.value);
      if (Number.isFinite(hoursNum) && hoursNum > 0 && rateCents > 0) {
        const periodCents = Math.round(rateCents * hoursNum);
        entries.push({
          fieldId: pick.hours.id,
          documentId: pick.doc.id,
          key: "letter_wage",
          documentType: "employment_letter",
          periodCents,
          frequency: "weekly",
          annualCents: annualizeCents(periodCents, "weekly"),
          counted: true,
        });
      }
    }
  }

  return entries;
}

/** Gross annual income (cents): the sum of COUNTED sources only. */
export function computeGrossAnnualCents(
  documents: readonly DocumentRecord[],
  fields: readonly ExtractedField[],
): number {
  return deriveIncomeSources(documents, fields)
    .filter((s) => s.counted)
    .reduce((sum, s) => sum + s.annualCents, 0);
}

function isExpired(dateStr: string): boolean {
  // "current" if dated on/after the 60-day window start (challenge convention).
  // A "YYYY-MM" statement month counts as its LAST covered day (engine parity).
  const text = dateStr.trim();
  let d: number;
  if (/^\d{4}-\d{2}$/.test(text)) {
    const year = Number(text.slice(0, 4));
    const month = Number(text.slice(5, 7));
    d = Date.UTC(year, month, 0); // day 0 of next month = last day of `month`
  } else {
    d = Date.parse(text);
  }
  if (Number.isNaN(d)) return false;
  return d < Date.parse(CURRENCY_WINDOW_START);
}

function isResolved(f: ExtractedField): boolean {
  return f.reviewStatus === "confirmed" || f.reviewStatus === "corrected" || f.reviewStatus === "renter_entered";
}

/**
 * File-level readiness. Blocking codes drive the status; missing documents are
 * informational (they raise Errors but do not block) — per CLAUDE.md §6.
 */
export function computeReadiness(
  documents: readonly DocumentRecord[],
  fields: readonly ExtractedField[],
  missingRequired: readonly string[],
  householdSize: number | null,
): ReadinessResult {
  const reasons: ReviewReason[] = [];

  // Evidence checks run on CONFIRMED values only — an unconfirmed extraction is
  // "pending", not yet an inconsistency. Once the renter confirms (or corrects)
  // the involved values, the checks below fire independently of the rest.

  // Frozen 60-day currency convention over EVERY dated evidence document
  // (mirrors the engine's DATE_FIELD map; one reason per expired code).
  const DATE_FIELD: Partial<Record<DocumentType, string>> = {
    employment_letter: "document_date",
    benefit_letter: "document_date",
    pay_stub: "pay_date",
    gig_statement: "statement_month",
  };
  const EXPIRED_CODE: Partial<Record<DocumentType, ReviewReasonCode>> = {
    employment_letter: "EMPLOYMENT_LETTER_EXPIRED",
    benefit_letter: "BENEFIT_LETTER_EXPIRED",
    pay_stub: "PAY_STUB_EXPIRED",
    gig_statement: "GIG_STATEMENT_EXPIRED",
  };
  const expiredSeen = new Set<ReviewReasonCode>();
  for (const doc of documents) {
    const dateKey = DATE_FIELD[doc.documentType];
    const code = EXPIRED_CODE[doc.documentType];
    if (!dateKey || !code || expiredSeen.has(code)) continue;
    const dateField = fields.find((f) => f.documentId === doc.id && f.key === dateKey);
    if (dateField && isResolved(dateField) && isExpired(dateField.value)) {
      expiredSeen.add(code);
      reasons.push({ code, blocking: true, documentId: doc.id });
    }
  }

  // Gig income corroboration — flagged once its receipts are confirmed.
  for (const doc of documents) {
    if (doc.documentType !== "gig_statement") continue;
    const receipts = fields.find((f) => f.documentId === doc.id && f.key === "gross_receipts");
    if (receipts && isResolved(receipts)) {
      reasons.push({ code: "GIG_INCOME_UNCORROBORATED", blocking: true, documentId: doc.id });
    }
  }

  // Employer letter corroborates the RATE: a confirmed letter rate differing
  // from every confirmed stub rate (beyond a cent) is a conflict; differing
  // hours are just an approximate schedule, never a conflict.
  const stubRates = documents
    .filter((d) => d.documentType === "pay_stub")
    .map((d) => fields.find((f) => f.documentId === d.id && f.key === "hourly_rate"))
    .filter((f): f is ExtractedField => Boolean(f && isResolved(f)))
    .map((f) => toCents(f.value))
    .filter((cents) => cents > 0);
  const letterRateField = documents
    .filter((d) => d.documentType === "employment_letter")
    .map((d) => fields.find((f) => f.documentId === d.id && f.key === "hourly_rate"))
    .find((f) => f && isResolved(f));
  if (letterRateField && stubRates.length > 0) {
    const letterRate = toCents(letterRateField.value);
    if (letterRate > 0 && stubRates.every((r) => Math.abs(r - letterRate) > 1)) {
      reasons.push({
        code: "EMPLOYMENT_RATE_CONFLICT",
        blocking: true,
        documentId: letterRateField.documentId,
      });
    }
  }

  // Self-declared amounts are never counted as documented income.
  for (const doc of documents) {
    if (doc.documentType !== "application_summary") continue;
    const declared = fields.find((f) => f.documentId === doc.id && f.key === "declared_income");
    if (declared && isResolved(declared)) {
      reasons.push({ code: "UNVERIFIED_INCOME_CLAIM", blocking: true, documentId: doc.id });
    }
  }

  // Threshold applicability + income evidence — only once nothing is pending,
  // so "not confirmed yet" is never mislabelled as "missing".
  const nothingPending = documents.length > 0 && fields.every((f) => isResolved(f));
  if (nothingPending) {
    if (householdSize === null) {
      reasons.push({ code: "MISSING_HOUSEHOLD_SIZE", blocking: true });
    } else if (thresholdForSize(householdSize) === null) {
      reasons.push({ code: "NO_FROZEN_THRESHOLD", blocking: true });
    }
    const counted = deriveIncomeSources(documents, fields).some((s) => s.counted);
    if (!counted) {
      reasons.push({ code: "MISSING_INCOME_EVIDENCE", blocking: true });
    }
  }

  // Pay-stub internal conflict: stated gross vs hourly_rate * regular_hours,
  // once all three values are confirmed.
  for (const doc of documents) {
    if (doc.documentType !== "pay_stub") continue;
    const gross = fields.find((f) => f.documentId === doc.id && f.key === "gross_pay");
    const rate = fields.find((f) => f.documentId === doc.id && f.key === "hourly_rate");
    const hours = fields.find((f) => f.documentId === doc.id && f.key === "regular_hours");
    if (gross && rate && hours && isResolved(gross) && isResolved(rate) && isResolved(hours)) {
      const stated = toCents(gross.value);
      const computed = Math.round(toCents(rate.value) * Number(hours.value)) / 1; // cents
      if (stated !== computed) {
        reasons.push({ code: "PAY_STUB_TOTAL_CONFLICT", blocking: true, documentId: doc.id });
      }
    }
  }

  // Unresolved / low-confidence extracted fields.
  const unresolved = fields.filter((f) => !isResolved(f));
  if (unresolved.length > 0) {
    reasons.push({ code: "UNCONFIRMED_FIELDS", blocking: true, detail: String(unresolved.length) });
  }
  const lowConf = unresolved.filter((f) => f.confidence < LOW_CONFIDENCE);
  if (lowConf.length > 0) {
    reasons.push({ code: "LOW_CONFIDENCE_FIELDS", blocking: false, detail: String(lowConf.length) });
  }

  // Missing required documents — informational only (do NOT block).
  for (const docType of missingRequired) {
    reasons.push({ code: "MISSING_REQUIRED_DOCUMENT", blocking: false, detail: docType });
  }

  const status = reasons.some((r) => r.blocking) ? "NEEDS_REVIEW" : "READY_TO_REVIEW";
  return { status, reasons };
}

/** Extracted fields the renter has not yet confirmed/corrected/entered. */
export function countUnresolved(fields: readonly ExtractedField[]): number {
  return fields.filter((f) => !isResolved(f)).length;
}

/**
 * Progress-aware display status, first match wins. UI vocabulary only: the
 * exported readiness stays the organizer's binary and is computed separately
 * in computeReadiness().
 */
export function deriveDisplayStatus(args: {
  documentCount: number;
  busy: boolean;
  locked: boolean;
  unresolvedCount: number;
  reasons: readonly ReviewReason[];
  missingRequiredCount: number;
}): DisplayStatus {
  if (args.documentCount === 0) return "NOT_STARTED";
  if (args.busy) return "PROCESSING";
  if (args.locked) return "PACKET_LOCKED";
  // Detected inconsistencies outrank pending confirmations (red beats yellow).
  if (args.reasons.some((r) => r.blocking && r.code !== "UNCONFIRMED_FIELDS")) {
    return "EVIDENCE_ISSUES";
  }
  if (args.unresolvedCount > 0) return "AWAITING_CONFIRMATION";
  if (args.missingRequiredCount > 0) return "DOCUMENTS_MISSING";
  return "READY";
}

/**
 * Errors = detected inconsistencies / rule flags on confirmed values.
 * Independent of confirmation progress: unconfirmed fields and missing
 * documents are "pending"/informational, never errors.
 */
export function computeErrorCount(reasons: readonly ReviewReason[]): number {
  return reasons.filter((r) => r.blocking && r.code !== "UNCONFIRMED_FIELDS").length;
}

export { LOW_CONFIDENCE };
