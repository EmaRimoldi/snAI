"""Block F — extraction scorecard (35% dimension).

Runs the real extractor over every pack PDF and grades it against
synthetic_documents/gold/document_gold.jsonl:

- value accuracy: numeric within $0.01 / normalized string equality
- bbox hit: extracted box center inside the (slightly padded) gold box,
  or IoU >= 0.5 -- gold boxes carry fixed padding, so center containment
  is the primary signal and IoU is reported as information.
"""
from __future__ import annotations

import _bootstrap  # noqa: F401
import re

from realdoor import config
from realdoor.citations import validate_boxes
from realdoor.extract import extract_pack
from realdoor.models import load_document_records

PAD = 2.0


# Typographic vs ASCII punctuation is a rendering detail, not an extraction
# error (e.g. dev fixtures render ' as U+2019 while their gold keeps ASCII).
_PUNCT = str.maketrans({"’": "'", "‘": "'", "“": '"',
                        "”": '"', "–": "-", "—": "-",
                        " ": " "})


def value_match(gold, ours) -> bool:
    if isinstance(gold, (int, float)) and isinstance(ours, (int, float)):
        return abs(float(gold) - float(ours)) <= 0.01
    if isinstance(gold, str) and isinstance(ours, str):
        norm = lambda s: re.sub(r"\s+", " ", s.translate(_PUNCT)).strip().casefold()
        return norm(gold) == norm(ours)
    return False


def iou(a, b) -> float:
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    if inter <= 0:
        return 0.0
    area = lambda r: (r[2] - r[0]) * (r[3] - r[1])
    return inter / (area(a) + area(b) - inter)


def bbox_hit(gold_box, our_box) -> bool:
    cx = (our_box[0] + our_box[2]) / 2
    cy = (our_box[1] + our_box[3]) / 2
    padded = (gold_box[0] - PAD, gold_box[1] - PAD,
              gold_box[2] + PAD, gold_box[3] + PAD)
    if padded[0] <= cx <= padded[2] and padded[1] <= cy <= padded[3]:
        return True
    return iou(gold_box, our_box) >= 0.5


def main() -> int:
    gold_docs = {d.document_id: d for d in
                 load_document_records(config.DOCUMENT_GOLD)}
    extracted = {d.document_id: d for d in extract_pack()}

    total = value_ok = box_ok = 0
    iou_sum = 0.0
    print(f"{'document':14} {'kind':7} {'values':>9} {'boxes':>9}  misses")
    for doc_id, gold in sorted(gold_docs.items()):
        ours = extracted.get(doc_id)
        misses = []
        v_ok = b_ok = 0
        for gf in gold.fields:
            total += 1
            of = ours.get(gf.field) if ours else None
            if of is not None and value_match(gf.value, of.value):
                v_ok += 1
            else:
                misses.append(f"{gf.field}={None if of is None else of.value!r}")
            if of is not None and bbox_hit(gf.bbox, of.bbox):
                b_ok += 1
                iou_sum += iou(gf.bbox, of.bbox)
        value_ok += v_ok
        box_ok += b_ok
        kind = "ocr" if (ours and ours.rasterized) else "vector"
        print(f"{doc_id:14} {kind:7} {v_ok:>4}/{len(gold.fields):<4} "
              f"{b_ok:>4}/{len(gold.fields):<4}  {', '.join(misses)}")

    bad_boxes = validate_boxes(list(extracted.values()))
    print("-" * 70)
    print(f"value accuracy: {value_ok}/{total} ({value_ok / total:.1%})")
    print(f"bbox hits:      {box_ok}/{total} ({box_ok / total:.1%})   "
          f"mean IoU of hits: {iou_sum / max(box_ok, 1):.2f}")
    print(f"out-of-page boxes: {len(bad_boxes)}")
    return 0 if value_ok == total and not bad_boxes else 1


if __name__ == "__main__":
    raise SystemExit(main())
