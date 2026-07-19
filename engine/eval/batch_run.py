"""Batch runner: process whole document sets in parallel, report success
rate and timing.  Guarantees at most ONE LLM call per set batch.

Usage: batch_run.py [set ...] [--workers N]     (default sets: all five)
"""
from __future__ import annotations

import _bootstrap  # noqa: F401
import argparse
import csv
import json
import time

from realdoor import config
from realdoor.extract.batch import batch_extract
from realdoor.extract import llm_backup
from realdoor.models import load_document_records
from realdoor.pipeline import group_by_household, process_household
from score_extraction import bbox_hit, value_match

ALL_SETS = ["official", "dev", "dev2", "dev3", "dev4", "dev5"]
# The first fixture set predates the numbering; accept both spellings.
_ALIASES = {"dev1": "dev", "synthetic_documents": "official"}


def _paths(name):
    if name == "official":
        return (config.DOCUMENT_MANIFEST, config.DOCUMENTS_DIR,
                config.DOCUMENT_GOLD, config.CHECKLISTS)
    root = config.PACK_ROOT / name
    return (root / "gold" / "document_manifest.csv", root / "documents",
            root / "gold" / "document_gold.jsonl",
            root / "gold" / "application_checklists.json")


def _resolve_set(name: str) -> str:
    name = _ALIASES.get(name, name)
    if not _paths(name)[0].exists():
        available = ["official"] + sorted(
            p.name for p in config.PACK_ROOT.glob("dev*")
            if (p / "gold" / "document_manifest.csv").exists())
        raise SystemExit(f"unknown set '{name}' -- available: "
                         f"{', '.join(available)} (dev1 = dev)")
    return name


def run_set(name: str, workers: int | None) -> dict:
    name = _resolve_set(name)
    manifest, docs_dir, gold_path, checklists_path = _paths(name)
    jobs = []
    with open(manifest, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            jobs.append((docs_dir / row["file_name"], row["document_id"],
                         row["household_id"], row["document_type"],
                         row["file_name"]))

    start = time.perf_counter()
    docs, stats = batch_extract(jobs, max_workers=workers)
    grouped = group_by_household(docs)
    sub_start = time.perf_counter()
    submissions = {hh: process_household(hh, hh_docs)
                   for hh, hh_docs in sorted(grouped.items())}
    submissions_seconds = time.perf_counter() - sub_start
    total_seconds = time.perf_counter() - start

    # Extraction success rate vs gold.
    gold = {d.document_id: d for d in load_document_records(gold_path)}
    field_ok = field_total = 0
    for doc in docs:
        for gf in gold[doc.document_id].fields:
            field_total += 1
            of = doc.get(gf.field)
            if (of is not None and value_match(gf.value, of.value)
                    and bbox_hit(gf.bbox, of.bbox)):
                field_ok += 1

    # Household success rate vs checklists.
    with open(checklists_path, encoding="utf-8") as handle:
        checklists = json.load(handle)
    hh_ok = 0
    for expected in checklists:
        sub = submissions.get(expected["household_id"])
        # Official checklists predate security events; compare only when
        # the fixture set defines them.
        events_ok = True
        if "expected_security_events" in expected:
            events_ok = ({(e["code"], e["document_id"])
                          for e in sub.security_events}
                         == {(e["code"], e["document_id"])
                             for e in expected["expected_security_events"]})
        hh_ok += (
            sub is not None
            and abs(sub.annualized_income
                    - expected["expected_annualized_income"]) <= 0.01
            and sub.frozen_threshold == expected["frozen_60_percent_threshold"]
            and sub.comparison == expected["comparison"]
            and sub.readiness_status == expected["expected_readiness_status"]
            and sorted(r.code for r in sub.review_reasons)
                == sorted(expected["expected_review_reasons"])
            and events_ok)

    return {
        "set": name, "docs": len(jobs), "households": len(checklists),
        "field_ok": field_ok, "field_total": field_total,
        "hh_ok": hh_ok,
        "tokenize_s": stats.tokenize_seconds,
        "match_s": stats.match_seconds,
        "llm_s": stats.llm_seconds, "llm_calls": stats.llm_calls,
        "llm_labels": stats.llm_labels_sent,
        "submissions_s": submissions_seconds,
        "total_s": total_seconds, "workers": stats.workers,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("sets", nargs="*", default=ALL_SETS)
    parser.add_argument("--workers", type=int, default=None)
    args = parser.parse_args()

    rows = [run_set(name, args.workers) for name in (args.sets or ALL_SETS)]
    print(f"{'set':9} {'docs':>4} {'extraction':>12} {'households':>10} "
          f"{'total':>7} {'tokenize':>9} {'match':>7} {'llm':>7} "
          f"{'calls':>5} {'ms/doc':>7}")
    ok = True
    for r in rows:
        extraction = f"{r['field_ok']}/{r['field_total']}"
        households = f"{r['hh_ok']}/{r['households']}"
        ok &= (r["field_ok"] == r["field_total"]
               and r["hh_ok"] == r["households"] and r["llm_calls"] <= 2)   # <=1 per LLM tier
        print(f"{r['set']:9} {r['docs']:>4} {extraction:>12} "
              f"{households:>10} {r['total_s']:>6.2f}s "
              f"{r['tokenize_s']:>8.2f}s {r['match_s']:>6.2f}s "
              f"{r['llm_s']:>6.2f}s {r['llm_calls']:>5} "
              f"{r['total_s'] / r['docs'] * 1000:>6.0f}")
    total_docs = sum(r["docs"] for r in rows)
    total_time = sum(r["total_s"] for r in rows)
    print("-" * 88)
    print(f"{'TOTAL':9} {total_docs:>4} "
          f"{sum(r['field_ok'] for r in rows)}/"
          f"{sum(r['field_total'] for r in rows):>4} "
          f"{sum(r['hh_ok'] for r in rows)}/"
          f"{sum(r['households'] for r in rows):>3} "
          f"{total_time:>6.2f}s   (workers={rows[0]['workers']}, "
          f"llm calls={sum(r['llm_calls'] for r in rows)}, "
          f"llm backup {'on' if llm_backup.enabled() else 'OFF'})")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
