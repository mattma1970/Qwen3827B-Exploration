// Regression: key presses must be buffered until the turn can actually be made.
// Before the fix, Mover.decide() discarded the buffered direction the moment it
// could not be applied at the next cell center, so pressing a turn key even one
// cell early was silently eaten (the "arrow keys sometimes don't work" bug).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = "/home/mattma/repos/Qwen3827B-Exploration/pacman/js";
global.window = {};
const sandbox = { window: global.window, console };
vm.createContext(sandbox);
for (const f of ["config.js", "utils.js", "pacman.js"]) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
}
sandbox.gridTest = vm.runInContext("MAZE.map((row) => row.split(''))", sandbox);

let fail = 0;
function assert(cond, msg) {
  if (cond) console.log("  pass:", msg);
  else { console.log("  FAIL:", msg); fail++; }
}

function makePlayer(r, c, dirName) {
  return vm.runInContext(
    "(function() { const pl = new Player(gridTest, ARG_R, ARG_C, TUNE.playerSpeed); pl.dir = ARG_D; pl.update(1/60); return pl; })()"
      .replace("ARG_R", r).replace("ARG_C", c).replace("ARG_D", '"' + dirName + '"'),
    sandbox);
}

// Maze facts (0-indexed):
// row 12: open c1..c13. row 11 above it: open only at c1, c4, c10, c13.
// So "up" from row 12 is BLOCKED at c2 and c3, open first at c4.
// row 10: open c1..c6, wall at c7. (dead-end corridor)

// 1) early buffered turn: press "up" while up is blocked (c2, c3) —
//    the key must survive both cells and be honored at c4.
const p = makePlayer(12, 2, "right"); // moving right from (12,2), up blocked here
p.want = "up"; // keypress arrives mid-cell
let turnC = -1;
for (let i = 0; i < 300 && turnC === -1; i++) {
  p.update(1 / 60);
  if (p.dir === "up" && p.c > 1) turnC = p.c;
}
console.log("early buffered turn (pressed up, blocked at c2,c3):");
assert(turnC === 4, "buffered 'up' honored at c=4, first cell where it is open (turned at c=" + turnC + ")");

// 2) immediate reverse: press the OPPOSITE mid-cell — the player must turn
//    around at once and back away from the dead end (never stop at its wall).
const q = makePlayer(10, 4, "right"); // moving right, dead end at (10,7)
q.want = "left"; // keypress arrives mid-cell
q.update(1 / 60);
console.log("immediate reverse (mid-cell):");
assert(q.dir === "left" && q.want === "none", "opposite key reverses at once (" + q.dir + " at (r" + q.r + ",c" + q.c + "))");
for (let i = 0; i < 30; i++) q.update(1 / 60);
assert(q.c < 4, "player backed away from the dead end (now c=" + q.c + "; its wall is c=7)");

// 3) normal same-direction press is consumed (no stale state, no self-turn)
const w = makePlayer(12, 7, "right");
w.want = "right";
for (let i = 0; i < 10; i++) w.update(1 / 60);
assert(w.dir === "right" && w.want === "none", "same-direction press consumed cleanly");

console.log(fail === 0 ? "ALL CHECKS PASSED" : fail + " CHECKS FAILED");
process.exit(fail === 0 ? 0 : 1);
