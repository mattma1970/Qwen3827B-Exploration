// PERU MAN - all sprite drawing: BR-flag pacman, turkeys, Canva power pill, pellets.

function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return "rgb(" + r + "," + g + "," + b + ")";
}

// Pac-man shaped like the Brazilian flag (green + yellow diamond + blue circle)
function drawPlayer(c, x, y, r, mouth, facing) {
  const ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[facing] || 0;
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

// A turkey: colored body, fanned tail, red wattle, orange beak
function drawTurkey(c, x, y, r, color, opts) {
  const o = opts || {};
  const fright = o.fright;
  const flick = o.flick;
  c.save();
  c.translate(x, y);
  if (o.facing === "left") c.scale(-1, 1);
  if (o.bob) c.translate(0, o.bob);

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
function drawEyes(c, x, y) {
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

// Power pill: Canva logo - red circle with white brush swoosh, gently pulsing
function drawCanvaPill(c, x, y, r, t) {
  const s = 1 + 0.1 * Math.sin((t || 0) * 5);
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  const g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.2);
  g.addColorStop(0, "#ff9966");
  g.addColorStop(1, "#e63926");
  c.beginPath();
  c.arc(0, 0, r * 1.05, 0, Math.PI * 2);
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = "#fff";
  c.lineWidth = r * 0.32;
  c.lineCap = "round";
  c.beginPath();
  c.arc(0, r * 0.12, r * 0.55, Math.PI * 1.08, Math.PI * 1.92);
  c.stroke();
  c.beginPath();
  c.arc(r * 0.58, -r * 0.3, r * 0.13, 0, Math.PI * 2);
  c.fillStyle = "#fff";
  c.fill();
  c.restore();
}

// Pellet: a tiny yellow diamond (a little piece of the flag)
function drawPellet(c, x, y) {
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

// Life icon: mini Brazilian flag circle
function drawMiniFlag(c, x, y, r) {
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.clip();
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
