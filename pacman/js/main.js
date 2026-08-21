// PERU MAN - bootstrap: canvas, input, main loop.
(function () {
  const canvas = document.getElementById("game");
  const SIZE = COLS * CELL;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = SIZE * DPR;
  canvas.height = SIZE * DPR;
  canvas.style.width = SIZE + "px";
  canvas.style.height = SIZE + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(DPR, DPR);

  const game = new Game(ctx, SIZE);
  initCustomize(game, canvas);

  const KEYMAP = {
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
  };

  window.addEventListener("keydown", (e) => {
    AudioFX.ensure();
    const dir = KEYMAP[e.code];
    if (dir) {
      e.preventDefault();
      game.setWant(dir);
    } else if (e.code === "Enter" || e.code === "Space") {
      e.preventDefault();
      game.primaryAction();
    } else if (e.code === "KeyP") {
      game.togglePause();
    } else if (e.code === "KeyM") {
      const m = !AudioFX.isMuted();
      AudioFX.setMuted(m);
    }
  });

  // basic touch/click: tap left/right halves to steer, tap to start
  canvas.addEventListener("pointerdown", (e) => {
    AudioFX.ensure();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (game.state === "title" || game.state === "gameover") {
      game.primaryAction();
      return;
    }
    game.setWant(x < rect.width / 2 ? "left" : "right");
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
