# PERU MAN — handover / resume notes

> Read this first to pick up where work left off. Last updated: 2026-08-20 (post-reboot).
> Keep this file updated as you go so a future session can resume.

## What this is
A modern Pac-Man remake. Theme (user-specified):
- Player / Pac-Man = shape of the **Brazilian flag**.
- All 4 ghosts = **turkeys** (Dario / Rita / Zeca / Tuca), distinct personalities.
- **Power pills = the Canva logo** (brand colors).
- "Fun and colorful", **basic sound effects**.
Named **PERU MAN**.

## Where things are
- Repo clone (git workdir for commits/pushes): `/home/mattma/Qwen3827B-Exploration`
- Game root: `/home/mattma/Qwen3827B-Exploration/pacman/` (static site, no build step)
- Live URL (GitHub Pages, from `main` at repo root):
  **https://mattma1970.github.io/Qwen3827B-Exploration/pacman/**
  (Pages rebuilds ~1–2 min after each push.)

## File layout (pacman/)
- `index.html` — loads JS in fixed order: config → utils → audio → sprites → pacman → ghost → game → main
- `css/style.css`
- `js/config.js` — CELL=32, COLS/ROWS=15, MAZE grid (`#` wall, `.` pellet, `P` power pill, `M` player start, `G` turkey start), DEN (r7,c7), TUNE, TURKEYS[], SCATTER_TARGETS, PHASE_DURATIONS
- `js/utils.js` — DIRS, DIR_NAMES, OPPOSITE, centerOf, isWall, isOpen, clamp, bfsDistances
- `js/audio.js` — AudioFX (Web Audio SFX, created on first user gesture; M to mute)
- `js/sprites.js` — drawPlayer (BR flag), drawTurkey, drawEyes, drawCanvaPill (TODO see below), drawPellet, drawMiniFlag, shadeHex
- `js/pacman.js` — Mover base (grid move; on wall hit sets dir="none" so player stops, does NOT reverse) + Player
- `js/ghost.js` — Turkey extends Mover (AI: scatter/chase BFS + flee when frightened)
- `js/game.js` — Game state machine, collisions, scoring, rendering
- `js/main.js` — bootstrap, DPR scaling, keyboard + pointer input, rAF loop
- `README.md`

Controls: arrows/WASD move, Enter/Space start, P pause, M mute. Mobile: tap left/right half.

## How to run & test (no browser needed)
Headless tests use `node` + `vm` to load the JS in order with a canvas-2D-context Proxy stub
(`makeCtx`). Note: top-level `const`s do NOT attach to the sandbox object — read them *inside*
`vm.runInContext`. Test files live in `pacman/tests/` (survive reboots; use absolute js path):
- pacman/tests/peru-smoke.js   — random-walk sanity (maze reachable, state transitions, no exceptions)
- pacman/tests/peru-scripted.js — pill -> fright -> gobble -> den respawn -> levelup
- pacman/tests/peru-flee.js    — frightened turkey steers away (BFS), fan-out tie-break

Quick loop after any JS edit (run from the repo root /home/mattma/Qwen3827B-Exploration):
```
node --check pacman/js/<file>.js          # syntax
node pacman/tests/peru-smoke.js           # sanity
node pacman/tests/peru-scripted.js        # pill/fright/gobble/levelup
node pacman/tests/peru-flee.js            # flee direction (BFS)
```
(Tests reference the absolute js path, so location is fine; if you move the repo,
update the `dir =` line at the top of each test.)
Then: commit + `git push` (Pages auto-rebuilds).
Push works via `gh auth setup-git` (HTTPS creds not otherwise configured). `gh` is authed with admin/push/pull.

## Done
- Full game built & live (player BR flag, 4 turkey ghosts w/ personalities, Web Audio SFX, 3 lives,
  scatter/chase phases, level speed-ups, score/best, floats, title/ready/dying/levelup/gameover, mobile).
- All JS passes `node --check`; all 3 tests pass.
- Commits: e7c0f1a (initial), 983ccdc (player stops at walls), 864fd47 (frightened turkeys flee player),
  e741898 (headless tests + handover).
  Flee: picks open dir maximizing BFS distance from player; may reverse; ties random + ~4% twitch.
  Verified: flee 22.5x more often than approach, approach only ~4%.

## Done (post-reboot pickup)
**Real Canva logo power pill** — `drawCanvaPill()` in `js/sprites.js` now draws a Canva "C" mark
(open on the right, like the real brush-C) stroked with a linear gradient in the true brand
colors from the official SVG (https://upload.wikimedia.org/wikipedia/en/b/bb/Canva_Logo.svg):
`#6420FF`/`#7D2AE7` (purple, left) → `#00C4CC` (teal "Canva blue", right), on a soft
white→lavender glowing pill disc (`#ffffff`/`#efeaff`/`#d9c9ff`) with a light purple rim.
- Verified by rendering an equivalent SVG to PNG with ImageMagick (`convert ...svg ppm:-`) and
  pixel-probing: left ring = purple, right-of-center = open gap (white disc shows through),
  top/bottom of ring = teal end of gradient. (My model can't view images; use pixel probes.)
- All 3 tests pass; `node --check` clean.

## Idea backlog (optional, not requested)
- Could swap the "C" for the full "Canva" wordmark (embed the fetched SVG as data-URI Image in
  main.js + drawImage) — decided against: wordmark is ~10px tall at pill size, "C" reads better.
- Could add a small "CANVA" text under the pill.

Note on git: don't commit secrets; this file is untracked by design.
