"""Shared data contracts (Block 0).

These dataclasses mirror the pack's JSON schemas:

- ``ExtractedField`` / ``DocumentRecord``  <->  synthetic_documents/gold/field_schema.json
- ``Submission``                            <->  starter/schemas/submission.schema.json
- ``Citation`` is the team's agreed shape for the submission schema's
  otherwise-unconstrained ``citations[]`` items.

Person 1's extractor produces ``DocumentRecord`` objects.  Person 2's engines
consume them.  ``document_gold.jsonl`` parses into the exact same shape
(``load_document_records``), so the reasoning stack can be developed and
tested against gold before extraction is finished.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from .config import BBOX_UNITS, PAGE_SIZE_POINTS

# ---------------------------------------------------------------------------
# Review reason codes (vocabulary matches evaluation/application_checklists.json
# where the checklists define one; the rest follow the same naming style).
# ---------------------------------------------------------------------------
PAY_STUB_TOTAL_CONFLICT = "PAY_STUB_TOTAL_CONFLICT"
GIG_INCOME_UNCORROBORATED = "GIG_INCOME_UNCORROBORATED"
# Employer letter states a different hourly rate than the pay stubs.  (Hours
# may legitimately differ -- letters give approximate schedules -- so the
# rate, not the annualized total, is the corroborated quantity.)
EMPLOYMENT_RATE_CONFLICT = "EMPLOYMENT_RATE_CONFLICT"
UNVERIFIED_INCOME_CLAIM = "UNVERIFIED_INCOME_CLAIM"
MISSING_INCOME_EVIDENCE = "MISSING_INCOME_EVIDENCE"
MISSING_HOUSEHOLD_SIZE = "MISSING_HOUSEHOLD_SIZE"
MISSING_CITATION = "MISSING_CITATION"
MALFORMED_SOURCE_BOX = "MALFORMED_SOURCE_BOX"
NO_FROZEN_THRESHOLD = "NO_FROZEN_THRESHOLD"

# Security event codes (surfaced separately from review reasons: detecting an
# injection is a security event, not automatically a readiness failure).
PROMPT_INJECTION_DETECTED = "PROMPT_INJECTION_DETECTED"


def expired_code(document_type: str) -> str:
    """EMPLOYMENT_LETTER_EXPIRED, PAY_STUB_EXPIRED, ... (checklist naming)."""
    return f"{document_type.upper()}_EXPIRED"


# ---------------------------------------------------------------------------
# Extraction contracts
# ---------------------------------------------------------------------------
@dataclass
class ExtractedField:
    field: str
    value: Any
    page: int
    bbox: tuple[float, float, float, float]  # (x1, y1, x2, y2), bottom-left origin
    bbox_units: str = BBOX_UNITS
    # Extraction certainty in [0, 1]: recognition quality x how the field was
    # located (exact label > inline > fuzzy label > prose fallback).  Gold
    # records and hand-built fixtures default to 1.0.
    confidence: float = 1.0
    # Provenance: "rules" for the deterministic cascade, "llm" when the
    # LABEL's meaning was decided by the anonymized classifier.  The value
    # itself is always OCR/vector-decoded and geometry-located locally.
    source: str = "rules"
    # Source box of the label this value was paired with (when label-driven).
    label_bbox: tuple[float, float, float, float] | None = None

    def to_dict(self) -> dict:
        out = {
            "field": self.field,
            "value": self.value,
            "page": self.page,
            "bbox": [round(float(v), 2) for v in self.bbox],
            "bbox_units": self.bbox_units,
            "confidence": round(float(self.confidence), 3),
            "source": self.source,
        }
        if self.label_bbox is not None:
            out["label_bbox"] = [round(float(v), 2) for v in self.label_bbox]
        return out


@dataclass
class DocumentRecord:
    document_id: str
    household_id: str
    document_type: str
    file_name: str
    fields: list[ExtractedField]
    page_size_points: tuple[float, float] = PAGE_SIZE_POINTS
    rasterized: bool | None = None
    contains_adversarial_text: bool | None = None

    @classmethod
    def from_gold_row(cls, row: dict) -> "DocumentRecord":
        """Parse a gold row OR a previously exported extraction artifact
        (round-trip: confidence/source/label_bbox survive when present, so
        frontend-edited artifacts re-validate faithfully)."""
        return cls(
            document_id=row["document_id"],
            household_id=row["household_id"],
            document_type=row["document_type"],
            file_name=row["file_name"],
            fields=[
                ExtractedField(
                    field=f["field"],
                    value=f["value"],
                    page=f["page"],
                    bbox=tuple(f["bbox"]),
                    bbox_units=f.get("bbox_units", BBOX_UNITS),
                    confidence=float(f.get("confidence", 1.0)),
                    source=f.get("source", "rules"),
                    label_bbox=(tuple(f["label_bbox"])
                                if f.get("label_bbox") else None),
                )
                for f in row["fields"]
            ],
            page_size_points=tuple(row.get("page_size_points", PAGE_SIZE_POINTS)),
            rasterized=row.get("rasterized"),
            contains_adversarial_text=row.get("contains_adversarial_text"),
        )

    def get(self, name: str) -> ExtractedField | None:
        for f in self.fields:
            if f.field == name:
                return f
        return None

    def value(self, name: str, default: Any = None) -> Any:
        f = self.get(name)
        return f.value if f is not None else default

    def to_dict(self) -> dict:
        return {
            "document_id": self.document_id,
            "household_id": self.household_id,
            "document_type": self.document_type,
            "file_name": self.file_name,
            "synthetic": True,
            "page_size_points": list(self.page_size_points),
            "rasterized": self.rasterized,
            "contains_adversarial_text": self.contains_adversarial_text,
            "fields": [f.to_dict() for f in self.fields],
        }


def load_document_records(path: str | Path) -> list[DocumentRecord]:
    """Parse a document-gold-shaped JSONL file into DocumentRecords."""
    records = []
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                records.append(DocumentRecord.from_gold_row(json.loads(line)))
    return records


# ---------------------------------------------------------------------------
# Output contracts
# ---------------------------------------------------------------------------
@dataclass
class Citation:
    """One traceable source for a material output value.

    Either a document anchor (document_id + page + bbox) or a rule anchor
    (rule_id + source_locator), or both when a rule was applied to a
    document value.
    """
    document_id: str | None = None
    page: int | None = None
    bbox: list[float] | None = None
    bbox_units: str | None = None
    field: str | None = None
    rule_id: str | None = None
    source_locator: str | None = None

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class ReviewReason:
    code: str
    detail: str
    citations: list[Citation] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "detail": self.detail,
            "citations": [c.to_dict() for c in self.citations],
        }


@dataclass
class IncomeSource:
    """One documented recurring gross income source (CH-INCOME-001)."""
    kind: str                    # "wages" | "benefit" | "gig" | "self_declared"
    period_amount: float         # recurring gross amount per period
    frequency: str               # explicit frequency ("weekly", "monthly", ...)
    annual_amount: float         # annualized; 0.0 when the source is not counted
    citations: list[Citation] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)   # review reason codes raised here
    counted: bool = True         # self-declared claims are never counted

    def to_dict(self) -> dict:
        return {
            "kind": self.kind,
            "period_amount": self.period_amount,
            "frequency": self.frequency,
            "annual_amount": self.annual_amount,
            "counted": self.counted,
            "flags": list(self.flags),
            "citations": [c.to_dict() for c in self.citations],
        }


@dataclass
class Submission:
    """Final per-household output (starter/schemas/submission.schema.json).

    The schema requires household_id, annualized_income, comparison,
    readiness_status, citations; extra keys (review_reasons, income_sources,
    notes) carry the human-review handoff detail.
    """
    household_id: str
    annualized_income: float
    comparison: str              # below_or_equal | above | no_frozen_threshold
    readiness_status: str        # READY_TO_REVIEW | NEEDS_REVIEW
    citations: list[Citation] = field(default_factory=list)
    review_reasons: list[ReviewReason] = field(default_factory=list)
    income_sources: list[IncomeSource] = field(default_factory=list)
    security_events: list[dict] = field(default_factory=list)
    household_size: int | None = None
    frozen_threshold: float | None = None
    extraction_confidence: float | None = None   # weakest evidence field, [0,1]
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        out = {
            "household_id": self.household_id,
            "annualized_income": self.annualized_income,
            "comparison": self.comparison,
            "readiness_status": self.readiness_status,
            "citations": [c.to_dict() for c in self.citations],
            "review_reasons": [r.to_dict() for r in self.review_reasons],
            "income_sources": [s.to_dict() for s in self.income_sources],
            "security_events": [dict(e) for e in self.security_events],
            "notes": list(self.notes),
        }
        if self.household_size is not None:
            out["household_size"] = self.household_size
        if self.frozen_threshold is not None:
            out["frozen_threshold"] = self.frozen_threshold
        if self.extraction_confidence is not None:
            out["extraction_confidence"] = self.extraction_confidence
        return out
