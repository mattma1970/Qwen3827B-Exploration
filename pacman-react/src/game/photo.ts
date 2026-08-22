// PERU MAN - photo-to-sprite: pure pixel functions (posterize/medianCut) plus
// the browser glue (canvas pipeline, Sprites registry assignment, localStorage
// persistence). Every entry point here is guarded so headless (no DOM) callers
// can import the pure parts safely.
// Pipeline (glue): resize -> blur -> posterize -> medianCut -> (optional
// sticker outline) -> drawImage as-is.

import { Sprites } from "./sprites";
import { stickerOutline } from "./sticker";
import {
  SPRITE_SIZE,
  SPRITE_LS_PREFIX,
  SpriteData,
  allSlots,
  hasStorage,
  persistSlot,
  spriteFits,
  spriteSlot,
} from "./photoSlots";

// Snap each RGB channel to `levels` steps (2..256). Alpha is passed through.
// Returns a new array. levels < 2 is clamped to 2.
export function posterize(rgba: Uint8ClampedArray, levels: number): Uint8ClampedArray {
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

export interface MedianCutResult {
  data: Uint8ClampedArray;
  palette: number[][];
}

// Median-cut color quantization to at most `colors` flat palette colors.
// Works on opaque pixels (alpha>0); transparent pixels pass through untouched.
// Returns { data: new RGBA, palette: [[r,g,b], ...] } with palette.length <= colors.
export function medianCut(rgba: Uint8ClampedArray, w: number, h: number, colors: number): MedianCutResult {
  if (colors < 1) colors = 1;
  const n = w * h;

  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    if (rgba[i * 4 + 3] > 0) idx.push(i);
  }
  if (idx.length === 0) {
    return { data: new Uint8ClampedArray(rgba), palette: [] };
  }

  function bounds(list: number[]) {
    let rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0;
    for (const i of list) {
      const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      if (r < rmin) rmin = r;
      if (r > rmax) rmax = r;
      if (g < gmin) gmin = g;
      if (g > gmax) gmax = g;
      if (b < bmin) bmin = b;
      if (b > bmax) bmax = b;
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
      if (range > best) {
        best = range;
        bi = b;
      }
    }
    if (best <= 0 || boxPixels[bi].length < 2) break;

    const B = boxes[bi];
    const rRange = B.rmax - B.rmin, gRange = B.gmax - B.gmin, bRange = B.bmax - B.bmin;
    const ch = rRange >= gRange && rRange >= bRange ? 0 : gRange >= bRange ? 1 : 2;

    const list = boxPixels[bi].slice().sort((a, b) => rgba[a * 4 + ch] - rgba[b * 4 + ch]);
    const mid = list.length >> 1;
    const l1 = list.slice(0, mid);
    const l2 = list.slice(mid);

    boxPixels[bi] = l1;
    boxes[bi] = bounds(l1);
    boxPixels.push(l2);
    boxes.push(bounds(l2));
  }

  const palette: number[][] = [];
  for (let b = 0; b < boxes.length; b++) {
    const list = boxPixels[b];
    let r = 0, g = 0, bl = 0;
    for (const i of list) {
      r += rgba[i * 4];
      g += rgba[i * 4 + 1];
      bl += rgba[i * 4 + 2];
    }
    const cnt = list.length || 1;
    palette.push([Math.round(r / cnt), Math.round(g / cnt), Math.round(bl / cnt)]);
  }

  const data = new Uint8ClampedArray(rgba);
  for (const i of idx) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    let bestD = Infinity, pi = 0;
    for (let p = 0; p < palette.length; p++) {
      const dr = palette[p][0] - r, dg = palette[p][1] - g, db = palette[p][2] - b;
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) {
        bestD = d;
        pi = p;
      }
    }
    data[i * 4] = palette[pi][0];
    data[i * 4 + 1] = palette[pi][1];
    data[i * 4 + 2] = palette[pi][2];
  }

  return { data, palette };
}

// ---------------------------------------------------------------------------
// Glue (browser only): photo -> emoji-fied 256px sprite -> Sprites registry
// -> localStorage.
// ---------------------------------------------------------------------------

export type SourceImage = HTMLImageElement | File | Blob | string | {
  complete?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
  width: number;
  height: number;
  _sample?: (x: number, y: number) => [number, number, number, number];
};

export interface ToSpriteOpts {
  size?: number;
  colors?: number;
  levels?: number;
  blur?: number;
  // sticker ring around the alpha silhouette: px radius (`true` = 6), or
  // absent/false for the plain square. No-op on fully opaque photos, because
  // then the "background" the ring could cover doesn't exist.
  outline?: number | boolean;
}

// Load a File/Blob (object URL), a data/URL string, or pass through an already
// loaded image-like object. Resolves an image element with natural dimensions.
export function loadSourceImage(source: SourceImage): Promise<HTMLImageElement> {
  const isFileOrBlob = source instanceof File || source instanceof Blob;
  if (isFileOrBlob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(source);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("could not load image"));
      };
      img.src = url;
    });
  }
  if (typeof source === "string") {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("could not load image"));
      img.src = source;
    });
  }
  return Promise.resolve(source as HTMLImageElement);
}

// Two-pass separable box blur over RGBA (edge-clamped). Used when ctx.filter
// (canvas blur) is unavailable.
export function boxBlurRgba(rgba: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  if (!radius || radius < 1) return rgba;
  const tmp = new Uint8ClampedArray(rgba.length);
  const out = new Uint8ClampedArray(rgba.length);
  const pass = (src: Uint8ClampedArray, dst: Uint8ClampedArray, horizontal: boolean): void => {
    for (let i = 0; i < w * h; i++) {
      const x = i % w, y = (i / w) | 0;
      let r = 0, g = 0, b = 0, a = 0, nn = 0;
      for (let k = -radius; k <= radius; k++) {
        const px = horizontal ? x + k : x;
        const py = horizontal ? y : y + k;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        const j = (py * w + px) * 4;
        r += src[j]; g += src[j + 1]; b += src[j + 2]; a += src[j + 3]; nn++;
      }
      dst[i * 4] = r / nn;
      dst[i * 4 + 1] = g / nn;
      dst[i * 4 + 2] = b / nn;
      dst[i * 4 + 3] = a / nn;
    }
  };
  pass(rgba, tmp, true);
  pass(tmp, out, false);
  return out;
}

// Emoji-fy any photo: cover-crop to a square canvas, blur, posterize(20),
// median-cut to 16 flat colors. Feeds a cutout PNG (transparent background,
// see ./silhouette) the object keeps its silhouette instead of a flat square,
// and `outline` adds a flat sticker ring around that silhouette. Resolves an
// Image whose src is the PNG data URL.
export function imageToSprite(source: SourceImage, opts?: ToSpriteOpts): Promise<HTMLImageElement> {
  const o = opts || {};
  const size = o.size || SPRITE_SIZE;
  const colors = o.colors || 16;
  const levels = o.levels || 20;
  const blurPx = o.blur === undefined ? 4 : o.blur;
  return loadSourceImage(source).then((srcImg) => {
    const sw = srcImg.naturalWidth || srcImg.width;
    const sh = srcImg.naturalHeight || srcImg.height;
    if (!sw || !sh) throw new Error("source image has no dimensions");
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
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
    let rgba: Uint8ClampedArray = ctx.getImageData(0, 0, size, size).data;
    if (blurPx > 0 && !hasFilter) rgba = boxBlurRgba(rgba, size, size, blurPx);
    rgba = posterize(rgba, levels);
    const q = medianCut(rgba, size, size, colors);
    let out = q.data;
    const ring = typeof o.outline === "number" ? o.outline : o.outline === true ? 6 : 0;
    if (ring > 0) out = stickerOutline(out, size, size, { radius: ring });
    if (typeof ImageData !== "undefined") ctx.putImageData(new ImageData(out as unknown as ImageDataArray, size, size), 0, 0);
    const url = cv.toDataURL("image/png");
    const img = new Image();
    img.src = url;
    (img as never as { _spriteUrl?: string })._spriteUrl = url;
    return img;
  });
}

export function setSprite(slot: string, img: HTMLImageElement | null): boolean {
  const s = spriteSlot(slot);
  if (!s) return false;
  if (s === "player") Sprites.player = img;
  else if (s === "pill") Sprites.pill = img;
  else Sprites.ghosts[s] = img;
  return true;
}

export function spriteFor(slot: string): HTMLImageElement | null {
  const s = spriteSlot(slot);
  if (!s) return null;
  if (s === "player") return Sprites.player;
  if (s === "pill") return Sprites.pill;
  return Sprites.ghosts[s] || null;
}

export function clearPhoto(slot: string): boolean {
  const s = spriteSlot(slot);
  if (!s) return false;
  setSprite(s, null);
  delete SpriteData[s];
  if (hasStorage()) {
    try {
      localStorage.removeItem(SPRITE_LS_PREFIX + s);
    } catch (e) {}
  }
  return true;
}

// End-to-end: process the photo, assign it to the slot, persist it.
// Resolves the slot name; rejects on unknown slot, unreadable image, or a
// sprite that would overflow the storage quota.
export function assignPhoto(slot: string, source: SourceImage, opts?: ToSpriteOpts): Promise<string> {
  const s = spriteSlot(slot);
  if (!s) return Promise.reject(new Error("unknown sprite slot: " + slot));
  return imageToSprite(source, opts).then((img) => {
    const url = (img as never as { _spriteUrl?: string })._spriteUrl || (typeof img.src === "string" ? img.src : "");
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
export function restoreSprites(): void {
  if (typeof Image === "undefined" || !hasStorage()) return;
  for (const s of allSlots()) {
    let url: string | null = null;
    try {
      url = localStorage.getItem(SPRITE_LS_PREFIX + s);
    } catch (e) {}
    if (!url) continue;
    const img = new Image();
    img.src = url;
    (img as never as { _spriteUrl?: string })._spriteUrl = url;
    setSprite(s, img);
    SpriteData[s] = url;
  }
}
