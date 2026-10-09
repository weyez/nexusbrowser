import type { IncomingHttpHeaders } from "node:http";

export interface FramePolicy {
  allowed: boolean;
  reason: "ok" | "x-frame-options" | "csp-frame-ancestors";
}

function headerValues(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function defaultPort(protocol: string): string {
  return protocol === "https:" ? "443" : protocol === "http:" ? "80" : "";
}

/** Does a single CSP source expression match the embedding (ancestor) origin? */
export function matchSource(source: string, ancestor: URL, targetOrigin: string): boolean {
  const s = source.trim();
  const lower = s.toLowerCase();
  if (lower === "*") return ancestor.protocol === "http:" || ancestor.protocol === "https:";
  if (lower === "'self'") return ancestor.origin === targetOrigin;
  if (lower.startsWith("'")) return false; // 'none', nonces, hashes: never match an ancestor
  if (/^[a-z][a-z0-9+.-]*:$/.test(lower)) {
    // scheme-source; "http:" also matches https (secure upgrade)
    return lower === ancestor.protocol || (lower === "http:" && ancestor.protocol === "https:");
  }
  const m = lower.match(/^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*|(?:\*\.)?[a-z0-9.-]+)(?::(\*|\d+))?(?:\/.*)?$/);
  if (!m) return false;
  const [, scheme, host, port] = m;
  if (scheme) {
    const ok = `${scheme}:` === ancestor.protocol || (scheme === "http" && ancestor.protocol === "https:");
    if (!ok) return false;
  } else if (ancestor.protocol !== "http:" && ancestor.protocol !== "https:") {
    return false;
  }
  const ancestorHost = ancestor.hostname.toLowerCase();
  if (host === "*") {
    // bare "*" handled above; "*" with scheme/port matches any host
  } else if (host.startsWith("*.")) {
    if (!ancestorHost.endsWith(host.slice(1))) return false;
  } else if (host !== ancestorHost) {
    return false;
  }
  const ancestorPort = ancestor.port || defaultPort(ancestor.protocol);
  if (port === "*") return true;
  if (port) return port === ancestorPort;
  const expected = scheme ? defaultPort(`${scheme}:`) : defaultPort(ancestor.protocol);
  // without a scheme, http default port 80 also matches upgraded https 443
  return ancestorPort === expected || (!scheme && ancestor.protocol === "https:" && ancestorPort === "443");
}

/**
 * Decide whether a response would be displayed inside a frame on `appOrigin`.
 * CSP frame-ancestors (if present) takes precedence over X-Frame-Options, matching browser behaviour.
 */
export function evaluateFramePolicy(headers: IncomingHttpHeaders, appOrigin: string, targetOrigin: string): FramePolicy {
  const ancestor = new URL(appOrigin);
  const policies = headerValues(headers["content-security-policy"]).flatMap((h) => h.split(","));
  let sawFrameAncestors = false;
  for (const policy of policies) {
    for (const directive of policy.split(";")) {
      const tokens = directive.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0 || tokens[0].toLowerCase() !== "frame-ancestors") continue;
      sawFrameAncestors = true;
      const sources = tokens.slice(1);
      if (!sources.some((src) => matchSource(src, ancestor, targetOrigin))) {
        return { allowed: false, reason: "csp-frame-ancestors" };
      }
      break; // only the first frame-ancestors directive in a policy counts
    }
  }
  if (sawFrameAncestors) return { allowed: true, reason: "ok" };

  const xfo = headerValues(headers["x-frame-options"])
    .flatMap((h) => h.split(","))
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (xfo.includes("deny")) return { allowed: false, reason: "x-frame-options" };
  if (xfo.includes("sameorigin") && ancestor.origin !== targetOrigin) return { allowed: false, reason: "x-frame-options" };
  // ALLOW-FROM and invalid values are ignored by modern browsers.
  return { allowed: true, reason: "ok" };
}
