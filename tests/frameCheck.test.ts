import { describe, expect, it } from "vitest";
import { evaluateFramePolicy } from "../server/frameCheck";

const APP = "https://nexus.example.com";
const T = "https://site.test";
const ev = (h: Record<string, string | string[]>) => evaluateFramePolicy(h, APP, T);

describe("evaluateFramePolicy", () => {
  it("allows when no framing headers are present", () => {
    expect(ev({})).toEqual({ allowed: true, reason: "ok" });
  });
  it("blocks X-Frame-Options DENY and SAMEORIGIN", () => {
    expect(ev({ "x-frame-options": "DENY" }).allowed).toBe(false);
    expect(ev({ "x-frame-options": "sameorigin" })).toEqual({ allowed: false, reason: "x-frame-options" });
    expect(evaluateFramePolicy({ "x-frame-options": "SAMEORIGIN" }, T, T).allowed).toBe(true);
  });
  it("ignores obsolete ALLOW-FROM like browsers do", () => {
    expect(ev({ "x-frame-options": "ALLOW-FROM https://x.test" }).allowed).toBe(true);
  });
  it("handles CSP frame-ancestors sources", () => {
    expect(ev({ "content-security-policy": "frame-ancestors 'none'" }).allowed).toBe(false);
    expect(ev({ "content-security-policy": "frame-ancestors 'self'" }).allowed).toBe(false);
    expect(ev({ "content-security-policy": "frame-ancestors *" }).allowed).toBe(true);
    expect(ev({ "content-security-policy": "frame-ancestors https:" }).allowed).toBe(true);
    expect(ev({ "content-security-policy": "frame-ancestors https://*.example.com" }).allowed).toBe(true);
    expect(ev({ "content-security-policy": "frame-ancestors nexus.example.com" }).allowed).toBe(true);
    expect(ev({ "content-security-policy": "frame-ancestors https://other.com https://nexus.example.com:443" }).allowed).toBe(true);
    expect(ev({ "content-security-policy": "frame-ancestors https://nexus.example.com:8443" }).allowed).toBe(false);
    expect(ev({ "content-security-policy": "frame-ancestors *.other.com" }).allowed).toBe(false);
  });
  it("lets CSP frame-ancestors override X-Frame-Options", () => {
    expect(ev({ "content-security-policy": "default-src 'self'; frame-ancestors *", "x-frame-options": "DENY" }).allowed).toBe(true);
  });
  it("requires every policy to allow framing", () => {
    expect(ev({ "content-security-policy": ["frame-ancestors *", "frame-ancestors 'none'"] }).allowed).toBe(false);
    expect(ev({ "content-security-policy": "frame-ancestors *, frame-ancestors https://other.com" }).allowed).toBe(false);
  });
  it("ignores CSP without frame-ancestors", () => {
    expect(ev({ "content-security-policy": "default-src 'none'" }).allowed).toBe(true);
  });
});
