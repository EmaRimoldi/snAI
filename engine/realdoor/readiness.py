"""Block C — readiness reasoning (Person 2).

CH-READINESS-001: READY_TO_REVIEW only when required evidence is present,
current under the frozen 60-day convention, internally consistent, and
traceable to page-level source boxes; otherwise NEEDS_REVIEW with reasons.

Calibration facts from the gold checklists that shape this logic:
- Reason codes, not missing-document lists, drive the status: households
  with a missing employment letter are still READY when pay stubs document
  the wage source.
- Adversarial text inside a document never changes readiness by itself; it
  is quarantined by the safety layer and noted.
- The 60-day rule is a frozen simulation convention, not a real LIHTC rule.
"""
from __future__ import annotations

from datetime import date, timedelta

from . import config
from .models import (
    Citation,
    DocumentRecord,
    IncomeSource,
    ReviewReason,
    MISSING_HOUSEHOLD_SIZE,
    MISSING_INCOME_EVIDENCE,
    NO_FROZEN_THRESHOLD,
    EMPLOYMENT_RATE_CONFLICT,
    GIG_INCOME_UNCORROBORATED,
    PAY_STUB_TOTAL_CONFLICT,
    UNVERIFIED_INCOME_CLAIM,
    expired_code,
)

READY_TO_REVIEW = "READY_TO_REVIEW"
NEEDS_REVIEW = "NEEDS_REVIEW"

# Which extracted field carries the evidence date, per document type.
DATE_FIELD = {
    "employment_letter": "document_date",
    "benefit_letter": "document_date",
    "pay_stub": "pay_date",
    "gig_statement": "statement_month",
}

_FLAG_DETAIL = {
    PAY_STUB_TOTAL_CONFLICT:
        "Pay evidence totals do not reconcile; a human reviewer must resolve "
        "which recurring amount is documented.",
    GIG_INCOME_UNCORROBORATED:
        "Gig income is documented only by a self-generated statement; "
        "corroborating evidence is required.",
    EMPLOYMENT_RATE_CONFLICT:
        "The employer letter states a different hourly rate than the pay "
        "stub evidence.",
    UNVERIFIED_INCOME_CLAIM:
        "A self-declared income amount has no supporting employer or program "
        "evidence and was not counted.",
}


def _parse_evidence_date(raw) -> date | None:
    """ISO date, or a YYYY-MM statement month taken as its last covered day."""
    if raw is None:
        return None
    text = str(raw).strip()
    try:
        if len(text) == 7:                      # "YYYY-MM" statement month
            year, month = int(text[:4]), int(text[5:7])
            if month == 12:
                return date(year, 12, 31)
            return date(year, month + 1, 1) - timedelta(days=1)
        return date.fromisoformat(text)
    except ValueError:
        return None


def currency_reasons(docs: list[DocumentRecord]) -> list[ReviewReason]:
    """Frozen 60-day currency convention over every dated evidence document.

    One reason per code: several expired documents of the same type merge
    their citations instead of repeating the code."""
    reasons: list[ReviewReason] = []
    by_code: dict[str, ReviewReason] = {}
    for doc in docs:
        field_name = DATE_FIELD.get(doc.document_type)
        if field_name is None:
            continue
        f = doc.get(field_name)
        evidence_date = _parse_evidence_date(f.value if f else None)
        if evidence_date is None:
            continue
        if evidence_date < config.CURRENCY_CUTOFF:
            citation = Citation(
                document_id=doc.document_id, page=f.page,
                bbox=[round(float(v), 2) for v in f.bbox],
                bbox_units=f.bbox_units, field=f.field)
            code = expired_code(doc.document_type)
            if code in by_code:
                by_code[code].citations.append(citation)
                continue
            reason = ReviewReason(
                code=code,
                detail=(f"{doc.document_type} dated {evidence_date.isoformat()} "
                        f"is older than the frozen {config.CURRENCY_DAYS}-day "
                        f"currency convention (cutoff "
                        f"{config.CURRENCY_CUTOFF.isoformat()})."),
                citations=[citation])
            by_code[code] = reason
            reasons.append(reason)
    return reasons


def source_reasons(sources: list[IncomeSource]) -> list[ReviewReason]:
    """Consistency/corroboration flags raised during income derivation."""
    reasons = []
    seen: set[str] = set()
    for source in sources:
        for flag in source.flags:
            if flag in seen:
                continue
            seen.add(flag)
            reasons.append(ReviewReason(
                code=flag,
                detail=_FLAG_DETAIL.get(flag, flag),
                citations=list(source.citations)))
    return reasons


def evaluate_reasons(
    docs: list[DocumentRecord],
    sources: list[IncomeSource],
    household_size: int | None,
    threshold: float | None,
) -> list[ReviewReason]:
    """All review reasons for one household (traceability reasons are added
    separately by the pipeline once citations are assembled)."""
    reasons = source_reasons(sources) + currency_reasons(docs)

    if household_size is None:
        reasons.append(ReviewReason(
            code=MISSING_HOUSEHOLD_SIZE,
            detail="No documented household size; the frozen threshold table "
                   "cannot be applied."))
    elif threshold is None:
        reasons.append(ReviewReason(
            code=NO_FROZEN_THRESHOLD,
            detail=(f"Household size {household_size} is outside the frozen "
                    f"1-8 MTSP table; no frozen threshold exists and a human "
                    f"must apply program guidance.")))

    if not any(s.counted for s in sources):
        reasons.append(ReviewReason(
            code=MISSING_INCOME_EVIDENCE,
            detail="No documented recurring income evidence was found."))

    return reasons


def status_from_reasons(reasons: list[ReviewReason]) -> str:
    return NEEDS_REVIEW if reasons else READY_TO_REVIEW
