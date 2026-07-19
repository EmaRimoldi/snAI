# RealDoor — Application-Readiness Copilot (Hack-Nation 2026 Challenge 03)

Renter-side copilot that turns household documents into a human-confirmed profile, explains
one affordable-housing program's rules with citations, flags missing or expired documents, and
produces a renter-controlled application-readiness packet. **It prepares and validates the
application — it never decides eligibility** (no approve / reject / score / rank / priority, ever).
Challenge brief: [`challenge_03.pdf`](challenge_03.pdf).

## How it works

A minimal entry point explains RealDoor in **three short steps**, then starts the flow.
**One applicant = one application record**, built entirely from uploaded documents. Three global
values are recomputed after **every** change and stay visible throughout:

| Value | What it is |
|---|---|
| **Status** | Current phase and completeness of the application |
| **Gross Income** | Auto-aggregated from income fields extracted across the documents |
| **Errors** | Missing required documents + unresolved / low-confidence fields |

These are **readiness, accuracy and completeness signals only — never an eligibility verdict.**
The flow is a strict three-phase pipeline, with progress tracked per phase:

1. **Upload** — documents (ID, pay stubs, benefit letters, …) are auto-classified against a
   required-documents checklist that live-updates into *uploaded* vs *still missing (even if
   required)*. Missing items never hard-block progress; they persist as errors until resolved.
2. **Review** — the AI extracts structured fields; the renter validates them **one at a time**
   (prev / next). Each field shows the **source document with the exact region highlighted**, a
   **confidence score**, and a **plain-language explanation** of what it is and why it's needed —
   then **confirm**, **correct** (a typed value overrides the extraction), or **ask the assistant**.
   Every confirm/correct recomputes Gross Income and Errors.
3. **Confirm** — a single summary of everything collected; the renter confirms (locked as *ready to
   review* — about the **file**, not eligibility) or goes back to fix things.

Cross-cutting: an **AI assistant** (Help) opens from anywhere and knows the current application
state, documents, fields, and errors; everything is **reactive** (any change propagates to Status,
Gross Income, Errors, and the checklist); the UI is **fully localized in five languages**
(EN, ES, ZH, TL, VI — the most spoken in the US), switchable at any time.

> The domain & safety law (no-eligibility red line, income math, readiness codes, the renter
> journey) lives in [`CLAUDE.md`](CLAUDE.md); the visual & interaction system lives in
> [`FRONTEND-DESIGN.md`](FRONTEND-DESIGN.md).
>
> **Build status:** the entry landing + login + five-language i18n are built. The upload / review /
> confirm surfaces and the extraction + rules engine described above are the product spec and are
> **not built yet**.

## Frontend

**Next.js (App Router, TypeScript)** in [`frontend/`](frontend/) — the landing (hero, document
prompt, phase cards), a five-language switch (EN/ES/ZH/TL/VI), and Supabase login. It began as a
pixel-identical port of the original single-file page and grows from there.

- **Live app:** https://realdoor-boston.vercel.app
- **Hosting:** Vercel (project `realdoor-boston`, team `chefcurrys-projects`).
- **Backend:** Supabase (project `snAI`, ref `zgfanoruqwftbqhhvtwg`, region eu-central-1)
  provides **auth and the i18n tables today** (more database later). The URL and publishable key in
  `lib/supabase.ts` are public by design (equivalent to the anon key) and can be overridden with
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Real secrets (LLM keys etc.)
  go in **API routes + Vercel env vars only**, never in client code. Demo login credentials: ask
  Massimo.

> Why not hosted on Supabase itself: Supabase deliberately rewrites `text/html`
> responses to `text/plain` on the shared `*.supabase.co` domain (anti-phishing
> policy, both Edge Functions and Storage), so it cannot serve web pages there.

### Structure

```
frontend/
  app/            layout, page (view switching landing/login), globals.css
  components/     SiteHeader, PromptShell, PhaseCards, LoginView
  lib/            supabase.ts (client), dictionaries.ts (5-language strings),
                  i18n.tsx (provider + Supabase overlay + hook)
  public/         logo.svg, fonts/
  next.config.ts  security headers (CSP etc.)
```

### Develop & deploy

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
npm run build      # must pass before pushing

./deploy.sh        # manual production deploy (Vercel project: realdoor-boston)
```

> Note: the `realdoor-boston.vercel.app` domain is still attached to the old
> `snai` Vercel project, so `deploy.sh` adds an explicit `vercel alias set`
> after deploying. Moving the domain to the `realdoor-boston` project in the
> Vercel dashboard (Settings → Domains) makes plain `vercel deploy --prod`
> sufficient.

## Local tooling (MCP)

Two MCP servers are wired up for local agent workflows in [`.mcp.json`](.mcp.json) at the repo root
— **gitignored on purpose** (machine-local, not committed):

- **Playwright** (`@playwright/mcp`) — drive a real browser for E2E checks and responsive / visual
  verification across breakpoints (320 → 1920 px).
- **Remotion** (`@remotion/mcp`) — programmatic React video, e.g. a demo recording.

Both run on demand via `npx …@latest`, so there's no install step. The repo-root
[`.gitignore`](.gitignore) also covers OS/editor junk, root env files, and local Claude/MCP config;
the Next.js app keeps its own `frontend/.gitignore` for build and dependency artifacts.

### Ground rules for all frontend work

1. **Mobile friendly, always** — responsive layout, verified at 320 / 375 / 768 px (and comfortable
   up to large desktops), no horizontal overflow, the landing fits the viewport without scrolling on
   a normal laptop, touch targets ≥ 44px.
2. **WCAG 2.2 AA, always** (non-negotiable requirement of the challenge brief):
   - Fully keyboard-operable (native controls, skip link, logical focus order)
   - Visible focus indicator (3px outline on `:focus-visible`)
   - Labeled controls; errors linked via `aria-describedby` + `aria-invalid`
   - No color-only status: every error prefixed with text ("Error: …")
   - Structured headings, focus moved to the view heading on navigation
   - Clear completion announcements via the visually-hidden `role="status"` live
     region ("Signed in successfully.", "Signed out.") — screen-reader only by design
   - AA color contrast on the warm palette (see `globals.css` custom properties)
3. **i18n** — every user-facing string lives in `lib/dictionaries.ts` with entries in
   all five supported languages (EN, ES, ZH, TL, VI) and is mirrored in the Supabase
   `i18n_translations` table (runtime override, bundled fallback). Never hardcode copy in components.
```
