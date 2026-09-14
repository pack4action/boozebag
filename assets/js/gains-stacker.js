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
  // Three ways a block can land rather than two. Dead centre keeps the
  // whole plate; near enough loses only the sliver it missed by; anything
  // else is trimmed to the overlap the way it always was. The middle one is
  // the point: with only PERFECT and a full trim, a drop two pixels out and
  // a drop twenty pixels out cost the same, so there was nothing to aim at
  // once you knew you had missed.
  const SNAP_SLOP = 4;
  const CLOSE_SLOP = 15;
  const MIN_SPEED = 2.2;
  const MAX_SPEED = 9.5;
  const SPEED_STEP = 0.1;
  // Past this height the plate stops sliding at one speed: it eases into
  // the turns and hurries through the middle, so the moment it is over the
  // tower is not the moment it looks like it is. Faded in over the next
  // twenty five so nobody has a drop change under them.
  const WOBBLE_FROM = 18;
  const WOBBLE_OVER = 25;
  const WOBBLE_DEPTH = 0.45;
  // Getting the width back. One is the reward for a clean run and the other
  // is the floor under a bad one, so a tower that has been whittled down is
  // never quite unrecoverable.
  const REBUILD_EVERY = 4;    // perfects in a row
  const REBUILD_GROWTH = 0.2;
  const POWERUP_INTERVAL = 15; // every Nth block stacked
  const POWERUP_GROWTH = 0.22;
  const MISS_WORDS = ['DAMMIT', 'SHIT', 'FUCK', 'AW HELL', 'GODDAMMIT', 'BULLSHIT'];
  // Weight-plate colors, echoing real bumper-plate conventions while staying
  // in the site's warm palette.
  const PLATES = [
    { color: '#e3a83b', label: '45' },
    { color: '#c0483a', label: '35' },
    { color: '#3d7a9e', label: '25' },
    { color: '#4f9d6e', label: '10' },
    { color: '#3a3632', label: '5' },
  ];

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

  const leaderboard = window.BoozebagLeaderboard.makeLeaderboard('gains-stacker', 'gainsStackerLeaderboard');
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

  function pickPlate() {
    return PLATES[Math.floor(Math.random() * PLATES.length)];
  }

  // What a plate is worth where it lands. The fiftieth is a harder drop
  // than the fifth, on a narrower tower moving faster, and it ought to pay
  // like one: a flat ten a block meant the back half of a run was the same
  // money as the front half for far more work.
  function plateValue(height) {
    return 10 + Math.floor(height * 0.9);
  }

  // ---- Game state ----
  let stack, active, debris, particles, cameraOffset, cameraTarget, score, combo, gameOver;
  // How hard the room is still rocking from the last bad drop, in pixels.
  let shake = 0;

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
    // Each block spawns at the width of whatever it's about to land on, so
    // an off-center drop permanently narrows the tower from then on.
    const w = top.w;
    const speed = Math.min(MIN_SPEED + n * SPEED_STEP, MAX_SPEED);
    const dir = Math.random() < 0.5 ? -1 : 1;
    const x = dir === 1 ? 30 : W - 30 - w;

    const plate = pickPlate();
    active = { x, w, y: top.y - BLOCK_H, dir, speed, color: plate.color, label: plate.label };
    cameraTarget = Math.max(0, CEILING_Y - active.y);
  }

  function reset() {
    stack = [{ x: (W - BASE_W) / 2, w: BASE_W, y: BASE_TOP_Y, h: BASE_H, color: '#2b2724', isBase: true }];
    debris = [];
    particles = [];
    shake = 0;
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

  // Wider, up to the width it started at. Nothing ever grows past the base:
  // a tower that got broader than its own foundations would undo the whole
  // point of stacking carefully. The caller says what to put on the screen,
  // because a reward that lands on the same frame as a drop has to share
  // one line with it rather than wipe it.
  function widen(by, colour) {
    const top = stack[stack.length - 1];
    const growBy = Math.min(top.w * by, Math.max(0, BASE_W - top.w));
    if (growBy < 1) return false;
    top.w += growBy;
    top.x = Math.max(0, Math.min(W - top.w, top.x - growBy / 2));
    spawnPerfectBurst(top.x + top.w / 2, top.y + BLOCK_H / 2, colour);
    return true;
  }
  // A run of clean drops buys the tower some of its width back. This is the
  // one that makes a perfect worth chasing rather than just worth points:
  // four in a row and the thing you are stacking onto is bigger than it was.
  function maybeRebuild(landedPerfect) {
    // Only a fresh perfect pays this. A near miss keeps the run alive but
    // does not earn it again, otherwise every close drop after a fourth
    // perfect would hand out width for nothing.
    if (!landedPerfect || !combo || combo % REBUILD_EVERY !== 0) return '';
    return widen(REBUILD_GROWTH, '#ffd28a') ? ' \u00b7 WIDER' : '';
  }
  // Every fifteenth plate is a gift. If the tower is already as broad as the
  // base there is no width to give, so it pays out instead: a milestone that
  // quietly does nothing is worse than no milestone at all.
  function maybeTriggerPowerup(height) {
    if (height === 0 || height % POWERUP_INTERVAL !== 0) return '';
    if (widen(POWERUP_GROWTH, '#8ecbff')) return ' \u00b7 PLATE ' + height + ', WIDER';
    const gift = plateValue(height) * 3;
    score += gift;
    spawnPerfectBurst(stack[stack.length - 1].x + stack[stack.length - 1].w / 2,
      stack[stack.length - 1].y + BLOCK_H / 2, '#8ecbff');
    return ' \u00b7 PLATE ' + height + ', +' + gift;
  }

  function endGame() {
    gameOver = true;
    const height = stack.length - 1;
    best = submitScore(score);
    overlayTitle.textContent = 'TOWER TOPPLED';
    overlayScore.textContent = 'Final bag: $' + score + ', height ' + height;
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
      shake = 16;
      endGame();
      return;
    }

    let placedX, placedW;
    let said = '';
    let tone = null;

    const activeCenter = active.x + active.w / 2;
    const topCenter = top.x + top.w / 2;
    const miss = Math.abs(activeCenter - topCenter);
    const height = stack.length; // what this plate's own height will be
    const worth = plateValue(height);
    if (miss <= SNAP_SLOP) {
      // Dead centre: snap it flush, full width, no overhang, no trim -- a
      // genuine PERFECT rather than a generous tolerance check.
      placedX = Math.max(0, Math.min(W - active.w, topCenter - active.w / 2));
      placedW = active.w;
      combo++;
      const bonus = Math.round(worth * (1 + combo * 0.3));
      score += bonus;
      said = combo > 1 ? 'PERFECT x' + combo + '! +' + bonus : 'PERFECT! +' + bonus;
      tone = 'legend-moon';
      spawnPerfectBurst(placedX + placedW / 2, newY + BLOCK_H / 2, '#ffd28a');
    } else if (miss <= CLOSE_SLOP) {
      // Near enough: it settles into place and loses only what it missed
      // by, rather than the whole overhang. The run of perfects survives
      // but does not grow, so a tidy player is not punished for a near
      // thing and is not rewarded for it either.
      const lost = miss - SNAP_SLOP;
      placedW = Math.max(MIN_OVERLAP, active.w - lost);
      placedX = Math.max(0, Math.min(W - placedW, topCenter - placedW / 2));
      spawnOverhangDebris(active, placedX, placedW, newY);
      score += worth;
      said = 'NICE +' + worth;
    } else {
      placedX = overlapLeft;
      placedW = overlapW;
      spawnOverhangDebris(active, placedX, placedW, newY);
      combo = 0;
      shake = Math.min(9, 3 + (active.w - placedW) / 14);
      score += Math.round(worth * 0.5);
      said = '+' + Math.round(worth * 0.5);
    }

    stack.push({ x: placedX, w: placedW, y: newY, h: BLOCK_H, color: active.color, label: active.label });
    // The rewards are worked out before anything is said, so a drop and the
    // gift it earned go on one line instead of one wiping the other out.
    said += maybeRebuild(miss <= SNAP_SLOP);
    said += maybeTriggerPowerup(stack.length - 1);
    toast(said, tone);
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
      // Slow at the turns and quick through the middle, more so the higher
      // the tower goes. A plate that crosses the middle at one speed is a
      // plate you can time by counting; one that does not has to be read.
      const height = stack.length - 1;
      const ease = Math.max(0, Math.min(1, (height - WOBBLE_FROM) / WOBBLE_OVER));
      const span = Math.max(1, W - active.w);
      const along = Math.max(0, Math.min(1, active.x / span));
      const swing = 1 + WOBBLE_DEPTH * ease * (Math.sin(along * Math.PI) * 2 - 1);
      active.x += active.dir * active.speed * swing;
      if (active.x <= 0) { active.x = 0; active.dir = 1; }
      if (active.x + active.w >= W) { active.x = W - active.w; active.dir = -1; }
    }
    cameraOffset += (cameraTarget - cameraOffset) * 0.16;
    shake *= 0.85;
    if (shake < 0.3) shake = 0;

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
    g.addColorStop(0, '#171310');
    g.addColorStop(1, '#332a20');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // rack uprights framing the lane
    const uprightW = 26;
    ctx.fillStyle = '#100d0b';
    ctx.fillRect(0, 0, uprightW, H);
    ctx.fillRect(W - uprightW, 0, uprightW, H);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(uprightW - 3, 0, 3, H);
    ctx.fillRect(W - uprightW, 0, 3, H);

    // peg holes with hanging plate silhouettes, scrolling with the world
    const pegSpacing = 90;
    const pegOffset = ((cameraOffset % pegSpacing) + pegSpacing) % pegSpacing;
    for (let y = -pegSpacing + pegOffset; y < H + pegSpacing; y += pegSpacing) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(uprightW / 2, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(227,168,59,0.16)';
      ctx.beginPath();
      ctx.ellipse(uprightW / 2 + 9, y, 7, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      const y2 = y + pegSpacing / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(W - uprightW / 2, y2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(61,122,158,0.16)';
      ctx.beginPath();
      ctx.ellipse(W - uprightW / 2 - 9, y2, 7, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // The climb, written up the rack. Every fifth plate gets a line and a
    // number and every fifteenth gets the bright one, so the next gift is
    // always something you can see coming rather than a surprise.
    ctx.textBaseline = 'middle';
    ctx.font = '700 11px Anton, sans-serif';
    for (let n = 5; n <= 400; n += 5) {
      const y = BASE_TOP_Y - n * BLOCK_H + BLOCK_H / 2 + cameraOffset;
      if (y < -20) break;
      if (y > H + 20) continue;
      const big = n % POWERUP_INTERVAL === 0;
      ctx.fillStyle = big ? 'rgba(142,203,255,0.55)' : 'rgba(255,255,255,0.16)';
      ctx.fillRect(uprightW, y - 1, big ? 16 : 9, 2);
      ctx.fillRect(W - uprightW - (big ? 16 : 9), y - 1, big ? 16 : 9, 2);
      ctx.textAlign = 'left';
      ctx.fillText(String(n), uprightW + 20, y);
      ctx.textAlign = 'right';
      ctx.fillText(String(n), W - uprightW - 20, y);
    }

    // rubber floor speckle, scrolling
    const tile = 46;
    const offset = ((cameraOffset % tile) + tile) % tile;
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#000';
    for (let y = -tile + offset; y < H + tile; y += tile) {
      for (let x = uprightW; x < W - uprightW; x += tile) {
        ctx.beginPath();
        ctx.arc(x + tile / 2, y + tile / 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // hanging gym light, world-anchored -- scrolls away as the tower grows
    const lampScreenY = -40 + cameraOffset;
    if (lampScreenY > -80 && lampScreenY < H + 80) {
      const glow = ctx.createRadialGradient(W / 2, lampScreenY, 10, W / 2, lampScreenY, 190);
      glow.addColorStop(0, 'rgba(255,210,140,0.20)');
      glow.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0d0b09';
      ctx.fillRect(W / 2 - 3, lampScreenY - 30, 6, 30);
      ctx.save();
      ctx.shadowColor = 'rgba(255,210,140,0.9)';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#ffdca0';
      ctx.beginPath();
      ctx.ellipse(W / 2, lampScreenY, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // vignette
    const vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.45, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function drawBlock(b) {
    const screenY = b.y + cameraOffset;
    if (screenY > H + 10 || screenY + b.h < -10) return;
    const r = Math.min(10, b.h / 2, b.w / 2);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, screenY + b.h + 3, Math.max(4, (b.w / 2) * 0.9), 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createLinearGradient(0, screenY, 0, screenY + b.h);
    grad.addColorStop(0, shade(b.color, 30));
    grad.addColorStop(0.15, shade(b.color, 8));
    grad.addColorStop(0.85, shade(b.color, -10));
    grad.addColorStop(1, shade(b.color, -32));
    ctx.beginPath();
    ctx.roundRect(b.x, screenY, b.w, b.h, r);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(b.x + 2, screenY + 2, Math.max(0, b.w - 4), Math.max(3, b.h * 0.22), r * 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();

    if (b.w > 40) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.w / 2 - 1, screenY + 3, 2, b.h - 6);
    }

    if (b.label && b.w > 34) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 12px Anton, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x + b.w / 2, screenY + b.h / 2 + 1);
    }
  }

  function drawBase(b) {
    const screenY = b.y + cameraOffset;
    const barH = 10;
    const barY = screenY + b.h / 2 - barH / 2;
    const overhang = 22;

    const barGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
    barGrad.addColorStop(0, '#9a9aa0');
    barGrad.addColorStop(0.5, '#d4d4da');
    barGrad.addColorStop(1, '#74747a');
    ctx.fillStyle = barGrad;
    ctx.fillRect(b.x - overhang, barY, b.w + overhang * 2, barH);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x - overhang, barY, b.w + overhang * 2, barH);

    ctx.fillStyle = '#4a4a50';
    ctx.fillRect(b.x - overhang - 4, barY - 4, 8, barH + 8);
    ctx.fillRect(b.x + b.w + overhang - 4, barY - 4, 8, barH + 8);

    drawBlock(b);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawBackground();

    stack.forEach((b, i) => { if (i === 0) drawBase(b); else drawBlock(b); });

    if (active) {
      drawBlock({ x: active.x, y: active.y, w: active.w, h: BLOCK_H, color: active.color, label: active.label });
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
    ctx.restore();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  reset();
  loop();
})();
