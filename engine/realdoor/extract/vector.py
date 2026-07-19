"""Block A1 — text-layer extraction with pdfplumber (Person 1).

The synthetic watermark ("SYNTHETIC - NOT A REAL DOCUMENT") is rendered as
individual ~34pt glyphs tiled diagonally across the page (each glyph is
upright, so pdfplumber's `upright` attribute does NOT catch them).  Content
text is at most ~18pt, so watermark chars are filtered by font size
*before* words are assembled -- otherwise watermark letters merge into real
words (e.g. "2026-0T6-20", "RALTE").

Coordinates are converted from pdfplumber's top-left origin to the pack's
PDF-points bottom-left origin: y_pdf = page_height - y_top.
"""
from __future__ import annotations

from pathlib import Path

import pdfplumber

from .tokens import Token


# Content text tops out around 18pt; the tiled watermark glyphs are ~34pt.
MAX_CONTENT_FONT_SIZE = 24.0


def _keep(obj) -> bool:
    """Drop watermark chars (oversized or rotated); keep everything else."""
    if obj.get("object_type") == "char":
        if not obj.get("upright", True):
            return False
        return float(obj.get("size", 0)) <= MAX_CONTENT_FONT_SIZE
    return True


def vector_pages(
    pdf_path: str | Path,
) -> tuple[list[list[Token]], tuple[float, float]]:
    """(token list per page, page-1 size in points).

    An empty token list for a page means it has no text layer -- the signal
    to run that page through the OCR path instead.
    """
    pages: list[list[Token]] = []
    size = (612.0, 792.0)
    with pdfplumber.open(pdf_path) as pdf:
        for index, page in enumerate(pdf.pages):
            height = float(page.height)
            if index == 0:
                size = (float(page.width), height)
            words = page.filter(_keep).extract_words(keep_blank_chars=False)
            pages.append([
                Token(
                    text=w["text"],
                    x0=float(w["x0"]),
                    y0=height - float(w["bottom"]),
                    x1=float(w["x1"]),
                    y1=height - float(w["top"]),
                )
                for w in words
                if w["text"].strip()
            ])
    return pages, size


def vector_tokens(pdf_path: str | Path) -> tuple[list[Token], tuple[float, float]]:
    """Page-1 shortcut kept for debugging tools."""
    pages, size = vector_pages(pdf_path)
    return (pages[0] if pages else []), size
