"use client";

import type { DocumentRecord } from "@/lib/pipeline/types";
import type { AiChatResponse, AiOutcome } from "@/lib/ai/types";
import type { RuleAuthority } from "@/lib/data/ruleCorpus";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import { useFieldLabel } from "@/lib/pipeline/labels";
import s from "@/components/pipeline/pipeline.module.css";

type Props = {
  response: AiChatResponse;
  documents?: readonly DocumentRecord[];
};

export default function AiAnswer({ response, documents = [] }: Props) {
  const c = useCopy();
  const fieldLabel = useFieldLabel();
  const outcomeLabel: Record<AiOutcome, string> = {
    answered: c.aiOutcomeAnswered,
    refused: c.aiOutcomeRefused,
    abstained: c.aiOutcomeAbstained,
    needs_confirmation: c.aiOutcomeNeedsConfirmation,
  };
  const authorityLabel: Record<RuleAuthority, string> = {
    official_hud: c.authOfficialHud,
    official_federal: c.authOfficialFederal,
    hackathon_simulation: c.authChallenge,
  };
  return (
    <div className={s.qaAnswer} aria-live="polite">
      <div className={s.aiOutcomeRow}>
        <span className={s.aiOutcome}>{outcomeLabel[response.outcome]}</span>
        {response.policyCode !== "NONE" && <span className={s.hint}>{response.policyCode}</span>}
      </div>
      <p className={s.aiAnswerText}>{response.answer}</p>
      {response.citations.length > 0 && (
        <div className={s.aiCitations} aria-label={c.aiSources}>
          {response.citations.map((citation, index) => {
            if (citation.kind === "rule") {
              return (
                <a
                  key={`${citation.ruleId}-${index}`}
                  className={s.aiCitationChip}
                  href={citation.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={citation.sourceLocator}
                >
                  {citation.ruleId} · {authorityLabel[citation.authority]} ↗
                </a>
              );
            }
            if (citation.kind === "guide") {
              return (
                <span key={`${citation.guideId}-${index}`} className={s.aiCitationChip}>
                  {c.aiGuideLabel} · {citation.guideId}
                </span>
              );
            }
            const document = documents.find((item) => item.id === citation.documentId);
            return (
              <span key={`${citation.documentId}-${citation.page}-${index}`} className={s.aiCitationChip}>
                {document?.fileName ?? c.aiCurrentDocument} · {fmt(c.page, { n: citation.page })} ·{" "}
                {fieldLabel(citation.field)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
