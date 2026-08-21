// PERU MAN - the turkey ghosts: personality-based AI on the grid.

import { CELL, COLS, DEN, ROWS, TUNE, type TurkeyDef } from "./config";
import { DIRS, DIR_NAMES, OPPOSITE, clamp, centerOf, isWall, isOpen, bfsDistances, type Dir, type Grid } from "./utils";
import { Mover, type Player } from "./pacman";

export class Turkey extends Mover {
  def: TurkeyDef;
  scatter: { r: number; c: number };
  released: boolean;
  releaseAt: number;
  releaseT: number;
  eaten: boolean;
  fright: boolean;
  bobT: number;
  _player: Player | null;

  constructor(grid: Grid, def: TurkeyDef, scatterTarget: { r: number; c: number }) {
    super(grid, def.start[0], def.start[1], TUNE.ghostSpeed);
    this.def = def;
    this.scatter = scatterTarget;
    this.released = false;
    this.releaseAt = def.release;
    this.releaseT = 0;
    this.eaten = false;
    this.fright = false;
    this.bobT = Math.random() * 6;
    this._player = null;
  }

  release(): void {
    if (!this.released) {
      this.released = true;
      this.dir = "none"; // aiDir picks a random way out
    }
  }

  setEaten(): void {
    this.eaten = true;
  }

  update(dt: number, player: Player, level: number, frightActive: boolean): void {
    this._player = player;
    this.fright = frightActive && !this.eaten && this.released;
    if (!this.released) {
      this.releaseT += dt;
      this.bobT += dt;
      if (this.releaseT >= this.releaseAt) this.release();
      return;
    }
    if (this.eaten) {
      this.flyToDen(dt);
      return;
    }
    const boost = 1 + Math.min(TUNE.maxLevelBoost, TUNE.levelSpeedStep * (level - 1));
    this.setSpeed((this.fright ? TUNE.frightSpeed : TUNE.ghostSpeed) * boost);
    this.step(dt);
  }

  // straight flight back to the den, ignoring the grid
  flyToDen(dt: number): void {
    const target = centerOf(DEN.r, DEN.c);
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const s = TUNE.eatenSpeed * dt;
    if (dist <= s + 1) {
      this.x = target.x;
      this.y = target.y;
      this.r = DEN.r;
      this.c = DEN.c;
      this.atCenter = true;
      this.dir = "none";
      this.eaten = false;
      this.fright = false;
      this.released = false;
      this.releaseAt = 1; // short breather before it hunts again
      this.releaseT = 0;
      this.bobT = Math.random() * 6;
    } else {
      this.x += (dx / dist) * s;
      this.y += (dy / dist) * s;
    }
  }

  decide(): void {
    this.dir = this.aiDir();
  }

  aiDir(): Dir {
    const open = DIR_NAMES.filter((d) => isOpen(this.grid, this.r + DIRS[d].dr, this.c + DIRS[d].dc));
    if (!open.length) return OPPOSITE[this.dir] || "right";

    // frightened: RUN AWAY from the player. Pick the open direction that gets
    // farthest from the player (they CAN reverse while panicking). Ties are
    // broken at random so the flock spreads out, plus an occasional twitch.
    if (this.fright) {
      const p = this._player || { r: 0, c: 0 };
      const dist = bfsDistances(this.grid, p.r, p.c);
      let bd = -1;
      let ties: Dir[] = [];
      for (const d of open) {
        const dd = dist[this.r + DIRS[d].dr][this.c + DIRS[d].dc];
        if (dd > bd) {
          bd = dd;
          ties = [d];
        } else if (dd === bd) ties.push(d);
      }
      if (Math.random() < 0.3) return open[(Math.random() * open.length) | 0];
      return ties[(Math.random() * ties.length) | 0];
    }

    // hunt: ghosts never reverse unless boxed in, then chase via BFS
    let opts: Dir[] = open;
    if (this.dir !== "none") {
      const noReversal = open.filter((d) => d !== OPPOSITE[this.dir]);
      if (noReversal.length) opts = noReversal;
    }
    if (!opts.length) return OPPOSITE[this.dir] || "right";

    const t = this.targetCell();
    const dist = bfsDistances(this.grid, t.r, t.c);
    let best = opts[0];
    let b = Infinity;
    for (const d of opts) {
      const dd = dist[this.r + DIRS[d].dr][this.c + DIRS[d].dc];
      if (dd < b) {
        b = dd;
        best = d;
      }
    }
    return best;
  }

  // each turkey chases a slightly different spot
  targetCell(): { r: number; c: number } {
    const p = this._player || { r: DEN.r, c: DEN.c, x: 0, y: 0, dir: "none" as Dir };
    let t = { r: p.r, c: p.c };
    const s = this.def.style;
    if (p.dir !== "none") {
      if (s === "ahead") {
        t = {
          r: clamp(p.r + DIRS[p.dir].dr * 3, 0, ROWS - 1),
          c: clamp(p.c + DIRS[p.dir].dc * 3, 0, COLS - 1),
        };
      } else if (s === "behind") {
        t = {
          r: clamp(p.r - DIRS[p.dir].dr * 2, 0, ROWS - 1),
          c: clamp(p.c - DIRS[p.dir].dc * 2, 0, COLS - 1),
        };
      }
    }
    if (s === "shy") {
      const near = Math.hypot(p.x - this.x, p.y - this.y) < CELL * 5;
      if (near) t = this.scatter;
    }
    if (isWall(this.grid, t.r, t.c)) t = { r: p.r, c: p.c };
    return t;
  }
}
