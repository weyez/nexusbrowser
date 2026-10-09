import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.CHROMIUM_PATH || undefined;
const PORT = Number(process.env.E2E_PORT || 4173);

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  webServer: {
    command: `npm run build && node dist-server/server/index.js`,
    env: { PORT: String(PORT), HOST: "127.0.0.1" },
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
    { name: "ipad-chromium", use: { ...devices["iPad Pro 11"], browserName: "chromium", launchOptions: { executablePath } } },
    ...(process.env.PW_WEBKIT ? [{ name: "ipad-webkit", use: { ...devices["iPad Pro 11"] } }] : []),
  ],
});
