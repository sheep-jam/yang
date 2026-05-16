import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { routeApi, json, send } from "./lib/runtime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 5177);
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

async function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${decodeURIComponent(requested)}`);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden", "text/plain");
  try {
    const data = await fs.readFile(filePath);
    send(res, 200, data, MIME[path.extname(filePath)] || "application/octet-stream");
  } catch {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await routeApi(req, res, url.pathname);
    } else {
      await serveStatic(req, res, url.pathname);
    }
  } catch (error) {
    json(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Skill Chat MVP running at http://127.0.0.1:${PORT}`);
});
