// netlify/functions/search.js
// Jessica AI Search — uses Google Custom Search if env provided.
// Env: GCSE_ID, GCSE_KEY. Query: { q, num=10, start=1 }
const https = require("https");

function j(statusCode, obj){
  return { statusCode, headers: { "content-type":"application/json", "cache-control":"no-store" }, body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return j(405, { error: "Method Not Allowed" });
    const { q, num=10, start=1 } = JSON.parse(event.body || "{}");
    if (!q || typeof q !== "string") return j(400, { error: "Missing q" });

    const cx = process.env.GCSE_ID;
    const key = process.env.GCSE_KEY;
    if (!cx || !key) return j(412, { error: "Missing GCSE_ID/GCSE_KEY in environment" });

    const params = new URLSearchParams({ q, cx, key, num: String(Math.min(Math.max(num,1),10)), start: String(start) });
    const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;

    const data = await fetchJSON(url);
    const items = (data.items || []).map(it => ({
      title: it.title || "",
      link: it.link || "",
      snippet: it.snippet || "",
      image: (it.pagemap && (it.pagemap.cse_image?.[0]?.src || it.pagemap.metatags?.[0]?.["og:image"])) || "",
      source: new URL(it.link).hostname
    }));

    return j(200, { q, count: items.length, items });
  } catch (e) {
    return j(500, { error: e.message || String(e) });
  }
};

function fetchJSON(url){
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}
