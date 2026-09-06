(function () {
  const hudTotal = document.getElementById('hud-total');
  if (!hudTotal) return;

  const SAVE_KEY = 'gymTycoonSave';
  const COST_GROWTH = 1.15;
  const OFFLINE_CAP_SECONDS = 8 * 3600;
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

  // Grid the rooms are laid out on. Moved up here (rather than living with
  // the rest of the floor-designer/rendering code further down) because the
  // synergy math below needs it, and that math has to run before `load()`
  // computes the very first gps figure.
  //
  // The whole floor plan lives on ONE isometric lattice: every room and
  // corridor is a rectangle of tiles on it, at absolute tile coordinates.
  // (An earlier version parked each room in its own screen-space cell, which
  // meant corridors between them could never line up with the tile grid and
  // read as planks bridging a gap rather than hallways.)
  const ROOM = { tileW: 96, tileH: 48, wallH: 110 };

  // Rooms are not one bay stamped out N times: each position in a chain has
  // its own footprint, so a plan reads as an actual building. Bigger rooms
  // hold more gear, which is most of what the later ones are bought for.
  const ROOM_SHAPES = [
    { cols: 4, rows: 3 }, // 12 slots -- the starter bay
    { cols: 5, rows: 3 }, // 15 slots -- long and wide
    { cols: 4, rows: 4 }, // 16 slots -- square hall
    { cols: 5, rows: 4 }, // 20 slots -- the big floor
  ];

  // Which way the plan grows at each step. Turning instead of running in one
  // line is what folds it into the L a real floor plan makes.
  const ROOM_DIRS = ['east', 'south', 'west'];
  const CORRIDOR_LEN = 3; // tiles of hallway between two rooms
  const CORRIDOR_WIDTH = 2;

  function roomShapeFor(index) {
    return ROOM_SHAPES[index % ROOM_SHAPES.length];
  }
  function slotCountFor(index) {
    const s = roomShapeFor(index);
    return s.cols * s.rows;
  }

  // Tile rectangles for a chain of `count` rooms, each butted up against the
  // previous one with a corridor's worth of space between them and centred on
  // the shared edge.
  function roomPlacements(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const shape = roomShapeFor(i);
      if (i === 0) {
        out.push({ gx0: 0, gy0: 0, cols: shape.cols, rows: shape.rows });
        continue;
      }
      const prev = out[i - 1];
      const dir = ROOM_DIRS[(i - 1) % ROOM_DIRS.length];
      let gx0;
      let gy0;
      if (dir === 'east') {
        gx0 = prev.gx0 + prev.cols + CORRIDOR_LEN;
        gy0 = prev.gy0 + Math.round((prev.rows - shape.rows) / 2);
      } else if (dir === 'west') {
        gx0 = prev.gx0 - CORRIDOR_LEN - shape.cols;
        gy0 = prev.gy0 + Math.round((prev.rows - shape.rows) / 2);
      } else {
        gy0 = prev.gy0 + prev.rows + CORRIDOR_LEN;
        gx0 = prev.gx0 + Math.round((prev.cols - shape.cols) / 2);
      }
      out.push({ gx0, gy0, cols: shape.cols, rows: shape.rows });
    }
    return out;
  }

  // The hallway tiles joining two consecutive rooms, plus which side of which
  // room it opens through. A corridor running along +gx pierces the eastern
  // room's back-left wall; one running along +gy pierces the southern room's
  // back-right wall. The other end comes out of a room's open front, where
  // there is no wall to cut a door into.
  function corridorBetween(a, b, dir) {
    if (dir === 'east' || dir === 'west') {
      const left = dir === 'east' ? a : b;
      const right = dir === 'east' ? b : a;
      const lo = Math.max(a.gy0, b.gy0);
      const hi = Math.min(a.gy0 + a.rows, b.gy0 + b.rows);
      const gy0 = Math.round((lo + hi) / 2 - CORRIDOR_WIDTH / 2);
      return {
        gx0: left.gx0 + left.cols,
        gy0,
        cols: right.gx0 - (left.gx0 + left.cols),
        rows: CORRIDOR_WIDTH,
        doorRoom: right,
        doorWall: 'west',
      };
    }
    const top = dir === 'south' ? a : b;
    const bottom = dir === 'south' ? b : a;
    const lo = Math.max(a.gx0, b.gx0);
    const hi = Math.min(a.gx0 + a.cols, b.gx0 + b.cols);
    const gx0 = Math.round((lo + hi) / 2 - CORRIDOR_WIDTH / 2);
    return {
      gx0,
      gy0: top.gy0 + top.rows,
      cols: CORRIDOR_WIDTH,
      rows: bottom.gy0 - (top.gy0 + top.rows),
      doorRoom: bottom,
      doorWall: 'north',
    };
  }

  // Screen position of the lattice's (0,0), set by updateWorldBounds so the
  // whole plan sits inside the canvas with a margin.
  const worldOrigin = { x: 0, y: 0 };

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

  function neighborIndexes(index, shape) {
    const gx = index % shape.cols;
    const gy = Math.floor(index / shape.cols);
    const out = [];
    if (gx > 0) out.push(index - 1);
    if (gx < shape.cols - 1) out.push(index + 1);
    if (gy > 0) out.push(index - shape.cols);
    if (gy < shape.rows - 1) out.push(index + shape.cols);
    return out;
  }

  // Per-slot multiplier from adjacent gear: +12% for each neighbor of the
  // same category, +20% for each neighboring booster (trainer/gear/hq) of
  // a *different* category. Two boosters next to each other just count as
  // a same-category match.
  function itemSynergyMultiplier(layout, index, shape) {
    const itemId = layout[index];
    if (!itemId) return 1;
    const cat = CATEGORY[itemId];
    let mult = 1;
    neighborIndexes(index, shape).forEach((nIdx) => {
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
  function computeGps(layout, shape) {
    let total = 0;
    layout.forEach((itemId, index) => {
      const item = itemId && itemById(itemId);
      if (!item) return;
      total += item.gps * itemSynergyMultiplier(layout, index, shape);
    });
    return total;
  }

  // Total across every room in every theme's chain -- gear earns
  // regardless of which theme/room is currently in view. Each room is scored
  // against its own footprint, since that decides which slots are neighbours.
  function computeTotalGps(themeRooms) {
    return THEMES.reduce((sum, t) => (
      sum + (themeRooms[t.id] || []).reduce(
        (s2, room, i) => s2 + computeGps(room.layout, roomShapeFor(i)), 0)
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

  function emptyGymRoom(index) {
    return { layout: new Array(slotCountFor(index)).fill(null) };
  }

  function defaultThemeRooms() {
    const byTheme = {};
    THEMES.forEach((t) => { byTheme[t.id] = [emptyGymRoom(0)]; });
    return byTheme;
  }

  // Resizes each saved room to the footprint its position now calls for.
  // Every footprint holds at least the 12 slots rooms used to have, so a save
  // written before rooms varied in size only ever gains slots, never drops
  // gear off the end.
  function normalizedRoomChain(source) {
    const arr = Array.isArray(source) ? source : [];
    const rooms = arr.slice(0, MAX_ROOMS_PER_THEME).map((r, i) => {
      const old = Array.isArray(r && r.layout) ? r.layout : [];
      return { layout: new Array(slotCountFor(i)).fill(null).map((_, s) => old[s] || null) };
    });
    return rooms.length ? rooms : [emptyGymRoom(0)];
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
      byTheme[theme] = [{ layout: new Array(slotCountFor(0)).fill(null).map((_, i) => saved.layout[i] || null) }];
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
      toPlace.slice(0, firstLayout.length).forEach((id, i) => { firstLayout[i] = id; });
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
    const baseSum = layout.reduce((sum, id) => {
      const item = id && itemById(id);
      return sum + (item ? item.gps : 0);
    }, 0);
    const roomGps = computeGps(layout, roomShapeFor(state.activeRoomIndex));
    const bonusPct = baseSum > 0 ? Math.round((roomGps / baseSum - 1) * 100) : 0;
    synergyEl.textContent = placed + '/' + layout.length + ' slots filled -- base ' + formatNum(baseSum) + '/s'
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
          '<span class="shop-item-icon" style="color:' + cat.color + '">' + iconMarkup(item.id, 26) + '</span>' +
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

  // The plan lives on one lattice, so the canvas is however big the drawn
  // tiles turn out to be. BASE_W/BASE_H are recomputed, and worldOrigin
  // shifted, every time the plan changes -- a new room, or a theme whose
  // chain is a different length.
  let BASE_W = 480;
  let BASE_H = 380;
  const WORLD_PAD = 34;
  let placements = [];
  let corridors = [];

  function rebuildPlan() {
    const count = activeRooms().length;
    placements = roomPlacements(count);
    corridors = [];
    for (let i = 0; i < count - 1; i++) {
      const dir = ROOM_DIRS[i % ROOM_DIRS.length];
      corridors.push(corridorBetween(placements[i], placements[i + 1], dir));
    }

    let minGx = Infinity;
    let maxGx = -Infinity;
    let minGy = Infinity;
    let maxGy = -Infinity;
    placements.concat(corridors).forEach((r) => {
      minGx = Math.min(minGx, r.gx0);
      maxGx = Math.max(maxGx, r.gx0 + r.cols);
      minGy = Math.min(minGy, r.gy0);
      maxGy = Math.max(maxGy, r.gy0 + r.rows);
    });

    const halfW = ROOM.tileW / 2;
    const halfH = ROOM.tileH / 2;
    // Screen extremes of the lattice: widest points are the west and east
    // corners; the top is a wall's height above the back corner.
    const xMin = (minGx - maxGy) * halfW - WORLD_PAD;
    const xMax = (maxGx - minGy) * halfW + WORLD_PAD;
    const yMin = (minGx + minGy) * halfH - ROOM.wallH - WORLD_PAD;
    const yMax = (maxGx + maxGy) * halfH + WORLD_PAD;
    worldOrigin.x = -xMin;
    worldOrigin.y = -yMin;
    BASE_W = Math.round(xMax - xMin);
    BASE_H = Math.round(yMax - yMin);
  }

  // Pan is native container scrolling (or the click-and-drag/touch-swipe
  // handlers further down); zoom is a CSS transform on the canvas itself
  // sitting inside a wrapper sized to match (so the scrollable area's
  // dimensions stay correct at any zoom level). Click math (pointFromEvent)
  // is already ratio-based off getBoundingClientRect, which reflects both
  // scroll position and the zoom transform, so it needs no special-casing
  // for either.
  let zoomLevel = 1;
  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 1.6;
  const ZOOM_STEP = 0.2;
  const zoomWrapEl = document.getElementById('room-zoom-wrap');
  const stageScrollEl = document.getElementById('room-stage-scroll');

  // On a phone the stage window is only ~330px wide, so a 1x view of a
  // 960px-wide floor plan drops you onto one anonymous corner of one room.
  // Until the player works the zoom buttons themselves, keep the whole plan
  // framed to fit the window -- which also re-frames itself as rooms are
  // added or a theme with a different plan comes into view.
  let userSetZoom = false;

  function fitZoomToStage() {
    if (!stageScrollEl || userSetZoom) return;
    const availW = stageScrollEl.clientWidth;
    const availH = stageScrollEl.clientHeight;
    if (!availW || !availH) return;
    const fit = Math.min(availW / BASE_W, availH / BASE_H, 1);
    zoomLevel = Math.max(ZOOM_MIN, Math.round(fit * 100) / 100);
  }

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
    userSetZoom = true;
    zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(next * 100) / 100));
    applyStageSizing();
  }

  function scrollToRoom(index) {
    if (!stageScrollEl) return;
    const place = placements[index];
    if (!place) return;
    const mid = cellCenter(place.gx0 + place.cols / 2 - 0.5, place.gy0 + place.rows / 2 - 0.5);
    const centerX = mid.x * zoomLevel;
    const centerY = mid.y * zoomLevel;
    stageScrollEl.scrollTo({
      left: Math.max(0, centerX - stageScrollEl.clientWidth / 2),
      top: Math.max(0, centerY - stageScrollEl.clientHeight / 2),
      behavior: 'smooth',
    });
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

  // Tile coordinates are absolute across the whole plan, so one origin serves
  // every room.
  function isoPoint(gx, gy) {
    return {
      x: worldOrigin.x + (gx - gy) * (ROOM.tileW / 2),
      y: worldOrigin.y + (gx + gy) * (ROOM.tileH / 2),
    };
  }
  function cellCenter(gx, gy) {
    return isoPoint(gx + 0.5, gy + 0.5);
  }
  // A room's tiles, furthest-back first, so nearer gear paints over what is
  // behind it.
  function cellsBackToFront(place) {
    const cells = [];
    for (let ry = 0; ry < place.rows; ry++) {
      for (let rx = 0; rx < place.cols; rx++) {
        cells.push({ rx, ry, gx: place.gx0 + rx, gy: place.gy0 + ry });
      }
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
    // The scenery below was composed against a single 480x340 room. The
    // canvas is now as big as the whole floor plan, so vertical positions
    // scale with it -- otherwise the props bunch up along the top edge and
    // float in dead space away from any room.
    const sy = H / 340;
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
      [[46, 38 * sy, 22], [118, 64 * sy, 15], [W - 140, 88 * sy, 17]].forEach(([cx, cy, r]) => {
        floorCtx.beginPath();
        floorCtx.ellipse(cx, cy, r * 1.6, r * 0.65, 0, 0, Math.PI * 2);
        floorCtx.fill();
      });

      const skylineY = 300 * sy;
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
      [[0, 26 * sy], [0, 88 * sy], [W, 26 * sy], [W, 88 * sy]].forEach(([x, y]) => {
        floorCtx.beginPath();
        floorCtx.moveTo(x, y);
        floorCtx.lineTo(W / 2, -8);
        floorCtx.stroke();
      });

      [[32, 256 * sy, 24], [32, 212 * sy, 20]].forEach(([x, y, r]) => {
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

      [150 * sy, 190 * sy, 230 * sy].forEach((y) => {
        floorCtx.fillStyle = 'rgba(0,0,0,0.4)';
        floorCtx.fillRect(W - 48, y, 32, 6);
        floorCtx.fillStyle = 'rgba(255,255,255,0.08)';
        floorCtx.fillRect(W - 48, y, 32, 1.5);
      });
      floorCtx.fillStyle = '#c0483a';
      floorCtx.fillRect(W - 40, 160 * sy, 10, 24);
      floorCtx.fillStyle = '#3fa8a0';
      floorCtx.fillRect(W - 26, 200 * sy, 8, 26);
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
        floorCtx.lineTo(x, 262 * sy);
        floorCtx.stroke();
      });
      floorCtx.fillStyle = 'rgba(180,210,230,0.14)';
      floorCtx.beginPath();
      floorCtx.moveTo(30, 100 * sy);
      floorCtx.lineTo(90, 260 * sy);
      floorCtx.lineTo(30, 260 * sy);
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

  // A flat panel lying on a wall plane, corners given as fractions along the
  // wall (t) and up it (h) -- so it skews with the wall instead of sitting on
  // it as an unconvincing screen-aligned rectangle.
  function wallQuad(from, to, t0, t1, h0, h1) {
    return [
      wallPoint(from, to, t0, h0),
      wallPoint(from, to, t1, h0),
      wallPoint(from, to, t1, h1),
      wallPoint(from, to, t0, h1),
    ];
  }

  function paintQuad(pts, fill, stroke, lineWidth) {
    floorCtx.beginPath();
    floorCtx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) floorCtx.lineTo(pts[i].x, pts[i].y);
    floorCtx.closePath();
    if (fill) {
      floorCtx.fillStyle = fill;
      floorCtx.fill();
    }
    if (stroke) {
      floorCtx.strokeStyle = stroke;
      floorCtx.lineWidth = lineWidth || 1.2;
      floorCtx.stroke();
    }
  }

  // ---- Per-room fit-out ----
  // Two rooms of the same theme would otherwise be the same box twice over.
  // Each position in a chain gets its own lighting rig and its own set of
  // wall fittings on top of whatever the theme itself puts up.
  const ROOM_FITS = [
    { lighting: 'bulb', decor: [] },
    { lighting: 'strip', decor: ['shelf', 'vent'] },
    { lighting: 'strip', decor: ['clock'] },
    { lighting: 'bulb', decor: ['shelf', 'clock', 'vent'] },
  ];
  function roomFitFor(index) {
    return ROOM_FITS[index % ROOM_FITS.length];
  }

  // A lit rail running the length of both walls, downlights washing the wall
  // beneath each lamp -- the alternative to the single hanging bulb.
  function drawCeilingStrip(north, east, west, light) {
    const bulbColor = light.bulb || '#eaf7ff';
    [[north, east], [north, west]].forEach(([from, to]) => {
      const railA = wallPoint(from, to, 0.05, 0.92);
      const railB = wallPoint(from, to, 0.95, 0.92);
      floorCtx.beginPath();
      floorCtx.moveTo(railA.x, railA.y);
      floorCtx.lineTo(railB.x, railB.y);
      floorCtx.strokeStyle = 'rgba(198, 214, 228, 0.28)';
      floorCtx.lineWidth = 2.5;
      floorCtx.stroke();

      const lamps = 3;
      for (let i = 0; i < lamps; i++) {
        const t = 0.2 + (i * 0.6) / (lamps - 1);
        const lamp = wallPoint(from, to, t, 0.9);

        // Wash of light down the wall below the lamp.
        const spread = 0.11;
        const cone = wallQuad(from, to, t - spread * 0.45, t + spread * 0.45, 0.9, 0.08);
        const wide = [
          cone[0],
          cone[1],
          wallPoint(from, to, t + spread, 0.08),
          wallPoint(from, to, t - spread, 0.08),
        ];
        const grad = floorCtx.createLinearGradient(lamp.x, lamp.y, lamp.x, wide[2].y);
        grad.addColorStop(0, hexA(bulbColor, 0.28));
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        floorCtx.save();
        floorCtx.globalCompositeOperation = 'lighter';
        paintQuad(wide, grad, null);
        floorCtx.restore();

        floorCtx.beginPath();
        floorCtx.ellipse(lamp.x, lamp.y, 5, 3.4, 0, 0, Math.PI * 2);
        floorCtx.fillStyle = bulbColor;
        floorCtx.shadowColor = bulbColor;
        floorCtx.shadowBlur = 9;
        floorCtx.fill();
        floorCtx.shadowBlur = 0;
      }
    });
  }

  // Wall fittings placed by roomFitFor. Each takes a wall (as its two floor
  // corners) so it can be hung on whichever side has room for it.
  const WALL_FITTINGS = {
    // Bracketed shelving with a few boxes on it, like a stockroom rack.
    shelf(from, to, t) {
      const w = 0.13;
      [0.62, 0.42].forEach((h) => {
        paintQuad(wallQuad(from, to, t - w, t + w, h, h - 0.045), '#4a4f5c', 'rgba(0,0,0,0.5)');
        paintQuad(wallQuad(from, to, t - w, t + w, h - 0.045, h - 0.06), '#31353f', null);
      });
      // Uprights.
      [t - w, t + w].forEach((tt) => {
        paintQuad(wallQuad(from, to, tt - 0.012, tt + 0.012, 0.64, 0.36), '#3c414c', 'rgba(0,0,0,0.45)');
      });
      // Boxes sitting on the top shelf.
      paintQuad(wallQuad(from, to, t - 0.09, t - 0.02, 0.72, 0.62), '#7d6a4f', 'rgba(0,0,0,0.5)');
      paintQuad(wallQuad(from, to, t + 0.01, t + 0.08, 0.69, 0.62), '#6d5b45', 'rgba(0,0,0,0.5)');
    },
    // Extractor grille.
    vent(from, to, t) {
      const w = 0.07;
      paintQuad(wallQuad(from, to, t - w, t + w, 0.78, 0.62), '#2b2f36', 'rgba(0,0,0,0.55)');
      for (let i = 0; i < 4; i++) {
        const h = 0.755 - i * 0.038;
        paintQuad(wallQuad(from, to, t - w * 0.8, t + w * 0.8, h, h - 0.016), 'rgba(255,255,255,0.10)', null);
      }
    },
    // Gym clock -- squashed along the wall so it reads as flat against it.
    clock(from, to, t) {
      const c = wallPoint(from, to, t, 0.66);
      const edge = wallPoint(from, to, t + 0.05, 0.66);
      const rx = Math.max(7, Math.abs(edge.x - c.x));
      floorCtx.beginPath();
      floorCtx.ellipse(c.x, c.y, rx, 11, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = '#e8e4d8';
      floorCtx.fill();
      floorCtx.strokeStyle = '#1b1a17';
      floorCtx.lineWidth = 1.6;
      floorCtx.stroke();
      floorCtx.beginPath();
      floorCtx.moveTo(c.x, c.y);
      floorCtx.lineTo(c.x + rx * 0.1, c.y - 6);
      floorCtx.moveTo(c.x, c.y);
      floorCtx.lineTo(c.x + rx * 0.55, c.y + 2);
      floorCtx.strokeStyle = '#1b1a17';
      floorCtx.lineWidth = 1.4;
      floorCtx.stroke();
    },
  };

  function drawRoomFittings(fit, north, east, west) {
    // Spread the pieces across both walls so nothing stacks on the theme's
    // own decor, which always sits mid-wall.
    const slots = [
      { wall: [north, east], t: 0.24 },
      { wall: [north, west], t: 0.76 },
      { wall: [north, east], t: 0.84 },
    ];
    fit.decor.forEach((name, i) => {
      const draw = WALL_FITTINGS[name];
      const slot = slots[i % slots.length];
      if (draw) draw(slot.wall[0], slot.wall[1], slot.t);
    });
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

  // ---- Corridors between rooms ----
  // Rooms are joined by an actual short corridor with a lit doorframe at
  // each end, rather than a glowing marker floated over the seam -- that
  // join is what makes a plan read as one building instead of rooms parked
  // next to each other.

  // ---- Corridors ----
  // A hallway is built the same way a room is: real tiles on the shared
  // lattice, a wall with visible thickness down its back edge, and a pale
  // door casing standing at each end where it meets a room.

  function lerpPt(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  function liftPt(p, h) {
    return { x: p.x, y: p.y - h };
  }

  function tileIsFloor(gx, gy) {
    const inside = (r) => gx >= r.gx0 && gx < r.gx0 + r.cols && gy >= r.gy0 && gy < r.gy0 + r.rows;
    return placements.some(inside) || corridors.some(inside);
  }

  // The lip under a floor plate's two front edges. Without it every space
  // runs into the next as one flat sheet; with it each room and hallway
  // reads as a slab of its own, which is most of what separates them.
  // Edges that a hallway continues through are skipped, so the floor stays
  // unbroken where you can actually walk between two spaces.
  function drawSlabEdges(rect, colors) {
    const h = 15;
    const right = shade(colors.floorB, -40);
    const left = shade(colors.floorB, -26);
    const outline = 'rgba(0,0,0,0.55)';
    const drop = (a, b, fill) => paintQuad(
      [a, b, { x: b.x, y: b.y + h }, { x: a.x, y: a.y + h }], fill, outline, 1,
    );

    const gxEdge = rect.gx0 + rect.cols;
    for (let gy = rect.gy0; gy < rect.gy0 + rect.rows; gy++) {
      if (tileIsFloor(gxEdge, gy)) continue;
      drop(isoPoint(gxEdge, gy), isoPoint(gxEdge, gy + 1), right);
    }

    const gyEdge = rect.gy0 + rect.rows;
    for (let gx = rect.gx0; gx < rect.gx0 + rect.cols; gx++) {
      if (tileIsFloor(gx, gyEdge)) continue;
      drop(isoPoint(gx, gyEdge), isoPoint(gx + 1, gyEdge), left);
    }
  }

  // Wall running from floor point a to floor point b, `h` tall, with its top
  // face drawn as a slab `depth` deep -- that top face is what reads as
  // thickness rather than a paper-thin plane.
  function drawThickWall(a, b, h, depth, colors) {
    const face = [a, b, liftPt(b, h), liftPt(a, h)];
    const grad = floorCtx.createLinearGradient(0, a.y - h, 0, a.y);
    grad.addColorStop(0, shade(colors.wallL, 16));
    grad.addColorStop(1, shade(colors.wallL, -12));
    paintQuad(face, grad, 'rgba(0,0,0,0.45)', 1);

    const top = [
      liftPt(a, h),
      liftPt(b, h),
      { x: b.x + depth.x, y: b.y + depth.y - h },
      { x: a.x + depth.x, y: a.y + depth.y - h },
    ];
    paintQuad(top, shade(colors.wallL, 62), 'rgba(0,0,0,0.4)', 1);
  }

  // The two floor corners spanning a corridor's end, in the order that keeps
  // the frame facing the viewer.
  function corridorEnd(c, far) {
    const along = c.cols > c.rows;
    if (along) {
      const gx = far ? c.gx0 + c.cols : c.gx0;
      return [isoPoint(gx, c.gy0), isoPoint(gx, c.gy0 + c.rows)];
    }
    const gy = far ? c.gy0 + c.rows : c.gy0;
    return [isoPoint(c.gx0, gy), isoPoint(c.gx0 + c.cols, gy)];
  }

  function drawCorridorShell(c, colors) {
    for (let ry = 0; ry < c.rows; ry++) {
      for (let rx = 0; rx < c.cols; rx++) {
        const gx = c.gx0 + rx;
        const gy = c.gy0 + ry;
        const tile = (gx + gy) % 2 === 0 ? colors.floorA : colors.floorB;
        paintQuad([
          isoPoint(gx, gy), isoPoint(gx + 1, gy),
          isoPoint(gx + 1, gy + 1), isoPoint(gx, gy + 1),
        ], shade(tile, -8), 'rgba(0,0,0,0.28)', 1);
      }
    }

    drawSlabEdges(c, colors);

    const along = c.cols > c.rows;
    const h = ROOM.wallH * 0.82;
    if (along) {
      // Running east: the back edge is the gy0 side; thickness pushes away
      // from the viewer, up and to the right.
      drawThickWall(
        isoPoint(c.gx0, c.gy0), isoPoint(c.gx0 + c.cols, c.gy0),
        h, { x: ROOM.tileW * 0.16, y: -ROOM.tileH * 0.16 }, colors,
      );
    } else {
      // Running south: the back edge is the gx0 side, thickness up-left.
      drawThickWall(
        isoPoint(c.gx0, c.gy0), isoPoint(c.gx0, c.gy0 + c.rows),
        h, { x: -ROOM.tileW * 0.16, y: -ROOM.tileH * 0.16 }, colors,
      );
    }
  }

  // A pale casing standing across the corridor mouth: two jambs and a lintel
  // around an unlit opening. Drawn as a frame rather than a filled slab so
  // the doorway reads as something you look through, not a black panel.
  function drawCorridorDoor(p0, p1, colors) {
    const h = ROOM.wallH * 0.56;
    // Narrow it to the middle of the hallway -- a door, not the whole end
    // wall gone missing.
    const a = lerpPt(p0, p1, 0.18);
    const b = lerpPt(p0, p1, 0.82);
    const casing = shade(colors.wallL, 112);
    const edge = 'rgba(0,0,0,0.5)';
    const jamb = 0.12;
    const lintel = 10;

    // Dim depth behind the opening -- shadowed, not a void.
    const depth = floorCtx.createLinearGradient(0, a.y - h, 0, a.y);
    depth.addColorStop(0, shade(colors.wallR, -14));
    depth.addColorStop(1, shade(colors.floorB, -24));
    paintQuad([a, b, liftPt(b, h), liftPt(a, h)], depth, null);

    const aj = lerpPt(a, b, jamb);
    const bj = lerpPt(a, b, 1 - jamb);
    paintQuad([a, aj, liftPt(aj, h), liftPt(a, h)], casing, edge, 1.2);
    paintQuad([bj, b, liftPt(b, h), liftPt(bj, h)], casing, edge, 1.2);
    paintQuad(
      [liftPt(a, h - lintel), liftPt(b, h - lintel), liftPt(b, h), liftPt(a, h)],
      casing, edge, 1.2,
    );
  }

  // Only one end of a hallway meets a wall. Rooms are open at the front and
  // walled at the back, so a corridor running away from a room leaves through
  // its open side (nothing to frame) and arrives through the far room's back
  // wall (which is where the casing belongs). A frame at the open end would
  // be a door standing in mid-air.
  function drawCorridorDoors(c, colors) {
    const near = corridorEnd(c, false);
    const far = corridorEnd(c, true);
    drawCorridorDoor(near[0], near[1], colors);
    drawCorridorDoor(far[0], far[1], colors);
  }

  function renderScene() {
    rebuildPlan();
    fitZoomToStage();
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
    drawBackdrop(state.activeTheme, W, H);

    // Hallways go down first: a room drawn after will correctly cover the end
    // that runs behind its wall, leaving only the doorway showing.
    corridors.forEach((c) => drawCorridorShell(c, colors));

    // Rooms back-to-front, so a nearer room's walls overlap what is behind it
    // rather than the draw order fighting the projection.
    const rooms = activeRooms();
    rooms
      .map((room, i) => ({ room, i }))
      .sort((a, b) => (placements[a.i].gx0 + placements[a.i].gy0) - (placements[b.i].gx0 + placements[b.i].gy0))
      .forEach(({ room, i }) => drawRoom(room.layout, colors, light, i));

    // Door casings go on last so they read as standing in the wall the room
    // just painted over the hallway's end, rather than behind it.
    corridors.forEach((c) => drawCorridorDoors(c, colors));

    const vignette = floorCtx.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.42, H * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    floorCtx.fillStyle = vignette;
    floorCtx.fillRect(0, 0, W, H);
  }

  function drawRoom(layout, colors, light, roomIndex) {
    const theme = state.activeTheme;
    const place = placements[roomIndex];
    const shape = { cols: place.cols, rows: place.rows };

    const north = isoPoint(place.gx0, place.gy0);
    const east = isoPoint(place.gx0 + place.cols, place.gy0);
    const west = isoPoint(place.gx0, place.gy0 + place.rows);

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
    drawRoomFittings(roomFitFor(roomIndex), north, east, west);

    const cells = cellsBackToFront(place);

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

    drawSlabEdges(place, colors);

    const roomCenterFloor = isoPoint(place.gx0 + shape.cols / 2, place.gy0 + shape.rows / 2);
    drawLightPool(roomCenterFloor, light.glow);
    // Drawn before the props loop below, not after -- otherwise a fixture
    // would float on top of tall gear placed in the center-ish slots
    // instead of being hidden behind it like real ceiling hardware.
    if (roomFitFor(roomIndex).lighting === 'strip') {
      drawCeilingStrip(north, east, west, light);
    } else {
      drawLampFixture({ x: roomCenterFloor.x, y: roomCenterFloor.y - ROOM.wallH + 6 }, light);
    }

    cells.forEach(({ gx, gy, rx, ry }) => {
      const index = ry * shape.cols + rx;
      const itemId = layout[index];
      if (!itemId) return;
      const item = itemById(itemId);
      if (!item) return;
      const c = cellCenter(gx, gy);
      const catColor = CATEGORY_META[CATEGORY[itemId]].color;
      const mult = itemSynergyMultiplier(layout, index, shape);

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

  // Every room is on the one lattice, so a click resolves to a single tile
  // and then to whichever room's rectangle contains it -- no per-room origin
  // to unwind first.
  function gridCellFromPoint(px, py) {
    const dx = px - worldOrigin.x;
    const dy = py - worldOrigin.y;
    const a = dx / (ROOM.tileW / 2);
    const b = dy / (ROOM.tileH / 2);
    const gx = Math.floor((a + b) / 2);
    const gy = Math.floor((b - a) / 2);

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      if (gx >= p.gx0 && gx < p.gx0 + p.cols && gy >= p.gy0 && gy < p.gy0 + p.rows) {
        return { laneIndex: i, cellIndex: (gy - p.gy0) * p.cols + (gx - p.gx0) };
      }
    }
    return null;
  }

  // ---- Pan and pinch ----
  // One pointer drags the plan around; two fingers pinch to zoom. The canvas
  // takes the whole touch gesture (touch-action: none) so a pinch can't be
  // half-swallowed by the browser's own scrolling -- which in turn means
  // vertical drags have to hand what they cannot use back to the page
  // themselves, or a finger starting on the canvas would trap the reader on
  // a 340px-tall element with the shop below it out of reach.
  // Listen on the stage window rather than the canvas: zoomed out the plan
  // is smaller than the window, and a pinch that happens to start on the
  // background beside it should still work.
  const gestureEl = stageScrollEl || floorCanvas;
  const DRAG_THRESHOLD = 6;
  const pointers = new Map();
  let dragState = null;
  let pinchState = null;

  function pointerMid() {
    const pts = Array.from(pointers.values());
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
    };
  }

  // Zoom about a fixed point on screen: work out which world coordinate sits
  // under it, apply the new zoom, then re-scroll so that same coordinate is
  // still under it. Without this the plan lurches away from your fingers.
  function zoomAround(nextZoom, clientX, clientY) {
    if (!stageScrollEl) return;
    const rect = floorCanvas.getBoundingClientRect();
    const clamp = (v, hi) => Math.max(0, Math.min(hi, v));
    // Clamp to the plan: pinching about a point off in the background would
    // otherwise anchor to a coordinate outside it and fling the view away.
    const worldX = clamp(rect.width ? (clientX - rect.left) * (BASE_W / rect.width) : 0, BASE_W);
    const worldY = clamp(rect.height ? (clientY - rect.top) * (BASE_H / rect.height) : 0, BASE_H);
    const stageRect = stageScrollEl.getBoundingClientRect();

    setZoom(nextZoom);

    stageScrollEl.scrollLeft = stageRect.left + worldX * zoomLevel - clientX;
    stageScrollEl.scrollTop = stageRect.top + worldY * zoomLevel - clientY;
  }

  // Pan the stage, and pass whatever scroll it cannot absorb on to the page,
  // the way a nested scroller normally chains.
  function panBy(dx, dy) {
    stageScrollEl.scrollLeft = dragState.startScrollLeft - dx;

    const wantTop = dragState.startScrollTop - dy;
    const maxTop = Math.max(0, stageScrollEl.scrollHeight - stageScrollEl.clientHeight);
    const clamped = Math.max(0, Math.min(maxTop, wantTop));
    stageScrollEl.scrollTop = clamped;
    const leftover = wantTop - clamped;
    if (leftover !== 0) {
      const applied = dragState.pageScrolled || 0;
      window.scrollBy(0, leftover - applied);
      dragState.pageScrolled = leftover;
    }
  }

  gestureEl.addEventListener('pointerdown', (e) => {
    if (!stageScrollEl) return;
    // The primary pointer is the first one down of a gesture, so this is
    // where a new gesture begins -- clear anything the last one left behind.
    // A pointerup can go missing (capture lost, the browser cancelling a
    // touch), and a stale entry would otherwise make the next pinch measure
    // its span against a finger that is no longer on the glass.
    if (e.isPrimary) {
      pointers.clear();
      pinchState = null;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { gestureEl.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }

    if (pointers.size === 2) {
      // Second finger down: stop panning, start pinching.
      dragState = null;
      const mid = pointerMid();
      pinchState = { startDist: mid.dist || 1, startZoom: zoomLevel };
      return;
    }
    if (pointers.size > 2) return;

    dragState = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startScrollLeft: stageScrollEl.scrollLeft,
      startScrollTop: stageScrollEl.scrollTop,
      pageScrolled: 0,
      moved: 0,
    };
    gestureEl.style.cursor = 'grabbing';
  });

  gestureEl.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchState && pointers.size >= 2) {
      const mid = pointerMid();
      if (!mid.dist) return;
      zoomAround(pinchState.startZoom * (mid.dist / pinchState.startDist), mid.x, mid.y);
      return;
    }

    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const dx = e.clientX - dragState.startClientX;
    const dy = e.clientY - dragState.startClientY;
    dragState.moved = Math.max(dragState.moved, Math.abs(dx), Math.abs(dy));
    panBy(dx, dy);
  });

  gestureEl.addEventListener('pointerup', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchState = null;

    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const wasDrag = dragState.moved > DRAG_THRESHOLD;
    dragState = null;
    gestureEl.style.cursor = 'grab';
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

  // A trackpad pinch arrives as a wheel event with ctrlKey set; a plain wheel
  // is left alone so the page still scrolls normally over the canvas.
  gestureEl.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomAround(zoomLevel * (1 - e.deltaY * 0.01), e.clientX, e.clientY);
  }, { passive: false });

  gestureEl.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchState = null;
    dragState = null;
    gestureEl.style.cursor = 'grab';
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
        rebuildPlan();
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
      btn.textContent = 'Room ' + (i + 1) + ' (' + placed + '/' + room.layout.length + ')';
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
      btn.textContent = '+ Add Room (' + slotCountFor(rooms.length) + ' slots) — $' + formatNum(cost);
      btn.disabled = !affordable;
      btn.addEventListener('click', () => {
        if (state.balance < cost) return;
        state.balance -= cost;
        rooms.push(emptyGymRoom(rooms.length));
        state.activeRoomIndex = rooms.length - 1;
        rebuildPlan();
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
