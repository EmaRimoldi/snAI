import json
from pathlib import Path

def load_gold(path: str | Path):
    with Path(path).open(encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]

def validate_boxes(rows):
    errors = []
    for row in rows:
        width, height = row["page_size_points"]
        for field in row["fields"]:
            x1, y1, x2, y2 = field["bbox"]
            if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
                errors.append((row["document_id"], field["field"], field["bbox"]))
    return errors
