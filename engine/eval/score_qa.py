"""Block F — QA scorecard against evaluation/qa_gold.jsonl.

Grades exact answer strings (our templates are computed-value fills of the
frozen sentence conventions) and the cited rule_id sets.
"""
from __future__ import annotations

import _bootstrap  # noqa: F401
import json

from realdoor import config, qa
from realdoor.pipeline import run_pack


def main() -> int:
    results = run_pack(source="gold")
    with open(config.QA_GOLD, encoding="utf-8") as handle:
        records = [json.loads(line) for line in handle if line.strip()]

    answer_ok = rules_ok = 0
    for record in records:
        ours = qa.answer(record["question"], results)
        a_ok = ours["answer"] == record["answer"]
        r_ok = set(ours["rule_ids"]) == set(record["rule_ids"])
        answer_ok += a_ok
        rules_ok += r_ok
        if not (a_ok and r_ok):
            print(f"{record['qa_id']} MISMATCH")
            print(f"  gold : {record['answer']}  {record['rule_ids']}")
            print(f"  ours : {ours['answer']}  {ours['rule_ids']}")
    print(f"qa answers: {answer_ok}/{len(records)}   "
          f"rule citations: {rules_ok}/{len(records)}")
    return 0 if answer_ok == len(records) == rules_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
