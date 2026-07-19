"""Frozen rule corpus access (rules/rule_corpus.jsonl).

Behavior-compatible with starter/src/rules.py (unique rule_id enforcement),
plus citation helpers.  Rule IDs are the citation vocabulary for every
material answer (see evaluation/qa_gold.jsonl).
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from . import config
from .models import Citation

# Well-known rule ids (identifiers, not data values; retained by hidden tests
# because the schemas/corpus are frozen).
HUD_MTSP_EFFECTIVE = "HUD-MTSP-001"
HUD_MTSP_60 = "HUD-MTSP-002"
HUD_MTSP_50 = "HUD-MTSP-003"
HUD_DATA_LIMITS = "HUD-DATA-001"
HUD_GEO = "HUD-GEO-001"
FED_LIHTC = "FED-LIHTC-001"
FED_MONITOR = "FED-MONITOR-001"
CH_INCOME = "CH-INCOME-001"
CH_READINESS = "CH-READINESS-001"
CH_SAFETY = "CH-SAFETY-001"
CH_DECISION = "CH-DECISION-001"


@lru_cache(maxsize=None)
def load_rules(path: str | None = None) -> dict[str, dict]:
    """rule_id -> full rule row; raises on duplicate rule ids."""
    rules: dict[str, dict] = {}
    with open(Path(path) if path else config.RULE_CORPUS, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            if row["rule_id"] in rules:
                raise ValueError(f"Duplicate rule_id: {row['rule_id']}")
            rules[row["rule_id"]] = row
    return rules


def get_rule(rule_id: str) -> dict:
    return load_rules()[rule_id]


def rule_citation(rule_id: str) -> Citation:
    """Citation anchored to a frozen-corpus rule."""
    rule = get_rule(rule_id)
    return Citation(rule_id=rule_id, source_locator=rule.get("source_locator"))
