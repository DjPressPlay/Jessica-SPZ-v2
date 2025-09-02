// render_stcg_card.js
// Creates a full TCG card DOM element from a card object

export function renderSTCGCard(card, options = {}) {
  const {
    flipped = false,
    showStats = true,
    showEffects = true,
  } = options;

  const el = document.createElement("div");
  el.className = "stcg-card";
  el.dataset.cardId = card.id || "";
  el.dataset.name = card.name || "";
  el.dataset.type = card.type || "";

  // Flip card if requested
  if (flipped) {
    el.classList.add("flipped");
  }

  // Card background image
  el.style.backgroundImage = `url('${card.img || card.image || ""}')`;
  el.style.backgroundSize = "cover";
  el.style.backgroundPosition = "center";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.border = "2px solid #ff0088";
  el.style.borderRadius = "12px";
  el.style.boxShadow = "0 0 12px rgba(0,0,0,0.4)";
  el.style.overflow = "hidden";
  el.style.position = "relative";

  // ⚡ Nameplate (top)
  const nameplate = document.createElement("div");
  nameplate.className = "stcg-nameplate";
  nameplate.textContent = card.name || "Unknown Card";
  nameplate.style.position = "absolute";
  nameplate.style.top = "4px";
  nameplate.style.left = "4px";
  nameplate.style.right = "4px";
  nameplate.style.padding = "2px 6px";
  nameplate.style.fontSize = "12px";
  nameplate.style.fontWeight = "bold";
  nameplate.style.background = "rgba(0,0,0,0.6)";
  nameplate.style.color = "#fff";
  nameplate.style.textAlign = "center";
  nameplate.style.borderRadius = "6px";
  el.appendChild(nameplate);

  // ⚔️ ATK / DEF
  if (showStats && card.atk && card.def) {
    const stats = document.createElement("div");
    stats.className = "stcg-stats";
    stats.textContent = `ATK ${card.atk} | DEF ${card.def}`;
    stats.style.position = "absolute";
    stats.style.bottom = "4px";
    stats.style.left = "4px";
    stats.style.right = "4px";
    stats.style.fontSize = "10px";
    stats.style.fontWeight = "bold";
    stats.style.background = "rgba(0,0,0,0.5)";
    stats.style.color = "#fff";
    stats.style.textAlign = "center";
    stats.style.borderRadius = "6px";
    stats.style.padding = "2px 4px";
    el.appendChild(stats);
  }

  // 💬 Effects list (optional)
  if (showEffects && Array.isArray(card.effects)) {
    const effectBox = document.createElement("div");
    effectBox.className = "stcg-effects";
    effectBox.style.position = "absolute";
    effectBox.style.bottom = "24px";
    effectBox.style.left = "4px";
    effectBox.style.right = "4px";
    effectBox.style.maxHeight = "40%";
    effectBox.style.overflowY = "auto";
    effectBox.style.fontSize = "10px";
    effectBox.style.color = "#eee";
    effectBox.style.background = "rgba(0,0,0,0.3)";
    effectBox.style.borderRadius = "6px";
    effectBox.style.padding = "4px";

    for (let eff of card.effects) {
      const line = document.createElement("div");
      line.textContent = eff.text || "";
      line.style.marginBottom = "2px";
      effectBox.appendChild(line);
    }

    el.appendChild(effectBox);
  }

  return el;
}

