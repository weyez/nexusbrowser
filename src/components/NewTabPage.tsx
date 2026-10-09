import { memo, useState } from "react";
import type { Favorite } from "../lib/settings";
import { resolveInput, SEARCH_ENGINES, type SearchEngineId } from "../lib/url";
import { IconClose, IconPlus, IconSearch } from "./Icons";
import { SiteAvatar } from "./ui";

interface Props {
  favorites: Favorite[];
  engine: SearchEngineId;
  onSubmit(input: string): void;
  onOpen(url: string): void;
  onAddFavorite(title: string, url: string): void;
  onRemoveFavorite(id: string): void;
}

export const NewTabPage = memo(function NewTabPage({ favorites, engine, onSubmit, onOpen, onAddFavorite, onRemoveFavorite }: Props) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [formError, setFormError] = useState("");

  const addFavorite = () => {
    const res = resolveInput(newUrl, engine);
    if (!res || res.kind !== "url") {
      setFormError("Enter a valid web address, e.g. example.com");
      return;
    }
    onAddFavorite(newTitle.trim() || new URL(res.url).hostname.replace(/^www\./, ""), res.url);
    setAdding(false);
    setNewTitle("");
    setNewUrl("");
    setFormError("");
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center px-5 pb-10 pt-[12vh]">
        <div className="mb-8 flex items-center gap-3">
          <div className="nx-logo grid size-11 place-items-center rounded-2xl text-lg font-black text-white">N</div>
          <h1 className="text-3xl font-bold tracking-tight">NEXUS</h1>
        </div>
        <form
          role="search"
          className="mb-10 flex h-14 w-full items-center gap-3 rounded-2xl border border-line bg-panel px-4 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(query);
          }}
        >
          <IconSearch className="text-muted" />
          <input
            aria-label="Search or enter address"
            placeholder={`Search ${SEARCH_ENGINES[engine].name} or type a URL`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
        </form>

        <div className="mb-3 flex w-full items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Favorites</h2>
          <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-accent hover:bg-elev pointer-coarse:py-2.5" onClick={() => setEditing((v) => !v)}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>
        <ul className="grid w-full grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {favorites.map((f) => (
            <li key={f.id} className="relative">
              <button
                type="button"
                title={f.url}
                onClick={() => (editing ? undefined : onOpen(f.url))}
                className={`flex w-full flex-col items-center gap-2 rounded-2xl p-3 text-xs hover:bg-elev ${editing ? "nx-wiggle" : ""}`}
              >
                <span className="grid size-14 place-items-center rounded-2xl border border-line bg-panel">
                  <SiteAvatar url={f.url} label={f.title} size={30} />
                </span>
                <span className="w-full truncate text-center">{f.title}</span>
              </button>
              {editing && (
                <button
                  type="button"
                  aria-label={`Remove ${f.title}`}
                  onClick={() => onRemoveFavorite(f.id)}
                  className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-red-500 text-white pointer-coarse:size-9"
                >
                  <IconClose width={14} height={14} />
                </button>
              )}
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setAdding(true)} className="flex w-full flex-col items-center gap-2 rounded-2xl p-3 text-xs text-muted hover:bg-elev">
              <span className="grid size-14 place-items-center rounded-2xl border border-dashed border-line">
                <IconPlus />
              </span>
              <span>Add</span>
            </button>
          </li>
        </ul>

        {adding && (
          <form
            className="mt-4 grid w-full gap-2 rounded-2xl border border-line bg-panel p-4 sm:grid-cols-[1fr_1.5fr_auto_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              addFavorite();
            }}
          >
            <input aria-label="Name" placeholder="Name" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-11 rounded-xl bg-elev px-3 text-base outline-none sm:text-sm" />
            <input
              aria-label="Address"
              placeholder="example.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-11 rounded-xl bg-elev px-3 text-base outline-none sm:text-sm"
            />
            <button type="submit" className="h-11 rounded-xl bg-accent px-4 text-sm font-medium text-white">Save</button>
            <button type="button" className="h-11 rounded-xl bg-elev px-4 text-sm" onClick={() => setAdding(false)}>Cancel</button>
            {formError && <p className="text-sm text-red-500 sm:col-span-4">{formError}</p>}
          </form>
        )}

        <p className="mt-auto max-w-lg pt-12 text-center text-xs leading-relaxed text-muted">
          Some sites don't allow being shown inside other pages. When that happens, NEXUS tells you and offers to open the site in a normal tab.
        </p>
      </div>
    </div>
  );
});
