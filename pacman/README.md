# PERU MAN - o Pac-BR

A modern remake of the classic, in a Brazilian key:

- **Player** - Pac-Man reshaped as the Brazilian flag (green, yellow diamond, blue globe)
- **Ghosts** - 4 turkeys with distinct personalities (Dario, Rita, Zeca, Tuca)
- **Power pills** - Canva logos! Eat one to turn turkeys blue and gobble them for 100/200/400/800
- **Pellets** - little yellow diamonds
- **Sound** - waka-waka, pill jingle, gobble fanfare, death slide (Web Audio, M to mute)

## Play

No build step - just open it:

```
open pacman/index.html
```

Or serve it:

```
python3 -m http.server -d pacman 8000
# then visit http://localhost:8000
```

### Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Move |
| Enter / Space | Start / restart |
| P | Pause |
| M | Mute |
| Tap left/right half | Mobile steering |

## How it works

- 15x15 maze, grid-based movement; turkeys steer with BFS distance fields toward per-personality targets
- Classic scatter/chase phases (short scatters between long chases, endless final chase)
- 3 lives, 500 bonus per completed level, turkeys speed up each level
- Eaten turkeys fly home to the den as eyes and respawn

## Files (kept small on purpose)

```
pacman/
  index.html
  css/style.css
  js/config.js   grid, maze, tuning, turkey roster
  js/utils.js    directions, grid queries, BFS
  js/audio.js    Web Audio sound effects
  js/sprites.js  all drawing (flag, turkeys, pills)
  js/pacman.js   mover base + player
  js/ghost.js    turkey AI
  js/game.js     state machine, scoring, rendering
  js/main.js     bootstrap, input, loop
```

Verified headlessly: maze connectivity, full game loop (death/respawn/game over),
power pill, gobble chain, den respawn, and level-up all pass.
