// DealerController.js
// One script to rule them all — uses CardSlotController to visually render full cards

import { CardLibrary } from './card_library.js';
import { CardSlotController } from './card_slot_controller.js';

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
    this.deck = [...Object.values(CardLibrary)]; // 🔄 convert CardLibrary object to array
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  },

  startGame() {
    console.log('🎮 Game Started');

    // 🟣 Inject a full visible hand using real DOM cards
    for (let i = 1; i <= 5; i++) {
      const card = this.drawCard();
      const slotId = `player-hand-${i}`;
      this.injectCardToSlot(slotId, card);
    }
  },

  drawCard() {
    if (this.deck.length === 0) return null;
    const card = this.deck.shift();
    this.hand.push(card);
    return card;
  },

  injectCardToSlot(slotId, rawCard, flipped = false) {
    if (!rawCard) return;

    const slot = document.getElementById(slotId);
    if (!slot) {
      console.warn(`Slot not found: ${slotId}`);
      return;
    }

    const enriched = CardSlotController.normalize(rawCard); // ✅ normalize first
    const el = CardSlotController.createEl(enriched, flipped); // ✅ render full styled card
    slot.innerHTML = "";
    slot.appendChild(el);
  }
};

// 🔁 Auto-run on DOM ready
document.addEventListener("DOMContentLoaded", () => Dealer.init());

export default Dealer;
