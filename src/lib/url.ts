export type SearchEngineId = "duckduckgo" | "bing" | "google" | "startpage" | "wikipedia";

/** `embeds`: whether result pages were verified to allow display inside NEXUS (checked Oct 2026; sites can change). */
export const SEARCH_ENGINES: Record<SearchEngineId, { name: string; embeds: boolean; build: (q: string) => string }> = {
  bing: { name: "Bing", embeds: true, build: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  wikipedia: { name: "Wikipedia", embeds: true, build: (q) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` },
  duckduckgo: { name: "DuckDuckGo", embeds: false, build: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  google: { name: "Google", embeds: false, build: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  startpage: { name: "Startpage", embeds: false, build: (q) => `https://www.startpage.com/do/search?q=${encodeURIComponent(q)}` },
};

export type ResolveResult =
  | { kind: "url"; url: string }
  | { kind: "search"; url: string; query: string }
  | { kind: "invalid"; reason: string };

const DOMAIN_RE =
  /^(?:[a-z0-9\u00a1-\uffff](?:[a-z0-9\u00a1-\uffff-]{0,61}[a-z0-9\u00a1-\uffff])?\.)+(?:[a-z\u00a1-\uffff]{2,63}|xn--[a-z0-9-]{1,59})\.?(?::\d{1,5})?(?:[/?#].*)?$/i;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}(?::\d{1,5})?(?:[/?#].*)?$/;
const LOCAL_RE = /^(?:localhost|\[[0-9a-f:.]+\])(?::\d{1,5})?(?:[/?#].*)?$/i;
const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;

function parseHttp(candidate: string): string | null {
  try {
    const u = new URL(candidate);
    if ((u.protocol === "http:" || u.protocol === "https:") && u.hostname) return u.href;
  } catch {
    /* not a URL */
  }
  return null;
}

/** Turn address-bar input into a URL to open or a search, like a real browser omnibox. */
export function resolveInput(input: string, engine: SearchEngineId): ResolveResult | null {
  const text = input.trim();
  if (!text) return null;
  const search = (): ResolveResult => ({ kind: "search", query: text, url: SEARCH_ENGINES[engine].build(text) });

  if (/^https?:\/\//i.test(text)) {
    const url = parseHttp(text.replace(/\s/g, "%20"));
    return url ? { kind: "url", url } : search();
  }
  if (/\s/.test(text)) return search();

  if (LOCAL_RE.test(text) || IPV4_RE.test(text)) {
    const url = parseHttp(`http://${text}`);
    if (url) return { kind: "url", url };
  }
  if (DOMAIN_RE.test(text)) {
    const url = parseHttp(`https://${text}`);
    if (url) return { kind: "url", url };
  }
  const scheme = text.match(SCHEME_RE)?.[1]?.toLowerCase();
  if (scheme && !/^\d+$/.test(text.slice(scheme.length + 1, scheme.length + 2) || "x")) {
    return { kind: "invalid", reason: `"${scheme}:" addresses can't be opened in NEXUS.` };
  }
  return search();
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Compact URL for display when the address bar is not focused. */
export function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.host.replace(/^www\./, "")}${path}${u.search}${u.hash}`;
  } catch {
    return url;
  }
}

export function isSecureUrl(url: string): boolean {
  return url.startsWith("https://");
}

/** An http:// page inside an https:// app is blocked by every browser (mixed content). */
export function isMixedContent(url: string, pageProtocol: string): boolean {
  if (pageProtocol !== "https:" || !url.startsWith("http://")) return false;
  const host = hostnameOf(url);
  return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
}
