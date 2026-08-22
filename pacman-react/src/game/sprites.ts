// PERU MAN - all sprite drawing: emoji-ified Rafa player (BR-flag fallback),
// turkeys, Canva power pill, pellets.

import { clamp } from "./utils";
import { designFor } from "./character";

// Sprite registry: user photos (emoji-fied in-browser, see photo.ts) override
// the hand-drawn art per slot. `ghosts` is keyed by turkey name. Values are
// HTMLImageElement or null.
export const Sprites: {
  player: HTMLImageElement | null;
  pill: HTMLImageElement | null;
  ghosts: Record<string, HTMLImageElement | null>;
} = { player: null, pill: null, ghosts: {} };

export function spriteReady(img: HTMLImageElement | null | undefined): img is HTMLImageElement {
  return !!(img && img.complete && img.naturalWidth > 0);
}

export function playerSprite(): HTMLImageElement | null {
  return spriteReady(Sprites.player)
    ? Sprites.player
    : rafaEmojiReady()
      ? rafaEmojiImg
      : null;
}

export function shadeHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return "rgb(" + r + "," + g + "," + b + ")";
}

// Emoji-ified avatar of Rafa (img/rafa_emoji.png: rafa.jpg run through a local
// ImageMagick pass -blur 0x4 -posterize 20 -colors 16 + circle mask). Loaded once
// at boot; the player falls back to hand-drawn BR flag while it loads or when
// Image is unavailable (headless tests).
let rafaEmojiImg: HTMLImageElement | null = null;
if (typeof Image !== "undefined") {
  rafaEmojiImg = new Image();
  rafaEmojiImg.src = "img/rafa_emoji.png";
}

export function rafaEmojiReady(): boolean {
  return !!(rafaEmojiImg && rafaEmojiImg.complete && rafaEmojiImg.naturalWidth > 0);
}

export type Facing = "up" | "down" | "left" | "right";

// Classic arcade Pac-Man yellow (also the pellet/flag-diamond yellow).
export const PAC_YELLOW = "#ffdf00";

// Rider photo scale relative to the character radius: <1 keeps a visible rim
// of the base (and the mouth wedge) around the cutout face.
export const PLAYER_RIDER_SCALE = 0.88;

export interface BaseOpts {
  facing?: Facing;
  mouth?: number;
  fright?: boolean;
  flick?: boolean;
}

// Scared face (squiggle eyes + wave mouth), centered — used by the ghost base
// in fright mode.
function frightFaceGhost(c: CanvasRenderingContext2D, r: number, flick?: boolean): void {
  c.strokeStyle = flick ? "#5b7fff" : "#1c2a6b";
  c.lineWidth = 2;
  for (const ex of [-r * 0.3, r * 0.3]) {
    c.beginPath();
    c.moveTo(ex - r * 0.14, -r * 0.26);
    c.quadraticCurveTo(ex - r * 0.07, -r * 0.38, ex, -r * 0.26);
    c.quadraticCurveTo(ex + r * 0.07, -r * 0.14, ex + r * 0.14, -r * 0.26);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(-r * 0.36, r * 0.3);
  for (let i = 0; i < 4; i++) {
    c.lineTo(-r * 0.36 + r * 0.2 * (i + 0.5), r * 0.3 + (i % 2 ? r * 0.14 : -r * 0.14));
  }
  c.stroke();
}

// The base character's outline, built as a path centered on the current
// origin — used both to FILL the base and to CLIP a photo riding on top of it
// (a photo may cover the character but never extend outside it). The pacman
// wedge is rotated to `facing` (path coordinates freeze at build time, so the
// save/rotate/.../restore around it is safe). Returns false for "none"/
// unknown ids: a cutout on its own has no shape to clip against.
export function characterBasePath(c: CanvasRenderingContext2D, base: string, r: number, opts?: BaseOpts): boolean {
  const o = opts || {};
  const facing: Facing = o.facing || "right";
  if (base === "pacman") {
    const ang: number = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[facing] || 0;
    const mouth = o.mouth == null ? 0.5 : o.mouth;
    c.save();
    c.rotate(ang);
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
    c.closePath();
    c.restore();
    return true;
  }
  if (base === "ghost") {
    c.beginPath();
    c.arc(0, -r * 0.08, r * 0.92, Math.PI, 0); // dome
    const yBot = r * 0.72;
    c.lineTo(r * 0.92, yBot);
    const sw = (r * 1.84) / 3;
    for (let i = 0; i < 3; i++) {
      const cx = r * 0.92 - sw / 2 - i * sw;
      c.arc(cx, yBot, sw / 2, 0, Math.PI, false); // scallop bumping downward
    }
    c.closePath();
    return true;
  }
  return false;
}

// A base character, drawn centered on the current origin (the caller has
// already translated/scaled to the character). Library:
//  - "pacman": classic yellow-style mouth wedge, rotated to `facing`;
//  - "ghost":  classic dome + wavy skirt, eyes looking toward `facing`;
//  - "none" (or unknown): nothing — the cutout+sticker look on its own.
// `fright` paints the base in the scared blue (white when flick) with the
// squiggle face instead of the normal face.
export function drawCharacterBase(c: CanvasRenderingContext2D, base: string, color: string, r: number, opts?: BaseOpts): void {
  const o = opts || {};
  const fright = !!o.fright;
  if (!characterBasePath(c, base, r, o)) return;
  c.fillStyle = fright ? (o.flick ? "#f8f9ff" : "#5b7fff") : color;
  c.fill();
  if (fright) {
    frightFaceGhost(c, r, o.flick);
    return;
  }
  if (base !== "ghost") return;
  const facing: Facing = o.facing || "right";
  const pdx = facing === "left" ? -r * 0.05 : facing === "right" ? r * 0.05 : 0;
  const pdy = facing === "up" ? -r * 0.06 : facing === "down" ? r * 0.06 : 0;
  for (const ex of [-r * 0.33, r * 0.33]) {
    c.fillStyle = "#fff";
    c.beginPath();
    c.ellipse(ex, -r * 0.3, r * 0.19, r * 0.25, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#1b2cff";
    c.beginPath();
    c.arc(ex + pdx, -r * 0.3 + pdy, r * 0.1, 0, Math.PI * 2);
    c.fill();
  }
}

// Pac-man face: photo sprite (if assigned) -> emoji avatar -> hand-drawn BR flag.
// With a photo: the slot's character base (see game/character.ts — classic
// Pac-Man by default) is drawn first, and the photo RIDES on top of it, always
// upright and CLIPPED to the base's outline — it may cover the character but
// never extends outside it (a transparent cutout keeps the base visible around
// the object, so the face looks like it rides the character; opaque photos
// cover the whole shape). A "none" base has no outline: the photo is as-is.
export function drawPlayer(c: CanvasRenderingContext2D, x: number, y: number, r: number, mouth: number, facing: string): void {
  const img = playerSprite();
  if (img) {
    const d = designFor("player");
    const bo = { facing: facing as Facing, mouth };
    c.save();
    c.translate(x, y);
    drawCharacterBase(c, d.base, d.color, r, bo);
    if (characterBasePath(c, d.base, r, bo)) c.clip();
    const s = r * PLAYER_RIDER_SCALE;
    c.drawImage(img, -s, -s, s * 2, s * 2);
    c.restore();
    return;
  }
  const ang: number = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[facing as Facing] || 0;
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.beginPath();
  c.moveTo(0, 0);
  c.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
  c.closePath();
  const g = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.15, 0, 0, r);
  g.addColorStop(0, "#2fd06b");
  g.addColorStop(1, "#009c3b");
  c.fillStyle = g;
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = "#ffdf00"; // yellow diamond
  c.beginPath();
  c.moveTo(0, -r * 0.8);
  c.lineTo(r * 0.64, 0);
  c.lineTo(0, r * 0.8);
  c.lineTo(-r * 0.64, 0);
  c.closePath();
  c.fill();
  c.fillStyle = "#002776"; // blue globe
  c.beginPath();
  c.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.85)"; // equator band
  c.lineWidth = r * 0.06;
  c.stroke();
  c.restore();
  c.restore();
}

export interface TurkeyOpts {
  fright?: boolean;
  flick?: boolean;
  facing?: Facing;
  bob?: number;
  name?: string;
}

// A turkey: colored body, fanned tail, red wattle, orange beak.
// If a photo is assigned to this turkey (Sprites.ghosts[name]) the raw square
// image replaces the whole hand-drawn turkey as one unit (bob/flip kept).
export function drawTurkey(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, opts: TurkeyOpts): void {
  const o = opts || {};
  const fright = o.fright;
  const flick = o.flick;
  c.save();
  c.translate(x, y);
  if (o.facing === "left") c.scale(-1, 1);
  if (o.bob) c.translate(0, o.bob);

  const photo = o.name ? Sprites.ghosts[o.name] : null;
  if (o.name && spriteReady(photo)) {
    // base character (upright at the bobbed spot — it already faces via
    // `facing`; the local x-flip is for the hand-drawn art), then the photo on
    // top, upright, bobbing along, and clipped to the base's outline
    const d = designFor(o.name);
    const bob = o.bob || 0;
    const bo = { facing: o.facing, fright, flick };
    c.restore();
    c.save();
    c.translate(x, y + bob);
    drawCharacterBase(c, d.base, d.color, r, bo);
    if (characterBasePath(c, d.base, r, bo)) c.clip();
    const s = r * PLAYER_RIDER_SCALE;
    c.drawImage(photo, -s, -s, s * 2, s * 2);
    c.restore();
    return;
  }

  const body = fright ? (flick ? "#f8f9ff" : "#5b7fff") : color;
  const tail = fright ? (flick ? "#d8dbee" : "#3b53c9") : shadeHex(color, -55);

  // tail fan (behind, opening to the left)
  c.beginPath();
  c.moveTo(0, 0);
  c.arc(0, 0, r * 1.2, Math.PI - 1.2, Math.PI + 1.2);
  c.closePath();
  c.fillStyle = tail;
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.35)";
  c.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    const a = Math.PI + i * 0.33;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12);
    c.stroke();
  }

  // body
  const bg = c.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r * 0.75);
  bg.addColorStop(0, shadeHex(fright ? (flick ? "#f8f9ff" : "#5b7fff") : color, 50));
  bg.addColorStop(1, body);
  c.beginPath();
  c.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  c.fillStyle = bg;
  c.fill();

  if (fright) {
    // scared squiggle face
    c.strokeStyle = flick ? "#5b7fff" : "#1c2a6b";
    c.lineWidth = 2;
    for (const ey of [-r * 0.35, 0]) {
      c.beginPath();
      c.moveTo(r * 0.2, ey);
      c.quadraticCurveTo(r * 0.3, ey - 3, r * 0.4, ey);
      c.quadraticCurveTo(r * 0.5, ey + 3, r * 0.6, ey);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(r * 0.15, r * 0.35);
    c.lineTo(r * 0.3, r * 0.22);
    c.lineTo(r * 0.45, r * 0.35);
    c.lineTo(r * 0.6, r * 0.22);
    c.stroke();
  } else {
    // head bump
    c.beginPath();
    c.arc(r * 0.5, -r * 0.28, r * 0.32, 0, Math.PI * 2);
    c.fillStyle = body;
    c.fill();
    // red wattle
    c.fillStyle = "#e63946";
    c.beginPath();
    c.ellipse(r * 0.42, r * 0.08, r * 0.14, r * 0.2, 0.3, 0, Math.PI * 2);
    c.fill();
    // orange beak
    c.fillStyle = "#ffb703";
    c.beginPath();
    c.moveTo(r * 0.72, -r * 0.42);
    c.lineTo(r * 1.16, -r * 0.24);
    c.lineTo(r * 0.68, -r * 0.1);
    c.closePath();
    c.fill();
    // eye
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(r * 0.52, -r * 0.38, r * 0.17, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#20242e";
    c.beginPath();
    c.arc(r * 0.58, -r * 0.36, r * 0.08, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// Eyes only: a turkey being gobbled up flies home
export function drawEyes(c: CanvasRenderingContext2D, x: number, y: number): void {
  for (const dx of [-5, 6]) {
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(x + dx, y - 3, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#20242e";
    c.beginPath();
    c.arc(x + dx + 1, y - 3, 2.2, 0, Math.PI * 2);
    c.fill();
  }
}

// Official Canva wordmark SVG (brand gradient: purple #6420FF/#7D2AE7 -> teal
// #00C4CC), embedded as a data-URI image. Loaded once at boot; pill falls back
// to the "C" mark until it is ready (or when Image is unavailable, e.g. headless
// tests).
const CANVA_WORDMARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 30"><defs><radialGradient id="b" cx="0" cy="0" r="1" gradientTransform="matrix(16.80002 -17.28 11.48403 11.16504 40.96 29)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6420FF"/><stop offset="1" stop-color="#6420FF" stop-opacity="0"/></radialGradient><radialGradient id="c" cx="0" cy="0" r="1" gradientTransform="matrix(46.71996 4.16 -3.31561 37.23688 1.92 17.64)" gradientUnits="userSpaceOnUse"><stop offset=".25" stop-color="#00C4CC"/><stop offset="1" stop-color="#00C4CC" stop-opacity="0"/></radialGradient><radialGradient id="d" cx="0" cy="0" r="1" gradientTransform="rotate(-38.85 54.22 -35.3) scale(30.226 20.6676)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6420FF"/><stop offset="1" stop-color="#6420FF" stop-opacity="0"/></radialGradient><radialGradient id="e" cx="0" cy="0" r="1" gradientTransform="matrix(31.32001 -15.36 10.50269 21.41566 2.28 26.2)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6420FF"/><stop offset="1" stop-color="#6420FF" stop-opacity="0"/></radialGradient><radialGradient id="f" cx="0" cy="0" r="1" gradientTransform="matrix(67.99982 15.03996 -18.44596 83.39925 7.68 2.92)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#00C4CC"/><stop offset="1" stop-color="#00C4CC" stop-opacity="0"/></radialGradient><pattern id="x" width="1" height="1"><rect width="100" height="100" fill="#7D2AE7"/><rect width="100" height="100" fill="url(#b)"/><rect width="100" height="100" fill="url(#c)"/><rect width="100" height="100" fill="url(#d)"/><rect width="100" height="100" fill="url(#e)"/><rect width="100" height="100" fill="url(#f)"/></pattern></defs><mask id="a"><path fill="#fff" d="M79.444 18.096c-.136 0-.26.088-.324.272-.82 2.34-1.928 3.732-2.84 3.732-.524 0-.736-.584-.736-1.5 0-2.292 1.372-7.152 2.064-9.368.08-.268.132-.508.132-.712 0-.644-.352-.96-1.224-.96-.94 0-1.952.368-2.936 2.092-.34-1.52-1.368-2.184-2.804-2.184-1.66 0-3.264 1.068-4.584 2.8-1.32 1.732-2.872 2.3-4.04 2.02.84-2.056 1.152-3.592 1.152-4.732 0-1.788-.884-2.868-2.312-2.868-2.172 0-3.424 2.072-3.424 4.252 0 1.684.764 3.416 2.444 4.256-1.408 3.184-3.464 6.064-4.244 6.064-1.008 0-1.304-4.932-1.248-8.46.036-2.024.204-2.128.204-2.74 0-.352-.228-.592-1.144-.592-2.136 0-2.796 1.808-2.896 3.884a10.233 10.233 0 01-.368 2.332c-.892 3.184-2.732 5.6-3.932 5.6-.556 0-.708-.556-.708-1.284 0-2.292 1.284-5.156 1.284-7.6 0-1.796-.788-2.932-2.272-2.932-1.748 0-4.06 2.08-6.248 5.976.72-2.984 1.016-5.872-1.116-5.872A2.886 2.886 0 0036 9.916a.752.752 0 00-.432.728c.204 3.176-2.56 11.312-5.18 11.312-.476 0-.708-.516-.708-1.348 0-2.296 1.368-7.144 2.056-9.364.088-.288.136-.536.136-.752 0-.608-.376-.92-1.228-.92-.936 0-1.952.356-2.932 2.08-.344-1.52-1.372-2.184-2.808-2.184-2.356 0-4.988 2.492-6.144 5.74-1.548 4.336-4.668 8.524-8.868 8.524-3.812 0-5.824-3.172-5.824-8.184C4.068 8.312 9.38 2.4 13.32 2.4c1.884 0 2.784 1.2 2.784 3.04 0 2.228-1.244 3.264-1.244 4.112 0 .26.216.516.644.516 1.712 0 3.728-2.012 3.728-4.756S17.004.56 13.064.56C6.552.56 0 7.112 0 15.508c0 6.68 3.296 10.708 8.996 10.708 3.888 0 7.284-3.024 9.116-6.552.208 2.924 1.536 4.452 3.56 4.452 1.8 0 3.256-1.072 4.368-2.956.428 1.972 1.564 2.936 3.04 2.936 1.692 0 3.108-1.072 4.456-3.064-.02 1.564.336 3.036 1.692 3.036.64 0 1.404-.148 1.54-.708 1.428-5.904 4.956-10.724 6.036-10.724.32 0 .408.308.408.672 0 1.604-1.132 4.892-1.132 6.992 0 2.268.964 3.768 2.956 3.768 2.208 0 4.452-2.704 5.948-6.656.468 3.692 1.48 6.672 3.064 6.672 1.944 0 5.396-4.092 7.488-8.424.82.104 2.052.076 3.236-.76-.504 1.276-.8 2.672-.8 4.068 0 4.02 1.92 5.148 3.572 5.148 1.796 0 3.252-1.072 4.368-2.956.368 1.7 1.308 2.932 3.036 2.932 2.704 0 5.052-2.764 5.052-5.032 0-.6-.256-.964-.556-.964zM23.32 21.888c-1.092 0-1.52-1.1-1.52-2.74 0-2.848 1.948-7.604 4.008-7.604.9 0 1.24 1.06 1.24 2.356 0 2.892-1.852 7.988-3.728 7.988zm37.404-8.5c-.652-.776-.888-1.832-.888-2.772 0-1.16.424-2.14.932-2.14s.664.5.664 1.196c0 1.164-.416 2.864-.708 3.716zm8.468 8.5c-1.092 0-1.52-1.264-1.52-2.74 0-2.748 1.948-7.604 4.024-7.604.9 0 1.22 1.052 1.22 2.356 0 2.892-1.82 7.988-3.724 7.988z"/></mask><rect mask="url(#a)" width="100" height="100" fill="url(#x)"/></svg>';

let canvaWordmarkImg: HTMLImageElement | null = null;
if (typeof Image !== "undefined") {
  canvaWordmarkImg = new Image();
  canvaWordmarkImg.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(CANVA_WORDMARK_SVG);
}

// Power pill: the Canva wordmark (official SVG mark) on a soft glowing pill disc,
// with a hand-drawn brand-gradient "C" fallback before the image loads.
export function drawCanvaPill(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  const s = 1 + 0.1 * Math.sin((t || 0) * 5);
  c.save();
  c.translate(x, y);
  c.scale(s, s);

  // soft glowing "pill" disc, brand-tinted at the rim
  const disc = c.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r * 1.15);
  disc.addColorStop(0, "#ffffff");
  disc.addColorStop(0.7, "#efeaff");
  disc.addColorStop(1, "#d9c9ff");
  c.beginPath();
  c.arc(0, 0, r * 1.12, 0, Math.PI * 2);
  c.fillStyle = disc;
  c.fill();
  c.lineWidth = r * 0.08;
  c.strokeStyle = "rgba(100,32,255,0.5)";
  c.stroke();

  // a user photo rides its character base on top of the glowing disc (the
  // base mouth wiggles on the same clock as the pulse)
  if (spriteReady(Sprites.pill)) {
    const d = designFor("pill");
    const rb = r * 0.92;
    const bo = {
      facing: "right" as const,
      mouth: 0.5 + 0.35 * Math.sin((t || 0) * 6),
    };
    drawCharacterBase(c, d.base, d.color, rb, bo);
    if (characterBasePath(c, d.base, rb, bo)) c.clip();
    const rs = rb * PLAYER_RIDER_SCALE;
    c.drawImage(Sprites.pill, -rs, -rs, rs * 2, rs * 2);
    c.restore();
    return;
  }
  const img = canvaWordmarkImg;
  if (img && img.complete && img.naturalWidth > 0) {
    // full official "Canva" wordmark, scaled to sit inside the disc
    const w = r * 1.95;
    const h = w * (img.naturalHeight / img.naturalWidth);
    c.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    // fallback: bold brush "C", open on the right, brand purple -> teal
    const R = r * 0.62;
    const gap = 0.72; // radians of opening on either side of the right
    const grad = c.createLinearGradient(-R, 0, R, 0);
    grad.addColorStop(0, "#6420FF");
    grad.addColorStop(0.5, "#7D2AE7");
    grad.addColorStop(1, "#00C4CC");
    c.strokeStyle = grad;
    c.lineWidth = r * 0.36;
    c.lineCap = "round";
    c.beginPath();
    c.arc(0, 0, R, gap, Math.PI * 2 - gap); // sweep the long way => C open at right
    c.stroke();
  }

  c.restore();
}

// Pellet: a tiny yellow diamond (a little piece of the flag)
export function drawPellet(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.fillStyle = "#ffdf00";
  c.beginPath();
  c.moveTo(x, y - 5);
  c.lineTo(x + 4, y);
  c.lineTo(x, y + 5);
  c.lineTo(x - 4, y);
  c.closePath();
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.beginPath();
  c.moveTo(x, y - 2);
  c.lineTo(x + 1.5, y);
  c.lineTo(x, y + 2);
  c.lineTo(x - 1.5, y);
  c.closePath();
  c.fill();
}

// Life icon: mini photo/avatar circle (BR flag before load)
export function drawMiniFlag(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.clip();
  const img = playerSprite();
  if (img) {
    c.drawImage(img, x - r, y - r, r * 2, r * 2);
    c.restore();
    return;
  }
  c.fillStyle = "#009c3b";
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.fillStyle = "#ffdf00";
  c.beginPath();
  c.moveTo(x, y - r * 0.75);
  c.lineTo(x + r * 0.65, y);
  c.lineTo(x, y + r * 0.75);
  c.lineTo(x - r * 0.65, y);
  c.closePath();
  c.fill();
  c.fillStyle = "#002776";
  c.beginPath();
  c.arc(x, y, r * 0.33, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
