(function () {
  const canvas = document.getElementById('stacker-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;

  const BLOCK_H = 42;
  const BASE_W = 200;
  const BASE_H = 56;
  const BASE_BOTTOM_Y = 650;
  const BASE_TOP_Y = BASE_BOTTOM_Y - BASE_H;
  const CEILING_Y = 220; // once the tower grows this high on screen, the camera starts following
  const MIN_OVERLAP = 5;
  const SNAP_SLOP = 4; // how close to dead-center counts as a PERFECT snap
  const MIN_SPEED = 2.2;
  const MAX_SPEED = 7.5;
  const SPEED_STEP = 0.09;
  const MISS_WORDS = ['DAMMIT', 'SHIT', 'FUCK', 'AW HELL', 'GODDAMMIT', 'BULLSHIT'];
  const PALETTE = ['#e0a45c', '#5ec4c9', '#d97a5c', '#c9a86a', '#7a9e6e'];

  // ---- Persistence (local for now; see wallet.js/leaderboard.js for why) ----
  const STORAGE_KEY = 'gainsStackerHighScore';
  function getBestScore() {
    return Number(localStorage.getItem(STORAGE_KEY) || 0);
  }
  function submitScore(score) {
    const best = getBestScore();
    if (score > best) {
      localStorage.setItem(STORAGE_KEY, String(score));
      return score;
    }
    return best;
  }

  const leaderboard = window.BoozebagLeaderboard.makeLeaderboard('gainsStackerLeaderboard');
  const leaderboardList = document.getElementById('leaderboard-list');
  const leaderboardEmpty = document.getElementById('leaderboard-empty');
  function renderLeaderboard() {
    leaderboard.render(leaderboardList, leaderboardEmpty, (h) => 'height ' + h, (score) => '$' + score);
  }

  let connectedWallet = null;
  if (window.BoozebagWallet) {
    window.BoozebagWallet.attachUI({
      onChange(address) { connectedWallet = address; },
      onError(msg) { toast(msg, 'legend-rug'); },
    });
  } else {
    document.getElementById('btn-connect').hidden = true;
  }

  const hudScore = document.getElementById('hud-score');
  const hudHeight = document.getElementById('hud-height');
  const hudCombo = document.getElementById('hud-combo');
  const hudBest = document.getElementById('hud-best');
  const toastEl = document.getElementById('game-toast');
  const overlay = document.getElementById('game-overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayScore = document.getElementById('overlay-score');
  const overlayBest = document.getElementById('overlay-best');
  const btnReplay = document.getElementById('btn-replay');

  let best = getBestScore();
  hudBest.textContent = best;
  renderLeaderboard();

  function toast(msg, cls) {
    toastEl.textContent = msg;
    toastEl.className = 'game-toast show' + (cls ? ' ' + cls : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.classList.remove('show'); }, 900);
  }

  function shade(hex, amt) {
    const c = hex.replace('#', '');
    const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
    let r = (num >> 16) + amt;
    let g = ((num >> 8) & 0xff) + amt;
    let b = (num & 0xff) + amt;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `rgb(${r},${g},${b})`;
  }

  function pickColor() {
    return PALETTE[Math.floor(Math.random() * PALETTE.length)];
  }

  // ---- Game state ----
  let stack, active, debris, particles, cameraOffset, cameraTarget, score, combo, gameOver;

  function spawnPerfectBurst(x, y, color) {
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const speed = 1.5 + Math.random() * 2.8;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 32,
        color,
      });
    }
  }

  function spawnActive() {
    const n = stack.length - 1; // blocks placed so far, base excluded
    const top = stack[stack.length - 1];
    // Always spawn a fresh, full-size block regardless of how narrow the
    // last placement ended up -- a bad drop trims that one block, but
    // doesn't compound into a permanently shrinking tower.
    const w = BASE_W;
    const speed = Math.min(MIN_SPEED + n * SPEED_STEP, MAX_SPEED);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const x = dir === 1 ? 30 : W - 30 - w;

    active = { x, w, y: top.y - BLOCK_H, dir, speed, color: pickColor() };
    cameraTarget = Math.max(0, CEILING_Y - active.y);
  }

  function reset() {
    stack = [{ x: (W - BASE_W) / 2, w: BASE_W, y: BASE_TOP_Y, h: BASE_H, color: '#4a3320' }];
    debris = [];
    particles = [];
    score = 0;
    combo = 0;
    gameOver = false;
    hudScore.textContent = 0;
    hudHeight.textContent = 0;
    hudCombo.textContent = 0;
    spawnActive();
    cameraOffset = cameraTarget;
    overlay.hidden = true;
  }

  function spawnOverhangDebris(block, placedX, placedW, y) {
    if (placedX > block.x + 0.5) {
      const cutW = placedX - block.x;
      debris.push({ x: block.x, y, w: cutW, h: BLOCK_H, color: block.color, vx: -2.2, vy: -1, rot: 0, vr: -0.15 });
    }
    const rightCutStart = placedX + placedW;
    const rightCutEnd = block.x + block.w;
    if (rightCutEnd > rightCutStart + 0.5) {
      const cutW = rightCutEnd - rightCutStart;
      debris.push({ x: rightCutStart, y, w: cutW, h: BLOCK_H, color: block.color, vx: 2.2, vy: -1, rot: 0, vr: 0.15 });
    }
  }

  function endGame() {
    gameOver = true;
    const height = stack.length - 1;
    best = submitScore(score);
    overlayTitle.textContent = 'TOWER TOPPLED';
    overlayScore.textContent = 'Final bag: $' + score + ' — height ' + height;
    overlayBest.textContent = 'Best bag: $' + best;
    hudBest.textContent = best;
    if (connectedWallet) {
      leaderboard.upsert(connectedWallet, score, height);
      renderLeaderboard();
    }
    overlay.hidden = false;
  }

  function drop() {
    if (gameOver || !active) return;
    const top = stack[stack.length - 1];
    const overlapLeft = Math.max(active.x, top.x);
    const overlapRight = Math.min(active.x + active.w, top.x + top.w);
    const overlapW = overlapRight - overlapLeft;
    const newY = active.y;

    if (overlapW < MIN_OVERLAP) {
      debris.push({ x: active.x, y: newY, w: active.w, h: BLOCK_H, color: active.color, vx: active.dir * 2.4, vy: -2, rot: 0, vr: active.dir * 0.14 });
      active = null;
      toast(MISS_WORDS[Math.floor(Math.random() * MISS_WORDS.length)], 'legend-rekt');
      endGame();
      return;
    }

    let placedX, placedW;

    const activeCenter = active.x + active.w / 2;
    const topCenter = top.x + top.w / 2;
    const isSnap = Math.abs(activeCenter - topCenter) <= SNAP_SLOP;
    if (isSnap) {
      // Close enough to dead-center: snap it flush, full width, no
      // overhang, no trim -- a genuine PERFECT rather than just a
      // generous tolerance check.
      placedX = Math.max(0, Math.min(W - active.w, topCenter - active.w / 2));
      placedW = active.w;
      combo++;
      const bonus = 10 + combo * 2;
      score += bonus;
      toast(combo > 1 ? 'PERFECT x' + combo + '! +' + bonus : 'PERFECT! +' + bonus, 'legend-moon');
      spawnPerfectBurst(placedX + placedW / 2, newY + BLOCK_H / 2, '#ffd28a');
    } else {
      placedX = overlapLeft;
      placedW = overlapW;
      spawnOverhangDebris(active, placedX, placedW, newY);
      combo = 0;
      score += 10;
      toast('+10', null);
    }

    stack.push({ x: placedX, w: placedW, y: newY, h: BLOCK_H, color: active.color });
    hudScore.textContent = score;
    hudHeight.textContent = stack.length - 1;
    hudCombo.textContent = combo;
    active = null;
    setTimeout(spawnActive, 90);
  }

  canvas.addEventListener('mousedown', drop);
  canvas.addEventListener('touchstart', (e) => { drop(); e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); drop(); }
  });
  btnReplay.addEventListener('click', reset);

  function update() {
    if (!gameOver && active) {
      active.x += active.dir * active.speed;
      if (active.x <= 0) { active.x = 0; active.dir = 1; }
      if (active.x + active.w >= W) { active.x = W - active.w; active.dir = -1; }
    }
    cameraOffset += (cameraTarget - cameraOffset) * 0.16;

    for (const d of debris) {
      d.vy += 0.5;
      d.x += d.vx;
      d.y += d.vy;
      d.rot += d.vr;
    }
    debris = debris.filter((d) => d.y + cameraOffset < H + 150);

    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life--;
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#241a10');
    g.addColorStop(1, '#3a2814');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const tile = 140;
    const offset = ((cameraOffset % tile) + tile) % tile;
    ctx.save();
    for (let y = -tile + offset; y < H + tile; y += tile) {
      ctx.fillStyle = 'rgba(255,200,130,0.10)';
      ctx.fillRect(0, y, 14, 70);
      ctx.fillRect(W - 14, y, 14, 70);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 2;
    for (let y = -tile + offset; y < H + tile; y += tile / 2) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBlock(b) {
    const screenY = b.y + cameraOffset;
    if (screenY > H + 10 || screenY + b.h < -10) return;
    const grad = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
    grad.addColorStop(0, shade(b.color, -18));
    grad.addColorStop(0.5, b.color);
    grad.addColorStop(1, shade(b.color, -18));
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, screenY, b.w, b.h);
    ctx.fillStyle = shade(b.color, 26);
    ctx.fillRect(b.x, screenY, b.w, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, screenY, b.w, b.h);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    for (const b of stack) drawBlock(b);

    if (active) {
      drawBlock({ x: active.x, y: active.y, w: active.w, h: BLOCK_H, color: active.color });
    }

    for (const d of debris) {
      const screenY = d.y + cameraOffset;
      ctx.save();
      ctx.translate(d.x + d.w / 2, screenY + d.h / 2);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
      ctx.restore();
    }

    for (const p of particles) {
      const screenY = p.y + cameraOffset;
      ctx.globalAlpha = Math.max(p.life / 32, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, screenY, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  reset();
  loop();
})();
