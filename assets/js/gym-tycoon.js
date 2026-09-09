(function () {
  const hudTotal = document.getElementById('hud-total');
  if (!hudTotal) return;

  const SAVE_KEY = 'gymTycoonSave';
  const COST_GROWTH = 1.15;
  const TICK_MS = 100;

  const ITEMS = [
    // The first thing on any floor. Every location needs one before it takes
    // a cent or sells you anything: the first is yours for nothing, and the
    // next locations each buy their own. It earns a trickle of membership
    // fees on its own, which is what the first dumbbell set is bought with.
    // The desk earns nothing. It opens the doors, and that is all it does:
    // the first money comes from the trophy for putting it down, and after
    // that from tapping the bubbles. Nothing pays into the balance by
    // itself until there is a cashier to carry it there.
    { id: 'frontdesk', name: 'Customer Desk', baseCost: 2500, gps: 0, starter: true },
    { id: 'dumbbell', name: 'Dumbbell Set', baseCost: 25, gps: 0.1 },
    { id: 'dumbbellrack', name: 'Dumbbell Rack', baseCost: 60, gps: 0.22 },
    { id: 'mat', name: 'Yoga Mat', baseCost: 100, gps: 0.5 },
    { id: 'bench', name: 'Bench Press', baseCost: 320, gps: 2 },
    { id: 'rack', name: 'Squat Rack', baseCost: 1200, gps: 8 },
    { id: 'cable', name: 'Cable Machine', baseCost: 4500, gps: 30 },
    { id: 'treadmill', name: 'Treadmill', baseCost: 15000, gps: 100 },
    // The counter. These earn on the floor like anything else, and on top of
    // that they make stock: you start a batch, it takes real time to run,
    // and what comes off the counter is what the delivery orders on the Jobs
    // tab ask for. Everything else in the game is a rate; this is the one
    // thing that is a queue.
    { id: 'juicebar', name: 'Juice Bar', baseCost: 36000, gps: 250, unlockLevel: 3 },
    { id: 'sauna', name: 'Sauna', baseCost: 220000, gps: 1500 },
    { id: 'gearfridge', name: 'Gear Fridge', baseCost: 900000, gps: 6000 },
    { id: 'proshop', name: 'Pro Shop', baseCost: 2200000, gps: 15000, unlockLevel: 7 },
    { id: 'soundsystem', name: 'Hype Sound System', baseCost: 3600000, gps: 25000 },
    // Office tier: hidden in the shop until the gym is established enough to
    // need one -- the "then you hire people" stage after the core equipment.
    { id: 'desk', name: "Manager's Desk", baseCost: 14000000, gps: 100000, unlockLevel: 6 },
    { id: 'cubicle', name: 'Sales Cubicle', baseCost: 56000000, gps: 400000, unlockLevel: 8 },
    { id: 'officepod', name: 'Corner Office Pod', baseCost: 220000000, gps: 1600000, unlockLevel: 10 },

    // Fittings. These earn nothing on their own -- what they do is make the
    // room somewhere people want to be, and a room people want to be in
    // works harder. Every one of them takes a slot a machine could have had,
    // which is the decision: floor space for a multiplier on the space that
    // is left.
    { id: 'palm', name: 'Potted Palm', baseCost: 1400, vibe: 1, unlockLevel: 2 },
    { id: 'cooler', name: 'Water Cooler', baseCost: 11000, vibe: 2, unlockLevel: 3 },
    { id: 'mirrorwall', name: 'Mirror Wall', baseCost: 130000, vibe: 3, unlockLevel: 5 },
    { id: 'neon', name: 'Neon Sign', baseCost: 1700000, vibe: 5, unlockLevel: 7 },
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
    juicebar: '<path d="M6.2 6.6h11.6l-1.5 13.2a2.4 2.4 0 0 1-2.4 2.1h-3.8a2.4 2.4 0 0 1-2.4-2.1Z"/><rect x="5.2" y="3.6" width="13.6" height="2.6" rx="1.3"/><path d="M14.4 2.2l2.6 1-3.4 4.2-1.6-1Z"/>',
    proshop: '<path d="M9.4 3.4h5.2a2.6 2.6 0 0 1-5.2 0Z"/><path d="M8.6 3.6 4 6.9l2.3 3.5 2-1.2v11h11.4v-11l2 1.2L24 6.9l-4.6-3.3h-1.2a5 5 0 0 1-9.4 0Z" transform="translate(-1)"/>',
    trainer: '<circle cx="12" cy="6.2" r="3.1"/><rect x="8" y="10.2" width="8" height="9.6" rx="3.2"/>',
    sauna: '<path d="M12 2.2c-1.2 3-4.6 4.7-4.6 9a4.6 4.6 0 0 0 9.2 0c0-2.1-1-3.3-2-4.6.1 1.7-1 2.9-2 2.9-1.2 0-1.7-1.2-1-2.4C13 5.6 13 4 12 2.2Z"/>',
    gearfridge: '<rect x="5.5" y="2" width="13" height="8.6" rx="1.6"/><rect x="5.5" y="12" width="13" height="10" rx="1.6"/><rect x="3.4" y="4.6" width="1.8" height="4" rx="0.9"/><rect x="3.4" y="14.4" width="1.8" height="4.6" rx="0.9"/>',
    soundsystem: '<rect x="5.5" y="2" width="13" height="20" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="8.6" r="3.1"/><circle cx="12" cy="16.8" r="2"/>',
    frontdesk: '<rect x="2.5" y="11" width="19" height="3" rx="1"/><rect x="4" y="14" width="16" height="7" rx="1"/><rect x="9.6" y="6.6" width="4.8" height="4.4" rx="1.2"/><rect x="11.4" y="4.4" width="1.2" height="2.4"/>',
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
    // A second location is a mid-game thing, not a level-2 thing: the first
    // gym should be half built before there is another one to think about.
    { id: 'basement', name: 'Basement', unlockLevel: 5 },
    { id: 'rooftop', name: 'Rooftop', unlockLevel: 8 },
    // The far end of the ladder. Nothing else unlocks past level ten, and
    // forty levels of nothing to look forward to is a long way to walk.
    { id: 'boardwalk', name: 'Boardwalk', unlockLevel: 12 },
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
  // The walls stand a real ceiling height, 2.4 m -- tall enough that a
  // doorway cut in them clears anyone walking through.
  const ROOM = { tileW: 32, tileH: 16, wallH: 145 };

  // Gear is drawn against this reference tile size, so its size on screen is
  // fixed no matter how fine the lattice under it gets. Shrinking the tile
  // to fit a bigger room must not shrink the equipment standing in it.
  const PROP_TILE = 96;

  // Each theme builds to its own floor plan, because a unit, a cellar and a
  // roof are not the same shape of place. Rooms are not one bay stamped out
  // N times either: every position in a chain has its own footprint, and the
  // later ones are bigger, which is most of what they are bought for.
  //
  // The four chains come to 63, 63, 65 and 64 slots, so no theme is a better
  // buy than another for the same run of prices -- what differs is the shape
  // of the space you are arranging gear in.
  // A shape is its bounding box in lattice tiles, and some have a corner
  // taken out of them -- `cut` names which corner and how much of it -- so
  // a chain is not four boxes in a row. 'ne' is the back-right corner, 'sw'
  // the front-left, 'se' the front-right; the back-left is where a hallway
  // comes in, so it is never cut. The starter room of every location is a
  // plain box, because the first thing a new player does is find their feet
  // in it.
  //
  // Always the near corner -- the one facing the camera. A corner taken out
  // of a far side leaves an edge that has to be walled, and a wall standing
  // inside the room hides the floor behind it and hangs over the hole with
  // nothing under it. Taken out of the near corner the floor simply steps
  // back, with the same lip it has along the rest of its front edges, and
  // every line in the room still meets another line.
  //
  // Cuts are kept clear of wherever a hallway meets the room: a hallway
  // leaves by the east or south edge at the back-left end of it, and
  // arrives through the west or north wall, again at the back-left end.
  const ROOM_PLANS = {
    // Vehicle bays knocked through into one another: broad rooms, each a
    // little bigger than the last, with a short walk between them.
    garage: {
      shapes: [
        { cols: 20, rows: 15 },                                        // 12 pieces
        { cols: 22, rows: 17, cut: { corner: 'se', cols: 8, rows: 6 } }, // 14
        { cols: 24, rows: 18, cut: { corner: 'se', cols: 8, rows: 8 } }, // 16
        { cols: 26, rows: 21, cut: { corner: 'se', cols: 9, rows: 6 } }, // 21
      ],
      caps: [12, 14, 16, 21],
      dirs: ['east', 'east', 'south'],
      corridorLen: 9,
      corridorWidth: 9,
    },
    // Cellar rooms strung together by real tunnels that turn corners rather
    // than opening straight onto each other.
    basement: {
      shapes: [
        { cols: 17, rows: 18 },                                        // 12
        { cols: 21, rows: 20, cut: { corner: 'se', cols: 8, rows: 6 } }, // 15
        { cols: 21, rows: 21, cut: { corner: 'se', cols: 8, rows: 6 } }, // 16
        { cols: 23, rows: 23, cut: { corner: 'se', cols: 9, rows: 8 } }, // 20
      ],
      caps: [12, 15, 16, 20],
      dirs: ['south', 'east', 'south'],
      corridorLen: 18,
      corridorWidth: 9,
    },
    // Open deck: broad platforms that spread across the roof, joined by
    // walkways wide enough to read as outdoors.
    rooftop: {
      shapes: [
        { cols: 18, rows: 17 },                                        // 12
        { cols: 21, rows: 18, cut: { corner: 'se', cols: 6, rows: 6 } }, // 15
        { cols: 23, rows: 21, cut: { corner: 'se', cols: 8, rows: 6 } }, // 18
        { cols: 24, rows: 21, cut: { corner: 'se', cols: 8, rows: 6 } }, // 20
      ],
      caps: [12, 15, 18, 20],
      dirs: ['east', 'south', 'west'],
      corridorLen: 14,
      corridorWidth: 14,
    },
    // Decking out over the water, joined by walkways with room to stop on.
    boardwalk: {
      shapes: [
        { cols: 18, rows: 17 },                                        // 12
        { cols: 21, rows: 18, cut: { corner: 'se', cols: 6, rows: 5 } }, // 16
        { cols: 23, rows: 20, cut: { corner: 'se', cols: 8, rows: 6 } }, // 17
        { cols: 24, rows: 21, cut: { corner: 'se', cols: 9, rows: 6 } }, // 19
      ],
      caps: [12, 16, 17, 19],
      dirs: ['east', 'south', 'east'],
      corridorLen: 15,
      corridorWidth: 11,
    },
  };

  function planFor(themeId) {
    return ROOM_PLANS[themeId] || ROOM_PLANS.garage;
  }
  function roomShapeFor(themeId, index) {
    const shapes = planFor(themeId).shapes;
    return shapes[index % shapes.length];
  }

  // ---- Cut corners ----
  // The notch taken out of a shape or a placed room, as a rectangle in the
  // same coordinates (a shape has no gx0/gy0 and so is measured from its own
  // back corner). Null for a plain box.
  function cutRect(r) {
    const c = r && r.cut;
    if (!c) return null;
    const gx0 = r.gx0 || 0;
    const gy0 = r.gy0 || 0;
    return {
      gx0: c.corner === 'ne' || c.corner === 'se' ? gx0 + r.cols - c.cols : gx0,
      gy0: c.corner === 'sw' || c.corner === 'se' ? gy0 + r.rows - c.rows : gy0,
      cols: c.cols,
      rows: c.rows,
    };
  }
  function inRect(r, gx, gy) {
    return gx >= r.gx0 && gx < r.gx0 + r.cols && gy >= r.gy0 && gy < r.gy0 + r.rows;
  }
  // Whether a point is on this room's floor: inside its box and not in the
  // notch.
  function onFloorOf(r, gx, gy) {
    const gx0 = r.gx0 || 0;
    const gy0 = r.gy0 || 0;
    if (gx < gx0 || gx >= gx0 + r.cols || gy < gy0 || gy >= gy0 + r.rows) return false;
    const c = cutRect(r);
    return !(c && inRect(c, gx, gy));
  }
  // The floor's outline as lattice corners, walked clockwise from the back
  // corner: four for a box, six for an L.
  function floorPolygon(r) {
    const gx0 = r.gx0 || 0;
    const gy0 = r.gy0 || 0;
    const gx1 = gx0 + r.cols;
    const gy1 = gy0 + r.rows;
    const c = r.cut;
    if (!c) return [[gx0, gy0], [gx1, gy0], [gx1, gy1], [gx0, gy1]];
    if (c.corner === 'ne') {
      return [[gx0, gy0], [gx1 - c.cols, gy0], [gx1 - c.cols, gy0 + c.rows],
        [gx1, gy0 + c.rows], [gx1, gy1], [gx0, gy1]];
    }
    if (c.corner === 'sw') {
      return [[gx0, gy0], [gx1, gy0], [gx1, gy1], [gx0 + c.cols, gy1],
        [gx0 + c.cols, gy1 - c.rows], [gx0, gy1 - c.rows]];
    }
    return [[gx0, gy0], [gx1, gy0], [gx1, gy1 - c.rows], [gx1 - c.cols, gy1 - c.rows],
      [gx1 - c.cols, gy1], [gx0, gy1]];
  }
  // The inside corner of the notch, stepped half a tile onto the floor --
  // the point a walk across the room goes round.
  function innerCornerOf(r) {
    const c = cutRect(r);
    if (!c) return null;
    const k = r.cut.corner;
    return {
      gx: k === 'sw' ? c.gx0 + c.cols + 0.5 : c.gx0 - 0.5,
      gy: k === 'ne' ? c.gy0 + c.rows + 0.5 : c.gy0 - 0.5,
    };
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
        out.push({ gx0: 0, gy0: 0, cols: shape.cols, rows: shape.rows, cut: shape.cut || null });
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
      out.push({ gx0, gy0, cols: shape.cols, rows: shape.rows, cut: shape.cut || null });
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
  // Booster-category gear (fridge/sound system) instead boosts ANY different
  // category neighbor, so it's worth spreading those around rather than
  // clustering them.
  const CATEGORY = {
    dumbbell: 'strength', dumbbellrack: 'strength', bench: 'strength', rack: 'strength', cable: 'strength',
    treadmill: 'cardio',
    juicebar: 'counter', proshop: 'counter',
    mat: 'recovery', sauna: 'recovery',
    gearfridge: 'booster', soundsystem: 'booster',
    frontdesk: 'front',
    desk: 'office', cubicle: 'office', officepod: 'office',
    palm: 'decor', cooler: 'decor', mirrorwall: 'decor', neon: 'decor',
  };
  const CATEGORY_META = {
    strength: { name: 'Strength', color: '#c0483a' },
    cardio: { name: 'Cardio', color: '#3fa0c9' },
    recovery: { name: 'Recovery', color: '#3fa87e' },
    booster: { name: 'Booster', color: '#d9a53f' },
    office: { name: 'Office', color: '#8a6fd1' },
    front: { name: 'Front of house', color: '#e8b04b' },
    counter: { name: 'Counter', color: '#e2724a' },
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
  // What each piece actually takes up on the floor, in metres: along its
  // own length, then across it. This is the hitbox -- whether two pieces
  // can stand in the same place, and how close one can stand to a wall --
  // and it is the piece as drawn, not a circle around its middle: a squat
  // rack is narrow and wide, a treadmill long and thin, and turning either
  // swaps which way round that is.
  const ITEM_BOX = {
    dumbbell: [0.80, 0.64], dumbbellrack: [1.55, 0.62], mat: [1.80, 0.66],
    bench: [1.75, 1.50], rack: [0.62, 2.10], cable: [0.52, 1.50],
    treadmill: [1.90, 0.80], sauna: [2.00, 1.50],
    juicebar: [1.60, 0.72], proshop: [1.70, 0.80],
    gearfridge: [1.40, 0.70], soundsystem: [0.70, 1.60], desk: [1.85, 1.20], frontdesk: [1.80, 0.75],
    cubicle: [1.65, 1.40], officepod: [1.60, 1.35], palm: [0.50, 0.50],
    cooler: [0.40, 0.40], mirrorwall: [0.34, 1.70], neon: [0.22, 1.50],
  };
  // Which side of a piece you get onto it from, and how much clear floor
  // that takes, in metres. Nothing may stand in that floor: two treadmills
  // side by side are fine, one nose to tail behind another is not, because
  // nobody could get on the back one. Sides are in the piece's own frame
  // before it is turned -- '+u' is its far end along its length, '+v' its
  // front face -- and mats, speakers and fittings need no run-up at all.
  const ITEM_ACCESS = {
    treadmill: ['+u', 0.85], rack: ['+u', 0.90], cable: ['+u', 0.90],
    bench: ['+v', 0.60], dumbbell: ['+v', 0.70], dumbbellrack: ['+v', 0.80],
    sauna: ['+v', 0.80], gearfridge: ['+v', 0.70],
    juicebar: ['+v', 0.85], proshop: ['+v', 0.85],
    desk: ['+v', 0.80], cubicle: ['+v', 0.70], officepod: ['+v', 0.80], frontdesk: ['+v', 0.90],
  };
  // Which pieces are used from the zone, standing, rather than from on top
  // of the piece itself.
  const USED_FROM_ZONE = { cable: true, dumbbell: true, dumbbellrack: true, gearfridge: true,
    sauna: true, desk: true, cubicle: true, officepod: true, frontdesk: true,
    juicebar: true, proshop: true };

  // What the two counter pieces make, and how much of it you can keep. The
  // rest of the counter is further down with the jobs it feeds; this much is
  // up here because reading a save asks what a product is.
  const QUEUE_SLOTS = 3;
  const LARDER_CAP = 25;
  const PRODUCTS = {
    shake: { name: 'Protein Shake', from: 'juicebar', seconds: 45, color: '#e2724a' },
    smoothie: { name: 'Green Smoothie', from: 'juicebar', seconds: 420, color: '#5db56a' },
    tee: { name: 'Gym Tee', from: 'proshop', seconds: 120, color: '#4f9ad1' },
    belt: { name: 'Lifting Belt', from: 'proshop', seconds: 900, color: '#b4574a' },
  };
  const RECIPES_OF = {
    juicebar: ['shake', 'smoothie'],
    proshop: ['tee', 'belt'],
  };
  // A direction in a piece's own frame, turned the way the piece is: the
  // same quarter turns turnUV applies to the drawing.
  function turnDir(du, dv, turn) {
    const t = (turn || 0) & 3;
    if (t === 1) return { u: -dv, v: du };
    if (t === 2) return { u: -du, v: -dv };
    if (t === 3) return { u: dv, v: -du };
    return { u: du, v: dv };
  }
  // The floor a piece at this spot needs clear in front of its step-on
  // side, as a rectangle on the room's lattice: from the edge of its box
  // out by its access depth, the full width of that side. Null for a piece
  // with no such side.
  function accessZone(itemId, spot, turn) {
    const acc = ITEM_ACCESS[itemId];
    if (!acc) return null;
    const box = ITEM_BOX[itemId] || [footprintOf(itemId), footprintOf(itemId)];
    const along = acc[0][1] === 'u';
    const sign = acc[0][0] === '-' ? -1 : 1;
    const dir = turnDir(along ? sign : 0, along ? 0 : sign, turn);
    const h = halfBoxOf(itemId, turn);
    const depth = acc[1] * TILES_PER_METRE;
    // Reach along the direction is the box's half-extent that way; the
    // width across it is the box's extent the other way.
    const reach = dir.u ? h.u : h.v;
    const half = dir.u ? h.v : h.u;
    const cu = spot.u + dir.u * (reach + depth / 2);
    const cv = spot.v + dir.v * (reach + depth / 2);
    const hu = dir.u ? depth / 2 : half;
    const hv = dir.u ? half : depth / 2;
    return { u0: cu - hu, u1: cu + hu, v0: cv - hv, v1: cv + hv };
  }
  function boxRect(spot, h) {
    return { u0: spot.u - h.u, u1: spot.u + h.u, v0: spot.v - h.v, v1: spot.v + h.v };
  }
  function rectsMeet(a, b) {
    return a.u1 > b.u0 + 0.02 && a.u0 < b.u1 - 0.02 && a.v1 > b.v0 + 0.02 && a.v0 < b.v1 - 0.02;
  }
  // Whether the floor a piece needs to be got onto runs off the room, or
  // into the notch cut out of it.
  function zoneOffFloor(shape, itemId, spot, turn) {
    const z = accessZone(itemId, spot, turn);
    if (!z) return false;
    if (z.u0 < -0.02 || z.v0 < -0.02 || z.u1 > shape.cols + 0.02 || z.v1 > shape.rows + 0.02) return true;
    const c = cutRect(shape);
    return !!c && rectsMeet(z, { u0: c.gx0, u1: c.gx0 + c.cols, v0: c.gy0, v1: c.gy0 + c.rows });
  }

  // Half-extents on the lattice, with the piece's turn applied.
  function halfBoxOf(itemId, turn) {
    const box = ITEM_BOX[itemId] || [footprintOf(itemId), footprintOf(itemId)];
    const a = (box[0] / 2) * TILES_PER_METRE;
    const b = (box[1] / 2) * TILES_PER_METRE;
    return (turn & 1) ? { u: b, v: a } : { u: a, v: b };
  }

  function clampSpot(spot, shape, itemId, turn) {
    const h = halfBoxOf(itemId, turn || 0);
    const lo = Math.min(h.u, shape.cols / 2);
    const loV = Math.min(h.v, shape.rows / 2);
    const at = {
      u: Math.max(lo, Math.min(shape.cols - lo, spot.u)),
      v: Math.max(loV, Math.min(shape.rows - loV, spot.v)),
    };
    // Its step-on floor has to be inside the room as well: a treadmill
    // pushed back against the wall is nudged forward until it can be got
    // onto.
    const z = accessZone(itemId, at, turn || 0);
    if (z) {
      if (z.u0 < 0) at.u -= z.u0;
      if (z.u1 > shape.cols) at.u -= z.u1 - shape.cols;
      if (z.v0 < 0) at.v -= z.v0;
      if (z.v1 > shape.rows) at.v -= z.v1 - shape.rows;
      at.u = Math.max(lo, Math.min(shape.cols - lo, at.u));
      at.v = Math.max(loV, Math.min(shape.rows - loV, at.v));
    }
    // Out of the notch, if it has landed in one: pushed back onto the floor
    // along whichever axis is the shorter push, then held inside the box
    // again. A piece bigger than the leg it is in can end up still hanging
    // over, and confirmEdit refuses that.
    const c = cutRect(shape);
    if (c && boxMeetsRect(at, h, c)) {
      const onRight = c.gx0 > 0;
      const atFront = c.gy0 > 0;
      const uAway = onRight ? c.gx0 - h.u : c.gx0 + c.cols + h.u;
      const vAway = atFront ? c.gy0 - h.v : c.gy0 + c.rows + h.v;
      if (Math.abs(uAway - at.u) <= Math.abs(vAway - at.v)) at.u = uAway; else at.v = vAway;
      at.u = Math.max(lo, Math.min(shape.cols - lo, at.u));
      at.v = Math.max(loV, Math.min(shape.rows - loV, at.v));
    }
    return at;
  }
  function boxMeetsRect(spot, h, r) {
    return spot.u + h.u > r.gx0 + 0.02 && spot.u - h.u < r.gx0 + r.cols - 0.02
      && spot.v + h.v > r.gy0 + 0.02 && spot.v - h.v < r.gy0 + r.rows - 0.02;
  }
  // Whether a piece at this spot hangs over the room's notch.
  function spotInCut(shape, itemId, spot, turn) {
    const c = cutRect(shape);
    return !!c && boxMeetsRect(spot, halfBoxOf(itemId, turn || 0), c);
  }

  // The piece already standing where this one would go, if any. Two boxes
  // on the lattice overlap when they overlap on both axes; a hair of slack
  // so two pieces set edge to edge are not counted as touching.
  function overlapsAnother(room, shape, itemId, spot, turn) {
    const h = halfBoxOf(itemId, turn);
    const mine = boxRect(spot, h);
    const myZone = accessZone(itemId, spot, turn);
    for (let i = 0; i < room.layout.length; i++) {
      const id = room.layout[i];
      if (!id) continue;
      const sp = spotOf(room, i, shape);
      const t = turnAt(room, i);
      const theirs = boxRect(sp, halfBoxOf(id, t));
      if (rectsMeet(mine, theirs)) return id;
      // Standing in the floor they need to be got onto, or them in mine.
      // Two zones may share floor: that is an aisle.
      const theirZone = accessZone(id, sp, t);
      if (theirZone && rectsMeet(mine, theirZone)) return id;
      if (myZone && rectsMeet(myZone, theirs)) return id;
    }
    return null;
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

  // Which way round a piece is standing: 0, 1, 2 or 3 quarter turns.
  function turnAt(room, index) {
    const s = room.spots && room.spots[index];
    return s && s.r ? (s.r & 3) : 0;
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
  // same category, +20% for each neighboring booster (fridge/sound system) of
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
      id: 'cashier',
      name: 'Cashier',
      baseCost: 6000,
      unlockLevel: 2,
      // Walks the room from bubble to bubble and empties each one they
      // reach. `first` is unused for this role: what a cashier is worth is
      // how fast they get round, and that is a matter of legs, not a number.
      first: 0,
      perRoom: true,
      note: (n) => (n === 1 ? 'one cashier' : n + ' cashiers') + ' walking this room',
    },
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
      note: (n) => 'busy-hour bonus +' + Math.round(staffEffect('receptionist', n) * 100) + '%',
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
  // Cashiers are hired into a room, not into the gym. Up to three a room:
  // one keeps a small room clear, three keep a full one clear, and a fourth
  // would only follow the third about.
  const CASHIERS_PER_ROOM = 3;
  function roomCashiers(room) {
    return (room && room.staff && room.staff.cashier) || 0;
  }
  function cashiersEverywhere() {
    return allRoomsEverywhere().reduce((n, room) => n + roomCashiers(room), 0);
  }
  function staffCount(id) {
    if (id === 'cashier') return cashiersEverywhere();
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
  // ---- Open day ----
  // The gym's own rhythm is the rush, and you cannot argue with it: the
  // place is busy at seven in the morning and at six in the evening whether
  // you are there or not. An open day is the one lever over how busy it is
  // that belongs to the player -- free, short, and on a long enough
  // cooldown that it is worth coming back for rather than something to sit
  // and spam.
  const PROMO_MULT = 2.5;
  const PROMO_SECONDS = 90;
  const PROMO_COOLDOWN_SECONDS = 15 * 60;

  // Measured off the wall clock, like everything else with a duration here,
  // so a reload does not restart it and a closed tab does not pause it.
  function promoAgeSeconds() {
    const at = state.promoAt || 0;
    return at ? (Date.now() - at) / 1000 : Infinity;
  }
  function promoSecondsLeft() {
    return Math.max(0, PROMO_SECONDS - promoAgeSeconds());
  }
  function promoReadyInSeconds() {
    return Math.max(0, PROMO_COOLDOWN_SECONDS - promoAgeSeconds());
  }
  function promoRunning() {
    return promoSecondsLeft() > 0;
  }
  function promoMultiplier() {
    return promoRunning() ? PROMO_MULT : 1;
  }
  function clockOf(seconds) {
    const s = Math.ceil(seconds);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
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
    if (f >= 0.8) return 'Rammed';
    if (f >= 0.45) return 'Busy';
    if (f >= 0.18) return 'Steady';
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
  // Everything that multiplies a whole room's takings. Net, not gross: the
  // wage bill comes off every figure the game shows, so the rate in the HUD
  // is the rate the money actually arrives at.
  function roomMultiplier(room) {
    return vibeMultiplier(room) * rushMultiplier() * promoMultiplier()
      * (1 + staffEffect('manager')) * franchiseMultiplier() * (1 - wageShare());
  }
  // What each piece in a room makes a second, slot by slot -- this is what
  // lands in the pile at its foot.
  function pieceRates(room, shape) {
    const mult = synergyMultipliers(room, shape);
    const rm = roomMultiplier(room);
    return room.layout.map((itemId, index) => (itemId ? gpsOf(itemId) * mult[index] * rm : 0));
  }
  function computeGps(room, shape) {
    return pieceRates(room, shape).reduce((sum, r) => sum + r, 0);
  }

  // Total across every room in every theme's chain -- gear earns
  // regardless of which theme/room is currently in view. Each room is scored
  // against its own footprint, since that decides which slots are neighbours.
  function computeTotalGps(themeRooms) {
    return THEMES.reduce((sum, t) => (
      chainHasDesk(themeRooms[t.id]) ? sum + (themeRooms[t.id] || []).reduce(
        (s2, room, i) => s2 + computeGps(room, roomShapeFor(t.id, i)), 0) : sum
    ), 0);
  }

  // ---- Cash on the floor ----
  // A piece of gear does not pay into your balance. What it takes piles up
  // at its foot, and you pick it up -- tap the pile -- or a Cashier does.
  // A pile only holds so much: a couple of minutes of that piece's takings
  // to begin with, more as the Customer Desk is upgraded, and a piece whose
  // pile is full earns nothing until it is cleared. That is the whole loop
  // of the early game, and hiring your way out of it is the mid game.
  const PILE_CAP_SECONDS = [0, 120, 360, 1200, 3600];
  function pileCapSeconds() {
    return PILE_CAP_SECONDS[tierOf('frontdesk')] || PILE_CAP_SECONDS[1];
  }
  // What a machine fills to, rounded to a figure worth reading. Two minutes
  // of a treadmill's takings is $15,600-and-change, which is a number
  // nobody wants to look at: the nearest of 10, 20, 50, 100 and so on up is
  // both close enough and something you can hold in your head.
  function niceCap(raw) {
    if (!(raw > 0)) return 0;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const steps = [1, 2, 5, 10];
    let best = 10 * mag;
    let bestGap = Infinity;
    steps.forEach((k) => {
      const gap = Math.abs(Math.log(k * mag) - Math.log(raw));
      if (gap < bestGap) { bestGap = gap; best = k * mag; }
    });
    return Math.max(10, best);
  }
  function roomCash(room) {
    if (!room.cash || room.cash.length !== room.layout.length) {
      room.cash = new Array(room.layout.length).fill(0).map((_, i) => (room.cash && room.cash[i]) || 0);
    }
    return room.cash;
  }
  // How full a pile is, in steps the drawing and the repaint care about:
  // 0 nothing to see, 1 to 3 a growing stack, 4 full and waiting.
  function pileLevel(amount, cap) {
    if (amount < 1 || cap <= 0) return 0;
    const f = amount / cap;
    return f >= 0.97 ? 4 : f >= 0.62 ? 3 : f >= 0.28 ? 2 : 1;
  }
  let pileLevelsKey = '';
  function earnTick(dt) {
    const capS = pileCapSeconds();
    let direct = 0;
    let key = '';
    THEMES.forEach((t) => {
      const rooms = state.themeRooms[t.id] || [];
      if (!chainHasDesk(rooms)) return;
      rooms.forEach((room, i) => {
        const rates = pieceRates(room, roomShapeFor(t.id, i));
        const cash = roomCash(room);
        rates.forEach((r, k) => {
          if (r <= 0) return;
          // Membership fees are paid at the desk, straight into the till.
          // The desk earns nothing, and nothing else pays in by itself.
          if (room.layout[k] === 'frontdesk') return;
          const cap = niceCap(r * capS);
          cash[k] = Math.min(cap, cash[k] + r * dt);
          key += pileLevel(cash[k], cap);
        });
      });
    });
    state.balance += direct;
    state.lifetime += direct;
    cashierRounds(dt);
    // A pile that has grown a size is a visible change on a floor that may
    // not otherwise be repainting -- but not for somebody who has asked
    // their system for less motion, whose gym stays still until they do
    // something to it. The money still arrives; the picture of it waits.
    if (key !== pileLevelsKey) {
      pileLevelsKey = key;
      if (!wantsStillness()) paintScene();
    }
  }
  // The cap for one piece, in dollars, and the level its pile is at now.
  function pileOf(room, shape, index) {
    const rate = pieceRates(room, shape)[index] || 0;
    const cap = niceCap(rate * pileCapSeconds());
    const amount = roomCash(room)[index] || 0;
    return { amount, cap, level: pileLevel(amount, cap) };
  }
  function floorCash() {
    return allRoomsEverywhere().reduce((sum, room) => sum + roomCash(room).reduce((a, b) => a + b, 0), 0);
  }
  // A cashier reaching a machine takes everything in its bubble, quietly:
  // no toast, because three of them working a room would never stop
  // announcing themselves. The HUD ticks up and the bubble goes.
  function takePile(room, index) {
    const cash = roomCash(room);
    const amount = cash[index] || 0;
    if (amount < 0.5) return 0;
    cash[index] = 0;
    state.balance += amount;
    state.lifetime += amount;
    return amount;
  }
  // The fullest bubble in a room, or -1 for a room with nothing to collect.
  function fullestPile(room) {
    const cash = roomCash(room);
    let best = -1;
    let most = 0.5;
    cash.forEach((c, i) => {
      if (room.layout[i] && room.layout[i] !== 'frontdesk' && c > most) { most = c; best = i; }
    });
    return best;
  }
  // Rooms you are not looking at have no figures walking them, so their
  // cashiers collect on a clock instead: each one clears the fullest bubble
  // every so often, at about the pace a walking one manages on screen.
  const CASHIER_TRIP_SECONDS = 9;
  function cashierRounds(dt) {
    THEMES.forEach((t) => {
      const rooms = state.themeRooms[t.id] || [];
      if (!chainHasDesk(rooms)) return;
      rooms.forEach((room, i) => {
        const n = roomCashiers(room);
        if (!n) return;
        if (t.id === state.activeTheme && walkersCollect()) return;
        room.cashierClock = (room.cashierClock || 0) + dt * n;
        if (room.cashierClock < CASHIER_TRIP_SECONDS) return;
        room.cashierClock = 0;
        const k = fullestPile(room);
        if (k !== -1) takePile(room, k);
      });
    });
  }
  // Whether the room on screen is being worked by figures who collect when
  // they arrive, or has to be worked by the clock like everywhere else.
  function walkersCollect() {
    return !wantsStillness() && members.some((m) => m.staffRole === 'cashier');
  }

  function collectPile(roomIndex, index) {
    const room = activeRooms()[roomIndex];
    if (!room) return 0;
    const cash = roomCash(room);
    const amount = cash[index] || 0;
    if (amount < 0.5) return 0;
    cash[index] = 0;
    state.balance += amount;
    state.lifetime += amount;
    refreshHud();
    toast('+$' + formatMoney(amount), 'legend-paper');
    renderScene();
    save();
    return amount;
  }

  // ---- The Customer Desk ----
  // A location is open once its Customer Desk stands on its floor. Until
  // then it takes nothing -- there is nobody to take it -- and the shop
  // stays shut, so the first thing anyone does with a new gym is put the
  // desk down.
  function chainHasDesk(rooms) {
    return (rooms || []).some((room) => room.layout.indexOf('frontdesk') !== -1);
  }
  function deskPlacedIn(themeId) {
    return chainHasDesk(state.themeRooms[themeId]);
  }
  function gymOpen() {
    return deskPlacedIn(state.activeTheme);
  }
  // The desk is never for sale. It used to cost $2,500 and be buyable once
  // per address, which meant a new location could be opened and then sat
  // there shut because the money had gone on gear -- a dead end you could
  // walk into without noticing. Every unlocked location is simply given one.
  function deskWanted() {
    return !deskPlacedIn(state.activeTheme);
  }

  // Money as somebody would say it out loud: whole dollars under a
  // thousand, and above that as few decimals as still tell you something.
  // Nobody wants to watch $1,124.43 tick over, and $127.68K is no better.
  function formatMoney(n) {
    if (!(n > 0)) return '0';
    if (n < 1000) return String(Math.floor(n));
    const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];
    let v = n;
    let u = -1;
    while (v >= 1000 && u < units.length - 1) {
      v /= 1000;
      u++;
    }
    const digits = v >= 100 ? 0 : 1;
    // A trailing ".0" says nothing: $20K, not $20.0K.
    return v.toFixed(digits).replace(/\.0$/, '') + units[u];
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
      const room = {
        layout: new Array(n).fill(null).map((_, k) => old[k] || null),
        // Positions travel with the pieces. A save from before free
        // placement has none, and spotOf falls back to the middle of the
        // grid cell the slot index used to mean -- which is exactly where
        // that piece was standing.
        spots: new Array(n).fill(null).map((_, k) => {
          const sp = oldSpots[k];
          return sp && typeof sp.u === 'number' && typeof sp.v === 'number'
            ? { u: sp.u, v: sp.v, r: (sp.r | 0) & 3 } : null;
        }),
        // What is waiting on the floor by each piece.
        cash: new Array(n).fill(0).map((_, k) => {
          const c = Array.isArray(r && r.cash) ? r.cash[k] : 0;
          return typeof c === 'number' && isFinite(c) && c > 0 ? c : 0;
        }),
        // What each counter has on. Batches are stored as the moment they
        // finish, so a save that sat overnight comes back with everything
        // already done, which is what it should be. Dropped on the way
        // through: a batch of something that no longer exists, and one in a
        // slot that has no counter in it any more.
        // Who works this room.
        staff: { cashier: Math.max(0, Math.min(CASHIERS_PER_ROOM,
          (r && r.staff && r.staff.cashier) | 0)) },
        batches: new Array(n).fill(null).map((_, k) => {
          const id = old[k] || null;
          if (!RECIPES_OF[id]) return [];
          const q = Array.isArray(r && r.batches) ? r.batches[k] : null;
          if (!Array.isArray(q)) return [];
          return q.filter((bt) => bt && PRODUCTS[bt.p] && PRODUCTS[bt.p].from === id
            && typeof bt.at === 'number' && isFinite(bt.at)).slice(0, QUEUE_SLOTS);
        }),
      };
      settleRoom(themeId, i, room);
      return room;
    });
    return rooms.length ? rooms : [emptyGymRoom(themeId, 0)];
  }

  // Every piece back on the floor of the room as it is now shaped. Rooms
  // change shape between versions of the game, and a piece that was
  // standing where there is now a wall, or the notch cut out of a corner,
  // or on top of something else, is moved to the nearest clear floor -- and
  // if there is none, taken up into the inventory rather than left hanging
  // in the air.
  function settleRoom(themeId, index, room) {
    const shape = roomShapeFor(themeId, index);
    room.layout.forEach((id, k) => {
      if (!id || !itemById(id)) return;
      const sp = spotOf(room, k, shape);
      const turn = turnAt(room, k);
      const at = clampSpot(sp, shape, id, turn);
      // Checked against the others with this one lifted out, so it does not
      // block itself.
      room.layout[k] = null;
      let clear = !spotInCut(shape, id, at, turn) && !zoneOffFloor(shape, id, at, turn)
        && !overlapsAnother(room, shape, id, at, turn) ? at : null;
      if (!clear) clear = findFreeSpot(room, shape, id, turn, at);
      if (clear) {
        room.layout[k] = id;
        room.spots[k] = { u: clear.u, v: clear.v, r: turn };
      } else {
        room.spots[k] = null;
      }
    });
  }

  // The nearest clear spot to `near` where this piece would stand on the
  // floor and on nothing else, searched over a half-tile grid; null if the
  // room is full.
  function findFreeSpot(room, shape, itemId, turn, near) {
    const from = near || { u: shape.cols / 2, v: shape.rows / 2 };
    let best = null;
    for (let v = 0.5; v < shape.rows; v += 0.5) {
      for (let u = 0.5; u < shape.cols; u += 0.5) {
        const at = clampSpot({ u, v }, shape, itemId, turn);
        if (spotInCut(shape, itemId, at, turn)) continue;
        if (zoneOffFloor(shape, itemId, at, turn)) continue;
        if (overlapsAnother(room, shape, itemId, at, turn)) continue;
        const d = Math.hypot(at.u - from.u, at.v - from.v);
        if (!best || d < best.d) best = { u: at.u, v: at.v, d };
      }
    }
    return best ? { u: best.u, v: best.v } : null;
  }

  // ---- Persistence ----
  function defaultState() {
    return {
      balance: 0,
      lifetime: 0,
      xp: 0,
      tiers: {},
      jobs: [],
      jobsDone: 0,
      rush: { job: null, deadlineAt: 0, nextAt: 0 },
      rushDone: 0,
      promoAt: 0,
      trophies: {},
      gymName: '',
      staff: {},
      larder: {},
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

    // The Personal Trainer is gone: at a third of a square metre it earned
    // more per metre of floor than a sauna, and a floor of them was the
    // best money in the game. Anyone who owned one gets what they paid.
    if (s.owned.trainer) {
      s.balance = (s.balance || 0) + s.owned.trainer * 40000;
      delete s.owned.trainer;
      THEMES.forEach((t) => {
        (s.themeRooms[t.id] || []).forEach((room) => {
          room.layout.forEach((id, i) => {
            if (id === 'trainer') {
              room.layout[i] = null;
              if (room.spots) room.spots[i] = null;
            }
          });
        });
      });
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

    // A gym from before the Customer Desk existed is open for business
    // already, so every location with gear on its floor gets a desk standing
    // on it -- on the nearest clear floor in the first room with any -- and
    // one goes into the inventory if there is no room for it. A fresh gym
    // has the one it started with.
    THEMES.forEach((t) => {
      const rooms = s.themeRooms[t.id] || [];
      const hasGear = rooms.some((r) => r.layout.some(Boolean));
      const hasDesk = rooms.some((r) => r.layout.indexOf('frontdesk') !== -1);
      if (!hasGear || hasDesk) return;
      s.owned.frontdesk = (s.owned.frontdesk || 0) + 1;
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const slot = room.layout.indexOf(null);
        if (slot === -1) continue;
        const shape = roomShapeFor(t.id, i);
        const spot = findFreeSpot(room, shape, 'frontdesk', 0, { u: 1.4, v: shape.rows / 2 });
        if (!spot) continue;
        room.layout[slot] = 'frontdesk';
        // The oldest save shape carries no positions at all, so a room
        // migrated from it may have no spots array yet.
        if (!room.spots) room.spots = new Array(room.layout.length).fill(null);
        room.spots[slot] = { u: spot.u, v: spot.v, r: 0 };
        return;
      }
    });
    // A desk is never in Storage: it is taken from the shop, free, and put
    // straight down. The count owned is the count standing, and a save
    // from the days of spare desks loses the spares.
    s.owned.frontdesk = THEMES.reduce((n, t) => n + (s.themeRooms[t.id] || []).reduce(
      (m, room) => m + room.layout.filter((id) => id === 'frontdesk').length, 0), 0);

    // Cashiers used to be hired into the gym; they are hired into a room.
    // A save with the old kind spreads them over its open rooms, three a
    // room, biggest room first, and the old number is dropped.
    if (s.staff && s.staff.cashier) {
      let left = s.staff.cashier | 0;
      const rooms = THEMES.reduce((list, t) => list.concat(s.themeRooms[t.id] || []), [])
        .filter((room) => room.layout.some(Boolean))
        .sort((a, b) => b.layout.filter(Boolean).length - a.layout.filter(Boolean).length);
      rooms.forEach((room) => {
        if (left <= 0) return;
        if (!room.staff) room.staff = {};
        const take = Math.min(CASHIERS_PER_ROOM, left);
        room.staff.cashier = (room.staff.cashier || 0) + take;
        left -= take;
      });
      delete s.staff.cashier;
    }

    // "First Rep" is gone -- it fired on the same click as opening up -- so a
    // save that won it carries a key for a trophy that no longer exists.
    if (s.trophies && s.trophies.first) delete s.trophies.first;

    // A save from before the counter existed has no larder, and a hand-edited
    // one could hold anything. Whatever is there is read back to whole
    // counts of products that still exist.
    const stock = {};
    Object.keys(s.larder && typeof s.larder === 'object' ? s.larder : {}).forEach((p) => {
      if (!PRODUCTS[p]) return;
      const n = Math.floor(Number(s.larder[p]) || 0);
      if (n > 0) stock[p] = Math.min(LARDER_CAP, n);
    });
    s.larder = stock;
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

  // ---- The counter ----
  // A gym that is only a set of rates is a game about waiting. The counter
  // is the one part of it that is a queue: you put a batch on, it takes real
  // time to run whether you watch it or not, and what comes off is a thing
  // you hold rather than a number that went up. What it is for is the
  // delivery orders on the Jobs board, which pay better than anything else
  // and can only be filled out of the larder.
  //
  // Each counter runs up to three batches back to back. The quick recipe is
  // for someone sitting there filling an order now; the slow one is for
  // someone closing the tab, since three of them is most of an hour of
  // stock. Nothing spoils and nothing is lost by leaving it.
  function makesStock(itemId) {
    return !!RECIPES_OF[itemId];
  }
  function larder() {
    if (!state.larder || typeof state.larder !== 'object') state.larder = {};
    return state.larder;
  }
  function larderCount(productId) {
    return Math.max(0, Math.floor(larder()[productId] || 0));
  }
  function larderRoom(productId) {
    return Math.max(0, LARDER_CAP - larderCount(productId));
  }
  function addToLarder(productId, n) {
    const took = Math.min(n, larderRoom(productId));
    if (took > 0) larder()[productId] = larderCount(productId) + took;
    return took;
  }
  function spendFromLarder(productId, n) {
    const had = larderCount(productId);
    if (had < n) return false;
    larder()[productId] = had - n;
    return true;
  }

  // The batches a room's counters have on, one list per slot, in the same
  // shape as the cash piles: a plain array the length of the layout, made on
  // demand so an older save grows one the first time it is asked.
  function roomBatches(room) {
    if (!Array.isArray(room.batches) || room.batches.length !== room.layout.length) {
      const was = Array.isArray(room.batches) ? room.batches : [];
      room.batches = new Array(room.layout.length).fill(null)
        .map((_, i) => (Array.isArray(was[i]) ? was[i] : []));
    }
    return room.batches;
  }
  function queueAt(room, index) {
    const q = roomBatches(room)[index];
    return Array.isArray(q) ? q : (roomBatches(room)[index] = []);
  }
  // A batch runs when the one before it has finished, so a queue is a chain
  // rather than three timers racing. Stored as the moment each one is done,
  // which survives a reload and needs no ticking to stay true.
  function roomIn(themeId, roomIndex) {
    return (state.themeRooms[themeId] || [])[roomIndex] || null;
  }
  function startBatch(themeId, roomIndex, index, productId) {
    const room = roomIn(themeId, roomIndex);
    const product = PRODUCTS[productId];
    if (!room || !product) return false;
    if (room.layout[index] !== product.from) return false;
    const q = queueAt(room, index);
    if (q.length >= QUEUE_SLOTS) return false;
    const now = Date.now();
    const startsAt = q.length ? Math.max(now, q[q.length - 1].at) : now;
    q.push({ p: productId, at: startsAt + product.seconds * 1000 });
    save();
    return true;
  }
  function readyAt(room, index, now) {
    const at = now || Date.now();
    return queueAt(room, index).filter((b) => b.at <= at).length;
  }
  // Everything finished on this counter, into the larder in one go. What the
  // larder has no room for stays on the counter rather than evaporating.
  function collectBatches(themeId, roomIndex, index) {
    const room = roomIn(themeId, roomIndex);
    if (!room) return 0;
    const now = Date.now();
    const q = queueAt(room, index);
    const keep = [];
    const got = {};
    let taken = 0;
    q.forEach((b) => {
      if (b.at > now) { keep.push(b); return; }
      if (addToLarder(b.p, 1)) { got[b.p] = (got[b.p] || 0) + 1; taken++; }
      else keep.push(b);
    });
    if (!taken) return 0;
    roomBatches(room)[index] = keep;
    const parts = Object.keys(got).map((p) => got[p] + ' x ' + PRODUCTS[p].name);
    toast('Collected ' + parts.join(', '), 'good');
    save();
    return taken;
  }
  // Everything off this counter: what is done into the larder, what is not
  // thrown out. Used when the piece is picked up, which is the one moment a
  // counter stops being a counter standing in a place.
  function emptyCounter(themeId, roomIndex, index) {
    const room = roomIn(themeId, roomIndex);
    if (!room || !makesStock(room.layout[index])) return;
    const lost = queueAt(room, index).filter((b) => b.at > Date.now()).length;
    collectBatches(themeId, roomIndex, index);
    roomBatches(room)[index] = [];
    if (lost) {
      toast(lost === 1 ? 'One batch poured away' : lost + ' batches poured away', null);
    }
  }

  // Anything ready anywhere, which is what puts the dot on the tab.
  function anyQueueHere() {
    const rooms = state.themeRooms[state.activeTheme] || [];
    return rooms.some((room) => room.layout.some((id, i) => (
      makesStock(id) && queueAt(room, i).length > 0
    )));
  }
  function anythingReady() {
    return THEMES.some((t) => (state.themeRooms[t.id] || []).some((room) => (
      room.layout.some((id, i) => makesStock(id) && readyAt(room, i) > 0)
    )));
  }
  // Every counter standing on a floor anywhere, which is what the panel
  // lists and what decides whether a delivery order can be asked for.
  function countersPlaced() {
    const out = [];
    THEMES.forEach((t) => {
      (state.themeRooms[t.id] || []).forEach((room, roomIndex) => {
        room.layout.forEach((id, index) => {
          if (makesStock(id)) out.push({ themeId: t.id, roomIndex, index, itemId: id, room });
        });
      });
    });
    return out;
  }
  function productsMakeable() {
    const from = {};
    countersPlaced().forEach((c) => { from[c.itemId] = true; });
    return Object.keys(PRODUCTS).filter((p) => from[PRODUCTS[p].from]);
  }

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
    deliver: {
      pick(ctx) {
        const p = pickOf(ctx.products);
        // Never more than the larder can hold, or the order could not be
        // filled however long you left it running.
        const most = Math.min(LARDER_CAP, PRODUCTS[p].seconds > 300 ? 4 : 8);
        return { product: p, target: Math.max(2, 2 + Math.floor(Math.random() * (most - 1))) };
      },
      text: (j) => 'Deliver ' + j.target + ' x ' + PRODUCTS[j.product].name,
      done: (j) => larderCount(j.product),
      spend: (j) => spendFromLarder(j.product, j.target),
      // Worth the trouble: a delivery is the only job you have to plan
      // ahead for, so it pays about double what a standing job pays.
      pay: 2.2,
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
    // A delivery can only be asked for if there is a counter on a floor
    // somewhere that makes the thing.
    if (productsMakeable().length) kinds.push('deliver');
    return kinds;
  }

  function makeJob(mult, avoidKinds) {
    const tally = floorTally();
    const level = currentLevel();
    const affordable = ITEMS.filter((i) => unlockedFor(i) && !i.starter);
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
      products: productsMakeable(),
    };
    let choices = jobKindsAvailable(tally).filter((k) => avoidKinds.indexOf(k) === -1);
    if (!choices.length) choices = jobKindsAvailable(tally);
    const kind = pickOf(choices);
    const job = Object.assign({ kind }, JOB_KINDS[kind].pick(ctx));
    // Stated when the job is written, not when it is handed in, so the board
    // can say what a job is worth before you decide to go and do it.
    const pay = mult * (JOB_KINDS[kind].pay || 1);
    job.cash = Math.max(150, Math.round(gps * 45 * pay));
    job.xp = Math.round(16 * pay * (1 + level * 0.12));
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

  // ---- Rush orders ----
  // The standing jobs wait for you. A rush order does not: one at a time,
  // three times the pay, and eight minutes to do it in, after which it is
  // gone and the board goes quiet for a while. It is the thing that makes
  // *now* different from later in a game that is otherwise happy to be left
  // -- and it only ever asks for something that can be bought or placed on
  // the spot, never for a room to be filled or an arrangement worked out.
  const RUSH_ORDER_MIN_LEVEL = 3;
  const RUSH_ORDER_SECONDS = 8 * 60;
  const RUSH_ORDER_PAY = 3.0;
  const RUSH_ORDER_GAP_DONE = 10 * 60;
  const RUSH_ORDER_GAP_MISSED = 20 * 60;
  const RUSH_ORDER_KINDS = ['ownItem', 'placeItem', 'placeCategory', 'gps'];

  function rushState() {
    if (!state.rush || typeof state.rush !== 'object') {
      state.rush = { job: null, deadlineAt: 0, nextAt: 0 };
    }
    return state.rush;
  }
  function rushOrder() {
    const r = rushState();
    return r.job && JOB_KINDS[r.job.kind] ? r.job : null;
  }
  function rushSecondsLeft() {
    return Math.max(0, (rushState().deadlineAt - Date.now()) / 1000);
  }
  function rushNextInSeconds() {
    return Math.max(0, (rushState().nextAt - Date.now()) / 1000);
  }

  function writeRushOrder() {
    const avoid = Object.keys(JOB_KINDS).filter((k) => RUSH_ORDER_KINDS.indexOf(k) === -1);
    const usable = jobKindsAvailable(floorTally()).filter((k) => avoid.indexOf(k) === -1);
    if (!usable.length) return;
    const r = rushState();
    r.job = makeJob(RUSH_ORDER_PAY, avoid);
    r.deadlineAt = Date.now() + RUSH_ORDER_SECONDS * 1000;
  }

  // Off the earnings tick, like everything else with a clock on it: an order
  // that runs out while the tab is open is taken off the board there and
  // then, and the next one is written when its time comes.
  function tickRushOrder() {
    if (currentLevel() < RUSH_ORDER_MIN_LEVEL) return;
    const r = rushState();
    const now = Date.now();
    if (r.job && now >= r.deadlineAt) {
      r.job = null;
      r.nextAt = now + RUSH_ORDER_GAP_MISSED * 1000;
      toast('Rush order missed -- another in ' + Math.round(RUSH_ORDER_GAP_MISSED / 60) + ' min', null);
      save();
    }
    if (!r.job && now >= r.nextAt) {
      writeRushOrder();
      if (r.job) save();
    }
  }

  function claimRushOrder() {
    const job = rushOrder();
    if (!job) return;
    if (!jobProgress(job, floorTally()).ready) return;
    const before = currentLevel();
    state.balance += job.cash;
    state.lifetime += job.cash;
    state.xp = (state.xp || 0) + job.xp;
    state.jobsDone = (state.jobsDone || 0) + 1;
    state.rushDone = (state.rushDone || 0) + 1;
    const r = rushState();
    r.job = null;
    r.nextAt = Date.now() + RUSH_ORDER_GAP_DONE * 1000;
    if (currentLevel() > before) announceLevel(currentLevel());
    else toast('Rush order done -- $' + formatNum(job.cash) + ' and ' + job.xp + ' XP', 'good');
    refreshHud();
    refreshLevelUI();
    refreshShopUI();
    refreshThemeRow();
    refreshRushOrderUI();
    updateLeaderboardEntry();
    save();
  }

  // ---- Trophies ----
  // Milestones, in the Township sense: things you were going to do anyway,
  // noticed and paid for. What they are really for is pointing at corners of
  // the game somebody might otherwise never open -- that how gear is
  // arranged matters, that fittings do something, that there is a franchise
  // button at all -- rather than at the totals, which look after themselves.
  //
  // They are permanent. Franchising clears the gym; it does not clear these.
  const TROPHIES = [
    { id: 'open', name: 'Open For Business', hint: 'Put the Customer Desk on the floor',
      cash: 50, got: (c) => c.open },
    { id: 'ten', name: 'Kitted Out', hint: 'Have ten pieces on the floor at once',
      cash: 400, got: (c) => c.placed >= 10 },
    { id: 'fullroom', name: 'Not An Inch Spare', hint: 'Fill every slot in one room',
      cash: 1500, got: (c) => c.fullRoom >= 1 },
    { id: 'synergy', name: 'Good Layout', hint: 'Get one piece to a +40% arrangement bonus',
      cash: 2000, got: (c) => c.bestSynergy >= 1.4 },
    { id: 'vibe', name: 'Somewhere Nice', hint: 'Take a room to the top of the vibe scale',
      cash: 250000, got: (c) => c.bestVibe >= VIBE_MAX_POINTS },
    { id: 'fifty', name: 'Proper Gym', hint: 'Have fifty pieces on the floor at once',
      cash: 500000, got: (c) => c.placed >= 50 },
    { id: 'hundred', name: 'Chain Material', hint: 'Have a hundred pieces on the floor at once',
      cash: 30000000, got: (c) => c.placed >= 100 },

    { id: 'lvl5', name: 'Getting Somewhere', hint: 'Reach level 5',
      cash: 3000, got: (c) => c.level >= 5 },
    { id: 'lvl10', name: 'Established', hint: 'Reach level 10',
      cash: 1500000, got: (c) => c.level >= 10 },
    { id: 'lvl20', name: 'Household Name', hint: 'Reach level 20',
      cash: 2000000000, got: (c) => c.level >= 20 },
    { id: 'lvl30', name: 'Industry Fixture', hint: 'Reach level 30',
      cash: 500000000000, got: (c) => c.level >= 30 },

    { id: 'rooms', name: 'Knocked Through', hint: 'Open all four rooms in one location',
      cash: 6000000, got: (c) => c.mostRooms >= MAX_ROOMS_PER_THEME },
    { id: 'themes', name: 'Three Addresses', hint: 'Have gear on the floor in three locations at once',
      cash: 900000, got: (c) => c.themesUsed >= 3 },
    { id: 'pier', name: 'Out On The Pier', hint: 'Open the Boardwalk and put gear on it',
      cash: 50000000, got: (c) => c.themesUsed >= 4 },

    { id: 'staff1', name: 'On The Payroll', hint: 'Hire your first member of staff',
      cash: 2000, got: (c) => c.staff >= 1 },
    { id: 'staffall', name: 'Full Team', hint: 'Employ every kind of staff at once',
      cash: 500000, got: (c) => c.roles >= STAFF_ROLES.length },

    { id: 'upgrade', name: 'Marked Up', hint: 'Upgrade a piece of gear to Mk II',
      cash: 1500, got: (c) => c.topTier >= 2 },
    { id: 'mkiv', name: 'Top Of The Range', hint: 'Take a piece costing $10K or more all the way to Mk IV',
      cash: 3000000, got: (c) => c.topTierBig >= MAX_TIER },

    { id: 'jobs10', name: 'Reliable', hint: 'Finish ten jobs',
      cash: 25000, got: (c) => c.jobsDone >= 10 },
    { id: 'jobs50', name: 'Never Says No', hint: 'Finish fifty jobs',
      cash: 5000000, got: (c) => c.jobsDone >= 50 },
    { id: 'rush5', name: 'Under Pressure', hint: 'Finish five rush orders before they run out',
      cash: 150000, got: (c) => c.rushDone >= 5 },

    { id: 'fran1', name: 'Second Location', hint: 'Franchise the gym out once',
      cash: 300000, got: (c) => c.runs >= 1 },
    { id: 'fran5', name: 'Franchise Group', hint: 'Franchise out five times',
      cash: 10000000000, got: (c) => c.runs >= 5 },

    { id: 'rich', name: 'First Million', hint: 'Earn a million in total',
      cash: 50000, got: (c) => c.lifetime >= 1e6 },
    { id: 'richer', name: 'First Billion', hint: 'Earn a billion in total',
      cash: 40000000, got: (c) => c.lifetime >= 1e9 },
  ];

  function hasTrophy(id) {
    return !!(state.trophies && state.trophies[id]);
  }
  function trophiesWon() {
    return TROPHIES.filter((t) => hasTrophy(t.id)).length;
  }

  // Everything the tests above ask about, gathered once. floorTally() is the
  // expensive part of it, which is why the check is throttled rather than
  // run on every tick of the earnings clock.
  function trophyContext() {
    const tally = floorTally();
    let mostRooms = 0;
    let themesUsed = 0;
    THEMES.forEach((t) => {
      const chain = state.themeRooms[t.id] || [];
      if (chain.length > mostRooms) mostRooms = chain.length;
      if (chain.some((r) => r.layout.some(Boolean))) themesUsed++;
    });
    let topTier = 1;
    // And the best tier reached on a piece that is not pocket change to
    // upgrade: upgrading costs forty times the piece's price, so the tiers
    // of the cheapest gear in the shop are bought with small change.
    let topTierBig = 1;
    Object.keys(state.tiers || {}).forEach((id) => {
      const item = itemById(id);
      if (state.tiers[id] > topTier) topTier = state.tiers[id];
      if (item && item.baseCost >= 10000 && state.tiers[id] > topTierBig) topTierBig = state.tiers[id];
    });
    return {
      placed: tally.placed,
      fullRoom: tally.fullRoom,
      bestSynergy: tally.bestSynergy,
      // floorTally reports vibe as the percentage it is worth, because that
      // is what the jobs board quotes. The scale itself is in points.
      bestVibe: tally.bestVibe / (VIBE_PER_POINT * 100),
      level: currentLevel(),
      lifetime: state.lifetime,
      mostRooms,
      themesUsed,
      staff: staffTotal(),
      roles: STAFF_ROLES.filter((r) => staffCount(r.id) > 0).length,
      open: THEMES.some((t) => deskPlacedIn(t.id)),
      topTier,
      topTierBig,
      jobsDone: state.jobsDone || 0,
      rushDone: state.rushDone || 0,
      runs: (state.franchise && state.franchise.runs) || 0,
    };
  }

  // ---- Members ----
  // The people using the place. They earn nothing -- what a room makes is
  // decided entirely by the gear standing in it -- they are what makes a gym
  // read as a gym rather than a showroom of equipment nobody has touched.
  // Each one walks to a piece of kit, uses it for a while, and moves on.
  const MEMBER_SHIRTS = ['#4a5ec8', '#c0483a', '#3fa87e', '#c98a4a', '#7a5ac9', '#3f9ec9'];
  const MEMBER_SKINS = ['#efc39c', '#d59a6c', '#a06a44', '#7a4a2c', '#f3d3b4'];
  const MEMBER_HAIR = ['#2b2119', '#4a3524', '#8a6a3a', '#1c1c20', '#6b3a24'];
  // Enough variation that six people in one room read as six people. 'skin'
  // in the legs list means bare legs rather than a colour.
  const MEMBER_LEGS = ['#454b57', '#2c3140', '#3d4a3a', '#5b4a3e', 'skin', 'skin'];
  const MEMBER_HAIRSTYLES = ['crop', 'crop', 'crop', 'bun', 'tail', 'long', 'cap', 'band'];
  const MEMBER_CAPS = ['#d94f43', '#3f7fd1', '#e0b93f', '#2f3a4a', '#3fa87e'];
  const MEMBER_BAGS = ['#b0453c', '#2f5f8a', '#4a4f5c', '#7a5a34'];
  const MEMBER_CARRY = ['none', 'none', 'none', 'none', 'none', 'bottle', 'bottle', 'bag', 'towel'];

  // What somebody does at a piece of kit. Anything not named here gets a
  // small stationary sway, which is the right answer for a sauna door or a
  // reception desk -- and for whatever gets added later.
  const EXERCISE = {
    treadmill: 'run',
    dumbbell: 'curl', dumbbellrack: 'curl',
    bench: 'press',
    rack: 'squat',
    cable: 'pull',
    mat: 'stretch',
    sauna: 'sit',
  };
  // How fast each movement cycles, in radians a second. A sprint is not a
  // squat, and a set of squats taken at running speed looks ridiculous.
  const EXERCISE_RATE = {
    run: 11.5, curl: 3.4, press: 2.5, squat: 2.0, pull: 3.0,
    stretch: 1.2, sit: 0.8,
  };
  const MEMBER_WALK = 1.15 * TILES_PER_METRE;   // tiles a second, a gym walk
  // Roughly two members for every three pieces of kit, so a room fills up as
  // it is fitted out, with a ceiling so a big room does not turn into a
  // crowd scene that costs more to draw than it is worth.
  const MEMBERS_PER_PIECE = 0.45;
  const MAX_MEMBERS_PER_ROOM = 4;

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
  // The uniform. Gold is the one colour no member's shirt is, and trousers
  // are the one thing no member wears -- the crowd is all shorts and bare
  // legs -- so the two read apart on silhouette alone before colour does.
  const STAFF_SHIRT = '#f2b632';
  const STAFF_TROUSERS = '#1d2230';
  const STAFF_CAP = '#15181f';
  const STAFF_TRIM = '#e8c46a';
  const STAFF_MARK = '#ffd166';

  // Somewhere on this room's floor, clear of the walls and never in the
  // notch cut out of its corner.
  function randomFloorSpot(place) {
    for (let tries = 0; tries < 12; tries++) {
      const at = {
        gx: place.gx0 + 0.8 + Math.random() * Math.max(0.1, place.cols - 1.6),
        gy: place.gy0 + 0.8 + Math.random() * Math.max(0.1, place.rows - 1.6),
      };
      if (onFloorOf(place, at.gx, at.gy)) return at;
    }
    return { gx: place.gx0 + 1, gy: place.gy0 + 1 };
  }
  // A walk from one point to another inside a room, as the waypoints to
  // reach: straight there, unless the line crosses the notch, in which case
  // round its inside corner first. Nobody walks across a hole in the floor.
  function routeInRoom(place, from, to) {
    const c = cutRect(place);
    if (!c) return [to];
    const steps = Math.max(2, Math.ceil(Math.hypot(to.gx - from.gx, to.gy - from.gy) / 0.4));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (inRect(c, from.gx + (to.gx - from.gx) * t, from.gy + (to.gy - from.gy) * t)) {
        return [innerCornerOf(place), to];
      }
    }
    return [to];
  }

  function spawnMember(room, place, staffRoleId) {
    const at = randomFloorSpot(place);
    return {
      // Where a member is, is a point on the world lattice, not a point in
      // some room -- they walk out of one room, down a hallway and into the
      // next, and none of that has room-local coordinates that mean anything.
      room,
      gx: at.gx,
      gy: at.gy,
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
      speed: MEMBER_WALK * (staffRoleId === 'cashier' ? 1.05 : staffRoleId ? 0.75 : 0.85 + Math.random() * 0.35),
      // Which piece they are on, once they get there, so the figure knows
      // whether it is running, curling or sitting in a sauna.
      gearId: null,
      // Build and dress. Rolled once, at spawn, so somebody does not change
      // height between frames.
      build: 0.93 + Math.random() * 0.14,
      broad: 0.92 + Math.random() * 0.20,
      legs: staffRoleId ? STAFF_TROUSERS : pickOf(MEMBER_LEGS),
      shortsLen: Math.random() < 0.35 ? 0.345 : 0.415,
      // Everyone on staff wears the cap. Members get whatever hair they have.
      hairStyle: staffRoleId ? 'cap' : pickOf(MEMBER_HAIRSTYLES),
      capColor: staffRoleId ? STAFF_CAP : pickOf(MEMBER_CAPS),
      bagColor: pickOf(MEMBER_BAGS),
      // Staff are at work, not on their way to it: no gym bag, but a towel
      // over the shoulder is exactly what somebody working a floor carries.
      // A cashier carries the takings in a pouch on the hip. Nobody on staff
      // carries a gym bag or a water bottle: those are what members bring.
      carry: staffRoleId === 'cashier' ? 'pouch' : staffRoleId ? 'none' : pickOf(MEMBER_CARRY),
    };
  }

  // Rebuilt only when the crowd it was built for has changed -- a different
  // theme, or a room that has gained or lost something. Members already in a
  // room are kept exactly where they are, so buying something in one room
  // does not teleport everybody in the others.
  function rebuildMembers() {
    const rooms = activeRooms();
    const key = wantsStillness() ? 'still' : state.activeTheme + '|' + staffTotal() + '|'
      + rooms.map((r) => r.layout.filter(Boolean).length + '.' + roomVibe(r) + '.' + roomCashiers(r)).join(',');
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
        * (0.55 + 0.75 * rushFactor()) * (promoRunning() ? 1.4 : 1);
      const want = placed === 0 ? 0
        : Math.max(1, Math.min(MAX_MEMBERS_PER_ROOM, Math.round(draw)));
      const here = members.filter((m) => m.room === roomIndex && !m.staffRole).slice(0, want);
      while (here.length < want) here.push(spawnMember(roomIndex, place));
      next.push(...here);
    });

    // Cashiers stand in the room they were hired into, one figure per hire.
    rooms.forEach((room, roomIndex) => {
      if (!placements[roomIndex]) return;
      const kept = members.filter((m) => m.staffRole === 'cashier' && m.room === roomIndex);
      for (let k = 0; k < roomCashiers(room); k++) {
        next.push(kept[k] || spawnMember(roomIndex, placements[roomIndex], 'cashier'));
      }
    });
    // The other roles are spread across the rooms that are open, one room
    // at a time, so two of them are in two rooms rather than both in the
    // first.
    const open = rooms.map((r, i) => i).filter((i) => placements[i]);
    let slot = 0;
    STAFF_ROLES.filter((r) => !r.perRoom).forEach((role) => {
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
  // Raised with the rooms: a bigger floor with fewer people on it read as
  // four separate rooms rather than one gym, because hardly anybody was
  // ever in the hallway between them.
  const MEMBER_ROAM_CHANCE = 0.28;
  // A cashier's next stop is the fullest bubble in their room, walked to
  // through the machine's step-on floor; the money is taken on arrival.
  // With nothing to collect they stroll to somewhere and wait a moment,
  // which is what a person with nothing to do does.
  function chooseCashierTarget(m) {
    const rooms = activeRooms();
    const room = rooms[m.room];
    const place = placements[m.room];
    if (!room || !place) { m.state = 'idle'; return; }
    const k = fullestPile(room);
    // Two cashiers do not converge on the same machine.
    const claimed = k !== -1 && members.some((o) => o !== m && o.staffRole === 'cashier'
      && o.room === m.room && o.gear === k && o.state !== 'idle');
    let goal;
    if (k !== -1 && !claimed) {
      const id = room.layout[k];
      const spot = spotOf(room, k, { cols: place.cols, rows: place.rows });
      const zone = accessZone(id, spot, turnAt(room, k));
      m.gear = k;
      m.via = null;
      goal = zone
        ? { gx: place.gx0 + (zone.u0 + zone.u1) / 2, gy: place.gy0 + (zone.v0 + zone.v1) / 2 }
        : { gx: place.gx0 + spot.u, gy: place.gy0 + spot.v + 1.2 };
      if (!onFloorOf(place, goal.gx, goal.gy)) goal = { gx: place.gx0 + spot.u, gy: place.gy0 + spot.v };
    } else {
      m.gear = null;
      m.via = null;
      goal = randomFloorSpot(place);
    }
    m.path = routeInRoom(place, m, goal);
    m.state = 'walking';
  }

  function chooseTarget(m) {
    if (m.staffRole === 'cashier') { chooseCashierTarget(m); return; }
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
      const id = room.layout[i];
      const spot = spotOf(room, i, { cols: place.cols, rows: place.rows });
      const zone = accessZone(id, spot, turnAt(room, i));
      m.gear = i;
      if (zone) {
        // In through the floor kept clear for getting on, then either stand
        // there (a cable stack is worked from in front of it) or step onto
        // the piece (a treadmill is run on, not beside).
        const inZone = { gx: place.gx0 + (zone.u0 + zone.u1) / 2, gy: place.gy0 + (zone.v0 + zone.v1) / 2 };
        m.via = inZone;
        goal = USED_FROM_ZONE[id] ? inZone : { gx: place.gx0 + spot.u, gy: place.gy0 + spot.v };
      } else {
        m.via = null;
        // Stand in front of the piece rather than inside it: clear of its
        // own footprint, and toward the viewer so the gear is not hidden.
        const clear = (footprintOf(id) / 2 + 0.4) * TILES_PER_METRE;
        goal = {
          gx: place.gx0 + clampTo(spot.u + clear * 0.5, 0.6, Math.max(0.6, place.cols - 0.6)),
          gy: place.gy0 + clampTo(spot.v + clear * 0.8, 0.6, Math.max(0.6, place.rows - 0.6)),
        };
        // A piece against the notch has its front over the edge: stand
        // beside it instead.
        if (!onFloorOf(place, goal.gx, goal.gy)) {
          goal = { gx: place.gx0 + spot.u, gy: place.gy0 + spot.v + clear * 0.4 };
          if (!onFloorOf(place, goal.gx, goal.gy)) goal = { gx: place.gx0 + spot.u, gy: place.gy0 + spot.v };
        }
      }
    } else {
      m.via = null;
      m.gear = null;
      goal = randomFloorSpot(place);
    }

    // The way in to a piece is through its step-on floor, so the last leg
    // of the walk goes there first.
    const legs = (from) => (m.via && (m.via.gx !== goal.gx || m.via.gy !== goal.gy)
      ? routeInRoom(place, from, m.via).concat([goal])
      : routeInRoom(place, from, goal));
    if (dest === m.room) {
      m.path = legs(m);
    } else {
      // corridors[i] joins rooms i and i+1, and always runs from its nearRoom
      // to its doorRoom -- which of those is the room being left decides
      // which way down it this member is walking.
      const c = corridors[Math.min(m.room, dest)];
      if (!c) {
        m.path = routeInRoom(place, m, goal);
      } else {
        const hall = corridorWaypoints(c, placements[m.room] === c.nearRoom);
        m.path = routeInRoom(placements[m.room], m, hall[0])
          .concat(hall.slice(1), legs(hall[hall.length - 1]));
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
        m.phase += dt * (EXERCISE_RATE[EXERCISE[m.gearId]] || 5.5);
        // The piece they were using can be picked up out from under them.
        if (m.timer <= 0 || !room.layout[m.gear]) m.state = 'idle';
        return;
      }
      if (m.state === 'pausing') {
        m.timer -= dt;
        if (m.timer <= 0) m.state = 'idle';
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
        if (m.staffRole === 'cashier') {
          if (m.gear !== null && room.layout[m.gear]) takePile(room, m.gear);
          // A beat at the machine, or a longer pause with nothing to do,
          // so an empty room is not somebody pacing it.
          m.state = 'pausing';
          m.timer = m.gear === null ? 1.5 + Math.random() * 2 : 0.6;
          m.gear = null;
          return;
        }
        m.state = m.gear === null ? 'idle' : 'using';
        m.gearId = m.gear === null ? null : room.layout[m.gear];
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
      .concat(THEMES.filter((t) => t.unlockLevel === level).map((t) => t.name))
      .concat(STAFF_ROLES.filter((r) => r.unlockLevel === level).map((r) => r.name + 's'))
      .concat(level === UPGRADE_MIN_LEVEL ? ['upgrades'] : [])
      .concat(level === RUSH_ORDER_MIN_LEVEL ? ['rush orders'] : []);
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

  const jobsDotEl = document.getElementById('tab-dot-jobs');
  function refreshJobsDot() {
    if (!jobsDotEl) return;
    const ready = !!document.querySelector('#jobs-list .tycoon-job.is-ready')
      || !!document.querySelector('#rush-order .tycoon-job.is-ready');
    if (jobsDotEl.hidden === ready) jobsDotEl.hidden = !ready;
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
    // A delivery is handed over, and the stock goes with it -- every other
    // job is satisfied by the state of the gym and takes nothing away. If
    // the stock has gone since the board was last drawn the job stays put
    // rather than paying out for nothing.
    const kind = JOB_KINDS[job.kind];
    if (kind.spend && !kind.spend(job)) { refreshJobsUI(); return; }
    const before = currentLevel();
    state.balance += job.cash;
    state.lifetime += job.cash;
    state.xp = (state.xp || 0) + job.xp;
    state.jobs.splice(index, 1);
    state.jobsDone = (state.jobsDone || 0) + 1;
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

  // ---- The rush order, on the board ----
  // One row, built once; what changes on it -- progress, the clock -- is
  // written into place, for the same reason the standing jobs are.
  const rushOrderEl = document.getElementById('rush-order');
  let rushRow = null;
  let rushSignature = '';

  function buildRushRow() {
    rushOrderEl.innerHTML =
      '<div class="tycoon-job is-rush">'
        + '<span class="tycoon-job-text"></span>'
        + '<span class="tycoon-job-bar"><span class="tycoon-job-fill"></span></span>'
        + '<span class="tycoon-job-foot">'
          + '<span class="tycoon-job-meta"></span>'
          + '<button class="tycoon-job-claim" type="button" disabled>Claim</button>'
        + '</span>'
      + '</div>'
      + '<p class="tycoon-rush-wait"></p>';
    const row = rushOrderEl.querySelector('.tycoon-job');
    const claim = row.querySelector('.tycoon-job-claim');
    claim.addEventListener('click', claimRushOrder);
    rushRow = {
      row,
      text: row.querySelector('.tycoon-job-text'),
      fill: row.querySelector('.tycoon-job-fill'),
      meta: row.querySelector('.tycoon-job-meta'),
      claim,
      wait: rushOrderEl.querySelector('.tycoon-rush-wait'),
      last: null,
    };
  }

  function refreshRushOrderUI() {
    if (!rushOrderEl) return;
    if (currentLevel() < RUSH_ORDER_MIN_LEVEL) {
      rushOrderEl.hidden = true;
      return;
    }
    rushOrderEl.hidden = false;
    if (!rushRow) buildRushRow();
    const job = rushOrder();
    if (!job) {
      rushRow.row.hidden = true;
      rushRow.wait.hidden = false;
      rushRow.wait.textContent = 'Next rush order in ' + clockOf(rushNextInSeconds());
      rushSignature = '';
      return;
    }
    rushRow.wait.hidden = true;
    rushRow.row.hidden = false;
    const signature = job.kind + ':' + job.target + ':' + (job.item || job.cat || '');
    if (signature !== rushSignature) {
      rushSignature = signature;
      rushRow.text.textContent = 'RUSH: ' + JOB_KINDS[job.kind].text(job);
      rushRow.last = null;
    }
    const p = jobProgress(job, floorTally());
    const shown = Math.min(p.at, p.target);
    const left = Math.ceil(rushSecondsLeft());
    const stamp = shown + '/' + p.target + '/' + left + (p.ready ? '!' : '');
    if (rushRow.last === stamp) return;
    rushRow.last = stamp;
    rushRow.fill.style.width = ((shown / Math.max(1, p.target)) * 100).toFixed(1) + '%';
    rushRow.meta.innerHTML = '<span class="tycoon-job-reward">$' + formatNum(job.cash)
      + ' + ' + job.xp + ' XP</span> &middot; ' + formatNum(shown) + ' / ' + formatNum(p.target)
      + ' &middot; <span class="tycoon-rush-clock' + (left < 60 ? ' is-late' : '') + '">'
      + clockOf(left) + '</span>';
    rushRow.claim.disabled = !p.ready;
    rushRow.row.classList.toggle('is-ready', p.ready);
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
    const keptTrophies = state.trophies || {};
    const keptPromoAt = state.promoAt || 0;
    const keptJobsDone = state.jobsDone || 0;
    const keptRushDone = state.rushDone || 0;
    const keptName = state.gymName || '';
    state = Object.assign(defaultState(), {
      xp: keptXp,
      trophies: keptTrophies,
      jobsDone: keptJobsDone,
      rushDone: keptRushDone,
      promoAt: keptPromoAt,
      gymName: keptName,
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
    refreshTrophyUI();
    renderInventory();
    renderScene();
    updateLeaderboardEntry();
    save();
    toast('Franchised out -- ' + banked + ' points, +'
      + Math.round((franchiseMultiplier() - 1) * 100) + '% forever', 'good');
  }

  if (franchiseBtn) franchiseBtn.addEventListener('click', doFranchise);

  // ---- Trophy panel ----
  const trophyGridEl = document.getElementById('trophy-grid');
  const trophyCountEl = document.getElementById('trophy-count');
  const gymNameEl = document.getElementById('gym-name');
  const trophyEls = {};

  function buildTrophyUI() {
    if (!trophyGridEl) return;
    trophyGridEl.innerHTML = '';
    TROPHIES.forEach((t) => {
      const el = document.createElement('div');
      el.className = 'tycoon-trophy';
      el.innerHTML = '<span class="tycoon-trophy-name"></span>'
        + '<span class="tycoon-trophy-hint"></span>';
      el.querySelector('.tycoon-trophy-name').textContent = t.name;
      el.querySelector('.tycoon-trophy-hint').textContent = t.hint;
      trophyGridEl.appendChild(el);
      trophyEls[t.id] = el;
    });
  }

  function refreshTrophyUI() {
    if (!trophyGridEl) return;
    TROPHIES.forEach((t) => {
      const el = trophyEls[t.id];
      if (!el) return;
      const won = hasTrophy(t.id);
      el.classList.toggle('is-won', won);
      el.querySelector('.tycoon-trophy-hint').textContent = won
        ? 'Done -- $' + formatNum(t.cash) : t.hint;
    });
    trophyCountEl.textContent = trophiesWon() + ' of ' + TROPHIES.length;
  }

  // Swept off the earnings tick, so a total that creeps past a milestone
  // while nothing is being clicked still lands -- but throttled, because
  // gathering the context walks every room in every theme.
  let lastTrophySweep = 0;
  function checkTrophies(force) {
    const now = Date.now();
    if (!force && now - lastTrophySweep < 1500) return;
    lastTrophySweep = now;
    if (!state.trophies) state.trophies = {};
    const ctx = trophyContext();
    const won = [];
    TROPHIES.forEach((t) => {
      if (hasTrophy(t.id) || !t.got(ctx)) return;
      state.trophies[t.id] = true;
      state.balance += t.cash;
      state.lifetime += t.cash;
      won.push(t);
    });
    if (!won.length) return;
    refreshTrophyUI();
    refreshHud();
    won.forEach(announceTrophy);
    save();
  }

  // ---- The trophy card ----
  // Slides in from the top the way a console achievement does, holds long
  // enough to read, and slides out. Several won at once queue up and show
  // one after another rather than talking over each other.
  const trophyPopEl = document.getElementById('trophy-pop');
  const trophyQueue = [];
  let trophyShowing = false;
  function announceTrophy(t) {
    if (!trophyPopEl) { toast(t.name + ' -- $' + formatNum(t.cash), 'good'); return; }
    trophyQueue.push(t);
    if (!trophyShowing) showNextTrophy();
  }
  function showNextTrophy() {
    const t = trophyQueue.shift();
    if (!t) { trophyShowing = false; return; }
    trophyShowing = true;
    setText(trophyPopEl.querySelector('.tycoon-pop-name'), t.name);
    setText(trophyPopEl.querySelector('.tycoon-pop-cash'), '+$' + formatNum(t.cash));
    trophyPopEl.hidden = false;
    // Two frames: the first paints it off-screen, the second lets the
    // transition carry it in. Without the gap it just appears.
    requestAnimationFrame(() => requestAnimationFrame(() => trophyPopEl.classList.add('is-in')));
    setTimeout(() => {
      trophyPopEl.classList.remove('is-in');
      setTimeout(() => { trophyPopEl.hidden = true; showNextTrophy(); }, 450);
    }, 3600);
  }

  // The name is the player's, so it is kept the moment it is typed rather
  // than behind a save button nobody would press.
  let nameSaveTimer = null;
  if (gymNameEl) {
    gymNameEl.value = state.gymName || '';
    gymNameEl.addEventListener('input', () => {
      state.gymName = gymNameEl.value.slice(0, 28);
      clearTimeout(nameSaveTimer);
      nameSaveTimer = setTimeout(save, 400);
    });
  }

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

  // ---- The Counter tab ----
  // Rebuilt whole whenever the set of counters changes and written into in
  // place otherwise, the same way the jobs board is: the queue bars move
  // every tick and rebuilding the DOM under a cursor ten times a second
  // makes the buttons unclickable.
  const larderEl = document.getElementById('larder');
  const counterListEl = document.getElementById('counter-list');
  const counterDotEl = document.getElementById('tab-dot-counter');
  let counterRows = [];
  let counterSignature = '';

  function counterKeyOf(c) {
    return c.themeId + ':' + c.roomIndex + ':' + c.index + ':' + c.itemId;
  }
  function themeName(themeId) {
    const t = THEMES.find((x) => x.id === themeId);
    return t ? t.name : themeId;
  }
  function secondsText(sec) {
    const s2 = Math.max(0, Math.round(sec));
    if (s2 < 60) return s2 + 's';
    const m = Math.floor(s2 / 60);
    return m + 'm' + (s2 % 60 ? ' ' + (s2 % 60) + 's' : '');
  }

  function buildCounterUI(counters) {
    counterListEl.innerHTML = '';
    counterRows = [];
    if (!counters.length) {
      const none = document.createElement('p');
      none.className = 'tycoon-counter-empty';
      none.textContent = 'No counter on a floor yet.';
      counterListEl.appendChild(none);
      return;
    }
    counters.forEach((c) => {
      const card = document.createElement('div');
      card.className = 'tycoon-maker';
      card.innerHTML =
        '<div class="tycoon-maker-head">'
          + '<span class="tycoon-maker-name"></span>'
          + '<span class="tycoon-maker-where"></span>'
        + '</div>'
        + '<div class="tycoon-maker-queue"></div>'
        + '<div class="tycoon-maker-state"></div>'
        + '<div class="tycoon-maker-btns"></div>';
      const queue = card.querySelector('.tycoon-maker-queue');
      const pips = [];
      for (let i = 0; i < QUEUE_SLOTS; i++) {
        const pip = document.createElement('span');
        pip.className = 'tycoon-pip';
        pip.innerHTML = '<span></span>';
        queue.appendChild(pip);
        pips.push({ root: pip, fill: pip.firstChild });
      }
      const btns = card.querySelector('.tycoon-maker-btns');
      const makeBtns = RECIPES_OF[c.itemId].map((productId) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tycoon-make-btn';
        b.innerHTML = PRODUCTS[productId].name
          + '<span class="tycoon-make-secs">' + secondsText(PRODUCTS[productId].seconds) + '</span>';
        b.addEventListener('click', () => {
          if (startBatch(c.themeId, c.roomIndex, c.index, productId)) refreshCounterUI();
        });
        btns.appendChild(b);
        return { productId, btn: b };
      });
      const collect = document.createElement('button');
      collect.type = 'button';
      collect.className = 'tycoon-collect-btn';
      collect.textContent = 'Collect';
      collect.hidden = true;
      collect.addEventListener('click', () => {
        if (collectBatches(c.themeId, c.roomIndex, c.index)) {
          refreshCounterUI();
          refreshJobsUI();
          renderScene();
        }
      });
      btns.appendChild(collect);
      counterListEl.appendChild(card);
      counterRows.push({
        at: c,
        name: card.querySelector('.tycoon-maker-name'),
        where: card.querySelector('.tycoon-maker-where'),
        state: card.querySelector('.tycoon-maker-state'),
        pips,
        makeBtns,
        collect,
      });
    });
  }

  function refreshLarderUI() {
    if (!larderEl) return;
    const held = Object.keys(PRODUCTS).filter((p) => larderCount(p) > 0);
    const sig = held.map((p) => p + larderCount(p)).join('|');
    if (larderEl.dataset.sig === sig) return;
    larderEl.dataset.sig = sig;
    larderEl.innerHTML = '';
    if (!held.length) {
      const none = document.createElement('span');
      none.className = 'tycoon-larder-empty';
      none.textContent = 'Larder empty.';
      larderEl.appendChild(none);
      return;
    }
    held.forEach((p) => {
      const pill = document.createElement('span');
      pill.className = 'tycoon-stock';
      pill.style.color = PRODUCTS[p].color;
      pill.innerHTML = '<span class="tycoon-stock-dot"></span>'
        + '<span class="tycoon-stock-name"></span>'
        + '<span class="tycoon-stock-n"></span>';
      pill.querySelector('.tycoon-stock-name').textContent = PRODUCTS[p].name;
      pill.querySelector('.tycoon-stock-n').textContent = larderCount(p)
        + (larderCount(p) >= LARDER_CAP ? ' / full' : '');
      larderEl.appendChild(pill);
    });
  }

  function refreshCounterUI() {
    if (!counterListEl) return;
    const counters = countersPlaced();
    // The tab only appears once there is a counter to look at, the way the
    // staff tab only appears once there is somebody to hire.
    const show = counters.length > 0 || (state.owned.juicebar || 0) > 0
      || (state.owned.proshop || 0) > 0;
    if (tabEls.counter && tabEls.counter.hidden === show) {
      tabEls.counter.hidden = !show;
      if (!show && activePanel === 'counter') showPanel('shop');
    }
    const sig = counters.map(counterKeyOf).join(',');
    if (sig !== counterSignature) {
      counterSignature = sig;
      buildCounterUI(counters);
    }
    refreshLarderUI();
    const now = Date.now();
    counterRows.forEach((row) => {
      const c = row.at;
      const room = roomIn(c.themeId, c.roomIndex);
      if (!room) return;
      setText(row.name, itemById(c.itemId).name);
      setText(row.where, themeName(c.themeId)
        + (state.themeRooms[c.themeId].length > 1 ? ' ' + roomLabel(c.roomIndex) : ''));
      const q = queueAt(room, c.index);
      let ready = 0;
      let nextDone = 0;
      row.pips.forEach((pip, i) => {
        const b = q[i];
        if (!b) {
          pip.root.style.color = 'transparent';
          pip.root.classList.remove('is-done');
          pip.fill.style.width = '0%';
          return;
        }
        const product = PRODUCTS[b.p];
        pip.root.style.color = product.color;
        const left = (b.at - now) / 1000;
        if (left <= 0) {
          ready++;
          pip.root.classList.add('is-done');
        } else {
          pip.root.classList.remove('is-done');
          const frac = 1 - Math.min(1, left / product.seconds);
          pip.fill.style.width = Math.round(frac * 100) + '%';
          if (!nextDone) nextDone = left;
        }
      });
      setText(row.state, ready
        ? ready + (ready === 1 ? ' batch ready' : ' batches ready')
        : q.length
          ? 'Next in ' + secondsText(nextDone) + ' \u00b7 ' + q.length + ' of ' + QUEUE_SLOTS + ' on'
          : 'Idle.');
      row.collect.hidden = ready === 0;
      row.makeBtns.forEach((mb) => {
        const full = q.length >= QUEUE_SLOTS;
        const noRoom = larderRoom(mb.productId) === 0;
        const off = full || noRoom;
        if (mb.btn.disabled !== off) mb.btn.disabled = off;
        const why = full ? 'All three slots are running' : noRoom
          ? 'The larder is full of those' : '';
        if (mb.btn.title !== why) mb.btn.title = why;
      });
    });
    if (counterDotEl) {
      const ready = anythingReady();
      if (counterDotEl.hidden === ready) counterDotEl.hidden = !ready;
    }
  }

  function refreshStaffUI() {
    if (!staffListEl) return;
    // Nothing to show a new player but a column of locked rows, so the tab
    // itself stays away until there is somebody they could hire.
    const anyStaff = STAFF_ROLES.some(unlockedFor);
    if (tabEls.staff && tabEls.staff.hidden === anyStaff) {
      tabEls.staff.hidden = !anyStaff;
      if (!anyStaff && activePanel === 'staff') showPanel('shop');
    }
    STAFF_ROLES.forEach((role) => {
      const els = hireEls[role.id];
      if (!els) return;
      const unlocked = unlockedFor(role);
      const here = role.perRoom ? roomCashiers(activeRoom()) : 0;
      const have = role.perRoom ? here : staffCount(role.id);
      const cost = staffHireCost(role.id);
      els.root.classList.toggle('is-locked', !unlocked);
      els.count.textContent = role.perRoom
        ? ' ' + roomLabel(state.activeRoomIndex) + ' \u00b7 ' + here + ' of ' + CASHIERS_PER_ROOM
        : have ? ' x' + have : '';
      els.letGo.hidden = !have;
      if (!unlocked) {
        els.note.textContent = 'From level ' + role.unlockLevel;
        els.btn.textContent = 'Locked';
        els.btn.disabled = true;
        return;
      }
      if (role.perRoom) {
        const full = here >= CASHIERS_PER_ROOM;
        els.note.textContent = full ? 'Fully staffed'
          : 'Walks to the bubbles and empties them \u00b7 ' + Math.round(WAGE_SHARE_EACH * 100) + '% of the takings each';
        els.btn.textContent = full ? 'Room full' : 'Hire here -- $' + formatNum(cost);
        els.btn.disabled = full || state.balance < cost;
        return;
      }
      // What they are worth now, and what one more would add on top.
      const next = staffEffect(role.id, have + 1) - staffEffect(role.id, have);
      els.note.textContent = (have ? role.note(have) + ' \u00b7 ' : '')
        + 'next +' + (role.id === 'cleaner'
          ? next.toFixed(1) + ' vibe' : Math.round(next * 100) + '%')
        + ' for ' + Math.round(WAGE_SHARE_EACH * 100) + '% of the takings';
      els.btn.textContent = 'Hire -- $' + formatNum(cost);
      els.btn.disabled = state.balance < cost;
    });
    const share = wageShare();
    staffWagesEl.textContent = share > 0
      ? staffTotal() + ' on staff. Wages: ' + Math.round(share * 100) + '% of the takings'
        + (share >= WAGE_SHARE_MAX ? ' (the cap).' : '.')
      : 'No wages yet.';
  }

  // Free to do, and no severance: over-hiring should be a mistake you can
  // see in the numbers and then undo, not one you are stuck with.
  function letStaffGo(id) {
    if (staffCount(id) <= 0) return;
    if (id === 'cashier') {
      const room = activeRoom();
      if (!room || roomCashiers(room) <= 0) return;
      room.staff.cashier = roomCashiers(room) - 1;
    } else {
      state.staff[id] = staffCount(id) - 1;
    }
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
    if (id === 'cashier') {
      const room = activeRoom();
      if (!room || roomCashiers(room) >= CASHIERS_PER_ROOM) return;
    }
    const before = currentLevel();
    state.balance -= cost;
    if (id === 'cashier') {
      const room = activeRoom();
      if (!room.staff) room.staff = {};
      room.staff.cashier = roomCashiers(room) + 1;
    } else {
      if (!state.staff) state.staff = {};
      state.staff[id] = staffCount(id) + 1;
    }
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
  // The clock the whole day runs on: busy hours, the sky, the lamps. It
  // was invisible, so the gym filling up looked like weather.
  const clockEl = document.getElementById('tycoon-clock-time');
  function refreshClock() {
    if (!clockEl) return;
    const d = new Date();
    const text = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (clockEl.textContent !== text) clockEl.textContent = text;
  }
  function refreshRushUI() {
    refreshClock();
    if (!rushEl) return;
    const shut = !gymOpen();
    if (rushEl.hidden !== shut) rushEl.hidden = shut;
    if (shut) return;
    const f = rushFactor();
    const bonus = Math.round(RUSH_BONUS * f * 100);
    const when = rushLabel();
    // Rebuilt only when what it says changes: rebuilding it every tick
    // would swallow the tap that opens it.
    const sig = when + '|' + bonus + '|' + (f * 100).toFixed(0) + '|' + new Date().getMinutes();
    if (rushEl.dataset.sig === sig) return;
    rushEl.dataset.sig = sig;
    const hour = new Date().getHours();
    const next = hour < 7 ? 'The morning rush starts around 7.'
      : hour < 9 ? 'This is the morning rush.'
        : hour < 17 ? 'The evening rush starts around 5.'
          : hour < 20 ? 'This is the evening rush.'
            : 'It quietens down for the night from here.';
    rushEl.innerHTML = '<span class="tycoon-rush-when">' + when + '</span>'
      + '<span class="tycoon-rush-meter"><span class="tycoon-rush-fill" style="width:'
      + (f * 100).toFixed(0) + '%"></span></span>'
      + '<span class="tycoon-rush-bonus' + (bonus > 0 ? '' : ' is-none') + '">'
      + (bonus > 0 ? '+' + bonus + '%' : 'no bonus') + '</span>'
      + '<span class="tycoon-rush-hint" aria-hidden="true">?</span>'
      + '<span class="tycoon-rush-pop" role="note">'
        + '<b>How busy the gym is right now</b>'
        + '<span>It is ' + String(hour).padStart(2, '0') + ':' + String(new Date().getMinutes()).padStart(2, '0')
          + '. ' + when + ' \u2014 everything is earning '
          + (bonus > 0 ? '+' + bonus + '%' : 'its normal rate') + '.</span>'
        + '<span>The gym fills up mornings and evenings, on your clock. '
          + next + '</span>'
        + '<span>Quiet is never a penalty. Rammed is +' + Math.round(RUSH_BONUS * 100) + '%.</span>'
      + '</span>';
  }
  if (rushEl) {
    rushEl.addEventListener('click', () => rushEl.classList.toggle('is-open'));
    rushEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rushEl.classList.toggle('is-open'); }
      if (e.key === 'Escape') rushEl.classList.remove('is-open');
    });
    document.addEventListener('click', (e) => {
      if (!rushEl.contains(e.target)) rushEl.classList.remove('is-open');
    });
  }

  // ---- Open day button ----
  const promoBtn = document.getElementById('btn-promo');
  const promoWrap = document.getElementById('promo-wrap');
  // Whether one was running last tick, so its ending can be noticed.
  let promoWasRunning = false;
  function refreshPromoUI() {
    if (!promoBtn) return;
    // Nothing to multiply until the gym is open, and a bright button that
    // does nothing is the loudest thing on a new player's screen. The
    // whole pill goes, ? and all.
    const shut = !gymOpen();
    const pill = promoWrap || promoBtn;
    if (pill.hidden !== shut) pill.hidden = shut;
    if (shut) return;
    const left = promoSecondsLeft();
    const cooling = promoReadyInSeconds();
    promoBtn.classList.toggle('is-running', left > 0);
    promoBtn.disabled = cooling > 0;
    const html = left > 0
      ? 'Promo x' + PROMO_MULT + ' \u00b7 ' + Math.ceil(left) + 's'
      : cooling > 0
        ? 'Promo in ' + clockOf(cooling)
        : 'Promo';
    if (promoBtn.innerHTML !== html) promoBtn.innerHTML = html;
  }

  function runOpenDay() {
    if (promoReadyInSeconds() > 0) return;
    state.promoAt = Date.now();
    // The rate and the crowd both change the moment it starts, so neither
    // waits for whatever would have refreshed them next.
    membersKey = '';
    recomputeStats();
    refreshPromoUI();
    renderScene();
    save();
    toast('Promo on: x' + PROMO_MULT + ' for ' + PROMO_SECONDS + 's', 'good');
  }

  if (promoBtn) promoBtn.addEventListener('click', runOpenDay);
  const promoInfo = document.getElementById('promo-info');
  if (promoWrap && promoInfo) {
    const pop = promoWrap.querySelector('.tycoon-info-pop');
    pop.innerHTML = '<b>Promo</b>'
      + '<span>Runs a promotion for ' + PROMO_SECONDS + ' seconds: a burst of new members, and everything earns x'
      + PROMO_MULT + ' while it lasts.</span>'
      + '<span>Then it needs ' + Math.round(PROMO_COOLDOWN_SECONDS / 60) + ' minutes before the next one.</span>';
    promoInfo.addEventListener('click', (e) => { e.stopPropagation(); promoWrap.classList.toggle('is-open'); });
    document.addEventListener('click', (e) => { if (!promoWrap.contains(e.target)) promoWrap.classList.remove('is-open'); });
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
  const hudFloor = document.getElementById('hud-floor');
  function refreshHud() {
    hudTotal.textContent = '$' + formatNum(state.balance);
    hudGps.textContent = formatNum(gps) + '/s';
    // The figure alone, and never anything else: this box is a fixed size
    // and a longer string in it would resize the whole row of stats and
    // shove the page about.
    if (hudFloor) hudFloor.textContent = '$' + formatMoney(floorCash());
  }

  function recomputeStats() {
    gps = computeTotalGps(state.themeRooms);
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
    // An empty room has no takings to break down, so there is nothing to
    // show. It used to say "Room 1 is empty" here, which the hint box and
    // the Storage tray were already saying in their own words.
    const nothing = !gymOpen() || placed === 0;
    const box = document.getElementById('room-details');
    if (box && box.hidden !== nothing) box.hidden = nothing;
    if (nothing) return;
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
    // Asked of the arrangement itself rather than worked back out of the
    // room's rate by dividing the other multipliers off it: that only ever
    // divided off the two it named, so the wage bill, the franchise bonus
    // and a running open day were all quietly showing up as synergy.
    const arrangeMult = synergyMultipliers(room, shape);
    const arrangedGps = layout.reduce(
      (sum, id, i) => sum + (id ? gpsOf(id) * arrangeMult[i] : 0), 0);
    const bonusPct = baseSum > 0 ? Math.round((arrangedGps / baseSum - 1) * 100) : 0;
    // Written as a breakdown rather than a sentence. It used to be one long
    // run-on -- "7/12 slots filled -- base 140/s, +3% from arrangement
    // synergy, +9% vibe from the fittings, +16% rush bonus = 177/s" -- which
    // holds the answer to "why is this room worth what it is worth" and
    // gives it up to nobody. Same numbers, one per line, so the three
    // bonuses can be read against each other and against the base.
    const rows = [['Gear on the floor', '', formatNum(baseSum) + '/s']];
    const add = (label, pct, from) => {
      if (pct <= 0) return;
      rows.push([label, '+' + pct + '%', '+' + formatNum(baseSum * (pct / 100) * from) + '/s']);
    };
    add('Arrangement', bonusPct, 1);
    if (vibe > 0) {
      rows.push(['Fittings' + (vibe > VIBE_MAX_POINTS ? ' (at the cap)' : ''),
        '+' + vibePct + '%', '+' + formatNum(arrangedGps * (vibePct / 100)) + '/s']);
    }
    if (rushPct > 0) {
      const before = arrangedGps * (1 + vibePct / 100);
      rows.push(['Busy hour', '+' + rushPct + '%', '+' + formatNum(before * (rushPct / 100)) + '/s']);
    }
    const cell = (text, cls) => '<span class="' + cls + '"></span>';
    synergyEl.innerHTML = '<p class="tycoon-bd-head"></p>'
      + rows.map(() => '<span class="tycoon-bd-row">' + cell('', 'tycoon-bd-label')
        + cell('', 'tycoon-bd-pct') + cell('', 'tycoon-bd-num') + '</span>').join('')
      + '<span class="tycoon-bd-row is-total">' + cell('', 'tycoon-bd-label')
      + cell('', 'tycoon-bd-pct') + cell('', 'tycoon-bd-num') + '</span>';
    synergyEl.querySelector('.tycoon-bd-head').textContent =
      roomLabel() + ' \u00b7 ' + placed + '/' + layout.length + ' slots filled';
    // The folded-up line says the one thing worth knowing without opening
    // it: which room, and what it earns.
    setText(document.getElementById('room-details-sum'),
      roomLabel() + ' \u00b7 ' + formatNum(roomGps) + '/s');
    const rowEls = synergyEl.querySelectorAll('.tycoon-bd-row');
    rows.concat([['This room earns', '', formatNum(roomGps) + '/s']]).forEach((r, i) => {
      const el = rowEls[i];
      el.children[0].textContent = r[0];
      el.children[1].textContent = r[1];
      el.children[2].textContent = r[2];
    });
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
    if (!item || item.starter || availableCount(id) <= 0) return;
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

  // What a shop row says a piece does. A counter earns like anything else
  // and also makes stock, and the stock is the reason to buy one, so the row
  // has to say so where the gains/sec is said.
  function earnsLine(itemId) {
    const tier = tierOf(itemId);
    if (itemById(itemId).starter) {
      return 'Opens the location. Earns nothing itself'
        + (tier > 1 ? ' \u00b7 bubbles hold ' + Math.round(pileCapSeconds() / 60) + ' min' : '');
    }
    return '+' + formatNum(gpsOf(itemId)) + '/s on the floor'
      + (tier > 1 ? ' (' + TIER_NAMES[tier] + ')' : '')
      + (makesStock(itemId) ? ' \u00b7 makes ' + RECIPES_OF[itemId]
        .map((p) => PRODUCTS[p].name.toLowerCase() + 's').join(' and ') : '');
  }

  // Which category the shop is showing. Null is everything, which is where
  // it starts and where it stays unless somebody asks for less.
  let shopFilter = null;
  const shopFilterEl = document.getElementById('shop-filter');

  // A menu rather than a row of chips: nine chips did not fit any width
  // short of a desktop, and the ones off the edge might as well not exist.
  function buildShopFilter() {
    if (!shopFilterEl) return;
    const cats = [null].concat([...new Set(ITEMS.map((i) => CATEGORY[i.id]))]);
    shopFilterEl.innerHTML = '<label class="tycoon-filter-box">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
      + '<path d="M3 5h18v2.2l-7 7.3V20l-4-2v-5.5L3 7.2Z"/></svg>'
      + '<span class="tycoon-filter-word">Filter</span>'
      + '<select class="tycoon-filter-select" aria-label="Show one category"></select></label>';
    const sel = shopFilterEl.querySelector('select');
    cats.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat || '';
      opt.textContent = cat ? CATEGORY_META[cat].name : 'All gear';
      opt.selected = cat === shopFilter;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      shopFilter = sel.value || null;
      shopFilterEl.classList.toggle('is-on', !!shopFilter);
      refreshShopUI();
    });
  }

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
          ? '+' + Math.round(item.vibe * VIBE_PER_POINT * 100) + '% vibe for its room'
          : earnsLine(item.id)) + '</span>' +
        '<div class="shop-item-buy">' +
          '<button class="shop-buy-btn" type="button">Buy</button>' +
        '</div>' +
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

  // ---- What to do next ----
  // In priority order: the thing that is finished and waiting beats the
  // thing that is merely available, and both beat advice. Only ever one
  // line, because a list of five suggestions is not a suggestion.
  const nextStepEl = document.getElementById('next-step');
  function nextStep() {
    if (!gymOpen()) return null;

    const tally = floorTally();
    const readyJobs = (state.jobs || []).filter((j) => jobProgress(j, tally).ready).length;
    const rush = rushOrder();
    if (rush && jobProgress(rush, tally).ready) {
      return ['Rush order done. Hand it in before the clock runs out.', 'jobs'];
    }
    if (readyJobs) {
      return [readyJobs === 1 ? 'A job is done. Hand it in.' : readyJobs + ' jobs are done. Hand them in.', 'jobs'];
    }
    const readyCounter = countersPlaced().find((c) => readyAt(c.room, c.index) > 0);
    if (readyCounter) {
      return ['Stock is ready on the ' + itemById(readyCounter.itemId).name + '.', 'counter'];
    }
    // A spare desk in Storage belongs to a location that has none yet, and
    // the useful thing to say about it is which one.
    const deskless = THEMES.filter((t) => unlockedFor(t) && !deskPlacedIn(t.id));
    if (deskless.length && deskless[0].id !== state.activeTheme) {
      return ['The ' + deskless[0].name + ' has no desk yet. Go there and take its free desk from the Shop.', null];
    }
    const waiting = ITEMS.reduce((n, item) => n + (item.starter ? 0 : availableCount(item.id)), 0);
    if (waiting) {
      return [waiting === 1 ? 'One piece in Storage is earning nothing. Put it down.'
        : waiting + ' pieces in Storage are earning nothing. Put them down.', null];
    }
    const inBubbles = floorCash();
    if (inBubbles >= 1) {
      return ['$' + formatMoney(inBubbles) + ' is in the bubbles. Tap them.', null];
    }
    // Nothing is waiting, so the question becomes what to spend on.
    const idle = countersPlaced().find((c) => queueAt(c.room, c.index).length === 0);
    if (idle) {
      return ['The ' + itemById(idle.itemId).name + ' is idle. Start a batch.', 'counter'];
    }
    const hire = STAFF_ROLES.find((r) => unlockedFor(r) && staffCount(r.id) === 0
      && state.balance >= staffHireCost(r.id));
    if (hire) {
      return ['You can afford a ' + hire.name + ': ' + hire.note(1) + '.', 'staff'];
    }
    const up = ITEMS.find((i) => canUpgrade(i.id) && state.balance >= upgradeCost(i.id));
    if (up) {
      return ['You can upgrade the ' + up.name + ' to ' + TIER_NAMES[tierOf(up.id) + 1] + '.', 'shop'];
    }
    const buy = ITEMS.filter((i) => unlockedFor(i) && !i.starter && state.balance >= costFor(i))
      .sort((a, b) => costFor(b) - costFor(a))[0];
    if (buy) {
      return ['You can afford a ' + buy.name + '.', 'shop'];
    }
    return ['Nothing waiting. Let it earn.', null];
  }

  function refreshNextStep() {
    if (!nextStepEl) return;
    const step = nextStep();
    if (!step) {
      if (!nextStepEl.hidden) nextStepEl.hidden = true;
      return;
    }
    if (nextStepEl.hidden) nextStepEl.hidden = false;
    setText(nextStepEl.querySelector('.tycoon-next-text'), step[0]);
    const go = nextStepEl.querySelector('.tycoon-next-go');
    const tab = step[1] && tabEls[step[1]] && !tabEls[step[1]].hidden ? step[1] : null;
    if (go.hidden !== !tab) go.hidden = !tab;
    if (tab) {
      setText(go, 'Open ' + tabEls[tab].firstChild.textContent);
      go.onclick = () => showPanel(tab);
    }
  }

  const openHintEl = document.getElementById('open-hint');
  function refreshOpenHint() {
    if (!openHintEl) return;
    const open = gymOpen();
    openHintEl.hidden = open;
    if (open) return;
    const theme = THEMES.find((t) => t.id === state.activeTheme);
    openHintEl.textContent = availableCount('frontdesk') > 0
      ? 'The ' + theme.name + ' is closed. Take its free Customer Desk from the Shop and put it on the floor.'
      : 'The ' + theme.name + ' is closed. Take its free Customer Desk from the Shop and put it on the floor.';
  }

  function refreshShopUI() {
    refreshOpenHint();
    ITEMS.forEach((item) => {
      const els = shopEls[item.id];
      const shown = !shopFilter || CATEGORY[item.id] === shopFilter;
      if (els.root.hidden !== !shown) els.root.hidden = !shown;
      if (!shown) return;
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
      // "x0" on every row you own none of is noise; the count only shows
      // once there is one to count.
      els.ownedEl.textContent = owned ? 'x' + owned : '';
      // Shut until the Customer Desk is down, apart from the desk itself --
      // which is only for sale while some location still has none.
      const shut = item.starter ? !deskWanted() : !gymOpen();
      els.root.classList.toggle('is-shut', shut);
      if (shut) {
        els.buyBtn.textContent = item.starter ? 'Placed here' : 'Place the desk first';
        els.buyBtn.disabled = true;
        els.root.classList.remove('is-affordable');
        els.upBtn.hidden = true;
        return;
      }
      els.buyBtn.textContent = item.starter ? 'Take it · free' : 'Buy — $' + formatNum(cost);
      const affordable = item.starter || state.balance >= cost;
      els.buyBtn.disabled = !affordable;
      els.root.classList.toggle('is-affordable', affordable);

      // What it earns now, which is not what it says on the tin once it has
      // been upgraded, and the control to take it further.
      const tier = tierOf(item.id);
      els.tierEl.textContent = item.name + (tier > 1 ? ' ' + TIER_NAMES[tier] : '');
      if (!item.vibe) els.gpsEl.textContent = earnsLine(item.id);
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
    if (item.starter ? !deskWanted() : !gymOpen()) return;
    const cost = item.starter ? 0 : costFor(item);
    if (state.balance < cost) return;
    const before = currentLevel();
    state.balance -= cost;
    state.owned[id] = (state.owned[id] || 0) + 1;
    state.xp = (state.xp || 0) + xpForSpend(cost);
    const after = currentLevel();
    if (after > before) announceLevel(after);
    if (item.starter) {
      // The desk goes straight into your hand to be put down, never into
      // Storage. Cancelling throws it away; the shop offers it again.
      const idx = state.activeRoomIndex;
      const shape = roomShapeFor(state.activeTheme, idx);
      if (editing) cancelEdit();
      beginEdit(id, idx, { u: shape.cols / 2, v: shape.rows / 2 }, null);
      scrollToRoom(idx);
      refreshShopUI();
      renderInventory();
      save();
      return;
    }
    // Auto-drop new gear into an open slot in the room+theme currently in
    // view so it starts earning right away. Once that's full, further
    // purchases sit in inventory until you free up a slot somewhere --
    // that's the point where arranging what to keep on the floor (or
    // switching theme, or buying another room) actually becomes a decision.
    const room = activeRoom();
    const emptyIndex = room.layout.indexOf(null);
    if (emptyIndex !== -1) {
      const shape = roomShapeFor(state.activeTheme, state.activeRoomIndex);
      // Wherever the old grid would have put it, or the nearest clear floor
      // to that -- never on top of something already standing there.
      const spot = findFreeSpot(room, shape, id, 0, defaultSpot(shape, emptyIndex, room.layout.length));
      if (spot) {
        room.layout[emptyIndex] = id;
        if (!room.spots) room.spots = new Array(room.layout.length).fill(null);
        room.spots[emptyIndex] = { u: spot.u, v: spot.v, r: 0 };
      } else {
        toast('Nowhere clear to stand it -- it has gone to Storage', null);
      }
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
  let floorCtx = floorCanvas.getContext('2d');
  // What Place all would put down here, biggest first so the awkward pieces
  // get the room they need before the small ones fill it up. The count on
  // the button comes from the same list, so it can never promise more than
  // it will do.
  function placeAllQueue() {
    const queue = [];
    ITEMS.slice().reverse().forEach((item) => {
      // The spare desks are for the other locations. One is already down
      // here, or one goes down here, and no more than that.
      const want = item.starter
        ? (deskPlacedIn(state.activeTheme) ? 0 : Math.min(1, availableCount(item.id)))
        : availableCount(item.id);
      for (let i = 0; i < want; i++) queue.push(item.id);
    });
    return queue;
  }

  function placeAllStored() {
    const roomIndex = state.activeRoomIndex;
    const room = activeRooms()[roomIndex];
    const shape = roomShapeFor(state.activeTheme, roomIndex);
    if (!room) return;
    const queue = placeAllQueue();
    if (!queue.length) return;
    let placed = 0;
    queue.forEach((itemId) => {
      const slot = room.layout.indexOf(null);
      if (slot === -1) return;
      const at = findFreeSpot(room, shape, itemId, 0, null);
      if (!at) return;
      if (!room.spots) room.spots = new Array(room.layout.length).fill(null);
      room.layout[slot] = itemId;
      room.spots[slot] = { u: at.u, v: at.v, r: 0 };
      placed++;
    });
    const left = queue.length - placed;
    toast(placed
      ? 'Put ' + placed + (placed === 1 ? ' piece' : ' pieces') + ' down'
        + (left ? ', and ' + left + ' would not fit' : '')
      : 'Nothing would fit in ' + roomLabel(roomIndex), placed ? 'good' : null);
    recomputeStats();
    renderScene();
    renderInventory();
    refreshRoomActions();
    save();
  }

  const placeAllBtn = document.getElementById('btn-place-all');
  if (placeAllBtn) placeAllBtn.addEventListener('click', placeAllStored);
  function refreshPlaceAll() {
    if (!placeAllBtn) return;
    const waiting = placeAllQueue().length;
    const show = waiting > 1 && gymOpen();
    if (placeAllBtn.hidden !== !show) placeAllBtn.hidden = !show;
    if (show) setText(placeAllBtn, 'Place all ' + waiting);
  }

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
  // How much room the plan canvas leaves around the rooms themselves. The
  // ground is not drawn here any more -- it has its own canvas the size of
  // the window -- so this is only the space the plan needs to breathe.
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
  const ZOOM_MIN = 0.12;
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
    // Sized before the ground is measured against it, since the ground is
    // drawn from where this puts the plan canvas.
    queueGroundPaint();
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
    // Sun-bleached decking over green water.
    boardwalk: { floorA: '#c3a069', floorB: '#ad8b55', wallL: '#8a6a41', wallR: '#6d5232', bgTop: '#2d7f8c', bg: '#0f3846' },
  };
  // The colour the ground around the plan is washed with -- the theme's own
  // light spilling out past the rooms.
  const AMBIENT_WASH = {
    garage: 'rgba(120, 82, 40, 0.5)',
    basement: 'rgba(58, 82, 104, 0.5)',
    rooftop: 'rgba(96, 148, 190, 0.55)',
    boardwalk: 'rgba(240, 186, 108, 0.5)',
  };

  // Per-theme light: the colour of the downlights and of the pool they
  // throw on the floor.
  const LIGHT_COLORS = {
    garage: { glow: 'rgba(255,196,120,0.30)', bulb: '#fff2cf' },
    basement: { glow: 'rgba(170,210,255,0.20)', bulb: '#eaf7ff' },
    rooftop: { glow: 'rgba(255,236,180,0.38)', bulb: '#fff4d6' },
    // Open to the sky like the rooftop, but hung with festoon bulbs rather
    // than lit by nothing, so it reads as somewhere that stays open late.
    boardwalk: { glow: 'rgba(255,214,150,0.34)', bulb: '#fff1cd' },
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

  // Which quarter turn the piece currently being drawn is standing at.
  // Applied inside the primitives every builder is written in terms of, and
  // nowhere a builder can see it: a piece is described once, facing one way,
  // and comes out right at all four of them.
  //
  // This is why the equipment is geometry rather than pictures. A picture
  // gives two usable views -- itself and its mirror -- and the other two
  // quarter turns are the back of the object, which a front view does not
  // contain. Boxes on a lattice have no such problem.
  let propTurn = 0;
  function turnUV(u, v) {
    if (propTurn === 1) return { u: -v, v: u };
    if (propTurn === 2) return { u: -u, v: -v };
    if (propTurn === 3) return { u: v, v: -u };
    return { u, v };
  }

  // A single point on a prop's surface, (u, v) tile-units from its base and
  // liftPx up off the ground -- for a box drawn at that same (u, v, lift)
  // this lands exactly on its right-face plane, so small flat details
  // (windows, screens, buttons) can be stamped directly onto a box's face.
  // Whether the face whose outward normal is (du, dv) in the piece's own
  // frame is turned toward the viewer. Anything stamped flat on a face --
  // a screen, a door, a control panel -- has to be left off when that face
  // is round the back, or it reads as a sticker floating on the wrong side.
  function faceShows(du, dv) {
    const t = turnUV(du, dv);
    return t.u + t.v > 0.0001;
  }

  // Draw a piece's parts back to front for the way it is standing. A piece
  // with a front and a back -- a bench with its rack at the head, a
  // treadmill with its console -- was drawn in one fixed order, so on the
  // turns where the back is nearest the viewer the two ends came out the
  // wrong way round and the bench appeared to sit behind its own bar. Each
  // part gives the point it stands at, and they are sorted by how near
  // that point is once the turn is applied.
  function drawParts(parts) {
    parts.slice().sort((a, b) => {
      const ta = turnUV(a.u || 0, a.v || 0);
      const tb = turnUV(b.u || 0, b.v || 0);
      return (ta.u + ta.v) - (tb.u + tb.v);
    }).forEach((p) => p.draw());
  }

  function isoScreenPoint(base, u, v, liftPx) {
    const t = turnUV(u, v);
    const c = isoVecRaw(t.u, t.v);
    return { x: base.x + c.x, y: base.y + c.y - (liftPx || 0) };
  }

  // A round bar or post between two points on the lattice, at one height --
  // half of this equipment is made of them, and a box never reads as one.
  function drawIsoBar(ctx, base, u0, v0, u1, v1, lift, thick, color) {
    const a = isoScreenPoint(base, u0, v0, lift);
    const b = isoScreenPoint(base, u1, v1, lift);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(Math.atan2(dy, dx));
    const grad = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2);
    grad.addColorStop(0, shade(color, 26));
    grad.addColorStop(1, shade(color, -26));
    ctx.beginPath();
    roundedQuadPath(ctx,
      { x: -thick / 2, y: -thick / 2 }, { x: len + thick / 2, y: -thick / 2 },
      { x: len + thick / 2, y: thick / 2 }, { x: -thick / 2, y: thick / 2 },
      thick / 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  // A flat panel lying on the floor: a mat, a platform, a rubber square.
  function drawIsoSlab(ctx, base, offU, offV, halfA, halfB, lift, color, radius) {
    const t = turnUV(offU, offV);
    const hA = propTurn % 2 ? halfB : halfA;
    const hB = propTurn % 2 ? halfA : halfB;
    const c = isoVecRaw(t.u, t.v);
    const gx = base.x + c.x;
    const gy = base.y + c.y - (lift || 0);
    const at = (a, b) => {
      const v = isoVecRaw(a, b);
      return { x: gx + v.x, y: gy + v.y };
    };
    ctx.beginPath();
    roundedQuadPath(ctx, at(hA, hB), at(hA, -hB), at(-hA, -hB), at(-hA, hB),
      radius == null ? 3 : radius);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
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
    // The turn: the offset rotates on the lattice and the two half-extents
    // swap on the odd quarters, so each face keeps its own meaning and goes
    // on being lit from the same side of the room whichever way round the
    // piece is standing.
    const t = turnUV(offU, offV);
    const hA = propTurn % 2 ? halfB : halfA;
    const hB = propTurn % 2 ? halfA : halfB;
    const c = isoVecRaw(t.u, t.v);
    const groundY = base.y + c.y - lift;
    const groundX = base.x + c.x;

    const front = isoVecRaw(hA, hB);
    const right = isoVecRaw(hA, -hB);
    const back = isoVecRaw(-hA, -hB);
    const left = isoVecRaw(-hA, hB);

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
    const r = Math.min(5, Math.min(hA, hB) * ROOM.tileW * 0.4, height * 0.35);

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
    // It stops short of both ends by the corner radius, so it stays on the
    // edge it is lighting: run the other way it overshot the box at top and
    // bottom, and a stack of boxes drew one bright line straight down the
    // piece and on out onto the floor.
    if (height > r * 2 + 1) {
      ctx.beginPath();
      ctx.moveTo(pFront.x, pFront.y - r);
      ctx.lineTo(top(pFront).x, top(pFront).y + r);
      ctx.strokeStyle = shade(color, 48);
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

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
    sauna: 2.2,
    gearfridge: 1.4,
    soundsystem: 1.6,
    desk: 2.0,
    frontdesk: 1.8,
    cubicle: 2.0,
    officepod: 1.7,
    palm: 0.8,
    cooler: 0.6,
    mirrorwall: 1.7,
    neon: 1.6,
  };
  const DEFAULT_FOOTPRINT = 1.4;

  // The size a piece is drawn at, along its longest side. The same as its
  // footprint now that every piece is built to its own dimensions.
  const ITEM_DRAW_SIZE = {};

  // A lattice tile is a third of a metre, so this is a metre across the
  // floor in pixels.
  const PX_PER_METRE = ROOM.tileW * 3;

  // What one metre of *height* comes out as on screen. Set so a person
  // stands the right height next to a squat rack, and everything else
  // built by hand is measured against the same number.
  const PX_PER_METRE_TALL = (ROOM.tileH * 1.45) * (3 / 1.15);

  // Metres to lattice units on the floor, and metres to pixels upward. Every
  // piece below is written in these, so a bench is 0.45 tall because a bench
  // is 0.45 tall -- there is no per-piece fudge factor between the model and
  // the drawing any more.
  const M = TILES_PER_METRE;
  const MH = PX_PER_METRE_TALL;

  // Every piece of equipment, drawn as geometry in real dimensions: `M` turns
  // metres into lattice units on the floor, `MH` turns metres into pixels
  // upward. A builder never mentions the turn -- drawIsoBox, drawIsoBar,
  // drawIsoSlab and isoScreenPoint apply it -- so a piece written here comes
  // out right at all four quarter turns, lit from the same side at each.
  //
  // Gym equipment is powder-coated steel, black upholstery and rubber. The
  // room's own lighting does the rest, so the palette stays narrow.
  const STEEL = '#9fb0c6';
  const STEEL_LT = '#c3d0de';
  const FRAME = '#5d6a80';
  const FRAME_DK = '#3d4658';
  const PAD = '#2b3140';
  const RUBBER = '#20232b';
  const WEIGHT = '#454f63';
  const GLOW = '#5fd0e6';

  const PROP_BUILDERS = {
    // A pair on a small rubber square. Knee-high clutter, not furniture.
    dumbbell: (ctx, b) => {
      drawIsoSlab(ctx, b, 0, 0, 0.40 * M, 0.32 * M, 0, RUBBER, 4);
      [-0.16, 0.16].forEach((v) => {
        drawIsoBar(ctx, b, -0.13 * M, v * M, 0.13 * M, v * M, 0.13 * MH, 6, STEEL_LT);
        [-0.19, 0.19].forEach((u) => {
          drawIsoDisc(ctx, isoScreenPoint(b, u * M, v * M, 0.13 * MH), 8, 10, FRAME_DK);
          drawIsoDisc(ctx, isoScreenPoint(b, u * M, v * M, 0.13 * MH), 2.8, 3.6, STEEL);
        });
      });
    },

    // An A-frame with two tiers of dumbbells racked along it.
    dumbbellrack: (ctx, b) => {
      const L = 1.55, D = 0.5;
      [-1, 1].forEach((s) => {
        drawIsoBox(ctx, b, s * (L / 2 - 0.06) * M, 0, 0.06 * M, D / 2 * M, 0.80 * MH, FRAME, 0);
      });
      drawIsoBox(ctx, b, 0, 0, L / 2 * M, D / 2 * M, 0.09 * MH, FRAME_DK, 0);
      [[0.46, 0.20], [0.74, 0.03]].forEach(([h, lean]) => {
        drawIsoBox(ctx, b, 0, lean * M, (L / 2 - 0.05) * M, 0.10 * M, 0.06 * MH, STEEL, h * MH);
        for (let i = -2; i <= 2; i++) {
          const u = i * 0.30;
          drawIsoBar(ctx, b, u * M, (lean - 0.14) * M, u * M, (lean + 0.14) * M,
            (h + 0.10) * MH, 5, STEEL_LT);
          [-0.16, 0.16].forEach((dv) => {
            drawIsoDisc(ctx, isoScreenPoint(b, u * M, (lean + dv) * M, (h + 0.10) * MH),
              5, 6.5, '#b4453c');
          });
        }
      });
    },

    // Rolled out flat, with a lighter strip down the middle of it.
    mat: (ctx, b) => {
      drawIsoSlab(ctx, b, 0, 0, 0.90 * M, 0.33 * M, 0.02 * MH, '#4b4fa8', 4);
      drawIsoSlab(ctx, b, 0, 0, 0.78 * M, 0.22 * M, 0.025 * MH, '#5a5fc4', 4);
    },

    // Bench press: a padded bench with a rack at the head of it and a loaded
    // bar sitting in the hooks.
    bench: (ctx, b) => {
      const L = 1.30;
      const head = -(L / 2 + 0.16);
      // Two feet and a padded bench across them.
      const seat = () => {
        [-1, 1].forEach((sgn) => {
          drawIsoBox(ctx, b, sgn * (L / 2 - 0.14) * M, 0, 0.09 * M, 0.22 * M, 0.34 * MH, FRAME, 0);
        });
        drawIsoBox(ctx, b, 0, 0, L / 2 * M, 0.20 * M, 0.14 * MH, PAD, 0.32 * MH);
        // The head end is raised a little, the way a bench's is.
        drawIsoBox(ctx, b, -(L / 2 - 0.20) * M, 0, 0.22 * M, 0.20 * M, 0.08 * MH, PAD, 0.46 * MH);
      };
      // The rack at the head end, with a loaded bar sitting in the hooks.
      const rack = () => {
        [-1, 1].forEach((sgn) => {
          drawIsoBox(ctx, b, head * M, sgn * 0.34 * M, 0.06 * M, 0.06 * M, 1.02 * MH, FRAME, 0);
          drawIsoBox(ctx, b, head * M, sgn * 0.34 * M, 0.10 * M, 0.05 * M, 0.10 * MH,
            FRAME_DK, 0.94 * MH);
        });
        drawIsoBar(ctx, b, head * M, -0.74 * M, head * M, 0.74 * M, 1.02 * MH, 6, STEEL_LT);
        [-0.60, 0.60].forEach((v) => {
          const at = isoScreenPoint(b, head * M, v * M, 1.02 * MH);
          drawIsoDisc(ctx, at, 9, 12, WEIGHT);
          drawIsoDisc(ctx, at, 3.2, 4.2, STEEL);
        });
      };
      drawParts([{ u: 0, v: 0, draw: seat }, { u: head, v: 0, draw: rack }]);
    },

    // Squat rack: two uprights on feet, a loaded bar in the hooks at chest
    // height, and a safety bar low down between them.
    rack: (ctx, b) => {
      const W = 1.25;
      [-1, 1].forEach((s) => {
        drawIsoBox(ctx, b, 0, s * (W / 2) * M, 0.28 * M, 0.07 * M, 0.10 * MH, FRAME_DK, 0);
        drawIsoBox(ctx, b, 0, s * (W / 2) * M, 0.07 * M, 0.07 * M, 1.80 * MH, FRAME, 0.10 * MH);
      });
      drawIsoBar(ctx, b, 0, -(W / 2) * M, 0, (W / 2) * M, 0.55 * MH, 5, FRAME_DK);
      drawIsoBar(ctx, b, 0.06 * M, -(W / 2 + 0.42) * M, 0.06 * M, (W / 2 + 0.42) * M,
        1.42 * MH, 6, STEEL_LT);
      [-1, 1].forEach((s) => {
        const at = isoScreenPoint(b, 0.06 * M, s * (W / 2 + 0.30) * M, 1.42 * MH);
        drawIsoDisc(ctx, at, 9, 12, WEIGHT);
        drawIsoDisc(ctx, at, 3.4, 4.6, STEEL);
      });
    },

    // Cable machine: a weight stack in a frame, a pulley at the top and a bar
    // hanging off the cable.
    cable: (ctx, b) => {
      const W = 1.35;
      [-1, 1].forEach((s) => {
        drawIsoBox(ctx, b, 0, s * (W / 2) * M, 0.24 * M, 0.07 * M, 0.09 * MH, FRAME_DK, 0);
        drawIsoBox(ctx, b, 0, s * (W / 2) * M, 0.07 * M, 0.07 * M, 1.80 * MH, FRAME, 0.09 * MH);
      });
      drawIsoBox(ctx, b, 0, 0, 0.10 * M, W / 2 * M, 0.09 * MH, FRAME, 1.78 * MH);
      // The stack of plates against one upright, and the bar hanging off the
      // pulley at the other -- drawn back to front for the turn, or the bar
      // ends up behind the frame it hangs in front of.
      const stack = () => {
        drawIsoBox(ctx, b, -0.02 * M, -(W / 2 - 0.02) * M, 0.16 * M, 0.16 * M,
          0.95 * MH, WEIGHT, 0.09 * MH);
        for (let i = 0; i < 5; i++) {
          const p = isoScreenPoint(b, 0.14 * M, -(W / 2 - 0.02) * M, (0.20 + i * 0.16) * MH);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(p.x - 7, p.y - 1.5, 14, 2);
        }
      };
      const bar = () => {
        const topP = isoScreenPoint(b, 0, (W / 2 - 0.14) * M, 1.76 * MH);
        const barP = isoScreenPoint(b, 0, (W / 2 - 0.14) * M, 1.35 * MH);
        ctx.beginPath();
        ctx.moveTo(topP.x, topP.y);
        ctx.lineTo(barP.x, barP.y);
        ctx.strokeStyle = 'rgba(220,232,244,0.75)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        drawIsoBar(ctx, b, -0.26 * M, (W / 2 - 0.14) * M, 0.26 * M, (W / 2 - 0.14) * M,
          1.33 * MH, 5, STEEL_LT);
      };
      drawParts([{ u: 0, v: -(W / 2), draw: stack }, { u: 0, v: W / 2, draw: bar }]);
    },

    // Two metres of deck with a console on a mast at the back of it.
    treadmill: (ctx, b) => {
      const L = 1.90, W = 0.80;
      const back = -(L / 2 - 0.14);
      const deck = () => {
        drawIsoBox(ctx, b, 0, 0, L / 2 * M, W / 2 * M, 0.14 * MH, STEEL, 0);
        drawIsoSlab(ctx, b, 0.06 * M, 0, (L / 2 - 0.16) * M, (W / 2 - 0.15) * M,
          0.16 * MH, RUBBER, 3);
      };
      // The mast, the console on it and the handles either side.
      const console_ = () => {
        [-1, 1].forEach((s) => {
          drawIsoBox(ctx, b, back * M, s * (W / 2 - 0.09) * M, 0.05 * M, 0.05 * M,
            1.00 * MH, STEEL, 0.14 * MH);
        });
        drawIsoBox(ctx, b, back * M, 0, 0.06 * M, (W / 2 - 0.02) * M, 0.28 * MH,
          FRAME_DK, 1.02 * MH);
        if (faceShows(1, 0)) {
          const s = isoScreenPoint(b, (back + 0.07) * M, 0, 1.22 * MH);
          ctx.fillStyle = GLOW;
          ctx.fillRect(s.x - 8, s.y - 5, 16, 9);
        }
        [-1, 1].forEach((sgn) => {
          drawIsoBar(ctx, b, (back + 0.05) * M, sgn * (W / 2 - 0.04) * M,
            (back + 0.62) * M, sgn * (W / 2 - 0.04) * M, 0.92 * MH, 5, STEEL_LT);
        });
      };
      drawParts([{ u: 0, v: 0, draw: deck }, { u: back, v: 0, draw: console_ }]);
    },

  // A timber cabin with a glass door and a warm slot of light behind it.
    sauna: (ctx, b) => {
      const L = 1.90, D = 1.40, H = 1.72;
      drawIsoBox(ctx, b, 0, 0, L / 2 * M, D / 2 * M, H * MH, '#8a6440', 0);
      drawIsoBox(ctx, b, 0, 0, (L / 2 + 0.05) * M, (D / 2 + 0.05) * M, 0.10 * MH, '#6d4e31', H * MH);
      // Board lines down the face that looks at the viewer, so it reads as
      // timber rather than as a crate.
      // Board lines down whichever of the two long faces is turned toward
      // the viewer, so the cabin reads as timber from either side.
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 1.5;
      const boardFace = faceShows(1, 0) ? 1 : -1;
      for (let i = -2; i <= 2; i++) {
        const p0 = isoScreenPoint(b, boardFace * (L / 2) * M, i * 0.24 * M, 0.04 * MH);
        const p1 = isoScreenPoint(b, boardFace * (L / 2) * M, i * 0.24 * M, (H - 0.04) * MH);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      ctx.restore();
      // The door is on one face only: from behind, the cabin is just timber.
      if (!faceShows(1, 0)) return;
      const dl = isoScreenPoint(b, (L / 2) * M, -0.30 * M, 0.06 * MH);
      const dr = isoScreenPoint(b, (L / 2) * M, 0.34 * M, 0.06 * MH);
      const doorH = 1.48 * MH;
      ctx.beginPath();
      ctx.moveTo(dl.x, dl.y);
      ctx.lineTo(dr.x, dr.y);
      ctx.lineTo(dr.x, dr.y - doorH);
      ctx.lineTo(dl.x, dl.y - doorH);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,168,72,0.85)';
      ctx.fill();
      ctx.strokeStyle = '#5c4128';
      ctx.lineWidth = 2;
      ctx.stroke();
    },

    // A double glass-door fridge, lit from inside. It used to be a single
    // locker of a thing at a fraction of the floor, which at its price made
    // it the best money in the game per square metre by a mile.
    gearfridge: (ctx, b) => {
      const W = 1.36, D = 0.66, H = 1.58;
      drawIsoBox(ctx, b, 0, 0, W / 2 * M, D / 2 * M, H * MH, FRAME_DK, 0);
      // The doors are the front of it: turned away, you see the back of a
      // fridge, which is a plain cabinet.
      if (!faceShows(0, 1)) return;
      [[-(W / 2 - 0.08), -0.04], [0.04, W / 2 - 0.08]].forEach(([d0, d1]) => {
        const a = isoScreenPoint(b, d0 * M, (D / 2) * M, 0.12 * MH);
        const c = isoScreenPoint(b, d1 * M, (D / 2) * M, 0.12 * MH);
        const gh = 1.24 * MH;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
        ctx.lineTo(c.x, c.y - gh); ctx.lineTo(a.x, a.y - gh);
        ctx.closePath();
        ctx.fillStyle = 'rgba(120,220,240,0.5)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const s0 = isoScreenPoint(b, d0 * M, (D / 2) * M, (0.30 + i * 0.36) * MH);
          const s1 = isoScreenPoint(b, d1 * M, (D / 2) * M, (0.30 + i * 0.36) * MH);
          ctx.beginPath();
          ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y);
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.stroke();
        }
      });
    },

    // Two stacks and a deck between them.
    soundsystem: (ctx, b) => {
      [-1, 1].forEach((s) => {
        drawIsoBox(ctx, b, 0, s * 0.56 * M, 0.24 * M, 0.24 * M, 1.40 * MH, FRAME_DK, 0);
        const f = isoScreenPoint(b, 0.20 * M, s * 0.52 * M, 0.95 * MH);
        drawIsoDisc(ctx, f, 8, 10, '#1b1e25');
        const g = isoScreenPoint(b, 0.20 * M, s * 0.52 * M, 0.45 * MH);
        drawIsoDisc(ctx, g, 5, 6.5, '#1b1e25');
      });
      drawIsoBox(ctx, b, 0, 0, 0.30 * M, 0.26 * M, 0.85 * MH, FRAME, 0);
      const top = isoScreenPoint(b, 0, 0, 0.86 * MH);
      ctx.fillStyle = GLOW;
      ctx.fillRect(top.x - 12, top.y - 4, 24, 4);
    },

    // The customer desk: a counter with a higher ledge along the customer's
    // side, a screen behind it and a bell on the ledge.
    frontdesk: (ctx, b) => {
      const L = 1.80, D = 0.62;
      const TOP = '#7d6a55';
      const SIDE = '#5a4a3a';
      const LEDGE = '#8f7c64';
      // How near a part of the piece is to the viewer once the piece has
      // been turned. An asymmetric piece has to draw its parts back to
      // front, and which part is at the back depends on the turn -- drawn
      // in a fixed order, the desk's customer-side ledge ended up in front
      // of the screen that is meant to be behind it.
      const near = (u, v) => {
        const t = turnUV(u, v);
        return t.u + t.v;
      };
      // The counter itself, with the staff's side of the top.
      const counter = () => {
        drawIsoBox(ctx, b, 0, -0.04 * M, L / 2 * M, (D / 2 - 0.04) * M, 0.92 * MH, SIDE, 0);
        drawIsoBox(ctx, b, 0, -0.04 * M, (L / 2 + 0.04) * M, (D / 2) * M, 0.05 * MH, TOP, 0.92 * MH);
      };
      // A monitor standing on the counter, facing whoever is working the
      // desk. Built as boxes rather than stamped on as a flat rectangle, so
      // it stands up from every side instead of lying on the desk like a
      // sticker -- and so its back is what you see from the customer's side,
      // which is how a reception desk looks.
      const screen = () => {
        drawIsoBox(ctx, b, -0.34 * M, -0.10 * M, 0.05 * M, 0.14 * M, 0.10 * MH, '#39404e', 0.97 * MH);
        drawIsoBox(ctx, b, -0.34 * M, -0.10 * M, 0.035 * M, 0.26 * M, 0.34 * MH, '#2b3140', 1.07 * MH);
        drawIsoBox(ctx, b, -0.34 * M, -0.15 * M, 0.02 * M, 0.22 * M, 0.28 * MH, GLOW, 1.10 * MH);
      };
      // The customer's side: a higher ledge with a brass strip along it.
      const ledge = () => {
        drawIsoBox(ctx, b, 0, (D / 2 - 0.06) * M, (L / 2 + 0.04) * M, 0.10 * M, 1.10 * MH, SIDE, 0);
        drawIsoBox(ctx, b, 0, (D / 2 - 0.06) * M, (L / 2 + 0.08) * M, 0.14 * M, 0.05 * MH, LEDGE, 1.10 * MH);
        drawIsoBar(ctx, b, -(L / 2 + 0.08) * M, (D / 2 + 0.08) * M, (L / 2 + 0.08) * M, (D / 2 + 0.08) * M,
          1.15 * MH, 2, '#d9b25a');
      };
      const bell = () => {
        const at = isoScreenPoint(b, 0.52 * M, (D / 2 - 0.06) * M, 1.15 * MH);
        ctx.beginPath();
        ctx.arc(at.x, at.y - 3, 3.2, Math.PI, 0);
        ctx.fillStyle = '#e2c063';
        ctx.fill();
        ctx.fillStyle = '#a8862f';
        ctx.fillRect(at.x - 4, at.y - 3, 8, 1.6);
      };
      // Whichever of the two sides is at the back goes down first. What
      // stands on a side always follows it: the screen on the counter, the
      // bell on the ledge.
      if (near(0, D / 2) > near(0, -0.04)) {
        counter(); screen(); ledge(); bell();
      } else {
        ledge(); bell(); counter(); screen();
      }
    },

    // Juice bar: a serving counter with a raised bar top, a blender on the
    // work side and three bottles along the back.
    juicebar: (ctx, b) => {
      const L = 1.60, D = 0.66;
      const BODY = '#8a4a32';
      const TOP = '#c69a63';
      // The bottles stand on the back edge of the bar top rather than on a
      // gantry behind it. A gantry taller than the counter hides the counter
      // from whichever side it ends up on, and one turn in four that is the
      // side you are looking from.
      const bottles = () => {
        [-0.52, -0.24, 0.04].forEach((u, i) => {
          drawIsoBox(ctx, b, u * M, -(D / 2 - 0.10) * M, 0.055 * M, 0.055 * M, 0.24 * MH,
            ['#d5643c', '#5db56a', '#e8b04b'][i], 1.06 * MH);
          drawIsoBox(ctx, b, u * M, -(D / 2 - 0.10) * M, 0.022 * M, 0.022 * M, 0.05 * MH,
            '#cfc6b4', 1.30 * MH);
        });
      };
      const body = () => {
        drawIsoBox(ctx, b, 0, 0, L / 2 * M, D / 2 * M, 1.00 * MH, BODY, 0);
        drawIsoBox(ctx, b, 0, 0, (L / 2 + 0.05) * M, (D / 2 + 0.05) * M, 0.06 * MH, TOP, 1.00 * MH);
        // A blender on the top, which is what says what this piece is for.
        drawIsoBox(ctx, b, 0.54 * M, -0.04 * M, 0.10 * M, 0.10 * M, 0.07 * MH,
          shade(BODY, -30), 1.06 * MH);
        drawIsoBox(ctx, b, 0.54 * M, -0.04 * M, 0.075 * M, 0.075 * M, 0.26 * MH,
          'rgba(180,225,205,0.55)', 1.13 * MH);
      };
      const front = () => {
        // The customer's rail, and two stools tucked under it.
        drawIsoBar(ctx, b, -(L / 2 + 0.05) * M, (D / 2 + 0.06) * M, (L / 2 + 0.05) * M,
          (D / 2 + 0.06) * M, 1.08 * MH, 2.4, '#d9b25a');
        [-0.42, 0.42].forEach((u) => {
          drawIsoBox(ctx, b, u * M, (D / 2 + 0.34) * M, 0.06 * M, 0.06 * M, 0.60 * MH, '#6f6357', 0);
          drawIsoSlab(ctx, b, u * M, (D / 2 + 0.34) * M, 0.17 * M, 0.17 * M, 0.64 * MH, '#a8563a', 5);
        });
      };
      drawParts([{ u: 0, v: 0, draw: body }, { u: 0, v: -(D / 2 - 0.10), draw: bottles },
        { u: 0, v: D / 2 + 0.20, draw: front }]);
    },

    // Pro shop: a glass display case with folded stock behind it on a rail.
    proshop: (ctx, b) => {
      const L = 1.70, D = 0.74;
      const BODY = '#3f5566';
      const TOP = '#93a6b4';
      // A real rail rather than a panel with shirts painted on it: two posts
      // and a bar, so from the back of the shop you see past it to the case
      // instead of at a solid slab.
      const rail = () => {
        const at = (L / 2 - 0.04);
        [-1, 1].forEach((sgn) => {
          drawIsoBox(ctx, b, sgn * at * M, -(D / 2 + 0.04) * M, 0.045 * M, 0.045 * M,
            1.55 * MH, shade(BODY, -22), 0);
        });
        drawIsoBar(ctx, b, -at * M, -(D / 2 + 0.04) * M, at * M, -(D / 2 + 0.04) * M,
          1.52 * MH, 3, '#8f9aa6');
        [-0.54, -0.18, 0.18, 0.54].forEach((u, i) => {
          drawIsoBox(ctx, b, u * M, -(D / 2 + 0.04) * M, 0.13 * M, 0.045 * M, 0.46 * MH,
            ['#c0483a', '#e8b04b', '#4f9ad1', '#5db56a'][i], 0.96 * MH);
        });
      };
      const cabinet = () => {
        drawIsoBox(ctx, b, 0, 0, L / 2 * M, D / 2 * M, 0.62 * MH, BODY, 0);
        drawIsoBox(ctx, b, 0, 0, (L / 2 - 0.03) * M, (D / 2 - 0.03) * M, 0.34 * MH,
          'rgba(170,215,235,0.34)', 0.62 * MH);
        drawIsoBox(ctx, b, 0, 0, (L / 2 + 0.05) * M, (D / 2 + 0.05) * M, 0.06 * MH, TOP, 0.96 * MH);
        // Folded stock inside the case, seen through the glass.
        [-0.40, 0.10].forEach((u) => {
          drawIsoBox(ctx, b, u * M, 0, 0.16 * M, 0.18 * M, 0.16 * MH, '#d9d2c4', 0.64 * MH);
        });
      };
      const till = () => {
        drawIsoBox(ctx, b, 0.58 * M, 0.08 * M, 0.13 * M, 0.13 * M, 0.14 * MH,
          shade(BODY, -30), 1.02 * MH);
        drawIsoBox(ctx, b, 0.58 * M, 0.04 * M, 0.10 * M, 0.02 * M, 0.16 * MH, GLOW, 1.16 * MH);
      };
      drawParts([{ u: 0, v: -(D / 2 + 0.04), draw: rail }, { u: 0, v: 0, draw: cabinet },
        { u: 0.58, v: 0.08, draw: till }]);
    },

    // Manager's desk: a counter with a return along one end.
    desk: (ctx, b) => {
      const L = 1.75;
      drawIsoBox(ctx, b, 0, 0, L / 2 * M, 0.32 * M, 1.02 * MH, '#6b5a48', 0);
      drawIsoBox(ctx, b, 0, 0, (L / 2 + 0.05) * M, 0.38 * M, 0.07 * MH, '#8d7860', 1.02 * MH);
      // The return along one end, and a monitor built as boxes rather than
      // stamped on flat so it stands up whichever way the desk is turned.
      const returnEnd = () => drawIsoBox(ctx, b, -(L / 2 - 0.30) * M, 0.52 * M,
        0.30 * M, 0.22 * M, 0.74 * MH, '#6b5a48', 0);
      const monitor = () => {
        drawIsoBox(ctx, b, 0.30 * M, 0.06 * M, 0.05 * M, 0.14 * M, 0.09 * MH, '#39404e', 1.09 * MH);
        drawIsoBox(ctx, b, 0.30 * M, 0.06 * M, 0.035 * M, 0.26 * M, 0.34 * MH, '#2b3140', 1.18 * MH);
        drawIsoBox(ctx, b, 0.30 * M, 0.01 * M, 0.02 * M, 0.22 * M, 0.28 * MH, GLOW, 1.21 * MH);
      };
      drawParts([{ u: -(L / 2 - 0.30), v: 0.52, draw: returnEnd },
        { u: 0.30, v: 0.06, draw: monitor }]);
    },

    // Partitions with a desk inside them.
    cubicle: (ctx, b) => {
      const W = 1.65, D = 1.40;
      // Both partitions stand on the same two sides of the desk, so on one
      // turn in four they both end up between the desk and the camera and
      // the whole thing reads as a plain blue box. A partition facing the
      // viewer is cut down to a rail, the way the room's own near walls are,
      // so you can always see the desk it is meant to enclose.
      const panelH = (near) => (near ? 0.42 : 1.28) * MH;
      const wallU = () => drawIsoBox(ctx, b, -(W / 2) * M, 0, 0.06 * M, D / 2 * M,
        panelH(faceShows(-1, 0)), '#5a6472', 0);
      const wallV = () => drawIsoBox(ctx, b, 0, -(D / 2) * M, W / 2 * M, 0.06 * M,
        panelH(faceShows(0, -1)), '#4e5765', 0);
      const workstation = () => {
        drawIsoBox(ctx, b, 0.10 * M, 0.10 * M, 0.52 * M, 0.28 * M, 0.72 * MH, '#6b5a48', 0);
        drawIsoBox(ctx, b, 0.10 * M, 0.06 * M, 0.05 * M, 0.13 * M, 0.08 * MH, '#39404e', 0.79 * MH);
        drawIsoBox(ctx, b, 0.10 * M, 0.06 * M, 0.03 * M, 0.24 * M, 0.30 * MH, '#2b3140', 0.87 * MH);
        drawIsoBox(ctx, b, 0.10 * M, 0.01 * M, 0.02 * M, 0.20 * M, 0.25 * MH, GLOW, 0.90 * MH);
      };
      drawParts([{ u: -(W / 2), v: 0, draw: wallU }, { u: 0, v: -(D / 2), draw: wallV },
        { u: 0.10, v: 0.10, draw: workstation }]);
    },

    // A glazed pod: solid to waist height, glass above.
    officepod: (ctx, b) => {
      const W = 1.50, D = 1.25, H = 1.78;
      drawIsoBox(ctx, b, 0, 0, W / 2 * M, D / 2 * M, 0.70 * MH, '#4e5765', 0);
      drawIsoBox(ctx, b, 0, 0, W / 2 * M, D / 2 * M, 1.00 * MH, 'rgba(150,205,230,0.35)', 0.70 * MH);
      drawIsoBox(ctx, b, 0, 0, (W / 2 + 0.05) * M, (D / 2 + 0.05) * M, 0.09 * MH, '#3d4658', H * MH);
      [-1, 1].forEach((s) => {
        drawIsoBox(ctx, b, s * (W / 2) * M, (D / 2) * M, 0.05 * M, 0.05 * M, H * MH, '#3d4658', 0);
      });
    },

    // A pot with a trunk and a spray of fronds.
    palm: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.21 * M, 0.21 * M, 0.36 * MH, '#7a4b32', 0);
      drawIsoBox(ctx, b, 0, 0, 0.23 * M, 0.23 * M, 0.05 * MH, '#5f3a26', 0.36 * MH);
      // A trunk that leans a little, because a straight one reads as a pole.
      drawIsoBar(ctx, b, 0, 0, 0.10 * M, 0.06 * M, 0.40 * MH, 7, '#8a6a44');
      drawIsoBox(ctx, b, 0.05 * M, 0.03 * M, 0.045 * M, 0.045 * M, 0.72 * MH, '#8a6a44', 0.40 * MH);
      const top = isoScreenPoint(b, 0.10 * M, 0.06 * M, 1.12 * MH);
      ctx.save();
      ctx.strokeStyle = '#4d7a45';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.quadraticCurveTo(top.x + Math.cos(a) * 13, top.y + Math.sin(a) * 6.5 - 7,
          top.x + Math.cos(a) * 24, top.y + Math.sin(a) * 12);
        ctx.stroke();
      }
      ctx.restore();
    },

    // A cooler with the bottle upended on top of it.
    cooler: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.18 * M, 0.18 * M, 0.92 * MH, '#e6ebf1', 0);
      drawIsoBox(ctx, b, 0, 0, 0.20 * M, 0.20 * M, 0.07 * MH, '#9aa5b3', 0.92 * MH);
      drawIsoBox(ctx, b, 0, 0, 0.13 * M, 0.13 * M, 0.40 * MH,
        'rgba(96,196,232,0.9)', 0.99 * MH);
      // The taps, on the front of the cooler -- and only when the front is
      // the side you are looking at.
      if (faceShows(1, 0)) {
        const t = isoScreenPoint(b, 0.18 * M, 0, 0.62 * MH);
        ctx.fillStyle = '#5a6472';
        ctx.fillRect(t.x - 5, t.y - 6, 10, 7);
        const p = isoScreenPoint(b, 0.18 * M, 0, 0.40 * MH);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(p.x - 7, p.y - 5, 14, 5);
      }
    },

    // A mirror on a frame, standing against whatever wall it is put by.
    mirrorwall: (ctx, b) => {
      const W = 1.60;
      drawIsoBox(ctx, b, 0, 0, 0.16 * M, (W / 2 + 0.04) * M, 0.08 * MH, '#2f3644', 0);
      drawIsoBox(ctx, b, 0, 0, 0.06 * M, W / 2 * M, 1.55 * MH, '#3d4658', 0.08 * MH);
      const a = isoScreenPoint(b, 0.06 * M, -(W / 2 - 0.06) * M, 0.18 * MH);
      const c = isoScreenPoint(b, 0.06 * M, (W / 2 - 0.06) * M, 0.18 * MH);
      const h = 1.36 * MH;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
      ctx.lineTo(c.x, c.y - h); ctx.lineTo(a.x, a.y - h);
      ctx.closePath();
      const g = ctx.createLinearGradient(a.x, a.y - h, c.x, c.y);
      g.addColorStop(0, 'rgba(200,226,240,0.85)');
      g.addColorStop(1, 'rgba(140,175,200,0.7)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    },

    // A sign on two legs, lit.
    neon: (ctx, b) => {
      const W = 1.45;
      [-1, 1].forEach((s) => {
        drawIsoBox(ctx, b, 0, s * (W / 2 - 0.08) * M, 0.05 * M, 0.05 * M, 0.95 * MH, FRAME_DK, 0);
      });
      drawIsoBox(ctx, b, 0, 0, 0.05 * M, W / 2 * M, 0.60 * MH, '#241b2e', 0.95 * MH);
      const a = isoScreenPoint(b, 0.05 * M, -(W / 2 - 0.10) * M, 1.05 * MH);
      const c = isoScreenPoint(b, 0.05 * M, (W / 2 - 0.10) * M, 1.05 * MH);
      ctx.save();
      ctx.strokeStyle = '#ff5fa8';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff5fa8';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 0.14 * MH);
      ctx.lineTo(c.x, c.y - 0.14 * MH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 0.34 * MH);
      ctx.lineTo(c.x - (c.x - a.x) * 0.35, c.y - 0.34 * MH);
      ctx.strokeStyle = '#5fd0e6';
      ctx.shadowColor = '#5fd0e6';
      ctx.stroke();
      ctx.restore();
    },
  };

  // Thin trim band along the bottom of a wall, where it meets the floor,
  // so the walls don't just end abruptly -- p0/p1 are the wall's two
  // floor-level corners (in screen space).
  // Skirting. Kept shallow and faint on purpose: a deep dark band along the
  // bottom of a wall reads as a step down onto the floor rather than as the
  // wall meeting it, and the two are meant to meet on one line.
  function drawBaseboard(p0, p1) {
    const trimH = 5;
    floorCtx.beginPath();
    floorCtx.moveTo(p0.x, p0.y);
    floorCtx.lineTo(p1.x, p1.y);
    floorCtx.lineTo(p1.x, p1.y - trimH);
    floorCtx.lineTo(p0.x, p0.y - trimH);
    floorCtx.closePath();
    floorCtx.fillStyle = 'rgba(0,0,0,0.16)';
    floorCtx.fill();
    floorCtx.beginPath();
    floorCtx.moveTo(p0.x, p0.y - trimH);
    floorCtx.lineTo(p1.x, p1.y - trimH);
    floorCtx.strokeStyle = 'rgba(255,255,255,0.05)';
    floorCtx.lineWidth = 1;
    floorCtx.stroke();
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

  function drawGroundLattice(colors, view) {
    const step = 6;   // lattice tiles between lines
    const halfW = ROOM.tileW / 2;
    const halfH = ROOM.tileH / 2;
    // Far enough out to cross whatever is being looked at, corner to
    // corner, however far the view reaches past the plan itself.
    const wide = view ? Math.max(Math.abs(view.x0 - worldOrigin.x), Math.abs(view.x1 - worldOrigin.x)) * 2 : BASE_W;
    const tall = view ? Math.max(Math.abs(view.y0 - worldOrigin.y), Math.abs(view.y1 - worldOrigin.y)) * 2 : BASE_H;
    const reach = Math.ceil((wide / halfW + tall / halfH) / 2) + step * 2;
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

  // The ground has a canvas of its own, behind the scrolling plan and the
  // size of the stage window rather than the size of the plan. The plan
  // canvas is only as big as the rooms need, so zoomed out it sat in the
  // middle of the window with flat colour all round it -- the site has to
  // reach the edges of what you are looking through, at every zoom.
  //
  // It is drawn in the window's own coordinates, with the plan's transform
  // applied, so the lattice lines up with the floors exactly and travels
  // with them as you pan. Nothing here changes between frames, so it is
  // repainted only when the view does: a pan, a zoom, a new plan, a change
  // of theme or of the hour.
  const groundCanvas = document.getElementById('tycoon-ground');
  const groundCtx = groundCanvas ? groundCanvas.getContext('2d') : null;
  let groundKey = '';
  function paintStageGround(force) {
    if (!groundCtx || !stageScrollEl) return;
    const w = Math.round(stageScrollEl.clientWidth);
    const h = Math.round(stageScrollEl.clientHeight);
    if (!w || !h) return;
    const sr = stageScrollEl.getBoundingClientRect();
    const cr = floorCanvas.getBoundingClientRect();
    const wr = groundCanvas.parentNode.getBoundingClientRect();
    if (!sr.width || !cr.width) return;
    // Laid exactly over the stage's inside edge, whatever the stage's own
    // width and centring work out to.
    const border = (sr.width - w) / 2;
    groundCanvas.style.left = (sr.left - wr.left + border) + 'px';
    groundCanvas.style.top = (sr.top - wr.top + border) + 'px';
    // Where the plan canvas's own (0,0) sits inside the window, in window
    // pixels -- which folds in the scroll position and the centring the
    // stage does when the plan is smaller than the window.
    const ox = Math.round((cr.left - sr.left) * 100) / 100;
    const oy = Math.round((cr.top - sr.top) * 100) / 100;
    const z = cr.width / (parseFloat(floorCanvas.style.width) || BASE_W);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = [state.activeTheme, w, h, ox, oy, z.toFixed(4), dpr,
      Math.round(skyWash().a * 1000)].join('|');
    if (!force && key === groundKey) return;
    groundKey = key;

    const bw = Math.max(1, Math.round(w * dpr));
    const bh = Math.max(1, Math.round(h * dpr));
    if (groundCanvas.width !== bw || groundCanvas.height !== bh) {
      groundCanvas.width = bw;
      groundCanvas.height = bh;
    }
    groundCanvas.style.width = w + 'px';
    groundCanvas.style.height = h + 'px';

    const colors = THEME_COLORS[state.activeTheme] || THEME_COLORS.garage;
    groundCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundCtx.fillStyle = colors.bg;
    groundCtx.fillRect(0, 0, w, h);

    // Everything below is drawn in the plan's coordinates, so the same
    // isoPoint the rooms are built from puts the lattice in the right
    // place. The visible part of the plan's world is the window, mapped
    // back through the transform.
    const live = floorCtx;
    floorCtx = groundCtx;
    groundCtx.save();
    groundCtx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
    const view = { x0: -ox / z, y0: -oy / z, x1: (w - ox) / z, y1: (h - oy) / z };
    try {
      drawGroundLattice(colors, view);
      drawSiteWash(AMBIENT_WASH[state.activeTheme] || AMBIENT_WASH.garage);
    } finally {
      groundCtx.restore();
      floorCtx = live;
    }

    // The hour of the day and the vignette, over the ground and in the
    // window's own space -- a vignette tied to the plan canvas would draw a
    // rectangle of shadow in the middle of the site.
    const sky = skyWash();
    if (sky.a > 0.002) {
      groundCtx.fillStyle = 'rgba(' + sky.r + ',' + sky.g + ',' + sky.b + ',' + sky.a.toFixed(3) + ')';
      groundCtx.fillRect(0, 0, w, h);
    }
    const vig = groundCtx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3,
      w / 2, h * 0.45, Math.hypot(w, h) * 0.62);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.45)');
    groundCtx.fillStyle = vig;
    groundCtx.fillRect(0, 0, w, h);
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
  // Deliberately escalating: the starter bay is a bare room, and each one
  // bought after it arrives better appointed than the last, so the plan
  // visibly improves as it grows rather than repeating one room. Every room
  // is properly lit, though -- a rail of downlights along both back walls
  // -- because a single bulb on a cord made the first room look like a
  // cellar you had not moved into yet.
  const ROOM_FITS = [
    { lighting: 'strip', decor: [] },
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
    drawLightRails([[north, east], [north, west]], light);
  }
  function drawLightRails(walls, light) {
    const bulbColor = light.bulb || '#eaf7ff';
    walls.forEach(([from, to]) => {
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
      const lamps = Math.max(run < 150 ? 2 : 3, Math.min(5, Math.round(run / 95)));
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

        // And a pool on the floor at the foot of the wall under it.
        const foot = wallPoint(from, to, t, 0);
        const pool = floorCtx.createRadialGradient(foot.x, foot.y, 2, foot.x, foot.y, ROOM.tileW * 1.15);
        pool.addColorStop(0, scaleAlpha(light.glow, lampBoost() * 0.9));
        pool.addColorStop(1, 'rgba(0,0,0,0)');
        floorCtx.save();
        floorCtx.globalCompositeOperation = 'lighter';
        floorCtx.fillStyle = pool;
        floorCtx.beginPath();
        floorCtx.ellipse(foot.x, foot.y, ROOM.tileW * 1.15, ROOM.tileH * 1.15, 0, 0, Math.PI * 2);
        floorCtx.fill();
        floorCtx.restore();
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
    const len = backWallLengths(r);
    corridors.forEach((c) => {
      if (c.doorRoom !== r) return;
      if (c.axis === 'gy') {
        ne.push([(c.gx0 - r.gx0) / len.ne - pad, (c.gx0 + c.cols - r.gx0) / len.ne + pad]);
      } else {
        nw.push([(c.gy0 - r.gy0) / len.nw - pad, (c.gy0 + c.rows - r.gy0) / len.nw + pad]);
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
    } else if (theme === 'boardwalk') {
      // Bunting: a slack line between two corners with flags hung off it,
      // which is the one thing that says seaside and nothing else does.
      const flags = ['#e4573f', '#e8c46a', '#3fa8a0', '#eef1f6'];
      [{ from: north, to: east }, { from: north, to: west }].forEach(({ from, to }, side) => {
        const sag = (t) => 0.90 - 0.055 * Math.sin(Math.PI * t);
        const line = [];
        for (let i = 0; i <= 12; i++) line.push(wallPoint(from, to, i / 12, sag(i / 12)));
        strokePolyline(line, 'rgba(255,255,255,0.35)', 1.4);
        for (let i = 1; i < 12; i++) {
          const t = i / 12;
          const hang = wallPoint(from, to, t, sag(t));
          const tipL = wallPoint(from, to, t - 0.022, sag(t));
          const tipR = wallPoint(from, to, t + 0.022, sag(t));
          const point = wallPoint(from, to, t, sag(t) - 0.055);
          paintQuad([tipL, tipR, point], flags[(i + side) % flags.length], null);
        }
      });
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
    return placements.some((r) => onFloorOf(r, gx, gy)) || corridors.some((r) => inRect(r, gx, gy));
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
    const h = SLAB_DEPTH;
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

    // Every line the floor can drop away along: the two front edges of the
    // box, and for a room with a corner cut out, the two inner edges of the
    // notch. A lip goes where there is floor on the near side of the line
    // and none on the far side.
    const cut = cutRect(rect);
    const gxLines = [rect.gx0 + rect.cols];
    const gyLines = [rect.gy0 + rect.rows];
    if (cut) {
      if (cut.gx0 > rect.gx0) gxLines.push(cut.gx0);
      if (cut.gy0 > rect.gy0) gyLines.push(cut.gy0);
    }
    gxLines.forEach((gx) => runEdge(rect.gy0, rect.gy0 + rect.rows,
      (gy) => onFloorOf(rect, gx - 1, gy) && !tileIsFloor(gx, gy), (gy) => isoPoint(gx, gy), right));
    gyLines.forEach((gy) => runEdge(rect.gx0, rect.gx0 + rect.cols,
      (gx) => onFloorOf(rect, gx, gy - 1) && !tileIsFloor(gx, gy), (gx) => isoPoint(gx, gy), left));

    // The walls stand on this slab and are thick, so they reach a little
    // past the room's own edge. The lip runs out to meet them at the two
    // corners where a wall ends on a front edge -- without it the wall
    // overhangs the corner with nothing beneath it, and the outline of the
    // building takes a step there.
    const t = WALL_THICK;
    const eastLine = rect.gx0 + rect.cols;
    if (onFloorOf(rect, eastLine - 1, rect.gy0) && !tileIsFloor(eastLine, rect.gy0)) {
      drop(isoPoint(eastLine, rect.gy0 - t), isoPoint(eastLine, rect.gy0), right);
    }
    const southLine = rect.gy0 + rect.rows;
    if (onFloorOf(rect, rect.gx0, southLine - 1) && !tileIsFloor(rect.gx0, southLine)) {
      drop(isoPoint(rect.gx0 - t, southLine), isoPoint(rect.gx0, southLine), left);
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
  // A wall is a solid with thickness, and that thickness sits over the edge
  // of the floor slab it stands on. At the end of a run you were looking
  // straight at the underside of the overhang, with the site showing
  // through the gap between it and the slab's own edge -- so the cut end of
  // a wall is carried down the depth of the slab and meets it.
  const SLAB_DEPTH = 15;
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
  // A doorway is 2.1 m to the top of its casing and the lintel is 10 px
  // deep, so the opening itself clears the tallest member (1.85 m) with
  // room to spare: nobody's head passes through the lintel any more.
  const DOOR_H = Math.round(2.1 * PX_PER_METRE_TALL);
  const DOOR_HEAD = DOOR_H - 10;
  const DOOR_JAMB = 0.12;
  const DOOR_FROM = 0.18 + DOOR_JAMB * (0.82 - 0.18);
  const DOOR_TO = 0.82 - DOOR_JAMB * (0.82 - 0.18);

  // Where this room's walls have holes in them, as fractions along each wall
  // in the direction that wall is measured: north->east for the one running
  // along +gx, north->west for the one running along +gy.
  // How long each back wall actually is, in tiles: a corner cut out of the
  // back-right shortens the north wall, one out of the front-left shortens
  // the west wall. Fractions along a wall are measured against these.
  function backWallLengths(r) {
    return { ne: r.cols, nw: r.rows };
  }
  function wallApertures(roomIndex) {
    const r = placements[roomIndex];
    const ne = [];
    const nw = [];
    if (!r) return { ne, nw };
    const len = backWallLengths(r);
    corridors.forEach((c) => {
      if (c.doorRoom !== r) return;
      if (c.axis === 'gy') {
        const lo = (c.gx0 - r.gx0) / len.ne;
        const span = c.cols / len.ne;
        ne.push([lo + span * DOOR_FROM, lo + span * DOOR_TO]);
      } else {
        const lo = (c.gy0 - r.gy0) / len.nw;
        const span = c.rows / len.nw;
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
    // Carried down the depth of the floor slab, so the end of the wall
    // lands on the slab's edge rather than hanging over it.
    const drop = (p) => ({ x: p.x, y: p.y + SLAB_DEPTH });
    const endIndex = [0, n];
    endIndex.forEach((i, which) => {
      if (ends[which] !== 'cap') return;
      const d = dep[i === 0 ? 0 : n - 1];
      paintQuad([drop(pts[i]), drop(shift(pts[i], d)), outer[i], lift(pts[i])],
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
      strokePolyline([lift(pts[i]), drop(pts[i]), drop(shift(pts[i], d)), outer[i]],
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

  // A hallway was paving and two walls: the gap between two rooms rather
  // than a part of the building. What a corridor in a real gym has is a
  // lane painted down it, somewhere to sit, and a fountain to stop at --
  // so these get one of each.
  //
  // Nothing here is random. Everything is placed off the hallway's own
  // position on the lattice, so a corridor is the same corridor on every
  // repaint and between one session and the next.
  function drawHallwayFittings(c, colors) {
    const along = c.axis === 'gx' ? c.cols : c.rows;
    const across = c.axis === 'gx' ? c.rows : c.cols;
    // The garage's link between bays is two metres square -- a doorway with
    // a floor, not a corridor. Furniture in it would sit half inside the
    // wall of the room it opens into, so a hallway only gets furnished if
    // there is somewhere in it to put anything. The paint goes down either
    // way; that is what makes the short one read as a way through.
    const roomy = along >= 8 && across >= 5;

    // Two lanes of tape down the middle. `u` runs along the hallway and `v`
    // across it, whichever way round the axis has them.
    const at = (u, v) => (c.axis === 'gx'
      ? isoPoint(c.gx0 + u, c.gy0 + v) : isoPoint(c.gx0 + v, c.gy0 + u));
    const stripe = (v, width, color) => {
      paintQuad([at(0.4, v), at(along - 0.4, v),
        at(along - 0.4, v + width), at(0.4, v + width)], color, null, 0);
    };
    // Paint, not light: a pale wash of the floor's own colour, so it reads
    // as something rolled onto the slabs rather than shone at them.
    const tint = toRgb(shade(colors.floorA, 62));
    const paint = 'rgba(' + tint.r + ',' + tint.g + ',' + tint.b + ',0.5)';
    stripe(across * 0.40, 0.30, paint);
    stripe(across * 0.68, 0.30, paint);

    if (!roomy) return;

    // Both against the back wall, which is the v = 0 edge on either axis --
    // clear of the lane the crowd walks down the middle.
    const benchLen = Math.min(4.6, along * 0.5);
    // Kept away from the far end. A hallway runs into the next room's side
    // wall, and that wall is drawn after the hallway and in front of it, so
    // anything sitting too close to it is hidden behind it.
    const benchAt = along * 0.30;
    const fountainAt = along * 0.64;
    const wood = shade(colors.floorA, 24);
    const steel = '#9aa4b0';
    // drawIsoBox takes half-extents along the two lattice axes, so which of
    // them is the length depends on which way the hallway runs.
    const box = (u, v, halfAlong, halfAcross, h, color, lift) => {
      const base = at(u, v);
      if (c.axis === 'gx') drawIsoBox(floorCtx, base, 0, 0, halfAlong, halfAcross, h, color, lift);
      else drawIsoBox(floorCtx, base, 0, 0, halfAcross, halfAlong, h, color, lift);
    };
    // Bench: a plinth at each end, a seat across them and a back against
    // the wall. The back is what makes it read as a bench rather than as a
    // slab floating in front of a dark wall.
    const seatH = 0.45 * PX_PER_METRE_TALL;
    const legH = seatH * 0.76;
    const SEAT_V = 2.0;
    const BACK_V = 1.3;
    box(benchAt - benchLen / 2 + 0.55, SEAT_V, 0.30, 0.44, legH, shade(steel, -46));
    box(benchAt + benchLen / 2 - 0.55, SEAT_V, 0.30, 0.44, legH, shade(steel, -46));
    box(benchAt, SEAT_V, benchLen / 2, 0.52, seatH * 0.24, wood, legH);
    box(benchAt, BACK_V, benchLen / 2, 0.11, 0.34 * PX_PER_METRE_TALL, wood, legH);

    // Fountain: a post with a basin on it, against the same wall.
    const postH = 0.80 * PX_PER_METRE_TALL;
    box(fountainAt, 1.5, 0.38, 0.38, postH, shade(steel, -30));
    box(fountainAt, 1.5, 0.58, 0.58, postH * 0.14, steel, postH);
  }

  function drawCorridorShell(c, colors) {
    drawPaving(c, colors, -3);
    drawSlabEdges(c, colors);
    // The step across the mouth this hallway leaves its first room by: a
    // piece of floor, so it goes down with the floor and whoever walks over
    // it is drawn on top.
    const nearEnd = corridorEnd(c, false);
    drawThreshold(nearEnd[0], nearEnd[1], colors);

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

    drawHallwayFittings(c, colors);

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
    const h = DOOR_H;
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
        if (!onFloorOf(rect, gx, gy)) continue;
        paintQuad([
          isoPoint(gx, gy), isoPoint(gx + 1, gy),
          isoPoint(gx + 1, gy + 1), isoPoint(gx, gy + 1),
        ], faint, 'rgba(255,255,255,0.05)', 1);
      }
    }
    const corners = floorPolygon(rect).map(([gx, gy]) => isoPoint(gx, gy));
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
  // a door in, so it gets a threshold, drawn with the hallway's floor -- and
  // arrives at the far room through a real back wall, which is where the
  // casing belongs, drawn with that room's walls.

  let groundTimer = null;
  function queueGroundPaint() {
    clearTimeout(groundTimer);
    groundTimer = setTimeout(() => paintStageGround(), 0);
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
    // Money tags are collected as the rooms are drawn and laid out once the
    // whole plan is down, so this frame starts with none.
    pileTags = [];

    // The canvas no longer paints its own full-bleed rectangle: the stage
    // window carries the ground colour, the canvas fades to transparent at
    // its edges, and the two meet with no seam to see.
    // The site the plan stands on is a layer of its own now, behind this
    // canvas and the size of the window (see paintStageGround).

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

    // The money tags, over everything in the plan: a tag is a label on the
    // scene rather than a thing standing in it, and one hidden behind a
    // machine would be money you could not see or reach. Not while a piece
    // is in your hands, so a tap meant for the floor cannot collect
    // something by accident.
    pileTagRects = [];
    if (!editing) layOutPileTags();

    // The hour of the day, over the gym only: 'source-atop' keeps it off
    // the empty parts of this canvas, which are a window onto the ground
    // layer behind and have already been tinted there.
    const sky = skyWash();
    if (sky.a > 0.002) {
      floorCtx.save();
      floorCtx.globalCompositeOperation = 'source-atop';
      floorCtx.fillStyle = 'rgba(' + sky.r + ',' + sky.g + ',' + sky.b + ',' + sky.a.toFixed(3) + ')';
      floorCtx.fillRect(0, 0, W, H);
      floorCtx.restore();
    }
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
    const gx1 = place.gx0 + place.cols;
    const gy1 = place.gy0 + place.rows;
    const cut = place.cut;
    // Both back walls run corner to corner: a cut only ever takes the near
    // corner, which neither wall reaches.
    const eastCorner = { gx: gx1, gy: place.gy0 };
    const westCorner = { gx: place.gx0, gy: gy1 };
    const east = isoPoint(eastCorner.gx, eastCorner.gy);
    const west = isoPoint(westCorner.gx, westCorner.gy);

    // Both back walls are one solid that turns the north corner, not two
    // that meet there, and each end either caps off at the room's open corner
    // or carries straight on into the hallway that leaves from it.
    // The run goes east -> north -> west, so the north wall is walked
    // backwards relative to the direction its doorways are measured in.
    const holes = wallApertures(roomIndex);
    drawWallRun([east, north, west], ['gx', 'gy'], ROOM.wallH, colors, [
      roomWallEnd(place, eastCorner),
      roomWallEnd(place, westCorner),
    ], [holes.ne.map(([t0, t1]) => [1 - t1, 1 - t0]), holes.nw]);

    drawBaseboard(east, north);
    drawBaseboard(north, west);
    const doors = wallDoorSpans(roomIndex);
    drawWallDecor(theme, north, east, west, doors);
    drawRoomFittings(roomFitFor(roomIndex), north, east, west, doors);
    // The casing of every doorway cut in these walls goes on now, so it
    // stands in the wall: over the hallway showing through the hole and
    // over anything strung along the wall, and under whatever stands in
    // the room in front of it. Painted after everything, as it used to be,
    // it sat on top of the gear and the people beside the door.
    corridors.forEach((c) => {
      if (c.doorRoom !== place) return;
      const far = corridorEnd(c, true);
      drawCorridorDoor(far[0], far[1], colors);
    });

    // The floor is the L, not the box: paved inside its outline only.
    floorCtx.save();
    if (cut) {
      const poly = floorPolygon(place).map(([gx, gy]) => isoPoint(gx, gy));
      floorCtx.beginPath();
      floorCtx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) floorCtx.lineTo(poly[i].x, poly[i].y);
      floorCtx.closePath();
      floorCtx.clip();
    }
    drawPaving(place, colors, 0);
    floorCtx.restore();

    drawSlabEdges(place, colors);

    // The light comes from the rail of downlights along the back walls and
    // the pools they throw on the floor beneath them -- there is no longer
    // a fixture in the middle of the room, so nothing pools there either.
    // Drawn before the props loop below, not after, so the rail sits behind
    // tall gear like real ceiling hardware instead of floating on top.
    drawCeilingStrip(north, east, west, light);

    // Gear stands wherever it was put, not in a grid cell, so the draw
    // order comes from the pieces themselves -- furthest back first, or a
    // piece behind another would paint over it.
    const room = activeRooms()[roomIndex];
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
      drawProp(itemId, c, tierOf(itemId), turnAt(room, index));
      if (makesStock(itemId)) drawBatchBar(room, index, c);
      const pile = pileOf(room, shape, index);
      if (pile.level > 0) queuePileTag(roomIndex, index, itemId, turnAt(room, index), c, pile);
    });

    if (editing && editing.roomIndex === roomIndex) {
      drawHeldPiece(place, editing);
    }
  }

  // What a counter has on, on the floor at its foot: one lane per queue
  // slot, filling as the batch runs and going solid when it is done. It sits
  // on the floor rather than in a bubble over the piece because there is
  // already a bubble over every machine for the money, and two of them on
  // one piece is the clutter the bubbles were introduced to get rid of.
  function drawBatchBar(room, index, c) {
    const q = queueAt(room, index);
    if (!q.length) return;
    const now = Date.now();
    // Sized off the tile rather than in flat pixels, so it stays the same
    // fraction of the piece however far the plan is zoomed out.
    const w = ROOM.tileW * 1.35;
    const h = Math.max(4.5, ROOM.tileH * 0.34);
    const gap = h * 0.55;
    const lane = (w - gap * (QUEUE_SLOTS - 1)) / QUEUE_SLOTS;
    const y = c.y + ROOM.tileH * 0.86;
    for (let i = 0; i < QUEUE_SLOTS; i++) {
      const x = c.x - w / 2 + i * (lane + gap);
      roundRectPath(floorCtx, x - 1, y - 1, lane + 2, h + 2, (h + 2) / 2);
      floorCtx.fillStyle = 'rgba(0,0,0,0.55)';
      floorCtx.fill();
      roundRectPath(floorCtx, x, y, lane, h, h / 2);
      floorCtx.fillStyle = 'rgba(255,255,255,0.10)';
      floorCtx.fill();
      const b = q[i];
      if (!b || !PRODUCTS[b.p]) continue;
      const product = PRODUCTS[b.p];
      const left = (b.at - now) / 1000;
      const frac = left <= 0 ? 1 : 1 - Math.min(1, left / product.seconds);
      if (frac <= 0) continue;
      roundRectPath(floorCtx, x, y, Math.max(h, lane * frac), h, h / 2);
      floorCtx.fillStyle = left <= 0 ? '#ffb703' : product.color;
      floorCtx.fill();
    }
  }

  // Tags are collected during the scene pass and drawn after all of it, so
  // a tag can never be hidden by a wall, a machine or somebody walking past
  // -- which is the whole reason the amount does not live on the floor with
  // the notes. `pileTags` is what was asked for this frame; `pileTagRects`
  // is where they ended up, which is also what a tap is tested against.
  let pileTags = [];
  let pileTagRects = [];
  function queuePileTag(roomIndex, index, itemId, turn, base, pile) {
    // A coin bubble over the machine, the way an idle game asks to be
    // tapped: above the piece's own artwork so it is never mistaken for
    // part of it, but no higher than a hand's reach above the floor it
    // stands on, so a tall machine does not send its bubble to the ceiling.
    // It is the only place money appears. Notes stacked on the floor as
    // well made a busy room impossible to read, and they were the half that
    // could end up hidden behind something.
    const e = propCache.get(itemId + ':' + turn);
    const top = e ? base.y - e.oy - 8 : base.y - 40;
    pileTags.push({
      roomIndex, index, pile,
      x: base.x,
      y: Math.max(top, base.y - 78),
      depth: base.y,
    });
  }
  const TAG_H = 18;
  function layOutPileTags() {
    // Nearest the front first, so a tag that has to move gets out of the way
    // of the one in front of it rather than the other way round.
    pileTags.sort((a, b) => b.depth - a.depth);
    const placed = [];
    pileTagRects = [];
    floorCtx.font = 'bold 10px system-ui, sans-serif';
    pileTags.forEach((t) => {
      const label = '$' + formatMoney(t.pile.amount);
      // Room for the coin as well as the figure.
      const w = Math.max(40, floorCtx.measureText(label).width + 26);
      const r = { x: t.x - w / 2, y: t.y - TAG_H, w, h: TAG_H };
      // Up and out of the way of any tag already placed, so two pieces
      // standing close together do not stack their tags on one another.
      for (let guard = 0; guard < 40; guard++) {
        const hit = placed.find((o) => r.x < o.x + o.w + 2 && o.x < r.x + r.w + 2
          && r.y < o.y + o.h + 2 && o.y < r.y + r.h + 2);
        if (!hit) break;
        r.y = hit.y - r.h - 3;
      }
      placed.push(r);
      pileTagRects.push({ rect: r, roomIndex: t.roomIndex, index: t.index });
      drawPileTag(r, label, t);
    });
  }
  function drawPileTag(r, label, t) {
    const ctx = floorCtx;
    const full = t.pile.level >= 4;
    // A thread when the bubble has had to move up out of the way of another
    // one, so it still points at its own machine.
    if (r.y + r.h < t.y - 4) {
      ctx.beginPath();
      ctx.moveTo(t.x, r.y + r.h);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = full ? 'rgba(255,183,3,0.45)' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // The bubble, with a little tail pointing down at the machine.
    ctx.beginPath();
    ctx.moveTo(t.x - 4, r.y + r.h - 0.5);
    ctx.lineTo(t.x + 4, r.y + r.h - 0.5);
    ctx.lineTo(t.x, r.y + r.h + 4.5);
    ctx.closePath();
    ctx.fillStyle = full ? 'rgba(255,183,3,0.96)' : 'rgba(18,20,26,0.9)';
    ctx.fill();

    roundRectPath(ctx, r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fillStyle = full ? 'rgba(255,183,3,0.96)' : 'rgba(18,20,26,0.9)';
    ctx.fill();
    ctx.strokeStyle = full ? 'rgba(120,80,0,0.9)' : 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // A coin at the near end: the thing you are being asked to collect.
    const cx = r.x + r.h / 2 + 1;
    const cy = r.y + r.h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 5.4, 0, Math.PI * 2);
    ctx.fillStyle = full ? '#8a5a00' : '#e8c46a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 5.4, 0, Math.PI * 2);
    ctx.strokeStyle = full ? 'rgba(60,38,0,0.8)' : 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = full ? '#f6d98f' : '#7a5a12';
    ctx.fillText('$', cx, cy + 0.5);

    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillStyle = full ? '#1a1200' : '#eafbef';
    ctx.fillText(label, cx + 6 + (r.w - r.h - 6) / 2, cy + 0.5);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // The tag under a point, if any -- tested last-drawn first, so the one on
  // top is the one you get.
  function pileTagAtPoint(px, py) {
    for (let i = pileTagRects.length - 1; i >= 0; i--) {
      const r = pileTagRects[i].rect;
      if (px >= r.x - 3 && px <= r.x + r.w + 3 && py >= r.y - 3 && py <= r.y + r.h + 3) {
        return { roomIndex: pileTagRects[i].roomIndex, index: pileTagRects[i].index };
      }
    }
    return null;
  }

  // The piece in your hands: a marked footprint on the floor so you can see
  // exactly where it will stand, and the piece itself above it, lifted a
  // little and lightened so it reads as held rather than placed.
  function drawHeldPiece(place, held) {
    const c = isoPoint(place.gx0 + held.spot.u, place.gy0 + held.spot.v);
    // The outline is the piece's actual footprint on the floor, turned the
    // way the piece is -- and red where it would land on something.
    const h = halfBoxOf(held.itemId, held.turn);
    const blocked = !!editOverlaps();
    const corner = (du, dv) => isoPoint(place.gx0 + held.spot.u + du, place.gy0 + held.spot.v + dv);
    const q = [corner(-h.u, -h.v), corner(h.u, -h.v), corner(h.u, h.v), corner(-h.u, h.v)];

    floorCtx.save();
    floorCtx.beginPath();
    floorCtx.moveTo(q[0].x, q[0].y + 1);
    for (let i = 1; i < 4; i++) floorCtx.lineTo(q[i].x, q[i].y + 1);
    floorCtx.closePath();
    floorCtx.fillStyle = blocked ? 'rgba(255,72,56,0.22)' : 'rgba(255,183,3,0.16)';
    floorCtx.fill();
    floorCtx.strokeStyle = blocked ? 'rgba(255,90,70,0.95)' : 'rgba(255,183,3,0.95)';
    floorCtx.lineWidth = 1.8;
    floorCtx.setLineDash([5, 4]);
    floorCtx.stroke();
    floorCtx.setLineDash([]);
    floorCtx.restore();

    // And the floor it needs to be got onto, lighter, so what is being
    // asked for is visible before something is refused for standing in it.
    const z = accessZone(held.itemId, held.spot, held.turn);
    if (z) {
      const zq = [
        isoPoint(place.gx0 + z.u0, place.gy0 + z.v0), isoPoint(place.gx0 + z.u1, place.gy0 + z.v0),
        isoPoint(place.gx0 + z.u1, place.gy0 + z.v1), isoPoint(place.gx0 + z.u0, place.gy0 + z.v1),
      ];
      floorCtx.save();
      floorCtx.beginPath();
      floorCtx.moveTo(zq[0].x, zq[0].y + 1);
      for (let i = 1; i < 4; i++) floorCtx.lineTo(zq[i].x, zq[i].y + 1);
      floorCtx.closePath();
      floorCtx.fillStyle = blocked ? 'rgba(255,72,56,0.10)' : 'rgba(255,255,255,0.08)';
      floorCtx.fill();
      floorCtx.strokeStyle = blocked ? 'rgba(255,90,70,0.6)' : 'rgba(255,255,255,0.55)';
      floorCtx.lineWidth = 1.2;
      floorCtx.setLineDash([3, 4]);
      floorCtx.stroke();
      floorCtx.setLineDash([]);
      floorCtx.restore();
    }

    floorCtx.save();
    floorCtx.globalAlpha = 0.82;
    drawProp(held.itemId, { x: c.x, y: c.y - 10 }, 1, held.turn);
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

  // What the moving parts are doing this frame, in body-height units off the
  // floor. The rig is identical for everybody -- these numbers are the whole
  // difference between walking to a machine, sprinting on it and sinking
  // under a loaded bar.
  function poseOf(m) {
    const s = Math.sin(m.phase);
    const c = Math.cos(m.phase);
    const base = {
      legT: 0, armT: 0, crouch: 0, bob: 0, lift: 0, lean: 0,
      handY: 0.545, handX: 0.125, spread: 1, hold: null,
    };
    if (m.state !== 'using') {
      // Walking: arms and legs scissor opposite each other over a slight bob.
      return Object.assign(base, { legT: s, armT: -s, bob: Math.abs(c) * 0.014 });
    }
    // 0 at one end of the movement, 1 at the other, smooth at both.
    const cycle = 0.5 - 0.5 * c;
    switch (EXERCISE[m.gearId]) {
      case 'run':
        return Object.assign(base, {
          legT: s, armT: -s, bob: Math.abs(c) * 0.026, lift: 0.030,
          handY: 0.700, handX: 0.098, lean: 0.048,
        });
      case 'curl':
        return Object.assign(base, {
          handY: 0.545 + cycle * 0.205, handX: 0.118, hold: 'dumbbells', spread: 1.1,
        });
      case 'press':
        // Overhead, with a dip in the knees as the bar comes back down.
        return Object.assign(base, {
          handY: 0.822 + cycle * 0.235, handX: 0.150, hold: 'bar', spread: 1.15,
          crouch: (1 - cycle) * 0.10,
        });
      case 'squat':
        return Object.assign(base, {
          crouch: cycle, handY: 0.845, handX: 0.185, hold: 'barback', spread: 1.5,
        });
      case 'pull':
        return Object.assign(base, {
          handY: 1.020 - cycle * 0.300, handX: 0.104, hold: 'bar', spread: 1.1,
        });
      case 'stretch':
        return Object.assign(base, {
          crouch: cycle * 0.95, handY: 0.520 - cycle * 0.230,
          handX: 0.088 + cycle * 0.155, spread: 1.30, lean: cycle * 0.105,
        });
      case 'sit':
        // Standing at the door getting their breath back, not exercising.
        return Object.assign(base, {
          crouch: 0.26, handY: 0.545 + cycle * 0.075, handX: 0.150 + cycle * 0.022,
          spread: 1.30, bob: Math.abs(c) * 0.008,
        });
      default:
        return Object.assign(base, { legT: s * 0.22, armT: -s * 0.22, bob: Math.abs(c) * 0.004 });
    }
  }

  // A member, flat-shaded to sit alongside the equipment art. Everything is
  // a proportion of body height, so a member stands the right height next to
  // a squat rack whatever the room's scale.
  //
  // Two things stop a busy room reading as one figure copied six times:
  // nobody is quite the same build or dressed the same way, and what
  // somebody is doing is decided by the piece they are standing at.
  function drawMember(c, m) {
    const ctx = floorCtx;
    const H = 1.72 * (m.build || 1) * PX_PER_METRE_TALL;
    const broad = m.broad || 1;
    const p = poseOf(m);
    // Sinking the hips shortens the legs and brings everything above them
    // down with it. The feet stay planted where they were.
    const drop = p.crouch * 0.135;
    const f = m.facing;
    const y = c.y - p.bob * H;
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
    // A limb between two points, so an arm can reach overhead, forward or
    // down to the floor rather than only hang off the shoulder.
    const limb = (x1, y1, x2, y2, w, color) => {
      const ax = X(x1);
      const ay = Y(y1);
      const dx = X(x2) - ax;
      const dy = Y(y2) - ay;
      const len = Math.hypot(dx, dy);
      const t = w * H;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(Math.atan2(dy, dx));
      roundRectPath(ctx, -t / 2, -t / 2, len + t, t, t * 0.45);
      ctx.fillStyle = color;
      ctx.fill();
      outline();
      ctx.restore();
    };

    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 2, H * 0.10, H * 0.043, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fill();

    const bare = m.legs === 'skin' || !m.legs;
    const legFront = bare ? m.skin : m.legs;
    const legBack = bare ? shade(m.skin, -34) : shade(m.legs, -22);
    const shorts = m.staffRole ? m.legs : shade(m.shirt, -58);

    const hip = 0.435 - drop;
    const shoulderY = 0.80 - drop;
    // Everything from the hips up leans together. The feet stay planted, so
    // the lean reads as somebody putting their weight into it.
    const lean = p.lean;
    const shoulderX = 0.133 * broad + lean;
    const stance = 0.052 * p.spread;
    const legT = p.legT * 0.08;
    const armT = p.armT * 0.06;
    const backFoot = p.lift * Math.max(0, -p.legT);
    const frontFoot = p.lift * Math.max(0, p.legT);
    const armW = 0.052 * broad;

    // Nobody's arms grow. A pose asking the hands further from the shoulders
    // than an arm reaches gets them pulled back in along the same line, so
    // whatever is in them comes back too.
    let handX = p.handX + lean;
    let handY = p.handY - drop;
    {
      const dx = handX - shoulderX;
      const dy = handY - shoulderY;
      const reach = Math.hypot(dx, dy);
      if (reach > 0.345) {
        const k = 0.345 / reach;
        handX = shoulderX + dx * k;
        handY = shoulderY + dy * k;
      }
    }

    // Whatever is in the hands. Wanted at two depths: a bar across the
    // shoulders goes behind the body, everything else in front of it.
    const heldWeight = () => {
      // Mirrored around the lean, not around the figure's own centre, so a
      // weight stays in the hand holding it.
      const hx = handX + armT;
      const far = -hx + lean * 2;
      if (p.hold === 'dumbbells') {
        bar(hx, handY + 0.030, handY - 0.030, 0.052, '#333944');
        bar(far, handY + 0.030, handY - 0.030, 0.052, '#2a2f39');
        return;
      }
      const reach = Math.max(hx - lean, 0.13) + 0.075;
      limb(lean - reach, handY, lean + reach, handY, 0.024, '#8b939e');
      bar(lean - reach, handY + 0.048, handY - 0.048, 0.040, '#2f343d');
      bar(lean + reach, handY + 0.048, handY - 0.048, 0.040, '#3a4049');
    };

    // Back limbs first, darkened, so the figure has some depth to it.
    limb(-shoulderX + lean * 2, shoulderY, -handX - armT + lean * 2, handY, armW, shade(m.skin, -38));
    bar(-stance - legT, hip, 0.045 + backFoot, 0.078 * broad, legBack);
    bar(-stance - legT, 0.062 + backFoot, 0.006 + backFoot, 0.098, '#b9c2cc');

    // Front leg and its shoe.
    bar(stance + legT, hip, 0.045 + frontFoot, 0.078 * broad, legFront);
    bar(stance + legT, 0.062 + frontFoot, 0.006 + frontFoot, 0.098, '#e9edf2');

    bar(lean * 0.35, 0.545 - drop, (m.shortsLen || 0.415) - drop, 0.200 * broad, shorts);

    if (p.hold === 'barback') heldWeight();

    // Torso, tapered shoulder to waist rather than a straight block.
    const waist = 0.092 * broad;
    ctx.beginPath();
    roundedQuadPath(ctx,
      { x: X(-0.118 * broad + lean), y: Y(0.845 - drop) },
      { x: X(0.118 * broad + lean), y: Y(0.845 - drop) },
      { x: X(waist + lean * 0.35), y: Y(0.515 - drop) },
      { x: X(-waist + lean * 0.35), y: Y(0.515 - drop) }, H * 0.035);
    ctx.fillStyle = m.shirt;
    ctx.fill();
    outline();
    // A lit edge down the side the room's lights come from.
    ctx.beginPath();
    roundedQuadPath(ctx,
      { x: X(0.045 + lean), y: Y(0.83 - drop) },
      { x: X(0.105 * broad + lean), y: Y(0.83 - drop) },
      { x: X(0.082 * broad + lean * 0.35), y: Y(0.53 - drop) },
      { x: X(0.03 + lean * 0.35), y: Y(0.53 - drop) }, H * 0.02);
    ctx.fillStyle = shade(m.shirt, 30);
    ctx.fill();

    // A gym bag hangs off the back shoulder, so it sits over the shirt and
    // under the arm carrying it.
    if (m.carry === 'bag' && m.state !== 'using') {
      limb(-0.06, 0.845 - drop, -0.155, 0.655 - drop, 0.016, '#2b3038');
      roundRectPath(ctx, X(-0.225), Y(0.635 - drop), 0.115 * H * f, 0.145 * H,
        H * 0.022);
      ctx.fillStyle = m.bagColor;
      ctx.fill();
      outline();
      // A lighter panel along the top, or it is a coloured brick.
      roundRectPath(ctx, X(-0.222), Y(0.628 - drop), 0.109 * H * f, 0.030 * H,
        H * 0.012);
      ctx.fillStyle = shade(m.bagColor, 26);
      ctx.fill();
    }

    limb(shoulderX, shoulderY, handX + armT, handY, armW, m.skin);

    // A towel goes over the near shoulder, on top of the arm under it.
    if (m.carry === 'towel' && m.state !== 'using') {
      bar(0.128, 0.878 - drop, 0.640 - drop, 0.056, '#eef1f6');
    }

    // The uniform's details: a dark collar at the neck of the polo, a black
    // belt where the shirt meets the trousers, and a name badge on the
    // chest. A cashier's pouch hangs at the far hip.
    if (m.staffRole) {
      bar(lean, 0.850 - drop, 0.822 - drop, 0.17 * broad, STAFF_CAP);
      bar(lean * 0.35, 0.535 - drop, 0.512 - drop, 0.19 * broad, STAFF_CAP);
      bar(-0.048 + lean * 0.6, 0.735 - drop, 0.705 - drop, 0.050, '#f4f6f8');
      if (m.carry === 'pouch') {
        bar(-0.135 + lean * 0.35, 0.520 - drop, 0.430 - drop, 0.078, '#3a2b1c');
        bar(-0.135 + lean * 0.35, 0.522 - drop, 0.500 - drop, 0.082, '#5a4330');
      }
    }

    if (p.hold && p.hold !== 'barback') heldWeight();
    if (m.carry === 'bottle' && m.state !== 'using') {
      bar(handX + armT, handY + 0.035, handY - 0.032, 0.036, '#6fc9e8');
      bar(handX + armT, handY + 0.058, handY + 0.033, 0.022, '#2f6f88');
    }

    // Hair that falls past the head is drawn behind it.
    if (m.hairStyle === 'long') bar(-0.02 + lean, 0.955 - drop, 0.760 - drop, 0.132, m.hair);
    if (m.hairStyle === 'tail') limb(-0.05 + lean, 0.930 - drop, -0.098 + lean, 0.775 - drop, 0.046, m.hair);

    // Neck, head, then whatever is on top of it.
    bar(0.006 + lean, 0.885 - drop, 0.83 - drop, 0.05, shade(m.skin, -18));
    ctx.beginPath();
    ctx.arc(X(0.008 + lean), Y(0.915 - drop), H * 0.078, 0, Math.PI * 2);
    ctx.fillStyle = m.skin;
    ctx.fill();
    outline();
    ctx.beginPath();
    ctx.arc(X(0.008 + lean), Y(0.928 - drop), H * 0.078, Math.PI * 1.02, Math.PI * 2.12);
    ctx.fillStyle = m.hairStyle === 'cap' ? m.capColor : m.hair;
    ctx.fill();
    if (m.hairStyle === 'cap') {
      // A peak out the front, which is what makes a cap a cap. Gold on the
      // staff cap, so the cap alone says who they are.
      limb(0.062 + lean, 0.948 - drop, 0.150 + lean, 0.940 - drop, 0.020,
        m.staffRole ? STAFF_MARK : shade(m.capColor, -28));
    } else if (m.hairStyle === 'bun') {
      ctx.beginPath();
      ctx.arc(X(-0.042 + lean), Y(0.988 - drop), H * 0.034, 0, Math.PI * 2);
      ctx.fillStyle = m.hair;
      ctx.fill();
      outline();
    } else if (m.hairStyle === 'band') {
      bar(0.008 + lean, 0.948 - drop, 0.918 - drop, 0.152, m.capColor);
    }
    if (m.staffRole) drawStaffMark(c, m);
  }

  // A small gold diamond over every member of staff. It is the one thing
  // that still tells them apart when the plan is zoomed out to a room the
  // size of a stamp, where a shirt colour is two pixels.
  function drawStaffMark(c, m) {
    const H = 1.72 * (m.build || 1) * PX_PER_METRE_TALL;
    const bob = Math.sin((m.phase || 0) * 0.35) * 1.2;
    const x = c.x;
    const y = c.y - H * 1.10 + bob;
    const r = Math.max(2.6, H * 0.038);
    floorCtx.beginPath();
    floorCtx.moveTo(x, y - r * 1.3);
    floorCtx.lineTo(x + r, y);
    floorCtx.lineTo(x, y + r * 1.3);
    floorCtx.lineTo(x - r, y);
    floorCtx.closePath();
    floorCtx.fillStyle = STAFF_MARK;
    floorCtx.fill();
    floorCtx.strokeStyle = 'rgba(0,0,0,0.55)';
    floorCtx.lineWidth = 1;
    floorCtx.stroke();
  }

  function drawProp(itemId, c, tier, turn) {
    const catColor = CATEGORY_META[CATEGORY[itemId]].color;
    floorCtx.save();

    // Everything below is in metres now, so there is no per-piece scaling
    // transform any more: a builder that says 0.45 gets 0.45 of a metre.
    const tiles = drawSizeOf(itemId) * TILES_PER_METRE;

    // The only thing on the floor under a piece is its shadow. It used to
    // stand on a category-coloured pool with a synergy ring and a pulsing
    // in-use ring on top of that, and three haloes stacked under an object
    // do not read as an object standing on a floor -- they read as one
    // hovering over a sticker. What they were saying is said elsewhere now:
    // the arrangement bonus by the synergy line under the plan, and who is
    // using what by the person standing there doing it.
    //
    // Sized off the piece, so a dumbbell casts a dumbbell's shadow and a
    // sauna casts a sauna's. The softness is a gradient fading to nothing at
    // the rim rather than an ellipse run through a blur filter: a canvas
    // filter re-rasterises the region it touches, and with one under every
    // piece of gear that single call cost nine tenths of the entire frame.
    const shadowRX = tiles * ROOM.tileW * 0.25;
    const shadowRY = tiles * ROOM.tileH * 0.27;
    const shadowY = c.y + 2;
    const soft = floorCtx.createRadialGradient(c.x, shadowY, shadowRX * 0.08,
      c.x, shadowY, shadowRX);
    soft.addColorStop(0, 'rgba(0,0,0,0.55)');
    soft.addColorStop(0.45, 'rgba(0,0,0,0.34)');
    soft.addColorStop(1, 'rgba(0,0,0,0)');
    floorCtx.beginPath();
    floorCtx.ellipse(c.x, shadowY, shadowRX, shadowRY, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = soft;
    floorCtx.fill();

    // An upgraded piece carries its mark: one stripe per tier above the
    // first, painted on the floor in front of it, so a room of Mk III
    // treadmills reads differently from a room of new ones without having
    // to be told.
    if (tier > 1) {
      for (let i = 0; i < tier - 1; i++) {
        const px = c.x + (i - (tier - 2) / 2) * ROOM.tileW * 0.11;
        roundRectPath(floorCtx, px - ROOM.tileW * 0.022,
          shadowY + shadowRY * 0.72, ROOM.tileW * 0.044, ROOM.tileH * 0.14,
          ROOM.tileW * 0.018);
        floorCtx.fillStyle = hexA(catColor, 0.9);
        floorCtx.fill();
      }
    }

    const build = PROP_BUILDERS[itemId];
    if (build) {
      blitProp(itemId, turn || 0, c);
    } else {
      // Nothing should reach here, but a piece with no drawing at all would
      // otherwise be an invisible thing standing on the floor earning money.
      drawIsoBox(floorCtx, c, 0, 0, tiles / 2, tiles / 2, 0.6 * PX_PER_METRE_TALL,
        catColor, 0);
    }
    floorCtx.restore();
  }

  // A piece is a dozen gradient-filled faces, and a full gym has sixty of
  // them on screen, redrawn twenty times a second under the crowd. Drawn
  // live that cost more than the flat pictures it replaced. So each piece
  // is drawn once, at each turn, into a bitmap of its own, and stamped from
  // there -- which is cheaper than the pictures were. Nothing in a builder
  // moves, so the bitmap never goes stale; it is only thrown away when the
  // canvas's own resolution changes, because a bitmap made for one scale
  // blurs at another.
  const propCache = new Map();
  let propCacheScale = 0;

  function blitProp(itemId, turn, c) {
    const scale = floorCtx.getTransform().a || 1;
    if (scale !== propCacheScale) {
      propCache.clear();
      propCacheScale = scale;
    }
    const key = itemId + ':' + turn;
    let entry = propCache.get(key);
    if (!entry) {
      entry = renderPropBitmap(itemId, turn, scale);
      propCache.set(key, entry);
    }
    // Snapped to whole device pixels, or the stamp lands between them and
    // comes out soft on one side.
    const x = Math.round((c.x - entry.ox) * scale) / scale;
    const y = Math.round((c.y - entry.oy) * scale) / scale;
    floorCtx.drawImage(entry.canvas, x, y, entry.w, entry.h);
  }

  function renderPropBitmap(itemId, turn, scale) {
    // Generous bounds off the piece's footprint: as wide as its longest side
    // could reach on either lattice axis, and tall enough for anything that
    // stands under the wall line, plus a margin for a rail or a frond that
    // pokes past.
    const tiles = drawSizeOf(itemId) * TILES_PER_METRE;
    const w = Math.ceil(tiles * ROOM.tileW * 1.3 + 40);
    const h = Math.ceil(tiles * ROOM.tileH * 1.3 + 2.3 * PX_PER_METRE_TALL + 40);
    const ox = w / 2;
    const oy = h - tiles * ROOM.tileH * 0.65 - 20;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * scale);
    canvas.height = Math.ceil(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // The builders draw through floorCtx by name, so it is pointed at the
    // bitmap for the duration and put back after.
    const live = floorCtx;
    floorCtx = ctx;
    propTurn = turn;
    try {
      PROP_BUILDERS[itemId](ctx, { x: ox, y: oy });
    } finally {
      propTurn = 0;
      floorCtx = live;
    }
    return { canvas, w, h, ox, oy };
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

  // Shift the view by a screen delta, right now, with nothing remembered.
  // The two-finger pan measures frame to frame rather than from where the
  // gesture started, because a pinch moves both fingers and there is no one
  // anchor to hold on to.
  function nudgeView(dx, dy) {
    if (!stageScrollEl) return;
    stageScrollEl.scrollLeft -= dx;
    const maxTop = Math.max(0, stageScrollEl.scrollHeight - stageScrollEl.clientHeight);
    const wantTop = stageScrollEl.scrollTop - dy;
    const clamped = Math.max(0, Math.min(maxTop, wantTop));
    stageScrollEl.scrollTop = clamped;
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
      pinchState = { startDist: mid.dist || 1, startZoom: zoomLevel, lastX: mid.x, lastY: mid.y };
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
      // Both at once, the way every map does it: the span between the
      // fingers sets the zoom, and the midpoint moving drags the view.
      // Zooming first, so the pan is measured in the new scale.
      zoomAround(pinchState.startZoom * (mid.dist / pinchState.startDist), mid.x, mid.y);
      nudgeView(mid.x - pinchState.lastX, mid.y - pinchState.lastY);
      pinchState.lastX = mid.x;
      pinchState.lastY = mid.y;
      return;
    }

    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const dx = e.clientX - dragState.startClientX;
    const dy = e.clientY - dragState.startClientY;
    dragState.moved = Math.max(dragState.moved, Math.abs(dx), Math.abs(dy));
    if (dragState.carrying) {
      const p = pointFromEvent(e);
      const hit = spotFromPoint(p.x, p.y);
      if (hit && editing) {
        if (hit.roomIndex !== editing.roomIndex) carryEditTo(hit.roomIndex, hit.u, hit.v);
        else moveEditTo(hit.u, hit.v);
      }
      return;
    }
    panBy(dx, dy);
  });

  function samePiece(a, b) {
    return (!a && !b)
      || (!!a && !!b && a.roomIndex === b.roomIndex && a.index === b.index);
  }

  // Whether the pointer is over a machine's money bubble.
  function overCash(px, py) {
    return !editing && !!pileTagAtPoint(px, py);
  }

  function setHoverCell(next) {
    if (samePiece(hoverCell, next)) return;
    hoverCell = next;
    // Only fires when the pointer crosses onto a different piece, not on
    // every mouse move, so this is a handful of repaints a second at most.
    renderScene();
  }

  let cashUnderPointer = false;
  function restCursor() {
    gestureEl.style.cursor = (hoverCell || cashUnderPointer) ? 'pointer' : 'grab';
  }

  gestureEl.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (dragState || pinchState || editing) { setHoverCell(null); return; }
    const p = pointFromEvent(e);
    cashUnderPointer = overCash(p.x, p.y);
    setHoverCell(cashUnderPointer ? null : pieceAtPoint(p.x, p.y));
    restCursor();
  });

  // Panning moves the plan under the window, so the site has to be
  // redrawn at its new offset.
  if (stageScrollEl) {
    stageScrollEl.addEventListener('scroll', queueGroundPaint, { passive: true });
  }

  gestureEl.addEventListener('pointerleave', () => {
    cashUnderPointer = false;
    setHoverCell(null);
    restCursor();
  });

  // The finger still down after a pinch ends starts a fresh gesture from
  // where it is, rather than waiting to be lifted and put back.
  function resumeSinglePointer() {
    if (!stageScrollEl || pointers.size !== 1) return;
    const id = Array.from(pointers.keys())[0];
    const at = pointers.get(id);
    dragState = {
      pointerId: id,
      startClientX: at.x,
      startClientY: at.y,
      startScrollLeft: stageScrollEl.scrollLeft,
      startScrollTop: stageScrollEl.scrollTop,
      pageScrolled: 0,
      // A gesture that began as a pinch is a view gesture, not a placement
      // one: lifting one finger should not suddenly start dragging the
      // piece you are holding halfway across the room.
      moved: 999,
      carrying: false,
    };
  }

  gestureEl.addEventListener('pointerup', (e) => {
    const wasPinching = !!pinchState;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchState = null;
    // One of a pinch's two fingers has come off. The other is still on the
    // glass and has to go on meaning something.
    if (wasPinching && !pinchState) resumeSinglePointer();

    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const wasDrag = dragState.moved > DRAG_THRESHOLD;
    const wasCarry = dragState.carrying;
    dragState = null;
    restCursor();
    if (wasDrag || wasCarry) return;

    const p = pointFromEvent(e);
    onFloorTap(p.x, p.y);
  });

  // The wheel zooms the plan, no modifier needed: over the stage a scroll
  // is a zoom, the way it is on every map. Two different things arrive
  // here as wheel events. A trackpad pinch comes with ctrlKey set and a
  // stream of small deltas, and gets a gentle exponential rate so the
  // pinch is smooth. A mouse wheel comes in notches -- a hundred pixels or
  // a few lines a click -- and gets a fixed step per notch, so one click is
  // a clear nudge in or out rather than a lurch or a nothing.
  const PINCH_ZOOM_RATE = 0.002;
  const NOTCH_ZOOM_STEP = 1.12;
  gestureEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    let factor;
    if (e.ctrlKey) {
      factor = Math.exp(-e.deltaY * PINCH_ZOOM_RATE);
    } else {
      const notches = e.deltaMode === 0 ? e.deltaY / 100 : e.deltaY / 3;
      factor = Math.pow(NOTCH_ZOOM_STEP, -Math.max(-3, Math.min(3, notches)));
    }
    zoomAround(zoomLevel * factor, e.clientX, e.clientY);
  }, { passive: false });

  gestureEl.addEventListener('pointercancel', (e) => {
    const wasPinching = !!pinchState;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchState = null;
    dragState = null;
    if (wasPinching && !pinchState) resumeSinglePointer();
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

  function roomLabel(index) {
    return 'Room ' + (index + 1);
  }

  function editShape() {
    return roomShapeFor(state.activeTheme, editing.roomIndex);
  }

  function beginEdit(itemId, roomIndex, spot, fromIndex) {
    const shape = roomShapeFor(state.activeTheme, roomIndex);
    const turn = spot && spot.r ? (spot.r & 3) : 0;
    const at = clampSpot(snapSpot(spot.u, spot.v), shape, itemId, turn);
    editing = {
      itemId,
      roomIndex,
      // The room it was lifted out of, which is where cancelling puts it
      // back -- not necessarily the room it is being carried around in.
      fromRoomIndex: fromIndex === undefined || fromIndex === null ? null : roomIndex,
      spot: at,
      // Picked up the way it was standing, so moving a turned piece does
      // not quietly straighten it out.
      turn: spot && spot.r ? (spot.r & 3) : 0,
      // Where it stood when it was picked up -- the position itself, not the
      // snapped working copy, so cancelling a piece that was sitting between
      // two steps of the grid puts it back between them.
      originSpot: { u: spot.u, v: spot.v, r: spot && spot.r ? (spot.r & 3) : 0 },
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
    collectPile(roomIndex, index);
    // A queue belongs to a counter standing still: the piece being lifted
    // may end up in storage or in another room's slot, so what is finished
    // goes into the larder now and what is not is poured away.
    emptyCounter(state.activeTheme, roomIndex, index);
    const shape = roomShapeFor(state.activeTheme, roomIndex);
    const itemId = room.layout[index];
    if (!itemId) return;
    const spot = spotOf(room, index, shape);
    room.layout[index] = null;
    if (room.spots) room.spots[index] = null;
    beginEdit(itemId, roomIndex, spot, index);
    recomputeStats();
  }

  // Now that two pieces cannot share floor, what people want is to set them
  // side by side -- and getting two edges exactly flush with a five-pixel
  // nudge is fiddly. So a held piece that comes within half a tile of
  // another piece's edge snaps to it, flush: along whichever axis the two
  // already overlap, on the other. Snapping never moves a piece more than
  // that half tile, so it cannot fight the hand that is dragging it.
  const SNAP_REACH = 0.55;
  function snapToNeighbours(room, shape, itemId, spot, turn) {
    const h = halfBoxOf(itemId, turn);
    let best = null;
    room.layout.forEach((id, i) => {
      if (!id) return;
      const sp = spotOf(room, i, shape);
      const t = turnAt(room, i);
      const o = halfBoxOf(id, t);
      // Everything of theirs to sit flush against: the piece, and the floor
      // it needs in front of it. And everything of mine that has to clear
      // them: my box, and my own step-on floor.
      const theirs = [boxRect(sp, o)];
      const zone = accessZone(id, sp, t);
      if (zone) theirs.push(zone);
      const myZone = accessZone(itemId, spot, turn);
      const mine = [boxRect(spot, h)];
      if (myZone) mine.push(myZone);
      const tries = [];
      theirs.forEach((r) => mine.forEach((m) => {
        // How far my rectangle's centre sits from the held spot.
        const du = (m.u0 + m.u1) / 2 - spot.u;
        const dv = (m.v0 + m.v1) / 2 - spot.v;
        const mu = (m.u1 - m.u0) / 2;
        const mv = (m.v1 - m.v0) / 2;
        const sideBySideU = m.v1 > r.v0 && m.v0 < r.v1;
        const sideBySideV = m.u1 > r.u0 && m.u0 < r.u1;
        if (sideBySideU) {
          tries.push({ u: r.u1 + mu - du, v: spot.v });
          tries.push({ u: r.u0 - mu - du, v: spot.v });
        }
        if (sideBySideV) {
          tries.push({ u: spot.u, v: r.v1 + mv - dv });
          tries.push({ u: spot.u, v: r.v0 - mv - dv });
        }
      }));
      tries.forEach((t) => {
        const d = Math.hypot(t.u - spot.u, t.v - spot.v);
        if (d >= SNAP_REACH || (best && d >= best.d)) return;
        // Never snap into a place the piece could not be put down: flush
        // with a treadmill's side is no use if that puts you in the floor
        // in front of it, and a snap there would hold the piece in the
        // very spot it is being nudged out of.
        if (overlapsAnother(room, shape, itemId, t, turn)) return;
        if (spotInCut(shape, itemId, t, turn) || zoneOffFloor(shape, itemId, t, turn)) return;
        best = { u: t.u, v: t.v, d };
      });
    });
    return best ? { u: best.u, v: best.v } : spot;
  }

  // Whatever the held piece would land on top of, right now.
  // 'edge' when it hangs over the notch cut out of the room, which is not a
  // thing but blocks like one.
  function editOverlaps() {
    if (!editing) return null;
    const room = activeRooms()[editing.roomIndex];
    if (!room) return null;
    const shape = editShape();
    if (spotInCut(shape, editing.itemId, editing.spot, editing.turn)) return 'edge';
    if (zoneOffFloor(shape, editing.itemId, editing.spot, editing.turn)) return 'edge';
    return overlapsAnother(room, shape, editing.itemId, editing.spot, editing.turn);
  }
  function blockerName(blocker) {
    return blocker === 'edge' ? 'edge of the floor' : itemById(blocker).name;
  }

  // Carry the held piece into another room: it keeps its turn, and lands
  // wherever in that room the pointer is, clamped onto its floor.
  function carryEditTo(roomIndex, u, v) {
    if (!editing || editing.roomIndex === roomIndex) return false;
    if (!activeRooms()[roomIndex]) return false;
    editing.roomIndex = roomIndex;
    moveEditTo(u, v);
    return true;
  }

  function moveEditTo(u, v) {
    if (!editing) return;
    const room = activeRooms()[editing.roomIndex];
    const shape = editShape();
    const at = clampSpot(snapSpot(u, v), shape, editing.itemId, editing.turn);
    // Snapped, then clamped again: a snap can only ever move a piece toward
    // a neighbour, and a neighbour against a wall is inside the room.
    editing.spot = clampSpot(snapToNeighbours(room, shape, editing.itemId, at, editing.turn),
      shape, editing.itemId, editing.turn);
    refreshPlaceHud();
    renderScene();
  }

  function nudgeEdit(du, dv) {
    if (!editing) return;
    moveEditTo(editing.spot.u + du * SPOT_STEP, editing.spot.v + dv * SPOT_STEP);
  }

  function turnEdit() {
    if (!editing) return;
    editing.turn = (editing.turn + 1) & 3;
    // A turned piece reaches further one way and less the other, so it is
    // clamped again for the wall it may now be through.
    editing.spot = clampSpot(editing.spot, editShape(), editing.itemId, editing.turn);
    refreshPlaceHud();
    renderScene();
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
    const blocker = editOverlaps();
    if (blocker) {
      toast("Won't fit -- it would overlap the " + blockerName(blocker), null);
      return;
    }
    const room = activeRooms()[editing.roomIndex];
    // Back into the slot it came from where there is one, so moving a piece
    // does not quietly reshuffle a full room -- but a piece carried into
    // another room takes a free slot there, and only if that room has one.
    const sameRoom = editing.fromRoomIndex === editing.roomIndex;
    let slot = sameRoom ? editing.fromIndex : null;
    if (slot === null || room.layout[slot]) slot = room.layout.indexOf(null);
    if (slot === -1) {
      toast(roomLabel(editing.roomIndex) + ' is full -- every slot in it is taken', null);
      return;
    }
    if (!room.spots) room.spots = new Array(room.layout.length).fill(null);
    const itemId = editing.itemId;
    const turn = editing.turn & 3;
    const roomIndex = editing.roomIndex;
    const fromTray = editing.fromIndex === null;
    room.layout[slot] = itemId;
    room.spots[slot] = { u: editing.spot.u, v: editing.spot.v, r: turn };
    const at = { u: editing.spot.u, v: editing.spot.v };
    endEdit();

    // Straight on to the next one. Only for a piece that came out of
    // Storage -- moving a piece already on the floor is a single act, and
    // handing you another one after it would be baffling.
    if (!fromTray || availableCount(itemId) <= 0) return;
    // One desk per location, so putting one down is the end of it.
    if (itemById(itemId) && itemById(itemId).starter) return;
    const shape = roomShapeFor(state.activeTheme, roomIndex);
    const next = findFreeSpot(activeRooms()[roomIndex], shape, itemId, turn, at);
    if (!next) return;
    beginEdit(itemId, roomIndex, next, null);
    if (editing) editing.turn = turn;
    refreshPlaceHud();
    renderScene();
  }

  function cancelEdit() {
    if (!editing) return;
    // A desk that was never put down is not kept: it goes back to being
    // the free one the shop offers.
    const held = itemById(editing.itemId);
    if (editing.fromIndex === null && held && held.starter) {
      state.owned[held.id] = Math.max(0, (state.owned[held.id] || 0) - 1);
    }
    if (editing.fromIndex !== null) {
      // It was already on the floor: put it back exactly where it stood,
      // in the room it stood in.
      const room = activeRooms()[editing.fromRoomIndex];
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
        const c = cutRect(p);
        if (c && inRect(c, gx, gy)) continue;
        return { roomIndex: i, u: gx - p.gx0, v: gy - p.gy0 };
      }
    }
    return null;
  }

  // The bitmap for a piece at a turn, made if it is not there yet -- a tap
  // can land before the first paint since a change of resolution.
  function propBitmap(itemId, turn) {
    const scale = floorCtx.getTransform().a || 1;
    if (scale !== propCacheScale) {
      propCache.clear();
      propCacheScale = scale;
    }
    const key = itemId + ':' + turn;
    let entry = propCache.get(key);
    if (!entry) {
      entry = renderPropBitmap(itemId, turn, scale);
      propCache.set(key, entry);
    }
    return entry;
  }

  // Which piece a point on the canvas lands on -- tested against the piece
  // as drawn, in screen space, rather than as a circle around its middle on
  // the floor. So a squat rack is grabbed by its uprights and a mat by its
  // edge, a tall thing whose top stands past the back wall can still be
  // taken by that top, and where two pieces overlap on screen the one drawn
  // in front is the one you get.
  function pieceAtPoint(px, py) {
    let best = null;
    activeRooms().forEach((room, roomIndex) => {
      const place = placements[roomIndex];
      if (!place) return;
      const shape = roomShapeFor(state.activeTheme, roomIndex);
      room.layout.forEach((id, i) => {
        if (!id || !PROP_BUILDERS[id]) return;
        const sp = spotOf(room, i, shape);
        const c = isoPoint(place.gx0 + sp.u, place.gy0 + sp.v);
        const e = propBitmap(id, turnAt(room, i));
        const lx = px - (c.x - e.ox);
        const ly = py - (c.y - e.oy);
        if (lx < 0 || ly < 0 || lx >= e.w || ly >= e.h) return;
        const sc = propCacheScale;
        const alpha = e.canvas.getContext('2d')
          .getImageData(Math.floor(lx * sc), Math.floor(ly * sc), 1, 1).data[3];
        if (alpha < 40) return;
        // Later rooms and deeper spots are painted later, so they are in front.
        const depth = roomIndex * 1e6 + sp.u + sp.v;
        if (!best || depth >= best.depth) best = { roomIndex, index: i, depth };
      });
    });
    return best ? { roomIndex: best.roomIndex, index: best.index } : null;
  }

  // What a tap on the plan does, in order: move the piece you are holding,
  // pick up the piece you tapped, or just make that room the active one.
  function onFloorTap(px, py) {
    const hit = spotFromPoint(px, py);
    if (editing) {
      if (hit) {
        if (hit.roomIndex !== editing.roomIndex) carryEditTo(hit.roomIndex, hit.u, hit.v);
        else moveEditTo(hit.u, hit.v);
      }
      return;
    }
    // Cash first: the bubble over a machine is the thing you are most
    // likely reaching for, and it is drawn over everything.
    const pile = pileTagAtPoint(px, py);
    if (pile) {
      collectPile(pile.roomIndex, pile.index);
      return;
    }
    // Then a piece: its top can stand past the floor of any room.
    const piece = pieceAtPoint(px, py);
    const roomIndex = piece ? piece.roomIndex : hit ? hit.roomIndex : -1;
    if (roomIndex < 0) return;
    if (roomIndex !== state.activeRoomIndex) {
      state.activeRoomIndex = roomIndex;
      refreshRoomActions();
      refreshSynergyText();
    }
    if (piece) liftPiece(piece.roomIndex, piece.index);
  }

  function renderInventory() {
    refreshPlaceAll();
    inventoryEl.innerHTML = '';
    const ownedItems = ITEMS.filter((item) => !item.starter && availableCount(item.id) > 0);
    if (ownedItems.length === 0) {
      const p = document.createElement('p');
      p.className = 'tycoon-inv-empty';
      p.textContent = THEMES.some((t) => state.themeRooms[t.id].some((r) => r.layout.some(Boolean)))
        ? 'Empty. Everything you own is on a floor.'
        : 'Empty. Buy gear from the shop and it lands here.';
      inventoryEl.appendChild(p);
      return;
    }
    ownedItems.forEach((item) => {
      const cat = CATEGORY_META[CATEGORY[item.id]];
      // A wrapping div rather than a button, since it holds two separate
      // clickable controls (arm-to-place, and sell) -- buttons can't nest.
      const chip = document.createElement('div');
      const held = editing && editing.itemId === item.id && editing.fromIndex === null;
      chip.className = 'tycoon-inv-item' + (held ? ' is-armed' : '')
        + (item.starter && !gymOpen() && !held ? ' is-needed' : '');

      const armBtn = document.createElement('button');
      armBtn.type = 'button';
      armBtn.className = 'tycoon-inv-arm';
      armBtn.innerHTML = '<span class="inv-cat-dot" style="background:' + cat.color + '"></span>'
        + '<span class="inv-icon">' + iconMarkup(item.id, 15) + '</span> '
        + item.name + ' <span class="inv-count">x' + availableCount(item.id) + '</span>'
        + '<span class="inv-rate"></span>';
      // What it will be worth once it is down, so the choice of what to
      // place first can be made here rather than back in the shop.
      armBtn.querySelector('.inv-rate').textContent = item.vibe
        ? '+' + Math.round(item.vibe * VIBE_PER_POINT * 100) + '% vibe'
        : formatNum(gpsOf(item.id)) + '/s';
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

      // The desk is not for sale: a location cannot run without one.
      if (!item.starter) {
        const sellBtn = document.createElement('button');
        sellBtn.type = 'button';
        sellBtn.className = 'tycoon-inv-sell';
        sellBtn.textContent = 'Sell +$' + formatNum(sellPrice(item));
        sellBtn.title = 'Sell one back for 60% of what you paid for it';
        sellBtn.addEventListener('click', () => sellItem(item.id));
        chip.appendChild(sellBtn);
        // Clearing out a stack of six meant six clicks.
        const spare = availableCount(item.id);
        if (spare > 1) {
          const allBtn = document.createElement('button');
          allBtn.type = 'button';
          allBtn.className = 'tycoon-inv-sell is-all';
          allBtn.textContent = 'Sell all';
          allBtn.title = 'Sell every spare ' + item.name + ' back';
          allBtn.addEventListener('click', () => {
            for (let i = 0; i < spare; i++) sellItem(item.id);
          });
          chip.appendChild(allBtn);
        }
      }

      inventoryEl.appendChild(chip);
    });
  }

  // The row of locations. Built once, because the tick refreshes it ten
  // times a second: a row rebuilt between a press and its release swallows
  // the click, which is why switching location used to take two goes.
  const themeBtns = {};
  function buildThemeRow() {
    if (!themeRowEl) return;
    themeRowEl.innerHTML = '';
    THEMES.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tycoon-theme-btn';
      btn.addEventListener('click', () => {
        if (state.activeTheme === t.id || !unlockedFor(t)) return;
        state.activeTheme = t.id;
        state.activeRoomIndex = Math.min(state.activeRoomIndex, activeRooms().length - 1);
        rebuildPlan();
        renderScene();
        renderInventory();
        refreshThemeRow();
        refreshSynergyText();
        refreshRoomActions();
        refreshShopUI();
        scrollToRoom(state.activeRoomIndex);
        save();
      });
      themeRowEl.appendChild(btn);
      themeBtns[t.id] = btn;
    });
  }

  function refreshThemeRow() {
    THEMES.forEach((t) => {
      const btn = themeBtns[t.id];
      if (!btn) return;
      const unlocked = unlockedFor(t);
      const rooms = state.themeRooms[t.id] || [];
      const open = chainHasDesk(rooms);
      const rate = open ? rooms.reduce(
        (sum, room, i) => sum + computeGps(room, roomShapeFor(t.id, i)), 0) : 0;
      const waiting = rooms.reduce(
        (sum, room) => sum + roomCash(room).reduce((a, b) => a + b, 0), 0);
      const label = !unlocked
        ? t.name + ' <span class="btn-lock-icon">' + iconMarkup('lock', 11) + '</span><span class="theme-lv"> Lv ' + t.unlockLevel + '</span>'
        : t.name + '<span class="theme-rate">' + (open ? formatNum(rate) + '/s' : 'shut') + '</span>'
          + (waiting >= 1 ? '<span class="theme-dot" title="Money waiting in the bubbles here"></span>' : '');
      if (btn.innerHTML !== label) btn.innerHTML = label;
      btn.classList.toggle('is-active', state.activeTheme === t.id);
      btn.classList.toggle('is-locked', !unlocked);
      btn.classList.toggle('is-shut', unlocked && !open);
      btn.disabled = !unlocked;
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
  let addRoomBtn = null;
  function buildRoomActions() {
    if (!roomActionsEl) return;
    roomActionsEl.innerHTML = '';
    addRoomBtn = document.createElement('button');
    addRoomBtn.type = 'button';
    addRoomBtn.className = 'tycoon-add-room';
    // Built once and only relabelled after, for the same reason the
    // location buttons are: the tick refreshes this ten times a second.
    addRoomBtn.addEventListener('click', () => {
      const rooms = activeRooms();
      if (rooms.length >= MAX_ROOMS_PER_THEME) return;
      const cost = ROOM_UNLOCK_COSTS[rooms.length];
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
    roomActionsEl.appendChild(addRoomBtn);
  }

  function refreshRoomActions() {
    if (!addRoomBtn) return;
    const rooms = activeRooms();
    // A second room is no use to a location whose first one is not open yet,
    // and none of it is any use before the desk goes down.
    if (rooms.length >= MAX_ROOMS_PER_THEME || !gymOpen()) {
      addRoomBtn.hidden = true;
      return;
    }
    const cost = ROOM_UNLOCK_COSTS[rooms.length];
    const affordable = state.balance >= cost;
    const label = '+ Room<span class="room-slots"> \u00b7 ' + slotCountFor(state.activeTheme, rooms.length)
      + ' slots</span> \u00b7 $' + formatNum(cost);
    addRoomBtn.hidden = false;
    if (addRoomBtn.innerHTML !== label) addRoomBtn.innerHTML = label;
    addRoomBtn.classList.toggle('is-locked', !affordable);
    addRoomBtn.disabled = !affordable;
  }

  // ---- The placement pad ----
  // Arrows to nudge, and the two decisions. Kept as real buttons over the
  // stage rather than drawn into the canvas so they are proper tap targets
  // and can be reached by keyboard.
  const placeHudEl = document.getElementById('place-hud');
  const placeLabelEl = document.getElementById('place-label');
  const placeStoreBtn = document.getElementById('btn-place-store');
  const placeConfirmBtn = document.getElementById('btn-place-confirm');

  function refreshPlaceHud() {
    if (!placeHudEl) return;
    placeHudEl.hidden = !editing;
    if (!editing) return;
    const item = itemById(editing.itemId);
    const blocker = editOverlaps();
    if (placeLabelEl) {
      const where = activeRooms().length > 1 ? ' in ' + roomLabel(editing.roomIndex) : '';
      placeLabelEl.textContent = (item ? item.name : 'Gear')
        + (blocker ? ' \u00b7 too close to the ' + blockerName(blocker)
          : where + ' \u00b7 drag, then Place');
    }
    if (placeConfirmBtn) placeConfirmBtn.disabled = !!blocker;
    if (placeStoreBtn) placeStoreBtn.hidden = editing.fromIndex === null;
  }

  const placeTurnBtn = document.getElementById('btn-place-turn');
  if (placeTurnBtn) placeTurnBtn.addEventListener('click', turnEdit);
  // R for the same thing, because a piece being turned round is the sort of
  // thing you do half a dozen times while laying a room out.
  // Screen directions again: up is away from you up the floor, which on this
  // projection is a step back along both lattice axes.
  const ARROW_NUDGE = {
    ArrowUp: [-1, -1], ArrowDown: [1, 1], ArrowLeft: [-1, 1], ArrowRight: [1, -1],
  };
  document.addEventListener('keydown', (e) => {
    if (!editing || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      turnEdit();
      return;
    }
    if (ARROW_NUDGE[e.key]) {
      e.preventDefault();
      nudgeEdit(ARROW_NUDGE[e.key][0], ARROW_NUDGE[e.key][1]);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmEdit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });

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

  // ---- Reset ----
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm("Reset all Gym Tycoon progress on this browser? This can't be undone.")) return;
    localStorage.removeItem(SAVE_KEY);
    state = defaultState();
    gps = 0;
    armedItemId = null;
    editing = null;
    refreshHud();
    refreshSynergyText();
    refreshShopUI();
    // The trophy wall only ever gains tiles as they are won, so a reset has
    // to put it back itself or it would keep showing a cleared gym's.
    refreshTrophyUI();
    refreshRushOrderUI();
    if (gymNameEl) gymNameEl.value = '';
    renderScene();
    renderInventory();
    refreshThemeRow();
    refreshRoomActions();
    save();
  });

  // ---- Zoom buttons ----

  // ---- Side panel tabs ----
  // One board at a time. The tab row is built once and never rebuilt, so a
  // click on it always completes.
  const tabsEl = document.getElementById('panel-tabs');
  const panelEls = {};
  const tabEls = {};
  let activePanel = 'shop';
  const PANEL_KEY = 'gymTycoonPanel';
  function showPanel(name) {
    if (!panelEls[name] || tabEls[name].hidden) return;
    activePanel = name;
    try { localStorage.setItem(PANEL_KEY, name); } catch (err) { /* private mode */ }
    Object.keys(panelEls).forEach((key) => {
      panelEls[key].hidden = key !== name;
      tabEls[key].classList.toggle('is-active', key === name);
    });
  }
  function buildTabs() {
    if (!tabsEl) return;
    document.querySelectorAll('.tycoon-panel').forEach((el) => {
      panelEls[el.dataset.panel] = el;
    });
    tabsEl.querySelectorAll('.tycoon-tab').forEach((btn) => {
      tabEls[btn.dataset.panel] = btn;
      btn.addEventListener('click', () => showPanel(btn.dataset.panel));
    });
    // Back where you left off. A tab that has since been hidden -- the last
    // of a staff role let go, say -- falls back to the shop, which showPanel
    // does for us by refusing a hidden tab.
    let want = 'shop';
    try { want = localStorage.getItem(PANEL_KEY) || 'shop'; } catch (err) { want = 'shop'; }
    showPanel(want);
    if (activePanel !== want) showPanel('shop');
  }

  // ---- What the whole business is doing ----
  // The plan only ever shows one location. This is the answer to "so how am
  // I doing": every location, whether it is open, how much of it is built
  // and what it brings in -- and a click to go and look at one.
  const overviewEl = document.getElementById('overview');
  const overviewRows = {};
  let overviewTotalEl = null;
  // What the next level opens, in the same words the level-up toast uses.
  function nextLevelBrings(level) {
    const opened = ITEMS.filter((i) => i.unlockLevel === level).map((i) => i.name)
      .concat(THEMES.filter((t) => t.unlockLevel === level).map((t) => t.name))
      .concat(STAFF_ROLES.filter((r) => r.unlockLevel === level).map((r) => r.name + 's'))
      .concat(level === UPGRADE_MIN_LEVEL ? ['upgrades'] : [])
      .concat(level === RUSH_ORDER_MIN_LEVEL ? ['rush orders'] : []);
    return opened.length ? opened.join(', ') : null;
  }

  const levelCardEl = document.getElementById('level-card');
  function refreshLevelCard() {
    if (!levelCardEl) return;
    const level = currentLevel();
    const p = levelProgress();
    setText(levelCardEl.querySelector('.tycoon-lvl-now'), 'Level ' + level);
    levelCardEl.querySelector('.tycoon-lvl-fill').style.width =
      Math.round(p.frac * 100) + '%';
    if (p.capped) {
      setText(levelCardEl.querySelector('.tycoon-lvl-xp'), 'Top level');
      setText(levelCardEl.querySelector('.tycoon-lvl-next'),
        'There is no level above this one. Everything is open.');
      return;
    }
    const into = Math.max(0, (state.xp || 0) - p.from);
    setText(levelCardEl.querySelector('.tycoon-lvl-xp'),
      formatNum(into) + ' / ' + formatNum(p.to - p.from) + ' XP to level ' + (level + 1));
    const brings = nextLevelBrings(level + 1);
    setText(levelCardEl.querySelector('.tycoon-lvl-next'), brings
      ? 'Level ' + (level + 1) + ' opens ' + brings + '.'
      : 'Buying and upgrading gear is what earns XP. Dearer kit earns more.');
  }

  function buildOverview() {
    if (!overviewEl) return;
    overviewEl.innerHTML = '';
    overviewTotalEl = document.createElement('div');
    overviewTotalEl.className = 'ov-total';
    overviewEl.appendChild(overviewTotalEl);
    THEMES.forEach((t) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'ov-row';
      row.innerHTML = '<span class="ov-main"><span class="ov-name"></span>'
        + '<span class="ov-meta"></span></span><span class="ov-rate"></span>';
      row.addEventListener('click', () => {
        if (!unlockedFor(t) || state.activeTheme === t.id) return;
        state.activeTheme = t.id;
        state.activeRoomIndex = Math.min(state.activeRoomIndex, activeRooms().length - 1);
        rebuildPlan();
        renderScene();
        renderInventory();
        refreshThemeRow();
        refreshSynergyText();
        refreshRoomActions();
        refreshShopUI();
        scrollToRoom(state.activeRoomIndex);
        save();
      });
      overviewEl.appendChild(row);
      overviewRows[t.id] = {
        root: row,
        name: row.querySelector('.ov-name'),
        meta: row.querySelector('.ov-meta'),
        rate: row.querySelector('.ov-rate'),
      };
    });
  }
  function refreshOverview() {
    if (!overviewEl) return;
    let places = 0;
    let pieces = 0;
    THEMES.forEach((t) => {
      const els = overviewRows[t.id];
      if (!els) return;
      const rooms = state.themeRooms[t.id] || [];
      const unlocked = unlockedFor(t);
      const open = chainHasDesk(rooms);
      const placed = rooms.reduce((n, r) => n + r.layout.filter(Boolean).length, 0);
      const rate = open ? rooms.reduce(
        (sum, room, i) => sum + computeGps(room, roomShapeFor(t.id, i)), 0) : 0;
      if (open) places++;
      pieces += placed;
      const meta = !unlocked ? 'Locked until level ' + t.unlockLevel
        : !open ? 'Closed -- needs a Customer Desk'
          : rooms.length + (rooms.length === 1 ? ' room, ' : ' rooms, ') + placed
            + (placed === 1 ? ' piece' : ' pieces');
      setText(els.name, t.name + (state.activeTheme === t.id ? ' (here)' : ''));
      setText(els.meta, meta);
      setText(els.rate, unlocked && open ? formatNum(rate) + '/s' : '');
      els.meta.classList.toggle('is-shut', unlocked && !open);
      els.root.classList.toggle('is-active', state.activeTheme === t.id);
      els.root.classList.toggle('is-locked', !unlocked);
      els.root.disabled = !unlocked;
    });
    setText(overviewTotalEl, places + (places === 1 ? ' location open' : ' locations open')
      + ' · ' + pieces + (pieces === 1 ? ' piece on the floor' : ' pieces on the floor')
      + ' · ' + formatNum(gps) + '/s');
  }
  // Writing the same string back into the DOM ten times a second is a lot of
  // needless layout work, so nothing is written unless it changed.
  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  // ---- Init ----
  buildTabs();
  buildOverview();
  buildShop();
  buildShopFilter();
  buildThemeRow();
  buildRoomActions();
  buildStaffUI();
  buildTrophyUI();
  refreshCounterUI();
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
  refreshTrophyUI();
  refreshNextStep();
  refreshLevelCard();
  refreshPromoUI();
  tickRushOrder();
  refreshRushOrderUI();
  promoWasRunning = promoRunning();
  // Straight away rather than on the first tick, so a save that already
  // qualifies for something opens showing it rather than winning it a
  // second and a half after the page settles.
  checkTrophies(true);

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
      // The hour tints the site as well as the gym.
      queueGroundPaint();
      membersKey = '';
    }

    // An open day ends on its own, so the tick has to notice: the rate goes
    // back down and the crowd it drew in goes home.
    const promoOn = promoRunning();
    if (promoOn !== promoWasRunning) {
      promoWasRunning = promoOn;
      recomputeStats();
      membersKey = '';
      renderScene();
    }
    refreshPromoUI();

    earnTick(dt);
    refreshHud();
    refreshJobsUI();
    refreshShopUI();
    refreshStaffUI();
    refreshCounterUI();
    refreshFranchiseUI();
    refreshThemeRow();
    refreshRoomActions();
    tickRushOrder();
    refreshRushOrderUI();
    refreshJobsDot();
    refreshNextStep();
    refreshLevelCard();
    refreshOverview();
    checkTrophies();

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
    if (members.length) {
      stepMembers(dt);
      paintScene();
      lastBatchPaint = now;
      return;
    }
    // Nobody in, but a counter's queue bar still has to creep along. It gets
    // one repaint a second rather than the crowd's twenty: the bar moves a
    // pixel a minute and an empty gym is meant to cost nothing.
    if (now - lastBatchPaint > 1000 && anyQueueHere()) {
      lastBatchPaint = now;
      paintScene();
    }
  }
  let lastBatchPaint = 0;
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
