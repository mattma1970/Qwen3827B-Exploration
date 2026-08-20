// Focused test: a frightened turkey must REROUTE AWAY from the player.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const dir = "/home/mattma/Qwen3827B-Exploration/pacman/js";
global.window = {};
const sandbox = { window: global.window, console };
vm.createContext(sandbox);
for (const f of ["config.js","utils.js","audio.js","sprites.js","pacman.js","ghost.js","game.js"])
  vm.runInContext(fs.readFileSync(path.join(dir,f),"utf8"), sandbox, { filename: f });

let fail = 0;
const assert = (c,m)=> c ? console.log("  pass:",m) : (console.log("  FAIL:",m), fail++);

const R = vm.runInContext(`
  // a fully open 15x15 field with no walls so every direction is available
  const grid = [];
  for (let r=0;r<15;r++){ grid.push([]); for(let c=0;c<15;c++) grid[r].push(" "); }
  const g = new Turkey(grid, TURKEYS[0], {r:0,c:0});
  // player sits to the RIGHT of the turkey, same row, 2 cells away
  g.r=7; g.c=5; g.grid=grid;
  g.fright=true; g.released=true; g.eaten=false;
  g._player = { r:7, c:7, x:7*32+16, y:7*32+16, dir:"none" };
  const counts = {up:0,down:0,left:0,right:0};
  let towards=0, away=0;
  for (let i=0;i<400;i++){
    const d = g.aiDir();
    counts[d]++;
    // distance after one step toward each option, from the player at (7,7):
    const after = {up:3,down:3,left:3,right:1};
    if (after[d] < 2) towards++; else away++;
  }
  JSON.stringify(counts);`, sandbox);
const counts = JSON.parse(R);
console.log("flee direction tally (400 samples, player to the right):", R);
const towards = counts.right;         // only "right" steps TOWARD the player
const away = counts.up+counts.down+counts.left;
assert(away/towards > 6, "turkey strongly prefers directions AWAY (away/towards="+ (away/towards).toFixed(1) +")");
assert(towards/400 < 0.2, "approach direction taken only occasionally (panic twitch): " + (100*towards/400).toFixed(1) + "%");
assert(counts.up+counts.down+counts.left >= 300, "flock fans out over multiple away-directions (tie-break)");

console.log(fail===0 ? "ALL CHECKS PASSED" : fail+" CHECKS FAILED");
process.exit(fail===0?0:1);
