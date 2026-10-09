import { memo, useCallback, useEffect, useState } from "react";
import { checkEmbed } from "../lib/embed";
import { hostnameOf, isMixedContent } from "../lib/url";
import { BlockedPage, ErrorPage, openExternally, type ErrorKind } from "./Pages";
import { IconClose, IconExternal } from "./Icons";

export type Phase = "checking" | "loading" | "loaded" | "blocked" | "error" | "stopped";

export interface WebViewApi {
  stop(): void;
}

interface Props {
  tabId: string;
  url: string;
  reloadKey: number;
  active: boolean;
  embedCheck: boolean;
  timeoutSec: number;
  canGoBack: boolean;
  onStatus(id: string, phase: Phase): void;
  onBack(id: string): void;
  onReload(id: string): void;
  register(id: string, api: WebViewApi | null): void;
}

function preflight(url: string): ErrorKind | null {
  if (isMixedContent(url, location.protocol)) return "mixed-content";
  try {
    if (new URL(url).origin === location.origin) return "self";
  } catch {
    /* ignore */
  }
  if (!navigator.onLine) return "offline";
  return null;
}

const SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-pointer-lock allow-downloads allow-orientation-lock allow-presentation";
const ALLOW = "fullscreen; autoplay; gamepad; clipboard-write; encrypted-media; picture-in-picture";

export const WebView = memo(function WebView(props: Props) {
  const { tabId, url, reloadKey, active, embedCheck, timeoutSec, canGoBack, onStatus, onBack, onReload, register } = props;
  const loadKey = `${reloadKey}|${url}`;
  const [phase, setPhase] = useState<Phase>("checking");
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>("offline");
  const [blockReason, setBlockReason] = useState("");
  const [forcedKey, setForcedKey] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [dismissedSlow, setDismissedSlow] = useState(false);
  const [retry, setRetry] = useState(0);
  const forced = forcedKey === loadKey;

  // Decide how to load the URL: preflight checks, then optional server-side embed check, then iframe.
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    setSlow(false);
    setDismissedSlow(false);
    setFrameSrc(null);
    const problem = preflight(url);
    if (problem) {
      setErrorKind(problem);
      setPhase("error");
      return;
    }
    if (!embedCheck || forced) {
      setPhase("loading");
      setFrameSrc(url);
      return;
    }
    setPhase("checking");
    checkEmbed(url, ac.signal).then((v) => {
      if (cancelled) return;
      if (v.finalUrl && isMixedContent(v.finalUrl, location.protocol)) {
        // e.g. https://site → redirects to http://site: the browser would silently block it.
        setErrorKind("mixed-content");
        setPhase("error");
      } else if (v.verdict === "blocked") {
        setBlockReason(v.reason);
        setPhase("blocked");
      } else {
        setPhase("loading");
        setFrameSrc(url);
      }
    });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [url, loadKey, embedCheck, forced, retry]);

  // Auto-retry after reconnecting.
  useEffect(() => {
    if (phase !== "error" || errorKind !== "offline") return;
    const onOnline = () => setRetry((n) => n + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [phase, errorKind]);

  // Real timeout: iframe 'load' never fired within the limit.
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setTimeout(() => setSlow(true), timeoutSec * 1000);
    return () => clearTimeout(t);
  }, [phase, timeoutSec, loadKey]);

  useEffect(() => onStatus(tabId, phase), [tabId, phase, onStatus]);

  const stop = useCallback(() => {
    setPhase((p) => {
      if (p !== "checking" && p !== "loading") return p;
      setFrameSrc(null);
      return "stopped";
    });
  }, []);
  useEffect(() => {
    register(tabId, { stop });
    return () => register(tabId, null);
  }, [tabId, stop, register]);

  return (
    <div className={`absolute inset-0 bg-bg ${active ? "" : "invisible pointer-events-none"}`} aria-hidden={!active} inert={!active}>
      {frameSrc && (
        <iframe
          key={loadKey}
          title={hostnameOf(url)}
          src={frameSrc}
          className="h-full w-full border-0 bg-white"
          sandbox={SANDBOX}
          allow={ALLOW}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => {
            setPhase((p) => (p === "loading" || p === "loaded" ? "loaded" : p));
            setSlow(false);
          }}
        />
      )}
      {phase === "checking" && <div className="absolute inset-0 grid place-items-center text-sm text-muted">Connecting to {hostnameOf(url)}…</div>}
      {phase === "blocked" && <BlockedPage url={url} reason={blockReason} canGoBack={canGoBack} onBack={() => onBack(tabId)} onTryAnyway={() => setForcedKey(loadKey)} />}
      {phase === "error" && <ErrorPage kind={errorKind} url={url} onRetry={() => setRetry((n) => n + 1)} />}
      {phase === "stopped" && <ErrorPage kind="stopped" url={url} onRetry={() => onReload(tabId)} />}
      {slow && !dismissedSlow && phase === "loading" && (
        <div role="status" className="absolute inset-x-3 bottom-3 mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-line bg-panel/95 p-3 text-sm shadow-xl backdrop-blur">
          <span className="min-w-0 flex-1">
            {hostnameOf(url)} is taking a long time. It may be slow, or it may refuse to load inside other pages.
          </span>
          <button type="button" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 font-medium text-white" onClick={() => openExternally(url)}>
            <IconExternal width={15} height={15} /> Open
          </button>
          <button type="button" aria-label="Dismiss" className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-elev" onClick={() => setDismissedSlow(true)}>
            <IconClose width={15} height={15} />
          </button>
        </div>
      )}
    </div>
  );
});
