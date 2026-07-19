"""Per-document processing-time benchmark.

Times extract_document for every document across all fixture sets, grouped
by processing path (vector / OCR / LLM-backup when enabled), plus the
reasoning pipeline (calc -> readiness -> safety -> submission) per household.
"""
from __future__ import annotations

import _bootstrap  # noqa: F401
import csv
import statistics
import time

from realdoor import config
from realdoor.extract import extract_document
from realdoor.extract import llm_backup
from realdoor.models import load_document_records
from realdoor.pipeline import group_by_household, process_household

SETS = ["official", "dev", "dev2", "dev3", "dev4"]


def _jobs(name):
    if name == "official":
        manifest = config.DOCUMENT_MANIFEST
        docs_dir = config.DOCUMENTS_DIR
    else:
        root = config.PACK_ROOT / name
        manifest = root / "gold" / "document_manifest.csv"
        docs_dir = root / "documents"
    with open(manifest, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            yield (docs_dir / row["file_name"], row["document_id"],
                   row["household_id"], row["document_type"])


def main() -> int:
    timings: dict[str, list[float]] = {"vector": [], "ocr": []}
    extracted = []
    for set_name in SETS:
        if set_name != "official" and not (
                config.PACK_ROOT / set_name / "documents").is_dir():
            continue
        for path, doc_id, hh_id, doc_type in _jobs(set_name):
            start = time.perf_counter()
            doc = extract_document(path, doc_id, hh_id, doc_type)
            elapsed = time.perf_counter() - start
            timings["ocr" if doc.rasterized else "vector"].append(elapsed)
            extracted.append(doc)

    print(f"{'path':10} {'docs':>5} {'mean':>9} {'median':>9} "
          f"{'min':>8} {'max':>8}")
    for path_name, values in timings.items():
        if not values:
            continue
        print(f"{path_name:10} {len(values):>5} "
              f"{statistics.mean(values):>8.2f}s "
              f"{statistics.median(values):>8.2f}s "
              f"{min(values):>7.2f}s {max(values):>7.2f}s")
    if llm_backup.enabled():
        print("(LLM backup was ENABLED: times above include model calls "
              "for documents with missing fields)")

    # Reasoning pipeline per household, from already-extracted records.
    grouped = group_by_household(extracted)
    start = time.perf_counter()
    for hh, docs in grouped.items():
        process_household(hh, docs)
    per_household = (time.perf_counter() - start) / max(len(grouped), 1)
    print(f"\nreasoning pipeline (calc+readiness+safety+schema): "
          f"{per_household * 1000:.1f} ms/household over {len(grouped)} "
          f"households")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
