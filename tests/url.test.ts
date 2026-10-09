import { describe, expect, it } from "vitest";
import { displayUrl, hostnameOf, isMixedContent, resolveInput } from "../src/lib/url";

const r = (s: string) => resolveInput(s, "bing");

describe("resolveInput", () => {
  it("returns null for empty input", () => {
    expect(r("   ")).toBeNull();
  });
  it("adds https:// to bare domains", () => {
    expect(r("example.com")).toEqual({ kind: "url", url: "https://example.com/" });
    expect(r("en.wikipedia.org/wiki/iPad")).toEqual({ kind: "url", url: "https://en.wikipedia.org/wiki/iPad" });
    expect(r("example.co.uk:8443/a?b=1")).toEqual({ kind: "url", url: "https://example.co.uk:8443/a?b=1" });
  });
  it("keeps explicit schemes", () => {
    expect(r("http://example.com")).toEqual({ kind: "url", url: "http://example.com/" });
    expect(r("HTTPS://Example.com/Path")).toEqual({ kind: "url", url: "https://example.com/Path" });
  });
  it("treats localhost and IPs as http", () => {
    expect(r("localhost:3000")).toEqual({ kind: "url", url: "http://localhost:3000/" });
    expect(r("192.168.1.10/admin")).toEqual({ kind: "url", url: "http://192.168.1.10/admin" });
  });
  it("searches for plain words and phrases", () => {
    expect(r("ipad games")).toMatchObject({ kind: "search", url: "https://www.bing.com/search?q=ipad%20games" });
    expect(r("hello")).toMatchObject({ kind: "search" });
    expect(r("1.5")).toMatchObject({ kind: "search" });
    expect(r("what is example.com")).toMatchObject({ kind: "search" });
  });
  it("uses the selected engine", () => {
    expect(resolveInput("cats", "wikipedia")).toMatchObject({ url: "https://en.wikipedia.org/w/index.php?search=cats" });
  });
  it("refuses dangerous or unsupported schemes", () => {
    expect(r("javascript:alert(1)")).toMatchObject({ kind: "invalid" });
    expect(r("data:text/html,hi")).toMatchObject({ kind: "invalid" });
    expect(r("file:///etc/passwd")).toMatchObject({ kind: "invalid" });
  });
});

describe("url helpers", () => {
  it("formats display URLs", () => {
    expect(displayUrl("https://www.example.com/")).toBe("example.com");
    expect(displayUrl("https://example.com/a/b?c=1#d")).toBe("example.com/a/b?c=1#d");
    expect(hostnameOf("https://www.wikipedia.org/x")).toBe("wikipedia.org");
  });
  it("detects mixed content", () => {
    expect(isMixedContent("http://example.com/", "https:")).toBe(true);
    expect(isMixedContent("https://example.com/", "https:")).toBe(false);
    expect(isMixedContent("http://example.com/", "http:")).toBe(false);
    expect(isMixedContent("http://localhost:3000/", "https:")).toBe(false);
  });
});
