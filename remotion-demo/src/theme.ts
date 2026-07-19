// Design tokens lifted 1:1 from realdoor-boston.vercel.app (:root CSS variables).
export const colors = {
  background: '#faf6ef',
  foreground: '#2a211c',
  primary: '#b5654a',
  primaryDark: '#914b37',
  primaryDarkHover: '#7d3e2e',
  primaryForeground: '#ffffff',
  secondary: '#e8dfcf',
  muted: '#f2eadc',
  mutedForeground: '#6f6259',
  input: '#d5c6b4',
  danger: '#a92d2d',
  success: '#366e45',
  warn: '#8a5a00',
  // .cursor-grid uses #914b3724 grid lines
  gridLine: 'rgba(145, 75, 55, 0.14)',
  // logo.svg palette
  logoTile: '#F0E4D2',
  logoDoorClosed: '#D9BFA0',
  logoDoorOpen: '#C2634A',
} as const;

export const fontFamily =
  "'Public Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const site = {
  name: 'RealDoor',
  tagline: 'Housing paperwork, made clear.',
  description: 'A calm application-readiness assistant for affordable housing paperwork.',
  url: 'realdoor-boston.vercel.app',
  heroLine1: 'Preparing your housing paperwork',
  heroLine2: 'has never been this easy.',
  heroSub: 'One step at a time',
  assurances: ['No account needed', 'Your documents stay private', 'Free to use'],
  phases: [
    {n: 1, title: 'Profile', lines: ['Upload your documents.', "Confirm what's true."]},
    {n: 2, title: 'Understand', lines: ['Ask about the rules.', 'Get the answer, with its source.']},
    {n: 3, title: 'Prepare', lines: ["See what's missing.", "Export when you're ready."]},
  ],
  appTitle: 'Your application',
  appSubtitle:
    'RealDoor prepares and checks your paperwork for affordable housing in Boston. It never decides eligibility.',
  checklist: ['Application summary', 'Pay stub', 'Employment letter'],
} as const;
