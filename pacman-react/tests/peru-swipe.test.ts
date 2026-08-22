// Headless unit tests for the continuous touch-steering tracker
// (src/game/swipe.ts). Pure math, no DOM needed.
import { describe, expect, it } from "vitest";
import { SWIPE_THRESHOLD, SwipeTracker } from "../src/game/swipe";

const T = SWIPE_THRESHOLD;

describe("SwipeTracker", () => {
  it("ignores movement before start() and after end()", () => {
    const t = new SwipeTracker();
    expect(t.move(100, 0)).toBeNull();
    t.start(0, 0);
    t.end();
    expect(t.move(300, 0)).toBeNull();
    expect(t.isActive).toBe(false);
  });

  it("reports isActive while a gesture is going", () => {
    const t = new SwipeTracker();
    expect(t.isActive).toBe(false);
    t.start(0, 0);
    expect(t.isActive).toBe(true);
    t.end();
    expect(t.isActive).toBe(false);
  });

  it("ignores wiggles under the threshold (fired stays false -> tap)", () => {
    const t = new SwipeTracker();
    t.start(100, 100);
    for (const [x, y] of [
      [105, 102],
      [96, 104],
      [101, 97],
      [99, 100],
    ]) {
      expect(t.move(x, y)).toBeNull();
    }
    expect(t.fired).toBe(false);
  });

  it("fires each axis once the threshold is crossed", () => {
    for (const [expectDir, dx, dy] of [
      ["right", T + 3, 0],
      ["left", -(T + 3), 0],
      ["up", 0, -(T + 3)],
      ["down", 0, T + 3],
    ] as const) {
      const t = new SwipeTracker();
      t.start(100, 100);
      expect(t.move(100 + dx, 100 + dy)).toBe(expectDir);
      expect(t.fired).toBe(true);
    }
  });

  it("fires exactly at the threshold (boundary)", () => {
    const t = new SwipeTracker();
    t.start(0, 0);
    expect(t.move(T, 0)).toBe("right");
    const t2 = new SwipeTracker();
    t2.start(0, 0);
    expect(t2.move(T - 1, 0)).toBeNull();
  });

  it("picks the dominant axis", () => {
    const t = new SwipeTracker();
    t.start(0, 0);
    expect(t.move(40, 12)).toBe("right"); // mostly horizontal
    t.start(0, 0);
    expect(t.move(12, 40)).toBe("down"); // mostly vertical
  });

  it("resolves diagonal ties to horizontal", () => {
    const t = new SwipeTracker();
    t.start(0, 0);
    expect(t.move(30, 30)).toBe("right");
    t.start(0, 0);
    expect(t.move(-30, 30)).toBe("left");
  });

  it("re-anchors on each turn, so a second threshold of travel re-fires", () => {
    const t = new SwipeTracker();
    t.start(0, 0);
    expect(t.move(100, 0)).toBe("right"); // anchor is now (100, 0)
    expect(t.move(101, 0)).toBeNull(); // still not a new threshold
    expect(t.move(160, 0)).toBe("right"); // another ~60px -> fires again
  });

  it("lets the finger change direction mid-gesture without lifting", () => {
    const t = new SwipeTracker();
    t.start(0, 0);
    expect(t.move(80, 0)).toBe("right"); // anchor (80, 0)
    expect(t.move(80, 90)).toBe("down"); // anchor (80, 90)
    expect(t.move(0, 90)).toBe("left"); // anchor (0, 90)
    expect(t.move(0, 0)).toBe("up"); // one continuous gesture, 4 dirs
  });

  it("supports instant U-turns (move back past the threshold)", () => {
    const t = new SwipeTracker();
    t.start(0, 0);
    expect(t.move(60, 0)).toBe("right");
    expect(t.move(0, 0)).toBe("left"); // swing back 60px
  });

  it("a stationary finger emits nothing even after a turn", () => {
    const t = new SwipeTracker();
    t.start(0, 0);
    expect(t.move(100, 0)).toBe("right");
    // keep tapping the same spot (no travel)
    expect(t.move(100, 0)).toBeNull();
    expect(t.move(100, 0)).toBeNull();
  });

  it("start() restarts cleanly with a fresh anchor and fired flag", () => {
    const t = new SwipeTracker();
    t.start(0, 0);
    expect(t.move(100, 0)).toBe("right");
    expect(t.fired).toBe(true);
    t.start(50, 50);
    expect(t.fired).toBe(false);
    expect(t.move(60, 60)).toBeNull(); // measured from the new anchor
    expect(t.move(60, 50 + T)).toBe("down");
  });

  it("honors a custom threshold", () => {
    const t = new SwipeTracker(30);
    t.start(0, 0);
    expect(t.move(25, 0)).toBeNull();
    expect(t.move(31, 0)).toBe("right");
  });
});
