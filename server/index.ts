import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createApiHandler } from "./api.js";

const cfg = loadConfig();
const api = createApiHandler(cfg);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-src http: https:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; "),
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  let file = path.normalize(path.join(root, pathname));
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(pathname)) {
      res.writeHead(404, SECURITY_HEADERS).end("Not found");
      return;
    }
    file = path.join(root, "index.html"); // SPA fallback
  }
  const ext = path.extname(file);
  const cache = pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache";
  res.writeHead(200, { ...SECURITY_HEADERS, "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": cache });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api/")) {
    api(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    return;
  }
  serveStatic(req, res);
});

server.headersTimeout = 10000;
server.requestTimeout = 15000;
server.listen(cfg.port, cfg.host, () => {
  console.log(`NEXUS BROWSER running on http://${cfg.host}:${cfg.port}`);
  if (cfg.allowlist.length) console.log(`Embed-check allowlist: ${cfg.allowlist.join(", ")}`);
});
