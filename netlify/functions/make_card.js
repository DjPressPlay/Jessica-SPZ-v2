// netlify/functions/make_card.js

const MODE       = (process.env.JESS_MODE || "scraper").toLowerCase();
const LLM_SITE   = process.env.LLM_SITE;
const LLM_MODEL  = process.env.LLM_MODEL_ID;
const LLM_PATH   = process.env.LLM_API_PATH || "/v1/chat/completions";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return res(204, "");
  if (event.httpMethod !== "POST")    return res(405, { error: "Method Not Allowed" });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return res(400, { error: "Invalid JSON" }); }

  // Extract URL from "make card: <url>" message
  const msg = Array.isArray(body.messages) ? body.messages.find(m => m && m.content) : null;
  const text = (msg?.content || "").trim();
  const match = text.match(/make\s+card:\s*(.+)$/i);
  const targetUrl = match ? match[1].trim() : "";

  if (!targetUrl) return res(400, { error: "Missing target URL in 'make card: <url>'" });

  // SCRAPER-FIRST: if forced, or LLM not configured, build via your existing pipeline
  const useScraper = MODE === "scraper" || !LLM_SITE || !LLM_MODEL;

  try {
    if (useScraper) {
      // hit your existing pipeline — adjust to your actual function names if different
      const base = inferSiteBase(event); // https://<yoursite>.netlify.app
      // 1) crawl
      const crawled = await postJSON(`${base}/api/crawl`, { url: targetUrl });
      // 2) enrich
      const enriched = await postJSON(`${base}/api/enrich`, { data: crawled });
      // 3) fuse → returns a single fused object we can map to a card
      const fused = await postJSON(`${base}/api/fuse`, { data: enriched });

      // Return exactly what Jessica expects: raw JSON in assistant message.content
      return res(200, {
        id: "chatcmpl-scraper",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: "scraper",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: JSON.stringify(fused) },
            finish_reason: "stop"
          }
        ]
      });
    }

    // LLM path (optional)
    const url = new URL(LLM_PATH, LLM_SITE).toString();
    const payload = {
      model: LLM_MODEL,
      messages: body.messages || [],
      stream: !!body.stream,
      temperature: body.temperature ?? 0.2
    };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const textResp = await r.text();
    return {
      statusCode: r.status,
      headers: headers("application/json"),
      body: textResp
    };

  } catch (err) {
    return res(502, { error: "Orchestrator failed", detail: String(err?.message || err) });
  }
};

// ---- helpers ----
function inferSiteBase(event) {
  const host = event.headers["x-forwarded-host"] || event.headers.host;
  const proto = (event.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}
async function postJSON(url, obj) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  });
  if (!r.ok) throw new Error(`POST ${url} -> ${r.status}`);
  return await r.json().catch(() => ({}));
}
function headers(ct = "application/json") {
  return {
    "Content-Type": ct,
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
function res(code, data) {
  return { statusCode: code, headers: headers(), body: typeof data === "string" ? data : JSON.stringify(data) };
}
