// PERU MAN (React) - the game board: canvas + engine wiring + input.
// The Game engine runs outside React (rAF loop); React just mounts it.

import { useEffect, useRef } from "react";
import { CELL, COLS } from "../game/config";
import { Game } from "../game/game";
import { AudioFX } from "../game/audio";
import type { Dir } from "../game/utils";

const SIZE = COLS * CELL;

const KEYMAP: Record<string, Dir> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

interface Props {
  onGame: (game: Game) => void;
  onToggleCustomize: () => void;
  // drop-anywhere: a photo dropped on the canvas goes to the last-used slot
  onCanvasDrop?: (f: File | null) => void;
}

const SWIPE_THRESHOLD = 24; // px of travel before a swipe counts as a direction

export default function GameBoard({ onGame, onToggleCustomize, onCanvasDrop }: Props) {
  const onCanvasDropRef = useRef(onCanvasDrop);
  onCanvasDropRef.current = onCanvasDrop;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const onGameRef = useRef(onGame);
  const onToggleRef = useRef(onToggleCustomize);
  onGameRef.current = onGame;
  onToggleRef.current = onToggleCustomize;

  // engine lifecycle: create Game, run the rAF loop, tear down on unmount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // DPR scaling lives in the backing store only; the CSS display size is
    // owned by style.css (.canvas-wrap) so the board fills the phone screen.
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = SIZE * DPR;
    canvas.height = SIZE * DPR;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(DPR, DPR);

    const game = new Game(ctx, SIZE);
    gameRef.current = game;
    onGameRef.current(game);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      game.update(dt);
      game.render();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      gameRef.current = null;
    };
  }, []);

  // keyboard (desktop)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const game = gameRef.current;
      if (!game) return;
      AudioFX.ensure();
      const dir = KEYMAP[e.code];
      if (dir) {
        e.preventDefault();
        game.setWant(dir);
      } else if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        game.primaryAction();
      } else if (e.code === "KeyP") {
        game.togglePause();
      } else if (e.code === "KeyM") {
        const m = !AudioFX.isMuted();
        AudioFX.setMuted(m);
      } else if (e.code === "KeyC") {
        onToggleRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // touch: swipe to steer (one direction per gesture) + tap = left/right steer
  // or start (title/gameover), matching the desktop tap behavior.
  const gesture = useRef<{ x: number; y: number; swiped: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const game = gameRef.current;
    if (!game) return;
    AudioFX.ensure();
    gesture.current = { x: e.clientX, y: e.clientY, swiped: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current;
    const game = gameRef.current;
    if (!g || g.swiped || !game) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.hypot(dx, dy) < SWIPE_THRESHOLD) return;
    g.swiped = true;
    const dir: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    game.setWant(dir);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const game = gameRef.current;
    const g = gesture.current;
    gesture.current = null;
    if (!game || !g || g.swiped) return;
    // a tap (no meaningful travel): start, or steer left/right by half
    const canvas = canvasRef.current;
    if (game.state === "title" || game.state === "gameover") {
      game.primaryAction();
      return;
    }
    const rect = canvas ? canvas.getBoundingClientRect() : null;
    if (rect) game.setWant(e.clientX - rect.left < rect.width / 2 ? "left" : "right");
  };

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer?.files?.[0] ?? null;
          onCanvasDropRef.current?.(f);
        }}
      />
    </div>
  );
}
