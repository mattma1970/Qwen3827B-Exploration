// PERU MAN - global config: grid, maze, tuning, turkey roster.
// Maze legend: # wall, . pellet, P power pill (Canva), M player start, G turkey start

export const CELL = 32;
export const COLS = 15;
export const ROWS = 15;

export const MAZE = [
  "###############",
  "#P...........P#",
  "#.##.#####.##.#",
  "#......#......#",
  "#.............#",
  "#.#.#.#...#.#.#",
  "#.............#",
  "#....G.G.G....#",
  "#.............#",
  "#.#.#.#...#.#.#",
  "#......#......#",
  "#P##.#####.##P#",
  "#......M......#",
  "#.............#",
  "###############",
];

// Where turkeys fly back when eaten (cell)
export const DEN = { r: 7, c: 7 };

export interface Tune {
  playerSpeed: number;
  ghostSpeed: number;
  frightSpeed: number;
  eatenSpeed: number;
  frightTime: number;
  levelSpeedStep: number;
  maxLevelBoost: number;
  ghostRadius: number;
  playerRadius: number;
}

export const TUNE: Tune = {
  playerSpeed: 175,
  ghostSpeed: 152,
  frightSpeed: 104,
  eatenSpeed: 340,
  frightTime: 6,
  levelSpeedStep: 0.05,
  maxLevelBoost: 0.4,
  ghostRadius: 12,
  playerRadius: 14,
};

// 4 turkeys: direct stalker, one that aims ahead, one from behind, one shy
export interface TurkeyDef {
  name: string;
  color: string;
  start: [number, number];
  release: number;
  style: "direct" | "ahead" | "behind" | "shy";
}

export const TURKEYS: TurkeyDef[] = [
  { name: "Dario", color: "#e63946", start: [1, 3], release: 0, style: "direct" },
  { name: "Rita", color: "#ffb703", start: [7, 5], release: 1, style: "ahead" },
  { name: "Zeca", color: "#ff7ab6", start: [7, 9], release: 2.5, style: "behind" },
  { name: "Tuca", color: "#80ed99", start: [9, 7], release: 4, style: "shy" },
];

export const SCATTER_TARGETS = [
  { r: 0, c: 0 },
  { r: 0, c: COLS - 1 },
  { r: ROWS - 1, c: 0 },
  { r: ROWS - 1, c: COLS - 1 },
];

// phase durations: scatter 7s, chase 20s, then shorter scatters; last phase = chase forever
export const PHASE_DURATIONS = [7, 20, 5, 20, 5, 20];
