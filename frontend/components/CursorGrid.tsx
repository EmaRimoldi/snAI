"use client";

import { useEffect, useRef } from "react";

const EASING = 0.16;
const STOP_THRESHOLD = 0.08;

export function CursorGrid() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!grid || !finePointer.matches) return;

    const current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const target = { ...current };
    let frame: number | null = null;

    const render = () => {
      frame = null;
      current.x += (target.x - current.x) * EASING;
      current.y += (target.y - current.y) * EASING;

      grid.style.setProperty("--grid-cursor-x", `${current.x.toFixed(2)}px`);
      grid.style.setProperty("--grid-cursor-y", `${current.y.toFixed(2)}px`);

      const remaining = Math.abs(target.x - current.x) + Math.abs(target.y - current.y);

      if (remaining > STOP_THRESHOLD) frame = window.requestAnimationFrame(render);
    };

    const scheduleRender = () => {
      if (frame === null) frame = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      target.x = event.clientX;
      target.y = event.clientY;
      grid.style.setProperty("--grid-active", "1");

      if (reducedMotion.matches) {
        grid.style.setProperty("--grid-cursor-x", `${target.x}px`);
        grid.style.setProperty("--grid-cursor-y", `${target.y}px`);
        return;
      }

      scheduleRender();
    };

    const hideGrid = (event: PointerEvent) => {
      if (event.relatedTarget === null) grid.style.setProperty("--grid-active", "0");
    };

    const handleBlur = () => grid.style.setProperty("--grid-active", "0");

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerout", hideGrid, { passive: true });
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerout", hideGrid);
      window.removeEventListener("blur", handleBlur);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={gridRef} className="cursor-grid" aria-hidden="true" />;
}
