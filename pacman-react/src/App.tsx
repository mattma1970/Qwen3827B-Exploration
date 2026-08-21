// PERU MAN (React) - app shell: game board + touch controls + customize panel.

import { useEffect, useRef, useState } from "react";
import GameBoard from "./components/GameBoard";
import TouchControls from "./components/TouchControls";
import CustomizePanel from "./components/CustomizePanel";
import type { Game } from "./game/game";
import { restoreSprites } from "./game/photo";

export default function App() {
  const [game, setGame] = useState<Game | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Re-hydrate custom photo sprites from localStorage on boot so they survive
  // reloads (the vanilla photo.js did this at module load; React does it once
  // on mount).
  useEffect(() => {
    restoreSprites();
  }, []);

  // late-bound handlers: the customize panel registers its drop-anywhere and
  // C-toggle closures (which hold the last-used slot + pause state)
  const dropHandler = useRef<((f: File | null) => void) | null>(null);
  const toggleHandler = useRef<(() => void) | null>(null);

  return (
    <main className="wrap">
      <h1 className="logo">
        PERU&nbsp;MAN
      </h1>
      <GameBoard
        onGame={setGame}
        onToggleCustomize={() => toggleHandler.current?.()}
        onCanvasDrop={(f) => dropHandler.current?.(f)}
      />
      <p className="hint">
        Setas / WASD move &middot; P pausa &middot; M som &middot; Enter come&ccedil;a
        <br />
        no celular: deslize no tabuleiro ou use o direcional
        <br />
        Pilulas de poder: Canva &middot; Ghosts: 4 perus
        <br />
        C personaliza &middot; solte uma foto num slot (no tabuleiro, vai pro &uacute;ltimo usado)
      </p>
      <CustomizePanel
        open={customizeOpen}
        setOpen={setCustomizeOpen}
        game={game}
        registerDropHandler={(h) => {
          dropHandler.current = h;
        }}
        registerToggle={(fn) => {
          toggleHandler.current = fn;
        }}
      />
      <TouchControls game={game} />
    </main>
  );
}
