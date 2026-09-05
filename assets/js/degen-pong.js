(function () {
  const canvas = document.getElementById('pong-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;

  const GRAVITY = 0.3;
  const WALL_DAMP = 0.72;
  const MAX_PULL = 120;
  const POWER = 0.24;
  const CAN_R = 15;
  const ANCHOR = { x: W / 2, y: 610 };
  const TOTAL_BALLS = 8;

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
  function makeCups() {
    return [
      { x: 190, y: 130, r: 30, label: 'MOON', points: 100, fill: '#2ecc71', sunk: false },
      { x: 250, y: 130, r: 30, label: '10X', points: 75, fill: '#ffb703', sunk: false },
      { x: 310, y: 130, r: 30, label: 'DIAMOND\nHANDS', points: 60, fill: '#3ddcff', sunk: false },
      { x: 220, y: 186, r: 30, label: 'PAPER\nHANDS', points: 20, fill: '#a89fb0', sunk: false },
      { x: 280, y: 186, r: 30, label: 'REKT', points: 10, fill: '#ff3b3b', sunk: false },
      { x: 250, y: 242, r: 30, label: 'RUG', points: 0, fill: '#3a1414', sunk: false },
    ];
  }

  let cups = makeCups();
  let ball = null;
  let ballsLeft = TOTAL_BALLS;
  let score = 0;
  let best = getBestScore();
  let dragging = false;
  let dragPos = null;
  let gameOver = false;
  let particles = [];

  const hudScore = document.getElementById('hud-score');
  const hudBalls = document.getElementById('hud-balls');
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
    const allSunk = cups.every((c) => c.sunk);
    if (allSunk) {
      const bonus = 50;
      score += bonus;
      hudScore.textContent = score;
      toast('RACK CLEARED +' + bonus, 'legend-moon');
      setTimeout(endGame, 900);
    } else if (ballsLeft <= 0) {
      setTimeout(endGame, 500);
    }
  }

  function endGame() {
    gameOver = true;
    best = submitScore(score);
    overlayTitle.textContent = cups.every((c) => c.sunk) ? 'RACK CLEARED' : 'OUT OF CANS';
    overlayScore.textContent = 'Final bag: $' + score;
    overlayBest.textContent = 'Best bag: $' + best;
    hudBest.textContent = best;
    overlay.hidden = false;
  }

  btnReplay.addEventListener('click', () => {
    cups = makeCups();
    ballsLeft = TOTAL_BALLS;
    score = 0;
    gameOver = false;
    particles = [];
    hudScore.textContent = 0;
    hudBalls.textContent = ballsLeft;
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
        if (d < cup.r * 0.75) {
          cup.sunk = true;
          score += cup.points;
          hudScore.textContent = score;
          const cls = cup.points >= 75 ? 'legend-moon' : cup.points >= 40 ? 'legend-10x' : cup.points > 0 ? 'legend-rekt' : 'legend-rug';
          toast((cup.points > 0 ? '+' + cup.points + ' ' : '') + cup.label.replace('\n', ' '), cls);
          if (cup.points >= 60) spawnBurst(cup.x, cup.y, cup.fill);
          ball.flying = false;
          finishThrow();
          break;
        }
      }

      if (ball.flying && ball.y - CAN_R > H) {
        toast('MISSED', 'legend-rekt');
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

  function drawCup(cup) {
    ctx.save();
    if (cup.sunk) ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.ellipse(cup.x, cup.y, cup.r, cup.r * 0.72, 0, 0, Math.PI * 2);
    ctx.fillStyle = cup.fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();

    if (!cup.sunk) {
      ctx.fillStyle = cup.points >= 75 || cup.fill === '#3a1414' ? '#fff' : '#0a0a0d';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = cup.label.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, cup.x, cup.y + (i - (lines.length - 1) / 2) * 12);
      });
    }
    ctx.restore();
  }

  function drawCan(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.beginPath();
    ctx.roundRect(-CAN_R * 0.6, -CAN_R, CAN_R * 1.2, CAN_R * 2, 4);
    ctx.fillStyle = '#e7e2da';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(-CAN_R * 0.6, -3, CAN_R * 1.2, 6);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // table floor
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 560, W, H - 560);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, 560);
    ctx.lineTo(W, 560);
    ctx.stroke();

    for (const cup of cups) drawCup(cup);

    for (const p of particles) {
      ctx.globalAlpha = Math.max(p.life / 40, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // aim line while dragging
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
      ctx.strokeStyle = 'rgba(255,183,3,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ANCHOR.x - dx, ANCHOR.y - dy);
      ctx.lineTo(ANCHOR.x, ANCHOR.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255,183,3,0.55)';
      let sx = ANCHOR.x, sy = ANCHOR.y, svx = vx, svy = vy;
      for (let i = 0; i < 16; i++) {
        svy += GRAVITY;
        sx += svx;
        sy += svy;
        if (i % 2 === 0) {
          ctx.beginPath();
          ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      drawCan(ANCHOR.x - dx, ANCHOR.y - dy, 0);
    } else if (!ball.flying) {
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
