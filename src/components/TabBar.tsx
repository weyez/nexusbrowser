import { memo, useEffect, useRef } from "react";
import { currentUrl, type Tab } from "../lib/tabs";
import { hostnameOf } from "../lib/url";
import type { Phase } from "./WebView";
import { IconClose, IconPlus } from "./Icons";
import { IconButton, SiteAvatar, Spinner } from "./ui";

interface Props {
  tabs: Tab[];
  activeId: string;
  statuses: Record<string, Phase>;
  onActivate(id: string): void;
  onClose(id: string): void;
  onNew(): void;
}

export const TabBar = memo(function TabBar({ tabs, activeId, statuses, onActivate, onClose, onNew }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, tabs.length]);

  return (
    <div className="flex items-center gap-1 px-2 pt-1.5" data-no-swipe>
      <div ref={listRef} role="tablist" aria-label="Tabs" className="nx-scroll flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const url = currentUrl(tab);
          const title = url ? hostnameOf(url) : "New Tab";
          const active = tab.id === activeId;
          const loading = statuses[tab.id] === "checking" || statuses[tab.id] === "loading";
          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              className={`group flex h-9 min-w-[8rem] max-w-[14rem] flex-1 items-center rounded-lg border text-sm transition-colors pointer-coarse:h-11 ${
                active ? "border-line bg-panel text-fg shadow-sm" : "border-transparent text-muted hover:bg-elev"
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                title={url || "New Tab"}
                onClick={() => onActivate(tab.id)}
                onAuxClick={(e) => e.button === 1 && onClose(tab.id)}
                className="flex h-full min-w-0 flex-1 items-center gap-2 pl-2.5 text-left"
              >
                {loading ? <Spinner size={16} /> : url ? <SiteAvatar url={url} size={16} /> : <span className="size-4 shrink-0 rounded bg-accent/80" />}
                <span className="truncate">{title}</span>
              </button>
              <button
                type="button"
                aria-label={`Close ${title}`}
                onClick={() => onClose(tab.id)}
                className={`mr-1 grid size-7 shrink-0 place-items-center rounded-md hover:bg-line pointer-coarse:size-9 pointer-coarse:opacity-100 ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
              >
                <IconClose width={14} height={14} />
              </button>
            </div>
          );
        })}
      </div>
      <IconButton label="New tab (Alt+T)" onClick={onNew}>
        <IconPlus />
      </IconButton>
    </div>
  );
});
