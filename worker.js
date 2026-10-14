/**
 * Apna AI Video Maker — Cloudflare Worker API
 * Required Worker secrets/variables:
 *   REPLICATE_API_TOKEN (secret)
 *   REPLICATE_MODEL (variable, owner/model slug for a text-to-video model available to your Replicate account)
 *
 * Deploy this file as a Cloudflare Worker. Keep the API token as a Worker secret;
 * never place it in index.html or any public GitHub file.
 */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
function outputUrl(output) {
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output)) return output.find(x => typeof x === "string" && /^https?:\/\//i.test(x)) || null;
  if (output && typeof output === "object") {
    for (const v of Object.values(output)) {
      const found = outputUrl(v);
      if (found) return found;
    }
  }
  return null;
}
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "Apna AI Video Maker API", configured: Boolean(env.REPLICATE_API_TOKEN && env.REPLICATE_MODEL) });
    }
    if (!env.REPLICATE_API_TOKEN || !env.REPLICATE_MODEL) {
      return json({ error: "Backend configure nahi hai. REPLICATE_API_TOKEN secret aur REPLICATE_MODEL variable set karein." }, 503);
    }
    if (url.pathname === "/generate" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "Request JSON valid nahi hai." }, 400); }
      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) return json({ error: "Video prompt likhna zaroori hai." }, 400);
      if (prompt.length > 2000) return json({ error: "Prompt bohat lamba hai. 2000 characters tak rakhein." }, 400);
      // Model-specific options differ; this starter sends the universally common prompt field.
      // Configure a compatible text-to-video model in REPLICATE_MODEL.
      const model = String(env.REPLICATE_MODEL).trim().replace(/^\/+|\/+$/g, "");
      if (!/^[a-z0-9_-]+\/[a-z0-9_.-]+$/i.test(model)) return json({ error: "REPLICATE_MODEL ko owner/model format mein set karein." }, 500);
      const upstream = await fetch("https://api.replicate.com/v1/models/" + model + "/predictions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + env.REPLICATE_API_TOKEN, "Content-Type": "application/json", "Prefer": "wait=1" },
        body: JSON.stringify({ input: { prompt } })
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        return json({ error: data.detail || data.title || "AI provider ne request reject kar di. Model slug, token aur billing check karein.", provider_status: upstream.status }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502);
      }
      const video_url = outputUrl(data.output);
      return json({ id: data.id, status: data.status || (video_url ? "succeeded" : "starting"), video_url, output: data.output || null, error: data.error || null }, 200);
    }
    const match = url.pathname.match(/^\/status\/([a-zA-Z0-9_-]+)$/);
    if (match && request.method === "GET") {
      const upstream = await fetch("https://api.replicate.com/v1/predictions/" + encodeURIComponent(match[1]), {
        headers: { "Authorization": "Bearer " + env.REPLICATE_API_TOKEN }
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return json({ error: data.detail || "AI job ka status hasil nahi ho saka." }, upstream.status);
      return json({ id: data.id, status: data.status, video_url: outputUrl(data.output), output: data.output || null, error: data.error || null, logs: data.logs || null });
    }
    return json({ error: "Route nahi mili. /health, POST /generate ya GET /status/:id use karein." }, 404);
  }
};