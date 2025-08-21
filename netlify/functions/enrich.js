// netlify/functions/enrich.js
// Jessica AI Enrich — converts crawled/fused items into "card-ready" objects
// Input: { items:[ {url,title,desc,image,price,brand,tags,date} ], mode?, session? }
// Output: { session, mode, cards:[...] }
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Invalid JSON" }); }
    const session = body.session || ("sess-" + Date.now().toString(36));
    const mode = (body.mode || "auto").toLowerCase();

    const cards = (Array.isArray(body.items) ? body.items : []).map((it, i) => toCard(it, i, mode, session)).filter(Boolean);
    return json(200, { session, mode, count: cards.length, cards });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

function json(statusCode, obj){
  return { statusCode, headers: { "content-type":"application/json", "cache-control":"no-store" }, body: JSON.stringify(obj) };
}

// lightweight classifier
function classify(u, title, desc){
  try {
    const host = (new URL(u)).hostname;
    if (/\b(youtube|youtu\.be|tiktok|instagram|x\.com|twitter)\b/i.test(host)) return "Social";
    if (/\b(amazon|ebay|etsy|gumroad|shopify|aliexpress)\b/i.test(host)) return "Product";
    if (/\b(reddit|medium|substack|news|cnn|bbc|nytimes|theverge|wired)\b/i.test(host) || /\b(news|breaking|report)\b/i.test(title+ " " +desc)) return "News";
    return "Info";
  } catch { return "Info"; }
}

function rarityFromRank(rank){
  const choices = ["Normal","Rare","Super Rare","Ultra Rare","Quantum","Zetsumetsu EOE"];
  if (rank <= 1) return choices[5];
  if (rank <= 2) return choices[4];
  if (rank <= 4) return choices[3];
  if (rank <= 7) return choices[2];
  if (rank <= 10) return choices[1];
  return choices[0];
}

function toCard(it, i, mode, session){
  const url = it.url || it.link || "";
  if (!url) return null;
  const title = (it.title || it.name || "").toString().trim();
  const desc = (it.desc || it.description || it.snippet || "").toString().trim();
  const image = (it.image || it.img || it.thumbnail || "").toString().trim();
  const price = it.price || null;
  const brand = it.brand || it.source || null;
  const date = it.date || null;
  const kind = classify(url, title, desc);
  const rank = i+1;

  // TCG-ish schema
  return {
    id: `card-${session}-${rank}`,
    session,
    kind,                       // News | Product | Social | Info
    rarity: rarityFromRank(rank),
    header: {
      id: `#${rank}`,
      name: title || cleanHost(url),
      icon: iconFor(kind)
    },
    artwork: {
      url: image || fallbackFor(kind),
      alt: title || "artwork"
    },
    typeBanner: {
      stars: Math.max(1, 6 - Math.floor(rank/2)),
      about: brand || cleanHost(url),
      emoji: emojiFor(kind)
    },
    effectBox: {
      description: desc || shortUrl(url),
      effects: buildEffects(kind, price, date)
    },
    footer: {
      tags: buildTags(kind, brand),
      set: "Jessica AI • SPZ",
      timestamp: (new Date()).toISOString(),
      rarity: undefined // shown above
    },
    links: { url }
  };
}

function buildEffects(kind, price, date){
  const eff = [];
  if (kind === "Product" && price) eff.push(`Price ~ ${String(price)}`);
  if (date) eff.push(`Dated: ${String(date).slice(0,10)}`);
  if (kind === "News") eff.push("Effect: If shared 3×, gain +1 Trend.");
  if (kind === "Social") eff.push("Effect: If bookmarked, draw 1 Meme.");
  if (eff.length === 0) eff.push("Effect: Reveal 1 insight.");
  return eff;
}

function buildTags(kind, brand){
  const t = [kind];
  if (brand) t.push(String(brand));
  return t.slice(0,5);
}

function iconFor(kind){
  return {
    News: "📰", Product: "🛒", Social: "🌐", Info: "📎"
  }[kind] || "✨";
}

function emojiFor(kind){
  return {
    News: "🗞️", Product: "💎", Social: "📣", Info: "🧩"
  }[kind] || "⭐";
}

function cleanHost(u){
  try { return new URL(u).hostname.replace(/^www\./,""); } catch { return "link"; }
}
function shortUrl(u){
  try { const x=new URL(u); return x.hostname.replace(/^www\./,"") + x.pathname.slice(0,30); } catch { return u; }
}
function fallbackFor(kind){
  return {
    News: "https://placehold.co/600x400?text=NEWS",
    Product: "https://placehold.co/600x400?text=PRODUCT",
    Social: "https://placehold.co/600x400?text=SOCIAL",
    Info: "https://placehold.co/600x400?text=INFO"
  }[kind];
}
