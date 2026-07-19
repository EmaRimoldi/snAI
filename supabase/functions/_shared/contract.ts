import type { RuleAuthority, TrustedRule } from "./rules.ts";
import type { AppGuideItem } from "./app_guide.ts";
import { contextIntegrityError } from "./integrity.ts";

export const SUPPORTED_LOCALES = ["en", "es", "zh", "tl", "vi"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const CHAT_OUTCOMES = [
  "answered",
  "refused",
  "abstained",
  "needs_confirmation",
] as const;
export type ChatOutcome = (typeof CHAT_OUTCOMES)[number];

export const POLICY_CODES = [
  "NONE",
  "OUT_OF_DOMAIN",
  "DECISION_BOUNDARY",
  "CROSS_APPLICANT_DATA",
  "PROTECTED_TRAIT_INFERENCE",
  "DATASET_LIMITATION",
  "FROZEN_CORPUS_ONLY",
  "PROMPT_INJECTION",
  "LEGAL_ADVICE",
  "MISSING_CONTEXT",
  "GROUNDING_FAILURE",
  "MODEL_UNAVAILABLE",
] as const;
export type PolicyCode = (typeof POLICY_CODES)[number];

export type SafeDocument = {
  documentId: string;
  documentType: string;
};

export type SafeEvidence = {
  evidenceId: string;
  documentId: string;
  page: number;
  bbox: readonly [number, number, number, number];
  field: string;
};

export type SafeIncomeSource = {
  field: string;
  periodAmount: number;
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "annual";
  annualAmount: number;
  evidenceRef: string;
};

export type SafeReviewReason = {
  code: string;
  blocking: boolean;
  documentId: string | null;
  evidenceRefs: string[];
};

export type SafeUnderstandingContext = {
  householdSize: number | null;
  annualizedIncome: number | null;
  frozenThreshold: number | null;
  comparison: "below_or_equal" | "above" | "no_frozen_threshold" | null;
  readinessStatus: "READY_TO_REVIEW" | "NEEDS_REVIEW" | null;
  documents: SafeDocument[];
  missingDocumentTypes: string[];
  incomeSources: SafeIncomeSource[];
  reviewReasons: SafeReviewReason[];
  evidence: SafeEvidence[];
};

export type ChatRequest = {
  mode: "general" | "personalized";
  locale: SupportedLocale;
  question: string;
  context?: SafeUnderstandingContext;
};

export type RuleCitation = {
  kind: "rule";
  ruleId: string;
  authority: RuleAuthority;
  effectiveDate: string | null;
  sourceLocator: string;
  sourceUrl: string;
};

export type GuideCitation = {
  kind: "guide";
  guideId: string;
};

export type DocumentCitation = {
  kind: "document";
  documentId: string;
  page: number;
  bbox: readonly [number, number, number, number];
  field: string;
};

export type AiCitation = RuleCitation | GuideCitation | DocumentCitation;

export type ChatResponse = {
  requestId: string;
  outcome: ChatOutcome;
  policyCode: PolicyCode;
  answer: string;
  citations: AiCitation[];
};

export type ModelOutput = {
  outcome: ChatOutcome;
  policy_code: PolicyCode;
  answer: string;
  citation_refs: string[];
};

const DOCUMENT_TYPES = new Set([
  "application_summary",
  "pay_stub",
  "employment_letter",
  "benefit_letter",
  "gig_statement",
  "gig_income_corroboration",
  "unknown",
]);
const FREQUENCIES = new Set(["weekly", "biweekly", "semimonthly", "monthly", "annual"]);
const COMPARISONS = new Set(["below_or_equal", "above", "no_frozen_threshold"]);
const READINESS = new Set(["READY_TO_REVIEW", "NEEDS_REVIEW"]);
const ID_RE = /^[A-Za-z0-9:_-]{1,120}$/;
const FIELD_RE = /^[a-z][a-z0-9_]{0,63}$/;
const REASON_RE = /^[A-Z][A-Z0-9_]{0,79}$/;

function objectValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function finiteAmount(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100_000_000) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function safeId(value: unknown): string | null {
  return typeof value === "string" && ID_RE.test(value) ? value : null;
}

function safeDocumentType(value: unknown): string | null {
  return typeof value === "string" && DOCUMENT_TYPES.has(value) ? value : null;
}

function parseBbox(value: unknown): readonly [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const box = value.map(Number);
  if (box.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) return null;
  if (!(box[0] < box[2] && box[1] < box[3])) return null;
  return [box[0], box[1], box[2], box[3]];
}

function parseContext(value: unknown): SafeUnderstandingContext | undefined {
  const raw = objectValue(value);
  if (!raw) return undefined;

  const documents: SafeDocument[] = [];
  for (const item of Array.isArray(raw.documents) ? raw.documents.slice(0, 12) : []) {
    const doc = objectValue(item);
    if (!doc) continue;
    const documentId = safeId(doc.documentId);
    const documentType = safeDocumentType(doc.documentType);
    if (documentId && documentType && !documents.some((d) => d.documentId === documentId)) {
      documents.push({ documentId, documentType });
    }
  }
  const documentIds = new Set(documents.map((doc) => doc.documentId));

  const evidence: SafeEvidence[] = [];
  for (const item of Array.isArray(raw.evidence) ? raw.evidence.slice(0, 80) : []) {
    const source = objectValue(item);
    if (!source) continue;
    const evidenceId = safeId(source.evidenceId);
    const documentId = safeId(source.documentId);
    const page = Number(source.page);
    const bbox = parseBbox(source.bbox);
    const field = typeof source.field === "string" && FIELD_RE.test(source.field) ? source.field : null;
    if (
      evidenceId && documentId && documentIds.has(documentId) && Number.isInteger(page) &&
      page >= 1 && page <= 100 && bbox && field &&
      !evidence.some((entry) => entry.evidenceId === evidenceId)
    ) {
      evidence.push({ evidenceId, documentId, page, bbox, field });
    }
  }
  const evidenceIds = new Set(evidence.map((entry) => entry.evidenceId));

  const incomeSources: SafeIncomeSource[] = [];
  for (const item of Array.isArray(raw.incomeSources) ? raw.incomeSources.slice(0, 30) : []) {
    const source = objectValue(item);
    if (!source) continue;
    const field = typeof source.field === "string" && FIELD_RE.test(source.field) ? source.field : null;
    const periodAmount = finiteAmount(source.periodAmount);
    const annualAmount = finiteAmount(source.annualAmount);
    const frequency = typeof source.frequency === "string" && FREQUENCIES.has(source.frequency)
      ? source.frequency as SafeIncomeSource["frequency"]
      : null;
    const evidenceRef = safeId(source.evidenceRef);
    if (field && periodAmount !== null && annualAmount !== null && frequency && evidenceRef && evidenceIds.has(evidenceRef)) {
      incomeSources.push({ field, periodAmount, annualAmount, frequency, evidenceRef });
    }
  }

  const reviewReasons: SafeReviewReason[] = [];
  for (const item of Array.isArray(raw.reviewReasons) ? raw.reviewReasons.slice(0, 30) : []) {
    const reason = objectValue(item);
    if (!reason || typeof reason.code !== "string" || !REASON_RE.test(reason.code)) continue;
    const documentId = reason.documentId === null ? null : safeId(reason.documentId);
    const evidenceRefs = (Array.isArray(reason.evidenceRefs) ? reason.evidenceRefs : [])
      .map(safeId)
      .filter((ref): ref is string => Boolean(ref && evidenceIds.has(ref)))
      .slice(0, 8);
    reviewReasons.push({
      code: reason.code,
      blocking: reason.blocking === true,
      documentId: documentId && documentIds.has(documentId) ? documentId : null,
      evidenceRefs,
    });
  }

  const missingDocumentTypes = (Array.isArray(raw.missingDocumentTypes) ? raw.missingDocumentTypes : [])
    .map(safeDocumentType)
    .filter((item): item is string => Boolean(item))
    .slice(0, 12);

  const householdSizeRaw = raw.householdSize;
  const householdSize = householdSizeRaw === null
    ? null
    : Number.isInteger(householdSizeRaw) && Number(householdSizeRaw) >= 1 && Number(householdSizeRaw) <= 99
      ? Number(householdSizeRaw)
      : null;
  const comparison = typeof raw.comparison === "string" && COMPARISONS.has(raw.comparison)
    ? raw.comparison as SafeUnderstandingContext["comparison"]
    : null;
  const readinessStatus = typeof raw.readinessStatus === "string" && READINESS.has(raw.readinessStatus)
    ? raw.readinessStatus as SafeUnderstandingContext["readinessStatus"]
    : null;

  return {
    householdSize,
    annualizedIncome: finiteAmount(raw.annualizedIncome),
    frozenThreshold: finiteAmount(raw.frozenThreshold),
    comparison,
    readinessStatus,
    documents,
    missingDocumentTypes,
    incomeSources,
    reviewReasons,
    evidence,
  };
}

export function parseChatRequest(value: unknown): ChatRequest {
  const raw = objectValue(value);
  if (!raw) throw new Error("Request body must be a JSON object.");
  const mode = raw.mode === "general" || raw.mode === "personalized" ? raw.mode : null;
  if (!mode) throw new Error("mode must be general or personalized.");
  const locale = typeof raw.locale === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(raw.locale)
    ? raw.locale as SupportedLocale
    : "en";
  // NFC-normalize before any regex gate: browsers (notably macOS) may submit
  // decomposed (NFD) text, which would never match the NFC literals in policy.ts.
  const question = typeof raw.question === "string" ? raw.question.normalize("NFC").trim() : "";
  if (!question || question.length > 1_000) {
    throw new Error("question must contain between 1 and 1000 characters.");
  }
  const context = mode === "personalized" ? parseContext(raw.context) : undefined;
  const integrityError = context ? contextIntegrityError(context) : null;
  if (integrityError) {
    throw new Error(`context failed deterministic integrity check: ${integrityError}`);
  }
  return context ? { mode, locale, question, context } : { mode, locale, question };
}

export function sanitizeQuestion(question: string): string {
  return question
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g, "[identifier removed]")
    .replace(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[phone removed]");
}

export function buildCitationRegistry(
  rules: readonly TrustedRule[],
  guide: readonly AppGuideItem[],
  context?: SafeUnderstandingContext,
): Map<string, AiCitation> {
  const registry = new Map<string, AiCitation>();
  for (const rule of rules) {
    registry.set(`rule:${rule.rule_id}`, {
      kind: "rule",
      ruleId: rule.rule_id,
      authority: rule.authority,
      effectiveDate: rule.effective_date,
      sourceLocator: rule.source_locator,
      sourceUrl: rule.source_url,
    });
  }
  for (const item of guide) {
    registry.set(`guide:${item.guide_id}`, { kind: "guide", guideId: item.guide_id });
  }
  for (const source of context?.evidence ?? []) {
    registry.set(`evidence:${source.evidenceId}`, {
      kind: "document",
      documentId: source.documentId,
      page: source.page,
      bbox: source.bbox,
      field: source.field,
    });
  }
  return registry;
}

const VERDICT_RE = /\b(approved|approve|approval|denied|deny|denial|eligible|eligibility|ineligible|prioriti[sz]ed|qualifies|qualified|disqualified|aprobado|aprobada|aprobación|denegado|denegada|elegible|califica|kwalipikado|aprubado|tinanggihan)\b|符合资格|不符合资格|批准|拒绝|đủ điều kiện|được chấp thuận|bị từ chối/iu;

export function hasUnsafeDecisionLanguage(text: string): boolean {
  // Deliberately conservative: even a negative verdict ("you are not eligible")
  // crosses the same human-decision boundary as an affirmative one. Safe policy
  // copy uses "program determination" instead of applicant verdict labels.
  return VERDICT_RE.test(text);
}

export function safeResponse(
  requestId: string,
  outcome: ChatOutcome,
  policyCode: PolicyCode,
  answer: string,
  citationRefs: readonly string[],
  registry: ReadonlyMap<string, AiCitation>,
): ChatResponse {
  const citations: AiCitation[] = [];
  for (const ref of citationRefs.slice(0, 8)) {
    const citation = registry.get(ref);
    if (citation && !citations.some((item) => JSON.stringify(item) === JSON.stringify(citation))) {
      citations.push(citation);
    }
  }
  if ((outcome === "answered" || outcome === "needs_confirmation") && citations.length === 0) {
    return {
      requestId,
      outcome: "abstained",
      policyCode: "GROUNDING_FAILURE",
      answer: "I don't have a verified RealDoor source for that answer, so I won't guess.",
      citations: [],
    };
  }
  if (hasUnsafeDecisionLanguage(answer)) {
    return {
      requestId,
      outcome: "refused",
      policyCode: "DECISION_BOUNDARY",
      answer: "RealDoor can't make a program determination. It can explain documented values, the published comparison, and file readiness for human review.",
      citations: registry.has("rule:CH-DECISION-001")
        ? [registry.get("rule:CH-DECISION-001")!]
        : [],
    };
  }
  return { requestId, outcome, policyCode, answer: answer.slice(0, 2_000), citations };
}

export function validateModelOutput(
  value: unknown,
  requestId: string,
  registry: ReadonlyMap<string, AiCitation>,
): ChatResponse {
  const raw = objectValue(value);
  if (!raw) {
    return safeResponse(requestId, "abstained", "GROUNDING_FAILURE", "I couldn't verify a grounded answer.", [], registry);
  }
  const outcome = typeof raw.outcome === "string" && (CHAT_OUTCOMES as readonly string[]).includes(raw.outcome)
    ? raw.outcome as ChatOutcome
    : "abstained";
  const policyCode = typeof raw.policy_code === "string" && (POLICY_CODES as readonly string[]).includes(raw.policy_code)
    ? raw.policy_code as PolicyCode
    : "GROUNDING_FAILURE";
  const answer = typeof raw.answer === "string" && raw.answer.trim()
    ? raw.answer.trim()
    : "I couldn't verify a grounded answer.";
  const citationRefs = (Array.isArray(raw.citation_refs) ? raw.citation_refs : [])
    .filter((item): item is string => typeof item === "string");
  return safeResponse(requestId, outcome, policyCode, answer, citationRefs, registry);
}

export function modelOutputJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["outcome", "policy_code", "answer", "citation_refs"],
    properties: {
      outcome: { type: "string", enum: CHAT_OUTCOMES },
      policy_code: { type: "string", enum: POLICY_CODES },
      answer: { type: "string", minLength: 1, maxLength: 2_000 },
      citation_refs: {
        type: "array",
        maxItems: 8,
        items: { type: "string", minLength: 1, maxLength: 160 },
      },
    },
  };
}
