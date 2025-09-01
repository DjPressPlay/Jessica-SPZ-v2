// CardSlotController.js — uses enrich.js schema + summon_btn template styling

const CardSlotController = {
  // ---- 1) Normalize an "enrich" card object into UI-ready fields
  normalize(enriched = {}) {
    const img =
      enriched.card_images?.[0]?.image_url ||
      enriched.image ||
      enriched.thumbnail ||
      "";

    return {
      id:        enriched.id || enriched._id || crypto.randomUUID(),
      name:      enriched.name || enriched.title || "Untitled",
      url:       enriched._source_url || enriched.url || enriched.link || "",
      about:     enriched.about || enriched.siteName || "",
      rarity:    enriched.rarity || "N",
      frameType: enriched.frameType || enriched.category || "general",
      color:     enriched.color || "silver",
      atk:       String(enriched.atk ?? ""),
      def:       String(enriched.def ?? ""),
      tribute:   enriched.tribute || enriched.tributes || "",
      effects:   Array.isArray(enriched.effects) ? enriched.effects : [],
      // emojis/icons
      emojis:    enriched.emojis || [],
      // image list (summon_btn expects first url)
      imageUrl:  img
    };
  },

  // ---- 2) Build DOM using the SAME structure & data-* hooks as summon_btn.html
  createEl(card, flipped = false) {
    const el = document.createElement("div");
    el.className = "stcg-card" + (flipped ? " flipped" : "");
    el.dataset.id       = card.id;
    el.dataset.rarity   = card.rarity;
    el.dataset.frame    = (card.frameType || "general").toLowerCase();
    el.dataset.color    = (card.color || "silver").toLowerCase();

    el.innerHTML = `
      <div class="stcg-card__inner">
        <div class="stcg-card__front">
          <div class="stcg-card__border">
            <div class="stcg-card__name">${card.name}</div>
            <div class="stcg-card__image" style="background-image:url('${card.imageUrl}')"></div>

            <div class="stcg-card__stats">
              <span class="atk">ATK: ${card.atk || "-"}</span>
              <span class="def">DEF: ${card.def || "-"}</span>
            </div>

            <div class="stcg-card__effects">
              ${
                (card.effects || [])
                  .map(e => `<div class="effect"><span class="icons">${e.icons || ""}</span><span class="txt">${e.text || ""}</span></div>`)
                  .join("")
              }
            </div>

            <div class="stcg-card__footer">
              <span class="about">${card.about || ""}</span>
              <span class="tribute">${card.tribute || ""}</span>
            </div>
          </div>
        </div>

        <div class="stcg-card__back"></div>
      </div>
    `;

    // optional: click to flip
    el.addEventListener("click", () => this.toggleFlip(el));
    return el;
  },

  // ---- 3) Public inject — slotId = any board slot (e.g. "player-hand-3")
  injectToSlot(slotId, enrichedCard, flipped = false) {
    const slot = document.getElementById(slotId);
    if (!slot) return;

    const card = this.normalize(enrichedCard);
    const node = this.createEl(card, flipped);
    slot.innerHTML = "";
    slot.appendChild(node);
  },

  // ---- 4) Helpers
  toggleFlip(el) {
    if (!el) return;
    el.classList.toggle("flipped");
  },
  setFace(el, face = "front") {
    if (!el) return;
    el.classList.toggle("flipped", face === "back");
  }
};

export { CardSlotController };
