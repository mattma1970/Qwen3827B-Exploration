// Headless unit tests for the camera helpers (src/game/camera.ts). Everything
// in that module is DOM-guarded at call time, so we stub the bare globals it
// touches (navigator / document.createElement("canvas")) under node env.
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureFrame, isCameraSupported } from "../src/game/camera";
import { noopCtx } from "./helpers";

interface CanvasCapture {
  cv?: { width: number; height: number };
}

function stubDocument(captured: CanvasCapture, ctx: CanvasRenderingContext2D | null): void {
  vi.stubGlobal("document", {
    createElement(_tag: string) {
      const cv = {
        width: 0,
        height: 0,
        getContext() {
          return ctx;
        },
        toDataURL(type: string) {
          return "data:" + type + ";base64,STUB";
        },
      };
      captured.cv = cv;
      return cv;
    },
  });
}

function makeVideo(w: number, h: number): HTMLVideoElement {
  return { videoWidth: w, videoHeight: h } as unknown as HTMLVideoElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isCameraSupported", () => {
  it("false when navigator has no mediaDevices (node default)", () => {
    vi.stubGlobal("navigator", {});
    expect(isCameraSupported()).toBe(false);
  });

  it("false when navigator itself is missing", () => {
    vi.stubGlobal("navigator", undefined);
    expect(isCameraSupported()).toBe(false);
  });

  it("false when mediaDevices exists but getUserMedia is not a function", () => {
    vi.stubGlobal("navigator", { mediaDevices: {} });
    expect(isCameraSupported()).toBe(false);
  });

  it("true when getUserMedia is a function", () => {
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: () => Promise.resolve(null) },
    });
    expect(isCameraSupported()).toBe(true);
  });
});

describe("captureFrame", () => {
  it("returns a PNG data URL", () => {
    const cap: CanvasCapture = {};
    stubDocument(cap, noopCtx() as CanvasRenderingContext2D);
    expect(captureFrame(makeVideo(640, 480))).toBe("data:image/png;base64,STUB");
  });

  it("downscales to maxDim on the long edge (1920x1080 -> 1024x576)", () => {
    const cap: CanvasCapture = {};
    stubDocument(cap, noopCtx() as CanvasRenderingContext2D);
    captureFrame(makeVideo(1920, 1080));
    expect(cap.cv?.width).toBe(1024);
    expect(cap.cv?.height).toBe(576);
  });

  it("honors a custom maxDim (1920x1080 @512 -> 512x288)", () => {
    const cap: CanvasCapture = {};
    stubDocument(cap, noopCtx() as CanvasRenderingContext2D);
    captureFrame(makeVideo(1920, 1080), 512);
    expect(cap.cv?.width).toBe(512);
    expect(cap.cv?.height).toBe(288);
  });

  it("never upscales small frames (320x240 stays 320x240)", () => {
    const cap: CanvasCapture = {};
    stubDocument(cap, noopCtx() as CanvasRenderingContext2D);
    captureFrame(makeVideo(320, 240));
    expect(cap.cv?.width).toBe(320);
    expect(cap.cv?.height).toBe(240);
  });

  it("portrait dimensions are handled symmetrically (1080x1920 -> 576x1024)", () => {
    const cap: CanvasCapture = {};
    stubDocument(cap, noopCtx() as CanvasRenderingContext2D);
    captureFrame(makeVideo(1080, 1920));
    expect(cap.cv?.width).toBe(576);
    expect(cap.cv?.height).toBe(1024);
  });

  it("mirror=true (front-camera selfie) still returns a same-size PNG data URL", () => {
    const cap: CanvasCapture = {};
    stubDocument(cap, noopCtx() as CanvasRenderingContext2D);
    expect(captureFrame(makeVideo(1920, 1080), 1024, true)).toBe("data:image/png;base64,STUB");
    expect(cap.cv?.width).toBe(1024);
    expect(cap.cv?.height).toBe(576);
  });

  it("returns null when the video has no frame yet (0x0)", () => {
    const cap: CanvasCapture = {};
    stubDocument(cap, noopCtx() as CanvasRenderingContext2D);
    expect(captureFrame(makeVideo(0, 0))).toBeNull();
    // no canvas should even have been created
    expect(cap.cv).toBeUndefined();
  });

  it("returns null when no 2d context is available", () => {
    const cap: CanvasCapture = {};
    stubDocument(cap, null);
    expect(captureFrame(makeVideo(640, 480))).toBeNull();
  });
});
