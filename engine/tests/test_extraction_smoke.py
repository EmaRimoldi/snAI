"""Blocks A1-A3 smoke test: one vector and one OCR document vs gold.

The full 24-document grade lives in eval/score_extraction.py; this is the
fast regression check for the extraction path itself.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from realdoor import config
from realdoor.extract import extract_document
from realdoor.models import load_document_records


def _gold():
    return {d.document_id: d for d in load_document_records(config.DOCUMENT_GOLD)}


class ExtractionSmokeTests(unittest.TestCase):
    def _check(self, gold_doc):
        extracted = extract_document(
            config.DOCUMENTS_DIR / gold_doc.file_name, gold_doc.document_id,
            gold_doc.household_id, gold_doc.document_type)
        for gf in gold_doc.fields:
            of = extracted.get(gf.field)
            self.assertIsNotNone(of, f"missing {gf.field}")
            if isinstance(gf.value, (int, float)):
                self.assertAlmostEqual(float(gf.value), float(of.value),
                                       delta=0.01, msg=gf.field)
            else:
                self.assertEqual(str(gf.value).casefold().split(),
                                 str(of.value).casefold().split(), gf.field)

    def test_one_vector_document(self):
        gold = _gold()
        doc = next(d for d in gold.values() if not d.rasterized)
        self._check(doc)

    def test_one_rasterized_document(self):
        gold = _gold()
        doc = next(d for d in gold.values() if d.rasterized)
        self._check(doc)


class LayoutRobustnessTests(unittest.TestCase):
    """The normalizer must survive layout rearrangements: reordered columns,
    relocated panels, and inline label:value rows."""

    @staticmethod
    def _tok(text, x, y, w=40):
        from realdoor.extract.tokens import Token
        return Token(text, x, y, x + w, y + 10)

    def _fields(self, tokens):
        from realdoor.extract.normalize import _cluster_lines, _harvest
        return {f.field: f.value for f in _harvest(_cluster_lines(tokens))}

    def test_columns_swapped(self):
        t = self._tok
        fields = self._fields([
            t("REGULAR", 360, 700, 35), t("HOURS", 398, 700, 25),
            t("PAY", 52, 700, 15), t("FREQUENCY", 70, 700),
            t("76", 360, 686, 10), t("biweekly", 52, 686)])
        self.assertEqual(fields, {"regular_hours": 76,
                                  "pay_frequency": "biweekly"})

    def test_panel_relocated_to_page_bottom(self):
        t = self._tok
        fields = self._fields([
            t("PAY", 360, 120, 15), t("FREQUENCY", 378, 120),
            t("biweekly", 360, 106)])
        self.assertEqual(fields, {"pay_frequency": "biweekly"})

    def test_inline_label_value_rows(self):
        t = self._tok
        fields = self._fields([
            t("PAY", 100, 700, 15), t("FREQUENCY:", 118, 700, 50),
            t("biweekly", 180, 700),
            t("REGULAR", 300, 700, 35), t("HOURS:", 338, 700, 28),
            t("76", 380, 700, 10)])
        self.assertEqual(fields, {"pay_frequency": "biweekly",
                                  "regular_hours": 76})


if __name__ == "__main__":
    unittest.main()
