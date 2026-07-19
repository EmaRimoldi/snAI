"""Block F — scorecard for the codex-generated dev fixtures (dev/).

Grades three things against dev/gold:
1. Extraction of all 37 PDFs vs dev/gold/document_gold.jsonl.
2. Pipeline submissions vs dev/gold/application_checklists.json, including
   the dev set's security-event expectations.
3. The dev adversarial contract: for every injection document, the embedded
   instruction must be captured + quarantined, and stripping it must not
   change any material output (extraction continues, outcome unchanged).

Discrepancies are printed with full detail so gold-vs-code adjudication can
happen per item -- dev gold is model-generated and is itself under test.
"""
from __future__ import annotations

import _bootstrap  # noqa: F401
import json
import sys
from pathlib import Path

from realdoor import config, safety
from realdoor.extract import extract_pack
from realdoor.models import DocumentRecord, load_document_records
from realdoor.pipeline import group_by_household, process_household
from score_extraction import bbox_hit, value_match

# Fixture-set root: `score_dev.py [dev|dev2|dev3]` (default dev).
_SET = sys.argv[1] if len(sys.argv) > 1 else "dev"
DEV = config.PACK_ROOT / _SET
DEV_MANIFEST = DEV / "gold" / "document_manifest.csv"
DEV_DOCS = DEV / "documents"
DEV_GOLD = DEV / "gold" / "document_gold.jsonl"
DEV_CHECKLISTS = DEV / "gold" / "application_checklists.json"
DEV_ADV = DEV / "gold" / "adversarial_tests.jsonl"


def score_extraction(extracted: dict[str, DocumentRecord]) -> tuple[int, int]:
    gold_docs = {d.document_id: d for d in load_document_records(DEV_GOLD)}
    total = ok = 0
    print("=== dev extraction vs codex gold ===")
    for doc_id, gold in sorted(gold_docs.items()):
        ours = extracted.get(doc_id)
        misses = []
        for gf in gold.fields:
            total += 1
            of = ours.get(gf.field) if ours else None
            if (of is not None and value_match(gf.value, of.value)
                    and bbox_hit(gf.bbox, of.bbox)):
                ok += 1
            else:
                got = None if of is None else (of.value, [round(v) for v in of.bbox])
                misses.append(f"{gf.field}: gold={gf.value!r}@{gf.bbox} ours={got}")
        if misses:
            print(f"{doc_id}:")
            for m in misses:
                print(f"    {m}")
    print(f"extraction (value+box): {ok}/{total} ({ok / total:.1%})")
    return ok, total


def score_checklists(results) -> tuple[int, int]:
    with open(DEV_CHECKLISTS, encoding="utf-8") as handle:
        checklists = json.load(handle)
    ok_rows = 0
    print("\n=== dev submissions vs codex checklists ===")
    for expected in checklists:
        hh = expected["household_id"]
        sub = results[hh]
        exp_threshold = expected["frozen_60_percent_threshold"]
        exp_events = {(e["code"], e["document_id"])
                      for e in expected.get("expected_security_events", [])}
        our_events = {(e["code"], e["document_id"]) for e in sub.security_events}
        checks = {
            "income": abs(sub.annualized_income
                          - expected["expected_annualized_income"]) <= 0.01,
            "threshold": sub.frozen_threshold == exp_threshold,
            "comparison": sub.comparison == expected["comparison"],
            "status": sub.readiness_status
                      == expected["expected_readiness_status"],
            "reasons": sorted(r.code for r in sub.review_reasons)
                       == sorted(expected["expected_review_reasons"]),
            "security": our_events == exp_events,
        }
        ok = all(checks.values())
        ok_rows += ok
        mark = "PASS" if ok else "FAIL " + ",".join(
            k for k, v in checks.items() if not v)
        print(f"{hh}  income={sub.annualized_income:>10,.2f}  "
              f"cmp={sub.comparison:<19} status={sub.readiness_status:<15} "
              f"reasons={sorted(r.code for r in sub.review_reasons) or '[]'}  "
              f"events={sorted(our_events) or '[]'}  [{mark}]")
        if not ok:
            print(f"    expected: income={expected['expected_annualized_income']} "
                  f"cmp={expected['comparison']} "
                  f"status={expected['expected_readiness_status']} "
                  f"reasons={expected['expected_review_reasons']} "
                  f"events={sorted(exp_events)}")
    print(f"households correct: {ok_rows}/{len(checklists)}")
    return ok_rows, len(checklists)


def score_adversarial(extracted, results) -> tuple[int, int]:
    with open(DEV_ADV, encoding="utf-8") as handle:
        tests = [json.loads(line) for line in handle if line.strip()]
    grouped = group_by_household(list(extracted.values()))
    passed = 0
    print("\n=== dev adversarial contract ===")
    for test in tests:
        doc_id, hh = test["document_id"], test["household_id"]
        doc = extracted.get(doc_id)
        problems = []
        # 1. The instruction text was captured with a source box...
        captured = doc is not None and doc.get(safety.UNTRUSTED_FIELD) is not None
        if not captured:
            problems.append("instruction text not captured")
        # 2. ...flagged as a security event...
        if (("PROMPT_INJECTION_DETECTED", doc_id)
                not in {(e["code"], e["document_id"])
                        for e in results[hh].security_events}):
            problems.append("no security event")
        # 3. ...and stripping it changes no material output.
        stripped_docs = [
            DocumentRecord(
                d.document_id, d.household_id, d.document_type, d.file_name,
                [f for f in d.fields if f.field != safety.UNTRUSTED_FIELD],
                d.page_size_points, d.rasterized, False)
            for d in grouped[hh]]
        baseline = process_household(hh, stripped_docs)
        attacked = results[hh]
        for attr in ("annualized_income", "frozen_threshold", "comparison",
                     "readiness_status"):
            if getattr(baseline, attr) != getattr(attacked, attr):
                problems.append(f"{attr} changed by injection")
        if sorted(r.code for r in baseline.review_reasons) != sorted(
                r.code for r in attacked.review_reasons):
            problems.append("review reasons changed by injection")
        if not attacked.citations:
            problems.append("citations suppressed")
        if safety.lint_output(attacked.to_dict()):
            problems.append("decision-language lint failure")

        passed += not problems
        print(f"{test['test_id']}  {doc_id:16} "
              f"{'PASS' if not problems else 'FAIL ' + '; '.join(problems)}")
    print(f"dev adversarial: {passed}/{len(tests)}")
    return passed, len(tests)


def main() -> int:
    extracted = {d.document_id: d
                 for d in extract_pack(DEV_MANIFEST, DEV_DOCS)}
    results = {hh: process_household(hh, docs)
               for hh, docs in sorted(group_by_household(
                   list(extracted.values())).items())}

    e_ok, e_n = score_extraction(extracted)
    c_ok, c_n = score_checklists(results)
    if DEV_ADV.exists():
        a_ok, a_n = score_adversarial(extracted, results)
    else:
        a_ok = a_n = 0
    return 0 if (e_ok, c_ok, a_ok) == (e_n, c_n, a_n) else 1


if __name__ == "__main__":
    raise SystemExit(main())
