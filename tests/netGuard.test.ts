import { describe, expect, it } from "vitest";
import { isBlockedAddress, safeLookup, validateTarget } from "../server/netGuard";

describe("isBlockedAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "64:ff9b::a00:1", "not-an-ip"])(
    "blocks %s",
    (ip) => expect(isBlockedAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "208.80.154.224", "1.1.1.1", "2620:0:861:ed1a::1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows public %s", (ip) =>
    expect(isBlockedAddress(ip)).toBe(false),
  );
});

describe("validateTarget", () => {
  const bad = (url: string, code: string) => expect(() => validateTarget(url)).toThrow(expect.objectContaining({ code }));
  it("accepts normal public URLs", () => {
    expect(validateTarget("https://en.wikipedia.org/wiki/X").hostname).toBe("en.wikipedia.org");
  });
  it("rejects unsafe targets", () => {
    bad("", "missing-url");
    bad("not a url", "invalid-url");
    bad("ftp://example.com/", "bad-scheme");
    bad("file:///etc/passwd", "bad-scheme");
    bad("https://user:pass@example.com/", "credentials");
    bad("https://example.com:8080/", "bad-port");
    bad("http://127.0.0.1/", "private-address");
    bad("http://2130706433/", "private-address");
    bad("http://0x7f.1/", "private-address");
    bad("http://[::1]/", "private-address");
    bad("http://[::ffff:169.254.169.254]/", "private-address");
    bad("http://169.254.169.254/latest/meta-data", "private-address");
    bad("http://localhost/", "internal-host");
    bad("http://metadata.google.internal/", "internal-host");
    bad("http://printer.local/", "internal-host");
    bad("http://intranet/", "internal-host");
    bad(`https://example.com/${"a".repeat(2100)}`, "url-too-long");
  });
  it("enforces the allowlist including subdomains", () => {
    expect(validateTarget("https://en.wikipedia.org/", ["wikipedia.org"]).hostname).toBe("en.wikipedia.org");
    expect(() => validateTarget("https://evilwikipedia.org/", ["wikipedia.org"])).toThrow(expect.objectContaining({ code: "not-allowlisted" }));
  });
});

describe("safeLookup", () => {
  it("refuses hostnames that resolve to loopback (DNS rebinding defence)", async () => {
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => safeLookup("localhost", { all: true }, (e) => resolve(e)));
    expect(err?.code).toBe("EBLOCKED");
  });
});
