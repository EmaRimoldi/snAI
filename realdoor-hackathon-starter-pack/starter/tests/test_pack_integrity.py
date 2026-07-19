import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))
from src.load_documents import load_gold, validate_boxes
from src.rules import load_rules

class PackIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.root = Path(__file__).parents[2]
    def test_document_count(self):
        rows = load_gold(self.root / "synthetic_documents/gold/document_gold.jsonl")
        self.assertGreaterEqual(len(rows), 20); self.assertLessEqual(len(rows), 40)
    def test_boxes(self):
        self.assertEqual(validate_boxes(load_gold(self.root / "synthetic_documents/gold/document_gold.jsonl")), [])
    def test_rule_ids(self): self.assertGreaterEqual(len(load_rules(self.root / "rules/rule_corpus.jsonl")), 10)
if __name__ == "__main__": unittest.main()
