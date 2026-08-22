// Headless tests for the per-slot character design (game/character.ts):
// first-run defaults, validation, and localStorage persistence (save, clear,
// boot restore). The module is DOM-free; the storage tests stub the global
// `localStorage` (matching the sprite-suite convention).
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHAR_COLORS,
  CHARS,
  OUTLINE_RADIUS,
  clearDesign,
  defaultDesign,
  designFor,
  isCharId,
  restoreCharDesigns,
  sanitizeDesign,
  setDesign,
} from "../src/game/character";
import { TURKEYS } from "../src/game/config";
import { allSlots } from "../src/game/photoSlots";

function makeStorage() {
  const backing: Record<string, string> = {};
  return {
    backing,
    getItem: (k: string) => (k in backing ? backing[k] : null),
    setItem: (k: string, v: string) => {
      backing[k] = String(v);
    },
    removeItem: (k: string) => {
      delete backing[k];
    },
  };
}
type StorageStub = ReturnType<typeof makeStorage>;

afterEach(() => {
  for (const s of allSlots()) clearDesign(s);
  vi.unstubAllGlobals();
});

describe("character library", () => {
  it("CHARS ids are unique + known, CHAR_COLORS all valid hex, OUTLINE_RADIUS is the thick ring", () => {
    const ids = CHARS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(isCharId(id)).toBe(true);
    for (const hex of CHAR_COLORS) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(OUTLINE_RADIUS).toBe(10);
  });
});

describe("defaultDesign (first-run looks)", () => {
  it("player -> yellow pacman, pill -> canva-purple pacman, each turkey -> ghost in its own color, all with silhueta", () => {
    expect(defaultDesign("player")).toEqual({ base: "pacman", color: "#ffdf00", silhueta: true });
    expect(defaultDesign("pill")).toEqual({ base: "pacman", color: "#6420ff", silhueta: true });
    for (const t of TURKEYS) {
      expect(defaultDesign(t.name)).toEqual({ base: "ghost", color: t.color, silhueta: true });
    }
    expect(defaultDesign("bogus-slot")).toEqual({ base: "none", color: "#ffffff", silhueta: true });
  });

  it("slot names are case-insensitive", () => {
    expect(defaultDesign("PLAYER").base).toBe("pacman");
    expect(defaultDesign("PILL").color).toBe("#6420ff");
    const t = TURKEYS[0];
    expect(defaultDesign(t.name.toUpperCase()).base).toBe("ghost");
    expect(defaultDesign(t.name.toLowerCase()).color).toBe(t.color);
  });
});

describe("isCharId + sanitizeDesign", () => {
  it("isCharId: true exactly for the library ids", () => {
    expect(isCharId("pacman")).toBe(true);
    expect(isCharId("ghost")).toBe(true);
    expect(isCharId("none")).toBe(true);
    expect(isCharId("Pacman")).toBe(false);
    expect(isCharId("nope")).toBe(false);
    expect(isCharId(undefined as unknown)).toBe(false);
    expect(isCharId(42 as unknown)).toBe(false);
  });

  it("sanitizeDesign(null/undefined) => the slot's defaults", () => {
    expect(sanitizeDesign(null, "player")).toEqual(defaultDesign("player"));
    expect(sanitizeDesign(undefined, "Rita")).toEqual(defaultDesign("Rita"));
  });

  it("per-field fallback: bad base/color fall back to that slot's defaults, good fields survive", () => {
    expect(sanitizeDesign({ base: "banana", color: "#123456", silhueta: false }, "player")).toEqual({
      base: "pacman",
      color: "#123456",
      silhueta: false,
    });
    expect(sanitizeDesign({ base: "ghost", color: "zzz" }, "Rita")).toEqual({
      base: "ghost",
      color: defaultDesign("Rita").color,
      silhueta: defaultDesign("Rita").silhueta,
    });
  });

  it("3-digit hex is accepted (valid CSS), malformed strings are not", () => {
    expect(sanitizeDesign({ base: "pacman", color: "#abc", silhueta: true }, "player").color).toBe("#abc");
    expect(sanitizeDesign({ base: "pacman", color: "red", silhueta: true }, "player").color).toBe("#ffdf00");
  });
});

describe("persistence (localStorage)", () => {
  it("setDesign saves sanitized JSON under peruman.char.<slot>; designFor reads it back", () => {
    const storage: StorageStub = makeStorage();
    vi.stubGlobal("localStorage", storage);
    setDesign("player", { base: "ghost", color: "#00ffff", silhueta: false });
    expect(designFor("player")).toEqual({ base: "ghost", color: "#00ffff", silhueta: false });
    const raw = storage.backing["peruman.char.player"];
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw)).toEqual({ base: "ghost", color: "#00ffff", silhueta: false });
  });

  it("setDesign sanitizes on save; clearDesign wipes memory and storage", () => {
    const storage: StorageStub = makeStorage();
    vi.stubGlobal("localStorage", storage);
    setDesign("pill", { base: "junk" as never, color: "#00c4cc", silhueta: true });
    expect(JSON.parse(storage.backing["peruman.char.pill"]).base).toBe("pacman");
    expect(designFor("pill")).toEqual({ base: "pacman", color: "#00c4cc", silhueta: true });
    clearDesign("pill");
    expect(designFor("pill")).toEqual(defaultDesign("pill"));
    expect(storage.backing["peruman.char.pill"]).toBeUndefined();
  });

  it("restoreCharDesigns re-hydrates saved designs; corrupt/invalid entries fall back to defaults", () => {
    for (const s of allSlots()) clearDesign(s);
    const storage: StorageStub = makeStorage();
    storage.backing["peruman.char.player"] = JSON.stringify({ base: "ghost", color: "#00ffff", silhueta: false });
    storage.backing["peruman.char.Dario"] = JSON.stringify({ base: "pacman", color: "#ffdf00", silhueta: false });
    storage.backing["peruman.char.Rita"] = "{broken json";
    storage.backing["peruman.char.Zeca"] = JSON.stringify({ base: "junk", color: "nope", silhueta: 1 });
    vi.stubGlobal("localStorage", storage);
    restoreCharDesigns();
    expect(designFor("player")).toEqual({ base: "ghost", color: "#00ffff", silhueta: false });
    expect(designFor("Dario")).toEqual({ base: "pacman", color: "#ffdf00", silhueta: false });
    expect(designFor("Rita")).toEqual(defaultDesign("Rita")); // unparseable -> defaults
    expect(designFor("Zeca")).toEqual(defaultDesign("Zeca")); // invalid fields -> defaults
    expect(designFor("Tuca")).toEqual(defaultDesign("Tuca")); // never saved -> defaults
  });

  it("no localStorage: in-memory design still works, setDesign reports false, nothing throws", () => {
    expect(setDesign("player", { base: "ghost", color: "#00ffff", silhueta: false })).toBe(false);
    expect(designFor("player")).toEqual({ base: "ghost", color: "#00ffff", silhueta: false });
    restoreCharDesigns(); // must be a safe no-op
    clearDesign("player");
    expect(designFor("player")).toEqual(defaultDesign("player"));
  });
});
