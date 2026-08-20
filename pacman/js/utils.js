// PERU MAN - tiny shared helpers: directions, grid queries, BFS distance field.

const DIRS = {
  none:  { dr: 0,  dc: 0 },
  up:    { dr: -1, dc: 0 },
  down:  { dr: 1,  dc: 0 },
  left:  { dr: 0,  dc: -1 },
  right: { dr: 0,  dc: 1 },
};
const DIR_NAMES = ["up", "down", "left", "right"];
const OPPOSITE = { up: "down", down: "up", left: "right", right: "left", none: "none" };

function centerOf(r, c) {
  return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
}

function isWall(grid, r, c) {
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return true;
  return grid[r][c] === "#";
}

function isOpen(grid, r, c) {
  return !isWall(grid, r, c);
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// BFS distance field from (tr, tc). dist[r][c] = steps away, -1 unreachable.
function bfsDistances(grid, tr, tc) {
  const dist = Array.from({ length: ROWS }, () => new Array(COLS).fill(-1));
  if (isWall(grid, tr, tc)) return dist;
  const q = [[tr, tc]];
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
