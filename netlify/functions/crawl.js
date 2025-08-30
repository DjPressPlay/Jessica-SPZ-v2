// netlify/functions/crawl.js
// Jessica Crawl v2 — cleaner metadata, smarter enrichment, robust fallbacks
// Accepts: { links: [...], session? } or { url:"..." }
// Returns: { session, results:[{ url,title,description,video,image,siteName,author,profile,keywords,rawHTMLLength,enrich }] }

const PLACEHOLDER_IMG = "https://miro.medium.com/v2/resize:fit:786/format:webp/1*l0k-78eTSOaUPijHdWIhkQ.png";

// Social brand fallbacks
const BRAND_IMAGES = {
  facebook: "https://static.xx.fbcdn.net/rsrc.php/yo/r/iRmz9lCMBD2.ico",
  instagram: "https://static.cdninstagram.com/rsrc.php/ye/r/utX5f5n0hjm.ico",
  twitter: "https://abs.twimg.com/favicons/twitter.2.ico",
  x: "https://abs.twimg.com/favicons/twitter.2.ico",
  tiktok: "https://www.tiktok.com/favicon.ico"
};

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
        // --- oEmbed pass ---
        const oembedData = await tryOEmbed(safeUrl);
        if (oembedData) {
          results.push(oembedData);
          continue;
        }

        // --- fetch HTML ---
        const r = await fetch(safeUrl, {
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Jessica-SPZ/2.0; +https://sporez.netlify.app)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
          }
        });
        if (!r.ok) throw new Error(`Fetch ${r.status}`);
        const html = await r.text();

        // --- core extractions ---
        const title = extractTitle(html) || firstHeadingText(html) || hostFromUrl(safeUrl);
        const description = extractDescription(html) || "No description available";
        const siteName = extractSiteName(html) || hostFromUrl(safeUrl);
        const keywords = extractKeywords(html, title);
        const author = extractAuthor(html);
        const profile = extractProfile(html);

        // --- media ---
        const { video, image } = pickMedia({ html, baseUrl: safeUrl });

        // --- crypto enrichment (only if ticker/coin detected) ---
        const cryptoName = detectCryptoName(title, description);
        const cryptoDesc = cryptoName ? description : "";

        results.push({
          url: safeUrl,
          title,
          description,
          video: video || "",
          image: image || PLACEHOLDER_IMG,
          siteName,
          author,
          profile,
          keywords,
          rawHTMLLength: html.length,
          enrich: cryptoName ? {
            name: cryptoName,
            effects: [{ icons: "💹📊", emoji: "💰", text: cryptoDesc }]
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
function hostFromUrl(u = "") { try { return new URL(u).hostname.replace(/^www\./i, ""); } catch { return ""; } }

/* ----- media pipeline ----- */
function pickMedia({ html, baseUrl }) {
  const video = (
    findMetaContent(html, ["og:video", "twitter:player"]) ||
    (html.match(/<video[^>]+src=["']([^"']+\.(mp4|webm|ogg))["']/i)?.[1] || "")
  );
  const vidUrl = video ? absolutize(baseUrl, video) : "";

  // Try images
  const img = extractHeroImage(html, baseUrl);
  if (img) return { video: vidUrl, image: img };

  // Hard domain fallbacks
  const host = (new URL(baseUrl).hostname || "").toLowerCase();
  if (/facebook\.com/.test(host)) return { video: vidUrl, image: BRAND_IMAGES.facebook };
  if (/instagram\.com/.test(host)) return { video: vidUrl, image: BRAND_IMAGES.instagram };
  if (/tiktok\.com/.test(host)) return { video: vidUrl, image: BRAND_IMAGES.tiktok };
  if (/twitter\.com|x\.com/.test(host)) return { video: vidUrl, image: BRAND_IMAGES.twitter };

  // Google favicon fallback (catch-all)
  if (host) {
    return {
      video: vidUrl,
      image: `https://www.google.com/s2/favicons?sz=256&domain=${host}`
    };
  }

  // Absolute last resort
  return { video: vidUrl, image: PLACEHOLDER_IMG };
}

/* ----- oEmbed support ----- */
async function tryOEmbed(url) {
  const endpoints = [
    { match: /twitter\.com|x\.com/i, api: "https://publish.twitter.com/oembed?url=" },
    { match: /reddit\.com/i, api: "https://www.reddit.com/oembed?url=" },
    { match: /youtube\.com|youtu\.be/i, api: "https://www.youtube.com/oembed?url=" },
    { match: /tiktok\.com/i, api: "https://www.tiktok.com/oembed?url=" }
  ];
  for (const ep of endpoints) {
    if (ep.match.test(url)) {
      try {
        const r = await fetch(ep.api + encodeURIComponent(url));
        if (!r.ok) throw new Error("oEmbed fail");
        const data = await r.json();
        return {
          url,
          title: data.title || hostFromUrl(url),
          description: data.author_name ? `By ${data.author_name}` : "No description available",
          image: data.thumbnail_url || PLACEHOLDER_IMG,
          siteName: data.provider_name || hostFromUrl(url),
          author: data.author_name || "",
          profile: "",
          keywords: [],
          rawHTMLLength: 0,
          enrich: {}
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}

/* ----- attribute-order agnostic parsing ----- */
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

/* ----- text fallbacks ----- */
function stripTags(s = "") { return s.replace(/<[^>]*>/g, ""); }
function firstMeaningfulText(html = "") {
  let t = matchText(html, /<p[^>]*>(.*?)<\/p>/gi, 80);
  if (t) return t;
  t = matchText(html, /<h2[^>]*>(.*?)<\/h2>/gi, 40);
  return t || "";
}
function firstHeadingText(html = "") {
  const t = matchText(html, /<h1[^>]*>(.*?)<\/h1>/gi, 10);
  return t || "";
}
function matchText(html, re, minLen) {
  let m;
  while ((m = re.exec(html))) {
    const t = stripTags(m[1]).replace(/\s+/g, " ").trim();
    if (t.length >= (minLen || 1) && !looksLikeCookieBanner(t)) return t;
  }
  return "";
}
function looksLikeCookieBanner(t = "") {
  return /cookies|consent|privacy|subscribe|newsletter|sign up|advert|gdpr|tracking/i.test(t);
}

/* ----- field extractors ----- */
function extractTitle(html = "") {
  return (
    findMetaContent(html, ["og:title", "twitter:title"]) ||
    (html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || "").trim()
  );
}
function extractDescription(html = "") {
  return (
    findMetaContent(html, ["description", "og:description", "twitter:description"]) ||
    firstMeaningfulText(html)
  );
}
function extractAuthor(html = "") {
  return findMetaContent(html, ["author"]) || "";
}
function extractProfile(html = "") {
  return findMetaContent(html, ["og:profile:username", "twitter:creator", "twitter:site"]) || "";
}
function detectCryptoName(title = "", desc = "") {
  const combined = (title + " " + desc).toLowerCase();
  const match = combined.match(/\b([A-Z]{2,5})\b/);
  if (match && /btc|eth|sol|doge|matic|usdt|usdc/i.test(match[1])) {
    return match[1].toUpperCase();
  }
  return "";
}
function extractSiteName(html = "") {
  return findMetaContent(html, ["og:site_name"]) || "";
}
function extractKeywords(html = "", title = "") {
  const s = findMetaContent(html, ["keywords"]);
  if (s) return s.split(",").map(x => x.trim()).filter(Boolean).slice(0, 20);
  return title.split(/\s+/).filter(w => w.length > 3).slice(0, 10);
}

/* ----- hero image extraction ----- */
function extractHeroImage(html = "", baseUrl = "") {
  const metaImg = (
    findMetaContent(html, ["og:image", "twitter:image", "twitter:image:src"]) ||
    findLinkHref(html, "image_src")
  );
  if (metaImg) {
    const u = absolutize(baseUrl, metaImg);
    if (isValidImage(u) && !isTrackerDomain(u)) return u;
  }
  // favicon
  const faviconMatch = html.match(/<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]*>/i);
  if (faviconMatch) {
    const href = getAttrCI(faviconMatch[0], "href");
    if (href) return absolutize(baseUrl, href);
  }
  // first <img>
  const reImg = /<img\b[^>]*>/gi;
  let m;
  while ((m = reImg.exec(html))) {
    const tag = m[0];
    const src = getAttrCI(tag, "src") || getAttrCI(tag, "data-src") || "";
    if (!src) continue;
    const url = absolutize(baseUrl, src.trim());
    if (isValidImage(url) && !isTrackerDomain(url) && !looksLikePixel({ url })) return url;
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

/* ----- URL helpers ----- */
function isValidImage(u = "") {
  try {
    const x = new URL(u);
    if (!/^https?:$/i.test(x.protocol)) return false;
    if (!/\.[a-z]{2,}$/i.test(x.hostname)) return false;
    if (/^data:image\//i.test(u)) return true;
    if (/\.(png|jpe?g|webp|gif|avif|ico)(\?|#|$)/i.test(u)) return true;
    return true;
  } catch {
    return false;
  }
}
function looksLikePixel(im) {
  const u = String(im.url || "").toLowerCase();
  if (/1x1|pixel|spacer|transparent/.test(u)) return true;
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
