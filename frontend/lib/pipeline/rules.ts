// Rules Q&A: answers ONLY from the frozen 11-rule corpus, with citations and an
// authority-tier badge. Refuses decision requests (the red line) in negated form,
// and abstains when a question falls outside the corpus. Deterministic, no network.

import { RULE_CORPUS } from "@/lib/data/ruleCorpus";
import type { Rule } from "@/lib/data/ruleCorpus";

export type RulesAnswer =
  | { kind: "refusal" }
  | { kind: "abstain" }
  | { kind: "answer"; rules: Rule[] };

// Decision-request signals — RealDoor must never decide/imply eligibility.
const DECISION_PATTERNS: readonly RegExp[] = [
  /eligib/i,
  /qualif/i,
  /\bapprov/i,
  /\bdeni(ed|al)?\b/i,
  /\bdeny\b/i,
  /\breject/i,
  /priorit/i,
  /\brank/i,
  /\bwill i (get|be)/i,
  /\bdo i (get|qualify)/i,
  /chances? of (getting|being)/i,
  /am i (eligible|approved|accepted)/i,
];

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "of", "to", "for", "and", "or", "in", "on", "what",
  "how", "do", "does", "i", "my", "me", "can", "you", "this", "that", "with", "about",
  "it", "be", "if", "when", "which", "there", "any", "am",
]);

export function isDecisionRequest(query: string): boolean {
  return DECISION_PATTERNS.some((re) => re.test(query));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function scoreRule(rule: Rule, tokens: readonly string[]): number {
  const haystack = `${rule.text} ${rule.ruleId} ${rule.sourceLocator}`.toLowerCase();
  let score = 0;
  for (const tok of tokens) {
    if (haystack.includes(tok)) score += 1;
  }
  return score;
}

/** Answer a rules question, or refuse / abstain. */
export function answerRulesQuestion(query: string): RulesAnswer {
  const trimmed = query.trim();
  if (!trimmed) return { kind: "abstain" };
  if (isDecisionRequest(trimmed)) return { kind: "refusal" };

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return { kind: "abstain" };

  const ranked = RULE_CORPUS.map((rule) => ({ rule, score: scoreRule(rule, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return { kind: "abstain" };
  return { kind: "answer", rules: ranked.slice(0, 3).map((r) => r.rule) };
}

export const AUTHORITY_LABEL: Record<Rule["authority"], string> = {
  official_hud: "Official · HUD",
  official_federal: "Official · Federal",
  hackathon_simulation: "Challenge convention",
};

// A few starter prompts for the demo (localized wrappers live in the UI).
export const SAMPLE_QUESTIONS: readonly string[] = [
  "What is the 60% income limit for a household of four?",
  "When do the FY2026 income limits take effect?",
  "How is recurring income annualized?",
  "What makes a file ready to review?",
];
