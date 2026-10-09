import { useEffect } from "react";
import type { Settings, ThemeSetting } from "../lib/settings";
import { SEARCH_ENGINES, type SearchEngineId } from "../lib/url";
import { IconClose, IconEyeOff, IconTrash } from "./Icons";
import { IconButton, Toggle } from "./ui";

interface Props {
  settings: Settings;
  backend: boolean | null;
  onChange(patch: Partial<Settings>): void;
  onClearData(): void;
  onFocusMode(): void;
  onClose(): void;
}

const THEMES: Array<{ id: ThemeSetting; label: string }> = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "system", label: "System" },
];

const SHORTCUTS: Array<[string, string]> = [
  ["Alt + T / Alt + W", "New / close tab"],
  ["Alt + [ / Alt + ]", "Previous / next tab"],
  ["Alt + 1…9", "Go to tab"],
  ["Alt + ← / →", "Back / forward"],
  ["Ctrl/⌘ + L", "Focus address bar"],
  ["Ctrl/⌘ + R", "Reload"],
  ["Alt + H / Alt + F", "Home / hide toolbars"],
];

export function SettingsPanel({ settings, backend, onChange, onClearData, onFocusMode, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="nx-sheet fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-line bg-panel p-4 shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-[calc(var(--nx-header,96px)+4px)] sm:w-96 sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Settings</h2>
          <IconButton label="Close settings" onClick={onClose}>
            <IconClose />
          </IconButton>
        </div>

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Appearance</h3>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-xl bg-elev p-1">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={settings.theme === t.id}
                onClick={() => onChange({ theme: t.id })}
                className={`h-9 rounded-lg text-sm pointer-coarse:h-11 ${settings.theme === t.id ? "bg-panel font-medium shadow-sm" : "text-muted"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Search</h3>
          <label className="flex items-center justify-between gap-4 text-sm">
            Search engine
            <select
              value={settings.searchEngine}
              onChange={(e) => onChange({ searchEngine: e.target.value as SearchEngineId })}
              className="h-10 rounded-lg border border-line bg-elev px-2 text-sm pointer-coarse:h-11"
            >
              {Object.entries(SEARCH_ENGINES).map(([id, e]) => (
                <option key={id} value={id}>{e.embeds ? e.name : `${e.name} (opens outside)`}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="mb-4 divide-y divide-line">
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Tabs & loading</h3>
          <Toggle label="Restore tabs on launch" checked={settings.restoreTabs} onChange={(v) => onChange({ restoreTabs: v })} />
          <Toggle
            label="Keep background tabs running"
            hint="Preserves game/app state; uses more memory"
            checked={settings.keepBackgroundTabs}
            onChange={(v) => onChange({ keepBackgroundTabs: v })}
          />
          <Toggle
            label="Check if sites allow embedding"
            hint={backend === false ? "Unavailable: backend not deployed" : "Shows a clear message instead of a blank page"}
            checked={settings.embedCheck}
            onChange={(v) => onChange({ embedCheck: v })}
          />
          <label className="flex items-center justify-between gap-4 py-2 text-sm">
            Slow-load warning after
            <select
              value={settings.loadTimeoutSec}
              onChange={(e) => onChange({ loadTimeoutSec: Number(e.target.value) })}
              className="h-10 rounded-lg border border-line bg-elev px-2 text-sm pointer-coarse:h-11"
            >
              {[10, 20, 30, 60].map((s) => (
                <option key={s} value={s}>{s} s</option>
              ))}
            </select>
          </label>
        </section>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onFocusMode} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-elev text-sm hover:bg-line">
            <IconEyeOff width={16} height={16} /> Hide toolbars
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Close all tabs and clear NEXUS history? Favorites and settings are kept.")) onClearData();
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-elev text-sm text-red-500 hover:bg-line"
          >
            <IconTrash width={16} height={16} /> Clear history
          </button>
        </div>

        <section className="pointer-coarse:hidden">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Keyboard shortcuts</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="contents">
                <dt><kbd className="rounded bg-elev px-1.5 py-0.5 font-mono">{k}</kbd></dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </>
  );
}
