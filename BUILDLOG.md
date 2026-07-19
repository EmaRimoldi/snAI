# BUILDLOG

## 2026-07-19 — Bounded AI assistant for Understand

**Shipped locally on branch `AI`:**
- A versioned policy and prompt contract for a narrow RealDoor assistant: it explains the frozen
  challenge rules, workflow, and confirmed deterministic results; it abstains on general-purpose,
  legal, cross-applicant, protected-trait, vacancy, and program-decision requests.
- Supabase `understand-chat` Edge Function with JWT authentication, input allowlisting, deterministic
  pre-gates, OpenAI Structured Outputs, citation resolution, post-generation decision-language lint,
  safe fallback answers, and metadata-only audit logging.
- Supabase migrations for `ai_request_events`: RLS enabled, browser roles denied, service-role-only
  access, and rate-limit indexes. The migrations are applied to the shared project.
- A localized floating AI launcher appears only after **Get started** and opens a right-side chat drawer
  across Profile, Understand, and Prepare. The landing stays aligned with the team’s latest design. The
  browser sends only confirmed structured fields and never names, addresses, raw OCR, filenames, URLs,
  or uploaded documents.
- A server-side arithmetic integrity gate independently recomputes source annualization, annualized total,
  the frozen household threshold, and the comparison before any model request.
- Policy/evaluation tests covering corpus hash parity, all 36 organizer QA cases, all 24 adversarial
  categories, multilingual off-domain prompts, allowlist sanitization, grounding, and decision lint.

**Deployment boundary:** the function code is ready but not deployed pending explicit authorization
for the disclosed OpenAI data transfer. Anonymous Auth is enabled and `OPENAI_API_KEY` is present in
the Supabase Edge Function secrets; only function deployment remains.

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

**Full i18n pass on Prepare (user-directed, same day):** audited every string on the step against
all five languages. Added the 17 missing keys to each of es/zh/tl/vi (`doc*` ×6, `rc_*` ×6,
`reasonsTitle`, `stExtracted`, `quarantineTitle`, `effective`, `cmpNone`, `lockedNote`, `unlockBtn`,
`deletedProof`, `noDocs`). New `FIELD_LABELS` map in `copy.ts` (25 parsed-field keys × 5 languages)
with `useFieldLabel()` in `labels.ts` (fallback language → en → humanize) — receipt rows no longer
show humanized-English keys in other languages. Reason `detail` doc names now use localized
`docLabels` instead of `humanize`. Dropped `text-transform: capitalize` on `.rowKey` (wrong for
es/vi casing; labels carry their own). Verified live in all four non-English languages (field
labels, red markers, doc sections, quarantine flag, rail) with a zero-residual-English sweep.
Still English-only elsewhere (pre-existing, outside Prepare): ProfileStep field-review headings and
`FIELD_EXPLAIN` explanations — `useFieldLabel` is ready for Profile as a follow-up.

**Brand + leaner rail (user-directed, same day):** the receipt's document header now carries the
RealDoor brand (logo.svg + name) top-right opposite the kicker/title (`.brand` in
`receipt.module.css`; prints with the page). Left rail slimmed: `prepareIntro` shortened in all five
languages ("Correct anything marked in red, then save your receipt as a PDF."), and the
`verdictNote` line dropped from the rail — the non-decisional note remains on the document's
readiness section, and `lockedNote` still appears when locked.

**Reason codes localized (user-flagged, same day):** the raw `UNCONFIRMED_FIELDS` /
`MISSING_REQUIRED_DOCUMENT`-style constants were showing untranslated in the reason lists. New
`rcTitle_*` short titles ×6 codes ×5 languages + `useReasonTitles()` in `labels.ts`; the rail shows
only the localized title, the receipt shows the localized title with the raw code demoted to a small
muted `.codeRef` (kept on the artifact — organizer evidence vocabulary; `submission.json` codes
unchanged). Verified in ES via a triggered PAY_STUB_TOTAL_CONFLICT.

**Prepare rail trimmed + spacing pass (user-directed, same day):** removed "Download packet" and
the "View raw data" toggle from Prepare (the JSON export UI is gone; `buildSubmission`/codes remain
intact in state for the organizer schema — copy keys left dormant in copy.ts in case it returns).
Rail spacing reworked: `.prepareControls` is now a flex column with a uniform 1.15rem gap (child
margins zeroed — rhythm from the gap, not ad-hoc margins); reasons grouped under `.railGroup`;
actions are full-width stacked buttons (`.railActions` — Save PDF primary, Edit secondary); delete
in a bordered `.deleteZone`; grid gap now fluid `clamp(1.5rem, 3vw, 2.75rem)`; inline styles
removed from PrepareStep. Also repaired a corrupted CSS comment opener before `.prepareGrid`
(was already re-fixed upstream). Verified at 1440/375, tsc clean.

**Known quirk (pre-existing, unchanged):** the DeletionProof panel in PrepareStep is unreachable —
`deleteSession()` navigates back to Profile, unmounting PrepareStep before the proof renders. Also
pre-existing: ProfileStep's correction input still lacks the numeric guard (same crash path), and
there's no route-level `error.tsx` boundary — both worth a follow-up.

**Verified:** `tsc --noEmit` clean; Playwright click-through (upload → confirm all → Understand →
Prepare): receipt visible by default, edit on receipt recomputes income/readiness/header chips
(gross-pay conflict fires PAY_STUB_TOTAL_CONFLICT), lock hides edit buttons, print emulation renders
the receipt alone with watermark, 320px collapses rows to one column (remaining 320px horizontal
overflow comes from the pre-existing header nav, not the receipt), ES localization + delete flow OK.

## 2026-07-19 — Understand step: structured math, support chat, full i18n; engine classifier fix

- Understand redesign (visually verified via headless-Chromium screenshots): calculation left /
  large support-chat right (tinted shell, presence header, bubbles, docked input, scroll-pinned
  thread, sample questions until first message); math as a labeled 3-column table (Source ·
  Calculation · Per year) with per-source rows + Total; green/red published-limit banner (text
  carries meaning; non-decisional note kept); de-boxed cards (hairline rows, single container each).
- Income derivation now groups pay stubs into ONE corroborated wage source (latest pay_date wins) —
  fixes double-counting with the real engine (HH-001 was showing $112,632).
- **Engine fix** (`realdoor/cli.py`): filename-hint order put bare "letter" before "benefit", so
  `*_benefit_letter.pdf` uploaded without a manifest classified as employment_letter and its income
  was dropped (HH-003 showed $30,030 instead of $40,230). Specific hints now match first; official
  set re-verified (159/159 fields, 6/6 households, classifier spot-check on HH-001/3/4).
- Dev fixture route generalized to serve ANY official household's complete set via
  NEXT_PUBLIC_DEMO_HOUSEHOLD; NEXT_PUBLIC_DEMO_STEP=understand debug mode auto-confirms and jumps.
- Verified HH-003 end-to-end in-browser: Pay $1,155×26 + Benefit $850×12 = $40,230 vs $92,580
  (size 3), header shows the READY-with-missing-letter oracle quirk as informational.

## 2026-07-19 — Oracle verification of the full main-branch pipeline (frontend + engine)

- New dev-only diagnostic `frontend/app/api/dev-oracle-check/route.ts`: runs the REAL frontend
  pipeline (engine adapter + calc.ts) over all six official households' PDFs server-side,
  simulating full renter confirmation; returns computed values only (expectations stay outside
  product code — the caller compares against the oracle).
- **Found & fixed a §8 violation:** the frontend annualized a pay stub's PRINTED gross, so HH-002
  computed $72,540 instead of $49,920. `deriveIncomeSources` now uses the internally consistent
  basis (regular_hours × hourly_rate, printed-gross fallback when absent) — engine-aligned.
- Result: all six households reproduce the oracle EXACTLY through the frontend path (income,
  readiness status, blocking codes, comparison). Engine path re-verified separately after the
  classifier fix (batch_run official: 159/159 fields, 6/6 households, 0 LLM calls).

## 2026-07-19 — AI chat: greetings, softer out-of-scope card, suggestion chips

Plain greetings (hi / hola / kumusta / xin chào / 你好…, anchored so "hi, what are the rules?"
still routes to the real question) now get a localized deterministic reply citing
GUIDE-FLOW-001 (`understand-chat` v6). `AiAnswer`: per-outcome pill styling; OUT_OF_DOMAIN
abstains show a soft dashed "Out of scope" pill (×5 languages) with two tappable
sample-question chips (reuses `sampleChip`, re-asks through the existing handlers) instead of
the raw policy code; other non-NONE codes demoted to small muted text. Policy tests 22/22;
greeting verified live in en/es; poem control still abstains. Verified at API + tsc level —
an in-panel visual pass on the unlocked Understand chat is still worth a click-through.

## 2026-07-19 — Dev-split verification: frontend now matches gold on ALL splits' calculations

- Engine: batch_run across official+dev1–dev6 = 1132/1132 fields, 59/59 households, LLM ≤2/set.
- Frontend (real pipeline via dev-oracle-check?set=…): **53/53 dev-split incomes and comparisons
  correct** after three fixes: (1) adapter counts any `<freq>_benefit` field (engine names the
  amount by frequency — annual_benefit was dropped); (2) employment-letter-only households derive
  the wage source from confirmed weekly_hours × hourly_rate (weekly) when no stub exists; (3)
  household size is now nullable — never defaulted to 1; absent/unreadable size ⇒ no frozen
  threshold ⇒ `no_frozen_threshold` (display shows "—"). Engine server also gained
  `refine_document_type`: inferred types are corrected from extracted fields (hintless dev3-style
  filenames had classified stubs/letters as application summaries on the upload path).
- Remaining, deliberate: 9/53 dev households differ ONLY by reason codes the frontend demo does not
  implement (BENEFIT_LETTER/PAY_STUB/GIG_STATEMENT_EXPIRED, EMPLOYMENT_RATE_CONFLICT,
  MISSING_HOUSEHOLD_SIZE, MISSING_INCOME_EVIDENCE, NO_FROZEN_THRESHOLD, UNVERIFIED_INCOME_CLAIM) —
  the engine implements all of them and stays the authority for submission scoring.

## 2026-07-19 — Frontend implements the full reason-code vocabulary; exact gold match on all splits

- `computeReadiness` now mirrors the engine's full rule surface: generic 60-day currency over every
  dated evidence doc (DATE_FIELD map incl. YYYY-MM statement months = last covered day) emitting
  `<TYPE>_EXPIRED` per doc type; `EMPLOYMENT_RATE_CONFLICT` (letter rate vs stub rates, hours never
  conflict); `UNVERIFIED_INCOME_CLAIM` (declared_income never counted); `MISSING_HOUSEHOLD_SIZE` /
  `NO_FROZEN_THRESHOLD` / `MISSING_INCOME_EVIDENCE` (the latter three gated on "nothing pending"
  so unconfirmed values are never mislabelled as missing).
- ReviewReasonCode union +8; rc_/rcTitle_ strings ×5 languages; labels hooks and header error-menu
  jump targets extended.
- Verification: official 6/6 exact; dev1–dev6 53/53 households exact on income, comparison,
  readiness status AND reason codes (zero remaining gaps). Engine remains authoritative for
  submissions; the frontend now tells the same story.

## 2026-07-19 — Review sweep: all six audit points closed; viewer on main; tests; arch note

1. AI-context regression FIXED: `lib/ai/context.ts` now sends the corroborated COUNTED sources
   (sum ≡ displayed total, integrity gate passes with 2+ stubs); negative amounts can no longer
   reach `annualizeCents` (skipped at derivation + rejected at the correction boundary with a
   localized error). HH-002 basis was already fixed on HEAD (243155b).
2. Deletion proof FIXED: proof lives in the provider, survives the wipe, and renders as a
   dismissible `role="status"` banner in PipelineApp (demo step 6 now visible).
3. Evidence viewer FIXED on main: real pdf.js viewer ported from the pdfviewer branch (canvas
   pages, confidence-colored source boxes, auto-crop/zoom/minimap/snap, worker-src CSP,
   `DocumentRecord.file`, `setDocumentPageCount`); verified via headless screenshot — real HH-001
   page renders with boxes in Profile.
4. Crash on negative correction FIXED: boundary validation + calc guards + `app/error.tsx`
   global boundary (message in all five languages, outside the i18n provider).
5. Abstention path ADDED: typing into an empty/abstained extraction marks it `renter_entered`
   (distinct localized status chip); confirmed values unchanged.
6. Frontend tests ADDED: vitest (`npm test`), 23 passing unit tests over the rewritten math —
   corroboration, hours×rate basis, letter-only wages, benefit frequencies, expiry incl. YYYY-MM,
   rate conflict, missing size/threshold/income gating, display ladder, inclusive boundary.
Plus: `ARCHITECTURE.md` (deliverable #5 — architecture & risk note). Oracle re-verified after all
changes: official 6/6 exact.

## 2026-07-19 — Discovery merged into main (PR #6) + full i18n/responsive remediation

- Merged `origin/discovery` (`--no-ff`, dcac8b0): sequential Upload/Reviewer flow with batch
  parsing (`processBatch`, per-file fault isolation in `engine/server.py`), source-grounded PDF
  review, localized 5-language document guides, and the Leaflet Discover explorer (32 real HUD
  LIHTC Boston records, attributed Wikimedia photos, OSM/ArcGIS tiles behind CSP).
- Conflict resolution vs the parallel viewer port (b81ee3e): kept discovery's Reviewer rewrite,
  ported main's negative-correction guard + `renter_entered` chip into it, deduped the viewer
  copy keys that both sides had added to all five language blocks, rebuilt
  `pipeline.module.css` from discovery's version + main-only `.correctError`/`.confidenceLow`.
- Remediation before push (d0dce15): DiscoverView + the 15 consistency warnings + slot
  descriptions + header nav/titles now fully localized (en/es/zh/tl/vi, ~90 new copy keys);
  shipped "PlaceHolder" replaced with a real record count; locale-aware number formatting;
  721–800px reviewGrid overflow and 375px header/canvas overflow fixed (`minmax(0,…)`,
  `min-width:0` chains); `@types/leaflet` → devDependencies.
- Verification: `next build` (strict tsc) clean; vitest 23/23; engine pytest 23/24 (1 failure =
  missing poppler binary in WSL, not code); Playwright smoke — landing/#app/#discover, PdfViewer
  canvases + bbox overlays, confidence meter, negative-guard rejection, reactive warnings,
  Understand math + citations, Prepare receipt with new reason codes, ES/ZH sweeps, 375/800px
  scroll-clean. PR #6 auto-marked MERGED on push.
