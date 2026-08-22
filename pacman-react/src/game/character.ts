// PERU MAN - per-slot character design: which base character a photo rides on,
// its color, and whether a silhueta cutout was applied. This is where future
// design effects (e.g. a "cartoonize" style) plug in: add a field to
// CharDesign + an option row in the wizard + its pipeline/render effect.
// Pure data + localStorage (DOM-free, import-safe headless).

import { TURKEYS } from "./config";
import { allSlots, hasStorage } from "./photoSlots";

export interface CharDesign {
  base: string; // "pacman" | "ghost" | "none"
  color: string; // hex tint applied to the base
  silhueta: boolean; // cut the photo's background before emoji-fying it
}

// The standard library of base characters (extensible: add an entry here, a
// draw branch in sprites.ts drawCharacterBase, and adjust defaults if needed).
export const CHARS: { id: string; label: string }[] = [
  { id: "pacman", label: "PACMAN" },
  { id: "ghost", label: "FANTASMA" },
  { id: "none", label: "SÓ RECORTE" },
];

// Classic arcade palette first, then extras.
export const CHAR_COLORS = [
  "#ffdf00", // pacman yellow
  "#ff0000", // blinky
  "#ffb8ff", // pinky
  "#00ffff", // inky
  "#ffb852", // clyde
  "#ffffff",
  "#202020",
  "#6420ff", // canva purple
  "#00c4cc", // canva teal
  "#e63946",
];

// The sticker ring is thicker than the pipeline default so it survives the
// 256 -> ~28 px shrink on the board.
export const OUTLINE_RADIUS = 10;

export function isCharId(id: unknown): id is string {
  return typeof id === "string" && CHARS.some((c) => c.id === id);
}

// The first-run look per slot: the player and pill ride the classic Pac-Man
// (pill in the Canva purple), each turkey becomes the classic ghost in its own
// color. Unknown slots get the sticker-only look.
export function defaultDesign(slot: string): CharDesign {
  const low = String(slot).toLowerCase();
  for (const t of TURKEYS) {
    if (t.name.toLowerCase() === low) return { base: "ghost", color: t.color, silhueta: true };
  }
  if (low === "player") return { base: "pacman", color: "#ffdf00", silhueta: true };
  if (low === "pill") return { base: "pacman", color: "#6420ff", silhueta: true };
  return { base: "none", color: "#ffffff", silhueta: true };
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

// Defensive normalization (used on save AND on restore of stale/corrupt JSON).
export function sanitizeDesign(d: Partial<CharDesign> | null | undefined, slot: string): CharDesign {
  const fall = defaultDesign(slot);
  return {
    base: d && isCharId(d.base) ? d.base : fall.base,
    color: d && typeof d.color === "string" && HEX_RE.test(d.color) ? d.color : fall.color,
    silhueta: d && typeof d.silhueta === "boolean" ? d.silhueta : fall.silhueta,
  };
}

export const CHAR_LS_PREFIX = "peruman.char.";

// slot -> saved design (in-memory mirror of localStorage)
export const CharDesigns: Record<string, CharDesign> = {};

export function designFor(slot: string): CharDesign {
  return sanitizeDesign(CharDesigns[slot] || undefined, slot);
}

export function setDesign(slot: string, d: CharDesign): boolean {
  const cd = sanitizeDesign(d, slot);
  CharDesigns[slot] = cd;
  if (!hasStorage()) return false;
  try {
    localStorage.setItem(CHAR_LS_PREFIX + slot, JSON.stringify(cd));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearDesign(slot: string): void {
  delete CharDesigns[slot];
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(CHAR_LS_PREFIX + slot);
  } catch (e) {}
}

// At boot: re-hydrate the per-slot designs so saved looks survive reloads.
export function restoreCharDesigns(): void {
  if (!hasStorage()) return;
  for (const s of allSlots()) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(CHAR_LS_PREFIX + s);
    } catch (e) {}
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") CharDesigns[s] = sanitizeDesign(parsed, s);
    } catch (e) {}
  }
}
