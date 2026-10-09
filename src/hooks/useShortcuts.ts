import { useEffect, useRef } from "react";

export interface ShortcutHandlers {
  newTab(): void;
  closeTab(): void;
  focusAddress(): void;
  reload(): void;
  back(): void;
  forward(): void;
  nextTab(): void;
  prevTab(): void;
  switchTo(index: number): void;
  home(): void;
  toggleFocusMode(): void;
  escape(): void;
}

/**
 * Keyboard shortcuts. Browsers reserve Ctrl/Cmd+T/W/N, so tab shortcuts use Alt (Option on Mac).
 * e.code is used because Option+letter produces special characters on macOS/iPadOS.
 * Note: keys pressed while focus is inside a cross-origin page never reach NEXUS.
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      const mod = e.metaKey || e.ctrlKey;
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]");
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (e.key === "Escape") return h.escape();
      if (mod && !e.altKey && !e.shiftKey && e.code === "KeyL") return run(h.focusAddress);
      if ((mod && !e.altKey && e.code === "KeyR") || e.code === "F5") return run(h.reload);
      if (!e.altKey || mod) return;
      if (/^Digit[1-9]$/.test(e.code)) return run(() => h.switchTo(e.code === "Digit9" ? -1 : Number(e.code.slice(5)) - 1));
      switch (e.code) {
        case "KeyT": return run(h.newTab);
        case "KeyW": return run(h.closeTab);
        case "KeyL": return run(h.focusAddress);
        case "KeyH": return run(h.home);
        case "KeyF": return run(h.toggleFocusMode);
        case "BracketRight": return run(h.nextTab);
        case "BracketLeft": return run(h.prevTab);
        case "ArrowLeft": if (!typing) run(h.back); return;
        case "ArrowRight": if (!typing) run(h.forward); return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
