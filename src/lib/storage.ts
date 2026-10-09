export function loadJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled (e.g. some private modes) — settings stay in memory */
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  settings: "nexus.settings.v1",
  favorites: "nexus.favorites.v1",
  recent: "nexus.recent.v1",
  tabs: "nexus.tabs.v1",
} as const;
