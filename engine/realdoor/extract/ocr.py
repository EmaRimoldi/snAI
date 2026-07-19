"""Block A2 — OCR extraction for rasterized documents (Person 1).

pdf2image renders the page, the image is binarized (the faint gray
watermark drops out below the threshold), and tesseract emits word boxes.
Pixel boxes are scaled to PDF points and flipped to bottom-left origin so
both extraction paths feed the same normalizer.
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path

try:  # the pip packages import fine without the system binaries; guard anyway
    import pdf2image
    import pytesseract
    from pytesseract import Output
    _OCR_IMPORTS = True
except Exception:  # pragma: no cover - missing packages on a slim deployment
    _OCR_IMPORTS = False

from .tokens import Token

# Use the solution-local English model when the system tessdata lacks one
# (see solution/README.md).
_LOCAL_TESSDATA = Path(__file__).resolve().parents[2] / ".tessdata"
if (_LOCAL_TESSDATA / "eng.traineddata").exists():
    os.environ.setdefault("TESSDATA_PREFIX", str(_LOCAL_TESSDATA))

from .. import settings

DPI = settings.ocr("dpi")           # 200 default; 300 equally accurate, 2x slower
MIN_CONFIDENCE = settings.ocr("min_confidence")
# Pixels darker than this survive binarization; the tiled watermark is a
# faint gray above it, while the small gray field labels stay below it.
# (140 wiped label rows the watermark crossed; 190 keeps labels crisp.)
BINARIZE_THRESHOLD = settings.ocr("binarize_threshold")


_OCR_AVAILABLE: bool | None = None


def ocr_available() -> bool:
    """True when the OCR path can actually run: pdf2image/pytesseract are
    importable AND the system binaries (poppler's pdftoppm + tesseract) exist.
    When False, rasterized pages ABSTAIN per field instead of failing — the
    renter types the values (frozen convention: a feature path, not a failure).
    """
    global _OCR_AVAILABLE
    if _OCR_AVAILABLE is None:
        _OCR_AVAILABLE = bool(
            _OCR_IMPORTS
            and shutil.which("pdftoppm")
            and shutil.which("tesseract")
        )
    return _OCR_AVAILABLE


def ocr_tokens(
    pdf_path: str | Path,
    page_size_points: tuple[float, float],
    page_index: int = 0,
) -> list[Token]:
    """Word tokens for one page of a rasterized PDF, in PDF points."""
    image = pdf2image.convert_from_path(
        str(pdf_path), dpi=DPI,
        first_page=page_index + 1, last_page=page_index + 1)[0]
    gray = image.convert("L")
    binary = gray.point(lambda px: 0 if px < BINARIZE_THRESHOLD else 255)

    data = pytesseract.image_to_data(binary, output_type=Output.DICT)

    width_pts, height_pts = page_size_points
    sx = width_pts / image.width
    sy = height_pts / image.height

    tokens = []
    for i, text in enumerate(data["text"]):
        text = text.strip()
        if not text:
            continue
        if float(data["conf"][i]) < MIN_CONFIDENCE:
            continue
        left, top = data["left"][i], data["top"][i]
        w, h = data["width"][i], data["height"][i]
        tokens.append(Token(
            text=text,
            x0=left * sx,
            y0=height_pts - (top + h) * sy,
            x1=(left + w) * sx,
            y1=height_pts - top * sy,
            conf=float(data["conf"][i]) / 100.0,
        ))
    return tokens
