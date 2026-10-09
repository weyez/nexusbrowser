import { describe, expect, it } from "vitest";
import { checkEmbeddable, type HeaderFetcher } from "../server/embedCheck";

const opts = { allowlist: [], checkTimeoutMs: 1000, maxRedirects: 3 };
const APP = "https://nexus.example.com";

function fake(routes: Record<string, { status: number; headers?: Record<string, string> }>): HeaderFetcher {
  return async (url) => {
    const r = routes[url.href];
    if (!r) throw new Error(`unexpected request ${url.href}`);
    return { status: r.status, headers: r.headers ?? {} };
  };
}

describe("checkEmbeddable", () => {
  it("reports allowed and blocked pages", async () => {
    const f = fake({ "https://ok.test/": { status: 200 }, "https://no.test/": { status: 200, headers: { "x-frame-options": "DENY" } } });
    await expect(checkEmbeddable("https://ok.test/", APP, opts, f)).resolves.toMatchObject({ verdict: "allowed" });
    await expect(checkEmbeddable("https://no.test/", APP, opts, f)).resolves.toMatchObject({ verdict: "blocked", reason: "x-frame-options" });
  });

  it("follows redirects and judges the final response", async () => {
    const f = fake({
      "https://a.test/": { status: 301, headers: { location: "/b" } },
      "https://a.test/b": { status: 302, headers: { location: "https://c.test/" } },
      "https://c.test/": { status: 200, headers: { "content-security-policy": "frame-ancestors 'none'" } },
    });
    await expect(checkEmbeddable("https://a.test/", APP, opts, f)).resolves.toMatchObject({ verdict: "blocked", redirects: 2, finalUrl: "https://c.test/" });
  });

  it("re-validates every redirect hop (no SSRF via redirect)", async () => {
    const f = fake({ "https://evil.test/": { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } } });
    await expect(checkEmbeddable("https://evil.test/", APP, opts, f)).rejects.toMatchObject({ code: "private-address" });
  });

  it("stops after too many redirects", async () => {
    const f: HeaderFetcher = async (url) => ({ status: 302, headers: { location: `${url.href}x` } });
    await expect(checkEmbeddable("https://loop.test/", APP, opts, f)).resolves.toMatchObject({ verdict: "unknown", reason: "too-many-redirects" });
  });
});
