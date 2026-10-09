import { SEARCH_ENGINES, type SearchEngineId } from "./url";

export type ThemeSetting = "system" | "dark" | "light";

export interface Settings {
  theme: ThemeSetting;
  searchEngine: SearchEngineId;
  keepBackgroundTabs: boolean;
  embedCheck: boolean;
  restoreTabs: boolean;
  loadTimeoutSec: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  searchEngine: "bing",
  keepBackgroundTabs: true,
  embedCheck: true,
  restoreTabs: true,
  loadTimeoutSec: 20,
};

export function sanitizeSettings(v: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (!v || typeof v !== "object") return s;
  const r = v as Record<string, unknown>;
  if (r.theme === "system" || r.theme === "dark" || r.theme === "light") s.theme = r.theme;
  if (typeof r.searchEngine === "string" && r.searchEngine in SEARCH_ENGINES) s.searchEngine = r.searchEngine as SearchEngineId;
  for (const k of ["keepBackgroundTabs", "embedCheck", "restoreTabs"] as const) if (typeof r[k] === "boolean") s[k] = r[k];
  if (typeof r.loadTimeoutSec === "number" && r.loadTimeoutSec >= 5 && r.loadTimeoutSec <= 120) s.loadTimeoutSec = r.loadTimeoutSec;
  return s;
}

export interface Favorite {
  id: string;
  title: string;
  url: string;
}

export const DEFAULT_FAVORITES: Favorite[] = [
  { id: "f-wikipedia", title: "Wikipedia", url: "https://en.wikipedia.org/wiki/Main_Page" },
  { id: "f-osm", title: "OpenStreetMap", url: "https://www.openstreetmap.org/export/embed.html" },
  { id: "f-2048", title: "2048", url: "https://gabrielecirulli.github.io/2048/" },
  { id: "f-dino", title: "Dino Run", url: "https://chromedino.com/" },
  { id: "f-desmos", title: "Desmos", url: "https://www.desmos.com/calculator" },
  { id: "f-geogebra", title: "GeoGebra", url: "https://www.geogebra.org/calculator" },
  { id: "f-excalidraw", title: "Excalidraw", url: "https://excalidraw.com/" },
  { id: "f-photopea", title: "Photopea", url: "https://www.photopea.com/" },
  { id: "f-archive", title: "Internet Archive", url: "https://archive.org/" },
  { id: "f-gutenberg", title: "Gutenberg", url: "https://www.gutenberg.org/" },
];

export function sanitizeFavorites(v: unknown): Favorite[] {
  if (!Array.isArray(v)) return DEFAULT_FAVORITES;
  return v
    .filter(
      (f): f is Favorite =>
        !!f && typeof f === "object" && typeof f.id === "string" && typeof f.title === "string" && typeof f.url === "string" && /^https?:\/\//.test(f.url),
    )
    .slice(0, 48);
}

export function sanitizeRecent(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 100) : [];
}
