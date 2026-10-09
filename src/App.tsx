import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { AddressBar } from "./components/AddressBar";
import { IconBack, IconClose, IconExpand, IconForward, IconHome, IconReload, IconShrink, IconSliders, IconStar } from "./components/Icons";
import { NewTabPage } from "./components/NewTabPage";
import { SettingsPanel } from "./components/SettingsPanel";
import { TabBar } from "./components/TabBar";
import { IconButton } from "./components/ui";
import { WebView, type Phase, type WebViewApi } from "./components/WebView";
import { usePersistentState } from "./hooks/usePersistentState";
import { useShortcuts } from "./hooks/useShortcuts";
import { useSwipe } from "./hooks/useSwipe";
import { useTheme } from "./hooks/useTheme";
import { backendAvailable } from "./lib/embed";
import { enterFullscreen, exitFullscreen, fullscreenSupported, isFullscreen, onFullscreenChange } from "./lib/fullscreen";
import { sanitizeFavorites, sanitizeRecent, sanitizeSettings, type Settings } from "./lib/settings";
import { KEYS, loadJSON, removeKey, saveJSON } from "./lib/storage";
import { canGoBack, canGoForward, currentUrl, initTabsState, makeId, NEW_TAB, serializeTabs, tabsReducer } from "./lib/tabs";
import { hostnameOf, resolveInput } from "./lib/url";

export default function App() {
  const [settings, setSettings] = usePersistentState(KEYS.settings, sanitizeSettings);
  const [favorites, setFavorites] = usePersistentState(KEYS.favorites, sanitizeFavorites);
  const [recent, setRecent] = usePersistentState(KEYS.recent, sanitizeRecent);
  const [state, dispatch] = useReducer(tabsReducer, null, () => initTabsState(settings.restoreTabs ? loadJSON(KEYS.tabs) : null));
  const [statuses, setStatuses] = useState<Record<string, Phase>>({});
  const [activated, setActivated] = useState<Set<string>>(() => new Set([state.activeId]));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [backend, setBackend] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const controllers = useRef(new Map<string, WebViewApi>());

  useTheme(settings.theme);

  const activeTab = state.tabs.find((t) => t.id === state.activeId) ?? state.tabs[0];
  const activeUrl = currentUrl(activeTab);
  const activeStatus = activeUrl ? statuses[activeTab.id] : undefined;
  const isLoading = activeStatus === "checking" || activeStatus === "loading";

  // Persist tabs (debounced) and on page hide.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const t = setTimeout(() => saveJSON(KEYS.tabs, serializeTabs(state)), 250);
    return () => clearTimeout(t);
  }, [state]);
  useEffect(() => {
    const flush = () => saveJSON(KEYS.tabs, serializeTabs(stateRef.current));
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  useEffect(() => {
    setActivated((s) => (s.has(state.activeId) ? s : new Set(s).add(state.activeId)));
  }, [state.activeId]);

  // Drop transient state for closed tabs.
  useEffect(() => {
    const ids = new Set(state.tabs.map((t) => t.id));
    setStatuses((s) => (Object.keys(s).every((id) => ids.has(id)) ? s : Object.fromEntries(Object.entries(s).filter(([id]) => ids.has(id)))));
    setActivated((s) => ([...s].every((id) => ids.has(id)) ? s : new Set([...s].filter((id) => ids.has(id)))));
  }, [state.tabs]);

  useEffect(() => {
    backendAvailable().then(setBackend);
  }, []);
  useEffect(() => onFullscreenChange(() => setFullscreen(isFullscreen())), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Expose header height for the settings popover position.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--nx-header", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, [focusMode]);

  const onStatus = useCallback((id: string, phase: Phase) => setStatuses((s) => (s[id] === phase ? s : { ...s, [id]: phase })), []);
  const register = useCallback((id: string, api: WebViewApi | null) => {
    if (api) controllers.current.set(id, api);
    else controllers.current.delete(id);
  }, []);

  const openUrl = useCallback(
    (url: string) => {
      dispatch({ type: "navigate", id: stateRef.current.activeId, url });
      setRecent((r) => [url, ...r.filter((u) => u !== url)].slice(0, 100));
    },
    [setRecent],
  );

  const submit = useCallback(
    (input: string) => {
      const res = resolveInput(input, settings.searchEngine);
      if (!res) return;
      if (res.kind === "invalid") return setToast(res.reason);
      openUrl(res.url);
    },
    [settings.searchEngine, openUrl],
  );

  const back = useCallback((id: string) => dispatch({ type: "back", id }), []);
  const reload = useCallback((id: string) => dispatch({ type: "reload", id }), []);
  const activate = useCallback((id: string) => dispatch({ type: "activate", id }), []);
  const close = useCallback((id: string) => dispatch({ type: "close", id }), []);
  const newTab = useCallback(() => {
    dispatch({ type: "new" });
    setTimeout(() => addressRef.current?.focus(), 0);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (fullscreenSupported()) {
      (isFullscreen() ? exitFullscreen() : enterFullscreen()).catch(() => setFocusMode((v) => !v));
    } else {
      setFocusMode((v) => !v); // e.g. iPhone Safari: no element fullscreen, hide toolbars instead
    }
  }, []);

  const isFavorite = !!activeUrl && favorites.some((f) => f.url === activeUrl);
  const toggleFavorite = () => {
    if (!activeUrl) return;
    if (isFavorite) setFavorites((fs) => fs.filter((f) => f.url !== activeUrl));
    else {
      setFavorites((fs) => [...fs, { id: makeId(), title: hostnameOf(activeUrl), url: activeUrl }]);
      setToast("Added to favorites");
    }
  };

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [setSettings]);
  useEffect(() => {
    if (!settings.restoreTabs) removeKey(KEYS.tabs);
  }, [settings.restoreTabs]);

  useShortcuts({
    newTab,
    closeTab: () => close(stateRef.current.activeId),
    focusAddress: () => {
      setFocusMode(false);
      setTimeout(() => addressRef.current?.focus(), 0);
    },
    reload: () => reload(stateRef.current.activeId),
    back: () => back(stateRef.current.activeId),
    forward: () => dispatch({ type: "forward", id: stateRef.current.activeId }),
    nextTab: () => dispatch({ type: "activateRelative", delta: 1 }),
    prevTab: () => dispatch({ type: "activateRelative", delta: -1 }),
    switchTo: (index) => dispatch({ type: "activateIndex", index }),
    home: () => openUrl(NEW_TAB),
    toggleFocusMode: () => setFocusMode((v) => !v),
    escape: () => setFocusMode(false),
  });

  const swipe = useSwipe((dir) => dispatch({ type: "activateRelative", delta: dir === "left" ? 1 : -1 }));

  return (
    <div className="nx-root flex flex-col bg-bg text-fg">
      {!focusMode && (
        <header ref={headerRef} className="nx-header relative z-30 shrink-0 border-b border-line bg-bg/95">
          <TabBar tabs={state.tabs} activeId={state.activeId} statuses={statuses} onActivate={activate} onClose={close} onNew={newTab} />
          <div className="flex items-center gap-1 px-2 py-1.5" style={{ touchAction: "pan-y" }} {...swipe}>
            <IconButton label="Back (Alt+←)" disabled={!canGoBack(activeTab)} onClick={() => back(activeTab.id)}>
              <IconBack />
            </IconButton>
            <IconButton label="Forward (Alt+→)" disabled={!canGoForward(activeTab)} onClick={() => dispatch({ type: "forward", id: activeTab.id })}>
              <IconForward />
            </IconButton>
            {isLoading ? (
              <IconButton label="Stop loading" onClick={() => controllers.current.get(activeTab.id)?.stop()}>
                <IconClose />
              </IconButton>
            ) : (
              <IconButton label="Reload (Ctrl/⌘+R)" disabled={!activeUrl} onClick={() => reload(activeTab.id)}>
                <IconReload />
              </IconButton>
            )}
            <IconButton label="Home (Alt+H)" className="max-sm:hidden" onClick={() => openUrl(NEW_TAB)}>
              <IconHome />
            </IconButton>
            <AddressBar url={activeUrl} engine={settings.searchEngine} favorites={favorites} recent={recent} inputRef={addressRef} onSubmit={submit} />
            <IconButton label={isFavorite ? "Remove from favorites" : "Add to favorites"} active={isFavorite} disabled={!activeUrl} onClick={toggleFavorite}>
              <IconStar fill={isFavorite ? "currentColor" : "none"} />
            </IconButton>
            <IconButton label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
              {fullscreen ? <IconShrink /> : <IconExpand />}
            </IconButton>
            <IconButton label="Settings" active={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}>
              <IconSliders />
            </IconButton>
          </div>
          {isLoading && <div className="nx-progress absolute inset-x-0 bottom-0 h-0.5" role="progressbar" aria-label="Loading page" />}
        </header>
      )}

      <main className="relative min-h-0 flex-1">
        {state.tabs.map((tab) => {
          const url = currentUrl(tab);
          const active = tab.id === state.activeId;
          const mounted = url !== NEW_TAB && (active || (settings.keepBackgroundTabs && activated.has(tab.id)));
          if (!mounted) return null;
          return (
            <WebView
              key={tab.id}
              tabId={tab.id}
              url={url}
              reloadKey={tab.reloadKey}
              active={active}
              embedCheck={settings.embedCheck}
              timeoutSec={settings.loadTimeoutSec}
              canGoBack={canGoBack(tab)}
              onStatus={onStatus}
              onBack={back}
              onReload={reload}
              register={register}
            />
          );
        })}
        {activeUrl === NEW_TAB && (
          <NewTabPage
            favorites={favorites}
            engine={settings.searchEngine}
            onSubmit={submit}
            onOpen={openUrl}
            onAddFavorite={(title, url) => setFavorites((fs) => [...fs, { id: makeId(), title, url }])}
            onRemoveFavorite={(id) => setFavorites((fs) => fs.filter((f) => f.id !== id))}
          />
        )}
      </main>

      {focusMode && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="nx-focus-exit fixed right-3 z-50 flex h-10 items-center gap-2 rounded-full border border-line bg-panel/90 px-4 text-sm shadow-lg backdrop-blur pointer-coarse:h-12"
        >
          <IconShrink width={16} height={16} /> Show toolbars
        </button>
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          backend={backend}
          onChange={updateSettings}
          onFocusMode={() => {
            setSettingsOpen(false);
            setFocusMode(true);
          }}
          onClearData={() => {
            setRecent([]);
            dispatch({ type: "reset" });
            setSettingsOpen(false);
            setToast("History cleared");
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-fg px-4 py-2.5 text-sm text-bg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
