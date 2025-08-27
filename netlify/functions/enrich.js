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

function normalizeCategory(cat=""){
  const s = String(cat || "").toLowerCase().trim();
  if (["breaking","breaking news"].includes(s)) return "Breaking News";
  if (["politics"].includes(s)) return "Politics";
  if (["national","national news"].includes(s)) return "National News";
  if (["international","world","world news","international news"].includes(s)) return "International News";
  if (["local","local news"].includes(s)) return "Local News";
  if (["economy","economics"].includes(s)) return "Economy";
  if (["business","biz"].includes(s)) return "Business";
  if (["sales"].includes(s)) return "Sales";
  if (["merch","merchandise","store"].includes(s)) return "Merch";
  if (["tech","technology"].includes(s)) return "Technology";
  if (["science","sci"].includes(s)) return "Science";
  if (["health"].includes(s)) return "Health";
  if (["education","edu"].includes(s)) return "Education";
  if (["environment","climate","green"].includes(s)) return "Environment";
  if (["sports","sport"].includes(s)) return "Sports";
  if (["entertainment","entertain","culture"].includes(s)) return "Entertainment";
  if (["lifestyle","life"].includes(s)) return "Lifestyle";
  if (["travel","trip","tourism"].includes(s)) return "Travel";
  if (["opinion","op-ed","op ed"].includes(s)) return "Opinion";
  if (["editorial"].includes(s)) return "Editorial";
  if (["feature","feature story","longform"].includes(s)) return "Feature Story";
  if (["photojournalism","photo","photography"].includes(s)) return "Photojournalism";
  if (["classifieds","classified"].includes(s)) return "Classifieds";
  if (["comics","puzzles","comics & puzzles","comic","puzzle"].includes(s)) return "Comics & Puzzles";
  if (["obituaries","obituary","obits"].includes(s)) return "Obituaries";
  if (["weather","forecast"].includes(s)) return "Weather";
  if (["society","community"].includes(s)) return "Society";
  if (["infotainment"].includes(s)) return "Infotainment";
  if (["soft news","softnews"].includes(s)) return "Soft News";
  if (["hard news","hardnews"].includes(s)) return "Hard News";
  if (["investigative","investigation"].includes(s)) return "Investigative";
  if (["government","gov"].includes(s)) return "Government";
  if (["zetsumetsu"].includes(s)) return "Zetsumetsu";
  if (["social","social media"].includes(s)) return "Social";
  if (["crypto","cryptocurrency","defi","bitcoin","eth"].includes(s)) return "Crypto";
  if (["meme","memes"].includes(s)) return "Meme";
  if (["people","human interest"].includes(s)) return "People";

  return "People"; // fallback = always valid category
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
