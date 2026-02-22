import { exec } from "node:child_process";
import type { AnalysisResult } from "../types.js";
import { generateDashboardHtml } from "./dashboard.html.js";

export async function renderWeb(
  result: AnalysisResult,
  port: number,
): Promise<void> {
  const html = generateDashboardHtml(result);
  const jsonData = JSON.stringify(result);

  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/api/data") {
        return new Response(jsonData, {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  });

  const address = `http://localhost:${server.port}`;
  console.log(`\n  Dashboard running at: \x1b[1;36m${address}\x1b[0m`);
  console.log(`  Press Ctrl+C to stop\n`);

  // Auto-open browser
  exec(`open "${address}"`);
}
