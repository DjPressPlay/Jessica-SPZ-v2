// Dealer.js
import { CardLibrary } from './card_library.js';

export const Dealer = {
  inject(card, targetSlotId) {
    const slot = document.getElementById(targetSlotId);
    if (!slot) return;

    const el = document.createElement("div");
    el.className = "stcg-card";
    el.dataset.name = card.name;
    el.dataset.emojis = card.effects.map(e => e.emoji).join("");
    el.dataset.effects = JSON.stringify(
      Object.fromEntries(card.effects.map(e => [e.emoji, e.text]))
    );

    el.style.width = "80px";
    el.style.height = "120px";
    el.style.backgroundImage = `url('${card.card_images?.[0]?.image_url}')`;
    el.style.backgroundSize = "cover";
    el.style.border = "2px solid #ff0066";
    el.style.borderRadius = "8px";
    el.title = `${card.name}\nATK: ${card.atk} | DEF: ${card.def}`;

    slot.appendChild(el);
  },

  start() {
    const card = CardLibrary.sampleCard;
    this.inject(card, "player-hand-3");
  },

  // add draw(), shuffle(), clear() etc next
};
