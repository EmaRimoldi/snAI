import json
from pathlib import Path

def load_rules(path: str | Path):
    with Path(path).open(encoding="utf-8") as f:
        rows = [json.loads(line) for line in f if line.strip()]
    ids = [r["rule_id"] for r in rows]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate rule_id")
    return {r["rule_id"]: r for r in rows}
