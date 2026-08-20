// PERU MAN - sound effects via Web Audio (created on first user gesture).
const AudioFX = (function () {
  let ctx = null;
  let mutedFlag = false;
  let wakaFlip = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function tone(freq, opts) {
    if (!ctx || mutedFlag) return;
    const o = opts || {};
    const dur = o.dur || 0.08;
    const delay = o.delay || 0;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
    gain.gain.setValueAtTime(o.vol || 0.1, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  return {
    ensure: ensure,
    setMuted(v) { mutedFlag = v; },
    isMuted() { return mutedFlag; },
    // classic waka-waka: alternate two blips per pellet
    pellet() {
      wakaFlip = !wakaFlip;
      tone(wakaFlip ? 460 : 300, { dur: 0.045, vol: 0.07 });
    },
    pill() {
      [330, 415, 494, 587, 660].forEach((f, i) => tone(f, { dur: 0.07, vol: 0.09, delay: i * 0.05 }));
    },
    turkeyEaten() {
      [392, 523, 659, 784, 1047].forEach((f, i) =>
        tone(f, { dur: 0.06, vol: 0.1, delay: i * 0.045, type: "triangle" }));
    },
    death() {
      tone(880, { dur: 0.9, vol: 0.1, slide: 90, type: "sawtooth" });
    },
    levelup() {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
        tone(f, { dur: 0.1, vol: 0.1, delay: i * 0.09, type: "triangle" }));
    },
    go() {
      tone(660, { dur: 0.09, vol: 0.09 });
      tone(880, { dur: 0.12, vol: 0.09, delay: 0.1 });
    },
    start() {
      [262, 330, 392, 523].forEach((f, i) =>
        tone(f, { dur: 0.09, vol: 0.09, delay: i * 0.07, type: "triangle" }));
    },
  };
})();
