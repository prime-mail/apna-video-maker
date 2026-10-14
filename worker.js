/**
 * Apna AI Video Maker — Cloudflare Worker API
 *
 * Cloudflare Worker settings:
 *   Secret: REPLICATE_API_TOKEN
 *   Variable (optional): REPLICATE_MODEL (defaults to prunaai/p-video)
 *   Variable (optional): ALLOWED_ORIGIN (defaults to https://prime-mail.github.io)
 *
 * Never put provider tokens in index.html or public GitHub files.
 */
const DEFAULT_MODEL = "prunaai/p-video";
const DEFAULT_ORIGIN = "https://prime-mail.github.io";

function headersFor(origin, env) {
  const allowed = (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, "");
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
  if (origin && origin === allowed) headers["Access-Control-Allow-Origin"] = allowed;
  return headers;
}
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

function outputUrl(output) {
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output)) return output.find(x => typeof x === "string" && /^https?:\/\//i.test(x)) || null;
  if (output && typeof output === "object") {
    for (const value of Object.values(output)) {
      const found = outputUrl(value);
      if (found) return found;
    }
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, "");
    const headers = headersFor(origin, env);

    if (request.method === "OPTIONS") {
      if (origin && origin !== allowedOrigin) return new Response(null, { status: 403, headers });
      return new Response(null, { status: 204, headers });
    }

    // Browser requests from other origins are rejected. This is CORS protection,
    // not authentication; add rate limiting/auth before offering public paid generation.
    if (origin && origin !== allowedOrigin) {
      return json({ error: "Is website origin ko API access ki ijazat nahi hai." }, 403, headers);
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "Apna AI Video Maker API",
        configured: Boolean(env.REPLICATE_API_TOKEN),
        model: String(env.REPLICATE_MODEL || DEFAULT_MODEL).trim()
      }, 200, headers);
    }

    if (!["GET", "POST"].includes(request.method)) {
      return json({ error: "HTTP method supported nahi hai." }, 405, headers);
    }

    const model = String(env.REPLICATE_MODEL || DEFAULT_MODEL).trim().replace(/^\/+|\/+$/g, "");
    if (!/^[a-z0-9_-]+\/[a-z0-9_.-]+$/i.test(model)) {
      return json({ error: "REPLICATE_MODEL ko owner/model format mein set karein." }, 500, headers);
    }
    if (!env.REPLICATE_API_TOKEN) {
      return json({ error: "Cloudflare Worker mein REPLICATE_API_TOKEN Secret set karein." }, 503, headers);
    }

    if (url.pathname === "/generate" && request.method === "POST") {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: "Request JSON valid nahi hai." }, 400, headers); }

      const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) return json({ error: "Video prompt likhna zaroori hai." }, 400, headers);
      if (prompt.length > 2000) return json({ error: "Prompt 2000 characters se zyada nahi ho sakta." }, 400, headers);

      const input = { prompt };
      // Official prunaai/p-video schema supports these fields. Other models have
      // different schemas, so only send these extra fields to this known model.
      if (model.toLowerCase() === "prunaai/p-video") {
        const duration = Number(body.duration);
        input.duration = Number.isInteger(duration) && duration >= 1 && duration <= 20 ? duration : 5;
        const ratios = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"];
        input.aspect_ratio = ratios.includes(body.aspect_ratio) ? body.aspect_ratio : "16:9";
        input.resolution = body.quality === "high" ? "1080p" : "720p";
      }

      let upstream;
      try {
        upstream = await fetch("https://api.replicate.com/v1/models/" + model + "/predictions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + env.REPLICATE_API_TOKEN,
            "Content-Type": "application/json",
            "Prefer": "wait=1"
          },
          body: JSON.stringify({ input })
        });
      } catch {
        return json({ error: "AI provider se connection nahi ho saka." }, 502, headers);
      }
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        return json({
          error: data.detail || data.title || "AI provider ne request reject kar di. Token, billing aur model inputs check karein.",
          provider_status: upstream.status
        }, upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, headers);
      }
      const video_url = outputUrl(data.output);
      return json({
        id: data.id,
        status: data.status || (video_url ? "succeeded" : "starting"),
        video_url,
        output: data.output || null,
        error: data.error || null
      }, 200, headers);
    }

    const match = url.pathname.match(/^\/status\/([a-zA-Z0-9_-]+)$/);
    if (match && request.method === "GET") {
      let upstream;
      try {
        upstream = await fetch("https://api.replicate.com/v1/predictions/" + encodeURIComponent(match[1]), {
          headers: { "Authorization": "Bearer " + env.REPLICATE_API_TOKEN }
        });
      } catch {
        return json({ error: "AI provider ka status hasil nahi ho saka." }, 502, headers);
      }
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return json({ error: data.detail || "AI job ka status hasil nahi ho saka." }, upstream.status, headers);
      return json({
        id: data.id,
        status: data.status,
        video_url: outputUrl(data.output),
        output: data.output || null,
        error: data.error || null,
        logs: data.logs || null
      }, 200, headers);
    }

    return json({ error: "Route nahi mili. /health, POST /generate ya GET /status/:id use karein." }, 404, headers);
  }
};
