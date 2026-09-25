"use strict";
function loop(time) {
  const delta = Math.min(time - lastTime, 1000);
  lastTime = time;
  anim = time;
  if (!document.hidden && !$("#modal")?.open && state) {
    if (speed) {
      tickClock += delta * speed;
      if (tickClock >= 5000) {
        tickClock = 0;
        advance();
      }
    }

  }
  requestAnimationFrame(loop);
}

// Inicia loop
requestAnimationFrame(loop);

// Dispara tela inicial se não houver jogo salvo
if (!state) {
  render();
  setTimeout(() => promptRegionSelection(true), 10);
}