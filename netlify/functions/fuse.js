// netlify/functions/fuse.js
// Fuse results + cards into ONE preview-ready card for preview.html (no deps).

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return resp(405, "Method Not Allowed");
    const body = safeJSON(event.body);
    if (!body) return json(400, { error: "Invalid JSON body" });

    const session   = body.session || "";
    const resultsIn = arr(body.results) || arr(body?.data?.results) || [];
    const cardsIn   = arr(body.cards)   || arr(body?.data?.cards)   || [];

    if (!resultsIn.length && !cardsIn.length) {
      return json(400, { error: "No results or cards provided" });
    }

    // Index crawl results by URL for merging
    const normResults = resultsIn.map(normalizeResult);
    const byUrl = Object.create(null);
    for (const r of normResults) if (r.url) byUrl[r.url] = r;

    // Turn incoming cards into preview schema, filling blanks from crawl result (by URL match)
    const builtCards = (cardsIn.length ? cardsIn : []).map(c => {
      const url = (c._source_url || c.url || "").trim();
      const r   = byUrl[url] || null;
      return normalizeCard(c, r);
    });

    // If we had no cards, build from results directly
    if (!builtCards.length) {
      for (const r of normResults) builtCards.push(cardFromResult(r));
    }

    // Fuse into one
    const card = fuseCards(builtCards);

    return json(200, { session, card, sources: normResults.map(r => r.url).filter(Boolean) });
  } catch (err) {
    console.error("Fuse fatal:", err && err.stack || err);
    return json(500, { error: "Fuse failed", reason: (err && err.message) || String(err) });
  }
};

/* ---------------- helpers ---------------- */
function resp(code, text){ return { statusCode: code, body: text }; }
function json(code, obj){ return { statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) }; }
function safeJSON(s){ try{ return JSON.parse(s || "{}"); }catch{ return null; } }
const arr = x => Array.isArray(x) ? x : null;

function hostOf(u){ try { return new URL(u).hostname.replace(/^www\./i,""); } catch { return ""; } }
function stripTags(s=""){ return s.replace(/<[^>]*>/g,""); }
function uniq(a){ const seen=Object.create(null), out=[]; for(const v of a){ const k=String(v).toLowerCase(); if(!seen[k]){ seen[k]=1; out.push(v);} } return out; }
function truncate(s="", n=280){ return s.length>n ? s.slice(0,n-1)+"…" : s; }
function shortHash(s=""){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } h=Math.abs(h); return (h.toString(36).padStart(8,"0")+Date.now().toString(36)).slice(0,12); }
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

/* -------- crawl result -> normalized -------- */
function normalizeResult(r={}){
  const url   = (r.url || "").trim();
  const title = text(r.title);
  const desc  = text(r.description);
  const image = (r.image || "").trim();
  const site  = text(r.siteName) || hostOf(url);
  const keys  = Array.isArray(r.keywords) ? r.keywords.filter(Boolean).map(text) : [];
  return { url, title, desc, image, site, keys };
}

/* -------- card (any shape) + matching result -> preview card -------- */
function normalizeCard(c={}, r=null){
  const url   = (c._source_url || c.url || (r && r.url) || "").trim();
  const name  = firstNonEmpty([c.name, r && r.title, hostOf(url), url]);
  const imgIn = firstNonEmpty([
    firstCardImage(c),
    r && r.image ? absolutize(r.url, r.image) : ""
  ]);

  // effects: use existing, else build from description/title
  let effects = Array.isArray(c.effects) ? c.effects.filter(e => e && text(e.text)).map(e => ({
    icons: e.icons || "", emoji: e.emoji || "", text: text(e.text)
  })) : [];
  if (!effects.length && r) {
    const effTexts = [r.desc, r.title].filter(Boolean);
    effects = effTexts.slice(0,3).map(t => ({ icons:"", emoji:"", text: truncate(t, 280) }));
  }

  // tags/sets
  const tags = (Array.isArray(c.tags) ? c.tags.map(text) : []).concat(r && r.keys || []);
  const card_sets = Array.isArray(c.card_sets) && c.card_sets.length
    ? c.card_sets.map(text)
    : (r && r.site ? [r.site] : []);

  // footer: flatten object -> string
  const footer = footerToString(c.footer);

  // rarity: drop placeholder "Zetsumetsu EOE"
  const rarity = (text(c.rarity) === "Zetsumetsu EOE") ? "" : text(c.rarity);

  return {
    id: c.id || shortHash(url || name || ""),
    name: text(name),
    icon: c.icon || "",
    about: text(c.about || ""),
    tribute: text(c.tribute || ""),
    effects,
    rarity,
    tags: uniq(tags).slice(0,12),
    card_sets: uniq(card_sets).slice(0,6),
    timestamp: c.timestamp || new Date().toISOString(),
    footer,
    card_images: imgIn ? [{ image_url: imgIn }] : [],
    frameType: text(c.frameType || ""),
    _source_url: url
  };
}

function firstCardImage(c){
  if (!Array.isArray(c.card_images)) return "";
  const x = c.card_images.find(i => i && i.image_url);
  return x ? String(x.image_url) : "";
}

function footerToString(f){
  if (!f) return "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber";
  if (typeof f === "string") return f;
  try {
    const parts = [];
    if (Array.isArray(f.tags) && f.tags.length) parts.push(f.tags.join(" "));
    if (f.set) parts.push(String(f.set));
    if (f.timestamp) parts.push(String(f.timestamp));
    parts.push("Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber");
    return parts.filter(Boolean).join(" | ");
  } catch {
    return "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber";
  }
}

function text(s){ return (typeof s === "string" ? s.replace(/\s+/g," ").trim() : ""); }
function firstNonEmpty(list){ for (const v of list){ if (v && String(v).trim()) return String(v).trim(); } return ""; }

/* -------- build from result only -------- */
function cardFromResult(r){
  const name = r.title || r.site || r.url;
  const effects = [];
  if (r.desc) effects.push({ icons:"", emoji:"", text: truncate(r.desc, 280) });
  if (r.title && r.title !== r.desc) effects.push({ icons:"", emoji:"", text: truncate(r.title, 280) });

  return {
    id: shortHash(r.url || name),
    name,
    icon: "",
    about: "",
    tribute: "",
    effects,
    rarity: "",
    tags: r.keys || [],
    card_sets: r.site ? [r.site] : [],
    timestamp: new Date().toISOString(),
    footer: "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
    card_images: r.image ? [{ image_url: absolutize(r.url, r.image) }] : [],
    frameType: "",
    _source_url: r.url
  };
}

/* -------- fuse many preview cards into one -------- */
function fuseCards(list){
  if (!list.length) return cardFromResult({ url:"", title:"Card", desc:"" });

  const withImg = list.find(c => (c.card_images||[]).length);
  const withEff = list.find(c => (c.effects||[]).length);
  const primary = withImg || withEff || list[0];

  const name    = firstNonEmpty([primary.name].concat(list.map(c=>c.name)));
  const icon    = firstNonEmpty([primary.icon].concat(list.map(c=>c.icon)));
  const about   = firstNonEmpty([primary.about].concat(list.map(c=>c.about)));
  const tribute = firstNonEmpty([primary.tribute].concat(list.map(c=>c.tribute)));

  // merge effects (dedupe by text)
  const effMap = Object.create(null); const effects=[];
  for (const c of list) for (const e of (c.effects||[])) {
    if (!e || !text(e.text)) continue;
    const key = text(e.text).toLowerCase();
    if (!effMap[key]) { effMap[key]=1; effects.push({ icons:e.icons||"", emoji:e.emoji||"", text:text(e.text) }); }
  }

  const imgs = uniq(list.flatMap(c => (c.card_images||[]).map(i => i.image_url))).slice(0,3);
  const tags = uniq(list.flatMap(c => c.tags || [])).slice(0,12);
  const sets = uniq(list.flatMap(c => c.card_sets || [])).slice(0,6);

  return {
    id: primary.id || shortHash(name || Date.now()+""),
    name, icon, about, tribute,
    effects: effects.slice(0,4),
    rarity: primary.rarity || "",
    tags, card_sets: sets,
    timestamp: new Date().toISOString(),
    footer: primary.footer || "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
    card_images: imgs.map(u => ({ image_url: u })),
    frameType: primary.frameType || ""
  };
}
