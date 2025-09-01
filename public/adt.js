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

---------------------------------------------------------
  
const applyHandBehavior = (el) => {
  el.card = null;

  // === CORE METHODS ===

  el.place = function(card) {
    this.card = card;
    this.innerHTML = '';
    this.appendChild(card.render());
  };

  el.destroy = function() {
    this.card = null;
    this.innerHTML = '';
  };

  el.flip = function() {
    if (this.card && typeof this.card.flip === 'function') {
      this.card.flip();
    }
  };

  el.moveTo = function(targetSlot) {
    if (!this.card || !targetSlot) return;
    targetSlot.place(this.card);
    this.destroy();
  };

  // === NEW METHODS ===

  // Removes card from play
  el.burn = function(burnZone) {
    if (!this.card || !burnZone || typeof burnZone.add !== 'function') return;
    burnZone.add(this.card);
    this.destroy();
  };

  // Temporarily flips to show then flips back
  el.show = function(duration = 1000) {
    if (!this.card) return;
    const wasFlipped = !!this.card.isFlipped;
    this.card.isFlipped = true;
    this.card.render();

    setTimeout(() => {
      this.card.isFlipped = wasFlipped;
      this.card.render();
    }, duration);
  };

  // Return this card to a specified hand slot
  el.return = function(targetSlot) {
    if (!this.card || !targetSlot || targetSlot.card) return;
    targetSlot.place(this.card);
    this.destroy();
  };

  // Give card to opponent hand (finds open slot)
  el.give = function(opponentHand) {
    if (!this.card || !Array.isArray(opponentHand)) return;
    const openSlot = opponentHand.find(s => !s.card);
    if (openSlot) {
      openSlot.place(this.card);
      this.destroy();
    }
  };

  // Activate card effect (if it exists)
  el.activateEffect = function() {
    if (this.card && typeof this.card.effect === 'function') {
      this.card.effect();
    }
  };

  return el;
};

-------------------------------------------------------
function applyCardSlotBehavior(el) {
  el.card = null;

  el.place = function(card) {
    this.card = card;
    this.innerHTML = '';
    this.appendChild(card.render());
  };

  el.destroy = function() {
    this.card = null;
    this.innerHTML = '';
  };

  el.flip = function() {
    if (this.card && typeof this.card.flip === 'function') {
      this.card.flip();
    }
  };

  el.moveTo = function(targetSlot) {
    if (!this.card || !targetSlot) return;
    targetSlot.place(this.card);
    this.destroy();
  };

  el.isEmpty = function() {
    return this.card === null;
  };

  return el;
}

-------------------------------------------------------
function applyZoneBehavior(el) {
  el.stack = [];

  el.add = function(card) {
    this.stack.push(card);
    this.render();
  };

  el.pop = function() {
    const card = this.stack.pop();
    this.render();
    return card;
  };

  el.render = function() {
    this.innerHTML = '';
    if (this.stack.length > 0) {
      const topCard = this.stack[this.stack.length - 1];
      this.appendChild(topCard.render());
    }
  };

  el.clear = function() {
    this.stack = [];
    this.innerHTML = '';
  };

  return el;
}

