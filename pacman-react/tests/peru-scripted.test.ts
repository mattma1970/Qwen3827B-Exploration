// Scripted verification: Canva pill -> frightened -> gobble -> respawn, levelup.
import { describe, expect, it } from "vitest";
import { Game } from "../src/game/game";
import { noopCtx } from "./helpers";

describe("scripted gameplay", () => {
  it("pill fright, gobble, respawn, and levelup all work", () => {
    const G = new Game(noopCtx(), 480);
    G.newGame();
    G.setState("play");
    const p = G.player!;

    // put the player sitting on a Canva pill
    p.r = 1;
    p.c = 1;
    p.x = 1 * 32 + 16;
    p.y = 1 * 32 + 16;
    p.atCenter = true;
    p.dir = "none";
    G.grid[1][1] = "P";

    G.update(1 / 60);
    expect(G.frightT).toBeGreaterThan(5);
    expect(G.grid[1][1]).toBe(" ");
    expect(G.score).toBeGreaterThanOrEqual(100);

    // wait for turkeys to release (max releaseAt = 4s)
    for (let i = 0; i < 300; i++) {
      G.update(1 / 60);
      if (G.turkeys.every((t) => t.released)) break;
    }
    expect(G.turkeys.every((t) => t.released)).toBe(true);
    expect(G.turkeys.some((t) => t.fright)).toBe(true);

    // teleport a turkey onto the player to test the gobble path
    const t0 = G.turkeys[0];
    t0.x = G.player!.x;
    t0.y = G.player!.y;
    t0.r = G.player!.r;
    t0.c = G.player!.c;
    t0.atCenter = true;
    t0.dir = "right";
    t0.fright = true;
    const scoreBefore = G.score;
    G.update(1 / 60);
    expect(t0.eaten).toBe(true);
    expect(G.score).toBeGreaterThanOrEqual(scoreBefore + 100);

    // eaten turkey flies home and respawns
    for (let i = 0; i < 300; i++) {
      G.update(1 / 60);
      if (!t0.eaten && t0.fright === false) break;
    }
    expect(t0.eaten).toBe(false);
    expect(Math.hypot(t0.x - (7 * 32 + 16), t0.y - (7 * 32 + 16))).toBeLessThan(1);

    // eat everything to force levelup
    for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) if (G.grid[r][c] !== "#") G.grid[r][c] = ".";
    G.pelletsLeft = 1;
    const q = G.player!;
    q.r = 7;
    q.c = 7;
    q.x = 7 * 32 + 16;
    q.y = 7 * 32 + 16;
    q.atCenter = true;
    q.want = "right";
    q.dir = "right";
    G.grid[7][7] = ".";
    for (let i = 0; i < 100 && G.state === "play"; i++) G.update(1 / 60);
    expect(G.state === "levelup" || G.level === 2).toBe(true);
  });
});
