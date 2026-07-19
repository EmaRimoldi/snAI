"""Debug/demo renderer: PDFs with extraction overlays.

For every document, renders the page and draws:
- extracted field boxes, color-coded by confidence
  (green >= 0.95, orange >= 0.80, red below; purple = untrusted text),
  each labeled "field=value (confidence)"
- gold source boxes as thin blue outlines for visual comparison

Usage: render_annotations.py [--set official|dev|both] [--out DIR]
"""
from __future__ import annotations

import _bootstrap  # noqa: F401
import argparse
from pathlib import Path

import csv

import pdf2image
from PIL import ImageDraw, ImageFont

from realdoor import config
from realdoor.extract.batch import batch_extract
from realdoor.models import load_document_records

DPI = 150
SCALE = DPI / 72.0
GOLD_OUTLINE = (110, 110, 255)
UNTRUSTED = (150, 60, 200)
LLM_SOURCE = (20, 110, 220)

DEV = config.PACK_ROOT / "dev"


def _font():
    try:
        return ImageFont.truetype(
            "/usr/share/fonts/TTF/DejaVuSans.ttf", 13)
    except OSError:
        return ImageFont.load_default()


def _confidence_color(conf: float) -> tuple[int, int, int]:
    if conf >= 0.95:
        return (0, 150, 60)
    if conf >= 0.80:
        return (235, 140, 0)
    return (210, 40, 40)


def render_document(pdf_path: Path, doc, gold, out_path: Path, font) -> None:
    images = pdf2image.convert_from_path(str(pdf_path), dpi=DPI)
    page_height = doc.page_size_points[1]

    def to_px(bbox):
        x1, y1, x2, y2 = bbox
        return (x1 * SCALE, (page_height - y2) * SCALE,
                x2 * SCALE, (page_height - y1) * SCALE)

    for page_number, image in enumerate(images, start=1):
        page_fields = [f for f in doc.fields if f.page == page_number]
        gold_fields = ([f for f in gold.fields if f.page == page_number]
                       if gold is not None else [])
        if page_number > 1 and not page_fields and not gold_fields:
            continue
        image = image.convert("RGB")
        draw = ImageDraw.Draw(image)
        for f in gold_fields:
            draw.rectangle(to_px(f.bbox), outline=GOLD_OUTLINE, width=1)
        for f in page_fields:
            box = to_px(f.bbox)
            is_llm = getattr(f, "source", "rules") == "llm"
            if f.field == "untrusted_instruction_text":
                color = UNTRUSTED
            else:
                # The VALUE box always shows its measured confidence color;
                # the LLM never touches values, only label semantics.
                color = _confidence_color(f.confidence)
            draw.rectangle(box, outline=color, width=3)
            if is_llm and getattr(f, "label_bbox", None):
                # Blue marks what the LLM actually classified: the LABEL.
                draw.rectangle(to_px(f.label_bbox), outline=LLM_SOURCE,
                               width=3)
            value = str(f.value)
            if len(value) > 40:
                value = value[:37] + "..."
            tag = " label:llm" if is_llm else ""
            label = f"{f.field}={value} ({f.confidence:.2f}{tag})"
            tx, ty = box[0], max(0.0, box[1] - 17)
            width = draw.textlength(label, font=font)
            draw.rectangle((tx, ty, tx + width + 4, ty + 15),
                           fill=(255, 255, 255))
            draw.text((tx + 2, ty + 1), label,
                      fill=LLM_SOURCE if is_llm else color, font=font)
        target = (out_path if page_number == 1 else
                  out_path.with_suffix(f".p{page_number}.png"))
        image.save(target)


def render_set(name: str, out_dir: Path) -> int:
    # Batch extraction: parallel tokenization + at most ONE LLM call per set.
    if name == "official":
        manifest, pdf_dir = config.DOCUMENT_MANIFEST, config.DOCUMENTS_DIR
        gold_path = config.DOCUMENT_GOLD
    else:
        root = config.PACK_ROOT / name          # dev, dev3, dev4, ...
        manifest = root / "gold" / "document_manifest.csv"
        pdf_dir = root / "documents"
        gold_path = root / "gold" / "document_gold.jsonl"
    with open(manifest, newline="", encoding="utf-8") as handle:
        jobs = [(pdf_dir / row["file_name"], row["document_id"],
                 row["household_id"], row["document_type"], row["file_name"])
                for row in csv.DictReader(handle)]
    docs, _stats = batch_extract(jobs)
    gold = ({d.document_id: d for d in load_document_records(gold_path)}
            if gold_path.exists() else {})

    target = out_dir / name
    target.mkdir(parents=True, exist_ok=True)
    font = _font()
    for doc in docs:
        render_document(pdf_dir / doc.file_name, doc,
                        gold.get(doc.document_id),
                        target / f"{doc.document_id}.png", font)
    return len(docs)


_LEGEND = """
<p class="legend">
<span style="color:#00963c">&#9632;</span> conf &ge; 0.95 &nbsp;
<span style="color:#eb8c00">&#9632;</span> conf 0.80&ndash;0.95 &nbsp;
<span style="color:#d22828">&#9632;</span> conf &lt; 0.80 &nbsp;
<span style="color:#146edc">&#9632;</span> label box classified by LLM (value box keeps its measured conf color) &nbsp;
<span style="color:#963cc8">&#9632;</span> untrusted/injected text &nbsp;
<span style="color:#6e6eff">&#9633;</span> gold source box
</p>
"""


def write_index(out_dir: Path) -> None:
    """Browsable gallery: one <details> section per set, image grid inside."""
    parts = ["<!doctype html><meta charset='utf-8'>"
             "<title>RealDoor extraction overlays</title><style>"
             "body{font-family:sans-serif;margin:1.5rem;background:#f5f5f5}"
             ".grid{display:grid;grid-template-columns:repeat(auto-fill,"
             "minmax(340px,1fr));gap:1rem}figure{margin:0;background:#fff;"
             "padding:.5rem;border:1px solid #ddd}figcaption{font-size:.85rem;"
             "padding:.3rem 0;font-weight:600}img{width:100%;height:auto}"
             ".legend{font-size:.9rem}</style>",
             "<h1>Extraction overlays</h1>", _LEGEND]
    for set_dir in sorted(p for p in out_dir.iterdir() if p.is_dir()):
        pages = sorted(set_dir.glob("*.png"))
        parts.append(f"<details open><summary><b>{set_dir.name}</b> "
                     f"({len(pages)} pages)</summary><div class='grid'>")
        for page in pages:
            rel = f"{set_dir.name}/{page.name}"
            parts.append(f"<figure><a href='{rel}'><img loading='lazy' "
                         f"src='{rel}'></a><figcaption>{page.stem}"
                         f"</figcaption></figure>")
        parts.append("</div></details>")
    (out_dir / "index.html").write_text("\n".join(parts), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    # "all" renders every set that exists (official + dev*); or name one.
    parser.add_argument("--set", dest="which", default="all")
    parser.add_argument("--out", default="annotated")
    args = parser.parse_args()

    if args.which == "all":
        names = ["official"] + sorted(
            p.name for p in config.PACK_ROOT.glob("dev*")
            if (p / "documents").is_dir())
    else:
        names = [args.which]

    out_dir = Path(args.out)
    total = 0
    for name in names:
        total += render_set(name, out_dir)
    write_index(out_dir)
    print(f"rendered {total} annotated pages -> {out_dir.resolve()}")
    print(f"gallery: {(out_dir / 'index.html').resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
