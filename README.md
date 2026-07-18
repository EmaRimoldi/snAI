# snAI — RealDoor (Hack-Nation Challenge 03)

Renter-side application-readiness copilot. Challenge brief: [`challenge_03.pdf`](challenge_03.pdf).

## Frontend (branch `frontend`)

Minimal skeleton: a login page (Supabase Auth, email + password) and an intentionally
empty white page after sign-in. No app content yet.

- **Live app:** https://zgfanoruqwftbqhhvtwg.supabase.co/functions/v1/app
- **Hosting:** the whole page is served by the Supabase Edge Function in
  [`supabase/functions/app/index.ts`](supabase/functions/app/index.ts). No build step,
  no framework — one HTML page with inline CSS/JS, `supabase-js` loaded from esm.sh.
- **Auth:** Supabase Auth (project `snAI`, ref `zgfanoruqwftbqhhvtwg`). The Supabase URL
  and anon key are injected by the function from its environment at request time, so no
  keys live in this repo. Demo credentials: ask Massimo (not committed here on purpose).

### Deploy

The function is deployed with `verify_jwt = false` (it serves a public login page and
nothing else). To redeploy after editing `index.ts`:

```bash
supabase functions deploy app --project-ref zgfanoruqwftbqhhvtwg --no-verify-jwt
```

(or via the Supabase dashboard / MCP tooling).

### Accessibility (WCAG 2.2 AA)

The skeleton already implements the non-negotiable "Accessible Journey" requirements
from the brief — keep them intact when adding content:

- Fully keyboard-operable (native controls only, skip link, logical focus order)
- Visible focus indicator (3px outline on `:focus-visible`)
- Labeled controls; errors linked via `aria-describedby` + `aria-invalid`
- No color-only status: every error/status is prefixed with text ("Error: …")
- Structured headings (`h1` app name → `h2` per view), focus moved to the view heading
  on navigation
- Clear completion announcements via a `role="status"` live region
  ("Signed in successfully.", "Signed out.")
- AA color contrast (#111827 / #1d4ed8 / #b91c1c on white)
