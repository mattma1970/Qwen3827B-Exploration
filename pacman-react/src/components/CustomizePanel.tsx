// PERU MAN (React) - the photo-to-sprite customize panel.
// React port of pacman/js/customize.js: 6 drop zones (Pacman, 4 named turkeys,
// pill), live 64px previews, drag-drop + file-picker (mobile) per zone,
// drop-anywhere-on-canvas to the last-used slot, clear/reset, live usage meter
// and toasts. Opened with C or the on-screen button; auto-pauses the game.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game } from "../game/game";
import { TURKEYS } from "../game/config";
import { drawCanvaPill, drawPlayer, drawTurkey } from "../game/sprites";
import { SpriteData, allSlots, spriteUsage, SPRITE_QUOTA } from "../game/photoSlots";
import { assignPhoto, clearPhoto } from "../game/photo";
import { AudioFX } from "../game/audio";
import CameraCapture from "./CameraCapture";

function slotList(): string[] {
  return allSlots();
}

function slotLabel(slot: string): string {
  if (slot === "player") return "PACMAN";
  if (slot === "pill") return "PÍLULA";
  return slot.toUpperCase();
}

function isImageFile(f: File | null | undefined): f is File {
  return !!(f && typeof f.type === "string" && f.type.indexOf("image") === 0);
}

function fmtBytes(n: number): string {
  return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.ceil(n / 1024) + " kB";
}

function turkeyColor(slot: string): string {
  let col = "#e63946";
  for (const d of TURKEYS) if (d.name === slot) {
    col = d.color;
    break;
  }
  return col;
}

interface PanelProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  game: Game | null;
  // on phones the top-left hamburger replaces the in-flow "Personalizar"
  // button (which the fixed on-screen DPad would overlap)
  mobile?: boolean;
  // the panel decides where drop-anywhere-on-canvas goes (the last-used slot),
  // so it registers its canvas-drop handler up top
  registerDropHandler: (h: (f: File | null) => void) => void;
  // the C hotkey (handled on the board) must go through the panel's
  // pause-aware toggle, so it is registered too
  registerToggle: (fn: () => void) => void;
}

function drawPrev(slot: string, ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, 64, 64);
  if (slot === "player") drawPlayer(ctx, 32, 32, 22, 0.35, "right");
  else if (slot === "pill") drawCanvaPill(ctx, 32, 32, 18, 0.5);
  else drawTurkey(ctx, 32, 32, 20, turkeyColor(slot), { name: slot });
}

function SlotZone({
  slot,
  version,
  onAssign,
  onClear,
  onCamera,
}: {
  slot: string;
  version: number;
  onAssign: (slot: string, f: File) => void;
  onClear: (slot: string) => void;
  onCamera: (slot: string) => void;
}) {
  const prevRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);
  const assigned = !!SpriteData[slot];

  useEffect(() => {
    const cv = prevRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (ctx) drawPrev(slot, ctx);
  }, [slot, version, assigned]);

  const file = (f: File | null | undefined) => {
    if (f) onAssign(slot, f);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div
      className={"slot-zone" + (drag ? " drag" : "") + (assigned ? " filled" : "")}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        file(e.dataTransfer?.files?.[0]);
      }}
      onClick={() => fileRef.current?.click()}
    >
      <canvas ref={prevRef} className="slot-prev" width={64} height={64} />
      <div className="slot-name">{slotLabel(slot)}</div>
      <div className="slot-status">{assigned ? "personalizada" : "padrão"}</div>
      <div className="slot-btns">
        <button
          className="slot-cam"
          title="tirar foto com a câmera"
          onClick={(e) => {
            e.stopPropagation();
            onCamera(slot);
          }}
        >
          foto
        </button>
        <button
          className="slot-clear"
          onClick={(e) => {
            e.stopPropagation();
            onClear(slot);
          }}
        >
          limpar
        </button>
      </div>
      <input
        ref={fileRef}
        className="slot-file"
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          file(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function CustomizePanel({ open, setOpen, game, mobile = false, registerDropHandler, registerToggle }: PanelProps) {
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: "", show: false });
  const [version, setVersion] = useState(0);
  const [lastUsed, setLastUsed] = useState("player");
  // slot the camera overlay is capturing for (null = camera closed)
  const [cameraSlot, setCameraSlot] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const pausedByPanel = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast({ msg, show: true });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast((t) => ({ ...t, show: false })), 2400);
  }, []);

  const bump = () => setVersion((n) => n + 1);

  const setPanel = useCallback(
    (v: boolean) => {
      setOpen(v);
      if (v) {
        if (game && !game.paused && (game.state === "play" || game.state === "ready")) {
          game.togglePause();
          pausedByPanel.current = true;
        }
      } else if (pausedByPanel.current && game) {
        game.togglePause();
        pausedByPanel.current = false;
      }
    },
    [game, setOpen]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // while the camera overlay is open, its own Escape handler closes it
      if (e.code === "Escape" && open && !cameraSlot) setPanel(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setPanel, cameraSlot]);

  // register the C-toggle (freshest closure on every render)
  const openRef = useRef(open);
  openRef.current = open;
  const setPanelRef = useRef(setPanel);
  setPanelRef.current = setPanel;
  useEffect(() => {
    registerToggle(() => setPanelRef.current(!openRef.current));
  });

  const handleAssign = (slot: string, f: File) => {
    if (!isImageFile(f)) {
      showToast("só imagens, por favor");
      return;
    }
    assignPhoto(slot, f).then(
      (name) => {
        setLastUsed(name);
        bump();
        showToast("foto aplicada em " + slotLabel(name));
      },
      (err: unknown) => {
        showToast(String(err).indexOf("quota") > -1 ? "armazenamento cheio \u2014 foto muito grande" : "n\u00e3o deu para ler essa imagem");
      }
    );
  };

  const handleCanvasDrop = (f: File | null) => {
    if (!f) return;
    handleAssign(lastUsed, f);
  };
  // (re)register the canvas-drop handler after every render so it always sees
  // the freshest lastUsedSlot closure
  useEffect(() => {
    registerDropHandler(handleCanvasDrop);
  });

  // captured camera frame arrives as a PNG data URL: close the overlay (which
  // stops the camera stream) and feed it through the same pipeline as a file
  const handleCapture = (slot: string, dataUrl: string) => {
    setCameraSlot(null);
    assignPhoto(slot, dataUrl).then(
      (name) => {
        setLastUsed(name);
        bump();
        showToast("foto aplicada em " + slotLabel(name));
      },
      (err: unknown) => {
        showToast(
          String(err).indexOf("quota") > -1
            ? "armazenamento cheio — foto muito grande"
            : "não deu para usar essa foto"
        );
      }
    );
  };

  const handleClear = (slot: string) => {
    clearPhoto(slot);
    bump();
    showToast(slotLabel(slot) + " de volta ao padrão");
  };

  const handleReset = () => {
    for (const s of slotList()) clearPhoto(s);
    setLastUsed("player");
    bump();
    showToast("todos os slots restaurados");
  };

  return (
    <>
      {!mobile && (
        <button
          className="custom-btn"
          onClick={(e) => {
            e.preventDefault();
            AudioFX.ensure();
            setPanel(!open);
          }}
        >
          Personalizar (C)
        </button>
      )}

      {open && (
        <div className="customize-panel">
          <div className="cp-head">
            <h2>PERSONALIZAR</h2>
            <button className="cp-close" onClick={(e) => { e.preventDefault(); setPanel(false); }}>
              ×
            </button>
          </div>
          <div className="cp-sub">solte uma foto em cada slot — ou clique para escolher</div>
          <div className="cp-grid">
            {slotList().map((slot) => (
              <SlotZone
                key={slot}
                slot={slot}
                version={version}
                onAssign={handleAssign}
                onClear={handleClear}
                onCamera={(s) => setCameraSlot(s)}
              />
            ))}
          </div>
          <div className="cp-foot">
            <div className="cp-usage">
              usando {fmtBytes(spriteUsage())} de {fmtBytes(SPRITE_QUOTA)}
            </div>
            <button className="cp-reset" onClick={handleReset}>
              restaurar padrões
            </button>
          </div>
        </div>
      )}

      {cameraSlot && (
        <CameraCapture
          slotLabel={slotLabel(cameraSlot)}
          onApply={(url) => handleCapture(cameraSlot, url)}
          onClose={() => setCameraSlot(null)}
        />
      )}

      <div className={"toast" + (toast.show ? " show" : "")}>{toast.msg}</div>
    </>
  );
}
