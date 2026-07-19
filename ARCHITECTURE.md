# RealDoor — Architecture & Risk Note

*Hack-Nation 2026 · Challenge 03 (RealPage) · Team snAI — one page, per the brief's deliverable #5.*

## Architecture

**Two deliberately separated halves, one contract.**

- **Engine** (`engine/`, Python 3.11 + FastAPI on :8787): deterministic extraction and reasoning.
  PDF → pdfplumber text layer (tesseract OCR fallback) → label-driven scored matcher (exact →
  synonym → fuzzy → prose fallback; confidence = semantic × geometry × recognition) → optional
  anonymized LLM backup (≤2 batched calls, sees masked labels/symbols only — never values, names,
  or boxes) → `DocumentRecord` with per-field page + bbox (PDF points) + calibrated confidence.
  Reasoning: frozen FY2026 MTSP table, income annualization, corroboration, readiness codes,
  rule-corpus Q&A, injection quarantine, decision-language lint, jsonschema-validated submissions.
- **Frontend** (`frontend/`, Next.js 16 + React 19): the renter journey — Profile (upload,
  pdf.js evidence viewer with source boxes, confirm/correct/renter-enter every field), Understand
  (structured income math with per-source formula, threshold + effective date + citations, rules
  chat answering only from the frozen 11-rule corpus), Prepare (readiness reasons, receipt preview,
  downloadable packet, session deletion with visible proof). All state lives in browser memory.
- **The seam:** `NEXT_PUBLIC_ENGINE` swaps a deterministic mock for the real engine without UI
  changes. `lib/engine/http.ts` is the single bbox-conversion point (bottom-left PDF points →
  top-left normalized). The frontend re-derives all math from **confirmed values only** and is
  verified to reproduce the engine's gold results exactly (official 6/6; dev splits 53/53 on
  income, comparison, status, and reason codes; `npm test` covers the math rules).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Wrong extraction drives wrong math | Nothing is reused until the renter confirms or corrects it; every value shows its source box + confidence; empty/abstained fields are typed by the renter and marked `renter_entered`. |
| Deciding eligibility (instant DQ) | No decision vocabulary anywhere; comparisons described only against the published limit; decision requests get a fixed negated refusal; engine lints every output string. |
| Prompt injection in documents | Document text is data, never instructions: instruction-like fields are quarantined, displayed transparently, excluded from all math; behavior never changes. |
| Privacy | Files never leave the browser (viewer renders in-memory bytes); AI context sends only confirmed numbers/statuses/references — never files, names, or raw text; deletion wipes state + object URLs and shows a before/after proof. |
| Silent math drift | Deterministic integer-cent math; inclusive threshold boundary pinned by test; frontend↔gold verified across all fixture splits; engine scoreboard (`eval/run_all.py`) plus frontend unit tests. |
| Hidden-test perturbation | No value or name is keyed to household IDs; classification is refined from extracted fields, not filenames; rules answers compute numbers instead of hardcoding them. |
| Offline venue / API failure | Mock engine and local frozen-rule fallback keep the full journey demoable with no network; global error boundary keeps the UI recoverable. |

**Known limitations:** engine remains authoritative for scored submissions (frontend mirrors it);
Supabase is used only for auth + i18n (documents deliberately not persisted); accessibility target
is WCAG 2.2 AA (keyboard-complete, live regions, no color-only signaling).
