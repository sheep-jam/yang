import { routeApi, json } from "../../lib/runtime.js";

export default async function handler(req, res) {
  try {
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    await routeApi(req, res, `/api/skills/${encodeURIComponent(id || "")}`);
  } catch (error) {
    json(res, 500, { error: error.message || "Server error" });
  }
}
