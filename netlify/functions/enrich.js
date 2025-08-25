// netlify/functions/enrich.js
// Jessica AI Enrich — convert crawled items into card schema
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid JSON" }); }

    const session = body.session || ("sess-" + Date.now().toString(36));
    const mode = (body.mode || "auto").toLowerCase();

    const cards = (Array.isArray(body.items) ? body.items : [])
      .map((it, i) => toCard(it, i, session))
      .filter(Boolean);

    return json(200, { session, mode, count: cards.length, cards });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

function json(statusCode, obj){
  return {
    statusCode,
    headers: { "content-type":"application/json", "cache-control":"no-store" },
    body: JSON.stringify(obj)
  };
}

function toCard(it, i, session){
  const url   = it.url || it.link || "";
  if (!url) return null;

  const title = (it.title || it.name || "").toString().trim();
  const desc  = (it.desc || it.description || it.snippet || "").toString().trim();
  const image = (it.image || it.img || it.thumbnail || "").toString().trim();
  const brand = it.brand || it.source || "";
  const date  = it.date  || null;
  const rank  = i + 1;

  // Map collected info into effects array
  const effects = [];
  if (desc) effects.push({ text: desc });
  if (it.effect) effects.push({ text: it.effect });
  if (date) effects.push({ text: `Dated: ${String(date).slice(0,10)}` });

  return {
    id: `card-${session}-${rank}`,
    session,
    header: { id: `#${rank}`, name: title, icon: "✨" },
    artwork: { url: image, alt: title || "artwork" },
    typeBanner: {
      tribute: it.tribute || "",
      about: brand || "",
      emoji: "🧩"
    },
    effectBox: { description: desc, effects },
    footer: {
      tags: it.tags || [],
      set: "Jessica AI • SPZ",
      timestamp: new Date().toISOString(),
    },
    links: { url }
  };
}
