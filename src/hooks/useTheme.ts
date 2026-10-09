import { useEffect } from "react";
import type { ThemeSetting } from "../lib/settings";

export function useTheme(theme: ThemeSetting): void {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b0c10" : "#f4f5f8");
      try {
        localStorage.setItem("nexus.themeClass", dark ? "dark" : "light");
      } catch {
        /* ignore */
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}
