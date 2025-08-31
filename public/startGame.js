// start_game.js
import { Dealer } from "./Dealer.js";
import { initCardInfoHover } from "./initCardInfoHover.js";

window.addEventListener("DOMContentLoaded", () => {
  initCardInfoHover();
  Dealer.start();
});
