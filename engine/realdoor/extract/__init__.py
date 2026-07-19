"""Blocks A1-A3 — document extraction (Person 1).

vector.py    A1: text-layer PDFs via pdfplumber (watermark filtered by the
             `upright` char attribute -- the synthetic watermark is rotated).
ocr.py       A2: rasterized PDFs via pdf2image + tesseract (watermark removed
             by binarization -- it is printed in faint gray).
normalize.py A3: shared label->field grid parsing, value typing, and
             DocumentRecord assembly.  Extraction is label-driven only;
             no document value is ever hardcoded.
"""
from .normalize import extract_document, extract_pack  # noqa: F401
