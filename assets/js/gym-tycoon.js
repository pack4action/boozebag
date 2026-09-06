(function () {
  const hudTotal = document.getElementById('hud-total');
  if (!hudTotal) return;

  const SAVE_KEY = 'gymTycoonSave';
  const COST_GROWTH = 1.15;
  const OFFLINE_CAP_SECONDS = 8 * 3600;
  const SLOT_COUNT = 12;
  const TICK_MS = 100;

  const ITEMS = [
    { id: 'dumbbell', name: 'Dumbbell Set', emoji: '🏋️', baseCost: 15, gps: 0.1 },
    { id: 'mat', name: 'Yoga Mat', emoji: '🧘', baseCost: 60, gps: 0.5 },
    { id: 'bench', name: 'Bench Press', emoji: '🛋️', baseCost: 200, gps: 2 },
    { id: 'rack', name: 'Squat Rack', emoji: '🏗️', baseCost: 800, gps: 8 },
    { id: 'cable', name: 'Cable Machine', emoji: '⚙️', baseCost: 3000, gps: 30 },
    { id: 'treadmill', name: 'Treadmill', emoji: '🏃', baseCost: 10000, gps: 100 },
    { id: 'trainer', name: 'Personal Trainer', emoji: '🧑‍🏫', baseCost: 40000, gps: 400 },
    { id: 'sauna', name: 'Sauna', emoji: '🔥', baseCost: 150000, gps: 1500 },
    { id: 'gear', name: 'Steroid Cycle', emoji: '💉', baseCost: 600000, gps: 6000 },
    { id: 'hq', name: 'Second Location', emoji: '🏢', baseCost: 2500000, gps: 25000 },
  ];

  const THEMES = [
    { id: 'garage', name: 'Garage', unlockAt: 0 },
    { id: 'basement', name: 'Basement', unlockAt: 1000 },
    { id: 'rooftop', name: 'Rooftop', unlockAt: 50000 },
  ];

  // Grid the room is laid out on. Moved up here (rather than living with the
  // rest of the floor-designer/rendering code further down) because the
  // synergy math below needs it, and that math has to run before `load()`
  // computes the very first gps figure.
  const ROOM = { cols: 4, rows: 3, tileW: 96, tileH: 48, wallH: 110, originX: 216, originY: 120 };

  // Placement is no longer cosmetic: gains/sec is earned only by gear
  // actually sitting in the room (see computeGps), and equipment of the
  // same category placed edge-to-edge in the grid boosts each other.
  // Booster-category gear (trainer/gear/hq) instead boosts ANY different
  // category neighbor, so it's worth spreading those around rather than
  // clustering them.
  const CATEGORY = {
    dumbbell: 'strength', bench: 'strength', rack: 'strength', cable: 'strength',
    treadmill: 'cardio',
    mat: 'recovery', sauna: 'recovery',
    trainer: 'booster', gear: 'booster', hq: 'booster',
  };
  const CATEGORY_META = {
    strength: { name: 'Strength', color: '#c0483a' },
    cardio: { name: 'Cardio', color: '#3fa0c9' },
    recovery: { name: 'Recovery', color: '#3fa87e' },
    booster: { name: 'Booster', color: '#d9a53f' },
  };
  const SAME_CATEGORY_BONUS = 0.12;
  const BOOSTER_NEARBY_BONUS = 0.20;

  function itemById(id) {
    return ITEMS.find((i) => i.id === id);
  }

  function neighborIndexes(index) {
    const gx = index % ROOM.cols;
    const gy = Math.floor(index / ROOM.cols);
    const out = [];
    if (gx > 0) out.push(index - 1);
    if (gx < ROOM.cols - 1) out.push(index + 1);
    if (gy > 0) out.push(index - ROOM.cols);
    if (gy < ROOM.rows - 1) out.push(index + ROOM.cols);
    return out;
  }

  // Per-slot multiplier from adjacent gear: +12% for each neighbor of the
  // same category, +20% for each neighboring booster (trainer/gear/hq) of
  // a *different* category. Two boosters next to each other just count as
  // a same-category match.
  function itemSynergyMultiplier(layout, index) {
    const itemId = layout[index];
    if (!itemId) return 1;
    const cat = CATEGORY[itemId];
    let mult = 1;
    neighborIndexes(index).forEach((nIdx) => {
      const nId = layout[nIdx];
      if (!nId) return;
      const nCat = CATEGORY[nId];
      if (nCat === cat) mult += SAME_CATEGORY_BONUS;
      else if (nCat === 'booster') mult += BOOSTER_NEARBY_BONUS;
    });
    return mult;
  }

  // Gains/sec now comes entirely from what's placed in the room, not from
  // raw ownership -- gear sitting unplaced in inventory earns nothing.
  function computeGps(layout) {
    let total = 0;
    layout.forEach((itemId, index) => {
      const item = itemId && itemById(itemId);
      if (!item) return;
      total += item.gps * itemSynergyMultiplier(layout, index);
    });
    return total;
  }

  function formatNum(n) {
    if (n < 1000) return (Math.floor(n * 10) / 10).toString();
    const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];
    let v = n;
    let u = -1;
    while (v >= 1000 && u < units.length - 1) {
      v /= 1000;
      u++;
    }
    return v.toFixed(2) + units[u];
  }

  // ---- Persistence ----
  function defaultState() {
    return {
      balance: 0,
      lifetime: 0,
      owned: {},
      layout: new Array(SLOT_COUNT).fill(null),
      theme: 'garage',
      lastSaved: Date.now(),
    };
  }

  function load() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch (e) {
      saved = null;
    }
    if (!saved) return defaultState();

    const s = Object.assign(defaultState(), saved);
    s.owned = saved.owned || {};
    if (!Array.isArray(s.layout) || s.layout.length !== SLOT_COUNT) {
      const old = Array.isArray(saved.layout) ? saved.layout : [];
      s.layout = new Array(SLOT_COUNT).fill(null).map((_, i) => old[i] || null);
    }

    // Migration for saves from before placement mattered: if the room is
    // empty but the player owns gear, auto-fill the floor with it so
    // returning players don't come back to a sudden $0/s.
    if (s.layout.every((x) => !x)) {
      const toPlace = [];
      ITEMS.forEach((item) => {
        const count = s.owned[item.id] || 0;
        for (let i = 0; i < count; i++) toPlace.push(item.id);
      });
      toPlace.slice(0, SLOT_COUNT).forEach((id, i) => { s.layout[i] = id; });
    }

    const elapsed = Math.max(0, (Date.now() - (saved.lastSaved || Date.now())) / 1000);
    const cappedElapsed = Math.min(elapsed, OFFLINE_CAP_SECONDS);
    const gpsAtSave = computeGps(s.layout);
    const offlineEarnings = cappedElapsed * gpsAtSave;
    if (offlineEarnings > 1) {
      s.balance += offlineEarnings;
      s.lifetime += offlineEarnings;
      setTimeout(() => toast('WELCOME BACK +$' + formatNum(offlineEarnings), 'legend-moon'), 400);
    }
    return s;
  }

  function save() {
    state.lastSaved = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  let state = load();
  let gps = computeGps(state.layout);
  let clickAmount = 1 + gps * 0.05;

  // ---- Wallet-gated local leaderboard ----
  const leaderboard = window.BoozebagLeaderboard.makeLeaderboard('gymTycoonLeaderboard');
  const leaderboardList = document.getElementById('leaderboard-list');
  const leaderboardEmpty = document.getElementById('leaderboard-empty');
  function renderLeaderboard() {
    leaderboard.render(leaderboardList, leaderboardEmpty, (rate) => formatNum(rate) + '/s', (score) => '$' + formatNum(score));
  }
  renderLeaderboard();

  let connectedWallet = null;
  function updateLeaderboardEntry() {
    if (!connectedWallet) return;
    leaderboard.upsert(connectedWallet, Math.floor(state.lifetime), Math.round(gps * 10) / 10);
    renderLeaderboard();
  }

  if (window.BoozebagWallet) {
    window.BoozebagWallet.attachUI({
      onChange(address) {
        connectedWallet = address;
        if (address) updateLeaderboardEntry();
      },
      onError(msg) { toast(msg, 'legend-rug'); },
    });
  } else {
    document.getElementById('btn-connect').hidden = true;
  }

  // ---- Toast ----
  const toastEl = document.getElementById('game-toast');
  function toast(msg, cls) {
    toastEl.textContent = msg;
    toastEl.className = 'game-toast show' + (cls ? ' ' + cls : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.classList.remove('show'); }, 1100);
  }

  // ---- HUD ----
  const hudGps = document.getElementById('hud-gps');
  const hudClick = document.getElementById('hud-click');
  function refreshHud() {
    hudTotal.textContent = '$' + formatNum(state.balance);
    hudGps.textContent = formatNum(gps) + '/s';
    hudClick.textContent = '+' + formatNum(clickAmount);
  }

  function recomputeStats() {
    gps = computeGps(state.layout);
    clickAmount = 1 + gps * 0.05;
    refreshHud();
    refreshSynergyText();
  }

  // ---- Room synergy readout ----
  const synergyEl = document.getElementById('tycoon-synergy');
  function refreshSynergyText() {
    if (!synergyEl) return;
    const placed = state.layout.filter(Boolean).length;
    if (placed === 0) {
      synergyEl.textContent = "Empty room = $0/s. Arm a piece of gear below and click a tile to start earning.";
      return;
    }
    const baseSum = state.layout.reduce((sum, id) => sum + (id ? itemById(id).gps : 0), 0);
    const bonusPct = baseSum > 0 ? Math.round((gps / baseSum - 1) * 100) : 0;
    synergyEl.textContent = placed + '/' + SLOT_COUNT + ' slots filled -- base ' + formatNum(baseSum) + '/s'
      + (bonusPct > 0 ? ', +' + bonusPct + '% from arrangement synergy' : ', no synergy bonus yet')
      + ' = ' + formatNum(gps) + '/s total.';
  }

  // ---- Shop ----
  function costFor(item) {
    return Math.ceil(item.baseCost * Math.pow(COST_GROWTH, state.owned[item.id] || 0));
  }

  const shopGrid = document.getElementById('shop-grid');
  const shopEls = {};

  function buildShop() {
    ITEMS.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'shop-item';
      const cat = CATEGORY_META[CATEGORY[item.id]];
      el.innerHTML =
        '<div class="shop-item-head">' +
          '<span class="shop-item-emoji">' + item.emoji + '</span>' +
          '<span class="shop-item-name">' + item.name + '</span>' +
          '<span class="shop-item-owned">x0</span>' +
        '</div>' +
        '<span class="shop-item-cat" style="color:' + cat.color + '">' + cat.name + '</span>' +
        '<span class="shop-item-gps">+' + formatNum(item.gps) + ' gains/sec when placed</span>' +
        '<button class="shop-buy-btn" type="button">Buy</button>';
      const buyBtn = el.querySelector('.shop-buy-btn');
      buyBtn.addEventListener('click', () => buyItem(item.id));
      shopGrid.appendChild(el);
      shopEls[item.id] = { root: el, ownedEl: el.querySelector('.shop-item-owned'), buyBtn };
    });
  }

  function refreshShopUI() {
    ITEMS.forEach((item) => {
      const els = shopEls[item.id];
      const owned = state.owned[item.id] || 0;
      const cost = costFor(item);
      els.ownedEl.textContent = 'x' + owned;
      els.buyBtn.textContent = 'Buy — $' + formatNum(cost);
      const affordable = state.balance >= cost;
      els.buyBtn.disabled = !affordable;
      els.root.classList.toggle('is-affordable', affordable);
    });
  }

  function buyItem(id) {
    const item = ITEMS.find((i) => i.id === id);
    const cost = costFor(item);
    if (state.balance < cost) return;
    state.balance -= cost;
    state.owned[id] = (state.owned[id] || 0) + 1;
    // Auto-drop new gear into an open slot so it starts earning right away.
    // Once the room's full, further purchases sit in inventory until you
    // free up a slot -- that's the point where arranging what to keep on
    // the floor actually becomes a decision.
    const emptyIndex = state.layout.indexOf(null);
    if (emptyIndex !== -1) {
      state.layout[emptyIndex] = id;
      renderScene();
    }
    recomputeStats();
    refreshShopUI();
    renderInventory();
    updateLeaderboardEntry();
    save();
  }

  // ---- Floor designer: isometric room rendered on canvas ----
  const floorCanvas = document.getElementById('tycoon-floor');
  const floorCtx = floorCanvas.getContext('2d');
  const inventoryEl = document.getElementById('tycoon-inventory');
  const themeRowEl = document.getElementById('theme-row');
  let armedItemId = null;

  const THEME_COLORS = {
    garage: { floorA: '#5c4530', floorB: '#4a3624', wallL: '#3a2c1c', wallR: '#2e2116', bgTop: '#241a10', bg: '#171310' },
    basement: { floorA: '#33404a', floorB: '#28333c', wallL: '#1c242c', wallR: '#161b21', bgTop: '#171b1f', bg: '#0e1114' },
    rooftop: { floorA: '#5a89ad', floorB: '#4a7594', wallL: '#3f6f94', wallR: '#2f5673', bgTop: '#3f6f94', bg: '#1c3348' },
  };
  // Per-theme ceiling fixture + ambient glow pool. Rooftop has no fixture
  // (it's open to the sky) but still gets a warm sun-glow on the floor.
  const LIGHT_COLORS = {
    garage: { glow: 'rgba(255,196,120,0.30)', cord: '#171310', shade: '#caa25c', shadeDark: '#8a6a34', bulb: '#fff2cf' },
    basement: { glow: 'rgba(170,210,255,0.20)', cord: '#0b0f12', shade: '#c6d6de', shadeDark: '#84949e', bulb: '#eaf7ff' },
    rooftop: { glow: 'rgba(255,236,180,0.38)', cord: null, shade: null, shadeDark: null, bulb: null },
  };

  function placedCount(itemId) {
    return state.layout.filter((x) => x === itemId).length;
  }
  function availableCount(itemId) {
    return (state.owned[itemId] || 0) - placedCount(itemId);
  }

  function isoPoint(gx, gy) {
    return {
      x: ROOM.originX + (gx - gy) * (ROOM.tileW / 2),
      y: ROOM.originY + (gx + gy) * (ROOM.tileH / 2),
    };
  }
  function cellCenter(gx, gy) {
    return isoPoint(gx + 0.5, gy + 0.5);
  }
  function allCellsBackToFront() {
    const cells = [];
    for (let gy = 0; gy < ROOM.rows; gy++) {
      for (let gx = 0; gx < ROOM.cols; gx++) cells.push({ gx, gy });
    }
    cells.sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
    return cells;
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

  function hexA(hex, alpha) {
    const c = hex.replace('#', '');
    const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Raw isometric offset (no origin) for a point (u, v) tile-units away from
  // some base -- used to build little 3D boxes out of props in the same
  // projection as the floor tiles.
  function isoVecRaw(u, v) {
    return { x: (u - v) * (ROOM.tileW / 2), y: (u + v) * (ROOM.tileH / 2) };
  }

  // Draws one shaded isometric box: (offU, offV) is its center relative to
  // the base point in tile-units, (halfA, halfB) its footprint half-extents
  // (also tile-units), height and lift in pixels (lift raises it off the
  // ground, for stacking props on top of one another).
  function drawIsoBox(ctx, base, offU, offV, halfA, halfB, height, color, lift) {
    lift = lift || 0;
    const c = isoVecRaw(offU, offV);
    const groundY = base.y + c.y - lift;
    const groundX = base.x + c.x;

    const front = isoVecRaw(halfA, halfB);
    const right = isoVecRaw(halfA, -halfB);
    const back = isoVecRaw(-halfA, -halfB);
    const left = isoVecRaw(-halfA, halfB);

    const pFront = { x: groundX + front.x, y: groundY + front.y };
    const pRight = { x: groundX + right.x, y: groundY + right.y };
    const pBack = { x: groundX + back.x, y: groundY + back.y };
    const pLeft = { x: groundX + left.x, y: groundY + left.y };
    const top = (p) => ({ x: p.x, y: p.y - height });

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';

    ctx.beginPath();
    ctx.moveTo(pLeft.x, pLeft.y);
    ctx.lineTo(pFront.x, pFront.y);
    ctx.lineTo(top(pFront).x, top(pFront).y);
    ctx.lineTo(top(pLeft).x, top(pLeft).y);
    ctx.closePath();
    ctx.fillStyle = shade(color, -35);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pFront.x, pFront.y);
    ctx.lineTo(pRight.x, pRight.y);
    ctx.lineTo(top(pRight).x, top(pRight).y);
    ctx.lineTo(top(pFront).x, top(pFront).y);
    ctx.closePath();
    ctx.fillStyle = shade(color, -15);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(top(pFront).x, top(pFront).y);
    ctx.lineTo(top(pRight).x, top(pRight).y);
    ctx.lineTo(top(pBack).x, top(pBack).y);
    ctx.lineTo(top(pLeft).x, top(pLeft).y);
    ctx.closePath();
    ctx.fillStyle = shade(color, 22);
    ctx.fill();
    ctx.stroke();
  }

  // Each piece of equipment is built from a couple of shaded boxes rather
  // than a flat emoji sticker, so it actually reads as part of the 3D room.
  const PROP_BUILDERS = {
    dumbbell: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.30, 0.20, 6, '#7a5a34', 0);
      drawIsoBox(ctx, b, -0.14, 0, 0.07, 0.10, 16, '#26262a', 6);
      drawIsoBox(ctx, b, 0.14, 0, 0.07, 0.10, 16, '#26262a', 6);
      drawIsoBox(ctx, b, 0, 0, 0.16, 0.035, 6, '#9a9aa0', 14);
    },
    mat: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.34, 0.22, 5, '#3fa8a0', 0);
    },
    bench: (ctx, b) => {
      drawIsoBox(ctx, b, 0, -0.28, 0.08, 0.06, 24, '#7a7a80', 0);
      drawIsoBox(ctx, b, 0, 0.28, 0.08, 0.06, 24, '#7a7a80', 0);
      drawIsoBox(ctx, b, 0, 0, 0.14, 0.34, 10, '#2255aa', 20);
    },
    rack: (ctx, b) => {
      drawIsoBox(ctx, b, -0.20, -0.20, 0.045, 0.045, 42, '#5a5a60', 0);
      drawIsoBox(ctx, b, 0.20, -0.20, 0.045, 0.045, 42, '#5a5a60', 0);
      drawIsoBox(ctx, b, -0.20, 0.20, 0.045, 0.045, 42, '#5a5a60', 0);
      drawIsoBox(ctx, b, 0.20, 0.20, 0.045, 0.045, 42, '#5a5a60', 0);
      drawIsoBox(ctx, b, 0, 0, 0.24, 0.24, 4, '#c0483a', 42);
    },
    cable: (ctx, b) => {
      drawIsoBox(ctx, b, -0.10, 0, 0.08, 0.10, 46, '#3a3a3e', 0);
      drawIsoBox(ctx, b, 0.14, 0, 0.10, 0.14, 20, '#4a5a6a', 0);
    },
    treadmill: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0.02, 0.32, 0.18, 8, '#26262a', 0);
      drawIsoBox(ctx, b, 0, -0.20, 0.06, 0.16, 24, '#3a3a3e', 8);
    },
    trainer: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.14, 0.12, 26, '#c98a4a', 0);
      drawIsoBox(ctx, b, 0, 0, 0.08, 0.08, 10, '#e0a86a', 26);
    },
    sauna: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.30, 0.26, 44, '#8a5a34', 0);
      drawIsoBox(ctx, b, 0, 0, 0.10, 0.10, 10, '#e8b04a', 44);
    },
    gear: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.10, 0.10, 30, '#c0483a', 0);
      drawIsoBox(ctx, b, 0, 0, 0.03, 0.03, 14, '#e8e8ea', 30);
    },
    hq: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.34, 0.30, 60, '#4a5a6a', 0);
      drawIsoBox(ctx, b, 0, 0, 0.20, 0.18, 14, '#c0483a', 60);
    },
  };

  // Thin trim band along the bottom of a wall, where it meets the floor,
  // so the walls don't just end abruptly -- p0/p1 are the wall's two
  // floor-level corners (in screen space).
  function drawBaseboard(p0, p1) {
    const trimH = 9;
    floorCtx.beginPath();
    floorCtx.moveTo(p0.x, p0.y);
    floorCtx.lineTo(p1.x, p1.y);
    floorCtx.lineTo(p1.x, p1.y - trimH);
    floorCtx.lineTo(p0.x, p0.y - trimH);
    floorCtx.closePath();
    floorCtx.fillStyle = 'rgba(0,0,0,0.30)';
    floorCtx.fill();
    floorCtx.beginPath();
    floorCtx.moveTo(p0.x, p0.y - trimH);
    floorCtx.lineTo(p1.x, p1.y - trimH);
    floorCtx.strokeStyle = 'rgba(255,255,255,0.06)';
    floorCtx.lineWidth = 1;
    floorCtx.stroke();
  }

  // Soft radial glow pooling on the floor under the ceiling fixture --
  // drawn with an additive blend so it lightens whatever is underneath
  // rather than flatly covering it.
  function drawLightPool(center, glowColor) {
    const grad = floorCtx.createRadialGradient(center.x, center.y, 4, center.x, center.y, ROOM.tileW * 1.9);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    floorCtx.save();
    floorCtx.globalCompositeOperation = 'lighter';
    floorCtx.fillStyle = grad;
    floorCtx.beginPath();
    floorCtx.ellipse(center.x, center.y, ROOM.tileW * 1.9, ROOM.tileH * 1.9, 0, 0, Math.PI * 2);
    floorCtx.fill();
    floorCtx.restore();
  }

  // Hanging bulb (garage/basement) -- skipped for rooftop, which is lit by
  // open sky instead of a fixture.
  function drawLampFixture(anchor, light) {
    if (!light.cord) return;
    const cordLen = 30;
    const bulbY = anchor.y + cordLen;
    floorCtx.beginPath();
    floorCtx.moveTo(anchor.x, anchor.y);
    floorCtx.lineTo(anchor.x, bulbY);
    floorCtx.strokeStyle = light.cord;
    floorCtx.lineWidth = 2;
    floorCtx.stroke();

    floorCtx.beginPath();
    floorCtx.moveTo(anchor.x - 13, bulbY);
    floorCtx.lineTo(anchor.x + 13, bulbY);
    floorCtx.lineTo(anchor.x + 7, bulbY + 14);
    floorCtx.lineTo(anchor.x - 7, bulbY + 14);
    floorCtx.closePath();
    floorCtx.fillStyle = light.shadeDark;
    floorCtx.fill();
    floorCtx.beginPath();
    floorCtx.moveTo(anchor.x - 13, bulbY);
    floorCtx.lineTo(anchor.x + 13, bulbY);
    floorCtx.lineTo(anchor.x + 10, bulbY - 5);
    floorCtx.lineTo(anchor.x - 10, bulbY - 5);
    floorCtx.closePath();
    floorCtx.fillStyle = light.shade;
    floorCtx.fill();

    floorCtx.beginPath();
    floorCtx.arc(anchor.x, bulbY + 18, 5, 0, Math.PI * 2);
    floorCtx.fillStyle = light.bulb;
    floorCtx.shadowColor = light.bulb;
    floorCtx.shadowBlur = 12;
    floorCtx.fill();
    floorCtx.shadowBlur = 0;
  }

  // Point on a wall: t is fraction along the wall (0 = the near/floor
  // corner given as fromP, 1 = toP), hFrac is fraction up from the floor
  // (0 = floor line, 1 = ceiling). Decor drawn from this stays anchored to
  // the wall as the room re-renders, without needing full quad-skew math.
  function wallPoint(fromP, toP, t, hFrac) {
    return {
      x: fromP.x + (toP.x - fromP.x) * t,
      y: fromP.y + (toP.y - fromP.y) * t - hFrac * ROOM.wallH,
    };
  }

  function drawWallDecor(theme, north, east, west) {
    if (theme === 'garage') {
      const p = wallPoint(north, east, 0.56, 0.62);
      floorCtx.fillStyle = 'rgba(0,0,0,0.22)';
      floorCtx.fillRect(p.x - 32, p.y - 24, 64, 44);
      floorCtx.strokeStyle = 'rgba(255,255,255,0.10)';
      floorCtx.lineWidth = 1;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 6; col++) {
          floorCtx.beginPath();
          floorCtx.arc(p.x - 26 + col * 11, p.y - 17 + row * 11, 1.3, 0, Math.PI * 2);
          floorCtx.stroke();
        }
      }
      floorCtx.strokeStyle = '#c94f3a';
      floorCtx.lineWidth = 2.5;
      floorCtx.lineCap = 'round';
      floorCtx.beginPath();
      floorCtx.moveTo(p.x - 14, p.y + 12);
      floorCtx.lineTo(p.x - 14, p.y - 8);
      floorCtx.moveTo(p.x - 19, p.y - 8);
      floorCtx.lineTo(p.x - 9, p.y - 8);
      floorCtx.stroke();
      floorCtx.strokeStyle = '#9aa0a8';
      floorCtx.beginPath();
      floorCtx.moveTo(p.x + 10, p.y + 14);
      floorCtx.lineTo(p.x + 10, p.y - 10);
      floorCtx.stroke();
      floorCtx.beginPath();
      floorCtx.arc(p.x + 10, p.y - 10, 4, 0.3, Math.PI * 1.4);
      floorCtx.stroke();
    } else if (theme === 'basement') {
      const p = wallPoint(north, west, 0.5, 0.6);
      floorCtx.fillStyle = '#1a1512';
      floorCtx.fillRect(p.x - 26, p.y - 32, 52, 40);
      floorCtx.fillStyle = '#dcd0b8';
      floorCtx.fillRect(p.x - 22, p.y - 28, 44, 32);
      floorCtx.fillStyle = 'rgba(0,0,0,0.55)';
      floorCtx.fillRect(p.x - 17, p.y - 22, 34, 3);
      floorCtx.fillRect(p.x - 17, p.y - 15, 22, 3);
      floorCtx.fillRect(p.x - 17, p.y - 8, 26, 3);
      floorCtx.fillStyle = '#c0483a';
      floorCtx.fillRect(p.x - 17, p.y - 1, 12, 3);
    } else if (theme === 'rooftop') {
      const wallTopColor = 'rgba(255, 236, 190, 0.9)';
      [
        { from: north, to: east },
        { from: north, to: west },
      ].forEach(({ from, to }) => {
        floorCtx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const q = wallPoint(from, to, i / 6, 0.94);
          if (i === 0) floorCtx.moveTo(q.x, q.y);
          else floorCtx.lineTo(q.x, q.y);
        }
        floorCtx.strokeStyle = 'rgba(255,255,255,0.18)';
        floorCtx.lineWidth = 1.5;
        floorCtx.stroke();
        for (let i = 0; i <= 6; i++) {
          const q = wallPoint(from, to, i / 6, 0.94);
          floorCtx.beginPath();
          floorCtx.arc(q.x, q.y, 2.4, 0, Math.PI * 2);
          floorCtx.fillStyle = wallTopColor;
          floorCtx.shadowColor = wallTopColor;
          floorCtx.shadowBlur = 8;
          floorCtx.fill();
          floorCtx.shadowBlur = 0;
        }
      });
    }
  }

  function renderScene() {
    const colors = THEME_COLORS[state.theme] || THEME_COLORS.garage;
    const light = LIGHT_COLORS[state.theme] || LIGHT_COLORS.garage;
    const W = floorCanvas.width;
    const H = floorCanvas.height;
    floorCtx.clearRect(0, 0, W, H);

    const bgGrad = floorCtx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, colors.bgTop);
    bgGrad.addColorStop(1, colors.bg);
    floorCtx.fillStyle = bgGrad;
    floorCtx.fillRect(0, 0, W, H);

    const north = isoPoint(0, 0);
    const east = isoPoint(ROOM.cols, 0);
    const west = isoPoint(0, ROOM.rows);

    const wallRGrad = floorCtx.createLinearGradient(0, north.y - ROOM.wallH, 0, north.y);
    wallRGrad.addColorStop(0, shade(colors.wallR, 14));
    wallRGrad.addColorStop(1, shade(colors.wallR, -10));
    floorCtx.beginPath();
    floorCtx.moveTo(north.x, north.y - ROOM.wallH);
    floorCtx.lineTo(east.x, east.y - ROOM.wallH);
    floorCtx.lineTo(east.x, east.y);
    floorCtx.lineTo(north.x, north.y);
    floorCtx.closePath();
    floorCtx.fillStyle = wallRGrad;
    floorCtx.fill();

    const wallLGrad = floorCtx.createLinearGradient(0, north.y - ROOM.wallH, 0, north.y);
    wallLGrad.addColorStop(0, shade(colors.wallL, 14));
    wallLGrad.addColorStop(1, shade(colors.wallL, -10));
    floorCtx.beginPath();
    floorCtx.moveTo(north.x, north.y - ROOM.wallH);
    floorCtx.lineTo(west.x, west.y - ROOM.wallH);
    floorCtx.lineTo(west.x, west.y);
    floorCtx.lineTo(north.x, north.y);
    floorCtx.closePath();
    floorCtx.fillStyle = wallLGrad;
    floorCtx.fill();

    drawBaseboard(east, north);
    drawBaseboard(north, west);
    drawWallDecor(state.theme, north, east, west);

    const cells = allCellsBackToFront();

    cells.forEach(({ gx, gy }) => {
      const p0 = isoPoint(gx, gy);
      const p1 = isoPoint(gx + 1, gy);
      const p2 = isoPoint(gx + 1, gy + 1);
      const p3 = isoPoint(gx, gy + 1);
      const tileColor = (gx + gy) % 2 === 0 ? colors.floorA : colors.floorB;
      floorCtx.beginPath();
      floorCtx.moveTo(p0.x, p0.y);
      floorCtx.lineTo(p1.x, p1.y);
      floorCtx.lineTo(p2.x, p2.y);
      floorCtx.lineTo(p3.x, p3.y);
      floorCtx.closePath();
      floorCtx.fillStyle = tileColor;
      floorCtx.fill();
      floorCtx.strokeStyle = 'rgba(0,0,0,0.25)';
      floorCtx.lineWidth = 1;
      floorCtx.stroke();

      // Beveled-tile look: a light seam along the two edges facing the
      // room's light source (up/left in screen space), a dark seam along
      // the two facing away, instead of one flat fill.
      floorCtx.beginPath();
      floorCtx.moveTo(p0.x, p0.y);
      floorCtx.lineTo(p1.x, p1.y);
      floorCtx.strokeStyle = shade(tileColor, 20);
      floorCtx.lineWidth = 1;
      floorCtx.stroke();
      floorCtx.beginPath();
      floorCtx.moveTo(p0.x, p0.y);
      floorCtx.lineTo(p3.x, p3.y);
      floorCtx.stroke();
      floorCtx.beginPath();
      floorCtx.moveTo(p2.x, p2.y);
      floorCtx.lineTo(p1.x, p1.y);
      floorCtx.strokeStyle = shade(tileColor, -20);
      floorCtx.stroke();
      floorCtx.beginPath();
      floorCtx.moveTo(p2.x, p2.y);
      floorCtx.lineTo(p3.x, p3.y);
      floorCtx.stroke();
    });

    const roomCenterFloor = isoPoint(ROOM.cols / 2, ROOM.rows / 2);
    const lampAnchor = { x: roomCenterFloor.x, y: roomCenterFloor.y - ROOM.wallH + 6 };
    drawLightPool(roomCenterFloor, light.glow);

    cells.forEach(({ gx, gy }) => {
      const index = gy * ROOM.cols + gx;
      const itemId = state.layout[index];
      if (!itemId) return;
      const item = itemById(itemId);
      if (!item) return;
      const c = cellCenter(gx, gy);
      const catColor = CATEGORY_META[CATEGORY[itemId]].color;
      const mult = itemSynergyMultiplier(state.layout, index);

      // A glowing ring means this piece is currently getting a synergy
      // bonus from its neighbors -- direct visual payoff for arrangement.
      if (mult > 1) {
        floorCtx.beginPath();
        floorCtx.ellipse(c.x, c.y + 3, ROOM.tileW * 0.33, ROOM.tileH * 0.28, 0, 0, Math.PI * 2);
        floorCtx.strokeStyle = catColor;
        floorCtx.lineWidth = 2;
        floorCtx.shadowColor = catColor;
        floorCtx.shadowBlur = 10;
        floorCtx.stroke();
        floorCtx.shadowBlur = 0;
      }

      floorCtx.beginPath();
      floorCtx.ellipse(c.x, c.y + 3, ROOM.tileW * 0.28, ROOM.tileH * 0.24, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = hexA(catColor, 0.34);
      floorCtx.fill();

      const build = PROP_BUILDERS[itemId];
      if (build) {
        build(floorCtx, c);
      } else {
        floorCtx.font = '30px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
        floorCtx.textAlign = 'center';
        floorCtx.textBaseline = 'middle';
        floorCtx.fillText(item.emoji, c.x, c.y - 16);
      }
    });

    drawLampFixture(lampAnchor, light);

    const vignette = floorCtx.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.42, H * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    floorCtx.fillStyle = vignette;
    floorCtx.fillRect(0, 0, W, H);
  }

  function pointFromEvent(e) {
    const rect = floorCanvas.getBoundingClientRect();
    const scaleX = floorCanvas.width / rect.width;
    const scaleY = floorCanvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function gridCellFromPoint(px, py) {
    const dx = px - ROOM.originX;
    const dy = py - ROOM.originY;
    const a = dx / (ROOM.tileW / 2);
    const b = dy / (ROOM.tileH / 2);
    const gx = Math.floor((a + b) / 2);
    const gy = Math.floor((b - a) / 2);
    if (gx < 0 || gx >= ROOM.cols || gy < 0 || gy >= ROOM.rows) return null;
    return gy * ROOM.cols + gx;
  }

  floorCanvas.addEventListener('click', (e) => {
    const p = pointFromEvent(e);
    const index = gridCellFromPoint(p.x, p.y);
    if (index === null) return;
    onFloorCellClick(index);
  });

  function onFloorCellClick(index) {
    const current = state.layout[index];
    if (current) {
      state.layout[index] = null;
      renderScene();
      renderInventory();
      recomputeStats();
      save();
      return;
    }
    if (armedItemId && availableCount(armedItemId) > 0) {
      state.layout[index] = armedItemId;
      if (availableCount(armedItemId) <= 0) armedItemId = null;
      renderScene();
      renderInventory();
      recomputeStats();
      save();
    }
  }

  function renderInventory() {
    inventoryEl.innerHTML = '';
    const ownedItems = ITEMS.filter((item) => availableCount(item.id) > 0);
    if (ownedItems.length === 0) {
      const p = document.createElement('p');
      p.className = 'tycoon-inv-empty';
      p.textContent = state.layout.some(Boolean)
        ? 'Everything you own is already on the floor.'
        : 'Buy some gear below, then place it up here.';
      inventoryEl.appendChild(p);
      return;
    }
    ownedItems.forEach((item) => {
      const cat = CATEGORY_META[CATEGORY[item.id]];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tycoon-inv-item' + (armedItemId === item.id ? ' is-armed' : '');
      chip.innerHTML = '<span class="inv-cat-dot" style="background:' + cat.color + '"></span>'
        + item.emoji + ' ' + item.name + ' <span class="inv-count">x' + availableCount(item.id) + '</span>';
      chip.addEventListener('click', () => {
        armedItemId = armedItemId === item.id ? null : item.id;
        renderInventory();
      });
      inventoryEl.appendChild(chip);
    });
  }

  function refreshThemeRow() {
    themeRowEl.innerHTML = '';
    THEMES.forEach((t) => {
      const unlocked = state.lifetime >= t.unlockAt;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tycoon-theme-btn' + (state.theme === t.id ? ' is-active' : '') + (unlocked ? '' : ' is-locked');
      btn.textContent = unlocked ? t.name : t.name + ' 🔒 $' + formatNum(t.unlockAt);
      btn.disabled = !unlocked;
      btn.addEventListener('click', () => {
        state.theme = t.id;
        renderScene();
        refreshThemeRow();
        save();
      });
      themeRowEl.appendChild(btn);
    });
  }

  // ---- Lift button ----
  document.getElementById('btn-lift').addEventListener('click', () => {
    state.balance += clickAmount;
    state.lifetime += clickAmount;
    refreshHud();
    toast('+$' + formatNum(clickAmount), null);
  });

  // ---- Reset ----
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm("Reset all Gym Tycoon progress on this browser? This can't be undone.")) return;
    localStorage.removeItem(SAVE_KEY);
    state = defaultState();
    gps = 0;
    clickAmount = 1;
    armedItemId = null;
    refreshHud();
    refreshSynergyText();
    refreshShopUI();
    renderScene();
    renderInventory();
    refreshThemeRow();
    save();
  });

  // ---- Init ----
  buildShop();
  refreshHud();
  refreshSynergyText();
  refreshShopUI();
  renderScene();
  renderInventory();
  refreshThemeRow();

  setInterval(() => {
    state.balance += gps / (1000 / TICK_MS);
    state.lifetime += gps / (1000 / TICK_MS);
    refreshHud();
    refreshShopUI();
    refreshThemeRow();
  }, TICK_MS);

  setInterval(() => {
    save();
    updateLeaderboardEntry();
  }, 5000);

  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
})();
