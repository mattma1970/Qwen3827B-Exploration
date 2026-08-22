// PERU MAN - game state machine, collisions, scoring, rendering.

import { CELL, MAZE, PHASE_DURATIONS, ROWS, COLS, SCATTER_TARGETS, TUNE, TURKEYS } from "./config";
import type { Dir, Grid } from "./utils";
import { Player } from "./pacman";
import { Turkey } from "./ghost";
import { AudioFX } from "./audio";
import { drawCanvaPill, drawEyes, drawMiniFlag, drawPellet, drawPlayer, drawTurkey, type TurkeyOpts } from "./sprites";

export type GameState = "title" | "ready" | "play" | "dying" | "levelup" | "gameover";

export interface FloatText {
  x: number;
  y: number;
  txt: string;
  t: number;
  col: string;
}

export class Game {
  ctx: CanvasRenderingContext2D;
  size: number;
  grid: Grid = [];
  player: Player | null = null;
  turkeys: Turkey[] = [];
  state: GameState = "title"; // title | ready | play | dying | levelup | gameover
  stateT = 0;
  t = 0;
  paused = false;
  score = 0;
  best = 0;
  lives = 3;
  level = 1;
  pelletsLeft = 0;
  frightT = 0;
  chain = 0;
  cycleT = 0;
  phase: "scatter" | "chase" = "scatter";
  playerStart = { r: 12, c: 7 };
  floats: FloatText[] = [];

  constructor(ctx: CanvasRenderingContext2D, size: number) {
    this.ctx = ctx;
    this.size = size;
  }

  // ---------- control ----------

  primaryAction(): void {
    if (this.state === "title" || (this.state === "gameover" && this.stateT > 1)) {
      AudioFX.start();
      this.newGame();
    }
  }

  setWant(dir: Dir): void {
    if (this.state === "title" || (this.state === "gameover" && this.stateT > 1)) {
      AudioFX.start();
      this.newGame();
      if (this.player) this.player.want = dir;
      return;
    }
    if (this.player) this.player.want = dir;
  }

  togglePause(): void {
    if (this.state === "play" || this.state === "ready") this.paused = !this.paused;
  }

  newGame(): void {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.loadLevel();
    this.setState("ready");
    AudioFX.go();
  }

  setState(s: GameState): void {
    this.state = s;
    this.stateT = 0;
  }

  playerSpeed(): number {
    return TUNE.playerSpeed * (1 + Math.min(TUNE.maxLevelBoost, TUNE.levelSpeedStep * (this.level - 1)));
  }

  loadLevel(): void {
    this.grid = MAZE.map((row) => row.split(""));
    let pellets = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = this.grid[r][c];
        if (ch === "M") {
          this.playerStart = { r, c };
          this.grid[r][c] = " ";
        } else if (ch === "G") this.grid[r][c] = " ";
        if (ch === "." || ch === "P") pellets++;
      }
    }
    this.pelletsLeft = pellets;
    this.player = new Player(this.grid, this.playerStart.r, this.playerStart.c, this.playerSpeed());
    this.turkeys = TURKEYS.map((def, i) => new Turkey(this.grid, def, SCATTER_TARGETS[i % SCATTER_TARGETS.length]));
    this.frightT = 0;
    this.chain = 0;
    this.cycleT = 0;
    this.phase = "scatter";
    this.floats = [];
  }

  resetActors(): void {
    // after death: keep pellets, just reposition everyone
    this.player = new Player(this.grid, this.playerStart.r, this.playerStart.c, this.playerSpeed());
    this.turkeys = TURKEYS.map((def, i) => new Turkey(this.grid, def, SCATTER_TARGETS[i % SCATTER_TARGETS.length]));
    this.frightT = 0;
    this.chain = 0;
    this.cycleT = 0;
    this.phase = "scatter";
    this.floats = [];
  }

  // ---------- update ----------

  update(dt: number): void {
    this.t += dt;
    if (this.paused) return;
    this.stateT += dt;
    switch (this.state) {
      case "ready":
        if (this.stateT > 1.6) this.setState("play");
        break;
      case "play":
        this.updatePlay(dt);
        break;
      case "dying":
        if (this.stateT > 1.7) this.afterDeath();
        break;
      case "levelup":
        if (this.stateT > 2.4) {
          this.level++;
          this.loadLevel();
          this.setState("ready");
          AudioFX.go();
        }
        break;
      default:
        break; // title / gameover
    }
    for (const f of this.floats) f.t += dt;
    this.floats = this.floats.filter((f) => f.t < 0.9);
  }

  updatePlay(dt: number): void {
    const p = this.player;
    if (!p) return;

    // global mode schedule (frozen while a power pill is active)
    if (this.frightT > 0) {
      this.frightT -= dt;
      if (this.frightT <= 0) {
        this.frightT = 0;
        this.chain = 0;
      }
    } else {
      this.cycleT += dt;
      let t = this.cycleT;
      let step = PHASE_DURATIONS.length - 1;
      for (let i = 0; i < PHASE_DURATIONS.length; i++) {
        if (t < PHASE_DURATIONS[i]) {
          step = i;
          break;
        }
        t -= PHASE_DURATIONS[i];
      }
      this.phase = step % 2 === 0 ? "scatter" : "chase";
    }
    const frightActive = this.frightT > 0;

    p.update(dt);

    // eat whatever is in the cell we just centered on
    const ch = this.grid[p.r][p.c];
    if (ch === ".") {
      this.grid[p.r][p.c] = " ";
      this.pelletsLeft--;
      this.score += 10;
      AudioFX.pellet();
    } else if (ch === "P") {
      this.grid[p.r][p.c] = " ";
      this.pelletsLeft--;
      this.score += 100;
      this.frightT = Math.max(2, TUNE.frightTime - (this.level - 1) * 0.5);
      this.chain = 0;
      AudioFX.pill();
      this.floats.push({ x: p.x, y: p.y - 14, txt: "PERUS!", t: 0, col: "#ffd166" });
    }
    if (this.pelletsLeft <= 0) {
      this.score += 500;
      this.setState("levelup");
      AudioFX.levelup();
      return;
    }

    for (const g of this.turkeys) {
      g.update(dt, p, this.level, frightActive);
      if (!g.released || g.eaten) continue;
      if (Math.hypot(g.x - p.x, g.y - p.y) < CELL * 0.55) {
        if (frightActive) {
          const pts = 100 << this.chain;
          this.chain = Math.min(3, this.chain + 1);
          this.score += pts;
          g.setEaten();
          AudioFX.turkeyEaten();
          this.floats.push({ x: g.x, y: g.y - 10, txt: "" + pts, t: 0, col: "#9ef01a" });
        } else {
          this.setState("dying");
          AudioFX.death();
          return;
        }
      }
    }
    if (this.score > this.best) this.best = this.score;
  }

  afterDeath(): void {
    this.lives--;
    if (this.lives <= 0) {
      this.setState("gameover");
    } else {
      this.resetActors();
      this.setState("ready");
      AudioFX.go();
    }
  }

  // ---------- render ----------

  render(): void {
    const c = this.ctx;
    const S = this.size;
    c.fillStyle = "#12122b";
    c.fillRect(0, 0, S, S);

    if (this.state === "title") {
      this.renderTitle(c, S);
      return;
    }

    this.renderMaze(c);
    this.renderTurkeys(c);
    this.renderPlayer(c);
    this.renderFloats(c);
    this.renderHud(c, S);
    this.renderOverlays(c, S);
  }

  renderMaze(c: CanvasRenderingContext2D): void {
    // colorful walls, pellets, Canva power pills
    for (let r = 0; r < ROWS; r++) {
      for (let cc = 0; cc < COLS; cc++) {
        const ch = this.grid[r][cc];
        const x = cc * CELL;
        const y = r * CELL;
        if (ch === "#") {
          const hue = 200 + ((r * 13 + cc * 7) % 50) - 20;
          c.fillStyle = "hsl(" + hue + ",55%,34%)";
          roundRect(c, x + 2, y + 2, CELL - 4, CELL - 4, 7);
          c.fill();
          c.fillStyle = "hsla(" + hue + ",60%,55%,0.25)";
          roundRect(c, x + 4, y + 4, CELL - 8, CELL - 8, 5);
          c.fill();
        } else if (ch === ".") {
          drawPellet(c, x + CELL / 2, y + CELL / 2);
        } else if (ch === "P") {
          drawCanvaPill(c, x + CELL / 2, y + CELL / 2, CELL / 2.4, this.t);
        }
      }
    }
  }

  renderTurkeys(c: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.turkeys.length; i++) {
      const g = this.turkeys[i];
      const bob = Math.sin((this.t + i) * 6) * 2;
      if (g.eaten) {
        drawEyes(c, g.x, g.y);
        continue;
      }
      const flick = this.frightT < 2 && g.fright && ((this.t * 5) | 0) % 2 === 0;
      const facing: TurkeyOpts["facing"] = g.dir === "left" ? "left" : "right";
      drawTurkey(c, g.x, g.y, TUNE.ghostRadius, g.def.color, {
        fright: g.fright,
        flick: flick,
        facing: g.fright ? "right" : facing,
        bob: g.released ? 0 : bob,
        name: g.def.name,
      });
    }
  }

  renderPlayer(c: CanvasRenderingContext2D): void {
    const p = this.player;
    if (!p) return;
    const mouth = 0.1 + 0.6 * (0.5 + 0.5 * Math.sin(this.t * 11));
    if (this.state === "dying") {
      const e = Math.min(1, this.stateT / 1.5);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(this.stateT * 14);
      c.globalAlpha = 1 - e * 0.6;
      drawPlayer(c, 0, 0, TUNE.playerRadius * (1 - e) + 1, 0.9, "right");
      c.restore();
      c.globalAlpha = 1;
      return;
    }
    if (this.state === "play" || this.state === "ready") {
      drawPlayer(c, p.x, p.y, TUNE.playerRadius, mouth, p.dir === "none" ? "right" : p.dir);
    }
  }

  renderFloats(c: CanvasRenderingContext2D): void {
    c.font = "bold 14px monospace";
    c.textAlign = "center";
    for (const f of this.floats) {
      c.globalAlpha = 1 - f.t / 0.9;
      c.fillStyle = f.col;
      c.fillText(f.txt, f.x, f.y - f.t * 26);
    }
    c.globalAlpha = 1;
  }

  renderHud(c: CanvasRenderingContext2D, S: number): void {
    c.font = "bold 15px monospace";
    c.textAlign = "left";
    c.fillStyle = "#ffdf00";
    c.fillText("PONTOS " + this.score, 10, 21);
    c.textAlign = "right";
    c.fillStyle = "#7ee8fa";
    c.fillText("FASE " + this.level, S - 10, 21);
    c.textAlign = "center";
    c.fillStyle = "#565d8f";
    c.font = "11px monospace";
    c.fillText("RECORDE " + this.best, S / 2, 21);
    // lives as mini flags
    for (let i = 0; i < this.lives; i++) {
      drawMiniFlag(c, 14 + i * 22, S - 14, 8);
    }
  }

  renderOverlays(c: CanvasRenderingContext2D, S: number): void {
    const mid = S / 2;
    if (this.state === "ready") {
      c.textAlign = "center";
      c.fillStyle = "#ffdf00";
      c.font = "bold 22px monospace";
      c.fillText("FASE " + this.level, mid, mid - 14);
      c.fillStyle = (this.stateT * 4) % 1 < 0.7 ? "#fff" : "#e63946";
      c.font = "bold 30px monospace";
      c.fillText("VÁ!", mid, mid + 18);
    } else if (this.paused) {
      this.dim(c, S, 0.55);
      c.textAlign = "center";
      c.fillStyle = "#fff";
      c.font = "bold 26px monospace";
      c.fillText("PAUSADO (P)", mid, mid);
    } else if (this.state === "dying") {
      c.textAlign = "center";
      c.fillStyle = "#e63946";
      c.font = "bold 24px monospace";
      c.fillText("OHH-NÔ!", mid, mid - 40);
    } else if (this.state === "levelup") {
      this.dim(c, S, 0.4);
      c.textAlign = "center";
      c.fillStyle = "#80ed99";
      c.font = "bold 24px monospace";
      c.fillText("FASE " + this.level + " COMPLETA!", mid, mid - 10);
      c.fillStyle = "#ffdf00";
      c.font = "16px monospace";
      c.fillText("bônus +500 - os perus ficam mais rapids", mid, mid + 18);
    } else if (this.state === "gameover") {
      this.dim(c, S, 0.65);
      c.textAlign = "center";
      c.fillStyle = "#e63946";
      c.font = "bold 30px monospace";
      c.fillText("FIM DE JOGO", mid, mid - 14);
      c.fillStyle = "#cdd3ff";
      c.font = "16px monospace";
      c.fillText("pontos " + this.score + "  -  recorde " + this.best, mid, mid + 14);
      if (this.stateT > 1) {
        c.fillStyle = "#fff";
        c.font = "bold 14px monospace";
        c.fillText("Enter / toque na tela para jogar de novo", mid, mid + 44);
      }
    }
  }

  dim(c: CanvasRenderingContext2D, S: number, a: number): void {
    c.fillStyle = "rgba(10,10,25," + a + ")";
    c.fillRect(0, 0, S, S);
  }

  renderTitle(c: CanvasRenderingContext2D, S: number): void {
    const mid = S / 2;
    // demo sprites
    const bob = Math.sin(this.t * 3) * 4;
    drawPlayer(c, S * 0.28, mid - 30 + bob, 22, 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(this.t * 9)), "right");
    drawCanvaPill(c, S * 0.28, mid + 40, 12, this.t);
    for (let i = 0; i < TURKEYS.length; i++) {
      const g = TURKEYS[i];
      drawTurkey(c, S * 0.62, mid - 62 + i * 40, 14, g.color, { bob: Math.sin(this.t * 4 + i) * 3, name: g.name });
    }
    c.textAlign = "center";
    const grad = c.createLinearGradient(S * 0.15, 0, S * 0.85, 0);
    grad.addColorStop(0, "#00d95f");
    grad.addColorStop(0.5, "#ffdf00");
    grad.addColorStop(1, "#4d7cff");
    c.fillStyle = grad;
    c.font = "900 40px sans-serif";
    c.fillText("PERU MAN", mid, 96);
    c.fillStyle = "#8b93c9";
    c.font = "14px monospace";
    c.fillText("o Pac-BR persegue o rebanho", mid, 126);
    c.fillStyle = "#cdd3ff";
    c.font = "14px monospace";
    c.fillText("comas os losangos, pegue a pilula Canva,", mid, mid + 96);
    c.fillText("e devore os perus azuis!", mid, mid + 116);
    if ((this.t * 2) % 1 < 0.6) {
      c.fillStyle = "#fff";
      c.font = "bold 16px monospace";
        c.fillText("ENTER, toque ou uma seta para jogar", mid, mid + 156);
    }
  }
}

// rounded rect path helper (shared by maze walls)
export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
