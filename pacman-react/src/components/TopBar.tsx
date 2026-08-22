// PERU MAN (React) - mobile top banner. The hamburger (left) opens the
// personalize panel; the play/pause button (right) starts a match on the title
// screen and pauses/resumes mid-play. Steering is a screen swipe (GameBoard),
// so this banner is the only on-screen control, and it lives UP in the corner
// banner instead of over the board so swiping is unobstructed.

import { useEffect, useState } from "react";
import type { Game } from "../game/game";
import { AudioFX } from "../game/audio";

interface Props {
  game: Game | null;
  onMenu: () => void;
}

export default function TopBar({ game, onMenu }: Props) {
  const [, force] = useState(0);
  // re-render on a slow tick so the ▶ / ❚❚ label tracks the paused flag (there
  // is no engine event bus; this mirrors the old TouchControls polling)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 300);
    return () => clearInterval(id);
  }, []);

  const active = !!game && (game.paused || game.state === "play" || game.state === "ready");

  const onPlay = () => {
    if (!game) return;
    AudioFX.ensure();
    if (game.state === "title" || (game.state === "gameover" && game.stateT > 1)) game.primaryAction();
    else game.togglePause();
  };

  return (
    <header className="topbar">
      <button className="topbar-btn" aria-label="menu" onClick={onMenu}>
        &#9776;
      </button>
      <span className="topbar-brand">
        PERU&nbsp;MAN<span className="topbar-badge">react</span>
      </span>
      <button className="topbar-btn" aria-label="pausa / começar" onPointerDown={(e) => {
        e.preventDefault();
        onPlay();
      }}>
        {active ? "❚❚" : "▶"}
      </button>
    </header>
  );
}
