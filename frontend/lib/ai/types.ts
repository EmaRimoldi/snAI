import type { NormBox, PayFrequency } from "@/lib/pipeline/types";
import type { RuleAuthority } from "@/lib/data/ruleCorpus";

export type AiLocale = "en" | "es" | "zh" | "tl" | "vi";
export type AiMode = "general" | "personalized";
export type AiOutcome = "answered" | "refused" | "abstained" | "needs_confirmation";

export type SafeUnderstandingContext = {
  householdSize: number | null;
  annualizedIncome: number | null;
  frozenThreshold: number | null;
  comparison: "below_or_equal" | "above" | "no_frozen_threshold" | null;
  readinessStatus: "READY_TO_REVIEW" | "NEEDS_REVIEW" | null;
  documents: { documentId: string; documentType: string }[];
  missingDocumentTypes: string[];
  incomeSources: {
    field: string;
    periodAmount: number;
    frequency: PayFrequency;
    annualAmount: number;
    evidenceRef: string;
  }[];
  reviewReasons: {
    code: string;
    blocking: boolean;
    documentId: string | null;
    evidenceRefs: string[];
  }[];
  evidence: {
    evidenceId: string;
    documentId: string;
    page: number;
    bbox: NormBox;
    field: string;
  }[];
};
export type AiCitation =
  | {
      kind: "rule";
      ruleId: string;
      authority: RuleAuthority;
      effectiveDate: string | null;
      sourceLocator: string;
      sourceUrl: string;
    }
  | { kind: "guide"; guideId: string }
  | { kind: "document"; documentId: string; page: number; bbox: NormBox; field: string };

export type AiChatResponse = {
  requestId: string;
  outcome: AiOutcome;
  policyCode: string;
  answer: string;
  citations: AiCitation[];
};

export type AiChatRequest = {
  mode: AiMode;
  locale: AiLocale;
  question: string;
  context?: SafeUnderstandingContext;
};
