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
