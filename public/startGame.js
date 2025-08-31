import { Dealer } from './Dealer.js';
import { CardLibrary } from './cards.js'; // your local card store

window.addEventListener("DOMContentLoaded", () => {
  // Inject a sample card to ANY SLOT
  Dealer.injectCard("player-battle-3", CardLibrary.sampleCard);

  // Later, you can remove it:
  // Dealer.removeCard("player-battle-3");
});
