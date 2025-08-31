// js/startGame.js

async function startGame() {
  try {
    const res = await fetch("/data/cards.json");
    const cards = await res.json();

    if (!cards.length) return console.warn("No cards found");

    const card = cards[0];
    const html = renderCard(card); // use your real renderer
    document.getElementById("hand-slot-2").innerHTML = html;
  } catch (err) {
    console.error("Start game failed:", err);
  }
}
