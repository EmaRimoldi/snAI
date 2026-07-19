"""RealDoor CLI: staged pipeline with editable intermediate artifacts.

    extract   PDFs -> extraction artifact (documents + fields + boxes +
              confidence + source).  Runs OCR/matching/LLM tiers ONCE.
              The artifact is plain JSON a frontend can edit: fix a value,
              add a missing field, delete a wrong one (set "source":
              "human" on edited fields by convention).
    validate  extraction artifact -> submissions: desired values (income,
              threshold, comparison, readiness), errors/inconsistencies
              (review reasons with citations), security events.  Pure and
              fast (~ms/household) -- rerun after every edit.
    run       extract + validate in one shot (single-upload convenience).

Examples:
    python -m realdoor.cli extract upload1.pdf upload2.pdf --out extraction.json
    python -m realdoor.cli validate extraction.json --out result.json
    python -m realdoor.cli run *.pdf --household-id HH-X

Configuration: realdoor.config.json (+ env overrides, see settings.py).
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

from . import settings
from .extract.batch import batch_extract
from .extract.vector import vector_tokens
from .models import DocumentRecord
from .pipeline import group_by_household, process_household

_TYPE_KEYWORDS = [
    ("pay_stub", ("pay stub", "paystub", "payroll", "pay record",
                  "pay statement", "wage")),
    ("employment_letter", ("employment", "employer", "verification letter")),
    ("benefit_letter", ("benefit",)),
    ("gig_statement", ("gig", "receipts", "platform")),
    ("application_summary", ("application", "summary", "intake",
                             "applicant")),
]
_FILENAME_HINTS = [
    ("pay_stub", ("stub", "pay")),
    ("employment_letter", ("employment", "letter")),
    ("benefit_letter", ("benefit",)),
    ("gig_statement", ("gig",)),
    ("application_summary", ("application", "summary", "intake")),
]


def infer_document_type(pdf_path: Path) -> str:
    name = pdf_path.stem.lower()
    for doc_type, hints in _FILENAME_HINTS:
        if any(h in name for h in hints):
            return doc_type
    tokens, _ = vector_tokens(pdf_path)
    head = " ".join(t.text for t in tokens[:40]).lower()
    best, best_hits = "application_summary", 0
    for doc_type, keywords in _TYPE_KEYWORDS:
        hits = sum(head.count(k) for k in keywords)
        if hits > best_hits:
            best, best_hits = doc_type, hits
    return best


def _build_jobs(args) -> list[tuple]:
    if args.manifest:
        rows = list(csv.DictReader(open(args.manifest, encoding="utf-8")))
        base = Path(args.manifest).parent
        return [((Path(r["file_name"]) if Path(r["file_name"]).is_absolute()
                  else base / r["file_name"]),
                 r["document_id"], r["household_id"], r["document_type"],
                 r["file_name"]) for r in rows]
    jobs = []
    for index, pdf in enumerate(args.pdfs, start=1):
        path = Path(pdf)
        doc_type = args.type or infer_document_type(path)
        jobs.append((path, f"{args.household_id}-D{index:02d}",
                     args.household_id, doc_type, path.name))
    return jobs


def _emit(payload: dict, args) -> None:
    text = json.dumps(payload, indent=None if args.compact else 2)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
        print(f"wrote {args.out} ({len(text)} bytes)", file=sys.stderr)
    else:
        print(text)


def cmd_extract(args) -> dict:
    """PDFs -> extraction artifact (the editable intermediate)."""
    jobs = _build_jobs(args)
    missing = [str(p) for p, *_ in jobs if not Path(p).exists()]
    if missing:
        raise SystemExit(f"not found: {', '.join(missing)}")
    docs, stats = batch_extract(jobs, max_workers=args.workers)
    return {
        "artifact": "realdoor.extraction",
        "config": settings.summary(),
        "stats": {
            "documents": stats.documents,
            "tokenize_seconds": round(stats.tokenize_seconds, 3),
            "match_seconds": round(stats.match_seconds, 3),
            "llm_seconds": round(stats.llm_seconds, 3),
            "llm_calls": stats.llm_calls,
            "workers": stats.workers,
        },
        "documents": [doc.to_dict() for doc in docs],
    }


def load_documents(artifact: dict) -> list[DocumentRecord]:
    return [DocumentRecord.from_gold_row(row)
            for row in artifact["documents"]]


def cmd_validate(artifact: dict) -> dict:
    """Extraction artifact (possibly human-edited) -> rule validation.

    Deterministic and fast: desired values, errors/inconsistencies as
    review reasons with citations, security events.  Rerun at will."""
    docs = load_documents(artifact)
    submissions = {hh: process_household(hh, hh_docs)
                   for hh, hh_docs in sorted(
                       group_by_household(docs).items())}
    return {
        "artifact": "realdoor.validation",
        "config": settings.summary(),
        "submissions": [sub.to_dict() for sub in submissions.values()],
        "issues": [
            {"household_id": sub.household_id,
             "readiness_status": sub.readiness_status,
             "review_reasons": [r.to_dict() for r in sub.review_reasons],
             "security_events": list(sub.security_events)}
            for sub in submissions.values()
        ],
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="realdoor")
    sub = parser.add_subparsers(dest="command", required=True)

    def add_extract_args(p):
        p.add_argument("pdfs", nargs="*", help="PDF files (one household)")
        p.add_argument("--manifest", help="CSV manifest for multi-household "
                       "batches (document_id,household_id,document_type,"
                       "file_name)")
        p.add_argument("--household-id", default="UPLOAD-001")
        p.add_argument("--type", choices=[t for t, _ in _TYPE_KEYWORDS])
        p.add_argument("--workers", type=int, default=None)
        p.add_argument("--out")
        p.add_argument("--compact", action="store_true")

    add_extract_args(sub.add_parser(
        "extract", help="PDFs -> editable extraction artifact"))
    v = sub.add_parser("validate",
                       help="extraction artifact -> rule validation")
    v.add_argument("artifact", help="extraction artifact JSON (or a 'run' "
                   "output containing documents)")
    v.add_argument("--out")
    v.add_argument("--compact", action="store_true")
    add_extract_args(sub.add_parser(
        "run", help="extract + validate in one shot"))

    args = parser.parse_args(argv)
    if args.command == "extract":
        if not args.pdfs and not args.manifest:
            parser.error("give PDF files or --manifest")
        _emit(cmd_extract(args), args)
    elif args.command == "validate":
        artifact = json.loads(Path(args.artifact).read_text(encoding="utf-8"))
        _emit(cmd_validate(artifact), args)
    else:  # run
        if not args.pdfs and not args.manifest:
            parser.error("give PDF files or --manifest")
        extraction = cmd_extract(args)
        validation = cmd_validate(extraction)
        _emit({**extraction, "artifact": "realdoor.result",
               "submissions": validation["submissions"],
               "issues": validation["issues"]}, args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
