// PERU MAN (React) - camera capture overlay. Opens getUserMedia (rear camera
// by default on phones, with a flip button to the front camera for selfies),
// shows the live feed, and hands the captured frame back to the panel as a PNG
// data URL. All error paths (denied / unavailable / insecure context) surface
// a message and fall back to the file picker.

import { useEffect, useRef, useState } from "react";
import { captureFrame, isCameraSupported } from "../game/camera";

type Facing = "environment" | "user";

interface Props {
  slotLabel: string;
  onApply: (dataUrl: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ slotLabel, onApply, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // which camera feed is live: rear by default, flip to front for a selfie.
  // The flip re-requests getUserMedia with the other facingMode (a bare string
  // is "ideal" semantics per spec, so single-camera devices just re-open the
  // same camera instead of erroring).
  const [facing, setFacing] = useState<Facing>("environment");

  useEffect(() => {
    let stopped = false;
    setReady(false);
    if (!window.isSecureContext) {
      setErr("a câmera precisa de https (ou localhost) — use a galeria (clique no slot)");
      return;
    }
    if (!isCameraSupported()) {
      setErr("câmera indisponível neste navegador — use a galeria (clique no slot)");
      return;
    }
    setErr(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((stream) => {
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        v.play()
          .then(() => setReady(true))
          .catch(() => {});
      })
      .catch((e: unknown) => {
        const name = (e as { name?: string } | null)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          setErr("câmera bloqueada — permita o acesso no navegador ou use a galeria (clique no slot)");
        } else {
          setErr("não foi possível abrir a câmera — use a galeria (clique no slot)");
        }
      });
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facing]);

  // Escape closes the camera (the panel's own Escape is suppressed while open)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const flip = () => setFacing((f) => (f === "environment" ? "user" : "environment"));

  const shoot = () => {
    const v = videoRef.current;
    if (!v) return;
    // front camera: mirror the frame so the sprite matches the on-screen preview
    const url = captureFrame(v, 1024, facing === "user");
    if (url) onApply(url);
  };

  return (
    <div className="cam-overlay" role="dialog" aria-label="câmera">
      <div className="cam-title">
        <span>
          FOTO — {slotLabel} · {facing === "user" ? "FRENTE" : "COSTAS"}
        </span>
        <button className="cam-x" onClick={onClose} aria-label="fechar">
          ×
        </button>
      </div>
      <div className="cam-stage">
        <video
          ref={videoRef}
          className={"cam-video" + (facing === "user" ? " mirror" : "")}
          muted
          playsInline
          autoPlay
        />
        {!err && !ready && <div className="cam-loading">abrindo câmera…</div>}
        {!err && (
          <button
            className="cam-flip"
            onClick={flip}
            title="trocar câmera (frente/costas)"
            aria-label="trocar câmera"
          >
            ⇄
          </button>
        )}
      </div>
      {err && <div className="cam-error">{err}</div>}
      <div className="cam-actions">
        <button className="cam-btn" onClick={onClose}>
          cancelar
        </button>
        <button className="cam-btn shoot" onClick={shoot} disabled={!ready || !!err}>
          capturar
        </button>
      </div>
    </div>
  );
}
