// PERU MAN (React) - on-screen play/pause button (mobile). Steering is done by
// swiping anywhere on the screen (GameBoard's touch gesture), so this only
// keeps the start/pause toggle, centered at the bottom. Only rendered on touch
// devices (coarse pointer); desktop users keep the keyboard (P).

import { useEffect, useState } from "react";
import type { Game } from "../game/game";
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

  return (
    <div className="touch-controls" aria-label="controles">
      <button
        className="pause-btn"
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
    </div>
  );
}
