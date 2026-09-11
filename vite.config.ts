import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Connect } from "vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";
import { SHA, bareUrlRun, listRuns, redirectHtml } from "./scripts/runs";

// One app, served once per run at /<fc sha>/ beside that run's data (which it fetches
// with relative URLs), and a redirect page at / pointing at the run the unversioned links refer to (BARE_URL_RUN). The dev
// and preview servers mirror the deployed layout (GitHub Pages sends /<dir> to /<dir>/).
function runs(): Plugin {
  let config: ResolvedConfig;
  const slash: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (SHA.test(url.pathname.slice(1))) {
      res.statusCode = 301;
      res.setHeader("Location", `${url.pathname}/${url.search}`);
      res.end();
      return;
    }
    next();
  };
  return {
    name: "runs",
    configResolved(c) {
      config = c;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === "/" || url.pathname === "/index.html") {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(redirectHtml(bareUrlRun().sha));
          return;
        }
        // /<sha>/ falls through to the SPA fallback and /<sha>/index.json, files/** to the public dir
        slash(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(slash);
    },
    closeBundle() {
      const out = join(config.root, config.build.outDir);
      const app = readFileSync(join(out, "index.html"), "utf8");
      for (const run of listRuns()) {
        const dir = join(out, run.sha);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "index.html"), app);
        cpSync(join(out, config.build.assetsDir), join(dir, config.build.assetsDir), { recursive: true });
      }
      rmSync(join(out, config.build.assetsDir), { recursive: true });
      writeFileSync(join(out, "index.html"), redirectHtml(bareUrlRun().sha));
    },
  };
}

export default defineConfig({
  base: "./",
  // the exporter's output is served as-is: data/<sha>/index.json -> /<sha>/index.json, data/<sha>/files/** -> /<sha>/files/**
  publicDir: "data",
  plugins: [react(), runs()],
  resolve: {
    // rehype-katex depends on katex ^0.16 and pnpm gives it its own copy, while the
    // page loads katex 0.18's stylesheet: one katex for markup and CSS
    dedupe: ["katex"],
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
