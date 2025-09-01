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
    this.deck = [...CardLibrary];
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

  injectCardToSlot(slotId, card, flipped = false) {
    if (!card) return;

    const slot = document.getElementById(slotId);
    if (!slot) {
      console.warn(`Slot not found: ${slotId}`);
      return;
    }

    const el = CardSlotController.createEl(card, flipped); // ✅ get full styled card
    slot.innerHTML = ""; // clear slot
    slot.appendChild(el); // ✅ render full card visually
  }
};

// 🔁 Auto-run on DOM ready
document.addEventListener("DOMContentLoaded", () => Dealer.init());

export default Dealer;
