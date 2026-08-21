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
- `js/sprites.js` — drawPlayer (BR flag), drawTurkey, drawEyes, drawCanvaPill (official Canva wordmark, "C" fallback), drawPellet, drawMiniFlag, shadeHex
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
- pacman/tests/peru-buffer.js  — keypress buffering: early turns survive blocked cells; opposite key reverses at dead ends

Quick loop after any JS edit (run from the repo root /home/mattma/Qwen3827B-Exploration):
```
node --check pacman/js/<file>.js          # syntax
node pacman/tests/peru-smoke.js           # sanity
node pacman/tests/peru-scripted.js        # pill/fright/gobble/levelup
node pacman/tests/peru-flee.js            # flee direction (BFS)
node pacman/tests/peru-buffer.js          # keypress buffering / dead-end reverse
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
  e741898 (headless tests + handover), 66063da (real Canva logo power pill), 754eeb9 (full Canva wordmark pill).
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

## Done (post-reboot: full Canva wordmark pill)
User asked for the full Canva wordmark (instead of just the "C"). `sprites.js` now embeds the
official wordmark SVG (fetched from Wikipedia, verified against the source) as
`CANVA_WORDMARK_SVG`, builds a data-URI `Image` at load (guarded by `typeof Image` so headless
Node tests stay safe — falls back to the hand-drawn gradient "C" until/ unless the image loads),
and `drawCanvaPill` drawImage's it scaled to fit the glowing disc (w = 1.95r, aspect 80:30).
Verified: data-URI round-trips byte-for-byte to the embedded SVG; brand colors present
(#6420FF/#7D2AE7/#00C4CC); all 3 tests pass; syntax clean.
If the wordmark ever needs re-fetching:
`curl -sL https://upload.wikimedia.org/wikipedia/en/b/bb/Canva_Logo.svg` (strip width/height attrs, keep viewBox).

## Done (post-reboot: arrow keys intermittently not registering)
User reported arrow keys "intermittantly not working" (suspected key buffering). Root cause:
`Mover.decide()` (js/pacman.js) discarded the buffered `want` direction whenever it could not be
applied at the moment it was checked — so pressing a turn key even ~1 cell early (or pressing the
OPPOSITE direction, e.g. reversing at a dead end) silently ate the keypress. Fix (classic
Pac-Man buffering): only consume `want` when it's applied or is a same-direction no-op; otherwise
keep it until a cell lets it through (new keypresses just overwrite). Also restores dead-end
reverse (buffered opposite key is honored once a wall stop makes dir="none"). Turkeys are unaffected
(they override decide()). Regression test: pacman/tests/peru-buffer.js — fails 2/3 checks on the
old code, passes on the fix; all 4 test suites pass.

## Done (player = emoji-ified Rafa avatar)
Web search confirmed there is NO off-the-shelf "emoji-fy an image" npm/PyPI package (only
AI SaaS tools — makeemoji/openart/pixelbin — needing accounts/keys, and Replicate models).
Chosen path: one-off local ImageMagick pipeline (IM 6.9, no OpenCV so no face-detect;
source is a 400×400 headshot so center-crop is fine).
- Source: `/home/mattma/documents/rafa.jpg` (NOT in repo).
- Pipeline: `convert rafa.jpg -resize 256x256 -blur 0x4 -posterize 20 -colors 16 -alpha set
  \( -size 256x256 xc:none -fill white -draw "circle 128,128 128,0" \) -compose DstIn -composite
  -strip pacman/img/rafa_emoji.png`
  IM6 gotcha: WITHOUT `-alpha set` on the palette (indexed) base, DstIn/CopyOpacity silently
  produce a fully opaque result (verified via -alpha extract).
- `js/sprites.js`: `rafaEmojiImg` loads `img/rafa_emoji.png` (guarded by `typeof Image`.
  headless-safe). `drawPlayer` clips the mouth wedge then drawImage's the avatar inside it
  (BR flag hand-drawn fallback until loaded — same pattern as the Canva wordmark).
  `drawMiniFlag` (life icons) does the same. Title-screen bobber at game.js:374 picks it up
  for free (calls drawPlayer).
- Verified: all 4 test suites pass (paths updated to /home/mattma/repos/... after the repo
  moved), plus a vm check that the image branch drawImage's at (-r,-r,2r,2r) for the player
  and (x-r,y-r,2r,2r) for life icons.
- `pacman/img/` was untracked; contains leftover `rafa.png`, `rafa_preview.png`, `framings.png`
  from earlier attempts — candidate for cleanup.

## Done (immediate turn-around / reverse)
User: turning around required a wall stop. Was intentional old design
(peru-buffer test section 2). Fix in `Mover.update()` (js/pacman.js): if
`want === OPPOSITE[this.dir]` while moving, flip `dir` instantly mid-cell
(grid-safe, retraces the same line) — before the wait/decide logic.
Perpendicular buffering unchanged (honored at first open cell). Turkeys are
unaffected (they never set `want`; they override decide()).
peru-buffer.js section 2 rewritten: reversed at once + backed away from the
dead end (never hits its wall). All 4 suites pass.

## Idea backlog (optional, not requested)
- Could add a small "CANVA" text under the pill (redundant now that the wordmark is shown).
