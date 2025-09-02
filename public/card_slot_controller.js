// CardSlotController.js — uses enrich.js schema + render_stcg_card layout

import { renderSTCGCard } from './render_stcg_card.js';

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
      emojis:    enriched.emojis || [],
      imageUrl:  img
    };
  },

  // ---- 2) Render card using the new render engine (flipped handled internally)
  createEl(card, flipped = false) {
    const el = renderSTCGCard(card, { flipped });
    el.dataset.id     = card.id;
    el.dataset.rarity = card.rarity;
    el.dataset.frame  = (card.frameType || "general").toLowerCase();
    el.dataset.color  = (card.color || "silver").toLowerCase();
    el.classList.add("stcg-card-wrapper");

    el.addEventListener("click", () => this.toggleFlip(el));
    return el;
  },

  // ---- 3) Inject into slot by ID
  injectToSlot(slotId, enrichedCard, flipped = false) {
    const slot = document.getElementById(slotId);
    if (!slot) return;

    const card = this.normalize(enrichedCard);
    const node = this.createEl(card, flipped);
    slot.innerHTML = "";
    slot.appendChild(node);
  },

  // ---- 4) Flip logic
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
