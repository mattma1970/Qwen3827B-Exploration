// Regression: key presses must be buffered until the turn can actually be made.
import { describe, expect, it } from "vitest";
import { MAZE, TUNE, type Grid } from "../src/game/config";
import { Player } from "../src/game/pacman";

const gridTest: Grid = MAZE.map((row) => row.split(""));

function makePlayer(r: number, c: number, dirName: Player["dir"]): Player {
  const pl = new Player(gridTest, r, c, TUNE.playerSpeed);
  pl.dir = dirName;
  pl.update(1 / 60);
  return pl;
}

describe("early buffered turn", () => {
  it("presses 'up' while blocked (c2,c3) and honors it at c4", () => {
    const p = makePlayer(12, 2, "right"); // moving right; up is blocked at c2, c3
    p.want = "up"; // keypress arrives mid-cell
    let turnC = -1;
    for (let i = 0; i < 300 && turnC === -1; i++) {
      p.update(1 / 60);
      if (p.dir === "up" && p.c > 1) turnC = p.c;
    }
    expect(turnC).toBe(4);
  });
});

describe("immediate reverse (mid-cell)", () => {
  it("reverses at once and backs away from a dead end", () => {
    const q = makePlayer(10, 4, "right"); // moving right; dead end wall at c7
    q.want = "left"; // keypress arrives mid-cell
    q.update(1 / 60);
    expect(q.dir).toBe("left");
    expect(q.want).toBe("none");
    for (let i = 0; i < 30; i++) q.update(1 / 60);
    expect(q.c).toBeLessThan(4);
  });
});

describe("same-direction press", () => {
  it("is consumed cleanly (no stale state, no self-turn)", () => {
    const w = makePlayer(12, 7, "right");
    w.want = "right";
    for (let i = 0; i < 10; i++) w.update(1 / 60);
    expect(w.dir).toBe("right");
    expect(w.want).toBe("none");
  });
});
