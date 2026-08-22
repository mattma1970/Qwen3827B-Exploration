// Headless tests for the sticker-outline pixel math (sticker.ts, pure) and the
// lazy @imgly/background-removal wrapper (silhouette.ts, with the model mocked).
import { afterEach, describe, expect, it, vi } from "vitest";

import { dilate, maskFromAlpha, stickerOutline } from "../src/game/sticker";

// ---- silhouette wrapper (imgly is mocked, so no ONNX/WASM ever loads) ------

const mockRemove = vi.fn();
const mockPreload = vi.fn();
vi.mock("@imgly/background-removal", () => ({
  removeBackground: (...a: unknown[]) => mockRemove(...a),
  preload: (...a: unknown[]) => mockPreload(...a),
}));

async function cutoutMod() {
  vi.resetModules();
  return await import("../src/game/silhouette");
}

describe("sticker.ts: maskFromAlpha", () => {
  it("thresholds alpha at >= 128 (default) and custom", () => {
    // alphas: 127, 128, 255, 0
    const rgba = new Uint8ClampedArray([0, 0, 0, 127, 0, 0, 0, 128, 0, 0, 0, 255, 0, 0, 0, 0]);
    const m = maskFromAlpha(rgba, 2, 2);
    expect(Array.from(m)).toEqual([0, 1, 1, 0]);
    const m2 = maskFromAlpha(rgba, 2, 2, 1);
    expect(Array.from(m2)).toEqual([1, 1, 1, 0]);
    const m3 = maskFromAlpha(rgba, 2, 2, 256);
    expect(Array.from(m3)).toEqual([0, 0, 0, 0]);
  });
});

describe("sticker.ts: dilate", () => {
  it("grows a dot to a (2r+1)^2 square and copies when radius < 1", () => {
    const n = 5;
    const m = new Uint8Array(n * n);
    m[12] = 1; // center
    const out = dilate(m, n, n, 1);
    const grownIdx = [];
    for (let i = 0; i < n * n; i++) if (out[i]) grownIdx.push(i);
    expect(grownIdx).toEqual([6, 7, 8, 11, 12, 13, 16, 17, 18]); // the 3x3 around center
    expect(Array.from(dilate(m, n, n, 0))).toEqual(Array.from(m)); // <1 -> copy
    expect(m[12]).toBe(1); // input untouched
  });

  it("is separable-max: matches the brute-force box max on a random mask", () => {
    const w = 7, h = 5, r = 2;
    const m = new Uint8Array(w * h);
    let s = 12345;
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < w * h; i++) m[i] = rnd() < 0.35 ? 1 : 0;
    const out = dilate(m, w, h, r);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let want = 0;
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const px = x + dx, py = y + dy;
            if (px < 0 || py < 0 || px >= w || py >= h) continue;
            if (m[py * w + px]) want = 1;
          }
        expect(out[y * w + x]).toBe(want);
      }
    }
  });

  it("clamps at edges (a corner dot grows into an L, not a full square)", () => {
    const n = 4;
    const m = new Uint8Array(n * n);
    m[0] = 1;
    const out = dilate(m, n, n, 1);
    // pixels within Chebyshev distance 1 of (0,0): (0,0),(1,0),(0,1),(1,1)
    expect(Array.from(out, (v) => (v ? 1 : 0))).toEqual([1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("sticker.ts: stickerOutline", () => {
  function solid(w: number, h: number, r: number, g: number, b: number, a: number): Uint8ClampedArray {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = a;
    }
    return d;
  }

  it("fully opaque input is untouched (no background to outline)", () => {
    const d = solid(4, 4, 200, 0, 0, 255);
    const out = stickerOutline(d, 4, 4, { radius: 3 });
    expect(Array.from(out)).toEqual(Array.from(d));
  });

  it("draws a flat white ring around the silhouette, leaving object + far background alone", () => {
    // 9x9, object = 3x3 square at the center (alpha 255), rest transparent
    const n = 9;
    const d = new Uint8ClampedArray(n * n * 4);
    for (let y = 3; y < 6; y++)
      for (let x = 3; x < 6; x++) {
        d[(y * n + x) * 4 + 3] = 255;
      }
    const out = stickerOutline(d, n, n, { radius: 2 });
    const at = (x: number, y: number) => [(out[(y * n + x) * 4]), out[(y * n + x) * 4 + 1], out[(y * n + x) * 4 + 2], out[(y * n + x) * 4 + 3]];
    // object pixel unchanged (still fully transparent in RGB, alpha 255)
    expect(at(4, 4)[3]).toBe(255);
    expect(at(4, 4)[0]).toBe(0);
    // ring pixel: 2 away from the object edge -> white opaque
    expect(at(5, 1)).toEqual([255, 255, 255, 255]);
    expect(at(1, 5)).toEqual([255, 255, 255, 255]);
    // far corner: still transparent
    expect(at(0, 0)[3]).toBe(0);
    expect(at(8, 8)[3]).toBe(0);
    // one past the ring (Chebyshev 3 from the object) stays background
    expect(at(5, 0)[3]).toBe(0);
    expect(at(8, 4)[3]).toBe(0);
    // ring pixels right up to the r=2 boundary
    expect(at(6, 4)).toEqual([255, 255, 255, 255]);
    expect(at(7, 4)).toEqual([255, 255, 255, 255]);
  });

  it("honors a custom ring color and does not rewrite soft-alpha edges inside the mask", () => {
    const n = 5;
    const d = new Uint8ClampedArray(n * n * 4);
    // object pixel with alpha 128 (>= default threshold => mask), RGB kept
    d[(2 * n + 2) * 4] = 10;
    d[(2 * n + 2) * 4 + 1] = 20;
    d[(2 * n + 2) * 4 + 2] = 30;
    d[(2 * n + 2) * 4 + 3] = 128;
    const out = stickerOutline(d, n, n, { radius: 1, color: [255, 0, 0] });
    expect(Array.from(out.slice((2 * n + 2) * 4, (2 * n + 2) * 4 + 4))).toEqual([10, 20, 30, 128]); // object pixel kept
    expect(Array.from(out.slice((2 * n + 1) * 4, (2 * n + 1) * 4 + 4))).toEqual([255, 0, 0, 255]); // left neighbor ring
    expect(out[(0 * n + 0) * 4 + 3]).toBe(0); // corner: 2 away -> background
  });
});

describe("silhouette.ts: lazy imgly wrapper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockRemove.mockReset();
    mockPreload.mockReset();
  });

  it("resolves the cutout Blob and forwards model/output/progress config", async () => {
    vi.stubGlobal("window", {});
    const { cutout } = await cutoutMod();
    const progress = vi.fn();
    const blob = new Blob(["png"], { type: "image/png" });
    mockRemove.mockResolvedValue(blob);
    const got = await cutout("data:image/png;base64,x", { progress });
    expect(got).toBe(blob);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    const [src, cfg] = mockRemove.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(src).toBe("data:image/png;base64,x");
    expect(cfg.model).toBe("isnet_quint8");
    expect(cfg.output).toEqual({ format: "image/png" });
    expect(cfg.progress).toBe(progress);
  });

  it("null source short-circuits without importing anything", async () => {
    const { cutout } = await cutoutMod();
    expect(await cutout("", {})).toBeNull();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("resolves null when the model throws or returns an empty Blob", async () => {
    vi.stubGlobal("window", {});
    const { cutout } = await cutoutMod();
    mockRemove.mockRejectedValue(new Error("boom"));
    expect(await cutout("img.png")).toBeNull();
    mockRemove.mockResolvedValue(new Blob([]));
    expect(await cutout("img.png")).toBeNull();
  });

  it("preloadCutout forwards the model choice and swallows failures", async () => {
    vi.stubGlobal("window", {});
    const { preloadCutout } = await cutoutMod();
    await expect(preloadCutout({ model: "isnet_fp16" })).resolves.toBeUndefined();
    expect(mockPreload).toHaveBeenCalledWith({ model: "isnet_fp16" });
    mockPreload.mockRejectedValue(new Error("nope"));
    await expect(preloadCutout()).resolves.toBeUndefined();
  });

  it("preloadCutout defaults to the smallest model and forwards progress", async () => {
    vi.stubGlobal("window", {});
    const { preloadCutout } = await cutoutMod();
    const progress = vi.fn();
    await expect(preloadCutout({ progress })).resolves.toBeUndefined();
    expect(mockPreload).toHaveBeenCalledTimes(1);
    const [cfg] = mockPreload.mock.calls[0] as [Record<string, unknown>];
    expect(cfg.model).toBe("isnet_quint8");
    expect(cfg.progress).toBe(progress);
  });
});
