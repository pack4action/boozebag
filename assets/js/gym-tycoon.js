(function () {
  const hudTotal = document.getElementById('hud-total');
  if (!hudTotal) return;

  const SAVE_KEY = 'gymTycoonSave';
  const COST_GROWTH = 1.15;
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
    { id: 'gearfridge', name: 'Gear Fridge', baseCost: 600000, gps: 6000 },
    { id: 'soundsystem', name: 'Hype Sound System', baseCost: 2500000, gps: 25000 },
    // Office tier: hidden in the shop until the gym is established enough to
    // need one -- the "then you hire people" stage after the core equipment.
    { id: 'desk', name: 'Reception Desk', baseCost: 10000000, gps: 100000, unlockLevel: 6 },
    { id: 'cubicle', name: 'Sales Cubicle', baseCost: 40000000, gps: 400000, unlockLevel: 8 },
    { id: 'officepod', name: 'Corner Office Pod', baseCost: 160000000, gps: 1600000, unlockLevel: 10 },

    // Fittings. These earn nothing on their own -- what they do is make the
    // room somewhere people want to be, and a room people want to be in
    // works harder. Every one of them takes a slot a machine could have had,
    // which is the decision: floor space for a multiplier on the space that
    // is left.
    { id: 'palm', name: 'Potted Palm', baseCost: 900, vibe: 1, unlockLevel: 2 },
    { id: 'cooler', name: 'Water Cooler', baseCost: 7500, vibe: 2, unlockLevel: 3 },
    { id: 'mirrorwall', name: 'Mirror Wall', baseCost: 90000, vibe: 3, unlockLevel: 5 },
    { id: 'neon', name: 'Neon Sign', baseCost: 1200000, vibe: 5, unlockLevel: 7 },
  ];
  // Gains per second is the headline number on every piece of gear, and a
  // fitting has none. Rather than scatter `item.gps || 0` through the
  // earnings, the shop and the jobs, they are given a zero here.
  ITEMS.forEach((item) => { if (typeof item.gps !== 'number') item.gps = 0; });
  function isDecor(id) {
    const item = itemById(id);
    return !!(item && item.vibe);
  }

  // Three items used to be things you cannot actually stand on a gym floor:
  // a 10cm vial ("Steroid Cycle"), an entire second building ("Second
  // Location") and a whole room ("Manager's Office"). Each was swapped for a
  // real piece of furniture at the same price, gains/sec and category, and a
  // save from before the swap keeps the piece -- it just becomes the thing
  // that replaced it.
  const RENAMED_ITEMS = {
    gear: 'gearfridge',
    hq: 'soundsystem',
    manager: 'officepod',
  };

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
    gearfridge: '<rect x="5.5" y="2" width="13" height="8.6" rx="1.6"/><rect x="5.5" y="12" width="13" height="10" rx="1.6"/><rect x="3.4" y="4.6" width="1.8" height="4" rx="0.9"/><rect x="3.4" y="14.4" width="1.8" height="4.6" rx="0.9"/>',
    soundsystem: '<rect x="5.5" y="2" width="13" height="20" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="8.6" r="3.1"/><circle cx="12" cy="16.8" r="2"/>',
    desk: '<rect x="3" y="13.4" width="18" height="2.8" rx="1"/><rect x="5" y="16.2" width="2" height="5.4" rx="0.6"/><rect x="17" y="16.2" width="2" height="5.4" rx="0.6"/><rect x="9" y="5.4" width="6.4" height="6" rx="1"/><rect x="11.2" y="11.4" width="2" height="2.2"/>',
    cubicle: '<rect x="3" y="4" width="3" height="16.5" rx="0.8"/><rect x="3" y="4" width="14.5" height="3" rx="0.8"/><rect x="6" y="14.5" width="14.5" height="3" rx="1"/><rect x="15.3" y="8.2" width="5.2" height="5.2" rx="1"/>',
    officepod: '<rect x="3" y="4.2" width="18" height="15.6" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.9"/><rect x="12.6" y="6.8" width="6" height="10.4" rx="1.2"/><rect x="5.6" y="12.2" width="5.4" height="2" rx="0.7"/><rect x="6.4" y="14.2" width="1.5" height="3.2" rx="0.6"/>',
    palm: '<path d="M12 21V11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 11C9 11 6.4 9.2 5.2 6.4 8.2 5.6 11 7.2 12 10c1-2.8 3.8-4.4 6.8-3.6C17.6 9.2 15 11 12 11Z"/><path d="M7.5 21h9l-1 -4h-7Z"/>',
    cooler: '<rect x="8.2" y="1.6" width="7.6" height="7.4" rx="1.6"/><rect x="7" y="9" width="10" height="9.6" rx="1.4"/><rect x="8.6" y="18.6" width="6.8" height="3.4" rx="1"/><rect x="14.4" y="12.4" width="2.6" height="2.6" rx="0.7" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    mirrorwall: '<rect x="3.4" y="2.6" width="7.2" height="18.8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13.4" y="2.6" width="7.2" height="18.8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.4 17.4 8.8 6.2M15.4 17.4 18.8 6.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    neon: '<rect x="2.2" y="5" width="19.6" height="12.4" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 14V9.4l3.4 4.6V9.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15.6" cy="11.6" r="1.5"/><path d="M18.4 9.4v4.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    lock: '<path d="M7 10.4V7.2a5 5 0 0 1 10 0v3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="5" y="10.4" width="14" height="10" rx="2.2"/>',
  };
  function iconMarkup(id, sizePx) {
    const inner = ICON_PATHS[id] || '';
    const size = sizePx || 22;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + inner + '</svg>';
  }

  const THEMES = [
    { id: 'garage', name: 'Garage', unlockLevel: 1 },
    { id: 'basement', name: 'Basement', unlockLevel: 2 },
    { id: 'rooftop', name: 'Rooftop', unlockLevel: 4 },
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
  // The lattice is a fine grid the room is measured in, not the size of a
  // piece of gear. A tile is roughly a third of a metre, so a treadmill is
  // three tiles long and a room is dozens across -- which is what makes a
  // gym floor read as a floor with equipment standing about on it, rather
  // than a shelf with one item per compartment.
  const ROOM = { tileW: 32, tileH: 16, wallH: 100 };

  // Gear is drawn against this reference tile size, so its size on screen is
  // fixed no matter how fine the lattice under it gets. Shrinking the tile
  // to fit a bigger room must not shrink the equipment standing in it. What
  // each piece is scaled to from there is its own footprint -- see
  // propScaleFor.
  const PROP_TILE = 96;

  // Each theme builds to its own floor plan, because a unit, a cellar and a
  // roof are not the same shape of place. Rooms are not one bay stamped out
  // N times either: every position in a chain has its own footprint, and the
  // later ones are bigger, which is most of what they are bought for.
  //
  // The three chains come to 63, 63 and 65 slots, so no theme is a better
  // buy than another for the same run of prices -- what differs is the shape
  // of the space you are arranging gear in.
  const ROOM_PLANS = {
    // A row of vehicle bays down one unit: wide, shallow, side by side, with
    // just enough between them to walk through.
    garage: {
      shapes: [
        { cols: 18, rows: 7 },  // 12 pieces of gear -- the starter bay
        { cols: 21, rows: 7 },  // 14
        { cols: 24, rows: 7 },  // 16 -- the long bay
        { cols: 21, rows: 10 }, // 21 -- deep enough for two rows of kit
      ],
      caps: [12, 14, 16, 21],
      dirs: ['east', 'east', 'south'],
      corridorLen: 6,
      corridorWidth: 6,
    },
    // Cellar rooms: narrow, deep, and strung together by real tunnels that
    // turn corners rather than opening straight onto each other.
    basement: {
      shapes: [
        { cols: 10, rows: 13 }, // 12
        { cols: 10, rows: 16 }, // 15 -- the long cell
        { cols: 13, rows: 13 }, // 16
        { cols: 13, rows: 16 }, // 20
      ],
      caps: [12, 15, 16, 20],
      dirs: ['south', 'east', 'south'],
      corridorLen: 12,
      corridorWidth: 6,
    },
    // Open deck: broad platforms that spread across the roof, joined by
    // walkways wide enough to read as outdoors.
    rooftop: {
      shapes: [
        { cols: 13, rows: 10 }, // 12
        { cols: 16, rows: 10 }, // 15
        { cols: 19, rows: 10 }, // 18 -- the wide deck
        { cols: 16, rows: 13 }, // 20
      ],
      caps: [12, 15, 18, 20],
      dirs: ['east', 'south', 'west'],
      corridorLen: 9,
      corridorWidth: 9,
    },
  };

  function planFor(themeId) {
    return ROOM_PLANS[themeId] || ROOM_PLANS.garage;
  }
  function roomShapeFor(themeId, index) {
    const shapes = planFor(themeId).shapes;
    return shapes[index % shapes.length];
  }
  // How much a room holds, which is no longer the same question as how big
  // its floor is.
  function slotCountFor(themeId, index) {
    const caps = planFor(themeId).caps;
    return caps[index % caps.length];
  }

  // Tile rectangles for a chain of `count` rooms, each butted up against the
  // previous one with a corridor's worth of space between them and centred on
  // the shared edge.
  function roomDirFor(themeId, step) {
    const dirs = planFor(themeId).dirs;
    return dirs[step % dirs.length];
  }

  function roomPlacements(themeId, count) {
    const plan = planFor(themeId);
    const out = [];
    for (let i = 0; i < count; i++) {
      const shape = roomShapeFor(themeId, i);
      if (i === 0) {
        out.push({ gx0: 0, gy0: 0, cols: shape.cols, rows: shape.rows });
        continue;
      }
      const prev = out[i - 1];
      const dir = roomDirFor(themeId, i - 1);
      let gx0;
      let gy0;
      if (dir === 'east') {
        gx0 = prev.gx0 + prev.cols + plan.corridorLen;
        gy0 = prev.gy0 + Math.round((prev.rows - shape.rows) / 2);
      } else if (dir === 'west') {
        gx0 = prev.gx0 - plan.corridorLen - shape.cols;
        gy0 = prev.gy0 + Math.round((prev.rows - shape.rows) / 2);
      } else {
        gy0 = prev.gy0 + prev.rows + plan.corridorLen;
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
  function corridorBetween(themeId, a, b, dir) {
    const width = planFor(themeId).corridorWidth;
    if (dir === 'east' || dir === 'west') {
      const left = dir === 'east' ? a : b;
      const right = dir === 'east' ? b : a;
      // Run the hallway flush with the back of the rooms rather than centred
      // between them. Centred, its back wall sat a tile in front of theirs and
      // needed an odd stub of wall to reach back -- flush, the hallway wall
      // simply continues the room wall in one straight line.
      const lo = Math.max(a.gy0, b.gy0);
      const hi = Math.min(a.gy0 + a.rows, b.gy0 + b.rows);
      const gy0 = Math.min(lo, hi - width);
      return {
        // Which way the hallway runs. This used to be read back off the
        // rectangle as cols > rows, which is only true while a hallway is
        // longer than it is wide -- the garage's are 2x2 and the rooftop's
        // 3x3, and both were being drawn as though they ran the other way.
        axis: 'gx',
        gx0: left.gx0 + left.cols,
        gy0,
        cols: right.gx0 - (left.gx0 + left.cols),
        rows: width,
        doorRoom: right,
        doorWall: 'west',
        nearRoom: left,
      };
    }
    const top = dir === 'south' ? a : b;
    const bottom = dir === 'south' ? b : a;
    const lo = Math.max(a.gx0, b.gx0);
    const hi = Math.min(a.gx0 + a.cols, b.gx0 + b.cols);
    const gx0 = Math.min(lo, hi - width);
    return {
      axis: 'gy',
      gx0,
      gy0: top.gy0 + top.rows,
      cols: width,
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
    trainer: 'booster', gearfridge: 'booster', soundsystem: 'booster',
    desk: 'office', cubicle: 'office', officepod: 'office',
    palm: 'decor', cooler: 'decor', mirrorwall: 'decor', neon: 'decor',
  };
  const CATEGORY_META = {
    strength: { name: 'Strength', color: '#c0483a' },
    cardio: { name: 'Cardio', color: '#3fa0c9' },
    recovery: { name: 'Recovery', color: '#3fa87e' },
    booster: { name: 'Booster', color: '#d9a53f' },
    office: { name: 'Office', color: '#8a6fd1' },
    decor: { name: 'Fittings', color: '#4fc38a' },
  };
  const SAME_CATEGORY_BONUS = 0.12;
  const BOOSTER_NEARBY_BONUS = 0.20;

  function itemById(id) {
    return ITEMS.find((i) => i.id === id);
  }

  // ---- Levels ----
  // What the gym has been *built up to*, as opposed to what it happens to
  // have in the till. Money comes and goes -- you spend it the moment you
  // have it -- so gating anything on the balance meant the shop unlocked and
  // relocked as you bought things. Levels only ever go up, and they come from
  // the one thing that is unambiguously progress: kit bought and paid for.
  //
  // Each purchase is worth roughly the cube root of what it cost, so a tier
  // of gear ten times the price is worth about twice the experience -- enough
  // that better kit is the faster way up, not so much that the early game is
  // worth nothing.
  function xpForSpend(cost) {
    return Math.max(1, Math.round(Math.pow(Math.max(1, cost), 0.34)));
  }

  // Experience needed to have reached a level. Deliberately steep: the first
  // few come inside a couple of minutes, and the office tier is a session's
  // work away rather than a purchase away.
  function xpForLevel(level) {
    return level <= 1 ? 0 : Math.round(60 * Math.pow(level - 1, 1.85));
  }
  const MAX_LEVEL = 40;
  function levelFromXp(xp) {
    let level = 1;
    while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
    return level;
  }
  function currentLevel() {
    return levelFromXp(state.xp || 0);
  }
  // How far into the current level, 0..1, and the two ends of it -- what the
  // bar under the level badge is drawn from.
  function levelProgress() {
    const level = currentLevel();
    if (level >= MAX_LEVEL) return { level, from: 0, to: 0, frac: 1, capped: true };
    const from = xpForLevel(level);
    const to = xpForLevel(level + 1);
    return {
      level,
      from,
      to,
      frac: Math.max(0, Math.min(1, ((state.xp || 0) - from) / Math.max(1, to - from))),
      capped: false,
    };
  }
  function unlockedFor(thing) {
    return currentLevel() >= (thing.unlockLevel || 1);
  }

  // How much floor a piece takes up along its longest side, in metres, and
  // how big to draw it. They are the same number for a machine; they part
  // company for anything whose art is taller than the floor it stands on.
  // Both tables live with the rest of the drawing tables further down; these
  // are the readers everything else goes through.
  function footprintOf(id) {
    return ITEM_FOOTPRINT[id] || DEFAULT_FOOTPRINT;
  }
  function drawSizeOf(id) {
    return ITEM_DRAW_SIZE[id] || footprintOf(id);
  }

  // How finely a piece can be positioned. Five screen pixels, expressed in
  // tile units so it stays five pixels whatever the lattice is.
  const SPOT_STEP = 5 / ROOM.tileW;

  function snapSpot(u, v) {
    return {
      u: Math.round(u / SPOT_STEP) * SPOT_STEP,
      v: Math.round(v / SPOT_STEP) * SPOT_STEP,
    };
  }

  // A lattice tile is a third of a metre, so this converts the sizes that are
  // properly measured in metres -- how much room a piece needs, how close is
  // "next to", how near a tap has to land -- into lattice units.
  const TILES_PER_METRE = 3;

  // Keep a piece inside its room, clear of the walls by half its own width.
  function clampSpot(spot, shape, itemId) {
    const inset = (footprintOf(itemId) / 2) * TILES_PER_METRE;
    const lo = Math.min(inset, shape.cols / 2);
    const loV = Math.min(inset, shape.rows / 2);
    return {
      u: Math.max(lo, Math.min(shape.cols - lo, spot.u)),
      v: Math.max(loV, Math.min(shape.rows - loV, spot.v)),
    };
  }

  // Where a piece stands, in tile units from its room's back corner. Gear is
  // positioned freely now rather than dropped into a grid cell, so a room's
  // layout array says WHAT is in it and its spots array says WHERE.
  // Where a piece goes when nothing has said otherwise: laid out evenly
  // across the floor. This is what a save from before free placement gets,
  // and what newly bought gear gets -- the old rule put a piece in the
  // middle of the grid cell its slot index named, which on a floor three
  // times the size would file everything along the back wall.
  function defaultSpot(shape, index, cap) {
    const perRow = Math.max(1, Math.round(Math.sqrt(cap * shape.cols / shape.rows)));
    const rows = Math.max(1, Math.ceil(cap / perRow));
    const col = index % perRow;
    const row = Math.floor(index / perRow) % rows;
    return {
      u: ((col + 0.5) * shape.cols) / perRow,
      v: ((row + 0.5) * shape.rows) / rows,
    };
  }

  function spotOf(room, index, shape) {
    const s = room.spots && room.spots[index];
    if (s) return s;
    return defaultSpot(shape, index, room.layout.length);
  }

  // "Next to" is a distance now: close enough to be part of the same set-up,
  // about two metres between centres.
  const SYNERGY_REACH = 2.0 * TILES_PER_METRE;

  // Every piece's synergy multiplier in one pass, so neither the earnings
  // sum nor the draw loop has to re-walk the room for each piece.
  function synergyMultipliers(room, shape) {
    const layout = room.layout;
    const n = layout.length;
    const mult = new Array(n).fill(1);
    const at = new Array(n).fill(null);
    for (let i = 0; i < n; i++) if (layout[i]) at[i] = spotOf(room, i, shape);
    for (let i = 0; i < n; i++) {
      if (!layout[i]) continue;
      const cat = CATEGORY[layout[i]];
      for (let j = 0; j < n; j++) {
        if (j === i || !layout[j]) continue;
        if (Math.hypot(at[i].u - at[j].u, at[i].v - at[j].v) > SYNERGY_REACH) continue;
        const nCat = CATEGORY[layout[j]];
        if (nCat === cat) mult[i] += SAME_CATEGORY_BONUS;
        else if (nCat === 'booster') mult[i] += BOOSTER_NEARBY_BONUS;
      }
    }
    return mult;
  }

  // Per-slot multiplier from adjacent gear: +12% for each neighbor of the
  // same category, +20% for each neighboring booster (trainer/gear/hq) of
  // a *different* category. Two boosters next to each other just count as
  // a same-category match.


  // ---- Upgrades ----
  // A room has a fixed number of slots, so a gym that has filled its rooms
  // and bought every room it can has nowhere left to go: the shop still
  // sells things but there is nowhere to stand them. Upgrading fixes that.
  // It lifts every unit of a type at once, so it is worth more the more of
  // that type you have -- which makes the real question wide or tall. Wide
  // is more units and so more neighbours to earn synergy from; tall is
  // fewer, better ones. Slots are what make it a question at all.
  const MAX_TIER = 4;
  const TIER_STEP = 2.2;
  const TIER_NAMES = ['', 'Mk I', 'Mk II', 'Mk III', 'Mk IV'];
  const UPGRADE_MIN_LEVEL = 4;
  const UPGRADE_MIN_OWNED = 3;
  function tierOf(id) {
    return (state.tiers && state.tiers[id]) || 1;
  }
  function tierMultiplier(id) {
    return Math.pow(TIER_STEP, tierOf(id) - 1);
  }
  // What a piece earns as it stands, tier included. Everything that asks
  // what an item is worth goes through here rather than reading item.gps.
  function gpsOf(id) {
    const item = itemById(id);
    return item ? item.gps * tierMultiplier(id) : 0;
  }
  function upgradeCost(id) {
    const item = itemById(id);
    return Math.ceil(item.baseCost * 40 * Math.pow(3.2, tierOf(id) - 1));
  }
  function canUpgrade(id) {
    const item = itemById(id);
    return !!item && !item.vibe && tierOf(id) < MAX_TIER
      && currentLevel() >= UPGRADE_MIN_LEVEL
      && (state.owned[id] || 0) >= UPGRADE_MIN_OWNED;
  }
  function upgradeItem(id) {
    if (!canUpgrade(id)) return;
    const cost = upgradeCost(id);
    if (state.balance < cost) return;
    const before = currentLevel();
    state.balance -= cost;
    if (!state.tiers) state.tiers = {};
    state.tiers[id] = tierOf(id) + 1;
    state.xp = (state.xp || 0) + xpForSpend(cost);
    if (currentLevel() > before) announceLevel(currentLevel());
    else toast(itemById(id).name + ' upgraded to ' + TIER_NAMES[tierOf(id)], 'good');
    recomputeStats();
    refreshLevelUI();
    refreshShopUI();
    renderInventory();
    renderScene();
    save();
  }

  // ---- Franchising ----
  // The shop runs out. Once the office tier is bought there is nothing left
  // to spend money on but more of the same, and no reason to keep the tab
  // open. Franchising is the way out of that: cash the gym in for points
  // that multiply everything from then on, and build it back faster than it
  // went up the first time.
  //
  // It keeps levels and everything they unlocked. Relocking the Rooftop
  // would read as being punished for finishing, and starting over is
  // supposed to be the reward. What it does cost is real: every piece of
  // gear, every room past the first, and everyone on the payroll.
  const FRANCHISE_MIN_LIFETIME = 1e7;
  const FRANCHISE_PER_POINT = 0.15;
  function franchisePoints() {
    return (state.franchise && state.franchise.points) || 0;
  }
  function franchiseMultiplier() {
    return 1 + franchisePoints() * FRANCHISE_PER_POINT;
  }
  // What cashing in right now would be worth, over and above what has
  // already been banked from previous times.
  function franchiseOffer() {
    const earned = Math.floor(Math.pow(Math.max(0, state.lifetime) / FRANCHISE_MIN_LIFETIME, 0.4));
    return Math.max(0, earned - franchisePoints());
  }

  // ---- Staff ----
  // Everything in this game only ever went up: gear earns, fittings
  // multiply, rushes add. Nothing cost anything to keep. Staff are the other
  // side of that -- hired for cash, then paid a share of what the gym takes,
  // for as long as they work there.
  //
  // Each extra hire in a role is worth less than the one before while their
  // wage is exactly the same as the one before, so there is a point past
  // which the next hire costs more than they bring in. Finding it is the
  // decision; the panel shows both numbers so it is findable rather than
  // guessed at.
  const WAGE_SHARE_EACH = 0.03;
  // High enough that a badly overstaffed gym really is worse off than a
  // well-staffed one -- capped at 45% the wages could never catch the
  // bonuses, so hiring everybody was strictly correct and there was no
  // decision in it. Not 100%, because a gym earning literally nothing is a
  // dead end rather than a mistake, and staff can be let go anyway.
  const WAGE_SHARE_MAX = 0.8;
  const STAFF_FALLOFF = 0.75;
  const STAFF_ROLES = [
    {
      id: 'cleaner',
      name: 'Cleaner',
      baseCost: 60000,
      unlockLevel: 3,
      // Keeps every room nicer than it would otherwise be: vibe points on
      // top of the fittings, and so subject to the same ceiling.
      first: 2,
      note: (n) => '+' + staffEffect('cleaner', n).toFixed(1) + ' vibe in every room',
    },
    {
      id: 'receptionist',
      name: 'Receptionist',
      baseCost: 120000,
      unlockLevel: 5,
      // Works the front desk, so more of the rush actually gets through the
      // door: the peak bonus itself is bigger.
      first: 0.3,
      note: (n) => 'rush bonus +' + Math.round(staffEffect('receptionist', n) * 100) + '% bigger',
    },
    {
      id: 'manager',
      name: 'Floor Manager',
      baseCost: 250000,
      unlockLevel: 7,
      first: 0.18,
      note: (n) => '+' + Math.round(staffEffect('manager', n) * 100) + '% on everything',
    },
  ];
  function staffRole(id) {
    return STAFF_ROLES.find((r) => r.id === id);
  }
  function staffCount(id) {
    return (state.staff && state.staff[id]) || 0;
  }
  function staffTotal() {
    return STAFF_ROLES.reduce((sum, r) => sum + staffCount(r.id), 0);
  }
  // What n of a role are worth together: the first is worth `first`, and each
  // one after that three quarters of the one before.
  function staffEffect(id, n) {
    const role = staffRole(id);
    const count = n === undefined ? staffCount(id) : n;
    let total = 0;
    for (let i = 0; i < count; i++) total += role.first * Math.pow(STAFF_FALLOFF, i);
    return total;
  }
  function staffHireCost(id) {
    const role = staffRole(id);
    return Math.ceil(role.baseCost * Math.pow(1.6, staffCount(id)));
  }
  // The whole wage bill as a share of what the gym takes. Capped, so however
  // badly a gym is overstaffed it still earns something -- a tycoon game that
  // can be driven to zero income by buying things is a trap, not a decision.
  function wageShare() {
    return Math.min(WAGE_SHARE_MAX, staffTotal() * WAGE_SHARE_EACH);
  }

  // ---- Rush hours ----
  // A gym is heaving at eight in the morning and at six in the evening, and
  // empty at three. The clock the curve reads is the player's own, so the
  // place is busy when their gym would be.
  //
  // A rush is a bonus and never a penalty: a quiet hour earns exactly what
  // the gym has always earned, and peak earns more. Punishing somebody for
  // playing at midnight would be a strange thing to build.
  //
  // Crucially the economy reads this curve and not the figures walking
  // around, which are switched off entirely for anyone who has asked for
  // less motion. Earnings cannot depend on something that is not always
  // there.
  const RUSH_BONUS = 0.35;
  // How busy each hour of the day is, 0 to 1, read at the hour and
  // interpolated between -- so the gym fills up and empties out rather than
  // stepping between states on the hour.
  const RUSH_BY_HOUR = [
    0.05, 0.02, 0.00, 0.00, 0.02, 0.15,   // 00-05 dead
    0.55, 0.90, 1.00, 0.70, 0.40, 0.35,   // 06-11 the morning rush
    0.50, 0.45, 0.35, 0.40, 0.65, 0.95,   // 12-17 lunch, then it builds
    1.00, 0.85, 0.60, 0.40, 0.25, 0.12,   // 18-23 the evening rush
  ];
  function rushFactor(now) {
    const d = now || new Date();
    const at = d.getHours() + d.getMinutes() / 60;
    const lo = Math.floor(at) % 24;
    const hi = (lo + 1) % 24;
    const t = at - Math.floor(at);
    return RUSH_BY_HOUR[lo] * (1 - t) + RUSH_BY_HOUR[hi] * t;
  }
  function rushMultiplier() {
    return 1 + RUSH_BONUS * (1 + staffEffect('receptionist')) * rushFactor();
  }
  // The light outside, by the hour. A room is lit by its own fittings, so
  // this is a wash laid over the finished plan rather than a change to any
  // material in it -- cold and dim in the small hours, warm at the ends of
  // the day, and nothing at all at midday when the light is just light.
  const SKY_BY_HOUR = [
    [30, 48, 96, 0.34], [30, 48, 96, 0.34], [30, 48, 96, 0.34],  // 00-02
    [30, 48, 96, 0.32], [36, 54, 100, 0.28], [90, 74, 108, 0.20], // 03-05
    [180, 118, 86, 0.15], [214, 150, 96, 0.10], [220, 176, 120, 0.05], // 06-08
    [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],                     // 09-11
    [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],                     // 12-14
    [0, 0, 0, 0], [216, 168, 112, 0.06], [214, 138, 88, 0.13],    // 15-17
    [176, 102, 84, 0.16], [110, 78, 112, 0.20], [58, 62, 112, 0.26], // 18-20
    [38, 52, 100, 0.30], [30, 48, 96, 0.33], [30, 48, 96, 0.34],  // 21-23
  ];
  function skyWash(now) {
    const d = now || new Date();
    const at = d.getHours() + d.getMinutes() / 60;
    const lo = Math.floor(at) % 24;
    const hi = (lo + 1) % 24;
    const t = at - Math.floor(at);
    const a = SKY_BY_HOUR[lo];
    const b = SKY_BY_HOUR[hi];
    const mix = (i) => a[i] * (1 - t) + b[i] * t;
    return { r: Math.round(mix(0)), g: Math.round(mix(1)), b: Math.round(mix(2)), a: mix(3) };
  }
  // How much the fittings have to do. Their glow is turned up after dark and
  // down in the middle of the day, which is the other half of the same idea.
  function lampBoost() {
    return 0.75 + 0.55 * (skyWash().a / 0.34);
  }

  function rushLabel() {
    const f = rushFactor();
    if (f >= 0.8) return 'Peak hours';
    if (f >= 0.45) return 'Busy';
    if (f >= 0.18) return 'Ticking over';
    return 'Quiet';
  }

  // ---- Vibe ----
  // What the fittings in a room add up to, and what that is worth. Each
  // point is a few percent on everything the room earns, up to a ceiling --
  // without one the best floor plan would be a room of plants around a
  // single treadmill, which is not a gym.
  const VIBE_PER_POINT = 0.03;
  const VIBE_MAX_POINTS = 12;
  function roomVibe(room) {
    return room.layout.reduce((sum, id) => {
      const item = id && itemById(id);
      return sum + (item && item.vibe ? item.vibe : 0);
    }, 0);
  }
  function vibeMultiplier(room) {
    const points = roomVibe(room) + staffEffect('cleaner');
    return 1 + Math.min(VIBE_MAX_POINTS, points) * VIBE_PER_POINT;
  }

  // Gains/sec now comes entirely from what's placed in the room, not from
  // raw ownership -- gear sitting unplaced in inventory earns nothing.
  // Synergy is computed per-room: adjacency only matters within the same
  // grid, so equipment in different rooms never interacts.
  function computeGps(room, shape) {
    const mult = synergyMultipliers(room, shape);
    let total = 0;
    room.layout.forEach((itemId, index) => {
      if (!itemId) return;
      total += gpsOf(itemId) * mult[index];
    });
    // Net, not gross: the wage bill comes off every figure the game shows,
    // so the rate in the HUD is the rate the balance actually climbs at.
    return total * vibeMultiplier(room) * rushMultiplier()
      * (1 + staffEffect('manager')) * franchiseMultiplier() * (1 - wageShare());
  }

  // Total across every room in every theme's chain -- gear earns
  // regardless of which theme/room is currently in view. Each room is scored
  // against its own footprint, since that decides which slots are neighbours.
  function computeTotalGps(themeRooms) {
    return THEMES.reduce((sum, t) => (
      sum + (themeRooms[t.id] || []).reduce(
        (s2, room, i) => s2 + computeGps(room, roomShapeFor(t.id, i)), 0)
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

  function emptyGymRoom(themeId, index) {
    const n = slotCountFor(themeId, index);
    return { layout: new Array(n).fill(null), spots: new Array(n).fill(null) };
  }

  function defaultThemeRooms() {
    const byTheme = {};
    THEMES.forEach((t) => { byTheme[t.id] = [emptyGymRoom(t.id, 0)]; });
    return byTheme;
  }

  // Resizes each saved room to the footprint its position now calls for.
  // Every footprint holds at least the 12 slots rooms used to have, so a save
  // written before rooms varied in size only ever gains slots, never drops
  // gear off the end.
  function normalizedRoomChain(themeId, source) {
    const arr = Array.isArray(source) ? source : [];
    const rooms = arr.slice(0, MAX_ROOMS_PER_THEME).map((r, i) => {
      const old = Array.isArray(r && r.layout) ? r.layout : [];
      const oldSpots = Array.isArray(r && r.spots) ? r.spots : [];
      const n = slotCountFor(themeId, i);
      return {
        layout: new Array(n).fill(null).map((_, k) => old[k] || null),
        // Positions travel with the pieces. A save from before free
        // placement has none, and spotOf falls back to the middle of the
        // grid cell the slot index used to mean -- which is exactly where
        // that piece was standing.
        spots: new Array(n).fill(null).map((_, k) => {
          const sp = oldSpots[k];
          return sp && typeof sp.u === 'number' && typeof sp.v === 'number'
            ? { u: sp.u, v: sp.v } : null;
        }),
      };
    });
    return rooms.length ? rooms : [emptyGymRoom(themeId, 0)];
  }

  // ---- Persistence ----
  function defaultState() {
    return {
      balance: 0,
      lifetime: 0,
      xp: 0,
      tiers: {},
      jobs: [],
      staff: {},
      franchise: { points: 0, runs: 0 },
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
        byTheme[t.id] = normalizedRoomChain(t.id, saved.rooms.map((r) => ({
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
      byTheme[theme] = [{ layout: new Array(slotCountFor(theme, 0)).fill(null).map((_, i) => saved.layout[i] || null) }];
      s.themeRooms = byTheme;
      s.activeTheme = theme;
      s.activeRoomIndex = 0;
    } else {
      const byTheme = {};
      THEMES.forEach((t) => {
        byTheme[t.id] = normalizedRoomChain(t.id, saved.themeRooms && saved.themeRooms[t.id]);
      });
      s.themeRooms = byTheme;
    }

    if (!THEMES.some((t) => t.id === s.activeTheme)) s.activeTheme = 'garage';
    const activeChain = s.themeRooms[s.activeTheme] || [];
    s.activeRoomIndex = Number.isInteger(s.activeRoomIndex) && s.activeRoomIndex >= 0 && s.activeRoomIndex < activeChain.length
      ? s.activeRoomIndex
      : 0;

    // A save from before levels existed has no experience on it, and
    // starting everyone back at level one would take the themes and the
    // office tier off people who had already earned them. So it is worked
    // out from what they have: every piece they own is worth what buying it
    // was worth, and as a floor, whatever their lifetime earnings would have
    // unlocked under the old money gates -- an idler who banked rather than
    // spent keeps what they had.
    // Asked of the save as it was read, not of `s`: defaultState has already
    // put a zero there, so `s.xp` is a number either way and cannot tell a
    // save from before levels apart from one that has genuinely earned none.
    if (typeof saved.xp !== 'number' || !isFinite(saved.xp)) {
      const fromOwned = ITEMS.reduce(
        (sum, item) => sum + (s.owned[item.id] || 0) * xpForSpend(item.baseCost), 0);
      const fromLifetime = Math.round(16.5 * Math.pow(Math.max(0, s.lifetime), 0.306));
      s.xp = Math.max(fromOwned, fromLifetime);
    }

    // Carry saves across the item swap (see RENAMED_ITEMS): a Steroid Cycle
    // in the inventory becomes a Gear Fridge, one standing in a room becomes
    // a Gear Fridge standing in the same spot. Counts are added rather than
    // overwritten, in case a save somehow holds both the old id and its
    // replacement.
    const ownedById = {};
    Object.keys(s.owned).forEach((id) => {
      const to = RENAMED_ITEMS[id] || id;
      ownedById[to] = (ownedById[to] || 0) + (s.owned[id] || 0);
    });
    s.owned = ownedById;
    THEMES.forEach((t) => {
      (s.themeRooms[t.id] || []).forEach((room) => {
        room.layout = room.layout.map((id) => (id && RENAMED_ITEMS[id]) || id);
      });
    });

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

    // Nothing is credited for the time the tab was gone: gear earns while
    // you are watching it and not otherwise. lastSaved is still written --
    // it dates the save -- it just no longer buys anything.
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

  // ---- Jobs ----
  // Three standing requests at a time, each one a thing the gym could be
  // doing better, with the money and experience for doing it stated up
  // front. An idle game without them is a game about waiting; with them
  // there is always something specific to go and do, and the something is
  // usually the thing that teaches how the game works -- arrange for
  // synergy, fill a room, get a category onto the floor.
  const JOBS_ON_BOARD = 3;

  function allRoomsEverywhere() {
    return THEMES.reduce((list, t) => list.concat(state.themeRooms[t.id] || []), []);
  }

  // One pass over every room in every theme: what is standing on the floors,
  // by piece and by category, and the best synergy multiplier going.
  function floorTally() {
    const byItem = {};
    const byCat = {};
    let placed = 0;
    let fullRoom = 0;
    let bestSynergy = 1;
    let bestVibe = 0;
    THEMES.forEach((t) => {
      (state.themeRooms[t.id] || []).forEach((room, i) => {
        const shape = roomShapeFor(t.id, i);
        const mult = synergyMultipliers(room, shape);
        let here = 0;
        room.layout.forEach((id, k) => {
          if (!id) return;
          here++;
          placed++;
          byItem[id] = (byItem[id] || 0) + 1;
          byCat[CATEGORY[id]] = (byCat[CATEGORY[id]] || 0) + 1;
          if (mult[k] > bestSynergy) bestSynergy = mult[k];
        });
        if (here > 0 && here === room.layout.length) fullRoom = 1;
        bestVibe = Math.max(bestVibe, Math.round((vibeMultiplier(room) - 1) * 100));
      });
    });
    return { byItem, byCat, placed, fullRoom, bestSynergy, bestVibe };
  }

  // Each kind knows how to phrase itself, how far along it is, and what
  // counts as done. Targets are worked out against the gym as it stands when
  // the job is written, so a job is always a step past where you already are.
  const JOB_KINDS = {
    placeItem: {
      pick(ctx) {
        const item = pickOf(ctx.pool);
        const now = ctx.tally.byItem[item.id] || 0;
        return { item: item.id, target: now + 1 + Math.floor(Math.random() * 2) };
      },
      text: (j) => 'Get ' + j.target + ' x ' + itemById(j.item).name + ' onto the floor',
      done: (j, tally) => tally.byItem[j.item] || 0,
    },
    ownItem: {
      pick(ctx) {
        const item = pickOf(ctx.pool);
        const now = state.owned[item.id] || 0;
        return { item: item.id, target: now + 2 + Math.floor(Math.random() * 3) };
      },
      text: (j) => 'Own ' + j.target + ' x ' + itemById(j.item).name,
      done: (j) => state.owned[j.item] || 0,
    },
    placeCategory: {
      pick(ctx) {
        const cat = pickOf(ctx.cats);
        const now = ctx.tally.byCat[cat] || 0;
        return { cat, target: now + 2 + Math.floor(Math.random() * 3) };
      },
      text: (j) => 'Have ' + j.target + ' ' + CATEGORY_META[j.cat].name.toLowerCase()
        + ' pieces on the floor at once',
      done: (j, tally) => tally.byCat[j.cat] || 0,
    },
    gps: {
      pick() {
        const now = Math.max(1, gps);
        return { target: Math.ceil(now * (1.5 + Math.random() * 0.8)) };
      },
      text: (j) => 'Reach ' + formatNum(j.target) + ' gains/sec',
      done: () => gps,
    },
    fillRoom: {
      pick: () => ({ target: 1 }),
      text: () => 'Fill every slot in one room',
      done: (j, tally) => tally.fullRoom,
    },
    vibe: {
      pick(ctx) {
        const now = ctx.tally.bestVibe;
        const step = Math.round(VIBE_PER_POINT * 100) * 2;
        return { target: Math.min(Math.round(VIBE_MAX_POINTS * VIBE_PER_POINT * 100),
          Math.max(step, Math.ceil((now + step) / step) * step)) };
      },
      text: (j) => 'Fit out one room to a +' + j.target + '% vibe',
      done: (j, tally) => tally.bestVibe,
    },
    synergy: {
      pick(ctx) {
        const now = Math.round((ctx.tally.bestSynergy - 1) * 100);
        return { target: Math.max(24, Math.round((now + 12) / 12) * 12) };
      },
      text: (j) => 'Get one piece earning a +' + j.target + '% synergy bonus',
      done: (j, tally) => Math.round((tally.bestSynergy - 1) * 100),
    },
  };

  // Which kinds are worth asking for right now. There is no point asking a
  // player with one empty starter room to fill a room, or asking for synergy
  // before there are two pieces to stand next to each other.
  function jobKindsAvailable(tally) {
    const kinds = ['ownItem', 'gps'];
    if (tally.placed > 0) kinds.push('placeItem', 'placeCategory');
    if (tally.placed >= 4) kinds.push('synergy');
    // Only worth asking once there is a fitting to buy that would move it.
    if (ITEMS.some((i) => i.vibe && unlockedFor(i))) kinds.push('vibe');
    if (tally.placed >= 6 && !tally.fullRoom) kinds.push('fillRoom');
    return kinds;
  }

  function makeJob(mult, avoidKinds) {
    const tally = floorTally();
    const level = currentLevel();
    const affordable = ITEMS.filter((i) => unlockedFor(i));
    const owned = affordable.filter((i) => (state.owned[i.id] || 0) > 0);
    // Weighted to the better half of what they own -- ITEMS runs cheapest
    // first, so this is the dearer end. Otherwise a gym full of saunas keeps
    // being asked to buy two more dumbbells, which is no kind of job.
    const pool = owned.length
      ? owned.slice(-Math.max(1, Math.ceil(owned.length / 2)))
      : affordable.slice(0, 3);
    const ctx = {
      tally,
      pool,
      cats: [...new Set(pool.map((i) => CATEGORY[i.id]))],
    };
    let choices = jobKindsAvailable(tally).filter((k) => avoidKinds.indexOf(k) === -1);
    if (!choices.length) choices = jobKindsAvailable(tally);
    const kind = pickOf(choices);
    const job = Object.assign({ kind }, JOB_KINDS[kind].pick(ctx));
    // Stated when the job is written, not when it is handed in, so the board
    // can say what a job is worth before you decide to go and do it.
    job.cash = Math.max(150, Math.round(gps * 45 * mult));
    job.xp = Math.round(16 * mult * (1 + level * 0.12));
    return job;
  }

  function refillJobs() {
    if (!Array.isArray(state.jobs)) state.jobs = [];
    state.jobs = state.jobs.filter((j) => j && JOB_KINDS[j.kind]);
    const weights = [1, 1.7, 2.6];
    while (state.jobs.length < JOBS_ON_BOARD) {
      state.jobs.push(makeJob(weights[state.jobs.length] || 1,
        state.jobs.map((j) => j.kind)));
    }
  }

  function jobProgress(job, tally) {
    const kind = JOB_KINDS[job.kind];
    const at = Math.max(0, kind.done(job, tally));
    return { at, target: job.target, ready: at >= job.target };
  }

  // ---- Members ----
  // The people using the place. They earn nothing -- what a room makes is
  // decided entirely by the gear standing in it -- they are what makes a gym
  // read as a gym rather than a showroom of equipment nobody has touched.
  // Each one walks to a piece of kit, uses it for a while, and moves on.
  const MEMBER_SHIRTS = ['#4a5ec8', '#c0483a', '#3fa87e', '#c98a4a', '#7a5ac9', '#3f9ec9'];
  const MEMBER_SKINS = ['#efc39c', '#d59a6c', '#a06a44', '#7a4a2c', '#f3d3b4'];
  const MEMBER_HAIR = ['#2b2119', '#4a3524', '#8a6a3a', '#1c1c20', '#6b3a24'];
  const MEMBER_WALK = 1.15 * TILES_PER_METRE;   // tiles a second, a gym walk
  // Roughly two members for every three pieces of kit, so a room fills up as
  // it is fitted out, with a ceiling so a big room does not turn into a
  // crowd scene that costs more to draw than it is worth.
  const MEMBERS_PER_PIECE = 0.66;
  const MAX_MEMBERS_PER_ROOM = 6;

  let members = [];
  let membersKey = '';

  // The crowd is decoration, and it is decoration made entirely of movement,
  // so someone who has asked their system for less of that gets the gym
  // without it rather than a room of people frozen mid-stride.
  const stillness = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function wantsStillness() {
    return !!(stillness && stillness.matches);
  }
  if (stillness && stillness.addEventListener) {
    stillness.addEventListener('change', () => {
      membersKey = '';
      renderScene();
    });
  }

  function pickOf(list) {
    return list[Math.floor(Math.random() * list.length)];
  }
  function clampTo(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // Staff on the floor wear the same shirt as each other, so a room full of
  // members reads as members with a couple of staff in it rather than as a
  // crowd of strangers.
  const STAFF_SHIRT = '#1f2a44';
  const STAFF_TRIM = '#e8c46a';

  function spawnMember(room, place, staffRoleId) {
    return {
      // Where a member is, is a point on the world lattice, not a point in
      // some room -- they walk out of one room, down a hallway and into the
      // next, and none of that has room-local coordinates that mean anything.
      room,
      gx: place.gx0 + 0.8 + Math.random() * Math.max(0.1, place.cols - 1.6),
      gy: place.gy0 + 0.8 + Math.random() * Math.max(0.1, place.rows - 1.6),
      path: [],
      gear: null,
      state: 'idle',
      timer: 0,
      phase: Math.random() * Math.PI * 2,
      facing: 1,
      staffRole: staffRoleId || null,
      shirt: staffRoleId ? STAFF_SHIRT : pickOf(MEMBER_SHIRTS),
      skin: pickOf(MEMBER_SKINS),
      hair: pickOf(MEMBER_HAIR),
      speed: MEMBER_WALK * (staffRoleId ? 0.75 : 0.85 + Math.random() * 0.35),
    };
  }

  // Rebuilt only when the crowd it was built for has changed -- a different
  // theme, or a room that has gained or lost something. Members already in a
  // room are kept exactly where they are, so buying something in one room
  // does not teleport everybody in the others.
  function rebuildMembers() {
    const rooms = activeRooms();
    const key = wantsStillness() ? 'still' : state.activeTheme + '|' + staffTotal() + '|'
      + rooms.map((r) => r.layout.filter(Boolean).length + '.' + roomVibe(r)).join(',');
    if (key === membersKey) return;
    membersKey = key;
    if (key === 'still') {
      members = [];
      return;
    }
    const next = [];
    rooms.forEach((room, roomIndex) => {
      const place = placements[roomIndex];
      if (!place) return;
      const placed = room.layout.filter(Boolean).length;
      // A room people want to be in has more people in it, so the fittings
      // show up in the crowd as well as in the takings.
      const draw = placed * MEMBERS_PER_PIECE * vibeMultiplier(room)
        * (0.55 + 0.75 * rushFactor());
      const want = placed === 0 ? 0
        : Math.max(1, Math.min(MAX_MEMBERS_PER_ROOM, Math.round(draw)));
      const here = members.filter((m) => m.room === roomIndex && !m.staffRole).slice(0, want);
      while (here.length < want) here.push(spawnMember(roomIndex, place));
      next.push(...here);
    });

    // Staff are spread across the rooms that are actually open, one room at
    // a time, so a gym with three rooms and two staff has one of them in two
    // of the rooms rather than both stood in the first.
    const open = rooms.map((r, i) => i).filter((i) => placements[i]);
    let slot = 0;
    STAFF_ROLES.forEach((role) => {
      const kept = members.filter((m) => m.staffRole === role.id);
      for (let k = 0; k < staffCount(role.id); k++) {
        const roomIndex = open[slot++ % Math.max(1, open.length)];
        if (placements[roomIndex] === undefined) continue;
        next.push(kept[k] || spawnMember(roomIndex, placements[roomIndex], role.id));
      }
    });
    members = next;
  }

  // The two ends of a hallway, a little way inside it, in the order they are
  // walked. Down the middle, because that is where the doorway at each end
  // is: the casing is drawn across the middle of the mouth, not the whole of
  // it, so anything walking along an edge would go through the wall beside it.
  function corridorWaypoints(c, forward) {
    if (c.axis === 'gx') {
      const midGy = c.gy0 + c.rows / 2;
      const near = { gx: c.gx0 + 0.5, gy: midGy };
      const far = { gx: c.gx0 + c.cols - 0.5, gy: midGy };
      return forward ? [near, far] : [far, near];
    }
    const midGx = c.gx0 + c.cols / 2;
    const near = { gx: midGx, gy: c.gy0 + 0.5 };
    const far = { gx: midGx, gy: c.gy0 + c.rows - 0.5 };
    return forward ? [near, far] : [far, near];
  }

  // Where a member goes next: a free piece of gear most of the time, now and
  // then somewhere else on the floor so the room is not a queueing system,
  // and now and then the room next door, which means a walk down the hallway
  // to get there.
  const MEMBER_ROAM_CHANCE = 0.16;
  function chooseTarget(m) {
    const rooms = activeRooms();
    let dest = m.room;
    if (rooms.length > 1 && Math.random() < MEMBER_ROAM_CHANCE) {
      const step = Math.random() < 0.5 ? -1 : 1;
      const tryRoom = m.room + step;
      if (tryRoom >= 0 && tryRoom < rooms.length) dest = tryRoom;
    }
    const room = rooms[dest];
    const place = placements[dest];
    if (!room || !place) {
      m.state = 'idle';
      return;
    }

    const free = [];
    room.layout.forEach((id, i) => {
      // Fittings are scenery: nobody queues to use a pot plant.
      if (!id || isDecor(id)) return;
      const taken = members.some((o) => o !== m && o.room === dest && o.gear === i);
      if (!taken) free.push(i);
    });

    let goal;
    if (free.length && Math.random() < 0.82) {
      const i = pickOf(free);
      const spot = spotOf(room, i, { cols: place.cols, rows: place.rows });
      // Stand in front of the piece rather than inside it: clear of its own
      // footprint, and toward the viewer so the gear is not hidden.
      const clear = (footprintOf(room.layout[i]) / 2 + 0.4) * TILES_PER_METRE;
      m.gear = i;
      goal = {
        gx: place.gx0 + clampTo(spot.u + clear * 0.5, 0.6, Math.max(0.6, place.cols - 0.6)),
        gy: place.gy0 + clampTo(spot.v + clear * 0.8, 0.6, Math.max(0.6, place.rows - 0.6)),
      };
    } else {
      m.gear = null;
      goal = {
        gx: place.gx0 + 0.8 + Math.random() * Math.max(0.1, place.cols - 1.6),
        gy: place.gy0 + 0.8 + Math.random() * Math.max(0.1, place.rows - 1.6),
      };
    }

    if (dest === m.room) {
      m.path = [goal];
    } else {
      // corridors[i] joins rooms i and i+1, and always runs from its nearRoom
      // to its doorRoom -- which of those is the room being left decides
      // which way down it this member is walking.
      const c = corridors[Math.min(m.room, dest)];
      if (!c) {
        m.path = [goal];
      } else {
        m.path = corridorWaypoints(c, placements[m.room] === c.nearRoom).concat([goal]);
        m.room = dest;
      }
    }
    m.state = 'walking';
  }

  function stepMembers(dt) {
    const rooms = activeRooms();
    members.forEach((m) => {
      const room = rooms[m.room];
      if (!room) return;

      if (m.state === 'using') {
        m.timer -= dt;
        m.phase += dt * 5.5;
        // The piece they were using can be picked up out from under them.
        if (m.timer <= 0 || !room.layout[m.gear]) m.state = 'idle';
        return;
      }
      if (m.state === 'idle') {
        chooseTarget(m);
        return;
      }

      const goal = m.path[0];
      if (!goal) {
        m.state = 'idle';
        return;
      }
      const dx = goal.gx - m.gx;
      const dy = goal.gy - m.gy;
      const dist = Math.hypot(dx, dy);
      const step = m.speed * dt;
      m.phase += dt * 7.5;
      if (dist <= step || dist === 0) {
        m.gx = goal.gx;
        m.gy = goal.gy;
        m.path.shift();
        if (m.path.length) return;
        m.state = m.gear === null ? 'idle' : 'using';
        m.timer = 3.5 + Math.random() * 7;
        return;
      }
      m.gx += (dx / dist) * step;
      m.gy += (dy / dist) * step;
      // Which way they face on screen: +gx and -gy both read as rightward.
      const screenward = dx - dy;
      if (Math.abs(screenward) > 0.0001) m.facing = screenward > 0 ? 1 : -1;
    });
  }

  // Whoever is standing inside this rectangle right now, wherever they call
  // home -- a member halfway down a hallway is drawn by the hallway.
  function membersInside(rect) {
    return members.filter((m) => m.gx >= rect.gx0 && m.gx < rect.gx0 + rect.cols
      && m.gy >= rect.gy0 && m.gy < rect.gy0 + rect.rows);
  }

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
  const levelWrapEl = document.querySelector('.hud-level');
  const levelValueEl = document.getElementById('hud-level');
  const xpFillEl = document.getElementById('hud-xp-fill');
  const xpTextEl = document.getElementById('hud-xp-text');
  function refreshLevelUI() {
    if (!levelValueEl) return;
    const p = levelProgress();
    levelValueEl.textContent = p.level;
    levelWrapEl.classList.toggle('is-capped', p.capped);
    xpFillEl.style.width = (p.frac * 100).toFixed(1) + '%';
    xpTextEl.textContent = p.capped
      ? formatNum(Math.floor(state.xp || 0)) + ' XP'
      : formatNum(Math.floor((state.xp || 0) - p.from)) + ' / ' + formatNum(p.to - p.from) + ' XP';
  }

  // What this level just opened up, so a level-up says something more useful
  // than a bigger number.
  function announceLevel(level) {
    const opened = ITEMS.filter((i) => i.unlockLevel === level).map((i) => i.name)
      .concat(THEMES.filter((t) => t.unlockLevel === level).map((t) => t.name));
    toast(opened.length
      ? 'Level ' + level + ' -- ' + opened.join(' and ') + ' unlocked'
      : 'Level ' + level, 'good');
    if (!levelWrapEl) return;
    levelWrapEl.classList.remove('is-up');
    // Reading the layout back forces the animation to start over rather than
    // being skipped as a class that never actually changed.
    void levelWrapEl.offsetWidth;
    levelWrapEl.classList.add('is-up');
  }

  // ---- The board ----
  // Rebuilt from scratch only when the set of jobs changes; the progress on
  // them is written straight into the existing rows, because that is updated
  // several times a second and rebuilding three rows of DOM that often is
  // both wasteful and enough to kill a click landing on a Claim button.
  const jobsListEl = document.getElementById('jobs-list');
  let jobRowEls = [];
  let jobsSignature = '';

  function buildJobsUI() {
    if (!jobsListEl) return;
    jobsListEl.innerHTML = '';
    jobRowEls = state.jobs.map((job, index) => {
      const row = document.createElement('div');
      row.className = 'tycoon-job';
      row.innerHTML =
        '<span class="tycoon-job-text"></span>'
        + '<span class="tycoon-job-bar"><span class="tycoon-job-fill"></span></span>'
        + '<span class="tycoon-job-foot">'
          + '<span class="tycoon-job-meta"></span>'
          + '<button class="tycoon-job-claim" type="button" disabled>Claim</button>'
        + '</span>';
      const claim = row.querySelector('.tycoon-job-claim');
      claim.addEventListener('click', () => claimJob(index));
      jobsListEl.appendChild(row);
      return {
        root: row,
        text: row.querySelector('.tycoon-job-text'),
        fill: row.querySelector('.tycoon-job-fill'),
        meta: row.querySelector('.tycoon-job-meta'),
        claim,
        last: null,
      };
    });
  }

  function refreshJobsUI() {
    if (!jobsListEl) return;
    const signature = state.jobs.map((j) => j.kind + ':' + j.target + ':' + (j.item || j.cat || '')).join('|');
    if (signature !== jobsSignature) {
      jobsSignature = signature;
      buildJobsUI();
    }
    const tally = floorTally();
    state.jobs.forEach((job, i) => {
      const els = jobRowEls[i];
      if (!els) return;
      const p = jobProgress(job, tally);
      const shown = Math.min(p.at, p.target);
      const stamp = shown + '/' + p.target + (p.ready ? '!' : '');
      if (els.last === stamp) return;
      els.last = stamp;
      els.text.textContent = JOB_KINDS[job.kind].text(job);
      els.fill.style.width = ((shown / Math.max(1, p.target)) * 100).toFixed(1) + '%';
      els.meta.innerHTML = '<span class="tycoon-job-reward">$' + formatNum(job.cash)
        + ' + ' + job.xp + ' XP</span> &middot; ' + formatNum(shown) + ' / ' + formatNum(p.target);
      els.claim.disabled = !p.ready;
      els.root.classList.toggle('is-ready', p.ready);
    });
  }

  function claimJob(index) {
    const job = state.jobs[index];
    if (!job) return;
    if (!jobProgress(job, floorTally()).ready) return;
    const before = currentLevel();
    state.balance += job.cash;
    state.lifetime += job.cash;
    state.xp = (state.xp || 0) + job.xp;
    state.jobs.splice(index, 1);
    refillJobs();
    if (currentLevel() > before) announceLevel(currentLevel());
    else toast('Job done -- $' + formatNum(job.cash) + ' and ' + job.xp + ' XP', 'good');
    refreshHud();
    refreshLevelUI();
    refreshShopUI();
    refreshThemeRow();
    refreshJobsUI();
    updateLeaderboardEntry();
    save();
  }

  const franchisePanelEl = document.getElementById('franchise-panel');
  const franchiseHeldEl = document.getElementById('franchise-held');
  const franchiseNoteEl = document.getElementById('franchise-note');
  const franchiseBtn = document.getElementById('btn-franchise');
  // Throwing the gym away takes two clicks, and the second one says what it
  // is about to do. It also times out, so a stray click cannot leave the
  // control armed for later.
  let franchiseArmed = false;
  let franchiseArmTimer = null;

  function refreshFranchiseUI() {
    if (!franchisePanelEl) return;
    const held = franchisePoints();
    const offer = franchiseOffer();
    // Nothing to see until it is either worth something or already earned.
    franchisePanelEl.hidden = held === 0 && offer === 0;
    if (franchisePanelEl.hidden) return;
    franchiseHeldEl.textContent = held
      ? held + ' point' + (held === 1 ? '' : 's') + ' -- +'
        + Math.round((franchiseMultiplier() - 1) * 100) + '% on everything, forever'
      : 'nothing banked yet';
    franchiseNoteEl.textContent = offer
      ? 'Cash this gym in for ' + offer + ' more point' + (offer === 1 ? '' : 's') + '. '
        + 'You keep your level and everything it unlocked, and your points. '
        + 'You lose the gear, every room past the first, and the staff.'
      : 'Keep earning -- the next point is worth more the bigger the gym gets.';
    franchiseBtn.disabled = offer === 0;
    franchiseBtn.classList.toggle('is-confirming', franchiseArmed);
    franchiseBtn.textContent = !offer ? 'Nothing to cash in yet'
      : franchiseArmed ? 'Really clear the gym?' : 'Franchise out -- +' + offer;
  }

  function disarmFranchise() {
    franchiseArmed = false;
    clearTimeout(franchiseArmTimer);
    refreshFranchiseUI();
  }

  function doFranchise() {
    const offer = franchiseOffer();
    if (!offer) return;
    if (!franchiseArmed) {
      franchiseArmed = true;
      clearTimeout(franchiseArmTimer);
      franchiseArmTimer = setTimeout(disarmFranchise, 6000);
      refreshFranchiseUI();
      return;
    }
    franchiseArmed = false;
    clearTimeout(franchiseArmTimer);

    const banked = franchisePoints() + offer;
    const runs = ((state.franchise && state.franchise.runs) || 0) + 1;
    const keptXp = state.xp;
    const keptLifetime = state.lifetime;
    state = Object.assign(defaultState(), {
      xp: keptXp,
      // Lifetime is what the offer is measured against, so it has to survive
      // -- points already banked are subtracted from the offer instead.
      lifetime: keptLifetime,
      franchise: { points: banked, runs },
    });
    editing = null;
    armedItemId = null;
    membersKey = '';
    refillJobs();
    recomputeStats();
    refreshHud();
    refreshLevelUI();
    refreshJobsUI();
    refreshStaffUI();
    refreshShopUI();
    refreshThemeRow();
    refreshRoomActions();
    refreshFranchiseUI();
    renderInventory();
    renderScene();
    updateLeaderboardEntry();
    save();
    toast('Franchised out -- ' + banked + ' points, +'
      + Math.round((franchiseMultiplier() - 1) * 100) + '% forever', 'good');
  }

  if (franchiseBtn) franchiseBtn.addEventListener('click', doFranchise);

  const staffListEl = document.getElementById('staff-list');
  const staffWagesEl = document.getElementById('staff-wages');
  const hireEls = {};
  function buildStaffUI() {
    if (!staffListEl) return;
    staffListEl.innerHTML = '';
    STAFF_ROLES.forEach((role) => {
      const row = document.createElement('div');
      row.className = 'tycoon-hire';
      row.innerHTML =
        '<span class="tycoon-hire-who">'
          + '<span class="tycoon-hire-name">' + role.name
            + '<span class="tycoon-hire-count"></span></span>'
          + '<span class="tycoon-hire-note"></span>'
        + '</span>'
        + '<span class="tycoon-hire-actions">'
          + '<button class="tycoon-hire-let-go" type="button" hidden>Let go</button>'
          + '<button class="tycoon-hire-btn" type="button">Hire</button>'
        + '</span>';
      const btn = row.querySelector('.tycoon-hire-btn');
      const letGo = row.querySelector('.tycoon-hire-let-go');
      btn.addEventListener('click', () => hireStaff(role.id));
      letGo.addEventListener('click', () => letStaffGo(role.id));
      staffListEl.appendChild(row);
      hireEls[role.id] = {
        root: row,
        count: row.querySelector('.tycoon-hire-count'),
        note: row.querySelector('.tycoon-hire-note'),
        btn,
        letGo,
      };
    });
  }

  const staffPanelEl = document.querySelector('.tycoon-staff');
  function refreshStaffUI() {
    if (!staffListEl) return;
    // Nothing to show a new player but three locked rows, and on a phone
    // they would have to scroll past them to reach the shop.
    if (staffPanelEl) staffPanelEl.hidden = !STAFF_ROLES.some(unlockedFor);
    STAFF_ROLES.forEach((role) => {
      const els = hireEls[role.id];
      if (!els) return;
      const unlocked = unlockedFor(role);
      const have = staffCount(role.id);
      const cost = staffHireCost(role.id);
      els.root.classList.toggle('is-locked', !unlocked);
      els.count.textContent = have ? ' x' + have : '';
      els.letGo.hidden = !have;
      if (!unlocked) {
        els.note.textContent = 'Unlocks at level ' + role.unlockLevel;
        els.btn.textContent = 'Locked';
        els.btn.disabled = true;
        return;
      }
      // What they are worth now, and what one more would add on top.
      const next = staffEffect(role.id, have + 1) - staffEffect(role.id, have);
      els.note.textContent = (have ? role.note(have) + ' -- ' : '')
        + 'next adds ' + (role.id === 'cleaner'
          ? next.toFixed(1) + ' vibe' : Math.round(next * 100) + '%')
        + ' for ' + Math.round(WAGE_SHARE_EACH * 100) + '% of takings';
      els.btn.textContent = 'Hire -- $' + formatNum(cost);
      els.btn.disabled = state.balance < cost;
    });
    const share = wageShare();
    staffWagesEl.textContent = share > 0
      ? staffTotal() + ' on the books -- ' + Math.round(share * 100) + '% of takings in wages'
        + (share >= WAGE_SHARE_MAX ? ' (capped)' : '')
      : 'no wages to pay';
  }

  // Free to do, and no severance: over-hiring should be a mistake you can
  // see in the numbers and then undo, not one you are stuck with.
  function letStaffGo(id) {
    if (staffCount(id) <= 0) return;
    state.staff[id] = staffCount(id) - 1;
    membersKey = '';
    recomputeStats();
    refreshStaffUI();
    renderScene();
    toast(staffRole(id).name + ' let go', '');
    save();
  }

  function hireStaff(id) {
    const role = staffRole(id);
    if (!role || !unlockedFor(role)) return;
    const cost = staffHireCost(id);
    if (state.balance < cost) return;
    const before = currentLevel();
    state.balance -= cost;
    if (!state.staff) state.staff = {};
    state.staff[id] = staffCount(id) + 1;
    state.xp = (state.xp || 0) + xpForSpend(cost);
    if (currentLevel() > before) announceLevel(currentLevel());
    else toast(role.name + ' hired', 'good');
    membersKey = '';
    recomputeStats();
    refreshLevelUI();
    refreshStaffUI();
    refreshShopUI();
    renderScene();
    save();
  }

  const rushEl = document.getElementById('rush-badge');
  function refreshRushUI() {
    if (!rushEl) return;
    const f = rushFactor();
    const bonus = Math.round(RUSH_BONUS * f * 100);
    rushEl.innerHTML = '<span class="tycoon-rush-when">' + rushLabel() + '</span>'
      + '<span class="tycoon-rush-meter"><span class="tycoon-rush-fill" style="width:'
      + (f * 100).toFixed(0) + '%"></span></span>'
      + '<span class="tycoon-rush-bonus' + (bonus > 0 ? '' : ' is-none') + '">'
      + (bonus > 0 ? '+' + bonus + '% while it lasts' : 'no rush bonus right now') + '</span>';
  }

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
    // Without the tabs, this line is where you read which room the numbers
    // below are describing.
    const roomLabel = () => 'Room ' + (state.activeRoomIndex + 1);
    const placed = layout.filter(Boolean).length;
    if (placed === 0) {
      synergyEl.textContent = roomLabel() + ' is empty = $0/s from here. '
        + 'Pick a piece of gear below, drag it where you want it, and hit the tick.';
      return;
    }
    const baseSum = layout.reduce((sum, id) => sum + (id ? gpsOf(id) : 0), 0);
    const room = activeRoom();
    const shape = roomShapeFor(state.activeTheme, state.activeRoomIndex);
    const roomGps = computeGps(room, shape);
    const vibe = roomVibe(room);
    const vibePct = Math.round((vibeMultiplier(room) - 1) * 100);
    // The vibe is reported separately from the arrangement bonus: they are
    // two different things you can do to a room, and rolling them into one
    // percentage hides which of them is doing the work.
    const rushPct = Math.round((rushMultiplier() - 1) * 100);
    const arrangedGps = roomGps / vibeMultiplier(room) / rushMultiplier();
    const bonusPct = baseSum > 0 ? Math.round((arrangedGps / baseSum - 1) * 100) : 0;
    synergyEl.textContent = roomLabel() + ': ' + placed + '/' + layout.length
      + ' slots filled -- base ' + formatNum(baseSum) + '/s'
      + (bonusPct > 0 ? ', +' + bonusPct + '% from arrangement synergy' : ', no synergy bonus yet')
      + (vibe > 0 ? ', +' + vibePct + '% vibe from the fittings'
        + (vibe > VIBE_MAX_POINTS ? ' (capped)' : '') : '')
      + (rushPct > 0 ? ', +' + rushPct + '% rush bonus' : '')
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
        '<span class="shop-item-gps">' + (item.vibe
          ? '+' + Math.round(item.vibe * VIBE_PER_POINT * 100) + '% to everything its room earns'
          : '+' + formatNum(item.gps) + ' gains/sec when placed') + '</span>' +
        '<button class="shop-buy-btn" type="button">Buy</button>' +
        '<button class="shop-upgrade-btn" type="button" hidden></button>';
      const buyBtn = el.querySelector('.shop-buy-btn');
      const upBtn = el.querySelector('.shop-upgrade-btn');
      buyBtn.addEventListener('click', () => buyItem(item.id));
      upBtn.addEventListener('click', () => upgradeItem(item.id));
      shopGrid.appendChild(el);
      shopEls[item.id] = {
        root: el,
        ownedEl: el.querySelector('.shop-item-owned'),
        gpsEl: el.querySelector('.shop-item-gps'),
        tierEl: el.querySelector('.shop-item-name'),
        buyBtn,
        upBtn,
      };
    });
  }

  function refreshShopUI() {
    ITEMS.forEach((item) => {
      const els = shopEls[item.id];
      const unlocked = unlockedFor(item);
      els.root.classList.toggle('is-locked', !unlocked);
      if (!unlocked) {
        els.ownedEl.textContent = '';
        els.buyBtn.innerHTML = '<span class="btn-lock-icon">' + iconMarkup('lock', 13) + '</span> Unlocks at level ' + item.unlockLevel;
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

      // What it earns now, which is not what it says on the tin once it has
      // been upgraded, and the control to take it further.
      const tier = tierOf(item.id);
      els.tierEl.textContent = item.name + (tier > 1 ? ' ' + TIER_NAMES[tier] : '');
      if (!item.vibe) {
        els.gpsEl.textContent = '+' + formatNum(gpsOf(item.id)) + ' gains/sec when placed'
          + (tier > 1 ? ' (' + TIER_NAMES[tier] + ')' : '');
      }
      const upgradable = canUpgrade(item.id);
      els.upBtn.hidden = !upgradable;
      if (upgradable) {
        const upCost = upgradeCost(item.id);
        els.upBtn.textContent = 'Upgrade to ' + TIER_NAMES[tier + 1] + ' — $' + formatNum(upCost)
          + ' (x' + TIER_STEP.toFixed(1) + ')';
        els.upBtn.disabled = state.balance < upCost;
      }
    });
  }

  function buyItem(id) {
    const item = ITEMS.find((i) => i.id === id);
    if (!unlockedFor(item)) return;
    const cost = costFor(item);
    if (state.balance < cost) return;
    const before = currentLevel();
    state.balance -= cost;
    state.owned[id] = (state.owned[id] || 0) + 1;
    state.xp = (state.xp || 0) + xpForSpend(cost);
    const after = currentLevel();
    if (after > before) announceLevel(after);
    // Auto-drop new gear into an open slot in the room+theme currently in
    // view so it starts earning right away. Once that's full, further
    // purchases sit in inventory until you free up a slot somewhere --
    // that's the point where arranging what to keep on the floor (or
    // switching theme, or buying another room) actually becomes a decision.
    const room = activeRoom();
    const emptyIndex = room.layout.indexOf(null);
    if (emptyIndex !== -1) {
      const shape = roomShapeFor(state.activeTheme, state.activeRoomIndex);
      room.layout[emptyIndex] = id;
      if (!room.spots) room.spots = new Array(room.layout.length).fill(null);
      room.spots[emptyIndex] = defaultSpot(shape, emptyIndex, room.layout.length);
      renderScene();
    }
    recomputeStats();
    refreshShopUI();
    refreshLevelUI();
    refreshThemeRow();
    renderInventory();
    refreshRoomActions();
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
    const theme = state.activeTheme;
    const count = activeRooms().length;
    placements = roomPlacements(theme, count);
    corridors = [];
    for (let i = 0; i < count - 1; i++) {
      corridors.push(corridorBetween(
        theme, placements[i], placements[i + 1], roomDirFor(theme, i),
      ));
    }

    // The plot the next room will stand on, worked out one room ahead. It is
    // drawn as a staked-out site rather than left as empty black, so there is
    // something to save towards -- and because it is measured now, buying the
    // room drops the building straight onto it without the plan reflowing.
    preview = null;
    previewCorridor = null;
    if (count < MAX_ROOMS_PER_THEME) {
      const withNext = roomPlacements(theme, count + 1);
      preview = withNext[count];
      previewCorridor = corridorBetween(
        theme, placements[count - 1], preview, roomDirFor(theme, count - 1),
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
  // Low enough that the longest plan -- the garage's row of bays, which runs
  // 25 tiles end to end -- still frames whole on a phone.
  const ZOOM_MIN = 0.2;
  const ZOOM_MAX = 1.6;
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
  const FIT_MAX = 1.25;

  function fitZoomToStage() {
    if (!stageScrollEl || userSetZoom) return;
    const availW = stageScrollEl.clientWidth;
    const availH = stageScrollEl.clientHeight;
    if (!availW || !availH) return;
    // Frame the plan with a little of what it stands in, rather than butting
    // it against the edges: the site around it is drawn now, and a plan
    // fitted edge to edge hides all of it. The margin scales with the window
    // so a phone, where every pixel of plan counts, gives up almost none.
    const margin = Math.min(70, availW * 0.08);
    const fit = Math.min(
      availW / (PLAN_W + margin * 2),
      availH / (PLAN_H + margin * 2),
      FIT_MAX,
    );
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

  // The same colour at a different opacity, for an rgba() string whose base
  // opacity is already part of the design.
  function scaleAlpha(rgba, factor) {
    const m = /^rgba?\(([^)]+)\)$/.exec(String(rgba).trim());
    if (!m) return rgba;
    const parts = m[1].split(',').map((v) => parseFloat(v));
    const a = parts.length > 3 ? parts[3] : 1;
    return 'rgba(' + parts[0] + ',' + parts[1] + ',' + parts[2] + ','
      + Math.max(0, Math.min(1, a * factor)).toFixed(3) + ')';
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

  // A flat panel lying in one vertical face of a prop: p0 and p1 are the two
  // ends of its ground edge in tile-units, z0/z1 how far up that face it runs
  // in pixels. A door, screen or pane of glass drawn this way sits *in* the
  // face it belongs to, instead of reading as yet another box stuck on the
  // side of the one underneath it.
  function drawFacePanel(ctx, base, p0, p1, z0, z1, color, radius) {
    const a = isoScreenPoint(base, p0.u, p0.v, z0);
    const b = isoScreenPoint(base, p1.u, p1.v, z0);
    const c = isoScreenPoint(base, p1.u, p1.v, z1);
    const d = isoScreenPoint(base, p0.u, p0.v, z1);
    ctx.beginPath();
    roundedQuadPath(ctx, a, b, c, d, radius == null ? 1.5 : radius);
    ctx.fillStyle = color;
    ctx.fill();
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

  // How much floor each piece actually takes up, along its longest side, in
  // metres. Everything used to be drawn at one size, which is why a pair of
  // dumbbells came out as big as a squat rack; sized off this, a dumbbell is
  // knee-high clutter and a treadmill is a machine you walk around.
  const ITEM_FOOTPRINT = {
    dumbbell: 0.7,       // a pair on the floor
    dumbbellrack: 1.7,
    mat: 1.8,            // rolled out flat
    bench: 1.8,
    rack: 1.6,
    cable: 1.7,
    treadmill: 2.0,
    trainer: 0.7,        // the floor a person stands on, not their height
    sauna: 2.2,
    gearfridge: 0.9,
    soundsystem: 1.4,
    desk: 2.0,
    cubicle: 2.0,
    officepod: 1.7,
    palm: 0.8,
    cooler: 0.6,
    mirrorwall: 1.7,
    neon: 1.6,
  };
  const DEFAULT_FOOTPRINT = 1.4;

  // The size to *draw* a piece at, along its longest side, for the few whose
  // art is not proportioned like their footprint. A Personal Trainer is a
  // standing person: scaled by the half-metre of floor they occupy they come
  // out knee-high next to the gear, so they are drawn at their own height
  // instead. How much room a piece needs to clear a wall still comes from
  // ITEM_FOOTPRINT.
  const ITEM_DRAW_SIZE = {
    trainer: 1.75,
  };

  // A lattice tile is a third of a metre, and drawItemSprite draws an
  // untouched sprite about 1.15 tiles wide -- so this is what one metre of
  // real gear has to be scaled by to come out a metre wide on the floor.
  const PX_PER_METRE = ROOM.tileW * 3;
  const SPRITE_BASE_W = ROOM.tileW * 1.15;
  function propScaleFor(itemId) {
    return (drawSizeOf(itemId) * PX_PER_METRE) / SPRITE_BASE_W;
  }

  // What one metre of *height* comes out as on the floor. A sprite is drawn
  // ROOM.tileH * 1.45 tall before its own scaling, so this is the number to
  // build anything by hand against if it is to stand the same height as the
  // art does -- a person next to a squat rack, say.
  const PX_PER_METRE_TALL = (ROOM.tileH * 1.45) * (PX_PER_METRE / SPRITE_BASE_W);

  // `anchor` shifts how far the image's bottom edge sits below the middle of
  // its footprint -- an object whose visual weight isn't near the bottom of
  // its own bounding box (a dumbbell shot at an angle, a mat lying flat)
  // needs a bigger push down or it reads as floating above its shadow.
  const ITEM_SPRITE_TUNING = {
    dumbbell: { anchor: 0.34 },
    mat: { anchor: 0.36 },
  };
  const DEFAULT_SPRITE_TUNING = { anchor: 0.16 };

  function drawItemSprite(ctx, center, img, itemId) {
    const ready = img.complete && img.naturalWidth > 0;
    if (!ready) return false;
    const tuning = ITEM_SPRITE_TUNING[itemId] || DEFAULT_SPRITE_TUNING;
    const maxH = ROOM.tileH * 1.45;
    const maxW = ROOM.tileW * 1.15;
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
    // Every builder below is drawn at its own item's scale (drawProp scales
    // the whole context by propScaleFor), so all three are dimensioned off
    // their ITEM_FOOTPRINT F: one real metre is 1.15/F tile-units across the
    // floor and about 24/F pixels up. That is what lets a 1.85m fridge and a
    // 2.1m office pod come out the right heights relative to each other on
    // screen while their floor footprints stay 0.9m and 1.7m apart.
    gearfridge: (ctx, b) => {
      // Glass-fronted fridge, shelves stocked with vials. F = 0.9.
      drawIsoBox(ctx, b, 0, 0, 0.46, 0.42, 49, '#59636f', 0);
      drawIsoBox(ctx, b, 0, 0, 0.42, 0.38, 4, '#39414a', 49);
      drawFacePanel(ctx, b, { u: 0.465, v: -0.34 }, { u: 0.465, v: 0.34 }, 5, 44, '#16232b', 3);
      [12, 23, 34].forEach((z) => {
        drawFacePanel(ctx, b, { u: 0.47, v: -0.30 }, { u: 0.47, v: 0.30 }, z, z + 1.5, '#e8a04a', 1);
        for (let k = -2; k <= 2; k++) {
          const v = k * 0.125;
          drawFacePanel(ctx, b, { u: 0.475, v: v - 0.045 }, { u: 0.475, v: v + 0.045 }, z + 1.5, z + 6.5, '#6fd6e8', 1);
        }
      });
      drawFacePanel(ctx, b, { u: 0.49, v: 0.26 }, { u: 0.49, v: 0.30 }, 12, 38, '#cfd6de', 2);
    },
    soundsystem: (ctx, b) => {
      // A pair of PA stacks -- a sub on the floor with a column speaker
      // standing on it -- and the thing that makes the whole room train
      // harder. F = 1.4.
      [-0.30, 0.30].forEach((v) => {
        drawIsoBox(ctx, b, 0, v, 0.226, 0.226, 10.3, '#464c56', 0);
        drawFacePanel(ctx, b, { u: 0.231, v: v - 0.185 }, { u: 0.231, v: v + 0.185 }, 1.2, 9.1, '#22252b', 1.4);
        drawIsoDisc(ctx, isoScreenPoint(b, 0.236, v, 5.2), 3.4, 4.1, '#6a717d');
        drawIsoBox(ctx, b, 0, v, 0.148, 0.148, 19.7, '#525965', 10.3);
        drawFacePanel(ctx, b, { u: 0.153, v: v - 0.115 }, { u: 0.153, v: v + 0.115 }, 11.6, 28.6, '#22252b', 1.2);
        [15.2, 20.1, 25.0].forEach((z) => {
          drawIsoDisc(ctx, isoScreenPoint(b, 0.158, v, z), 1.9, 2.3, '#6a717d');
        });
        drawFacePanel(ctx, b, { u: 0.160, v: v - 0.05 }, { u: 0.160, v: v + 0.05 }, 12.2, 13.1, '#5ec4c9', 0.5);
      });
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
    // A palm in a pot: fronds arcing out of a trunk, drawn as tapered blades
    // rather than boxes, because nothing about a plant is rectangular.
    // F = 0.8.
    palm: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.30, 0.28, 13, '#8a5a3a', 0);
      drawIsoBox(ctx, b, 0, 0, 0.26, 0.24, 3, '#5f3d27', 13);
      drawIsoBox(ctx, b, 0, 0, 0.05, 0.05, 26, '#6f5a38', 15);
      const top = isoScreenPoint(b, 0, 0, 41);
      [[-1, -0.15], [-0.72, 0.5], [0.05, 0.85], [0.8, 0.45], [1, -0.2], [-0.3, -0.6], [0.4, -0.7]]
        .forEach(([dx, dy], i) => {
          const len = 22 + (i % 3) * 5;
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.quadraticCurveTo(top.x + dx * len * 0.6, top.y + dy * len * 0.5 - 9,
            top.x + dx * len, top.y + dy * len * 0.55);
          ctx.lineWidth = 5.5;
          ctx.lineCap = 'round';
          ctx.strokeStyle = i % 2 ? '#3f9a63' : '#2f7d4e';
          ctx.stroke();
        });
      drawIsoDisc(ctx, top, 4, 3, '#4fb173');
    },
    // A bottled cooler: base unit, a cup dispenser on its side, and the
    // bottle upended on top of it. F = 0.6.
    cooler: (ctx, b) => {
      // 0.95m of cabinet with a 0.45m bottle upended on it: at 40 pixels to
      // the metre for a piece this size, that is 38 and 18.
      drawIsoBox(ctx, b, 0, 0, 0.40, 0.36, 38, '#dfe6ee', 0);
      drawIsoBox(ctx, b, 0, 0, 0.36, 0.32, 3, '#aab6c4', 38);
      drawFacePanel(ctx, b, { u: 0.41, v: -0.22 }, { u: 0.41, v: 0.22 }, 12, 26, '#5a6673', 2);
      drawFacePanel(ctx, b, { u: 0.42, v: -0.10 }, { u: 0.42, v: 0.10 }, 15, 23, '#7fd6e8', 1.5);
      drawFacePanel(ctx, b, { u: 0.43, v: 0.24 }, { u: 0.43, v: 0.33 }, 7, 19, '#cfd6de', 1.5);
      drawIsoBox(ctx, b, 0, 0, 0.27, 0.25, 18, 'rgba(120,200,225,0.85)', 41);
      drawIsoBox(ctx, b, 0, 0, 0.10, 0.10, 4, '#4a7fa8', 59);
    },
    // A run of mirrored panel on a stand -- the thing that turns a bare room
    // into a gym. F = 2.4.
    mirrorwall: (ctx, b) => {
      // 1.5m of mirror, 1.85m tall, on a shallow foot. A wide flat thing
      // seen in this projection reads taller than it is -- its top face adds
      // most of a metre of apparent height on its own -- so it is drawn to
      // its real size and left to look as big as a real one does.
      drawIsoBox(ctx, b, 0, 0, 0.055, 0.507, 1.6, '#3a3f48', 0);
      drawIsoBox(ctx, b, 0, 0, 0.034, 0.492, 26, '#2b343d', 1.6);
      drawFacePanel(ctx, b, { u: 0.038, v: -0.465 }, { u: 0.038, v: 0.465 }, 3.4, 26.4, '#4c6373', 1.2);
      // Two panes with a joint between them, and slanted highlights so it
      // reads as glass rather than a grey board.
      drawFacePanel(ctx, b, { u: 0.042, v: -0.42 }, { u: 0.042, v: -0.17 }, 5, 24.5, 'rgba(255,255,255,0.16)', 0.9);
      drawFacePanel(ctx, b, { u: 0.042, v: 0.03 }, { u: 0.042, v: 0.18 }, 5, 24.5, 'rgba(255,255,255,0.09)', 0.9);
      drawFacePanel(ctx, b, { u: 0.046, v: -0.015 }, { u: 0.046, v: 0.01 }, 3.4, 26.4, 'rgba(0,0,0,0.45)', 0.3);
      drawIsoBox(ctx, b, 0, -0.48, 0.13, 0.045, 1.4, '#3a3f48', 0);
      drawIsoBox(ctx, b, 0, 0.48, 0.13, 0.045, 1.4, '#3a3f48', 0);
    },
    // A neon sign on a pole. The glow is the point, so it is drawn as a
    // shadowed stroke rather than a filled shape. F = 1.6.
    neon: (ctx, b) => {
      // A 0.75m sign on a 1.5m pole: 15 pixels to the metre at this size.
      drawIsoBox(ctx, b, 0, 0, 0.162, 0.150, 2, '#2b2f36', 0);
      drawIsoBox(ctx, b, 0, 0, 0.029, 0.029, 22, '#4a4f58', 2);
      drawIsoBox(ctx, b, 0, 0, 0.043, 0.539, 11.5, '#1d2128', 24);
      const glow = (from, to, color) => {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.lineWidth = 1.9;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 5;
        ctx.stroke();
        ctx.shadowBlur = 0;
      };
      const at = (v, z) => isoScreenPoint(b, 0.05, v, z);
      glow(at(-0.40, 26.5), at(-0.40, 33), '#ff5c8a');
      glow(at(-0.40, 33), at(-0.24, 26.5), '#ff5c8a');
      glow(at(-0.24, 26.5), at(-0.24, 33), '#ff5c8a');
      glow(at(-0.05, 33), at(-0.05, 26.5), '#5ec4c9');
      glow(at(-0.05, 26.5), at(0.09, 26.5), '#5ec4c9');
      glow(at(0.30, 26.5), at(0.30, 33), '#ffd45c');
    },
    officepod: (ctx, b) => {
      // A one-person glass office booth -- 1.6m square and 2.1m tall, the
      // kind you drop on a floor, not a room. Drawn inside-out: plinth, then
      // the furniture standing in it, then the glass in front of that, so
      // you read the inside through the walls. F = 1.7.
      drawIsoBox(ctx, b, 0, 0, 0.541, 0.474, 1.2, '#2f3a45', 0);
      drawIsoBox(ctx, b, -0.24, 0.02, 0.203, 0.338, 10.6, '#6b4a30', 1.2);
      drawIsoBox(ctx, b, -0.24, -0.13, 0.028, 0.028, 4.4, '#26262a', 11.8);
      drawIsoBox(ctx, b, -0.24, -0.13, 0.115, 0.02, 5.6, '#3fa0c9', 16.2);
      drawIsoBox(ctx, b, 0.08, 0.04, 0.16, 0.16, 6.4, '#33383f', 1.2);
      drawIsoBox(ctx, b, 0.16, 0.04, 0.04, 0.15, 8.5, '#3f454e', 7.6);
      drawIsoDisc(ctx, isoScreenPoint(b, -0.22, 0.06, 24), 5, 3.2, 'rgba(240,200,120,0.28)');
      drawFacePanel(ctx, b, { u: -0.507, v: 0.443 }, { u: 0.507, v: 0.443 }, 1.2, 30, 'rgba(140,200,220,0.13)', 1);
      drawFacePanel(ctx, b, { u: 0.505, v: -0.443 }, { u: 0.505, v: 0.443 }, 1.2, 30, 'rgba(155,210,230,0.20)', 1);
      drawFacePanel(ctx, b, { u: 0.512, v: 0.03 }, { u: 0.512, v: 0.055 }, 1.2, 30, 'rgba(200,230,240,0.42)', 0.6);
      drawFacePanel(ctx, b, { u: 0.518, v: 0.11 }, { u: 0.518, v: 0.145 }, 12, 17, '#cfd6de', 1);
      [[-0.507, -0.443], [0.507, -0.443], [-0.507, 0.443], [0.507, 0.443]].forEach(([u, v]) => {
        drawIsoBox(ctx, b, u, v, 0.024, 0.024, 30, '#98a1ac', 0);
      });
      drawIsoBox(ctx, b, 0, 0, 0.548, 0.480, 2.5, '#59636f', 30);
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
    // The lights work harder after dark and are barely noticed at midday.
    grad.addColorStop(0, scaleAlpha(glowColor, lampBoost()));
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
  // ---- Ground ----
  // The rooms used to stand inside a bigger themed room -- a unit, a boiler
  // room, a roof -- which read as a room inside a room and fought with the
  // rooms themselves for attention. Now that a room is a room-sized space,
  // it does not need a building drawn around it: it stands on open ground
  // that carries the theme's colour and falls away into the dark.

  function drawGroundLattice(colors) {
    const step = 6;   // lattice tiles between lines
    const halfW = ROOM.tileW / 2;
    const halfH = ROOM.tileH / 2;
    const reach = Math.ceil((BASE_W / halfW + BASE_H / halfH) / 2) + step * 2;
    const span = reach * 2;

    floorCtx.save();
    floorCtx.strokeStyle = shade(colors.bg, 12);
    floorCtx.lineWidth = 1;
    for (let i = -reach; i <= reach; i += step) {
      const a = isoPoint(i, -span);
      const b = isoPoint(i, span);
      floorCtx.beginPath();
      floorCtx.moveTo(a.x, a.y);
      floorCtx.lineTo(b.x, b.y);
      floorCtx.stroke();
      const c = isoPoint(-span, i);
      const d = isoPoint(span, i);
      floorCtx.beginPath();
      floorCtx.moveTo(c.x, c.y);
      floorCtx.lineTo(d.x, d.y);
      floorCtx.stroke();
    }
    floorCtx.restore();
  }

  // A pool of the theme's own light over the plan, so the middle of the view
  // is lit and the ground falls away at the edges.
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

  function drawSiteVignette() {
    const cx = BLEED_SIDE + PLAN_W / 2;
    const cy = BLEED_TOP + PLAN_H / 2;
    const radius = Math.hypot(BASE_W, BASE_H) * 0.62;
    const g = floorCtx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    floorCtx.fillStyle = g;
    floorCtx.fillRect(0, 0, BASE_W, BASE_H);
  }

  // Dissolve the last strip along each edge, so the ground runs out rather
  // than stopping at a cut line.
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
    const colors = THEME_COLORS[theme] || THEME_COLORS.garage;
    drawGroundLattice(colors);
    drawSiteWash(AMBIENT_WASH[theme] || AMBIENT_WASH.garage);
    drawSiteVignette();
    maskAmbienceEdges();
  }

  // Point on a wall: t is fraction along the wall (0 = the near/floor
  // corner given as fromP, 1 = toP), hFrac is fraction up from the floor
  // (0 = floor line, 1 = ceiling). Decor drawn from this stays anchored to
  // the wall as the room re-renders, without needing full quad-skew math.
  // A little coordinate frame lying in a wall's own plane: (along, up) in
  // pixels from a point on the wall, mapped to the screen. Anything flat
  // stuck on a wall is drawn through this, because a wall recedes -- a
  // rectangle painted square to the screen on one reads as a sticker
  // floating in front of the wall rather than something hanging on it.
  function wallFrame(fromP, toP, t, hFrac) {
    const origin = wallPoint(fromP, toP, t, hFrac);
    const len = Math.hypot(toP.x - fromP.x, toP.y - fromP.y) || 1;
    const ux = (toP.x - fromP.x) / len;
    const uy = (toP.y - fromP.y) / len;
    return (along, up) => ({ x: origin.x + ux * along, y: origin.y + uy * along - up });
  }

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

  // A doorway is a hole in a wall, so nothing can hang across it -- and with
  // three themes growing in three directions, which wall a room's doorways
  // land on is no longer something that can be assumed. These are the spans
  // the hallways take out of a room's two back walls, as fractions along
  // them, with a little clearance either side of the casing.
  function wallDoorSpans(roomIndex) {
    const r = placements[roomIndex];
    const ne = [];  // the north->east wall, running along +gx
    const nw = [];  // the north->west wall, running along +gy
    if (!r) return { ne, nw };
    const pad = 0.05;
    corridors.forEach((c) => {
      if (c.doorRoom !== r) return;
      if (c.axis === 'gy') {
        ne.push([(c.gx0 - r.gx0) / r.cols - pad, (c.gx0 + c.cols - r.gx0) / r.cols + pad]);
      } else {
        nw.push([(c.gy0 - r.gy0) / r.rows - pad, (c.gy0 + c.rows - r.gy0) / r.rows + pad]);
      }
    });
    return { ne, nw };
  }

  // The first of the offered positions that clears every doorway on that
  // wall (and anything already hung there), or null if the wall is full.
  function pickWallSpot(spans, taken, candidates, half) {
    for (let i = 0; i < candidates.length; i++) {
      const t = candidates[i];
      if (t - half < 0 || t + half > 1) continue;
      const clearOfDoors = spans.every(([lo, hi]) => t + half <= lo || t - half >= hi);
      const clearOfKit = taken.every((u) => Math.abs(u - t) >= half * 2);
      if (clearOfDoors && clearOfKit) return t;
    }
    return null;
  }

  function drawRoomFittings(fit, north, east, west, doors) {
    // Alternating walls, each piece taking the first free position on its
    // wall. Fixed positions were fine while every room had its doorway in
    // the same place; now a piece that would land on a doorway steps along
    // the wall to the next opening instead, and is dropped if there is none.
    const order = [
      { key: 'ne', wall: [north, east], from: [0.22, 0.38, 0.81, 0.62, 0.1] },
      { key: 'nw', wall: [north, west], from: [0.75, 0.24, 0.55, 0.88, 0.12] },
    ];
    const taken = { ne: [], nw: [] };
    const half = 0.075;
    fit.decor.forEach((name, i) => {
      const draw = WALL_FITTINGS[name];
      if (!draw) return;
      // Try its own wall first, then the other one.
      for (let k = 0; k < order.length; k++) {
        const side = order[(i + k) % order.length];
        const t = pickWallSpot(doors[side.key], taken[side.key], side.from, half);
        if (t === null) continue;
        taken[side.key].push(t);
        draw(side.wall[0], side.wall[1], t);
        return;
      }
    });
  }

  function drawWallDecor(theme, north, east, west, doors) {
    if (theme === 'garage') {
      // Mid-wall unless a doorway is there, in which case step along it.
      const t = pickWallSpot(doors.ne, [], [0.56, 0.34, 0.76, 0.16], 0.14);
      if (t === null) return;
      const at = wallFrame(north, east, t, 0.62);
      paintQuad([at(-32, 24), at(32, 24), at(32, -20), at(-32, -20)],
        'rgba(0,0,0,0.22)', null);
      floorCtx.strokeStyle = 'rgba(255,255,255,0.10)';
      floorCtx.lineWidth = 1;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 6; col++) {
          const hole = at(-26 + col * 11, 17 - row * 11);
          floorCtx.beginPath();
          floorCtx.arc(hole.x, hole.y, 1.3, 0, Math.PI * 2);
          floorCtx.stroke();
        }
      }
      floorCtx.lineCap = 'round';
      strokePolyline([at(-14, -12), at(-14, 8)], '#c94f3a', 2.5);
      strokePolyline([at(-19, 8), at(-9, 8)], '#c94f3a', 2.5);
      strokePolyline([at(10, -14), at(10, 10)], '#9aa0a8', 2.5);
      const eye = at(10, 10);
      floorCtx.beginPath();
      floorCtx.arc(eye.x, eye.y, 4, 0.3, Math.PI * 1.4);
      floorCtx.strokeStyle = '#9aa0a8';
      floorCtx.lineWidth = 2.5;
      floorCtx.stroke();
    } else if (theme === 'basement') {
      const t = pickWallSpot(doors.nw, [], [0.5, 0.28, 0.74, 0.14], 0.14);
      if (t === null) return;
      const at = wallFrame(north, west, t, 0.6);
      const sheet = (a0, a1, u0, u1, fill) => paintQuad(
        [at(a0, u0), at(a1, u0), at(a1, u1), at(a0, u1)], fill, null);
      sheet(-26, 26, 32, -8, '#1a1512');
      sheet(-22, 22, 28, -4, '#dcd0b8');
      sheet(-17, 17, 22, 19, 'rgba(0,0,0,0.55)');
      sheet(-17, 5, 15, 12, 'rgba(0,0,0,0.55)');
      sheet(-17, 9, 8, 5, 'rgba(0,0,0,0.55)');
      sheet(-17, -5, 1, -2, '#c0483a');
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

  // The lattice is far finer than a floor tile -- it is what gear is
  // positioned on, not what the floor is paved with -- so the paving goes
  // down in plates a few lattice tiles across, which is about the size a real
  // floor tile would be. Rooms and hallways are paved by the same routine so
  // one does not come out tiled three times finer than the other; `dim` is
  // how much darker a hallway's floor sits than a room's.
  const PLATE = 3;
  function drawPaving(rect, colors, dim) {
    for (let ry = 0; ry < rect.rows; ry += PLATE) {
      for (let rx = 0; rx < rect.cols; rx += PLATE) {
        const gx = rect.gx0 + rx;
        const gy = rect.gy0 + ry;
        const w = Math.min(PLATE, rect.cols - rx);
        const h = Math.min(PLATE, rect.rows - ry);
        const p0 = isoPoint(gx, gy);
        const p1 = isoPoint(gx + w, gy);
        const p2 = isoPoint(gx + w, gy + h);
        const p3 = isoPoint(gx, gy + h);
        const tileColor = shade(((rx / PLATE | 0) + (ry / PLATE | 0)) % 2 === 0
          ? colors.floorA : colors.floorB, dim || 0);
        paintQuad([p0, p1, p2, p3], tileColor, 'rgba(0,0,0,0.25)', 1);

        // A light seam along the two edges facing the light source and a dark
        // one along the two facing away, so a plate reads as a slab with an
        // edge rather than a flat fill.
        floorCtx.beginPath();
        floorCtx.moveTo(p0.x, p0.y);
        floorCtx.lineTo(p1.x, p1.y);
        floorCtx.moveTo(p0.x, p0.y);
        floorCtx.lineTo(p3.x, p3.y);
        floorCtx.strokeStyle = shade(tileColor, 16);
        floorCtx.lineWidth = 1;
        floorCtx.stroke();
        floorCtx.beginPath();
        floorCtx.moveTo(p2.x, p2.y);
        floorCtx.lineTo(p1.x, p1.y);
        floorCtx.moveTo(p2.x, p2.y);
        floorCtx.lineTo(p3.x, p3.y);
        floorCtx.strokeStyle = shade(tileColor, -18);
        floorCtx.stroke();
      }
    }
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

    // One quad per unbroken stretch of exposed edge, not one per lattice
    // tile. The lattice is three times finer than a floor tile now, so a
    // quad each -- outlined, as every quad here is -- ruled a dark line
    // every few pixels along the whole front of every room, which is the
    // floor's version of the seam the walls used to have.
    const runEdge = (from, to, exposed, corner, fill) => {
      let start = null;
      for (let i = from; i <= to; i++) {
        const open = i < to && exposed(i);
        if (open && start === null) start = i;
        if (!open && start !== null) {
          drop(corner(start), corner(i), fill);
          start = null;
        }
      }
    };

    const gxEdge = rect.gx0 + rect.cols;
    runEdge(rect.gy0, rect.gy0 + rect.rows,
      (gy) => !tileIsFloor(gxEdge, gy), (gy) => isoPoint(gxEdge, gy), right);

    const gyEdge = rect.gy0 + rect.rows;
    runEdge(rect.gx0, rect.gx0 + rect.cols,
      (gx) => !tileIsFloor(gx, gyEdge), (gx) => isoPoint(gx, gyEdge), left);
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

  // An open polyline, stroked once. Wall edges are drawn this way rather than
  // as the outlines of the quads that meet along them, because an edge two
  // faces share gets stroked twice that way -- which is exactly what made
  // every joint in a wall show up as a line darker than the wall's own
  // corners.
  function strokePolyline(pts, color, width) {
    if (pts.length < 2) return;
    floorCtx.beginPath();
    floorCtx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) floorCtx.lineTo(pts[i].x, pts[i].y);
    floorCtx.strokeStyle = color;
    floorCtx.lineWidth = width || 1;
    floorCtx.lineJoin = 'round';
    floorCtx.stroke();
  }

  function sameVec(a, b) {
    return !!a && !!b && a.x === b.x && a.y === b.y;
  }

  // How far an end that runs into another wall is pushed past the join. Two
  // fills that only just touch leave an antialiased hairline between them,
  // which on a wall that is meant to be continuous reads as exactly the seam
  // this whole thing is here to get rid of; a run drawn later overlaps the
  // one it continues instead.
  const WALL_JOIN_OVERLAP = 1.5;
  function pushPast(p, towards) {
    const dx = p.x - towards.x;
    const dy = p.y - towards.y;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: p.x + (dx / len) * WALL_JOIN_OVERLAP,
      y: p.y + (dy / len) * WALL_JOIN_OVERLAP,
    };
  }

  // What a room's wall does where it reaches one of the room's open corners.
  // A hallway flush with the backs of both rooms starts its wall on this very
  // corner and carries straight on along the same line, so there is nothing
  // there to cut and capping it put a cut face in the middle of a wall that
  // runs on unbroken -- which was the seam you could see at every hallway.
  // A hallway stepped back from the room's wall reaches this corner by a
  // return that hangs off the wall's inner side instead, and there the wall
  // really does end, so it keeps its cap.
  function roomWallEnd(place, corner) {
    return corridors.some((c) => c.nearRoom === place
      && c.gx0 === corner.gx && c.gy0 === corner.gy) ? 'open' : 'cap';
  }

  // A whole run of wall as one solid: `pts` is its centre-line corner to
  // corner and `axes` says which lattice axis each segment runs along, which
  // decides both its shading and which way its thickness backs off. `ends`
  // says what happens at each end -- 'cap' for a cut end you can see the
  // thickness of, 'open' for one that runs into the next wall along.
  //
  // Drawing a run in one go is the whole point. Built out of one slab per
  // segment, every joint showed as a seam -- each slab outlining an edge its
  // neighbour had already outlined -- and every turn had to be patched with a
  // separate square of ceiling that left a notch where it met them. Here the
  // faces are filled with no outlines of their own, the top is one unbroken
  // band with the turn mitred into it, and the finished solid is outlined
  // once, so a wall that turns a corner reads as one wall that turns a
  // corner.
  // How much of the wall's height a doorway takes out of it, and how wide
  // the opening is as a fraction of the hallway mouth it stands in -- the
  // same numbers drawCorridorDoor builds its casing from, so the hole and
  // the frame around it line up exactly.
  const DOOR_HEAD = ROOM.wallH * 0.56 - 10;
  const DOOR_JAMB = 0.12;
  const DOOR_FROM = 0.18 + DOOR_JAMB * (0.82 - 0.18);
  const DOOR_TO = 0.82 - DOOR_JAMB * (0.82 - 0.18);

  // Where this room's walls have holes in them, as fractions along each wall
  // in the direction that wall is measured: north->east for the one running
  // along +gx, north->west for the one running along +gy.
  function wallApertures(roomIndex) {
    const r = placements[roomIndex];
    const ne = [];
    const nw = [];
    if (!r) return { ne, nw };
    corridors.forEach((c) => {
      if (c.doorRoom !== r) return;
      if (c.axis === 'gy') {
        const lo = (c.gx0 - r.gx0) / r.cols;
        const span = c.cols / r.cols;
        ne.push([lo + span * DOOR_FROM, lo + span * DOOR_TO]);
      } else {
        const lo = (c.gy0 - r.gy0) / r.rows;
        const span = c.rows / r.rows;
        nw.push([lo + span * DOOR_FROM, lo + span * DOOR_TO]);
      }
    });
    return { ne, nw };
  }

  function drawWallRun(centreLine, axes, h, colors, ends, apertures) {
    const n = axes.length;
    const dep = axes.map(wallDepth);
    const pts = centreLine.slice();
    if (ends[0] !== 'cap') pts[0] = pushPast(pts[0], pts[1]);
    if (ends[1] !== 'cap') pts[n] = pushPast(pts[n], pts[n - 1]);
    const lift = (p) => ({ x: p.x, y: p.y - h });
    const shift = (p, d, up) => ({ x: p.x + d.x, y: p.y + d.y - (up ? h : 0) });
    const faceOf = (axis) => (axis === 'gx' ? colors.wallR : colors.wallL);
    const faceFill = (axis, atY) => {
      const base = faceOf(axis);
      const grad = floorCtx.createLinearGradient(0, atY - h, 0, atY);
      grad.addColorStop(0, shade(base, 16));
      grad.addColorStop(1, shade(base, -12));
      return grad;
    };

    // Where the outside of the top band sits above each centre-line point:
    // one segment's offset at an end, and both segments' offsets added at a
    // turn, which is the mitre that used to need its own patch.
    const outer = pts.map((p, i) => {
      const before = dep[i - 1];
      const after = dep[i];
      if (!before) return shift(p, after, true);
      if (!after) return shift(p, before, true);
      if (sameVec(before, after)) return shift(p, after, true);
      return shift(p, { x: before.x + after.x, y: before.y + after.y }, true);
    });

    // Cut ends first: whatever stands in front of them is drawn after.
    const endIndex = [0, n];
    endIndex.forEach((i, which) => {
      if (ends[which] !== 'cap') return;
      const d = dep[i === 0 ? 0 : n - 1];
      paintQuad([pts[i], shift(pts[i], d), outer[i], lift(pts[i])],
        shade(faceOf(axes[i === 0 ? 0 : n - 1]), -20), null);
    });

    // The top, as one unbroken band around the whole run -- no seam at the
    // turns because there is nothing there to seam.
    paintQuad(pts.map(lift).concat(outer.slice().reverse()),
      shade(colors.wallL, 46), null);

    // The faces you look at, a segment at a time so a doorway can be left
    // out of one. A hole is a real hole: the strip of wall below the lintel
    // simply is not painted, so the hallway and whoever is walking through it
    // show through the opening instead of being covered by a panel painted to
    // look like one.
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const fill = faceFill(axes[i], a.y);
      const holes = ((apertures && apertures[i]) || [])
        .map(([t0, t1]) => [Math.max(0, t0), Math.min(1, t1)])
        .filter(([t0, t1]) => t1 > t0)
        .sort((x, y) => x[0] - y[0]);
      // Everything either side of the holes, full height. The first piece of
      // each segment after the first starts a hair inside the segment before
      // it, so two fills that only just touch cannot leave a hairline between
      // them where the wall turns.
      let at = 0;
      const solid = [];
      holes.forEach(([t0, t1]) => {
        if (t0 > at) solid.push([at, t0]);
        at = t1;
      });
      if (at < 1) solid.push([at, 1]);
      solid.forEach(([t0, t1], k) => {
        let p0 = lerpPt(a, b, t0);
        const p1 = lerpPt(a, b, t1);
        if (k === 0 && t0 === 0 && i > 0) p0 = pushPast(p0, p1);
        paintQuad([p0, p1, lift(p1), lift(p0)], fill, null);
      });
      // And the wall above each opening.
      holes.forEach(([t0, t1]) => {
        const p0 = lerpPt(a, b, t0);
        const p1 = lerpPt(a, b, t1);
        paintQuad([liftPt(p0, DOOR_HEAD), liftPt(p1, DOOR_HEAD), lift(p1), lift(p0)], fill, null);
      });
      // The line where this stretch of wall meets the floor, broken by the
      // openings -- a doorway has no wall standing on it.
      solid.forEach(([t0, t1]) => {
        strokePolyline([lerpPt(a, b, t0), lerpPt(a, b, t1)], 'rgba(0,0,0,0.45)', 1);
      });
    }

    // One line per edge the solid actually has. The bottom is drawn with the
    // faces above, because the openings break it.
    strokePolyline(pts.map(lift), 'rgba(0,0,0,0.42)', 1);
    strokePolyline(outer, 'rgba(0,0,0,0.34)', 1);
    for (let i = 1; i < n; i++) {
      if (sameVec(dep[i - 1], dep[i])) continue;
      strokePolyline([pts[i], lift(pts[i])], 'rgba(0,0,0,0.26)', 1);
    }
    endIndex.forEach((i, which) => {
      if (ends[which] !== 'cap') return;
      const d = dep[i === 0 ? 0 : n - 1];
      strokePolyline([lift(pts[i]), pts[i], shift(pts[i], d), outer[i]],
        'rgba(0,0,0,0.5)', 1);
    });
  }

  // The two floor corners spanning a corridor's end, in the order that keeps
  // the frame facing the viewer.
  function corridorEnd(c, far) {
    if (c.axis === 'gx') {
      const gx = far ? c.gx0 + c.cols : c.gx0;
      return [isoPoint(gx, c.gy0), isoPoint(gx, c.gy0 + c.rows)];
    }
    const gy = far ? c.gy0 + c.rows : c.gy0;
    return [isoPoint(c.gx0, gy), isoPoint(c.gx0 + c.cols, gy)];
  }

  function drawCorridorShell(c, colors) {
    drawPaving(c, colors, -8);
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
    // The return and the hallway's own wall are one run that turns the corner
    // between them. Neither end is a cut end: the far end butts into the far
    // room's wall, and the near end either carries straight on out of the near
    // room's wall (a hallway flush with the backs of both rooms) or turns out
    // of the end of it by a return.
    const near = c.nearRoom;
    const corner = isoPoint(c.gx0, c.gy0);
    if (c.axis === 'gx') {
      // Running east along the gy0 edge; thickness backs off up and right.
      const far = isoPoint(c.gx0 + c.cols, c.gy0);
      if (near && c.gy0 > near.gy0) {
        drawWallRun([isoPoint(c.gx0, near.gy0), corner, far], ['gy', 'gx'],
          ROOM.wallH, colors, ['open', 'open']);
      } else {
        drawWallRun([corner, far], ['gx'], ROOM.wallH, colors, ['open', 'open']);
      }
    } else {
      // Running south along the gx0 edge; thickness backs off up and left.
      const far = isoPoint(c.gx0, c.gy0 + c.rows);
      if (near && c.gx0 > near.gx0) {
        drawWallRun([isoPoint(near.gx0, c.gy0), corner, far], ['gx', 'gy'],
          ROOM.wallH, colors, ['open', 'open']);
      } else {
        drawWallRun([corner, far], ['gy'], ROOM.wallH, colors, ['open', 'open']);
      }
    }

    // Anyone walking between rooms is drawn by the hallway they are in, back
    // to front like everything else, so they pass behind its far wall and in
    // front of its near one.
    membersInside(c)
      .sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy))
      .forEach((m) => drawMember(isoPoint(m.gx, m.gy), m));
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
    const jamb = DOOR_JAMB;
    const lintel = 10;

    // Nothing is painted across the opening any more: the wall it stands in
    // has a real hole cut in it, so what shows through is the hallway on the
    // other side and whoever is walking down it. A panel here would put the
    // wall back and cut them off at the waist.
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
    floorCtx.fillText(slotCountFor(state.activeTheme, index) + ' SLOTS', top.x, top.y + 27);
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
    rebuildMembers();
    fitZoomToStage();
    fitCanvasResolution();
    applyStageSizing();
    paintScene();
  }

  // Repainting only: no plan rebuild, no measuring the stage window back out
  // of the DOM. The members walking around run the canvas many times a
  // second, and asking the browser to re-lay-out the page that often -- which
  // is what reading the stage's size does -- would cost far more than the
  // drawing itself.
  function paintScene() {
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

    // The hour of the day, laid over everything but under the vignette.
    const sky = skyWash();
    if (sky.a > 0.002) {
      floorCtx.fillStyle = 'rgba(' + sky.r + ',' + sky.g + ',' + sky.b + ',' + sky.a.toFixed(3) + ')';
      floorCtx.fillRect(0, 0, W, H);
    }

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


  function drawRoom(layout, colors, light, roomIndex) {
    const theme = state.activeTheme;
    const place = placements[roomIndex];
    const shape = { cols: place.cols, rows: place.rows };

    const north = isoPoint(place.gx0, place.gy0);
    const east = isoPoint(place.gx0 + place.cols, place.gy0);
    const west = isoPoint(place.gx0, place.gy0 + place.rows);

    // Both back walls are one solid that turns the north corner, not two
    // that meet there, and each end either caps off at the room's open corner
    // or carries straight on into the hallway that leaves from it.
    // The run goes east -> north -> west, so the north wall is walked
    // backwards relative to the direction its doorways are measured in.
    const holes = wallApertures(roomIndex);
    drawWallRun([east, north, west], ['gx', 'gy'], ROOM.wallH, colors, [
      roomWallEnd(place, { gx: place.gx0 + place.cols, gy: place.gy0 }),
      roomWallEnd(place, { gx: place.gx0, gy: place.gy0 + place.rows }),
    ], [holes.ne.map(([t0, t1]) => [1 - t1, 1 - t0]), holes.nw]);

    drawBaseboard(east, north);
    drawBaseboard(north, west);
    const doors = wallDoorSpans(roomIndex);
    drawWallDecor(theme, north, east, west, doors);
    drawRoomFittings(roomFitFor(roomIndex), north, east, west, doors);

    drawPaving(place, colors, 0);

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

    // Gear stands wherever it was put, not in a grid cell, so the draw
    // order comes from the pieces themselves -- furthest back first, or a
    // piece behind another would paint over it.
    const room = activeRooms()[roomIndex];
    const mult = synergyMultipliers(room, shape);
    // Gear and members go down in one sorted pass, so a member walking
    // behind a machine is hidden by it and one walking in front covers it.
    const standing = [];
    layout.forEach((itemId, index) => {
      if (!itemId) return;
      const spot = spotOf(room, index, shape);
      standing.push({ index, itemId, spot });
    });
    membersInside(place).forEach((m) => {
      standing.push({ member: m, spot: { u: m.gx - place.gx0, v: m.gy - place.gy0 } });
    });
    standing.sort((a, b) => (a.spot.u + a.spot.v) - (b.spot.u + b.spot.v));

    standing.forEach(({ index, itemId, spot, member }) => {
      if (member) {
        drawMember(isoPoint(place.gx0 + spot.u, place.gy0 + spot.v), member);
        return;
      }
      const item = itemById(itemId);
      if (!item) return;
      const c = isoPoint(place.gx0 + spot.u, place.gy0 + spot.v);
      if (hoverCell && hoverCell.roomIndex === roomIndex && hoverCell.index === index) {
        floorCtx.save();
        floorCtx.beginPath();
        floorCtx.ellipse(c.x, c.y + 2, PROP_TILE * 0.36, PROP_TILE * 0.18, 0, 0, Math.PI * 2);
        floorCtx.strokeStyle = 'rgba(255,255,255,0.75)';
        floorCtx.lineWidth = 1.6;
        floorCtx.stroke();
        floorCtx.restore();
      }
      drawProp(itemId, c, mult[index], propScaleFor(itemId),
        gearInUse.has(roomIndex + ':' + index), tierOf(itemId));
    });

    if (editing && editing.roomIndex === roomIndex) {
      drawHeldPiece(place, editing);
    }
  }

  // The piece in your hands: a marked footprint on the floor so you can see
  // exactly where it will stand, and the piece itself above it, lifted a
  // little and lightened so it reads as held rather than placed.
  function drawHeldPiece(place, held) {
    const c = isoPoint(place.gx0 + held.spot.u, place.gy0 + held.spot.v);
    const s = propScaleFor(held.itemId);
    const rx = ROOM.tileW * 0.3 * s * 1.5;
    const ry = ROOM.tileH * 0.3 * s * 1.5;

    floorCtx.save();
    floorCtx.beginPath();
    floorCtx.ellipse(c.x, c.y + 2, rx, ry, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = 'rgba(255,183,3,0.16)';
    floorCtx.fill();
    floorCtx.strokeStyle = 'rgba(255,183,3,0.95)';
    floorCtx.lineWidth = 1.8;
    floorCtx.setLineDash([5, 4]);
    floorCtx.stroke();
    floorCtx.setLineDash([]);
    floorCtx.restore();

    floorCtx.save();
    floorCtx.globalAlpha = 0.82;
    drawProp(held.itemId, { x: c.x, y: c.y - 10 }, 1, propScaleFor(held.itemId));
    floorCtx.restore();
  }

  // One piece of gear, standing at c. Everything it is made of -- sprite or
  // built shape, shadow, category pool, synergy ring -- is drawn at its
  // native size inside a transform that scales about the piece's own base,
  // so a single number changes how big gear is relative to the room without
  // touching a line of the artwork.
  // A rounded rectangle as a path. Members are built out of these rather
  // than boxes skewed into the projection: a person is drawn as a flat
  // billboard standing on the floor, the same way the equipment art is.
  function roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // A member, flat-shaded to sit alongside the equipment art. Everything is
  // a proportion of body height, so a member stands the right height next to
  // a squat rack whatever the room's scale, and arms and legs swing opposite
  // each other over a slight bob so a busy room reads as moving rather than
  // as a row of standing dolls.
  function drawMember(c, m) {
    const ctx = floorCtx;
    const H = 1.72 * PX_PER_METRE_TALL;
    // Working a machine is a smaller, quicker movement than walking to it.
    const busy = m.state === 'using';
    const swing = busy ? 0.22 : 1;
    const t = Math.sin(m.phase) * swing;
    const f = m.facing;
    const y = c.y - Math.abs(Math.cos(m.phase)) * H * 0.014 * swing;
    const X = (v) => c.x + v * H * f;
    const Y = (v) => y - v * H;
    const line = 'rgba(0,0,0,0.38)';
    const pen = Math.max(0.5, H * 0.008);

    const outline = () => {
      ctx.strokeStyle = line;
      ctx.lineWidth = pen;
      ctx.stroke();
    };
    // A limb or a block: centred on cx, running from `top` down to `bottom`.
    const bar = (cx, top, bottom, w, color) => {
      roundRectPath(ctx, X(cx) - (w * H) / 2, Y(top), w * H, (top - bottom) * H, w * H * 0.42);
      ctx.fillStyle = color;
      ctx.fill();
      outline();
    };

    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 2, H * 0.10, H * 0.043, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fill();

    const legFront = '#454b57';
    const legBack = '#333842';
    const shorts = shade(m.shirt, -58);

    // Back limbs first, darkened, so the figure has some depth to it.
    bar(-0.125 + t * 0.05, 0.80, 0.545, 0.052, shade(m.skin, -38));
    bar(-0.052 - t * 0.08, 0.435, 0.045, 0.078, legBack);
    bar(-0.052 - t * 0.08, 0.062, 0.006, 0.098, '#b9c2cc');

    // Front leg and its shoe.
    bar(0.052 + t * 0.08, 0.435, 0.045, 0.078, legFront);
    bar(0.052 + t * 0.08, 0.062, 0.006, 0.098, '#e9edf2');

    bar(0, 0.545, 0.40, 0.215, shorts);

    // Torso, tapered shoulder to waist rather than a straight block.
    const shoulder = 0.118;
    const waist = 0.092;
    ctx.beginPath();
    roundedQuadPath(ctx,
      { x: X(-shoulder), y: Y(0.845) }, { x: X(shoulder), y: Y(0.845) },
      { x: X(waist), y: Y(0.515) }, { x: X(-waist), y: Y(0.515) }, H * 0.035);
    ctx.fillStyle = m.shirt;
    ctx.fill();
    outline();
    // A lit edge down the side the room's lights come from.
    ctx.beginPath();
    roundedQuadPath(ctx,
      { x: X(0.045), y: Y(0.83) }, { x: X(0.105), y: Y(0.83) },
      { x: X(0.082), y: Y(0.53) }, { x: X(0.03), y: Y(0.53) }, H * 0.02);
    ctx.fillStyle = shade(m.shirt, 30);
    ctx.fill();

    bar(0.125 - t * 0.05, 0.80, 0.545, 0.052, m.skin);

    // Staff wear a marked shirt, so who works here is readable at a glance.
    if (m.staffRole) {
      bar(0, 0.855, 0.815, 0.20, STAFF_TRIM);
      bar(-0.055, 0.70, 0.655, 0.038, STAFF_TRIM);
    }

    // Neck, head, then hair sitting on top of it.
    bar(0.006, 0.885, 0.83, 0.05, shade(m.skin, -18));
    ctx.beginPath();
    ctx.arc(X(0.008), Y(0.915), H * 0.078, 0, Math.PI * 2);
    ctx.fillStyle = m.skin;
    ctx.fill();
    outline();
    ctx.beginPath();
    ctx.arc(X(0.008), Y(0.928), H * 0.078, Math.PI * 1.02, Math.PI * 2.12);
    ctx.fillStyle = m.hair;
    ctx.fill();
  }

  // Which pieces have somebody on them right now, keyed room and slot. Kept
  // as a set built once a frame rather than searched per piece, because the
  // draw loop asks about every piece on every floor.
  let gearInUse = new Set();
  function refreshGearInUse() {
    const next = new Set();
    members.forEach((m) => {
      if (m.state === 'using' && m.gear !== null) next.add(m.room + ':' + m.gear);
    });
    gearInUse = next;
  }

  function drawProp(itemId, c, mult, scale, busy, tier) {
    const catColor = CATEGORY_META[CATEGORY[itemId]].color;
    floorCtx.save();
    floorCtx.translate(c.x, c.y);
    floorCtx.scale(scale, scale);
    floorCtx.translate(-c.x, -c.y);

    // A glowing ring means this piece is currently getting a synergy
    // bonus from what is standing near it -- the payoff for arrangement.
    if (mult > 1) {
      floorCtx.beginPath();
      floorCtx.ellipse(c.x, c.y + 3, ROOM.tileW * 0.30, ROOM.tileH * 0.26, 0, 0, Math.PI * 2);
      floorCtx.strokeStyle = hexA(catColor, 0.7);
      floorCtx.lineWidth = 1.1;
      floorCtx.shadowColor = catColor;
      floorCtx.shadowBlur = 4;
      floorCtx.stroke();
      floorCtx.shadowBlur = 0;
    }

    // Soft contact shadow underneath, plus the crisper category-tinted pool
    // on top -- reads as the item actually sitting on the floor instead of a
    // flat sticker. The softness is a gradient that fades to nothing at the
    // rim, not an ellipse run through a blur filter: a canvas filter
    // re-rasterises the region it touches, and with one under every piece of
    // gear that single call cost nine tenths of the entire frame.
    const shadowR = ROOM.tileW * 0.34;
    const soft = floorCtx.createRadialGradient(c.x, c.y + 4, shadowR * 0.15, c.x, c.y + 4, shadowR);
    soft.addColorStop(0, 'rgba(0,0,0,0.42)');
    soft.addColorStop(0.55, 'rgba(0,0,0,0.28)');
    soft.addColorStop(1, 'rgba(0,0,0,0)');
    floorCtx.beginPath();
    floorCtx.ellipse(c.x, c.y + 4, shadowR, ROOM.tileH * 0.30, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = soft;
    floorCtx.fill();

    // A piece with somebody working it lights up under them and breathes,
    // so a busy gym reads as busy at a glance -- and so that a member
    // standing at a machine looks different from one standing beside it.
    const pulse = busy ? 0.5 + 0.5 * Math.sin(performance.now() / 380) : 0;
    floorCtx.beginPath();
    floorCtx.ellipse(c.x, c.y + 3, ROOM.tileW * (0.28 + pulse * 0.05),
      ROOM.tileH * (0.24 + pulse * 0.05), 0, 0, Math.PI * 2);
    floorCtx.fillStyle = hexA(catColor, 0.34 + (busy ? 0.20 + pulse * 0.16 : 0));
    floorCtx.fill();
    if (busy) {
      floorCtx.beginPath();
      floorCtx.ellipse(c.x, c.y + 3, ROOM.tileW * (0.33 + pulse * 0.06),
        ROOM.tileH * (0.28 + pulse * 0.06), 0, 0, Math.PI * 2);
      floorCtx.strokeStyle = hexA(catColor, 0.5 - pulse * 0.28);
      floorCtx.lineWidth = 1.2;
      floorCtx.stroke();
    }

    // An upgraded piece carries its mark: one pip per tier above the first,
    // set into the floor in front of it, so a room of Mk III treadmills
    // reads differently from a room of new ones without having to be told.
    if (tier > 1) {
      for (let i = 0; i < tier - 1; i++) {
        const px = c.x + (i - (tier - 2) / 2) * ROOM.tileW * 0.12;
        floorCtx.beginPath();
        floorCtx.ellipse(px, c.y + ROOM.tileH * 0.42, ROOM.tileW * 0.035,
          ROOM.tileH * 0.035, 0, 0, Math.PI * 2);
        floorCtx.fillStyle = hexA(catColor, 0.95);
        floorCtx.fill();
      }
    }

    const sprite = itemSprites[itemId];
    const drewSprite = sprite && drawItemSprite(floorCtx, c, sprite, itemId);
    const build = PROP_BUILDERS[itemId];
    if (drewSprite) {
      // real icon art, already drawn above
    } else if (build) {
      build(floorCtx, c);
    } else {
      // Every current item has a PROP_BUILDER; this is just a safety net for
      // a future item that doesn't yet, drawn as a plain block.
      drawIsoBox(floorCtx, c, 0, 0, 0.24, 0.24, 20, catColor, 0);
    }
    floorCtx.restore();
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
      // Holding a piece turns a drag into carrying it. Panning is still
      // there -- it is just what a drag does when your hands are empty.
      carrying: !!editing,
    };
    gestureEl.style.cursor = editing ? 'grabbing' : 'grabbing';
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
    if (dragState.carrying) {
      const p = pointFromEvent(e);
      const hit = spotFromPoint(p.x, p.y);
      if (hit && editing && hit.roomIndex === editing.roomIndex) moveEditTo(hit.u, hit.v);
      return;
    }
    panBy(dx, dy);
  });

  function samePiece(a, b) {
    return (!a && !b)
      || (!!a && !!b && a.roomIndex === b.roomIndex && a.index === b.index);
  }

  function setHoverCell(next) {
    if (samePiece(hoverCell, next)) return;
    hoverCell = next;
    // Only fires when the pointer crosses onto a different piece, not on
    // every mouse move, so this is a handful of repaints a second at most.
    renderScene();
  }

  function restCursor() {
    gestureEl.style.cursor = hoverCell ? 'pointer' : 'grab';
  }

  gestureEl.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (dragState || pinchState || editing) { setHoverCell(null); return; }
    const p = pointFromEvent(e);
    setHoverCell(pieceAtPoint(p.x, p.y));
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
    const wasCarry = dragState.carrying;
    dragState = null;
    restCursor();
    if (wasDrag || wasCarry) return;

    const p = pointFromEvent(e);
    onFloorTap(p.x, p.y);
  });

  // A trackpad pinch arrives as a wheel event with ctrlKey set, and ctrl with
  // a mouse wheel is the same gesture by hand -- with the +/- buttons gone
  // this is the whole zoom story for a pointer, so the rate is exponential
  // (every notch the same proportional step, in or out) and gentle enough
  // that one notch is a nudge rather than a jump. A plain wheel is left
  // alone, so the page still scrolls normally over the canvas.
  const WHEEL_ZOOM_RATE = 0.002;
  gestureEl.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomAround(zoomLevel * Math.exp(-e.deltaY * WHEEL_ZOOM_RATE), e.clientX, e.clientY);
  }, { passive: false });

  gestureEl.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchState = null;
    dragState = null;
    restCursor();
  });

  // ---- Placing gear ----
  // Nothing is dropped straight onto the floor any more. Picking a piece --
  // from the tray, or by tapping one already down -- takes hold of it: it
  // follows your finger, the pad nudges it a few pixels at a time, and it
  // only settles where it is when you say so. Cancelling puts it back
  // exactly where it came from.
  //
  // editing = { itemId, roomIndex, spot, fromIndex }
  //   fromIndex is the slot it was lifted out of, or null if it came from
  //   the tray -- which is what tells cancel where to put it back.
  let editing = null;

  function editShape() {
    return roomShapeFor(state.activeTheme, editing.roomIndex);
  }

  function beginEdit(itemId, roomIndex, spot, fromIndex) {
    const shape = roomShapeFor(state.activeTheme, roomIndex);
    const at = clampSpot(snapSpot(spot.u, spot.v), shape, itemId);
    editing = {
      itemId,
      roomIndex,
      spot: at,
      // Where it stood when it was picked up -- the position itself, not the
      // snapped working copy, so cancelling a piece that was sitting between
      // two steps of the grid puts it back between them.
      originSpot: { u: spot.u, v: spot.v },
      fromIndex: fromIndex === undefined ? null : fromIndex,
    };
    armedItemId = null;
    hoverCell = null;
    refreshPlaceHud();
    renderScene();
    renderInventory();
  }

  // Take a piece already on the floor back into your hands. Its slot is
  // emptied now so the room reads as it will if you leave the piece
  // elsewhere; cancel puts it back in the same slot.
  function liftPiece(roomIndex, index) {
    const room = activeRooms()[roomIndex];
    const shape = roomShapeFor(state.activeTheme, roomIndex);
    const itemId = room.layout[index];
    if (!itemId) return;
    const spot = spotOf(room, index, shape);
    room.layout[index] = null;
    if (room.spots) room.spots[index] = null;
    beginEdit(itemId, roomIndex, spot, index);
    recomputeStats();
  }

  function moveEditTo(u, v) {
    if (!editing) return;
    editing.spot = clampSpot(snapSpot(u, v), editShape(), editing.itemId);
    renderScene();
  }

  function nudgeEdit(du, dv) {
    if (!editing) return;
    moveEditTo(editing.spot.u + du * SPOT_STEP, editing.spot.v + dv * SPOT_STEP);
  }

  function endEdit() {
    editing = null;
    refreshPlaceHud();
    renderScene();
    renderInventory();
    recomputeStats();
    refreshRoomActions();
    save();
  }

  function confirmEdit() {
    if (!editing) return;
    const room = activeRooms()[editing.roomIndex];
    // Back into the slot it came from where there is one, so moving a piece
    // does not quietly reshuffle a full room.
    let slot = editing.fromIndex;
    if (slot === null || room.layout[slot]) slot = room.layout.indexOf(null);
    if (slot === -1) { cancelEdit(); return; }
    if (!room.spots) room.spots = new Array(room.layout.length).fill(null);
    room.layout[slot] = editing.itemId;
    room.spots[slot] = editing.spot;
    endEdit();
  }

  function cancelEdit() {
    if (!editing) return;
    if (editing.fromIndex !== null) {
      // It was already on the floor: put it back exactly where it stood.
      const room = activeRooms()[editing.roomIndex];
      if (!room.layout[editing.fromIndex]) {
        room.layout[editing.fromIndex] = editing.itemId;
        if (!room.spots) room.spots = new Array(room.layout.length).fill(null);
        room.spots[editing.fromIndex] = editing.originSpot;
      }
    }
    endEdit();
  }

  // Only offered for a piece lifted off the floor -- a piece from the tray
  // is already stored.
  function storeEdit() {
    if (!editing || editing.fromIndex === null) return;
    endEdit();
  }

  // Lattice coordinates of a point, as floats, plus which room it lands in.
  function spotFromPoint(px, py) {
    const dx = px - worldOrigin.x;
    const dy = py - worldOrigin.y;
    const a = dx / (ROOM.tileW / 2);
    const b = dy / (ROOM.tileH / 2);
    const gx = (a + b) / 2;
    const gy = (b - a) / 2;
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      if (gx >= p.gx0 && gx <= p.gx0 + p.cols && gy >= p.gy0 && gy <= p.gy0 + p.rows) {
        return { roomIndex: i, u: gx - p.gx0, v: gy - p.gy0 };
      }
    }
    return null;
  }

  // How close a tap has to land to count as grabbing a piece: within the
  // piece as drawn, give or take. A dumbbell is a small target and a
  // treadmill is a big one, which is exactly right.
  function pickReachFor(itemId) {
    return Math.max(0.9, (drawSizeOf(itemId) / 2) * TILES_PER_METRE);
  }

  function pieceAtPoint(px, py) {
    const hit = spotFromPoint(px, py);
    if (!hit) return null;
    const room = activeRooms()[hit.roomIndex];
    if (!room) return null;
    const shape = roomShapeFor(state.activeTheme, hit.roomIndex);
    let best = null;
    room.layout.forEach((id, i) => {
      if (!id) return;
      const sp = spotOf(room, i, shape);
      const d = Math.hypot(sp.u - hit.u, sp.v - hit.v);
      if (d <= pickReachFor(id) && (!best || d < best.d)) best = { index: i, d };
    });
    return best ? { roomIndex: hit.roomIndex, index: best.index } : null;
  }

  // What a tap on the plan does, in order: move the piece you are holding,
  // pick up the piece you tapped, or just make that room the active one.
  function onFloorTap(px, py) {
    const hit = spotFromPoint(px, py);
    if (editing) {
      if (hit && hit.roomIndex === editing.roomIndex) moveEditTo(hit.u, hit.v);
      return;
    }
    if (!hit) return;
    if (hit.roomIndex !== state.activeRoomIndex) {
      state.activeRoomIndex = hit.roomIndex;
      refreshRoomActions();
      refreshSynergyText();
    }
    const piece = pieceAtPoint(px, py);
    if (piece) liftPiece(piece.roomIndex, piece.index);
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
      const held = editing && editing.itemId === item.id && editing.fromIndex === null;
      chip.className = 'tycoon-inv-item' + (held ? ' is-armed' : '');

      const armBtn = document.createElement('button');
      armBtn.type = 'button';
      armBtn.className = 'tycoon-inv-arm';
      armBtn.innerHTML = '<span class="inv-cat-dot" style="background:' + cat.color + '"></span>'
        + '<span class="inv-icon">' + iconMarkup(item.id, 15) + '</span> '
        + item.name + ' <span class="inv-count">x' + availableCount(item.id) + '</span>';
      armBtn.addEventListener('click', () => {
        if (editing && editing.itemId === item.id && editing.fromIndex === null) {
          cancelEdit();
          return;
        }
        if (availableCount(item.id) <= 0) return;
        const idx = state.activeRoomIndex;
        const shape = roomShapeFor(state.activeTheme, idx);
        // It appears in the middle of the room you are looking at, which is
        // both visible and somewhere you can drag it from.
        beginEdit(item.id, idx, { u: shape.cols / 2, v: shape.rows / 2 }, null);
        scrollToRoom(idx);
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
      const unlocked = unlockedFor(t);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tycoon-theme-btn' + (state.activeTheme === t.id ? ' is-active' : '') + (unlocked ? '' : ' is-locked');
      btn.innerHTML = unlocked ? t.name
        : t.name + ' <span class="btn-lock-icon">' + iconMarkup('lock', 11) + '</span> Lv ' + t.unlockLevel;
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
        refreshRoomActions();
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
  // There used to be a tab per room here, to pick which one you were looking
  // at. Panning and pinching does that job better -- the whole chain is one
  // plan you move around, and clicking any room's floor makes it the active
  // one -- so all that is left is the control for buying the next room.
  const roomActionsEl = document.getElementById('room-actions');
  function refreshRoomActions() {
    if (!roomActionsEl) return;
    roomActionsEl.innerHTML = '';
    const rooms = activeRooms();
    if (rooms.length >= MAX_ROOMS_PER_THEME) return;

    const cost = ROOM_UNLOCK_COSTS[rooms.length];
    const affordable = state.balance >= cost;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tycoon-add-room' + (affordable ? '' : ' is-locked');
    btn.textContent = '+ Add Room (' + slotCountFor(state.activeTheme, rooms.length)
      + ' slots) — $' + formatNum(cost);
    btn.disabled = !affordable;
    btn.addEventListener('click', () => {
      if (state.balance < cost) return;
      const before = currentLevel();
      state.balance -= cost;
      // Taking on a room is progress like any other purchase, and a big one.
      state.xp = (state.xp || 0) + xpForSpend(cost);
      rooms.push(emptyGymRoom(state.activeTheme, rooms.length));
      state.activeRoomIndex = rooms.length - 1;
      if (currentLevel() > before) announceLevel(currentLevel());
      rebuildPlan();
      refreshHud();
      refreshLevelUI();
      refreshShopUI();
      renderScene();
      renderInventory();
      refreshThemeRow();
      refreshSynergyText();
      refreshRoomActions();
      scrollToRoom(state.activeRoomIndex);
      save();
    });
    roomActionsEl.appendChild(btn);
  }

  // ---- The placement pad ----
  // Arrows to nudge, and the two decisions. Kept as real buttons over the
  // stage rather than drawn into the canvas so they are proper tap targets
  // and can be reached by keyboard.
  const placeHudEl = document.getElementById('place-hud');
  const placeLabelEl = document.getElementById('place-label');
  const placeStoreBtn = document.getElementById('btn-place-store');

  function refreshPlaceHud() {
    if (!placeHudEl) return;
    placeHudEl.hidden = !editing;
    if (!editing) return;
    const item = itemById(editing.itemId);
    if (placeLabelEl) {
      placeLabelEl.textContent = (item ? item.name : 'Gear')
        + (editing.fromIndex === null ? ' -- drag or nudge, then place' : ' -- moving');
    }
    if (placeStoreBtn) placeStoreBtn.hidden = editing.fromIndex === null;
  }

  if (placeHudEl) {
    // Screen directions, not lattice ones: up moves the piece away from you
    // up the floor, which on this projection is a step back along both axes.
    const NUDGE = { up: [-1, -1], down: [1, 1], left: [-1, 1], right: [1, -1] };
    placeHudEl.querySelectorAll('[data-nudge]').forEach((btn) => {
      const [du, dv] = NUDGE[btn.dataset.nudge];
      const step = () => nudgeEdit(du, dv);
      btn.addEventListener('click', step);
      // Press and hold to keep nudging, the way an arrow pad should behave.
      let hold = null;
      let repeat = null;
      const stop = () => { clearTimeout(hold); clearInterval(repeat); hold = null; repeat = null; };
      btn.addEventListener('pointerdown', () => {
        hold = setTimeout(() => { repeat = setInterval(step, 60); }, 320);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
    });
    document.getElementById('btn-place-confirm').addEventListener('click', confirmEdit);
    document.getElementById('btn-place-cancel').addEventListener('click', cancelEdit);
    if (placeStoreBtn) placeStoreBtn.addEventListener('click', storeEdit);
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
    editing = null;
    refreshHud();
    refreshSynergyText();
    refreshShopUI();
    renderScene();
    renderInventory();
    refreshThemeRow();
    refreshRoomActions();
    save();
  });

  // ---- Zoom buttons ----

  // ---- Init ----
  buildShop();
  buildStaffUI();
  refreshFranchiseUI();
  refillJobs();
  refreshRushUI();
  refreshStaffUI();
  refreshHud();
  refreshLevelUI();
  refreshJobsUI();
  refreshSynergyText();
  refreshShopUI();
  renderScene();
  renderInventory();
  refreshThemeRow();
  refreshRoomActions();

  // The plot sign for the next room lights up once you can afford it, so the
  // scene has to be redrawn on the tick that crosses the price -- the loop
  // below otherwise only touches the HUD and the buttons.
  let couldAffordNextRoom = null;
  function nextRoomAffordable() {
    const rooms = activeRooms();
    if (rooms.length >= MAX_ROOMS_PER_THEME) return null;
    return state.balance >= ROOM_UNLOCK_COSTS[rooms.length];
  }

  // Earnings come off the wall clock rather than off a tick count, because
  // a background tab does not get the ticks it was promised: browsers
  // throttle setInterval there to about one a second, or one a minute, so
  // counting ticks would quietly pay out at the wrong rate. Measuring the
  // real gap pays exactly the time that passed -- and a hidden tab is paid
  // for none of it.
  let lastTickAt = Date.now();
  let lastRush = -1;

  setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTickAt) / 1000;
    lastTickAt = now;
    if (document.hidden) return;

    // The rush moves on its own, so the rate has to be recomputed as it
    // does -- but only when it has actually shifted, not ten times a second.
    const rush = rushFactor();
    if (Math.abs(rush - lastRush) > 0.004) {
      lastRush = rush;
      recomputeStats();
      refreshRushUI();
      membersKey = '';
    }

    state.balance += gps * dt;
    state.lifetime += gps * dt;
    refreshHud();
    refreshJobsUI();
    refreshShopUI();
    refreshStaffUI();
    refreshFranchiseUI();
    refreshThemeRow();
    refreshRoomActions();

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

  // ---- The place in motion ----
  // Members are stepped on a capped frame rate rather than every animation
  // frame: a walk reads fine at twenty a second and costs a third of what
  // sixty would on a phone. An empty gym repaints not at all, and nothing
  // runs at all while the tab is hidden -- the same rule the earnings follow.
  const MEMBER_FPS = 20;
  let lastFrameAt = 0;
  // Scrolled past the plan, there is nothing to animate for. The observer is
  // a cheap way to know that without asking the browser for the stage's
  // position every frame.
  let stageOnScreen = true;
  if (stageScrollEl && window.IntersectionObserver) {
    new IntersectionObserver((entries) => {
      stageOnScreen = entries[entries.length - 1].isIntersecting;
    }, { rootMargin: '80px' }).observe(stageScrollEl);
  }
  function animateMembers(now) {
    requestAnimationFrame(animateMembers);
    if (document.hidden || !stageOnScreen) {
      lastFrameAt = 0;
      return;
    }
    if (!lastFrameAt) {
      lastFrameAt = now;
      return;
    }
    if (now - lastFrameAt < 1000 / MEMBER_FPS) return;
    const dt = Math.min(0.25, (now - lastFrameAt) / 1000);
    lastFrameAt = now;
    if (!members.length) return;
    stepMembers(dt);
    refreshGearInUse();
    paintScene();
  }
  requestAnimationFrame(animateMembers);

  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      save();
      return;
    }
    // Back on screen: restart the clock here. The last tick while hidden
    // could have been a minute ago, and without this the first tick back
    // would pay out that whole minute away.
    lastTickAt = Date.now();
  });
})();
