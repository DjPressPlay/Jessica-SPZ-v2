//EFFECTS AND INFORMATION CONTAINERS //

function initCardInfoHover() {
  const allSlots = document.querySelectorAll('.slot, .deck, .grave');

  allSlots.forEach(slot => {
    slot.addEventListener('mouseenter', () => {
      const card = slot.querySelector('.stcg-card');
      const id = slot.id || "";

      // Direct check: if it's a player slot, use player info box
      const isPlayer = id.includes("player-");
      const infoBoxId = isPlayer ? "player-card-info" : "cpu-card-info";
      const infoBox = document.getElementById(infoBoxId);
      if (!infoBox) return;

      if (card) {
        const name = card.dataset.name || "Unknown";
        const emojis = card.dataset.emojis || "";
        let effects = {};

        try {
          effects = JSON.parse(card.dataset.effects || "{}");
        } catch (e) {
          console.warn("Invalid effects JSON:", card.dataset.effects);
        }

        let text = `🃏 <strong>${name}</strong><br>`;
        for (const emoji of emojis) {
          const effect = effects[emoji] || "(no effect)";
          text += `${emoji} — ${effect}<br>`;
        }

        infoBox.innerHTML = text;
        infoBox.style.display = "block";
      } else {
        infoBox.innerHTML = "(No info)";
        infoBox.style.display = "block";
      }
    });

    slot.addEventListener('mouseleave', () => {
      document.getElementById("player-card-info").style.display = "none";
      document.getElementById("cpu-card-info").style.display = "none";
    });
  });
}
