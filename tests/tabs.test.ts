import { describe, expect, it } from "vitest";
import { canGoBack, canGoForward, currentUrl, initTabsState, NEW_TAB, serializeTabs, tabsReducer, type TabsState } from "../src/lib/tabs";

const start = (): TabsState => initTabsState(null);

describe("tabsReducer", () => {
  it("starts with one new tab", () => {
    const s = start();
    expect(s.tabs).toHaveLength(1);
    expect(currentUrl(s.tabs[0])).toBe(NEW_TAB);
  });

  it("keeps separate history per tab with back/forward", () => {
    let s = start();
    const a = s.activeId;
    s = tabsReducer(s, { type: "navigate", id: a, url: "https://a.com/" });
    s = tabsReducer(s, { type: "navigate", id: a, url: "https://b.com/" });
    s = tabsReducer(s, { type: "new" });
    const b = s.activeId;
    s = tabsReducer(s, { type: "navigate", id: b, url: "https://c.com/" });
    s = tabsReducer(s, { type: "back", id: a });
    const tabA = s.tabs.find((t) => t.id === a)!;
    expect(currentUrl(tabA)).toBe("https://a.com/");
    expect(canGoForward(tabA)).toBe(true);
    expect(currentUrl(s.tabs.find((t) => t.id === b)!)).toBe("https://c.com/");
    s = tabsReducer(s, { type: "forward", id: a });
    expect(currentUrl(s.tabs.find((t) => t.id === a)!)).toBe("https://b.com/");
  });

  it("drops forward history on new navigation", () => {
    let s = start();
    const id = s.activeId;
    for (const u of ["https://a.com/", "https://b.com/"]) s = tabsReducer(s, { type: "navigate", id, url: u });
    s = tabsReducer(s, { type: "back", id });
    s = tabsReducer(s, { type: "navigate", id, url: "https://z.com/" });
    expect(s.tabs[0].history).toEqual([NEW_TAB, "https://a.com/", "https://z.com/"]);
    expect(canGoForward(s.tabs[0])).toBe(false);
  });

  it("navigating to the current URL reloads instead of duplicating", () => {
    let s = start();
    const id = s.activeId;
    s = tabsReducer(s, { type: "navigate", id, url: "https://a.com/" });
    s = tabsReducer(s, { type: "navigate", id, url: "https://a.com/" });
    expect(s.tabs[0].history).toHaveLength(2);
    expect(s.tabs[0].reloadKey).toBe(1);
  });

  it("closing activates a neighbour and never leaves zero tabs", () => {
    let s = start();
    s = tabsReducer(s, { type: "new" });
    s = tabsReducer(s, { type: "new" });
    const [t0, t1, t2] = s.tabs.map((t) => t.id);
    s = tabsReducer(s, { type: "activate", id: t1 });
    s = tabsReducer(s, { type: "close", id: t1 });
    expect(s.activeId).toBe(t2);
    s = tabsReducer(s, { type: "close", id: t2 });
    expect(s.activeId).toBe(t0);
    s = tabsReducer(s, { type: "close", id: t0 });
    expect(s.tabs).toHaveLength(1);
    expect(s.tabs[0].id).not.toBe(t0);
  });

  it("cycles tabs relatively and by index", () => {
    let s = start();
    s = tabsReducer(s, { type: "new" });
    s = tabsReducer(s, { type: "new" });
    s = tabsReducer(s, { type: "activateRelative", delta: 1 });
    expect(s.activeId).toBe(s.tabs[0].id);
    s = tabsReducer(s, { type: "activateIndex", index: -1 });
    expect(s.activeId).toBe(s.tabs[2].id);
  });

  it("round-trips through persistence and rejects bad data", () => {
    let s = start();
    s = tabsReducer(s, { type: "navigate", id: s.activeId, url: "https://a.com/" });
    const restored = initTabsState(JSON.parse(JSON.stringify(serializeTabs(s))));
    expect(restored.tabs[0].history).toEqual(s.tabs[0].history);
    expect(restored.activeId).toBe(s.activeId);
    const bad = initTabsState({ tabs: [{ id: "x", history: ["javascript:alert(1)"], index: 0 }, 5, null] });
    expect(bad.tabs).toHaveLength(1);
    expect(currentUrl(bad.tabs[0])).toBe(NEW_TAB);
    expect(canGoBack(bad.tabs[0])).toBe(false);
  });
});
