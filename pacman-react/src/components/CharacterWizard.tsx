// PERU MAN (React) - character-design wizard. Two steps:
//   1 "foto"       — take a photo (camera) or pick one from the gallery
//   2 "personagem" — design step: silhueta cutout toggle, base character
//                    (classic Pac-Man / classic ghost / só recorte), base
//                    color, and a live 256px preview. The cutout (lazy ONNX
//                    model) + emoji-ify run HERE, with progress; on apply the
//                    processed source + design are handed to the panel, which
//                    does assignPhoto + persists the design. The photo can be
//                    pressed-and-dragged on the preview to shift its position
//                    on the character (persisted as CharDesign.dx/dy).
// Extensible: a future effect (e.g. "cartoonize") = one more toggle + its
// pipeline step here + one field in game/character.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { PLAYER_RIDER_SCALE, characterBasePath, drawCharacterBase } from "../game/sprites";
import { SourceImage, imageToSprite } from "../game/photo";
import { cutout } from "../game/silhouette";
import { CHARS, CHAR_COLORS, CHAR_OFFSET_MAX, CharDesign, OUTLINE_RADIUS } from "../game/character";
import CameraCapture from "./CameraCapture";

const PREV_SIZE = 256;
const PREV_R = 96;

interface Props {
  slot: string;
  slotLabel: string;
  photo: SourceImage | null; // null => start on step 1 (camera)
  initial: CharDesign; // the slot's current design (pre-fills the step 2)
  onApply: (src: SourceImage, d: CharDesign) => void;
  onCancel: () => void;
}

function BaseThumb({ id, label, color, active, onClick }: { id: string; label: string; color: string; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const c = cv.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, 56, 56);
    c.save();
    c.translate(28, 28);
    if (id === "none") {
      c.strokeStyle = "#8f96d9";
      c.setLineDash([4, 4]);
      c.beginPath();
      c.arc(0, 0, 17, 0, Math.PI * 2);
      c.stroke();
    } else {
      drawCharacterBase(c, id, color, 18, { facing: "right", mouth: 0.55 });
    }
    c.restore();
  }, [id, color]);
  return (
    <button type="button" className={"wiz-base" + (active ? " active" : "")} onClick={onClick} title={label}>
      <canvas ref={ref} width={56} height={56} />
      <span>{label}</span>
    </button>
  );
}

export default function CharacterWizard({ slot, slotLabel, photo, initial, onApply, onCancel }: Props) {
  const [step, setStep] = useState<"foto" | "design">(photo ? "design" : "foto");
  const [shot, setShot] = useState<SourceImage | null>(photo);
  const [d, setD] = useState<CharDesign>(initial);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const cutoutRef = useRef<Blob | null>(null); // cached: flipping silhueta back on re-cuts nothing
  const lastSrcRef = useRef<SourceImage | null>(null); // the source the preview was built from
  const jobRef = useRef(0);
  const prevRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // press-and-drag photo repositioning: the gesture start (client xy + the
  // offset at that moment) so a move is always start + full delta (no drift)
  const dragRef = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);

  // cutout (if wanted) -> emoji-ify with the sticker ring (if cut). Re-runs
  // only when the photo or the silhueta choice changes; base/color are render-only.
  const process = useCallback((src: SourceImage | null, silhueta: boolean) => {
    if (!src) return;
    const job = ++jobRef.current;
    setFailed(false);
    setBusy("processando…");
    const finish = (s: SourceImage) => {
      imageToSprite(s, { outline: silhueta ? OUTLINE_RADIUS : 0 }).then(
        (im) => {
          if (job === jobRef.current) {
            lastSrcRef.current = s;
            setImg(im);
            setBusy(null);
          }
        },
        () => {
          if (job === jobRef.current) {
            setImg(null);
            setFailed(true);
            setBusy(null);
          }
        }
      );
    };
    if (!silhueta) {
      finish(src);
      return;
    }
    if (cutoutRef.current) {
      finish(cutoutRef.current);
      return;
    }
    cutout(src as string | Blob | File, {
      progress: (_key, cur, total) => {
        if (job === jobRef.current && total > 0) setBusy("recortando silhueta… " + Math.min(100, Math.round((cur / total) * 100)) + "%");
      },
    }).then((b) => {
      if (job !== jobRef.current) return;
      if (b) {
        cutoutRef.current = b;
        finish(b);
      } else {
        setBusy("sem silhueta (sem rede?) — usando a foto inteira");
        window.setTimeout(() => {
          if (job === jobRef.current) setBusy(null);
        }, 1500);
        finish(src);
      }
    });
  }, []);

  useEffect(() => {
    if (step === "design" && shot) process(shot, d.silhueta);
  }, [step, shot, d.silhueta, process]);

  // live preview: base character + the processed photo riding it
  useEffect(() => {
    const cv = prevRef.current;
    if (!cv || step !== "design") return;
    const c = cv.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, PREV_SIZE, PREV_SIZE);
    c.save();
    c.translate(PREV_SIZE / 2, PREV_SIZE / 2 + 6);
    const bo = { facing: "right" as const, mouth: 0.55 };
    drawCharacterBase(c, d.base, d.color, PREV_R, bo);
    if (img) {
      const s = PREV_R * PLAYER_RIDER_SCALE;
      c.save();
      if (characterBasePath(c, d.base, PREV_R, bo)) c.clip();
      c.drawImage(img, d.dx * PREV_R - s, d.dy * PREV_R - s, s * 2, s * 2);
      c.restore();
    }
    c.restore();
  }, [step, d, img]);

  // Press-and-drag on the preview shifts the photo (in base-radius units).
  // The scale maps client px -> canvas px -> base units so the feel is the
  // same no matter how the 256px canvas is CSS-scaled.
  const onDragStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, dx: d.dx, dy: d.dy };
  };
  const onDragMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const cv = prevRef.current;
    if (!drag || !cv) return;
    const rect = cv.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const kx = PREV_SIZE / rect.width / PREV_R;
    const ky = PREV_SIZE / rect.height / PREV_R;
    const ndx = Math.max(-CHAR_OFFSET_MAX, Math.min(CHAR_OFFSET_MAX, drag.dx + (e.clientX - drag.x) * kx));
    const ndy = Math.max(-CHAR_OFFSET_MAX, Math.min(CHAR_OFFSET_MAX, drag.dy + (e.clientY - drag.y) * ky));
    setD((prev) => (prev.dx === ndx && prev.dy === ndy ? prev : { ...prev, dx: ndx, dy: ndy }));
  };
  const onDragEnd = () => {
    dragRef.current = null;
  };

  // Escape on the design step closes the wizard (the camera step has its own)
  useEffect(() => {
    if (step !== "design") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onCancel]);

  const apply = () => {
    if (step !== "design" || failed || !img || !shot) return;
    onApply(lastSrcRef.current ?? shot, d);
  };

  const filePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (f) {
      setShot(f);
      setStep("design");
    }
  };

  if (step === "foto") {
    return (
      <>
        <CameraCapture
          slotLabel={slotLabel}
          onApply={(url) => {
            setShot(url);
            setStep("design");
          }}
          onClose={() => (shot ? setStep("design") : onCancel())}
          onGallery={() => fileRef.current?.click()}
        />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={filePick} />
      </>
    );
  }

  return (
    <div className="wiz-overlay" role="dialog" aria-label={"personagem " + slotLabel}>
      <div className="wiz-card" data-slot={slot}>
        <div className="wiz-head">
          <h2>PERSONAGEM — {slotLabel}</h2>
          <button className="cp-close" onClick={onCancel} aria-label="fechar">
            ×
          </button>
        </div>
        <canvas
          ref={prevRef}
          className="wiz-prev"
          width={PREV_SIZE}
          height={PREV_SIZE}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        />
        <div className="wiz-hint">
          {d.dx !== 0 || d.dy !== 0 ? (
            <button type="button" className="wiz-recenter" onClick={() => setD({ ...d, dx: 0, dy: 0 })}>
              recentrar foto
            </button>
          ) : (
            "arraste a foto para posicionar no personagem"
          )}
        </div>
        {busy && <div className="wiz-status">{busy}</div>}
        <label className="wiz-opt" title="recorta o fundo da foto no aparelho e desenha um contorno de sticker">
          <input type="checkbox" checked={d.silhueta} onChange={(e) => setD({ ...d, silhueta: e.target.checked })} />
          <span>recorte de silhueta</span>
        </label>
        <div className="wiz-row">
          {CHARS.map((c) => (
            <BaseThumb key={c.id} id={c.id} label={c.label} color={d.color} active={d.base === c.id} onClick={() => setD({ ...d, base: c.id })} />
          ))}
        </div>
        <div className="wiz-colors">
          {CHAR_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              className={"wiz-swatch" + (d.color === hex ? " active" : "")}
              style={{ background: hex }}
              title={hex}
              onClick={() => setD({ ...d, color: hex })}
            />
          ))}
        </div>
        <div className="wiz-actions">
          <button className="wiz-btn" onClick={() => setStep("foto")}>
            refazer foto
          </button>
          <button className="wiz-btn" onClick={onCancel}>
            cancelar
          </button>
          <button className="wiz-btn apply" onClick={apply} disabled={failed || !img || !!busy}>
            aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
