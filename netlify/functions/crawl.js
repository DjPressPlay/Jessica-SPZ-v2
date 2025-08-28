OK REWRITE IT 

// netlify/functions/crawl.js
// Safer scraping -> order-agnostic meta parsing + solid fallbacks.
// Accepts: { links: [...], session? }  (also tolerates { url: "..." } )
// Returns: { session, results:[{ url,title,description,image,siteName,keywords,rawHTMLLength,enrich }] }

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return resText(405, "Method Not Allowed");

    const body = safeJSON(event.body);
    if (!body) return resJSON(400, { error: "Invalid JSON body" });

    // Accept {links:[...]} or {url:"..."}
    let links = [];
    if (Array.isArray(body.links) && body.links.length) links = body.links;
    else if (typeof body.url === "string" && body.url.trim()) links = [body.url];

    const session = body.session || "";
    if (!links.length) return resJSON(400, { error: "No links provided" });

    const results = [];
    for (let rawUrl of links) {
      let safeUrl = (rawUrl || "").trim();
      if (!/^https?:\/\//i.test(safeUrl)) safeUrl = "https://" + safeUrl;

      try {
        const r = await fetch(safeUrl, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Jessica-SPZ/1.0; +https://sporez.netlify.app)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
          }
        });
        if (!r.ok) throw new Error(`Fetch ${r.status}`);
        const html = await r.text();

        // --- robust extraction ---
        const title = extractTitle(html) || firstHeadingText(html) || hostFromUrl(safeUrl);
        const description = extractDescription(html) || firstMeaningfulText(html);
        const image = extractHeroImage(html, safeUrl) || "";
        const siteName = extractSiteName(html) || hostFromUrl(safeUrl);
        const keywords = extractKeywords(html);

        // 🧩 crypto aware
        const cryptoDesc = extractCryptoDescription(html);
        const cryptoName = extractCryptoName(html);

        results.push({
          url: safeUrl,
          title,
          description,
          image,
          siteName,
          keywords,
          rawHTMLLength: html.length,

          enrich: cryptoDesc || cryptoName ? {
            name: cryptoName || "",          // card.name
            effects: cryptoDesc
              ? [{ icons: "💹📊", emoji: "💰", text: cryptoDesc }]
              : []
          } : {}
        });
      } catch (err) {
        results.push({ url: safeUrl, error: String(err && err.message || err) });
      }
    }

    return resJSON(200, { session, results });
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
function hostFromUrl(u=""){ try{ return new URL(u).hostname.replace(/^www\./i,""); }catch{ return ""; } }

/* ----- attribute-order agnostic meta parsing ----- */
function getAttrCI(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : "";
}
function findMetaContent(html, keys) {
  const re = /<meta\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const prop = (getAttrCI(tag, "property") || "").toLowerCase();
    const name = (getAttrCI(tag, "name") || "").toLowerCase();
    if (keys.includes(prop) || keys.includes(name)) {
      const content = getAttrCI(tag, "content");
      if (content) return content.trim();
    }
  }
  return "";
}
function findLinkHref(html, relValue) {
  const re = /<link\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const rel = (getAttrCI(tag, "rel") || "").toLowerCase();
    if (rel.split(/\s+/).includes(relValue.toLowerCase())) {
      const href = getAttrCI(tag, "href");
      if (href) return href.trim();
    }
  }
  return "";
}

/* ----- text fallbacks ----- */
function stripTags(s=""){ return s.replace(/<[^>]*>/g,""); }
function firstMeaningfulText(html="") {
  let t = matchText(html, /<p[^>]*>(.*?)<\/p>/gi, 80);
  if (t) return t;
  t = matchText(html, /<h2[^>]*>(.*?)<\/h2>/gi, 40);
  return t || "";
}
function firstHeadingText(html="") {
  const t = matchText(html, /<h1[^>]*>(.*?)<\/h1>/gi, 10);
  return t || "";
}
function matchText(html, re, minLen){
  let m;
  while ((m = re.exec(html))) {
    const t = stripTags(m[1]).replace(/\s+/g, " ").trim();
    if (t.length >= (minLen || 1) && !looksLikeCookieBanner(t)) return t;
  }
  return "";
}
function looksLikeCookieBanner(t=""){ return /cookies|consent|privacy|subscribe|newsletter|sign up|advert/i.test(t); }

/* ----- field extractors ----- */
function extractTitle(html="") {
  return (
    findMetaContent(html, ["og:title","twitter:title"]) ||
    ""
  );
}
function extractDescription(html="") {
  return (
    findMetaContent(html, ["description","og:description","twitter:description"]) ||
    ""
  );
}
function extractCryptoDescription(html="") {
  return findMetaContent(html, ["description"]) || "";
}
function extractCryptoName(html="") {
  // from title or og:title (ex: "BEP-20 Token | Address: ... | BscScan")
  const raw = findMetaContent(html, ["og:title"]) || "";
  if (raw) return raw.split("|")[0].trim();
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  return match ? stripTags(match[1]).split("|")[0].trim() : "";
}
function extractSiteName(html="") {
  return findMetaContent(html, ["og:site_name"]) || "";
}
function extractKeywords(html="") {
  const s = findMetaContent(html, ["keywords"]);
  if (!s) return [];
  return s.split(",").map(x => x.trim()).filter(Boolean).slice(0, 20);
}
function extractHeroImage(html="", baseUrl="") {
  const metaImg = (
    findMetaContent(html, ["og:image","twitter:image","twitter:image:src"]) ||
    findLinkHref(html, "image_src")
  );
  if (metaImg) {
    const u = absolutize(baseUrl, metaImg);
    if (isValidImage(u) && !isTrackerDomain(u)) return u;
  }
  const imgs = [];
  const reImg = /<img\b[^>]*>/gi;
  let m;
  while ((m = reImg.exec(html))) {
    const tag = m[0];
    const src = getAttrCI(tag, "src") || getAttrCI(tag, "data-src") || "";
    if (!src) continue;
    const w = parseInt(getAttrCI(tag, "width") || "0", 10);
    const h = parseInt(getAttrCI(tag, "height") || "0", 10);
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

/* ----- URL helpers ----- */
function isValidImage(u = "") {
  try {
    const x = new URL(u);
    if (!/^https?:$/i.test(x.protocol)) return false;
    if (!/\.[a-z]{2,}$/i.test(x.hostname)) return false;
    if (/^data:image\//i.test(u)) return true;
    if (/\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(u)) return true;
    return true;
  } catch {
    return false;
  }
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
  } catch {
    return src;
  }
}
