"use client";

// Real PDF viewer: renders every page of the uploaded document with pdf.js and
// overlays ALL of the document's extracted-field boxes. Navigating to a field
// auto-crops (zooms + centers) around its box; boxes are buttons that jump to
// their field. Zoom via 44px buttons, Ctrl+wheel / trackpad pinch, and +/- keys
// — always anchored on the current crop (viewport center or cursor), never the
// page corner. Bytes come from the in-memory File (never fetched or uploaded).

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { RenderTask } from "pdfjs-dist/types/src/display/api";
import { loadPdfjs } from "@/lib/pdf/pdfjs";
import { confidenceColor } from "@/lib/pipeline/confidence";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import type { DocumentRecord, ExtractedField } from "@/lib/pipeline/types";
import s from "./pipeline.module.css";

type Props = {
  doc: DocumentRecord;
  fields: ExtractedField[];
  activeFieldId?: string;
  onSelectField?: (id: string) => void;
  onPageCount?: (docId: string, pageCount: number) => void;
  onError?: () => void;
};

type PageSize = { width: number; height: number };
type ZoomAnchor = { fracX: number; fracY: number; vx: number; vy: number };

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.25;
const MAX_CANVAS_DIM = 4096;
const PAGE_GAP = 12; // px between stacked pages
/** Boxes are drawn slightly dilated so the characters inside stay readable. */
const BOX_PAD = 0.006; // fraction of the page per side
/** Auto-crop targets: the active box fills most of the viewer. */
const CROP_WIDTH_FILL = 0.8;
const CROP_HEIGHT_FILL = 0.72;
/** Minimap: constant fit-to-width thumbnail with the visible-crop rectangle. */
const MINIMAP_WIDTH = 96;

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function PdfViewer({
  doc,
  fields,
  activeFieldId,
  onSelectField,
  onPageCount,
  onError,
}: Props) {
  const c = useCopy();
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [basePages, setBasePages] = useState<PageSize[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pageWrapRefs = useRef<Array<HTMLDivElement | null>>([]);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const minimapRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const minimapViewportRef = useRef<HTMLDivElement>(null);
  // Manual zoom keeps this point (content fraction ↔ viewport px) fixed.
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null);
  // Navigation sets this so the view centers on the active box after re-scale.
  const pendingCenterRef = useRef(false);
  const callbacksRef = useRef({ onPageCount, onError });
  callbacksRef.current = { onPageCount, onError };
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const activeFieldIdRef = useRef(activeFieldId);
  activeFieldIdRef.current = activeFieldId;

  // Open the document from in-memory bytes. A fresh buffer per open — pdf.js
  // transfers (detaches) it to the worker, so it must never be reused.
  useEffect(() => {
    const file = doc.file;
    if (!file) return;
    let cancelled = false;
    let loadingTask: ReturnType<typeof import("pdfjs-dist").getDocument> | null = null;

    const open = async () => {
      try {
        const pdfjs = await loadPdfjs();
        const data = new Uint8Array(await file.arrayBuffer());
        loadingTask = pdfjs.getDocument({ data });
        const opened = await loadingTask.promise;
        if (cancelled) return;
        const sizes: PageSize[] = [];
        for (let n = 1; n <= opened.numPages; n += 1) {
          const page = await opened.getPage(n);
          const viewport = page.getViewport({ scale: 1 });
          sizes.push({ width: viewport.width, height: viewport.height });
        }
        if (cancelled) return;
        setPdf(opened);
        setBasePages(sizes);
        setZoom(1);
        callbacksRef.current.onPageCount?.(doc.id, opened.numPages);
      } catch {
        if (!cancelled) callbacksRef.current.onError?.();
      }
    };
    void open();

    return () => {
      cancelled = true;
      setPdf(null);
      setBasePages([]);
      if (loadingTask) void loadingTask.destroy();
    };
  }, [doc.id, doc.file]);

  // Fit-to-width base scale. scrollbar-gutter is reserved in CSS so the width
  // does not flip when the vertical scrollbar appears (no zoom feedback loop);
  // sub-pixel jitter is ignored as extra insurance.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () =>
      setContainerWidth((prev) => {
        const next = el.clientWidth;
        return Math.abs(prev - next) > 1 ? next : prev;
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitScale =
    basePages.length > 0 && containerWidth > 0
      ? Math.max(0.1, (containerWidth - 2) / basePages[0].width)
      : 1;
  const scale = fitScale * zoom;

  const centerOnField = (field: ExtractedField, smooth: boolean) => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    const wrap = pageWrapRefs.current[field.page - 1];
    if (!scroller || !content || !wrap) return;
    const box = field.bbox;
    const cx = ((box[0] + box[2]) / 2) * wrap.clientWidth;
    const cy = ((box[1] + box[3]) / 2) * wrap.clientHeight;
    scroller.scrollTo({
      left: Math.max(0, content.offsetLeft + wrap.offsetLeft + cx - scroller.clientWidth / 2),
      top: Math.max(0, content.offsetTop + wrap.offsetTop + cy - scroller.clientHeight / 2),
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    });
  };

  /** Zoom anchored on a viewport point (defaults to the viewport center). */
  const manualZoom = (compute: (z: number) => number, vx?: number, vy?: number) => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (scroller && content && content.clientWidth > 0 && content.clientHeight > 0) {
      const ax = vx ?? scroller.clientWidth / 2;
      const ay = vy ?? scroller.clientHeight / 2;
      zoomAnchorRef.current = {
        fracX: (scroller.scrollLeft + ax - content.offsetLeft) / content.clientWidth,
        fracY: (scroller.scrollTop + ay - content.offsetTop) / content.clientHeight,
        vx: ax,
        vy: ay,
      };
    }
    pendingCenterRef.current = false;
    setZoom((z) => clampZoom(compute(z)));
  };

  // Page-wrapper geometry updates synchronously with `scale`, so scroll
  // corrections can run right after commit — before canvases even repaint.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    const anchor = zoomAnchorRef.current;
    if (anchor) {
      zoomAnchorRef.current = null;
      scroller.scrollLeft = anchor.fracX * content.clientWidth + content.offsetLeft - anchor.vx;
      scroller.scrollTop = anchor.fracY * content.clientHeight + content.offsetTop - anchor.vy;
      return;
    }
    if (pendingCenterRef.current) {
      pendingCenterRef.current = false;
      const field = fieldsRef.current.find((f) => f.id === activeFieldIdRef.current);
      if (field) centerOnField(field, true);
    }
  }, [scale]);

  /** Auto-crop: zoom so the active field's box fills most of the viewer, then
   *  center on it. Used on navigation and by the "Snap to value" button. */
  const snapToActiveField = () => {
    const scroller = scrollerRef.current;
    const field = fields.find((f) => f.id === activeFieldId);
    if (!scroller || !field || basePages.length === 0 || containerWidth <= 0) return;
    const base = basePages[field.page - 1] ?? basePages[0];
    const [x1, yTop, x2, yBottom] = field.bbox;
    const widthFrac = Math.max(0.02, x2 - x1);
    const heightFrac = Math.max(0.01, yBottom - yTop);
    const zoomForWidth = CROP_WIDTH_FILL / widthFrac;
    const scrollerHeight = scroller.clientHeight || 1;
    const zoomForHeight =
      (CROP_HEIGHT_FILL * scrollerHeight) / (heightFrac * base.height * fitScale);
    const target = clampZoom(Math.max(1, Math.min(zoomForWidth, zoomForHeight)));
    zoomAnchorRef.current = null;
    if (Math.abs(target - zoom) < 0.001) {
      centerOnField(field, true);
    } else {
      pendingCenterRef.current = true;
      setZoom(target);
    }
  };
  const snapRef = useRef(snapToActiveField);
  snapRef.current = snapToActiveField;

  // Manual zoom/pan is left alone until the next navigation; snapping also
  // fires once the document loads.
  useEffect(() => {
    snapRef.current();
  }, [activeFieldId, basePages]);

  // Render every page's canvas at the current scale; cancel in-flight tasks on
  // every change (zoom, resize, doc switch, unmount).
  useEffect(() => {
    if (!pdf || basePages.length === 0 || containerWidth <= 0) return;
    let cancelled = false;
    const tasks: RenderTask[] = [];

    const render = async () => {
      const dpr = window.devicePixelRatio || 1;
      for (let index = 0; index < basePages.length; index += 1) {
        if (cancelled) return;
        const canvas = canvasRefs.current[index];
        if (!canvas) continue;
        const page = await pdf.getPage(index + 1);
        if (cancelled) return;
        const cssViewport = page.getViewport({ scale });
        const effDpr = Math.min(
          dpr,
          MAX_CANVAS_DIM / Math.max(cssViewport.width, cssViewport.height),
        );
        const viewport = page.getViewport({ scale: scale * effDpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        // Keep the canvas explicitly opaque while navigation changes the crop.
        // Resizing a canvas clears it before pdf.js repaints; without a render
        // background Chromium can briefly composite that cleared surface as
        // black against the animated page grid.
        const task = page.render({
          canvas,
          viewport,
          background: "rgb(255, 255, 255)",
        });
        tasks.push(task);
        try {
          await task.promise;
        } catch {
          return; // cancelled mid-render — a newer pass owns the canvas now
        }
      }
    };
    void render();

    return () => {
      cancelled = true;
      for (const task of tasks) task.cancel();
    };
  }, [pdf, basePages, scale, containerWidth]);

  // Mouse drag-to-pan: grab the page background (boxes stay clickable; touch
  // keeps native scrolling).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      if ((event.target as HTMLElement).closest("button")) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = el.scrollLeft;
      startTop = el.scrollTop;
      el.setPointerCapture(event.pointerId);
      el.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      el.scrollLeft = startLeft - (event.clientX - startX);
      el.scrollTop = startTop - (event.clientY - startY);
    };
    const endDrag = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "";
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        // pointer capture may already be gone — nothing to release
      }
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  // Ctrl+wheel / trackpad-pinch zoom, anchored on the cursor. Needs a
  // NON-passive listener (React's onWheel cannot preventDefault).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      manualZoom(
        (z) => z * (event.deltaY < 0 ? 1.1 : 1 / 1.1),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // manualZoom only touches refs + setZoom — safe to bind once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScrollerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      manualZoom((z) => z * ZOOM_STEP);
    } else if (event.key === "-") {
      event.preventDefault();
      manualZoom((z) => z / ZOOM_STEP);
    }
  };

  const activeField = fields.find((f) => f.id === activeFieldId);
  const numPages = basePages.length;
  const minimapPage = Math.min(
    Math.max(0, numPages - 1),
    Math.max(0, (activeField?.page ?? 1) - 1),
  );

  // Paint the minimap thumbnail (constant fit-to-width, independent of zoom).
  useEffect(() => {
    if (!pdf || basePages.length === 0) return;
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    const render = async () => {
      const page = await pdf.getPage(minimapPage + 1);
      if (cancelled) return;
      const base = basePages[minimapPage];
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (MINIMAP_WIDTH / base.width) * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({
        canvas,
        viewport,
        background: "rgb(255, 255, 255)",
      });
      await task.promise.catch(() => undefined);
    };
    void render();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, basePages, minimapPage]);

  // Keep the minimap's crop rectangle in sync with the visible viewport.
  const updateMinimapViewport = () => {
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    const wrap = pageWrapRefs.current[minimapPage];
    const boxEl = minimapViewportRef.current;
    if (!scroller || !content || !wrap || !boxEl) return;
    const wrapLeft = content.offsetLeft + wrap.offsetLeft;
    const wrapTop = content.offsetTop + wrap.offsetTop;
    const cl = (v: number) => Math.min(1, Math.max(0, v));
    const x0 = cl((scroller.scrollLeft - wrapLeft) / wrap.clientWidth);
    const y0 = cl((scroller.scrollTop - wrapTop) / wrap.clientHeight);
    const x1 = cl((scroller.scrollLeft + scroller.clientWidth - wrapLeft) / wrap.clientWidth);
    const y1 = cl((scroller.scrollTop + scroller.clientHeight - wrapTop) / wrap.clientHeight);
    boxEl.style.left = `${x0 * 100}%`;
    boxEl.style.top = `${y0 * 100}%`;
    boxEl.style.width = `${(x1 - x0) * 100}%`;
    boxEl.style.height = `${(y1 - y0) * 100}%`;
  };
  const updateMinimapRef = useRef(updateMinimapViewport);
  updateMinimapRef.current = updateMinimapViewport;

  // rAF-throttled scroll tracking (scrollTo animations emit scroll events too).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateMinimapRef.current();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Re-sync after zoom/layout/page changes settle.
  useEffect(() => {
    updateMinimapRef.current();
  }, [scale, minimapPage, basePages, containerWidth]);

  // Click the minimap to pan the main view to that spot.
  const onMinimapPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const mapEl = minimapRef.current;
    const scroller = scrollerRef.current;
    const content = contentRef.current;
    const wrap = pageWrapRefs.current[minimapPage];
    if (!mapEl || !scroller || !content || !wrap) return;
    const rect = mapEl.getBoundingClientRect();
    const fx = (event.clientX - rect.left) / rect.width;
    const fy = (event.clientY - rect.top) / rect.height;
    const wrapLeft = content.offsetLeft + wrap.offsetLeft;
    const wrapTop = content.offsetTop + wrap.offsetTop;
    scroller.scrollTo({
      left: Math.max(0, wrapLeft + fx * wrap.clientWidth - scroller.clientWidth / 2),
      top: Math.max(0, wrapTop + fy * wrap.clientHeight - scroller.clientHeight / 2),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  if (!doc.file) return null;

  return (
    <div className={s.viewerShell}>
      <div className={s.viewerToolbar}>
        <button
          type="button"
          className={s.viewerBtn}
          aria-label={c.zoomOut}
          onClick={() => manualZoom((z) => z / ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
        >
          −
        </button>
        <span className={s.zoomReadout} aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          className={s.viewerBtn}
          aria-label={c.zoomIn}
          onClick={() => manualZoom((z) => z * ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
        >
          +
        </button>
        <button type="button" className={s.viewerBtnText} onClick={() => manualZoom(() => 1)}>
          {c.zoomFit}
        </button>
        <button
          type="button"
          className={s.viewerBtnText}
          onClick={() => snapRef.current()}
          disabled={!activeField}
        >
          {c.snapToField}
        </button>
        {numPages > 1 && (
          <span className={s.pageReadout}>
            {fmt(c.pageOfTotal, { n: activeField?.page ?? 1, total: numPages })}
          </span>
        )}
      </div>

      <div className={s.viewerBody}>
        <div
          className={s.viewerScroll}
          ref={scrollerRef}
          role="region"
          aria-label={`${c.viewerLabel} — ${doc.fileName}`}
          tabIndex={0}
          onKeyDown={onScrollerKeyDown}
        >
          {numPages === 0 ? (
            <p className={s.viewerLoading} role="status">
              {c.reading}
            </p>
          ) : (
            <div className={s.viewerContent} ref={contentRef}>
              {basePages.map((base, index) => (
                <div
                  key={index}
                  className={s.pdfPageWrap}
                  style={{
                    width: base.width * scale,
                    height: base.height * scale,
                    marginBottom: index < numPages - 1 ? PAGE_GAP : 0,
                  }}
                  ref={(el) => {
                    pageWrapRefs.current[index] = el;
                  }}
                >
                  <canvas
                    className={s.pdfCanvas}
                    ref={(el) => {
                      canvasRefs.current[index] = el;
                    }}
                  />
                  {fields
                    .filter((f) => f.page === index + 1)
                    .map((f) => {
                      const [rawX1, rawTop, rawX2, rawBottom] = f.bbox;
                      const x1 = Math.max(0, rawX1 - BOX_PAD);
                      const yTop = Math.max(0, rawTop - BOX_PAD);
                      const x2 = Math.min(1, rawX2 + BOX_PAD);
                      const yBottom = Math.min(1, rawBottom + BOX_PAD);
                      const isActive = f.id === activeFieldId;
                      const cls = isActive ? `${s.bboxBtn} ${s.bboxActive}` : s.bboxBtn;
                      const style = {
                        left: `${x1 * 100}%`,
                        top: `${yTop * 100}%`,
                        width: `${(x2 - x1) * 100}%`,
                        height: `${(yBottom - yTop) * 100}%`,
                        // Same ramp as the confidence meter, consumed by the CSS.
                        "--conf": confidenceColor(f.confidence),
                      } as React.CSSProperties;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          className={cls}
                          style={style}
                          aria-label={`${humanize(f.key)}: ${f.value || c.parameterNotPresent} — ${fmt(c.page, { n: f.page })}`}
                          aria-current={isActive ? "true" : undefined}
                          onClick={() => onSelectField?.(f.id)}
                        />
                      );
                    })}
                </div>
              ))}
            </div>
          )}
        </div>

        {numPages > 0 && (
          <div
            className={s.viewerMinimap}
            ref={minimapRef}
            aria-hidden="true"
            onPointerDown={onMinimapPointerDown}
          >
            <canvas ref={minimapCanvasRef} className={s.viewerMinimapCanvas} />
            <div ref={minimapViewportRef} className={s.minimapViewport} />
          </div>
        )}
      </div>
    </div>
  );
}
