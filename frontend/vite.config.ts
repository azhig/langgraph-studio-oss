import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Сборка кладётся прямо в Python-пакет и раздаётся Starlette по /studio.
// base "./" — все ссылки на ассеты относительные, поэтому путь монтирования
// можно менять на стороне сервера без пересборки.
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
    // В dev-режиме API проксируется на локальный Agent Server — те же относительные пути.
    proxy: {
      "^/(assistants|threads|runs|store|info|ok|mcp|a2a|docs|openapi.json)": {
        target: "http://127.0.0.1:2024",
        changeOrigin: false,
      },
    },
  },
});
