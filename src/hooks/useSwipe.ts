import { useRef } from "react";
import type { PointerEvent } from "react";

/** Horizontal swipe detection for touch/pen. Ignores swipes that start in text fields. */
export function useSwipe(onSwipe: (direction: "left" | "right") => void, minDistance = 70) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse") return;
      if ((e.target as HTMLElement).closest("input, textarea, [data-no-swipe]")) return;
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    },
    onPointerUp(e: PointerEvent) {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Date.now() - s.t < 700 && Math.abs(dx) >= minDistance && Math.abs(dx) > 2 * Math.abs(dy)) {
        onSwipe(dx < 0 ? "left" : "right");
      }
    },
    onPointerCancel() {
      start.current = null;
    },
  };
}
