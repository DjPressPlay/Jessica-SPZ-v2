// netlify/functions/enrich.js
// Jessica AI Enrich — convert crawled items into card schema (updated STCG mapping)

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });

    let body = {};
    try { body = JSON.parse(event.body || "{}"); }
    catch { return json(400, { error: "Invalid JSON" }); }

    const session = body.session || ("sess-" + Date.now().toString(36));
    const mode = String(body.mode || "auto").toLowerCase();

    const items = Array.isArray(body.items) ? body.items : [];
    const cards = items.map((it, i) => toCard(it, session)).filter(Boolean);

    return json(200, { session, mode, count: cards.length, cards });
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

function clampRankFromId(id=""){
  // Keep alphanumerics only, take first 6, left-pad with zeros to length 6
  const clean = String(id).replace(/[^A-Za-z0-9]/g, "");
  const first = clean.slice(0, 6);
  return first.padStart(6, "0");
}

function nowParts(){
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return { hh, mm, ss, date: d };
}

function makeTimestamp(dateMaybe){
  // If a date is provided, combine with current time; else now (ISO)
  if (!dateMaybe) return new Date().toISOString();

  try {
    const provided = String(dateMaybe).trim();

    // If it's date-only (YYYY-MM-DD), append current time (local) and let Date parse in local tz
    const dateOnlyMatch = /^(\d{4}-\d{2}-\d{2})$/.exec(provided);
    if (dateOnlyMatch) {
      const { hh, mm, ss } = nowParts();
      const local = new Date(`${dateOnlyMatch[1]}T${hh}:${mm}:${ss}`);
      return local.toISOString();
    }

    // If it's already a full datetime, just normalize
    const parsed = new Date(provided);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();

    // Fallback: now
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/* ------------- category → icons, desc1 → emoji ------------- */

function normalizeCategory(cat=""){
  const s = String(cat || "").toLowerCase().trim();
  if (!s) return "";

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

  return s;
}


// ——— Category → Effects.icons mapping (two-emoji string) ———
function iconsFromCategory(category) {
  const cat = normalizeCategory(category);
  if (cat === "Breaking News")     return "🚨🗞️";
  if (cat === "Politics")          return "🏛️🗳️";
  if (cat === "National News")     return "📰🧭";
  if (cat === "International News")return "🌍📰";
  if (cat === "Local News")        return "🏘️🗞️";
  if (cat === "Economy")           return "💹📈";
  if (cat === "Business")          return "💼📊";
  if (cat === "Sales")             return "🛒🏷️";
  if (cat === "Merch")             return "👕🛍️";
  if (cat === "Technology")        return "🔧🚀";   // (kept classic tech pair)
  if (cat === "Science")           return "🔬🧪";
  if (cat === "Health")            return "🩺🧬";
  if (cat === "Education")         return "🎓📚";
  if (cat === "Environment")       return "🌱🌎";
  if (cat === "Sports")            return "🏅🏟️";
  if (cat === "Entertainment")     return "🎭🎬";
  if (cat === "Lifestyle")         return "🌸🧘";
  if (cat === "Travel")            return "✈️🧭";
  if (cat === "Opinion")           return "💬🗣️";
  if (cat === "Editorial")         return "🖋️📜";
  if (cat === "Feature Story")     return "📖✨";
  if (cat === "Photojournalism")   return "📸📰";
  if (cat === "Classifieds")       return "📇📢";
  if (cat === "Comics & Puzzles")  return "🧩🗯️";
  if (cat === "Obituaries")        return "⚰️🕯️";
  if (cat === "Weather")           return "☀️🌧️";
  if (cat === "Society")           return "👥🏙️";
  if (cat === "Infotainment")      return "📺🎤";
  if (cat === "Soft News")         return "🪶📰";
  if (cat === "Hard News")         return "🗞️📢";
  if (cat === "Investigative")     return "🔎🗃️";
  if (cat === "Government")        return "⚖️🏛️";
  if (cat === "Zetsumetsu")        return "🪬🌀";
  if (cat === "Social")            return "📱💬";
  if (cat === "Crypto")            return "🪙🔗";
  if (cat === "Meme")              return "😂🔥";
  if (cat === "People")            return "🙇‍♂️";

  return "⭐🌌"; // default
}

function emojiFromDesc1(desc1 = "") {
  const s = String(desc1 || "").toLowerCase();

  const map = [
    // Very specific / strong signals first
    { k: /(obituar(y|ies)|passes away|in memoriam|dies\b|dead\b|rip\b)/, e: "🕯️" },
    { k: /(investigat|exposé|expose|whistleblower|leak(ed)?|probe)/,      e: "🔎" },

    // Breaking / urgency
    { k: /(breaking|urgent|just[-\s]?in|developing|alert)/,               e: "🚨" },

    // Politics / government / courts
    { k: /(election|vote|ballot|senate|house|congress|white house|president|govern(or|ment)|minister|parliament|policy|bill)/, e: "🏛️" },
    { k: /(supreme court|court|lawsuit|ruling|verdict|appeal|injunction)/,                                              e: "⚖️" },

    // Geo scope
    { k: /(international|worldwide|global|united nations|u\.n\.|nato|\beu\b|war|conflict|ceasefire|sanction)/,          e: "🌍" },
    { k: /(community|neighborhood|downtown|county|city council|local\b)/,                                              e: "🏘️" },

    // Weather / disasters
    { k: /(hurricane|tornado|storm|heatwave|snow|blizzard|wildfire|earthquake|forecast|weather)/,                        e: "🌦️" },

    // Space / rockets
    { k: /(rocket|launch|spacex|falcon|booster|orbit|nasa|space)/,                                                      e: "🛰️" },

    // Tech / AI
    { k: /(ai|artificial intelligence|neural|ml|gpt|llm|model|fine[-\s]?tune|transformer)/,                             e: "🤖" },
    { k: /(chip|gpu|cpu|semiconductor|driver|firmware|software|app|update|patch|release)/,                              e: "🛠️" },

    // Finance / business / crypto
    { k: /(money|price|market|stock|shares|earnings|revenue|profit|ipo|merger|acquisition|layoffs|jobs|inflation|gdp|cpi)/, e: "💹" },
    { k: /(bitcoin|\bbtc\b|ethereum|\beth\b|token|airdrop|defi|on[-\s]?chain|nft|web3|wallet|exchange)/,                e: "🪙" },
    { k: /(sale|discount|deal|coupon|merch|hoodie|shirt|drop|collection|store|shop)/,                                    e: "🛒" },

    // Science / health / education / environment
    { k: /(science|research|study|paper|peer[-\s]?review|experiment|lab)/,                                              e: "🔬" },
    { k: /(health|disease|virus|covid|vaccine|treatment|clinical|mental health|wellness|outbreak)/,                     e: "🩺" },
    { k: /(school|teacher|student|university|college|campus|curriculum|classroom|exam)/,                                e: "🎓" },
    { k: /(climate|emissions|co2|sustainab|renewable|recycling|deforestation|biodiversity|environment)/,                e: "🌱" },

    // Sports
    { k: /(game|match|score|goal|touchdown|playoffs|championship|league|\bnba\b|\bnfl\b|\bmlb\b|\bnhl\b|\bfifa\b)/,     e: "🏅" },

    // Entertainment / media / lifestyle / travel
    { k: /(trailer|movie|film|tv|series|episode|cast|celebrity|album|music video|premiere|oscars|grammys)/,             e: "🎬" },
    { k: /(watch|livestream|streaming|watch now)/,                                                                      e: "🎥" },
    { k: /(fashion|home|design|beauty|diet|recipe|food|wellness|lifestyle)/,                                            e: "🌸" },
    { k: /(flight|airline|airport|visa|passport|hotel|itinerary|tour|travel)/,                                          e: "✈️" },

    // Opinion / feature / photo / classifieds / puzzles
    { k: /(opinion|op[-\s]?ed|analysis|commentary|column|editorial)/,                                                   e: "💬" },
    { k: /(feature|deep dive|longform|profile|in[-\s]?depth)/,                                                          e: "📖" },
    { k: /(gallery|photos|photo essay|slideshow|high[-\s]?res)/,                                                        e: "📸" },
    { k: /(listing|for sale|for rent|hiring|job posting|vacancy)/,                                                      e: "📇" },
    { k: /(crossword|sudoku|puzzle|comic|strip|webcomic|panel)/,                                                        e: "🧩" },

    // Social / memes / security / Zetsu / people
    { k: /(trend|viral|tiktok|instagram|youtube|reddit|twitter|\bx\b|social media)/,                                    e: "📱" },
    { k: /(meme|shitpost|dank|haha|lol|funny|joke)/,                                                                     e: "😂" },
    { k: /(breach|ransomware|malware|exploit|\bcve\b|zero[-\s]?day|phishing|hack)/,                                     e: "🛡️" },
    { k: /(zetsumetsu|eoe|artworqq|jessica spz|signalz|sporez|\bzetsu\b)/,                                              e: "🪬" },
    { k: /(people|interview|q&a|q & a|biography|bio|who is)/,                                                            e: "🙇‍♂️" },
  ];

  for (const { k, e } of map) if (k.test(s)) return e;
  return "🧩"; // default
}


/* ---------------- core transform ---------------- */
function toCard(it = {}, session) {
  const url = it.url || it.link || "";
  if (!url) return null;

  const title = (it.title || it.name || "").toString().trim();

  // Two-line description model for effects/description
  const desc1 = (it.desc1 || it.description1 || it.snippet1 || "").toString().trim();
  const desc2 = (it.desc2 || it.description2 || it.snippet2 || "").toString().trim();

  const image = (it.image || it.img || it.thumbnail || "").toString().trim();

  // brand/about: prefer brand, then source, then siteName from upstream
  const brand = (it.brand || it.source || it.siteName || "").toString().trim();

  // tags: accept tags or keywords, then trim + dedupe + cap 20
  const rawTags = Array.isArray(it.tags) ? it.tags
                : Array.isArray(it.keywords) ? it.keywords
                : [];
  const tags = [...new Set(rawTags.map(t => String(t).trim()).filter(Boolean))].slice(0, 20);

  const date = it.date || null;
  const timestamp = makeTimestamp(date); // date + current time, else now()

  // rank derived from it.id (6-char alnum, left-padded with zeros)
  const rank = clampRankFromId(it.id || "");

  // category / icon / tribute
  const categoryInput = (it.category ?? it.catagory ?? it.icon ?? "").toString().trim();
  const icon = (it.icon ?? it.category ?? it.catagory ?? "").toString().trim();
  const category = normalizeCategory(categoryInput); // canonical Title-Case
  const tribute = (it.tribute || it.categoryNumber || it.categoryId || "").toString().trim();

  // siteName for card_sets (prefer actual host), fallback to brand
  const siteName = (it.siteName || hostFromUrl(url) || brand || "").toString().trim();

  // card_sets rule: [ SITENAME, `${YYYY} ABOUT` ]
  const yyyy = (new Date(timestamp)).getUTCFullYear();
  const about = brand;
  const card_sets = [siteName, `${yyyy} ${about}`].filter(Boolean);

  // Build effects (no date line)
  const icons = iconsFromCategory(category);
  const emoji = emojiFromDesc1(desc1);

  const effects = [];
  if (desc1) effects.push({ icons, emoji, text: desc1 });
  if (desc2) effects.push({ icons, emoji, text: desc2 });

  return {
    id: `card-${session}-${rank}`,
    session,

    header: {
      id: `#${rank}`,
      name: title,
      icon: icon || "✨" // category = icon (if provided)
    },

    artwork: {
      url: image,
      alt: title || "artwork"
    },

    typeBanner: {
      tribute,
      about: brand,
      emoji: "🧩" // banner stays simple; effect emojis come from desc1
    },

    effectBox: {
      description: desc1 || desc2 || "",
      effects
    },

    footer: {
      tags,
      set: "Jessica AI • SPZ",
      timestamp
    },

    // STCG extras expected downstream
    card_sets,

    // Preserve URL linkage
    links: { url }
  };
}
