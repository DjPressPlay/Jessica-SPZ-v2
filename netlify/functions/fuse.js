// netlify/functions/fuse.js
// Fuse a single crawler result + optional enrich data into ONE preview card.

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return resp(405, "Method Not Allowed");
    const body = safeJSON(event.body);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const session = body.session || "";
    // new crawler returns a single object, but frontend may still send .results
    const result = body.result || (body.results && body.results[0]) || null;
    const cardIn = body.card || (body.cards && body.cards[0]) || null;

    if (!result && !cardIn) {
      return json(400, { error: "No result or card provided" });
    }

    // normalize the crawler result
    const normResult = result ? normalizeResult(result) : null;

    // merge with incoming enriched card if provided
    let card = cardIn
      ? normalizeCard(cardIn, normResult)
      : cardFromResult(normResult);

    // finalize: type → emoji/frame/tributes
    card = finalizeCard(card);

    return json(200, { session, card, source: normResult?.url || "" });
  } catch (err) {
    console.error("Fuse fatal:", err && err.stack || err);
    return json(500, { error: "Fuse failed", reason: (err && err.message) || String(err) });
  }
};

/* ---------------- helpers ---------------- */
function resp(code, text){ return { statusCode: code, body: text }; }
function json(code, obj){ return { statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }; }
function safeJSON(s){ try{ return JSON.parse(s || "{}"); }catch{ return null; } }
function stripTags(s=""){ return s.replace(/<[^>]*>/g,""); }
function text(s){ return (typeof s === "string" ? s.replace(/\s+/g," ").trim() : ""); }
function uniq(a){ const seen=Object.create(null), out=[]; for(const v of a){ const k=String(v).toLowerCase(); if(!seen[k]){ seen[k]=1; out.push(v);} } return out; }
function truncate(s="", n=280){ return s.length>n ? s.slice(0,n-1)+"…" : s; }
function hostOf(u){ try{ return new URL(u).hostname.replace(/^www\./i,""); }catch{ return ""; } }
function shortHash(s=""){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } h=Math.abs(h); return (h.toString(36).padStart(8,"0")+Date.now().toString(36)).slice(0,12); }

/* -------- normalize crawler result -------- */
function normalizeResult(r={}){
  const url   = (r.url || "").trim();
  const title = text(r.title);
  const desc  = Array.isArray(r.sentences) ? r.sentences.join(" ") : text(r.description || "");
  const image = (r.media || "").trim();
  const site  = text(r.siteName) || hostOf(url);
  const keys  = Array.isArray(r.keywords) ? r.keywords.filter(Boolean).map(text) : [];
  return { url, title, desc, image, site, keys };
}

/* -------- basic card from result -------- */
function cardFromResult(r){
  if (!r) return {};
  const name = r.title || r.site || r.url;
  const effects = [];
  if (r.desc) effects.push({ icons:"", emoji:"", text: truncate(r.desc, 280) });
  if (r.title && r.title !== r.desc) effects.push({ icons:"", emoji:"", text: truncate(r.title, 280) });

  return {
    id: shortHash(r.url || name),
    name,
    icon: "🔗",
    about: r.site,
    tribute: "",
    effects,
    rarity: "Normal",
    tags: r.keys || [],
    card_sets: r.site ? [r.site] : [],
    timestamp: new Date().toISOString(),
    footer: "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
    card_images: r.image ? [{ image_url: r.image }] : [],
    frameType: "",
    _source_url: r.url
  };
}

/* -------- normalize enriched card + merge result -------- */
function normalizeCard(c={}, r=null){
  const url = c.url || c._source_url || (r && r.url) || "";
  const name = text(c.name || (r && r.title) || hostOf(url));
  const img = c.image || (r && r.image) || "";
  const desc = c.desc || (r && r.desc) || "";

  const effects = [];
  if (desc) effects.push({ icons:"", emoji:"", text: truncate(desc, 280) });
  if (name) effects.push({ icons:"", emoji:"", text: truncate(name, 280) });

  return {
    id: c.id || shortHash(url || name),
    name,
    icon: c.icon || "🔗",
    about: c.about || (r && r.site) || hostOf(url),
    tribute: c.tribute || "",
    effects,
    rarity: c.rarity || "Normal",
    tags: uniq([...(c.tags || []), ...(r?.keys || [])]),
    card_sets: c.card_sets || (r?.site ? [r.site] : []),
    timestamp: c.timestamp || new Date().toISOString(),
    footer: c.footer || "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
    card_images: img ? [{ image_url: img }] : [],
    frameType: c.frameType || "",
    _source_url: url
  };
}

/* -------- finalize card (add type/emoji/frame/tributes) -------- */
function finalizeCard(card){
  const host = hostOf(card._source_url || "");
  const type = "Technology"; // simple default classification
  const icon = card.icon || "🔗";
  const tribute = card.tribute || "1";
  return { ...card, type, icon, tribute, frameType: card.frameType || type.toLowerCase() };
}
