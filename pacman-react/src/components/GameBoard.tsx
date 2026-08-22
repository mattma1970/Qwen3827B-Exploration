// PERU MAN (React) - the game board: canvas + engine wiring + input.
// The Game engine runs outside React (rAF loop); React just mounts it.

import { useEffect, useRef, type ReactNode } from "react";
import { CELL, COLS } from "../game/config";
import { Game } from "../game/game";
import { AudioFX } from "../game/audio";
import { SwipeTracker } from "../game/swipe";
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
  // optional overlay rendered on top of the canvas (e.g. the mobile title splash)
  overlay?: ReactNode;
}

export default function GameBoard({ onGame, onToggleCustomize, onCanvasDrop, overlay }: Props) {
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

  // touch: continuous steering anywhere on the screen. While the finger is
  // down, each chunk of travel in a new dominant axis steers Pac-Man
  // (SwipeTracker re-anchors per turn); a stationary finger does nothing;
  // a quick tap (no travel) starts / replays on title & gameover.
  // Touches that begin on interactive UI (buttons, the customize panel, the
  // camera overlay) are left alone — they keep their own behavior.
  const INTERACTIVE_SEL =
    'button, a, input, select, textarea, [role="button"], .customize-panel, .cam-overlay';

  useEffect(() => {
    const tracker = new SwipeTracker();
    let touchId: number | null = null;

    const isInteractive = (t: EventTarget | null): boolean =>
      t instanceof Element && t.closest(INTERACTIVE_SEL) !== null;

    const trackedTouch = (e: TouchEvent): Touch | undefined =>
      Array.from(e.changedTouches).find((tc) => tc.identifier === touchId);

    const onTouchStart = (e: TouchEvent) => {
      if (touchId !== null || isInteractive(e.target)) return;
      const tc = e.changedTouches[0];
      touchId = tc.identifier;
      tracker.start(tc.clientX, tc.clientY);
      AudioFX.ensure();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchId === null) return;
      // active steer: keep the page from scrolling with the swipe
      e.preventDefault();
      const tc = trackedTouch(e);
      if (!tc) return;
      const dir = tracker.move(tc.clientX, tc.clientY);
      if (!dir) return;
      const game = gameRef.current;
      if (!game || game.paused) return;
      AudioFX.ensure();
      game.setWant(dir);
    };

    const onFinish = (e: TouchEvent, asTap: boolean) => {
      if (touchId === null) return;
      const tc = trackedTouch(e);
      if (!tc) return; // a different finger lifted
      touchId = null;
      const fired = tracker.fired;
      tracker.end();
      // a release without any travel is a tap: start or replay
      if (asTap && !fired) gameRef.current?.primaryAction();
    };

    const onTouchEnd = (e: TouchEvent) => onFinish(e, true);
    const onTouchCancel = (e: TouchEvent) => onFinish(e, false);

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, []);

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer?.files?.[0] ?? null;
          onCanvasDropRef.current?.(f);
        }}
      />
      {overlay}
    </div>
  );
}
