// Dealer.js

export const Dealer = {
  injectCard(slotId, cardData) {
    const slot = document.getElementById(slotId);
    if (!slot || !cardData) return;

    // Clean out previous card (1 per slot)
    Dealer.removeCard(slotId);

    const el = document.createElement("div");
    el.className = "stcg-card";
    el.dataset.id = cardData.id;
    el.dataset.name = cardData.name;
    el.dataset.emojis = cardData.emojis?.join("") || "";
    el.dataset.effects = JSON.stringify(cardData.effects || {});

    el.style.width = "80px";
    el.style.height = "120px";
    el.style.backgroundImage = `url('${cardData.img}')`;
    el.style.backgroundSize = "cover";
    el.style.border = "2px solid #0ff";
    el.style.borderRadius = "8px";

    el.title = `${cardData.name}\nATK: ${cardData.atk} | DEF: ${cardData.def}`;

    slot.appendChild(el);
  },

  removeCard(slotId) {
    const slot = document.getElementById(slotId);
    if (!slot) return;
    const card = slot.querySelector(".stcg-card");
    if (card) slot.removeChild(card);
  },

  getCard(slotId) {
    const slot = document.getElementById(slotId);
    if (!slot) return null;
    return slot.querySelector(".stcg-card");
  }
};
