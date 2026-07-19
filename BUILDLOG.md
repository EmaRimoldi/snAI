# BUILDLOG

## 2026-07-18 — After-login pipeline (Profile → Understand → Prepare), demo build

**Shipped** (all new files unless noted; signed-in users now enter the pipeline):
- `frontend/lib/data/mtsp2026.ts`, `frontend/lib/data/ruleCorpus.ts` — bundled FY2026 60% MTSP
  thresholds + the frozen 11-rule corpus (from the starter pack; not the gold/eval files).
- `frontend/lib/pipeline/types.ts`, `calc.ts`, `rules.ts`, `state.tsx`, `copy.ts` — types; deterministic
  income/threshold/readiness math (integer cents, ported from `calculate.py`); rules Q&A + refusals;
  the reactive `AppStateProvider` (Status / Gross Income / Errors); localized pipeline copy.
- `frontend/lib/engine/extract.ts` — mock classify + extract behind `NEXT_PUBLIC_ENGINE`.
- `frontend/components/pipeline/*` — PipelineApp, GlobalValues, Stepper, ProfileStep, UnderstandStep,
  PrepareStep, DocumentPreview, and `pipeline.module.css`.
- Edited `frontend/app/page.tsx` (mount pipeline when signed in) and `CLAUDE.md §2A` (flow renamed to
  Profile → Understand → Prepare).

**Decisions / deviations (demo scope, not production):**
- **No new dependencies.** Skipped `pdfjs`/`zod` — installing onto the WSL mount from Windows fetches
  wrong-platform Next/SWC binaries. Preview = native "open document" link + a page schematic with the
  bbox highlighted (normalized coords); validation = TS types + light guards.
- **Mock engine seam.** Extraction is a deterministic mock (per-filename hash, never keyed to household
  IDs) so the demo runs standalone; teammates' real engine swaps in via `NEXT_PUBLIC_ENGINE`.
- **Client-side state.** The application record lives in React context; **Supabase Storage/Postgres
  persistence deferred** (the chosen durable store is a follow-up, not needed for the demo loop).
- **Pipeline copy** in `lib/pipeline/copy.ts` (EN complete + ES/ZH/TL/VI for visible chrome, EN
  fallback) rather than `dictionaries.ts`, to avoid churn on that actively-developed file. Fold in later.
- **CSS Modules** for pipeline components (consume the global `:root` tokens) to avoid clobbering the
  in-flight `globals.css` edits.

**Verified:** `tsc --noEmit` clean across all 15 new files (strict mode). **Not run:** live
click-through — the pipeline is behind login (no demo creds here) and there is no local Node toolchain
in WSL; Vercel builds on push. Run locally with `npm install && npm run dev` in `frontend/`, or push
for a Vercel preview.

**Follow-ups:** swap mock→real engine; add `supabase.auth.onAuthStateChange` before authenticated
Supabase calls; wire the private `documents` Storage bucket + persistence; fold `copy.ts` into
`dictionaries.ts` + `i18n_translations` and complete the longer-string translations; make the
conflict/expired/quarantine cases reliably triggerable for the live demo.

## 2026-07-19 — Progress-aware status in the header (chips), sticky header

**Shipped:** a UI-only `DisplayStatus` ladder derived from already-parsed state —
NOT_STARTED → PROCESSING → AWAITING_CONFIRMATION (n unconfirmed) → EVIDENCE_ISSUES (n blocking) →
DOCUMENTS_MISSING (informational) → READY → PACKET_LOCKED — shown as two minimal color-coded chips
(Status + Errors with a circled-! / check icon) inside the now-sticky `SiteHeader`, visible only in
the app view. `deriveDisplayStatus()`/`countUnresolved()` live in `lib/pipeline/calc.ts`;
`AppStateProvider` moved from `PipelineApp` up to `app/page.tsx` so the header shares the record;
`GlobalValues` (Status/Gross-Income/Errors cards) removed — gross income now appears only in
Understand. Copy for the new states added in all five languages (`lib/pipeline/copy.ts`).

**Decisions / deviations:**
- The exported `submission.readiness_status` remains strictly the organizer binary
  (READY_TO_REVIEW / NEEDS_REVIEW); the ladder maps down and adds no new export vocabulary.
- New `--success` token in `globals.css` (user-directed status color-coding; deviates from the
  design doc's "no success color" rule). Mitigation: color is never the only signal — each state has
  distinct text, and the error chip pairs color with a distinct icon (circled ! vs check).
- `body` `overflow-x` switched to `clip` (with `hidden` fallback) so `position: sticky` works.

**Verified:** `npm run build` clean (strict TS). Live click-through of the ladder still to be done in
the browser (upload → confirm → lock walk; delete-session → NOT_STARTED).

## 2026-07-19 — Errors chip → expandable menu; auto-advance on confirm

**Shipped:**
- The header errors chip is now a disclosure button: it expands a small menu titled "What needs
  attention" listing one entry per counted error — unconfirmed fields ("Needs your check"),
  confirmed-but-low-confidence fields, and each missing checklist document — with a one-line
  explanation. Choosing a field entry jumps straight to it in Profile (new
  `requestReviewField(id)` / `pendingReviewFieldId` in `lib/pipeline/state.tsx`, consumed by a
  `ProfileStep` effect); a missing-document entry jumps to the upload checklist. Menu closes on
  outside click and Escape (focus returned to the chip); entry count always equals the chip number.
- Confirming or saving a correction in Profile now auto-advances to the next field still needing a
  check (forward search with wrap; stays put when none remain), so reviewing a document flows
  hands-free from value to value.
- New copy keys (`errorsMenuTitle`, `errLowConfidence`) in all five languages.

**Verified:** `npm run build` clean (strict TS). Browser click-through still recommended.

## 2026-07-19 — Error semantics decoupled from confirmation; traffic-light chip

**Shipped (user-directed redefinition):**
- **Errors now = detected inconsistencies / rule flags on CONFIRMED values only** (pay-stub
  conflict, expired letter, gig corroboration) — `computeReadiness` evidence checks fire only once
  the involved fields are confirmed/corrected; `computeErrorCount(reasons)` counts blocking
  non-UNCONFIRMED reasons. Unconfirmed fields and missing documents are pending/informational,
  never errors.
- **Traffic light on the errors chip:** red (circled !) = errors found; yellow (clock icon, new
  `--warn` amber token) = no errors but values unconfirmed; green (check) = all confirmed and ok.
  Status-chip tones aligned (AWAITING/DOCUMENTS_MISSING now amber). Ladder priority flipped:
  EVIDENCE_ISSUES outranks AWAITING_CONFIRMATION (red beats yellow).
- **Menu improvements:** entries grouped errors → pending confirmations → missing documents, each
  with explanation + jump; menu is scrollable (max-height 60vh); opening focuses the first entry;
  after a jump, focus lands on the field heading in Profile.

**Note:** exported `submission.readiness_status` untouched — UNCONFIRMED_FIELDS still blocks it, so
final outcomes after full confirmation are identical to before.
