// Headless unit tests for the photo-to-sprite pure core: posterize + medianCut.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = "/home/mattma/repos/Qwen3827B-Exploration/pacman/js";
global.window = {};
const sandbox = { window: global.window, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(dir, "photo.js"), "utf8"), sandbox, { filename: "photo.js" });

let fail = 0;
function assert(cond, msg) {
  if (cond) console.log("  pass:", msg);
  else { console.log("  FAIL:", msg); fail++; }
}
const post = (rgba, levels) => sandbox.posterize(rgba, levels);
const cut = (rgba, w, h, colors) => sandbox.medianCut(rgba, w, h, colors);

// ---- posterize ----
console.log("posterize:");
const gray = new Uint8ClampedArray(256 * 4);
for (let i = 0; i < 256; i++) {
  gray[i * 4] = i; gray[i * 4 + 1] = i; gray[i * 4 + 2] = i; gray[i * 4 + 3] = 255;
}
const p20 = post(gray, 20);
const distinct = new Set();
for (let i = 0; i < 256; i++) distinct.add(p20[i * 4]);
assert(distinct.size <= 20, "levels=20 keeps <=20 distinct values per channel (got " + distinct.size + ")");
assert(p20[0] === 0 && p20[255 * 4] === 255, "endpoints preserved (0 stays 0, 255 stays 255)");
let monotonic = true;
for (let i = 1; i < 256; i++) if (p20[i * 4] < p20[(i - 1) * 4]) monotonic = false;
assert(monotonic, "output is non-decreasing (no banding inversions)");
const p20b = post(p20, 20);
let idem = true;
for (let i = 0; i < p20.length; i++) if (p20[i] !== p20b[i]) { idem = false; break; }
assert(idem, "idempotent (posterizing twice is stable)");
assert(p20[3] === 255 && post(gray, 4)[7] === 255, "alpha passed through untouched");

// ---- medianCut ----
console.log("medianCut:");

// 2-color image -> palette collapses to 2, and every mapped pixel is in the palette
const w = 16, h = 16;
const two = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < w * h; i++) {
  const black = (i % 2 === 0);
  two[i * 4] = black ? 0 : 255; two[i * 4 + 1] = 0; two[i * 4 + 2] = 0; two[i * 4 + 3] = 255;
}
const r2 = cut(two, w, h, 16);
assert(r2.palette.length === 2, "2-color image -> palette of 2 (got " + r2.palette.length + ")");
const palSet = new Set(r2.palette.map(c => c.join(",")));
let allIn = true;
for (let i = 0; i < w * h; i++) {
  const key = r2.data[i * 4] + "," + r2.data[i * 4 + 1] + "," + r2.data[i * 4 + 2];
  if (!palSet.has(key)) { allIn = false; break; }
}
assert(allIn, "every opaque mapped pixel is exactly a palette color");

// grayscale gradient -> palette fills up to the requested count
const gw = 64, gh = 1;
const grad = new Uint8ClampedArray(gw * gh * 4);
for (let i = 0; i < gw; i++) {
  grad[i * 4] = Math.round(i / (gw - 1) * 255);
  grad[i * 4 + 1] = grad[i * 4]; grad[i * 4 + 2] = grad[i * 4]; grad[i * 4 + 3] = 255;
}
const r8 = cut(grad, gw, gh, 8);
assert(r8.palette.length === 8, "gradient -> palette of 8 (got " + r8.palette.length + ")");
const r2cap = cut(grad, gw, gh, 2);
assert(r2cap.palette.length <= 2, "respects a small color cap (<=2, got " + r2cap.palette.length + ")");

// transparency preserved
const tw = 4, th = 1;
const tr = new Uint8ClampedArray(tw * th * 4);
for (let i = 0; i < tw; i++) {
  tr[i * 4] = 200; tr[i * 4 + 1] = 100; tr[i * 4 + 2] = 50;
  tr[i * 4 + 3] = i < 2 ? 255 : 0; // first half opaque, second half transparent
}
const rt = cut(tr, tw, th, 16);
assert(rt.data[1 * 4 + 3] === 255, "opaque pixel keeps alpha=255");
assert(rt.data[3 * 4 + 3] === 0, "transparent pixel keeps alpha=0 (untouched)");

// fully transparent -> empty palette, no crash
const ft = new Uint8ClampedArray(16);
const rf = cut(ft, 4, 1, 16);
assert(rf.palette.length === 0 && rf.data.length === 16, "fully-transparent input -> empty palette, no crash");

console.log(fail === 0 ? "ALL CHECKS PASSED" : fail + " CHECKS FAILED");
process.exit(fail === 0 ? 0 : 1);
