// netlify/functions/enrich.js
// Jessica AI Enrich — convert crawled items into final card schema

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

    let body = {};
    try { body = JSON.parse(event.body || "{}"); }
    catch { return json(400, { error: "Invalid JSON" }); }

    const items = Array.isArray(body.items) ? body.items : [];
    const cards = items.map((it) => toCard(it)).filter(Boolean);

    return json(200, { count: cards.length, cards });
  } catch (e) {
    return json(500, { error: e?.message || String(e) });
  }
};

/* ---------------- utils ---------------- */

function json(statusCode, obj){
  return {
    statusCode,
    headers: { "content-type":"application/json", "cache-control":"no-store" },
    body: JSON.stringify(obj)
  };
}

function hostFromUrl(u=""){
  try { return new URL(u).hostname.replace(/^www\./i,""); }
  catch { return ""; }
}

function makeTimestamp(dateMaybe){
  if (!dateMaybe) return new Date().toISOString();
  try {
    const parsed = new Date(dateMaybe);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/* ---------------- category + emoji mapping ---------------- */
function normalizeCategory(cat = "", keywords = []) {
  const s = String(cat || "").toLowerCase().trim();

  // 1. Check keywords against the known group
  for (const kw of keywords) {
    const k = String(kw || "").toLowerCase().trim();
    if (k.includes("breaking")) return "Breaking News";
    if (k.includes("politic")) return "Politics";
    if (k.includes("national")) return "National News";
    if (k.includes("international") || k.includes("world")) return "International News";
    if (k.includes("local")) return "Local News";
    if (k.includes("economy")) return "Economy";
    if (k.includes("business") || k.includes("biz")) return "Business";
    if (k.includes("sales")) return "Sales";
    if (k.includes("merch")) return "Merch";
    if (k.includes("tech")) return "Technology";
    if (k.includes("science")) return "Science";
    if (k.includes("health") || k.includes("medical")) return "Health";
    if (k.includes("edu")) return "Education";
    if (k.includes("climate") || k.includes("environment") || k.includes("green")) return "Environment";
    if (k.includes("sport")) return "Sports";
    if (k.includes("entertain")) return "Entertainment";
    if (k.includes("lifestyle")) return "Lifestyle";
    if (k.includes("travel") || k.includes("tourism")) return "Travel";
    if (k.includes("opinion")) return "Opinion";
    if (k.includes("editorial")) return "Editorial";
    if (k.includes("feature")) return "Feature Story";
    if (k.includes("photo")) return "Photojournalism";
    if (k.includes("classified")) return "Classifieds";
    if (k.includes("comic") || k.includes("puzzle")) return "Comics & Puzzles";
    if (k.includes("obitu")) return "Obituaries";
    if (k.includes("weather") || k.includes("forecast")) return "Weather";
    if (k.includes("society") || k.includes("community")) return "Society";
    if (k.includes("infotainment")) return "Infotainment";
    if (k.includes("soft news")) return "Soft News";
    if (k.includes("hard news")) return "Hard News";
    if (k.includes("investigat")) return "Investigative";
    if (k.includes("gov")) return "Government";
    if (k.includes("zetsu")) return "Zetsumetsu";
    if (k.includes("social")) return "Social";
    if (k.includes("crypto") || k.includes("bitcoin") || k.includes("eth") || k.includes("defi")) return "Crypto";
    if (k.includes("meme")) return "Meme";
if (k.includes("people") || k.includes("human") || k.includes("social media")) return "People";
  }

  // 2. If no keyword match → force pick from existing group
  const allCategories = Object.keys(emojiMap); // the group you defined
  const idx = Math.floor(Math.random() * allCategories.length);
  return allCategories[idx]; // always returns a valid one from your set
}


const emojiMap = {
 "Breaking News": "🚨", "Politics": "🏛️", "National News": "📰",
  "International News": "🌍", "Local News": "🏘️", "Economy": "💹",
  "Business": "💼", "Sales": "🛒", "Merch": "👕", "Technology": "🤖",
  "Science": "🔬", "Health": "🩺", "Education": "🎓", "Environment": "🌱",
  "Sports": "🏅", "Entertainment": "🎭", "Lifestyle": "🌸", "Travel": "✈️",
  "Opinion": "💬", "Editorial": "🖋️", "Feature Story": "📖", "Photojournalism": "📸",
  "Classifieds": "📇", "Comics & Puzzles": "🧩", "Obituaries": "⚰️",
  "Weather": "☀️", "Society": "👥", "Infotainment": "📺", "Soft News": "🪶",
  "Hard News": "🗞️", "Investigative": "🔎", "Government": "⚖️", "Zetsumetsu": "🪬",
  "Social": "📱", "Crypto": "🪙", "Meme": "😂", "People": "🙇‍♂️"
};

function categoryMap(category) {
  switch (category) {
   
   case "Breaking News":     return { icon:"🚨🗞️", rarity:"UR", frameType:"breaking_news", color:"bright-red", max_tribute:6 };
    case "Politics":          return { icon:"🏛️🗳️", rarity:"SR", frameType:"politics",      color:"maroon",     max_tribute:9 };
    case "National News":     return { icon:"📰🧭", rarity:"R",   frameType:"national_news",      color:"dark-blue",         max_tribute:8 };
    case "International News":return { icon:"🌍📰", rarity:"UR",  frameType:"international_news", color:"blue",              max_tribute:8 };
    case "Local News":        return { icon:"🏘️🗞️", rarity:"R",   frameType:"local_news",         color:"sky-blue",          max_tribute:7 };
    case "Economy":           return { icon:"💹📈", rarity:"SR",  frameType:"economy",            color:"teal",              max_tribute:8 };
    case "Business":          return { icon:"💼📊", rarity:"SR",  frameType:"business",           color:"gold",              max_tribute:7 };
    case "Sales":             return { icon:"🛒🏷️", rarity:"R",   frameType:"sales",              color:"cyan",              max_tribute:7 };
    case "Merch":             return { icon:"👕🛍️", rarity:"R",   frameType:"merch",              color:"magenta",           max_tribute:7 };
    case "Technology":        return { icon:"🔧🚀", rarity:"SR",  frameType:"technology",         color:"silver",            max_tribute:8 };
    case "Science":           return { icon:"🔬🧪", rarity:"UR",  frameType:"science",            color:"blue",              max_tribute:8 };
    case "Health":            return { icon:"🩺🧬", rarity:"SR",  frameType:"health",             color:"red-orange",        max_tribute:7 };
    case "Education":         return { icon:"🎓📚", rarity:"R",   frameType:"education",          color:"sky-blue-light",    max_tribute:7 };
    case "Environment":       return { icon:"🌱🌎", rarity:"SR",  frameType:"environment",        color:"forest-green",      max_tribute:7 };
    case "Sports":            return { icon:"🏅🏟️", rarity:"R",   frameType:"sports",             color:"green",             max_tribute:8 };
    case "Entertainment":     return { icon:"🎭🎬", rarity:"SR",  frameType:"entertainment",      color:"orange",            max_tribute:6 };
    case "Lifestyle":         return { icon:"🌸🧘", rarity:"R",   frameType:"lifestyle",          color:"light-green",       max_tribute:6 };
    case "Travel":            return { icon:"✈️🧭", rarity:"R",   frameType:"travel",             color:"teal",              max_tribute:7 };
    case "Opinion":           return { icon:"💬🗣️", rarity:"C",   frameType:"opinion",            color:"violet",            max_tribute:5 };
    case "Editorial":         return { icon:"🖋️📜", rarity:"C",   frameType:"editorial",          color:"dark-violet",       max_tribute:6 };
    case "Feature Story":     return { icon:"📖✨", rarity:"UR",  frameType:"feature_story",      color:"peach",             max_tribute:5 };
    case "Photojournalism":   return { icon:"📸📰", rarity:"R",   frameType:"photojournalism",    color:"gray",              max_tribute:5 };
    case "Classifieds":       return { icon:"📇📢", rarity:"C",   frameType:"classifieds",        color:"beige",             max_tribute:4 };
    case "Comics & Puzzles":  return { icon:"🧩🗯️", rarity:"R",   frameType:"comics_puzzles",     color:"yellow-green",      max_tribute:4 };
    case "Obituaries":        return { icon:"⚰️🕯️", rarity:"C",   frameType:"obituaries",         color:"black",             max_tribute:5 };
    case "Weather":           return { icon:"☀️🌧️", rarity:"C",   frameType:"weather",            color:"light-gray",        max_tribute:4 };
    case "Society":           return { icon:"👥🏙️", rarity:"R",   frameType:"society",            color:"rose",              max_tribute:5 };
    case "Infotainment":      return { icon:"📺🎤", rarity:"SR",  frameType:"infotainment",       color:"neon-yellow",       max_tribute:5 };
    case "Soft News":         return { icon:"🪶📰", rarity:"C",   frameType:"soft_news",          color:"peach-light",       max_tribute:5 };
    case "Hard News":         return { icon:"🗞️📢", rarity:"R",   frameType:"hard_news",          color:"dark-red",          max_tribute:8 };
    case "Investigative":     return { icon:"🔎🗃️", rarity:"UR",  frameType:"investigative",      color:"dark-blue",         max_tribute:9 };
    case "Government":        return { icon:"⚖️🏛️", rarity:"UR",  frameType:"government",         color:"gray",              max_tribute:10 };
    case "Zetsumetsu":        return { icon:"🪬🌀", rarity:"ZEOE", frameType:"zetsu",  color:"black-red-holo",    max_tribute:10 };
    case "Social":            return { icon:"📱💬", rarity:"R",   frameType:"social",             color:"rose",              max_tribute:5 };
    case "Crypto":            return { icon:"🪙🔗", rarity:"SR",  frameType:"crypto",             color:"purple",            max_tribute:8 };
    case "Meme":              return { icon:"😂🔥", rarity:"R",   frameType:"meme",               color:"neon-multicolor",   max_tribute:5 };
    case "People":            return { icon:"🙇‍♂️", rarity:"C",   frameType:"people",             color:"light-gray",        max_tribute:5 }; 
   
  }
}

/* ---------------- stat calculation ---------------- */

function calcStats(tributes) {
  const MIN_ATK = 1000, MAX_ATK = 5000;
  const atk = Math.floor(MIN_ATK + (tributes / 10) * (MAX_ATK - MIN_ATK));
  const def = Math.max(800, Math.floor(atk * 0.8));
  return { atk, def, level: tributes };
}

/* ---------------- core transform ---------------- */

function toCard(it = {}) {
  const url = it.url || it.link || "";
  if (!url) return null;

  const title = (it.title || it.name || "").trim();
  const desc1 = (it.description || it.desc1 || "").trim();
  const desc2 = (it.desc2 || "").trim();
  const image = (it.image || it.img || "").trim();
  const brand = (it.brand || it.siteName || hostFromUrl(url)).trim();
  const tags = (Array.isArray(it.keywords) ? it.keywords : []).map(t => String(t).trim());

  const rank = String((desc1 + desc2).length).padStart(6,"0");

  // Category → mapped fields
  const category = normalizeCategory(it.category || brand);
  const { icon, rarity, frameType, tributes } = categoryMap(category);

  const tribute = "🙇".repeat(tributes);
  const { atk, def, level } = calcStats(tributes);

  const yyyy = (new Date()).getUTCFullYear();
  const card_sets = [brand, `${yyyy} ${brand}`];

  const effects = [];
  if (desc1) effects.push({ icons: icon, emoji: emojiMap[category] || "🧩", text: desc1 });
  if (desc2) effects.push({ icons: icon, emoji: emojiMap[category] || "🧩", text: desc2 });

  return {
    id: rank,
    name: title,
    icon,
    about: brand,
    tribute,
    effects,
    atk, def, level,
    rarity,
    tags,
    card_sets,
    timestamp: makeTimestamp(it.date),
    footer: "Jessica AI • SPZ | Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
    card_images: [{ image_url: image }],
    frameType,
    category,
    _source_url: url
  };
}
