// Browser-only, memoized pdf.js loader. Never import pdfjs-dist at a module's
// top level — client components still server-render and pdf.js touches browser
// globals. The worker URL resolves to a same-origin static asset at build time,
// so the CSP stays 'self'-only (worker-src 'self').

let mod: Promise<typeof import("pdfjs-dist")> | undefined;

export function loadPdfjs(): Promise<typeof import("pdfjs-dist")> {
  mod ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return pdfjs;
  });
  return mod;
}
