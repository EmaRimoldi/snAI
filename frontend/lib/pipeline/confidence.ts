/** Shared confidence → color ramp: green (high) → amber → red (low ≤ 50%).
 *  Used by the confidence meter and the PDF bounding-box overlays. A numeric
 *  or textual signal always accompanies it — color is never the only cue. */
export function confidenceColor(confidence: number): string {
  const t = Math.min(1, Math.max(0, (confidence - 0.5) / 0.5));
  return `hsl(${Math.round(t * 120)} 62% 34%)`;
}
