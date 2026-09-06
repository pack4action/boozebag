(function () {
  const hudTotal = document.getElementById('hud-total');
  if (!hudTotal) return;

  const SAVE_KEY = 'gymTycoonSave';
  const COST_GROWTH = 1.15;
  const OFFLINE_CAP_SECONDS = 8 * 3600;
  const SLOT_COUNT = 12;
  const TICK_MS = 100;

  const ITEMS = [
    { id: 'dumbbell', name: 'Dumbbell Set', baseCost: 15, gps: 0.1 },
    { id: 'dumbbellrack', name: 'Dumbbell Rack', baseCost: 35, gps: 0.22 },
    { id: 'mat', name: 'Yoga Mat', baseCost: 60, gps: 0.5 },
    { id: 'bench', name: 'Bench Press', baseCost: 200, gps: 2 },
    { id: 'rack', name: 'Squat Rack', baseCost: 800, gps: 8 },
    { id: 'cable', name: 'Cable Machine', baseCost: 3000, gps: 30 },
    { id: 'treadmill', name: 'Treadmill', baseCost: 10000, gps: 100 },
    { id: 'trainer', name: 'Personal Trainer', baseCost: 40000, gps: 400 },
    { id: 'sauna', name: 'Sauna', baseCost: 150000, gps: 1500 },
    { id: 'gear', name: 'Steroid Cycle', baseCost: 600000, gps: 6000 },
    { id: 'hq', name: 'Second Location', baseCost: 2500000, gps: 25000 },
    // Office tier: hidden in the shop until you've built the gym up past HQ
    // level (see unlockAt) -- the "then you build a desk for employees"
    // progression stage that comes after the core gym equipment.
    { id: 'desk', name: 'Reception Desk', baseCost: 10000000, gps: 100000, unlockAt: 2500000 },
    { id: 'cubicle', name: 'Sales Cubicle', baseCost: 40000000, gps: 400000, unlockAt: 10000000 },
    { id: 'manager', name: "Manager's Office", baseCost: 160000000, gps: 1600000, unlockAt: 40000000 },
  ];

  // Flat-shape line/solid icons (24x24) standing in for every item's old
  // emoji, plus a lock glyph for locked shop rows and theme buttons --
  // single-color (currentColor) so they inherit whatever text color the
  // surrounding UI element already uses.
  const ICON_PATHS = {
    dumbbell: '<rect x="2.5" y="9.2" width="3.2" height="5.6" rx="1.2"/><rect x="18.3" y="9.2" width="3.2" height="5.6" rx="1.2"/><rect x="5.5" y="7.4" width="2.4" height="9.2" rx="1"/><rect x="16.1" y="7.4" width="2.4" height="9.2" rx="1"/><rect x="7.7" y="10.9" width="8.6" height="2.2"/>',
    dumbbellrack: '<rect x="10.8" y="1.5" width="2.4" height="21" rx="0.8"/><rect x="4.5" y="7" width="15" height="2" rx="0.6"/><rect x="3" y="5.4" width="3" height="5.2" rx="1"/><rect x="18" y="5.4" width="3" height="5.2" rx="1"/><rect x="4.5" y="15" width="15" height="2" rx="0.6"/><rect x="3" y="13.4" width="3" height="5.2" rx="1"/><rect x="18" y="13.4" width="3" height="5.2" rx="1"/>',
    mat: '<rect x="6" y="9" width="15.5" height="6" rx="1.2"/><circle cx="6" cy="12" r="3.3"/>',
    bench: '<rect x="3" y="9.2" width="18" height="2.8" rx="1"/><rect x="5" y="12" width="2.3" height="7" rx="0.6"/><rect x="16.7" y="12" width="2.3" height="7" rx="0.6"/>',
    rack: '<rect x="4" y="2" width="2.4" height="20" rx="0.6"/><rect x="17.6" y="2" width="2.4" height="20" rx="0.6"/><rect x="4" y="10" width="16" height="2.2" rx="0.6"/>',
    cable: '<rect x="4" y="3" width="4" height="18" rx="1"/><circle cx="6" cy="6.2" r="2.1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.6 8.2 L16.5 17.8" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/><circle cx="17" cy="18.2" r="1.9"/>',
    treadmill: '<rect x="3" y="15.2" width="15" height="3.6" rx="1.4"/><rect x="15" y="4" width="3" height="12.5" rx="1"/><rect x="13.6" y="2.6" width="6" height="2.4" rx="1"/>',
    trainer: '<circle cx="12" cy="6.2" r="3.1"/><rect x="8" y="10.2" width="8" height="9.6" rx="3.2"/>',
    sauna: '<path d="M12 2.2c-1.2 3-4.6 4.7-4.6 9a4.6 4.6 0 0 0 9.2 0c0-2.1-1-3.3-2-4.6.1 1.7-1 2.9-2 2.9-1.2 0-1.7-1.2-1-2.4C13 5.6 13 4 12 2.2Z"/>',
    gear: '<rect x="1.2" y="10.9" width="3.4" height="2.2" rx="0.6"/><rect x="4.4" y="9.8" width="11" height="4.4" rx="1.2"/><rect x="15" y="10.6" width="6.4" height="2.8" rx="0.8"/>',
    hq: '<path d="M4 5 L12 1.4 L20 5 Z"/><rect x="5" y="5" width="14" height="17.4" rx="1"/>',
    desk: '<rect x="3" y="13.4" width="18" height="2.8" rx="1"/><rect x="5" y="16.2" width="2" height="5.4" rx="0.6"/><rect x="17" y="16.2" width="2" height="5.4" rx="0.6"/><rect x="9" y="5.4" width="6.4" height="6" rx="1"/><rect x="11.2" y="11.4" width="2" height="2.2"/>',
    cubicle: '<rect x="3" y="4" width="3" height="16.5" rx="0.8"/><rect x="3" y="4" width="14.5" height="3" rx="0.8"/><rect x="6" y="14.5" width="14.5" height="3" rx="1"/><rect x="15.3" y="8.2" width="5.2" height="5.2" rx="1"/>',
    manager: '<path d="M9 9V6.4a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><rect x="3" y="9" width="18" height="11.4" rx="2"/>',
    lock: '<path d="M7 10.4V7.2a5 5 0 0 1 10 0v3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="5" y="10.4" width="14" height="10" rx="2.2"/>',
  };
  function iconMarkup(id, sizePx) {
    const inner = ICON_PATHS[id] || '';
    const size = sizePx || 22;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + inner + '</svg>';
  }

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
    dumbbell: 'strength', dumbbellrack: 'strength', bench: 'strength', rack: 'strength', cable: 'strength',
    treadmill: 'cardio',
    mat: 'recovery', sauna: 'recovery',
    trainer: 'booster', gear: 'booster', hq: 'booster',
    desk: 'office', cubicle: 'office', manager: 'office',
  };
  const CATEGORY_META = {
    strength: { name: 'Strength', color: '#c0483a' },
    cardio: { name: 'Cardio', color: '#3fa0c9' },
    recovery: { name: 'Recovery', color: '#3fa87e' },
    booster: { name: 'Booster', color: '#d9a53f' },
    office: { name: 'Office', color: '#8a6fd1' },
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
  // Synergy is computed per-room: adjacency only matters within the same
  // grid, so equipment in different rooms never interacts.
  function computeGps(layout) {
    let total = 0;
    layout.forEach((itemId, index) => {
      const item = itemId && itemById(itemId);
      if (!item) return;
      total += item.gps * itemSynergyMultiplier(layout, index);
    });
    return total;
  }

  // Total across every room in every theme's chain -- gear earns
  // regardless of which theme/room is currently in view.
  function computeTotalGps(themeRooms) {
    return THEMES.reduce((sum, t) => (
      sum + (themeRooms[t.id] || []).reduce((s2, room) => s2 + computeGps(room.layout), 0)
    ), 0);
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

  // ---- Rooms ----
  // Garage/Basement/Rooftop are separate physical spaces, not reskins of
  // one shared floor -- each theme grows its own independent chain of
  // connected rooms (see the multi-lane canvas further down), so buying
  // an extra room only expands whichever theme you're currently in, and
  // gear never appears to "move" between themes.
  const ROOM_UNLOCK_COSTS = [0, 10000, 500000, 25000000];
  const MAX_ROOMS_PER_THEME = ROOM_UNLOCK_COSTS.length;

  function emptyGymRoom() {
    return { layout: new Array(SLOT_COUNT).fill(null) };
  }

  function defaultThemeRooms() {
    const byTheme = {};
    THEMES.forEach((t) => { byTheme[t.id] = [emptyGymRoom()]; });
    return byTheme;
  }

  function normalizedRoomChain(source) {
    const arr = Array.isArray(source) ? source : [];
    const rooms = arr.slice(0, MAX_ROOMS_PER_THEME).map((r) => {
      const old = Array.isArray(r && r.layout) ? r.layout : [];
      return { layout: new Array(SLOT_COUNT).fill(null).map((_, i) => old[i] || null) };
    });
    return rooms.length ? rooms : [emptyGymRoom()];
  }

  // ---- Persistence ----
  function defaultState() {
    return {
      balance: 0,
      lifetime: 0,
      owned: {},
      themeRooms: defaultThemeRooms(),
      activeTheme: 'garage',
      activeRoomIndex: 0,
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
    // Object.assign above copies these over verbatim from an old-shape
    // save -- drop them so the persisted state doesn't carry dead fields
    // around forever alongside the new `themeRooms` map.
    delete s.layout;
    delete s.theme;
    delete s.rooms;
    delete s.activeRoom;

    if (Array.isArray(saved.rooms)) {
      // Migrate from the room-slot-with-a-layout-per-theme shape: each old
      // slot's layout for theme T becomes one room in theme T's own
      // chain, in the same slot order, so nothing placed anywhere is lost.
      const byTheme = {};
      THEMES.forEach((t) => {
        byTheme[t.id] = normalizedRoomChain(saved.rooms.map((r) => ({
          layout: (r && r.layouts && r.layouts[t.id]) || (r && r.layout) || [],
        })));
      });
      s.themeRooms = byTheme;
      const oldActiveSlot = saved.rooms[saved.activeRoom];
      s.activeTheme = (oldActiveSlot && oldActiveSlot.theme) || 'garage';
      s.activeRoomIndex = Number.isInteger(saved.activeRoom) ? saved.activeRoom : 0;
    } else if (Array.isArray(saved.layout)) {
      // Migrate from the original single top-level layout/theme shape.
      const theme = saved.theme || 'garage';
      const byTheme = defaultThemeRooms();
      byTheme[theme] = [{ layout: new Array(SLOT_COUNT).fill(null).map((_, i) => saved.layout[i] || null) }];
      s.themeRooms = byTheme;
      s.activeTheme = theme;
      s.activeRoomIndex = 0;
    } else {
      const byTheme = {};
      THEMES.forEach((t) => {
        byTheme[t.id] = normalizedRoomChain(saved.themeRooms && saved.themeRooms[t.id]);
      });
      s.themeRooms = byTheme;
    }

    if (!THEMES.some((t) => t.id === s.activeTheme)) s.activeTheme = 'garage';
    const activeChain = s.themeRooms[s.activeTheme] || [];
    s.activeRoomIndex = Number.isInteger(s.activeRoomIndex) && s.activeRoomIndex >= 0 && s.activeRoomIndex < activeChain.length
      ? s.activeRoomIndex
      : 0;

    // Migration for saves from before placement mattered: if every room in
    // every theme is empty but the player owns gear, auto-fill the first
    // garage room so returning players don't come back to a sudden $0/s.
    const allEmpty = THEMES.every((t) => s.themeRooms[t.id].every((r) => r.layout.every((x) => !x)));
    if (allEmpty) {
      const toPlace = [];
      ITEMS.forEach((item) => {
        const count = s.owned[item.id] || 0;
        for (let i = 0; i < count; i++) toPlace.push(item.id);
      });
      const firstLayout = s.themeRooms.garage[0].layout;
      toPlace.slice(0, SLOT_COUNT).forEach((id, i) => { firstLayout[i] = id; });
    }

    const elapsed = Math.max(0, (Date.now() - (saved.lastSaved || Date.now())) / 1000);
    const cappedElapsed = Math.min(elapsed, OFFLINE_CAP_SECONDS);
    const gpsAtSave = computeTotalGps(s.themeRooms);
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
  // The current theme's own chain of rooms, and whichever one in it is
  // focused for placement/shop/synergy purposes.
  function activeRooms() {
    return state.themeRooms[state.activeTheme];
  }
  function activeRoom() {
    return activeRooms()[state.activeRoomIndex];
  }
  let gps = computeTotalGps(state.themeRooms);
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
    gps = computeTotalGps(state.themeRooms);
    clickAmount = 1 + gps * 0.05;
    refreshHud();
    refreshSynergyText();
  }

  // ---- Room synergy readout (describes the theme/layout currently in view) ----
  const synergyEl = document.getElementById('tycoon-synergy');
  function refreshSynergyText() {
    if (!synergyEl) return;
    const layout = activeRoom().layout;
    const placed = layout.filter(Boolean).length;
    if (placed === 0) {
      synergyEl.textContent = "This room is empty = $0/s from here. Arm a piece of gear below and click a tile to start earning.";
      return;
    }
    const baseSum = layout.reduce((sum, id) => sum + (id ? itemById(id).gps : 0), 0);
    const roomGps = computeGps(layout);
    const bonusPct = baseSum > 0 ? Math.round((roomGps / baseSum - 1) * 100) : 0;
    synergyEl.textContent = placed + '/' + SLOT_COUNT + ' slots filled -- base ' + formatNum(baseSum) + '/s'
      + (bonusPct > 0 ? ', +' + bonusPct + '% from arrangement synergy' : ', no synergy bonus yet')
      + ' = ' + formatNum(roomGps) + '/s from this room.';
  }

  // ---- Shop ----
  function costFor(item) {
    return Math.ceil(item.baseCost * Math.pow(COST_GROWTH, state.owned[item.id] || 0));
  }

  const SELL_REFUND_RATE = 0.6;
  // Refunds 60% of what the most recently bought unit actually cost --
  // costFor scales with owned count, so pricing it one unit down gives
  // exactly that unit's purchase price, not the (higher) next-buy price.
  function sellPrice(item) {
    const owned = state.owned[item.id] || 0;
    if (owned <= 0) return 0;
    const lastUnitCost = Math.ceil(item.baseCost * Math.pow(COST_GROWTH, owned - 1));
    return Math.floor(lastUnitCost * SELL_REFUND_RATE);
  }

  // Only unplaced (available) gear can be sold -- selling a piece that's
  // on the floor would need to also rip it out of whatever room/theme
  // it's sitting in, so requiring it be packed away first keeps the
  // room's layout the single source of truth for what's placed.
  function sellItem(id) {
    const item = ITEMS.find((i) => i.id === id);
    if (!item || availableCount(id) <= 0) return;
    const refund = sellPrice(item);
    state.owned[id] -= 1;
    state.balance += refund;
    if (armedItemId === id && availableCount(id) <= 0) armedItemId = null;
    recomputeStats();
    refreshShopUI();
    renderInventory();
    save();
    toast('+$' + formatNum(refund), 'legend-paper');
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
          '<span class="shop-item-emoji" style="color:' + cat.color + '">' + iconMarkup(item.id, 26) + '</span>' +
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
      const unlockAt = item.unlockAt || 0;
      const unlocked = state.lifetime >= unlockAt;
      els.root.classList.toggle('is-locked', !unlocked);
      if (!unlocked) {
        els.ownedEl.textContent = '';
        els.buyBtn.innerHTML = '<span class="btn-lock-icon">' + iconMarkup('lock', 13) + '</span> Unlocks at $' + formatNum(unlockAt) + ' lifetime';
        els.buyBtn.disabled = true;
        els.root.classList.remove('is-affordable');
        return;
      }
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
    if (state.lifetime < (item.unlockAt || 0)) return;
    const cost = costFor(item);
    if (state.balance < cost) return;
    state.balance -= cost;
    state.owned[id] = (state.owned[id] || 0) + 1;
    // Auto-drop new gear into an open slot in the room+theme currently in
    // view so it starts earning right away. Once that's full, further
    // purchases sit in inventory until you free up a slot somewhere --
    // that's the point where arranging what to keep on the floor (or
    // switching theme, or buying another room) actually becomes a decision.
    const layout = activeRoom().layout;
    const emptyIndex = layout.indexOf(null);
    if (emptyIndex !== -1) {
      layout[emptyIndex] = id;
      renderScene();
    }
    recomputeStats();
    refreshShopUI();
    renderInventory();
    refreshRoomTabs();
    updateLeaderboardEntry();
    save();
  }

  // ---- Floor designer: isometric room rendered on canvas ----
  const floorCanvas = document.getElementById('tycoon-floor');
  const floorCtx = floorCanvas.getContext('2d');
  const inventoryEl = document.getElementById('tycoon-inventory');
  const themeRowEl = document.getElementById('theme-row');
  let armedItemId = null;

  // Every room gets its own fixed-width "lane" on one continuous canvas,
  // laid out left to right and joined by a connecting walkway, instead of
  // each room being a separate view swapped via tabs. LANE_W is the
  // original single-room logical width (every ROOM/isoPoint number below
  // is authored against that one lane, at its own local origin) -- BASE_W
  // is the full multi-lane canvas width and grows as rooms are bought.
  const LANE_W = floorCanvas.width;
  const BASE_H = floorCanvas.height;
  let BASE_W = LANE_W;
  function updateWorldWidth() {
    BASE_W = LANE_W * activeRooms().length;
  }

  // Pan is native container scrolling; zoom is a CSS transform on the
  // canvas itself sitting inside a wrapper sized to match (so the
  // scrollable area's dimensions stay correct at any zoom level). Click
  // math (pointFromEvent) is already ratio-based off getBoundingClientRect,
  // which reflects both scroll position and the zoom transform, so it
  // needs no special-casing for either.
  let zoomLevel = 1;
  const ZOOM_MIN = 0.6;
  const ZOOM_MAX = 1.6;
  const ZOOM_STEP = 0.2;
  const zoomWrapEl = document.getElementById('room-zoom-wrap');
  const stageScrollEl = document.getElementById('room-stage-scroll');

  function applyStageSizing() {
    if (zoomWrapEl) {
      zoomWrapEl.style.width = (BASE_W * zoomLevel) + 'px';
      zoomWrapEl.style.height = (BASE_H * zoomLevel) + 'px';
    }
    floorCanvas.style.width = BASE_W + 'px';
    floorCanvas.style.height = BASE_H + 'px';
    floorCanvas.style.transform = 'scale(' + zoomLevel + ')';
    floorCanvas.style.transformOrigin = 'top left';
  }

  function setZoom(next) {
    zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(next * 100) / 100));
    applyStageSizing();
  }

  function scrollToRoom(index) {
    if (!stageScrollEl) return;
    const laneCenter = (index + 0.5) * LANE_W * zoomLevel;
    stageScrollEl.scrollTo({ left: Math.max(0, laneCenter - stageScrollEl.clientWidth / 2), behavior: 'smooth' });
  }

  function fitCanvasResolution() {
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(BASE_W * dpr);
    const targetH = Math.round(BASE_H * dpr);
    if (floorCanvas.width !== targetW || floorCanvas.height !== targetH) {
      floorCanvas.width = targetW;
      floorCanvas.height = targetH;
    }
    floorCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

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

  // Placement counts are global across every room in every theme's chain
  // -- an item bought once can only be on one floor at a time, wherever
  // you put it.
  function placedCount(itemId) {
    return THEMES.reduce((sum, t) => (
      sum + state.themeRooms[t.id].reduce((s2, room) => s2 + room.layout.filter((x) => x === itemId).length, 0)
    ), 0);
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

  // A single point on a prop's surface, (u, v) tile-units from its base and
  // liftPx up off the ground -- for a box drawn at that same (u, v, lift)
  // this lands exactly on its right-face plane, so small flat details
  // (windows, screens, buttons) can be stamped directly onto a box's face.
  function isoScreenPoint(base, u, v, liftPx) {
    const c = isoVecRaw(u, v);
    return { x: base.x + c.x, y: base.y + c.y - (liftPx || 0) };
  }

  // A shaded round disc (weight plate, pulley wheel, a head) -- boxes can't
  // read as round objects no matter how much corner rounding they get, so
  // genuinely circular parts are drawn as real ellipses with a radial
  // shading gradient instead of being approximated with a rounded cuboid.
  function drawIsoDisc(ctx, center, rx, ry, color) {
    const grad = ctx.createRadialGradient(center.x - rx * 0.35, center.y - ry * 0.35, 1, center.x, center.y, Math.max(rx, ry));
    grad.addColorStop(0, shade(color, 22));
    grad.addColorStop(1, shade(color, -26));
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Traces a quad p0->p1->p2->p3 with each corner rounded by r, clamped to
  // half the shorter adjacent edge so small/thin quads just come out
  // pill-shaped instead of self-intersecting. Softens every box face so
  // props read as solid rounded objects instead of sharp-cornered blocks.
  function roundedQuadPath(ctx, p0, p1, p2, p3, r) {
    const pts = [p0, p1, p2, p3];
    for (let i = 0; i < 4; i++) {
      const prev = pts[(i + 3) % 4];
      const cur = pts[i];
      const next = pts[(i + 1) % 4];
      const toPrev = Math.hypot(prev.x - cur.x, prev.y - cur.y) || 1;
      const toNext = Math.hypot(next.x - cur.x, next.y - cur.y) || 1;
      const rr = Math.min(r, toPrev / 2, toNext / 2);
      const inFrom = { x: cur.x + (prev.x - cur.x) / toPrev * rr, y: cur.y + (prev.y - cur.y) / toPrev * rr };
      const outTo = { x: cur.x + (next.x - cur.x) / toNext * rr, y: cur.y + (next.y - cur.y) / toNext * rr };
      if (i === 0) ctx.moveTo(inFrom.x, inFrom.y);
      else ctx.lineTo(inFrom.x, inFrom.y);
      ctx.quadraticCurveTo(cur.x, cur.y, outTo.x, outTo.y);
    }
    ctx.closePath();
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
    // Corner radius scales down for small/thin boxes (accents, bars) so
    // they don't get over-rounded into blobs, but stays big enough on
    // normal-sized boxes to visibly soften every hard edge.
    const r = Math.min(5, Math.min(halfA, halfB) * ROOM.tileW * 0.4, height * 0.35);

    // Left face: vertical gradient instead of one flat tint, so it reads as
    // a lit surface rather than a solid color swatch.
    const leftGrad = ctx.createLinearGradient(pLeft.x, top(pLeft).y, pLeft.x, pLeft.y);
    leftGrad.addColorStop(0, shade(color, -22));
    leftGrad.addColorStop(1, shade(color, -44));
    ctx.beginPath();
    roundedQuadPath(ctx, pLeft, pFront, top(pFront), top(pLeft), r);
    ctx.fillStyle = leftGrad;
    ctx.fill();
    ctx.stroke();

    // Right face: faces the room's light more directly, brighter overall.
    const rightGrad = ctx.createLinearGradient(pRight.x, top(pRight).y, pRight.x, pRight.y);
    rightGrad.addColorStop(0, shade(color, 4));
    rightGrad.addColorStop(1, shade(color, -20));
    ctx.beginPath();
    roundedQuadPath(ctx, pFront, pRight, top(pRight), top(pFront), r);
    ctx.fillStyle = rightGrad;
    ctx.fill();
    ctx.stroke();

    // Top face: brightest near the front corner (closest to the ceiling
    // light and the viewer), dimming toward the back.
    const topGrad = ctx.createLinearGradient(top(pBack).x, top(pBack).y, top(pFront).x, top(pFront).y);
    topGrad.addColorStop(0, shade(color, 10));
    topGrad.addColorStop(1, shade(color, 32));
    ctx.beginPath();
    roundedQuadPath(ctx, top(pFront), top(pRight), top(pBack), top(pLeft), r);
    ctx.fillStyle = topGrad;
    ctx.fill();
    ctx.stroke();

    // Rim highlight on the nearest vertical edge, where the two side faces
    // meet -- the brightest line on the box, like light catching an edge.
    ctx.beginPath();
    ctx.moveTo(pFront.x, pFront.y + r);
    ctx.lineTo(top(pFront).x, top(pFront).y - r);
    ctx.strokeStyle = shade(color, 48);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Real icon art for equipment, where we have it -- drawn as a flat
  // "billboard" sprite standing on the tile rather than skewed into the
  // isometric projection (the standard, accepted way isometric games
  // render sprites that weren't modeled/drawn in true 3D). Items without
  // an entry here fall back to the hand-drawn PROP_BUILDERS box below.
  const ITEM_SPRITE_SRC = {
    dumbbell: 'assets/img/equipment/dumbbell.png',
    dumbbellrack: 'assets/img/equipment/dumbbell-rack.png',
    cable: 'assets/img/equipment/cable.png',
    treadmill: 'assets/img/equipment/treadmill.png',
    rack: 'assets/img/equipment/rack.png',
    mat: 'assets/img/equipment/mat.png',
    bench: 'assets/img/equipment/bench.png',
    trainer: 'assets/img/equipment/trainer.png',
    sauna: 'assets/img/equipment/sauna.png',
    gear: 'assets/img/equipment/gear.png',
    desk: 'assets/img/equipment/desk.png',
    cubicle: 'assets/img/equipment/cubicle.png',
  };
  const itemSprites = {};
  Object.keys(ITEM_SPRITE_SRC).forEach((id) => {
    const img = new Image();
    img.onload = () => renderScene();
    img.src = ITEM_SPRITE_SRC[id];
    itemSprites[id] = img;
  });

  // Per-item overrides: `scale` shrinks a sprite that reads too large for
  // its tile (a flat, wide object like a mat photographed on a diagonal
  // needs to be sized down more than a naturally tall/narrow one), and
  // `anchor` shifts how far the image's bottom edge sits below the tile
  // center -- an object whose visual "weight" isn't near the bottom of
  // its own bounding box (a dumbbell shot at an angle, a mat lying flat)
  // needs a bigger push down or it reads as floating above its shadow.
  const ITEM_SPRITE_TUNING = {
    dumbbell: { scale: 0.48, anchor: 0.34 },
    mat: { scale: 0.58, anchor: 0.36 },
  };
  const DEFAULT_SPRITE_TUNING = { scale: 1, anchor: 0.16 };

  function drawItemSprite(ctx, center, img, itemId) {
    const ready = img.complete && img.naturalWidth > 0;
    if (!ready) return false;
    const tuning = ITEM_SPRITE_TUNING[itemId] || DEFAULT_SPRITE_TUNING;
    const maxH = ROOM.tileH * 1.45 * tuning.scale;
    const maxW = ROOM.tileW * 1.15 * tuning.scale;
    const aspect = img.naturalWidth / img.naturalHeight;
    let h = maxH;
    let w = h * aspect;
    if (w > maxW) {
      w = maxW;
      h = w / aspect;
    }
    ctx.drawImage(img, center.x - w / 2, center.y - h + h * tuning.anchor, w, h);
    return true;
  }

  // Each piece of equipment is built from a couple of shaded boxes rather
  // than a flat emoji sticker, so it actually reads as part of the 3D room.
  const PROP_BUILDERS = {
    dumbbell: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.30, 0.20, 4, '#4a3c2e', 0);
      drawIsoBox(ctx, b, 0, 0, 0.15, 0.032, 5, '#9a9aa0', 4);
      [-0.15, 0.15].forEach((u) => {
        const p = isoScreenPoint(b, u, 0, 17);
        drawIsoDisc(ctx, p, 9, 13, '#26262a');
        drawIsoDisc(ctx, p, 3.2, 4.6, '#6a6a70');
      });
    },
    dumbbellrack: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.03, 0.20, 30, '#5a5a60', 0);
      drawIsoBox(ctx, b, 0, -0.10, 0.20, 0.03, 3, '#3a3a3e', 24);
      drawIsoBox(ctx, b, 0, 0.10, 0.20, 0.03, 3, '#3a3a3e', 10);
      [-0.10, 0.10].forEach((v) => {
        [24, 10].forEach((lift) => {
          const p = isoScreenPoint(b, 0.16, v, lift + 3);
          drawIsoDisc(ctx, p, 5, 7, '#26262a');
        });
      });
    },
    mat: (ctx, b) => {
      drawIsoBox(ctx, b, 0.02, 0, 0.32, 0.20, 5, '#3fa8a0', 0);
      drawIsoBox(ctx, b, -0.28, 0, 0.05, 0.19, 9, '#2c8c85', 0);
    },
    bench: (ctx, b) => {
      drawIsoBox(ctx, b, 0, -0.28, 0.08, 0.06, 24, '#7a7a80', 0);
      drawIsoBox(ctx, b, 0, 0.28, 0.08, 0.06, 24, '#7a7a80', 0);
      drawIsoBox(ctx, b, 0, 0, 0.14, 0.34, 10, '#2255aa', 20);
      drawIsoBox(ctx, b, 0, 0, 0.24, 0.04, 4, '#26262a', 33);
      [-0.20, 0.20].forEach((u) => {
        const p = isoScreenPoint(b, u, 0, 35);
        drawIsoDisc(ctx, p, 7, 10, '#c0483a');
      });
    },
    rack: (ctx, b) => {
      drawIsoBox(ctx, b, -0.20, -0.20, 0.045, 0.045, 42, '#5a5a60', 0);
      drawIsoBox(ctx, b, 0.20, -0.20, 0.045, 0.045, 42, '#5a5a60', 0);
      drawIsoBox(ctx, b, -0.20, 0.20, 0.045, 0.045, 42, '#5a5a60', 0);
      drawIsoBox(ctx, b, 0.20, 0.20, 0.045, 0.045, 42, '#5a5a60', 0);
      drawIsoBox(ctx, b, 0, -0.20, 0.22, 0.03, 3, '#3a3a3e', 22);
      drawIsoBox(ctx, b, 0, 0.20, 0.22, 0.03, 3, '#3a3a3e', 22);
      drawIsoBox(ctx, b, 0, 0, 0.24, 0.24, 4, '#c0483a', 42);
    },
    cable: (ctx, b) => {
      drawIsoBox(ctx, b, -0.10, 0, 0.09, 0.11, 4, '#26262a', 0);
      drawIsoBox(ctx, b, -0.10, 0, 0.08, 0.10, 46, '#3a3a3e', 4);
      drawIsoDisc(ctx, isoScreenPoint(b, -0.10, 0, 51), 6, 4.2, '#c0483a');
      drawIsoBox(ctx, b, 0.14, 0, 0.10, 0.14, 20, '#4a5a6a', 0);
      drawIsoBox(ctx, b, 0.14, 0, 0.08, 0.03, 4, '#8fa4b4', 18);
      drawIsoBox(ctx, b, 0.14, 0, 0.08, 0.03, 4, '#c0483a', 12);
    },
    treadmill: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0.02, 0.32, 0.18, 8, '#26262a', 0);
      drawIsoBox(ctx, b, 0, -0.20, 0.06, 0.16, 24, '#3a3a3e', 8);
      drawIsoBox(ctx, b, 0, -0.24, 0.10, 0.03, 4, '#5ec4c9', 30);
      drawIsoBox(ctx, b, -0.17, -0.05, 0.03, 0.03, 20, '#2a2a2e', 8);
      drawIsoBox(ctx, b, 0.17, -0.05, 0.03, 0.03, 20, '#2a2a2e', 8);
    },
    trainer: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0.02, 0.09, 0.08, 15, '#2a2a2e', 0);
      drawIsoBox(ctx, b, 0, 0, 0.13, 0.11, 20, '#c98a4a', 15);
      drawIsoBox(ctx, b, -0.14, 0, 0.04, 0.045, 14, '#c98a4a', 20);
      drawIsoBox(ctx, b, 0.14, 0, 0.04, 0.045, 14, '#c98a4a', 20);
      drawIsoDisc(ctx, isoScreenPoint(b, 0, 0, 40), 7.5, 7.5, '#e0a86a');
      drawIsoBox(ctx, b, 0, -0.02, 0.085, 0.06, 3, '#8a5a2e', 46);
    },
    sauna: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.30, 0.26, 44, '#8a5a34', 0);
      drawIsoBox(ctx, b, 0.08, -0.22, 0.08, 0.02, 26, '#5a3c22', 4);
      drawIsoBox(ctx, b, 0, 0, 0.10, 0.10, 10, '#e8b04a', 44);
      drawIsoBox(ctx, b, 0, 0, 0.05, 0.05, 5, '#ffe0a0', 54);
    },
    gear: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.09, 0.09, 22, '#c0483a', 0);
      drawIsoDisc(ctx, isoScreenPoint(b, 0, 0, 22), 6.5, 4.2, '#8a2e24');
      drawIsoBox(ctx, b, 0, 0, 0.03, 0.03, 9, '#e8e8ea', 22);
      drawIsoBox(ctx, b, 0, 0, 0.012, 0.012, 11, '#c8c8ce', 31);
    },
    hq: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.36, 0.32, 4, '#2e3844', 0);
      drawIsoBox(ctx, b, 0, 0, 0.34, 0.30, 60, '#4a5a6a', 4);
      drawIsoBox(ctx, b, 0, 0, 0.20, 0.18, 14, '#c0483a', 64);
      ctx.fillStyle = '#e8d98a';
      [-0.14, 0.14].forEach((v) => {
        const w = isoScreenPoint(b, 0.34, v, 44);
        ctx.fillRect(w.x - 4, w.y - 5, 8, 8);
      });
      ctx.fillStyle = '#241a10';
      const door = isoScreenPoint(b, 0.34, 0, 18);
      ctx.fillRect(door.x - 5, door.y - 14, 10, 14);
    },
    desk: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0.02, 0.30, 0.20, 11, '#6b4a30', 0);
      drawIsoBox(ctx, b, 0.10, -0.08, 0.03, 0.03, 9, '#26262a', 11);
      drawIsoBox(ctx, b, 0.10, -0.08, 0.09, 0.02, 7, '#3fa0c9', 18);
    },
    cubicle: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0.08, 0.10, 0.24, 30, '#9aa4b0', 0);
      drawIsoBox(ctx, b, -0.20, -0.06, 0.24, 0.06, 28, '#9aa4b0', 0);
      drawIsoBox(ctx, b, 0.06, -0.08, 0.20, 0.14, 9, '#6b4a30', 0);
      drawIsoBox(ctx, b, 0.06, -0.18, 0.045, 0.03, 8, '#26262a', 9);
      drawIsoBox(ctx, b, 0.06, -0.18, 0.10, 0.02, 6, '#3fa0c9', 15);
    },
    manager: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0.06, 0.30, 0.22, 12, '#3a2c22', 0);
      drawIsoBox(ctx, b, 0.10, -0.10, 0.03, 0.03, 10, '#26262a', 12);
      drawIsoBox(ctx, b, 0, -0.22, 0.11, 0.09, 20, '#241a10', 0);
      drawIsoBox(ctx, b, -0.22, 0.20, 0.07, 0.07, 4, '#8a5a34', 0);
      drawIsoBox(ctx, b, -0.22, 0.20, 0.05, 0.05, 15, '#3fa87e', 4);
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

    // A tighter, brighter hot spot right under the fixture on top of the
    // wide ambient pool -- gives the floor a real specular sheen instead
    // of one flat wash of color.
    const hot = floorCtx.createRadialGradient(center.x, center.y, 0, center.x, center.y, ROOM.tileW * 0.5);
    hot.addColorStop(0, 'rgba(255,255,255,0.22)');
    hot.addColorStop(1, 'rgba(255,255,255,0)');
    floorCtx.fillStyle = hot;
    floorCtx.beginPath();
    floorCtx.ellipse(center.x, center.y, ROOM.tileW * 0.5, ROOM.tileH * 0.5, 0, 0, Math.PI * 2);
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

  // The walls/floor only cover the middle ~70% of the canvas width -- the
  // ~70px strips on either side (and the sliver above the wall peak) are
  // plain background. Give each theme something to actually look at back
  // there instead of a flat gradient: a skyline for rooftop, rafters and
  // stacked tires for garage, exposed ductwork for basement. Drawn before
  // the walls, so the walls correctly cover whatever part would fall
  // behind them.
  function drawBackdrop(theme, W, H) {
    if (theme === 'rooftop') {
      const sunX = W - 68;
      const sunY = 54;
      const sunGlow = floorCtx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 48);
      sunGlow.addColorStop(0, 'rgba(255,244,200,0.9)');
      sunGlow.addColorStop(1, 'rgba(255,244,200,0)');
      floorCtx.fillStyle = sunGlow;
      floorCtx.beginPath();
      floorCtx.arc(sunX, sunY, 48, 0, Math.PI * 2);
      floorCtx.fill();
      floorCtx.beginPath();
      floorCtx.arc(sunX, sunY, 13, 0, Math.PI * 2);
      floorCtx.fillStyle = '#fff6da';
      floorCtx.fill();

      floorCtx.fillStyle = 'rgba(255,255,255,0.32)';
      [[46, 38, 22], [118, 64, 15], [W - 140, 88, 17]].forEach(([cx, cy, r]) => {
        floorCtx.beginPath();
        floorCtx.ellipse(cx, cy, r * 1.6, r * 0.65, 0, 0, Math.PI * 2);
        floorCtx.fill();
      });

      const skylineY = 300;
      const buildings = [
        { x: 0, w: 26, h: 120 }, { x: 24, w: 20, h: 82 }, { x: 42, w: 30, h: 152 },
        { x: W - 30, w: 30, h: 132 }, { x: W - 55, w: 22, h: 92 }, { x: W - 78, w: 24, h: 162 },
      ];
      buildings.forEach((b) => {
        floorCtx.fillStyle = 'rgba(26,46,66,0.6)';
        floorCtx.fillRect(b.x, skylineY - b.h, b.w, b.h);
        floorCtx.fillStyle = 'rgba(255,228,158,0.55)';
        for (let wy = skylineY - b.h + 10; wy < skylineY - 8; wy += 13) {
          for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 8) {
            if (((wx + wy) * 7) % 5 < 2) floorCtx.fillRect(wx, wy, 3, 4);
          }
        }
      });
    } else if (theme === 'garage') {
      floorCtx.strokeStyle = shade(THEME_COLORS.garage.bg, 40);
      floorCtx.lineWidth = 4;
      floorCtx.lineCap = 'round';
      [[0, 26], [0, 88], [W, 26], [W, 88]].forEach(([x, y]) => {
        floorCtx.beginPath();
        floorCtx.moveTo(x, y);
        floorCtx.lineTo(ROOM.originX, -8);
        floorCtx.stroke();
      });

      [[32, 256, 24], [32, 212, 20]].forEach(([x, y, r]) => {
        floorCtx.beginPath();
        floorCtx.arc(x, y, r, 0, Math.PI * 2);
        floorCtx.fillStyle = '#100f0d';
        floorCtx.fill();
        floorCtx.strokeStyle = '#4a453e';
        floorCtx.lineWidth = 1.5;
        floorCtx.stroke();
        floorCtx.beginPath();
        floorCtx.arc(x, y, r * 0.45, 0, Math.PI * 2);
        floorCtx.fillStyle = '#4a453e';
        floorCtx.fill();
      });

      [150, 190, 230].forEach((y) => {
        floorCtx.fillStyle = 'rgba(0,0,0,0.4)';
        floorCtx.fillRect(W - 48, y, 32, 6);
        floorCtx.fillStyle = 'rgba(255,255,255,0.08)';
        floorCtx.fillRect(W - 48, y, 32, 1.5);
      });
      floorCtx.fillStyle = '#c0483a';
      floorCtx.fillRect(W - 40, 160, 10, 24);
      floorCtx.fillStyle = '#3fa8a0';
      floorCtx.fillRect(W - 26, 200, 8, 26);
    } else if (theme === 'basement') {
      floorCtx.strokeStyle = '#3a4650';
      floorCtx.lineWidth = 5;
      floorCtx.beginPath();
      floorCtx.moveTo(0, 20);
      floorCtx.lineTo(W, 20);
      floorCtx.stroke();
      floorCtx.fillStyle = '#4a5862';
      for (let x = 10; x < W; x += 55) {
        floorCtx.beginPath();
        floorCtx.arc(x, 20, 5, 0, Math.PI * 2);
        floorCtx.fill();
      }
      floorCtx.strokeStyle = '#3a4650';
      floorCtx.lineWidth = 4;
      [28, W - 28].forEach((x) => {
        floorCtx.beginPath();
        floorCtx.moveTo(x, 20);
        floorCtx.lineTo(x, 262);
        floorCtx.stroke();
      });
      floorCtx.fillStyle = 'rgba(180,210,230,0.14)';
      floorCtx.beginPath();
      floorCtx.moveTo(30, 100);
      floorCtx.lineTo(90, 260);
      floorCtx.lineTo(30, 260);
      floorCtx.closePath();
      floorCtx.fill();
    }
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
    updateWorldWidth();
    fitCanvasResolution();
    applyStageSizing();
    const colors = THEME_COLORS[state.activeTheme] || THEME_COLORS.garage;
    const light = LIGHT_COLORS[state.activeTheme] || LIGHT_COLORS.garage;
    const W = BASE_W;
    const H = BASE_H;
    floorCtx.clearRect(0, 0, W, H);

    const bgGrad = floorCtx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, colors.bgTop);
    bgGrad.addColorStop(1, colors.bg);
    floorCtx.fillStyle = bgGrad;
    floorCtx.fillRect(0, 0, W, H);

    const rooms = activeRooms();
    rooms.forEach((room, i) => {
      floorCtx.save();
      floorCtx.translate(i * LANE_W, 0);
      drawRoomLane(room.layout, colors, light);
      floorCtx.restore();
    });

    if (rooms.length > 1) {
      floorCtx.save();
      for (let i = 0; i < rooms.length - 1; i++) {
        const seamX = (i + 1) * LANE_W;
        const beam = floorCtx.createLinearGradient(seamX - 10, 0, seamX + 10, 0);
        beam.addColorStop(0, 'rgba(255, 214, 120, 0)');
        beam.addColorStop(0.5, 'rgba(255, 214, 120, 0.5)');
        beam.addColorStop(1, 'rgba(255, 214, 120, 0)');
        floorCtx.fillStyle = beam;
        floorCtx.fillRect(seamX - 10, H * 0.12, 20, H * 0.82);

        floorCtx.beginPath();
        floorCtx.moveTo(seamX - 6, H * 0.5 - 8);
        floorCtx.lineTo(seamX + 6, H * 0.5);
        floorCtx.lineTo(seamX - 6, H * 0.5 + 8);
        floorCtx.strokeStyle = 'rgba(255, 236, 190, 0.9)';
        floorCtx.lineWidth = 2;
        floorCtx.lineJoin = 'round';
        floorCtx.stroke();
      }
      floorCtx.restore();
    }

    const vignette = floorCtx.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.42, H * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    floorCtx.fillStyle = vignette;
    floorCtx.fillRect(0, 0, W, H);
  }

  function drawRoomLane(layout, colors, light) {
    const theme = state.activeTheme;
    drawBackdrop(theme, LANE_W, BASE_H);

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
    drawWallDecor(theme, north, east, west);

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
    // Drawn before the props loop below, not after -- otherwise the bulb
    // would float on top of tall gear placed in the center-ish slots
    // instead of being hidden behind it like a real ceiling fixture.
    drawLampFixture(lampAnchor, light);

    cells.forEach(({ gx, gy }) => {
      const index = gy * ROOM.cols + gx;
      const itemId = layout[index];
      if (!itemId) return;
      const item = itemById(itemId);
      if (!item) return;
      const c = cellCenter(gx, gy);
      const catColor = CATEGORY_META[CATEGORY[itemId]].color;
      const mult = itemSynergyMultiplier(layout, index);

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

      // Soft blurred contact shadow underneath, plus the crisper
      // category-tinted pool on top -- reads as the item actually
      // sitting on the floor instead of a flat sticker.
      floorCtx.save();
      floorCtx.filter = 'blur(3px)';
      floorCtx.beginPath();
      floorCtx.ellipse(c.x, c.y + 4, ROOM.tileW * 0.30, ROOM.tileH * 0.26, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = 'rgba(0,0,0,0.4)';
      floorCtx.fill();
      floorCtx.restore();

      floorCtx.beginPath();
      floorCtx.ellipse(c.x, c.y + 3, ROOM.tileW * 0.28, ROOM.tileH * 0.24, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = hexA(catColor, 0.34);
      floorCtx.fill();

      const sprite = itemSprites[itemId];
      const drewSprite = sprite && drawItemSprite(floorCtx, c, sprite, itemId);
      const build = PROP_BUILDERS[itemId];
      if (drewSprite) {
        // real icon art, already drawn above
      } else if (build) {
        build(floorCtx, c);
      } else {
        // Every current item has a PROP_BUILDER; this is just a safety net
        // for a future item that doesn't yet, drawn as a plain block
        // rather than any placeholder glyph.
        drawIsoBox(floorCtx, c, 0, 0, 0.24, 0.24, 20, catColor, 0);
      }
    });
  }

  function pointFromEvent(e) {
    const rect = floorCanvas.getBoundingClientRect();
    // Scale into the LOGICAL 480x340 drawing space that isoPoint/ROOM use,
    // not the canvas's physical (device-pixel-ratio-scaled) buffer size.
    const scaleX = BASE_W / rect.width;
    const scaleY = BASE_H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function gridCellFromPoint(px, py) {
    const laneIndex = Math.floor(px / LANE_W);
    const localPx = px - laneIndex * LANE_W;
    const dx = localPx - ROOM.originX;
    const dy = py - ROOM.originY;
    const a = dx / (ROOM.tileW / 2);
    const b = dy / (ROOM.tileH / 2);
    const gx = Math.floor((a + b) / 2);
    const gy = Math.floor((b - a) / 2);
    if (laneIndex < 0 || laneIndex >= activeRooms().length) return null;
    if (gx < 0 || gx >= ROOM.cols || gy < 0 || gy >= ROOM.rows) return null;
    return { laneIndex, cellIndex: gy * ROOM.cols + gx };
  }

  // ---- Drag-to-pan ----
  // Click-and-drag with a mouse, or swipe with a finger, to move around a
  // theme's room chain directly -- like panning a map in Clash of Clans --
  // instead of only being able to scroll via a visible scrollbar or a
  // two-finger trackpad gesture. A single pointer both pans AND places
  // gear, so a drag is told apart from a tap by how far it moved before
  // release: past the threshold it's a pan (no placement), under it it's
  // a tap (place/remove gear, same as the old plain click).
  const DRAG_THRESHOLD = 6;
  let dragState = null;

  floorCanvas.addEventListener('pointerdown', (e) => {
    if (!stageScrollEl) return;
    dragState = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startScrollLeft: stageScrollEl.scrollLeft,
      moved: 0,
    };
    try { floorCanvas.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
    floorCanvas.style.cursor = 'grabbing';
  });

  floorCanvas.addEventListener('pointermove', (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const dx = e.clientX - dragState.startClientX;
    const dy = e.clientY - dragState.startClientY;
    dragState.moved = Math.max(dragState.moved, Math.abs(dx), Math.abs(dy));
    stageScrollEl.scrollLeft = dragState.startScrollLeft - dx;
  });

  floorCanvas.addEventListener('pointerup', (e) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const wasDrag = dragState.moved > DRAG_THRESHOLD;
    dragState = null;
    floorCanvas.style.cursor = 'grab';
    if (wasDrag) return;

    const p = pointFromEvent(e);
    const hit = gridCellFromPoint(p.x, p.y);
    if (!hit) return;
    if (hit.laneIndex !== state.activeRoomIndex) {
      state.activeRoomIndex = hit.laneIndex;
      refreshRoomTabs();
    }
    onFloorCellClick(hit.cellIndex);
  });

  floorCanvas.addEventListener('pointercancel', () => {
    dragState = null;
    floorCanvas.style.cursor = 'grab';
  });

  function onFloorCellClick(index) {
    const layout = activeRoom().layout;
    const current = layout[index];
    if (current) {
      layout[index] = null;
      renderScene();
      renderInventory();
      recomputeStats();
      refreshRoomTabs();
      save();
      return;
    }
    if (armedItemId && availableCount(armedItemId) > 0) {
      layout[index] = armedItemId;
      if (availableCount(armedItemId) <= 0) armedItemId = null;
      renderScene();
      renderInventory();
      recomputeStats();
      refreshRoomTabs();
      save();
    }
  }

  function renderInventory() {
    inventoryEl.innerHTML = '';
    const ownedItems = ITEMS.filter((item) => availableCount(item.id) > 0);
    if (ownedItems.length === 0) {
      const p = document.createElement('p');
      p.className = 'tycoon-inv-empty';
      p.textContent = THEMES.some((t) => state.themeRooms[t.id].some((r) => r.layout.some(Boolean)))
        ? 'Everything you own is already on the floor.'
        : 'Buy some gear below, then place it up here.';
      inventoryEl.appendChild(p);
      return;
    }
    ownedItems.forEach((item) => {
      const cat = CATEGORY_META[CATEGORY[item.id]];
      // A wrapping div rather than a button, since it holds two separate
      // clickable controls (arm-to-place, and sell) -- buttons can't nest.
      const chip = document.createElement('div');
      chip.className = 'tycoon-inv-item' + (armedItemId === item.id ? ' is-armed' : '');

      const armBtn = document.createElement('button');
      armBtn.type = 'button';
      armBtn.className = 'tycoon-inv-arm';
      armBtn.innerHTML = '<span class="inv-cat-dot" style="background:' + cat.color + '"></span>'
        + '<span class="inv-icon">' + iconMarkup(item.id, 15) + '</span> '
        + item.name + ' <span class="inv-count">x' + availableCount(item.id) + '</span>';
      armBtn.addEventListener('click', () => {
        armedItemId = armedItemId === item.id ? null : item.id;
        renderInventory();
      });
      chip.appendChild(armBtn);

      const sellBtn = document.createElement('button');
      sellBtn.type = 'button';
      sellBtn.className = 'tycoon-inv-sell';
      sellBtn.textContent = 'Sell +$' + formatNum(sellPrice(item));
      sellBtn.title = 'Sell one for 60% of what it cost';
      sellBtn.addEventListener('click', () => sellItem(item.id));
      chip.appendChild(sellBtn);

      inventoryEl.appendChild(chip);
    });
  }

  function refreshThemeRow() {
    themeRowEl.innerHTML = '';
    THEMES.forEach((t) => {
      const unlocked = state.lifetime >= t.unlockAt;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tycoon-theme-btn' + (state.activeTheme === t.id ? ' is-active' : '') + (unlocked ? '' : ' is-locked');
      btn.innerHTML = unlocked ? t.name : t.name + ' <span class="btn-lock-icon">' + iconMarkup('lock', 11) + '</span> $' + formatNum(t.unlockAt);
      btn.disabled = !unlocked;
      btn.addEventListener('click', () => {
        if (state.activeTheme === t.id) return;
        state.activeTheme = t.id;
        state.activeRoomIndex = Math.min(state.activeRoomIndex, activeRooms().length - 1);
        updateWorldWidth();
        renderScene();
        renderInventory();
        refreshThemeRow();
        refreshSynergyText();
        refreshRoomTabs();
        save();
      });
      themeRowEl.appendChild(btn);
    });
  }

  // ---- Room switcher: which physical room's floor you're viewing/editing,
  // within the currently selected theme's own independent room chain.
  // Gains/sec always adds up across every unlocked room in every theme,
  // whichever you're looking at -- switching rooms is just about where
  // you place gear next.
  const roomTabsEl = document.getElementById('room-tabs');
  function refreshRoomTabs() {
    if (!roomTabsEl) return;
    roomTabsEl.innerHTML = '';
    const rooms = activeRooms();
    rooms.forEach((room, i) => {
      const placed = room.layout.filter(Boolean).length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tycoon-room-tab' + (state.activeRoomIndex === i ? ' is-active' : '');
      btn.textContent = 'Room ' + (i + 1) + ' (' + placed + '/' + SLOT_COUNT + ')';
      btn.addEventListener('click', () => {
        if (state.activeRoomIndex === i) return;
        state.activeRoomIndex = i;
        renderScene();
        renderInventory();
        refreshThemeRow();
        refreshSynergyText();
        refreshRoomTabs();
        scrollToRoom(i);
        save();
      });
      roomTabsEl.appendChild(btn);
    });

    if (rooms.length < MAX_ROOMS_PER_THEME) {
      const cost = ROOM_UNLOCK_COSTS[rooms.length];
      const affordable = state.balance >= cost;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tycoon-room-tab tycoon-room-add' + (affordable ? '' : ' is-locked');
      btn.textContent = '+ Add Room — $' + formatNum(cost);
      btn.disabled = !affordable;
      btn.addEventListener('click', () => {
        if (state.balance < cost) return;
        state.balance -= cost;
        rooms.push(emptyGymRoom());
        state.activeRoomIndex = rooms.length - 1;
        updateWorldWidth();
        refreshHud();
        refreshShopUI();
        renderScene();
        renderInventory();
        refreshThemeRow();
        refreshSynergyText();
        refreshRoomTabs();
        scrollToRoom(state.activeRoomIndex);
        save();
      });
      roomTabsEl.appendChild(btn);
    }
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
    refreshRoomTabs();
    save();
  });

  // ---- Zoom buttons ----
  const zoomInBtn = document.getElementById('btn-zoom-in');
  const zoomOutBtn = document.getElementById('btn-zoom-out');
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => setZoom(zoomLevel + ZOOM_STEP));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => setZoom(zoomLevel - ZOOM_STEP));

  // ---- Init ----
  buildShop();
  refreshHud();
  refreshSynergyText();
  refreshShopUI();
  renderScene();
  renderInventory();
  refreshThemeRow();
  refreshRoomTabs();

  setInterval(() => {
    state.balance += gps / (1000 / TICK_MS);
    state.lifetime += gps / (1000 / TICK_MS);
    refreshHud();
    refreshShopUI();
    refreshThemeRow();
    refreshRoomTabs();
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
