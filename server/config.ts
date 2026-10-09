export interface ServerConfig {
  port: number;
  host: string;
  appOrigin: string | null;
  allowlist: string[];
  checkTimeoutMs: number;
  maxRedirects: number;
  ratePerMinute: number;
  trustProxy: boolean;
}

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function origin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: int(env.PORT, 8787, 1, 65535),
    host: env.HOST || "0.0.0.0",
    appOrigin: origin(env.APP_ORIGIN),
    allowlist: (env.EMBED_CHECK_ALLOWLIST ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase().replace(/^\*?\./, "").replace(/\.$/, ""))
      .filter(Boolean),
    checkTimeoutMs: int(env.EMBED_CHECK_TIMEOUT_MS, 6000, 1000, 20000),
    maxRedirects: int(env.EMBED_CHECK_MAX_REDIRECTS, 5, 0, 10),
    ratePerMinute: int(env.EMBED_CHECK_RATE_PER_MINUTE, 60, 1, 10000),
    trustProxy: env.TRUST_PROXY === "true",
  };
}
