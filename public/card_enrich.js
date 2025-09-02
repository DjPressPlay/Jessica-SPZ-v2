

// card_enrich.js
// Local enrich (no URL). Safe with mixed library shapes.

function makeTimestamp(dateMaybe){
  if (!dateMaybe) return new Date().toISOString();
  const d = new Date(dateMaybe);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/* ---------- tags ---------- */
const masterTags = [
  "#business","#entrepreneur","#entrepreneurship","#startup","#smallbusiness",
  "#businessowner","#motivation","#success","#leadership","#entrepreneurlife",
  "#digitalmarketing","#marketing","#businesswoman","#businessman","#goals",
  "#businesstips","#hustle","#inspiration","#innovation","#startuplife",
  "#mindset","#entrepreneurs","#businessgrowth","#ceo","#entrepreneurmindset",
  "#branding","#networking","#sales","#businesssuccess","#selfemployed",
  "#money","#strategy","#smallbiz","#businesscoach",
  "#entrepreneursofinstagram","#businessideas","#workfromhome","#businessmindset",
  "#boss","#successmindset","#leadershipskills","#marketingstrategy",
  "#financialfreedom","#investor","#socialmedia","#businessdevelopment",
  "#biztips","#entrepreneurgoals","#startups","#growthmindset",
  "#onlinemarketing","#beyourownboss","#entrepreneurtips","#wealth",
  "#businessmotivation","#sidehustle","#company","#entrepreneurlifestyle",
  "#startuplifestyle","#moneytips","#entrepreneurgoals","#successstories",
  "#businessadvice","#digitalbusiness","#workhard","#selfmade","#finance",
  "#entrepreneurmind","#consulting","#innovationstrategy","#marketingdigital",
  "#businesscoaching","#teamwork","#networkmarketing","#entrepreneurjourney",
  "#vision","#scaling","#growthhacking","#entrepreneurialmindset",
  "#businesssuccessstories","#investinyourself","#ecommerce","#onlinebusiness",
  "#personalbranding","#entrepreneurialspirit","#entrepreneurialjourney",
  "#hustlemode","#founder","#venturecapital","#entrepreneurmindsetquotes",
  "#entrepreneurial","#womeninbusiness","#businessleadership","#bossbabe",
  "#dreambig","#opportunity","#entrepreneurlife","#goalsetter","#lifecoach"
];

function generateTagsFromContent(title = "", description = "", keywords = []) {
  const text = (title + " " + description).toLowerCase();
  const chosen = new Set(
    (Array.isArray(keywords) ? keywords : [])
      .map(t => String(t).trim())
      .filter(Boolean)
  );

  for (const tag of masterTags) {
    const bare = tag.slice(1).toLowerCase();
    if (text.includes(bare)) chosen.add(tag);
  }
  while (chosen.size < 5) {
    chosen.add(masterTags[Math.floor(Math.random() * masterTags.length)]);
  }
  return Array.from(chosen).slice(0, 10);
}

/* ---------- categories ---------- */
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

function normalizeCategory(cat = "", keywords = [], title = "", desc1 = "", desc2 = "", brand = "") {
  const s = String(cat || "").toLowerCase().trim();
  const pool = [].concat(keywords || [], [s, title, desc1, desc2]);

  for (const kw of pool) {
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
    if (k.includes("crypto") || k.includes("bitcoin") || k.includes("eth") || k.includes("defi")) return "Crypto";
    if (k.includes("meme")) return "Meme";
    if (k.includes("people") || k.includes("human") || k.includes("social media")) return "People";

    if (k.includes("zetsumetsu") || k.includes("zetsu") || k.includes("zetsu metsu") ||
        k.includes("artworqq") || k.includes("nios") || k.includes("zetsumetsu corporation")) {
      return "Zetsumetsu";
    }
  }
  const all = Object.keys(emojiMap);
  return all[Math.floor(Math.random() * all.length)];
}

function categoryMap(category) {
  switch (category) {
    case "Breaking News":      return { icon:"🚨🗞️", rarity:"UR",  frameType:"breaking_news",      color:"bright-red",            max_tribute:6 };
    case "Politics":           return { icon:"🏛️🗳️", rarity:"SR",  frameType:"politics",            color:"maroon",                max_tribute:9 };
    case "National News":      return { icon:"📰🧭", rarity:"R",    frameType:"national_news",       color:"dark-blue",             max_tribute:8 };
    case "International News": return { icon:"🌍📰", rarity:"UR",   frameType:"international_news",  color:"blue",                  max_tribute:8 };
    case "Local News":         return { icon:"🏘️🗞️", rarity:"R",    frameType:"local_news",          color:"sky-blue",              max_tribute:4 };
    case "Economy":            return { icon:"💹📈", rarity:"SR",   frameType:"economy",             color:"teal",                  max_tribute:3 };
    case "Business":           return { icon:"💼📊", rarity:"SR",   frameType:"business",            color:"gold",                  max_tribute:7 };
    case "Sales":              return { icon:"🛒🏷️", rarity:"R",    frameType:"sales",               color:"cyan",                  max_tribute:7 };
    case "Merch":              return { icon:"👕🛍️", rarity:"R",    frameType:"merch",               color:"magenta",               max_tribute:7 };
    case "Technology":         return { icon:"🔧🚀", rarity:"SR",   frameType:"technology",          color:"silver",                max_tribute:8 };
    case "Science":            return { icon:"🔬🧪", rarity:"UR",   frameType:"science",             color:"blue",                  max_tribute:8 };
    case "Health":             return { icon:"🩺🧬", rarity:"SR",   frameType:"health",              color:"red-orange",            max_tribute:4 };
    case "Education":          return { icon:"🎓📚", rarity:"R",    frameType:"education",           color:"sky-blue-light",        max_tribute:3 };
    case "Environment":        return { icon:"🌱🌎", rarity:"SR",   frameType:"environment",         color:"forest-green",          max_tribute:2 };
    case "Sports":             return { icon:"🏅🏟️", rarity:"R",    frameType:"sports",              color:"green",                 max_tribute:5 };
    case "Entertainment":      return { icon:"🎭🎬", rarity:"SR",   frameType:"entertainment",       color:"orange",                max_tribute:3 };
    case "Lifestyle":          return { icon:"🌸🧘", rarity:"R",    frameType:"lifestyle",           color:"light-green",           max_tribute:6 };
    case "Travel":             return { icon:"✈️🧭", rarity:"R",    frameType:"travel",              color:"teal",                  max_tribute:7 };
    case "Opinion":            return { icon:"💬🗣️", rarity:"C",    frameType:"opinion",             color:"violet",                max_tribute:5 };
    case "Editorial":          return { icon:"🖋️📜", rarity:"C",    frameType:"editorial",           color:"dark-violet",           max_tribute:6 };
    case "Feature Story":      return { icon:"📖✨", rarity:"UR",   frameType:"feature_story",       color:"peach",                 max_tribute:5 };
    case "Photojournalism":    return { icon:"📸📰", rarity:"R",    frameType:"photojournalism",     color:"gray",                  max_tribute:5 };
    case "Classifieds":        return { icon:"📇📢", rarity:"C",    frameType:"classifieds",         color:"beige",                 max_tribute:4 };
    case "Comics & Puzzles":   return { icon:"🧩🗯️", rarity:"R",    frameType:"comics_puzzles",      color:"yellow-green",          max_tribute:4 };
    case "Obituaries":         return { icon:"⚰️🕯️", rarity:"C",    frameType:"obituaries",          color:"black",                 max_tribute:5 };
    case "Weather":            return { icon:"☀️🌧️", rarity:"C",    frameType:"weather",             color:"light-gray",            max_tribute:4 };
    case "Society":            return { icon:"👥🏙️", rarity:"R",    frameType:"society",             color:"rose",                  max_tribute:5 };
    case "Infotainment":       return { icon:"📺🎤", rarity:"SR",   frameType:"infotainment",        color:"neon-yellow",           max_tribute:5 };
    case "Soft News":          return { icon:"🪶📰", rarity:"C",    frameType:"soft_news",           color:"peach-light",           max_tribute:5 };
    case "Hard News":          return { icon:"🗞️📢", rarity:"R",    frameType:"hard_news",           color:"dark-red",              max_tribute:8 };
    case "Investigative":      return { icon:"🔎🗃️", rarity:"UR",  frameType:"investigative",       color:"dark-blue",             max_tribute:9 };
    case "Government":         return { icon:"⚖️🏛️", rarity:"UR",  frameType:"government",          color:"gray",                  max_tribute:10 };
    case "Zetsumetsu":         return { icon:"🪬🌀", rarity:"ZEOE", frameType:"zetsu",               color:"linear-gradient(135deg,#e63946,#6f42c1,#00e6e6)", max_tribute:10 };
    case "Social":             return { icon:"📱💬", rarity:"R",    frameType:"social",              color:"rose",                  max_tribute:5 };
    case "Crypto":             return { icon:"🪙🔗", rarity:"SR",   frameType:"crypto",              color:"purple",                max_tribute:9 };
    case "Meme":               return { icon:"😂🔥", rarity:"R",    frameType:"meme",                color:"neon-multicolor",       max_tribute:2 };
    case "People":             return { icon:"🙇‍♂️", rarity:"C",    frameType:"people",              color:"light-gray",            max_tribute:2 };
  }
  // fallback (shouldn't hit if above stays in sync with emojiMap)
  return { icon:"🧩", rarity:"C", frameType:"misc", color:"gray", max_tribute:3 };
}

/* ---------- stats ---------- */
function calcStats(tributes) {
  const MIN_ATK = 1000, MAX_ATK = 5000;
  const atk = Math.floor(MIN_ATK + (tributes / 10) * (MAX_ATK - MIN_ATK));
  const def = Math.max(800, Math.floor(atk * 0.8));
  return { atk, def, level: tributes };
}

/* ---------- core transform (library item -> card) ---------- */
export function toCard(it = {}) {
  // Accept both "flat" lib entries and already-enriched ones.
  // Field aliases to match your lib variations:
  const title = (it.title || it.name || "").trim();
  const desc1 = (it.description || it.desc1 || "").trim();
  const desc2 = (it.desc2 || "").trim();
  const image = (it.image || it.img || (it.card_images?.[0]?.image_url) || "").trim();
  const brand = (it.brand || it.siteName || it.about || "").trim();
  const keywords = Array.isArray(it.keywords) ? it.keywords : [];

  // ID from desc length (your rule)
  const rank = String((desc1 + desc2).length).padStart(6, "0");

  const category = normalizeCategory(
    it.category || brand,
    keywords,
    title,
    desc1,
    desc2,
    brand
  );
  const { icon, rarity, frameType, max_tribute, color } = categoryMap(category);

  const tributes = max_tribute;
  const tribute = "🙇‍♂️".repeat(tributes);
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
    atk,
    def,
    level,
    tributes,
    rarity,
    tags: generateTagsFromContent(title, desc1, keywords).map(s => String(s).trim()),
    card_sets,
    timestamp: makeTimestamp(it.date),
    footer: it.footer || "Jessica AI • SPZ | Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
    card_images: [{ image_url: image }],
    frameType,
    category,
    color,
    _source_url: it._source_url || "" // stays blank for local lib
  };
}
