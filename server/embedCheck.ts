import http from "node:http";
import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import { safeLookup, TargetError, validateTarget } from "./netGuard.js";
import { evaluateFramePolicy } from "./frameCheck.js";

export interface EmbedResult {
  verdict: "allowed" | "blocked" | "unknown";
  reason: string;
  status?: number;
  finalUrl?: string;
  redirects: number;
}

export interface HeaderResponse {
  status: number;
  headers: IncomingHttpHeaders;
}

export type HeaderFetcher = (url: URL, timeoutMs: number) => Promise<HeaderResponse>;

/** Fetch only status + headers. The body is never read or returned. */
export const fetchHeaders: HeaderFetcher = (url, timeoutMs) =>
  new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        agent: false,
        lookup: safeLookup as unknown as http.RequestOptions["lookup"],
        timeout: timeoutMs,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; NexusBrowser-EmbedCheck/1.0)",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "accept-encoding": "identity",
        },
      },
      (res) => {
        clearTimeout(deadline);
        resolve({ status: res.statusCode ?? 0, headers: res.headers });
        res.destroy();
      },
    );
    const deadline = setTimeout(() => req.destroy(new TargetError("timeout", "Request timed out")), timeoutMs);
    req.on("timeout", () => req.destroy(new TargetError("timeout", "Request timed out")));
    req.on("error", (err) => {
      clearTimeout(deadline);
      reject(err);
    });
    req.end();
  });

export interface CheckOptions {
  allowlist: string[];
  checkTimeoutMs: number;
  maxRedirects: number;
}

export async function checkEmbeddable(
  raw: string,
  appOrigin: string,
  opts: CheckOptions,
  fetcher: HeaderFetcher = fetchHeaders,
): Promise<EmbedResult> {
  let url = validateTarget(raw, opts.allowlist);
  for (let redirects = 0; ; redirects++) {
    const { status, headers } = await fetcher(url, opts.checkTimeoutMs);
    const location = headers.location;
    if (status >= 300 && status < 400 && typeof location === "string") {
      if (redirects >= opts.maxRedirects) return { verdict: "unknown", reason: "too-many-redirects", status, finalUrl: url.href, redirects };
      url = validateTarget(new URL(location, url).href, opts.allowlist); // every hop is re-validated
      continue;
    }
    const policy = evaluateFramePolicy(headers, appOrigin, url.origin);
    return { verdict: policy.allowed ? "allowed" : "blocked", reason: policy.reason, status, finalUrl: url.href, redirects };
  }
}
