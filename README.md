# RealDoor — Application-Readiness Copilot (Hack-Nation 2026 Challenge 03)

Renter-side copilot that turns synthetic household documents into a human-confirmed
profile, explains one affordable-housing program's rules with citations; identifie
missing or expired documents, and creates a renter-controlled application-readiness
packet — without deciding eligibility. Challenge brief: [`challenge_03.pdf`](challenge_03.pdf).

## Frontend

**Next.js (App Router, TypeScript)** in [`frontend/`](frontend/) — a pixel-identical
port of the original single-file landing page (hero, document prompt, phase cards,
EN/ES language switch, login).

- **Live app:** https://realdoor-boston.vercel.app
- **Hosting:** Vercel (project `realdoor-boston`, team `chefcurrys-projects`).
- **Backend:** Supabase (project `snAI`, ref `zgfanoruqwftbqhhvtwg`, region eu-central-1)
  provides auth (and later the database). The URL and publishable key in
  `lib/supabase.ts` are public by design (equivalent to the anon key) and can be
  overridden with `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
  Real secrets (LLM keys etc.) go in **API routes + Vercel env vars only**, never in
  client code. Demo login credentials: ask Massimo.

> Why not hosted on Supabase itself: Supabase deliberately rewrites `text/html`
> responses to `text/plain` on the shared `*.supabase.co` domain (anti-phishing
> policy, both Edge Functions and Storage), so it cannot serve web pages there.

### Structure

```
frontend/
  app/            layout, page (view switching landing/login), globals.css
  components/     SiteHeader, PromptShell, PhaseCards, LoginView
  lib/            supabase.ts (client), i18n.tsx (EN/ES dictionaries + hook)
  public/         logo.svg, fonts/
  next.config.ts  security headers (CSP etc.)
```

### Develop & deploy

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
npm run build      # must pass before pushing

vercel deploy --prod --yes   # manual deploy (Vercel auto-detects Next.js)
```

### Ground rules for all frontend work

1. **Mobile friendly, always** — responsive layout, verified at 320/375/768 px,
   no horizontal overflow, touch targets ≥ 44px.
2. **WCAG 2.2 AA, always** (non-negotiable requirement of the challenge brief):
   - Fully keyboard-operable (native controls, skip link, logical focus order)
   - Visible focus indicator (3px outline on `:focus-visible`)
   - Labeled controls; errors linked via `aria-describedby` + `aria-invalid`
   - No color-only status: every error prefixed with text ("Error: …")
   - Structured headings, focus moved to the view heading on navigation
   - Clear completion announcements via the visually-hidden `role="status"` live
     region ("Signed in successfully.", "Signed out.") — screen-reader only by design
   - AA color contrast on the warm palette (see `globals.css` custom properties)
3. **i18n** — every user-facing string lives in `lib/i18n.tsx` (EN + ES). Never
   hardcode copy in components.
