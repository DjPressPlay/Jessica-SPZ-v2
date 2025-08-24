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

    // Build preview-cards from incoming cards, filling blanks from matched crawl result
    const builtCards = (cardsIn.length ? cardsIn : []).map(c => {
      const url = urlOfCard(c, null);
      const r   = byUrl[url] || null;
      return normalizeCard(c, r);
    });

    // If we had no cards, build from results directly
    if (!builtCards.length) {
      for (const r of normResults) builtCards.push(cardFromResult(r));
    }

    // Fuse into one and finalize (type → emoji/frame/stars)
    let card = fuseCards(builtCards);
    card = finalizeCard(card); // add type/emoji/frameType/tribute

    return json(200, { session, card, sources: normResults.map(r => r.url).filter(Boolean) });
  } catch (err) {
    console.error("Fuse fatal:", err && err.stack || err);
    return json(500, { error: "Fuse failed", reason: (err && err.message) || String(err) });
  }
};

/* ---------------- mappings ---------------- */
const CARD_TYPE_MAP = {
  "Breaking News": { frameType: "breaking_news",      color: "bright-red",        max_stars: 6 },
  "Politics":      { frameType: "politics",           color: "maroon",            max_stars: 9 },
  "National News": { frameType: "national_news",      color: "dark-blue",         max_stars: 8 },
  "International News": { frameType: "international_news", color: "blue",         max_stars: 8 },
  "Local News":    { frameType: "local_news",         color: "sky-blue",          max_stars: 7 },
  "Economy":       { frameType: "economy",            color: "teal",              max_stars: 8 },
  "Business":      { frameType: "business",           color: "gold",              max_stars: 7 },
  "Sales":         { frameType: "sales",              color: "cyan",              max_stars: 7 },
  "Merch":         { frameType: "merch",              color: "magenta",           max_stars: 7 },
  "Technology":    { frameType: "technology",         color: "silver",            max_stars: 8 },
  "Science":       { frameType: "science",            color: "blue",              max_stars: 8 },
  "Health":        { frameType: "health",             color: "red-orange",        max_stars: 7 },
  "Education":     { frameType: "education",          color: "sky-blue-light",    max_stars: 7 },
  "Environment":   { frameType: "environment",        color: "forest-green",      max_stars: 7 },
  "Sports":        { frameType: "sports",             color: "green",             max_stars: 8 },
  "Entertainment": { frameType: "entertainment",      color: "orange",            max_stars: 6 },
  "Lifestyle":     { frameType: "lifestyle",          color: "light-green",       max_stars: 6 },
  "Travel":        { frameType: "travel",             color: "teal-blue",         max_stars: 6 },
  "Opinion":       { frameType: "opinion",            color: "violet",            max_stars: 5 },
  "Editorial":     { frameType: "editorial",          color: "dark-violet",       max_stars: 6 },
  "Feature Story": { frameType: "feature_story",      color: "peach",             max_stars: 5 },
  "Photojournalism":{frameType: "photojournalism",    color: "gray-gradient",     max_stars: 5 },
  "Classifieds":   { frameType: "classifieds",        color: "beige",             max_stars: 4 },
  "Comics & Puzzles":{frameType:"comics_puzzles",     color: "yellow-green",      max_stars: 4 },
  "Obituaries":    { frameType: "obituaries",         color: "black",             max_stars: 5 },
  "Weather":       { frameType: "weather",            color: "light-gray",        max_stars: 4 },
  "Society":       { frameType: "society",            color: "rose",              max_stars: 5 },
  "Infotainment":  { frameType: "infotainment",       color: "neon-yellow",       max_stars: 5 },
  "Soft News":     { frameType: "soft_news",          color: "peach-light",       max_stars: 5 },
  "Hard News":     { frameType: "hard_news",          color: "dark-red",          max_stars: 8 },
  "Investigative": { frameType: "investigative",      color: "dark-blue",         max_stars: 9 },
  "Government":    { frameType: "government",         color: "gray",              max_stars: 10 },
  "Zetsumetsu":    { frameType: "zetsu",              color: "black-red-holo",    max_stars: 10, min_stars: 5 },
  "Social":        { frameType: "social",             color: "pink",              max_stars: 5 },
  "Crypto":        { frameType: "crypto",             color: "purple",            max_stars: 8 },
  "Meme":          { frameType: "meme",               color: "neon-multicolor",   max_stars: 5 }
};

const EMOJI_MAP = {
  "Breaking News":"🚨","Politics":"🏛️","National News":"📰","International News":"🌍","Local News":"🏘️",
  "Economy":"💹","Business":"💼","Sales":"🛒","Merch":"👕","Technology":"🤖","Science":"🔬","Health":"🩺",
  "Education":"🎓","Environment":"🌱","Sports":"🏅","Entertainment":"🎭","Lifestyle":"🌸","Travel":"✈️",
  "Opinion":"💬","Editorial":"🖋️","Feature Story":"📖","Photojournalism":"📸","Classifieds":"📇",
  "Comics & Puzzles":"🧩","Obituaries":"⚰️","Weather":"☀️","Society":"👥","Infotainment":"📺",
  "Soft News":"🪶","Hard News":"🗞️","Investigative":"🔎","Government":"⚖️","Zetsumetsu":"🪬",
  "Social":"📱","Crypto":"🪙","Meme":"😂","People":"🙇‍♂️"
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
function intHash(s=""){ let h=0; for(let i=0;i<s.length;i++){ h=(h*33 + s.charCodeAt(i))|0; } return Math.abs(h); }
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
    // ignore f.timestamp on purpose
    parts.push(BRAND);
    return cleanFooterString(parts.filter(Boolean).join(" | "));
  }catch{
    return BRAND;
  }
}

/* -------- type classification + stars/emoji/frame -------- */
const TYPE_LIST = Object.keys(CARD_TYPE_MAP);

function classifyType({ name="", tags=[], host="", site="", desc="" }){
  const t = (tags || []).map(x => String(x).toLowerCase());
  const nm = String(name).toLowerCase();
  const ds = String(desc).toLowerCase();
  const hs = String(host).toLowerCase();
  const st = String(site).toLowerCase();

  // explicit tag matches first
  const direct = TYPE_LIST.find(tt => t.includes(tt.toLowerCase()));
  if (direct) return direct;

  // heuristics by host/tags/keywords/name
  if (nm.includes("breaking") || t.includes("breaking")) return "Breaking News";

  if (/(gov|\.gov)$/.test(hs) || t.includes("government") || nm.includes("government") || ds.includes("government"))
    return "Government";

  if (t.some(x => ["bitcoin","crypto","blockchain","defi","web3","ethereum"].includes(x)) ||
      /(binance|coinbase|coindesk|cointelegraph|kraken|opensea)/.test(hs))
    return "Crypto";

  if (t.includes("meme") || nm.includes("meme") || /(9gag|knowyourmeme|imgflip)/.test(hs))
    return "Meme";

  if (/(espn|nba|nfl|mlb|nhl|fifa|uefa|motorsport)/.test(hs) || t.includes("sports"))
    return "Sports";

  if (/(techcrunch|theverge|wired|arstechnica|github|gitlab|npmjs|developer|dev)\b/.test(hs) || t.includes("technology") || t.includes("tech"))
    return "Technology";

  if (/(nature\.com|sciencemag|arxiv|nasa|nih\.gov)/.test(hs) || t.includes("science"))
    return "Science";

  if (/(who\.int|cdc\.gov|health|medical)/.test(hs) || t.includes("health") || t.includes("medical"))
    return "Health";

  if (/(amazon|ebay|etsy|gumroad|shopify|aliexpress)/.test(hs) || t.includes("sales") || t.includes("merch") || t.includes("shop"))
    return t.includes("merch") ? "Merch" : "Sales";

  if (t.includes("business") || t.includes("economy") || /(bloomberg|wsj|ft\.com|marketwatch|forbes)/.test(hs))
    return t.includes("economy") ? "Economy" : "Business";

  if (/(bbc|nytimes|reuters|apnews|guardian|cnn|foxnews)/.test(hs)) {
    if (t.includes("international") || nm.includes("world") || ds.includes("world")) return "International News";
    if (t.includes("national") || nm.includes("u.s.") || nm.includes("us ")) return "National News";
    return "Hard News";
  }

  if (/(weather\.com|accuweather)/.test(hs) || t.includes("weather")) return "Weather";

  if (/(travel|tripadvisor|lonelyplanet)/.test(hs) || t.includes("travel")) return "Travel";

  if (/(instagram|tiktok|twitter|x\.com|facebook|reddit)/.test(hs) || t.includes("social")) return "Social";

  if (/(zetsu|zetsumetsu)/.test(hs) || t.includes("zetsu") || t.includes("zetsumetsu")) return "Zetsumetsu";

  // fallback
  if (t.includes("soft news")) return "Soft News";
  if (t.includes("infotainment")) return "Infotainment";
  if (t.includes("opinion")) return "Opinion";
  if (t.includes("editorial")) return "Editorial";
  if (t.includes("feature")) return "Feature Story";

  return "Technology"; // sensible default
}

function stableStarsKey(card){
  const base = (card.name || "") + "|" + (card._source_url || "");
  return intHash(base);
}
function computeTributeStars(type, card){
  const cfg = CARD_TYPE_MAP[type] || {};
  const min = Math.max(1, cfg.min_stars || 1);
  const max = Math.max(min, cfg.max_stars || 6);
  const seed = stableStarsKey(card);
  const span = (max - min + 1);
  const val = (seed % span) + min;
  return String(val);
}

function finalizeCard(card){
  const host = hostOf(card._source_url || "");
  const type = classifyType({
    name: card.name, tags: card.tags, host, site: card.card_sets?.[0] || "", desc: card.effects?.[0]?.text || ""
  });

  const map = CARD_TYPE_MAP[type] || {};
  const mappedEmoji = EMOJI_MAP[type] || "";
  const icon = firstNonEmpty([card.icon, mappedEmoji]) || fallbackIconByHost(host);

  const frameType = firstNonEmpty([card.frameType, map.frameType]) || card.frameType || "";
  const tribute   = card.tribute && String(card.tribute).trim() ? String(card.tribute) : computeTributeStars(type, card);

  return {
    ...card,
    type,
    icon,
    frameType,
    tribute,
    // footer already cleaned earlier
  };
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

  // Name & Image
  const name  = firstNonEmpty([c.name, hero.title, tb.title, r && r.title, hostOf(url), url]);
  const imgIn = firstNonEmpty([
    firstCardImage(c),
    r && r.image ? absolutize(r.url, r.image) : ""
  ]);

  // Effects (prefer explicit, else effectBox, else r.desc/title)
  let effects = asEffectArray(c.effects);
  if (!effects.length && (efb.description || (Array.isArray(efb.effects) && efb.effects.length))){
    const bundle = [];
    if (efb.description) bundle.push({ icons:"", emoji:"", text: text(efb.description) });
    if (Array.isArray(efb.effects)) for (const t of efb.effects){
      const m = text(String(t||"")); if (m) bundle.push({ icons:"", emoji:"", text: truncate(m,280) });
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

  // Icon/About/Tribute/Rarity
  const icon    = firstNonEmpty([c.icon, tb.emoji, hero.icon]);
  const about   = firstNonEmpty([c.about, tb.about, tb.subtitle, hero.subtitle, hero.title]);
  const tribute = firstNonEmpty([c.tribute, String(tb.stars||"")]);
  const rarity  = firstNonEmpty([c.rarity, tb.rarity, foot.rarity]);

  // Images
  const imgs = collectImages([imgIn].concat((c.card_images||[]).map(i => i.image_url)));

  return {
    id: c.id || shortHash(url || name || ""),
    name: text(name),
    icon: icon || "",
    about: text(about || ""),
    tribute: text(tribute || ""),
    effects: effects.slice(0,4),
    rarity: text(rarity || ""),
    tags,
    card_sets,
    timestamp: c.timestamp || new Date().toISOString(),
    footer: footerToString(c.footer || foot),
    card_images: imgs.map(u => ({ image_url: u })),
    frameType: text(c.frameType || ""),
    _source_url: url
  };
}

/* -------- build from result only (sane defaults) -------- */
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
    tribute: "", // will be set in finalizeCard()
    effects,
    rarity: "Normal",
    tags: r.keys || [],
    card_sets: r.site ? [r.site] : [],
    timestamp: new Date().toISOString(),
    footer: footerToString(""),
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
    rarity: text(primary.rarity || ""),
    tags, card_sets: sets,
    timestamp: new Date().toISOString(),
    footer: footerToString(primary.footer || ""),
    card_images: imgs.map(u => ({ image_url: u })),
    frameType: text(primary.frameType || ""),
    _source_url: primary._source_url || ""
  };
}
