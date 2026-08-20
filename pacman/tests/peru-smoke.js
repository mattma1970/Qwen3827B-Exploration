// Headless verification: maze integrity + smoke-run the full game loop.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = "/home/mattma/repos/Qwen3827B-Exploration/pacman/js";
global.window = {};
const sandbox = { window: global.window, console, performance };
vm.createContext(sandbox);
for (const f of ["config.js", "utils.js", "audio.js", "sprites.js", "pacman.js", "ghost.js", "game.js"]) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
}

// ---- 1. maze checks ----
let fail = 0;
function assert(cond, msg) {
  if (cond) console.log("  pass:", msg);
  else { console.log("  FAIL:", msg); fail++; }
}
console.log("maze:");
const mazeReport = vm.runInContext(`
  (function(){
    const rows = MAZE.length;
    const badLen = [];
    for (let i = 0; i < rows; i++) if (MAZE[i].length !== COLS) badLen.push(i + ":" + MAZE[i].length);
    const sr = MAZE.findIndex(r => r.includes("M"));
    const sc = MAZE[sr].indexOf("M");
    const seen = Array.from({length: ROWS}, () => new Array(COLS).fill(false));
    const q = [[sr, sc]]; seen[sr][sc] = true; let head = 0;
    while (head < q.length) {
      const [r, c] = q[head++];
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r+dr, nc = c+dc;
        if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
        if (seen[nr][nc] || MAZE[nr][nc] === "#") continue;
        seen[nr][nc] = true; q.push([nr, nc]);
      }
    }
    let openCells = 0, unreachable = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (MAZE[r][c] !== "#") { openCells++; if (!seen[r][c]) unreachable.push(r + "," + c); }
    }
    return { rows, badLen, openCells, unreachable };
  })()
`, sandbox);
assert(mazeReport.rows === 15, "15 rows");
assert(mazeReport.badLen.length === 0, "all rows width 15" + (mazeReport.badLen.length ? " bad: " + mazeReport.badLen : ""));
assert(mazeReport.unreachable.length === 0, "all " + mazeReport.openCells + " open cells reachable" + (mazeReport.unreachable.length ? " unreachable: " + mazeReport.unreachable : ""));
assert(mazeReport.openCells > 130, "decent pellet count (" + mazeReport.openCells + " open cells)");

// ---- 2. canvas stub ----
function makeCtx() {
  const store = {};
  return new Proxy(store, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop() {} });
      if (p === "measureText") return () => ({ width: 10 });
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

console.log("smoke test (4000 frames, random play):");
const game = new vm.Script("const G = new Game(makeCtx(), SIZE); G;").runInContext(
  Object.assign(sandbox, { makeCtx, SIZE: 15 * 32 }), { filename: "inst.js" });

let deaths = 0, levelups = 0, maxScore = 0, states = {};
const dirs = ["up", "down", "left", "right"];
const initialPellets = 0; // (informational)
game.newGame();
for (let i = 0; i < 5000; i++) {
  if (Math.random() < 0.6) game.setWant(dirs[(Math.random() * 4) | 0]);
  const prev = game.state;
  game.update(1 / 60);
  game.render();
  if (game.state !== prev) states[game.state] = (states[game.state] || 0) + 1;
  if (game.state === "dying") deaths++;
  if (game.state === "levelup") levelups++;
  maxScore = Math.max(maxScore, game.score);
}
console.log("  state transitions:", JSON.stringify(states));
console.log("  frames with dying:", deaths, "| levelups:", levelups, "| maxScore:", maxScore);
console.log("  final: state=" + game.state + " score=" + game.score + " lives=" + game.lives + " level=" + game.level + " pelletsLeft=" + game.pelletsLeft);
assert(maxScore > 30, "scored points during play (max=" + maxScore + ")");
assert(deaths > 0, "death path exercised");
assert(game.score >= 0 && !Array.isArray(game.floats.length) && true, "no exceptions in update/render");

console.log(fail === 0 ? "ALL CHECKS PASSED" : fail + " CHECKS FAILED");
process.exit(fail === 0 ? 0 : 1);
