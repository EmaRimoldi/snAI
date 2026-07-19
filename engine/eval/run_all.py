"""Block F — full scorecard across every scored dimension.

Runs extraction, submissions (gold + extracted), QA, and adversarial
harnesses and prints one weighted summary -- the "what works and what does
not" view.
"""
from __future__ import annotations

import _bootstrap  # noqa: F401
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# (script, args, scoring dimension, weight)
STAGES = [
    ("score_extraction.py", [], "extraction", 35),
    ("score_submissions.py", [], "calculation + readiness", 45),
    ("score_qa.py", [], "qa + citations", 10),
    ("run_adversarial.py", [], "safety / adversarial", 10),
]


def main() -> int:
    results = []
    for script, args, dimension, weight in STAGES:
        print("=" * 72)
        print(f"### {dimension} ({weight}%)  --  {script}")
        print("=" * 72)
        proc = subprocess.run([sys.executable, str(HERE / script), *args])
        results.append((dimension, weight, proc.returncode == 0))

    print("\n" + "=" * 72)
    print("SCORECARD")
    for dimension, weight, ok in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {dimension:28} ({weight}%)")
    return 0 if all(ok for _, _, ok in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
