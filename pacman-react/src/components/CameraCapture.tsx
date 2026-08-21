// PERU MAN (React) - camera capture overlay. Opens getUserMedia (rear camera
// preferred on phones), shows the live feed, and hands the captured frame back
// to the panel as a PNG data URL. All error paths (denied / unavailable /
// insecure context) surface a message and fall back to the file picker.

import { useEffect, useRef, useState } from "react";
import { captureFrame, isCameraSupported } from "../game/camera";

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

  useEffect(() => {
    let stopped = false;
    if (!window.isSecureContext) {
      setErr("a câmera precisa de https (ou localhost) — use a galeria (clique no slot)");
      return;
    }
    if (!isCameraSupported()) {
      setErr("câmera indisponível neste navegador — use a galeria (clique no slot)");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
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
  }, []);

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

  const shoot = () => {
    const v = videoRef.current;
    if (!v) return;
    const url = captureFrame(v);
    if (url) onApply(url);
  };

  return (
    <div className="cam-overlay" role="dialog" aria-label="câmera">
      <div className="cam-title">
        <span>FOTO — {slotLabel}</span>
        <button className="cam-x" onClick={onClose} aria-label="fechar">
          ×
        </button>
      </div>
      <div className="cam-stage">
        <video ref={videoRef} className="cam-video" muted playsInline autoPlay />
        {!err && !ready && <div className="cam-loading">abrindo câmera…</div>}
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
