"""Block B unit tests: starter parity + the cases the starter leaves open."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from realdoor import calc
from realdoor.models import DocumentRecord, ExtractedField


def stub(doc_id, hours, rate, gross, frequency="weekly", pay_date="2026-06-27"):
    fields = [
        ExtractedField("pay_date", pay_date, 1, (40, 650, 90, 660)),
        ExtractedField("pay_frequency", frequency, 1, (40, 630, 90, 640)),
        ExtractedField("regular_hours", hours, 1, (40, 610, 90, 620)),
        ExtractedField("hourly_rate", rate, 1, (40, 590, 90, 600)),
        ExtractedField("gross_pay", gross, 1, (40, 570, 90, 580)),
    ]
    return DocumentRecord(doc_id, "TEST", "pay_stub", f"{doc_id}.pdf", fields)


class AnnualizeTests(unittest.TestCase):
    """Behavior parity with starter/src/calculate.py."""

    def test_weekly(self):
        self.assertEqual(calc.annualize(1000, "weekly"), 52000.0)

    def test_biweekly(self):
        self.assertEqual(calc.annualize(2000, "biweekly"), 52000.0)

    def test_unknown_frequency(self):
        with self.assertRaises(ValueError):
            calc.annualize(1000, "fortnight-ish")

    def test_negative(self):
        with self.assertRaises(ValueError):
            calc.annualize(-1, "weekly")


class ThresholdTests(unittest.TestCase):
    def test_boundary_is_inclusive(self):
        table = calc.threshold_table()
        threshold = table[min(table)]
        self.assertEqual(calc.compare_to_threshold(threshold, threshold),
                         calc.BELOW_OR_EQUAL)
        self.assertEqual(calc.compare_to_threshold(threshold + 0.01, threshold),
                         calc.ABOVE)

    def test_table_covers_sizes_1_to_8(self):
        self.assertEqual(sorted(calc.threshold_table()), list(range(1, 9)))

    def test_no_frozen_threshold_outside_table(self):
        self.assertIsNone(calc.threshold_for(max(calc.threshold_table()) + 1))
        self.assertEqual(calc.compare_to_threshold(1000.0, None),
                         calc.NO_FROZEN_THRESHOLD_CMP)


class IncomeDerivationTests(unittest.TestCase):
    def test_multiple_stubs_are_one_source_not_additive(self):
        docs = [stub("D02", 40, 20.0, 800.0), stub("D03", 40, 20.0, 800.0)]
        sources = calc.derive_income_sources(docs)
        self.assertEqual(len(sources), 1)
        self.assertEqual(sources[0].annual_amount, 41600.0)

    def test_overtime_variance_uses_regular_basis_and_flags_conflict(self):
        docs = [stub("D02", 40, 20.0, 995.0),   # gross != hours x rate
                stub("D03", 40, 20.0, 800.0)]
        sources = calc.derive_income_sources(docs)
        self.assertEqual(sources[0].annual_amount, 41600.0)
        self.assertIn("PAY_STUB_TOTAL_CONFLICT", sources[0].flags)

    def test_value_perturbation_changes_output(self):
        """Anti-hardcoding: hidden tests perturb values; outputs must track
        the documents, not the sample households."""
        base = calc.derive_income_sources([stub("D02", 40, 20.0, 800.0)])
        doubled = calc.derive_income_sources([stub("D02", 40, 40.0, 1600.0)])
        self.assertEqual(doubled[0].annual_amount,
                         2 * base[0].annual_amount)


if __name__ == "__main__":
    unittest.main()
