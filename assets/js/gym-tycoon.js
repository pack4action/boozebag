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

    const elapsed = Math.max(0, (Date.now() - (saved.lastSaved || Date.now())) / 1000);
    const cappedElapsed = Math.min(elapsed, OFFLINE_CAP_SECONDS);
    const gpsAtSave = gpsFromOwned(s.owned);
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

  function gpsFromOwned(owned) {
    return ITEMS.reduce((sum, item) => sum + (owned[item.id] || 0) * item.gps, 0);
  }

  let state = load();
  let gps = gpsFromOwned(state.owned);
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
    gps = gpsFromOwned(state.owned);
    clickAmount = 1 + gps * 0.05;
    refreshHud();
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
      el.innerHTML =
        '<div class="shop-item-head">' +
          '<span class="shop-item-emoji">' + item.emoji + '</span>' +
          '<span class="shop-item-name">' + item.name + '</span>' +
          '<span class="shop-item-owned">x0</span>' +
        '</div>' +
        '<span class="shop-item-gps">+' + formatNum(item.gps) + ' gains/sec each</span>' +
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

  const ROOM = { cols: 4, rows: 3, tileW: 96, tileH: 48, wallH: 110, originX: 216, originY: 120 };
  const THEME_COLORS = {
    garage: { floorA: '#5c4530', floorB: '#4a3624', wallL: '#3a2c1c', wallR: '#2e2116', bgTop: '#241a10', bg: '#171310' },
    basement: { floorA: '#33404a', floorB: '#28333c', wallL: '#1c242c', wallR: '#161b21', bgTop: '#171b1f', bg: '#0e1114' },
    rooftop: { floorA: '#5a89ad', floorB: '#4a7594', wallL: '#3f6f94', wallR: '#2f5673', bgTop: '#3f6f94', bg: '#1c3348' },
  };

  function placedCount(itemId) {
    return state.layout.filter((x) => x === itemId).length;
  }
  function availableCount(itemId) {
    return (state.owned[itemId] || 0) - placedCount(itemId);
  }
  function itemById(id) {
    return ITEMS.find((i) => i.id === id);
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

  function renderScene() {
    const colors = THEME_COLORS[state.theme] || THEME_COLORS.garage;
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

    floorCtx.beginPath();
    floorCtx.moveTo(north.x, north.y - ROOM.wallH);
    floorCtx.lineTo(east.x, east.y - ROOM.wallH);
    floorCtx.lineTo(east.x, east.y);
    floorCtx.lineTo(north.x, north.y);
    floorCtx.closePath();
    floorCtx.fillStyle = colors.wallR;
    floorCtx.fill();

    floorCtx.beginPath();
    floorCtx.moveTo(north.x, north.y - ROOM.wallH);
    floorCtx.lineTo(west.x, west.y - ROOM.wallH);
    floorCtx.lineTo(west.x, west.y);
    floorCtx.lineTo(north.x, north.y);
    floorCtx.closePath();
    floorCtx.fillStyle = colors.wallL;
    floorCtx.fill();

    const cells = allCellsBackToFront();

    cells.forEach(({ gx, gy }) => {
      const p0 = isoPoint(gx, gy);
      const p1 = isoPoint(gx + 1, gy);
      const p2 = isoPoint(gx + 1, gy + 1);
      const p3 = isoPoint(gx, gy + 1);
      floorCtx.beginPath();
      floorCtx.moveTo(p0.x, p0.y);
      floorCtx.lineTo(p1.x, p1.y);
      floorCtx.lineTo(p2.x, p2.y);
      floorCtx.lineTo(p3.x, p3.y);
      floorCtx.closePath();
      floorCtx.fillStyle = (gx + gy) % 2 === 0 ? colors.floorA : colors.floorB;
      floorCtx.fill();
      floorCtx.strokeStyle = 'rgba(0,0,0,0.25)';
      floorCtx.lineWidth = 1;
      floorCtx.stroke();
    });

    cells.forEach(({ gx, gy }) => {
      const itemId = state.layout[gy * ROOM.cols + gx];
      if (!itemId) return;
      const item = itemById(itemId);
      if (!item) return;
      const c = cellCenter(gx, gy);

      floorCtx.beginPath();
      floorCtx.ellipse(c.x, c.y + 4, ROOM.tileW * 0.26, ROOM.tileH * 0.22, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = 'rgba(0,0,0,0.35)';
      floorCtx.fill();

      floorCtx.font = '30px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
      floorCtx.textAlign = 'center';
      floorCtx.textBaseline = 'middle';
      floorCtx.fillText(item.emoji, c.x, c.y - 16);
    });
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
      save();
      return;
    }
    if (armedItemId && availableCount(armedItemId) > 0) {
      state.layout[index] = armedItemId;
      if (availableCount(armedItemId) <= 0) armedItemId = null;
      renderScene();
      renderInventory();
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
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tycoon-inv-item' + (armedItemId === item.id ? ' is-armed' : '');
      chip.innerHTML = item.emoji + ' ' + item.name + ' <span class="inv-count">x' + availableCount(item.id) + '</span>';
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
    refreshShopUI();
    renderScene();
    renderInventory();
    refreshThemeRow();
    save();
  });

  // ---- Init ----
  buildShop();
  refreshHud();
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
