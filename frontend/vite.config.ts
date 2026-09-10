import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The build goes straight into the Python package and is served by Starlette at /studio.
// base "./" — all asset links are relative, so the mount path
// can be changed on the server side without a rebuild.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "../src/langgraph_studio_oss/static",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    // In dev mode the API is proxied to the local Agent Server — the same relative paths.
    proxy: {
      "^/(assistants|threads|runs|store|info|ok|mcp|a2a|docs|openapi.json)": {
        target: "http://127.0.0.1:2024",
        changeOrigin: false,
      },
    },
  },
  test: {
    // Tests cover pure modules (layout, colors, branches, history parsing) — they need no DOM
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
