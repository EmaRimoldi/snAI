"""Confidence calibration: are the reported confidences meaningful?

Runs extraction over every fixture set, compares each EMITTED field against
gold, and reports measured accuracy per confidence bucket and per source
(rules vs llm).  A meaningful confidence should be monotone: higher buckets
more accurate.  Also reports coverage (gold fields emitted at all), since
dropped fields are the complement of precision.

Run with REALDOOR_LLM_BACKUP=0 for the deterministic-only calibration.
"""
from __future__ import annotations

import _bootstrap  # noqa: F401
import csv
from collections import defaultdict

from realdoor import config
from realdoor.extract import extract_pack
from realdoor.extract import llm_backup
from realdoor.models import load_document_records
from score_extraction import bbox_hit, value_match

SETS = ["official", "dev", "dev2", "dev3", "dev4"]


def _paths(name):
    if name == "official":
        return (config.DOCUMENT_MANIFEST, config.DOCUMENTS_DIR,
                config.DOCUMENT_GOLD)
    root = config.PACK_ROOT / name
    return (root / "gold" / "document_manifest.csv", root / "documents",
            root / "gold" / "document_gold.jsonl")


def main() -> int:
    buckets = defaultdict(lambda: [0, 0])     # (source, band) -> [ok, n]
    emitted = correct = gold_total = 0
    for set_name in SETS:
        manifest, docs_dir, gold_path = _paths(set_name)
        if not manifest.exists():
            continue
        gold = {d.document_id: d for d in load_document_records(gold_path)}
        for doc in extract_pack(manifest, docs_dir):
            gold_doc = gold.get(doc.document_id)
            gold_fields = ({f.field: f for f in gold_doc.fields}
                           if gold_doc else {})
            gold_total += len(gold_fields)
            for f in doc.fields:
                gf = gold_fields.get(f.field)
                ok = (gf is not None and value_match(gf.value, f.value)
                      and bbox_hit(gf.bbox, f.bbox))
                band = round(f.confidence * 10) / 10   # 0.1-wide buckets
                key = (f.source, band)
                buckets[key][0] += ok
                buckets[key][1] += 1
                emitted += 1
                correct += ok

    print(f"{'source':7} {'conf band':>9} {'n':>5} {'accuracy':>9}")
    for (source, band), (ok, n) in sorted(buckets.items(),
                                          key=lambda kv: (kv[0][0],
                                                          -kv[0][1])):
        print(f"{source:7} {band:>9.1f} {n:>5} {ok / n:>8.1%}")
    print("-" * 34)
    print(f"emitted-field precision: {correct}/{emitted} "
          f"({correct / max(emitted, 1):.1%})")
    print(f"gold coverage:           {correct}/{gold_total} "
          f"({correct / max(gold_total, 1):.1%})")
    print(f"llm backup: {'ENABLED' if llm_backup.enabled() else 'disabled'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
