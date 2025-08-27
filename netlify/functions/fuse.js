// netlify/functions/fuse.js
// Fuse results + cards into ONE preview-ready card for preview.html (no deps).
// Builds a complete card and stamps tributes/level/ATK/DEF strictly from category.

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

    // Build preview-cards from incoming cards, merging with matched crawl result
    const builtCards = (cardsIn.length ? cardsIn : []).map(c => {
      const url = urlOfCard(c, null);
      const r   = byUrl[url] || null;
      return normalizeCard(c, r);
    });

    // If we had no cards, build from results directly
    if (!builtCards.length) {
      for (const r of normResults) builtCards.push(cardFromResult(r));
    }

    // Fuse → stamp core stats from CATEGORY ONLY → finalize frame meta
    let card = fuseCards(builtCards);
    card = stampCoreStatsFromCategory(card);
    card = finalizeCard(card);

    return json(200, { session, card, sources: normResults.map(r => r.url).filter(Boolean) });
  } catch (err) {
    console.error("Fuse fatal:", err && err.stack || err);
    return json(500, { error: "Fuse failed", reason: (err && err.message) || String(err) });
  }
};

/* ===== Frame color maps ===== */
const colorPalette = {
  "silver":"#C0C0C0","blue":"#0000FF","dark-blue":"#00008B","green":"#008000",
  "gold":"#FFD700","maroon":"#800000","bright-red":"#FF4949","sky-blue":"#87CEEB",
  "teal":"#008080","cyan":"#00FFFF","magenta":"#FF00FF","red-orange":"#FF4500",
  "sky-blue-light":"#ADD8E6","forest-green":"#228B22","orange":"#FFA500",
  "light-green":"#90EE90","violet":"#EE82EE","dark-violet":"#9400D3","peach":"#FFDAB9",
  "gray-gradient":"#D3D3D3","beige":"#F5F5DC","yellow-green":"#9ACD32","black":"#000000",
  "light-gray":"#D3D3D3","rose":"#FFC0CB","neon-yellow":"#FFFF00","peach-light":"#FFDAB9",
  "dark-red":"#8B0000","gray":"#808080","black-red-holo":"#8B0000","purple":"#6A0DAD",
  "neon-multicolor":"#FF00FF"
};
const card_type_map = {
  technology:{ color:"silver" },
  science:{ color:"blue" },
  investigative:{ color:"dark-blue" },
  sports:{ color:"green" },
  business:{ color:"gold" }
};
const rarityBorder = {
  Normal:{ color:"#aaa", iridescent:false },
  Rare:{ color:"#ddd", iridescent:false },
  SR:{ color:"#2d7bdc", iridescent:false },
  UR:{ color:"#7c3aed", iridescent:false },
  Quantum:{ color:"#f1c40f", iridescent:false },
  ZEOE:{ color:null, iridescent:true }
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
function text(s){ return (typeof s === "string" ? s.replace(/\s+/g," ").trim() : ""); }
function firstNonEmpty(list){ for (const v of list){ if (v && String(v).trim()) return String(v).trim(); } return ""; }

/* ---------- enriched-card helpers ---------- */
function urlOfCard(c={}, r=null){
  return (c._source_url || c.url || (c.links && c.links.url) || (r && r.url) || "").trim();
}
function asEffectArray(effects){
  if (!effects) return [];
  if (Array.isArray(effects)) {
    if (effects.length && typeof effects[0] === "object") {
      return effects.filter(e => e && text(e.text)).map(e => ({
        icons: e.icons || "", emoji: e.emoji || "", text: text(e.text)
      }));
    }
    return effects.map(t => ({ icons:"", emoji:"", text: text(String(t||"")) }))
                  .filter(e => e.text);
  }
  if (typeof effects === "string") {
    const t = text(effects);
    return t ? [{ icons:"", emoji:"", text:t }] : [];
  }
  return [];
}
function collectImages(list){
  const out = [];
  for (const v of list || []) {
    const s = String(v||"").trim();
    if (s) out.push(s);
  }
  return uniq(out);
}
function firstCardImage(c){
  if (c && c.hero && c.hero.image) return String(c.hero.image);
  if (c && c.image) return String(c.image);
  if (c && c.artwork && c.artwork.url) return String(c.artwork.url);
  if (!Array.isArray(c.card_images)) return "";
  const x = c.card_images.find(i => i && i.image_url);
  return x ? String(x.image_url) : "";
}

/* -------- crawl result -> normalized -------- */
function normalizeResult(r={}){
  const url   = (r.url || "").trim();
  const title = text(r.title || r.name);
  const desc  = text(r.description || r.desc);
  const image = (r.image || "").trim();
  const site  = text(r.siteName || r.site) || hostOf(url);
  const keys  = Array.isArray(r.keywords) ? r.keywords.filter(Boolean).map(text)
             : Array.isArray(r.keys)     ? r.keys.filter(Boolean).map(text)
             : [];
  return { url, title, desc, image, site, keys };
}

/* -------- footer (no timestamps) -------- */
function cleanFooterString(s){
  if (!s) return "";
  let out = String(s);
  out = out.replace(/\s*\|\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, ""); // remove ISO timestamp chunks
  out = out.replace(/\s*\|\s*\|/g, " | ");
  out = out.trim().replace(/^\|\s*|\s*\|$/g, "");
  return out;
}
function footerToString(f){
  const BRAND = "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber";
  try{
    if (!f) return BRAND;
    if (typeof f === "string") {
      const cleaned = cleanFooterString(f);
      return cleanFooterString([cleaned, BRAND].filter(Boolean).join(" | "));
    }
    const parts = [];
    if (Array.isArray(f.tags) && f.tags.length) parts.push(f.tags.join(" | "));
    if (f.set) parts.push(String(f.set));
    parts.push(BRAND);
    return cleanFooterString(parts.filter(Boolean).join(" | "));
  }catch{
    return BRAND;
  }
}

/* -------- frame color / rarity meta -------- */
function deriveFrameMeta(card){
  let baseColor = "#e63946"; // default accent
  const ft = String(card.frameType||"").toLowerCase().replace(/\s+/g,"_");
  if (card_type_map[ft]) {
    const key = card_type_map[ft].color;
    if (colorPalette[key]) baseColor = colorPalette[key];
  }
  let useIri = false;
  const r = card.rarity;
  if (r && rarityBorder[r]) {
    if (rarityBorder[r].iridescent) useIri = true;
    else if (rarityBorder[r].color) baseColor = rarityBorder[r].color;
  }
  return { frameColor: baseColor, iridescent: useIri };
}

/* -------- light finalization -------- */
function finalizeCard(card){
  const host = hostOf(card._source_url || "");
  const icon = firstNonEmpty([card.icon]) || fallbackIconByHost(host);
  const { frameColor, iridescent } = deriveFrameMeta(card);
  return { ...card, icon, frameColor, iridescent };
}

function fallbackIconByHost(host){
  if (!host) return "🔗";
  if (/\b(youtube|youtu\.be|tiktok|instagram|x\.com|twitter)\b/i.test(host)) return "📺";
  if (/\b(amazon|ebay|etsy|gumroad|shopify|aliexpress)\b/i.test(host)) return "🛍️";
  if (/\b(reddit|medium|substack|news|cnn|bbc|nytimes|verge|wired|bloomberg|forbes)\b/i.test(host)) return "📰";
  if (/\b(github|gitlab|npmjs|developer|docs)\b/i.test(host)) return "⚙️";
  return "🔗";
}

/* -------- card (any shape) + matching result -> preview card -------- */
function normalizeCard(c={}, r=null){
  const url   = urlOfCard(c, r);
  const hero  = c.hero || {};
  const tb    = c.typeBanner || {};
  const efb   = c.effectBox || {};
  const foot  = c.footer || {};

  // Name & Image (prefer enriched header.name)
  const name  = firstNonEmpty([c.name, c.header && c.header.name, hero.title, tb.title, r && r.title, hostOf(url), url]);
  const imgIn = firstNonEmpty([
    firstCardImage(c),
    r && r.image ? absolutize(r.url, r.image) : ""
  ]);

  // Effects (prefer explicit, else effectBox, else r.desc/title)
  let effects = asEffectArray(c.effects);
  if (!effects.length && (efb.description || (Array.isArray(efb.effects) && efb.effects.length))){
    const bundle = [];
    if (efb.description) bundle.push({ icons:"", emoji:"", text: text(efb.description) });
    if (Array.isArray(efb.effects)) for (const e of efb.effects){
      if (e && typeof e === "object" && text(e.text)) {
        bundle.push({ icons: e.icons || "", emoji: e.emoji || "", text: text(e.text) });
      } else {
        const m = text(String(e||"")); if (m) bundle.push({ icons:"", emoji:"", text: truncate(m,280) });
      }
    }
    effects = bundle;
  }
  if (!effects.length && r){
    const effTexts = [r.desc, r.title].filter(Boolean);
    effects = effTexts.slice(0,3).map(t => ({ icons:"", emoji:"", text: truncate(t, 280) }));
  }

  // Tags / Sets
  const tags = uniq([
    ...(Array.isArray(c.tags) ? c.tags.map(text) : []),
    ...(Array.isArray(foot.tags) ? foot.tags.map(text) : []),
    ...(r && r.keys || [])
  ]).slice(0,12);

  const card_sets = (Array.isArray(c.card_sets) && c.card_sets.length)
    ? c.card_sets.map(text)
    : (foot.set ? [text(foot.set)] : (r && r.site ? [r.site] : []));

  // Icon/About/Tribute/Rarity (tribute text from enrich may exist; stats ignore it)
  const icon    = firstNonEmpty([c.icon, c.header && c.header.icon, tb.emoji, hero.icon]);
  const about   = firstNonEmpty([c.about, tb.about, tb.subtitle, hero.subtitle, hero.title]);
  const tribute = firstNonEmpty([c.tribute, String(tb.stars||"")]);
  const rarity  = firstNonEmpty([c.rarity, tb.rarity, foot.rarity]);

  // Images
  const imgs = collectImages([imgIn].concat((c.card_images||[]).map(i => i.image_url)));

  return {
    id: c.id || shortHash(url || name || ""), // preserve enrich IDs
    name: text(name),
    icon: icon || "",
    about: text(about || ""),
    tribute: text(tribute || ""), // overwritten later with kneel string from category
    effects: effects.slice(0,4),
    rarity: text(rarity || ""),
    tags,
    card_sets,
    timestamp: c.timestamp || new Date().toISOString(),
    footer: footerToString(c.footer || foot),
    card_images: imgs.map(u => ({ image_url: u })),
    frameType: text(c.frameType || ""),
    category: c.category || "",
    _source_url: url
  };
}

/* -------- build from result only -------- */
function cardFromResult(r){
  const name = r.title || r.site || r.url;
  const effects = [];
  if (r.desc)  effects.push({ icons:"", emoji:"", text: truncate(r.desc, 280) });
  if (r.title && r.title !== r.desc) effects.push({ icons:"", emoji:"", text: truncate(r.title, 280) });

  const host = hostOf(r.url || "") || "";
  const icon = fallbackIconByHost(host);

  return {
    id: shortHash(r.url || name),
    name,
    icon,
    about: r.site || host,
    tribute: "",
    effects,
    rarity: "Normal",
    tags: r.keys || [],
    card_sets: r.site ? [r.site] : [],
    timestamp: new Date().toISOString(),
    footer: footerToString(""),
    card_images: r.image ? [{ image_url: absolutize(r.url, r.image) }] : [],
    frameType: "",
    category: "",
    _source_url: r.url
  };
}

/* -------- fuse many preview cards into one -------- */
function fuseCards(list){
  if (!list.length) return cardFromResult({ url:"", title:"Card", desc:"" });

  const withImg = list.find(c => (c.card_images||[]).length);
  const withEff = list.find(c => (c.effects||[]).length);
  const primary = withImg || withEff || list[0];

  const name      = firstNonEmpty([primary.name].concat(list.map(c=>c.name)));
  const icon      = firstNonEmpty([primary.icon].concat(list.map(c=>c.icon)));
  const about     = firstNonEmpty([primary.about].concat(list.map(c=>c.about)));
  const tribute   = firstNonEmpty([primary.tribute].concat(list.map(c=>c.tribute)));
  const frameType = firstNonEmpty([primary.frameType].concat(list.map(c=>c.frameType)));
  const category  = firstNonEmpty([primary.category].concat(list.map(c=>c.category)));

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
    rarity: text(primary.rarity || ""),
    tags, card_sets: sets,
    timestamp: new Date().toISOString(),
    footer: footerToString(primary.footer || ""),
    card_images: imgs.map(u => ({ image_url: u })),
    frameType,
    category,
    _source_url: primary._source_url || ""
  };
}

/* ==================== CORE STATS: CATEGORY → TRIBUTES/LEVEL/ATK/DEF ==================== */
/* Exact category → tribute cap mapping. No fallbacks, no conditions. */
const CATEGORY_MAX_TRIBUTE = {
  "Breaking News":6, "Politics":9, "National News":8, "International News":8, "Local News":7,
  "Economy":8, "Business":7, "Sales":7, "Merch":7, "Technology":8, "Science":8, "Health":7,
  "Education":7, "Environment":7, "Sports":8, "Entertainment":6, "Lifestyle":6, "Travel":7,
  "Opinion":5, "Editorial":6, "Feature Story":5, "Photojournalism":5, "Classifieds":4,
  "Comics & Puzzles":4, "Obituaries":5, "Weather":4, "Society":5, "Infotainment":5,
  "Soft News":5, "Hard News":8, "Investigative":9, "Government":10, "Zetsumetsu":10,
  "Social":5, "Crypto":8, "Meme":5, "People":5
};

const MIN_ATK = 1000, MAX_ATK = 5000;

function statsFromTributes(trib, cap){
  const fraction = trib / cap;                 // 0..1 (cap exists by contract)
  const atk = Math.round(MIN_ATK + fraction * (MAX_ATK - MIN_ATK));
  const def = Math.max(MIN_ATK, Math.round(atk * 0.8));
  return { atk, def };
}

function stampCoreStatsFromCategory(card){
  const cap   = CATEGORY_MAX_TRIBUTE[card.category]; // category is always valid per spec
  const trib  = cap;                                  // tributes = cap
  const level = trib;                                 // level = tributes
  const { atk, def } = statsFromTributes(trib, cap);

  return {
    ...card,
    tributes: trib,
    level: level,
    atk: atk,
    def: def,
    tribute: "🙇‍♂️".repeat(trib)
  };
}
