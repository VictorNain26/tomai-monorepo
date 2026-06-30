import { chromium } from "playwright";
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "dist");
const OUT = join(dirname(fileURLToPath(import.meta.url)), "web-smoke.png");
const PORT = 8088;
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2", ".map": "application/json",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let filePath = join(DIST, urlPath);
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST, "index.html"); // SPA fallback
  }
  try {
    const data = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

server.listen(PORT, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + (e?.message || String(e))));
  try {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load", timeout: 30000 });
  } catch (e) {
    errors.push("goto: " + e.message);
  }
  await page.waitForTimeout(6000);
  const title = await page.title().catch(() => "?");
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 300) ?? "").catch(() => "");
  const rootChildren = await page.evaluate(() => document.getElementById("root")?.childElementCount ?? -1).catch(() => -2);
  await page.screenshot({ path: OUT }).catch(() => {});
  console.log("=== WEB SMOKE ===");
  console.log("TITLE:", JSON.stringify(title));
  console.log("ROOT_CHILDREN:", rootChildren, "(>0 = React monté ; 0 = blank/crash)");
  console.log("BODY:", JSON.stringify(bodyText));
  console.log("ERRORS:", errors.length);
  errors.slice(0, 25).forEach((e) => console.log("  - " + e.slice(0, 280)));
  await browser.close();
  server.close();
  process.exit(0);
});
