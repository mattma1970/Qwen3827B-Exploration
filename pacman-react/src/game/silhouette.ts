// PERU MAN - recorte de silhueta (background removal) via @imgly/background-removal.
// Lazy: the ONNX/WASM segmentation model (dozens of MB, downloaded once and
// cached by the browser) loads ONLY when the user's first cutout (or the panel
// preload) runs, via a dynamic import — so the game bundle and the headless
// test suite never pay for it.
// Contract: resolves a transparent PNG Blob on success or null on ANY failure
// (headless, module load, download or inference error) so callers fall back to
// the uncut square. License: @imgly/background-removal is AGPL-3.0 (README).

export type CutoutSource = string | Blob | File;
export type ModelName = "isnet" | "isnet_fp16" | "isnet_quint8";
export type ProgressFn = (key: string, cur: number, total: number) => void;

export interface CutoutOpts {
  model?: ModelName;
  progress?: ProgressFn;
}

interface BgRemovalApi {
  removeBackground?: (img: unknown, cfg?: unknown) => Promise<Blob> | Blob;
  default?: (img: unknown, cfg?: unknown) => Promise<Blob> | Blob;
  preload?: (cfg?: unknown) => Promise<void>;
}

// Smallest model: fastest download + CPU inference on phones; quality is fine
// at sprite scale (the result gets posterized/quantized right after).
const DEFAULT_MODEL: ModelName = "isnet_quint8";

async function loadApi(): Promise<BgRemovalApi | null> {
  try {
    if (typeof window === "undefined") return null;
    const mod = (await import("@imgly/background-removal")) as unknown as BgRemovalApi;
    return mod || null;
  } catch (e) {
    return null;
  }
}

// Cut the background out of a photo: resolves a transparent PNG Blob, or null.
export async function cutout(source: CutoutSource, opts?: CutoutOpts): Promise<Blob | null> {
  if (!source) return null;
  const o = opts || {};
  const api = await loadApi();
  const fn = api && (api.removeBackground || api.default);
  if (typeof fn !== "function") return null;
  try {
    const cfg: Record<string, unknown> = {
      model: o.model || DEFAULT_MODEL,
      output: { format: "image/png" },
    };
    if (o.progress) cfg.progress = o.progress;
    const blob = await Promise.resolve(fn(source, cfg));
    if (blob && blob.size > 0) return blob;
    return null;
  } catch (e) {
    return null;
  }
}

export interface PreloadOpts {
  model?: ModelName;
  // download/inference progress (same shape as CutoutOpts.progress) — lets a
  // caller show "downloading the cutout model…" during the first-time fetch
  progress?: ProgressFn;
}

// Pre-fetch the model so the first cutout is fast. Safe to call repeatedly and
// to ignore (fire-and-forget); headless/no-op when the module can't load.
export async function preloadCutout(opts?: PreloadOpts): Promise<void> {
  const api = await loadApi();
  const fn = api && api.preload;
  if (typeof fn !== "function") return;
  try {
    const cfg: Record<string, unknown> = { model: opts?.model || DEFAULT_MODEL };
    if (opts?.progress) cfg.progress = opts.progress;
    await fn(cfg);
  } catch (e) {}
}
