import { memo, useMemo, useState } from "react";
import type { RefObject } from "react";
import type { Favorite } from "../lib/settings";
import { displayUrl, isSecureUrl, resolveInput, SEARCH_ENGINES, type SearchEngineId } from "../lib/url";
import { IconGlobe, IconLock, IconSearch } from "./Icons";
import { SiteAvatar } from "./ui";

interface Props {
  url: string;
  engine: SearchEngineId;
  favorites: Favorite[];
  recent: string[];
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit(input: string): void;
}

interface Suggestion {
  key: string;
  label: string;
  sub?: string;
  value: string;
  kind: "go" | "search" | "site";
}

export const AddressBar = memo(function AddressBar({ url, engine, favorites, recent, inputRef, onSubmit }: Props) {
  const [focused, setFocused] = useState(false);
  const [value, setValue] = useState("");
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo<Suggestion[]>(() => {
    const text = value.trim();
    if (!focused || !text) return [];
    const list: Suggestion[] = [];
    const res = resolveInput(text, engine);
    if (res?.kind === "url") list.push({ key: "go", kind: "go", label: displayUrl(res.url), sub: "Open address", value: res.url });
    list.push({ key: "search", kind: "search", label: text, sub: `Search ${SEARCH_ENGINES[engine].name}`, value: SEARCH_ENGINES[engine].build(text) });
    const needle = text.toLowerCase();
    const seen = new Set(list.map((s) => s.value));
    const candidates = [...favorites.map((f) => ({ label: f.title, url: f.url })), ...recent.map((u) => ({ label: displayUrl(u), url: u }))];
    for (const c of candidates) {
      if (list.length >= 7) break;
      if (seen.has(c.url) || !(c.label.toLowerCase().includes(needle) || c.url.toLowerCase().includes(needle))) continue;
      seen.add(c.url);
      list.push({ key: c.url, kind: "site", label: c.label, sub: displayUrl(c.url), value: c.url });
    }
    return list;
  }, [value, focused, engine, favorites, recent]);

  const commit = (input: string) => {
    onSubmit(input);
    inputRef.current?.blur();
  };

  return (
    <div className="relative min-w-0 flex-1">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const s = suggestions[highlight];
          commit(s && highlight > 0 ? s.value : value);
        }}
        className={`flex h-9 items-center gap-2 rounded-xl border bg-elev px-3 transition-colors pointer-coarse:h-11 ${focused ? "border-accent ring-2 ring-accent/25" : "border-transparent"}`}
      >
        <span className="text-muted">{focused ? <IconSearch width={16} height={16} /> : url && isSecureUrl(url) ? <IconLock width={15} height={15} /> : <IconGlobe width={16} height={16} />}</span>
        <input
          ref={inputRef}
          type="text"
          aria-label="Address and search bar"
          placeholder="Search or enter address"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted sm:text-sm"
          value={focused ? value : url ? displayUrl(url) : ""}
          onChange={(e) => {
            setValue(e.target.value);
            setHighlight(0);
          }}
          onFocus={(e) => {
            setFocused(true);
            setValue(url);
            setHighlight(0);
            const el = e.currentTarget;
            setTimeout(() => el.setSelectionRange(0, el.value.length), 0);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && suggestions.length) {
              e.preventDefault();
              setHighlight((h) => (h + 1) % suggestions.length);
            } else if (e.key === "ArrowUp" && suggestions.length) {
              e.preventDefault();
              setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Escape") {
              e.stopPropagation();
              setValue(url);
              e.currentTarget.blur();
            }
          }}
        />
      </form>
      {suggestions.length > 0 && (
        <ul role="listbox" aria-label="Suggestions" className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-2xl">
          {suggestions.map((s, i) => (
            <li key={s.key} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => commit(s.value)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm pointer-coarse:py-3 ${i === highlight ? "bg-elev" : "hover:bg-elev"}`}
              >
                {s.kind === "search" ? <IconSearch width={16} height={16} className="text-muted" /> : <SiteAvatar url={s.value} size={16} />}
                <span className="truncate">{s.label}</span>
                {s.sub && <span className="ml-auto shrink-0 truncate pl-2 text-xs text-muted">{s.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
