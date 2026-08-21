// PERU MAN - photo-to-sprite core. Pure functions over raw RGBA (Uint8ClampedArray),
// no canvas or DOM, so they run in the headless vm tests. Declared as top-level
// `function`s so they attach to the global (const/class would not).
// Pipeline (glue in M2): resize -> blur -> posterize -> medianCut -> drawImage as-is.

// Snap each RGB channel to `levels` steps (2..256). Alpha is passed through.
// Returns a new array. levels < 2 is clamped to 2.
function posterize(rgba, levels) {
  if (levels < 2) levels = 2;
  if (levels > 256) levels = 256;
  const out = new Uint8ClampedArray(rgba.length);
  const step = 255 / (levels - 1);
  for (let i = 0; i < rgba.length; i += 4) {
    out[i] = Math.round(Math.round(rgba[i] / step) * step);
    out[i + 1] = Math.round(Math.round(rgba[i + 1] / step) * step);
    out[i + 2] = Math.round(Math.round(rgba[i + 2] / step) * step);
    out[i + 3] = rgba[i + 3];
  }
  return out;
}

// Median-cut color quantization to at most `colors` flat palette colors.
// Works on opaque pixels (alpha>0); transparent pixels pass through untouched.
// Returns { data: new RGBA, palette: [[r,g,b], ...] } with palette.length <= colors.
function medianCut(rgba, w, h, colors) {
  if (colors < 1) colors = 1;
  const n = w * h;

  const idx = [];
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] > 0) idx.push(i);
  }
  if (idx.length === 0) {
    return { data: new Uint8ClampedArray(rgba), palette: [] };
  }

  function bounds(list) {
    let rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0;
    for (const i of list) {
      const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      if (r < rmin) rmin = r; if (r > rmax) rmax = r;
      if (g < gmin) gmin = g; if (g > gmax) gmax = g;
      if (b < bmin) bmin = b; if (b > bmax) bmax = b;
    }
    return { rmin, rmax, gmin, gmax, bmin, bmax };
  }

  const boxes = [bounds(idx)];
  const boxPixels = [idx.slice()];

  while (boxes.length < colors) {
    let bi = 0, best = -1;
    for (let b = 0; b < boxes.length; b++) {
      const B = boxes[b];
      const range = Math.max(B.rmax - B.rmin, B.gmax - B.gmin, B.bmax - B.bmin);
      if (range > best) { best = range; bi = b; }
    }
    if (best <= 0 || boxPixels[bi].length < 2) break;

    const B = boxes[bi];
    const rRange = B.rmax - B.rmin, gRange = B.gmax - B.gmin, bRange = B.bmax - B.bmin;
    const ch = rRange >= gRange && rRange >= bRange ? 0 : (gRange >= bRange ? 1 : 2);

    const list = boxPixels[bi].slice().sort((a, b) => rgba[a * 4 + ch] - rgba[b * 4 + ch]);
    const mid = list.length >> 1;
    const l1 = list.slice(0, mid);
    const l2 = list.slice(mid);

    boxPixels[bi] = l1;
    boxes[bi] = bounds(l1);
    boxPixels.push(l2);
    boxes.push(bounds(l2));
  }

  const palette = [];
  for (let b = 0; b < boxes.length; b++) {
    const list = boxPixels[b];
    let r = 0, g = 0, bl = 0;
    for (const i of list) { r += rgba[i * 4]; g += rgba[i * 4 + 1]; bl += rgba[i * 4 + 2]; }
    const cnt = list.length || 1;
    palette.push([Math.round(r / cnt), Math.round(g / cnt), Math.round(bl / cnt)]);
  }

  const data = new Uint8ClampedArray(rgba);
  for (const i of idx) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    let best = Infinity, pi = 0;
    for (let p = 0; p < palette.length; p++) {
      const dr = palette[p][0] - r, dg = palette[p][1] - g, db = palette[p][2] - b;
      const d = dr * dr + dg * dg + db * db;
      if (d < best) { best = d; pi = p; }
    }
    data[i * 4] = palette[pi][0];
    data[i * 4 + 1] = palette[pi][1];
    data[i * 4 + 2] = palette[pi][2];
  }

  return { data, palette };
}

// ---------------------------------------------------------------------------
// Glue (browser only): photo -> emoji-fied 256px sprite -> Sprites registry
// -> localStorage. Guarded so headless vm (no DOM) can load this safely.
// ---------------------------------------------------------------------------

var SPRITE_SIZE = 256;
var SPRITE_LS_PREFIX = "peruman.sprite.";
var SPRITE_QUOTA = 5 * 1024 * 1024; // data-URL chars (~bytes) allowed across all slots
var SpriteData = {}; // slot -> data URL of the assigned photo sprite

// Every assignable slot, in display order (player, pill, the 4 named turkeys).
function allSlots() {
  const slots = ["player", "pill"];
  if (typeof TURKEYS !== "undefined") for (const d of TURKEYS) slots.push(d.name);
  return slots;
}

// Normalize a slot name: "player" | "pill" | a turkey name (case-insensitive).
// Returns null for unknown slots (needs TURKEYS from config.js when called).
function spriteSlot(name) {
  const s = String(name);
  const low = s.toLowerCase();
  if (low === "player") return "player";
  if (low === "pill") return "pill";
  if (typeof TURKEYS === "undefined") return null;
  for (const d of TURKEYS) {
    if (d.name.toLowerCase() === s.toLowerCase()) return d.name;
  }
  return null;
}

function spriteFor(slot) {
  const s = spriteSlot(slot);
  if (!s) return null;
  if (s === "player") return Sprites.player;
  if (s === "pill") return Sprites.pill;
  return Sprites.ghosts[s] || null;
}

function setSprite(slot, img) {
  const s = spriteSlot(slot);
  if (!s) return false;
  if (s === "player") Sprites.player = img;
  else if (s === "pill") Sprites.pill = img;
  else Sprites.ghosts[s] = img;
  return true;
}

function clearPhoto(slot) {
  const s = spriteSlot(slot);
  if (!s) return false;
  setSprite(s, null);
  delete SpriteData[s];
  if (hasStorage()) {
    try { localStorage.removeItem(SPRITE_LS_PREFIX + s); } catch (e) {}
  }
  return true;
}

// Load a File/Blob (object URL), a data/URL string, or pass through an already
// loaded image-like object. Resolves an image element with natural dimensions.
function loadSourceImage(source) {
  const isFileOrBlob = (typeof File !== "undefined" && source instanceof File) ||
    (typeof Blob !== "undefined" && source instanceof Blob);
  if (isFileOrBlob) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(source);
      const img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("could not load image")); };
      img.src = url;
    });
  }
  if (typeof source === "string") {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("could not load image")); };
      img.src = source;
    });
  }
  return Promise.resolve(source);
}

// Two-pass separable box blur over RGBA (edge-clamped). Used when ctx.filter
// (canvas blur) is unavailable.
function boxBlurRgba(rgba, w, h, radius) {
  if (!radius || radius < 1) return rgba;
  const tmp = new Uint8ClampedArray(rgba.length);
  const out = new Uint8ClampedArray(rgba.length);
  const pass = function (src, dst, horizontal) {
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = (i / w) | 0;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let k = -radius; k <= radius; k++) {
        const px = horizontal ? x + k : x;
        const py = horizontal ? y : y + k;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const j = (py * w + px) * 4;
        r += src[j]; g += src[j + 1]; b += src[j + 2]; a += src[j + 3]; n++;
      }
      dst[i * 4] = r / n; dst[i * 4 + 1] = g / n; dst[i * 4 + 2] = b / n; dst[i * 4 + 3] = a / n;
    }
  };
  pass(rgba, tmp, true);
  pass(tmp, out, false);
  return out;
}

// Emoji-fy any photo: cover-crop to a square canvas, blur, posterize(20),
// median-cut to 16 flat colors. v1 draws the photo AS-IS (no masking/crop
// beyond the square). Resolves an Image whose src is the PNG data URL.
function imageToSprite(source, opts) {
  const o = opts || {};
  const size = o.size || SPRITE_SIZE;
  const colors = o.colors || 16;
  const levels = o.levels || 20;
  const blurPx = o.blur === undefined ? 4 : o.blur;
  return loadSourceImage(source).then(function (srcImg) {
    const sw = srcImg.naturalWidth || srcImg.width;
    const sh = srcImg.naturalHeight || srcImg.height;
    if (!sw || !sh) throw new Error("source image has no dimensions");
    const cv = document.createElement("canvas");
    cv.width = size; cv.height = size;
    const ctx = cv.getContext("2d");
    const hasFilter = typeof ctx.filter === "string";
    const scale = Math.max(size / sw, size / sh);
    const dw = sw * scale, dh = sh * scale;
    const dx = (size - dw) / 2, dy = (size - dh) / 2;
    if (blurPx > 0 && hasFilter) {
      ctx.filter = "blur(" + blurPx + "px)";
      ctx.drawImage(srcImg, dx, dy, dw, dh);
      ctx.filter = "none";
    } else {
      ctx.drawImage(srcImg, dx, dy, dw, dh);
    }
    let rgba = ctx.getImageData(0, 0, size, size).data;
    if (blurPx > 0 && !hasFilter) rgba = boxBlurRgba(rgba, size, size, blurPx);
    rgba = posterize(rgba, levels);
    const q = medianCut(rgba, size, size, colors);
    if (typeof ImageData !== "undefined") ctx.putImageData(new ImageData(q.data, size, size), 0, 0);
    const url = cv.toDataURL("image/png");
    const img = new Image();
    img.src = url;
    img._spriteUrl = url;
    return img;
  });
}

// Persistence: data URL per slot in localStorage (photos never leave the machine).
function hasStorage() {
  try { return typeof localStorage !== "undefined" && !!localStorage; } catch (e) { return false; }
}

// Total localStorage bytes in use by the sprite entries (keys + values).
function spriteUsage() {
  let total = 0;
  for (const s of Object.keys(SpriteData)) {
    total += (SPRITE_LS_PREFIX + s).length + String(SpriteData[s]).length;
  }
  return total;
}

// Would storing `url` under `slot` keep total usage within SPRITE_QUOTA?
// Re-placing the same slot counts the new URL in place of the old one.
function spriteFits(slot, url) {
  const s = spriteSlot(slot);
  if (!s) return false;
  const keyLen = (SPRITE_LS_PREFIX + s).length;
  let used = spriteUsage();
  const old = SpriteData[s];
  if (old) used -= keyLen + String(old).length;
  return used + keyLen + String(url).length <= SPRITE_QUOTA;
}

function persistSlot(slot) {
  if (!hasStorage()) return false;
  const url = SpriteData[slot];
  if (!url) return false;
  try { localStorage.setItem(SPRITE_LS_PREFIX + slot, url); return true; } catch (e) { return false; }
}

// End-to-end: process the photo, assign it to the slot, persist it.
// Resolves the slot name; rejects on unknown slot or unreadable image.
function assignPhoto(slot, source, opts) {
  const s = spriteSlot(slot);
  if (!s) return Promise.reject(new Error("unknown sprite slot: " + slot));
  return imageToSprite(source, opts).then(function (img) {
    const url = img._spriteUrl || (typeof img.src === "string" ? img.src : "");
    if (hasStorage() && !spriteFits(s, url)) {
      return Promise.reject(new Error("sprite storage quota exceeded"));
    }
    setSprite(s, img);
    SpriteData[s] = url;
    persistSlot(s);
    return s;
  });
}

// At boot: re-hydrate Sprites from localStorage so custom sprites survive reloads.
function restoreSprites() {
  if (typeof Image === "undefined" || !hasStorage()) return;
  const slots = allSlots();
  for (const s of slots) {
    let url = null;
    try { url = localStorage.getItem(SPRITE_LS_PREFIX + s); } catch (e) {}
    if (!url) continue;
    const img = new Image();
    img.src = url;
    img._spriteUrl = url;
    setSprite(s, img);
    SpriteData[s] = url;
  }
}

if (typeof Image !== "undefined") restoreSprites();
