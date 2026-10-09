import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig, type ServerConfig } from "./config.js";
import { checkEmbeddable, fetchHeaders, type EmbedResult, type HeaderFetcher } from "./embedCheck.js";
import { TargetError } from "./netGuard.js";

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(body));
}

function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = req.headers["x-forwarded-for"];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "unknown";
}

function resolveAppOrigin(cfg: ServerConfig, param: string | null, req: IncomingMessage): string {
  if (cfg.appOrigin) return cfg.appOrigin;
  if (param) {
    try {
      const u = new URL(param);
      if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
    } catch {
      /* fall through */
    }
  }
  return `http://${req.headers.host ?? "localhost"}`;
}

export function createApiHandler(cfg: ServerConfig = loadConfig(), fetcher: HeaderFetcher = fetchHeaders) {
  const cache = new Map<string, { at: number; result: EmbedResult }>();
  const buckets = new Map<string, { tokens: number; at: number }>();

  function take(ip: string): boolean {
    const now = Date.now();
    const b = buckets.get(ip) ?? { tokens: cfg.ratePerMinute, at: now };
    b.tokens = Math.min(cfg.ratePerMinute, b.tokens + ((now - b.at) / 60000) * cfg.ratePerMinute);
    b.at = now;
    if (b.tokens < 1) {
      buckets.set(ip, b);
      return false;
    }
    b.tokens -= 1;
    buckets.set(ip, b);
    if (buckets.size > 10000) buckets.clear();
    return true;
  }

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method !== "GET") return json(res, 405, { error: "method-not-allowed" });

    if (url.pathname === "/api/health") {
      return json(res, 200, { ok: true, embedCheck: true, allowlist: cfg.allowlist.length > 0 });
    }

    if (url.pathname === "/api/embed-check") {
      if (!take(clientIp(req, cfg.trustProxy))) return json(res, 429, { verdict: "unknown", reason: "rate-limited" });
      const target = url.searchParams.get("url") ?? "";
      const appOrigin = resolveAppOrigin(cfg, url.searchParams.get("origin"), req);
      const key = `${appOrigin} ${target}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) return json(res, 200, hit.result);
      try {
        const result = await checkEmbeddable(target, appOrigin, cfg, fetcher);
        cache.set(key, { at: Date.now(), result });
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
        return json(res, 200, result);
      } catch (err) {
        if (err instanceof TargetError && err.code !== "timeout") {
          return json(res, 422, { verdict: "unknown", reason: err.code, redirects: 0 });
        }
        const reason = err instanceof TargetError ? err.code : "network-error";
        return json(res, 200, { verdict: "unknown", reason, redirects: 0 });
      }
    }

    return json(res, 404, { error: "not-found" });
  };
}
