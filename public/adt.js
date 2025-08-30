let cpuCounter = 0;
let playerCounter = 0;

function updateCounters() {
  document.getElementById("cpu-counter").textContent = cpuCounter;
  document.getElementById("player-counter").textContent = playerCounter;
}

// Demo: arrow keys adjust counters
document.addEventListener("keydown", e => {
  if (e.code === "ArrowUp") { cpuCounter++; updateCounters(); }
  if (e.code === "ArrowDown") { playerCounter++; updateCounters(); }
});

updateCounters();
