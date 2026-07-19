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

## 2026-07-19 — Prepare: SAMPLE readiness receipt (paper preview, inline edit, print-to-PDF)

**Shipped:**
- New `frontend/components/pipeline/ReceiptDocument.tsx` + `receipt.module.css` — the Prepare step's
  Summary card is replaced by a stacked "paper" document (SAMPLE watermark + banner + on-document
  kicker so the flag survives print): applicant/household, documents checklist, confirmed details
  with per-row Correct (edit-in-place via `correctField`, hidden when locked; recompute cascades
  live), income calculation (annualized / FY2026 60% limit / comparison / effective date), file
  readiness (status + coded reasons + non-decisional note), and a refusal-form footer.
- "Save receipt as PDF" = `window.print()` + print isolation in `globals.css` (scoped with
  `body:has([data-print-region])` so printing pages without a receipt is untouched; the show rules
  carry the same `:has()` prefix — a bare `[data-print-region] *` loses the specificity fight and
  prints blank). "View raw data" keeps the `submission.json` `<pre>`; JSON download unchanged.
- ~18 new copy keys × all five languages; `deleteConfirm` now mentions the receipt (all five);
  removed dead `previewBtn`/`summaryTitle` keys. Supabase `i18n_translations` mirror for pipeline
  copy still follows the earlier fold-in follow-up (§14).

**Revised after user direction + code review (same day):** the receipt's data sections now mirror
the parsed-document schema — one section per uploaded document listing every expected field for its
type (`EXPECTED_DOC_FIELDS` in `ReceiptDocument.tsx`; benefit amount is a dynamic one-of across
weekly/biweekly/semimonthly/monthly/annual keys; `declared_income` optional). Values come only from
parsed fields — never invented; absent entries render red "Still missing", extracted-but-unconfirmed
ones red "Needs your check", and a document's quarantined text is flagged ("⚠ Quarantined text —
ignored") without ever rendering its content. Review fixes: lock now force-closes an in-flight
editor and gates start/save (was a HIGH: save still worked if the editor was open when lock fired);
income-tagged corrections are validated non-negative/parseable with an inline `role="alert"` error
(`invalidAmount` ×5 languages) — this also guards the pre-existing `annualizeCents` throw-on-negative
crash (no error boundary exists in the app) and the silent `toCents("garbage") → $0` coercion, on
this surface; focus returns to the row's Correct button after save/cancel; `humanize`/doc-label/
reason-text helpers extracted to `lib/pipeline/labels.ts` (were copy-pasted ×3); edit inputs capped
at `maxLength={120}`; redundant threshold double-lookup dropped.

**Simplified (user-directed, same day):** Prepare collapsed from three cards to ONE surface —
title + a plain-language intro ("Check your receipt below — correct anything marked in red…"), the
readiness chip with the lock/unlock button beside it (locked swaps the note to `lockedNote`),
reasons only when they exist, a single visible actions row (Save receipt as PDF = the one primary
button; Download packet / Edit details / View raw data secondary), then the receipt document, with
delete-with-confirm last behind a separator rule. New `prepareIntro` copy ×5; `controlsTitle`
removed (`noReasons` kept — HeaderStatus uses it); `.statusRow` added to `pipeline.module.css`.
Verified: tsc clean; one h2 on the step; print isolation intact after the restructure; 375px stacks
cleanly (remaining overflow is the pre-existing header nav).

**Split view (user-directed, same day):** Prepare is now a two-pane layout on desktop — controls
rail on the left (intro, status + lock, reasons, actions, delete), the big paper document preview
on the right at ~60% of the card (`.prepareGrid` 2fr/3fr in `pipeline.module.css`, collapses to one
column ≤960px; the rail is `position: sticky` under the sticky header so actions stay reachable
while the document scrolls). `.shell` widened 62rem → 72rem so the document truly reads as half the
screen (all steps get the wider canvas). Verified: doc pane ≈592px right-of-rail at 1440px, sticky
rail pinned at ~88px mid-scroll, mobile stacks controls→document, print still emits only the
receipt.

**Known quirk (pre-existing, unchanged):** the DeletionProof panel in PrepareStep is unreachable —
`deleteSession()` navigates back to Profile, unmounting PrepareStep before the proof renders. Also
pre-existing: ProfileStep's correction input still lacks the numeric guard (same crash path), and
there's no route-level `error.tsx` boundary — both worth a follow-up.

**Verified:** `tsc --noEmit` clean; Playwright click-through (upload → confirm all → Understand →
Prepare): receipt visible by default, edit on receipt recomputes income/readiness/header chips
(gross-pay conflict fires PAY_STUB_TOTAL_CONFLICT), lock hides edit buttons, print emulation renders
the receipt alone with watermark, 320px collapses rows to one column (remaining 320px horizontal
overflow comes from the pre-existing header nav, not the receipt), ES localization + delete flow OK.
