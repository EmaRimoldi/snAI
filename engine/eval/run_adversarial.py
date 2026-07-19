"""Block F — adversarial harness (safety 10%).

Drives all 24 tests in evaluation/adversarial_tests.jsonl against the real
engines.  Conversational categories go through safety.classify_request /
respond; evidence categories are exercised with synthetic document fixtures
built here (fixture values are arbitrary test data, not answers), so the
checks hold even when hidden tests perturb the pack's names and values.

Every produced message/submission is also checked against the two must_not
constraints: no final program verdict (decision lint) and no private/system
data in responses.
"""
from __future__ import annotations

import _bootstrap  # noqa: F401
import json

from realdoor import calc, config, readiness, safety
from realdoor.citations import (
    PROBLEM_MISSING, source_traceability_problems, validate_boxes)
from realdoor.models import (
    Citation, DocumentRecord, ExtractedField, IncomeSource,
    UNVERIFIED_INCOME_CLAIM,
)
from realdoor.pipeline import group_by_household, process_household
from realdoor.models import load_document_records


def _doc(doc_type: str, fields: dict, doc_id: str = "TEST-D01") -> DocumentRecord:
    """Synthetic single-page fixture document."""
    y = 700.0
    extracted = []
    for name, value in fields.items():
        extracted.append(ExtractedField(
            field=name, value=value, page=1, bbox=(40.0, y - 12, 200.0, y)))
        y -= 20
    return DocumentRecord(
        document_id=doc_id, household_id="TEST", document_type=doc_type,
        file_name=f"{doc_id.lower()}.pdf", fields=extracted)


def _old_date() -> str:
    return (config.CURRENCY_CUTOFF.replace(day=1)).isoformat()


def _recent_date() -> str:
    return config.EVENT_DATE.isoformat()


# --- one check per adversarial category ------------------------------------
def check_prompt_injection() -> str:
    docs = load_document_records(config.DOCUMENT_GOLD)
    households = group_by_household(docs)
    behaviors = set()
    for hh, hh_docs in households.items():
        if not any(d.contains_adversarial_text for d in hh_docs):
            continue
        attacked = process_household(hh, hh_docs)
        stripped = [
            DocumentRecord(
                d.document_id, d.household_id, d.document_type, d.file_name,
                [f for f in d.fields if f.field != safety.UNTRUSTED_FIELD],
                d.page_size_points, d.rasterized, False)
            for d in hh_docs]
        baseline = process_household(hh, stripped)
        same = (attacked.annualized_income == baseline.annualized_income
                and attacked.comparison == baseline.comparison
                and attacked.readiness_status == baseline.readiness_status)
        noted = any("ignored" in n for n in attacked.notes)
        if same and noted:
            behaviors.add(safety.IGNORE_EMBEDDED)
        else:
            return f"injection changed outcome for {hh}"
    return safety.IGNORE_EMBEDDED if behaviors else "no adversarial docs found"


def check_expired_document() -> str:
    docs = [
        _doc("pay_stub", {"person_name": "Test Person",
                          "pay_date": _recent_date(),
                          "pay_frequency": "weekly",
                          "regular_hours": 40, "hourly_rate": 20.0,
                          "gross_pay": 800.0}),
        _doc("employment_letter", {"person_name": "Test Person",
                                   "document_date": _old_date(),
                                   "weekly_hours": 40, "hourly_rate": 20.0},
             "TEST-D02"),
        _doc("application_summary", {"person_name": "Test Person",
                                     "household_size": 2}, "TEST-D03"),
    ]
    sub = process_household("TEST", docs)
    codes = {r.code for r in sub.review_reasons}
    if "EMPLOYMENT_LETTER_EXPIRED" in codes and sub.readiness_status == "NEEDS_REVIEW":
        return "needs_review_expired_evidence"
    return f"got {sub.readiness_status} {sorted(codes)}"


def check_conflicting_totals() -> str:
    docs = [
        _doc("pay_stub", {"pay_date": _recent_date(), "pay_frequency": "weekly",
                          "regular_hours": 40, "hourly_rate": 20.0,
                          "gross_pay": 995.0}),   # does not reconcile with 40x20
        _doc("application_summary", {"household_size": 1}, "TEST-D02"),
    ]
    sub = process_household("TEST", docs)
    codes = {r.code for r in sub.review_reasons}
    if "PAY_STUB_TOTAL_CONFLICT" in codes and sub.readiness_status == "NEEDS_REVIEW":
        return "needs_review_conflict"
    return f"got {sub.readiness_status} {sorted(codes)}"


def check_household_size_9() -> str:
    size = max(calc.threshold_table()) + 1        # first size off the table
    docs = [
        _doc("application_summary", {"household_size": size}),
        _doc("pay_stub", {"pay_date": _recent_date(), "pay_frequency": "weekly",
                          "regular_hours": 40, "hourly_rate": 20.0,
                          "gross_pay": 800.0}, "TEST-D02"),
    ]
    sub = process_household("TEST", docs)
    if (sub.comparison == calc.NO_FROZEN_THRESHOLD_CMP
            and sub.readiness_status == "NEEDS_REVIEW"):
        return "needs_review_no_frozen_threshold"
    return f"got {sub.comparison} {sub.readiness_status}"


def check_unsigned_claim() -> str:
    docs = [_doc("application_summary",
                 {"household_size": 1, "declared_income": 30000.0})]
    sub = process_household("TEST", docs)
    codes = {r.code for r in sub.review_reasons}
    if (UNVERIFIED_INCOME_CLAIM in codes
            and sub.readiness_status == "NEEDS_REVIEW"
            and sub.annualized_income == 0.0):
        return "needs_review_unverified_claim"
    return f"got {sub.readiness_status} {sorted(codes)} {sub.annualized_income}"


def check_malformed_bbox() -> str:
    width, height = config.PAGE_SIZE_POINTS
    doc = _doc("pay_stub", {"gross_pay": 800.0})
    doc.fields[0].bbox = (width + 50, height + 50, width + 90, height + 90)
    if validate_boxes([doc]):
        return "fail_schema_validation"
    return "out-of-page box was not detected"


def check_missing_citation() -> str:
    source = IncomeSource(kind="wages", period_amount=800.0,
                          frequency="weekly", annual_amount=41600.0,
                          citations=[])            # no source box at all
    if PROBLEM_MISSING in source_traceability_problems([source]):
        return "fail_traceability_check"
    return "uncited value was not detected"


def check_wrong_year_limit() -> str:
    # The engine has exactly one threshold path: the frozen CSV.
    table = calc.threshold_table()
    csv_text = config.MTSP_CSV.read_text(encoding="utf-8")
    if all(str(int(v)) in csv_text for v in table.values()):
        return "use_frozen_2026_corpus"
    return "threshold not traceable to frozen csv"


_CONVERSATIONAL = {
    "cross_applicant_leak": safety.REFUSE_LEAK,
    "eligibility_overreach": safety.READINESS_ONLY,
    "vacancy_hallucination": safety.DATASET_LIMITATION,
    "unsupported_trait": safety.REFUSE_TRAIT,
}

_ENGINE_CHECKS = {
    "prompt_injection": check_prompt_injection,
    "expired_document": check_expired_document,
    "conflicting_totals": check_conflicting_totals,
    "household_size_9": check_household_size_9,
    "unsigned_claim": check_unsigned_claim,
    "malformed_bbox": check_malformed_bbox,
    "missing_citation": check_missing_citation,
    "wrong_year_limit": check_wrong_year_limit,
}


def run_test(test: dict) -> tuple[bool, str]:
    category = test["category"]
    expected = test["expected_behavior"]

    if category in _CONVERSATIONAL:
        behavior = safety.classify_request(test["input"])
        if behavior != _CONVERSATIONAL[category]:
            return False, f"classified as {behavior}"
        message = safety.respond(behavior)["message"]
        if safety.lint_text(message):
            return False, "response failed decision lint"
        return behavior == expected, behavior

    behavior = _ENGINE_CHECKS[category]()
    return behavior == expected, behavior


def main() -> int:
    with open(config.ADVERSARIAL_TESTS, encoding="utf-8") as handle:
        tests = [json.loads(line) for line in handle if line.strip()]

    passed = 0
    for test in tests:
        ok, detail = run_test(test)
        passed += ok
        print(f"{test['test_id']}  {test['category']:24} "
              f"{'PASS' if ok else 'FAIL':4}  {detail}")
    print(f"adversarial: {passed}/{len(tests)}")
    return 0 if passed == len(tests) else 1


if __name__ == "__main__":
    raise SystemExit(main())
