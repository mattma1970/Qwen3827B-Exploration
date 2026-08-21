# PERU MAN — handover / resume notes

> Read this first to pick up where work left off. Last updated: 2026-08-21 (photo-sprite M2/M3).
> Keep this file updated as you go so a future session can resume.

## What this is
A modern Pac-Man remake. Theme (user-specified):
- Player / Pac-Man = shape of the **Brazilian flag**.
- All 4 ghosts = **turkeys** (Dario / Rita / Zeca / Tuca), distinct personalities.
- **Power pills = the Canva logo** (brand colors).
- "Fun and colorful", **basic sound effects**.
Named **PERU MAN**.

## Where things are
- Repo clone (git workdir for commits/pushes): `/home/mattma/repos/Qwen3827B-Exploration`
- Game root: `/home/mattma/repos/Qwen3827B-Exploration/pacman/` (static site, no build step)
- Live URL (GitHub Pages, from `main` at repo root):
  **https://mattma1970.github.io/Qwen3827B-Exploration/pacman/**
  (Pages rebuilds ~1–2 min after each push.)

## File layout (pacman/)
- `index.html` — loads JS in fixed order: config → utils → audio → sprites → photo → pacman → ghost → game → main
- `css/style.css`
- `js/config.js` — CELL=32, COLS/ROWS=15, MAZE grid (`#` wall, `.` pellet, `P` power pill, `M` player start, `G` turkey start), DEN (r7,c7), TUNE, TURKEYS[], SCATTER_TARGETS, PHASE_DURATIONS
- `js/utils.js` — DIRS, DIR_NAMES, OPPOSITE, centerOf, isWall, isOpen, clamp, bfsDistances
- `js/audio.js` — AudioFX (Web Audio SFX, created on first user gesture; M to mute)
- `js/sprites.js` — Sprites registry + spriteReady/playerSprite, drawPlayer (photo > rafa avatar > BR flag), drawTurkey (photo slot via opts.name), drawEyes, drawCanvaPill (photo > Canva wordmark, "C" fallback), drawPellet, drawMiniFlag, shadeHex
- `js/photo.js` — emoji-fy core (posterize, medianCut) + glue: loadSourceImage, boxBlurRgba, imageToSprite, spriteSlot/spriteFor/setSprite/clearPhoto, assignPhoto, persistSlot/restoreSprites, SpriteData
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
- pacman/tests/peru-photo.js   — pure emoji-fy core (posterize, median-cut)
- pacman/tests/peru-sprite.js  — M2/M3 glue: registry, fallback chain, imageToSprite pipeline (stub canvas), boxBlurRgba, turkey/pill slots, persistence, boot restore, quota guard

Quick loop after any JS edit (run from the repo root /home/mattma/repos/Qwen3827B-Exploration):
```
node --check pacman/js/<file>.js          # syntax
node pacman/tests/peru-smoke.js           # sanity
node pacman/tests/peru-scripted.js        # pill/fright/gobble/levelup
node pacman/tests/peru-flee.js            # flee direction (BFS)
node pacman/tests/peru-buffer.js          # keypress buffering / dead-end reverse
node pacman/tests/peru-photo.js           # emoji-fy pure core
node pacman/tests/peru-sprite.js          # sprite registry/glue/turkey+pill slots
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
   `drawMiniFlag` (life icons) does the same. Title-screen bobber at game.js:375 picks it up
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

## Git workflow (important — see AGENTS.md)
Work on local feature branches; when pushing, create the SAME-NAMED remote branch
(`git push -u origin <branch>`). NEVER push new work to `main` directly (Pages serves
`main`). Landing on main = explicit merge/PR afterward.

## Done (photo-sprite M2/M3: sprite glue + turkey/pill slots)
Commit `d05487b` on `feature/photo-sprite` (pushed). All functions in photo.js are
top-level `function`/`var` (attach to the vm global) and DOM/canvas-touching code is
guarded so headless Node stays safe.
- `js/sprites.js`: `var Sprites = { player:null, pill:null, ghosts:{} }`,
  `spriteReady(img)`, `playerSprite()` (photo > rafa avatar > null → hand-drawn flag).
  `drawPlayer`/`drawMiniFlag` use `playerSprite()` (mouth-wedge clip still applies to
  the photo). `drawTurkey(c,x,y,r,color,opts)`: if `opts.name` has a ready
  `Sprites.ghosts[name]`, drawImage the raw square at (-1.15r, -1.15r, 2.3r, 2.3r);
  frightened = translucent tint circle + squiggle face overlaid, then return.
  `drawCanvaPill` uses `Sprites.pill` over the wordmark.
- `js/photo.js` glue: `loadSourceImage` (File/Blob → createObjectURL, string URL, or
  image-like passthrough), `boxBlurRgba` (separable, edge-clamped; manual fallback when
  `ctx.filter` is unsupported), `imageToSprite(source,{size=256,colors=16,levels=20,blur=4})`
  (cover-crop onto square canvas → blur → posterize → medianCut → putImageData →
  toDataURL → new Image; stores `_spriteUrl`), `spriteSlot(name)` (case-insensitive
  player/pill/turkey match, null if unknown), `spriteFor`, `setSprite`, `clearPhoto`,
  `assignPhoto(slot, source, opts)` (process + assign + persist; rejects unknown slot /
  failed load), `SpriteData` (`var`), `persistSlot` (swallows quota errors → false),
  `restoreSprites()` (rehydrates `Sprites.*` from `localStorage` `peruman.sprite.*`
  at boot; called at the end of photo.js, guarded by typeof Image + localStorage).
- `js/game.js`: `renderTurkeys` passes `name: g.def.name`; title-screen turkey calls
  pass `name: g.name`.
- New suite `tests/peru-sprite.js` (29 checks): stub `Image` (registry of fake sources,
  any `data:` URL loads as 256x256), localstorage stub with optional quota, canvas-ctx
  Proxy that samples the last drawn source, and `makeRecCtx(rec)` recording ctx
  (every method no-op, drawImage recorded, gradients get no-op addColorStop) for draw
  tests. Gotchas baked in: coordinate asserts use `Math.abs(x-expected) < 0.1`
  (`12*1.15` → 13.799999999999999); `String(err)` in vm yields `"Error: <msg>"` so
  assert with `indexOf(msg) > -1`, never `=== 0`.
- Verified: `node --check` clean; all 6 suites green.

## WIP: drop-a-photo-to-sprite feature (branch `feature/photo-sprite`)
**Status snapshot (2026-08-21):** branch `feature/photo-sprite` is clean and in sync with
its same-named remote branch (upstream set). Working tree has only untracked `pacman/img/`
leftovers. All 6 test suites green. **Next up: M4 (UI), then M5 (polish).**
**Feature**: user drops a photo into the game; it is "emoji-fied" in-browser (photo ->
256x256 -> blur -> posterize -> median-cut to 16 flat colors) and becomes a sprite
assignable to Pacman, a turkey, or the power pill. Photos stay local (no upload/server).
**Design decision (user)**: v1 uses the photo AS-IS — NO masking/cropping. Edge-detection
trim is an explicit later version. Pacman's mouth-wedge clip still applies (animation, not
crop). Turkeys: raw square image replaces the whole hand-drawn turkey as one unit.
Pill: image on the glowing disc.

### Plan / milestones
- [x] **M1** committed `b566d13` (pushed to origin/feature/photo-sprite): `js/photo.js`
  pure core — `posterize(rgba, levels)` + `medianCut(rgba,w,h,colors)->{data,palette}`.
  Pure functions over Uint8ClampedArray, no canvas/DOM; declared as top-level `function`s
  so they attach to the vm sandbox global (const/class would NOT). Added to index.html
  after sprites.js. Tests: `tests/peru-photo.js` (11 checks).
- [x] **M2** glue: committed with M3 in `d05487b` (see "Done (photo-sprite M2/M3)"
  above).
- [x] **M3** turkey + pill slots: committed in `d05487b`.
- [ ] **M4** UI: customize panel (key S or button) with 6 drop zones (Pacman, 4 named
  turkeys, pill) + clear buttons; drop-anywhere on canvas (last-used slot); file-input
  fallback for mobile; reset-to-defaults.
- [ ] **M5** polish: previews, error toasts for non-image drops, localStorage quota
  guard (~5MB cap; ~10-15KB per 256px 16-color PNG).

### Notes for the next session
- NEXT = **M4** (UI: customize panel, drop zones, drop-anywhere, file-input fallback,
  reset) then **M5** (previews, error toasts, ~5MB quota cap).
- Load order is fixed: config -> utils -> audio -> sprites -> photo -> pacman -> ghost ->
  game -> main. The test suites load only the files they need (peru-sprite.js:
  config → utils → audio → sprites → photo).
- Headless gotcha re-confirmed: top-level `function`/`var` attach to the vm sandbox;
  `const`/`let`/`class` don't. (New glue code follows this: `var Sprites`, `var SpriteData`.)
- Persistence: localStorage data-URLs keyed `peruman.sprite.<slot>`; `restoreSprites()`
  rehydrates `Sprites.*` at boot (guarded by typeof Image + typeof localStorage).
  `persistSlot` swallows QuotaExceededError (returns false) so assignment still works.
- All 6 suites currently green (smoke, scripted, flee, buffer, photo, sprite).
- Untracked leftovers in `pacman/img/` (rafa.png, rafa_preview.png, framings.png)
  are NOT part of this feature — optional cleanup.

## Idea backlog (optional, not requested)
- Could add a small "CANVA" text under the pill (redundant now that the wordmark is shown).
