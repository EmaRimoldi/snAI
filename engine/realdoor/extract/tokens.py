"""Shared token shape for both extraction paths (Blocks A1/A2)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Token:
    """One word on a page, in PDF points with bottom-left origin.

    ``conf`` is the recognition confidence in [0, 1]: None for vector text
    (the text layer is exact), tesseract's word confidence for OCR.
    """
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    conf: float | None = None

    @property
    def center_y(self) -> float:
        return (self.y0 + self.y1) / 2.0
