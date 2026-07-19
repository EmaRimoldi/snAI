"""Block F — submissions scorecard (calculation 25% + readiness 20%).

Runs the pipeline for every household and grades against
evaluation/application_checklists.json: annualized income, frozen
threshold, comparison, readiness status, and the exact review-reason set.
Every submission is also validated against submission.schema.json and the
decision-language lint (both enforced inside the pipeline itself).

Usage: score_submissions.py [gold|extracted]   (default: both)
"""
from __future__ import annotations

import _bootstrap  # noqa: F401
import json
import sys

from realdoor import config
from realdoor.pipeline import run_pack


def score(source: str) -> tuple[int, int]:
    with open(config.CHECKLISTS, encoding="utf-8") as handle:
        checklists = json.load(handle)
    results = run_pack(source=source)

    ok_rows = 0
    print(f"\n=== submissions from {source} documents ===")
    header = (f"{'household':10} {'income':>12} {'threshold':>10} "
              f"{'comparison':>14} {'status':>16}  reasons")
    print(header)
    for expected in checklists:
        hh = expected["household_id"]
        sub = results.get(hh)
        if sub is None:
            print(f"{hh:10} MISSING")
            continue
        our_codes = sorted(r.code for r in sub.review_reasons)
        checks = {
            "income": abs(sub.annualized_income
                          - expected["expected_annualized_income"]) <= 0.01,
            "threshold": sub.frozen_threshold
                         == expected["frozen_60_percent_threshold"],
            "comparison": sub.comparison == expected["comparison"],
            "status": sub.readiness_status
                      == expected["expected_readiness_status"],
            "reasons": our_codes == sorted(expected["expected_review_reasons"]),
        }
        ok = all(checks.values())
        ok_rows += ok
        mark = "PASS" if ok else "FAIL " + ",".join(
            k for k, v in checks.items() if not v)
        print(f"{hh:10} {sub.annualized_income:>12,.2f} "
              f"{sub.frozen_threshold or 0:>10,.0f} {sub.comparison:>14} "
              f"{sub.readiness_status:>16}  {our_codes or '[]'}  [{mark}]")
    print(f"households correct: {ok_rows}/{len(checklists)}")
    return ok_rows, len(checklists)


def main() -> int:
    sources = sys.argv[1:] or ["gold", "extracted"]
    failed = False
    for source in sources:
        ok, n = score(source)
        failed |= ok != n
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
