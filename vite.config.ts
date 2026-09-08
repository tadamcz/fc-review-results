import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  // the exporter's output is served as-is: data/index.json -> /index.json, data/files/** -> /files/**
  publicDir: "data",
  plugins: [react()],
  resolve: {
    // rehype-katex depends on katex ^0.16 and pnpm gives it its own copy, while the
    // page loads katex 0.18's stylesheet: one katex for markup and CSS
    dedupe: ["katex"],
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
