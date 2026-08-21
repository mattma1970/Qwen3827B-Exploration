// Shared test stubs.
//
// noopCtx: a full no-op 2D-context stand-in for the game render path. Every
// method is a no-op; gradient factories return a stop-able object. Properties
// (fillStyle, font, ...) are freely settable.

export function noopCtx(): CanvasRenderingContext2D {
  const store: Record<PropertyKey, unknown> = {};
  return new Proxy(store, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop() {} });
      if (p === "measureText") return () => ({ width: 10 });
      return () => {};
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
