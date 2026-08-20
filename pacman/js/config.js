// PERU MAN - global config: grid, maze, tuning, turkey roster.
// Maze legend: # wall, . pellet, P power pill (Canva), M player start, G turkey start
const CELL = 32;
const COLS = 15;
const ROWS = 15;

const MAZE = [
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
const DEN = { r: 7, c: 7 };

const TUNE = {
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
const TURKEYS = [
  { name: "Dario", color: "#e63946", start: [1, 3],  release: 0,   style: "direct" },
  { name: "Rita",  color: "#ffb703", start: [7, 5],  release: 1,   style: "ahead" },
  { name: "Zeca",  color: "#ff7ab6", start: [7, 9],  release: 2.5, style: "behind" },
  { name: "Tuca",  color: "#80ed99", start: [9, 7],  release: 4,   style: "shy" },
];

const SCATTER_TARGETS = [
  { r: 0, c: 0 },
  { r: 0, c: COLS - 1 },
  { r: ROWS - 1, c: 0 },
  { r: ROWS - 1, c: COLS - 1 },
];

// phase durations: scatter 7s, chase 20s, then shorter scatters; last phase = chase forever
const PHASE_DURATIONS = [7, 20, 5, 20, 5, 20];
