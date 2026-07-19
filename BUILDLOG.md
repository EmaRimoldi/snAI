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

## 2026-07-19 — Real PDF viewer with bounding-box overlays (branch pdfviewer)

**Shipped:**
- `pdfjs-dist` (exact 6.1.200) renders the actual uploaded PDFs in the review pane
  (`components/pipeline/PdfViewer.tsx`): every page as a canvas inside a FIXED-size scrollable box,
  ALL extracted-field boxes overlaid as clickable buttons (click = jump to that field, same
  focus-managed path as the error menu). Active box highlighted; confirmed boxes tinted green.
- Zoom: +/− / fit-width buttons (44px, localized), Ctrl+wheel / trackpad pinch (non-passive
  listener), +/− keys on the focused region; zoom grows the PDF inside the box, never the box.
- **Auto-crop:** navigating to a value zooms so its box is comfortably framed (~55% width, capped)
  and centers the viewport on it; smooth unless prefers-reduced-motion. Manual zoom respected until
  the next navigation.
- Bytes stay in the browser: `DocumentRecord.file` (File) → `getDocument({data})` — never fetched or
  uploaded; Supabase Storage deliberately NOT used (user decision; deletion-proof stays trivial,
  offline-venue safe). Worker is a same-origin Turbopack asset (`lib/pdf/pdfjs.ts`); CSP gained only
  `worker-src 'self'`.
- Batch parse: one `POST /extract` for a whole upload (`processBatch` seam in `lib/engine/extract.ts`
  + `httpProcessBatch` in `lib/engine/http.ts`, response mapped by index with file_name sanity
  check); killed the fragile per-file classify/extract filename cache. Mock engine unchanged
  (per-file, deterministic). `pageCount` now set from pdf.js via `setDocumentPageCount`.
- Non-PDF/image uploads and pdf.js failures fall back to the old schematic + open-original link.
- New copy (viewer label, zoom, page x of y, preview error) in all five languages.

**Verified:** `npm run build` clean; engine `POST /extract` with all 4 HH-001 PDFs → 4 docs in
order, 0 LLM calls; `npm run dev:household` (engine mode, port 3000) serving with worker asset
emitted. Browser click-through (boxes, auto-crop, zoom) pending user check.

**Viewer refinements (same session):** anchored zoom (buttons/keys = viewport center, Ctrl+wheel =
cursor) with scrollbar-gutter fix for the fit-width oscillation; auto-center only on navigation
(manual zoom/pan never snapped back); viewer box size fully locked (grid min-width clamp);
boxes colored by the shared green→red confidence ramp (`lib/pipeline/confidence.ts`, CSS var
`--conf`), slightly dilated (0.6% page pad) so characters stay readable; auto-crop now fills ~80%
of the viewer width; confidence meter uses the same ramp.

**Viewer additions:** coordinate-space fix (`position: relative` on the scroll box — centering and
zoom-anchor math were measuring offsets against a distant ancestor); side minimap (96px, constant
fit-to-width thumbnail of the active page with a live viewport rectangle, click-to-pan, hidden
<720px, aria-hidden decorative); "Snap to value" toolbar button re-running the auto-crop on the
active field (localized ×5).

## 2026-07-19 — Pipeline copy complete in all five languages; viewer drag-to-pan

- `lib/pipeline/copy.ts`: es/zh/tl/vi are now FULL `Copy` objects (was `Partial` with EN fallback) —
  switching language changes every pipeline string (~120 keys/language), enforced at compile time
  like `dictionaries.ts`. Field explanations ("Why this is needed") localized too via
  `useFieldExplain()` (16 fields × 5 languages); the EN-only `FIELD_EXPLAIN` export is gone.
  Supabase `i18n_translations` mirroring of pipeline copy remains a follow-up (table writes are
  dashboard-only; bundled copy is the offline source of truth).
- PdfViewer: mouse drag-to-pan on the page background (pointer capture; boxes stay clickable;
  touch keeps native scrolling; grab/grabbing cursor).
