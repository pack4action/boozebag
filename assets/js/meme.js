// ---- The meme maker ----
// A picture, two lines of words, and stickers from the site's own art.
// Everything is drawn onto one canvas at the size it will be saved at and
// shown scaled down, so what is on the screen is what comes out. Nothing
// leaves the phone: a picture of your own is read in the browser and the
// finished meme is made there too.
(function () {
  const canvas = document.getElementById('meme-canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  // ---- What there is to work with ----
  // The blank and the one of him sit on the page's own dark with a little
  // beer-coloured light behind, so a sticker dropped on either looks like
  // it belongs to the site rather than to a white square.
  const TEMPLATES = [
    { id: 'upload', label: 'Your own', upload: true },
    { id: 'poster', label: 'The poster', src: 'assets/img/share.jpg', fit: 'cover' },
    { id: 'him', label: 'Him', src: 'assets/img/hero-art.png', fit: 'art', w: 1080, h: 1080 },
    { id: 'blank', label: 'Blank', w: 1080, h: 1080 },
  ];
  // Sizes are a share of the picture's short side, so a sticker is the same
  // size on the poster as on the square.
  const STICKERS = [
    { id: 'can', src: 'assets/img/can.png', size: 0.36 },
    { id: 'syringe', src: 'assets/img/syringe.png', size: 0.26 },
    { id: 'degen', src: 'assets/img/degen-sign.png', size: 0.36 },
    { id: 'legend', src: 'assets/img/east-coast-legend.png', size: 0.32 },
    { id: 'shades', src: 'assets/img/work-harder.png', size: 0.5 },
    { id: 'another', src: 'assets/img/another-one.png', size: 0.44 },
    { id: 'face', src: 'assets/img/avatar.png', size: 0.26, round: true },
    { id: 'him', src: 'assets/img/hero-art.png', size: 0.7 },
  ];
  // What the words are written in. Anton is the site's own; the rest are
  // what a phone has if Anton has not arrived.
  const FACE = "Anton, Impact, 'Arial Narrow', sans-serif";
  const STYLES = {
    classic: { fill: '#ffffff', stroke: '#000000' },
    amber: { fill: '#ffc632', stroke: '#000000' },
    neon: { fill: '#ffffff', stroke: '#0a0a0d', glow: '#51fb18' },
  };
  const LONGEST = 1600;   // the longest side a picture of your own is kept at

  const state = {
    tpl: TEMPLATES[1],
    bg: null,
    W: 1200,
    H: 630,
    top: '',
    bottom: '',
    style: 'classic',
    stickers: [],   // { art, nx, ny, nw, rot, flip } in shares of the picture
    sel: -1,
  };

  // ---- Pictures, fetched once each ----
  const cache = new Map();
  function load(src) {
    if (cache.has(src)) return cache.get(src);
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('no picture'));
      img.src = src;
    });
    cache.set(src, p);
    return p;
  }

  // ---- Drawing ----
  const short = () => Math.min(state.W, state.H);

  function drawBackground() {
    const { W, H, tpl, bg } = state;
    if (tpl.fit === 'cover' || tpl.upload) {
      if (!bg) return;
      const s = Math.max(W / bg.width, H / bg.height);
      const w = bg.width * s;
      const h = bg.height * s;
      ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h);
      return;
    }
    // The dark, with a warm light behind where he stands.
    ctx.fillStyle = '#0d0b10';
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H * 0.62, 0, W / 2, H * 0.62, W * 0.62);
    glow.addColorStop(0, 'rgba(255, 170, 30, 0.34)');
    glow.addColorStop(0.55, 'rgba(255, 90, 40, 0.1)');
    glow.addColorStop(1, 'rgba(255, 90, 40, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    if (tpl.fit === 'art' && bg) {
      // Whole, and standing in the lower part so the top line has sky.
      const w = W * 0.96;
      const h = bg.height * (w / bg.width);
      ctx.drawImage(bg, (W - w) / 2, H - h - H * 0.1, w, h);
    }
  }

  function stickerBox(s) {
    const w = s.nw * short();
    const h = w * (s.art.height / s.art.width);
    return { x: s.nx * state.W, y: s.ny * state.H, w, h };
  }
  function drawSticker(s) {
    const b = stickerBox(s);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(s.rot);
    if (s.flip) ctx.scale(-1, 1);
    if (s.round) {
      ctx.beginPath();
      ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(s.art, -b.w / 2, -b.h / 2, b.w, b.h);
    ctx.restore();
    if (s.round) {
      // A rim, the way the avatar is shown on the site.
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.w / 2, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(3, b.w * 0.035);
      ctx.strokeStyle = '#ffc632';
      ctx.stroke();
      ctx.restore();
    }
  }

  // The words: as big as the width allows, two lines at most, three only
  // when there is no other way to fit them. Measured with the face that is
  // actually going to be used, so they never run off the edge.
  function wrap(text, size, maxW) {
    ctx.font = size + 'px ' + FACE;
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width <= maxW || !line) line = next;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
  }
  function fit(text, maxW) {
    const big = Math.round(short() * 0.135);
    const small = Math.round(short() * 0.05);
    for (const most of [2, 3]) {
      for (let size = big; size >= small; size -= 2) {
        const lines = wrap(text, size, maxW);
        ctx.font = size + 'px ' + FACE;
        const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
        if (lines.length <= most && widest <= maxW) return { size, lines };
      }
    }
    return { size: small, lines: wrap(text, small, maxW) };
  }
  function drawWords(text, where, reserve) {
    const clean = text.trim().toUpperCase();
    if (!clean) return;
    const pad = short() * 0.045;
    const maxW = state.W - pad * 2;
    const { size, lines } = fit(clean, maxW);
    const look = STYLES[state.style] || STYLES.classic;
    const lh = size * 1.04;
    ctx.save();
    ctx.font = size + 'px ' + FACE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    // Anton sits high in its box: the cap height is about 0.72 of the size.
    const cap = size * 0.74;
    let y = where === 'top'
      ? pad + cap
      : state.H - pad - reserve - (lines.length - 1) * lh;
    lines.forEach((line) => {
      if (look.glow) {
        ctx.shadowColor = look.glow;
        ctx.shadowBlur = size * 0.35;
      }
      ctx.lineWidth = size * 0.17;
      ctx.strokeStyle = look.stroke;
      ctx.strokeText(line, state.W / 2, y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = look.fill;
      ctx.fillText(line, state.W / 2, y);
      y += lh;
    });
    ctx.restore();
  }

  // The coin's name in the corner of everything that goes out, small enough
  // not to be the joke and big enough to be read in a feed. Its height is
  // handed back so the bottom line can stand clear of it.
  function drawStamp() {
    const size = Math.max(14, Math.round(short() * 0.036));
    const pad = short() * 0.03;
    ctx.save();
    ctx.font = size + 'px ' + FACE;
    const name = '$BOOZEBAG';
    const site = 'boozebag.us';
    const nameW = ctx.measureText(name).width;
    ctx.font = Math.round(size * 0.62) + 'px ' + FACE;
    const siteW = ctx.measureText(site).width;
    const gap = size * 0.4;
    const w = nameW + gap + siteW + size * 0.9;
    const h = size * 1.45;
    const x = state.W - pad - w;
    const y = state.H - pad - h;
    ctx.fillStyle = 'rgba(10, 10, 13, 0.62)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = size + 'px ' + FACE;
    ctx.fillStyle = '#ffc632';
    ctx.fillText(name, x + size * 0.45, y + h / 2 + size * 0.04);
    ctx.font = Math.round(size * 0.62) + 'px ' + FACE;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fillText(site, x + size * 0.45 + nameW + gap, y + h / 2 + size * 0.06);
    ctx.restore();
    return h + pad * 0.6;
  }

  // Where the corner handle of the picked sticker is, in picture pixels.
  function handleAt(s) {
    const b = stickerBox(s);
    const hx = b.w / 2;
    const hy = b.h / 2;
    const c = Math.cos(s.rot);
    const n = Math.sin(s.rot);
    return { x: b.x + hx * c - hy * n, y: b.y + hx * n + hy * c };
  }
  const HANDLE = () => Math.max(18, short() * 0.034);

  function drawPicked() {
    const s = state.stickers[state.sel];
    if (!s) return;
    const b = stickerBox(s);
    const line = Math.max(2, short() * 0.004);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(s.rot);
    ctx.setLineDash([line * 4, line * 3]);
    ctx.lineWidth = line;
    ctx.strokeStyle = '#ffc632';
    ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.restore();
    const h = handleAt(s);
    ctx.save();
    ctx.beginPath();
    ctx.arc(h.x, h.y, HANDLE(), 0, Math.PI * 2);
    ctx.fillStyle = '#ffc632';
    ctx.fill();
    ctx.lineWidth = line * 1.5;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    // A turning arrow on the handle, since it both sizes and turns.
    ctx.beginPath();
    ctx.arc(h.x, h.y, HANDLE() * 0.48, -Math.PI * 0.2, Math.PI * 1.3);
    ctx.lineWidth = line * 1.6;
    ctx.stroke();
    ctx.restore();
  }

  function draw(forExport) {
    ctx.clearRect(0, 0, state.W, state.H);
    drawBackground();
    state.stickers.forEach(drawSticker);
    const reserve = drawStamp();
    drawWords(state.top, 'top', 0);
    drawWords(state.bottom, 'bottom', reserve);
    if (!forExport) drawPicked();
  }
  let queued = false;
  function redraw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; draw(false); });
  }

  function size(W, H) {
    state.W = Math.round(W);
    state.H = Math.round(H);
    canvas.width = state.W;
    canvas.height = state.H;
    canvas.style.aspectRatio = state.W + ' / ' + state.H;
  }

  // ---- Picking a picture ----
  const note = document.getElementById('meme-note');
  function say(text) { if (note) note.textContent = text || ''; }

  function useTemplate(tpl) {
    state.tpl = tpl;
    markPicked();
    if (tpl.upload) { fileIn.click(); return; }
    if (!tpl.src) {
      state.bg = null;
      size(tpl.w, tpl.h);
      redraw();
      return;
    }
    load(tpl.src).then((img) => {
      if (state.tpl !== tpl) return;
      state.bg = img;
      if (tpl.fit === 'cover') size(img.width, img.height);
      else size(tpl.w, tpl.h);
      redraw();
    }).catch(() => say('That picture would not load. Try another.'));
  }

  const fileIn = document.getElementById('meme-file');
  fileIn.addEventListener('change', () => {
    const file = fileIn.files && fileIn.files[0];
    fileIn.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Kept at a size a feed will show without shrinking it, and no bigger.
      const s = Math.min(1, LONGEST / Math.max(img.width, img.height));
      const w = Math.round(img.width * s);
      const h = Math.round(img.height * s);
      const kept = document.createElement('canvas');
      kept.width = w;
      kept.height = h;
      kept.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      state.tpl = TEMPLATES[0];
      state.bg = kept;
      size(w, h);
      markPicked();
      say('');
      redraw();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      say('That file is not a picture this phone can open. A screenshot works.');
    };
    img.src = url;
  });

  const tplRow = document.getElementById('meme-templates');
  const tplButtons = [];
  TEMPLATES.forEach((tpl) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'meme-pick' + (tpl.upload ? ' is-upload' : '');
    b.setAttribute('role', 'radio');
    b.dataset.id = tpl.id;
    if (tpl.upload) {
      b.innerHTML = '<span class="meme-pick-art meme-pick-plus"><svg viewBox="0 0 24 24" aria-hidden="true">'
        + '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></span>';
    } else if (tpl.src) {
      b.innerHTML = '<span class="meme-pick-art' + (tpl.fit === 'art' ? ' is-dark' : '') + '"><img src="'
        + tpl.src + '" alt="" loading="lazy" decoding="async" /></span>';
    } else {
      b.innerHTML = '<span class="meme-pick-art is-dark is-blank"></span>';
    }
    const label = document.createElement('span');
    label.className = 'meme-pick-label';
    label.textContent = tpl.label;
    b.appendChild(label);
    b.addEventListener('click', () => useTemplate(tpl));
    tplRow.appendChild(b);
    tplButtons.push(b);
  });
  function markPicked() {
    tplButtons.forEach((b) => {
      const on = b.dataset.id === state.tpl.id;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  // ---- The words ----
  const topIn = document.getElementById('meme-top');
  const bottomIn = document.getElementById('meme-bottom');
  topIn.addEventListener('input', () => { state.top = topIn.value; redraw(); });
  bottomIn.addEventListener('input', () => { state.bottom = bottomIn.value; redraw(); });
  const styleRow = document.getElementById('meme-styles');
  styleRow.querySelectorAll('[data-style]').forEach((b) => {
    b.addEventListener('click', () => {
      state.style = b.dataset.style;
      styleRow.querySelectorAll('[data-style]').forEach((o) => {
        const on = o === b;
        o.classList.toggle('is-on', on);
        o.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      redraw();
    });
  });

  // ---- Stickers ----
  const selBar = document.getElementById('meme-sel');
  function pick(i) {
    state.sel = i;
    selBar.hidden = i < 0;
    redraw();
  }
  const stickRow = document.getElementById('meme-stickers');
  STICKERS.forEach((art) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'meme-stick';
    b.setAttribute('aria-label', 'Add sticker');
    b.innerHTML = '<img src="' + art.src + '" alt="" loading="lazy" decoding="async"'
      + (art.round ? ' class="is-round"' : '') + ' />';
    b.addEventListener('click', () => {
      load(art.src).then((img) => {
        // Each new one lands a little off the last, so a second of the same
        // sticker is not hidden exactly under the first.
        const n = state.stickers.length;
        state.stickers.push({
          art: img,
          round: !!art.round,
          nx: 0.5 + ((n % 3) - 1) * 0.08,
          ny: 0.5 + ((n % 2) ? 0.06 : -0.04),
          nw: art.size,
          rot: 0,
          flip: false,
        });
        pick(state.stickers.length - 1);
      }).catch(() => say('That sticker would not load.'));
    });
    stickRow.appendChild(b);
  });
  document.getElementById('sel-flip').addEventListener('click', () => {
    const s = state.stickers[state.sel];
    if (s) { s.flip = !s.flip; redraw(); }
  });
  document.getElementById('sel-front').addEventListener('click', () => {
    const s = state.stickers[state.sel];
    if (!s) return;
    state.stickers.splice(state.sel, 1);
    state.stickers.push(s);
    pick(state.stickers.length - 1);
  });
  function removePicked() {
    if (state.sel < 0) return;
    state.stickers.splice(state.sel, 1);
    pick(-1);
  }
  document.getElementById('sel-remove').addEventListener('click', removePicked);
  document.addEventListener('keydown', (e) => {
    if (state.sel < 0) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removePicked(); }
    if (e.key === 'Escape') pick(-1);
  });

  // ---- Moving them ----
  // One finger moves the picked sticker. The corner handle sizes and turns
  // it, and two fingers anywhere on the picture do the same as a pinch.
  function toPicture(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (state.W / r.width),
      y: (e.clientY - r.top) * (state.H / r.height),
    };
  }
  function hit(p) {
    for (let i = state.stickers.length - 1; i >= 0; i--) {
      const s = state.stickers[i];
      const b = stickerBox(s);
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const c = Math.cos(-s.rot);
      const n = Math.sin(-s.rot);
      const lx = dx * c - dy * n;
      const ly = dx * n + dy * c;
      if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) return i;
    }
    return -1;
  }
  const fingers = new Map();
  let grab = null;
  canvas.addEventListener('pointerdown', (e) => {
    const p = toPicture(e);
    fingers.set(e.pointerId, p);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    const s = state.stickers[state.sel];
    if (fingers.size === 2 && s) {
      const [a, b] = [...fingers.values()];
      grab = { mode: 'pinch', s, dist: Math.hypot(b.x - a.x, b.y - a.y),
        ang: Math.atan2(b.y - a.y, b.x - a.x), nw: s.nw, rot: s.rot };
      return;
    }
    if (s) {
      const h = handleAt(s);
      if (Math.hypot(p.x - h.x, p.y - h.y) <= HANDLE() * 1.6) {
        const b = stickerBox(s);
        grab = { mode: 'turn', s, dist: Math.hypot(p.x - b.x, p.y - b.y),
          ang: Math.atan2(p.y - b.y, p.x - b.x), nw: s.nw, rot: s.rot };
        e.preventDefault();
        return;
      }
    }
    const i = hit(p);
    pick(i);
    if (i >= 0) {
      const t = state.stickers[i];
      grab = { mode: 'move', s: t, dx: p.x - t.nx * state.W, dy: p.y - t.ny * state.H };
      e.preventDefault();
    } else {
      grab = null;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    const p = toPicture(e);
    fingers.set(e.pointerId, p);
    if (!grab) return;
    const s = grab.s;
    if (grab.mode === 'move') {
      s.nx = Math.min(1.1, Math.max(-0.1, (p.x - grab.dx) / state.W));
      s.ny = Math.min(1.1, Math.max(-0.1, (p.y - grab.dy) / state.H));
    } else if (grab.mode === 'turn') {
      const b = stickerBox(s);
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      s.nw = Math.min(2.2, Math.max(0.06, grab.nw * dist / Math.max(1, grab.dist)));
      s.rot = grab.rot + Math.atan2(p.y - b.y, p.x - b.x) - grab.ang;
    } else if (grab.mode === 'pinch' && fingers.size >= 2) {
      const [a, b] = [...fingers.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      s.nw = Math.min(2.2, Math.max(0.06, grab.nw * dist / Math.max(1, grab.dist)));
      s.rot = grab.rot + Math.atan2(b.y - a.y, b.x - a.x) - grab.ang;
    }
    redraw();
  });
  function letGo(e) {
    fingers.delete(e.pointerId);
    if (fingers.size === 0) grab = null;
    else if (grab && grab.mode === 'pinch') grab = null;
  }
  canvas.addEventListener('pointerup', letGo);
  canvas.addEventListener('pointercancel', letGo);
  // A wheel over a picked sticker sizes it, on a desk.
  canvas.addEventListener('wheel', (e) => {
    const s = state.stickers[state.sel];
    if (!s) return;
    e.preventDefault();
    s.nw = Math.min(2.2, Math.max(0.06, s.nw * (e.deltaY < 0 ? 1.06 : 1 / 1.06)));
    redraw();
  }, { passive: false });

  // ---- Out ----
  // The picked outline is left off anything that is saved.
  function finished() {
    draw(true);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => { draw(false); resolve(blob); }, 'image/png');
    });
  }
  const NAME = 'boozebag-meme.png';
  function flash(btn, text, back) {
    const label = btn.querySelector('.btn-label') || btn;
    label.textContent = text;
    setTimeout(() => { label.textContent = back; }, 1600);
  }

  const dl = document.getElementById('meme-download');
  dl.addEventListener('click', () => {
    finished().then((blob) => {
      if (!blob) { say('That did not save. Try again.'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash(dl, 'Saved', 'Download');
    });
  });

  // Sending a picture straight into another app is a phone thing, and only
  // some of them. The button is only there where it works.
  const shareBtn = document.getElementById('meme-share');
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], NAME, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [probe] })) shareBtn.hidden = false;
  } catch (e) { /* no sharing here */ }
  shareBtn.addEventListener('click', () => {
    finished().then((blob) => {
      if (!blob) return;
      const file = new File([blob], NAME, { type: 'image/png' });
      navigator.share({ files: [file], text: '$BOOZEBAG boozebag.us' }).catch(() => { /* closed */ });
    });
  });

  // And a picture on the clipboard, where a browser allows it.
  const copyBtn = document.getElementById('meme-copy');
  if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write
    && shareBtn.hidden) {
    copyBtn.hidden = false;
  }
  copyBtn.addEventListener('click', () => {
    // Handed a promise rather than the finished picture, which is what
    // Safari needs to keep treating it as a press.
    const item = new window.ClipboardItem({ 'image/png': finished() });
    navigator.clipboard.write([item]).then(
      () => flash(copyBtn, 'Copied', 'Copy image'),
      () => say('This browser would not copy a picture. Download it instead.'),
    );
  });

  // X will not take a picture through a link, so this opens the post with
  // the words and the site, and says to attach the one just saved.
  const post = document.getElementById('meme-post');
  post.href = 'https://x.com/intent/post?text='
    + encodeURIComponent('Made this on boozebag.us $BOOZEBAG')
    + '&url=' + encodeURIComponent('https://boozebag.us/meme.html');
  post.addEventListener('click', () => {
    say('Save it first, then add the picture to the post.');
  });

  // ---- Starting over ----
  document.getElementById('meme-reset').addEventListener('click', () => {
    state.stickers = [];
    state.top = '';
    state.bottom = '';
    topIn.value = '';
    bottomIn.value = '';
    pick(-1);
    useTemplate(TEMPLATES[1]);
    say('');
  });

  // ---- First picture ----
  // Drawn as soon as the poster is in, and again once Anton has arrived, so
  // the words never stay in a stand-in face.
  // A phone gets the square one first: a wide poster on a narrow screen is
  // a strip, and memes on a phone go out square.
  const first = window.matchMedia && window.matchMedia('(max-width: 600px)').matches
    ? TEMPLATES[2] : TEMPLATES[1];
  useTemplate(first);
  if (document.fonts && document.fonts.load) {
    document.fonts.load('80px Anton').then(redraw, () => {});
    if (document.fonts.ready) document.fonts.ready.then(redraw, () => {});
  }
}());
