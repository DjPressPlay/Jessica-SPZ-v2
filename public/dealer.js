// DealerController.js
// Manages deck, slot injection, game start — now using CardSlotController

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
    const startingCard = this.drawCard();
    this.injectCardToSlot('player-hand-3', startingCard);
  },

  drawCard() {
    if (this.deck.length === 0) return null;
    const card = this.deck.shift();
    this.hand.push(card);
    return card;
  },

  injectCardToSlot(slotId, card, flipped = false) {
    if (!card) return;
    CardSlotController.injectToSlot(slotId, card, flipped);
  }
};

// Initialize Dealer on DOM ready
document.addEventListener("DOMContentLoaded", () => Dealer.init());

export default Dealer;
