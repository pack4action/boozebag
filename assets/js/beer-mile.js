(function () {
  const canvas = document.getElementById('mile-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;

  // ---- The course ----
  const GROUND_Y = 330;          // where the road meets the runner's feet
  const RUNNER_X = 150;          // he stays put; the world comes to him
  // A mile has to be long enough that what spawns at the right hand edge
  // has time to reach him before the next aid station clears the road.
  // Shorter than this and the course cannot be lost, which I found out by
  // leaving a bot standing still on it for half a minute.
  const MILE_PX = 1400;
  const MILES = 26;              // 26 drinks in 26 miles, and then it is over
  // Everything below is per second, not per frame. A runner measured in
  // frames sprints on a 120hz screen and jogs on a tired phone, and the
  // course is not the same course at the two.
  const START_SPEED = 250;
  // He never quite tops out: twenty six miles at this puts the last one a
  // shade under the ceiling, so the road is still speeding up at the end.
  const SPEED_PER_MILE = 18;
  const MAX_SPEED = 760;
  const GRAVITY = 2230;
  // High enough that the window for clearing a bin is a window and not a
  // frame: at the slowest the course ever runs, he is above the tallest
  // thing in the road for about half a second, and the tallest thing needs
  // a bit over a third of that to get past him.
  const JUMP_V = -790;
  // How much road there is on top of the jump itself between one thing and
  // the next, which is the whole of how hard the running is. It starts
  // generous and closes up mile by mile: half a second of spare road at the
  // first marker, a tenth of one at the last. Flat at the generous end the
  // course could not be lost by anybody who could see.
  const GAP_SPARE_FIRST = 120;
  const GAP_SPARE_LAST = 34;
  const GAP_ROLL_FIRST = 260;
  const GAP_ROLL_LAST = 70;
  // And from the sixth marker they start arriving in pairs, near enough
  // that one jump has to take both.
  const PAIR_FROM_MILE = 5;
  const PAIR_PER_MILE = 0.045;
  const PAIR_MOST = 0.42;
  // How much of his jump the drink costs him. A smaller jump, not a random
  // one: a random one is a jump nobody can learn, and this is a game about
  // learning the road.
  const DRUNK_JUMP_LOSS = 0.13;
  const DRUNK_JUMP_WOBBLE = 60;
  // Something to jump for when there is nothing to jump over. A note
  // hanging at about the top of the arc, in the middle of a clear stretch:
  // it is only reachable off the ground, so the road is a thing to read
  // rather than a thing to survive.
  const PICKUP_CHANCE = 0.6;
  const PICKUP_WORTH = 40;
  // High enough that walking under one never takes it and any real jump
  // does. His head standing is about a hundred above the road and the arc
  // carries him a hundred and six even with the whole race in him.
  const PICKUP_HIGH = 148;
  const PICKUP_R = 17;
  const RUNNER_TALL = 104;
  // Clearing something by a hair. A jump taken as late as it can be taken
  // is the best jump, and nothing used to pay any more for it than a jump
  // taken with a yard to spare. Measured rather than guessed: a bot that
  // goes at the ordinary moment passes about fifty three pixels over a
  // bin, and one that leaves it as late as the arc allows gets down to
  // thirty five, so the band sits between the two. Tighter than this and
  // nobody could reach it at all, which is where it started.
  const NEAR_MISS_PX = 38;
  const NEAR_MISS_WORTH = 25;
  // And emptying the beer with time left on the clock.
  const QUICK_CHUG_WORTH = 90;

  // ---- The drink ----
  const CHUG_SECONDS = 2.6;      // to get the first one down
  const CHUG_TIGHTEN = 0.032;    // and a little less for every mile after
  const CHUG_FLOOR = 1.7;
  const CHUG_PER_TAP = 0.075;    // about fourteen gulps
  const CHUG_DRAIN = 0.13;       // a second of not swallowing, lost
  const BAC_PER_BEER = 0.075;
  const BAC_PER_SPILL = 0.03;

  const OBSTACLES = [
    { kind: 'cone', w: 30, h: 40 },
    { kind: 'crate', w: 46, h: 38 },
    { kind: 'bin', w: 40, h: 50 },
  ];
  const HIT_WORDS = ['ATE IT', 'DOWN HE GOES', 'FACE FIRST', 'THAT WILL BRUISE', 'WIPEOUT'];

  // ---- Persistence ----
  const STORAGE_KEY = 'beerMileHighScore';
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

  const leaderboard = window.BoozebagLeaderboard.makeLeaderboard('beer-mile', 'beerMileLeaderboard');
  const leaderboardList = document.getElementById('leaderboard-list');
  const leaderboardEmpty = document.getElementById('leaderboard-empty');
  function renderLeaderboard() {
    leaderboard.render(leaderboardList, leaderboardEmpty,
      (drinks) => drinks + ' down', (score) => '$' + score);
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
  const hudMile = document.getElementById('hud-mile');
  const hudDrinks = document.getElementById('hud-drinks');
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

  // ---- State ----
  // `phase` is the whole of the game's shape: running until the next aid
  // station, chugging when you reach one, and then running again.
  let phase, dist, speed, miles, drinks, score, bac, gameOver;
  let runner, obstacles, nextObstacleAt, nextStationAt, bounce;
  let chug, chugLeft, chugSpan, splashes, pickups, lastChugBonus;

  function reset() {
    phase = 'run';
    dist = 0;
    speed = START_SPEED;
    miles = 0;
    drinks = 0;
    score = 0;
    bac = 0;
    gameOver = false;
    runner = { y: 0, vy: 0, air: false, step: 0 };
    obstacles = [];
    splashes = [];
    pickups = [];
    lastChugBonus = 0;
    bounce = 0;
    chug = 0;
    chugLeft = 0;
    // The first stretch is clear, so nobody eats a cone before they have
    // worked out what the button does.
    nextObstacleAt = 520;
    nextStationAt = MILE_PX;
    overlay.hidden = true;
    hudScore.textContent = '0';
    hudMile.textContent = '0';
    hudDrinks.textContent = '0';
  }

  // ---- What the player does ----
  // One button the whole way through. Running, it is a jump; at the table,
  // it is a swallow.
  function press() {
    if (gameOver) return;
    if (phase === 'chug') {
      chug = Math.min(1, chug + CHUG_PER_TAP);
      if (chug >= 1) finishChug(true);
      return;
    }
    if (!runner.air) {
      runner.air = true;
      // A drink in you is a jump you do not quite control.
      runner.vy = JUMP_V * (1 - bac * DRUNK_JUMP_LOSS)
        + (Math.random() - 0.5) * bac * DRUNK_JUMP_WOBBLE;
    }
  }

  function startChug() {
    phase = 'chug';
    chug = 0;
    // They get harder to finish the further in he is, which is the honest
    // version of what a beer mile actually does to somebody.
    chugLeft = Math.max(CHUG_FLOOR, CHUG_SECONDS - miles * CHUG_TIGHTEN);
    chugSpan = chugLeft;
    runner.y = 0;
    runner.vy = 0;
    runner.air = false;
    // The road empties while he is at the table. Anything already out
    // there would otherwise sit frozen a few strides ahead for as long as
    // the beer took, and be on top of him the moment he set off again.
    obstacles = [];
    pickups = [];
  }

  function finishChug(drained) {
    if (drained) {
      drinks += 1;
      bac = Math.min(1, bac + BAC_PER_BEER);
      // The clock you had left is the clock you get paid for.
      const spare = Math.max(0, chugLeft) / Math.max(0.001, chugSpan);
      const quick = Math.round(spare * QUICK_CHUG_WORTH);
      score += 120 + quick;
      lastChugBonus = quick;
      for (let i = 0; i < 10; i++) {
        splashes.push({ x: RUNNER_X + 12, y: GROUND_Y - 96,
          vx: (Math.random() - 0.5) * 200, vy: -90 - Math.random() * 150, life: 0.5 });
      }
      toast(drinks >= MILES ? 'THAT IS ALL OF THEM'
        : 'DOWN IT! +' + (120 + lastChugBonus) + (lastChugBonus ? ' \u00b7 STRAIGHT DOWN' : ''),
        'legend-moon');
    } else {
      bac = Math.min(1, bac + BAC_PER_SPILL);
      toast('SPILLED IT', 'legend-rekt');
    }
    hudDrinks.textContent = drinks;
    hudScore.textContent = score;
    if (miles >= MILES) {
      finish(true);
      return;
    }
    phase = 'run';
    // A clear run out of the aid station, so the first thing past the table
    // is never a cone you could not have seen.
    nextObstacleAt = dist + 260;
  }

  function passMile() {
    miles += 1;
    score += 100;
    speed = Math.min(MAX_SPEED, START_SPEED + miles * SPEED_PER_MILE);
    hudMile.textContent = miles;
    hudScore.textContent = score;
    nextStationAt = dist + MILE_PX;
    startChug();
  }

  function spawnObstacle() {
    const kind = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
    obstacles.push({ x: W + 40, w: kind.w, h: kind.h, kind: kind.kind });
    let end = W + 40 + kind.w;
    // A pair is two of them close enough that there is no landing between,
    // so it is one jump or none. They fit well inside the arc: the whole
    // pair is under two hundred pixels and the jump carries three times
    // that even at the end of the race with a full skinful.
    const along = Math.min(1, miles / Math.max(1, MILES - 1));
    const pairChance = miles <= PAIR_FROM_MILE ? 0
      : Math.min(PAIR_MOST, (miles - PAIR_FROM_MILE) * PAIR_PER_MILE);
    if (Math.random() < pairChance) {
      const second = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
      const apart = 26 + Math.random() * 34;
      obstacles.push({ x: end + apart, w: second.w, h: second.h, kind: second.kind });
      end += apart + second.w;
    }
    const spawnedAt = dist;
    // Never closer together than a jump takes, with room to land and go
    // again, so every gap is one somebody could actually make. What that
    // spare room is shrinks as the race goes on.
    const airborne = (-JUMP_V / GRAVITY) * 2;
    const jumpRun = airborne * speed;
    const spare = GAP_SPARE_FIRST + (GAP_SPARE_LAST - GAP_SPARE_FIRST) * along;
    const roll = GAP_ROLL_FIRST + (GAP_ROLL_LAST - GAP_ROLL_FIRST) * along;
    nextObstacleAt = dist + (end - (W + 40)) + jumpRun + spare + Math.random() * roll;
    // Hung in the middle of the clear road that follows, where jumping for
    // it costs nothing but a jump you did not have to make.
    if (Math.random() < PICKUP_CHANCE) {
      const clear = nextObstacleAt - spawnedAt;
      pickups.push({ x: end + clear * 0.45, y: GROUND_Y - PICKUP_HIGH, spin: Math.random() * 6 });
    }
  }

  function hit() {
    toast(HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)], 'legend-rekt');
    finish(false);
  }

  function finish(won) {
    gameOver = true;
    phase = 'over';
    if (won) score += 2600;
    best = submitScore(score);
    overlayTitle.textContent = won ? 'TWENTY SIX AND TWENTY SIX' : 'RUN OVER';
    overlayScore.textContent = 'Final bag: $' + score + ', ' + miles
      + (miles === 1 ? ' mile, ' : ' miles, ') + drinks
      + (drinks === 1 ? ' drink' : ' drinks');
    overlayBest.textContent = 'Best bag: $' + best;
    hudBest.textContent = best;
    if (connectedWallet) {
      leaderboard.upsert(connectedWallet, score, drinks);
      renderLeaderboard();
    }
    overlay.hidden = false;
  }

  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); press(); });
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); press(); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); press(); }
  });
  btnReplay.addEventListener('click', reset);

  // ---- The run ----
  function stepSplashes(dt) {
    for (const s of splashes) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 780 * dt;
      s.life -= dt;
    }
    splashes = splashes.filter((s) => s.life > 0);
  }

  function update(dt) {
    if (gameOver) {
      stepSplashes(dt);
      return;
    }

    if (phase === 'chug') {
      chugLeft -= dt;
      chug = Math.max(0, chug - CHUG_DRAIN * dt);
      if (chugLeft <= 0) finishChug(false);
      return;
    }

    dist += speed * dt;
    runner.step += speed * dt * 0.055;

    if (runner.air) {
      runner.vy += GRAVITY * dt;
      runner.y += runner.vy * dt;
      if (runner.y >= 0) {
        runner.y = 0;
        runner.vy = 0;
        runner.air = false;
        bounce = 0.1;
      }
    }
    if (bounce > 0) bounce = Math.max(0, bounce - dt);

    if (dist >= nextStationAt) {
      passMile();
      return;
    }
    if (dist >= nextObstacleAt) spawnObstacle();

    // The world moves; everything on the road moves with it.
    for (const o of obstacles) o.x -= speed * dt;
    // Anything well behind him is done with. It is kept until it is a long
    // way past, because a bin he only just cleared is paid for after it has
    // gone by him rather than as he goes over it.
    obstacles = obstacles.filter((o) => o.x + o.w > -60);
    for (const q of pickups) { q.x -= speed * dt; q.spin += dt * 4; }
    pickups = pickups.filter((q) => q.x > -60);

    stepSplashes(dt);

    // Collision is worked out on the road, not on the picture: the sway is
    // there to make it feel like a skinful, not to move the cones.
    const bodyL = RUNNER_X - 13;
    const bodyR = RUNNER_X + 15;
    const feet = GROUND_Y + runner.y;
    for (const o of obstacles) {
      if (o.x > bodyR || o.x + o.w < bodyL) continue;
      if (feet > GROUND_Y - o.h + 6) { hit(); return; }
      // How near the soles came to the top of it, kept so a late jump can
      // be paid for once the thing is safely behind him.
      const clear = (GROUND_Y - o.h + 6) - feet;
      o.closest = o.closest === undefined ? clear : Math.min(o.closest, clear);
    }
    // Behind him now, and cleared by a hair.
    for (const o of obstacles) {
      if (o.paid || o.closest === undefined || o.x + o.w >= bodyL) continue;
      o.paid = true;
      if (o.closest <= NEAR_MISS_PX) {
        score += NEAR_MISS_WORTH;
        toast('THAT WAS CLOSE +' + NEAR_MISS_WORTH, 'legend-10x');
      }
    }
    // And anything he jumped through on the way. Against the whole of him,
    // boots to hair: a note hanging at head height passes through his legs
    // at the top of a jump, and a check against his chest alone never saw
    // one of them.
    const feetY = GROUND_Y + runner.y;
    pickups.forEach((q) => {
      if (q.got) return;
      if (Math.abs(q.x - RUNNER_X) > PICKUP_R + 18) return;
      if (q.y > feetY + PICKUP_R || q.y < feetY - RUNNER_TALL - PICKUP_R) return;
      q.got = true;
      score += PICKUP_WORTH;
      for (let i = 0; i < 8; i++) {
        splashes.push({ x: q.x, y: q.y, vx: (Math.random() - 0.5) * 220,
          vy: -60 - Math.random() * 160, life: 0.45 });
      }
      toast('+' + PICKUP_WORTH, 'legend-moon');
    });
    pickups = pickups.filter((q) => !q.got);
  }

  // ---- Drawing ----
  // How far over the whole picture leans this instant. It grows with what
  // is in him and is never allowed to touch anything the game measures.
  function sway(t) {
    return Math.sin(t * 0.0016) * bac * 0.055 + Math.sin(t * 0.0041) * bac * 0.022;
  }

  // Stars, rolled once and kept, so they do not crawl about the sky.
  const STARS = [];
  for (let i = 0; i < 46; i++) {
    STARS.push({ x: Math.random() * W, y: Math.random() * 190, r: 0.7 + Math.random() * 1.1,
      a: 0.25 + Math.random() * 0.5 });
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y + 30);
    g.addColorStop(0, '#120d22');
    g.addColorStop(0.45, '#2b1836');
    g.addColorStop(0.82, '#54303c');
    g.addColorStop(1, '#7a4433');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const s of STARS) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#fff6df';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // A moon, low and heavy, in the same amber as everything else.
    ctx.fillStyle = 'rgba(255, 214, 140, 0.13)';
    ctx.beginPath();
    ctx.arc(566, 86, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe6b0';
    ctx.beginPath();
    ctx.arc(566, 86, 26, 0, Math.PI * 2);
    ctx.fill();

    // A city going past, two layers of it, the near one faster. Lit windows
    // on the near one, because a dead skyline at night reads as a wall.
    const skyline = (offset, height, color, step, lit) => {
      const start = -((dist * offset) % step);
      for (let x = start; x < W + step; x += step) {
        const n = Math.abs(Math.sin((x - start + dist * offset) * 0.013));
        const h = height * (0.55 + n * 0.45);
        ctx.fillStyle = color;
        ctx.fillRect(x, GROUND_Y - h, step * 0.72, h);
        if (!lit) continue;
        ctx.fillStyle = 'rgba(255, 199, 110, 0.5)';
        for (let wy = GROUND_Y - h + 12; wy < GROUND_Y - 16; wy += 17) {
          for (let wx = x + 6; wx < x + step * 0.72 - 6; wx += 13) {
            if (Math.abs(Math.sin(wx * 12.9898 + wy * 78.233)) > 0.72) ctx.fillRect(wx, wy, 5, 7);
          }
        }
      }
    };
    skyline(0.12, 160, '#1d1531', 74, false);
    skyline(0.3, 104, '#2a1d3c', 52, true);

    // The pavement the city stands on, so the buildings are behind the road
    // rather than standing in it.
    ctx.fillStyle = '#43323a';
    ctx.fillRect(0, GROUND_Y - 14, W, 14);
    ctx.fillStyle = '#53404a';
    ctx.fillRect(0, GROUND_Y - 14, W, 3);
  }

  // Street lights going past at the speed of the road, the one thing that
  // says how fast he is actually moving.
  function drawLamps() {
    const step = 260;
    const start = -(dist % step);
    for (let x = start; x < W + step; x += step) {
      ctx.fillStyle = '#3c3038';
      ctx.fillRect(x, GROUND_Y - 150, 6, 150);
      ctx.fillRect(x, GROUND_Y - 152, 40, 6);
      ctx.fillStyle = '#ffd97a';
      ctx.fillRect(x + 32, GROUND_Y - 150, 14, 9);
      const cone = ctx.createLinearGradient(0, GROUND_Y - 142, 0, GROUND_Y);
      cone.addColorStop(0, 'rgba(255, 217, 122, 0.20)');
      cone.addColorStop(1, 'rgba(255, 217, 122, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(x + 33, GROUND_Y - 141);
      ctx.lineTo(x + 45, GROUND_Y - 141);
      ctx.lineTo(x + 92, GROUND_Y);
      ctx.lineTo(x - 14, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRoad() {
    ctx.fillStyle = '#2a2128';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = '#3c2f36';
    ctx.fillRect(0, GROUND_Y, W, 5);

    // Centre dashes, running away under him.
    ctx.fillStyle = 'rgba(255, 214, 140, 0.5)';
    const step = 90;
    const start = -(dist % step);
    for (let x = start; x < W + step; x += step) ctx.fillRect(x, GROUND_Y + 46, 46, 5);

    // Mile posts, so the distance is something you can see going by.
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let m = 1; m <= MILES; m++) {
      const x = m * MILE_PX - dist + RUNNER_X;
      if (x < -40 || x > W + 40) continue;
      ctx.fillStyle = '#6b5a4a';
      ctx.fillRect(x - 2, GROUND_Y - 34, 4, 34);
      ctx.fillStyle = '#ffb703';
      ctx.fillRect(x - 13, GROUND_Y - 48, 26, 16);
      ctx.fillStyle = '#1a1200';
      ctx.fillText(String(m), x, GROUND_Y - 36);
    }
    ctx.textAlign = 'start';
  }

  // A rolled note, hung at the top of the arc and turning slowly so it
  // catches the eye against a road that is all browns and greys.
  function drawPickups(t) {
    pickups.forEach((q) => {
      const bob = Math.sin(t * 0.004 + q.spin) * 5;
      ctx.save();
      ctx.translate(q.x, q.y + bob);
      ctx.rotate(Math.sin(t * 0.003 + q.spin) * 0.35);
      ctx.fillStyle = 'rgba(53, 224, 138, 0.22)';
      ctx.beginPath();
      ctx.arc(0, 0, PICKUP_R + 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#35e08a';
      ctx.fillRect(-PICKUP_R, -10, PICKUP_R * 2, 20);
      ctx.fillStyle = '#0d3a24';
      ctx.fillRect(-PICKUP_R + 3, -7, PICKUP_R * 2 - 6, 14);
      ctx.fillStyle = '#35e08a';
      ctx.font = '800 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    });
  }

  function drawObstacle(o) {
    const y = GROUND_Y;
    ctx.save();
    ctx.translate(o.x, y);
    if (o.kind === 'cone') {
      ctx.fillStyle = '#d7542c';
      ctx.beginPath();
      ctx.moveTo(o.w / 2, -o.h);
      ctx.lineTo(o.w, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f4f0ea';
      ctx.fillRect(o.w * 0.18, -o.h * 0.58, o.w * 0.64, 6);
      ctx.fillStyle = '#2a2128';
      ctx.fillRect(-3, -5, o.w + 6, 5);
    } else if (o.kind === 'crate') {
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(0, -o.h, o.w, o.h);
      ctx.fillStyle = '#a8703a';
      ctx.fillRect(2, -o.h + 2, o.w - 4, 8);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, -o.h, o.w, o.h);
      // Bottles poking out of the top of it.
      ctx.fillStyle = '#3f7a3a';
      for (let i = 0; i < 3; i++) ctx.fillRect(5 + i * 13, -o.h - 9, 6, 10);
    } else {
      ctx.fillStyle = '#3f4750';
      ctx.fillRect(0, -o.h, o.w, o.h);
      ctx.fillStyle = '#565f6a';
      ctx.fillRect(-3, -o.h - 7, o.w + 6, 8);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, -o.h, o.w, o.h);
    }
    ctx.restore();
  }

  function drawStation() {
    // The table he is standing at while the beer goes down.
    const x = RUNNER_X + 52;
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(x, GROUND_Y - 54, 96, 10);
    ctx.fillStyle = '#6b451f';
    ctx.fillRect(x + 6, GROUND_Y - 44, 8, 44);
    ctx.fillRect(x + 82, GROUND_Y - 44, 8, 44);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#d7542c';
      ctx.fillRect(x + 10 + i * 20, GROUND_Y - 70, 13, 16);
      ctx.fillStyle = '#f4f0ea';
      ctx.fillRect(x + 10 + i * 20, GROUND_Y - 70, 13, 4);
    }
  }

  // A runner: a few boxes with legs that scissor. He leans further the more
  // he has had, and his own wobble is on top of the picture's.
  function drawRunner(t) {
    const lean = bac * 0.16 + Math.sin(t * 0.006) * bac * 0.09;
    const y = GROUND_Y + runner.y;
    const cycle = runner.step;
    const swing = runner.air ? 0.7 : Math.sin(cycle) * 1.15;
    const squash = bounce > 0 ? bounce * 1.2 : 0;

    ctx.save();
    ctx.translate(RUNNER_X, y);
    ctx.rotate(lean);
    ctx.scale(1 + squash, 1 - squash);

    // Shadow on the road, tighter the closer he is to it.
    ctx.save();
    ctx.rotate(-lean);
    const up = -runner.y;
    ctx.globalAlpha = Math.max(0.12, 0.42 - up * 0.0032);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(2, -runner.y + 2, 20 - up * 0.06, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const skin = '#e3b189';
    const shirt = '#ffb703';

    // Back leg, then the front one, so he reads as having two.
    const leg = (dir, color, shoe) => {
      ctx.save();
      // Set a little apart as well as swung, or the back one hides behind
      // the front one and he reads as a man hopping on one leg.
      ctx.translate(dir * 3, -30);
      ctx.rotate(swing * dir * 0.5);
      ctx.fillStyle = color;
      ctx.fillRect(-5, 0, 10, 30);
      ctx.fillStyle = shoe;
      ctx.fillRect(-8, 27, 15, 6);
      ctx.restore();
    };
    leg(-1, shade(skin, -55), '#b9b3aa');
    leg(1, skin, '#f4f0ea');

    // Shorts, then the belly he has earned.
    ctx.fillStyle = '#2f2a3a';
    ctx.fillRect(-11, -44, 22, 16);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(-12, -44);
    ctx.quadraticCurveTo(-17, -60, -11, -72);
    ctx.lineTo(11, -72);
    ctx.quadraticCurveTo(17, -58, 12, -44);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Arms pumping the other way to the legs.
    const arm = (dir, color) => {
      ctx.save();
      ctx.translate(0, -68);
      ctx.rotate(-swing * dir * 0.6);
      ctx.fillStyle = color;
      ctx.fillRect(-4, 0, 8, 24);
      ctx.restore();
    };
    arm(1, shade(skin, -40));
    arm(-1, skin);

    // Neck, head, and the cap that makes him him.
    ctx.fillStyle = shade(skin, -18);
    ctx.fillRect(-4, -78, 8, 8);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -86, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0483a';
    ctx.beginPath();
    ctx.arc(0, -88, 11, Math.PI * 1.02, Math.PI * 2.05);
    ctx.fill();
    ctx.fillRect(6, -90, 12, 4);
    ctx.restore();
  }

  function shade(hex, amt) {
    const c = hex.replace('#', '');
    const num = parseInt(c, 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawChug() {
    const barW = 320;
    const x = (W - barW) / 2;
    const y = 74;
    ctx.fillStyle = 'rgba(10, 10, 13, 0.82)';
    ctx.fillRect(x - 14, y - 40, barW + 28, 92);
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 14, y - 40, barW + 28, 92);

    ctx.font = '700 15px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#f4f0ea';
    ctx.textAlign = 'center';
    ctx.fillText('TAP TO DRINK', W / 2, y - 18);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, barW, 22);
    const g = ctx.createLinearGradient(x, 0, x + barW, 0);
    g.addColorStop(0, '#ffb703');
    g.addColorStop(1, '#ff8c1a');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, barW * chug, 22);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, barW, 22);

    // The clock, running out from both ends so it reads at a glance.
    const left = Math.max(0, chugLeft / chugSpan);
    ctx.fillStyle = left < 0.3 ? '#ff3b3b' : 'rgba(244,240,234,0.7)';
    ctx.fillRect(x + (barW * (1 - left)) / 2, y + 30, barW * left, 6);
    ctx.textAlign = 'start';
  }

  function drawHudOnCanvas() {
    // How full he is, at the top corner, where it cannot be missed.
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(244,240,234,0.75)';
    ctx.fillText('HOW FULL HE IS', 16, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(16, 30, 150, 12);
    const g = ctx.createLinearGradient(16, 0, 166, 0);
    g.addColorStop(0, '#35e08a');
    g.addColorStop(0.6, '#ffb703');
    g.addColorStop(1, '#ff3b3b');
    ctx.fillStyle = g;
    ctx.fillRect(16, 30, 150 * bac, 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 30, 150, 12);

    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffb703';
    ctx.textAlign = 'right';
    ctx.fillText('MILE ' + Math.min(miles + 1, MILES) + ' OF ' + MILES, W - 16, 26);
    ctx.fillText(drinks + ' DOWN', W - 16, 44);
    ctx.textAlign = 'start';
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // Everything in the world leans together. The bars and the numbers do
    // not, or you could not read them by mile twenty.
    ctx.translate(W / 2, H);
    ctx.rotate(sway(t));
    ctx.translate(-W / 2, -H);
    drawSky();
    drawLamps();
    drawRoad();
    for (const o of obstacles) drawObstacle(o);
    drawPickups(t);
    if (phase === 'chug') drawStation();
    drawRunner(t);
    for (const s of splashes) {
      ctx.globalAlpha = Math.max(0, s.life / 0.5);
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (bac > 0.55) {
      ctx.fillStyle = 'rgba(255, 140, 26, ' + ((bac - 0.55) * 0.22).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    drawHudOnCanvas();
    if (phase === 'chug') drawChug();
  }

  // ---- Loop ----
  // Stepped on real time rather than on frames, so the run is the same
  // length of run on a slow phone as on a fast desktop.
  let last = 0;
  function loop(now) {
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw(now);
    requestAnimationFrame(loop);
  }

  reset();
  requestAnimationFrame(loop);
})();
