import { routeApi, json } from "../lib/runtime.js";

export default async function handler(req, res) {
  try {
    await routeApi(req, res, "/api/generate-image-diagram");
  } catch (error) {
    json(res, 500, { error: error.message || "Server error" });
  }
}
