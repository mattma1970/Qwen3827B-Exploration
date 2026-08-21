// PERU MAN - tiny shared helpers: directions, grid queries, BFS distance field.

import { CELL, COLS, ROWS } from "./config";

export type Dir = "none" | "up" | "down" | "left" | "right";
export type Grid = string[][];

export interface Vec {
  dr: number;
  dc: number;
}

export const DIRS: Record<Dir, Vec> = {
  none: { dr: 0, dc: 0 },
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

export const DIR_NAMES: Dir[] = ["up", "down", "left", "right"];

export const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
  none: "none",
};

export function centerOf(r: number, c: number): { x: number; y: number } {
  return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
}

export function isWall(grid: Grid, r: number, c: number): boolean {
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return true;
  return grid[r][c] === "#";
}

export function isOpen(grid: Grid, r: number, c: number): boolean {
  return !isWall(grid, r, c);
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

// BFS distance field from (tr, tc). dist[r][c] = steps away, -1 unreachable.
export function bfsDistances(grid: Grid, tr: number, tc: number): number[][] {
  const dist: number[][] = Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(-1));
  if (isWall(grid, tr, tc)) return dist;
  const q: Array<[number, number]> = [[tr, tc]];
  dist[tr][tc] = 0;
  let head = 0;
  while (head < q.length) {
    const [r, c] = q[head++];
    for (const d of DIR_NAMES) {
      const nr = r + DIRS[d].dr;
      const nc = c + DIRS[d].dc;
      if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
      if (grid[nr][nc] === "#") continue;
      if (dist[nr][nc] !== -1) continue;
      dist[nr][nc] = dist[r][c] + 1;
      q.push([nr, nc]);
    }
  }
  return dist;
}
