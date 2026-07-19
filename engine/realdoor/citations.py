"""Citation plumbing + traceability checks (Citations block, 10%).

Every material output value must trace to a page-level source box and/or a
frozen rule (CH-READINESS-001, and the missing_citation / malformed_bbox
adversarial categories).  ``validate_boxes`` matches the starter reference
semantics: 0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height.
"""
from __future__ import annotations

from .config import PAGE_SIZE_POINTS
from .models import Citation, DocumentRecord, IncomeSource

TRACEABILITY_OK = "ok"
PROBLEM_MISSING = "missing_citation"
PROBLEM_MALFORMED = "malformed_bbox"


def bbox_in_bounds(bbox, page_size=PAGE_SIZE_POINTS) -> bool:
    if bbox is None or len(bbox) != 4:
        return False
    x1, y1, x2, y2 = bbox
    width, height = page_size
    return 0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height


def validate_boxes(records: list[DocumentRecord]) -> list[tuple]:
    """(document_id, field, bbox) for every out-of-bounds source box."""
    errors = []
    for record in records:
        for f in record.fields:
            if not bbox_in_bounds(f.bbox, record.page_size_points):
                errors.append((record.document_id, f.field, list(f.bbox)))
    return errors


def citation_problems(citations: list[Citation]) -> list[str]:
    """Traceability problems for a citation list.

    A citation must anchor to a document source box (page + in-bounds bbox)
    or to a frozen rule id; document anchors with missing or out-of-page
    boxes are malformed.
    """
    problems = []
    for c in citations:
        if c.document_id is not None:
            if c.page is None or c.bbox is None:
                problems.append(PROBLEM_MISSING)
            elif not bbox_in_bounds(c.bbox):
                problems.append(PROBLEM_MALFORMED)
        elif c.rule_id is None:
            problems.append(PROBLEM_MISSING)
    return problems


def source_traceability_problems(sources: list[IncomeSource]) -> list[str]:
    """Every counted income source needs at least one document source box."""
    problems = []
    for source in sources:
        if not source.counted:
            continue
        doc_anchors = [c for c in source.citations if c.document_id is not None]
        if not doc_anchors:
            problems.append(PROBLEM_MISSING)
        problems.extend(citation_problems(doc_anchors))
    return problems
