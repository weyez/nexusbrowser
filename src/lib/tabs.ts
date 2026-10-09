/** Empty string = the internal New Tab page. */
export const NEW_TAB = "";
const MAX_HISTORY = 50;
const MAX_TABS = 50;

export interface Tab {
  id: string;
  history: string[];
  index: number;
  reloadKey: number;
}

export interface TabsState {
  tabs: Tab[];
  activeId: string;
}

export type TabsAction =
  | { type: "new"; url?: string; activate?: boolean }
  | { type: "close"; id: string }
  | { type: "activate"; id: string }
  | { type: "activateRelative"; delta: number }
  | { type: "activateIndex"; index: number }
  | { type: "navigate"; id: string; url: string }
  | { type: "back"; id: string }
  | { type: "forward"; id: string }
  | { type: "reload"; id: string }
  | { type: "reset" };

let counter = 0;
export function makeId(): string {
  counter += 1;
  return `t${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createTab(url: string = NEW_TAB): Tab {
  return { id: makeId(), history: [url], index: 0, reloadKey: 0 };
}

export const currentUrl = (tab: Tab): string => tab.history[tab.index] ?? NEW_TAB;
export const canGoBack = (tab: Tab): boolean => tab.index > 0;
export const canGoForward = (tab: Tab): boolean => tab.index < tab.history.length - 1;

function update(state: TabsState, id: string, fn: (t: Tab) => Tab): TabsState {
  return { ...state, tabs: state.tabs.map((t) => (t.id === id ? fn(t) : t)) };
}

export function tabsReducer(state: TabsState, action: TabsAction): TabsState {
  switch (action.type) {
    case "new": {
      if (state.tabs.length >= MAX_TABS) return state;
      const tab = createTab(action.url ?? NEW_TAB);
      return { tabs: [...state.tabs, tab], activeId: action.activate === false ? state.activeId : tab.id };
    }
    case "close": {
      const idx = state.tabs.findIndex((t) => t.id === action.id);
      if (idx === -1) return state;
      const tabs = state.tabs.filter((t) => t.id !== action.id);
      if (tabs.length === 0) {
        const tab = createTab();
        return { tabs: [tab], activeId: tab.id };
      }
      const activeId = state.activeId === action.id ? tabs[Math.min(idx, tabs.length - 1)].id : state.activeId;
      return { tabs, activeId };
    }
    case "activate":
      return state.tabs.some((t) => t.id === action.id) ? { ...state, activeId: action.id } : state;
    case "activateRelative": {
      const idx = state.tabs.findIndex((t) => t.id === state.activeId);
      const n = state.tabs.length;
      return { ...state, activeId: state.tabs[(((idx + action.delta) % n) + n) % n].id };
    }
    case "activateIndex": {
      const tab = action.index < 0 ? state.tabs[state.tabs.length - 1] : state.tabs[action.index];
      return tab ? { ...state, activeId: tab.id } : state;
    }
    case "navigate":
      return update(state, action.id, (t) => {
        if (currentUrl(t) === action.url) return { ...t, reloadKey: t.reloadKey + 1 };
        const history = [...t.history.slice(0, t.index + 1), action.url].slice(-MAX_HISTORY);
        return { ...t, history, index: history.length - 1 };
      });
    case "back":
      return update(state, action.id, (t) => (canGoBack(t) ? { ...t, index: t.index - 1 } : t));
    case "forward":
      return update(state, action.id, (t) => (canGoForward(t) ? { ...t, index: t.index + 1 } : t));
    case "reload":
      return update(state, action.id, (t) => ({ ...t, reloadKey: t.reloadKey + 1 }));
    case "reset": {
      const tab = createTab();
      return { tabs: [tab], activeId: tab.id };
    }
    default:
      return state;
  }
}

/** Build initial state from persisted data, discarding anything malformed. */
export function initTabsState(saved: unknown): TabsState {
  const fallback = (): TabsState => {
    const tab = createTab();
    return { tabs: [tab], activeId: tab.id };
  };
  if (!saved || typeof saved !== "object") return fallback();
  const s = saved as { tabs?: unknown; activeId?: unknown };
  if (!Array.isArray(s.tabs)) return fallback();
  const tabs: Tab[] = [];
  for (const raw of s.tabs.slice(0, MAX_TABS)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as { id?: unknown; history?: unknown; index?: unknown };
    if (typeof r.id !== "string" || !Array.isArray(r.history)) continue;
    const history = r.history
      .filter((u): u is string => typeof u === "string" && (u === NEW_TAB || /^https?:\/\//.test(u)))
      .slice(-MAX_HISTORY);
    if (history.length === 0) continue;
    const index = typeof r.index === "number" && r.index >= 0 && r.index < history.length ? Math.floor(r.index) : history.length - 1;
    tabs.push({ id: r.id, history, index, reloadKey: 0 });
  }
  if (tabs.length === 0) return fallback();
  const activeId = tabs.some((t) => t.id === s.activeId) ? (s.activeId as string) : tabs[0].id;
  return { tabs, activeId };
}

export function serializeTabs(state: TabsState) {
  return { activeId: state.activeId, tabs: state.tabs.map(({ id, history, index }) => ({ id, history, index })) };
}
