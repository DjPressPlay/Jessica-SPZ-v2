// Jessica-SPZ Frontend Logic — Clean Rewrite (crawl → enrich → fuse)
// Drop-in replacement. Keeps your existing DOM IDs / buttons.

(() => {
  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const sid       = $("sid");
  const logEl     = $("log");
  const jsonEl    = $("json");
  const heroImg   = $("heroImg");
  const heroTitle = $("heroTitle");
  const heroSub   = $("heroSub");
  const heroCta   = $("heroCta");
  const productsEl= $("products");
  const infoEl    = $("info");
  const footerEl  = $("footer");

  // ---------- State ----------
  let fusedData = {};
  let sessionId = "sess-" + Date.now().toString(36);
  if (sid) sid.textContent = sessionId;

  // ---------- Utils ----------
  const now = () => new Date().toLocaleTimeString();
  function log(msg) {
    if (!logEl) return;
    logEl.textContent += `\n[${now()}] ${msg}`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setJSON(data) {
    if (!jsonEl) return;
    try {
      jsonEl.textContent = JSON.stringify(data, null, 2);
    } catch {
      jsonEl.textContent = String(data);
    }
  }

  async function fetchJSON(url, bodyObj) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj || {})
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`${url} → ${res.status} ${t}`);
    }
    return res.json();
  }

  function clearPreview() {
    if (heroImg)   { heroImg.src = ""; heroImg.style.display = "none"; }
    if (heroTitle) heroTitle.textContent = "";
    if (heroSub)   heroSub.textContent = "";
    if (heroCta)   heroCta.textContent = "";
    if (productsEl) productsEl.innerHTML = "";
    if (infoEl)     infoEl.innerHTML = "";
    if (footerEl)   footerEl.textContent = "";
  }

  // ---------- Pipeline ----------
  async function runCrawlAndFuse() {
    log("Starting run…");
    clearPreview();

    const links = ($("links")?.value || "")
      .split("\n").map(s => s.trim()).filter(Boolean);

    if (!links.length) {
      alert("Please paste at least one link.");
      return;
    }

    const mode = document.querySelector("input[name=mode]:checked")?.value || "auto";
    const defaults = {
      sell: $("defSell")?.checked ?? true,
      info: $("defInfo")?.checked ?? false
    };

    try {
      // 1) Crawl
      log("Crawl → /api/crawl");
      const crawl = await fetchJSON("/api/crawl", { links, session: sessionId });
      const results = Array.isArray(crawl.results) ? crawl.results : [];
      // Some crawlers already produce proto-cards
      const crawlCards = Array.isArray(crawl.cards) ? crawl.cards : [];
      log(`Crawl complete. results=${results.length}, cards=${crawlCards.length}`);

      // 2) Enrich (best-effort). If endpoint missing, fallback silently.
      let enrichedCards = [];
      try {
        log("Enrich → /api/enrich");
        const enrich = await fetchJSON("/api/enrich", {
          session: sessionId,
          mode,
          items: results
        });
        enrichedCards = Array.isArray(enrich.cards) ? enrich.cards : [];
        log(`Enrich complete. cards=${enrichedCards.length}`);
      } catch (e) {
        log(`(enrich skipped) ${e.message}`);
      }

      // Combine any cards we have (enrich first, then crawl-provided)
      // Fuse prefers first non-empty fields, so order matters.
      const cards = [...enrichedCards, ...crawlCards];

      // 3) Fuse
      log("Fuse → /api/fuse");
      fusedData = await fetchJSON("/api/fuse", {
        session: sessionId,
        mode,
        defaults,
        results,
        cards
      });

      log(`Fusion complete. mode=${fusedData.mode || mode}`);
      setJSON(fusedData);

      // Render preview
      renderPreview(fusedData);
    } catch (err) {
      log(`⛔ Error: ${err.message}`);
    }
  }

  // ---------- Render ----------
  function renderPreview(data) {
    const hero = data?.hero || {};
    // Hero image
    if (heroImg) {
      const src = hero.image || "";
      heroImg.src = src;
      heroImg.style.display = src ? "block" : "none";
    }
    // Hero text
    if (heroTitle) heroTitle.textContent = hero.title || "No Title";
    if (heroSub)   heroSub.textContent   = hero.subtitle || "";

    // CTA (build DOM instead of innerHTML)
    if (heroCta) {
      heroCta.innerHTML = "";
      if (hero.ctaText) {
        const a = document.createElement("a");
        a.href = hero.ctaLink || "#";
        a.target = "_blank";
        a.style.background = "#00f0ff";
        a.style.color = "#000";
        a.style.padding = "6px 12px";
        a.style.borderRadius = "6px";
        a.style.textDecoration = "none";
        a.textContent = hero.ctaText;
        heroCta.appendChild(a);
      }
    }

    // Products
    if (productsEl) {
      productsEl.innerHTML = "";
      const arr = Array.isArray(data.products) ? data.products : [];
      for (const p of arr) {
        const el = document.createElement("div");
        el.className = "prod";

        if (p.image) {
          const img = document.createElement("img");
          img.src = p.image;
          img.alt = "";
          el.appendChild(img);
        }

        const name = document.createElement("div");
        name.className = "name";
        name.textContent = p.name || "";
        el.appendChild(name);

        if (p.price) {
          const price = document.createElement("div");
          price.className = "price";
          price.textContent = p.price;
          el.appendChild(price);
        }

        if (p.description) {
          const desc = document.createElement("div");
          desc.style.color = "#9db3c9";
          desc.style.fontSize = "12px";
          desc.textContent = p.description;
          el.appendChild(desc);
        }

        if (p.link) {
          const a = document.createElement("a");
          a.href = p.link;
          a.target = "_blank";
          a.textContent = "View";
          el.appendChild(a);
        }

        productsEl.appendChild(el);
      }
    }

    // Info / Articles
    if (infoEl) {
      infoEl.innerHTML = "";
      const arts = Array.isArray(data.articles) ? data.articles : [];
      for (const a of arts) {
        const wrap = document.createElement("div");
        wrap.className = "article";

        const h3 = document.createElement("h3");
        h3.textContent = a.heading || "";
        wrap.appendChild(h3);

        const content = document.createElement("div");
        // Use textContent to avoid accidental HTML injection
        content.textContent = a.content || "";
        wrap.appendChild(content);

        infoEl.appendChild(wrap);
      }
    }

    if (footerEl) {
      footerEl.textContent = `SporeZ • Jessica-SPZ • ${data.slug || ""}`;
    }
  }

  // ---------- Preview & Publish ----------
  function openLivePreview(data) {
    if (!data || !data.hero) {
      alert("Run Crawl + Fuse first.");
      return;
    }
    // Encode JSON → base64 for the preview page
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    const b64 = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""));
    const url = `/preview.html#j=${b64}`;
    window.open(url, "_blank");
  }

  async function publishPage() {
    if (!fusedData || !fusedData.hero) {
      alert("Run Crawl + Fuse first.");
      return;
    }
    const slugInput = $("slug")?.value.trim();
    if (slugInput) fusedData.slug = slugInput;

    try {
      const out = await fetchJSON("/api/publish_via_deploy", {
        fused: fusedData,
        session: sessionId
      });
      log("Published at: " + (out.url || "(no url)"));
      if (out.url) window.open(out.url, "_blank");
    } catch (err) {
      log(`⛔ Publish error: ${err.message}`);
    }
  }

  // ---------- Button bindings ----------
  $("btn-run")?.addEventListener("click", runCrawlAndFuse);
  $("btn-preview")?.addEventListener("click", () => openLivePreview(fusedData));
  $("btn-publish")?.addEventListener("click", publishPage);
})();
