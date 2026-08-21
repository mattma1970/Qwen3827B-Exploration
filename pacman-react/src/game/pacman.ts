// PERU MAN - grid movement base class + the player (BR-flag pacman).

import { CELL } from "./config";
import { DIRS, OPPOSITE, isOpen, centerOf, type Dir, type Grid } from "./utils";

// Grid-bound mover: walks cell centers, turns when buffered, and honors a
// buffered reverse immediately (grid-safe: it retraces the same line).
// Subclasses override decide() to set this.dir at each center.
export class Mover {
  grid: Grid;
  r: number;
  c: number;
  x: number;
  y: number;
  dir: Dir;
  want: Dir;
  speed: number;
  waiting: boolean;
  atCenter: boolean;

  constructor(grid: Grid, r: number, c: number, speed: number) {
    this.grid = grid;
    this.r = r;
    this.c = c;
    const p = centerOf(r, c);
    this.x = p.x;
    this.y = p.y;
    this.dir = "none";
    this.want = "none";
    this.speed = speed;
    this.waiting = false;
    this.atCenter = true;
  }

  setSpeed(s: number): void {
    this.speed = s;
  }

  // one grid-movement step (player actors expose this as update())
  step(dt: number): void {
    // Buffered reverse is applied at once, even mid-cell, instead of waiting
    // for a wall stop — turning around should feel instant.
    if (this.dir !== "none" && this.want !== "none" && this.want === OPPOSITE[this.dir]) {
      this.dir = this.want;
      this.want = "none";
    }
    if (this.waiting) {
      if (this.want !== "none" && isOpen(this.grid, this.r + DIRS[this.want].dr, this.c + DIRS[this.want].dc)) {
        this.dir = this.want;
        this.want = "none";
        this.waiting = false;
      } else {
        return;
      }
    }
    let d = this.speed * dt;
    while (d > 1e-6) {
      if (this.atCenter) {
        this.decide();
        if (this.dir === "none" || this.waiting) break;
      }
      const dv = DIRS[this.dir];
      const tx = (this.c + dv.dc) * CELL + CELL / 2;
      const ty = (this.r + dv.dr) * CELL + CELL / 2;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1e-6) {
        this.atCenter = true;
        break;
      }
      const s = Math.min(d, dist);
      this.x += (dx / dist) * s;
      this.y += (dy / dist) * s;
      d -= s;
      if (s >= dist - 1e-6) {
        this.r += dv.dr;
        this.c += dv.dc;
        this.atCenter = true;
      } else {
        break;
      }
    }
  }

  // default: apply buffered turn (player behavior)
  decide(): void {
    if (this.dir === "none") {
      if (this.want !== "none" && isOpen(this.grid, this.r + DIRS[this.want].dr, this.c + DIRS[this.want].dc)) {
        this.dir = this.want;
        this.want = "none";
      } else {
        return;
      }
    }
    if (this.want !== "none") {
      const w = this.want;
      if (w === this.dir) {
        this.want = "none"; // already heading that way
      } else if (w !== OPPOSITE[this.dir] && isOpen(this.grid, this.r + DIRS[w].dr, this.c + DIRS[w].dc)) {
        this.dir = w;
        this.want = "none";
      }
      // otherwise keep buffering until a cell lets us honor it. (Reverse
      // presses are handled immediately in update().) New keypresses simply
      // overwrite this value.
    }
    const dv = DIRS[this.dir];
    if (!isOpen(this.grid, this.r + dv.dr, this.c + dv.dc)) {
      this.dir = "none"; // hit a wall: stop and wait for a new direction
    }
  }
}

export class Player extends Mover {
  constructor(grid: Grid, r: number, c: number, speed: number) {
    super(grid, r, c, speed);
  }

  update(dt: number): void {
    this.step(dt);
  }
}
