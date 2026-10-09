export interface EmbedVerdict {
  verdict: "allowed" | "blocked" | "unknown";
  reason: string;
  finalUrl?: string;
}

let health: Promise<boolean> | null = null;

/** The embed-check API only exists when the Node backend is deployed. Static hosting falls back gracefully. */
export function backendAvailable(): Promise<boolean> {
  health ??= fetch("/api/health", { cache: "no-store" })
    .then(async (r) => r.ok && (r.headers.get("content-type") ?? "").includes("application/json") && (await r.json()).embedCheck === true)
    .catch(() => false);
  return health;
}

const cache = new Map<string, { at: number; v: EmbedVerdict }>();
const TTL = 5 * 60 * 1000;

export async function checkEmbed(url: string, signal: AbortSignal): Promise<EmbedVerdict> {
  if (!(await backendAvailable())) return { verdict: "unknown", reason: "no-backend" };
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  signal.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ac.abort(), 9000);
  try {
    const qs = new URLSearchParams({ url, origin: location.origin });
    const r = await fetch(`/api/embed-check?${qs}`, { signal: ac.signal, cache: "no-store" });
    const data = (await r.json()) as Partial<EmbedVerdict>;
    const v: EmbedVerdict = {
      verdict: data.verdict === "allowed" || data.verdict === "blocked" ? data.verdict : "unknown",
      reason: typeof data.reason === "string" ? data.reason : "unknown",
      finalUrl: typeof data.finalUrl === "string" ? data.finalUrl : undefined,
    };
    if (v.verdict !== "unknown") cache.set(url, { at: Date.now(), v });
    return v;
  } catch {
    return { verdict: "unknown", reason: signal.aborted ? "aborted" : "check-failed" };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}
