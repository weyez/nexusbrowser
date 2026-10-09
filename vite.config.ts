/// <reference types="vitest/config" />
import { defineConfig, type Connect } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createApiHandler } from "./server/api.js";

// Mounts the same /api handler used in production into the Vite dev/preview servers,
// so `npm run dev` is a single command.
function nexusApi() {
  const mount = (middlewares: Connect.Server) => {
    const handler = createApiHandler();
    middlewares.use((req, res, next) => {
      if (req.url?.startsWith("/api/")) handler(req, res).catch(next);
      else next();
    });
  };
  return {
    name: "nexus-api",
    configureServer(server: { middlewares: Connect.Server }) {
      mount(server.middlewares);
    },
    configurePreviewServer(server: { middlewares: Connect.Server }) {
      mount(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), nexusApi()],
  server: { host: true },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
