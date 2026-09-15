(function () {
  const canvas = document.getElementById('mile-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const juice = window.BoozebagJuice;

  const W = canvas.width;
  const H = canvas.height;

  // ---- How close the camera is ----
  // The world is 720 wide and stays 720 wide: where things spawn and how
  // long you have to see them coming never changes. What changes is how
  // much of it is on the board. Closer in, the runner is bigger and the
  // board is taller, which is the difference between a game and a
  // letterbox on a phone. Remembered, and closer by default on a narrow
  // screen. Nothing behind him is worth the room, so the crop comes off
  // the left first.
  // Picked from the width of the screen, and picked again if that changes.
  // A phone gets the camera close in; a desktop sees the whole road.
  let zoom = 1;
  let viewLeft = 0;
  function applyZoom() {
    const wide = window.innerWidth;
    zoom = wide < 480 ? 1.6 : wide < 760 ? 1.3 : 1;
    canvas.height = Math.round(H * zoom);
    const seen = W / zoom;
    viewLeft = Math.max(0, Math.min(W - seen, RUNNER_X - seen * 0.3));
  }
  window.addEventListener('resize', applyZoom);
  // A point in the world, as a fraction of the board as it is being shown.
  const fx = (x) => ((x - viewLeft) * zoom) / W;
  const fy = (y) => y / H;

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
  // Things hung over the road that have to be gone under rather than over.
  // `bottom` is how far above the road the underside is: lower than his
  // head standing, higher than his head sliding.
  const HANGING = [
    { kind: 'sign', w: 64, h: 0, hang: true, bottom: 56 },
    { kind: 'pipe', w: 34, h: 0, hang: true, bottom: 52 },
  ];
  const HANG_FROM_MILE = 2;
  const HANG_CHANCE = 0.34;
  const HIT_WORDS = ['ATE IT', 'DOWN HE GOES', 'FACE FIRST', 'THAT WILL BRUISE', 'WIPEOUT'];

  // ---- The race ----
  // It is a race, and the other runner is the point of it. Steve does not
  // drink, does not fall, and does not stop for anything but his beer; he
  // just runs, at a pace that a decent run beats and a sloppy one does
  // not. He keeps running while you are at the table, which is what makes
  // every second of a chug cost something.
  // Measured, not guessed: a bot that never falls and empties every glass
  // in a quarter of a second runs the course in about seventy two seconds
  // of real time. A person taps a beer down in about two, which is forty
  // seconds more over twenty six of them, and goes over a few times at a
  // couple of seconds each: call it a hundred and twenty. Steve takes
  // about a hundred and twenty nine, so a decent run beats him by a
  // stride and a sloppy one does not. He is quicker than you are sober,
  // so he leads early, and you reel him in as the beers make you quicker
  // than he is.
  const RIVAL_NAME = 'SOBER STEVE';
  const RIVAL_START = 440;
  const RIVAL_PER_MILE = 9;
  const RIVAL_CHUG = 2.4;        // seconds he stands at each table
  const FINAL_STRETCH = 700;     // road after the last beer to the tape
  // Going down is not the end of anything. You are on the road for a
  // second, you get up slower than you went down, and Steve does not wait.
  const FALL_SECONDS = 1.1;
  const FALL_SPEED_KEEP = 0.5;
  const SPEED_RECOVER = 1.8;     // how quickly he gets back up to pace
  // What is in him makes him quicker, right up to a full skinful. It also
  // makes him wobble, which is the trade.
  const DRUNK_SPEED_BOOST = 230;
  // Sliding: low and quick and over before you know it.
  const SLIDE_SECONDS = 0.62;
  const RUNNER_LOW = 42;

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
  juice.attach(document.querySelector('.game-stage'), document.querySelector('.game-hud'));
  applyZoom();

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
  // The other runner, how far the tape is, and whether the last beer is
  // down and it is only road to the line from here.
  let rival, finishAt, sprinting, falls, tape;
  function rivalPace() {
    return RIVAL_START + rival.miles * RIVAL_PER_MILE;
  }
  // What he can do right now, with what is in him.
  function paceNow() {
    return Math.min(MAX_SPEED + DRUNK_SPEED_BOOST,
      START_SPEED + miles * SPEED_PER_MILE + bac * DRUNK_SPEED_BOOST);
  }
  function runnerHeight() {
    return runner.slide > 0 ? RUNNER_LOW : RUNNER_TALL;
  }
  // Only the picture: how stretched he is off a jump, the dust his boots
  // kick up, the jolt through the frame when he hits something, and the
  // streaks across the sky once the road is properly quick.
  let stretch = 0;
  let jolt = 0;
  let dust = [];
  let streaks = [];
  function kickDust(n, spread) {
    for (let i = 0; i < n; i++) {
      dust.push({ x: RUNNER_X - 8 + (Math.random() - 0.5) * 10, y: GROUND_Y + 2,
        vx: -(40 + Math.random() * spread), vy: -(20 + Math.random() * 70),
        life: 0.3 + Math.random() * 0.25, r: 2 + Math.random() * 2.5 });
    }
  }

  function reset() {
    phase = 'run';
    dist = 0;
    speed = START_SPEED;
    miles = 0;
    drinks = 0;
    score = 0;
    bac = 0;
    gameOver = false;
    runner = { y: 0, vy: 0, air: false, step: 0, slide: 0, fall: 0 };
    rival = { dist: 0, miles: 0, stop: 0 };
    finishAt = MILES * MILE_PX + FINAL_STRETCH;
    sprinting = false;
    falls = 0;
    tape = null;
    obstacles = [];
    splashes = [];
    pickups = [];
    lastChugBonus = 0;
    stretch = 0;
    jolt = 0;
    dust = [];
    streaks = [];
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
  // Two things on the road: up, over what is standing in it, and down,
  // under what is hanging over it. At the table, either one is a swallow.
  // A jump cuts a slide short, so a late change of mind still counts.
  function press() {
    if (gameOver) return;
    if (phase === 'chug') {
      chug = Math.min(1, chug + CHUG_PER_TAP);
      juice.sfx.gulp(chug);
      if (chug >= 1) finishChug(true);
      return;
    }
    if (runner.fall > 0) return;
    if (!runner.air) {
      runner.air = true;
      runner.slide = 0;
      juice.sfx.jump();
      stretch = 1;
      kickDust(4, 60);
      // A drink in you is a jump you do not quite control.
      runner.vy = JUMP_V * (1 - bac * DRUNK_JUMP_LOSS)
        + (Math.random() - 0.5) * bac * DRUNK_JUMP_WOBBLE;
    }
  }

  function duck() {
    if (gameOver) return;
    if (phase === 'chug') { press(); return; }
    if (runner.fall > 0 || runner.air || runner.slide > 0) return;
    runner.slide = SLIDE_SECONDS;
    juice.sfx.whoosh(0.45);
    kickDust(5, 120);
  }

  // Down, and up again slower than he went down. The thing that put him
  // there is done with; nothing else on the road touches him while he is
  // on it, because he is under all of it.
  function fall(o) {
    o.hit = true;
    falls += 1;
    runner.fall = FALL_SECONDS;
    runner.slide = 0;
    runner.air = false;
    runner.y = 0;
    runner.vy = 0;
    speed *= FALL_SPEED_KEEP;
    toast(HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)], 'legend-rekt');
    juice.sfx.crash();
    juice.flash('#c0483a', 300);
    juice.hold(110);
    jolt = 14;
    kickDust(12, 160);
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
    runner.slide = 0;
    runner.fall = 0;
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
      juice.sfx.downed();
      juice.float('+' + (120 + quick), 0.5, 0.36, quick ? 'is-gold is-big' : 'is-gold');
      if (quick >= 60) juice.flash('#ffd28a', 260);
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
      juice.sfx.spill();
      juice.flash('#c0483a', 240);
    }
    hudDrinks.textContent = drinks;
    juice.pop(hudDrinks);
    juice.count(hudScore, score);
    phase = 'run';
    if (miles >= MILES) {
      // The last beer is down. Nothing left but road and the tape, and
      // whoever gets there first.
      sprinting = true;
      obstacles = [];
      pickups = [];
      toast('LAST BEER DOWN \u00b7 RUN', 'legend-10x');
      return;
    }
    // A clear run out of the aid station, so the first thing past the table
    // is never a cone you could not have seen.
    nextObstacleAt = dist + 260;
  }

  function passMile() {
    miles += 1;
    score += 100;
    hudMile.textContent = miles;
    juice.pop(hudMile);
    juice.count(hudScore, score);
    juice.sfx.bell();
    juice.float('MILE ' + miles + ' \u00b7 +100', fx(RUNNER_X + 40), 0.3, 'is-gold');
    nextStationAt = dist + MILE_PX;
    startChug();
  }

  function spawnObstacle() {
    // From the second mile some of what turns up is hung over the road
    // rather than stood in it, and a hung thing never comes as a pair.
    const hangIt = miles >= HANG_FROM_MILE && Math.random() < HANG_CHANCE;
    const kind = hangIt
      ? HANGING[Math.floor(Math.random() * HANGING.length)]
      : OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
    obstacles.push({ x: W + 40, w: kind.w, h: kind.h, kind: kind.kind,
      hang: !!kind.hang, bottom: kind.bottom || 0 });
    let end = W + 40 + kind.w;
    // A pair is two of them close enough that there is no landing between,
    // so it is one jump or none. They fit well inside the arc: the whole
    // pair is under two hundred pixels and the jump carries three times
    // that even at the end of the race with a full skinful.
    const along = Math.min(1, miles / Math.max(1, MILES - 1));
    const pairChance = miles <= PAIR_FROM_MILE ? 0
      : Math.min(PAIR_MOST, (miles - PAIR_FROM_MILE) * PAIR_PER_MILE);
    if (!hangIt && Math.random() < pairChance) {
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

  function finish(won) {
    gameOver = true;
    phase = 'over';
    if (won) score += 2600;
    const beaten = score > best && score > 0;
    best = submitScore(score);
    // The race is the headline whichever way it went; a best bag on a
    // lost race is the second line.
    overlayTitle.textContent = won ? 'YOU BEAT STEVE' : 'STEVE GOT THERE FIRST';
    if (won || beaten) setTimeout(() => { juice.sfx.newBest(); juice.celebrate(); }, won ? 200 : 450);
    if (won) {
      juice.flash('#ffd28a', 500);
      tape = { broke: 0 };
    }
    const fell = falls === 0 ? 'never went down' : falls === 1 ? 'went down once' : 'went down ' + falls + ' times';
    overlayScore.textContent = won
      ? 'Final bag: $' + score + '. All 26 down, ' + fell + '.'
      : 'Final bag: $' + score + '. You were on mile ' + Math.min(MILES, miles + 1)
        + ' with ' + drinks + (drinks === 1 ? ' drink' : ' drinks') + ' down, and ' + fell + '.';
    overlayBest.textContent = (beaten ? 'New best bag: $' : 'Best bag: $') + best;
    hudBest.textContent = best;
    if (connectedWallet) {
      leaderboard.upsert(connectedWallet, score, drinks);
      renderLeaderboard();
    }
    overlay.hidden = false;
  }

  // The top of the board is up and the bottom of it is down: a tap high
  // jumps and a tap low slides, with nothing to wait for to tell them
  // apart. At the table, anywhere is a swallow.
  function pressAt(clientY) {
    const box = canvas.getBoundingClientRect();
    const low = (clientY - box.top) / box.height > 0.55;
    if (low) duck(); else press();
  }
  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); pressAt(e.clientY); });
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); pressAt(e.touches[0].clientY); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); press(); }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); duck(); }
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

  // Steve, every frame, whatever you are doing. He stops at every table
  // for the same time each, and otherwise runs.
  function stepRival(dt) {
    if (rival.stop > 0) { rival.stop -= dt; return; }
    rival.dist += rivalPace() * dt;
    if (rival.miles < MILES && rival.dist >= (rival.miles + 1) * MILE_PX) {
      rival.miles += 1;
      rival.stop = RIVAL_CHUG;
    }
    if (rival.miles >= MILES && rival.dist >= finishAt) finish(false);
  }

  function update(dt) {
    if (gameOver) {
      stepSplashes(dt);
      if (tape) tape.broke = Math.min(1, tape.broke + dt * 2);
      return;
    }
    stepRival(dt);
    if (gameOver) return;

    if (phase === 'chug') {
      chugLeft -= dt;
      chug = Math.max(0, chug - CHUG_DRAIN * dt);
      if (chugLeft <= 0) finishChug(false);
      return;
    }

    // He gets back up to pace after a fall rather than snapping to it,
    // and the pace itself is what is in him as much as how far he is.
    const pace = paceNow();
    if (runner.fall > 0) {
      runner.fall = Math.max(0, runner.fall - dt);
      speed = Math.max(speed, START_SPEED * 0.3);
    } else {
      speed += (pace - speed) * Math.min(1, dt * SPEED_RECOVER);
    }
    if (runner.slide > 0) runner.slide = Math.max(0, runner.slide - dt);

    dist += speed * dt;
    runner.step += speed * dt * 0.055;
    if (sprinting && dist >= finishAt) { finish(true); return; }

    if (runner.air) {
      runner.vy += GRAVITY * dt;
      runner.y += runner.vy * dt;
      if (runner.y >= 0) {
        runner.y = 0;
        runner.vy = 0;
        runner.air = false;
        bounce = 0.1;
        juice.sfx.land();
        kickDust(6, 90);
      }
    }
    if (bounce > 0) bounce = Math.max(0, bounce - dt);
    if (stretch > 0) stretch = Math.max(0, stretch - dt * 5);
    jolt *= Math.pow(0.02, dt);
    if (jolt < 0.3) jolt = 0;
    for (const d of dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 320 * dt;
      d.life -= dt;
    }
    dust = dust.filter((d) => d.life > 0);
    // Streaks across the sky once the road is quick, more of them the
    // quicker it gets, so the speed is a thing you can see.
    const quick = Math.max(0, (speed - 430) / (MAX_SPEED - 430));
    if (quick > 0 && Math.random() < quick * 0.9) {
      streaks.push({ x: W + 60, y: 20 + Math.random() * (GROUND_Y - 60),
        len: 50 + Math.random() * 110, life: 1 });
    }
    for (const k of streaks) { k.x -= (speed * 2.2) * dt; k.life -= dt * 0.9; }
    streaks = streaks.filter((k) => k.life > 0 && k.x + k.len > -20);

    if (!sprinting && dist >= nextStationAt) {
      passMile();
      return;
    }
    if (!sprinting && dist >= nextObstacleAt) spawnObstacle();

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
    const head = feet - runnerHeight();
    for (const o of obstacles) {
      if (o.hit || o.x > bodyR || o.x + o.w < bodyL) continue;
      if (runner.fall > 0) continue;
      if (o.hang) {
        // Under it or into it. Sliding, his head is below the underside;
        // standing or jumping it is not.
        if (head < GROUND_Y - o.bottom) { fall(o); return; }
        continue;
      }
      if (feet > GROUND_Y - o.h + 6) { fall(o); return; }
      // How near the soles came to the top of it, kept so a late jump can
      // be paid for once the thing is safely behind him.
      const clear = (GROUND_Y - o.h + 6) - feet;
      o.closest = o.closest === undefined ? clear : Math.min(o.closest, clear);
    }
    // Behind him now, and cleared by a hair.
    for (const o of obstacles) {
      if (o.paid || o.hit || o.closest === undefined || o.x + o.w >= bodyL) continue;
      o.paid = true;
      if (o.closest <= NEAR_MISS_PX) {
        score += NEAR_MISS_WORTH;
        toast('THAT WAS CLOSE +' + NEAR_MISS_WORTH, 'legend-10x');
        // Time thickens for a moment, so a jump taken by a hair can be
        // seen to have been taken by a hair.
        juice.sfx.whoosh(1);
        juice.slow(0.32, 280);
        juice.float('+' + NEAR_MISS_WORTH, fx(o.x + o.w / 2), fy(GROUND_Y - o.h - 30), 'is-blue');
        juice.count(hudScore, score);
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
      juice.sfx.coin();
      juice.float('+' + PICKUP_WORTH, fx(q.x), fy(q.y), 'is-green');
      juice.count(hudScore, score);
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
    if (o.hang) {
      // Hung from something above the top of the picture, so it reads as
      // a thing to go under from the moment it comes on.
      const under = -o.bottom;
      ctx.strokeStyle = '#3a3238';
      ctx.lineWidth = 5;
      if (o.kind === 'sign') {
        ctx.beginPath();
        ctx.moveTo(o.w / 2 - 14, -GROUND_Y);
        ctx.lineTo(o.w / 2 - 14, under - 30);
        ctx.moveTo(o.w / 2 + 14, -GROUND_Y);
        ctx.lineTo(o.w / 2 + 14, under - 30);
        ctx.stroke();
        ctx.fillStyle = '#2a1e12';
        ctx.fillRect(0, under - 32, o.w, 32);
        ctx.strokeStyle = '#ffb703';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, under - 30, o.w - 4, 28);
        ctx.fillStyle = '#ffb703';
        ctx.font = '700 13px Anton, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BAR', o.w / 2, under - 16);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      } else {
        // A scaffold pole across the pavement, on two hangers.
        ctx.beginPath();
        ctx.moveTo(5, -GROUND_Y);
        ctx.lineTo(5, under - 6);
        ctx.moveTo(o.w - 5, -GROUND_Y);
        ctx.lineTo(o.w - 5, under - 6);
        ctx.stroke();
        ctx.fillStyle = '#7b8089';
        ctx.fillRect(-14, under - 10, o.w + 28, 10);
        ctx.fillStyle = '#aeb4bd';
        ctx.fillRect(-14, under - 10, o.w + 28, 3);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-14, under - 10, o.w + 28, 10);
      }
      ctx.restore();
      return;
    }
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

  // The other runner, drawn on the road a lane behind, when he is near
  // enough to be on the picture at all. He is a pace to be measured
  // against, so he is grey where you are yellow.
  function drawRival(t) {
    const sx = RUNNER_X + (rival.dist - dist);
    if (sx < -60 || sx > W + 60) return;
    const y = GROUND_Y - 6;
    const cycle = rival.dist * 0.055;
    const swing = rival.stop > 0 ? 0 : Math.sin(cycle) * 1.1;
    ctx.save();
    ctx.translate(sx, y);
    ctx.scale(0.92, 0.92);
    ctx.globalAlpha = 0.92;
    const skin = '#c9a184';
    const leg = (dir, color) => {
      ctx.save();
      ctx.translate(dir * 3, -30);
      ctx.rotate(swing * dir * 0.5);
      ctx.fillStyle = color;
      ctx.fillRect(-5, 0, 10, 30);
      ctx.fillStyle = '#d8d8dc';
      ctx.fillRect(-8, 27, 15, 6);
      ctx.restore();
    };
    leg(-1, shade(skin, -50));
    leg(1, skin);
    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(-11, -44, 22, 16);
    ctx.fillStyle = '#9aa3b2';
    ctx.fillRect(-12, -72, 24, 28);
    ctx.fillStyle = '#556072';
    ctx.font = '700 9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('0.0', 0, -55);
    ctx.fillStyle = skin;
    ctx.fillRect(-4, -78, 8, 8);
    ctx.beginPath();
    ctx.arc(0, -86, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d7a9e';
    ctx.beginPath();
    ctx.arc(0, -88, 11, Math.PI * 1.02, Math.PI * 2.05);
    ctx.fill();
    ctx.fillRect(6, -90, 12, 4);
    // A bottle of water. Of course.
    if (rival.stop > 0) {
      ctx.fillStyle = '#8ecbff';
      ctx.fillRect(14, -70, 6, 16);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(244,240,234,0.7)';
    ctx.font = '700 10px Inter, system-ui, sans-serif';
    ctx.fillText('STEVE', 0, -104);
    ctx.textAlign = 'start';
    ctx.restore();
  }

  // The line, the tape across it, and the people who came to see it. All
  // of it in the world, so it comes up the road the way everything does.
  function drawFinish(t) {
    const fx0 = RUNNER_X + (finishAt - dist);
    if (fx0 > W + 220) return;
    // A crowd along the last stretch, bobbing.
    for (let i = -26; i <= 4; i++) {
      const cx = fx0 + i * 27;
      if (cx < -20 || cx > W + 20) continue;
      const bob = Math.sin(t * 0.008 + i * 1.7) * 3;
      ctx.fillStyle = i % 3 === 0 ? '#5a3a2a' : i % 3 === 1 ? '#3a4a6a' : '#6a3a4a';
      ctx.fillRect(cx - 7, GROUND_Y - 30 + bob, 14, 26);
      ctx.fillStyle = i % 2 ? '#e3b189' : '#b98a68';
      ctx.beginPath();
      ctx.arc(cx, GROUND_Y - 36 + bob, 7, 0, Math.PI * 2);
      ctx.fill();
      if (i % 4 === 0) {
        ctx.fillStyle = '#ffb703';
        ctx.fillRect(cx - 9, GROUND_Y - 58 + bob * 1.4, 18, 12);
      }
    }
    // Two posts and the banner.
    ctx.fillStyle = '#d8d8dc';
    ctx.fillRect(fx0 - 3, GROUND_Y - 150, 6, 150);
    ctx.fillRect(fx0 + 61, GROUND_Y - 150, 6, 150);
    ctx.fillStyle = '#ffb703';
    ctx.fillRect(fx0 - 6, GROUND_Y - 150, 76, 26);
    ctx.fillStyle = '#1a1200';
    ctx.font = '700 15px Anton, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FINISH', fx0 + 32, GROUND_Y - 137);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    // The tape, whole until it is not.
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (!tape) {
      ctx.moveTo(fx0, GROUND_Y - 78);
      ctx.lineTo(fx0 + 64, GROUND_Y - 78);
    } else {
      const b = tape.broke;
      ctx.moveTo(fx0, GROUND_Y - 78);
      ctx.quadraticCurveTo(fx0 + 18, GROUND_Y - 78 + b * 30, fx0 + 26 - b * 14, GROUND_Y - 60 + b * 40);
      ctx.moveTo(fx0 + 64, GROUND_Y - 78);
      ctx.quadraticCurveTo(fx0 + 46, GROUND_Y - 78 + b * 30, fx0 + 38 + b * 14, GROUND_Y - 60 + b * 40);
    }
    ctx.stroke();
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
    // Long and thin off the ground, for a beat, the way anything that
    // jumps is.
    if (stretch > 0) ctx.scale(1 - stretch * 0.12, 1 + stretch * 0.16);
    if (runner.fall > 0) {
      // Over onto his face, fast, and back up again slower.
      const into = FALL_SECONDS - runner.fall;
      const down = Math.min(1, into * 5);
      const up = Math.max(0, 1 - runner.fall / 0.38);
      const over = 1.4 * down * (1 - up);
      ctx.rotate(over);
      ctx.translate(0, over * 16);
    } else if (runner.slide > 0) {
      // Flat out under it, feet first.
      ctx.rotate(-0.22);
      ctx.scale(1.25, 0.42);
    }

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

    // The race, across the top: the road from the start to the tape, with
    // you and Steve on it. Which of you is in front is the whole game, so
    // it is the thing in the middle of the screen.
    const x0 = 212;
    const x1 = W - 178;
    const y = 30;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x0, y - 2, x1 - x0, 4);
    ctx.fillStyle = '#ffb703';
    ctx.fillRect(x1 - 1, y - 9, 3, 18);
    const at = (d) => x0 + Math.max(0, Math.min(1, d / finishAt)) * (x1 - x0);
    const you = at(dist);
    const him = at(rival.dist);
    ctx.fillStyle = '#9aa3b2';
    ctx.beginPath();
    ctx.arc(him, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb703';
    ctx.beginPath();
    ctx.arc(you, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = '700 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb703';
    ctx.fillText('YOU', you, y - 11);
    ctx.fillStyle = '#9aa3b2';
    ctx.fillText('STEVE', him, y + 20);
    ctx.textAlign = 'start';
  }

  function draw(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    // The camera: the world drawn closer in, with the strip behind him
    // cropped off. Everything in the world is drawn in its own units and
    // knows nothing about this.
    ctx.setTransform(zoom, 0, 0, zoom, -viewLeft * zoom, 0);
    if (jolt) ctx.translate((Math.random() - 0.5) * jolt, (Math.random() - 0.5) * jolt);
    // Everything in the world leans together. The bars and the numbers do
    // not, or you could not read them by mile twenty.
    ctx.translate(W / 2, H);
    ctx.rotate(sway(t));
    ctx.translate(-W / 2, -H);
    drawSky();
    for (const k of streaks) {
      ctx.globalAlpha = Math.min(0.35, k.life * 0.4);
      ctx.fillStyle = '#fff6df';
      ctx.fillRect(k.x, k.y, k.len, 1.5);
    }
    ctx.globalAlpha = 1;
    drawLamps();
    drawRoad();
    drawFinish(t);
    drawRival(t);
    for (const o of obstacles) drawObstacle(o);
    drawPickups(t);
    if (phase === 'chug') drawStation();
    for (const d of dust) {
      ctx.globalAlpha = Math.min(0.55, d.life * 1.6);
      ctx.fillStyle = '#8d7d70';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (bac > 0.55) {
      ctx.fillStyle = 'rgba(255, 140, 26, ' + ((bac - 0.55) * 0.22).toFixed(3) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    // Slow motion and the odd held frame come from here: the game is
    // stepped by less time than has passed, or by none.
    update(dt * juice.timeScale());
    draw(now);
    requestAnimationFrame(loop);
  }

  reset();
  requestAnimationFrame(loop);
})();
