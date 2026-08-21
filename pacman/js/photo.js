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
