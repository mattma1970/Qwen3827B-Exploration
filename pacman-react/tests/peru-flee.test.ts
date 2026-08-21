// Focused test: a frightened turkey must REROUTE AWAY from the player.
import { describe, expect, it } from "vitest";
import { TURKEYS } from "../src/game/config";
import { Player } from "../src/game/pacman";
import { Turkey } from "../src/game/ghost";
import { COLS, ROWS, type Grid } from "../src/game/config";

describe("frightened turkey flee", () => {
  it("strongly prefers directions AWAY from the player, fanning out over ties", () => {
    // fully open 15x15 field so every direction is available
    const grid: Grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid.push([]);
      for (let c = 0; c < COLS; c++) grid[r].push(" ");
    }
    const g = new Turkey(grid, TURKEYS[0], { r: 0, c: 0 });
    g.r = 7;
    g.c = 5;
    g.fright = true;
    g.released = true;
    g.eaten = false;
    // player sits two cells to the RIGHT, same row
    g._player = new Player(grid, 7, 7, 152);

    const counts = { up: 0, down: 0, left: 0, right: 0 } as Record<string, number>;
    for (let i = 0; i < 400; i++) counts[g.aiDir()]++;

    const towards = counts.right; // only "right" steps TOWARD the player at (7,7)
    const away = counts.up + counts.down + counts.left;
    expect(away / towards).toBeGreaterThan(6);
    expect(towards / 400).toBeLessThan(0.2);
    expect(counts.up + counts.down + counts.left).toBeGreaterThanOrEqual(300);
  });
});
