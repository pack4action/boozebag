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
      // Run the hallway flush with the back of the rooms rather than centred
      // between them. Centred, its back wall sat a tile in front of theirs and
      // needed an odd stub of wall to reach back -- flush, the hallway wall
      // simply continues the room wall in one straight line.
      const lo = Math.max(a.gy0, b.gy0);
      const hi = Math.min(a.gy0 + a.rows, b.gy0 + b.rows);
      const gy0 = Math.min(lo, hi - CORRIDOR_WIDTH);
      return {
        gx0: left.gx0 + left.cols,
        gy0,
        cols: right.gx0 - (left.gx0 + left.cols),
        rows: CORRIDOR_WIDTH,
        doorRoom: right,
        doorWall: 'west',
        nearRoom: left,
      };
    }
    const top = dir === 'south' ? a : b;
    const bottom = dir === 'south' ? b : a;
    const lo = Math.max(a.gx0, b.gx0);
    const hi = Math.min(a.gx0 + a.cols, b.gx0 + b.cols);
    const gx0 = Math.min(lo, hi - CORRIDOR_WIDTH);
    return {
      gx0,
      gy0: top.gy0 + top.rows,
      cols: CORRIDOR_WIDTH,
      rows: bottom.gy0 - (top.gy0 + top.rows),
      doorRoom: bottom,
      doorWall: 'north',
      nearRoom: top,
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
  // How tightly the canvas frames the plan, and how much room is left around
  // it for the place the plan stands in. Asymmetric because the surroundings
  // are: the site's own back walls rise above the plan, so the top needs the
  // most, while the floor only has to run far enough off the other three
  // edges to be cut off rather than to end. None of it counts towards the
  // auto-fit zoom (see PLAN_W/PLAN_H), or adding background would shrink the
  // rooms.
  const WORLD_PAD = 34;
  const BLEED_TOP = 250;
  const BLEED_SIDE = 150;
  const BLEED_BOTTOM = 120;
  let PLAN_W = 480;
  let PLAN_H = 380;
  // The plan's extent in tiles, which is what the site is built around.
  const planBounds = { gx0: 0, gy0: 0, gx1: 4, gy1: 3 };
  let placements = [];
  let corridors = [];
  let preview = null;
  let previewCorridor = null;

  function rebuildPlan() {
    const count = activeRooms().length;
    placements = roomPlacements(count);
    corridors = [];
    for (let i = 0; i < count - 1; i++) {
      const dir = ROOM_DIRS[i % ROOM_DIRS.length];
      corridors.push(corridorBetween(placements[i], placements[i + 1], dir));
    }

    // The plot the next room will stand on, worked out one room ahead. It is
    // drawn as a staked-out site rather than left as empty black, so there is
    // something to save towards -- and because it is measured now, buying the
    // room drops the building straight onto it without the plan reflowing.
    preview = null;
    previewCorridor = null;
    if (count < MAX_ROOMS_PER_THEME) {
      const withNext = roomPlacements(count + 1);
      preview = withNext[count];
      previewCorridor = corridorBetween(
        placements[count - 1], preview, ROOM_DIRS[(count - 1) % ROOM_DIRS.length],
      );
    }

    let minGx = Infinity;
    let maxGx = -Infinity;
    let minGy = Infinity;
    let maxGy = -Infinity;
    placements.concat(corridors, preview ? [preview, previewCorridor] : []).forEach((r) => {
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
    PLAN_W = Math.round(xMax - xMin);
    PLAN_H = Math.round(yMax - yMin);
    planBounds.gx0 = minGx;
    planBounds.gy0 = minGy;
    planBounds.gx1 = maxGx;
    planBounds.gy1 = maxGy;
    worldOrigin.x = -xMin + BLEED_SIDE;
    worldOrigin.y = -yMin + BLEED_TOP;
    BASE_W = PLAN_W + BLEED_SIDE * 2;
    BASE_H = PLAN_H + BLEED_TOP + BLEED_BOTTOM;
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

  // A desktop stage window can be bigger than a one-room plan, so the fit is
  // allowed past 1x rather than leaving the room marooned in the middle of a
  // large empty frame -- fitCanvasResolution() below redraws the backing
  // store at the zoomed size, so filling the window costs no sharpness.
  const FIT_MAX = 1.4;

  function fitZoomToStage() {
    if (!stageScrollEl || userSetZoom) return;
    const availW = stageScrollEl.clientWidth;
    const availH = stageScrollEl.clientHeight;
    if (!availW || !availH) return;
    const fit = Math.min(availW / PLAN_W, availH / PLAN_H, FIT_MAX);
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

  // Re-rendering on every frame of a pinch would mean redrawing a canvas
  // that is getting bigger as the gesture goes, so the gesture itself rides
  // on the cheap CSS transform and the sharper redraw lands once it settles.
  let resRepaintTimer = null;
  function queueResolutionRepaint() {
    clearTimeout(resRepaintTimer);
    resRepaintTimer = setTimeout(renderScene, 110);
  }

  function setZoom(next) {
    userSetZoom = true;
    zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(next * 100) / 100));
    applyStageSizing();
    queueResolutionRepaint();
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

  // Zoom is a CSS transform on the canvas, so a fixed bitmap would be blown
  // up when you zoom in and thrown away when you zoom out. Sizing the
  // backing store to what the plan actually occupies on screen -- its
  // logical size, times the zoom, times the device's pixels per CSS pixel
  // -- is one texel per screen pixel at every zoom level. The bounds stop a
  // big plan on a retina screen asking for an absurd texture, and stop a
  // zoomed-out one asking for a mushy little thumbnail.
  const MAX_BACKING_SCALE = 2.2;
  const MIN_BACKING_SCALE = 0.5;

  function fitCanvasResolution() {
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(MIN_BACKING_SCALE,
      Math.min(MAX_BACKING_SCALE, dpr * zoomLevel));
    const targetW = Math.round(BASE_W * scale);
    const targetH = Math.round(BASE_H * scale);
    if (floorCanvas.width !== targetW || floorCanvas.height !== targetH) {
      floorCanvas.width = targetW;
      floorCanvas.height = targetH;
    }
    floorCtx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  const THEME_COLORS = {
    garage: { floorA: '#5c4530', floorB: '#4a3624', wallL: '#3a2c1c', wallR: '#2e2116', bgTop: '#241a10', bg: '#171310' },
    basement: { floorA: '#33404a', floorB: '#28333c', wallL: '#1c242c', wallR: '#161b21', bgTop: '#171b1f', bg: '#0e1114' },
    rooftop: { floorA: '#5a89ad', floorB: '#4a7594', wallL: '#3f6f94', wallR: '#2f5673', bgTop: '#3f6f94', bg: '#1c3348' },
  };
  // The colour the ground around the plan is washed with -- the theme's own
  // light spilling out past the rooms.
  const AMBIENT_WASH = {
    garage: 'rgba(120, 82, 40, 0.5)',
    basement: 'rgba(58, 82, 104, 0.5)',
    rooftop: 'rgba(96, 148, 190, 0.55)',
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

  // Accepts "#rgb", "#rrggbb" or the "rgb(r,g,b)" that shade() itself
  // returns. That last case is the one that matters: shade() feeds its own
  // output back in whenever a colour is derived twice (a prop tinted off a
  // palette entry, then shaded again for one of its faces), and parsing
  // "rgb(...)" as hex yields NaN, which lands on black.
  function toRgb(color) {
    const m = /^rgba?\(([^)]+)\)/.exec(color);
    if (m) {
      const parts = m[1].split(',').map((v) => parseFloat(v));
      return { r: parts[0] | 0, g: parts[1] | 0, b: parts[2] | 0 };
    }
    const c = color.replace('#', '');
    const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
    return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
  }

  function shade(color, amt) {
    const { r, g, b } = toRgb(color);
    const clamp = (v) => Math.max(0, Math.min(255, v + amt));
    return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
  }

  function hexA(color, alpha) {
    const { r, g, b } = toRgb(color);
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
  // ---- The site ----
  // What the plan stands in. Not a backdrop pinned to the canvas: an actual
  // space built on the same isometric lattice as the rooms, with a floor
  // running off three edges and its own back walls rising above -- a unit,
  // a boiler room, a roof. The plan is a building inside it.
  // The site has its own palette. Deriving it from the room colours produced
  // a black hole to stand the plan in: those values are a room's shadowed
  // inside, not a poured floor with lights on it.
  const SITE_COLORS = {
    garage: { floor: '#3b332a', wall: '#2b241d', trim: '#4b4136' },
    basement: { floor: '#37424a', wall: '#28313a', trim: '#46525c' },
    rooftop: { floor: '#333f4c', wall: '#2b3644', trim: '#44515f' },
  };

  const SITE_MARGIN = 3;        // tiles of floor beyond the plan, on the back sides
  const SITE_FRONT_MARGIN = 5;  // and on the near sides, where it runs off screen
  const SITE_WALL_H = 250;
  const SITE_WALL_THICK = 0.5;  // tiles

  function siteRect() {
    return {
      gx0: planBounds.gx0 - SITE_MARGIN,
      gy0: planBounds.gy0 - SITE_MARGIN,
      gx1: planBounds.gx1 + SITE_FRONT_MARGIN,
      gy1: planBounds.gy1 + SITE_FRONT_MARGIN,
    };
  }

  function siteCorners() {
    const r = siteRect();
    return {
      north: isoPoint(r.gx0, r.gy0),
      east: isoPoint(r.gx1, r.gy0),
      west: isoPoint(r.gx0, r.gy1),
      south: isoPoint(r.gx1, r.gy1),
      rect: r,
    };
  }

  // Same idea as wallPoint, against the site's taller walls.
  function sitePoint(from, to, t, hFrac) {
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t - hFrac * SITE_WALL_H,
    };
  }
  function siteQuad(from, to, t0, t1, h0, h1) {
    return [
      sitePoint(from, to, t0, h0), sitePoint(from, to, t1, h0),
      sitePoint(from, to, t1, h1), sitePoint(from, to, t0, h1),
    ];
  }

  // ---- Floor ----
  // Big poured slabs, four lattice tiles to a bay, so the ground under the
  // plan reads as a different, rougher surface than the rooms' own tiling.
  function drawSiteFloor(site) {
    const r = siteRect();
    const base = site.floor;
    const seam = 'rgba(0,0,0,0.4)';
    for (let gy = r.gy0; gy < r.gy1; gy += 2) {
      for (let gx = r.gx0; gx < r.gx1; gx += 2) {
        const n = Math.abs((gx * 7 + gy * 13) % 5);
        paintQuad([
          isoPoint(gx, gy), isoPoint(gx + 2, gy),
          isoPoint(gx + 2, gy + 2), isoPoint(gx, gy + 2),
        ], shade(base, n * 2 - 4), seam, 1);
      }
    }
    // Grime worked into the slab. One patch per cell would land on the
    // lattice and read as polka dots, so these are a handful of big soft
    // pools at scattered spots, sized off a hash of where they land.
    for (let gy = r.gy0; gy < r.gy1; gy += 3) {
      for (let gx = r.gx0; gx < r.gx1; gx += 3) {
        const h = Math.abs((gx * 73 + gy * 149) % 11);
        if (h > 4) continue;
        const c = cellCenter(gx + (h % 3) * 0.7, gy + (h % 2) * 0.9);
        const rad = ROOM.tileW * (0.9 + h * 0.28);
        const g = floorCtx.createRadialGradient(c.x, c.y, rad * 0.1, c.x, c.y, rad);
        g.addColorStop(0, 'rgba(0,0,0,0.16)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        floorCtx.save();
        floorCtx.translate(c.x, c.y);
        floorCtx.scale(1, ROOM.tileH / ROOM.tileW);
        floorCtx.fillStyle = g;
        floorCtx.beginPath();
        floorCtx.arc(0, 0, rad, 0, Math.PI * 2);
        floorCtx.fill();
        floorCtx.restore();
      }
    }
  }

  // A puddle: a shallow pool with a colour-cast sheen, which is most of what
  // makes a concrete floor look like it belongs somewhere real.
  function drawPuddle(gx, gy, rx, sheen) {
    const c = cellCenter(gx, gy);
    floorCtx.beginPath();
    floorCtx.ellipse(c.x, c.y, rx, rx * 0.42, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = 'rgba(0,0,0,0.34)';
    floorCtx.fill();
    floorCtx.beginPath();
    floorCtx.ellipse(c.x - rx * 0.1, c.y - rx * 0.05, rx * 0.72, rx * 0.26, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = sheen;
    floorCtx.fill();
  }

  // A drain set flush into the slab.
  function drawFloorDrain(gx, gy, site) {
    const c = cellCenter(gx, gy);
    const half = 0.3;
    paintQuad([
      isoPoint(gx + 0.5 - half, gy + 0.5 - half), isoPoint(gx + 0.5 + half, gy + 0.5 - half),
      isoPoint(gx + 0.5 + half, gy + 0.5 + half), isoPoint(gx + 0.5 - half, gy + 0.5 + half),
    ], shade(site.floor, -22), 'rgba(0,0,0,0.6)', 1.4);
    floorCtx.strokeStyle = shade(site.floor, 14);
    floorCtx.lineWidth = 1.4;
    for (let i = 1; i < 5; i++) {
      const t = -half + (half * 2 * i) / 5;
      const a = isoPoint(gx + 0.5 + t, gy + 0.5 - half);
      const b = isoPoint(gx + 0.5 + t, gy + 0.5 + half);
      floorCtx.beginPath();
      floorCtx.moveTo(a.x, a.y);
      floorCtx.lineTo(b.x, b.y);
      floorCtx.stroke();
    }
    floorCtx.fillStyle = 'rgba(255,255,255,0.05)';
    floorCtx.beginPath();
    floorCtx.ellipse(c.x, c.y, 26, 11, 0, 0, Math.PI * 2);
    floorCtx.fill();
  }

  // Hazard markings painted onto the slab, running along a lattice axis.
  function drawFloorStripe(gx0, gy0, len, axis, color) {
    const w = 0.14;
    const a = axis === 'gx'
      ? [isoPoint(gx0, gy0 - w), isoPoint(gx0 + len, gy0 - w),
         isoPoint(gx0 + len, gy0 + w), isoPoint(gx0, gy0 + w)]
      : [isoPoint(gx0 - w, gy0), isoPoint(gx0 + w, gy0),
         isoPoint(gx0 + w, gy0 + len), isoPoint(gx0 - w, gy0 + len)];
    paintQuad(a, color, null, 0);
  }

  // ---- Wall furniture ----
  // A lit tube on a wall: the fitting, then the light it throws onto the
  // wall around it. Cheap, and it is what carries the mood in all three.
  // Light spilling across a wall. A plain radial gradient in screen space
  // hangs in front of the wall as a disc, which is what made the big fittings
  // look stuck on; this lays the glow ON the wall plane instead -- stretched
  // along the wall's own direction, upright in screen space, because that is
  // how a wall runs in this projection -- so it washes along the surface the
  // way light actually does.
  function wallGlow(from, to, t, hFrac, color, alongR, upR, strength) {
    const dir = { x: to.x - from.x, y: to.y - from.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const at = sitePoint(from, to, t, hFrac);
    floorCtx.save();
    floorCtx.translate(at.x, at.y);
    floorCtx.transform((dir.x / len) * alongR, (dir.y / len) * alongR, 0, upR, 0, 0);
    const g = floorCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, alphaOf(color, strength));
    g.addColorStop(0.45, alphaOf(color, strength * 0.42));
    g.addColorStop(1, alphaOf(color, 0));
    floorCtx.fillStyle = g;
    floorCtx.beginPath();
    floorCtx.arc(0, 0, 1, 0, Math.PI * 2);
    floorCtx.fill();
    floorCtx.restore();
  }

  // Re-alpha an "rgb(...)"/"rgba(...)"/hex colour without disturbing its hue.
  function alphaOf(color, a) {
    const { r, g, b } = toRgb(color);
    return `rgba(${r},${g},${b},${a})`;
  }

  function drawStripLight(from, to, t, hFrac, site, glowColor, len) {
    const half = (len || 0.075);
    // The wash first, so the fitting itself sits crisply on top of it.
    wallGlow(from, to, t, hFrac, glowColor, 300, 150, 0.26);
    wallGlow(from, to, t, hFrac - 0.06, glowColor, 170, 70, 0.2);

    paintQuad(siteQuad(from, to, t - half, t + half, hFrac - 0.022, hFrac + 0.022),
      shade(site.wall, 40), 'rgba(0,0,0,0.45)', 1);
    paintQuad(siteQuad(from, to, t - half * 0.9, t + half * 0.9, hFrac - 0.012, hFrac + 0.012),
      glowColor, null, 0);

    // And a pool of it on the floor below, squashed onto the ground plane.
    const foot = sitePoint(from, to, t, 0);
    floorCtx.save();
    floorCtx.translate(foot.x, foot.y);
    const dir = { x: to.x - from.x, y: to.y - from.y };
    const dl = Math.hypot(dir.x, dir.y) || 1;
    floorCtx.transform((dir.x / dl) * 200, (dir.y / dl) * 200, 0, 62, 0, 0);
    const pool = floorCtx.createRadialGradient(0, 0, 0, 0, 0, 1);
    pool.addColorStop(0, alphaOf(glowColor, 0.1));
    pool.addColorStop(1, alphaOf(glowColor, 0));
    floorCtx.fillStyle = pool;
    floorCtx.beginPath();
    floorCtx.arc(0, 0, 1, 0, Math.PI * 2);
    floorCtx.fill();
    floorCtx.restore();
  }

  // A louvred vent grille.
  function drawWallVent(from, to, t, hFrac, site) {
    const w = 0.05;
    const h = 0.08;
    paintQuad(siteQuad(from, to, t - w, t + w, hFrac - h, hFrac + h),
      shade(site.wall, -8), 'rgba(0,0,0,0.5)', 1.2);
    for (let i = 1; i < 6; i++) {
      const hh = hFrac - h + (h * 2 * i) / 6;
      paintQuad(siteQuad(from, to, t - w * 0.86, t + w * 0.86, hh - 0.006, hh + 0.006),
        shade(site.wall, 26), null, 0);
    }
  }

  // A junction box, with the yellow triangle every one of them carries.
  function drawWallBox(from, to, t, hFrac, site, warn) {
    const w = 0.045;
    const h = 0.11;
    paintQuad(siteQuad(from, to, t - w, t + w, hFrac - h, hFrac + h),
      shade(site.wall, 18), 'rgba(0,0,0,0.55)', 1.2);
    paintQuad(siteQuad(from, to, t - w * 0.8, t + w * 0.8, hFrac - h * 0.8, hFrac + h * 0.8),
      shade(site.wall, 30), 'rgba(0,0,0,0.3)', 1);
    if (warn) {
      const a = sitePoint(from, to, t, hFrac + h * 0.32);
      const b = sitePoint(from, to, t - w * 0.42, hFrac - h * 0.28);
      const c = sitePoint(from, to, t + w * 0.42, hFrac - h * 0.28);
      paintQuad([a, c, b], 'rgba(224,178,54,0.85)', 'rgba(0,0,0,0.4)', 1);
    }
  }

  // A pipe run along a wall, with a bracket every so often.
  function drawWallPipe(from, to, hFrac, site, width) {
    const a = sitePoint(from, to, -0.02, hFrac);
    const b = sitePoint(from, to, 1.02, hFrac);
    floorCtx.save();
    floorCtx.lineCap = 'round';
    floorCtx.strokeStyle = shade(site.wall, 20);
    floorCtx.lineWidth = width;
    floorCtx.beginPath();
    floorCtx.moveTo(a.x, a.y);
    floorCtx.lineTo(b.x, b.y);
    floorCtx.stroke();
    floorCtx.strokeStyle = shade(site.wall, 46);
    floorCtx.lineWidth = width * 0.3;
    floorCtx.beginPath();
    floorCtx.moveTo(a.x, a.y - width * 0.28);
    floorCtx.lineTo(b.x, b.y - width * 0.28);
    floorCtx.stroke();
    floorCtx.restore();
    for (let t = 0.1; t < 1; t += 0.22) {
      const p = sitePoint(from, to, t, hFrac);
      paintQuad(siteQuad(from, to, t - 0.012, t + 0.012,
        hFrac - width / SITE_WALL_H * 0.8, hFrac + width / SITE_WALL_H * 0.8),
        shade(site.wall, 6), null, 0);
      void p;
    }
  }

  // ---- Floor furniture ----
  function drawCrate(gx, gy, size, site, lift) {
    const base = isoPoint(gx, gy);
    drawIsoBox(floorCtx, base, 0, 0, size, size, size * 150, shade(site.trim, 10), lift || 0);
  }

  function drawBarrel(gx, gy, site) {
    const base = isoPoint(gx, gy);
    const h = 62;
    const rx = 26;
    floorCtx.beginPath();
    floorCtx.moveTo(base.x - rx, base.y - h);
    floorCtx.lineTo(base.x - rx, base.y);
    floorCtx.ellipse(base.x, base.y, rx, rx * 0.42, 0, Math.PI, 0, true);
    floorCtx.lineTo(base.x + rx, base.y - h);
    floorCtx.closePath();
    const g = floorCtx.createLinearGradient(base.x - rx, 0, base.x + rx, 0);
    g.addColorStop(0, shade(site.trim, -22));
    g.addColorStop(0.45, shade(site.trim, 6));
    g.addColorStop(1, shade(site.trim, -28));
    floorCtx.fillStyle = g;
    floorCtx.fill();
    floorCtx.strokeStyle = 'rgba(0,0,0,0.5)';
    floorCtx.lineWidth = 1;
    floorCtx.stroke();
    floorCtx.beginPath();
    floorCtx.ellipse(base.x, base.y - h, rx, rx * 0.42, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = shade(site.trim, 10);
    floorCtx.fill();
    floorCtx.stroke();
  }

  function drawTyreStack(gx, gy, n, site) {
    const base = isoPoint(gx, gy);
    for (let i = 0; i < n; i++) {
      const y = base.y - i * 15;
      floorCtx.beginPath();
      floorCtx.ellipse(base.x, y, 30, 14, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = shade(site.floor, -18 + i * 3);
      floorCtx.fill();
      floorCtx.strokeStyle = 'rgba(0,0,0,0.55)';
      floorCtx.lineWidth = 1;
      floorCtx.stroke();
    }
    floorCtx.beginPath();
    floorCtx.ellipse(base.x, base.y - (n - 1) * 15, 12, 5.5, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = 'rgba(0,0,0,0.55)';
    floorCtx.fill();
  }

  // Shelving: an open frame of uprights and shelves, with boxes on it.
  function drawShelving(gx, gy, bays, site) {
    const base = isoPoint(gx, gy);
    const w = bays * 0.9;
    drawIsoBox(floorCtx, base, w / 2, 0, w / 2, 0.16, 8, shade(site.trim, -2), 0);
    for (let level = 0; level < 3; level++) {
      const lift = 34 + level * 46;
      drawIsoBox(floorCtx, base, w / 2, 0, w / 2, 0.16, 6, shade(site.trim, 2), lift);
      for (let b = 0; b < bays; b++) {
        if (((b * 7 + level * 5) % 3) === 0) continue;
        drawIsoBox(floorCtx, base, 0.45 + b * 0.9, 0, 0.24, 0.12, 26,
          shade(site.trim, 16 + ((b + level) % 3) * 12), lift + 6);
      }
    }
  }

  // ---- Site shells, one per theme ----
  // Each builds the same three things in the same order -- floor, enclosure,
  // then what is standing around in it -- but a boiler room, a workshop and
  // a roof are different enough places that they get their own.

  function drawSiteWalls(site) {
    const c = siteCorners();
    const depthE = isoVecRaw(0, -SITE_WALL_THICK);
    const depthW = isoVecRaw(-SITE_WALL_THICK, 0);
    drawWallSlab(c.north, c.east, SITE_WALL_H, depthE, site.wall);
    drawWallSlab(c.north, c.west, SITE_WALL_H, depthW, site.wall);
    drawWallCorner(c.north, depthE, depthW, SITE_WALL_H, site.wall);
    drawBaseboard(c.east, c.north);
    drawBaseboard(c.north, c.west);
    return c;
  }

  const SITE = {
    basement: (site) => {
      drawSiteFloor(site);
      const c = drawSiteWalls(site);
      const cyan = 'rgba(150,240,240,0.9)';

      [c.east, c.west].forEach((far, side) => {
        // Damp streaking down the concrete, under the pipe run.
        for (let t = 0.08; t < 1; t += 0.17) {
          paintQuad(siteQuad(c.north, far, t, t + 0.035, 0.05, 0.86),
            'rgba(0,0,0,0.13)', null, 0);
        }
        drawWallPipe(c.north, far, 0.9, site, 13);
        drawWallPipe(c.north, far, 0.82, site, 7);
        drawWallVent(c.north, far, side ? 0.36 : 0.44, 0.6, site);
        drawWallBox(c.north, far, side ? 0.62 : 0.68, 0.62, site, true);
        drawWallBox(c.north, far, side ? 0.52 : 0.16, 0.5, site, false);
        [0.24, 0.64].forEach((t, i) => {
          if (side === 1 && i === 1) return;
          drawStripLight(c.north, far, t, 0.72, site, cyan);
        });
      });

      const r = siteRect();
      drawCrate(r.gx0 + 1.0, r.gy0 + 2.6, 0.34, site);
      drawCrate(r.gx0 + 1.1, r.gy0 + 1.4, 0.28, site);
      drawBarrel(r.gx0 + 0.8, r.gy0 + 3.9, site);
      drawCrate(r.gx1 - 1.3, r.gy0 + 1.1, 0.32, site);
      drawBarrel(r.gx1 - 1.1, r.gy0 + 2.3, site);

      const sheen = 'rgba(150,230,240,0.16)';
      [[r.gx0 + 3, r.gy0 + 6, 60], [r.gx1 - 3, r.gy0 + 4, 48],
       [r.gx0 + 5, r.gy1 - 3, 66], [r.gx1 - 5, r.gy1 - 4, 44]]
        .forEach(([gx, gy, rx]) => drawPuddle(gx, gy, rx, sheen));
      [[r.gx0 + 2, r.gy0 + 4], [r.gx1 - 4, r.gy1 - 3], [r.gx0 + 6, r.gy1 - 2]]
        .forEach(([gx, gy]) => drawFloorDrain(gx, gy, site));
    },

    garage: (site) => {
      drawSiteFloor(site);
      const c = drawSiteWalls(site);
      const amber = 'rgba(255,206,130,0.9)';

      // Timber cladding: vertical boarding down both walls.
      [c.east, c.west].forEach((far) => {
        for (let t = 0; t < 1; t += 0.035) {
          paintQuad(siteQuad(c.north, far, t, t + 0.035, 0, 1),
            null, 'rgba(0,0,0,0.2)', 1);
        }
      });

      // The roller shutter, along the left-hand wall.
      const sh0 = 0.52;
      const sh1 = 0.8;
      paintQuad(siteQuad(c.north, c.west, sh0, sh1, 0, 0.62),
        shade(site.wall, -10), 'rgba(0,0,0,0.55)', 1.6);
      for (let h = 0.03; h < 0.6; h += 0.036) {
        paintQuad(siteQuad(c.north, c.west, sh0 + 0.012, sh1 - 0.012, h, h + 0.021),
          shade(site.wall, 22), null, 0);
      }
      // Cold daylight leaking in under it, and the wedge of it on the floor.
      paintQuad(siteQuad(c.north, c.west, sh0 + 0.02, sh1 - 0.02, 0, 0.028),
        'rgba(180,220,255,0.55)', null, 0);
      const sA = sitePoint(c.north, c.west, sh0 + 0.02, 0);
      const sB = sitePoint(c.north, c.west, sh1 - 0.02, 0);
      const reach = isoVecRaw(3.2, 0);
      const spill = floorCtx.createLinearGradient(sA.x, sA.y, sA.x + reach.x, sA.y + reach.y);
      spill.addColorStop(0, 'rgba(150,200,255,0.20)');
      spill.addColorStop(1, 'rgba(150,200,255,0)');
      paintQuad([sA, sB, { x: sB.x + reach.x, y: sB.y + reach.y },
        { x: sA.x + reach.x, y: sA.y + reach.y }], spill, null, 0);

      // Pegboard of tools over the bench, on the right-hand wall.
      const pb0 = 0.44;
      const pb1 = 0.7;
      paintQuad(siteQuad(c.north, c.east, pb0, pb1, 0.44, 0.68),
        shade(site.wall, -12), 'rgba(0,0,0,0.5)', 1.2);
      for (let i = 0; i < 11; i++) {
        const t = pb0 + 0.014 + i * 0.0225;
        if (i % 4 === 3) continue;
        paintQuad(siteQuad(c.north, c.east, t, t + 0.009, 0.48, 0.64),
          i % 3 ? 'rgba(206,178,132,0.7)' : 'rgba(176,86,72,0.7)', null, 0);
      }

      drawStripLight(c.north, c.west, 0.2, 0.8, site, amber, 0.1);
      drawStripLight(c.north, c.west, 0.92, 0.74, site, amber, 0.08);
      [0.2, 0.56, 0.88].forEach((t) => drawStripLight(c.north, c.east, t, 0.82, site, amber, 0.09));

      const r = siteRect();
      // A bench under the pegboard, running along the back-right wall.
      for (let i = 0; i < 4; i++) {
        const b = isoPoint(r.gx1 - 5.4 + i * 0.95, r.gy0 + 0.62);
        drawIsoBox(floorCtx, b, 0, 0, 0.42, 0.2, 44, shade(site.trim, -6), 0);
        drawIsoBox(floorCtx, b, 0, 0, 0.46, 0.23, 11, shade(site.trim, 22), 46);
      }
      drawShelving(r.gx0 + 0.8, r.gy0 + 1.3, 2, site);
      drawShelving(r.gx1 - 2.8, r.gy0 + 0.7, 2, site);
      drawTyreStack(r.gx0 + 0.9, r.gy0 + 4.3, 4, site);
      drawTyreStack(r.gx1 - 1.0, r.gy0 + 3.5, 3, site);
      drawBarrel(r.gx0 + 2.0, r.gy0 + 0.9, site);

      // Bay markings and the drain channel across the floor.
      const yellow = 'rgba(206,160,48,0.42)';
      drawFloorStripe(r.gx0 + 2, r.gy1 - 4, 6, 'gx', yellow);
      drawFloorStripe(r.gx0 + 2, r.gy1 - 4, 5, 'gy', yellow);
      drawFloorStripe(r.gx1 - 3, r.gy0 + 3, 5, 'gy', yellow);
      for (let i = 0; i < 5; i++) drawFloorDrain(r.gx0 + 3 + i, r.gy1 - 2, site);
      [[r.gx0 + 4, r.gy0 + 5, 54], [r.gx1 - 4, r.gy1 - 5, 44]]
        .forEach(([gx, gy, rx]) => drawPuddle(gx, gy, rx, 'rgba(255,214,150,0.10)'));
    },

    rooftop: (site) => {
      // No enclosure up here: a night sky, a city standing in it, and a low
      // parapet at the edge of the deck.
      const c = siteCorners();
      const horizon = c.north.y;
      const sky = floorCtx.createLinearGradient(0, 0, 0, horizon + 60);
      sky.addColorStop(0, '#0b1428');
      sky.addColorStop(0.55, '#182842');
      sky.addColorStop(1, '#27405e');
      floorCtx.fillStyle = sky;
      floorCtx.fillRect(0, 0, BASE_W, horizon + 60);

      // The city, in two ranks -- the far one hazier and set back. Drawn
      // either side of the moon and the landmarks, so those stand between
      // the ranks instead of behind everything.
      const skylineBase = horizon - 26;
      const drawRank = (rank) => {
        let x = -70;
        let seed = rank.seed;
        while (x < BASE_W + 70) {
          seed = wobbleSeed(seed);
          const w = 46 + (seed % 6) * 17;
          const h = (95 + (seed % 9) * 36) * rank.tall;
          const top = skylineBase - rank.set - h;
          floorCtx.fillStyle = rank.tint;
          floorCtx.fillRect(x, top, w, h + rank.set + 160);
          const warm = `rgba(255,204,126,${rank.lit})`;
          const cool = `rgba(126,214,240,${rank.lit})`;
          for (let wy = top + 15; wy < top + h - 12; wy += 18) {
            for (let wx = x + 8; wx < x + w - 10; wx += 14) {
              if (((wx * 13 + wy * 7) % 5) >= 2) continue;
              floorCtx.fillStyle = ((wx + wy) % 3) === 0 ? cool : warm;
              floorCtx.fillRect(wx, wy, 5, 8);
            }
          }
          if ((seed % 4) === 0) {
            floorCtx.fillStyle = 'rgba(255,86,74,0.9)';
            floorCtx.fillRect(x + w / 2 - 2, top - 8, 4, 6);
          }
          x += w + 9 + (seed % 4) * 8;
        }
      };

      drawRank({ set: 90, tint: '#1d2f4e', lit: 0.30, tall: 1.2, seed: 9 });

      // Moon, high enough to clear the towers.
      const moon = { x: BASE_W * 0.79, y: 92 };
      const halo = floorCtx.createRadialGradient(moon.x, moon.y, 6, moon.x, moon.y, 170);
      halo.addColorStop(0, 'rgba(226,236,255,0.5)');
      halo.addColorStop(1, 'rgba(226,236,255,0)');
      floorCtx.fillStyle = halo;
      floorCtx.beginPath();
      floorCtx.arc(moon.x, moon.y, 170, 0, Math.PI * 2);
      floorCtx.fill();
      floorCtx.beginPath();
      floorCtx.arc(moon.x, moon.y, 36, 0, Math.PI * 2);
      floorCtx.fillStyle = '#e9efff';
      floorCtx.fill();
      floorCtx.beginPath();
      floorCtx.arc(moon.x - 11, moon.y - 6, 6, 0, Math.PI * 2);
      floorCtx.arc(moon.x + 9, moon.y + 8, 8, 0, Math.PI * 2);
      floorCtx.fillStyle = 'rgba(196,208,232,0.55)';
      floorCtx.fill();

      drawRank({ set: 0, tint: '#131f38', lit: 0.55, tall: 0.9, seed: 23 });

      // Water tower and a comms mast, standing clear in front of the city.
      const silhouette = '#0e1a2e';
      const wt = { x: BASE_W * 0.1, y: skylineBase - 30 };
      floorCtx.fillStyle = silhouette;
      [-38, -12, 12, 38].forEach((dx) => floorCtx.fillRect(wt.x + dx, wt.y - 66, 6, 70));
      floorCtx.fillRect(wt.x - 45, wt.y - 128, 90, 64);
      floorCtx.beginPath();
      floorCtx.moveTo(wt.x - 52, wt.y - 128);
      floorCtx.lineTo(wt.x, wt.y - 158);
      floorCtx.lineTo(wt.x + 52, wt.y - 128);
      floorCtx.closePath();
      floorCtx.fill();
      // A rim of moonlight down one side, or the tower is a black slab.
      floorCtx.fillStyle = 'rgba(198,216,246,0.18)';
      floorCtx.fillRect(wt.x + 34, wt.y - 128, 11, 64);
      floorCtx.fillStyle = 'rgba(198,216,246,0.12)';
      floorCtx.fillRect(wt.x - 45, wt.y - 130, 90, 4);
      floorCtx.strokeStyle = 'rgba(198,216,246,0.14)';
      floorCtx.lineWidth = 2;
      for (let ry = wt.y - 120; ry < wt.y - 68; ry += 15) {
        floorCtx.beginPath();
        floorCtx.moveTo(wt.x - 43, ry);
        floorCtx.lineTo(wt.x + 43, ry);
        floorCtx.stroke();
      }

      const mast = { x: BASE_W * 0.93, y: skylineBase - 22 };
      floorCtx.fillStyle = silhouette;
      floorCtx.fillRect(mast.x - 4, mast.y - 152, 8, 156);
      [-116, -86, -56].forEach((dy) => floorCtx.fillRect(mast.x - 15, mast.y + dy, 30, 5));
      floorCtx.fillStyle = 'rgba(255,86,74,0.95)';
      floorCtx.fillRect(mast.x - 4, mast.y - 163, 8, 9);

      drawSiteFloor(site);

      // The parapet: a low wall around the two back edges, lights set in it.
      const parapetH = 66;
      const depthE = isoVecRaw(0, -SITE_WALL_THICK);
      const depthW = isoVecRaw(-SITE_WALL_THICK, 0);
      drawWallSlab(c.north, c.east, parapetH, depthE, site.wall);
      drawWallSlab(c.north, c.west, parapetH, depthW, site.wall);
      drawWallCorner(c.north, depthE, depthW, parapetH, site.wall);
      [c.east, c.west].forEach((far) => {
        for (let t = 0.14; t < 1; t += 0.24) {
          const at = (f) => ({ x: c.north.x + (far.x - c.north.x) * f,
                               y: c.north.y + (far.y - c.north.y) * f });
          const a = at(t);
          const b = at(t + 0.032);
          // Same reasoning as the strip lights: the wash lies along the
          // parapet, not as a disc hanging in front of it.
          wallGlow(c.north, far, t + 0.016, 0.132, 'rgba(255,198,112,1)', 150, 62, 0.22);
          paintQuad([liftPt(a, 40), liftPt(b, 40), liftPt(b, 26), liftPt(a, 26)],
            'rgba(255,198,112,0.9)', null, 0);
        }
      });

      // Plant on the deck.
      const r = siteRect();
      const unit = isoPoint(r.gx0 + 1.2, r.gy0 + 5.2);
      drawIsoBox(floorCtx, unit, 0, 0, 0.62, 0.46, 74, shade(site.trim, 24), 0);
      [[-0.24, -0.18], [0.24, 0.18]].forEach(([u, v]) => {
        const o = isoVecRaw(u, v);
        const f = { x: unit.x + o.x, y: unit.y + o.y - 76 };
        floorCtx.beginPath();
        floorCtx.ellipse(f.x, f.y, 25, 12, 0, 0, Math.PI * 2);
        floorCtx.fillStyle = shade(site.trim, -2);
        floorCtx.fill();
        floorCtx.strokeStyle = shade(site.trim, 44);
        floorCtx.lineWidth = 1.4;
        floorCtx.stroke();
      });
      drawIsoBox(floorCtx, isoPoint(r.gx1 - 1.6, r.gy0 + 4.6), 0, 0, 0.4, 0.34, 56,
        shade(site.trim, 20), 0);
      drawIsoBox(floorCtx, isoPoint(r.gx0 + 2.4, r.gy0 + 7.0), 0, 0, 0.34, 0.3, 40,
        shade(site.trim, 12), 0);
      drawIsoBox(floorCtx, isoPoint(r.gx0 + 1.6, r.gy1 - 5.0), 0, 0, 0.3, 0.26, 46,
        shade(site.trim, 18), 0);
      const stack = isoPoint(r.gx0 + 3.0, r.gy1 - 6.6);
      drawIsoBox(floorCtx, stack, 0, 0, 0.16, 0.14, 52, shade(site.trim, 26), 0);
      const steam = floorCtx.createRadialGradient(stack.x, stack.y - 92, 4, stack.x, stack.y - 92, 74);
      steam.addColorStop(0, 'rgba(200,220,240,0.18)');
      steam.addColorStop(1, 'rgba(200,220,240,0)');
      floorCtx.fillStyle = steam;
      floorCtx.beginPath();
      floorCtx.arc(stack.x, stack.y - 92, 74, 0, Math.PI * 2);
      floorCtx.fill();

      [[r.gx0 + 4, r.gy1 - 4, 62], [r.gx1 - 4, r.gy0 + 5, 48], [r.gx0 + 6, r.gy0 + 6, 40]]
        .forEach(([gx, gy, rx]) => drawPuddle(gx, gy, rx, 'rgba(180,215,255,0.16)'));
    },
  };

  // Deterministic per-position jitter, so a skyline is uneven but does not
  // reshuffle itself on every repaint.
  function wobbleSeed(seed) {
    return (seed * 37 + 11) % 97;
  }

  // A pool of the theme's own light over the plan, so the middle of the view
  // is lit and the far corners of the site fall away.
  function drawSiteWash(tint) {
    const cx = BLEED_SIDE + PLAN_W / 2;
    const cy = BLEED_TOP + PLAN_H / 2;
    const radius = Math.max(PLAN_W, PLAN_H) * 0.8;
    floorCtx.save();
    floorCtx.translate(cx, cy);
    floorCtx.scale(1, 0.6);
    const g = floorCtx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
    g.addColorStop(0, tint);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    floorCtx.fillStyle = g;
    floorCtx.beginPath();
    floorCtx.arc(0, 0, radius, 0, Math.PI * 2);
    floorCtx.fill();
    floorCtx.restore();
  }

  // Darkness closing in at the corners of the view. Where the plan is what
  // you are meant to be looking at, this is what keeps your eye on it.
  function drawSiteVignette() {
    const cx = BLEED_SIDE + PLAN_W / 2;
    const cy = BLEED_TOP + PLAN_H / 2;
    const radius = Math.hypot(BASE_W, BASE_H) * 0.62;
    const g = floorCtx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.4)');
    floorCtx.fillStyle = g;
    floorCtx.fillRect(0, 0, BASE_W, BASE_H);
  }

  // Dissolve the last strip along each edge of the canvas. The site's own
  // floor and walls are the frame now, but the canvas still has to stop
  // somewhere, and a cut edge against the stage would be a box outline.
  function maskAmbienceEdges() {
    const fade = 46;
    const edges = [
      [0, 0, fade, 0, 0, 0, fade, BASE_H],
      [BASE_W, 0, BASE_W - fade, 0, BASE_W - fade, 0, fade, BASE_H],
      [0, 0, 0, fade, 0, 0, BASE_W, fade],
      [0, BASE_H, 0, BASE_H - fade, 0, BASE_H - fade, BASE_W, fade],
    ];
    floorCtx.save();
    floorCtx.globalCompositeOperation = 'destination-out';
    edges.forEach(([x0, y0, x1, y1, rx, ry, rw, rh]) => {
      const g = floorCtx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      floorCtx.fillStyle = g;
      floorCtx.fillRect(rx, ry, rw, rh);
    });
    floorCtx.restore();
  }

  function drawAmbience(theme) {
    const site = SITE_COLORS[theme] || SITE_COLORS.garage;
    (SITE[theme] || SITE.garage)(site);
    drawSiteWash(AMBIENT_WASH[theme] || AMBIENT_WASH.garage);
    drawSiteVignette();
    maskAmbienceEdges();
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
  // Deliberately escalating: the starter bay is a bare room with one bulb,
  // and each one bought after it arrives better appointed than the last, so
  // the plan visibly improves as it grows rather than repeating one room.
  const ROOM_FITS = [
    { lighting: 'bulb', decor: [] },
    { lighting: 'strip', decor: ['vent', 'shelf'] },
    { lighting: 'strip', decor: ['shelf', 'clock', 'banner'] },
    { lighting: 'strip', decor: ['mirror', 'shelf', 'banner', 'clock', 'vent'] },
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

      // Longer wall, more lamps -- a bigger room should read as better lit,
      // not as the same three lights stretched further apart.
      const run = Math.hypot(to.x - from.x, to.y - from.y);
      const lamps = Math.max(3, Math.min(5, Math.round(run / 95)));
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
    // A run of mirrored panel, the thing that turns a bare room into a gym.
    mirror(from, to, t) {
      const w = 0.17;
      paintQuad(wallQuad(from, to, t - w, t + w, 0.76, 0.30), '#2b343d', 'rgba(0,0,0,0.55)', 1.4);
      paintQuad(wallQuad(from, to, t - w * 0.92, t + w * 0.92, 0.73, 0.33), '#4c6373', null);
      // Two slanted highlights, so it reads as glass rather than a grey panel.
      paintQuad(wallQuad(from, to, t - w * 0.66, t - w * 0.34, 0.73, 0.33), 'rgba(255,255,255,0.13)', null);
      paintQuad(wallQuad(from, to, t - w * 0.1, t + w * 0.06, 0.73, 0.33), 'rgba(255,255,255,0.07)', null);
      // Vertical joint between the two panes.
      paintQuad(wallQuad(from, to, t - 0.006, t + 0.006, 0.73, 0.33), 'rgba(0,0,0,0.4)', null);
    },
    // A hanging banner -- the room has been won, not just rented.
    banner(from, to, t) {
      const w = 0.05;
      paintQuad(wallQuad(from, to, t - w * 1.35, t + w * 1.35, 0.88, 0.855), '#6d747e', 'rgba(0,0,0,0.5)', 1);
      paintQuad(wallQuad(from, to, t - w, t + w, 0.855, 0.44), '#8d2f28', 'rgba(0,0,0,0.5)', 1.2);
      paintQuad(wallQuad(from, to, t - w * 0.5, t + w * 0.5, 0.80, 0.52), 'rgba(255, 220, 160, 0.22)', null);
      paintQuad(wallQuad(from, to, t - w, t + w, 0.47, 0.44), 'rgba(0,0,0,0.28)', null);
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
    // Kept clear of mid-wall, which is where each theme hangs its own decor.
    const slots = [
      { wall: [north, east], t: 0.22 },
      { wall: [north, west], t: 0.75 },
      { wall: [north, east], t: 0.81 },
      { wall: [north, west], t: 0.24 },
      { wall: [north, east], t: 0.38 },
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

  // ---- Walls ----
  // Every wall in the plan, room or hallway, is built here, so a room's wall
  // and the hallway wall running into it are the same solid and actually
  // meet at the corner. Earlier the rooms drew flat planes while corridors
  // drew slabs, which is why the junctions never lined up.
  const WALL_THICK = 0.3; // in tiles

  // Which way a wall's thickness points: away from the space it encloses,
  // along the other tile axis. Walls that run along +gx are backed off in
  // -gy, and vice versa, so the depth stays on the isometric grid instead of
  // being a screen-space guess.
  function wallDepth(axis) {
    return axis === 'gx' ? isoVecRaw(0, -WALL_THICK) : isoVecRaw(-WALL_THICK, 0);
  }

  // A wall as an actual solid: the face you look at, the top surface that
  // gives it thickness, and a cap on the far end. The cap belongs on the far
  // end only -- that is the end whose cut face turns toward the viewer, for
  // both axes, given a always starts at the shared back corner.
  function drawWallSlab(a, b, h, depth, baseColor) {
    const off = (p, lift) => ({ x: p.x + depth.x, y: p.y + depth.y - (lift || 0) });

    paintQuad(
      [b, off(b), off(b, h), liftPt(b, h)],
      shade(baseColor, -20), 'rgba(0,0,0,0.5)', 1,
    );

    paintQuad(
      [liftPt(a, h), liftPt(b, h), off(b, h), off(a, h)],
      shade(baseColor, 46), 'rgba(0,0,0,0.42)', 1,
    );

    const grad = floorCtx.createLinearGradient(0, a.y - h, 0, a.y);
    grad.addColorStop(0, shade(baseColor, 16));
    grad.addColorStop(1, shade(baseColor, -12));
    paintQuad([a, b, liftPt(b, h), liftPt(a, h)], grad, 'rgba(0,0,0,0.45)', 1);
  }

  // The square of ceiling left between two walls meeting at a back corner --
  // without it the two top faces stop short and leave a notch in the corner.
  function drawWallCorner(corner, depthA, depthB, h, baseColor) {
    paintQuad([
      liftPt(corner, h),
      { x: corner.x + depthA.x, y: corner.y + depthA.y - h },
      { x: corner.x + depthA.x + depthB.x, y: corner.y + depthA.y + depthB.y - h },
      { x: corner.x + depthB.x, y: corner.y + depthB.y - h },
    ], shade(baseColor, 46), 'rgba(0,0,0,0.42)', 1);
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

    // Full room height, not a shorter parapet: the hallway wall runs into a
    // room wall at both ends, and any difference in height shows up as a step
    // at the junction.
    //
    // The far end butts into the far room's back wall, which is a solid of
    // the same height, so that junction closes itself. The near end opens out
    // of a room's cutaway front, where there is no wall to meet -- so the
    // hallway wall would otherwise begin in mid-air, a few tiles adrift of
    // where the room's own wall stopped. The return below is the piece of the
    // room's side wall above the doorway that carries one into the other.
    const along = c.cols > c.rows;
    const near = c.nearRoom;
    if (along) {
      // Running east along the gy0 edge; thickness backs off up and right.
      drawWallSlab(
        isoPoint(c.gx0, c.gy0), isoPoint(c.gx0 + c.cols, c.gy0),
        ROOM.wallH, wallDepth('gx'), colors.wallR,
      );
      if (near && c.gy0 > near.gy0) {
        drawWallSlab(
          isoPoint(c.gx0, near.gy0), isoPoint(c.gx0, c.gy0),
          ROOM.wallH, wallDepth('gy'), colors.wallL,
        );
        // Mitre both ends of the return: into the room's back wall at the top,
        // into the hallway's own wall at the bottom.
        drawWallCorner(isoPoint(c.gx0, near.gy0), wallDepth('gx'), wallDepth('gy'),
          ROOM.wallH, colors.wallL);
        drawWallCorner(isoPoint(c.gx0, c.gy0), wallDepth('gx'), wallDepth('gy'),
          ROOM.wallH, colors.wallL);
      }
    } else {
      // Running south along the gx0 edge; thickness backs off up and left.
      drawWallSlab(
        isoPoint(c.gx0, c.gy0), isoPoint(c.gx0, c.gy0 + c.rows),
        ROOM.wallH, wallDepth('gy'), colors.wallL,
      );
      if (near && c.gx0 > near.gx0) {
        drawWallSlab(
          isoPoint(near.gx0, c.gy0), isoPoint(c.gx0, c.gy0),
          ROOM.wallH, wallDepth('gx'), colors.wallR,
        );
        drawWallCorner(isoPoint(near.gx0, c.gy0), wallDepth('gx'), wallDepth('gy'),
          ROOM.wallH, colors.wallL);
        drawWallCorner(isoPoint(c.gx0, c.gy0), wallDepth('gx'), wallDepth('gy'),
          ROOM.wallH, colors.wallL);
      }
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

  // ---- The next room, before it is bought ----
  // Staked out on the plan as a surveyed plot: the floor marked out, corner
  // posts, the hallway that will reach it, and a site board naming what it
  // is and what it costs. It lights up amber the moment it is affordable.

  function plotOutline(rect, accent, faint) {
    for (let ry = 0; ry < rect.rows; ry++) {
      for (let rx = 0; rx < rect.cols; rx++) {
        const gx = rect.gx0 + rx;
        const gy = rect.gy0 + ry;
        paintQuad([
          isoPoint(gx, gy), isoPoint(gx + 1, gy),
          isoPoint(gx + 1, gy + 1), isoPoint(gx, gy + 1),
        ], faint, 'rgba(255,255,255,0.05)', 1);
      }
    }
    const corners = [
      isoPoint(rect.gx0, rect.gy0),
      isoPoint(rect.gx0 + rect.cols, rect.gy0),
      isoPoint(rect.gx0 + rect.cols, rect.gy0 + rect.rows),
      isoPoint(rect.gx0, rect.gy0 + rect.rows),
    ];
    floorCtx.save();
    floorCtx.setLineDash([8, 7]);
    paintQuad(corners, null, accent, 2);
    floorCtx.restore();
    return corners;
  }

  function drawPlotSign(centre, index, cost, affordable, accent) {
    const postH = 30;
    const panelW = 104;
    const panelH = 50;
    const top = { x: centre.x, y: centre.y - postH - panelH };

    [-panelW * 0.3, panelW * 0.3].forEach((dx) => {
      paintQuad([
        { x: centre.x + dx - 2.5, y: centre.y },
        { x: centre.x + dx + 2.5, y: centre.y },
        { x: centre.x + dx + 2.5, y: centre.y - postH },
        { x: centre.x + dx - 2.5, y: centre.y - postH },
      ], shade(accent, -70), 'rgba(0,0,0,0.5)', 1);
    });

    floorCtx.save();
    if (affordable) {
      floorCtx.shadowColor = 'rgba(255,183,3,0.5)';
      floorCtx.shadowBlur = 16;
    }
    paintQuad([
      { x: top.x - panelW / 2, y: top.y },
      { x: top.x + panelW / 2, y: top.y },
      { x: top.x + panelW / 2, y: top.y + panelH },
      { x: top.x - panelW / 2, y: top.y + panelH },
    ], 'rgba(16,15,21,0.94)', accent, 2);
    floorCtx.restore();

    floorCtx.save();
    floorCtx.textAlign = 'center';
    floorCtx.textBaseline = 'middle';
    floorCtx.fillStyle = accent;
    floorCtx.font = '800 13px Inter, system-ui, sans-serif';
    floorCtx.fillText('ROOM ' + (index + 1), top.x, top.y + 13);
    floorCtx.fillStyle = 'rgba(244,240,234,0.72)';
    floorCtx.font = '700 10px Inter, system-ui, sans-serif';
    floorCtx.fillText(slotCountFor(index) + ' SLOTS', top.x, top.y + 27);
    floorCtx.fillStyle = affordable ? '#ffd66b' : 'rgba(244,240,234,0.5)';
    floorCtx.font = '800 12px Inter, system-ui, sans-serif';
    floorCtx.fillText('$' + formatNum(cost), top.x, top.y + 41);
    floorCtx.restore();
  }

  function drawRoomPreview(rect, corridor, colors, index) {
    const cost = ROOM_UNLOCK_COSTS[index];
    const affordable = state.balance >= cost;
    const accent = affordable ? '#ffb703' : 'rgba(168,159,176,0.5)';
    const faint = affordable ? 'rgba(255,183,3,0.05)' : 'rgba(255,255,255,0.022)';

    if (corridor) plotOutline(corridor, accent, faint);
    const corners = plotOutline(rect, accent, faint);

    // Corner stakes, so the plot reads as marked out rather than painted on.
    corners.forEach((p) => {
      paintQuad([
        { x: p.x - 2.5, y: p.y },
        { x: p.x + 2.5, y: p.y },
        { x: p.x + 2.5, y: p.y - 22 },
        { x: p.x - 2.5, y: p.y - 22 },
      ], shade(colors.wallL, 34), 'rgba(0,0,0,0.45)', 1);
      floorCtx.beginPath();
      floorCtx.arc(p.x, p.y - 24, 2.6, 0, Math.PI * 2);
      floorCtx.fillStyle = accent;
      floorCtx.fill();
    });

    const centre = cellCenter(
      rect.gx0 + rect.cols / 2 - 0.5, rect.gy0 + rect.rows / 2 - 0.5,
    );
    drawPlotSign(centre, index, cost, affordable, accent);
  }

  // A step of floor across the hallway mouth, marking the threshold where a
  // room opens onto it. This end has no wall to cut a door into, so a casing
  // here would be an arch standing in open floor with nothing above it.
  function drawThreshold(p0, p1, colors) {
    const back = ROOM.tileH * 0.16;
    const shift = (p) => ({ x: p.x, y: p.y - back });
    paintQuad([p0, p1, shift(p1), shift(p0)], shade(colors.floorA, 14), 'rgba(0,0,0,0.35)', 1);
  }

  // Only one end of a hallway can meet a wall. Rooms are walled along their
  // two back edges and cut away along the two front ones, so a hallway leaves
  // its first room through that open front -- there is nothing there to hang
  // a door in -- and arrives at the far room through a real back wall, which
  // is where the casing belongs.
  function drawCorridorDoors(c, colors) {
    const near = corridorEnd(c, false);
    const far = corridorEnd(c, true);
    drawThreshold(near[0], near[1], colors);
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

    // The canvas no longer paints its own full-bleed rectangle: the stage
    // window carries the ground colour, the canvas fades to transparent at
    // its edges, and the two meet with no seam to see.
    if (stageScrollEl) stageScrollEl.style.background = colors.bg;
    drawAmbience(state.activeTheme);

    // Rooms and hallways go down in one back-to-front pass, ordered by how far
    // back their rear corner sits. Drawing all the hallways first instead
    // meant a room painted over the very wall joining it to its hallway,
    // because that wall stands on the room's own boundary.
    const rooms = activeRooms();
    const pieces = rooms.map((room, i) => ({
      depth: placements[i].gx0 + placements[i].gy0,
      draw: () => drawRoom(room.layout, colors, light, i),
    })).concat(corridors.map((c) => ({
      depth: c.gx0 + c.gy0,
      draw: () => drawCorridorShell(c, colors),
    })));
    if (preview) {
      pieces.push({
        depth: preview.gx0 + preview.gy0,
        draw: () => drawRoomPreview(preview, previewCorridor, colors, rooms.length),
      });
    }
    pieces.sort((a, b) => a.depth - b.depth).forEach((p) => p.draw());

    // Door casings go on last so they read as standing in the wall the room
    // just painted over the hallway's end, rather than behind it.
    corridors.forEach((c) => drawCorridorDoors(c, colors));

    const vignette = floorCtx.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.42, H * 0.72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    floorCtx.fillStyle = vignette;
    floorCtx.fillRect(0, 0, W, H);
  }

  // ---- Hover ----
  // A phone has no hover, so nothing on the plan says which tile a tap is
  // about to land on -- you find out by tapping. A mouse can say it up
  // front, and knowing where an armed piece is going is most of what makes
  // arranging a room with a pointer feel deliberate rather than approximate.
  let hoverCell = null;

  function drawHoverTile(quad, occupied) {
    // Amber to place, red to pack away, plain white when there is nothing
    // armed and the tile is empty -- the same colours those two actions use
    // everywhere else on the page.
    const placing = armedItemId && !occupied;
    const fill = occupied ? 'rgba(255,80,70,0.16)'
      : placing ? 'rgba(255,183,3,0.24)' : 'rgba(255,255,255,0.09)';
    const line = occupied ? 'rgba(255,120,110,0.9)'
      : placing ? 'rgba(255,183,3,0.95)' : 'rgba(255,255,255,0.55)';
    floorCtx.beginPath();
    floorCtx.moveTo(quad[0].x, quad[0].y);
    for (let i = 1; i < quad.length; i++) floorCtx.lineTo(quad[i].x, quad[i].y);
    floorCtx.closePath();
    floorCtx.fillStyle = fill;
    floorCtx.fill();
    floorCtx.strokeStyle = line;
    floorCtx.lineWidth = 1.8;
    floorCtx.stroke();
  }

  function drawRoom(layout, colors, light, roomIndex) {
    const theme = state.activeTheme;
    const place = placements[roomIndex];
    const shape = { cols: place.cols, rows: place.rows };

    const north = isoPoint(place.gx0, place.gy0);
    const east = isoPoint(place.gx0 + place.cols, place.gy0);
    const west = isoPoint(place.gx0, place.gy0 + place.rows);

    // Both back walls, as solids. The north corner they share gets its own
    // patch of ceiling so the two top faces mitre instead of leaving a notch,
    // and each wall caps off at the room's open corner, which is where you
    // see how thick it is.
    const depthNE = wallDepth('gx');
    const depthNW = wallDepth('gy');
    drawWallSlab(north, east, ROOM.wallH, depthNE, colors.wallR);
    drawWallSlab(north, west, ROOM.wallH, depthNW, colors.wallL);
    drawWallCorner(north, depthNE, depthNW, ROOM.wallH, colors.wallL);

    drawBaseboard(east, north);
    drawBaseboard(north, west);
    drawWallDecor(theme, north, east, west);
    drawRoomFittings(roomFitFor(roomIndex), north, east, west);

    const cells = cellsBackToFront(place);

    cells.forEach(({ gx, gy, rx, ry }) => {
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

      if (hoverCell && hoverCell.laneIndex === roomIndex
          && hoverCell.cellIndex === ry * shape.cols + rx) {
        drawHoverTile([p0, p1, p2, p3], layout[ry * shape.cols + rx]);
      }
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

  function sameCell(a, b) {
    return (!a && !b)
      || (!!a && !!b && a.laneIndex === b.laneIndex && a.cellIndex === b.cellIndex);
  }

  function setHoverCell(next) {
    if (sameCell(hoverCell, next)) return;
    hoverCell = next;
    // Only fires when the pointer crosses into a different tile, not on
    // every mouse move, so this is a handful of repaints a second at most.
    renderScene();
  }

  function restCursor() {
    gestureEl.style.cursor = hoverCell ? 'pointer' : 'grab';
  }

  gestureEl.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (dragState || pinchState) { setHoverCell(null); return; }
    const p = pointFromEvent(e);
    setHoverCell(gridCellFromPoint(p.x, p.y));
    restCursor();
  });

  gestureEl.addEventListener('pointerleave', () => {
    setHoverCell(null);
    restCursor();
  });

  gestureEl.addEventListener('pointerup', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchState = null;

    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const wasDrag = dragState.moved > DRAG_THRESHOLD;
    dragState = null;
    restCursor();
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
    restCursor();
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

  // The plot sign for the next room lights up once you can afford it, so the
  // scene has to be redrawn on the tick that crosses the price -- the loop
  // below otherwise only touches the HUD and the buttons.
  let couldAffordNextRoom = null;
  function nextRoomAffordable() {
    const rooms = activeRooms();
    if (rooms.length >= MAX_ROOMS_PER_THEME) return null;
    return state.balance >= ROOM_UNLOCK_COSTS[rooms.length];
  }

  setInterval(() => {
    state.balance += gps / (1000 / TICK_MS);
    state.lifetime += gps / (1000 / TICK_MS);
    refreshHud();
    refreshShopUI();
    refreshThemeRow();
    refreshRoomTabs();

    const affordable = nextRoomAffordable();
    if (affordable !== couldAffordNextRoom) {
      couldAffordNextRoom = affordable;
      renderScene();
    }
  }, TICK_MS);

  setInterval(() => {
    save();
    updateLeaderboardEntry();
  }, 5000);

  // The stage window is sized off the viewport on desktop, so dragging a
  // browser window between a laptop screen and a monitor changes how much
  // plan fits. renderScene() re-measures the window on every call (that is
  // what fitZoomToStage does), so a repaint is the whole fix -- debounced,
  // because a resize fires on every frame of the drag.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderScene, 120);
  });

  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
})();
