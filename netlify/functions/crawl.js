// netlify/functions/crawl.js
// Single-link scraper: always returns media + 2 sentences about the title.

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return resText(405, "Method Not Allowed");

    const body = safeJSON(event.body);
    if (!body || !body.url) return resJSON(400, { error: "Missing url" });

    let safeUrl = body.url.trim();
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

      const title = extractTitle(html) || firstHeadingText(html) || hostFromUrl(safeUrl);
      const sentences = extractTwoSentences(html, title);
      const media = extractMedia(html, safeUrl, true); // true = preferVideo
      const siteName = extractSiteName(html) || hostFromUrl(safeUrl);
      const keywords = extractKeywords(html);

      // return single object only
      return resJSON(200, {
        url: safeUrl,
        title,
        sentences,     // array of 2 sentences
        media,         // image or video
        siteName,
        keywords,
        rawHTMLLength: html.length
      });
    } catch (err) {
      return resJSON(500, { url: safeUrl, error: String(err && err.message || err) });
    }

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

function stripTags(s=""){ return s.replace(/<[^>]*>/g,""); }
function splitSentences(t=""){
  return t.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.length>20);
}
function tokenize(t=""){ return t.toLowerCase().split(/\W+/).filter(Boolean); }
function overlap(a,b){ const A=new Set(a); let c=0; for(const w of b) if(A.has(w)) c++; return c; }

function extractTwoSentences(html="", title=""){
  const titleTokens = tokenize(title);
  const candidates = [];
  let m;
  const re = /<(p|h2)[^>]*>(.*?)<\/\1>/gi;
  while ((m = re.exec(html))) {
    const txt = stripTags(m[2]).replace(/\s+/g," ").trim();
    if (!txt || /cookies|consent|subscribe|privacy/i.test(txt)) continue;
    splitSentences(txt).forEach(s=>candidates.push(s));
  }
  const scored = candidates.map(s => ({ s, score: overlap(titleTokens, tokenize(s)) }));
  scored.sort((a,b)=>b.score-a.score || b.s.length - a.s.length);

  const unique = [];
  for (const cand of scored) {
    if (unique.length>=2) break;
    if (!unique.find(u=>u===cand.s)) unique.push(cand.s);
  }
  while (unique.length<2) unique.push(candidates[unique.length] || "");
  return unique.slice(0,2);
}

function getAttrCI(tag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = tag.match(re);
  return m ? m[1] : "";
}
function extractMedia(html="", baseUrl="", preferVideo=false){
  const imgs=[]; let m;
  const reImg=/<img\b[^>]*>/gi;
  while((m=reImg.exec(html))){
    const tag=m[0];
    const src=getAttrCI(tag,"src")||getAttrCI(tag,"data-src")||"";
    const w=parseInt(getAttrCI(tag,"width")||"0",10);
    const h=parseInt(getAttrCI(tag,"height")||"0",10);
    if(!src) continue;
    const url=absolutize(baseUrl,src);
    imgs.push({url,w,h});
  }

  const vids=[]; const reVid=/<video\b[^>]*>[\s\S]*?<\/video>/gi;
  while((m=reVid.exec(html))){
    const tag=m[0];
    const src=getAttrCI(tag,"src")||getAttrCI(tag,"poster")||"";
    if(src) vids.push({url:absolutize(baseUrl,src)});
    const reSrc=/<source\b[^>]*>/gi; let sm;
    while((sm=reSrc.exec(tag))){
      const s2=getAttrCI(sm[0],"src");
      if(s2) vids.push({url:absolutize(baseUrl,s2)});
    }
  }

  imgs.sort((a,b)=>(b.w*b.h)-(a.w*a.h));
  if (preferVideo && vids.length) return vids[0].url;
  if (imgs.length) return imgs[0].url;
  if (vids.length) return vids[0].url;
  return "";
}

function findMetaContent(html, keys){
  const re=/<meta\b[^>]*>/gi; let m;
  while((m=re.exec(html))){
    const tag=m[0];
    const prop=(getAttrCI(tag,"property")||"").toLowerCase();
    const name=(getAttrCI(tag,"name")||"").toLowerCase();
    if(keys.includes(prop)||keys.includes(name)){
      const content=getAttrCI(tag,"content");
      if(content) return content.trim();
    }
  }
  return "";
}
function extractTitle(html=""){ return findMetaContent(html,["og:title"])||""; }
function firstHeadingText(html=""){
  const m=html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  return m?stripTags(m[1]).trim():"";
}
function extractSiteName(html=""){ return findMetaContent(html,["og:site_name"])||""; }
function extractKeywords(html=""){
  const s=findMetaContent(html,["keywords"]);
  if(!s) return [];
  return s.split(",").map(x=>x.trim()).filter(Boolean).slice(0,20);
}

function absolutize(base, src){
  if(!src) return src;
  if(/^https?:\/\//i.test(src)) return src;
  if(src.startsWith("//")) return "https:"+src;
  try{
    const b=new URL(base);
    if(src.startsWith("/")) return b.origin+src;
    return new URL(src,b.origin+b.pathname).toString();
  }catch{return src;}
}
