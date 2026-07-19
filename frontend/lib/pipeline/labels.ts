"use client";

// Shared human-readable labels for pipeline surfaces: the field-key humanizer
// plus localized document-type and readiness-reason lookups. One source for the
// Profile, Prepare, and Receipt views (previously copy-pasted per component).

import type { DocumentType, ReviewReasonCode } from "@/lib/pipeline/types";
import { useCopy, FIELD_LABELS } from "@/lib/pipeline/copy";
import { useI18n } from "@/lib/i18n";

export function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Localized label for a parsed-document field key (falls back en → humanized). */
export function useFieldLabel(): (key: string) => string {
  const { language } = useI18n();
  return (key: string) => FIELD_LABELS[language]?.[key] ?? FIELD_LABELS.en[key] ?? humanize(key);
}

export function useDocLabels(): Record<DocumentType, string> {
  const c = useCopy();
  return {
    application_summary: c.docApplication_summary,
    pay_stub: c.docPay_stub,
    employment_letter: c.docEmployment_letter,
    benefit_letter: c.docBenefit_letter,
    gig_statement: c.docGig_statement,
    unknown: c.docUnknown,
  };
}

export function useReasonTexts(): Record<ReviewReasonCode, string> {
  const c = useCopy();
  return {
    PAY_STUB_TOTAL_CONFLICT: c.rc_PAY_STUB_TOTAL_CONFLICT,
    GIG_INCOME_UNCORROBORATED: c.rc_GIG_INCOME_UNCORROBORATED,
    EMPLOYMENT_LETTER_EXPIRED: c.rc_EMPLOYMENT_LETTER_EXPIRED,
    UNCONFIRMED_FIELDS: c.rc_UNCONFIRMED_FIELDS,
    LOW_CONFIDENCE_FIELDS: c.rc_LOW_CONFIDENCE_FIELDS,
    MISSING_REQUIRED_DOCUMENT: c.rc_MISSING_REQUIRED_DOCUMENT,
  };
}
