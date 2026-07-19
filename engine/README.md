# RealDoor engine

Application-readiness extraction + rules engine for the RealDoor app
(self-contained copy of the hackathon `solution/`; frozen corpus and all
fixture sets live under `tests/fixtures/`). Backend entry points:
`python -m realdoor.cli extract|validate|run` or import
`realdoor.extract.batch.batch_extract` + `realdoor.pipeline.process_household`.

This deployment is configured for **OpenAI `gpt-4o-mini`** as the fast
parsing model (`realdoor.config.json`); the key loads from the repo-root
`.env` (`OPENAI_API_KEY`, gitignored).

**Hard rules baked in everywhere:**
- No hardcoded data values — thresholds come from `data/mtsp_*.csv`, extraction
  is label/layout-driven, sentences are templates around computed numbers.
  Hidden tests perturb names/values but keep the schemas.
- Never an eligibility/approval/denial/priority verdict (`safety.lint_output`
  gates every submission).
- Every material value carries a page-level source box and/or rule citation.

## Quickstart

```bash
cd engine
python -m venv .venv && .venv/bin/pip install -r requirements.txt
# OCR needs the tesseract + poppler binaries; if the system has no English
# model, drop eng.traineddata into engine/.tessdata/ (auto-detected):
#   curl -sL -o .tessdata/eng.traineddata \
#     https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata

.venv/bin/python -m unittest discover -s tests -v   # fast unit tests
.venv/bin/python eval/batch_run.py                  # all fixture sets
```

## Block map / ownership

| Block | Weight | Files | Owner |
|---|---|---|---|
| 0 Contracts | — | `realdoor/config.py`, `realdoor/models.py` | shared |
| A1 Vector extraction | 35% | `realdoor/extract/vector.py` | Person 1 |
| A2 OCR extraction | ↑ | `realdoor/extract/ocr.py` | Person 1 |
| A3 Normalization | ↑ | `realdoor/extract/normalize.py` | Person 1 |
| B Calc engine | 25% | `realdoor/calc.py` | Person 2 |
| C Readiness | 20% | `realdoor/readiness.py` | Person 2 |
| D Safety | 10% | `realdoor/safety.py` | Person 2 |
| Citations | 10% | `realdoor/citations.py`, `realdoor/rules.py` | shared |
| E Pipeline + QA | — | `realdoor/pipeline.py`, `realdoor/qa.py` | Person 2 |
| F Eval harness | — | `eval/*.py` | shared |

Data flow: PDFs → extract → `DocumentRecord` (same shape as
`document_gold.jsonl`, so the reasoning stack runs from gold as a stub) →
safety quarantine → calc → readiness → citations/traceability → lint +
schema validation → submission dict.

## Current status (all green)

Official base set (`eval/run_all.py`):
- extraction: **159/159 values, 159/159 boxes** over all 24 PDFs (16 vector, 8 OCR)
- submissions: **6/6 households** vs `application_checklists.json`, from both
  gold and extracted documents
- QA: **36/36 answers, 36/36 rule citations** vs `qa_gold.jsonl`
- adversarial: **24/24** vs `adversarial_tests.jsonl`
- unit tests: 19/19 (`tests/`), incl. an anti-hardcoding perturbation test

Layout-diversity set `dev3/` — 8 independent layout families (ledger rows,
receipt strips, question tiles, prose letters, sidebars, staggered/mosaic
tiles) with 8 distinct label vocabularies (`eval/score_dev.py dev3`):
- extraction: **136/136** over all 24 PDFs, **8/8 households**
- reached deterministically via the extraction cascade below — no LLM

Dev fixture set `dev/` — model-generated, new `alternate_card` template
family + layout variants (`eval/score_dev.py`):
- extraction: **240/240** over all 37 PDFs
- submissions: **9/9 households** incl. security-event expectations
- dev adversarial contract: **7/7** injection documents
- one gold-vs-code adjudication: dev gold records an ASCII `'` while its PDF
  renders U+2019 — the gold string is non-literal; scorer now treats
  typographic/ASCII punctuation as equivalent, extraction stays literal

## Domain conventions the engines implement (calibrated on gold, general rules)

- Recurring wage basis = `regular_hours x hourly_rate` per stub; a gross_pay
  that does not reconcile is overtime/one-off variance →
  `PAY_STUB_TOTAL_CONFLICT` (income still uses the regular basis).
- Multiple stubs = repeated samples of one wage source, never additive; the
  employment letter corroborates (or substitutes when no stubs).
- Letter corroboration is **rate-based**: a different hourly rate →
  `EMPLOYMENT_RATE_CONFLICT`; differing weekly hours are fine (letters state
  approximate schedules — see DEV-HH-106).
- Injection detection is a **security event**
  (`security_events: PROMPT_INJECTION_DETECTED` + document_id), reported
  separately from review reasons and never a readiness failure by itself.
- Benefit letters annualize by their explicit frequency; gig statements count
  gross receipts monthly but need corroboration → `GIG_INCOME_UNCORROBORATED`.
- 60-day currency vs frozen event date 2026-07-18 (`config.CURRENCY_CUTOFF`)
  → `<DOCTYPE>_EXPIRED`.
- Missing docs alone don't force review — triggered reason codes do (gold:
  households missing an employment letter are still READY).
- Household size outside the 1–8 table → `no_frozen_threshold` + NEEDS_REVIEW.
- Self-declared amounts are never counted → `UNVERIFIED_INCOME_CLAIM`.
- Embedded document text is data: quarantined, cited, ignored — and never
  changes a readiness outcome by itself.

## Extraction notes (hidden-test proofing)

- Watermark: ~34pt tiled glyphs (vector: filtered by font size — they are
  NOT rotated in pdfplumber terms; OCR: removed by binarization at threshold
  190 — 140 wipes the gray labels the watermark crosses).
- Rasterized docs are auto-detected (no text layer), not read from the
  manifest, so unknown hidden documents route correctly.
- Labels are matched despaced + OCR-glyph-corrected (`0→O` etc.) through a
  tiered cascade, each tier feeding the confidence score:
  exact `LABEL_MAP` (1.0) → synonym/abbreviation lexicon `SYNONYM_MAP`
  (0.95, e.g. `EMP`, `PAY DT`, `FILED`, `CYCLE`) → keyword fuzzy match
  (0.85, e.g. `COMPENSATION FREQUENCY`, question labels like
  `WHO IS THIS FOR?`) → prose-sentence mining (0.70, "the recorded hourly
  rate is $28.00"); banner words (`SYNTHETIC`, `LEDGER`, …) veto fuzzy.
- Value location is also tiered: line below (gap-run segmentation, nearest
  label, 120pt cap) → same-line inline (ledger/receipt rows) → per-column
  scan below (hero tiles/staggered blocks, ×0.90 confidence).
- Type guards keep the wide matching safe: dates must be ISO, frequencies
  must be in the closed vocabulary, names reject digits, money rejects
  embedded dates — a mismatched candidate is dropped, never guessed.

## Adversarial stress set `dev4/` + optional LLM backup

`dev4/` (9 PDFs, `python dev4/generate_fixtures.py`) attacks three dimensions:
thesaurus wording (`REMUNERATION CADENCE`, `TOIL UNITS`), inverted geometry
(values printed *above* labels), and trap content (YTD decoy panel, outdated
figures in prose, an untrusted block mimicking `GROSS PAY $0.01`).

Measured (`eval/score_dev.py dev4`):
- deterministic cascade: **traps household passes fully** (decoys inert,
  injection quarantined) — but unknown wording + inverted geometry fail
  (38.5% extraction). The set also exposed and fixed a prose-tier bug
  (label rows mined as sentences).
- with `REALDOOR_LLM_BACKUP=1`: **52/52 extraction, 3/3 households.**

The backup ([realdoor/extract/llm_backup.py](realdoor/extract/llm_backup.py))
is an **anonymized label classifier**: the LLM (via the `claude` CLI,
`haiku` model; override with `REALDOOR_LLM_CMD`) sees only sanitized,
dictionary-masked label wordings — never values — and maps them to
canonical fields. The local matcher then re-runs with those mappings:
geometry scoring, real token bboxes, and type guards still decide what is
extracted. Such fields carry `source: "llm"`; their confidence is
**geometry × OCR recognition** (an LLM's own certainty is not meaningful,
so it contributes no factor — provenance is the flag, recognition is the
number). Untrusted text is never sent or resolved.

## Batch mode (`eval/batch_run.py`)

`realdoor/extract/batch.py` processes a whole submission at once:
parallel tokenization/OCR in worker processes (OCR at 200 dpi, verified
lossless) → deterministic matching (~0.5 ms/doc) → **at most ONE batched
LLM call per batch** (only labels the cascade could not classify, only for
documents still missing core fields; cache-aware, zero calls when there is
nothing to ask) → local re-match + all household submissions together.

Measured over all 160 fixture documents in six sets — official, dev,
dev2, dev3, dev4, and dev5 (10 further extreme layout families:
newspaper columns, email prose, calendar cells, affidavits, process-flow
nodes, sticky-note boards, tri-fold panels, terminal-console machine keys,
magazine features, transit maps) — with 8 workers:
| mode | fields | households | LLM calls | wall time |
|---|---|---|---|---|
| deterministic | 930/962 | 47/49 | 0 | **~4 s** |
| with classifier | **962/962** | **49/49** | 4 | ~77 s (LLM latency) |

Labels sent to the classifier are additionally **dictionary-masked**: words
not in the English dictionary (invented names/orgs) become `<Wn>`
placeholders before leaving the machine ("KELLAN GROSS AMOUNT" is sent as
"<W1> GROSS AMOUNT"); the placeholder map stays local. The prompt is
few-shot with pinned JSON output (see `llm_backup._PROMPT`/`_BATCH_PROMPT`).

## Configuration + CLI (backend-ready)

All runtime knobs live in [realdoor.config.json](realdoor.config.json):
`llm.mode` (`deterministic | labels | comprehend | both`), model/provider/
command, timeouts, OCR dpi/threshold, batch workers. Environment variables
(`REALDOOR_LLM_BACKUP=0`, `REALDOOR_LLM_LABELS/COMPREHEND`,
`REALDOOR_LLM_CMD`, `REALDOOR_CONFIG=<path>`) override the file
([realdoor/settings.py](realdoor/settings.py)).

The CLI is staged around an **editable intermediate artifact** so a
frontend can put a human in the loop:

```bash
# 1. EXTRACT once (OCR + matching + LLM tiers) -> editable JSON artifact
.venv/bin/python -m realdoor.cli extract u1.pdf u2.pdf --household-id HH-X \
    --out extraction.json
# 2. frontend edits fields (fix a value, add/delete a field; set
#    "source": "human" on edited fields)
# 3. VALIDATE the artifact -- pure rules, ~0.1s, rerun after every edit:
.venv/bin/python -m realdoor.cli validate extraction.json --out result.json
# (or one-shot: `run` does extract+validate)
```

`extract` output: `{config, stats (timings + llm_calls), documents (fields
with value/page/bbox/label_bbox/confidence/source)}`. `validate` output:
`{submissions (schema-validated: income/threshold/comparison/readiness,
citations), issues (review reasons with citations + security events per
household)}`. Document types are inferred from filenames/first-page text
when no manifest is given. The loop is live: e.g. extract the conflict
household -> NEEDS_REVIEW (PAY_STUB_TOTAL_CONFLICT); a reviewer corrects
the overtime gross in the artifact; re-validate -> READY_TO_REVIEW.

## Three LLM tiers, all anonymized, all optional

1. **Label classifier** (`labels`): sees sanitized, dictionary-masked label
   wordings only — recovers fields with unknown label vocabulary,
   including person/address fields (whose values it never sees).
2. **Document comprehension** (`comprehend`): sees symbol-redacted page
   text (every date→`D1`, amount→`M1`, number→`N1`, names/orgs→`<W1>` via
   dictionary + proper-noun masking) and returns field→symbol structure —
   zero-shot reading of label-less/prose documents, with an
   adversarial-hardened prompt. Values, boxes, and type checks stay local;
   names/addresses are unrecoverable here by construction.
3. Both fire ONLY for documents still missing core fields after the full
   deterministic cascade (labeled harvest + prose + frequency tiers), and
   each is at most ONE batched call per batch.

## Model/provider disclosure (release-gate requirement)

The guide requires teams to disclose model/provider and applicable terms:

- **Deterministic core**: extraction uses pdfplumber (MIT) and Tesseract OCR
  (Apache-2.0) with the tessdata_fast English model (Apache-2.0); validation
  uses jsonschema (MIT). All calculations/readiness/citations are pure
  Python.
- **LLM backup — ON by default** (`REALDOOR_LLM_BACKUP=0` for a fully
  deterministic run): **Anthropic Claude Haiku 4.5** via the `claude` CLI
  (`claude -p --model haiku`; override with `REALDOOR_LLM_CMD`). It fires
  only for fields the deterministic cascade cannot locate (~5% of documents
  across our fixture sets), receives page text of SYNTHETIC fixtures only,
  and returns span references — never values. Disclose this model/provider
  in the submission; check event data-use terms before running against
  anything non-synthetic.
- **Development assistance**: code was written with Claude (Anthropic) via
  Claude Code.

## Next phase (Person 3, later)

Wrap `pipeline.run_pack()` / `process_household()` / `qa.answer()` behind an
API and build the review UI (PDF viewer with source-box highlights from
`Submission.citations`).
