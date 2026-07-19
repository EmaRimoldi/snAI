import type { DocumentRecord } from "@/lib/pipeline/types";
import type { AiChatResponse } from "@/lib/ai/types";
import { AUTHORITY_LABEL } from "@/lib/pipeline/rules";
import s from "@/components/pipeline/pipeline.module.css";

type Props = {
  response: AiChatResponse;
  documents?: readonly DocumentRecord[];
};

export default function AiAnswer({ response, documents = [] }: Props) {
  return (
    <div className={s.qaAnswer} aria-live="polite">
      <div className={s.aiOutcomeRow}>
        <span className={s.aiOutcome}>{response.outcome.replace("_", " ")}</span>
        {response.policyCode !== "NONE" && <span className={s.hint}>{response.policyCode}</span>}
      </div>
      <p className={s.aiAnswerText}>{response.answer}</p>
      {response.citations.length > 0 && (
        <div className={s.aiCitations} aria-label="Sources">
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
                  {citation.ruleId} · {AUTHORITY_LABEL[citation.authority]} ↗
                </a>
              );
            }
            if (citation.kind === "guide") {
              return (
                <span key={`${citation.guideId}-${index}`} className={s.aiCitationChip}>
                  RealDoor guide · {citation.guideId}
                </span>
              );
            }
            const document = documents.find((item) => item.id === citation.documentId);
            return (
              <span key={`${citation.documentId}-${citation.page}-${index}`} className={s.aiCitationChip}>
                {document?.fileName ?? "Current document"} · page {citation.page} · {citation.field.replace(/_/g, " ")}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
