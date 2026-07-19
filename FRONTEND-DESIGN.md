# RealDoor — Frontend Design System

**This file is the single source of truth for RealDoor's visual and interaction design.**
It documents the design language shipped in `frontend/` (Next.js) in more depth than `README.md` —
the README covers structure, dev, and deploy; this file owns the tokens, components, and rules.

Design lives in exactly one stylesheet: [`frontend/app/globals.css`](frontend/app/globals.css).
Copy lives in [`frontend/lib/i18n.tsx`](frontend/lib/i18n.tsx). Keep it that way.

---

## 1. What RealDoor is (and why the design looks like this)

RealDoor is a **renter-side application-readiness copilot** for affordable-housing (LIHTC) paperwork.
Its users are people under real stress — sorting pay stubs, benefit letters, and gig statements to
prepare a housing application. The product **never decides eligibility**; it extracts, explains,
flags what's missing, and hands a clean packet back to the renter.

Everything about the design follows from that: it must feel **calm, honest, and in the renter's
control**. The shipped voice sets the tone —

> "Housing paperwork, made clear."
> "Nothing is decided without you."
> "One step at a time."

The look is warm and human (terracotta on cream), not clinical government-blue; flat and quiet, not
flashy; and rigorously accessible, because the people who most need this product are also the most
likely to rely on assistive tech, older devices, and keyboard navigation.

---

## 2. Design principles

1. **Calm & low-anxiety.** Generous whitespace, one idea per section, no urgency or pressure. Muted
   warm neutrals; a single accent color used sparingly.
2. **Clarity over cleverness.** Plain language, obvious controls, native HTML elements. If a plainer
   solution works, use it.
3. **Evidence is visible.** The product's credibility rests on citations. Design must always leave
   room to show *where a value came from* (source doc/page, or rule id) next to the value itself.
4. **Accessible by default (WCAG 2.2 AA).** Non-negotiable and heavily weighted in judging. Every
   component is keyboard-complete, labeled, and announced. See §9.
5. **Mobile-first & fluid.** Fluid units before breakpoints. Works from 320px up, no horizontal
   scroll, comfortable touch targets.
6. **Flat & warm — no dark patterns.** No shadows, no fake depth, no manipulative UI. Never use
   decision/approval language in the interface (that's an instant disqualification — see `CLAUDE.md`).

---

## 3. Brand & logo

The RealDoor mark is a **door within a frame**: three stacked rounded rectangles.

`public/logo.svg` (verbatim — do not restyle without updating this file):

```svg
<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" rx="22" fill="#F0E4D2"/>
  <rect x="18" y="14" width="64" height="72" rx="13" fill="#D9BFA0"/>
  <rect x="18" y="14" width="40" height="72" rx="13" fill="#C2634A"/>
</svg>
```

| Element | Value | Role |
|---|---|---|
| Tile / background | `#F0E4D2` (cream) | Rounded container, `rx=22` |
| Door frame / jamb | `#D9BFA0` (tan) | Right two-thirds, `rx=13` |
| Door leaf | `#C2634A` (terracotta) | Left, shares top/left/bottom edge → reads as an open door |

- **Logo palette is its own set of hex values** (`#F0E4D2 / #D9BFA0 / #C2634A`) and is intentionally
  *not* wired to the CSS tokens. The door leaf `#C2634A` is close to but distinct from `--primary`
  `#b5654a`. Keep them independent.
- **Wordmark:** the text "RealDoor" is rendered separately in `--primary`, weight 700, letter-spacing
  `-0.025em`. The `<img>` logo renders at `2rem × 2rem` (`.brand-logo`) with empty `alt` (decorative;
  the wordmark carries the accessible name).

> ⚠️ **Favicon gap.** The favicon is currently set to the full `/logo.svg` (via `app/layout.tsx`
> `metadata.icons`), which **includes** the cream `#F0E4D2` background tile. A "door-only, no
> background" favicon **does not exist in the repo** and would be a new asset. If you want the
> background-less favicon, create it as a separate SVG and point `metadata.icons` at it — do not strip
> the background from `logo.svg` itself (the tile is part of the brand mark).

---

## 4. Color system

**Light mode only** (`color-scheme: light`; there is no dark theme and none is planned — this is
deliberate). All tokens are defined once in `:root` in `globals.css`. Do not introduce new global
colors elsewhere; derive from these with `color-mix()`.

```css
:root {
  color-scheme: light;
  --background: #faf6ef;        /* cream page background */
  --foreground: #2a211c;        /* warm near-black text */
  --primary: #b5654a;           /* terracotta — brand accent */
  --primary-dark: #914b37;      /* deeper terracotta — focus ring, primary button */
  --primary-foreground: #ffffff;/* text/icons on terracotta */
  --secondary: #e8dfcf;         /* light tan — hover fills, card tint base */
  --muted: #f2eadc;             /* declared but UNUSED */
  --muted-foreground: #6f6259;  /* warm gray-brown — secondary text */
  --input: #d5c6b4;             /* tan — 1px borders on inputs/cards/panels */
  --danger: #a92d2d;            /* error red */
}
```

| Role | Token / value |
|---|---|
| Focus ring | `--primary-dark` `#914b37`, 3px solid, 3px offset |
| Primary button hover | literal `#7d3e2e` (the only in-rule color outside the token set) |
| Disabled (send button) | bg `--secondary`, text `--muted-foreground`, `cursor: not-allowed` |
| Error text | `--danger` `#a92d2d`; invalid inputs get a **2px** `--danger` border |
| Derived fills | `color-mix(in srgb, var(--secondary) 55%, transparent)` etc. — see card/panel rules |

**Rules of use**
- **Terracotta (`--primary` / `--primary-dark`) is the only accent.** Use it for the wordmark, the
  send button, phase-number badges, the file-count badge, and active/focus borders — sparingly.
- **No success color.** Success is communicated as text in a live region ("Signed in successfully."),
  never by color alone.
- **No color-only signaling anywhere** (WCAG). Errors always carry an "Error: …" text prefix in
  addition to the red styling.
- The original vanilla build's blue palette (`#111827 / #1d4ed8 / #b91c1c` on white) is **obsolete** —
  the current system is warm terracotta-on-cream, full stop.

---

## 5. Typography

- **Family:** `"Public Sans"`, a self-hosted variable font, with fallback `system-ui, sans-serif`.
  Base: `font: 16px/1.5 "Public Sans", system-ui, sans-serif;`. `button, input, select` inherit the
  font.
- **Loading:** self-hosted `@font-face` (no CDN — CSP allows `font-src 'self'` only):

  ```css
  @font-face {
    font-family: "Public Sans";
    src: url("/fonts/PublicSans-Variable.ttf") format("truetype");
    font-weight: 100 900;
    font-display: swap;
  }
  ```
  One variable TTF covers weights 100–900 (`public/fonts/PublicSans-Variable.ttf`, OFL 1.1). The
  `system-ui` fallback must look acceptable if the font fails (offline venue).

**Type scale** (all literal in `globals.css`):

| Use | Size | Notes |
|---|---|---|
| Hero H1 | `clamp(2.55rem, 6.2vw, 4.65rem)` | weight 700, `letter-spacing -0.045em`, `line-height 1.06`, `text-wrap: balance` |
| Hero subheadline | `clamp(1.05rem, 2vw, 1.25rem)` | `--muted-foreground`, `-0.01em` |
| Login H1 | `1.75rem` | `-0.035em` |
| Phase H2 / phase number | `1.25rem` | `-0.025em`; body `0.95rem / 1.6` |
| Brand wordmark | `1.05rem` | weight 700, `-0.025em` |
| Body / prompt input | `1rem` (16px base) | line-height `1.5` |
| Nav / captions | `0.875rem` – `0.9rem` | `--muted-foreground` |
| File badge | `0.625rem` | weight 800 |

- **Weights used:** 650, 700, 800.
- **Tracking:** tight negative letter-spacing on all display/heading text is a signature — keep it.

---

## 6. Spacing, shape & elevation

- **Spacing:** rem-based rhythm (`0.35 / 0.45 / 0.5 / 0.65 / 0.7 / 0.75 / 0.85 / 1 / 1.25 / 1.5 /
  1.75 / 2 / 2.25 / 2.5 / 2.75rem`). Section gaps are fluid: e.g. phase section top
  `clamp(3rem, 5vw, 4rem)`, phase grid gap `clamp(1.25rem, 3vw, 2.25rem)`, login top
  `clamp(2rem, 7vw, 5rem)`.
- **Radius scale:** `0.4rem` (small links), `0.75rem` / `0.8rem` (inputs, brand link), `1rem`
  (prompt shell, account panel), `1.25rem` (cards, login), `50%` (icon buttons, badges), `999px`
  (pills: language menu, primary/secondary buttons, skip link, file badge).
- **Elevation: none.** There are **no `box-shadow`s** in the system. Depth is expressed with **1px
  `--input` borders** and **tinted `color-mix` fills** over the cream background. Do not add shadows.
- **Max-width ladder:** nested `min(100%, Nrem)` containers step down to keep line lengths and grids
  comfortable — header `80rem` → main `72rem` → phase section `64rem` → hero `58rem` → prompt `46rem`
  → login card `28rem`.

---

## 7. Layout & screens

Two mutually-exclusive views, toggled by React state in `app/page.tsx` (`"landing"` | `"login"`);
the inactive one is `hidden`. A skip link precedes everything; a shared `SiteHeader` sits on top; a
centered `<main class="site-main">` (`min(100%, 72rem)`, `padding: 0 2.5rem 2rem`) holds both views
plus a visually-hidden `role="status"` live region.

**Header** (`.site-header`, both views): flex row, space-between, `min-height: 6rem`,
`width: min(100%, 80rem)`, `padding: 1rem 2.5rem`, `z-index: 20`.
- Left: brand link = 2rem logo + "RealDoor" wordmark (`gap 0.65rem`, `--primary`).
- Right (`.nav-actions`, gap `1.25rem`): custom language menu (EN / ES / 中文 / TL / VI, pill,
  custom chevron) showing the selected language's SVG flag in the trigger and every language's flag
  inside the website-styled dropdown (`LanguageFlag.tsx`).

**(a) Landing / signed-in view** — single centered column:
1. **Hero** (`.hero-section`, `min(100%, 58rem)`, centered): H1 + subheadline.
2. **Prompt shell** (`.prompt-section`, `min(100%, 46rem)`): rounded input bar with an upload
   (paperclip) icon button, a text input with an animated typewriter placeholder, and a circular
   terracotta send button. Drag-and-drop supported; shows a file-count badge. *(Currently UI-only.)*
3. **Phase cards** (`.phase-section`, `min(100%, 64rem)`): 3-column grid of tinted cards
   (`Profile` / `Understand` / `Prepare`), each with a circular numbered badge, H2, and description.

The signed-in state differs from signed-out only in the header (account icon vs "Log in"). The app
surface beyond the landing scaffold is not built yet.

**(b) Login view** (`.login-view`, `min(100%, 28rem)`, `border-radius: 1.25rem`, tinted
`color-mix(secondary 38%, background)`): a "← Back to RealDoor" link, H1 "Log in"
(focusable `tabIndex={-1}`), a tagline, then the form (`display: grid; gap: 1rem`) — a `role="alert"`
error paragraph, Email, Password, and a full-width primary "Log in" button.

---

## 8. Component patterns

All measurements are the shipped values; match them when extending.

- **Buttons** (`min-height: 44px`, `border-radius: 999px`, weight 700):
  - `.primary-button` — `--primary-dark` bg + border, white text; hover `#7d3e2e`.
  - `.secondary-button` — transparent bg, 1px `--primary` border, `--primary-dark` text; hover
    `--secondary`.
  - `.icon-button` — 44×44 circle, 1px `--input` border; hover `--secondary`.
  - `.send-button` / `.prompt-icon-button` — 44×44 circle; send is filled `--primary` (hover
    `--primary-dark`, disabled `--secondary`), upload is transparent.
- **Inputs** (login): `min-height: 48px`, `padding: 0.7rem 0.85rem`, 1px `--input` border,
  `border-radius: 0.8rem`, bg `--background`; `aria-invalid="true"` → 2px `--danger` border. Labels
  are block, weight 700, `0.35rem` gap.
- **Language menu:** a custom button and `role="menu"` dropdown, with a pill trigger, custom
  chevron, `min-height: 44px`, and `--muted-foreground` text. The trigger and each option show a
  simplified inline SVG flag (`LanguageFlag.tsx`, `aria-hidden` — identical on every OS, unlike
  emoji flags, which Windows renders as letters). It closes on selection, outside click, Escape,
  or Tab; arrow keys and Home/End move between options. Flag↔language mapping (en→US, es→ES,
  zh→CN, tl→PH, vi→VN) is a pragmatic demo convention — flags denote countries, not languages.
- **Account panel:** absolutely-positioned dropdown, `min-width: 14rem`, 1px `--input` border,
  `border-radius: 1rem`, bg `--background`; closes on Escape (restoring focus to its trigger) and on
  outside click; exposes `aria-expanded` + `aria-controls`.
- **Prompt shell:** flex row, 1px `--input` border, `border-radius: 1rem`, the only animated
  component (`transition: border-color 160ms, background-color 160ms`). `:focus-within` →
  `--primary` border + soft `color-mix(primary 22%)` outline; `.is-dragging` → `--primary` border +
  tint. File-count `.file-badge` is a terracotta pill top-right of the upload button.
- **Phase card:** column, centered, `min-height: 16rem`, `padding: 2.5rem 2.25rem`,
  `border-radius: 1.25rem`, fill `color-mix(secondary 55%, transparent)`; circular `.phase-number`
  badge (2.75rem, terracotta, white numeral) → H2 → description (`max-width: 17rem`).
- **Skip link:** fixed, off-canvas (`top: -5rem`), slides to `top: 1rem` on focus; pill,
  `--foreground` bg / `--background` text, `z-index: 50`.

---

## 9. Accessibility (WCAG 2.2 AA) — non-negotiable

This is a scored requirement of the challenge and a core product value. Every new surface must keep
all of the following:

- **Skip link** as the first focusable element (`href="#main"`).
- **Visible focus:** global `:focus-visible { outline: 3px solid var(--primary-dark); outline-offset:
  3px; }`. The programmatically-focused view headings suppress the ring (focus is moved there on
  navigation, not by the user).
- **Focus management:** on view change, move focus to the destination view's `<h1>`
  (`tabIndex={-1}`). On failed login, return focus to the email input; on validation error, focus the
  first invalid field.
- **Live regions:** a page-level visually-hidden `#status` (`role="status" aria-live="polite"`) for
  "Signing in… / Signed in successfully. / Signed out."; `#attachment-status` for "{count} files
  attached"; the login form error uses `role="alert"`.
- **Errors:** inputs use `aria-describedby` + `aria-invalid` (set `true` only when invalid); every
  error string is text-prefixed **"Error: …"** — never color-only.
- **Semantic HTML:** `<header> <main> <section aria-labelledby|aria-label> <article>`; one `<h1>` per
  view → `<h2>` per card.
- **Labeled controls:** the language menu button, and all icon-only buttons (upload, send, account),
  carry `aria-label`; decorative SVGs are `aria-hidden="true" focusable="false"`.
- **Keyboard:** native `<button> <input> <a>` behavior; the language menu supports arrow keys and
  Home/End, and menus close on Escape and restore focus; hidden file input is `tabIndex={-1}`
  (reached via its labeled button).
- **Touch targets ≥ 44px** across all interactive elements (login inputs are 48px).
- **`lang`:** `<html lang>` is kept in sync with the active language
  (`document.documentElement.lang = language`).
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables smooth scroll and near-zeroes
  transitions; typewriter content renders statically.
- **Contrast:** warm near-black `#2a211c` on cream `#faf6ef`, white on terracotta buttons. When
  adding UI, re-check ratios — especially `--muted-foreground` `#6f6259` on `--background` for small
  text.

---

## 10. Responsiveness

Fluid-first: containers use `min(100%, Nrem)`, type and gaps use `clamp()`, so most sizing needs no
media queries. Guards: `html { min-width: 320px }`, `body { overflow-x: hidden }`. There is **no**
custom viewport override — Next.js injects `width=device-width, initial-scale=1`.

**Viewport-fit landing (no vertical scroll on desktop):** `body` is a `100dvh` flex column, header
on top, `.site-main` takes `flex: 1`, and `.landing-view` centers its three blocks with
`gap: clamp(1rem, 3.5vh, 2.5rem)`. Height-aware `clamp(..., Nvh, ...)` values compress the header,
hero type, card `min-height`, and paddings on short screens, so the whole landing fits the viewport
on any reasonable desktop size (verified 1280×620 through 1920×1080). The login card centers with
`margin: auto`. On `≤720px` (stacked cards taller than a phone screen) `.landing-view` switches to
`flex-start` and the page scrolls naturally — keep that behavior.

| Breakpoint | Changes |
|---|---|
| `≤ 720px` | header `min-height: 5rem`, tighter padding; main padding `0 1.25rem 4rem`; **phase grid → 1 column**; cards `min-height: auto`; account panel right-aligned |
| `≤ 440px` | header/main padding → `1rem`; `.nav-actions` gap `0.35rem`; smaller select padding; prompt shell padding `0.45rem`; login padding `1.5rem 1.25rem`; account panel full-width |

Verify layouts at **320 / 375 / 768 / 1024 / 1440px** with no horizontal overflow.

---

## 11. Motion & interaction

- **Transitions:** only the prompt shell animates (border/background, 160ms ease). Keep motion this
  restrained.
- **Hover states:** language menu, icon buttons, login/back links, secondary/primary/send buttons
  all have designed hover states (see §8). Every interactive element should have one.
- **Scroll:** `html { scroll-behavior: smooth }` (auto under reduced motion).
- **Typewriter placeholder** (`PromptShell.tsx`): cycles localized phrases — type 55ms/char, delete
  32ms/char, 1100ms full-phrase pause, 250ms between phrases; restarts on language change; **respects
  reduced motion** (renders the first phrase statically, re-checks on media-query change).
- **Tap highlight:** `-webkit-tap-highlight-color: transparent` on `button, select, a`.

---

## 12. Internationalization

- **Five languages — the most spoken in the US:** English, Spanish, Chinese, Tagalog, Vietnamese
  (`en`, `es`, `zh`, `tl`, `vi`). Bundled dictionaries live in `lib/dictionaries.ts` (the
  `Dictionary` type enforces at compile time that every language has every key); the React context
  in `lib/i18n.tsx` exposes `t(path)` (strings) and `tList(path)` (arrays, e.g. the typewriter
  placeholders). Switching language updates `<html lang>`.
- **Supabase is the shared translation store:** tables `i18n_languages` + `i18n_translations`
  (public read via RLS; writes only via dashboard/SQL). The app fetches them once at load and
  overlays them on the bundled dictionaries; if the fetch fails, the bundled copy is the fallback —
  the UI never depends on the network.
- **Rule:** every user-facing string goes through i18n, with **an entry in all five languages**, in
  `lib/dictionaries.ts` **and** in `i18n_translations` (keep them in sync). Never hardcode display
  text in a component.
- **Keep the voice:** calm, plain, reassuring, non-decisional. Match the existing register —
  "Housing paperwork, made clear." / "Nothing is decided without you." / phase copy like "Upload your
  documents. Confirm what's true." Avoid jargon, urgency, and anything that sounds like a verdict.

---

## 13. File & architecture map

| Path | Responsibility |
|---|---|
| `frontend/app/globals.css` | **The entire design system** — tokens (`:root`) + all component rules |
| `frontend/app/layout.tsx` | Root layout, `<html lang>`, metadata, favicon (`icons: "/logo.svg"`) |
| `frontend/app/page.tsx` | View switching, Supabase session, focus management, live-region status |
| `frontend/components/SiteHeader.tsx` | Header: brand and custom language menu |
| `frontend/components/HeroSellingPoints.tsx` | Hero headline and delayed selling-point typewriter cycle |
| `frontend/components/LoginView.tsx` | Accessible email/password sign-in |
| `frontend/components/PromptShell.tsx` | Prompt input, drag-drop upload, typewriter placeholder |
| `frontend/components/PhaseCards.tsx` | The 3 phase cards |
| `frontend/lib/i18n.tsx` | EN/ES dictionary + provider (`t` / `tList`) |
| `frontend/lib/supabase.ts` | Supabase client (auth) |
| `frontend/next.config.ts` | CSP + security headers |
| `frontend/public/logo.svg` | Logo (also the current favicon) |
| `frontend/public/fonts/` | `PublicSans-Variable.ttf` + `OFL.txt` |

**Conventions:** organize by surface/feature; keep components small; define color tokens **only** in
`:root`; derive variants with `color-mix()`; route all copy through i18n.

---

## 14. Do / Don't

**Do**
- Reuse the tokens and the flat, warm, low-contrast-of-hue aesthetic.
- Give every interactive element a hover **and** focus-visible state.
- Design with the citation/evidence surface in mind (values always paired with their source).
- Keep it keyboard-complete, announced, and ≥44px — verify at 320px up.
- Add EN + ES copy for every new string.

**Don't**
- Add shadows, gradients, or blue/government styling — it breaks the system.
- Introduce a dark theme (light-only is intentional) or new global colors outside `:root`.
- Use color as the only signal, or omit the "Error: …" text prefix.
- Put **any** decision/approval/eligibility language in the UI (instant DQ — see `CLAUDE.md`).
- Ship a template-looking layout with uniform emphasis and no hierarchy.

---

## 15. Known gaps / TODO

- **Door-only favicon** (no cream background) requested but not created — see §3.
- **Prompt shell is UI-only** — upload/send currently `console.log` and clear; nothing is sent to a
  backend yet. Wiring it up is future work (and must remove the `console.log`s).
- **No app content beyond the landing scaffold** — the profile/understand/prepare surfaces described
  in the product spec are not built.
