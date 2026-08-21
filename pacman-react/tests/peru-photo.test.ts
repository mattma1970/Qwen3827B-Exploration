// Headless unit tests for the photo-to-sprite pure core: posterize + medianCut.
// The TS modules are DOM-guarded at import time, so the pure functions import
// cleanly in a node/vitest environment.
import { describe, expect, it } from "vitest";
import { medianCut, posterize } from "../src/game/photo";

describe("posterize", () => {
  const gray = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    gray[i * 4] = i;
    gray[i * 4 + 1] = i;
    gray[i * 4 + 2] = i;
    gray[i * 4 + 3] = 255;
  }
  const p20 = posterize(gray, 20);

  it("levels=20 keeps <=20 distinct values per channel", () => {
    const distinct = new Set<number>();
    for (let i = 0; i < 256; i++) distinct.add(p20[i * 4]);
    expect(distinct.size).toBeLessThanOrEqual(20);
  });

  it("endpoints preserved (0 stays 0, 255 stays 255)", () => {
    expect(p20[0]).toBe(0);
    expect(p20[255 * 4]).toBe(255);
  });

  it("output is non-decreasing (no banding inversions)", () => {
    for (let i = 1; i < 256; i++) expect(p20[i * 4]).toBeGreaterThanOrEqual(p20[(i - 1) * 4]);
  });

  it("idempotent (posterizing twice is stable)", () => {
    const p20b = posterize(p20, 20);
    for (let i = 0; i < p20.length; i++) expect(p20b[i]).toBe(p20[i]);
  });

  it("alpha passed through untouched", () => {
    expect(p20[3]).toBe(255);
    expect(posterize(gray, 4)[7]).toBe(255);
  });
});

describe("medianCut", () => {
  it("2-color image -> palette of 2, and every opaque mapped pixel is a palette color", () => {
    const w = 16, h = 16;
    const two = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const black = i % 2 === 0;
      two[i * 4] = black ? 0 : 255;
      two[i * 4 + 1] = 0;
      two[i * 4 + 2] = 0;
      two[i * 4 + 3] = 255;
    }
    const r2 = medianCut(two, w, h, 16);
    expect(r2.palette.length).toBe(2);
    const palSet = new Set(r2.palette.map((c) => c.join(",")));
    for (let i = 0; i < w * h; i++) {
      const key = r2.data[i * 4] + "," + r2.data[i * 4 + 1] + "," + r2.data[i * 4 + 2];
      expect(palSet.has(key)).toBe(true);
    }
  });

  it("grayscale gradient -> palette fills to the requested count (8)", () => {
    const gw = 64, gh = 1;
    const grad = new Uint8ClampedArray(gw * gh * 4);
    for (let i = 0; i < gw; i++) {
      grad[i * 4] = Math.round((i / (gw - 1)) * 255);
      grad[i * 4 + 1] = grad[i * 4];
      grad[i * 4 + 2] = grad[i * 4];
      grad[i * 4 + 3] = 255;
    }
    expect(medianCut(grad, gw, gh, 8).palette.length).toBe(8);
  });

  it("respects a small color cap (<=2)", () => {
    const gw = 64, gh = 1;
    const grad = new Uint8ClampedArray(gw * gh * 4);
    for (let i = 0; i < gw; i++) {
      grad[i * 4] = grad[i * 4 + 1] = grad[i * 4 + 2] = Math.round((i / (gw - 1)) * 255);
      grad[i * 4 + 3] = 255;
    }
    expect(medianCut(grad, gw, gh, 2).palette.length).toBeLessThanOrEqual(2);
  });

  it("preserves transparency (untouched alpha)", () => {
    const tw = 4, th = 1;
    const tr = new Uint8ClampedArray(tw * th * 4);
    for (let i = 0; i < tw; i++) {
      tr[i * 4] = 200;
      tr[i * 4 + 1] = 100;
      tr[i * 4 + 2] = 50;
      tr[i * 4 + 3] = i < 2 ? 255 : 0;
    }
    const rt = medianCut(tr, tw, th, 16);
    expect(rt.data[1 * 4 + 3]).toBe(255);
    expect(rt.data[3 * 4 + 3]).toBe(0);
  });

  it("fully-transparent input -> empty palette, no crash", () => {
    const ft = new Uint8ClampedArray(16);
    const rf = medianCut(ft, 4, 1, 16);
    expect(rf.palette.length).toBe(0);
    expect(rf.data.length).toBe(16);
  });
});
