// netlify/functions/crawl.js
// Scrape → extract meta → build PREVIEW-READY card objects (no LLM, no deps).

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return resText(405, "Method Not Allowed");

    const body = safeJSON(event.body);
    if (!body) return resJSON(400, { error: "Invalid JSON body" });

    // Accept either {links:[...]} or {url:"..."}
    let links = [];
    if (Array.isArray(body.links) && body.links.length) links = body.links;
    else if (typeof body.url === "string" && body.url.trim()) links = [body.url];

    const session = body.session || "";
    if (!links.length) return resJSON(400, { error: "No links provided" });

    const results = [];
    const cards   = [];

    for (let raw of links) {
      let safeUrl = (raw || "").trim();
      if (!/^https?:\/\//i.test(safeUrl)) safeUrl = "https://" + safeUrl;

      try {
        const r = await fetch(safeUrl, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Jessica-SPZ/1.0; +https://sporez.netlify.app)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        if (!r.ok) throw new Error(`Fetch ${r.status}`);
        const html = await r.text();

        // ---- base extractions (raw) ----
        const title       = extractTitle(html) || "";
        const description = extractDescription(html) || "";
        const image       = extractHeroImage(html, safeUrl) || "";
        const siteName    = extractSiteName(html) || hostFromUrl(safeUrl);
        const keywords    = extractKeywords(html);

        results.push({
          url: safeUrl,
          title, description, image,
          siteName, keywords,
          rawHTMLLength: html.length,
        });

        // ---- card build (schema for preview.html) ----
        const card = buildCard({
          url: safeUrl,
          title,
          description,
          image,
          siteName,
          keywords,
          html
        });

        cards.push(card);

      } catch (err) {
        results.push({ url: safeUrl, error: String(err && err.message || err) });
        cards.push(emptyCardForUrl(safeUrl)); // still return a card shell so UI stays consistent
      }
    }

    return resJSON(200, { session, results, cards });
  } catch (err) {
    return resJSON(500, { error: String(err && err.message || err) });
  }
};

/* ---------------- helpers ---------------- */

function resText(statusCode, body) { return { statusCode, body }; }
function resJSON(statusCode, obj) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
function safeJSON(s) { try { return JSON.parse(s || "{}"); } catch { return null; } }

function extractTitle(html = "") {
  let m = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
       || html.match(/<meta[^>]+name=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (m) return m[1].trim();
  m = html.match(/<title>(.*?)<\/title>/i);
  return m ? m[1].trim() : "";
}
function extractDescription(html = "") {
  let m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
       || html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
       || html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i);
  return m ? m[1].trim() : "";
}
function extractSiteName(html = "") {
  const m = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  return m ? m[1].trim() : "";
}
function extractKeywords(html = "") {
  const m = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
  if (!m) return [];
  return m[1].split(",").map(s => s.trim()).filter(Boolean);
}

function extractHeroImage(html = "", baseUrl = "") {
  // Prefer OG/Twitter/link rel=image_src
  const metas = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of metas) {
    const m = html.match(re);
    if (m) {
      const u = absolutize(baseUrl, m[1].trim());
      if (isValidImage(u) && !isTrackerDomain(u)) return u;
    }
  }

  // Fallback to IMG tags, skipping pixels/trackers
  const imgs = [];
  const reImg = /<img\b[^>]*>/gi;
  let m;
  while ((m = reImg.exec(html))) {
    const tag = m[0];
    const src = getAttr(tag, "src") || getAttr(tag, "data-src") || "";
    if (!src) continue;
    const w = parseInt(getAttr(tag, "width") || "0", 10);
    const h = parseInt(getAttr(tag, "height") || "0", 10);
    const url = absolutize(baseUrl, src.trim());
    imgs.push({ url, w, h, tag });
  }
  for (const im of imgs) {
    if (!isValidImage(im.url)) continue;
    if (looksLikePixel(im)) continue;
    if (isTrackerDomain(im.url)) continue;
    return im.url;
  }
  return "";
}

function getAttr(tag, name) { const re = new RegExp(name + `=["']([^"']+)["']`, "i"); const m = tag.match(re); return m ? m[1] : ""; }
function isValidImage(u = "") {
  try {
    const x = new URL(u);
    if (!/^https?:$/i.test(x.protocol)) return false;
    if (!/\.[a-z]{2,}$/i.test(x.hostname)) return false;
    if (/^data:image\//i.test(u)) return true;
    if (/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(u)) return true;
    return true; // allow CDN images without extension
  } catch { return false; }
}
function looksLikePixel(im) {
  const u = String(im.url || "").toLowerCase();
  if (/1x1|pixel|spacer|transparent/.test(u)) return true;
  if (im.w && im.h && im.w <= 2 && im.h <= 2) return true;
  if (/[?&](width|height)=1\b/.test(u)) return true;
  return false;
}
function isTrackerDomain(u = "") {
  return /(fls-na\.amazon|amazon-adsystem|doubleclick\.net|googletagmanager|google-analytics|stats\.|segment\.io|mixpanel|adservice\.)/i.test(u);
}
function absolutize(base, src) {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return "https:" + src;
  try {
    const b = new URL(base);
    if (src.startsWith("/")) return b.origin + src;
    return new URL(src, b.origin + b.pathname).toString();
  } catch { return src; }
}
function hostFromUrl(u=""){ try{ return new URL(u).hostname.replace(/^www\./i,""); }catch{ return ""; } }

/* ---------- CARD BUILDER (for preview.html schema) ---------- */
function buildCard({ url, title, description, image, siteName, keywords, html }) {
  // icon: first emoji found in title/description (non-fake). If none, empty.
  const icon = firstEmoji(title) || firstEmoji(description) || "";

  // effects: prefer description as first effect text; second effect from first <p>/<h2> chunk if meaningful.
  const effectTexts = [];
  if (description) effectTexts.push(description);
  const extra = firstMeaningfulText(html);
  if (extra && extra !== description) effectTexts.push(extra);

  const effects = effectTexts.slice(0, 3).map(t => ({ icons: "", emoji: "", text: truncate(t, 280) }));

  // tags from meta keywords; sets from site name (non-fake attribution)
  const tags = Array.isArray(keywords) ? keywords.slice(0, 10) : [];
  const card_sets = siteName ? [siteName] : [];

  // card_images array
  const card_images = image ? [{ image_url: image }] : [];

  // timestamp ISO
  const timestamp = new Date().toISOString();

  // id: deterministic short hash of URL (so same link -> same id)
  const id = shortHash(url);

  // footer: your brand (not a fake content field)
  const footer = "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber";

  // frameType: leave empty unless you want a simple classifier (kept blank to avoid fake typing)
  const frameType = "";

  return {
    id,
    name: title || hostFromUrl(url) || url,
    icon,
    about: "",           // left blank—preview handles empty safely
    tribute: "",         // left blank (stats auto-calc will fall back to level=1)
    effects,
    // atk/def/level are auto-calculated in preview; we don't set them here
    rarity: "",          // unknown from scrape
    tags,
    card_sets,
    timestamp,
    footer,
    card_images,
    frameType
  };
}

function emptyCardForUrl(url) {
  return {
    id: shortHash(url),
    name: hostFromUrl(url) || url,
    icon: "",
    about: "",
    tribute: "",
    effects: [],
    rarity: "",
    tags: [],
    card_sets: [],
    timestamp: new Date().toISOString(),
    footer: "Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
    card_images: [],
    frameType: ""
  };
}

/* ---------- small utils ---------- */
function firstEmoji(s="") {
  const m = s.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u);
  return m ? m[0] : "";
}
function firstMeaningfulText(html="") {
  // crude grab of first substantial <p> or <h2> text
  const p = matchText(html, /<p[^>]*>(.*?)<\/p>/gi, 80);
  if (p) return p;
  const h2 = matchText(html, /<h2[^>]*>(.*?)<\/h2>/gi, 40);
  return h2 || "";
}
function matchText(html, re, minLen) {
  let m;
  while ((m = re.exec(html))) {
    const t = stripTags(m[1]).replace(/\s+/g, " ").trim();
    if (t.length >= minLen && !looksLikeCookieBanner(t)) return t;
  }
  return "";
}
function stripTags(s=""){ return s.replace(/<[^>]*>/g,""); }
function looksLikeCookieBanner(t=""){ return /cookies|consent|privacy|subscribe|newsletter|sign up|advert/i.test(t); }
function truncate(s="", n=280){ return s.length>n ? s.slice(0,n-1)+"…" : s; }

function shortHash(s="") {
  // 12-char base36 hash
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  h = Math.abs(h);
  return (h.toString(36).padStart(8,"0") + Date.now().toString(36)).slice(0,12);
}
