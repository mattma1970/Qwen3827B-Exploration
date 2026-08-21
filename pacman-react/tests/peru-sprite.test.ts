// Headless tests for the photo-to-sprite GLUE: Sprites registry, the
// imageToSprite pipeline over a stub canvas, turkey/pill photo slots,
// persistence + boot restore + storage-quota guards.
//
// The TS modules are DOM-guarded at import time, but imageToSprite needs real
// DOM (document/canvas/Image/localStorage/URL) at call time. So we stub those
// globals BEFORE a dynamic `import()` (so `typeof Image !== "undefined"` at
// module load creates the rafa/canva images), and use vi.resetModules() to get
// a fresh Sprites/SpriteData registry per scenario (mirroring the original's
// per-sandbox load).
import { afterEach, describe, expect, it, vi } from "vitest";

type Sample = (x: number, y: number) => [number, number, number, number];
interface ImgEntry {
  w: number;
  h: number;
  sample: Sample;
}
const IMGS: Record<string, ImgEntry> = {};

// ---- stubs ---------------------------------------------------------------

class StubImage {
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
  width = 0;
  height = 0;
  _srcVal = "";
  _onl: (() => void) | null = null;
  _one: (() => void) | null = null;
  _sample: Sample | null = null;
  _spriteUrl?: string;
  get src(): string {
    return this._srcVal;
  }
  set src(v: string) {
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
  get onload() {
    return this._onl;
  }
  set onload(f: (() => void) | null) {
    this._onl = f;
  }
  get onerror() {
    return this._one;
  }
  set onerror(f: (() => void) | null) {
    this._one = f;
  }
}

// already-loaded image-like object (skips loadSourceImage)
function loadedFake(w: number, h: number, sample: Sample) {
  return { complete: true, naturalWidth: w, naturalHeight: h, width: w, height: h, _sample: sample };
}

function makeStorage(limit?: number) {
  const backing: Record<string, string> = {};
  const used = () => Object.keys(backing).reduce((n, k) => n + k.length + backing[k].length, 0);
  return {
    backing,
    getItem: (k: string) => (k in backing ? backing[k] : null),
    setItem(k: string, v: string) {
      if (limit && used() + k.length + String(v).length > limit) throw new Error("QuotaExceededError");
      backing[k] = String(v);
    },
    removeItem: (k: string) => {
      delete backing[k];
    },
  };
}
type StorageStub = ReturnType<typeof makeStorage>;

const clampI = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function makeCtx(cv: Record<string, unknown>): CanvasRenderingContext2D {
  let curSrc: { naturalWidth: number; naturalHeight: number; _sample: Sample } | null = null;
  let stored: Uint8ClampedArray | null = null;
  cv.__getData = (w: number, h: number) => ({ data: stored ? stored.slice() : new Uint8ClampedArray(w * h * 4) });
  cv.__toDataUrl = () => "data:image/png;base64,fake_" + (cv as { __seq: number }).__seq;
  return new Proxy({ __cv: cv }, {
    get(t: Record<PropertyKey, unknown>, p) {
      if (p in t) return t[p];
      if (p === "drawImage")
        return (img: { naturalWidth: number; naturalHeight: number; _sample: Sample }) => {
          curSrc = img;
          return true;
        };
      if (p === "getImageData")
        return (_x: number, _y: number, w: number, h: number) => {
          if (!curSrc || !curSrc._sample) return { data: new Uint8ClampedArray(w * h * 4) };
          const data = new Uint8ClampedArray(w * h * 4);
          for (let i = 0; i < w * h; i++) {
            const px = clampI(Math.floor(((i % w) / w) * curSrc.naturalWidth), 0, curSrc.naturalWidth - 1);
            const py = clampI(Math.floor((((i / w) | 0) / h) * curSrc.naturalHeight), 0, curSrc.naturalHeight - 1);
            const s = curSrc._sample(px, py);
            data[i * 4] = s[0];
            data[i * 4 + 1] = s[1];
            data[i * 4 + 2] = s[2];
            data[i * 4 + 3] = s[3];
          }
          return { data };
        };
      if (p === "putImageData")
        return (imgData: { data: Uint8ClampedArray }) => {
          stored = new Uint8ClampedArray(imgData.data);
          return true;
        };
      if (p === "toDataURL") return () => (cv as { __toDataUrl: () => string }).__toDataUrl();
      if (p === "filter") return "none";
      return () => undefined;
    },
    set(t: Record<PropertyKey, unknown>, p, v) {
      t[p] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function makeDoc() {
  const doc = {
    canvases: [] as Record<string, unknown>[],
    seq: 0,
    createElement(tag: string) {
      if (tag !== "canvas") throw new Error("unexpected element " + tag);
      const cv: Record<string, unknown> = { width: 300, height: 150, __seq: ++doc.seq, ctx: null };
      cv.getContext = function (this: { ctx: unknown; __seq: number }, kind: string) {
        if (kind !== "2d") return null;
        if (!this.ctx) this.ctx = makeCtx(cv);
        return (this.ctx as unknown) as CanvasRenderingContext2D;
      };
      cv.toDataURL = function (this: { __seq: number }) {
        return "data:image/png;base64,fake_" + this.__seq;
      };
      doc.canvases.push(cv);
      return cv;
    },
  };
  return doc;
}

// recording ctx: every call is a no-op except drawImage (recorded).
function makeRecCtx(rec: { drawImage: unknown[][] }): CanvasRenderingContext2D {
  const noop = () => {};
  return new Proxy({}, {
    get: (_t, p) => {
      if (p === "drawImage")
        return (img: unknown, x: number, y: number, w: number, h: number) => {
          rec.drawImage.push([img, x, y, w, h]);
        };
      if (p === "createRadialGradient" || p === "createLinearGradient") return () => ({ addColorStop: noop });
      return noop;
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

// Fresh module registry over a stubbed DOM, with IMGS seeded for rafa + blob.
// `storage` undefined => no localStorage (headless / quota check skipped).
async function fresh(storage?: StorageStub) {
  vi.resetModules();
  vi.unstubAllGlobals();
  IMGS["img/rafa_emoji.png"] = { w: 256, h: 256, sample: () => [0, 154, 59, 255] };
  IMGS["blob:stub_0"] = { w: 4, h: 4, sample: (x) => (x < 2 ? [255, 0, 0, 255] : [0, 0, 255, 255]) };
  const doc = makeDoc();
  const urlStub = {
    created: [] as string[],
    createObjectURL() {
      const u = "blob:stub_" + urlStub.created.length;
      urlStub.created.push(u);
      return u;
    },
    revokeObjectURL() {},
  };
  class ImageDataStub {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(d: Uint8ClampedArray, w: number, h: number) {
      this.data = d;
      this.width = w;
      this.height = h;
    }
  }
  vi.stubGlobal("Image", StubImage);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("URL", urlStub);
  vi.stubGlobal("ImageData", ImageDataStub);
  if (storage) vi.stubGlobal("localStorage", storage);

  const sprites = await import("../src/game/sprites");
  const photo = await import("../src/game/photo");
  const ps = await import("../src/game/photoSlots");
  return { sprites, photo, ps, doc };
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.1;

afterEach(() => vi.unstubAllGlobals());

// ---- tests ---------------------------------------------------------------

describe("registry", () => {
  it("Sprites registry exists with empty slots; slot/for normalization; glue exists", async () => {
    const { sprites, photo, ps } = await fresh();
    expect(sprites.Sprites.player).toBeNull();
    expect(sprites.Sprites.pill).toBeNull();
    expect(sprites.Sprites.ghosts.Dario).toBeUndefined();
    expect(ps.spriteSlot("player")).toBe("player");
    expect(ps.spriteSlot("pill")).toBe("pill");
    expect(ps.spriteSlot("dario")).toBe("Dario");
    expect(ps.spriteSlot("TUca")).toBe("Tuca");
    expect(ps.spriteSlot("nope")).toBeNull();
    expect(photo.spriteFor("nope")).toBeNull();
    expect(photo.spriteFor("Dario")).toBeNull();
    expect(typeof photo.setSprite).toBe("function");
    expect(typeof photo.clearPhoto).toBe("function");
    expect(typeof photo.assignPhoto).toBe("function");
  });
});

describe("player fallback chain", () => {
  it("photo > rafa avatar; drawPlayer/drawMiniFlag use the assigned photo; clearPhoto restores fallback", async () => {
    const { sprites, photo } = await fresh();
    expect(sprites.playerSprite() !== null).toBe(true); // rafa fallback present

    const rec0 = { drawImage: [] as unknown[][] };
    sprites.drawPlayer(makeRecCtx(rec0), 10, 10, 14, 0.5, "right");
    expect(rec0.drawImage.length).toBe(1);
    expect(rec0.drawImage[0][0]).toBeTruthy();
    expect(rec0.drawImage[0].slice(1)).toEqual([-14, -14, 28, 28]);

    const fakePhoto = loadedFake(128, 128, () => [255, 215, 0, 255]);
    expect(photo.setSprite("player", fakePhoto as HTMLImageElement)).toBe(true);
    expect(sprites.Sprites.player).toBe(fakePhoto);
    expect(sprites.playerSprite()).toBe(fakePhoto);

    const rec1 = { drawImage: [] as unknown[][] };
    sprites.drawPlayer(makeRecCtx(rec1), 10, 10, 20, 0.5, "right");
    expect(rec1.drawImage.length).toBe(1);
    expect(rec1.drawImage[0][0]).toBe(fakePhoto);
    expect(rec1.drawImage[0].slice(1)).toEqual([-20, -20, 40, 40]);

    const m1 = { drawImage: [] as unknown[][] };
    sprites.drawMiniFlag(makeRecCtx(m1), 30, 40, 8);
    expect(m1.drawImage.length).toBe(1);
    expect(m1.drawImage[0][0]).toBe(fakePhoto);
    expect(m1.drawImage[0].slice(1)).toEqual([22, 32, 16, 16]);

    expect(photo.clearPhoto("player")).toBe(true);
    expect(sprites.Sprites.player).toBeNull();
    expect(sprites.playerSprite() !== null).toBe(true); // back to rafa fallback
  });
});

describe("imageToSprite pipeline", () => {
  it("cover-crop + blur + posterize + medianCut -> 2..8 flat colors, gradient preserved", async () => {
    const { photo, doc } = await fresh();
    const gradFake = loadedFake(200, 100, (x) => {
      const v = Math.round((x / 199) * 255);
      return [v, 255 - v, 128, 255];
    });
    await photo.imageToSprite(gradFake, { colors: 8, blur: 4 });
    const cv = doc.canvases[doc.canvases.length - 1];
    const d = (cv.__getData(256, 256) as { data: Uint8ClampedArray }).data;
    const pal: Record<string, 1> = {};
    for (let i = 0; i < 256 * 256; i++) pal[d[i * 4] + "," + d[i * 4 + 1] + "," + d[i * 4 + 2]] = 1;
    const rep = { unique: Object.keys(pal).length, size: d.length, left: [d[0], d[1], d[2]], right: [d[255 * 4], d[255 * 4 + 1], d[255 * 4 + 2]] };
    expect(rep.size).toBe(256 * 256 * 4);
    expect(rep.unique).toBeGreaterThanOrEqual(2);
    expect(rep.unique).toBeLessThanOrEqual(8);
    expect(rep.left[1]).toBeGreaterThan(rep.left[0]);
    expect(rep.right[0]).toBeGreaterThan(rep.right[1]);
  });

  it("File -> object URL path preserves a red|blue split", async () => {
    const { photo, doc } = await fresh();
    const blob = new Blob(["x"], { type: "image/png" });
    await photo.imageToSprite(blob, { colors: 16 });
    const cv = doc.canvases[doc.canvases.length - 1];
    const d = (cv.__getData(256, 256) as { data: Uint8ClampedArray }).data;
    const left = [d[0], d[1], d[2]];
    const right = [d[255 * 4], d[255 * 4 + 1], d[255 * 4 + 2]];
    expect(left[0]).toBeGreaterThan(left[2]);
    expect(right[2]).toBeGreaterThan(right[0]);
  });

  it("boxBlurRgba spreads a dot to its 3x3", async () => {
    const photo = await import("../src/game/photo");
    const n = 5;
    const rgba = new Uint8ClampedArray(n * n * 4);
    for (let i = 0; i < n * n; i++) rgba[i * 4 + 3] = 255;
    rgba[12 * 4] = 255;
    const out = photo.boxBlurRgba(rgba, n, n, 1);
    expect(out[12 * 4]).toBe(28);
    expect(out[7 * 4]).toBe(28);
    expect(out[0]).toBe(0);
  });

  it("assignPhoto rejects unknown slot and an un-loadable image", async () => {
    const { photo } = await fresh();
    const gradFake = loadedFake(200, 100, () => [1, 2, 3, 255]);
    const rej1 = await photo.assignPhoto("bogus", gradFake, { colors: 4 }).then(() => null, (e) => String(e));
    expect(rej1).toContain("unknown sprite slot");
    const rej2 = await photo.assignPhoto("player", "nope.jpg").then(() => null, (e) => String(e));
    expect(rej2).toContain("could not load image");
  });
});

describe("persistence", () => {
  it("assignPhoto sets Sprites + SpriteData + storage; clearPhoto removes all three", async () => {
    const { photo, sprites, ps } = await fresh(makeStorage());
    const gradFake = loadedFake(200, 100, () => [1, 2, 3, 255]);
    const slot = await photo.assignPhoto("Dario", gradFake, { colors: 4 });
    expect(slot).toBe("Dario");
    expect(sprites.Sprites.ghosts.Dario !== null).toBe(true);
    expect((sprites.Sprites.ghosts.Dario as { src: string }).src).toBe(ps.SpriteData.Dario);
    expect(ps.SpriteData.Dario).toMatch(/^data:image\/png/);
    expect(globalThis.localStorage.getItem("peruman.sprite.Dario")).toBe(ps.SpriteData.Dario);
    expect(photo.clearPhoto("Dario")).toBe(true);
    expect(sprites.Sprites.ghosts.Dario).toBeNull();
    expect(globalThis.localStorage.getItem("peruman.sprite.Dario")).toBeNull();
  });
});

describe("turkey + pill slots", () => {
  it("photo turkey/pill replace hand-drawn art as one unit; clearing falls back", async () => {
    const { sprites, photo } = await fresh();
    const turkeyPhoto = loadedFake(64, 64, () => [230, 57, 70, 255]);
    expect(photo.setSprite("Zeca", turkeyPhoto as HTMLImageElement)).toBe(true);
    expect(sprites.Sprites.ghosts.Zeca).toBe(turkeyPhoto);

    const t0 = { drawImage: [] as unknown[][] };
    sprites.drawTurkey(makeRecCtx(t0), 10, 10, 12, "#e63946", { name: "Zeca", facing: "right" });
    expect(t0.drawImage.length).toBe(1);
    expect(t0.drawImage[0][0]).toBe(turkeyPhoto);
    expect(near(t0.drawImage[0][1] as number, -13.8)).toBe(true);
    expect(near(t0.drawImage[0][2] as number, -13.8)).toBe(true);
    expect(near(t0.drawImage[0][3] as number, 27.6)).toBe(true);
    expect(near(t0.drawImage[0][4] as number, 27.6)).toBe(true);

    const t1 = { drawImage: [] as unknown[][] };
    sprites.drawTurkey(makeRecCtx(t1), 10, 10, 12, "#e63946", { name: "Zeca", fright: true, flick: true });
    expect(t1.drawImage.length).toBe(1);
    expect(t1.drawImage[0][0]).toBe(turkeyPhoto);

    const t2 = { drawImage: [] as unknown[][] };
    sprites.drawTurkey(makeRecCtx(t2), 10, 10, 12, "#e63946", { name: "Dario" });
    sprites.drawTurkey(makeRecCtx(t2), 20, 20, 12, "#ffb703", {});
    expect(t2.drawImage.length).toBe(0);

    const pillPhoto = loadedFake(100, 40, () => [0, 196, 204, 255]);
    expect(photo.setSprite("pill", pillPhoto as HTMLImageElement)).toBe(true);
    const p1 = { drawImage: [] as unknown[][] };
    sprites.drawCanvaPill(makeRecCtx(p1), 10, 10, 10, 0);
    expect(p1.drawImage.length).toBe(1);
    expect(p1.drawImage[0][0]).toBe(pillPhoto);
    expect(photo.clearPhoto("pill")).toBe(true);
    const p2 = { drawImage: [] as unknown[][] };
    sprites.drawCanvaPill(makeRecCtx(p2), 10, 10, 10, 0);
    expect(p2.drawImage.length).toBe(1);
    expect(p2.drawImage[0][0]).not.toBe(pillPhoto); // falls back to the Canva wordmark
  });
});

describe("boot restore", () => {
  it("restoreSprites rehydrates player + turkey photos from storage", async () => {
    IMGS["data:image/png;base64,boot_dario"] = { w: 256, h: 256, sample: () => [10, 20, 30, 255] };
    const storage = makeStorage();
    storage.setItem("peruman.sprite.Dario", "data:image/png;base64,boot_dario");
    storage.setItem("peruman.sprite.player", "data:image/png;base64,fake_persisted");
    const { photo, sprites, ps } = await fresh(storage);
    // The React app calls restoreSprites() once on mount; mirror that here.
    photo.restoreSprites();
    expect(sprites.Sprites.player !== null).toBe(true);
    expect((sprites.Sprites.player as { src: string }).src).toBe("data:image/png;base64,fake_persisted");
    expect(sprites.playerSprite()).toBe(sprites.Sprites.player);
    expect(sprites.Sprites.ghosts.Dario !== null).toBe(true);
    expect((sprites.Sprites.ghosts.Dario as { src: string }).src).toBe("data:image/png;base64,boot_dario");
    expect(ps.SpriteData.Dario).toBe("data:image/png;base64,boot_dario");
    expect(ps.SpriteData.player !== undefined).toBe(true);
  });
});

describe("quota guard", () => {
  it("snapshot still assigned even when storage is over quota; persistSlot swallows the error", async () => {
    const { photo, sprites, ps } = await fresh(makeStorage(1));
    const gradFake = loadedFake(200, 100, () => [1, 2, 3, 255]);
    const slotQ = await photo.assignPhoto("Rita", gradFake, { colors: 4 });
    expect(slotQ).toBe("Rita");
    expect(sprites.Sprites.ghosts.Rita !== null).toBe(true);
    expect(ps.persistSlot("Rita")).toBe(false);
    expect(ps.SpriteData.Rita !== undefined).toBe(true);
  });
});

describe("quota pre-check (M5)", () => {
  it("spriteUsage/spriteFits; rejects over-quota slot, allows same-slot replacement", async () => {
    const { photo, sprites, ps } = await fresh(makeStorage());
    const gradFake = loadedFake(200, 100, () => [1, 2, 3, 255]);
    expect(typeof ps.spriteUsage).toBe("function");
    expect(typeof ps.spriteFits).toBe("function");
    expect(ps.spriteUsage()).toBe(0);

    ps.SpriteData.Rita = "data:image/png;base64," + "X".repeat(1000);
    expect(ps.spriteUsage()).toBe((ps.SPRITE_LS_PREFIX + "Rita").length + ps.SpriteData.Rita.length);
    expect(ps.spriteFits("nope", "x")).toBe(false);

    ps.SpriteData.player = "data:image/png;base64," + "X".repeat(ps.SPRITE_QUOTA - 40);
    const rejQ = await photo.assignPhoto("pill", gradFake, { colors: 4 }).then(() => null, (e) => String(e));
    expect(rejQ).toContain("quota");
    expect(sprites.Sprites.pill).toBeNull();
    expect(sprites.Sprites.pill === null && (ps as { SpriteData: Record<string, string> }).SpriteData.pill === undefined).toBe(true);
    expect(globalThis.localStorage.getItem("peruman.sprite.pill")).toBeNull();

    const slotR = await photo.assignPhoto("player", gradFake, { colors: 4 });
    expect(slotR).toBe("player");
    expect(sprites.Sprites.player !== null).toBe(true);
    expect(ps.SpriteData.player).toMatch(/^data:image\/png/);
    expect(globalThis.localStorage.getItem("peruman.sprite.player")).toBe(ps.SpriteData.player);
    expect(ps.spriteFits("pill", "y".repeat(50))).toBe(true);
  });
});

describe("no storage", () => {
  it("no localStorage -> quota check skipped, in-memory assign still works", async () => {
    const { photo, sprites, ps } = await fresh(undefined);
    const gradFake = loadedFake(200, 100, () => [1, 2, 3, 255]);
    const slotNS = await photo.assignPhoto("Dario", gradFake, { colors: 4 });
    expect(slotNS).toBe("Dario");
    expect(sprites.Sprites.ghosts.Dario !== null).toBe(true);
    expect(ps.persistSlot("Dario")).toBe(false);
  });
});
