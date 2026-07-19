"""Frozen challenge constants and pack file locations (Block 0).

Everything here is either (a) explicitly frozen by the challenge rules
(event date, 60-day currency window, page geometry) or (b) a path into the
read-only starter pack.  Nothing else in the codebase may hardcode data
values: thresholds, names and amounts must always come from the pack files,
because hidden tests perturb names/values while retaining the schemas.
"""
from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path

# --- frozen challenge conventions (rules/rule_corpus.jsonl, participant guide)
EVENT_DATE = date(2026, 7, 18)            # frozen "today" for the simulation
CURRENCY_DAYS = 60                        # evidence older than this is not current
CURRENCY_CUTOFF = EVENT_DATE - timedelta(days=CURRENCY_DAYS)
PAGE_SIZE_POINTS = (612.0, 792.0)         # US Letter, PDF points
BBOX_UNITS = "pdf_points_bottom_left_origin"

# --- pack layout: the engine is self-contained -- frozen corpus and all
#     fixture sets live under engine/tests/fixtures (override with
#     REALDOOR_PACK_ROOT to point at a full starter-pack checkout)
PACK_ROOT = Path(os.environ.get(
    "REALDOOR_PACK_ROOT",
    str(Path(__file__).resolve().parents[1] / "tests" / "fixtures"),
))

MTSP_CSV = PACK_ROOT / "data" / "mtsp_2026_boston_cambridge_quincy.csv"
RULE_CORPUS = PACK_ROOT / "rules" / "rule_corpus.jsonl"
DOCUMENTS_DIR = PACK_ROOT / "synthetic_documents" / "documents"
DOCUMENT_GOLD = PACK_ROOT / "synthetic_documents" / "gold" / "document_gold.jsonl"
DOCUMENT_MANIFEST = PACK_ROOT / "synthetic_documents" / "gold" / "document_manifest.csv"
FIELD_SCHEMA = PACK_ROOT / "synthetic_documents" / "gold" / "field_schema.json"
SUBMISSION_SCHEMA = PACK_ROOT / "starter" / "schemas" / "submission.schema.json"
CHECKLISTS = PACK_ROOT / "evaluation" / "application_checklists.json"
QA_GOLD = PACK_ROOT / "evaluation" / "qa_gold.jsonl"
ADVERSARIAL_TESTS = PACK_ROOT / "evaluation" / "adversarial_tests.jsonl"
