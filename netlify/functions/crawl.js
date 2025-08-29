// netlify/functions/crawl.js
// Accepts: { links: [...], session? }  (also tolerates { url:"..." })
// Returns: { session, results:[{ url,cardName,about,image,video,siteName,keywords,rawHTMLLength }] }

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

        // --- extraction ---
        const about = extractDescription(html) || firstMeaningfulText(html);
        const image = extractHeroImage(html, safeUrl) || "";
        const video = extractVideo(html) || "";
        const siteName = extractSiteName(html) || hostFromUrl(safeUrl);
        const keywords = extractKeywords(html);
        const cardName = extractAuthor(html) || extractFromOgTitle(html) || siteName;

        results.push({
          url: safeUrl,
          cardName,
          about,
          image,
          video,
          siteName,
          keywords,
          rawHTMLLength: html.length
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

/* ----- meta parsing ----- */
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
function extractDescription(html="") {
  return (
    findMetaContent(html, ["description","og:description","twitter:description"]) ||
    ""
  );
}
function extractAuthor(html="") {
  return (
    findMetaContent(html, [
      "author", "og:profile:username", "twitter:creator", "twitter:site"
    ]) || ""
  );
}
function extractFromOgTitle(html="") {
  const t = findMetaContent(html, ["og:title"]) || "";
  if (/^@/.test(t)) return t.split(" ")[0]; // IG/TikTok style
  if (t.includes("on Instagram:")) return t.split(" on Instagram:")[0];
  if (t.includes("on TikTok:")) return t.split(" on TikTok:")[0];
  if (t.includes("shared a post")) return t.replace("shared a post","").trim();
  return "";
}
function extractVideo(html="") {
  return (
    findMetaContent(html, ["og:video","og:video:url","twitter:player"]) ||
    ""
  );
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
function isTrackerDomain(u = "") {
  return /(doubleclick\.net|googletagmanager|google-analytics|stats\.|segment\.io|mixpanel|adservice\.)/i.test(u);
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
