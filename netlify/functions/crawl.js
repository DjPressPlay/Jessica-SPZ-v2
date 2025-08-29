// netlify/functions/crawl.js
// Safer scraping -> order-agnostic meta parsing + solid fallbacks.
// Accepts: { links: [...], session? }  (also tolerates { url:"..." } )
// Returns: { session, results:[{ url,title,description,image,siteName,profile,keywords,rawHTMLLength,enrich }] }

// netlify/functions/crawl.js

const cheerio = require("cheerio");

const PLACEHOLDER_IMG =
  "https://miro.medium.com/v2/resize:fit:786/format:webp/1*l0k-78eTSOaUPijHdWIhkQ.png";

/**
 * Main handler for the Netlify function.
 * @param {object} event - The function event object.
 * @returns {Promise<object>} - The HTTP response.
 */
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return resText(405, "Method Not Allowed");
    }

    const body = safeJSON(event.body);
    if (!body) {
      return resJSON(400, { error: "Invalid JSON body" });
    }

    let links = [];
    if (Array.isArray(body.links) && body.links.length) {
      links = body.links;
    } else if (typeof body.url === "string" && body.url.trim()) {
      links = [body.url];
    }

    const session = body.session || "";
    if (!links.length) {
      return resJSON(400, { error: "No links provided" });
    }

    const results = [];
    for (let rawUrl of links) {
      let safeUrl = (rawUrl || "").trim();
      if (!/^https?:\/\//i.test(safeUrl)) {
        safeUrl = "https://" + safeUrl;
      }

      try {
        // --- Try oEmbed first ---
        const oembedData = await tryOEmbed(safeUrl);
        if (oembedData) {
          results.push(oembedData);
          continue;
        }

        // --- Fetch HTML with timeout ---
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        const r = await fetch(safeUrl, {
          redirect: "follow",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Jessica-SPZ/1.0; +https://sporez.netlify.app)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        clearTimeout(timeoutId);
        if (!r.ok) {
          throw new Error(`Fetch failed with status: ${r.status}`);
        }
        const html = await r.text();

        // --- Robust extraction using cheerio ---
        const $ = cheerio.load(html);
        const title = extractTitle($) || firstHeadingText($) || hostFromUrl(safeUrl);
        const description = extractDescription($) || "No description available";
        const image = extractHeroImage($, safeUrl) || PLACEHOLDER_IMG;
        const siteName = extractSiteName($) || hostFromUrl(safeUrl);
        const keywords = extractKeywords($);
        const profile = extractAuthor($) || "";
        const cryptoDesc = extractCryptoDescription($);
        const cryptoName = extractCryptoName($);

        results.push({
          url: safeUrl,
          title,
          description,
          image,
          siteName,
          profile,
          keywords,
          rawHTMLLength: html.length,
          enrich: cryptoDesc || cryptoName
            ? {
                name: cryptoName || "",
                effects: cryptoDesc
                  ? [{ icons: "💹📊", emoji: "💰", text: cryptoDesc }]
                  : [],
              }
            : {},
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

/* -------------------------------- helpers -------------------------------- */

function resText(statusCode, body) {
  return { statusCode, body };
}
function resJSON(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}
function safeJSON(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return null;
  }
}
function hostFromUrl(u = "") {
  try {
    return new URL(u).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

/* ------------------- oEmbed support for socials ------------------- */
async function tryOEmbed(url) {
  const endpoints = [
    { match: /twitter\.com|x\.com/i, api: "https://publish.twitter.com/oembed?url=" },
    { match: /reddit\.com/i, api: "https://www.reddit.com/oembed?url=" },
    { match: /youtube\.com|youtu\.be/i, api: "https://www.youtube.com/oembed?url=" },
    { match: /tiktok\.com/i, api: "https://www.tiktok.com/oembed?url=" },
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
          profile: data.author_name || "",
          keywords: [],
          rawHTMLLength: 0,
          enrich: {},
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}

/* ------------------- Field Extractors using cheerio ------------------- */

/** @param {cheerio.CheerioAPI} $ */
function extractTitle($) {
  return (
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("title").text().trim()
  );
}

/** @param {cheerio.CheerioAPI} $ */
function extractDescription($) {
  return (
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    firstMeaningfulText($)
  );
}

/** @param {cheerio.CheerioAPI} $ */
function extractAuthor($) {
  return (
    $('meta[name="author"]').attr("content") ||
    $('meta[property="og:profile:username"]').attr("content") ||
    $('meta[name="twitter:creator"]').attr("content") ||
    $('meta[name="twitter:site"]').attr("content") ||
    ""
  );
}

/** @param {cheerio.CheerioAPI} $ */
function extractCryptoDescription($) {
  return $('meta[name="description"]').attr("content") || "";
}

/** @param {cheerio.CheerioAPI} $ */
function extractCryptoName($) {
  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (ogTitle) return ogTitle.split("|")[0].trim();
  const title = $("title").text().trim();
  return title.split("|")[0].trim();
}

/** @param {cheerio.CheerioAPI} $ */
function extractSiteName($) {
  return $('meta[property="og:site_name"]').attr("content") || "";
}

/** @param {cheerio.CheerioAPI} $ */
function extractKeywords($) {
  const s = $('meta[name="keywords"]').attr("content");
  if (!s) return [];
  return s.split(",").map(x => x.trim()).filter(Boolean).slice(0, 20);
}

/** @param {cheerio.CheerioAPI} $ */
function firstMeaningfulText($) {
  const p = $("p, h2")
    .map((i, el) => $(el).text().trim())
    .get()
    .filter(t => t.length > 50 && !looksLikeCookieBanner(t));
  return p[0] || "";
}

/** @param {cheerio.CheerioAPI} $ */
function firstHeadingText($) {
  const h1 = $("h1").first().text().trim();
  return h1.length > 10 ? h1 : "";
}

/** @param {cheerio.CheerioAPI} $ */
function extractHeroImage($, baseUrl) {
  const metaImg =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $('meta[name="twitter:image:src"]').attr("content") ||
    $('link[rel="image_src"]').attr("href");

  if (metaImg) {
    const u = absolutize(baseUrl, metaImg);
    if (isValidImage(u) && !isTrackerDomain(u)) {
      return u;
    }
  }

  const images = $("img")
    .map((i, el) => {
      const img = $(el);
      const src = img.attr("src") || img.attr("data-src");
      const url = src ? absolutize(baseUrl, src) : null;
      const w = parseInt(img.attr("width") || "0", 10);
      const h = parseInt(img.attr("height") || "0", 10);
      return { url, w, h };
    })
    .get()
    .filter(
      (im) =>
        im.url &&
        !looksLikePixel(im) &&
        !isTrackerDomain(im.url) &&
        isValidImage(im.url)
    )
    .sort((a, b) => (b.w * b.h) - (a.w * a.h)); // Sort by area

  return images.length > 0 ? images[0].url : "";
}

/* ------------------- URL & General Helpers ------------------- */

function looksLikeCookieBanner(t = "") {
  return /cookies|consent|privacy|subscribe|newsletter|sign up|advert|policy|terms/i.test(t);
}

function absolutize(base, src) {
  if (!src) return src;
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}

function isValidImage(u = "") {
  try {
    const x = new URL(u);
    if (!/^https?:$/i.test(x.protocol)) return false;
    if (isTrackerDomain(u)) return false;
    if (
      /^data:image\//i.test(u) ||
      /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(u)
    ) {
      return true;
    }
    // Final check for a domain with an extension to filter out random paths
    return /\.[a-z]{2,}(\?|#|$)/i.test(x.hostname);
  } catch {
    return false;
  }
}

function looksLikePixel(im) {
  const u = String(im.url || "").toLowerCase();
  if (/1x1|pixel|spacer|transparent/.test(u)) return true;
  if (im.w && im.h && (im.w <= 2 || im.h <= 2)) return true;
  if (/[?&](width|height)=1\b/.test(u)) return true;
  return false;
}

function isTrackerDomain(u = "") {
  return /(fls-na\.amazon|amazon-adsystem|doubleclick\.net|googletagmanager|google-analytics|stats\.|segment\.io|mixpanel|adservice\.|adobedtm|criteo\.com|demdex\.net|scorecardresearch|adsrvr\.org)/i.test(u);
}
