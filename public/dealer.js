// dealer.js
const Dealer = {
  playerDeck: [],
  cpuDeck: [],

  initGame(playerDeckData, cpuDeckData) {
    this.playerDeck = [...playerDeckData];
    this.cpuDeck = [...cpuDeckData];
    this.shuffleDeck(this.playerDeck);
    this.shuffleDeck(this.cpuDeck);
  },

  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  },

  drawCard(isPlayer = true) {
    const deck = isPlayer ? this.playerDeck : this.cpuDeck;
    if (deck.length === 0) return null;
    const card = deck.pop();
    const slotId = this.findOpenHandSlot(isPlayer);
    if (slotId) {
      const el = createCardElement(card);
      placeCardInSlot(el, slotId);
    }
    return card;
  },

  findOpenHandSlot(isPlayer) {
    const prefix = isPlayer ? "player-hand-" : "cpu-hand-";
    for (let i = 1; i <= 5; i++) {
      const el = document.getElementById(prefix + i);
      if (el && el.children.length === 0) return prefix + i;
    }
    return null;
  }
};
