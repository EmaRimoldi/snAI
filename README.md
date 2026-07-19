# RealDoor — Application-Readiness Copilot (Hack-Nation 2026, Challenge 03)

Renter-side copilot that turns household documents into a human-confirmed profile, explains one
affordable-housing program's rules with citations, flags missing or expired documents, and produces
a renter-controlled application-readiness packet. **It prepares and validates the application — it
never decides eligibility** (no approve / reject / score / rank / priority, ever).
Challenge brief: [`challenge_03.pdf`](challenge_03.pdf) · Live app:
**https://realdoor-boston.vercel.app**

```mermaid
---
config:
  theme: base
  themeVariables:
    fontFamily: ''
    fontSize: 15px
    background: '#FBF6EF'
    primaryColor: '#FFFFFF'
    primaryTextColor: '#3D2C24'
    primaryBorderColor: '#C4593F'
    lineColor: '#A8654F'
    clusterBkg: '#FBF6EF'
    clusterBorder: '#D9C7B8'
    edgeLabelBackground: '#FFF9F2'
  flowchart:
    curve: basis
    padding: 12
---
flowchart LR
 subgraph ENGINE["Deterministic engine"]
    direction TB
        B1["<b>Text layer</b><br><i>pdfplumber</i>"]
        B2["<b>OCR fallback</b><br><i>tesseract</i>"]
        B3["<b>Scored matcher</b><br>exact→synonym→fuzzy<br><i>+ anonimized LLM backup</i>"]
  end
 subgraph MATH["Deterministic reasoning — no model in the loop"]
    direction TB
        D["<b>Income math</b><br>integer cents · Decimal<br><i>frozen FY2026 MTSP CSV</i>"]
        Q["<b>Rules Q&amp;A + citations</b><br>frozen 11-rule corpus<br><i>abstains out of corpus</i>"]
  end
 subgraph CONTROL["Renter keeps control — browser memory only"]
    direction TB
        E["<b>File readiness</b><br>READY_TO_REVIEW /<br>NEEDS_REVIEW + coded reasons"]
        F["<b>Packet</b><br>download only — never sent<br>+ delete with proof"]
  end
    B1 --> B2
    B2 --> B3
    D --- Q
    E --> F
    B3 == extracted fields<br>+ evidence ==> C["<b>Renter confirms every value</b><br>evidence: page · bbox · confidence<br>"]
    C == confirmed<br>values only ==> D
    Q ==> G{{"<b>SAFETY GATE</b><br>injection quarantine · never-strings lint<br>guarded LLM I/O — masked, allowlisted, linted<br>never decides eligibility"}}
    G ==> E
    G -.- V(["✓ <b>Verified</b> — 6/6 gold households · 53/53 dev splits<br><i>pytest + vitest + eval harness</i>"])
    B3 -. anonymized labels only .-> G
    C -. AI help .- S["<b>Supabase</b><br>i18n ×5 languages<br>AI-chat Edge Function proxy"]
    S -. pre-gates + decision lint .-> G
    G -.-> O["<b>OpenAI</b><br>sees masked labels /<br>confirmed numbers only —<br>never names, raw text, or files"]
    A["<b>Upload</b><br>PDFs stay in the browser<br>"] --> ENGINE

     B1:::engine
     B2:::engine
     B3:::engine
     D:::engine
     Q:::engine
     E:::browser
     F:::browser
     C:::browser
     G:::safety
     V:::proof
     O:::service
     S:::service
     A:::browser
    classDef browser fill:#FDF3EA,stroke:#C4593F,stroke-width:2px,color:#3D2C24
    classDef engine fill:#EFF4F0,stroke:#2F6B4F,stroke-width:2px,color:#22352C
    classDef safety fill:#B3261E,stroke:#7A130D,stroke-width:3px,color:#FFF7EF,font-weight:bold
    classDef proof fill:#FBF6EF,stroke:#2F6B4F,stroke-width:1px,stroke-dasharray:4 3,color:#22352C
    classDef service fill:#EAF3F8,stroke:#2E6E8E,stroke-width:1.5px,stroke-dasharray:5 3,color:#1F3947
    style ENGINE fill:#F4F8F4,stroke:#2F6B4F,stroke-width:2px
    style MATH fill:#F4F8F4,stroke:#2F6B4F,stroke-width:2px
    style CONTROL fill:#FFFBF5,stroke:#C4593F,stroke-width:2px
```

*The red line everywhere in this diagram: no component ever labels a person eligible, approved,
denied, or ranked — the assistant refuses decision requests, and readiness always describes the
**file**, never the person.*

## How it works

**One applicant = one application record**, built entirely from uploaded documents. Three header
values recompute after **every** change: **Status** (phase ladder), **Gross Income** (deterministic,
integer cents), **Errors** (rule flags on confirmed values). All are readiness / accuracy /
completeness signals only — never a verdict. The flow is a strict three-phase pipeline (each step
unlocks the next):

1. **Profile** — drag in synthetic PDFs; each is classified against a live checklist (*uploaded* vs
   *still missing* — missing never hard-blocks). The engine extracts **only allowlisted fields**;
   the renter reviews them one at a time — each with the **source page and bounding box highlighted
   in the built-in PDF viewer**, a confidence score, and a plain-language explanation — then
   confirms, corrects, or types the value. **Only confirmed values are used downstream.** Injected
   document text is quarantined, never a field.
2. **Understand** — the income table shows every source annualized by its stated frequency
   (weekly ×52 … annual ×1) against the **frozen FY 2026 60% MTSP threshold** for the household
   size, with formula, effective date, and sources. A **bounded AI assistant** answers rules
   questions with `rule_id` citations and authority badges — greetings get a friendly reply,
   out-of-scope questions get a soft abstain with tappable suggestions, decision requests get a
   refusal.
3. **Prepare** — file readiness (`READY_TO_REVIEW` / `NEEDS_REVIEW`, about the **file**) with coded,
   evidence-linked reasons; a paper-style **SAMPLE readiness receipt** with in-place corrections and
   print-to-PDF; packet download (never transmitted); and delete-session with a deletion proof.

Cross-cutting: everything is reactive; the UI is **fully localized in five languages** (EN, ES, ZH,
TL, VI — the most spoken in the US), switchable at any time; the six official challenge households
reproduce the organizer oracle **exactly** through both the frontend and engine paths.

> The domain & safety law (red line, income math, readiness codes) lives in [`CLAUDE.md`](CLAUDE.md);
> the visual system in [`FRONTEND-DESIGN.md`](FRONTEND-DESIGN.md); the AI layer's contract,
> disclosure, and limits in [`AI_SPEC.md`](AI_SPEC.md); day-by-day decisions in
> [`BUILDLOG.md`](BUILDLOG.md).

## The AI assistant

A narrow, grounded chat panel in the Understand step, served by the Supabase Edge Function
[`supabase/functions/understand-chat`](supabase/functions/understand-chat):

- **Deterministic pre-gates** catch prompt injection, cross-applicant requests, protected-trait
  inference, legal advice, vacancy questions, wrong-year thresholds, decision requests, greetings,
  and "what are the rules?" — all without a model call.
- In-scope questions go to **OpenAI `gpt-4o`** (Responses API, Structured Outputs, `store: false`)
  with the frozen 11-rule corpus, an app guide, and an **allowlisted numeric context** — never
  files, raw OCR, names, addresses, or filenames. A server-side integrity gate independently
  recomputes all arithmetic before any model call.
- Answers must cite; uncited answers are downgraded, verdict language is lint-rejected, and every
  request is audited **metadata-only** in `ai_request_events` (RLS-denied to browsers) with per-user
  rate limits (5/min, 30/day). If the function or provider is down, a local frozen-rule fallback
  answers in the browser.

## Repository layout

```
frontend/   Next.js 16 app (App Router, strict TS) — pipeline UI, PDF viewer, AI chat,
            receipt, i18n; api/ carries the Python engine when deployed
engine/     Python extraction + rules engine (classify, extract, score) + fixtures/tests;
            deployed as a Vercel Python function at /api/engine/*
supabase/   understand-chat edge function + _shared policy/contract modules, tests
            (node --test), migrations (i18n, ai_request_events)
CLAUDE.md   project law · FRONTEND-DESIGN.md  design system · AI_SPEC.md  AI disclosure
```

## Hosting & services

- **Vercel** project `realdoor-boston` (team `chefcurrys-projects`) serves the frontend and the
  Python engine function. **Pushes do not auto-deploy** — deploy manually (below).
- **Supabase** project `snAI` (`zgfanoruqwftbqhhvtwg`, eu-central-1): anonymous auth, i18n tables,
  the `understand-chat` function, and the AI audit table. The URL + publishable key in
  `frontend/lib/supabase.ts` are public by design (anon-equivalent); real secrets
  (`OPENAI_API_KEY`, `OPENAI_MODEL`) live **only** in Supabase Edge Function secrets.

> Why the app isn't hosted on Supabase: the shared `*.supabase.co` domain rewrites `text/html` to
> `text/plain` (anti-phishing), so it can't serve web pages.

## Develop, test, deploy

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000  (NEXT_PUBLIC_ENGINE=mock for engine-less preview)
npm run build          # must pass before pushing

# AI policy + eval suites (from the repo root; Node ≥ 22 runs TS natively)
node --test supabase/functions/tests/ai_policy.test.ts supabase/functions/tests/ai_eval.test.ts

./frontend/deploy.sh   # manual production deploy to Vercel (no alias step — domains are attached)
```

The engine's own tests and the six-household oracle fixtures live under `engine/tests/`.

## Ground rules for all frontend work

1. **Mobile friendly, always** — verified at 320 / 375 / 768 px, no horizontal overflow, touch
   targets ≥ 44px.
2. **WCAG 2.2 AA, always** — keyboard-complete, visible focus, labeled controls, no color-only
   signaling, live-region announcements, AA contrast on the warm palette.
3. **i18n is law** — every user-facing string ships in all five languages
   (`frontend/lib/dictionaries.ts` / `lib/pipeline/copy.ts`, mirrored in Supabase
   `i18n_translations`); never hardcode copy in components.
4. **Never-strings** — no decision / approval / eligibility language anywhere: UI, logs, exports,
   or model output. Refusals only, phrased in the negative.

## Local tooling (MCP)

[`.mcp.json`](.mcp.json) (machine-local, gitignored) wires **Playwright** (browser E2E / responsive
checks) and **Remotion** (programmatic demo video). Both run on demand via `npx …@latest`.

## Tech stack

#### Frontend
<p align="left">
  <img src="https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" />
  <img src="https://img.shields.io/badge/pdf.js-B30B00?style=for-the-badge" />
</p>

#### Engine & AI
<p align="left">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/Tesseract%20OCR-5A5A5A?style=for-the-badge" />
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" />
</p>

#### Platform & Data
<p align="left">
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Deno-000000?style=for-the-badge&logo=deno&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenStreetMap-7EBC6F?style=for-the-badge&logo=openstreetmap&logoColor=white" />
</p>

#### Testing & Tooling
<p align="left">
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" />
  <img src="https://img.shields.io/badge/pytest-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white" />
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Mermaid-FF3670?style=for-the-badge&logo=mermaid&logoColor=white" />
</p>
