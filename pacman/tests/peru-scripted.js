// Scripted verification: Canva pill -> frightened -> gobble -> respawn, and levelup.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = "/home/mattma/repos/Qwen3827B-Exploration/pacman/js";
global.window = {};
const sandbox = { window: global.window, console };
vm.createContext(sandbox);
for (const f of ["config.js", "utils.js", "audio.js", "sprites.js", "pacman.js", "ghost.js", "game.js"]) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
}

function makeCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop() {} });
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
sandbox.makeCtx = makeCtx;

let fail = 0;
function assert(cond, msg) {
  if (cond) console.log("  pass:", msg);
  else { console.log("  FAIL:", msg); fail++; }
}

const G = vm.runInContext("new Game(makeCtx(), 480)", sandbox);
G.newGame();
G.setState("play");

// put the player sitting on a Canva pill
G.player.r = 1; G.player.c = 1;
G.player.x = 1 * 32 + 16; G.player.y = 1 * 32 + 16;
G.player.atCenter = true; G.player.dir = "none";
G.grid[1][1] = "P";

G.update(1 / 60);
console.log("power pill:");
assert(G.frightT > 5, "fright mode active, t=" + G.frightT.toFixed(2));
assert(G.grid[1][1] === " ", "pill cell consumed");
assert(G.score >= 100, "pill scored 100 (score=" + G.score + ")");

// wait for turkeys to release (max releaseAt = 4s)
for (let i = 0; i < 300; i++) { G.update(1 / 60); if (G.turkeys.every((t) => t.released)) break; }
assert(G.turkeys.every((t) => t.released), "all 4 turkeys released");
assert(G.turkeys.some((t) => t.fright), "turkeys are frightened");

// teleport a turkey onto the player to test the gobble path
const t0 = G.turkeys[0];
t0.x = G.player.x; t0.y = G.player.y;
t0.r = G.player.r; t0.c = G.player.c;
t0.atCenter = true; t0.dir = "right"; t0.fright = true;
const scoreBefore = G.score;
G.update(1 / 60);
assert(t0.eaten, "turkey gobbled while frightened");
assert(G.score >= scoreBefore + 100, "gobble scored (+" + (G.score - scoreBefore) + ")");

// eaten turkey flies home and respawns
for (let i = 0; i < 300; i++) { G.update(1 / 60); if (!t0.eaten && t0.fright === false) break; }
assert(!t0.eaten, "turkey returned to den");
assert(Math.hypot(t0.x - (7 * 32 + 16), t0.y - (7 * 32 + 16)) < 1, "turkey at den cell");

// eat everything to force levelup
for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) if (G.grid[r][c] !== "#") G.grid[r][c] = ".";
G.pelletsLeft = 1;
G.player.r = 7; G.player.c = 7;
G.player.x = 7 * 32 + 16; G.player.y = 7 * 32 + 16;
G.player.atCenter = true; G.player.want = "right"; G.player.dir = "right";
G.grid[7][7] = ".";
for (let i = 0; i < 100 && G.state === "play"; i++) G.update(1 / 60);
console.log("levelup:");
assert(G.state === "levelup" || G.level === 2, "levelup/next-level triggered (state=" + G.state + ", level=" + G.level + ")");

console.log(fail === 0 ? "ALL CHECKS PASSED" : fail + " CHECKS FAILED");
process.exit(fail === 0 ? 0 : 1);
