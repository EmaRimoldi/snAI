import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))
from src.calculate import annualize, compare_to_threshold

class CalculationTests(unittest.TestCase):
    def test_weekly(self): self.assertEqual(annualize(1000, "weekly"), 52000)
    def test_biweekly(self): self.assertEqual(annualize(2000, "biweekly"), 52000)
    def test_boundary(self): self.assertEqual(compare_to_threshold(72000, 72000), "below_or_equal")
    def test_above(self): self.assertEqual(compare_to_threshold(72000.01, 72000), "above")
    def test_unknown_frequency(self):
        with self.assertRaises(ValueError): annualize(1000, "fortnight-ish")
if __name__ == "__main__": unittest.main()
