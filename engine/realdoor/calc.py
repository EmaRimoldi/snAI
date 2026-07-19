"""Block B — deterministic income + threshold engine (Person 2).

Implements the frozen scoring conventions:

- CH-INCOME-001: annualize *recurring gross* income by its *explicit* pay
  frequency; sum independently documented recurring sources; never infer
  undocumented income.
- HUD-MTSP-002 (via data/mtsp_2026_boston_cambridge_quincy.csv): frozen 60%
  thresholds for household sizes 1-8.  Sizes outside the table have no
  frozen threshold -> comparison "no_frozen_threshold".
- CH-DECISION-001: this module compares numbers; it never labels a person.

``annualize`` and the comparison boundary are behavior-compatible with the
starter reference (starter/src/calculate.py), extended with the
no-frozen-threshold case the starter leaves to participants.

No dollar amount, name, or household-specific branch may appear in this
file: hidden tests perturb values while retaining schemas.
"""
from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

from . import config
from .models import (
    Citation,
    DocumentRecord,
    IncomeSource,
    EMPLOYMENT_RATE_CONFLICT,
    GIG_INCOME_UNCORROBORATED,
    PAY_STUB_TOTAL_CONFLICT,
    UNVERIFIED_INCOME_CLAIM,
)

# Pay periods per year, keyed by the explicit frequency word used in documents
# (same table as the starter reference implementation).
FREQUENCY = {
    "weekly": 52,
    "biweekly": 26,
    "semimonthly": 24,
    "monthly": 12,
    "annual": 1,
}

BELOW_OR_EQUAL = "below_or_equal"
ABOVE = "above"
NO_FROZEN_THRESHOLD_CMP = "no_frozen_threshold"

# Two amounts are "the same money" within a cent.
CENTS = 0.01


def annualize(amount: float, frequency: str) -> float:
    """Annualize a recurring gross amount by its explicit frequency."""
    if frequency not in FREQUENCY:
        raise ValueError(f"Unsupported frequency: {frequency}")
    if amount < 0:
        raise ValueError("Amount cannot be negative")
    return round(amount * FREQUENCY[frequency], 2)


# ---------------------------------------------------------------------------
# Frozen threshold table (loaded from the pack CSV, never hardcoded)
# ---------------------------------------------------------------------------
@lru_cache(maxsize=None)
def threshold_table(csv_path: str | None = None) -> dict[int, float]:
    """household_size -> frozen 60% threshold, from the frozen MTSP CSV."""
    path = Path(csv_path) if csv_path else config.MTSP_CSV
    table: dict[int, float] = {}
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            table[int(row["household_size"])] = float(row["core_challenge_threshold"])
    if not table:
        raise ValueError(f"No thresholds found in {path}")
    return table


def threshold_for(household_size: int | None) -> float | None:
    """Frozen threshold for a household size, or None outside the 1-8 table."""
    if household_size is None:
        return None
    return threshold_table().get(int(household_size))


def compare_to_threshold(annual_income: float, threshold: float | None) -> str:
    """Numeric comparison only (CH-DECISION-001: never an eligibility label)."""
    if annual_income < 0:
        raise ValueError("Income cannot be negative")
    if threshold is None:
        return NO_FROZEN_THRESHOLD_CMP
    if threshold < 0:
        raise ValueError("Threshold cannot be negative")
    return BELOW_OR_EQUAL if annual_income <= threshold else ABOVE


# ---------------------------------------------------------------------------
# Income-source derivation from document evidence
# ---------------------------------------------------------------------------
def _cite(doc: DocumentRecord, field_name: str) -> Citation | None:
    f = doc.get(field_name)
    if f is None:
        return None
    return Citation(
        document_id=doc.document_id,
        page=f.page,
        bbox=[round(float(v), 2) for v in f.bbox],
        bbox_units=f.bbox_units,
        field=f.field,
    )


def _cites(doc: DocumentRecord, *field_names: str) -> list[Citation]:
    return [c for c in (_cite(doc, n) for n in field_names) if c is not None]


def _stub_regular_amount(stub: DocumentRecord) -> tuple[float | None, bool]:
    """(recurring regular gross for one stub, conflict?).

    The recurring wage basis is regular_hours x hourly_rate: pay stubs may
    include one-off variance (overtime) in gross_pay, which is not recurring
    income under CH-INCOME-001.  A gross_pay that does not reconcile with
    the stated regular basis is a total conflict for human review.
    """
    hours = stub.value("regular_hours")
    rate = stub.value("hourly_rate")
    gross = stub.value("gross_pay")
    if hours is not None and rate is not None:
        regular = round(float(hours) * float(rate), 2)
        conflict = gross is not None and abs(float(gross) - regular) > CENTS
        return regular, conflict
    if gross is not None:
        return round(float(gross), 2), False
    return None, False


def derive_wage_source(docs: list[DocumentRecord]) -> IncomeSource | None:
    """Single recurring wage source from pay stubs + employment letter.

    Multiple stubs are repeated samples of the same recurring wage, not
    additive income.  The employment letter (weekly_hours x hourly_rate)
    corroborates the recurring basis; if no stub exists, a letter alone can
    document the wage.
    """
    stubs = [d for d in docs if d.document_type == "pay_stub"]
    letters = [d for d in docs if d.document_type == "employment_letter"]
    flags: list[str] = []
    citations: list[Citation] = []

    # (regular amount, frequency, hourly rate) per usable stub
    per_stub: list[tuple[float, str, float | None]] = []
    for stub in stubs:
        regular, conflict = _stub_regular_amount(stub)
        frequency = stub.value("pay_frequency")
        if regular is None or frequency not in FREQUENCY:
            continue
        rate = stub.value("hourly_rate")
        per_stub.append((regular, frequency,
                         None if rate is None else round(float(rate), 2)))
        citations.extend(_cites(
            stub, "regular_hours", "hourly_rate", "gross_pay", "pay_frequency"))
        if conflict and PAY_STUB_TOTAL_CONFLICT not in flags:
            flags.append(PAY_STUB_TOTAL_CONFLICT)

    # Employer letter: the hourly *rate* is the corroborated quantity.  The
    # letter's weekly hours are an approximate schedule, so hour differences
    # are not conflicts; a different rate is.
    letter_rate = letter_hours = None
    for letter in letters:
        hours = letter.value("weekly_hours")
        rate = letter.value("hourly_rate")
        if rate is not None:
            letter_rate = round(float(rate), 2)
            letter_hours = hours
            citations.extend(_cites(letter, "weekly_hours", "hourly_rate"))
            break

    if per_stub:
        stub_rates = {rate for _, _, rate in per_stub if rate is not None}
        if (letter_rate is not None and stub_rates
                and all(abs(letter_rate - r) > CENTS for r in stub_rates)):
            flags.append(EMPLOYMENT_RATE_CONFLICT)

        annuals = sorted({annualize(amount, freq) for amount, freq, _ in per_stub})
        if len(annuals) > 1:
            # Stubs disagree about the recurring wage itself.
            if PAY_STUB_TOTAL_CONFLICT not in flags:
                flags.append(PAY_STUB_TOTAL_CONFLICT)
            # Prefer a stub whose rate the employer letter corroborates,
            # else the lowest documented figure.
            corroborated = sorted(
                annualize(amount, freq) for amount, freq, rate in per_stub
                if letter_rate is not None and rate is not None
                and abs(rate - letter_rate) <= CENTS)
            annual = corroborated[0] if corroborated else annuals[0]
        else:
            annual = annuals[0]
        amount, frequency, _ = per_stub[0]
        return IncomeSource(
            kind="wages", period_amount=amount, frequency=frequency,
            annual_amount=annual, citations=citations, flags=flags)

    if letter_rate is not None and letter_hours is not None:
        weekly = round(float(letter_hours) * letter_rate, 2)
        return IncomeSource(
            kind="wages", period_amount=weekly, frequency="weekly",
            annual_amount=annualize(weekly, "weekly"),
            citations=citations, flags=flags)

    return None


def derive_benefit_sources(docs: list[DocumentRecord]) -> list[IncomeSource]:
    """One source per benefit letter: benefit amount at its explicit frequency."""
    sources = []
    for doc in (d for d in docs if d.document_type == "benefit_letter"):
        frequency = doc.value("benefit_frequency")
        amount = doc.value(f"{frequency}_benefit") if frequency else None
        if amount is None or frequency not in FREQUENCY:
            continue
        sources.append(IncomeSource(
            kind="benefit",
            period_amount=round(float(amount), 2),
            frequency=frequency,
            annual_amount=annualize(float(amount), frequency),
            citations=_cites(doc, f"{frequency}_benefit", "benefit_frequency"),
        ))
    return sources


def derive_gig_sources(docs: list[DocumentRecord]) -> list[IncomeSource]:
    """One source per gig statement: monthly gross receipts (fees are not
    deducted -- CH-INCOME-001 annualizes recurring *gross* income).  A gig
    statement alone is uncorroborated unless a gig_income_corroboration
    document is also present."""
    have_corroboration = any(
        d.document_type == "gig_income_corroboration" for d in docs)
    sources = []
    for doc in (d for d in docs if d.document_type == "gig_statement"):
        receipts = doc.value("gross_receipts")
        if receipts is None or doc.value("statement_month") is None:
            continue
        flags = [] if have_corroboration else [GIG_INCOME_UNCORROBORATED]
        sources.append(IncomeSource(
            kind="gig",
            period_amount=round(float(receipts), 2),
            frequency="monthly",                    # one statement month
            annual_amount=annualize(float(receipts), "monthly"),
            citations=_cites(doc, "gross_receipts", "statement_month"),
            flags=flags,
        ))
    return sources


def derive_self_declared_sources(docs: list[DocumentRecord]) -> list[IncomeSource]:
    """Self-declared amounts (e.g. on an application summary) are never
    counted as documented income; they surface as UNVERIFIED_INCOME_CLAIM."""
    sources = []
    for doc in (d for d in docs if d.document_type == "application_summary"):
        amount = doc.value("declared_income")
        frequency = doc.value("declared_income_frequency") or "annual"
        if amount is None:
            continue
        sources.append(IncomeSource(
            kind="self_declared",
            period_amount=round(float(amount), 2),
            frequency=frequency,
            annual_amount=0.0,
            citations=_cites(doc, "declared_income"),
            flags=[UNVERIFIED_INCOME_CLAIM],
            counted=False,
        ))
    return sources


def derive_income_sources(docs: list[DocumentRecord]) -> list[IncomeSource]:
    """All documented recurring sources for one household's documents."""
    sources: list[IncomeSource] = []
    wage = derive_wage_source(docs)
    if wage is not None:
        sources.append(wage)
    sources.extend(derive_benefit_sources(docs))
    sources.extend(derive_gig_sources(docs))
    sources.extend(derive_self_declared_sources(docs))
    return sources


def total_annualized_income(sources: list[IncomeSource]) -> float:
    """Sum of counted, independently documented sources (CH-INCOME-001)."""
    return round(sum(s.annual_amount for s in sources if s.counted), 2)
