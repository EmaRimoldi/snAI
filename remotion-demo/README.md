# RealDoor — 30s Remotion demo

A 30-second product demo video of [RealDoor](https://realdoor-boston.vercel.app/) — "Housing paperwork, made clear" — built with [Remotion](https://remotion.dev).

The video recreates the site's design system (cream `#faf6ef` background, terracotta `#b5654a`/`#914b37` accents, Public Sans, the drifting cursor grid) and walks through the product story:

| Time | Scene |
| --- | --- |
| 0–4s | Brand reveal — logo, wordmark, "Housing paperwork, made clear." |
| 4–11s | Landing hero — animated headline, typed "One step at a time", **Get started** CTA, assurances |
| 11–16s | The three phases — Profile · Understand · Prepare |
| 16–22s | In-app walkthrough — uploading documents, readiness checklist completes |
| 22–27s | Cited Q&A ("Does overtime pay count toward my income?") + **Ready to apply** verdict |
| 27–30s | Outro — lockup, URL, "it never decides eligibility" |

## Usage

```bash
npm install

# Preview in the browser (Remotion Studio)
npm run dev

# Render the 30s MP4 (1920x1080 @ 30fps) to out/realdoor-demo.mp4
npm run render
```

If Chrome cannot be downloaded in your environment, point Remotion at an existing
Chromium binary:

```bash
REMOTION_BROWSER_EXECUTABLE=/path/to/chromium npm run render
```

## Notes

- All copy in the video is taken verbatim from the live site (hero, phase cards,
  app subtitle, checklist items). The Q&A exchange is representative of the
  product's Understand step.
- `public/fonts` bundles the Public Sans variable font (the site's typeface),
  licensed under the SIL Open Font License (see `public/fonts/OFL.txt`).
- Scene timings live in `src/RealDoorDemo.tsx` (`SCENES`); design tokens in
  `src/theme.ts`.
