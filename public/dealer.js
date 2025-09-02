// DealerController.js
// Uses CardSlotController to render full cards pulled from CardLibrary

import { CardLibrary } from './card_library.js';
import { CardSlotController } from './card_slot_controller.js';

const HAND_SIZE = 5;

const Dealer = {
  deck: [],
  graveyard: [],
  hand: [],
  turn: 'player',

  init() {
    this.loadDeck();
    this.dealOpeningHand();
  },

  // Normalize CardLibrary (object or array) → shuffle
  loadDeck() {
    const src = Array.isArray(CardLibrary) ? CardLibrary : Object.values(CardLibrary || {});
    this.deck = src.filter(Boolean).map(c => ({ ...c })); // shallow copy
    this.shuffle(this.deck);
  },

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  },

  dealOpeningHand() {
    for (let i = 1; i <= HAND_SIZE; i++) {
      const card = this.drawCard();
      this.injectCardToSlot(`player-hand-${i}`, card);
    }
  },

  drawCard() {
    if (!this.deck.length) return null;
    const card = this.deck.shift();
    if (card) this.hand.push(card);
    return card;
  },

  draw(n = 1) {
    const pulled = [];
    for (let i = 0; i < n; i++) {
      const c = this.drawCard();
      if (c) pulled.push(c);
    }
    return pulled;
  },

  // Move a card to graveyard (by ref)
  sendToGrave(card) {
    if (!card) return;
    this.graveyard.push(card);
    // remove first match from hand if present
    const idx = this.hand.indexOf(card);
    if (idx >= 0) this.hand.splice(idx, 1);
  },

  injectCardToSlot(slotId, rawCard, flipped = false) {
    if (!rawCard) return;
    const slot = document.getElementById(slotId);
    if (!slot) return;

    const enriched = CardSlotController.normalize(rawCard);
    const el = CardSlotController.createEl(enriched, flipped);
    slot.innerHTML = '';
    slot.appendChild(el);
  },

  // Helpers for back-card / flip behaviors
  injectBackToSlot(slotId) {
    const slot = document.getElementById(slotId);
    if (!slot) return;
    const el = CardSlotController.createBackEl();
    slot.innerHTML = '';
    slot.appendChild(el);
  },

  flipSlotToCard(slotId, rawCard) {
    this.injectCardToSlot(slotId, rawCard, false);
  },

  flipSlotToBack(slotId) {
    this.injectBackToSlot(slotId);
  }
};

// Auto-run
document.addEventListener('DOMContentLoaded', () => Dealer.init());

export default Dealer;
