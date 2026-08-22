// PERU MAN (React) - app shell: game board + mobile top banner + swipe pad +
// customize panel. Desktop keeps an in-flow logo + the controls hint; mobile puts
// the play/pause button in the top corner banner (clear of the board), adds a
// bordered "swipe pad" under the board, and shows the controls as a retro splash
// box over the board (gone once the match starts or the panel opens).

import { useEffect, useRef, useState } from "react";
import GameBoard from "./components/GameBoard";
import TopBar from "./components/TopBar";
import CustomizePanel from "./components/CustomizePanel";
import type { Game } from "./game/game";
import { AudioFX } from "./game/audio";
import { restoreSprites } from "./game/photo";
import { restoreCharDesigns } from "./game/character";

// Mobile UI switch: viewport-based (kept in sync with the @media 720px rules
// in style.css). Drives the top-banner layout on phones.
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
    restoreCharDesigns();
  }, []);

  // late-bound handlers: the customize panel registers its drop-anywhere and
  // C-toggle closures (which hold the last-used slot + pause state)
  const dropHandler = useRef<((f: File | null) => void) | null>(null);
  const toggleHandler = useRef<(() => void) | null>(null);

  // top-left hamburger on phones: opens the personalize panel (same toggle as
  // the C hotkey, so it auto-pauses) and replaces the in-flow "Personalizar"
  // button, which a fixed on-screen control would sit on top of.
  const openMenu = () => {
    AudioFX.ensure();
    toggleHandler.current?.();
  };

  // the retro instructions splash: shown on the title screen, gone once the
  // match starts (state leaves "title") or the personalize panel opens
  const [atTitle, setAtTitle] = useState(true);
  useEffect(() => {
    if (!game) return;
    const tick = () => setAtTitle(game.state === "title" && !game.paused);
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [game]);

  const splash =
    isMobile && atTitle && !customizeOpen ? (
      <div className="splash">
        <div className="splash-box">
          <div className="splash-title">COMO JOGAR</div>
          <ul className="splash-lines">
            <li>deslize o dedo para mover o Pacman</li>
            <li>parado, ele n&atilde;o vira de dire&ccedil;&atilde;o</li>
            <li>&#9776; personaliza &middot; toque num slot e escolha uma foto</li>
            <li>P&iacute;lulas de poder: Canva &middot; Ghosts: 4 perus</li>
          </ul>
          <div className="splash-start">toque para come&ccedil;ar <span aria-hidden="true">▮</span></div>
        </div>
      </div>
    ) : null;

  return (
    <main className="wrap">
      {isMobile && <TopBar game={game} onMenu={openMenu} />}
      {!isMobile && (
        <h1 className="logo">
          PERU&nbsp;MAN
          <span className="ver-badge" title="React + TypeScript build">react</span>
        </h1>
      )}
      <GameBoard
        onGame={setGame}
        onToggleCustomize={() => toggleHandler.current?.()}
        onCanvasDrop={(f) => dropHandler.current?.(f)}
        overlay={splash}
      />
      {isMobile ? (
        <div className="swipe-pad" aria-hidden="true">
          <span className="swipe-pad-hint">deslize aqui para mover</span>
        </div>
      ) : (
        <p className="hint">
          Setas / WASD move &middot; P pausa &middot; M som &middot; Enter come&ccedil;a
          <br />
          no celular: deslize o dedo na tela para mover
          <br />
          Pilulas de poder: Canva &middot; Ghosts: 4 perus
          <br />
          C personaliza &middot; solte uma foto num slot (no tabuleiro, vai pro &uacute;ltimo usado)
        </p>
      )}
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
    </main>
  );
}
