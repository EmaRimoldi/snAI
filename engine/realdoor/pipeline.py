"""Block E — end-to-end assembly (both people; Person 2 leads).

Per household: safety quarantine -> income derivation -> threshold
comparison -> readiness reasons -> citations -> traceability check ->
decision-language lint -> schema-validated submission dict.

``run_pack(source="gold")`` runs the whole reasoning stack from the gold
document records (Person 2's dev mode); ``source="extracted"`` swaps in
Person 1's extractor for the same interface.
"""
from __future__ import annotations

import json
from collections import defaultdict

import jsonschema

from . import calc, citations as cite, config, readiness, rules, safety
from .extract import extract_pack
from .models import (
    Citation,
    DocumentRecord,
    ReviewReason,
    Submission,
    MALFORMED_SOURCE_BOX,
    MISSING_CITATION,
    PROMPT_INJECTION_DETECTED,
    load_document_records,
)


def _threshold_citations(threshold: float | None) -> list[Citation]:
    cites = [rules.rule_citation(rules.CH_INCOME), rules.rule_citation(rules.CH_READINESS),
             rules.rule_citation(rules.CH_DECISION)]
    if threshold is not None:
        cites.insert(0, rules.rule_citation(rules.HUD_MTSP_60))
    return cites


def _traceability_reasons(submission_citations, sources) -> list[ReviewReason]:
    problems = cite.citation_problems(submission_citations)
    problems += cite.source_traceability_problems(sources)
    reasons = []
    if cite.PROBLEM_MISSING in problems:
        reasons.append(ReviewReason(
            code=MISSING_CITATION,
            detail="A material value lacks a page-level source box or rule "
                   "citation and fails the traceability check."))
    if cite.PROBLEM_MALFORMED in problems:
        reasons.append(ReviewReason(
            code=MALFORMED_SOURCE_BOX,
            detail="A cited source box falls outside the document page and "
                   "fails schema validation."))
    return reasons


def process_household(household_id: str, docs: list[DocumentRecord]) -> Submission:
    """Evidence documents for one household -> submission object."""
    # 1. Safety: quarantine embedded instructions from the evidence view.
    # Detection is a security event, not automatically a readiness failure.
    guarded = safety.quarantine(docs)
    evidence = guarded.docs
    security_events = [
        {"code": PROMPT_INJECTION_DETECTED, "document_id": doc_id}
        for doc_id in dict.fromkeys(d for d, _, _ in guarded.ignored)]

    # 2. Household size from the application summary (never inferred).
    size = None
    size_citation = None
    for doc in evidence:
        f = doc.get("household_size")
        if f is not None:
            size = int(f.value)
            size_citation = Citation(
                document_id=doc.document_id, page=f.page,
                bbox=[round(float(v), 2) for v in f.bbox],
                bbox_units=f.bbox_units, field=f.field)
            break

    # 3. Documented recurring income (CH-INCOME-001).
    sources = calc.derive_income_sources(evidence)
    income = calc.total_annualized_income(sources)

    # 4. Frozen threshold + numeric comparison (HUD-MTSP-002, CH-DECISION-001).
    threshold = calc.threshold_for(size)
    comparison = calc.compare_to_threshold(income, threshold)

    # 5. Readiness reasons (CH-READINESS-001).
    reasons = readiness.evaluate_reasons(evidence, sources, size, threshold)

    # 6. Citations for every material value.
    submission_citations: list[Citation] = []
    if size_citation is not None:
        submission_citations.append(size_citation)
    for source in sources:
        submission_citations.extend(source.citations)
    submission_citations.extend(guarded.citations)
    submission_citations.extend(_threshold_citations(threshold))

    # 7. Traceability gate (missing/malformed citations force review).
    reasons.extend(_traceability_reasons(submission_citations, sources))

    # Extraction certainty summary: the weakest evidence field feeding this
    # submission.  Report-only for now -- a calibrated threshold that forces
    # NEEDS_REVIEW is a policy decision for the team.
    field_confidences = [f.confidence for d in evidence for f in d.fields]
    extraction_confidence = (round(min(field_confidences), 3)
                             if field_confidences else None)

    submission = Submission(
        household_id=household_id,
        annualized_income=income,
        comparison=comparison,
        readiness_status=readiness.status_from_reasons(reasons),
        citations=submission_citations,
        review_reasons=reasons,
        income_sources=sources,
        security_events=security_events,
        household_size=size,
        frozen_threshold=threshold,
        extraction_confidence=extraction_confidence,
        notes=guarded.notes + [
            "No eligibility, approval, denial, or priority determination is "
            "included; a human reviewer makes any program determination."],
    )

    # 8. Final gates: decision-language lint + submission schema.
    out = submission.to_dict()
    violations = safety.lint_output(out)
    if violations:
        raise AssertionError(f"Decision-language lint failed: {violations}")
    validate_submission(out)
    return submission


def validate_submission(payload: dict) -> None:
    with open(config.SUBMISSION_SCHEMA, encoding="utf-8") as handle:
        schema = json.load(handle)
    jsonschema.validate(payload, schema)


def group_by_household(docs: list[DocumentRecord]) -> dict[str, list[DocumentRecord]]:
    grouped: dict[str, list[DocumentRecord]] = defaultdict(list)
    for doc in docs:
        grouped[doc.household_id].append(doc)
    return dict(grouped)


def run_pack(source: str = "gold") -> dict[str, Submission]:
    """All households in the pack -> submissions.

    source="gold":      reasoning stack over gold document records (dev stub)
    source="extracted": full pipeline over the actual PDFs
    """
    if source == "gold":
        docs = load_document_records(config.DOCUMENT_GOLD)
    elif source == "extracted":
        docs = extract_pack()
    else:
        raise ValueError(f"Unknown source: {source}")
    return {
        household_id: process_household(household_id, household_docs)
        for household_id, household_docs in sorted(group_by_household(docs).items())
    }
