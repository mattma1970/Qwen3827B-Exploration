// PERU MAN - camera capture helpers. Thin DOM wrappers around
// navigator.mediaDevices.getUserMedia: nothing here runs at import time, so the
// module stays safe to import in headless (node/vitest) environments.
//
// The captured frame flows back as a PNG data URL and is fed into the same
// imageToSprite/assignPhoto pipeline as a dropped photo file (see photo.ts).

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

// Draw the current video frame into a downscaled canvas and return it as a PNG
// data URL. Downscaling keeps the data-URL small before it hits the sprite
// pipeline (which cover-crops to 256x256 anyway). Returns null when
// the video has no frame yet (width/height are 0).
export function captureFrame(video: HTMLVideoElement, maxDim = 1024): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const scale = Math.min(1, maxDim / Math.max(vw, vh));
  const w = Math.max(1, Math.round(vw * scale));
  const h = Math.max(1, Math.round(vh * scale));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return cv.toDataURL("image/png");
}
