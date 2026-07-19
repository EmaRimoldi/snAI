"""Block A3 — label-driven field normalization (Person 1).

The synthetic documents lay fields out as UPPERCASE labels with the value on
the line directly below.  This module turns page tokens (from either the
vector or OCR path) into typed ``ExtractedField`` objects with source boxes.

Everything is driven by the label vocabulary and the field-name -> type map;
no document value is ever matched against, so perturbed hidden documents
with the same layout schema parse identically.
"""
from __future__ import annotations

import csv
import re
from pathlib import Path

from .. import config
from ..calc import FREQUENCY
from ..models import DocumentRecord, ExtractedField
from ..safety import INSTRUCTION_RE
from .ocr import ocr_tokens
from .tokens import Token
from .vector import vector_pages

LINE_TOLERANCE = 6.0        # y-center clustering tolerance (points)
LABEL_GAP = 8.0             # max x-gap between words of one label
VALUE_GAP = 48.0            # max vertical gap between label line and value line
COLUMN_SCAN_GAP = 130.0     # max drop for the per-column scan (hero tiles)
COLUMN_SLACK = 40.0         # x-window slack for the per-column scan
MIN_VECTOR_TOKENS = 5       # fewer real words than this -> rasterized, use OCR

# Confidence model: confidence = semantic x geometry x recognition.
#   semantic   -- how sure we are the LABEL means this field
#   geometry   -- how sure we are this VALUE box belongs to that label
#   recognition-- how sure we are we read the glyphs (OCR word conf; 1.0 vector)
# Semantic tiers:
TIER_EXACT_LABEL = 1.00     # label text is in LABEL_MAP
TIER_SYNONYM = 0.95         # label matched via the synonym/abbreviation lexicon
TIER_FUZZY_LABEL = 0.85     # label matched by keyword, wording unseen
# Marker for classifier-decided labels.  It does NOT enter the confidence:
# an LLM's own certainty is not meaningful, so these fields score
# geometry x OCR recognition (the measurable parts) and carry
# source="llm" as the provenance flag instead.
TIER_LLM_LABEL = 0.75
TIER_INSTRUCTION = 0.90     # untrusted text caught by regex, not by label
TIER_PROSE = 0.70           # value mined from a prose sentence
# Geometry tiers:
GEOM_BELOW = 1.00           # value on the line directly below the label
GEOM_INLINE = 0.95          # value on the label's own line
GEOM_COLUMN = 0.90          # value found by per-column scan further below
GEOM_ABOVE = 0.75           # value on the line directly above the label

# Despaced label text -> canonical gold field name.  Aliases cover the label
# variants seen across document types.
LABEL_MAP = {
    "EMPLOYEE": "person_name",
    "APPLICANT": "person_name",
    "RECIPIENT": "person_name",
    "WORKER": "person_name",
    "PAYDATE": "pay_date",
    "LETTERDATE": "document_date",
    "DOCUMENTDATE": "document_date",
    "PAYPERIOD": "pay_period_start",
    "THROUGH": "pay_period_end",
    "PAYFREQUENCY": "pay_frequency",
    "REGULARHOURS": "regular_hours",
    "HOURS": "regular_hours",              # alternate_card pay panel
    "HOURLYRATE": "hourly_rate",
    "RATE": "hourly_rate",                 # alternate_card pay panel
    "GROSSPAY": "gross_pay",
    "NETPAY": "net_pay",
    "NETREFERENCE": "net_pay",             # alternate_card pay panel
    "HOUSEHOLDSIZE": "household_size",
    "MAILINGADDRESS": "address",
    "ADDRESS": "address",
    "APPLICATIONDATE": "application_date",
    "HOURSPERWEEK": "weekly_hours",
    "WEEKLYHOURS": "weekly_hours",
    "FREQUENCY": "benefit_frequency",
    "BENEFITAMOUNT": "benefit_amount",     # renamed to <freq>_benefit post-harvest
    "STATEMENTMONTH": "statement_month",
    "GROSSRECEIPTS": "gross_receipts",
    "PLATFORMFEES": "platform_fees",
    "UNTRUSTEDDOCUMENTTEXT": "untrusted_instruction_text",
}
# "<FREQUENCY> AMOUNT" benefit labels (MONTHLY AMOUNT -> monthly_benefit, ...)
_BENEFIT_AMOUNT_RE = re.compile(
    r"^(WEEKLY|BIWEEKLY|SEMIMONTHLY|MONTHLY|ANNUAL)AMOUNT$")

# Synonym/abbreviation lexicon (despaced key -> field, or per-doc-type dict
# with "*" default).  These are alternate wordings for the same semantic
# fields -- legitimate vocabulary, not fixture-specific values.
SYNONYM_MAP: dict[str, str | dict] = {
    "PAID": {"pay_stub": "pay_date", "*": "document_date"},
    "ISSUED": {"pay_stub": "pay_date", "*": "document_date"},
    "DATED": {"pay_stub": "pay_date", "application_summary": "application_date",
              "*": "document_date"},
    "CYCLE": {"benefit_letter": "benefit_frequency", "*": "pay_frequency"},
    "FREQ": {"benefit_letter": "benefit_frequency", "*": "pay_frequency"},
    "FROM": "pay_period_start",
    "TO": "pay_period_end",
    "PERIODA": "pay_period_start",
    "PERIODB": "pay_period_end",
    "PAYPERIODSTART": "pay_period_start",
    "PAYPERIODEND": "pay_period_end",
    "EMP": "person_name",
    "HRS": {"employment_letter": "weekly_hours", "*": "regular_hours"},
    "PAYDT": "pay_date",
    "FILED": {"application_summary": "application_date", "*": "document_date"},
    "PEOPLE": "household_size",
}

# Question-style labels ("WHO IS THIS FOR?") may exceed the short-group
# limit that guards the fuzzy pass against banners.
_QUESTION_WORDS = {"WHO", "WHAT", "WHEN", "WHERE", "WHICH", "HOW"}

# OCR sometimes swaps look-alike glyphs inside uppercase labels.
_LABEL_FIX = str.maketrans({"0": "O", "1": "I", "5": "S", "8": "B"})


def _label_field(despaced: str) -> str | None:
    key = re.sub(r"[^A-Z0-9]", "", despaced.translate(_LABEL_FIX))
    match = _BENEFIT_AMOUNT_RE.match(key)
    if match:
        return f"{match.group(1).lower()}_benefit"
    return LABEL_MAP.get(key)


def _synonym_field(despaced: str, document_type: str | None) -> str | None:
    key = re.sub(r"[^A-Z0-9]", "", despaced.translate(_LABEL_FIX))
    entry = SYNONYM_MAP.get(key)
    if isinstance(entry, dict):
        return entry.get(document_type or "*", entry.get("*"))
    return entry


# Words that mark banners/headers, never field labels; they veto the fuzzy
# pass ("SYNTHETIC RECEIPT" must not become gross_receipts).
_NOISE_WORDS = ("SYNTHETIC", "FIXTURE", "TRAINING", "RECORD",
                "REVIEW", "FORM", "DASHBOARD", "LEDGER", "CORRESPONDENCE",
                "VERIFICATION", "FICTIONAL", "ORGANIZATIONS", "NAMES")


def _fuzzy_label_field(despaced: str, document_type: str | None) -> str | None:
    """Keyword fallback for label wordings not in LABEL_MAP (exact match is
    always tried first).  Ordered most-specific first; document_type breaks
    the genuinely ambiguous cases (frequency, gross, hours, date)."""
    key = re.sub(r"[^A-Z0-9]", "", despaced.translate(_LABEL_FIX))
    if "UNTRUSTED" in key or "ADVERSARIAL" in key:
        return "untrusted_instruction_text"
    if any(noise in key for noise in _NOISE_WORDS):
        return None
    if ("FREQUENC" in key or "OFTEN" in key or "CYCLE" in key
            or "CADENCE" in key):
        return ("benefit_frequency" if document_type == "benefit_letter"
                else "pay_frequency")
    if document_type == "pay_stub" and ("START" in key or "FROM" in key
                                        or "OPENED" in key):
        return "pay_period_start"
    if document_type == "pay_stub" and (key.endswith("END")
                                        or key.endswith("TO")
                                        or "CLOSED" in key):
        return "pay_period_end"
    if "SCHEDULE" in key or "HRS" in key or "UNITS" in key:
        return ("weekly_hours" if document_type == "employment_letter"
                else "regular_hours")
    if key.endswith("DT"):
        return {"pay_stub": "pay_date",
                "application_summary": "application_date"}.get(
                    document_type or "", "document_date")
    if "PEOPLE" in key or "OCCUPANT" in key or "PERSONS" in key:
        return "household_size"
    if "FILED" in key or "SUBMITTED" in key:
        return ("application_date" if document_type == "application_summary"
                else "document_date")
    if "ISSUED" in key or "PAID" in key:
        return "pay_date" if document_type == "pay_stub" else "document_date"
    if "MAIL" in key or "WHERE" in key:
        return "address"
    if "WHO" in key:
        return "person_name"
    if "RECEIPT" in key:
        return "gross_receipts"
    if "FEE" in key:
        return "platform_fees"
    if "GROSS" in key:
        return ("gross_receipts" if document_type == "gig_statement"
                else "gross_pay")
    if "NET" in key:
        return "net_pay"
    if "RATE" in key:
        return "hourly_rate"
    if "HOURS" in key:
        return ("weekly_hours" if document_type == "employment_letter"
                else "regular_hours")
    if "AMOUNT" in key and document_type == "benefit_letter":
        return "benefit_amount"
    if "SIZE" in key:
        return "household_size"
    if "ADDRESS" in key:
        return "address"
    if any(k in key for k in ("NAME", "EMPLOYEE", "APPLICANT", "RECIPIENT",
                              "WORKER", "TENANT", "HOLDER")):
        return "person_name"
    if "MONTH" in key and document_type == "gig_statement":
        return "statement_month"
    if "DECLARED" in key or "SELFREPORTED" in key:
        return "declared_income"
    if "DATE" in key:
        return {"pay_stub": "pay_date",
                "employment_letter": "document_date",
                "benefit_letter": "document_date",
                "application_summary": "application_date"}.get(document_type)
    return None


# --- value parsing -------------------------------------------------------
def _clean_number(text: str) -> str:
    cleaned = re.sub(r"[^0-9.]", "", text)
    if cleaned.count(".") > 1:                       # OCR comma/period mixups
        head, _, tail = cleaned.rpartition(".")
        cleaned = head.replace(".", "") + "." + tail
    return cleaned


_DATE_RE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")
_DATE_ANYWHERE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")


def _parse_money(text: str):
    # A date inside a money value means column bleed, not an amount.
    if _DATE_ANYWHERE_RE.search(text):
        return None
    cleaned = _clean_number(text)
    if not any(ch.isdigit() for ch in cleaned):
        return None
    return float(cleaned)


def _parse_int(text: str):
    # A currency-marked token is money, never an hours/size count.
    if _DATE_ANYWHERE_RE.search(text) or "$" in text:
        return None
    cleaned = _clean_number(text)
    if not any(ch.isdigit() for ch in cleaned):
        return None
    value = float(cleaned)
    return int(value) if value == int(value) else value


def _parse_text(text: str):
    return text.strip() or None


def _parse_name(text: str):
    # Person names never contain digits (column bleed) and are not printed
    # in all-caps in these fixtures (all-caps means label text leaked in).
    text = text.strip().rstrip(".")
    if not text or any(ch.isdigit() for ch in text) or text.isupper():
        return None
    return text


def _parse_address(text: str):
    # An address is never just a date; a trailing date is column bleed.
    text = text.strip().rstrip(".")
    text = re.sub(r"\s+\d{4}-\d{2}(?:-\d{2})?$", "", text)
    # Addresses end at the ZIP; anything after is neighboring-column bleed
    # ("... MA 00000 People included: 7").
    match = re.search(r"^.*?\b\d{5}(?:-\d{4})?\b", text)
    if match:
        text = match.group(0)
    if not text or _DATE_RE.match(text.rstrip(",;:")):
        return None
    return text


def _parse_date(text: str):
    text = text.strip().rstrip(".,;:")
    return text if _DATE_RE.match(text) else None


def _parse_lower(text: str):
    return text.strip().lower() or None


def _parse_frequency(text: str):
    # Frequencies are a closed vocabulary (calc.FREQUENCY).
    word = text.strip().rstrip(".,;:").lower()
    return word if word in FREQUENCY else None


PARSERS = {
    "person_name": _parse_name,
    "address": _parse_address,
    "untrusted_instruction_text": _parse_text,
    "pay_date": _parse_date,
    "document_date": _parse_date,
    "application_date": _parse_date,
    "pay_period_start": _parse_date,
    "pay_period_end": _parse_date,
    "statement_month": _parse_date,
    "pay_frequency": _parse_frequency,
    "benefit_frequency": _parse_frequency,
    "household_size": _parse_int,
    "regular_hours": _parse_int,
    "weekly_hours": _parse_int,
    "hourly_rate": _parse_money,
    "benefit_amount": _parse_money,
    "declared_income": _parse_money,
    "gross_pay": _parse_money,
    "net_pay": _parse_money,
    "platform_fees": _parse_money,
    "gross_receipts": _parse_money,
}


def _parse_value(field_name: str, text: str):
    if field_name != "untrusted_instruction_text":
        # Machine-key layouts prefix values with separators (":: Pia Umber").
        text = re.sub(r"^[\s:;|=~•·\-]+", "", text)
    parser = PARSERS.get(field_name, _parse_money if field_name.endswith("_benefit")
                         else _parse_text)
    return parser(text)


_UNTYPED_PARSERS = (_parse_text, _parse_name, _parse_address)


def _typed_parse(field_name: str, tokens: list[Token]):
    """(value, tokens_used).  Typed fields (money/int/date/frequency) prefer
    the first token that parses alone -- a joined run can silently merge a
    neighbor column ("35 $25.00" -> 3525).  Free-text fields keep the run."""
    parser = PARSERS.get(field_name)
    typed = (field_name.endswith("_benefit")
             or (parser is not None and parser not in _UNTYPED_PARSERS))
    # "[02]"-style ordinal markers are layout chrome, never values.
    tokens = [t for t in tokens
              if not re.fullmatch(r"[\[\(]\d+[\]\)]:?", t.text)]
    if not tokens:
        return None, tokens
    if typed and len(tokens) > 1:
        for token in tokens:
            value = _parse_value(field_name, token.text)
            if value is not None:
                return value, [token]
    return _parse_value(field_name, " ".join(t.text for t in tokens)), tokens


# --- page geometry -------------------------------------------------------
def _cluster_lines(tokens: list[Token]) -> list[list[Token]]:
    """Tokens grouped into visual lines, top of page first."""
    lines: list[list[Token]] = []
    for token in sorted(tokens, key=lambda t: (-t.center_y, t.x0)):
        for line in lines:
            if abs(line[0].center_y - token.center_y) <= LINE_TOLERANCE:
                line.append(token)
                break
        else:
            lines.append([token])
    for line in lines:
        line.sort(key=lambda t: t.x0)
    return lines


def _is_capsish(text: str) -> bool:
    # Trailing ':' ("FREQUENCY:") and '?' ("...FOR?") allowed: inline and
    # question-style label layouts.  Underscores cover machine-key labels
    # ("REC.HOUSEHOLD_SIZE").
    return bool(re.fullmatch(r"[A-Z][A-Z0-9/&._\-]*[:?]?", text)) and len(text) >= 2


def _caps_groups(line: list[Token]) -> list[list[Token]]:
    """Runs of uppercase tokens on one line (potential labels)."""
    groups: list[list[Token]] = []
    for token in line:
        # Single uppercase chars ("PERIOD A") continue a label, never start one.
        continuation = (len(token.text.rstrip(":?")) == 1
                        and token.text[0].isupper()
                        and groups and groups[-1]
                        and token.x0 - groups[-1][-1].x1 <= LABEL_GAP)
        if continuation:
            groups[-1].append(token)
            continue
        if not _is_capsish(token.text):
            groups.append([])
            continue
        if groups and groups[-1] and token.x0 - groups[-1][-1].x1 <= LABEL_GAP:
            groups[-1].append(token)
        else:
            groups.append([token])
    return [g for g in groups if g]


def _norm_key(despaced: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", despaced.translate(_LABEL_FIX))


def _label_groups(
    line: list[Token], document_type: str | None = None,
    overrides: dict[str, str] | None = None,
) -> list[tuple[str, list[Token], float]]:
    """(field_name, label tokens, semantic-tier) for every known label on a
    line.  ``overrides`` maps normalized label keys to fields decided by the
    anonymized LLM label classifier (tier TIER_LLM_LABEL)."""
    found = []
    for group in _caps_groups(line):
        despaced = "".join(t.text for t in group)
        field_name = _label_field(despaced)
        tier = TIER_EXACT_LABEL
        if field_name is None:
            field_name = _synonym_field(despaced, document_type)
            tier = TIER_SYNONYM
        is_question = group[0].text.strip(":?") in _QUESTION_WORDS
        if field_name is None and (len(group) <= 4 or is_question):
            # Fuzzy pass only for short or question-style groups: long
            # non-question caps runs are banners ("ALL NAMES AND
            # ORGANIZATIONS ARE FICTIONAL"), not labels.
            field_name = _fuzzy_label_field(despaced, document_type)
            tier = TIER_FUZZY_LABEL
        if field_name is None and overrides:
            field_name = overrides.get(_norm_key(despaced))
            tier = TIER_LLM_LABEL
        if field_name:
            found.append((field_name, group, tier))
    # Coalesce groups that resolve to the same field (e.g. "UNTRUSTED
    # DOCUMENT TEXT - ADVERSARIAL TEST FIXTURE" is one label, not two
    # columns) so the value line is not split between them.
    merged: list[tuple[str, list[Token], float]] = []
    for field_name, group, tier in found:
        if merged and merged[-1][0] == field_name:
            prev_name, prev_group, prev_tier = merged[-1]
            merged[-1] = (prev_name, prev_group + group,
                          max(prev_tier, tier))
        else:
            merged.append((field_name, group, tier))
    return merged


def _union_bbox(tokens: list[Token]) -> tuple[float, float, float, float]:
    return (
        min(t.x0 for t in tokens),
        min(t.y0 for t in tokens),
        max(t.x1 for t in tokens),
        max(t.y1 for t in tokens),
    )


def _inline_value_tokens(
    line: list[Token], group: list[Token],
    all_groups: list[tuple[str, list[Token], float]],
) -> list[Token]:
    """Non-label tokens on the SAME line to the right of a label, up to the
    start of the next *matched* label group ("PAY FREQUENCY: biweekly" and
    ledger/receipt rows).  Unmatched caps tokens like "MA" inside an address
    are part of the value, so only matched groups terminate collection."""
    label_end = group[-1].x1
    next_starts = [g[0].x0 for _, g, _ in all_groups if g[0].x0 > label_end]
    boundary = min(next_starts) if next_starts else float("inf")
    collected = [t for t in line
                 if label_end < t.x0 < boundary
                 and t not in group]
    # A collection with no digit and no lowercase char is caps-junk (another
    # tile's "CHECK /" prefix), not a value.
    if not any(any(c.isdigit() or c.islower() for c in t.text)
               for t in collected):
        return []
    return collected


_SEPARATOR_RE = re.compile(r"[/|:;•·\-=~]+")
_ORDINAL_RE = re.compile(r"[\[\(]?\d{1,2}[\]\)]?:?")


def _line_furniture(line: list[Token]) -> set[int]:
    """Token ids that are label furniture on a mixed label line: caps-group
    tokens, separators, and ordinals ADJACENT to them ("PIN / 02 /").  A
    bare number standing alone is a value, not furniture."""
    furniture = {id(t) for g in _caps_groups(line) for t in g}
    furniture.update(id(t) for t in line
                     if _SEPARATOR_RE.fullmatch(t.text))
    for index, token in enumerate(line):
        if not _ORDINAL_RE.fullmatch(token.text):
            continue
        neighbors = []
        if index > 0:
            prev = line[index - 1]
            if token.x0 - prev.x1 <= 26.0:
                neighbors.append(prev)
        if index + 1 < len(line):
            nxt = line[index + 1]
            if nxt.x0 - token.x1 <= 26.0:
                neighbors.append(nxt)
        if any(id(n) in furniture for n in neighbors):
            furniture.add(id(token))
    return furniture


def _runs(line: list[Token]) -> list[list[Token]]:
    """Segment a line into x-gap runs (a multi-word value stays together)."""
    runs: list[list[Token]] = [[line[0]]]
    for token in line[1:]:
        if token.x0 - runs[-1][-1].x1 > 25.0:
            runs.append([token])
        else:
            runs[-1].append(token)
    return runs


def _assign_runs(value_line, groups,
                 max_distance: float = 120.0) -> dict[int, list[Token]]:
    """Assign each x-gap run to the nearest label column; runs far from
    every label belong to an unrecognized column and are dropped."""
    assigned: dict[int, list[Token]] = {k: [] for k in range(len(groups))}
    if value_line:
        for run in _runs(value_line):
            distances = [abs(run[0].x0 - g[0].x0) for _, g, _ in groups]
            best = distances.index(min(distances))
            if min(distances) <= max_distance:
                assigned[best].extend(run)
    return assigned


def _harvest(
    lines: list[list[Token]], document_type: str | None = None,
    page: int = 1, seen: set[str] | None = None,
    overrides: dict[str, str] | None = None,
    used: set[int] | None = None,
) -> list[ExtractedField]:
    """Scored matching between label boxes and value boxes.

    For every label, value candidates are generated in four geometries --
    below (1.0), inline (0.95), column-scan (0.90), above (0.75) -- type-gated
    by the field parsers, scored semantic x geometry x recognition, and
    assigned greedily best-score-first with field- and token-exclusivity.

    ``seen`` (field names) and ``used`` (token ids) are shared across calls
    so multi-page documents and classifier re-runs stay consistent."""
    label_lines = [_label_groups(line, document_type, overrides)
                   for line in lines]
    fields: list[ExtractedField] = []
    if seen is None:
        seen = set()
    if used is None:
        used = set()

    candidates = []   # (score, order, field, tokens, source)
    order = 0
    for i, groups in enumerate(label_lines):
        if not groups:
            continue
        label_bottom = min(t.y0 for _, g, _ in groups for t in g)
        label_top = max(t.y1 for _, g, _ in groups for t in g)

        # Sticky/pinned layouts interleave labels and other pins' values on
        # one line: a label line still offers its NON-label tokens as values.
        # Label furniture never counts: tokens inside ANY caps group
        # (matched or not) and ordinal chrome ("ROW 07 /", "[02]", "::").
        def _usable(j: int) -> tuple[list[Token] | None, bool]:
            """(value tokens, from-mixed-label-line?)."""
            if not label_lines[j]:
                return list(lines[j]), False
            furniture = _line_furniture(lines[j])
            tokens = [t for t in lines[j] if id(t) not in furniture]
            return (tokens or None), True

        # Below: next line down with usable value tokens.  Values borrowed
        # from a mixed label line use a tight distance cap so a column
        # layout cannot steal the next row's value.
        below_line, below_mixed = None, False
        for j in range(i + 1, len(lines)):
            if label_bottom - max(t.y1 for t in lines[j]) > VALUE_GAP:
                break
            usable, mixed = _usable(j)
            if usable is None:
                break
            if usable:
                below_line, below_mixed = usable, mixed
            break
        below = _assign_runs(below_line, groups,
                             60.0 if below_mixed else 120.0)

        # Above: nearest line up with usable tokens (inverted layouts).
        above_line, above_mixed = None, False
        for j in range(i - 1, -1, -1):
            if min(t.y0 for t in lines[j]) - label_top > VALUE_GAP:
                break
            usable, mixed = _usable(j)
            if usable is None:
                break
            if usable:
                above_line, above_mixed = usable, mixed
            break
        above = _assign_runs(above_line, groups,
                             60.0 if above_mixed else 120.0)

        for k, (field_name, group, sem) in enumerate(groups):
            source = "llm" if sem == TIER_LLM_LABEL else "rules"
            if source == "llm":
                sem = 1.0   # confidence = geometry x recognition only
            options = [
                (below[k], GEOM_BELOW),
                (_inline_value_tokens(lines[i], group, groups), GEOM_INLINE),
                (_column_scan(lines, label_lines, i, group), GEOM_COLUMN),
                (above[k], GEOM_ABOVE),
            ]
            for tokens, geom in options:
                if not tokens:
                    continue
                value, tokens = _typed_parse(field_name, tokens)
                if value is None:
                    continue
                score = round(sem * geom * _recognition_conf(tokens), 3)
                candidates.append((score, order, field_name, tokens,
                                   value, source, group))
                order += 1

    # Greedy assignment, best score first; ties resolve in reading order.
    candidates.sort(key=lambda c: (-c[0], c[1]))
    for score, _, field_name, tokens, value, source, group in candidates:
        if field_name in seen or any(id(t) in used for t in tokens):
            continue
        seen.add(field_name)
        used.update(id(t) for t in tokens)
        fields.append(ExtractedField(
            field=field_name, value=value, page=page,
            bbox=_union_bbox(tokens), confidence=score, source=source,
            label_bbox=_union_bbox(group)))
    return fields


def _column_scan(lines, label_lines, label_index: int,
                 group: list[Token]) -> list[Token]:
    """First value tokens found in this label's x-column on lines further
    below.  Stops at another label line that claims the same column."""
    window = (group[0].x0 - COLUMN_SLACK, group[-1].x1 + 60.0)
    label_bottom = min(t.y0 for t in group)
    for j in range(label_index + 1, len(lines)):
        line_top = max(t.y1 for t in lines[j])
        if label_bottom - line_top > COLUMN_SCAN_GAP:
            break
        if label_lines[j]:
            furniture = _line_furniture(lines[j])
            in_window = [t for t in lines[j]
                         if window[0] <= t.x0 <= window[1]
                         and id(t) not in furniture]
        else:
            in_window = [t for t in lines[j]
                         if window[0] <= t.x0 <= window[1]]
        if in_window:
            return in_window
        if label_lines[j] and any(window[0] <= g[0].x0 <= window[1]
                                  for _, g, _ in label_lines[j]):
            break                   # a lower label owns this column now
    return []


def _recognition_conf(tokens: list[Token]) -> float:
    """Recognition quality of the value tokens: exact for vector text (1.0),
    the weakest word's tesseract confidence for OCR."""
    return min((t.conf if t.conf is not None else 1.0) for t in tokens)


def _unknown_label_texts(
    line: list[Token], document_type: str | None,
) -> list[tuple[str, str]]:
    """(normalized key, display text) for plausible-but-unrecognized labels,
    eligible for the anonymized LLM classifier."""
    out = []
    for group in _caps_groups(line):
        despaced = "".join(t.text for t in group)
        if (_label_field(despaced)
                or _synonym_field(despaced, document_type)):
            continue
        is_question = group[0].text.strip(":?") in _QUESTION_WORDS
        if ((len(group) <= 4 or is_question)
                and _fuzzy_label_field(despaced, document_type)):
            continue
        if len(group) > 5 and not is_question:
            continue
        key = _norm_key(despaced)
        if not key:
            continue
        # Word-level noise test: skip only labels made ENTIRELY of banner
        # words ("SYNTHETIC TRAINING RECORD"); mixed phrases like
        # "RECORD HOLDER" go to the classifier, which judges the full
        # phrase zero-shot.
        words = [t.text.strip(":?.,;()_").upper() for t in group]
        if all(any(noise in w for noise in _NOISE_WORDS)
               for w in words if w):
            continue
        out.append((key, " ".join(t.text for t in group)))
    return out


# Prose-sentence tier ("The recorded hourly rate is $28.00"): field phrase
# followed by a linking word, value = the sentence tail.  Deterministic and
# type-guarded by the same parsers as labeled values.
_PROSE_PATTERNS: list[tuple[str, str]] = [
    ("person_name",
     r"(?:employee|applicant|recipient|worker)(?: name)?|(?:record )?holder"
     r"|belongs"),
    ("document_date", r"(?:letter|document) date"),
    ("application_date", r"application date"),
    ("pay_date", r"pay(?:ment)? date"),
    ("pay_frequency", r"pay frequency"),
    ("pay_period_start", r"pay period start"),
    ("pay_period_end", r"pay period end"),
    ("gross_pay", r"gross pay|before deductions?"),
    ("net_pay",
     r"net (?:pay|reference)|after (?:every )?deductions?|take-home"),
    ("hourly_rate", r"hourly rate|rate of pay|hourly basis"),
    ("weekly_hours", r"weekly hours|hours per week"),
    ("regular_hours", r"regular hours"),
    ("household_size", r"household size|number of people|people included"),
    ("address", r"mailing address|correspondence|\bmail\b"),
]

# Value-BEFORE-phrase prose ("works 38.0 hours per week at $28.50 per hour"):
# the value capture group is explicit.
_PROSE_INLINE_PATTERNS: list[tuple[str, str]] = [
    ("weekly_hours", r"(?P<v>\d+(?:[.,]\d+)?)\s+hours?\s+(?:per|a|each)\s+week"),
    ("regular_hours", r"(?P<v>\d+(?:[.,]\d+)?)\s+hours?\s+(?:per|a|each|this)\s+"
                      r"(?:pay\s+)?period"),
    ("hourly_rate", r"(?:at\s+)?(?P<v>\$[\d,]+(?:\.\d+)?)\s+(?:per|an?|/)\s*hour"),
]


def _prose_fallback(
    lines: list[list[Token]],
    fields: list[ExtractedField],
    document_type: str | None,
    page: int = 1,
) -> list[ExtractedField]:
    """Mine 'the <field phrase> is <value>' sentences for missing fields.

    Label lines are excluded and the linking word is mandatory -- otherwise
    a label row like "APPLICANT  HOUSEHOLD SIZE" reads as a sentence and the
    neighboring label text becomes a phantom value.
    """
    seen = {f.field for f in fields}
    # Merge wrapped sentences: a non-label line continues the previous block
    # when the gap is tight and it starts lowercase (or the previous line
    # ended mid-clause), so multi-line statements match as one unit.
    blocks: list[list[Token]] = []
    for line in lines:
        if _label_groups(line, document_type):
            blocks.append([])            # label lines break continuation
            continue
        text = " ".join(t.text for t in line)
        if blocks and blocks[-1]:
            prev_text = " ".join(t.text for t in blocks[-1])
            gap = (min(t.y0 for t in blocks[-1])
                   - max(t.y1 for t in line))
            if 0 <= gap <= 18.0 and (text[:1].islower()
                                     or prev_text.rstrip()[-1:] in ",;-"):
                blocks[-1].extend(line)
                continue
        blocks.append(list(line))
    prose_blocks = [b for b in blocks if b]
    for field_name, phrase in _PROSE_PATTERNS:
        if field_name in seen:
            continue
        # Gap-tolerant link: "the gross pay is X", "comes to X",
        # "keep this reference: X", "record holder, X".
        pattern = re.compile(
            rf"\b(?:{phrase})\b.{{0,40}}?(?:\bis\b|\bwas\b|\bto\b|\bat\b|:|,)"
            rf"\s+(?P<tail>.+)$", re.I)
        for line in prose_blocks:
            match = pattern.search(" ".join(t.text for t in line))
            if not match:
                continue
            tail_words = match.group("tail").split()
            tokens = line[-len(tail_words):]
            value, tokens = _typed_parse(field_name, tokens)
            # A trailing token from a neighboring column can contaminate an
            # untyped tail ("... is Iris North 2"): retry without it.
            trims = 0
            while value is None and len(tokens) > 1 and trims < 3:
                tokens = tokens[:-1]
                trims += 1
                value, tokens = _typed_parse(field_name, tokens)
            if value is None:
                continue
            seen.add(field_name)
            fields.append(ExtractedField(
                field=field_name, value=value, page=page,
                bbox=_union_bbox(tokens),
                confidence=round(TIER_PROSE * _recognition_conf(tokens), 3)))
            break
    # Value-before-phrase constructions ("38.0 hours per week").
    for field_name, pattern_text in _PROSE_INLINE_PATTERNS:
        if field_name in seen:
            continue
        pattern = re.compile(pattern_text, re.I)
        for line in prose_blocks:
            match = pattern.search(" ".join(t.text for t in line))
            if not match:
                continue
            raw = match.group("v")
            token = next((t for t in line
                          if t.text.strip(".,;:") == raw.strip(".,;:")), None)
            if token is None:
                continue
            value = _parse_value(field_name, raw)
            if value is None:
                continue
            seen.add(field_name)
            fields.append(ExtractedField(
                field=field_name, value=value, page=page,
                bbox=(token.x0, token.y0, token.x1, token.y1),
                confidence=round(TIER_PROSE * _recognition_conf([token]), 3)))
            break
    return fields


_FREQ_TARGET = {"pay_stub": "pay_frequency", "benefit_letter": "benefit_frequency"}


def _frequency_prose_fallback(
    lines: list[list[Token]],
    fields: list[ExtractedField],
    document_type: str | None,
    page: int = 1,
) -> list[ExtractedField]:
    """Recover an explicit frequency stated in prose when no labeled panel
    provided one ("this job is paid at this frequency: biweekly").

    Safe because frequency words are a closed vocabulary (calc.FREQUENCY);
    lines that mention "frequenc..." are preferred over incidental uses.
    """
    target = _FREQ_TARGET.get(document_type or "")
    if target is None or any(f.field == target for f in fields):
        return fields
    candidates = []
    for line in lines:
        mentions = "frequenc" in " ".join(t.text for t in line).lower()
        for token in line:
            word = token.text.strip(".,:;").lower()
            if word in FREQUENCY:
                candidates.append((not mentions, token, word))
    if candidates:
        candidates.sort(key=lambda c: c[0])   # prefer explicit mentions
        _, token, word = candidates[0]
        fields.append(ExtractedField(
            field=target, value=word, page=page,
            bbox=(token.x0, token.y0, token.x1, token.y1),
            confidence=round(TIER_PROSE * _recognition_conf([token]), 3)))
    return fields


def _extend_untrusted(
    lines: list[list[Token]],
    fields: list[ExtractedField],
    document_type: str | None,
    page: int = 1,
) -> list[ExtractedField]:
    """Untrusted blocks may wrap onto following lines; merge continuation
    lines (non-label, tight vertical gap, previous line not sentence-final)."""
    for f in fields:
        if f.field != "untrusted_instruction_text" or f.page != page:
            continue
        while not str(f.value).rstrip().endswith((".", "!", "?")):
            below = [line for line in lines
                     if not _label_groups(line, document_type)
                     and f.bbox[1] - max(t.y1 for t in line) > 0
                     and f.bbox[1] - max(t.y1 for t in line) <= 16.0]
            if not below:
                break
            line = below[0]
            f.value = f"{f.value} " + " ".join(t.text for t in line)
            merged = _union_bbox(line)
            f.bbox = (min(f.bbox[0], merged[0]), min(f.bbox[1], merged[1]),
                      max(f.bbox[2], merged[2]), max(f.bbox[3], merged[3]))
    return fields


def _instruction_fallback(
    lines: list[list[Token]], fields: list[ExtractedField], page: int = 1,
) -> list[ExtractedField]:
    """Catch instruction-like text even when its label was not recognized.

    If a partial capture exists (mixed-line harvesting can strip a fake
    caps prefix like "GROSS PAY $0.01 ..."), upgrade it to the full line."""
    existing = next((f for f in fields
                     if f.field == "untrusted_instruction_text"), None)
    for line in lines:
        text = " ".join(t.text for t in line)
        if not INSTRUCTION_RE.search(text):
            continue
        if existing is None:
            fields.append(ExtractedField(
                field="untrusted_instruction_text", value=text, page=page,
                bbox=_union_bbox(line),
                confidence=round(TIER_INSTRUCTION * _recognition_conf(line), 3)))
        else:
            line_bbox = _union_bbox(line)
            overlaps = (existing.page == page
                        and existing.bbox[0] < line_bbox[2]
                        and line_bbox[0] < existing.bbox[2]
                        and existing.bbox[1] < line_bbox[3]
                        and line_bbox[1] < existing.bbox[3])
            if overlaps and len(text) > len(str(existing.value)):
                existing.value = text
                existing.bbox = line_bbox
        break
    return fields


# --- entry points --------------------------------------------------------
def tokenize_document(
    pdf_path: str | Path,
) -> tuple[list[list[Token]], tuple[float, float], bool]:
    """The expensive I/O stage: (token list per page, page size, rasterized).

    Each page auto-detects the rasterized/OCR path.  Pure function of the
    PDF, safe to run in a worker process (tokens pickle cleanly)."""
    token_pages, page_size = vector_pages(pdf_path)
    if not token_pages:
        token_pages = [[]]
    rasterized = len(token_pages[0]) < MIN_VECTOR_TOKENS
    pages = []
    for index, tokens in enumerate(token_pages):
        if len(tokens) < MIN_VECTOR_TOKENS:
            tokens = ocr_tokens(pdf_path, page_size, index)
        pages.append(tokens)
    return pages, page_size, rasterized


class MatchState:
    """Deterministic matching over tokenized pages, resumable with
    classifier overrides (used by both the per-doc and batch paths)."""

    def __init__(self, token_pages: list[list[Token]],
                 document_type: str | None):
        self.document_type = document_type
        self.per_page = [(i + 1, _cluster_lines(tokens))
                         for i, tokens in enumerate(token_pages)]
        self.fields: list[ExtractedField] = []
        self.seen: set[str] = set()
        self.used: dict[int, set[int]] = {n: set() for n, _ in self.per_page}

    def run_deterministic(self) -> None:
        """Everything local: labeled harvest, untrusted capture, prose and
        frequency fallbacks.  LLM tiers only ever see what remains missing
        after ALL of this."""
        for page_number, lines in self.per_page:
            self.fields.extend(_harvest(
                lines, self.document_type, page_number, self.seen,
                used=self.used[page_number]))
        for page_number, lines in self.per_page:
            self.fields = _instruction_fallback(lines, self.fields,
                                                page_number)
            self.fields = _extend_untrusted(lines, self.fields,
                                            self.document_type, page_number)
        for page_number, lines in self.per_page:
            self.fields = _prose_fallback(lines, self.fields,
                                          self.document_type, page_number)
            self.fields = _frequency_prose_fallback(
                lines, self.fields, self.document_type, page_number)
        self.seen.update(f.field for f in self.fields)

    def missing_expected(self) -> set[str]:
        """Core fields still missing -- the LLM-call trigger.  Optional
        fields never trigger; a frequency-specific benefit field satisfies
        the generic benefit_amount."""
        from . import llm_backup
        doc_type = self.document_type or ""
        expected = set(llm_backup.EXPECTED_FIELDS.get(doc_type, {}))
        expected -= llm_backup.OPTIONAL_FIELDS.get(doc_type, set())
        satisfied = set(self.seen)
        if any(name.endswith("_benefit") for name in satisfied):
            satisfied.add("benefit_amount")
        return expected - satisfied

    def unknown_labels(self) -> dict[str, str]:
        """normalized key -> display text of unclassified label boxes."""
        unknown: dict[str, str] = {}
        for _, lines in self.per_page:
            for line in lines:
                for key, text in _unknown_label_texts(line,
                                                      self.document_type):
                    unknown.setdefault(key, text)
        return unknown

    def apply_overrides(self, overrides: dict[str, str]) -> None:
        """Re-run the matcher with classifier-decided label mappings."""
        overrides = {key: field for key, field in overrides.items()
                     if field in self.missing_expected()}
        if not overrides:
            return
        for page_number, lines in self.per_page:
            self.fields.extend(_harvest(
                lines, self.document_type, page_number, self.seen,
                overrides, self.used[page_number]))

    def sensitive_words(self) -> set[str]:
        """Words from already-extracted names/addresses: force-masked in the
        symbolized text even when they are dictionary words ("Meadow")."""
        words: set[str] = set()
        for f in self.fields:
            if f.field in ("person_name", "address"):
                words.update(w.strip(".,;:()").lower()
                             for w in str(f.value).split())
        return words

    def symbolize(self):
        """(symbol text, symbol table) for the comprehension pass."""
        from . import llm_backup
        return llm_backup.symbolize_document(self.per_page,
                                             self.sensitive_words())

    def fill_from_comprehension(self, mapping: dict, symtab: dict) -> None:
        """Resolve field->symbol answers back to real tokens, type-gated.

        The model only names positions (or a cadence word); values, boxes,
        and validity still come from this machine."""
        from . import llm_backup
        expected = llm_backup.EXPECTED_FIELDS.get(self.document_type or "", {})
        for field_name, symbol in mapping.items():
            if (field_name in self.seen or field_name not in expected
                    or not isinstance(symbol, str)):
                continue
            entry = symtab.get(symbol.strip())
            if entry is None:
                # Frequency fields answer with the cadence word itself.
                word = symbol.strip().lower()
                if not field_name.endswith("_frequency") or word not in FREQUENCY:
                    continue
                located = None
                for page_number, lines in self.per_page:
                    for line in lines:
                        for token in line:
                            if token.text.strip(".,;:").lower() == word:
                                located = (page_number, [token])
                                break
                        if located:
                            break
                    if located:
                        break
                if located is None:
                    continue
                entry = located
            page_number, tokens = entry
            if any(id(t) in self.used[page_number] for t in tokens):
                continue
            value, tokens = _typed_parse(field_name, tokens)
            if value is None:
                continue
            self.seen.add(field_name)
            self.used[page_number].update(id(t) for t in tokens)
            self.fields.append(ExtractedField(
                field=field_name, value=value, page=page_number,
                bbox=_union_bbox(tokens),
                confidence=round(_recognition_conf(tokens), 3),
                source="llm"))

    def finalize(self) -> list[ExtractedField]:
        # A generic "BENEFIT AMOUNT" label resolves to the frequency-specific
        # gold field name once the benefit frequency is known.
        frequency = next((f.value for f in self.fields
                          if f.field == "benefit_frequency"), None)
        for f in self.fields:
            if f.field == "benefit_amount" and frequency:
                f.field = f"{frequency}_benefit"
        # Reading order: page, then top of page first.
        self.fields.sort(key=lambda f: (f.page, -f.bbox[3], f.bbox[0]))
        return self.fields


def _build_record(pdf_path, document_id, household_id, document_type,
                  file_name, fields, page_size, rasterized) -> DocumentRecord:
    return DocumentRecord(
        document_id=document_id,
        household_id=household_id,
        document_type=document_type,
        file_name=file_name or Path(pdf_path).name,
        fields=fields,
        page_size_points=page_size,
        rasterized=rasterized,
        contains_adversarial_text=any(
            f.field == "untrusted_instruction_text" for f in fields),
    )


def extract_document(
    pdf_path: str | Path,
    document_id: str,
    household_id: str,
    document_type: str,
    file_name: str | None = None,
) -> DocumentRecord:
    """One PDF -> DocumentRecord (per-document path with its own classifier
    round; the batch path in batch.py shares MatchState but makes at most
    one classifier call for the whole batch)."""
    token_pages, page_size, rasterized = tokenize_document(pdf_path)
    state = MatchState(token_pages, document_type)
    state.run_deterministic()

    # Anonymized LLM label classifier (ON by default): unknown label
    # wordings -- and ONLY the label wordings, never any value -- are
    # classified into canonical fields, then the local matcher re-runs.
    from . import llm_backup
    if llm_backup.labels_enabled() and state.missing_expected():
        unknown = state.unknown_labels()
        if unknown:
            mapping = llm_backup.classify_labels(
                sorted(unknown.values()), document_type)
            state.apply_overrides({
                key: mapping[text] for key, text in unknown.items()
                if text in mapping})

    # Comprehension backup: symbol-anonymized structured reading for fields
    # still missing after labels failed (prose-only or alien structures).
    if llm_backup.comprehension_enabled() and llm_backup.recoverable_missing(
            document_type, state.missing_expected()):
        text, symtab = state.symbolize()
        answers, _calls = llm_backup.comprehend_documents(
            [("DOC1", document_type, text)])
        state.fill_from_comprehension(answers.get("DOC1", {}), symtab)

    fields = state.finalize()
    return _build_record(pdf_path, document_id, household_id, document_type,
                         file_name, fields, page_size, rasterized)


_FILENAME_RE = re.compile(r"(hh-\d+)_d(\d+)_(.+)\.pdf", re.I)


def extract_pack(
    manifest_path: str | Path | None = None,
    documents_dir: str | Path | None = None,
) -> list[DocumentRecord]:
    """Extract every document listed in the pack manifest.

    Falls back to filename-pattern discovery when no manifest exists.
    """
    documents_dir = Path(documents_dir or config.DOCUMENTS_DIR)
    manifest_path = Path(manifest_path or config.DOCUMENT_MANIFEST)

    jobs: list[tuple[str, str, str, str]] = []   # (doc_id, hh_id, type, file)
    if manifest_path.exists():
        with open(manifest_path, newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                jobs.append((row["document_id"], row["household_id"],
                             row["document_type"], row["file_name"]))
    else:
        for pdf in sorted(documents_dir.glob("*.pdf")):
            match = _FILENAME_RE.match(pdf.name)
            if not match:
                continue
            hh, d_num, doc_type = match.groups()
            jobs.append((f"{hh.upper()}-D{int(d_num):02d}", hh.upper(),
                         doc_type, pdf.name))

    from . import llm_backup

    docs = [
        extract_document(documents_dir / file_name, doc_id, hh_id, doc_type,
                         file_name)
        for doc_id, hh_id, doc_type, file_name in jobs
    ]
    # Second chance: with the classifier's positive cache warmed by sibling
    # documents (same template labels), one re-extraction recovers fields a
    # flaky first-round classification missed.
    if llm_backup.enabled():
        for index, (doc_id, hh_id, doc_type, file_name) in enumerate(jobs):
            expected = set(llm_backup.EXPECTED_FIELDS.get(doc_type, {}))
            have = {f.field for f in docs[index].fields}
            if expected - have:
                docs[index] = extract_document(
                    documents_dir / file_name, doc_id, hh_id, doc_type,
                    file_name)
    return docs
