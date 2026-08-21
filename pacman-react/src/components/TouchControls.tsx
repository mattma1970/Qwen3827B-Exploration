// PERU MAN (React) - on-screen touch controls (mobile fallback):
// a DPad for steering, a pause button and a start button. Only rendered on
// touch devices (coarse pointer); desktop users keep the keyboard.

import { useEffect, useState } from "react";
import type { Game } from "../game/game";
import type { Dir } from "../game/utils";
import { AudioFX } from "../game/audio";

interface Props {
  game: Game | null;
}

function useIsTouchDevice(): boolean {
  const [touch] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window;
  });
  return touch;
}

export default function TouchControls({ game }: Props) {
  const isTouch = useIsTouchDevice();
  const [, force] = useState(0);
  // re-render when the paused flag flips so the button label stays honest
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);

  if (!isTouch) return null;

  const steer = (dir: Dir) => {
    if (!game) return;
    AudioFX.ensure();
    game.setWant(dir);
  };

  return (
    <div className="touch-controls" aria-label="controles">
      <div className="dpad">
        <button className="dbtn up" onPointerDown={(e) => { e.preventDefault(); steer("up"); }} aria-label="cima">▲</button>
        <div className="dpad-row">
          <button className="dbtn left" onPointerDown={(e) => { e.preventDefault(); steer("left"); }} aria-label="esquerda">◀</button>
          <button
            className="dbtn mid"
            onPointerDown={(e) => {
              e.preventDefault();
              if (!game) return;
              AudioFX.ensure();
              if (game.state === "title" || (game.state === "gameover" && game.stateT > 1)) game.primaryAction();
              else game.togglePause();
            }}
            aria-label="pausa / começar"
          >
            {game && (game.paused || (game.state === "play" || game.state === "ready")) ? "❚❚" : "▶"}
          </button>
          <button className="dbtn right" onPointerDown={(e) => { e.preventDefault(); steer("right"); }} aria-label="direita">▶</button>
        </div>
        <button className="dbtn down" onPointerDown={(e) => { e.preventDefault(); steer("down"); }} aria-label="baixo">▼</button>
      </div>
    </div>
  );
}
