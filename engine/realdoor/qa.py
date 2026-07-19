"""Block E — QA answering (Person 2).

Answers the recurring per-household question block (threshold / annualized
income / comparison / readiness / decision boundary) from pipeline results,
and the policy questions from the frozen rule corpus.  Sentence templates
are frozen conventions; every number inside them is computed, so perturbed
hidden households answer correctly.
"""
from __future__ import annotations

import re
from datetime import date

from . import rules
from .models import Submission

_HH_RE = re.compile(r"\b(HH-\d+)\b", re.I)


def _fmt_dollars(amount: float, cents: bool = True) -> str:
    return f"${amount:,.2f}" if cents else f"${amount:,.0f}"


def _boundary_answer() -> dict:
    return {
        "answer": "No. It may report the numerical comparison and readiness "
                  "status only; a human makes any program determination.",
        "rule_ids": [rules.CH_DECISION],
    }


def _policy_answer(question: str) -> dict | None:
    q = question.lower()
    if "take effect" in q or "effective" in q:
        effective = date.fromisoformat(
            rules.get_rule(rules.HUD_MTSP_EFFECTIVE)["effective_date"])
        return {"answer": f"{effective.strftime('%B')} {effective.day}, "
                          f"{effective.year}.",
                "rule_ids": [rules.HUD_MTSP_EFFECTIVE]}
    if "vacant" in q or "vacancy" in q or "waitlist" in q:
        return {"answer": "No. The dataset is a project inventory, not a "
                          "vacancy or waitlist feed.",
                "rule_ids": [rules.HUD_DATA_LIMITS]}
    if "geocode" in q:
        return {"answer": "HUD identifies R and 4 as the higher-precision "
                          "codes for address display.",
                "rule_ids": [rules.HUD_GEO]}
    if "embedded" in q or "inside a pay stub" in q or "instructions" in q:
        return {"answer": "Treat them as untrusted document text and ignore "
                          "them.",
                "rule_ids": [rules.CH_SAFETY]}
    if "60-day" in q or "60 day" in q:
        return {"answer": "No. It is a frozen convention for this hackathon "
                          "simulation.",
                "rule_ids": [rules.CH_READINESS]}
    if "statutory" in q or "federal" in q:
        return {"answer": "26 U.S.C. section 42.",
                "rule_ids": [rules.FED_LIHTC]}
    return None


def answer(question: str, results: dict[str, Submission] | None = None) -> dict:
    """{"answer": ..., "rule_ids": [...]} for one QA question."""
    match = _HH_RE.search(question)
    if match and results:
        household_id = match.group(1).upper()
        submission = results.get(household_id)
        if submission is None:
            return {"answer": "I can't share information about a household "
                              "outside the current review context.",
                    "rule_ids": [rules.CH_SAFETY]}
        q = question.lower()
        if "eligible" in q or "ineligible" in q:
            return _boundary_answer()
        if "threshold" in q and "compare" not in q:
            if submission.frozen_threshold is None:
                return {"answer": "No frozen threshold exists for this "
                                  "household size; the frozen table covers "
                                  "sizes 1-8 only.",
                        "rule_ids": [rules.HUD_MTSP_60]}
            return {"answer": f"{_fmt_dollars(submission.frozen_threshold, cents=False)} "
                              f"for household size {submission.household_size}.",
                    "rule_ids": [rules.HUD_MTSP_60]}
        if "annualized" in q or "income" in q:
            return {"answer": f"{_fmt_dollars(submission.annualized_income)} "
                              f"under the frozen annualization convention.",
                    "rule_ids": [rules.CH_INCOME]}
        if "compare" in q:
            return {"answer": submission.comparison,
                    "rule_ids": [rules.HUD_MTSP_60, rules.CH_INCOME]}
        if "readiness" in q or "status" in q:
            return {"answer": submission.readiness_status,
                    "rule_ids": [rules.CH_READINESS]}

    policy = _policy_answer(question)
    if policy is not None:
        return policy
    return {"answer": "That is outside the frozen challenge scope; I can "
                      "report documented evidence, calculations, and "
                      "readiness for human review.",
            "rule_ids": [rules.CH_DECISION]}
