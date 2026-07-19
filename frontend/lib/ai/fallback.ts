import { answerRulesQuestion } from "@/lib/pipeline/rules";
import type { AiChatResponse } from "@/lib/ai/types";

/** Localized wrapper texts the caller supplies (from the pipeline copy), so the
 * fallback answers in the renter's language. Rule text itself is quoted
 * verbatim from the frozen English corpus — never paraphrased or translated. */
export type FallbackTexts = { refusal: string; abstain: string };

export function localRulesFallback(question: string, texts: FallbackTexts): AiChatResponse {
  const result = answerRulesQuestion(question);
  if (result.kind === "refusal") {
    return {
      requestId: "local-fallback",
      outcome: "refused",
      policyCode: "DECISION_BOUNDARY",
      answer: texts.refusal,
      citations: [],
    };
  }
  if (result.kind === "abstain") {
    return {
      requestId: "local-fallback",
      outcome: "abstained",
      policyCode: "OUT_OF_DOMAIN",
      answer: texts.abstain,
      citations: [],
    };
  }
  return {
    requestId: "local-fallback",
    outcome: "answered",
    policyCode: "NONE",
    answer: result.rules.map((rule) => rule.text).join(" "),
    citations: result.rules.map((rule) => ({
      kind: "rule" as const,
      ruleId: rule.ruleId,
      authority: rule.authority,
      effectiveDate: rule.effectiveDate,
      sourceLocator: rule.sourceLocator,
      sourceUrl: rule.sourceUrl,
    })),
  };
}
