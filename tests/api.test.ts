import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiHandler } from "../server/api";
import { loadConfig } from "../server/config";
import type { HeaderFetcher } from "../server/embedCheck";

let server: http.Server;
let base = "";
let calls = 0;
const fetcher: HeaderFetcher = async () => {
  calls++;
  return { status: 200, headers: { "x-frame-options": "SAMEORIGIN" } };
};

beforeAll(async () => {
  const handler = createApiHandler({ ...loadConfig({}), ratePerMinute: 5 }, fetcher);
  server = http.createServer((req, res) => void handler(req, res));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("API", () => {
  it("reports health", async () => {
    const r = await fetch(`${base}/api/health`);
    expect(await r.json()).toMatchObject({ ok: true, embedCheck: true });
  });
  it("checks a page and caches the result", async () => {
    const q = `${base}/api/embed-check?url=${encodeURIComponent("https://site.test/")}&origin=https://app.test`;
    const a = await (await fetch(q)).json();
    const b = await (await fetch(q)).json();
    expect(a).toMatchObject({ verdict: "blocked", reason: "x-frame-options" });
    expect(b).toEqual(a);
    expect(calls).toBe(1);
  });
  it("refuses private targets with 422", async () => {
    const r = await fetch(`${base}/api/embed-check?url=${encodeURIComponent("http://10.0.0.1/")}`);
    expect(r.status).toBe(422);
    expect(await r.json()).toMatchObject({ verdict: "unknown", reason: "private-address" });
  });
  it("rejects non-GET methods and unknown routes", async () => {
    expect((await fetch(`${base}/api/health`, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${base}/api/nope`)).status).toBe(404);
  });
  it("rate-limits embed checks", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await fetch(`${base}/api/embed-check?url=https://x${i}.test/`)).status);
    expect(statuses).toContain(429);
  });
});
