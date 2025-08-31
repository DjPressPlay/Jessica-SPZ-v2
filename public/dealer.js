// DealerController.js
// One script to rule them all — manages deck, slots, injects, start, draw.

import { CardLibrary } from './cardData.js';

const Dealer = {
  deck: [],
  graveyard: [],
  hand: [],
  turn: 'player',

  init() {
    this.loadDeck();
    this.startGame();
  },

  loadDeck() {
    this.deck = [...CardLibrary];
    // Optional shuffle
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  },

  startGame() {
    console.log('🎮 Game Started');
    const startingCard = this.drawCard();
    this.injectCardToSlot('player-hand-3', startingCard);
  },

  drawCard() {
    if (this.deck.length === 0) return null;
    return this.deck.shift();
  },

  injectCardToSlot(slotId, card) {
    if (!card) return;
    const slot = document.getElementById(slotId);
    if (!slot) return;

    const el = document.createElement("div");
    el.className = "stcg-card";
    el.dataset.id = card.id;
    el.dataset.name = card.name;
    el.dataset.emojis = card.emojis.join("");
    el.dataset.effects = JSON.stringify(card.effects);
    el.style.width = "80px";
    el.style.height = "120px";
    el.style.backgroundImage = `url('${card.img}')`;
    el.style.backgroundSize = "cover";
    el.style.border = "2px solid #ff0066";
    el.style.borderRadius = "8px";
    el.title = `${card.name}\nATK: ${card.atk} | DEF: ${card.def}`;

    slot.innerHTML = "";
    slot.appendChild(el);
  }
};

// Initialize Dealer on DOM ready
document.addEventListener("DOMContentLoaded", () => Dealer.init());

export default Dealer;
