// PERU MAN - continuous touch steering: while the finger is down, each chunk
// of travel (>= threshold) in a new dominant axis steers Pac-Man. A stationary
// finger emits nothing; lifting the finger ends the gesture (no auto-stop).

import type { Dir } from "./utils";

export const SWIPE_THRESHOLD = 20; // css px of travel before a turn registers

export class SwipeTracker {
  private threshold: number;
  private active = false;
  private ax = 0;
  private ay = 0;
  // true once at least one direction has fired since start() — the caller
  // uses it to tell a steer apart from a plain tap on release.
  fired = false;

  constructor(threshold: number = SWIPE_THRESHOLD) {
    this.threshold = threshold;
  }

  get isActive(): boolean {
    return this.active;
  }

  start(x: number, y: number): void {
    this.active = true;
    this.fired = false;
    this.ax = x;
    this.ay = y;
  }

  // Returns the direction to steer if this move crossed the threshold from the
  // last anchor point, otherwise null. Each fire re-anchors to the current
  // position, so the finger must travel another `threshold` before the next
  // direction can register (jitter filter + no repeated-fire storms).
  move(x: number, y: number): Dir | null {
    if (!this.active) return null;
    const dx = x - this.ax;
    const dy = y - this.ay;
    if (Math.hypot(dx, dy) < this.threshold) return null;
    this.ax = x;
    this.ay = y;
    this.fired = true;
    // dominant axis wins; diagonals (|dx| == |dy|) resolve to horizontal.
    // screen y grows downward, so dy > 0 is "down".
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }

  end(): void {
    this.active = false;
  }
}
