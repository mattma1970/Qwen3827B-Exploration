# PERU MAN — handover / resume notes

> Read this first to pick up where work left off. Last updated: 2026-08-22 (**photo
> silhueta + sticker outline + player rider + character-design wizard + busy/download-
> progress feedback + mobile UX layout (top-banner pause, board-up, swipe pad, title
> splash) all done on `feature/photo-outline` (pushed, PR #6 open), awaiting a PR
> review/merge on explicit user instruction**; swipe merged to main via PR #5 `7c1c065`; camera capture via PR #4
> `97fa5b1`; AGENTS.md allows `gh pr merge` ONLY on explicit user instruction, gated on a
> full passing test run). Keep this file updated as you go so a future session can resume.

## Mobile UX layout: top banner (pause), board-up, swipe pad, title splash (pacman-react/) — DONE, on branch `feature/photo-outline` (PR #6), NOT merged
Goal (user): swiping works but the pause button + board are "in the way". Shift the board
up, move the start/pause button into the top corner banner (hamburger stays left), add a
bordered "swipe pad" under the board (laptop-trackpad look), and move the controls text
into a retro splash box over the board that disappears when the match starts or the user
personalizes. React-only, mobile-only (≤720px); desktop keeps the logo + in-flow hint.
- **`src/components/TopBar.tsx`** (NEW, mobile only): fixed top banner. Left = hamburger
  (opens the personalize panel, same toggle as the C hotkey). Right = play/pause (▶ at
  title/gameover, ❚❚ when playing/paused) — moved here off the board; polls the paused flag
  on a 300 ms tick (no engine event bus). Brand "PERU MAN react" centered.
- **`src/components/GameBoard.tsx`**: new `overlay?: ReactNode` prop rendered inside
  `.canvas-wrap` (now `position: relative`) — hosts the mobile splash over the canvas.
- **`App.tsx`**: mobile renders `<TopBar>` + board + an in-flow bordered `.swipe-pad` under
  the board; desktop keeps the logo + `.hint`. Removed the fixed top-left hamburger + the
  bottom pause pill (`src/components/TouchControls.tsx` **DELETED**). New `atTitle` poll
  (200 ms) shows a retro `.splash` box over the board on the title screen; it hides the
  moment the match starts (state leaves "title") or the personalize panel opens
  (`pointer-events:none` on the splash so a tap on the board passes through to start).
- **`src/style.css`**: removed `.menu-btn`/`.hint .menu`/`.touch-controls`/`.pause-btn`;
  added `.topbar`/`.topbar-btn`/`.topbar-brand`/`.topbar-badge`, `.splash`/`.splash-box`/
  `.splash-title`/`.splash-lines`/`.splash-start` + `@keyframes splashblink`, `.swipe-pad`/
  `.swipe-pad-hint`. Mobile media queries: `body { align-items: flex-start }` (so a tall
  board is never clipped by flex centering) + `.wrap` top padding to clear the fixed
  banner; removed the old bottom 96px pad (no more fixed bottom button).
**Follow-up (same branch): rename to BRAZIL MAN** — top banner brand "PERU MAN react" →
"BRAZIL MAN", in-game canvas title (game.ts `fillText`), desktop logo, and `index.html`
tab title all renamed; the "react" version badge removed (its `.ver-badge`/`.topbar-badge`
CSS deleted too). localStorage prefixes `peruman.sprite.*` / `peruman.char.*` deliberately
UNCHANGED (persisted user data). Mobile `.wrap` `padding-top` bumped 58px → 74px to give a
small gap above the board under the banner.
**Verify: 89 tests / 10 files green; `npm run build` clean (tsc + vite). No suite covers
the app shell (banner/layout/splash) or the canvas title render — verified by `tsc` +
`vite build` only.**
Outstanding: (1) real-phone verification of the new layout (banner, board-up, pad,
splash-over-board, tap-to-start passthrough); (2) per AGENTS.md **do NOT merge PR #6**
without an explicit user instruction + a fresh full-green `npm test` (React-only, vanilla
untouched).

## Busy / download-progress feedback (pacman-react/) — DONE, on branch `feature/photo-outline` (PR #6), NOT merged
Goal (user): "when the library is being downloaded and when the processing is happening
on the phone there is no indication that something is in process of happening. it looks
like things have crashed." Two stalls needed visible feedback: (a) the **first-time
cutout-model download** (~40 MB from the IMG.LY CDN, browser-cached after) and (b) the
**per-photo cutout + emoji-ify** in the wizard.
- **`src/game/silhouette.ts`**: `preloadCutout` signature changed from
  `preloadCutout(model?: ModelName)` to `preloadCutout(opts?: PreloadOpts)` where
  `PreloadOpts = { model?: ModelName; progress?: ProgressFn }`; the progress fn is
  forwarded into imgly's `preload` cfg (imgly's `progress(key, cur, total)` covers
  download + inference, so % is meaningful). Behavior otherwise identical (swallows
  errors, resolves void). `test/peru-outline.test.ts` updated to the object form + new
  case asserting default model + progress forwarding (now 12 tests in that file, 89 total).
- **`CustomizePanel.tsx`**: new `warm` state `{pct:number|null}|null`; on panel open it
  fires `setWarm({pct:null})` + `preloadCutout({ progress: (_k,cur,total) =>
  total>0 && setWarm({pct: round(cur/total*100)}) }).then(() => setWarm(null))`. New
  `.cp-warm` status row under `.cp-sub` (spinner + "preparando o recorte de silhueta…" /
  "baixando o recorte de silhueta… N%"). Also `handleWizardApply` toasts
  "aplicando foto…" before `assignPhoto` to bridge the emoji-ify pause after leaving
  the wizard.
- **`CharacterWizard.tsx`**: `process()` now sets `busy` at EVERY phase — "processando
  a foto…" (no-silhueta path, cached-cutout path, and the emoji-ify after a fresh
  cutout), "recortando silhueta…" (+ "…N%" from the imgly progress callback) for the
  first real cutout, and the existing "sem silhueta (sem rede?) — usando a foto inteira"
  fallback (auto-cleared ~1500 ms). Preview canvas wrapped in `.wiz-prevwrap` with a
  `.wiz-busy` overlay (spinner + label) on top of the canvas while `busy` is set; the
  old `.wiz-status` text line was removed (was double-render). "aplicar" stays
  `disabled={failed || !img || !!busy}` so the existing gating is unchanged.
- **`src/style.css`**: removed dead `.wiz-status`; added `.wiz-prevwrap` (relative,
  centered), `.wiz-busy` (absolute inset overlay: dark blur backdrop, orange text,
  column center), `.spin` + `@keyframes spin` (26px orange-border spinner), `.cp-warm`
  (inline status chip) + `.cp-warm .spin` (14px variant).
**Verify: 89 tests / 10 files green; `npm run build` clean (tsc + vite) — main JS 196 kB
(65 kB gzip) + 9.2 kB css, ONNX chunks + ~24 MB wasm lazy.**
Outstanding: (1) real phone verification of BOTH the panel warm-download % and the
wizard overlay (a real slow download is where it matters); (2) per AGENTS.md **do NOT
merge PR #6** without an explicit user instruction + a fresh full-green `npm test`
(this feature is React-only, vanilla untouched).

## Character-design wizard (pacman-react/) — DONE, on branch `feature/photo-outline` (PR #6), NOT merged
Goal (user): a bare cutout photo "loses the characteristic shape"; the user should CHOOSE
how their photo is presented — a **2-step wizard** (2-step chosen as the "extensible"
option): step 1 **foto** (camera or gallery), step 2 **personagem** (design the
character). Options per slot: **remove-background/silhueta** (default on), **base
character** library (classic Pac-Man, the 4 classic ghosts' ghost shape, "só recorte"
= no base), **base color** (curated arcade-palette swatches, not a free picker). Applies
to **ALL 6 slots** (player, 4 turkeys, pill). Branch = `feature/photo-outline` (off
`origin/main` @ `12e8939`; already held silhouette `72272b7` + rider `051d893`); this
work is one more commit on the same branch/PR #6.
- **`src/game/character.ts`** (NEW, pure, DOM-free): `CharDesign {base, color, silhueta}`;
  `CHARS` (pacman/ghost/none — the extensible library: add an entry + a draw branch in
  `drawCharacterBase` + defaults),   `CHAR_COLORS` (10 hexes: classic arcade palette
  #ffdf00/#ff0000/#ffb8ff/#00ffff/#ffb852 + white/black + canva #6420ff/#00c4cc + #e63946),
  `OUTLINE_RADIUS=10`, `CHAR_OFFSET_MAX=0.5`, `isCharId`, `defaultDesign(slot)`
  (player→pacman #ffdf00, pill→pacman #6420ff, each turkey→ghost in its own TURKEYS
  color, unknown→none; all silhueta:true, dx/dy=0), `sanitizeDesign(d, slot)`
  (per-field fallback to the slot defaults; HEX_RE 3–8 digit; dx/dy non-finite/
  out-of-range → 0 / clamped to ±0.5; old records without dx/dy load centered),
  `CharDesigns` in-memory map, `designFor/setDesign/clearDesign` (localStorage
  `peruman.char.<slot>`, swallow-all errors, false when no storage),
  `restoreCharDesigns()` at boot. `dx/dy` = photo center offset from the base
  center, in base-radius units (added later for the press-and-drag reposition;
  applied in all three rider draw sites + wizard preview).
- **`src/game/sprites.ts`**: NEW `BaseOpts {facing?, mouth?, fright?, flick?}`,
  `export characterBasePath(c, base, r, opts): boolean` (the base's outline as a path —
  pacman wedge rotated to facing; path coords freeze at build time, so the internal
  save/rotate/.../restore is safe; false for "none"/unknown) and
  `export drawCharacterBase(c, base, color, r, opts)` = fill that path in `color`
  (fright→scared blue #5b7fff / flick white + squiggle face) + ghost eyes toward
  facing; "none"/unknown → nothing. **Rider photos are CLIPPED to the base outline
  (user ask: "crop when it extends outside the character")**: `drawPlayer` photo path =
  `designFor("player")` base (rotated/mouth-animated), then clip to `characterBasePath`
  + photo UPRIGHT at `PLAYER_RIDER_SCALE=0.88` (no rotation); "none" base → no clip.
  `drawTurkey` photo path: the hand-drawn x-flip is hand-drawn-art-only now — the base
  is drawn UPRIGHT at the bobbed spot (translate(x, y+bob); it already faces via
  `facing`, which also fixes the left-facing pupils/mouth mirroring), then clip +
  upright bobbing photo at 0.88 (replaces the old 1.15r full-square draw; test coords
  are now local-frame, ±s around the translated origin). `drawCanvaPill` photo path =
  `designFor("pill")` base on the glowing disc (mouth wiggling on the pulse clock),
  clip + photo at 0.88 of rb. Wizard 256px preview clips too (same look as the board).
  All three rider sites draw the photo at `(d.dx*r - s, d.dy*r - s)` (pill uses `rb`) —
  the user's chosen position, scale-free (radius units). `frightFaceGhost` helper
  (squiggle eyes + wave mouth). `drawMiniFlag` unchanged (plain circular photo, no
  base — the tiny 16px life icon would just get muddy).
- **`src/components/CharacterWizard.tsx`** (NEW): props `{slot, slotLabel, photo,
  initial, onApply, onCancel}`; `photo!=null` → straight to step 2. Step 1 wraps
  `CameraCapture` (new optional `onGallery` prop: "cancelar" becomes "voltar" + a
  "galeria" button) and a hidden file input. Step 2: 256px live preview canvas (base +
  upright, clipped, offset rider), "recorte de silhueta" checkbox, 3 base thumbs (56px
  canvas via `drawCharacterBase`), 10 color swatches, "refazer foto / cancelar /
  aplicar". **Press-and-drag on the preview repositions the photo** (user ask):
  pointer events with `setPointerCapture`; `dragRef` holds the gesture start (client
  xy + offset at that moment) so a move = start + full delta (no drift); client→canvas
  px→base-unit scale `PREV_SIZE/rect/PREV_R` so the feel is identical at any CSS size;
  clamped to ±`CHAR_OFFSET_MAX` (0.5 r); `touch-action:none` + cursor grab/grabbing so
  phones don't scroll the card mid-drag; the hint line under the preview swaps to a
  "recentrar foto" button when dx/dy ≠ 0. Offset applies live to the preview and
  persists with the design.
  Pipeline `process(src, silhueta)`: `cutout(src)` (cached in `cutoutRef` so flipping
  the toggle back on re-cuts nothing; progress toasts) with fallback to the whole photo,
  then `imageToSprite(s, {outline: silhueta?OUTLINE_RADIUS:0})`; job-guarded
  (`jobRef`). `apply()` hands the processed source + design to the panel.
- **`src/components/CustomizePanel.tsx`**: the old `cutoutOn` toggle + `cameraSlot`
  `CameraCapture` + `applyPhoto` cutout pipeline are GONE (cutout now lives in the
  wizard). New state `wiz: {slot, photo: SourceImage|null} | null`: per-slot "foto"
  button → `openWizard(slot, null)` (camera first); file pick/drop (zone or
  canvas-anywhere → lastUsed) → `openWizard(slot, file)` (straight to design).
  `handleWizardApply(slot, src, design)`: `setWiz(null)` →
  `assignPhoto(slot, src, design.silhueta?{outline:OUTLINE_RADIUS}:{})` →
  `setLastUsed` + `setDesign(slot, design)` + bump + toast. Escape on the panel is
  suppressed while `wiz` is open. `preloadCutout()` still fires on panel open.
- **`src/game/photo.ts`**: `clearPhoto` also calls `clearDesign(slot)` (clearing a slot's
  photo resets its character design to defaults too).
- **`src/App.tsx`**: boot `useEffect` calls `restoreCharDesigns()` right after
  `restoreSprites()`.
- **`src/style.css`**: `.wiz-*` overlay/card/preview/status/opt/base-row/colors/swatches/
  actions/apply-button (z 70, same palette as the panel).
- **Tests**: NEW `tests/peru-character.test.ts` (11 cases: library integrity +
  OUTLINE_RADIUS; defaultDesign per slot incl. case-insensitivity + bogus slot;
  isCharId; sanitizeDesign null/per-field-fallback/3-digit-hex; setDesign save+readback;
  sanitize-on-save + clearDesign; restoreCharDesigns valid/corrupt/invalid/bogus;
  no-storage in-memory). IN `peru-sprite.test.ts`: NEW 6-case `drawCharacterBase`
  suite (pacman wedge order + color + no eyes; pacman fright blue/white-flick; ghost
  body+eyes order; ghost fright no eyes; none/unknown draws nothing;
  characterBasePath path-only for pacman/ghost + false for none) + the player rider,
  turkey photo and pill tests assert the clip ordering (fill → clip → drawImage) +
  the turkey test the 0.88r rider local-frame coords + default-ghost-base-color
  assertion (Zeca color from TURKEYS) + a new rider-offset test (setDesign dx/dy
  shifts the drawImage frame by dx*r/dy*r for player AND turkey). `peru-character`
  gained the offset cases: defaults centered; per-field valid offsets survive;
  clamp ±0.5 / non-finite→0; setDesign sanitizes on save; old records without
  dx/dy restore centered. **SMOKE FLAKE FIXED (latent merge-gate risk)**:
  `peru-smoke.test.ts` randomized on the unseeded `Math.random` (failed once this
  session with maxScore=30, needs >30); now stubs it with a mulberry32(1) PRNG for the
  whole run (ghost AI included) → deterministic; measured seeds 1–8: maxScore 40–70,
  deaths 11–12 (seed 1: 50/12).
**Verify (after the photo-position change): 88 tests / 10 files green; `npm run build`
clean (tsc + vite) — main JS 195 kB (65 kB gzip) + 8.5 kB css, ONNX chunks + ~24 MB
wasm lazy.**
Outstanding: (1) real phone/browser verification of the wizard flow (camera step, design
step preview, cutout progress on a real device; CDN ~40 MB model + wasm on first use);
(2) per AGENTS.md **do NOT merge PR #6** without an explicit user instruction + a fresh
full-green `npm test` (and the vanilla `node pacman/tests/peru-*.js` gate if touching
vanilla — this feature is React-only, vanilla untouched).

## Photo silhouette cutout + sticker outline (pacman-react/) — DONE, on branch `feature/photo-outline`, NOT merged
Goal (user): photo sprites "lose detail" at the ~28 px board size — the object's shape
(silhouette/outline) should survive instead of a flat square, plus "fun emoji" filters.
Chosen engine: **`@imgly/background-removal`** (in-browser ONNX/WASM, AGPL-3.0, model
pulled once from the IMG.LY CDN `staticimgly.com/.../@imgly/background-removal-data/1.7.0/`
on first use, then browser-cached). Branch was off `origin/main` @ `12e8939`.
- **`src/game/silhouette.ts`** (new, lazy): `cutout(source, {model?, progress?})` →
  transparent PNG `Blob` or **`null` on ANY failure** (no `window`, module import, model
  download, inference throw, empty blob) so callers fall back to the plain square;
  `preloadCutout()` warms the model (panel calls it on open, fire-and-forget).
  Dynamic `import("@imgly/background-removal")` only at call time → no ONNX/WASM in the
  initial bundle, node/vitest-safe. Default model `isnet_quint8` (smallest, phone CPU).
  `package.json` adds `@imgly/background-removal@^1.7.0` + `onnxruntime-web@^1.21.0`
  (the dev build in imgly's docs ERESOLVE-conflicts with its pinned peer dep; stable works).
- **`src/game/sticker.ts`** (new, pure): `maskFromAlpha(rgba,w,h,threshold=128)`,
  `dilate(mask,w,h,r)` (separable max-box, edge-clamped), `stickerOutline(rgba,w,h,
  {radius=6, color=white, threshold=128})` — a flat opaque ring of `color` on pixels that
  are background but within Chebyshev `radius` of the silhouette; object pixels and soft
  alpha edges pass through untouched. No-op when the sprite is fully opaque (mask = whole
  square → empty ring).
- **`src/game/photo.ts`**: `ToSpriteOpts.outline?: number | boolean` (px radius, `true`
  = 6, absent/false = off). `imageToSprite` runs `stickerOutline` after posterize +
  medianCut and before `putImageData` (alpha-safe; a cutout PNG with transparent
  background drops in with no other format change).
- **`CustomizePanel.tsx`**: new "recorte de silhueta + contorno de sticker" checkbox
  (`cutoutOn`, **default ON**, `.cp-opt` css in style.css). Assign flow `applyPhoto(slot,
  source)`: cutout ON → toast "recortando silhueta… (%)" → `cutout(source, {progress})` →
  success: `assignPhoto(slot, blob, {outline: 10})`; failure: toast "sem silhueta — usando
  a foto inteira" + `assignPhoto(slot, source, {})`. OUTLINE_RADIUS=10 (thicker so the
  ring survives the 256→28 px shrink). Camera capture goes through the same path.
  `preloadCutout()` fires when the panel opens so the model download overlaps photo choice.
- **Player "rider" look** (user follow-up: cutout alone "doesn't keep the
  characteristic shape"; better = photo rides the classic Pac-Man): `drawPlayer`
  (sprites.ts) now, when a photo is present, first draws the **classic yellow
  Pac-Man body** (`PAC_YELLOW` `#ffdf00`, mouth wedge animated by the existing
  `mouth` param, rotated to `facing`) and then draws the photo **on top,
  always upright (no rotation)**, at `PLAYER_RIDER_SCALE = 0.88` of the radius
  so a yellow rim + mouth stay visible around the cutout. A transparent
  cutout shows the yellow around the face ("face piloting the Pac-Man"); an
  opaque/no-cutout photo just covers the body (the old look). rafa fallback
  (circle-masked) also rides. `drawMiniFlag` unchanged (plain circular photo).
- **Tests**: new `tests/peru-outline.test.ts` — 11 cases (threshold at 127/128; dot →
  3×3 grown set exactly; separable vs brute-force box max on a seeded random mask;
  corner L; full-opaque no-op; exact ring geometry incl. the r-boundary; custom ring
  color + in-mask soft alpha preserved; silhouette-with-mocked-imgly: Blob passthrough +
  cfg `{model: isnet_quint8, output png, progress}`, empty-source short-circuit,
  throw/empty → null, preload forwarding + error swallow). +2 cases in
  `peru-sprite.test.ts`: (a) rider — `makeRecCtx` now records call order when a
  `calls` array is passed; asserts yellow base (rotate → arc → `fillStyle:#ffdf00` →
  fill) precedes the photo `drawImage` in unrotated coords `(x±0.88r)`; (b)
  transparent-bg 8×8 source through `imageToSprite({outline:2})` at 256 → ring cols
  62–63 / 192–193 white opaque, object red intact, outside transparent; same source
  without `outline` stays a hole. Existing fallback-chain coords updated to the
  0.88-scale upright frame.
**Verify: 67 tests / 9 files green; `npm run build` clean — initial JS 187 kB (62 kB
gzip), ONNX chunks + ~24 MB wasm are lazy (fetched only when silhueta is first used).**
Outstanding: (1) real phone/browser verification — first cutout downloads the model
(~40 MB) + wasm from the CDN; inference time on mid-range phones; (2) CDN blocked →
silent fallback square + toast (covered by tests). **NOT merged** — per AGENTS.md, only
merge when the user explicitly says so, and only after a fresh full-green `npm test`.

## Swipe steering (pacman-react/) — DONE, MERGED to main (PR #5, merge `7c1c065`)
Goal (user): the on-screen DPad "doesn't work well" on the phone — replace it with
**swipe gestures**: touch the screen and move the finger; each new direction of travel turns
Pac-Man that way; a stationary finger changes nothing; the DPad arrows come off the screen.
Implemented on `feature/swipe-controls` (fresh branch off `origin/main` @ `97fa5b1`, the PR #4
merge):
- **`src/game/swipe.ts`** (new, pure): `SwipeTracker` — `start(x,y)`, `move(x,y)` → `Dir|null`,
  `end()`, `fired` flag, `SWIPE_THRESHOLD=20` css px. Each fire RE-ANCHORS to the current
  position, so the finger must travel another 20 px before the next turn registers (jitter
  filter, no repeat storms); dominant axis wins, `|dx|==|dy|` → horizontal; screen y grows down.
  Nothing runs at import time (node/vitest safe).
- **`GameBoard.tsx`**: the old canvas-only ONE-SHOT pointer handlers (lift the finger to steer
  again; tap = half-screen left/right) are GONE. New native document-level touch gesture:
  `trackId` on first non-interactive `touchstart`; `touchmove` (registered `passive:false`) →
  `tracker.move()` → `game.setWant(dir)` (skipped while `game.paused`); `preventDefault()`
  during an active steer stops page scroll; `touchend` with no fired direction = TAP →
  `primaryAction()` (no-op except title / gameover>1 → start & replay). Multi-touch: only the
  first touch id is tracked. Interactive starts are excluded via
  `INTERACTIVE_SEL = 'button, a, input, select, textarea, [role="button"], .customize-panel,
  .cam-overlay'` so the hamburger, pause pill, hint ☰ span, panel and camera overlay keep their
  own touches. `AudioFX.ensure()` on gesture start + first steer (iOS audio unlock).
  Note: mouse-click steering on desktop (old pointer handlers) is intentionally dropped —
  desktop has the keyboard.
- **`TouchControls.tsx`**: DPad removed; only the ▶/❚❚ start-pause pill remains (same title/
  gameover→`primaryAction()` else `togglePause()` logic; 500 ms label refresh kept; still gated
  on coarse-pointer/touch).
- **`style.css`**: `.dpad`/`.dpad-row`/`.dbtn` → `.pause-btn` (64x52 pill); ≤520 px `.wrap`
  padding-bottom 180 → 96 px (smaller fixed control).
- **Copy**: App.tsx hints → "deslize o dedo na tela para mover · parado não vira" (mobile) and
  "no celular: deslize o dedo na tela para mover" (desktop); game.ts title → "ENTER, toque ou
  uma seta para jogar", gameover → "Enter / toque na tela para jogar de novo".
- **`tests/peru-swipe.test.ts`**: 13 cases (pre-start/post-end null; isActive; sub-threshold
  wiggle → tap; 4 axes; exact threshold boundary; dominant axis; diagonal tie → horizontal;
  re-anchor + re-fire; 4-direction no-lift gesture; instant U-turn; stationary finger silent;
  clean restart; custom threshold).
**Verify: 55 tests / 8 files green; `npm run build` clean (~184 kB js / 61 kB gzip).**
Phone test: dev server (:5173) → swipe on the board (or anywhere) to steer; keep the finger
down and wiggle to turn corners; stationary = nothing; tap = start.
NOTE: the local repo had been reset to a pre-React-conversion `main` with sources missing
(stale untracked `pacman-react/dist` only); fixed by `git pull --ff-only` to `97fa5b1`.

## Camera capture (pacman-react/) — DONE, MERGED to main (PR #4, merge `97fa5b1`)
Goal (user): a **"take a photo with the camera and use it"** option in the personalize panel.
Done on `feature/camera-photo` (from `origin/main` @ `7b0a207`), commit `c9626c9`, pushed:
- `src/game/camera.ts`: `isCameraSupported()` + `captureFrame(video, maxDim=1024)` — draws the
  current video frame to a downscaled canvas, returns a PNG data URL (never upscales; null when
  no frame / no 2d ctx). Nothing runs at import time (safe under node/vitest).
- `src/components/CameraCapture.tsx`: overlay, `getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false})`,
  live `<video>`, cleanup stops tracks; pt-BR error states for insecure context / denied
  (`NotAllowedError`/`SecurityError`) / unavailable, each pointing at the file-picker fallback
  (click the slot); Escape closes.
- `CustomizePanel.tsx`: per-slot "foto" button (`.slot-cam`, inside `.slot-btns` next to "limpar")
  opens the overlay for that slot; the captured data URL goes through the SAME `assignPhoto`
  pipeline as a dropped file (quota/persistence/slot-normalization reused, no duplication).
  Panel Escape is suppressed while the camera is open; captured slot becomes lastUsed.
- `style.css`: `.slot-btns` flex row; camera overlay styles (`.cam-*`, z 70 above the panel).
- Front/back flip (selfie): `CameraCapture` holds `facing` state (default
  `environment`), the ⇄ button re-requests `getUserMedia` with the other facingMode
  (bare string = ideal semantics, so single-cam devices just re-open, no error); the
  title shows FRENTE/COSTAS, and front shots mirror the live feed (`.cam-video.mirror`)
  AND the captured frame (`captureFrame(…, mirror)`) so the sprite matches the preview.
- `tests/peru-camera.test.ts`: 12 tests (support detection ×4; data-URL shape, downscale
  1920x1080→1024x576 and portrait, custom maxDim, no-upscale, 0x0 → null + no canvas created,
  no-ctx → null) via `vi.stubGlobal` of `navigator` and `document.createElement`.
**Landed on main**: user manually merged PR #4 (merge `97fa5b1`,
https://github.com/mattma1970/Qwen3827B-Exploration/pull/4); `origin/main` @ `97fa5b1`
contains the camera feature. (Suite at merge time: 42 tests / 8 files, ~184 kB js.)
Phone test: camera needs https/localhost → `npm run dev -- --host` from `pacman-react/`,
port-forward, open Personalizar (hamburger), tap **foto** on a slot.

## React conversion (pacman-react/) — DONE, merged to main (PR #3, merge `7b0a207`)
Goal (user): port the game to **React + TypeScript** so it runs on a **phone** in a new
`pacman-react/` folder (`pacman/` left intact as reference). Was on branch
`mattma-react-conversion`; **user merged PR #3 manually** → `origin/main` now contains
`pacman-react/`. **Never push to `main`** (AGENTS.md); land via PR + manual merge.

- **Engine outside React**: rAF loop lives in `useEffect` inside `src/components/GameBoard.tsx`;
  React owns the shell (`App.tsx`, `GameBoard`, `TouchControls`, `CustomizePanel`).
- Modules ported 1:1 to `src/game/*.ts`: config, utils, audio, sprites, photoSlots, photo,
  pacman, ghost, game. DOM-guarded at import so node/vitest can import them cleanly.
- Build errors fixed: `Mover.update`→`step` (TS2416 override clash, `Player.update` calls
  `step`); `photo.ts` `Uint8ClampedArray`→`ImageData` widening + cast; `sprites.ts`
  `spriteReady` is a type guard (`img is HTMLImageElement`).
- **R1–R3 code-complete**, `npm run build` (tsc + vite) passes (dist js ~180 kB / gzip ~59 kB).
- **R4 tests ported to vitest** in `pacman-react/tests/` (run `npm test`, 30 tests / 6 files green):
  peru-photo, peru-smoke, peru-flee, peru-buffer, peru-scripted (straight ports via direct import
  + a no-op ctx Proxy), and peru-sprite (full DOM-stub env: Image/canvas/localStorage/URL/
  ImageData via `vi.stubGlobal`, fresh registry per scenario via `vi.resetModules()` + dynamic
  import). `peru-ui` NOT ported (DOM-heavy; React DOM tests differ — do it separately if wanted).
- **R4 regression found + fixed**: the vanilla `photo.js` auto-ran `restoreSprites()` at module
  load; the TS port dropped it and the React app never called it → custom sprites would NOT
  survive a reload. Fixed idiomatically: `App.tsx` calls `restoreSprites()` once in a `useEffect`
  on mount. (The sprite "boot restore" test now calls `restoreSprites()` explicitly to mirror this.)
- **R5**: README written (`pacman-react/README.md`), build re-verified.

**Landed on main**: user manually merged PR #3 (commit `6a213b4` port+tests, `eb8221a` mobile
hamburger UI) → merge `7b0a207`; `origin/main` now contains `pacman-react/`.
NOTE: `pacman-react/` is
NOT part of the GitHub Pages publish config (Pages still serves `pacman/` from main);
playing it means running `npm run dev`/`preview` from `pacman-react/`.
**Phone testing**: dev server binds 0.0.0.0:5173 (`npm run dev -- --host`); `dev.ideas.nu`
is allow-listed in vite.config.ts (port-forwarded to test on the phone).
**Mobile UI (eb8221a)**: viewport ≤720px (useIsMobile in App.tsx, sync with the CSS
720px media rule) shows a fixed top-left ✓-style hamburger (⌘ no — `☰`, z 45: above the
dpad 40, below the open panel 50 which has its own ×) running the same pause-aware panel
toggle as the C hotkey; the in-flow "Personalizar (C)" button is hidden on mobile (the
DPad used to overlap it); hint text swaps to a touch-friendly version. A purple "react"
logo badge + console.log("PERU MAN — react+ts build (pacman-react)") distinguish the
build from the vanilla one.

**Verify loop (from `pacman-react/`):**
```
npm test          # vitest run (8 suites, 55 tests)
npm run build     # tsc && vite build
```
This is a remote server (user can't easily open a browser; local http.server OOM'd) — rely on
`npm test` + `npm run build`, not real-browser testing. Feature work goes on a new branch off
`origin/main`; push the same-named remote (`gh auth setup-git`).
`pacman/img/rafa_emoji.png` is the only tracked image; the React app references `public/img/`.

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
- `js/customize.js` — M4 UI: slotList/slotLabel/isImageFile/setLastUsedSlot/assignToSlot (pure, top-level) + initCustomize(game, canvas) builds the panel (6 drop zones w/ live previews), clear buttons, reset, drop-anywhere on canvas (lastUsedSlot), KeyC/Escape, toast
- `js/pacman.js` — Mover base (grid move; on wall hit sets dir="none" so player stops, does NOT reverse) + Player
- `js/ghost.js` — Turkey extends Mover (AI: scatter/chase BFS + flee when frightened)
- `js/game.js` — Game state machine, collisions, scoring, rendering
- `js/main.js` — bootstrap, DPR scaling, keyboard + pointer input, rAF loop; calls `initCustomize(game, canvas)`
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
- pacman/tests/peru-ui.js      — M4 UI over a fake DOM: panel build, KeyC open/close + pause/resume, zone drop (real pipeline), non-image/empty drops, file-input flow, canvas drop-anywhere (last-used slot), clear + reset, previews

Quick loop after any JS edit (run from the repo root /home/mattma/repos/Qwen3827B-Exploration):
```
node --check pacman/js/<file>.js          # syntax
node pacman/tests/peru-smoke.js           # sanity
node pacman/tests/peru-scripted.js        # pill/fright/gobble/levelup
node pacman/tests/peru-flee.js            # flee direction (BFS)
node pacman/tests/peru-buffer.js          # keypress buffering / dead-end reverse
node pacman/tests/peru-photo.js           # emoji-fy pure core
node pacman/tests/peru-sprite.js          # sprite registry/glue/turkey+pill slots
node pacman/tests/peru-ui.js              # customize panel UI (fake DOM)
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

## Done (photo-sprite M4: customize UI)
**Feature**: `js/customize.js` (loaded after photo.js) + main.js calls
`initCustomize(game, canvas)` + CSS in style.css. All pure helpers are top-level
`function`/`var` (vm-global); `initCustomize` bails when headless (`typeof document`).
- Panel (hidden): 6 drop zones in order PACMAN / DARIO / RITA / ZECA / TUCA / PÍLULA, each
  with a live 64px preview canvas (drawPlayer/drawTurkey/drawCanvaPill of the current
  state), status line ("padrão"/"personalizada"), a "limpar" clear button (shown when
  filled) and a hidden `<input type=file accept="image/*">`.
- Interactions: drag-drop onto a zone (dragover highlight) → `assignToSlot` (process +
  assign + persist, marks `lastUsedSlot`); zone click → file picker (mobile fallback);
  "restaurar padrões" button clears all 6 slots + resets lastUsedSlot; drop ANYWHERE on
  the game canvas → goes to `lastUsedSlot` (default "player"); "Personalizar (C)" button
  below the canvas.
- **KEY: C (KeyC), not S — S is already the WASD "down" movement key.** Escape closes.
- Opening the panel during play/ready auto-pauses; closing resumes only if the panel
  paused it (title/gameover: no pause). Toast (fixed, bottom) for success/errors:
  "foto aplicada em X", "só imagens, por favor", "não deu para ler essa imagem", etc.
- `spriteSlot` now case-insensitive for player/pill too (was exact-match; only turkey
  matching was case-insensitive).
- Tests: `tests/peru-ui.js` (56 checks) drives the REAL initCustomize over a fake DOM
  (FakeEl with className<->_classes, classList, addEventListener/dispatch) + `makeFullCtx`
  (samples last-drawn source for the pipeline AND records drawImage for previews; gradient
  factories get no-op addColorStop). Sandbox A (no document/Image/storage) covers the pure
  helpers + the headless guard. Note: data-URL sequence is a global counter (CVSEQ) so
  re-assigns produce distinct URLs for change-detection asserts.

## DONE: drop-a-photo-to-sprite feature (was branch `feature/photo-sprite`)
**Status snapshot (2026-08-21):** feature is LIVE on main, merged via
https://github.com/mattma1970/Qwen3827B-Exploration/pull/1 (merge commit `35497f7`,
`feature/photo-sprite` → `main`).
All 7 test suites green (peru-ui 56, peru-sprite 46 checks). The feature branch
(local + `origin/feature/photo-sprite`) is fully merged and safe to delete.
GitHub Pages serves it from main at
https://mattma1970.github.io/Qwen3827B-Exploration/pacman/ — open the page and press
**C** to bring up the customize panel.
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
- [x] **M4** UI: customize panel with 6 drop zones (Pacman, 4 named turkeys, pill) +
  clear buttons; drop-anywhere on canvas (last-used slot); file-input fallback for
  mobile; reset-to-defaults. Opened with **C** (S is the WASD down key) or the on-screen
  button; see "Done (photo-sprite M4)" above.
- [x] **M5** quota guard: `SPRITE_QUOTA = 5*1024*1024` chars in photo.js; `spriteUsage()`
  sums key+value bytes across all `SpriteData` entries; `spriteFits(slot, url)` does the
  pre-check (re-placing the same slot swaps old bytes for new); `assignPhoto` rejects
  with `Error("sprite storage quota exceeded")` BEFORE mutating when `hasStorage()` and
  the new URL would exceed the quota (no-op in memory when localStorage is absent).
  customize.js toasts the distinct message "armazenamento cheio — foto muito grande"
  (matched on `String(err)`.indexOf("quota")) and the panel footer shows a live usage
  meter ("usando X de 5.0 MB", `.cp-usage`, flex next to "restaurar padrões"); the meter
  refreshes on every `refreshAll` (open panel / drop success / clear / reset). The
  raw-storage QuotaExceededError path still degrades gracefully (persistSlot → false,
  in-memory sprite kept). restoreSprites now reuses `allSlots()`.
- [x] **Landed on main**: pushed M5 to `origin/feature/photo-sprite` (commits
  `766921c`, `e9a19cb`), merged PR #1 into main (merge `35497f7`); local `main`
  fast-forwarded. Served on GitHub Pages from main.

### Notes for the next session
- Nothing blocking. Optional cleanups: delete the merged `feature/photo-sprite`
  branches (local + remote) and the stale local `mattma-pacman-update` branch
  (sits on the same commit as main, has nothing extra).
- Panel DOM wiring is exercised headless via the fake DOM in tests/peru-ui.js, but
  the REAL-browser feel (drag-drop, file picker, toast timing, panel scroll on small
  screens) was code-reviewed — if the user spots anything in a real browser, fix it
  on a fresh feature branch (never straight to main).
- Load order is fixed: config -> utils -> audio -> sprites -> photo -> pacman -> ghost ->
  game -> main. The test suites load only the files they need (peru-sprite.js:
  config → utils → audio → sprites → photo).
- Headless gotcha re-confirmed: top-level `function`/`var` attach to the vm sandbox;
  `const`/`let`/`class` don't. (New glue code follows this: `var Sprites`, `var SpriteData`.)
- Persistence: localStorage data-URLs keyed `peruman.sprite.<slot>`; `restoreSprites()`
  rehydrates `Sprites.*` at boot (guarded by typeof Image + typeof localStorage).
  `persistSlot` swallows QuotaExceededError (returns false) so assignment still works.
- All 7 suites currently green (smoke, scripted, flee, buffer, photo, sprite, ui).
- Untracked leftovers in `pacman/img/` (rafa.png, rafa_preview.png, framings.png)
  are NOT part of this feature — optional cleanup.

## Idea backlog (optional, not requested)
- Could add a small "CANVA" text under the pill (redundant now that the wordmark is shown).
