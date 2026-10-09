import { BlockList, isIP } from "node:net";
import dns from "node:dns";
import type { LookupAddress } from "node:dns";

/** Error thrown when a target URL is not allowed to be contacted. */
export class TargetError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "TargetError";
  }
}

// Separate lists: Node's BlockList matches IPv4 addresses against IPv6 ::ffff:0:0/96 rules,
// so mixing families in one list would block every IPv4 address.
const blocked4 = new BlockList();
const blocked6 = new BlockList();
const mapped6 = new BlockList(); // IPv4-mapped / NAT64 ranges that embed an IPv4 address
const V4: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];
const V6: Array<[string, number]> = [
  ["::", 128], ["::1", 128], ["64:ff9b:1::", 48],
  ["100::", 64], ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7],
  ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
];
for (const [net, prefix] of V4) blocked4.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of V6) blocked6.addSubnet(net, prefix, "ipv6");
mapped6.addSubnet("::ffff:0:0", 96, "ipv6");
mapped6.addSubnet("64:ff9b::", 96, "ipv6");

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".intranet", ".lan", ".home", ".corp", ".home.arpa", ".in-addr.arpa", ".ip6.arpa"];

/** True if the IP address is private, loopback, link-local, reserved, or otherwise non-public. */
export function isBlockedAddress(ip: string): boolean {
  const addr = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const family = isIP(addr);
  if (family === 0) return true;
  if (family === 4) return blocked4.check(addr, "ipv4");
  // IPv4-mapped / NAT64 forms carry an embedded IPv4 address: judge that address.
  const dotted = addr.match(/^(?:::ffff:|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return blocked4.check(dotted[1], "ipv4");
  const hex = addr.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const a = parseInt(hex[1], 16);
    const b = parseInt(hex[2], 16);
    return blocked4.check(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`, "ipv4");
  }
  if (mapped6.check(addr, "ipv6")) return true; // embedded IPv4 in an unrecognised notation: refuse
  return blocked6.check(addr, "ipv6");
}

export function isAllowedHost(host: string, allowlist: string[]): boolean {
  return allowlist.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Validate a URL before any network access. Returns the parsed URL or throws TargetError. */
export function validateTarget(raw: string, allowlist: string[] = []): URL {
  if (typeof raw !== "string" || raw.length === 0) throw new TargetError("missing-url", "URL is required");
  if (raw.length > 2048) throw new TargetError("url-too-long", "URL is too long");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TargetError("invalid-url", "URL is not valid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new TargetError("bad-scheme", "Only http and https are allowed");
  if (url.username || url.password) throw new TargetError("credentials", "URLs with credentials are not allowed");
  if (url.port !== "") throw new TargetError("bad-port", "Only default ports (80/443) are allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new TargetError("private-address", "Private or reserved addresses are not allowed");
  } else if (!host.includes(".") || host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new TargetError("internal-host", "Internal host names are not allowed");
  }
  if (allowlist.length > 0 && !isAllowedHost(host, allowlist)) {
    throw new TargetError("not-allowlisted", "Domain is not in the allowlist");
  }
  return url;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * DNS lookup used for every outgoing socket. All resolved addresses must be public;
 * validation happens at connect time, which defeats DNS-rebinding (no TOCTOU gap).
 */
export function safeLookup(hostname: string, options: dns.LookupOptions | number | LookupCallback, callback?: LookupCallback): void {
  const cb = (typeof options === "function" ? options : callback) as LookupCallback;
  const wantAll = typeof options === "object" && options !== null && options.all === true;
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return cb(err, wantAll ? [] : "");
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
      const e = new TargetError("private-address", `Refusing to connect to non-public address for ${hostname}`) as unknown as NodeJS.ErrnoException;
      e.code = "EBLOCKED";
      return cb(e, wantAll ? [] : "");
    }
    if (wantAll) return cb(null, addresses);
    cb(null, addresses[0].address, addresses[0].family);
  });
}
