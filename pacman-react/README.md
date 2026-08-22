# PERU MAN (React + TS)

The code in this repo is entirely written using Qwen 3.8 27B Q4_K_M quant from Unsloth
with thinking set to medium, using the suggest parameters + context lenght of 128k, 
OpenCode coding harness and running it locally on an RTX 4090.

The purpose of this project was to build something non-trival 
and have the small model development experience to compare and contrast it with having
a top-end of town FM as a daily driver. 

---

The PERU MAN game rebuilt with **React +
TypeScript + Vite**, so it runs on a phone. The vanilla no-build version stays
in `pacman/`; this is the `pacman-react/` port. The engine runs *outside* React
(a `requestAnimationFrame` loop in `GameBoard`); React owns the shell/UI.

Feature parity with the vanilla game:

- **Player** - Pac-Man as the Brazilian flag (green, yellow diamond, blue globe)
- **Ghosts** - 4 turkeys with distinct personalities (Dario, Rita, Zeca, Tuca)
- **Power pills** - Canva wordmarks; eat one to turn turkeys blue and gobble them
- **Photo sprites** - drop a photo (or take one with the camera / pick from the
  gallery) to "emoji-fy" it (256x256, blur, posterize, median-cut to 16 flat
  colors) and assign it to Pacman, a turkey, or the pill (photos stay local in
  `localStorage`, restored on reload). Every photo goes through the 2-step
  **character design wizard** (`src/components/CharacterWizard.tsx`):
  1. **foto** - camera capture or gallery pick;
  2. **personagem** - a live preview plus the choices: the **base character**
     the photo rides on (classic **PACMAN** mouth wedge, classic **FANTASMA**,
     or **SÓ RECORTE** = cutout only), a **base color** from a curated arcade
     palette, the **"recorte de silhueta"** toggle, and a
     **press-and-drag on the live preview** that shifts the photo's position
     on the character where it looks right (a "recentrar foto" button resets
     it). All the per-slot options live in `src/game/character.ts`
     (`CharDesign {base, color, silhueta, dx, dy}`), designed to grow: a
     future effect (e.g. a "cartoonize") is one more wizard toggle + one
     pipeline step + one design field.
  With silhueta on (default), the background is cut out in the browser
  (`@imgly/background-removal`, ONNX/WASM, model fetched once from the IMG.LY
  CDN and cached) so the sprite keeps the object's shape, plus a flat sticker
  ring around the silhouette (`src/game/sticker.ts`). If the cutout can't run
  (no network, headless, model error) it falls back to the plain square. The
  cutout/outline code is lazy: first use only. The photo **rides on top of its
  base character, always upright, offset by the chosen position (dx/dy), and
  clipped to the base's outline** (it may cover the character but never
  extends outside it; the base rotates/animates underneath) so the face
  looks like it's piloting the character — e.g. the player's default is a
  classic yellow Pac-Man, defaulting each turkey to the classic ghost in its
  own color, and the pill to a Canva-purple Pac-Man. The per-slot design is
  saved under `peruman.char.<slot>` and restored at boot
  (`restoreCharDesigns`). "SÓ RECORTE" (no base) has no outline to clip
   against — the photo shows as-is.
   **Busy feedback** - the model download (tens of MB, fetched once) and the
   per-photo cutout/emoji-ify are where a phone looks like it froze, so both
   show visible progress: on panel open a `.cp-warm` line spins with the
   model-download % (`preloadCutout({ progress })` — imgly reports download +
   inference), and inside the design step a `.wiz-busy` overlay (spinner + label,
   e.g. "recortando silhueta… N%") covers the preview across every processing
   phase and keeps "aplicar" disabled until the image is ready.
- **Sound** - Web Audio SFX (M to mute)

## Run

```
npm install
npm run dev        # http://127.0.0.1:5173
```

## Test / build

```
npm test           # vitest (maze, game loop, flee, buffering, sprite pipeline)
npm run build      # tsc typecheck + vite build -> dist/
```

Headless note: the game modules are DOM-guarded at import time, so the pure/core
suites run in plain node. The sprite glue suite stubs `Image`/`document`/`canvas`/
`localStorage`/`URL`/`ImageData` and re-imports the modules fresh per scenario.

## Controls

| Input | Action |
| --- | --- |
| Arrows / WASD | Move |
| Enter / Space | Start / restart |
| P | Pause |
| M | Mute |
| C | Customize (drop a photo sprite) |
| Swipe anywhere on screen | Mobile steering (finger direction turns Pac-Man; stationary finger = nothing) |
| Tap screen | Mobile start / replay |
| Top-banner ▶ / ❚❚ button | Mobile start / pause (top-right, cleared off the board for swiping) |
| Top-banner ☰ button | Mobile: open the personalize panel (top-left) |
| Bordered swipe pad (under board) | Mobile: the visible "swipe here" trackpad affordance (a full-screen swipe steers) |
| Retro instructions splash | Mobile: shown over the board on the title screen; gone once the match starts or the panel opens |

## Layout

```
pacman-react/
  src/main.tsx            React root
  src/App.tsx             shell: board + mobile top banner + swipe pad + splash + customize panel
  src/style.css           styles (incl. mobile banner / swipe pad / title splash)
   src/components/
      GameBoard.tsx         canvas, DPR sizing, rAF loop, keyboard + touch gesture input, board overlay
      TopBar.tsx            mobile top banner: hamburger (left) + play/pause (right)
      CustomizePanel.tsx    6 photo-sprite drop zones (+ file-picker fallback, reset)
     CameraCapture.tsx     camera step of the wizard (live video, flip, capture)
     CharacterWizard.tsx   2-step wizard: foto -> personagem (base, color, silhueta)
   src/game/               engine, ported 1:1 from the vanilla js/
     config.ts utils.ts audio.ts sprites.ts swipe.ts character.ts
     photoSlots.ts photo.ts silhouette.ts sticker.ts pacman.ts ghost.ts game.ts
  public/img/rafa_emoji.png
  tests/                  vitest suites (ported from pacman/tests/)
```

## Licenses

- `@imgly/background-removal` is **AGPL-3.0** (see
  `node_modules/@imgly/background-removal/LICENSE.md`). It runs entirely on the
  user's device (no server, photos never leave the machine), but the AGPL
  terms apply to the game build that ships it; the model weights themselves are
  fetched from `staticimgly.com` on first use.
