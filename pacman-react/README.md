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
- **Photo sprites** - drop a photo to "emoji-fy" it (256x256, blur, posterize,
  median-cut to 16 flat colors) and assign it to Pacman, a turkey, or the pill
  (photos stay local in `localStorage`, restored on reload)
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
| On-screen ▶ / ❚❚ button | Mobile start / pause (the old DPad arrows are gone) |

## Layout

```
pacman-react/
  src/main.tsx            React root
  src/App.tsx             shell: board + touch controls + customize panel
  src/style.css           styles (incl. mobile / touch controls)
  src/components/
    GameBoard.tsx         canvas, DPR sizing, rAF loop, keyboard + touch gesture input
    TouchControls.tsx     pause/start pill (pointer: coarse / ontouchstart only)
    CustomizePanel.tsx    6 photo-sprite drop zones (+ file-picker fallback, reset)
  src/game/               engine, ported 1:1 from the vanilla js/
    config.ts utils.ts audio.ts sprites.ts swipe.ts
    photoSlots.ts photo.ts pacman.ts ghost.ts game.ts
  public/img/rafa_emoji.png
  tests/                  vitest suites (ported from pacman/tests/)
```
