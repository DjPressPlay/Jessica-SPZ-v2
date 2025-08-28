// netlify/functions/crawl.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return resText(405, "Method Not Allowed");

    const body = safeJSON(event.body);
    if (!body) return resJSON(400, { error: "Invalid JSON body" });

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

        // --- generic extraction ---
        let title = extractTitle(html) || firstHeadingText(html) || hostFromUrl(safeUrl);
        let description = extractDescription(html) || firstMeaningfulText(html);
        const image = extractHeroImage(html, safeUrl) || "";
        const siteName = extractSiteName(html) || hostFromUrl(safeUrl);
        const keywords = extractKeywords(html);

        // --- crypto-aware ---
        const cryptoDesc = extractCryptoDescription(html);
        const cryptoName = extractCryptoName(html);

        // if crypto → override fields
        if (cryptoName) title = cryptoName;
        if (cryptoDesc) description = cryptoDesc;

        results.push({
          url: safeUrl,
          title,
          description,
          image,
          siteName,
          keywords,
          rawHTMLLength: html.length,

          enrich: (cryptoDesc || cryptoName) ? {
            name: cryptoName || "",
            about: "Crypto • BNB Smart Chain",
            effects: cryptoDesc
              ? [{ icons: "💹📊", emoji: "💰", text: cryptoDesc }]
              : [],
            tags: ["crypto", "blockchain", "bscscan"]
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

/* meta parsing + fallback helpers omitted for brevity, keep your existing ones */

function extractCryptoDescription(html="") {
  const meta = findMetaContent(html, ["description"]);
  if (meta && /Token Rep:|Holders:|Price:|Market Cap:/i.test(meta)) {
    return meta;
  }
  return "";
}
function extractCryptoName(html="") {
  const raw = findMetaContent(html, ["og:title"]) || "";
  if (raw && /Token|Address/i.test(raw)) return raw.split("|")[0].trim();
  const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (match && /Token|Address/i.test(match[1])) return stripTags(match[1]).split("|")[0].trim();
  return "";
}
