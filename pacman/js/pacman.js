// PERU MAN - grid movement base class + the player (BR-flag pacman).

// Grid-bound mover: walks cell centers, turns when buffered, never reverses
// unless blocked. Subclasses override decide() to set this.dir at each center.
class Mover {
  constructor(grid, r, c, speed) {
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

  setSpeed(s) { this.speed = s; }

  update(dt) {
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
      if (dist < 1e-6) { this.atCenter = true; break; }
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
  decide() {
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
      } else if (w !== OPPOSITE[this.dir] &&
                 isOpen(this.grid, this.r + DIRS[w].dr, this.c + DIRS[w].dc)) {
        this.dir = w;
        this.want = "none";
      }
      // otherwise keep buffering until a cell lets us honor it (or a wall
      // stop lets us reverse). New keypresses simply overwrite this value.
    }
    const dv = DIRS[this.dir];
    if (!isOpen(this.grid, this.r + dv.dr, this.c + dv.dc)) {
      this.dir = "none"; // hit a wall: stop and wait for a new direction
    }
  }
}

class Player extends Mover {
  constructor(grid, r, c, speed) {
    super(grid, r, c, speed);
  }
}
