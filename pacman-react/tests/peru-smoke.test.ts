// Headless verification: maze integrity + smoke-run the full game loop.
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAZE, COLS, ROWS } from "../src/game/config";
import { Game } from "../src/game/game";
import { noopCtx } from "./helpers";

const dirs = ["up", "down", "left", "right"] as const;

// Small deterministic PRNG (mulberry32). The smoke run below stubs
// Math.random with it, so the whole game loop (ghost AI included) is
// reproducible run-to-run instead of wobbling with the unseeded random.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let randSpy: ReturnType<typeof vi.spyOn> | null = null;
afterEach(() => {
  randSpy?.mockRestore();
  randSpy = null;
});

describe("maze", () => {
  it("has 15 rows, all width 15", () => {
    expect(MAZE.length).toBe(15);
    const badLen = MAZE.map((row, i) => (row.length !== COLS ? i + ":" + row.length : null)).filter(Boolean);
    expect(badLen).toEqual([]);
  });

  it("has all open cells reachable from the player start, with a decent pellet count", () => {
    const sr = MAZE.findIndex((r) => r.includes("M"));
    const sc = MAZE[sr].indexOf("M");
    const seen = Array.from({ length: ROWS }, () => new Array<boolean>(COLS).fill(false));
    const q: Array<[number, number]> = [[sr, sc]];
    seen[sr][sc] = true;
    let head = 0;
    while (head < q.length) {
      const [r, c] = q[head++];
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
        if (seen[nr][nc] || MAZE[nr][nc] === "#") continue;
        seen[nr][nc] = true;
        q.push([nr, nc]);
      }
    }
    let openCells = 0;
    const unreachable: string[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (MAZE[r][c] !== "#") {
          openCells++;
          if (!seen[r][c]) unreachable.push(r + "," + c);
        }
      }
    expect(unreachable).toEqual([]);
    expect(openCells).toBeGreaterThan(130);
  });
});

describe("smoke (5000 frames, random play)", () => {
  it("scores points, exercises the death path, and never throws", () => {
    randSpy = vi.spyOn(Math, "random").mockImplementation(mulberry32(1));
    const game = new Game(noopCtx(), 15 * 32);
    let deaths = 0, levelups = 0, maxScore = 0;
    const states: Record<string, number> = {};
    game.newGame();
    for (let i = 0; i < 5000; i++) {
      if (Math.random() < 0.6) game.setWant(dirs[(Math.random() * 4) | 0]);
      const prev = game.state;
      game.update(1 / 60);
      game.render();
      if (game.state !== prev) states[game.state] = (states[game.state] || 0) + 1;
      if (game.state === "dying") deaths++;
      if (game.state === "levelup") levelups++;
      maxScore = Math.max(maxScore, game.score);
    }
    expect(maxScore).toBeGreaterThan(30);
    expect(deaths).toBeGreaterThan(0);
    expect(game.score).toBeGreaterThanOrEqual(0);
  });
});
