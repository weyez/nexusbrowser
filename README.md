# NEXUS Browser

A browser-inside-a-browser web app built for iPad and Safari: tabs, an address bar with search, per-tab history, favorites, light and dark themes, full screen, and PWA install. Pages load for real in sandboxed iframes. A small Node backend checks ahead of time whether a site allows being embedded, so users see a clear message instead of a blank frame.

## Architecture

```
React + TypeScript (Vite, Tailwind v4)          Node.js (no framework)
┌───────────────────────────────────┐           ┌──────────────────────────────┐
│ TabBar · Toolbar · AddressBar     │  GET      │ /api/health                  │
│ WebView (sandboxed <iframe>)      │ ───────▶  │ /api/embed-check?url=…       │
│ NewTabPage · SettingsPanel        │  verdict  │  ├ validateTarget (SSRF)     │
│ localStorage: tabs/settings/favs  │ ◀───────  │  ├ safeLookup (DNS pinning)  │
│ Service worker: app shell only    │           │  └ headers only, body ignored│
└───────────────────────────────────┘           └──────────────────────────────┘
              │ iframe loads the site directly from the user's browser
              ▼
        third-party website
```

**Why there's no rewriting proxy:** Most sites send `X-Frame-Options` or CSP `frame-ancestors` to block embedding. The only way to "make every site work" is a proxy that removes those headers and rewrites pages. That would (a) disable sites' clickjacking protection, (b) pass users' logins and cookies through a third-party server, and (c) work as a network-filter bypass. All three conflict with the project's security requirements. NEXUS respects each site's choice and offers **Open in a normal tab** instead.

**What the backend does:** For each URL, it sends one GET request and reads only the status and headers. It follows up to 5 redirects and checks every hop, then evaluates `X-Frame-Options` and CSP `frame-ancestors` the way browsers do. It never returns page content.

SSRF protections:
- Only http and https URLs on the default ports. URLs with embedded credentials are rejected.
- Rejects loopback, private, link-local, CGNAT, multicast, reserved, IPv4-mapped and NAT64 addresses. This includes encodings like `2130706433` and `0x7f.1`.
- Rejects internal host names such as `localhost`, `*.local`, `*.internal` and single-label names.
- Checks DNS results at connect time (`lookup` hook), which blocks DNS rebinding.
- Optional domain allowlist (`EMBED_CHECK_ALLOWLIST`), plus timeouts, per-IP rate limiting and a result cache.

## Requirements

Node.js 22 or newer.

## Commands

```bash
npm install
npm run dev          # http://localhost:5173 — UI + API in one process
npm test             # unit tests (Vitest)
npm run build        # typecheck + client build (dist/) + server build (dist-server/)
npm start            # production server: http://localhost:8787 (static app + API)

# End-to-end tests (Playwright; desktop + iPad viewport projects)
npx playwright install chromium     # or: CHROMIUM_PATH=/path/to/chromium
npm run test:e2e
PW_WEBKIT=1 npm run test:e2e        # also run the iPad project in WebKit (Safari engine), where supported
```

Copy `.env.example` to `.env` to configure the production server.

## Deployment

**Recommended: one Node service** (Render, Railway, Fly.io, a VPS, or Docker):

1. Build command: `npm ci && npm run build`
2. Start command: `npm start`
3. Set `PORT` and `APP_ORIGIN=https://your-domain`. Set `EMBED_CHECK_ALLOWLIST` if you want to restrict which domains the backend contacts.
4. Serve over **HTTPS**. Safari needs it for PWA install, and it lets HTTPS sites embed without mixed-content errors.
5. Behind a reverse proxy, set `TRUST_PROXY=true` so rate limiting uses the client IP.

Minimal Dockerfile:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
ENV PORT=8787
EXPOSE 8787
CMD ["node", "dist-server/server/index.js"]
```

**Static-only hosting** (Netlify, Vercel static, GitHub Pages): deploy `dist/`. The app detects that `/api` is missing and turns off the embed check. Sites still load. Blocked sites show the browser's own error instead of the NEXUS explanation, and a slow-load banner still offers "Open".

**Install on iPad:** open the site in Safari → Share → **Add to Home Screen**.

## Keyboard shortcuts

Browsers reserve Ctrl/⌘+T, W and N, so tab shortcuts use **Alt (⌥)**:

| Keys | Action |
| --- | --- |
| Alt+T / Alt+W | New / close tab |
| Alt+[ / Alt+] | Previous / next tab |
| Alt+1…9 | Go to tab (9 = last) |
| Alt+← / Alt+→ | Back / forward |
| Ctrl/⌘+L | Focus the address bar |
| Ctrl/⌘+R, F5 | Reload |
| Alt+H | Home (new tab page) |
| Alt+F | Hide or show toolbars |

Touch: swipe left or right on the toolbar to switch tabs.

## Known limitations

- **Many major sites can't be embedded:** Google, YouTube (except `/embed/` links), DuckDuckGo, MDN, Scratch, Lichess, Poki, CrazyGames and others. NEXUS detects this and offers to open them normally. Bing results, Wikipedia, OpenStreetMap embed, Desmos, GeoGebra, Excalidraw, Photopea, Internet Archive and many HTML5 games work (checked Oct 2026; sites can change their headers at any time).
- **Back and forward only track navigation started in NEXUS** (address bar, favorites). Browsers don't let a page read where a cross-origin iframe has navigated, so link clicks inside a site aren't reflected in the address bar or in NEXUS history. The tab title shows the host name for the same reason.
- **Logins and cookies inside iframes may fail.** Safari's Intelligent Tracking Prevention and third-party-cookie blocking in other browsers often prevent signing in to embedded sites. Use "Open in a normal tab" for accounts.
- **http:// sites** can't load inside an HTTPS deployment (mixed content). NEXUS explains this, including when an https URL redirects to http.
- **The embed check is a prediction.** It checks one server-side request. Sites that vary headers by cookie, region or user agent, or that block bots (403/429), can differ from what the browser gets. "Try anyway" loads the iframe regardless.
- **Keyboard shortcuts** don't fire while focus is inside an embedded page (cross-origin key events never reach NEXUS). Click or tap the toolbar first.
- **Full screen on iPad** uses the WebKit Fullscreen API. Where element full screen is unavailable (iPhone Safari), the button falls back to "hide toolbars" mode. Installed as a PWA, NEXUS already runs without Safari's UI.
- **Background tabs:** with "Keep background tabs running" on, visited tabs stay alive, which uses memory. iPadOS may still reload pages under memory pressure. Restored tabs load only when you open them.
- **Testing:** unit tests and Playwright E2E tests (desktop Chrome plus an emulated iPad touch viewport in Chromium) pass. The WebKit project wasn't run in the development environment because WebKit couldn't be installed there, so confirm on a real iPad before release.

## Project structure

```
server/            Node backend (compiled to dist-server/)
  index.ts         HTTP server: static files + security headers + /api
  api.ts           /api/health, /api/embed-check (rate limit, cache)
  embedCheck.ts    header-only fetch with validated redirects
  frameCheck.ts    X-Frame-Options / CSP frame-ancestors evaluation
  netGuard.ts      SSRF guards: URL validation, IP blocklists, safe DNS lookup
  config.ts        environment configuration
src/
  App.tsx          state wiring, toolbar, shortcuts, persistence
  components/      TabBar, AddressBar, WebView, NewTabPage, SettingsPanel, Pages, ui, Icons
  hooks/           usePersistentState, useShortcuts, useSwipe, useTheme
  lib/             url (omnibox logic), tabs (reducer), settings, storage, embed client, fullscreen
public/            manifest, service worker, icons, theme-init.js
tests/             Vitest unit tests (59)
e2e/               Playwright end-to-end tests
```
