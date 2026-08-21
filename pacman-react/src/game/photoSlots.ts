// PERU MAN - photo sprite slots: registry data + localStorage persistence.
// DOM-free (import-safe headless): spriteSlot only needs TURKEYS from config.

import { TURKEYS } from "./config";

export const SPRITE_SIZE = 256;
export const SPRITE_LS_PREFIX = "peruman.sprite.";
export const SPRITE_QUOTA = 5 * 1024 * 1024; // data-URL chars (~bytes) allowed across all slots

// slot -> data URL of the assigned photo sprite
export const SpriteData: Record<string, string> = {};

// Every assignable slot, in display order (player + the 4 named turkeys + pill).
export function allSlots(): string[] {
  const slots = ["player"];
  for (const d of TURKEYS) slots.push(d.name);
  slots.push("pill");
  return slots;
}

// Normalize a slot name: "player" | "pill" | a turkey name (case-insensitive).
// Returns null for unknown slots.
export function spriteSlot(name: string): string | null {
  const s = String(name);
  const low = s.toLowerCase();
  if (low === "player") return "player";
  if (low === "pill") return "pill";
  for (const d of TURKEYS) {
    if (d.name.toLowerCase() === s.toLowerCase()) return d.name;
  }
  return null;
}

// Persistence: data URL per slot in localStorage (photos never leave the machine).
export function hasStorage(): boolean {
  try {
    return typeof localStorage !== "undefined" && !!localStorage;
  } catch (e) {
    return false;
  }
}

export function persistSlot(slot: string): boolean {
  if (!hasStorage()) return false;
  const url = SpriteData[slot];
  if (!url) return false;
  try {
    localStorage.setItem(SPRITE_LS_PREFIX + slot, url);
    return true;
  } catch (e) {
    return false;
  }
}

// Total localStorage bytes in use by the sprite entries (keys + values).
export function spriteUsage(): number {
  let total = 0;
  for (const s of Object.keys(SpriteData)) {
    total += (SPRITE_LS_PREFIX + s).length + String(SpriteData[s]).length;
  }
  return total;
}

// Would storing `url` under `slot` keep total usage within SPRITE_QUOTA?
// Re-placing the same slot counts the new URL in place of the old one.
export function spriteFits(slot: string, url: string): boolean {
  const s = spriteSlot(slot);
  if (!s) return false;
  const keyLen = (SPRITE_LS_PREFIX + s).length;
  let used = spriteUsage();
  const old = SpriteData[s];
  if (old) used -= keyLen + String(old).length;
  return used + keyLen + String(url).length <= SPRITE_QUOTA;
}
