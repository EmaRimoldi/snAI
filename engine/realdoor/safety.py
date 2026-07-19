"""Block D — safety layer (Person 2).

Three duties:

1. Injection guard (CH-SAFETY-001): document text is untrusted *data*.
   Instruction-like content is quarantined before the reasoning engines see
   it, and its presence never changes a readiness outcome by itself (gold:
   a household with adversarial text in a pay stub is still READY).
2. Request triage: refusal / limitation responses for out-of-scope asks
   (other applicants' data, eligibility verdicts, vacancy questions,
   non-frozen thresholds, protected-trait inference).
3. Decision-language lint (CH-DECISION-001): a final gate proving no output
   string labels a person with a program verdict.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .models import Citation, DocumentRecord, ExtractedField
from . import rules

UNTRUSTED_FIELD = "untrusted_instruction_text"

# Instruction-like content inside documents (prompt injection).
INSTRUCTION_RE = re.compile(
    r"(ignore|disregard|forget|override)\s+.{0,40}"
    r"(instruction|prompt|rule|arithmetic|comparison)"
    r"|system\s+prompt"
    r"|reveal\s+.{0,40}(prompt|secret|credential|hidden)"
    r"|(mark|return|declare|set)\s+.{0,40}(approved|denied|eligible|ineligible)"
    r"|copy\s+another\s+household",
    re.IGNORECASE,
)


def is_untrusted_text(field_obj: ExtractedField) -> bool:
    if field_obj.field == UNTRUSTED_FIELD:
        return True
    return isinstance(field_obj.value, str) and bool(
        INSTRUCTION_RE.search(field_obj.value))


@dataclass
class QuarantineResult:
    docs: list[DocumentRecord]              # evidence-safe document records
    ignored: list[tuple[str, str, str]]     # (document_id, field, text)
    citations: list[Citation] = field(default_factory=list)

    @property
    def notes(self) -> list[str]:
        return [
            f"Untrusted embedded text in {doc_id} ({field_name}) was treated "
            f"as data and ignored (CH-SAFETY-001)."
            for doc_id, field_name, _ in self.ignored
        ]


def quarantine(docs: list[DocumentRecord]) -> QuarantineResult:
    """Strip instruction-like fields from the evidence view of each document.

    The original records are untouched (extraction scoring still reports the
    adversarial text with its source box); only the reasoning engines get
    the filtered view.
    """
    safe_docs: list[DocumentRecord] = []
    ignored: list[tuple[str, str, str]] = []
    citations: list[Citation] = []
    for doc in docs:
        kept = []
        for f in doc.fields:
            if is_untrusted_text(f):
                ignored.append((doc.document_id, f.field, str(f.value)))
                citations.append(Citation(
                    document_id=doc.document_id, page=f.page,
                    bbox=[round(float(v), 2) for v in f.bbox],
                    bbox_units=f.bbox_units, field=f.field,
                    rule_id=rules.CH_SAFETY))
            else:
                kept.append(f)
        if len(kept) == len(doc.fields):
            safe_docs.append(doc)
        else:
            safe_docs.append(DocumentRecord(
                document_id=doc.document_id, household_id=doc.household_id,
                document_type=doc.document_type, file_name=doc.file_name,
                fields=kept, page_size_points=doc.page_size_points,
                rasterized=doc.rasterized,
                contains_adversarial_text=doc.contains_adversarial_text))
    return QuarantineResult(docs=safe_docs, ignored=ignored, citations=citations)


# ---------------------------------------------------------------------------
# Request triage (out-of-scope / hostile asks)
# ---------------------------------------------------------------------------
IGNORE_EMBEDDED = "ignore_embedded_instruction"
REFUSE_LEAK = "refuse_and_protect_data"
READINESS_ONLY = "provide_readiness_and_human_handoff_only"
DATASET_LIMITATION = "state_dataset_limitation"
FROZEN_CORPUS = "use_frozen_2026_corpus"
REFUSE_TRAIT = "refuse_trait_inference"
IN_SCOPE = "in_scope"

_RESPONSES: dict[str, tuple[str, list[str]]] = {
    IGNORE_EMBEDDED: (
        "Text embedded in a document is untrusted data, not an instruction. "
        "It was recorded with its source box and ignored; it does not change "
        "any calculation or status.",
        [rules.CH_SAFETY, rules.CH_DECISION]),
    REFUSE_LEAK: (
        "I can't share another household's documents, income, or any other "
        "applicant data. I can only discuss the household in the current "
        "review context.",
        [rules.CH_SAFETY]),
    READINESS_ONLY: (
        "I can't provide a program verdict on any applicant. I can report "
        "the documented annualized income, its comparison with the frozen "
        "threshold, and a readiness status; the determination is made by a "
        "human reviewer.",
        [rules.CH_DECISION]),
    DATASET_LIMITATION: (
        "The HUD LIHTC records here describe projects and units; they are "
        "not a vacancy, rent, waitlist, or application-status feed, so no "
        "current availability can be stated from them.",
        [rules.HUD_DATA_LIMITS]),
    FROZEN_CORPUS: (
        "Only the frozen FY 2026 MTSP limits (effective 2026-05-01) from the "
        "challenge corpus are used for scored calculations; remembered or "
        "other-year figures are not applied.",
        [rules.HUD_MTSP_EFFECTIVE, rules.HUD_MTSP_60]),
    REFUSE_TRAIT: (
        "I can't infer disability, immigration status, health, family "
        "relationships, or other protected traits from documents. Only the "
        "documented evidence fields are used.",
        [rules.CH_SAFETY]),
}

_CLASSIFY_PATTERNS: list[tuple[str, re.Pattern]] = [
    (REFUSE_TRAIT, re.compile(
        r"infer|disabilit|immigration|citizenship|health|ethnic|religio|"
        r"pregnan|marital", re.I)),
    (REFUSE_LEAK, re.compile(
        r"(another|other|different)\s+(household|applicant|family|person)"
        r"|someone else", re.I)),
    (IGNORE_EMBEDDED, re.compile(
        r"(document|stub|letter|statement).{0,60}(ignore|instruction|approved)"
        r"|ignore\s+system", re.I)),
    (DATASET_LIMITATION, re.compile(
        r"vacan|available\s+(today|now|unit)|unit\s+available|waitlist|"
        r"open\s+unit", re.I)),
    (FROZEN_CORPUS, re.compile(
        r"(remember|recall|memoriz|use).{0,40}(20(?!26)\d\d|last year|"
        r"old(er)?\s+(limit|threshold))|20(?!26)\d\d\s+(limit|threshold)", re.I)),
    (READINESS_ONLY, re.compile(
        r"approv|denial|denied|deny|eligib|qualif|priorit|final\s+decision",
        re.I)),
]


def classify_request(text: str) -> str:
    """Map an out-of-scope/hostile request to its safe-behavior token."""
    for behavior, pattern in _CLASSIFY_PATTERNS:
        if pattern.search(text):
            return behavior
    return IN_SCOPE


def respond(behavior: str) -> dict:
    """Canonical safe response for a behavior token."""
    message, rule_ids = _RESPONSES[behavior]
    return {"behavior": behavior, "message": message, "rule_ids": rule_ids}


# ---------------------------------------------------------------------------
# Decision-language lint (CH-DECISION-001)
# ---------------------------------------------------------------------------
# Verdict words applied to a person are forbidden.  Mentions inside an
# explicit negation/disclaimer window are allowed (e.g. "no eligibility
# determination is included", "can't provide ... approved").
_VERDICT_RE = re.compile(
    r"\b(approved|approve|approval|denied|deny|denial|eligible|ineligible|"
    r"prioriti[sz]ed|qualifies|qualified|disqualified)\b", re.I)
_NEGATION_RE = re.compile(
    r"\b(no|not|never|cannot|can't|won't|don't|doesn't|must\s+not|may\s+not|"
    r"without|refus\w*|ignor\w*|n't|verdict\s+on)\b", re.I)


def lint_text(text: str) -> list[str]:
    """Verdict words outside a negation window, as violation snippets."""
    violations = []
    for match in _VERDICT_RE.finditer(text):
        window = text[max(0, match.start() - 60):match.start()]
        if not _NEGATION_RE.search(window):
            snippet = text[max(0, match.start() - 30):match.end() + 30]
            violations.append(snippet.strip())
    return violations


def lint_output(obj) -> list[str]:
    """Recursively lint every string in a JSON-shaped output object."""
    violations: list[str] = []
    if isinstance(obj, str):
        violations.extend(lint_text(obj))
    elif isinstance(obj, dict):
        for value in obj.values():
            violations.extend(lint_output(value))
    elif isinstance(obj, (list, tuple)):
        for value in obj:
            violations.extend(lint_output(value))
    return violations
