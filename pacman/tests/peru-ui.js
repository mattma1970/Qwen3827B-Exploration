// Headless tests for the customize UI (M4): initCustomize builds the panel over a
// fake DOM, and the real drop / file-input / canvas-drop / clear / reset flows
// are driven through it (photos run through the real imageToSprite pipeline on
// a stub canvas).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = "/home/mattma/repos/Qwen3827B-Exploration/pacman/js";

let fail = 0;
function assert(cond, msg) {
  if (cond) console.log("  pass:", msg);
  else { console.log("  FAIL:", msg); fail++; }
}
const clampI = (v, a, b) => (v < a ? a : v > b ? b : v);

// image registry: any "data:" URL loads as 256x256 (the processed sprite)
class StubImage {
  constructor() {
    this.src = "";
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.width = 0;
    this.height = 0;
    this._onl = null;
    this._one = null;
  }
  set onload(f) { this._onl = f; }
  get onload() { return this._onl; }
  set onerror(f) { this._one = f; }
  get onerror() { return this._one; }
  set src(v) {
    this._srcVal = v;
    if (typeof v === "string" && v.indexOf("data:") === 0) {
      this.complete = true;
      this.naturalWidth = this.width = 256;
      this.naturalHeight = this.height = 256;
      if (this._onl) this._onl();
    } else if (v && this._one) {
      this._one();
    }
  }
  get src() { return this._srcVal; }
}

// fake "dropped file" that is also image-like (passthrough in loadSourceImage):
// 4x4, left half red / right half blue, carries a .type so isImageFile passes.
function fakePhoto() {
  return {
    type: "image/png",
    complete: true, naturalWidth: 4, naturalHeight: 4, width: 4, height: 4,
    _sample: (x) => (x < 2 ? [255, 0, 0, 255] : [0, 0, 255, 255]),
  };
}

// localStorage stub (no quota here; the quota guard is covered by peru-sprite)
function makeStorage() {
  const backing = {};
  return {
    backing,
    getItem: (k) => (k in backing ? backing[k] : null),
    setItem(k, v) { backing[k] = String(v); },
    removeItem: (k) => { delete backing[k]; },
  };
}

// full ctx: samples the last drawn source (pipeline canvas) AND records
// drawImage / no-ops everything else (preview canvases).
let CVSEQ = 0; // unique per sandbox-load: tags each data URL so sprite re-assigns differ
function makeFullCtx(cv, rec) {
  let curSrc = null;
  let stored = null;
  cv.__seq = ++CVSEQ;
  cv.__toDataUrl = () => "data:image/png;base64,fake_" + cv.__seq;
  return new Proxy({}, {
    get(t, p) {
      if (p === "drawImage") return (img, x, y, w, h) => { curSrc = img; rec.drawImage.push([img, x, y, w, h]); return true; };
      if (p === "getImageData") return (x, y, w, h) => {
        if (!curSrc || !curSrc._sample) return { data: new Uint8ClampedArray(w * h * 4) };
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < w * h; i++) {
          const px = clampI(Math.floor((i % w) / w * curSrc.naturalWidth), 0, curSrc.naturalWidth - 1);
          const py = clampI(Math.floor(((i / w) | 0) / h * curSrc.naturalHeight), 0, curSrc.naturalHeight - 1);
          const s = curSrc._sample(px, py);
          data[i * 4] = s[0]; data[i * 4 + 1] = s[1]; data[i * 4 + 2] = s[2]; data[i * 4 + 3] = s[3];
        }
        return { data };
      };
      if (p === "putImageData") return (im) => { stored = new Uint8ClampedArray(im.data); return true; };
      if (p === "filter") return "none";
      if (p === "createRadialGradient" || p === "createLinearGradient") return () => ({ addColorStop: () => {} });
      return () => undefined;
    },
    set: () => true,
  });
}

// minimal fake DOM element
class FakeEl {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.style = {};
    this.value = "";
    this.files = null;
    this.textContent = "";
    this._classes = {};
    this._listeners = {};
  }
  set className(v) {
    Object.keys(this._classes).forEach((k) => delete this._classes[k]);
    String(v).split(/\s+/).filter(Boolean).forEach((k) => { this._classes[k] = 1; });
  }
  get className() { return Object.keys(this._classes).join(" "); }
  get classList() {
    const c = this._classes;
    return {
      add: (n) => { c[n] = 1; },
      remove: (n) => { delete c[n]; },
      toggle: (n, v) => { const on = v === undefined ? !c[n] : v; if (on) c[n] = 1; else delete c[n]; return on; },
      contains: (n) => !!c[n],
    };
  }
  appendChild(ch) { this.children.push(ch); ch.parentElement = this; return ch; }
  addEventListener(t, f) { (this._listeners[t] = this._listeners[t] || []).push(f); }
  dispatch(t, ev) {
    ev = ev || {};
    if (!ev.preventDefault) ev.preventDefault = () => {};
    if (!ev.stopPropagation) ev.stopPropagation = () => {};
    for (const f of (this._listeners[t] || [])) f(ev);
  }
  click() { this.dispatch("click", { target: this }); }
  toDataURL() { return this.__toDataUrl(); }
  getContext() { return null; }
}

function byClass(root, cls) {
  const out = [];
  (function walk(el) {
    for (const ch of (el.children || [])) {
      if (ch._classes && ch._classes[cls]) out.push(ch);
      walk(ch);
    }
  })(root);
  return out;
}

const FILES = ["config.js", "utils.js", "sprites.js", "photo.js", "customize.js"];
function load(sandbox) {
  for (const f of FILES) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
  }
}
const inCtx = (B, code) => vm.runInContext(code, B.sandbox);
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

// sandbox A: no document/Image/localStorage at all (headless guard)
const A = { sandbox: { console } };
vm.createContext(A.sandbox);
load(A.sandbox);

// sandbox B: full fake DOM + canvas + storage + Image
const bodyEl = new FakeEl("body");
const wrapEl = new FakeEl("main");
const canvasWrap = new FakeEl("div");
const canvasEl = new FakeEl("canvas");
canvasWrap.appendChild(canvasEl);
wrapEl.appendChild(canvasWrap);

const doc = {
  body: bodyEl,
  createElement(tag) {
    const el = new FakeEl(tag);
    if (tag === "canvas") {
      el.getContext = function (kind) {
        if (kind !== "2d") return null;
        if (!this.__rec) this.__rec = { drawImage: [] };
        if (!this.__ctx) this.__ctx = makeFullCtx(this, this.__rec);
        return this.__ctx;
      };
      el.toDataURL = function () { return this.__toDataUrl(); };
    }
    return el;
  },
};
class File {}
class Blob {}
class ImageData {
  constructor(d, w, h) { this.data = d; this.width = w; this.height = h; }
}
const B = {
  sandbox: {
    console,
    Image: StubImage,
    File,
    Blob,
    ImageData,
    localStorage: makeStorage(),
    document: doc,
    window: { handlers: {}, addEventListener(t, f) { (this.handlers[t] = this.handlers[t] || []).push(f); } },
    setTimeout: () => 0,
    clearTimeout: () => {},
  },
};
vm.createContext(B.sandbox);
load(B.sandbox);
B.sandbox.__fake = fakePhoto();

(async function main() {
  console.log("pure helpers (no DOM):");
  assert(inCtx(A, "typeof initCustomize === 'function' && initCustomize({}, {}) === null"),
    "initCustomize is a function and bails headless (no document)");
  assert(inCtx(A, "slotList().join(',') === 'player,Dario,Rita,Zeca,Tuca,pill'"),
    "slotList = player + the 4 turkeys + pill, in display order");
  assert(inCtx(A, "isImageFile({type:'image/png'}) === true && isImageFile({type:'image/gif'}) === true"),
    "isImageFile accepts image/* types");
  assert(inCtx(A, "isImageFile({type:'text/plain'}) === false && isImageFile(null) === false && isImageFile({}) === false && isImageFile('image/png') === false"),
    "isImageFile rejects non-images");
  assert(inCtx(A, "lastUsedSlot === 'player'"), "lastUsedSlot defaults to player");
  assert(inCtx(A, "setLastUsedSlot('zeca') === 'Zeca' && lastUsedSlot === 'Zeca'"),
    "setLastUsedSlot normalizes case (zeca -> Zeca)");
  assert(inCtx(A, "setLastUsedSlot('nope') === 'Zeca' && lastUsedSlot === 'Zeca'"),
    "setLastUsedSlot ignores unknown slots (keeps previous)");
  assert(inCtx(A, "setLastUsedSlot('Pill') === 'pill'"), "setLastUsedSlot passes pill through");

  console.log("panel build + structure:");
  const gameStub = { state: "play", paused: false, togglePause() { this.paused = !this.paused; } };
  B.sandbox.__game = gameStub;
  B.sandbox.__canvas = canvasEl;
  const R = inCtx(B, "initCustomize(globalThis.__game, globalThis.__canvas)");
  assert(!!R && typeof R.setPanel === "function", "initCustomize returns { panel, setPanel, toast }");
  assert(byClass(bodyEl, "customize-panel").length === 1 && byClass(bodyEl, "toast").length === 1,
    "panel + toast appended to body");
  assert(byClass(wrapEl, "custom-btn").length === 1,
    "page button appended next to the canvas (in the wrap)");
  const z = byClass(bodyEl, "slot-zone");
  assert(z.length === 6, "6 drop zones built");
  const labels = z.map((zz) => byClass(zz, "slot-name")[0].textContent).join(",");
  assert(labels === "PACMAN,DARIO,RITA,ZECA,TUCA,PÍLULA", "zone labels in order (got " + labels + ")");
  assert(z.every((zz) => byClass(zz, "slot-status")[0].textContent === "padrão"),
    "all zones start with status padrão");
  assert(z.every((zz) => byClass(zz, "slot-file")[0].tagName === "INPUT"),
    "every zone has a hidden file input (mobile fallback)");
  assert(byClass(bodyEl, "customize-panel")[0].style.display === "none",
    "panel starts hidden");

  console.log("open/close + pause:");
  const key = (code) => B.sandbox.window.handlers.keydown.forEach((f) => f({ code }));
  key("KeyC");
  assert(byClass(bodyEl, "customize-panel")[0].style.display === "block", "KeyC opens the panel");
  assert(gameStub.paused === true, "opening during play pauses the game");
  key("Escape");
  assert(byClass(bodyEl, "customize-panel")[0].style.display === "none", "Escape closes the panel");
  assert(gameStub.paused === false, "closing resumes a game paused by the panel");
  gameStub.state = "title";
  key("KeyC");
  assert(gameStub.paused === false, "opening on the title screen does not pause");
  key("Escape");
  gameStub.state = "play";

  console.log("zone drop (real pipeline):");
  z[3].dispatch("dragover", {});
  assert(!!z[3]._classes.drag, "dragover highlights the zone");
  z[3].dispatch("dragleave", {});
  assert(!z[3]._classes.drag, "dragleave clears the highlight");
  z[3].dispatch("drop", { dataTransfer: { files: [fakePhoto()] } });
  await tick(20);
  assert(inCtx(B, "Sprites.ghosts.Zeca !== null && SpriteData.Zeca.indexOf('data:image/png') === 0"),
    "drop on the Zeca zone assigns the photo sprite + SpriteData");
  assert(inCtx(B, "lastUsedSlot === 'Zeca'"), "zone drop marks the slot as last-used");
  assert(!!z[3]._classes.filled && byClass(z[3], "slot-status")[0].textContent === "personalizada",
    "zone turns filled + personalized");
  assert(B.sandbox.localStorage.getItem("peruman.sprite.Zeca") !== null,
    "sprite persisted under peruman.sprite.Zeca");
  assert(byClass(bodyEl, "toast")[0].textContent === "foto aplicada em ZECA", "success toast names the slot");
  const zecaImg = inCtx(B, "Sprites.ghosts.Zeca");
  assert(z[3].children[0].__rec.drawImage.some((d) => d[0] === zecaImg),
    "Zeca zone preview drew the assigned photo");

  z[0].dispatch("drop", { dataTransfer: { files: [{ type: "text/plain" }] } });
  await tick(20);
  assert(byClass(bodyEl, "toast")[0].textContent === "só imagens, por favor",
    "non-image drop toasts an error");
  assert(inCtx(B, "Sprites.player === null && SpriteData.player === undefined"),
    "non-image drop assigns nothing");
  z[0].dispatch("drop", { dataTransfer: { files: [] } });
  await tick(20);
  assert(inCtx(B, "Sprites.player === null"), "empty drop is ignored");

  console.log("file-input flow (mobile fallback):");
  const tin = byClass(z[4], "slot-file")[0];
  let pickerOpened = 0;
  tin.click = () => { pickerOpened++; };
  z[4].dispatch("click", { target: z[4] });
  assert(pickerOpened === 1, "clicking a zone opens its file picker");
  tin.files = [fakePhoto()];
  tin.dispatch("change", {});
  await tick(20);
  assert(inCtx(B, "Sprites.ghosts.Tuca !== null && SpriteData.Tuca !== undefined && lastUsedSlot === 'Tuca'"),
    "file input change assigns to the zone's slot (+ last-used)");
  assert(tin.value === "", "file input value reset (same file can be re-picked)");

  console.log("drop-anywhere on the canvas:");
  const beforeUrl = inCtx(B, "SpriteData.Tuca");
  canvasEl.dispatch("drop", { dataTransfer: { files: [fakePhoto()] } });
  await tick(20);
  assert(inCtx(B, "SpriteData.Tuca !== undefined && SpriteData.Tuca !== '" + beforeUrl + "'"),
    "canvas drop re-assigned the last-used slot (Tuca) with a new sprite");
  assert(inCtx(B, "Sprites.player === null"), "canvas drop went to Tuca, not player");
  assert(byClass(bodyEl, "toast")[0].textContent === "foto aplicada em TUCA",
    "canvas-drop toast names the last-used slot");

  console.log("clear + reset:");
  byClass(z[3], "slot-clear")[0].dispatch("click", {});
  assert(inCtx(B, "Sprites.ghosts.Zeca === null && SpriteData.Zeca === undefined"),
    "clear button unassigns the sprite + SpriteData");
  assert(B.sandbox.localStorage.getItem("peruman.sprite.Zeca") === null,
    "clear removes the storage entry");
  assert(!z[3]._classes.filled && byClass(z[3], "slot-status")[0].textContent === "padrão",
    "cleared zone turns back to padrão");
  z[0].dispatch("drop", { dataTransfer: { files: [fakePhoto()] } });
  await tick(20);
  byClass(bodyEl, "cp-reset")[0].dispatch("click", {});
  assert(inCtx(B, "Sprites.player === null && Sprites.ghosts.Tuca === null && Sprites.ghosts.Dario === null && Sprites.pill === null"),
    "reset clears every slot (never-assigned slots normalized to null)");
  const keys = ["player", "pill", "Dario", "Rita", "Zeca", "Tuca"];
  assert(keys.every((k) => B.sandbox.localStorage.getItem("peruman.sprite." + k) === null),
    "reset wipes all storage entries");
  assert(inCtx(B, "lastUsedSlot === 'player'"), "reset restores lastUsedSlot to player");
  assert(z.every((zz) => !zz._classes.filled), "all zones back to empty state");
  assert(byClass(bodyEl, "toast")[0].textContent === "todos os slots restaurados",
    "reset toast shown");

  console.log("assignToSlot (pure path):");
  const r1 = await inCtx(B, "assignToSlot('Rita', globalThis.__fake).then(function(s){ return s; })");
  assert(r1 === "Rita" && inCtx(B, "Sprites.ghosts.Rita !== null && lastUsedSlot === 'Rita'"),
    "assignToSlot resolves the slot, assigns it, sets last-used");
  const r2 = await inCtx(B, "assignToSlot('nope', globalThis.__fake).then(function(){ return null; }, function(e){ return String(e); })");
  assert(r2.indexOf("unknown sprite slot") > -1, "assignToSlot rejects an unknown slot (got " + r2 + ")");
  const r3 = await inCtx(B, "assignToSlot('player', 'nope.jpg').then(function(){ return null; }, function(e){ return String(e); })");
  assert(r3.indexOf("could not load image") > -1, "assignToSlot rejects an image that fails to load (got " + r3 + ")");

  console.log("player preview uses the assigned photo:");
  z[0].dispatch("drop", { dataTransfer: { files: [fakePhoto()] } });
  await tick(20);
  const playerImg = inCtx(B, "Sprites.player");
  assert(z[0].children[0].__rec.drawImage.some((d) => d[0] === playerImg),
    "player zone preview drew the assigned photo");

  console.log(fail === 0 ? "ALL CHECKS PASSED" : fail + " CHECKS FAILED");
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) {
  console.log("Test harness error: " + e);
  process.exit(1);
});