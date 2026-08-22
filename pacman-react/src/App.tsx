// PERU MAN (React) - app shell: game board + touch controls + customize panel.

import { useEffect, useRef, useState } from "react";
import GameBoard from "./components/GameBoard";
import TouchControls from "./components/TouchControls";
import CustomizePanel from "./components/CustomizePanel";
import type { Game } from "./game/game";
import { AudioFX } from "./game/audio";
import { restoreSprites } from "./game/photo";

// Mobile UI switch: viewport-based (kept in sync with the @media 720px rules
// in style.css). Drives the hamburger menu layout on phones.
function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 720px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

export default function App() {
  const [game, setGame] = useState<Game | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const isMobile = useIsMobile();

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

  // top-left hamburger on phones: opens the personalize panel (same toggle as
  // the C hotkey, so it auto-pauses) and replaces the in-flow "Personalizar"
  // button, which the fixed on-screen DPad would sit on top of.
  const openMenu = () => {
    AudioFX.ensure();
    toggleHandler.current?.();
  };

  return (
    <main className="wrap">
      {isMobile && (
        <button className="menu-btn" aria-label="menu" onClick={openMenu}>
          &#9776;
        </button>
      )}
      <h1 className="logo">
        PERU&nbsp;MAN
        <span className="ver-badge" title="React + TypeScript build">react</span>
      </h1>
      <GameBoard
        onGame={setGame}
        onToggleCustomize={() => toggleHandler.current?.()}
        onCanvasDrop={(f) => dropHandler.current?.(f)}
      />
      <p className="hint">
        {isMobile ? (
          <>
            deslize o dedo na tela para mover &middot; parado n&atilde;o vira
            <br />
            <span className="menu" role="button" onClick={openMenu}>
              &#9776;
            </span>{" "}
            personaliza &middot; toque num slot e escolha uma foto
            <br />
            Pilulas de poder: Canva &middot; Ghosts: 4 perus
          </>
        ) : (
          <>
            Setas / WASD move &middot; P pausa &middot; M som &middot; Enter come&ccedil;a
            <br />
            no celular: deslize o dedo na tela para mover
            <br />
            Pilulas de poder: Canva &middot; Ghosts: 4 perus
            <br />
            C personaliza &middot; solte uma foto num slot (no tabuleiro, vai pro &uacute;ltimo usado)
          </>
        )}
      </p>
      <CustomizePanel
        open={customizeOpen}
        setOpen={setCustomizeOpen}
        game={game}
        mobile={isMobile}
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
