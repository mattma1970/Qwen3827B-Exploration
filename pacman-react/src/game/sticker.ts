// PERU MAN - sticker outline: pure pixel math over RGBA buffers (no DOM).
// Given a sprite whose alpha channel is the object silhouette (e.g. after a
// background cutout), draws a flat bright ring AROUND the silhouette so the
// character reads as a cartoon sticker at the ~28px board size.
// The ring only ever touches background pixels (alpha < threshold within
// `radius` of the object); object colors and soft alpha edges are untouched.

// Binary foreground mask: 1 where alpha >= threshold, else 0.
export function maskFromAlpha(rgba: Uint8ClampedArray, w: number, h: number, threshold = 128): Uint8Array {
  const n = w * h;
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = rgba[i * 4 + 3] >= threshold ? 1 : 0;
  return m;
}

// Binary dilation (max filter, square box of half-size `radius`), separable in
// two passes with edge clamping. radius < 1 returns a copy.
export function dilate(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  if (!radius || radius < 1) return mask.slice();
  const tmp = new Uint8Array(mask.length);
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = 0;
      const x0 = x - radius < 0 ? 0 : x - radius;
      const x1 = x + radius > w - 1 ? w - 1 : x + radius;
      for (let k = x0; k <= x1; k++) {
        if (mask[row + k]) {
          v = 1;
          break;
        }
      }
      tmp[row + x] = v;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 0;
      const y0 = y - radius < 0 ? 0 : y - radius;
      const y1 = y + radius > h - 1 ? h - 1 : y + radius;
      for (let k = y0; k <= y1; k++) {
        if (tmp[k * w + x]) {
          v = 1;
          break;
        }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

export interface OutlineOpts {
  radius?: number; // ring thickness in px (default 6)
  color?: [number, number, number]; // ring color (default white)
  threshold?: number; // alpha cutoff for "inside the object" (default 128)
}

// Returns a new RGBA with a flat `color` ring of `radius` px around the alpha
// silhouette. Every pixel that is background (alpha < threshold) but within
// `radius` of the object becomes fully opaque ring color; all other pixels
// (object + far background) are copied through unchanged.
export function stickerOutline(rgba: Uint8ClampedArray, w: number, h: number, opts?: OutlineOpts): Uint8ClampedArray {
  const o = opts || {};
  const radius = o.radius || 6;
  if (radius < 1) return rgba.slice();
  const color = o.color || [255, 255, 255];
  const n = w * h;
  const mask = maskFromAlpha(rgba, w, h, o.threshold == null ? 128 : o.threshold);
  const grown = dilate(mask, w, h, radius);
  const out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < n; i++) {
    if (grown[i] && !mask[i]) {
      out[i * 4] = color[0];
      out[i * 4 + 1] = color[1];
      out[i * 4 + 2] = color[2];
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}
