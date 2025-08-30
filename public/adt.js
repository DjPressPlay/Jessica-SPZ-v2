
// Placeholder for battle logic
let cpuCounter = 0;
let playerCounter = 0;

function updateCounters() {
  document.getElementById("cpu-counter").textContent = cpuCounter;
  document.getElementById("player-counter").textContent = playerCounter;
}

// Example demo: CPU + Player start with 0 → press space to increment
document.addEventListener("keydown", e => {
  if (e.code === "Space") {
    playerCounter++;
    cpuCounter++;
    updateCounters();
  }
});

updateCounters();
