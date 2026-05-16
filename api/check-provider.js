import { routeApi, json } from "../lib/runtime.js";

export default async function handler(req, res) {
  try {
    await routeApi(req, res, "/api/check-provider");
  } catch (error) {
    json(res, 500, { error: error.message || "Server error" });
  }
}
