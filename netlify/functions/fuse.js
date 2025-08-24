// netlify/functions/fuse.js
// Fuse multiple crawl/enrich results into ONE preview-ready CARD (no deps).

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return resp(405, "Method Not Allowed");

    const body = safeJSON(event.body);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const session = body.session || "";

    // Accept multiple payload shapes:
    // - { cards: [...] }
    // - { results: [...] }
    // - { data: { cards: [...] } } or { data: { results: [...] } }
    const cardsIn   = arr(body.cards)   || arr(body?.data?.cards)   || [];
    const resultsIn = arr(body.results) || arr(body?.data?.results) || [];

    if (!cardsIn.length && !resultsIn.length) {
      return json(400, { error: "No results or cards provided" });
    }

    // If we only got raw results, turn them into cards
    const builtCards = cardsIn.length ? cardsIn : resultsIn.map(resultToCard);

    // Normalize card fields, then fuse
    const normalized = builtCards.map(normalizeCard);
    const sources = collectSources(resultsIn, normalized);

    const card = fuseCards(normalized);

    return json(200, { session, card, sources });
  } catch (err) {
    console.error("Fuse fatal:", err && err.stack || err);
    return json(500, { error: "Fuse failed", reason: (err && err.message) || String(err) });
  }
};

/* ---------------- helpers ---------------- */
function resp(code, text){ return { statusCode: code, body: text }; }
function json(code, obj){
  return { statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
function safeJSON(s){ try{ return JSON.parse(s || "{}"); }catch{ return null; } }
const arr = (x) => Array.isArray(x) ? x : null;

function hostOf(u){ try { return new URL(u).hostname.replace(/^www\./i,""); } catch { return ""; } }
function stripTags(s=""){ return s.replace(/<[^>]*>/g,""); }
function uniq(arr){ const seen=Object.create(null); const out=[]; for(const v of arr){ const k=String(v).toLowerCase(); if(!seen[k]){ seen[k]=1; out.push(v);} } return out; }
function truncate(s="", n=280){ return s.length>n ? s.slice(0,n-1)+"…" : s; }
function shortHash(s=""){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31 + s.charCodeAt(i))|0; } h=Math.abs(h); return (h.toString(36).padStart(8,"0")+Date.now().toString(36)).slice(0,12); }

/* ---------- map raw crawl result -> preview card ---------- */
function resultToCard(r={}){
  const url   = (r.url || "").trim();
  const title = safeText(r.title);
  const desc  = safeText(r.description);
  const site  = (r.siteName || hostOf(url) || "").trim();
  const image = (r.image || "").trim();

  // effect texts: description + (optionally) title (short)
  const effTexts = [];
  if (desc)  effTexts.push(desc);
  if (title) effTexts.push(title);

  return {
    id: shortHash(url || title || Date.now()+""),
    name: title || hostOf(url) || url,
    icon: "",                 // unknown from result; leave blank (renderer is safe)
    about: "",
    tribute: "",
    effects: effTexts.slice(0,3).map(t => ({ icons:"", emoji:"", text: truncate(t, 280) })),
    rarity: "",
    tags: Array.isArray(r.keywords) ? r.keywords.slice(0,10) : [],
    card_sets: site ? [site] : [],
    timestamp: new Date().toISOString(),
    footer: "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
    card_images: image ? [{ image_url: absolutize(url, image) }] : [],
    frameType: "",
    _source_url: url
  };
}

function safeText(s){ return (typeof s === "string" ? s.replace(/\s+/g," ").trim() : ""); }
function absolutize(base, src){
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return "https:" + src;
  try{
    const b=new URL(base);
    if (src.startsWith("/")) return b.origin + src;
    return new URL(src, b.origin + b.pathname).toString();
  }catch{ return src; }
}

/* ---------- normalize incoming card ---------- */
function normalizeCard(c={}){
  const copy = {
    id:           (c.id || shortHash(c._source_url || c.name || "")),
    name:         safeText(c.name),
    icon:         c.icon || "",
    about:        safeText(c.about),
    tribute:      safeText(c.tribute),
    effects:      Array.isArray(c.effects) ? c.effects.map(e => ({
                    icons: e?.icons || "",
                    emoji: e?.emoji || "",
                    text:  safeText(e?.text || "")
                  })).filter(e => e.text) : [],
    rarity:       safeText(c.rarity),
    tags:         Array.isArray(c.tags) ? c.tags.filter(Boolean).map(safeText) : [],
    card_sets:    Array.isArray(c.card_sets) ? c.card_sets.filter(Boolean).map(safeText) : [],
    timestamp:    c.timestamp || new Date().toISOString(),
    footer:       c.footer || "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
    card_images:  Array.isArray(c.card_images) ? c.card_images
                    .map(x => ({ image_url: (x && x.image_url) ? String(x.image_url) : "" }))
                    .filter(x => x.image_url) : [],
    frameType:    safeText(c.frameType),
    _source_url:  c._source_url || ""
  };
  return copy;
}

/* ---------- fuse multiple cards into one ---------- */
function fuseCards(list){
  if (!list.length) {
    return {
      id: shortHash("empty"),
      name: "Card",
      icon: "", about:"", tribute:"",
      effects: [], rarity:"",
      tags: [], card_sets: [],
      timestamp: new Date().toISOString(),
      footer: "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
      card_images: [], frameType:""
    };
  }

  // pick a primary: with image > with effects > first
  const withImg = list.find(c => c.card_images && c.card_images.length);
  const withEff = list.find(c => (c.effects||[]).length);
  const primary = withImg || withEff || list[0];

  // Merge fields
  const name   = firstNonEmpty([primary.name].concat(list.map(c=>c.name)));
  const icon   = firstNonEmpty([primary.icon].concat(list.map(c=>c.icon)));
  const about  = firstNonEmpty([primary.about].concat(list.map(c=>c.about)));
  const tribute= firstNonEmpty([primary.tribute].concat(list.map(c=>c.tribute)));

  // effects: concat, dedupe by text, keep up to 4
  const allEffects = [];
  for (const c of list) for (const e of (c.effects||[])) {
    if (!e || !e.text) continue;
    const key = e.text.trim().toLowerCase();
    if (!allEffects.find(x => x.text.trim().toLowerCase() === key)) {
      allEffects.push({ icons: e.icons || "", emoji: e.emoji || "", text: e.text });
    }
  }
  const effects = allEffects.slice(0, 4);

  // images: gather unique, keep up to 3
  const imgs = uniq(list.flatMap(c => (c.card_images||[]).map(i => i.image_url))).slice(0,3);
  const card_images = imgs.map(u => ({ image_url: u }));

  // tags & sets
  const tags = uniq(list.flatMap(c => c.tags || [])).slice(0, 12);
  const card_sets = uniq(list.flatMap(c => c.card_sets || [])).slice(0, 6);

  // rarity/frameType — keep primary’s if present
  const rarity    = primary.rarity || "";
  const frameType = primary.frameType || "";

  return {
    id: primary.id || shortHash(name || Date.now()+""),
    name, icon, about, tribute,
    effects,
    // atk/def/level are auto-calculated by preview.js
    rarity,
    tags,
    card_sets,
    timestamp: new Date().toISOString(),
    footer: primary.footer || "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
    card_images,
    frameType
  };
}

function firstNonEmpty(list){ for (const s of list){ if (s && String(s).trim()) return String(s).trim(); } return ""; }
function collectSources(resultsIn, cards){
  const r = Array.isArray(resultsIn) ? resultsIn.map(x => x && x.url).filter(Boolean) : [];
  const c = Array.isArray(cards)     ? cards.map(x => x && x._source_url).filter(Boolean) : [];
  return uniq(r.concat(c)).slice(0, 20);
}
