(function () {
  const canvas = document.getElementById('pong-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;

  const GRAVITY = 0.34;
  const WALL_DAMP = 0.72;
  const MAX_PULL = 120;
  const POWER = 0.16;
  const CAN_R = 15;
  const ANCHOR = { x: W / 2, y: 610 };
  const TOTAL_BALLS = 5;
  const CUP_HIT_MULT = 0.52;
  const MAX_LANDING_SPEED = 8;
  const MISS_WORDS = ['DAMMIT', 'SHIT', 'FUCK', 'AW HELL', 'GODDAMMIT', 'BULLSHIT'];

  // ---- Persistence (local for now; structured so a backend/wallet layer can
  // slot in later without touching game logic) ----
  const STORAGE_KEY = 'degenPongHighScore';
  function getBestScore() {
    return Number(localStorage.getItem(STORAGE_KEY) || 0);
  }
  function submitScore(score) {
    // TODO: once a leaderboard exists, POST { wallet, score } here too.
    const best = getBestScore();
    if (score > best) {
      localStorage.setItem(STORAGE_KEY, String(score));
      return score;
    }
    return best;
  }

  // ---- Cups ----
  // Slot positions are fixed (physics/reachability was tuned around these
  // exact spots); which cup type lands in which slot is shuffled instead,
  // so the board layout changes each rack without breaking the tuning.
  const CUP_SLOTS = [
    { x: 190, y: 130, r: 22 },
    { x: 250, y: 130, r: 22 },
    { x: 310, y: 130, r: 22 },
    { x: 220, y: 186, r: 22 },
    { x: 280, y: 186, r: 22 },
    { x: 250, y: 242, r: 22 },
  ];
  const CUP_TYPES = [
    { label: 'MOON', points: 100, bonusCans: 3, fill: '#6fb98f' },
    { label: '10X', points: 75, bonusCans: 1, fill: '#f0a94e' },
    { label: 'DIAMOND\nHANDS', points: 60, bonusCans: 1, fill: '#5ec4c9' },
    { label: 'PAPER\nHANDS', points: 20, bonusCans: 1, fill: '#d9c3a3' },
    { label: 'REKT', points: 10, bonusCans: 1, fill: '#d9634f' },
    { label: 'RUG', points: -50, bonusCans: 0, fill: '#5c3427' },
  ];

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function makeCups() {
    const types = shuffled(CUP_TYPES);
    return CUP_SLOTS.map((slot, i) => ({ ...slot, ...types[i], sunk: false }));
  }

  let cups = makeCups();
  let ball = null;
  let ballsLeft = TOTAL_BALLS;
  let score = 0;
  let rack = 1;
  let best = getBestScore();
  let dragging = false;
  let dragPos = null;
  let gameOver = false;
  let particles = [];

  const hudScore = document.getElementById('hud-score');
  const hudBalls = document.getElementById('hud-balls');
  const hudRack = document.getElementById('hud-rack');
  const hudBest = document.getElementById('hud-best');
  const toastEl = document.getElementById('game-toast');
  const overlay = document.getElementById('game-overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayScore = document.getElementById('overlay-score');
  const overlayBest = document.getElementById('overlay-best');
  const btnReplay = document.getElementById('btn-replay');

  hudBest.textContent = best;

  function resetBall() {
    ball = { x: ANCHOR.x, y: ANCHOR.y, vx: 0, vy: 0, flying: false };
  }
  resetBall();

  function toast(msg, cls) {
    toastEl.textContent = msg;
    toastEl.className = 'game-toast show' + (cls ? ' ' + cls : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.classList.remove('show'); }, 900);
  }

  function spawnBurst(x, y, color) {
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const speed = 2 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 40,
        color,
      });
    }
  }

  function pointerToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function distToAnchor(p) {
    return Math.hypot(p.x - ANCHOR.x, p.y - ANCHOR.y);
  }

  function startDrag(clientX, clientY) {
    if (gameOver || ball.flying || ballsLeft <= 0) return;
    const p = pointerToCanvas(clientX, clientY);
    if (distToAnchor(p) > 70) return;
    dragging = true;
    dragPos = p;
  }

  function moveDrag(clientX, clientY) {
    if (!dragging) return;
    dragPos = pointerToCanvas(clientX, clientY);
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    let dx = ANCHOR.x - dragPos.x;
    let dy = ANCHOR.y - dragPos.y;
    const dist = Math.min(Math.hypot(dx, dy), MAX_PULL);
    if (dist < 12) { dragPos = null; return; }
    const angle = Math.atan2(dy, dx);
    dx = Math.cos(angle) * dist;
    dy = Math.sin(angle) * dist;
    ball.vx = dx * POWER;
    ball.vy = dy * POWER;
    ball.flying = true;
    dragPos = null;
  }

  canvas.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', endDrag);

  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    endDrag();
    e.preventDefault();
  }, { passive: false });

  function finishThrow() {
    ballsLeft--;
    hudBalls.textContent = Math.max(ballsLeft, 0);
    resetBall();
    const rackCleared = cups.filter((c) => c.label !== 'RUG').every((c) => c.sunk);
    if (rackCleared) {
      const bonus = 50;
      score += bonus;
      hudScore.textContent = score;
      toast('RACK CLEARED +' + bonus, 'legend-moon');
      setTimeout(startNextRack, 900);
    } else if (ballsLeft <= 0) {
      setTimeout(endGame, 500);
    }
  }

  function startNextRack() {
    rack++;
    hudRack.textContent = rack;
    cups = makeCups();
    ballsLeft = TOTAL_BALLS;
    hudBalls.textContent = ballsLeft;
  }

  function endGame() {
    gameOver = true;
    best = submitScore(score);
    overlayTitle.textContent = 'OUT OF CANS';
    overlayScore.textContent = 'Final bag: $' + score + ' — rack ' + rack;
    overlayBest.textContent = 'Best bag: $' + best;
    hudBest.textContent = best;
    overlay.hidden = false;
  }

  btnReplay.addEventListener('click', () => {
    cups = makeCups();
    ballsLeft = TOTAL_BALLS;
    score = 0;
    rack = 1;
    gameOver = false;
    particles = [];
    hudScore.textContent = 0;
    hudBalls.textContent = ballsLeft;
    hudRack.textContent = rack;
    resetBall();
    overlay.hidden = true;
  });

  function update() {
    if (ball.flying) {
      ball.vy += GRAVITY;
      ball.x += ball.vx;
      ball.y += ball.vy;

      if (ball.x - CAN_R < 0) { ball.x = CAN_R; ball.vx *= -WALL_DAMP; }
      if (ball.x + CAN_R > W) { ball.x = W - CAN_R; ball.vx *= -WALL_DAMP; }

      for (const cup of cups) {
        if (cup.sunk) continue;
        const d = Math.hypot(ball.x - cup.x, ball.y - cup.y);
        if (d < cup.r * CUP_HIT_MULT) {
          const speed = Math.hypot(ball.vx, ball.vy);
          const isSoftLanding = ball.vy > 0 && speed <= MAX_LANDING_SPEED;
          if (!isSoftLanding) continue;
          cup.sunk = true;
          score += cup.points;
          hudScore.textContent = score;
          if (cup.bonusCans > 0) ballsLeft += cup.bonusCans;
          const cls = cup.points >= 75 ? 'legend-moon' : cup.points >= 40 ? 'legend-10x' : cup.points > 0 ? 'legend-rekt' : 'legend-rug';
          const sign = cup.points > 0 ? '+' : cup.points < 0 ? '' : '';
          let msg = (cup.points !== 0 ? sign + cup.points + ' ' : '') + cup.label.replace('\n', ' ');
          if (cup.bonusCans > 0) msg += ' +' + cup.bonusCans + (cup.bonusCans > 1 ? ' cans' : ' can');
          toast(msg, cls);
          if (cup.points >= 60) spawnBurst(cup.x, cup.y, cup.fill);
          ball.flying = false;
          finishThrow();
          break;
        }
      }

      if (ball.flying && ball.y - CAN_R > H) {
        toast(MISS_WORDS[Math.floor(Math.random() * MISS_WORDS.length)], 'legend-rekt');
        ball.flying = false;
        finishThrow();
      }
    }

    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
    }
  }

  // ---- Static background scene (drawn once to an offscreen canvas; the
  // only thing that animates frame-to-frame is the can itself) ----
  const bg = document.createElement('canvas');
  bg.width = W;
  bg.height = H;
  const bgx = bg.getContext('2d');

  const TABLE_BACK_Y = 108;
  const TABLE_BACK_X0 = 168;
  const TABLE_BACK_X1 = 332;

  function drawStringLights(g, x0, y0, x1, y1, sag, colors) {
    // gentle catenary-ish sag using a quadratic curve
    const midX = (x0 + x1) / 2;
    const midY = Math.max(y0, y1) + sag;
    g.strokeStyle = 'rgba(90, 62, 40, 0.9)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(midX, midY, x1, y1);
    g.stroke();

    const bulbCount = 9;
    for (let i = 0; i <= bulbCount; i++) {
      const t = i / bulbCount;
      const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * midX + t * t * x1;
      const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * midY + t * t * y1;
      const color = colors[i % colors.length];
      g.save();
      g.shadowColor = color;
      g.shadowBlur = 9;
      g.fillStyle = color;
      g.beginPath();
      g.arc(bx, by + 3, 3.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  function drawCozyScene(g) {
    // warm back wall
    const wallGrad = g.createLinearGradient(0, 0, 0, 260);
    wallGrad.addColorStop(0, '#2e2119');
    wallGrad.addColorStop(1, '#463123');
    g.fillStyle = wallGrad;
    g.fillRect(0, 0, W, 260);

    // side wall shading (warm, not cold)
    g.fillStyle = 'rgba(20,12,6,0.32)';
    g.fillRect(0, 0, 95, 260);
    g.fillRect(W - 95, 0, 95, 260);

    // wood-paneled back wall
    g.fillStyle = '#523c2c';
    g.beginPath();
    g.roundRect(95, 45, W - 190, 165, 12);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 3;
    for (let i = 1; i < 5; i++) {
      const y = 45 + (165 / 5) * i;
      g.beginPath();
      g.moveTo(100, y);
      g.lineTo(W - 100, y);
      g.stroke();
    }

    // warm pendant lamp
    g.save();
    g.shadowColor = 'rgba(255, 200, 130, 0.95)';
    g.shadowBlur = 30;
    g.fillStyle = '#ffe3b0';
    g.beginPath();
    g.ellipse(W / 2, 26, 26, 15, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.fillStyle = '#3a2b20';
    g.fillRect(W / 2 - 2, 0, 4, 12);
    g.fillStyle = 'rgba(255,214,158,0.10)';
    g.beginPath();
    g.moveTo(W / 2 - 60, 35);
    g.lineTo(W / 2 + 60, 35);
    g.lineTo(W / 2 + 130, 220);
    g.lineTo(W / 2 - 130, 220);
    g.closePath();
    g.fill();

    // string lights strung across the back wall
    drawStringLights(g, 18, 58, W / 2 - 60, 40, 26, ['#ffd28a', '#ffb877', '#ffe3a8']);
    drawStringLights(g, W / 2 + 60, 40, W - 18, 58, 26, ['#ffe3a8', '#ffb877', '#ffd28a']);

    // left prop: warm glowing mug sign
    g.save();
    g.shadowColor = 'rgba(255, 190, 110, 0.8)';
    g.shadowBlur = 14;
    g.strokeStyle = '#ffc978';
    g.lineWidth = 2.5;
    g.beginPath();
    g.roundRect(14, 62, 62, 46, 10);
    g.stroke();
    g.fillStyle = 'rgba(255,190,110,0.14)';
    g.fill();
    g.fillStyle = '#ffc978';
    g.beginPath();
    g.roundRect(30, 74, 22, 22, 4);
    g.fill();
    g.beginPath();
    g.roundRect(52, 80, 8, 12, 3);
    g.stroke();
    g.fillStyle = '#fff3d9';
    g.beginPath();
    g.roundRect(30, 71, 22, 6, 3);
    g.fill();
    g.restore();

    // wooden keg barrel
    const kegGrad = g.createLinearGradient(14, 0, 66, 0);
    kegGrad.addColorStop(0, '#6b4a30');
    kegGrad.addColorStop(0.5, '#8f6440');
    kegGrad.addColorStop(1, '#5c3f28');
    g.fillStyle = kegGrad;
    g.beginPath();
    g.roundRect(14, 150, 52, 78, 10);
    g.fill();
    g.fillStyle = 'rgba(60,40,26,0.85)';
    g.fillRect(14, 168, 52, 6);
    g.fillRect(14, 204, 52, 6);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1.5;
    g.strokeRect(14, 150, 52, 78);

    // right prop: cozy pennant + drink shelf
    g.fillStyle = '#c96f4a';
    g.beginPath();
    g.moveTo(W - 78, 40);
    g.lineTo(W - 16, 40);
    g.lineTo(W - 16, 88);
    g.lineTo(W - 47, 78);
    g.lineTo(W - 78, 88);
    g.closePath();
    g.fill();
    g.fillStyle = '#fff3d9';
    g.font = '700 9px Inter, sans-serif';
    g.textAlign = 'center';
    g.fillText('DEGEN', W - 47, 58);
    g.fillText('MODE ON', W - 47, 70);

    const shelfGrad = g.createLinearGradient(W - 82, 0, W - 14, 0);
    shelfGrad.addColorStop(0, '#5c4230');
    shelfGrad.addColorStop(0.5, '#7a5a3e');
    shelfGrad.addColorStop(1, '#4a3524');
    g.fillStyle = shelfGrad;
    g.beginPath();
    g.roundRect(W - 82, 150, 68, 96, 8);
    g.fill();
    g.save();
    g.shadowColor = 'rgba(255, 200, 130, 0.55)';
    g.shadowBlur = 10;
    g.fillStyle = 'rgba(255, 210, 150, 0.16)';
    g.fillRect(W - 74, 158, 52, 80);
    g.restore();
    // bottle silhouettes on the shelf
    g.fillStyle = 'rgba(40,60,45,0.85)';
    [W - 66, W - 50, W - 34].forEach((bx) => {
      g.beginPath();
      g.roundRect(bx, 195, 10, 24, 3);
      g.fill();
    });
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 1.5;
    g.strokeRect(W - 82, 150, 68, 96);

    // floor beneath side props (warm wood, not cold concrete)
    g.fillStyle = '#241a13';
    g.fillRect(0, 260, W, H - 260);

    // table trapezoid
    g.beginPath();
    g.moveTo(TABLE_BACK_X0, TABLE_BACK_Y);
    g.lineTo(TABLE_BACK_X1, TABLE_BACK_Y);
    g.lineTo(W + 40, H);
    g.lineTo(-40, H);
    g.closePath();
    const woodGrad = g.createLinearGradient(0, TABLE_BACK_Y, 0, H);
    woodGrad.addColorStop(0, '#4a3320');
    woodGrad.addColorStop(0.5, '#75512f');
    woodGrad.addColorStop(1, '#a4763f');
    g.fillStyle = woodGrad;
    g.fill();

    // plank seams (converge toward back edge)
    g.strokeStyle = 'rgba(40,24,10,0.28)';
    g.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(250 + (i * (TABLE_BACK_X1 - TABLE_BACK_X0)) / 6, TABLE_BACK_Y);
      g.lineTo(250 + i * 130, H);
      g.stroke();
    }
    // warm court boundary line
    g.strokeStyle = 'rgba(255,240,220,0.5)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(TABLE_BACK_X0, TABLE_BACK_Y);
    g.lineTo(TABLE_BACK_X1, TABLE_BACK_Y);
    g.stroke();
    g.strokeStyle = 'rgba(255,240,220,0.16)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(40, 470);
    g.lineTo(W - 40, 470);
    g.stroke();

    // soft warm glow pooling under the pendant lamp, onto the table
    const poolGrad = g.createRadialGradient(W / 2, 260, 20, W / 2, 260, 260);
    poolGrad.addColorStop(0, 'rgba(255, 210, 150, 0.12)');
    poolGrad.addColorStop(1, 'rgba(255, 210, 150, 0)');
    g.fillStyle = poolGrad;
    g.fillRect(0, TABLE_BACK_Y, W, 420);

    // a cozy rug at the very front, near the player
    g.save();
    g.fillStyle = '#7a3b34';
    g.beginPath();
    g.roundRect(60, H - 90, W - 120, 70, 14);
    g.fill();
    g.strokeStyle = 'rgba(255, 235, 210, 0.35)';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(74, H - 78, W - 148, 46, 10);
    g.stroke();
    g.restore();

    // faint, cozy (not grimy) spill marks
    g.fillStyle = 'rgba(70,45,20,0.18)';
    [[110, 520, 40, 16], [370, 560, 34, 14], [200, 630, 50, 18]].forEach(([sx, sy, rx, ry]) => {
      g.beginPath();
      g.ellipse(sx, sy, rx, ry, 0.2, 0, Math.PI * 2);
      g.fill();
    });
  }
  drawCozyScene(bgx);

  function shade(hex, amt) {
    const c = hex.replace('#', '');
    const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
    let r = (num >> 16) + amt;
    let gr = ((num >> 8) & 0xff) + amt;
    let b = (num & 0xff) + amt;
    r = Math.max(0, Math.min(255, r));
    gr = Math.max(0, Math.min(255, gr));
    b = Math.max(0, Math.min(255, b));
    return `rgb(${r},${gr},${b})`;
  }

  function drawCup(cup) {
    ctx.save();
    if (cup.sunk) ctx.globalAlpha = 0.18;

    const topW = cup.r;
    const botW = cup.r * 0.62;
    const bodyH = cup.r * 1.5;

    // cup body (trapezoid)
    ctx.beginPath();
    ctx.moveTo(cup.x - topW, cup.y);
    ctx.lineTo(cup.x + topW, cup.y);
    ctx.lineTo(cup.x + botW, cup.y + bodyH);
    ctx.lineTo(cup.x - botW, cup.y + bodyH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(cup.x - topW, cup.y, cup.x + topW, cup.y);
    grad.addColorStop(0, shade(cup.fill, -18));
    grad.addColorStop(0.5, cup.fill);
    grad.addColorStop(1, shade(cup.fill, -18));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();

    // rim
    ctx.beginPath();
    ctx.ellipse(cup.x, cup.y, topW, topW * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = shade(cup.fill, 22);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();

    // gloss streak
    ctx.beginPath();
    ctx.moveTo(cup.x - topW * 0.55, cup.y + 4);
    ctx.lineTo(cup.x - botW * 0.5, cup.y + bodyH - 6);
    ctx.lineWidth = topW * 0.22;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineCap = 'round';
    ctx.stroke();

    if (!cup.sunk) {
      ctx.fillStyle = cup.points >= 75 || cup.fill === '#5c3427' ? '#fff' : '#0a0a0d';
      ctx.font = '700 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = cup.label.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, cup.x, cup.y + bodyH * 0.55 + (i - (lines.length - 1) / 2) * 9);
      });
    }
    ctx.restore();
  }

  function drawCan(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    const grad = ctx.createLinearGradient(-CAN_R * 0.6, 0, CAN_R * 0.6, 0);
    grad.addColorStop(0, '#b8b2a8');
    grad.addColorStop(0.5, '#eee9e0');
    grad.addColorStop(1, '#b8b2a8');
    ctx.beginPath();
    ctx.roundRect(-CAN_R * 0.6, -CAN_R, CAN_R * 1.2, CAN_R * 2, 4);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(-CAN_R * 0.6, -3, CAN_R * 1.2, 6);
    ctx.restore();
  }

  function drawHand(x, y) {
    ctx.save();
    ctx.translate(x, y + CAN_R * 1.6);
    ctx.fillStyle = '#d9a679';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 10, 17, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 11, -6, 6, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bg, 0, 0);

    for (const cup of cups) drawCup(cup);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life / 40, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // aim line + trajectory preview while dragging
    if (dragging && dragPos) {
      let dx = ANCHOR.x - dragPos.x;
      let dy = ANCHOR.y - dragPos.y;
      const dist = Math.min(Math.hypot(dx, dy), MAX_PULL);
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * dist;
      dy = Math.sin(angle) * dist;
      const vx = dx * POWER;
      const vy = dy * POWER;

      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ANCHOR.x - dx, ANCHOR.y - dy);
      ctx.lineTo(ANCHOR.x, ANCHOR.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      let sx = ANCHOR.x, sy = ANCHOR.y, svx = vx, svy = vy;
      const steps = 12;
      for (let i = 0; i < steps; i++) {
        svy += GRAVITY;
        sx += svx;
        sy += svy;
        if (i % 2 === 0) {
          ctx.beginPath();
          ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      drawHand(ANCHOR.x - dx, ANCHOR.y - dy);
      drawCan(ANCHOR.x - dx, ANCHOR.y - dy, 0);
    } else if (!ball.flying) {
      drawHand(ball.x, ball.y);
      drawCan(ball.x, ball.y, 0);
    }

    if (ball.flying) {
      const angle = Math.atan2(ball.vy, ball.vx) * 0.3;
      drawCan(ball.x, ball.y, angle);
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }
  loop();
})();
