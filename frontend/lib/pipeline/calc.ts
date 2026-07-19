// Deterministic challenge math — ported from the starter pack's calculate.py.
// NOT an eligibility engine: it annualizes income, compares to a published
// threshold, and derives file-level readiness. Money is handled in INTEGER CENTS
// (never floats) to keep the math exact.

import type {
  DocumentRecord,
  ExtractedField,
  Comparison,
  ReadinessResult,
  ReviewReason,
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

export function thresholdCentsForSize(size: number): number | null {
  const dollars = thresholdForSize(size);
  return dollars === null ? null : dollars * 100;
}

export function formatMoneyCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
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

/**
 * Gross annual income (cents) from CONFIRMED/CORRECTED income fields only.
 * Each income field is one documented source; same-source stubs are modelled as a
 * single field upstream, so we do not double-count. Gig receipts are monthly (×12).
 */
export function computeGrossAnnualCents(fields: readonly ExtractedField[]): number {
  let total = 0;
  for (const f of fields) {
    if (!f.isIncome) continue;
    if (f.reviewStatus !== "confirmed" && f.reviewStatus !== "corrected" && f.reviewStatus !== "renter_entered") {
      continue; // only confirmed values flow downstream
    }
    const freq = f.incomeFrequency ?? "monthly";
    total += annualizeCents(toCents(f.value), freq);
  }
  return total;
}

function isExpired(dateStr: string): boolean {
  // "current" if dated on/after the 60-day window start (challenge convention).
  const d = Date.parse(dateStr);
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
): ReadinessResult {
  const reasons: ReviewReason[] = [];

  // Employment letter currency (60-day window).
  for (const doc of documents) {
    if (doc.documentType !== "employment_letter") continue;
    const dateField = fields.find((f) => f.documentId === doc.id && f.key === "document_date");
    if (dateField && isExpired(dateField.value)) {
      reasons.push({ code: "EMPLOYMENT_LETTER_EXPIRED", blocking: true, documentId: doc.id });
    }
  }

  // Gig income is always corroboration-flagged.
  for (const doc of documents) {
    if (doc.documentType === "gig_statement") {
      reasons.push({ code: "GIG_INCOME_UNCORROBORATED", blocking: true, documentId: doc.id });
    }
  }

  // Pay-stub internal conflict: stated gross vs hourly_rate * regular_hours.
  for (const doc of documents) {
    if (doc.documentType !== "pay_stub") continue;
    const gross = fields.find((f) => f.documentId === doc.id && f.key === "gross_pay");
    const rate = fields.find((f) => f.documentId === doc.id && f.key === "hourly_rate");
    const hours = fields.find((f) => f.documentId === doc.id && f.key === "regular_hours");
    if (gross && rate && hours) {
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

/** Errors metric = missing required docs + unresolved/low-confidence fields. */
export function computeErrorCount(
  fields: readonly ExtractedField[],
  missingRequired: readonly string[],
): number {
  const unresolvedOrLow = fields.filter(
    (f) => !isResolved(f) || f.confidence < LOW_CONFIDENCE,
  ).length;
  return unresolvedOrLow + missingRequired.length;
}

export { LOW_CONFIDENCE };
