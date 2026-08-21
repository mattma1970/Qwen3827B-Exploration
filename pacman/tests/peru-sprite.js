// Headless tests for the photo-to-sprite GLUE (M2/M3): Sprites registry, the
// imageToSprite pipeline over a stub canvas, turkey/pill photo slots,
// persistence + boot restore.
// Stubs (Image/canvas/localStorage) live in the vm sandbox so the real
// sprites.js/photo.js code paths execute.
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

// ---------- stubs ----------

// image registry: src value -> { w, h, sample(x, y) -> [r, g, b, a] }
const IMGS = {};
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
    this._sample = null;
  }
  set onload(f) { this._onl = f; }
  get onload() { return this._onl; }
  set onerror(f) { this._one = f; }
  get onerror() { return this._one; }
  set src(v) {
    this._srcVal = v;
    const k = IMGS[v];
    if (k) {
      this.complete = true;
      this.naturalWidth = this.width = k.w;
      this.naturalHeight = this.height = k.h;
      this._sample = k.sample;
      if (this._onl) this._onl();
    } else if (typeof v === "string" && v.indexOf("data:") === 0) {
      this.complete = true;
      this.naturalWidth = this.width = 256;
      this.naturalHeight = this.height = 256;
      if (this._onl) this._onl();
    } else if (v) {
      if (this._one) this._one();
    }
  }
  get src() { return this._srcVal; }
}

// already-loaded image-like object (skips loadSourceImage)
function loadedFake(w, h, sample) {
  return { complete: true, naturalWidth: w, naturalHeight: h, width: w, height: h, _sample: sample };
}

// localStorage stub (optional byte quota)
function makeStorage(limit) {
  const backing = {};
  const used = () => Object.keys(backing).reduce((n, k) => n + k.length + backing[k].length, 0);
  return {
    backing,
    getItem: (k) => (k in backing ? backing[k] : null),
    setItem(k, v) {
      if (limit && used() + k.length + String(v).length > limit) throw new Error("QuotaExceededError");
      backing[k] = String(v);
    },
    removeItem: (k) => { delete backing[k]; },
  };
}

// canvas ctx stub: reads pixels from the last drawn source (nearest-neighbor
// upsample), records putImageData data, toDataURL -> tagged data URL.
// NOTE: `filter` reads back as a string so imageToSprite takes the ctx.filter
// branch (the stub ignores filter; boxBlurRgba is tested separately).
function makeCtx(cv) {
  let curSrc = null;
  let stored = null;
  cv.__getData = (w, h) => ({ data: stored ? stored.slice() : new Uint8ClampedArray(w * h * 4) });
  cv.__toDataUrl = () => "data:image/png;base64,fake_" + cv.__seq;
  return new Proxy({ __cv: cv }, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "drawImage") return (img) => { curSrc = img; return true; };
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
      if (p === "putImageData") return (imgData) => { stored = new Uint8ClampedArray(imgData.data); return true; };
      if (p === "toDataURL") return () => cv.__toDataUrl();
      if (p === "filter") return "none";
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

// recording ctx: every method is a no-op except drawImage (recorded), and the
// gradient factories return a no-op addColorStop. Records in `rec.drawImage`.
function makeRecCtx(rec) {
  const noop = () => {};
  return new Proxy({}, {
    get: (t, p) => {
      if (p === "drawImage") return (img, x, y, w, h) => { rec.drawImage.push([img, x, y, w, h]); };
      if (p === "createRadialGradient" || p === "createLinearGradient") return () => ({ addColorStop: noop });
      return noop;
    },
    set: () => true,
  });
}

function buildSandbox(storage) {
  IMGS["img/rafa_emoji.png"] = { w: 256, h: 256, sample: () => [0, 154, 59, 255] };
  IMGS["blob:stub_0"] = { w: 4, h: 4, sample: (x) => (x < 2 ? [255, 0, 0, 255] : [0, 0, 255, 255]) };
  const doc = {
    canvases: [],
    seq: 0,
    createElement(tag) {
      if (tag !== "canvas") throw new Error("unexpected element " + tag);
      const cv = { width: 300, height: 150, __seq: ++this.seq, ctx: null };
      cv.getContext = function (kind) {
        if (kind !== "2d") return null;
        if (!this.ctx) this.ctx = makeCtx(this);
        return this.ctx;
      };
      cv.toDataURL = function () { return "data:image/png;base64,fake_" + this.__seq; };
      cv.__getData = null;
      cv.__toDataUrl = null;
      this.canvases.push(cv);
      return cv;
    },
  };
  const URLStub = {
    created: [],
    createObjectURL() { const u = "blob:stub_" + this.created.length; this.created.push(u); return u; },
    revokeObjectURL() {},
  };
  class File {}
  class Blob {}
  class ImageData {
    constructor(d, w, h) { this.data = d; this.width = w; this.height = h; }
  }
  const sandbox = {
    window: {},
    console,
    Image: StubImage,
    URL: URLStub,
    Blob,
    File,
    ImageData,
    localStorage: storage,
    document: doc,
  };
  vm.createContext(sandbox);
  return { sandbox, doc };
}

function load(sandbox) {
  for (const f of ["config.js", "utils.js", "audio.js", "sprites.js", "photo.js"]) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), sandbox, { filename: f });
  }
}

const inCtx = (B, code) => vm.runInContext(code, B.sandbox);

// ---------- async driver ----------
(async function main() {
  const S = buildSandbox(makeStorage());
  load(S.sandbox);
  const gradFake = loadedFake(200, 100, (x) => {
    const v = Math.round(x / 199 * 255);
    return [v, 255 - v, 128, 255];
  });
  S.sandbox.__gradFake = gradFake;

  console.log("registry:");
  assert(inCtx(S, "typeof Sprites === 'object' && Sprites.player === null && Sprites.pill === null && Sprites.ghosts.Dario === undefined"),
    "Sprites registry exists with empty slots");
  assert(inCtx(S, "spriteSlot('player') === 'player' && spriteSlot('pill') === 'pill'"),
    "spriteSlot passes player/pill through");
  assert(inCtx(S, "spriteSlot('dario') === 'Dario' && spriteSlot('TUca') === 'Tuca'"),
    "spriteSlot case-insensitively matches turkey names");
  assert(inCtx(S, "spriteSlot('nope') === null && spriteFor('nope') === null && spriteFor('Dario') === null"),
    "unknown slot -> null (slot + for)");
  assert(inCtx(S, "typeof setSprite === 'function' && typeof clearPhoto === 'function' && typeof assignPhoto === 'function'"),
    "glue functions are on the global");

  console.log("player fallback chain:");
  assert(inCtx(S, "playerSprite() === rafaEmojiImg"),
    "playerSprite resolves the rafa avatar when no photo is assigned");
  const p0 = inCtx(S, "(function(){ const r=[]; const c={save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},arc(){},closePath(){},clip(){},createRadialGradient(){return {addColorStop(){}}},fill(){},drawImage:function(i,x,y,w,h){r.push([i===rafaEmojiImg,x,y,w,h])}}; drawPlayer(c,10,10,14,0.5,'right'); return r; })()");
  assert(p0.length === 1 && p0[0][0] === true && p0[0][1] === -14 && p0[0][2] === -14 && p0[0][3] === 28 && p0[0][4] === 28,
    "drawPlayer mouth-wedge clips rafa avatar at (-r,-r,2r,2r)");
  const fakePhoto = loadedFake(128, 128, () => [255, 215, 0, 255]);
  S.sandbox.__fakePhoto = fakePhoto;
  assert(inCtx(S, "setSprite('player', globalThis.__fakePhoto) === true && Sprites.player === globalThis.__fakePhoto && playerSprite() === globalThis.__fakePhoto"),
    "setSprite('player') prefers the photo over the rafa avatar");
  const p1 = inCtx(S, "(function(){ const r=[]; const c={save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},arc(){},closePath(){},clip(){},drawImage:function(i,x,y,w,h){r.push([i===globalThis.__fakePhoto,x,y,w,h])}}; drawPlayer(c,10,10,20,0.5,'right'); return r; })()");
  assert(p1.length === 1 && p1[0][0] === true && p1[0][1] === -20 && p1[0][2] === -20 && p1[0][3] === 40 && p1[0][4] === 40,
    "drawPlayer uses the assigned photo");
  const m1 = inCtx(S, "(function(){ const r=[]; const c={save(){},restore(){},beginPath(){},arc(){},clip(){},drawImage:function(i,x,y,w,h){r.push([i===globalThis.__fakePhoto,x,y,w,h])}}; drawMiniFlag(c,30,40,8); return r; })()");
  assert(m1.length === 1 && m1[0][0] === true && m1[0][1] === 22 && m1[0][2] === 32 && m1[0][3] === 16 && m1[0][4] === 16,
    "drawMiniFlag (life icons) uses the same photo");
  assert(inCtx(S, "clearPhoto('player') === true && Sprites.player === null && playerSprite() === rafaEmojiImg"),
    "clearPhoto restores the rafa fallback");

  console.log("imageToSprite:");
  const rep = await inCtx(S, "(function(){ return imageToSprite(globalThis.__gradFake, { colors: 8, blur: 4 }).then(function(){ var cv = document.canvases[document.canvases.length - 1]; var d = cv.__getData(256, 256).data; var pal = {}; for (var i = 0; i < 256 * 256; i++) pal[d[i * 4] + ',' + d[i * 4 + 1] + ',' + d[i * 4 + 2]] = 1; return { unique: Object.keys(pal).length, size: d.length, left: [d[0], d[1], d[2]], right: [d[255 * 4], d[255 * 4 + 1], d[255 * 4 + 2]] }; }); })()");
  assert(rep.size === 256 * 256 * 4, "sprite is a 256x256 RGBA surface");
  assert(rep.unique >= 2 && rep.unique <= 8, "pipeline output uses 2..8 flat colors (got " + rep.unique + ")");
  assert(rep.left[1] > rep.left[0] && rep.right[0] > rep.right[1],
    "gradient direction preserved (left green-dominant " + JSON.stringify(rep.left) + ", right red-dominant " + JSON.stringify(rep.right) + ")");

  const repB = await inCtx(S, "(function(){ return imageToSprite(new File(['x'], 'p.png'), { colors: 16 }).then(function(){ var cv = document.canvases[document.canvases.length - 1]; var d = cv.__getData(256, 256).data; return { left: [d[0], d[1], d[2]], right: [d[255 * 4], d[255 * 4 + 1], d[255 * 4 + 2]] }; }); })()");
  assert(repB.left[0] > repB.left[2] && repB.right[2] > repB.right[0],
    "File -> object URL path: red|blue split preserved (" + JSON.stringify(repB.left) + " / " + JSON.stringify(repB.right) + ")");

  const blurRes = inCtx(S, "(function(){ var n = 5; var rgba = new Uint8ClampedArray(n * n * 4); for (var i = 0; i < n * n; i++) rgba[i * 4 + 3] = 255; rgba[12 * 4] = 255; var out = boxBlurRgba(rgba, n, n, 1); return { center: out[12 * 4], neighbor: out[7 * 4], far: out[0] }; })()");
  assert(blurRes.center === 28, "boxBlurRgba spreads a dot to its 3x3 (255/9=28, got " + blurRes.center + ")");
  assert(blurRes.neighbor === 28, "direct neighbor picks up the same light (got " + blurRes.neighbor + ")");
  assert(blurRes.far === 0, "beyond the radius stays untouched (corner=" + blurRes.far + ")");

  const rej1 = await inCtx(S, "assignPhoto('bogus', globalThis.__gradFake, { colors: 4 }).then(function(){ return null; }, function(e){ return String(e); })");
  assert(rej1.indexOf("unknown sprite slot") > -1, "assignPhoto rejects unknown slot (got " + rej1 + ")");
  const rej2 = await inCtx(S, "assignPhoto('player', 'nope.jpg').then(function(){ return null; }, function(e){ return String(e); })");
  assert(rej2.indexOf("could not load image") > -1, "assignPhoto rejects an image that fails to load (got " + rej2 + ")");

  console.log("persistence:");
  const slot = await inCtx(S, "assignPhoto('Dario', globalThis.__gradFake, { colors: 4 })");
  assert(slot === "Dario", "assignPhoto resolves the normalized slot name");
  assert(inCtx(S, "Sprites.ghosts.Dario !== null && Sprites.ghosts.Dario.src === SpriteData.Dario"),
    "assignPhoto sets Sprites.ghosts.Dario + SpriteData");
  assert(inCtx(S, "SpriteData.Dario.indexOf('data:image/png') === 0"), "SpriteData.Dario is a PNG data URL");
  assert(inCtx(S, "localStorage.getItem('peruman.sprite.Dario') === SpriteData.Dario"),
    "persisted under peruman.sprite.Dario");
  assert(inCtx(S, "clearPhoto('Dario') === true && Sprites.ghosts.Dario === null && localStorage.getItem('peruman.sprite.Dario') === null"),
    "clearPhoto removes sprite + SpriteData + storage entry");

  console.log("turkey + pill slots:");
  const nearF = (a, b) => Math.abs(a - b) < 0.1;
  const turkeyPhoto = loadedFake(64, 64, () => [230, 57, 70, 255]);
  S.sandbox.__turkeyPhoto = turkeyPhoto;
  assert(inCtx(S, "setSprite('Zeca', globalThis.__turkeyPhoto) === true && Sprites.ghosts.Zeca === globalThis.__turkeyPhoto"),
    "setSprite assigns a turkey by name");
  const recT0 = { drawImage: [] };
  S.sandbox.__tctx = makeRecCtx(recT0);
  inCtx(S, "drawTurkey(globalThis.__tctx, 10, 10, 12, '#e63946', {name:'Zeca', facing:'right'})");
  const d0 = recT0.drawImage[0] || [];
  assert(recT0.drawImage.length === 1 && d0[0] === turkeyPhoto && nearF(d0[1], -13.8) && nearF(d0[2], -13.8) && nearF(d0[3], 27.6) && nearF(d0[4], 27.6),
    "drawTurkey photo replaces the drawn turkey as one unit (raw square at 2.3r, got " + JSON.stringify(d0.slice(1)) + ")");
  const recT1 = { drawImage: [] };
  S.sandbox.__tctx = makeRecCtx(recT1);
  inCtx(S, "drawTurkey(globalThis.__tctx, 10, 10, 12, '#e63946', {name:'Zeca', fright:true, flick:true})");
  assert(recT1.drawImage.length === 1 && recT1.drawImage[0][0] === turkeyPhoto,
    "frightened photo turkey still draws the photo (tint + squiggle overlaid)");
  const recT2 = { drawImage: [] };
  S.sandbox.__tctx = makeRecCtx(recT2);
  inCtx(S, "(function(){ drawTurkey(globalThis.__tctx, 10, 10, 12, '#e63946', {name:'Dario'}); drawTurkey(globalThis.__tctx, 20, 20, 12, '#ffb703', {}); })()");
  assert(recT2.drawImage.length === 0, "no photo (or no name) -> hand-drawn turkey, no drawImage");
  const pillPhoto = loadedFake(100, 40, () => [0, 196, 204, 255]);
  S.sandbox.__pillPhoto = pillPhoto;
  assert(inCtx(S, "setSprite('pill', globalThis.__pillPhoto) === true"), "setSprite assigns the pill photo");
  const recP1 = { drawImage: [] };
  S.sandbox.__pctx = makeRecCtx(recP1);
  inCtx(S, "drawCanvaPill(globalThis.__pctx, 10, 10, 10, 0)");
  assert(recP1.drawImage.length === 1 && recP1.drawImage[0][0] === pillPhoto,
    "drawCanvaPill prefers the photo over the Canva wordmark");
  assert(inCtx(S, "clearPhoto('pill') === true"), "clearPhoto('pill') resets");
  const recP2 = { drawImage: [] };
  S.sandbox.__pctx = makeRecCtx(recP2);
  inCtx(S, "drawCanvaPill(globalThis.__pctx, 10, 10, 10, 0)");
  assert(recP2.drawImage.length === 1 && recP2.drawImage[0][0] !== pillPhoto,
    "after clear, pill falls back to the Canva wordmark image");

  console.log("boot restore:");
  IMGS["data:image/png;base64,boot_dario"] = { w: 256, h: 256, sample: () => [10, 20, 30, 255] };
  const bootStorage = makeStorage();
  bootStorage.setItem("peruman.sprite.Dario", "data:image/png;base64,boot_dario");
  bootStorage.setItem("peruman.sprite.player", "data:image/png;base64,fake_persisted");
  const B = buildSandbox(bootStorage);
  load(B.sandbox);
  assert(inCtx(B, "Sprites.player !== null && Sprites.player.src === 'data:image/png;base64,fake_persisted' && playerSprite() === Sprites.player"),
    "boot restore rehydrates the player photo (and it wins the fallback chain)");
  assert(inCtx(B, "Sprites.ghosts.Dario !== null && Sprites.ghosts.Dario.src === 'data:image/png;base64,boot_dario'"),
    "boot restore rehydrates a turkey photo");
  assert(inCtx(B, "SpriteData.Dario === 'data:image/png;base64,boot_dario' && SpriteData.player !== undefined"),
    "SpriteData repopulated from storage");

  console.log("quota guard:");
  const Q = buildSandbox(makeStorage(1));
  load(Q.sandbox);
  Q.sandbox.__gradFake = gradFake;
  const slotQ = await inCtx(Q, "assignPhoto('Rita', globalThis.__gradFake, { colors: 4 })");
  assert(slotQ === "Rita" && inCtx(Q, "Sprites.ghosts.Rita !== null"),
    "snapshot assigned even when storage is over quota");
  assert(inCtx(Q, "persistSlot('Rita') === false && SpriteData.Rita !== undefined"),
    "persistSlot swallows the quota error (returns false), SpriteData kept");

  console.log("quota pre-check (M5):");
  const QP = buildSandbox(makeStorage());
  load(QP.sandbox);
  QP.sandbox.__gradFake = gradFake;
  assert(inCtx(QP, "typeof spriteUsage === 'function' && typeof spriteFits === 'function' && spriteUsage() === 0"),
    "spriteUsage/spriteFits on the global, usage starts at 0");
  inCtx(QP, "SpriteData.Rita = 'data:image/png;base64,' + ('X'.repeat(1000));");
  assert(inCtx(QP, "spriteUsage() === (SPRITE_LS_PREFIX + 'Rita').length + SpriteData.Rita.length"),
    "spriteUsage counts key + value bytes per entry");
  assert(inCtx(QP, "spriteFits('nope', 'x') === false"), "spriteFits rejects unknown slots");
  inCtx(QP, "SpriteData.player = 'data:image/png;base64,' + ('X'.repeat(SPRITE_QUOTA - 40));");
  const rejQ = await inCtx(QP, "assignPhoto('pill', globalThis.__gradFake, { colors: 4 }).then(function(){ return null; }, function(e){ return String(e); })");
  assert(rejQ.indexOf("quota") > -1, "assignPhoto rejects a different slot when over quota (got " + rejQ + ")");
  assert(inCtx(QP, "Sprites.pill === null && SpriteData.pill === undefined && localStorage.getItem('peruman.sprite.pill') === null"),
    "rejection assigns nothing (Sprites, SpriteData, storage untouched)");
  const slotR = await inCtx(QP, "assignPhoto('player', globalThis.__gradFake, { colors: 4 })");
  assert(slotR === "player" && inCtx(QP, "Sprites.player !== null && SpriteData.player.indexOf('data:image/png') === 0"),
    "re-placing the SAME slot frees the old bytes (replacement fits)");
  assert(inCtx(QP, "localStorage.getItem('peruman.sprite.player') === SpriteData.player && spriteFits('pill', 'y'.repeat(50)) === true"),
    "replacement persisted and later slots fit again");
  const NS = buildSandbox(undefined);
  load(NS.sandbox);
  NS.sandbox.__gradFake = gradFake;
  const slotNS = await inCtx(NS, "assignPhoto('Dario', globalThis.__gradFake, { colors: 4 })");
  assert(slotNS === "Dario" && inCtx(NS, "Sprites.ghosts.Dario !== null && persistSlot('Dario') === false"),
    "no localStorage -> quota check skipped, in-memory assign still works");

  console.log(fail === 0 ? "ALL CHECKS PASSED" : fail + " CHECKS FAILED");
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (e) {
  console.log("Test harness error: " + e);
  process.exit(1);
});
