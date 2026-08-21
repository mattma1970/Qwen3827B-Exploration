// PERU MAN - customize UI (M4): drop a photo onto a slot (Pacman, turkeys, pill).
// Top-level function/var so headless vm tests can load this; initCustomize only
// runs where a real document exists (browser).

var lastUsedSlot = "player"; // drop-anywhere target: last slot the user assigned to

function setLastUsedSlot(slot) {
  const s = spriteSlot(slot);
  if (s) lastUsedSlot = s;
  return lastUsedSlot;
}

function isImageFile(f) {
  return !!(f && typeof f.type === "string" && f.type.indexOf("image") === 0);
}

function slotList() {
  const list = ["player"];
  if (typeof TURKEYS !== "undefined") for (const d of TURKEYS) list.push(d.name);
  list.push("pill");
  return list;
}

function slotLabel(slot) {
  if (slot === "player") return "PACMAN";
  if (slot === "pill") return "PÍLULA";
  return String(slot).toUpperCase();
}

// UI-level assign: process + assign + persist (photo.js), then mark the slot
// as the drop-anywhere target. Resolves the normalized slot name.
function assignToSlot(slot, source, opts) {
  const s = spriteSlot(slot);
  if (!s) return Promise.reject(new Error("unknown sprite slot: " + slot));
  return assignPhoto(s, source, opts).then(function (name) {
    setLastUsedSlot(name);
    return name;
  });
}

// Build the panel, the 6 drop zones, the page button and drop-anywhere on the
// canvas. Returns { panel, setPanel } or null when headless / missing args.
function initCustomize(game, canvasEl) {
  if (typeof document === "undefined" || !game || !canvasEl) return null;
  const doc = document;
  const zones = {};
  let open = false, pausedByPanel = false;

  const panel = doc.createElement("div");
  panel.className = "customize-panel";
  panel.style.display = "none";

  const head = doc.createElement("div");
  head.className = "cp-head";
  const title = doc.createElement("h2");
  title.textContent = "PERSONALIZAR";
  const closeBtn = doc.createElement("button");
  closeBtn.className = "cp-close";
  closeBtn.textContent = "\u00d7";
  head.appendChild(title);
  head.appendChild(closeBtn);

  const sub = doc.createElement("div");
  sub.className = "cp-sub";
  sub.textContent = "solte uma foto em cada slot — ou clique para escolher";

  const grid = doc.createElement("div");
  grid.className = "cp-grid";

  const toastEl = doc.createElement("div");
  toastEl.className = "toast";
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2400);
  }

  function drawPrev(slot) {
    const el = zones[slot];
    if (!el || !el.prevCtx) return;
    const c = el.prevCtx;
    c.clearRect(0, 0, 64, 64);
    if (slot === "player") drawPlayer(c, 32, 32, 22, 0.35, "right");
    else if (slot === "pill") drawCanvaPill(c, 32, 32, 18, 0.5);
    else {
      let col = "#e63946";
      if (typeof TURKEYS !== "undefined") for (const d of TURKEYS) if (d.name === slot) { col = d.color; break; }
      drawTurkey(c, 32, 32, 20, col, { name: slot });
    }
  }

  function updateZone(slot) {
    const el = zones[slot];
    if (!el) return;
    const assigned = !!SpriteData[slot];
    el.zone.classList.toggle("filled", assigned, true);
    el.status.textContent = assigned ? "personalizada" : "padr\u00e3o";
    drawPrev(slot);
  }

  function fmtBytes(n) {
    return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.ceil(n / 1024) + " kB";
  }

  function updateUsage() {
    usageEl.textContent = "usando " + fmtBytes(spriteUsage()) + " de " + fmtBytes(SPRITE_QUOTA);
  }

  function refreshAll() {
    for (const s of slotList()) updateZone(s);
    updateUsage();
  }

  function handleDrop(slot, f) {
    if (!f) return;
    if (!isImageFile(f)) { toast("s\u00f3 imagens, por favor"); return; }
    assignToSlot(slot, f).then(function (name) {
      updateZone(name);
      toast("foto aplicada em " + slotLabel(name));
    }, function (err) {
      toast(String(err).indexOf("quota") > -1
        ? "armazenamento cheio \u2014 foto muito grande"
        : "n\u00e3o deu para ler essa imagem");
    });
  }

  for (const slot of slotList()) {
    const zone = doc.createElement("div");
    zone.className = "slot-zone";
    const prev = doc.createElement("canvas");
    prev.className = "slot-prev";
    prev.width = 64;
    prev.height = 64;
    const name = doc.createElement("div");
    name.className = "slot-name";
    name.textContent = slotLabel(slot);
    const status = doc.createElement("div");
    status.className = "slot-status";
    status.textContent = "padr\u00e3o";
    const clearBtn = doc.createElement("button");
    clearBtn.className = "slot-clear";
    clearBtn.textContent = "limpar";
    const file = doc.createElement("input");
    file.className = "slot-file";
    file.type = "file";
    file.accept = "image/*";
    file.style.display = "none";
    zone.appendChild(prev);
    zone.appendChild(name);
    zone.appendChild(status);
    zone.appendChild(clearBtn);
    zone.appendChild(file);
    grid.appendChild(zone);
    zones[slot] = {
      zone: zone,
      status: status,
      prevCtx: prev.getContext ? prev.getContext("2d") : null,
    };

    zone.addEventListener("dragover", function (e) {
      e.preventDefault();
      zone.classList.add("drag");
    });
    zone.addEventListener("dragleave", function () {
      zone.classList.remove("drag");
    });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      zone.classList.remove("drag");
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handleDrop(slot, f);
    });
    // click a zone -> file picker (mobile fallback + desktop convenience)
    zone.addEventListener("click", function () {
      file.click();
    });
    clearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      clearPhoto(slot);
      updateZone(slot);
      toast(slotLabel(slot) + " de volta ao padr\u00e3o");
    });
    file.addEventListener("change", function () {
      const f = file.files && file.files[0];
      if (f) handleDrop(slot, f);
      file.value = "";
    });
  }

  const foot = doc.createElement("div");
  foot.className = "cp-foot";
  const usageEl = doc.createElement("div");
  usageEl.className = "cp-usage";
  const resetBtn = doc.createElement("button");
  resetBtn.className = "cp-reset";
  resetBtn.textContent = "restaurar padr\u00f5es";
  resetBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    for (const s of slotList()) clearPhoto(s);
    setLastUsedSlot("player");
    refreshAll();
    toast("todos os slots restaurados");
  });
  foot.appendChild(usageEl);
  foot.appendChild(resetBtn);

  panel.appendChild(head);
  panel.appendChild(sub);
  panel.appendChild(grid);
  panel.appendChild(foot);
  doc.body.appendChild(panel);
  doc.body.appendChild(toastEl);

  // page button next to the canvas
  const btn = doc.createElement("button");
  btn.className = "custom-btn";
  btn.textContent = "Personalizar (C)";
  btn.addEventListener("click", function (e) {
    e.preventDefault();
    setPanel(!open);
  });
  const wrap = canvasEl.parentElement && canvasEl.parentElement.parentElement ? canvasEl.parentElement.parentElement : doc.body;
  wrap.appendChild(btn);

  // drop anywhere on the canvas -> goes to the last-used slot
  canvasEl.addEventListener("dragover", function (e) { e.preventDefault(); });
  canvasEl.addEventListener("drop", function (e) {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleDrop(lastUsedSlot, f);
  });

  function setPanel(v) {
    if (v === open) return;
    open = v;
    panel.style.display = open ? "block" : "none";
    if (open) {
      if (!game.paused && (game.state === "play" || game.state === "ready")) {
        game.togglePause();
        pausedByPanel = true;
      }
      refreshAll();
    } else if (pausedByPanel) {
      game.togglePause();
      pausedByPanel = false;
    }
  }

  closeBtn.addEventListener("click", function (e) {
    e.preventDefault();
    setPanel(false);
  });
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", function (e) {
      if (e.code === "KeyC") setPanel(!open);
      else if (e.code === "Escape" && open) setPanel(false);
    });
  }

  refreshAll();
  return { panel: panel, setPanel: setPanel, toast: toastEl };
}