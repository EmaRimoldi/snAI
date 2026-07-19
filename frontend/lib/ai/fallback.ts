import { answerRulesQuestion } from "@/lib/pipeline/rules";
import type { AiChatResponse } from "@/lib/ai/types";

export function localRulesFallback(question: string): AiChatResponse {
  const result = answerRulesQuestion(question);
  if (result.kind === "refusal") {
    return {
      requestId: "local-fallback",
      outcome: "refused",
      policyCode: "DECISION_BOUNDARY",
      answer: "RealDoor can't make a program determination. It can explain documented values, the published comparison, and file readiness for human review.",
      citations: [],
    };
  }
  if (result.kind === "abstain") {
    return {
      requestId: "local-fallback",
      outcome: "abstained",
      policyCode: "OUT_OF_DOMAIN",
      answer: "I can only help with RealDoor, its frozen rules, your current documents, and the application-readiness workflow.",
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
