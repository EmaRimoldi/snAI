# snAI — RealDoor (Hack-Nation Challenge 03)

Renter-side application-readiness copilot. Challenge brief: [`challenge_03.pdf`](challenge_03.pdf).

## Frontend (branch `frontend`)

Minimal skeleton: a login page (Supabase Auth, email + password) and an intentionally
empty white page after sign-in. No app content yet.

- **Live app:** https://snai-one.vercel.app
- **Hosting:** Vercel (project `snai`, team `chefcurrys-projects`), serving the static
  files in [`frontend/`](frontend/). No build step, no framework — one HTML page with
  inline CSS/JS, `supabase-js` loaded from esm.sh.
- **Backend:** Supabase (project `snAI`, ref `zgfanoruqwftbqhhvtwg`, region eu-central-1)
  provides auth (and later the database). The URL and publishable key embedded in
  `index.html` are public by design (equivalent to the anon key); real secrets never go
  in this repo. Demo login credentials: ask Massimo.

> Why not hosted on Supabase itself: Supabase deliberately rewrites `text/html`
> responses to `text/plain` on the shared `*.supabase.co` domain (anti-phishing
> policy, both Edge Functions and Storage), so it cannot serve web pages there.

### Deploy

From the `frontend/` directory, with the Vercel CLI:

```bash
vercel deploy --prod --yes
```

Security headers (CSP etc.) are configured in [`frontend/vercel.json`](frontend/vercel.json).

### Ground rules for all frontend work

1. **Mobile friendly, always** — responsive layout, verified at 320/375/768 px,
   no horizontal overflow, touch targets ≥ 44px.
2. **WCAG 2.2 AA, always** (non-negotiable requirement of the challenge brief):
   - Fully keyboard-operable (native controls, skip link, logical focus order)
   - Visible focus indicator (3px outline on `:focus-visible`)
   - Labeled controls; errors linked via `aria-describedby` + `aria-invalid`
   - No color-only status: every error/status prefixed with text ("Error: …")
   - Structured headings (`h1` app name → `h2` per view), focus moved to the view
     heading on navigation
   - Clear completion announcements via the `role="status"` live region
     ("Signed in successfully.", "Signed out.")
   - AA color contrast (#111827 / #1d4ed8 / #b91c1c on white)
