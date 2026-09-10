(function () {
  const hudTotal = document.getElementById('hud-total');
  if (!hudTotal) return;

  const SAVE_KEY = 'gymTycoonSave';
  const COST_GROWTH = 1.15;
  const TICK_MS = 100;

  const ITEMS = [
    // The first thing on any floor. Every location needs one before it takes
    // a cent or sells you anything. It is free, it goes straight from the
    // Shop into your hands, and it earns nothing: it opens the doors.
    { id: 'frontdesk', name: 'Customer Desk', baseCost: 2500, gps: 0, starter: true },

    // Gym equipment. The only things in the game that earn money.
    { id: 'dumbbell', name: 'Dumbbell Set', baseCost: 25, gps: 0.1 },
    { id: 'dumbbellrack', name: 'Dumbbell Rack', baseCost: 60, gps: 0.22 },
    { id: 'mat', name: 'Yoga Mat', baseCost: 100, gps: 0.5 },
    { id: 'bench', name: 'Bench Press', baseCost: 320, gps: 2 },
    { id: 'rack', name: 'Squat Rack', baseCost: 1200, gps: 8 },
    { id: 'cable', name: 'Cable Machine', baseCost: 4500, gps: 30 },
    { id: 'treadmill', name: 'Treadmill', baseCost: 15000, gps: 100 },
    { id: 'rower', name: 'Rowing Machine', baseCost: 50000, gps: 350, unlockLevel: 3 },
    { id: 'sauna', name: 'Sauna', baseCost: 220000, gps: 1500, unlockLevel: 4 },
    { id: 'boxingring', name: 'Boxing Ring', baseCost: 900000, gps: 6000, unlockLevel: 4 },
    { id: 'climbingwall', name: 'Climbing Wall', baseCost: 3600000, gps: 25000, unlockLevel: 6 },
    { id: 'stairclimber', name: 'Stair Climber', baseCost: 14000000, gps: 100000, unlockLevel: 7 },
    { id: 'cryo', name: 'Cryo Chamber', baseCost: 56000000, gps: 400000, unlockLevel: 8 },


    // Decor. None of it earns a cent, and every piece takes floor a machine
    // could have had. Each one does one thing, and the thing is different:
    // some work on the room they stand in, some on the whole gym. A room
    // effect stacks, up to a cap; a gym effect counts once, however many
    // you own.
    { id: 'palm', name: 'Potted Palm', baseCost: 1400, unlockLevel: 2,
      effect: { kind: 'vibe', amount: 2 } },
    { id: 'cooler', name: 'Water Cooler', baseCost: 11000, unlockLevel: 3,
      effect: { kind: 'cap', amount: 0.25, max: 1 } },
    { id: 'mirrorwall', name: 'Mirror Wall', baseCost: 130000, unlockLevel: 4,
      effect: { kind: 'rush', amount: 0.5, max: 1 } },
    { id: 'gearfridge', name: 'Gear Fridge', baseCost: 900000, unlockLevel: 5,
      effect: { kind: 'stock', amount: 0.3, max: 0.6 } },
    { id: 'neon', name: 'Neon Sign', baseCost: 1700000, unlockLevel: 6,
      effect: { kind: 'promo', amount: 0.5, gym: true } },
    { id: 'soundsystem', name: 'Hype Sound System', baseCost: 3600000, unlockLevel: 7,
      effect: { kind: 'floor', amount: 0.45, max: 0.45 } },
    { id: 'desk', name: "Manager's Desk", baseCost: 14000000, unlockLevel: 8,
      effect: { kind: 'wages', amount: 0.25, gym: true } },
    { id: 'cubicle', name: 'Sales Cubicle', baseCost: 56000000, unlockLevel: 9,
      effect: { kind: 'jobs', amount: 0.25, gym: true } },
    { id: 'officepod', name: 'Corner Office Pod', baseCost: 220000000, unlockLevel: 10,
      effect: { kind: 'cashiers', amount: 1, gym: true } },

    // The counters close the list. They are decoration as well -- they earn
    // nothing standing there -- but they also make stock for the delivery
    // orders on the Jobs tab, so they read as the last and biggest thing a
    // room can have rather than the first.
    { id: 'juicebar', name: 'Juice Bar', baseCost: 36000, unlockLevel: 3,
      effect: { kind: 'room', amount: 0.15, max: 0.15 } },
    { id: 'proshop', name: 'Pro Shop', baseCost: 2200000, unlockLevel: 7,
      effect: { kind: 'xp', amount: 0.25, gym: true } },
  ];
  // Gains per second is the headline number on every piece of gear, and a
  // fitting has none. Rather than scatter `item.gps || 0` through the
  // earnings, the shop and the jobs, they are given a zero here.
  ITEMS.forEach((item) => { if (typeof item.gps !== 'number') item.gps = 0; });
  function isDecor(id) {
    const item = itemById(id);
    return !!(item && item.effect);
  }
  // One of each fitting per room. Two Water Coolers in one room were never
  // twice as good -- the caps saw to that -- they were just the cheapest way
  // to fill a room with the same thing. The Potted Palm is the exception,
  // because a room full of plants is a look.
  const CROWDABLE = { palm: true };
  // And a cap per location on the big machines. A gym with four boxing
  // rings in it is not a gym, and the cheapest way to a big number was
  // always to fill every room with whatever earned most. One ring to a
  // location; the rest of the top end is two. Everything not named here is
  // unlimited, which is most of the shop.
  const MAX_PER_LOCATION = {
    boxingring: 1,
    climbingwall: 1,
    cryo: 1,
    proshop: 1,
    sauna: 2,
    stairclimber: 2,
    juicebar: 2,
  };
  function maxPerLocation(itemId) {
    return MAX_PER_LOCATION[itemId] || 0;
  }
  function placedInTheme(themeId, itemId) {
    return (state.themeRooms[themeId] || []).reduce(
      (sum, room) => sum + room.layout.filter((x) => x === itemId).length, 0);
  }
  // Whether this location already has as many of a piece as it may have.
  function locationFull(themeId, itemId) {
    const cap = maxPerLocation(itemId);
    return cap > 0 && placedInTheme(themeId, itemId) >= cap;
  }
  function onePerRoom(id) {
    return isDecor(id) && !CROWDABLE[id];
  }
  function roomAlreadyHas(room, itemId) {
    if (!room || !onePerRoom(itemId)) return false;
    return room.layout.some((id) => id === itemId);
  }
  // What a piece of decor does, in one line, for the shop row and the
  // Storage chip. Written once here so the two never disagree.
  const EFFECT_TEXT = {
    vibe: (a) => ['+' + Math.round(a * VIBE_PER_POINT * 100) + '% vibe for its room',
      '+' + Math.round(a * VIBE_PER_POINT * 100) + '% vibe'],
    cap: (a) => ['Bubbles in its room hold ' + Math.round(a * 100) + '% more',
      'bubbles +' + Math.round(a * 100) + '%'],
    rush: (a) => ['Busy hours pay ' + Math.round(a * 100) + '% more in its room',
      'busy hours +' + Math.round(a * 100) + '%'],
    stock: (a) => ['Counters in its room make stock ' + Math.round(a * 100) + '% faster',
      'stock ' + Math.round(a * 100) + '% faster'],
    promo: (a) => ['Promo lasts ' + Math.round(a * 100) + '% longer', 'promo +' + Math.round(a * 100) + '%'],
    floor: () => ['Its room is never Quiet', 'never quiet'],
    wages: (a) => ['Wages ' + Math.round(a * 100) + '% lower', 'wages -' + Math.round(a * 100) + '%'],
    jobs: (a) => ['Jobs pay ' + Math.round(a * 100) + '% more', 'jobs +' + Math.round(a * 100) + '%'],
    cashiers: (a) => [(a === 1 ? 'One more cashier' : a + ' more cashiers') + ' in every room',
      '+' + a + ' cashier'],
    room: (a) => ['Everything in its room earns +' + Math.round(a * 100) + '%',
      'room +' + Math.round(a * 100) + '%'],
    xp: (a) => ['Everything earns ' + Math.round(a * 100) + '% more XP',
      'XP +' + Math.round(a * 100) + '%'],
  };
  function effectLine(item, short) {
    if (!item || !item.effect) return '';
    const pair = EFFECT_TEXT[item.effect.kind](item.effect.amount);
    return short ? pair[1] : pair[0];
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
  // Decor used to earn money and the office tier used to be gym equipment.
  // Both now do something else instead, and any tier bought for one of them
  // is meaningless -- so a save carrying one is quietly cleared rather than
  // left multiplying a rate that no longer exists.
  function dropDeadTiers(tiers) {
    if (!tiers) return tiers;
    Object.keys(tiers).forEach((id) => {
      const item = itemById(id);
      // The desk is the exception: it earns nothing and its mark is still
      // worth keeping, because the bubble cap is read off it.
      if (item && item.starter) return;
      if (!item || item.effect || item.gps <= 0) delete tiers[id];
    });
    return tiers;
  }

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
    rower: '<rect x="3" y="11" width="18" height="2.2" rx="1.1"/><rect x="9" y="8.4" width="4.6" height="2.6" rx="1"/><circle cx="4.6" cy="15.4" r="3.4"/><rect x="16.4" y="14.4" width="2.2" height="5.4" rx="1"/><rect x="8" y="5.6" width="7.6" height="1.9" rx="0.95"/>',
    boxingring: '<rect x="2.4" y="7" width="19.2" height="10.6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="2.4" y="10.4" width="19.2" height="1.5"/><rect x="2.4" y="13.6" width="19.2" height="1.5"/><rect x="1.6" y="4.6" width="2.6" height="15.4" rx="1.1"/><rect x="19.8" y="4.6" width="2.6" height="15.4" rx="1.1"/>',
    climbingwall: '<rect x="4.4" y="1.8" width="15.2" height="20.4" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="9" cy="6.4" r="1.6"/><circle cx="15.2" cy="9.6" r="1.6"/><circle cx="8.4" cy="13.4" r="1.6"/><circle cx="15" cy="17.4" r="1.6"/>',
    stairclimber: '<rect x="3" y="17.4" width="7.4" height="3" rx="1.2"/><rect x="5.6" y="13" width="7.4" height="3" rx="1.2"/><rect x="15.4" y="3" width="2.8" height="17.4" rx="1.2"/><rect x="10.4" y="5.4" width="8.4" height="2.6" rx="1.2"/>',
    cryo: '<rect x="6" y="3.4" width="12" height="17.2" rx="3.4" fill="none" stroke="currentColor" stroke-width="1.9"/><rect x="9" y="7" width="6" height="9.4" rx="1.6"/><path d="M12 1.2v2M9.4 22.4h5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
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
    { id: 'rooftop', name: 'Rooftop', unlockLevel: 10 },
    // The far end of the ladder. Nothing else unlocks past level ten, and
    // forty levels of nothing to look forward to is a long way to walk.
    { id: 'boardwalk', name: 'Boardwalk', unlockLevel: 15 },
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
  // Every location is one open floor -- the hub -- with three rooms opening
  // off it, so a whole gym can be taken in at a glance and any walk between
  // two rooms crosses the floor everyone shares. Room 1 is the hub; the
  // rooms after it are set against the hub's edges in the order they are
  // bought (`dirs`), each centred on its edge and slid along it by `shift`,
  // which is what leaves the hub a free end to spread out into.
  const ROOM_PLANS = {
    // Three bays round a workshop floor, which runs on down-right past them.
    garage: {
      hub: true,
      shapes: [
        { cols: 30, rows: 18 },
        { cols: 14, rows: 18 },
        { cols: 20, rows: 13, shift: -5 },
        { cols: 18, rows: 15, shift: -6 },
      ],
      caps: [16, 14, 15, 18],
      dirs: ['west', 'north', 'south'],
      corridorLen: 3,
      corridorWidth: 11,
    },
    // A long cellar floor with rooms off its top and right, running on
    // down-left to the drain.
    basement: {
      hub: true,
      shapes: [
        { cols: 18, rows: 30 },
        { cols: 16, rows: 16, shift: -7 },
        { cols: 18, rows: 14 },
        { cols: 16, rows: 16 },
      ],
      caps: [16, 14, 15, 18],
      dirs: ['west', 'north', 'east'],
      corridorLen: 3,
      corridorWidth: 10,
    },
    // Open deck: three terraces off the main roof, joined by walkways wide
    // enough to read as outdoors. Both the outdoor locations are laid out
    // larger than the two indoor ones and stand further apart, with long
    // walkways between the terraces: a roof and a pier are places you can
    // see across, and cramming them to the same size as a workshop and a
    // cellar threw that away.
    rooftop: {
      hub: true,
      shapes: [
        { cols: 38, rows: 24 },
        { cols: 18, rows: 24 },
        { cols: 24, rows: 16, shift: -8 },
        { cols: 21, rows: 19, shift: -9 },
      ],
      caps: [16, 14, 16, 19],
      dirs: ['west', 'north', 'south'],
      corridorLen: 8,
      corridorWidth: 12,
    },
    // A pier, laid out like a pier rather than like the roof: a long
    // promenade running out over the water, with a sun deck hung off the
    // seaward side of it near the far end, a smaller sheltered deck off
    // the landward side near the shore, and the pier head square across
    // the end of the walk. Nothing about it is symmetrical, and the three
    // decks stand at three different distances off the promenade, which
    // is what stops it reading as the same cross as every other location.
    boardwalk: {
      hub: true,
      shapes: [
        { cols: 48, rows: 15 },
        { cols: 24, rows: 20, shift: 8, gap: 7 },
        { cols: 20, rows: 17, shift: -12, gap: 5 },
        { cols: 22, rows: 24, gap: 4 },
      ],
      caps: [16, 14, 16, 18],
      dirs: ['north', 'south', 'east'],
      corridorLen: 6,
      corridorWidth: 11,
    },
  };

  // ---- Locations ----
  // What each location is built of, over and above its colours: what the
  // edge of a floor is (a wall to hang things on, or a railing you see
  // over), what its floor is paved with, what kind of light it has, and
  // what is built onto its floors before any gear goes down.
  const THEME_STYLE = {
    garage: { edge: 'wall', light: 'tube', plate: 3 },
    basement: { edge: 'wall', light: 'sconce', plate: 3, planks: true },
    rooftop: { edge: 'rail', light: 'rail', plate: 4 },
    boardwalk: { edge: 'rail', light: 'rail', plate: 3, planks: true },
  };
  function styleOf(theme) {
    return THEME_STYLE[theme] || THEME_STYLE.garage;
  }
  function railed(theme) {
    return styleOf(theme).edge === 'rail';
  }

  // A repeatable number in [0, 1) for a place on the lattice, so the
  // scenery is the same scenery on every repaint and in every session.
  function noise(a, b, c) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)
      + Math.imul((c || 0) | 0, 1274126177)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    h = (h ^ (h >>> 16)) >>> 0;
    return h / 4294967296;
  }

  // The things a location builds onto a floor before any gear goes down: a
  // stair housing on a roof, a snack stand on a pier, a planter on the
  // railing. Each stands in a box of tiles measured from the room's back
  // corner, which the gear then has to keep out of. A planter sits on an
  // edge with its front half over the floor, so its box is that half.
  const ROOM_FIXTURES = {
    rooftop: [
      [{ kind: 'stairs', u0: 33, v0: 0, u1: 38, v1: 4 }, { kind: 'ac', u0: 28, v0: 0, u1: 30.5, v1: 2 },
        { kind: 'planter', u0: 15, v0: 0, u1: 16.2, v1: 0.6 }, { kind: 'planter', u0: 21, v0: 0, u1: 22.2, v1: 0.6 },
        { kind: 'planter', u0: 0, v0: 18, u1: 0.6, v1: 19.2 }],
      [{ kind: 'stairs', u0: 0, v0: 0, u1: 4, v1: 3 }, { kind: 'ac', u0: 15, v0: 0, u1: 17.5, v1: 2 },
        { kind: 'planter', u0: 9, v0: 0, u1: 10.2, v1: 0.6 }, { kind: 'planter', u0: 0, v0: 11, u1: 0.6, v1: 12.2 },
        { kind: 'planter', u0: 0, v0: 19, u1: 0.6, v1: 20.2 }],
      [{ kind: 'stairs', u0: 0, v0: 0, u1: 4, v1: 3 }, { kind: 'ac', u0: 0, v0: 12, u1: 2.5, v1: 14 },
        { kind: 'planter', u0: 10, v0: 0, u1: 11.2, v1: 0.6 }, { kind: 'planter', u0: 17, v0: 0, u1: 18.2, v1: 0.6 },
        { kind: 'planter', u0: 0, v0: 7, u1: 0.6, v1: 8.2 }],
      [{ kind: 'stairs', u0: 17, v0: 0, u1: 21, v1: 3 }, { kind: 'ac', u0: 17, v0: 3.6, u1: 19.5, v1: 5.6 },
        { kind: 'planter', u0: 0, v0: 6, u1: 0.6, v1: 7.2 }, { kind: 'planter', u0: 0, v0: 13, u1: 0.6, v1: 14.2 }],
    ],
    boardwalk: [
      // The promenade: tubs down the seaward rail at even intervals, the
      // way a pier walk is planted.
      [{ kind: 'planter', u0: 7, v0: 0, u1: 8.2, v1: 0.6 }, { kind: 'planter', u0: 16, v0: 0, u1: 17.2, v1: 0.6 },
        { kind: 'planter', u0: 25, v0: 0, u1: 26.2, v1: 0.6 }, { kind: 'planter', u0: 34, v0: 0, u1: 35.2, v1: 0.6 },
        { kind: 'planter', u0: 43, v0: 0, u1: 44.2, v1: 0.6 }, { kind: 'planter', u0: 0, v0: 9, u1: 0.6, v1: 10.2 }],
      // The sun deck, with the snack stand in its landward corner.
      [{ kind: 'kiosk', sign: 'SNACKS', u0: 0, v0: 0, u1: 5, v1: 4 },
        { kind: 'planter', u0: 11, v0: 0, u1: 12.2, v1: 0.6 }, { kind: 'planter', u0: 18, v0: 0, u1: 19.2, v1: 0.6 },
        { kind: 'planter', u0: 0, v0: 9, u1: 0.6, v1: 10.2 }, { kind: 'planter', u0: 0, v0: 15, u1: 0.6, v1: 16.2 }],
      // The sheltered deck by the shore: more planting, no stand.
      [{ kind: 'planter', u0: 5, v0: 0, u1: 6.2, v1: 0.6 }, { kind: 'planter', u0: 11, v0: 0, u1: 12.2, v1: 0.6 },
        { kind: 'planter', u0: 16, v0: 0, u1: 17.2, v1: 0.6 }, { kind: 'planter', u0: 0, v0: 5, u1: 0.6, v1: 6.2 },
        { kind: 'planter', u0: 0, v0: 11, u1: 0.6, v1: 12.2 }],
      // The pier head, with the beach shop across the seaward corner.
      [{ kind: 'kiosk', sign: 'BEACH SHOP', u0: 16, v0: 0, u1: 21, v1: 4 },
        { kind: 'planter', u0: 6, v0: 0, u1: 7.2, v1: 0.6 }, { kind: 'planter', u0: 0, v0: 8, u1: 0.6, v1: 9.2 },
        { kind: 'planter', u0: 0, v0: 16, u1: 0.6, v1: 17.2 }],
    ],
  };
  function fixturesFor(themeId, index) {
    const list = ROOM_FIXTURES[themeId];
    return list ? list[index % list.length] || [] : [];
  }
  const FIXTURE_NAMES = { stairs: 'stairs', ac: 'air unit', planter: 'planter', kiosk: 'stand' };
  // The fixture a piece at this spot would stand in, or null.
  function fixtureAt(shape, itemId, spot, turn) {
    const h = halfBoxOf(itemId, turn || 0);
    const hit = (shape.fixtures || []).find((f) => boxMeetsRect(spot, h,
      { gx0: f.u0, gy0: f.v0, cols: f.u1 - f.u0, rows: f.v1 - f.v0 }));
    return hit ? hit.kind : null;
  }

  function planFor(themeId) {
    return ROOM_PLANS[themeId] || ROOM_PLANS.garage;
  }
  function roomShapeFor(themeId, index) {
    const shapes = planFor(themeId).shapes;
    const shape = shapes[index % shapes.length];
    // With whatever the location has built onto that floor, which the gear
    // has to keep out of (see ROOM_FIXTURES).
    return Object.assign({}, shape, { fixtures: fixturesFor(themeId, index) });
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
    if (!inRect(r, gx, gy)) return false;
    const c = cutRect(r);
    if (c && inRect(c, gx, gy)) return false;
    // Nor inside anything the location built onto the floor.
    const u = gx - r.gx0;
    const v = gy - r.gy0;
    return !(r.fixtures || []).some((f) => u >= f.u0 && u < f.u1 && v >= f.v0 && v < f.v1);
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

  // Tile rectangles for `count` rooms: the hub first, then each room set
  // against the hub with a doorway's worth of space between them.
  function roomDirFor(themeId, step) {
    const dirs = planFor(themeId).dirs;
    return dirs[step % dirs.length];
  }
  // The room a hallway leaves from to reach room `index`: the hub on a hub
  // plan, the room before it on a chain.
  function hallwayFrom(themeId, placementsOf, index) {
    return planFor(themeId).hub ? placementsOf[0] : placementsOf[index - 1];
  }
  function isHubAt(themeId, index) {
    return !!planFor(themeId).hub && index === 0;
  }
  function hubRect() {
    return planFor(state.activeTheme).hub ? placements[0] || null : null;
  }

  function roomPlacements(themeId, count) {
    const plan = planFor(themeId);
    const out = [];
    for (let i = 0; i < count; i++) {
      const shape = roomShapeFor(themeId, i);
      if (i === 0) {
        out.push({ gx0: 0, gy0: 0, cols: shape.cols, rows: shape.rows, cut: shape.cut || null, fixtures: shape.fixtures });
        continue;
      }
      // Off the hub on a hub plan, off the room before it otherwise.
      const prev = plan.hub ? out[0] : out[i - 1];
      const dir = roomDirFor(themeId, i - 1);
      const shift = shape.shift || 0;
      // How long the walkway to this one is. A location can give a shape
      // its own gap, so the pieces of it need not all stand the same
      // distance off the middle.
      const gap = shape.gap == null ? plan.corridorLen : shape.gap;
      let gx0;
      let gy0;
      if (dir === 'east') {
        gx0 = prev.gx0 + prev.cols + gap;
        gy0 = prev.gy0 + Math.round((prev.rows - shape.rows) / 2) + shift;
      } else if (dir === 'west') {
        gx0 = prev.gx0 - gap - shape.cols;
        gy0 = prev.gy0 + Math.round((prev.rows - shape.rows) / 2) + shift;
      } else if (dir === 'north') {
        gy0 = prev.gy0 - gap - shape.rows;
        gx0 = prev.gx0 + Math.round((prev.cols - shape.cols) / 2) + shift;
      } else {
        gy0 = prev.gy0 + prev.rows + gap;
        gx0 = prev.gx0 + Math.round((prev.cols - shape.cols) / 2) + shift;
      }
      out.push({ gx0, gy0, cols: shape.cols, rows: shape.rows, cut: shape.cut || null, fixtures: shape.fixtures });
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
  // same category placed close together boosts each other. Decor is one
  // category, whatever it does, and it takes no part in that.
  const CATEGORY = {
    dumbbell: 'strength', dumbbellrack: 'strength', bench: 'strength', rack: 'strength', cable: 'strength',
    boxingring: 'strength', climbingwall: 'strength',
    treadmill: 'cardio', rower: 'cardio', stairclimber: 'cardio',
    juicebar: 'decor', proshop: 'decor',
    mat: 'recovery', sauna: 'recovery', cryo: 'recovery',
    frontdesk: 'front',
    palm: 'decor', cooler: 'decor', mirrorwall: 'decor', gearfridge: 'decor', neon: 'decor',
    soundsystem: 'decor', desk: 'decor', cubicle: 'decor', officepod: 'decor',
  };
  const CATEGORY_META = {
    strength: { name: 'Strength', color: '#c0483a' },
    cardio: { name: 'Cardio', color: '#3fa0c9' },
    recovery: { name: 'Recovery', color: '#3fa87e' },
    front: { name: 'Front of house', color: '#e8b04b' },
    decor: { name: 'Decor', color: '#4fc38a' },
  };
  const SAME_CATEGORY_BONUS = 0.12;

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
  // Experience, wherever it comes from, with whatever is lifting it. A Pro
  // Shop anywhere in the gym pays a quarter more on everything.
  function addXp(n) {
    state.xp = (state.xp || 0) + n * (1 + gymEffect('xp'));
  }
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

  // ---- What a level is worth ----
  // Nothing new came into the shop past level ten, and the last location
  // opened at fifteen, so the bar filled for nothing for most of its
  // length. Every level brings something now. From eleven up, each one is
  // two percent on everything -- the gym's reputation, which is what a
  // well-known place charges for -- and the milestones widen what the gym
  // can hold: more jobs on the board, a bigger larder, another Cashier to
  // a room, busier busy hours, a shorter wait for the next Open Day.
  const REPUTATION_FROM_LEVEL = 10;
  const REPUTATION_PER_LEVEL = 0.02;
  const LEVEL_PERKS = [
    { level: 12, kind: 'jobs', amount: 1, text: 'a fourth job on the board' },
    { level: 14, kind: 'larder', amount: 15, text: 'a larder that holds 40' },
    { level: 15, kind: 'promopower', amount: 0.5, text: 'an Open Day worth x3' },
    { level: 16, kind: 'promo', amount: 300, text: 'an Open Day every 10 minutes' },
    { level: 18, kind: 'cashiers', amount: 1, text: 'one more Cashier to a room' },
    { level: 20, kind: 'rush', amount: 0.10, text: 'busy hours paying 30% more' },
    { level: 21, kind: 'promolong', amount: 0.5, text: 'an Open Day half again as long' },
    { level: 22, kind: 'larder', amount: 10, text: 'a larder that holds 50' },
    { level: 24, kind: 'staff', amount: 1, text: 'one more of every kind of staff' },
    { level: 25, kind: 'jobs', amount: 1, text: 'a fifth job on the board' },
    { level: 28, kind: 'promo', amount: 240, text: 'an Open Day every 6 minutes' },
    { level: 26, kind: 'promopower', amount: 0.5, text: 'an Open Day worth x3.5' },
    { level: 30, kind: 'larder', amount: 10, text: 'a larder that holds 60' },
    { level: 33, kind: 'rush', amount: 0.10, text: 'busy hours paying 40% more' },
    { level: 35, kind: 'cashiers', amount: 1, text: 'one more Cashier to a room' },
    { level: 37, kind: 'staff', amount: 1, text: 'one more of every kind of staff again' },
    { level: 40, kind: 'reputation', amount: 0.20, text: 'another 20% on everything, for good' },
  ];
  // The perks of one kind that a level has earned, added up. Asked with a
  // level for the copy that says what a level will bring; without one for
  // the game as it stands.
  function levelPerk(kind, level) {
    const at = level === undefined ? currentLevel() : level;
    return LEVEL_PERKS.filter((perk) => perk.kind === kind && at >= perk.level)
      .reduce((sum, perk) => sum + perk.amount, 0);
  }
  function reputationBonus(level) {
    const at = level === undefined ? currentLevel() : level;
    return Math.max(0, at - REPUTATION_FROM_LEVEL) * REPUTATION_PER_LEVEL
      + levelPerk('reputation', at);
  }
  function reputationMultiplier() {
    return 1 + reputationBonus();
  }
  // Everything one level brings, in words, for the level-up line and the
  // card that says what the next one is for.
  function levelBrings(level) {
    const opened = ITEMS.filter((i) => i.unlockLevel === level).map((i) => i.name)
      .concat(THEMES.filter((t) => t.unlockLevel === level).map((t) => t.name))
      .concat(STAFF_ROLES.filter((r) => r.unlockLevel === level).map((r) => r.name + 's'))
      .concat(level === UPGRADE_MIN_LEVEL ? ['upgrades'] : [])
      .concat(level === RUSH_ORDER_MIN_LEVEL ? ['rush orders'] : [])
      .concat(LEVEL_PERKS.filter((perk) => perk.level === level).map((perk) => perk.text));
    if (level > REPUTATION_FROM_LEVEL) {
      opened.push('+' + Math.round(REPUTATION_PER_LEVEL * 100) + '% on everything'
        + (level === REPUTATION_FROM_LEVEL + 1 ? ' (reputation: every level from here adds it)' : ''));
    }
    return opened;
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
    rower: [2.10, 0.62], boxingring: [2.60, 2.60], climbingwall: [0.60, 2.40],
    stairclimber: [1.10, 0.90], cryo: [1.10, 1.10],
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
    rower: ['+u', 0.70], boxingring: ['+v', 0.70], climbingwall: ['+u', 1.00],
    stairclimber: ['+u', 0.80], cryo: ['+v', 0.80],
    juicebar: ['+v', 0.85], proshop: ['+v', 0.85],
    desk: ['+v', 0.80], cubicle: ['+v', 0.70], officepod: ['+v', 0.80], frontdesk: ['+v', 0.90],
  };
  // Which pieces are used from the zone, standing, rather than from on top
  // of the piece itself.
  const USED_FROM_ZONE = { cable: true, dumbbell: true, dumbbellrack: true, gearfridge: true,
    sauna: true, desk: true, cubicle: true, officepod: true, frontdesk: true,
    juicebar: true, proshop: true, climbingwall: true, cryo: true };

  // What the two counter pieces make, and how much of it you can keep. The
  // rest of the counter is further down with the jobs it feeds; this much is
  // up here because reading a save asks what a product is.
  const QUEUE_SLOTS = 3;
  const LARDER_CAP = 25;
  const LARDER_CAP_MAX = 60;
  function larderCap() {
    return Math.min(LARDER_CAP_MAX, LARDER_CAP + levelPerk('larder'));
  }
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
    if (c && boxMeetsRect(spot, halfBoxOf(itemId, turn || 0), c)) return true;
    return fixtureAt(shape, itemId, spot, turn) !== null;
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
        if (nCat === cat && nCat !== 'decor') mult[i] += SAME_CATEGORY_BONUS;
      }
    }
    return mult;
  }

  // Per-slot multiplier from adjacent gear: +12% for each neighbour of the
  // same category.

  // ---- Room goals ----
  // The arrangement bonus is a few percent for standing like beside like,
  // which is not enough to make anyone think about a room: a carefully
  // planned floor earned about what a randomly filled one did, and the
  // dragging and turning existed to serve nothing. Two goals a whole room
  // can meet, each worth a real slice, and each said in the room details
  // with what is missing when it is not met:
  //
  //   A specialist room: four or more machines and every one of them the
  //   same kind -- a cardio room, a weights room, a recovery suite.
  //
  //   Easy to get around: three or more machines and every one of them can
  //   be walked to from the door without squeezing between anything. That
  //   is a real walk on a grid of the floor, not a guess: a machine whose
  //   step-on floor is boxed in by its neighbours fails it, which is the
  //   blind-corner layout that looks fine and is not.
  const SPECIALIST_MIN = 4;
  const SPECIALIST_BONUS = 0.15;
  const CLEAR_WALK_MIN = 3;
  const CLEAR_WALK_BONUS = 0.10;
  // The floor is walked on a grid of half tiles, and a point on it is
  // standing room only if it is this far from every piece: a passage
  // narrower than about half a metre is not a passage.
  const WALK_CELL = 0.5;
  const WALK_CLEAR = 0.6;

  // Which theme a room belongs to and where it stands in the chain, found
  // by identity: the rooms are the saved objects themselves.
  function whereIs(room) {
    for (let t = 0; t < THEMES.length; t++) {
      const rooms = state.themeRooms[THEMES[t].id] || [];
      const i = rooms.indexOf(room);
      if (i !== -1) return { themeId: THEMES[t].id, index: i, count: rooms.length };
    }
    return null;
  }

  // The doorways into a room from the hallways, on its two back walls, as
  // spans in the room's own tiles. The open front is always a way in.
  function roomDoors(themeId, index, count) {
    const doors = [];
    if (count < 2) return doors;
    const pl = roomPlacements(themeId, count);
    const me = pl[index];
    // The hub has no walls: it is walked onto from every side.
    if (isHubAt(themeId, index)) {
      doors.push({ wall: 'u0', from: 0, to: me.rows }, { wall: 'v0', from: 0, to: me.cols });
      return doors;
    }
    for (let k = 0; k + 1 < count; k++) {
      const c = corridorBetween(themeId, hallwayFrom(themeId, pl, k + 1), pl[k + 1], roomDirFor(themeId, k));
      if (c.doorRoom !== me) continue;
      if (c.axis === 'gx') doors.push({ wall: 'u0', from: c.gy0 - me.gy0, to: c.gy0 + c.rows - me.gy0 });
      else doors.push({ wall: 'v0', from: c.gx0 - me.gx0, to: c.gx0 + c.cols - me.gx0 });
    }
    return doors;
  }

  // Every machine in the room that has step-on floor, with where it stands,
  // and whether each can be reached. A walk from the doors and the open
  // front across every half tile that is clear of every piece; a machine is
  // reached when the walk gets onto its step-on floor.
  function walkReach(room, shape, doors) {
    const cols = Math.ceil(shape.cols / WALK_CELL);
    const rows = Math.ceil(shape.rows / WALK_CELL);
    const cut = cutRect(shape);
    const boxes = [];
    const targets = [];
    room.layout.forEach((id, i) => {
      if (!id) return;
      const sp = spotOf(room, i, shape);
      const t = turnAt(room, i);
      boxes.push(boxRect(sp, halfBoxOf(id, t)));
      const item = itemById(id);
      const zone = accessZone(id, sp, t);
      if (item && item.gps > 0 && zone) targets.push({ id, index: i, zone, reached: false });
    });
    // What the location built there is in the way as much as any machine.
    (shape.fixtures || []).forEach((f) => boxes.push({ u0: f.u0, u1: f.u1, v0: f.v0, v1: f.v1 }));
    const clear = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const u = (i + 0.5) * WALK_CELL;
        const v = (j + 0.5) * WALK_CELL;
        if (u > shape.cols || v > shape.rows) continue;
        if (cut && inRect(cut, u, v)) continue;
        let free = true;
        for (let b = 0; b < boxes.length && free; b++) {
          const bx = boxes[b];
          if (u > bx.u0 - WALK_CLEAR && u < bx.u1 + WALK_CLEAR
            && v > bx.v0 - WALK_CLEAR && v < bx.v1 + WALK_CLEAR) free = false;
        }
        clear[j * cols + i] = free ? 1 : 0;
      }
    }
    // Where the walk starts: the cells along each doorway, and the whole of
    // the open front -- the two edges nearest you, which have no wall.
    const seen = new Uint8Array(cols * rows);
    const queue = [];
    const start = (i, j) => {
      if (i < 0 || j < 0 || i >= cols || j >= rows) return;
      const k = j * cols + i;
      if (!clear[k] || seen[k]) return;
      seen[k] = 1;
      queue.push(k);
    };
    doors.forEach((d) => {
      const lo = Math.floor(d.from / WALK_CELL);
      const hi = Math.ceil(d.to / WALK_CELL);
      for (let k = lo; k < hi; k++) {
        if (d.wall === 'u0') start(0, k); else start(k, 0);
      }
    });
    for (let i = 0; i < cols; i++) start(i, rows - 1);
    for (let j = 0; j < rows; j++) start(cols - 1, j);
    while (queue.length) {
      const k = queue.shift();
      const i = k % cols;
      const j = (k - i) / cols;
      const u = (i + 0.5) * WALK_CELL;
      const v = (j + 0.5) * WALK_CELL;
      targets.forEach((tg) => {
        if (!tg.reached && u > tg.zone.u0 && u < tg.zone.u1 && v > tg.zone.v0 && v < tg.zone.v1) tg.reached = true;
      });
      start(i + 1, j); start(i - 1, j); start(i, j + 1); start(i, j - 1);
    }
    return targets;
  }

  // What a room's layout is worth beyond the sum of its pieces, and why.
  // Remembered per layout, because the earnings ask ten times a second and
  // the walk is the one sum here that is not a handful of multiplications.
  const goalMemo = new Map();
  function roomGoals(room, shape) {
    const key = room.layout.join(',') + '|'
      + (room.spots || []).map((sp) => (sp ? sp.u + ',' + sp.v + ',' + (sp.r || 0) : '')).join(';')
      + '|' + shape.cols + 'x' + shape.rows;
    const at = whereIs(room);
    const fullKey = (at ? at.themeId + at.index + '/' + at.count : '?') + '#' + key;
    const hit = goalMemo.get(room);
    if (hit && hit.key === fullKey) return hit.goals;

    const machines = room.layout.filter((id) => id && itemById(id) && itemById(id).gps > 0);
    const kinds = [...new Set(machines.map((id) => CATEGORY[id]))];
    const specialist = machines.length >= SPECIALIST_MIN && kinds.length === 1;
    const targets = at
      ? walkReach(room, shape, roomDoors(at.themeId, at.index, at.count))
      : walkReach(room, shape, []);
    const stuck = targets.filter((t) => !t.reached);
    const clearWalk = targets.length >= CLEAR_WALK_MIN && stuck.length === 0;
    const goals = {
      specialist,
      kind: kinds.length === 1 ? kinds[0] : null,
      kinds,
      machines: machines.length,
      clearWalk,
      walkers: targets.length,
      stuck: stuck.map((t) => itemById(t.id).name),
      // Added, not compounded, so the header, the two lines and the rows in
      // the breakdown all say the same number.
      multiplier: 1 + (specialist ? SPECIALIST_BONUS : 0) + (clearWalk ? CLEAR_WALK_BONUS : 0),
    };
    goalMemo.set(room, { key: fullKey, goals });
    return goals;
  }
  function roomGoalMultiplier(room, shape) {
    return roomGoals(room, shape).multiplier;
  }

  // ---- Upgrades ----
  // A room has a fixed number of slots, so a gym that has filled its rooms
  // and bought every room it can has nowhere left to go: the shop still
  // sells things but there is nowhere to stand them. Upgrading fixes that.
  // It lifts every unit of a type at once, so it is worth more the more of
  // that type you have -- which makes the real question wide or tall. Wide
  // is more units and so more neighbours to earn synergy from; tall is
  // fewer, better ones. Slots are what make it a question at all.
  // Five marks rather than three. The gear ladder used to end at level 8,
  // where the last machine unlocks, leaving the rest of the levels with
  // nothing to spend on; two more marks carry it the rest of the way.
  const MAX_TIER = 5;
  const TIER_STEP = 2.2;
  const TIER_NAMES = ['', 'Mk I', 'Mk II', 'Mk III', 'Mk IV', 'Mk V'];
  // Any machine you own can be upgraded, from the first one you buy.
  const UPGRADE_MIN_LEVEL = 1;
  const UPGRADE_MIN_OWNED = 1;
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
  // The Customer Desk earns nothing, so it used to be the one thing in the
  // shop that could not be improved -- and the bubble cap, which is read
  // off its mark, was stuck at two minutes for the whole game as a result.
  // Its marks buy holding room instead of takings, which is what makes a
  // night away worth anything.
  function upgradeIsCap(id) {
    const item = itemById(id);
    return !!item && !!item.starter;
  }
  function canUpgrade(id) {
    const item = itemById(id);
    if (!item || item.effect) return false;
    if (!(item.gps > 0 || upgradeIsCap(id))) return false;
    return tierOf(id) < MAX_TIER
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
    addXp(xpForSpend(cost));
    sfx.thunk();
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
      max: 4,
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
      max: 3,
      note: (n) => 'busy-hour bonus +' + Math.round(staffEffect('receptionist', n) * 100) + '%',
    },
    {
      id: 'manager',
      name: 'Floor Manager',
      baseCost: 250000,
      unlockLevel: 7,
      first: 0.18,
      max: 3,
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
  // A Corner Office Pod anywhere in the gym adds one more to every room.
  // Three to a room, one more for a Corner Office Pod, and the levels add
  // their own. The clamp a save is read through uses the most this can be.
  const CASHIERS_PER_ROOM_MAX = 6;
  // How many of a role you may have. A cashier's cap is per room; the rest
  // are for the whole gym. Levels raise them, so a payroll grows with the
  // place rather than being one number for the whole game.
  function staffCap(id) {
    const role = staffRole(id);
    if (!role || role.perRoom) return 0;
    return (role.max || 0) + levelPerk('staff');
  }
  function staffFull(id) {
    const cap = staffCap(id);
    return cap > 0 && staffCount(id) >= cap;
  }
  function cashiersPerRoom() {
    return Math.min(CASHIERS_PER_ROOM_MAX,
      CASHIERS_PER_ROOM + gymEffect('cashiers') + levelPerk('cashiers'));
  }
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
    return Math.min(WAGE_SHARE_MAX, staffTotal() * WAGE_SHARE_EACH) * (1 - gymEffect('wages'));
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
  const RUSH_BONUS = 0.20;

  // ---- The gym's own clock ----
  // A day in the gym is an hour of real time, so the morning and evening
  // rushes come round while you are playing rather than once a session.
  // Every real hour is one full day: on the hour it is midnight in the
  // gym, half past is midday.
  const GAME_DAY_MS = 60 * 60 * 1000;
  function gameHourFloat(now) {
    const t = now ? now.getTime() : Date.now();
    return ((t % GAME_DAY_MS) / GAME_DAY_MS) * 24;
  }
  function gameClockText(now) {
    const at = gameHourFloat(now);
    const h = Math.floor(at);
    const m = Math.floor((at - h) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
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
    const at = gameHourFloat(now);
    const lo = Math.floor(at) % 24;
    const hi = (lo + 1) % 24;
    const t = at - Math.floor(at);
    return RUSH_BY_HOUR[lo] * (1 - t) + RUSH_BY_HOUR[hi] * t;
  }
  // What the busiest hour pays over the quietest, before staff and
  // fittings: the base, plus what the levels have added to it.
  function rushBonus() {
    return RUSH_BONUS + levelPerk('rush');
  }
  function rushMultiplier() {
    return 1 + rushBonus() * (1 + staffEffect('receptionist')) * rushFactor();
  }
  // The same, for one room: a Mirror Wall makes the busy hours pay more
  // there, and a Sound System means the room is never Quiet.
  function rushMultiplierFor(room) {
    const floor = roomEffect(room, 'floor');
    const f = Math.max(rushFactor(), floor);
    return 1 + rushBonus() * (1 + staffEffect('receptionist') + roomEffect(room, 'rush')) * f;
  }
  // ---- Open day ----
  // The gym's own rhythm is the rush, and you cannot argue with it: the
  // place is busy at seven in the morning and at six in the evening whether
  // you are there or not. An open day is the one lever over how busy it is
  // that belongs to the player -- free, short, and on a long enough
  // cooldown that it is worth coming back for rather than something to sit
  // and spam.
  // What an Open Day is worth while it runs. The base, plus whatever the
  // levels have added to it: the Neon Sign makes one longer, the levels
  // make it stronger, sooner and longer still.
  const PROMO_MULT = 2.5;
  function promoPower() {
    return PROMO_MULT + levelPerk('promopower');
  }
  const PROMO_SECONDS = 90;
  const PROMO_COOLDOWN_SECONDS = 15 * 60;

  // Measured off the wall clock, like everything else with a duration here,
  // so a reload does not restart it and a closed tab does not pause it.
  function promoAgeSeconds() {
    const at = state.promoAt || 0;
    return at ? (Date.now() - at) / 1000 : Infinity;
  }
  // How long one runs: the base, plus what a Neon Sign adds.
  function promoSeconds() {
    return Math.round(PROMO_SECONDS * (1 + gymEffect('promo') + levelPerk('promolong')));
  }
  function promoSecondsLeft() {
    return Math.max(0, promoSeconds() - promoAgeSeconds());
  }
  // The wait between Open Days, which the levels shorten.
  function promoCooldownSeconds() {
    return Math.max(60, PROMO_COOLDOWN_SECONDS - levelPerk('promo'));
  }
  function promoReadyInSeconds() {
    return Math.max(0, promoCooldownSeconds() - promoAgeSeconds());
  }
  function promoRunning() {
    return promoSecondsLeft() > 0;
  }
  function promoMultiplier() {
    return promoRunning() ? promoPower() : 1;
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
  // How much of the hour a location actually sees. A roof and a pier are
  // out in it; a workshop gets it through the doors; a cellar hardly at
  // all, and washing one in evening light turned its rock to brown paper.
  const SKY_REACH = { garage: 0.5, basement: 0.22, rooftop: 1, boardwalk: 1 };
  function skyWash(now) {
    const at = gameHourFloat(now);
    const lo = Math.floor(at) % 24;
    const hi = (lo + 1) % 24;
    const t = at - Math.floor(at);
    const a = SKY_BY_HOUR[lo];
    const b = SKY_BY_HOUR[hi];
    const mix = (i) => a[i] * (1 - t) + b[i] * t;
    const reach = SKY_REACH[state.activeTheme] == null ? 1 : SKY_REACH[state.activeTheme];
    return { r: Math.round(mix(0)), g: Math.round(mix(1)), b: Math.round(mix(2)), a: mix(3) * reach };
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
  // What the decor standing in a room adds up to for one kind of effect,
  // capped where the piece says so. Gym-wide effects are asked of the
  // whole gym instead, below, and count once.
  function roomEffect(room, kind) {
    if (!room || !room.layout) return 0;
    let total = 0;
    let cap = Infinity;
    room.layout.forEach((id) => {
      const item = id && itemById(id);
      if (!item || !item.effect || item.effect.kind !== kind || item.effect.gym) return;
      total += item.effect.amount;
      if (item.effect.max != null) cap = Math.min(cap, item.effect.max);
    });
    return Math.min(cap, total);
  }
  // A gym-wide effect: on if one of the piece stands on any open floor.
  function gymEffect(kind) {
    let best = 0;
    THEMES.forEach((t) => {
      const rooms = state.themeRooms[t.id] || [];
      if (!chainHasDesk(rooms)) return;
      rooms.forEach((room) => {
        room.layout.forEach((id) => {
          const item = id && itemById(id);
          if (item && item.effect && item.effect.kind === kind && item.effect.gym) {
            best = Math.max(best, item.effect.amount);
          }
        });
      });
    });
    return best;
  }
  // The decor effects at work in a room, one line each, for the room
  // details. Gym-wide ones say so.
  function roomEffectLines(room) {
    const seen = {};
    const lines = [];
    room.layout.forEach((id) => {
      const item = id && itemById(id);
      if (!item || !item.effect || item.effect.kind === 'vibe' || seen[item.effect.kind]) return;
      seen[item.effect.kind] = true;
      const kind = item.effect.kind;
      const amount = item.effect.gym ? gymEffect(kind) : roomEffect(room, kind);
      lines.push(EFFECT_TEXT[kind](amount)[0] + (item.effect.gym ? ' (whole gym)' : ''));
    });
    return lines;
  }
  function roomVibe(room) {
    return roomEffect(room, 'vibe');
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
    return (1 + roomEffect(room, 'room')) * vibeMultiplier(room) * rushMultiplierFor(room) * promoMultiplier()
      * (1 + staffEffect('manager')) * franchiseMultiplier() * reputationMultiplier() * (1 - wageShare());
  }
  // What each piece in a room makes a second, slot by slot -- this is what
  // lands in the pile at its foot.
  function pieceRates(room, shape) {
    const mult = synergyMultipliers(room, shape);
    const rm = roomMultiplier(room) * roomGoalMultiplier(room, shape);
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
  const PILE_CAP_SECONDS = [0, 120, 360, 1200, 3600, 10800];
  function pileCapSeconds() {
    return PILE_CAP_SECONDS[tierOf('frontdesk')] || PILE_CAP_SECONDS[1];
  }
  // For one room: a Water Cooler makes the bubbles there hold more.
  function pileCapSecondsFor(room) {
    return pileCapSeconds() * (1 + roomEffect(room, 'cap'));
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
    let direct = 0;
    let key = '';
    THEMES.forEach((t) => {
      const rooms = state.themeRooms[t.id] || [];
      if (!chainHasDesk(rooms)) return;
      rooms.forEach((room, i) => {
        const rates = pieceRates(room, roomShapeFor(t.id, i));
        const cash = roomCash(room);
        const capS = pileCapSecondsFor(room);
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
  // What every piece in a room earns, worked out once and handed back to
  // whoever else asks for it this frame. It used to be worked out again for
  // every piece as the room was drawn, and working it out means scoring the
  // whole room -- so a room of sixteen machines did that sum two hundred and
  // fifty-six times a frame, and the gym got slower the more you put in it.
  let rateStamp = 0;
  const rateCache = new WeakMap();
  function ratesNow(room, shape) {
    const held = rateCache.get(room);
    if (held && held.stamp === rateStamp) return held.rates;
    const rates = pieceRates(room, shape);
    rateCache.set(room, { stamp: rateStamp, rates });
    return rates;
  }
  function ratesChanged() {
    rateStamp += 1;
  }

  // The cap for one piece, in dollars, and the level its pile is at now.
  function pileOf(room, shape, index) {
    const rate = ratesNow(room, shape)[index] || 0;
    const cap = niceCap(rate * pileCapSecondsFor(room));
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
    sfx.coin();
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
        staff: { cashier: Math.max(0, Math.min(CASHIERS_PER_ROOM_MAX,
          (r && r.staff && r.staff.cashier) | 0)) },
        batches: new Array(n).fill(null).map((_, k) => {
          const id = old[k] || null;
          if (!RECIPES_OF[id]) return [];
          const q = Array.isArray(r && r.batches) ? r.batches[k] : null;
          if (!Array.isArray(q)) return [];
          return q.filter((bt) => bt && PRODUCTS[bt.p] && PRODUCTS[bt.p].from === id
            && typeof bt.at === 'number' && isFinite(bt.at)).slice(0, QUEUE_SLOTS);
        }),
        // The room's regular, if it has one yet: kept as saved, checked
        // when they next come in.
        regular: r && r.regular && typeof r.regular === 'object' && typeof r.regular.name === 'string'
          ? r.regular : null,
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
  // ---- The design shop ----
  // Paint for the walls and the floor of each location, art for its walls,
  // and a finish for every machine in the gym. A colour or a finish is
  // bought once and can then be put anywhere for nothing; art is bought
  // for the location it goes in.
  const WALL_PAINTS = [
    { id: 'white', name: 'Whitewash', color: '#c9c4bb', cost: 4000 },
    { id: 'charcoal', name: 'Charcoal', color: '#2b2d33', cost: 4000 },
    { id: 'red', name: 'Gym Red', color: '#7a2a24', cost: 9000 },
    { id: 'blue', name: 'Night Blue', color: '#243a5e', cost: 9000 },
    { id: 'green', name: 'Forest', color: '#26483a', cost: 9000 },
    { id: 'purple', name: 'Plum', color: '#46284f', cost: 20000 },
  ];
  const FLOOR_PAINTS = [
    { id: 'rubber', name: 'Rubber', a: '#2a2d33', b: '#23262b', cost: 6000 },
    { id: 'oak', name: 'Oak Boards', a: '#a67a4a', b: '#8f673c', cost: 12000 },
    { id: 'concrete', name: 'Concrete', a: '#7d8085', b: '#6b6e73', cost: 12000 },
    { id: 'court', name: 'Blue Court', a: '#2f5c8a', b: '#274d74', cost: 30000 },
    { id: 'track', name: 'Red Track', a: '#a1443a', b: '#883a31', cost: 30000 },
    { id: 'turf', name: 'Turf', a: '#3f7a3c', b: '#356732', cost: 60000 },
  ];
  const WALL_ART = [
    { id: 'posters', name: 'Poster Set', note: 'Three posters on the back wall', cost: 25000 },
    { id: 'stripe', name: 'Neon Stripe', note: 'A lit line round every room', cost: 80000 },
    { id: 'mural', name: 'Mural', note: 'A painted wall in each room', cost: 250000 },
  ];
  const FINISHES = [
    { id: 'standard', name: 'Standard', note: 'Powder-coated steel', cost: 0,
      palette: {} },
    { id: 'black', name: 'Matte Black', note: 'Every machine in black', cost: 250000,
      palette: { STEEL: '#3a3d45', STEEL_LT: '#5a5e68', FRAME: '#26282e', FRAME_DK: '#17181c', WEIGHT: '#2e3138', PAD: '#1f2126' } },
    { id: 'red', name: 'Racing Red', note: 'Red frames, black pads', cost: 1000000,
      palette: { STEEL: '#c8433a', STEEL_LT: '#e26a5f', FRAME: '#8f2c25', FRAME_DK: '#5e1c18', WEIGHT: '#3a2a2a' } },
    { id: 'chrome', name: 'Chrome', note: 'Polished all over', cost: 5000000,
      palette: { STEEL: '#d9e2ec', STEEL_LT: '#f4f7fa', FRAME: '#aeb9c7', FRAME_DK: '#7f8a98', WEIGHT: '#9aa5b3', PAD: '#3a3f4a' } },
    { id: 'gold', name: 'Gold', note: 'The most expensive thing in the shop', cost: 50000000,
      palette: { STEEL: '#e0b64a', STEEL_LT: '#f5dc86', FRAME: '#b8902f', FRAME_DK: '#7d5f1c', WEIGHT: '#a5822c', PAD: '#2b2418', RUBBER: '#231e14' } },
  ];
  function defaultDesign() {
    return {
      ownedWalls: {}, ownedFloors: {}, ownedFinishes: { standard: true },
      walls: {}, floors: {}, art: {}, finish: 'standard',
    };
  }
  // Something from the design shop tried on before it is paid for: shown
  // on the plan for the location you are in, saved nowhere, and gone the
  // moment you buy it, cancel it, or look at another location.
  let designPreview = null;
  function previewFor(kind, theme) {
    if (!designPreview || designPreview.kind !== kind) return null;
    if (kind !== 'finish' && designPreview.theme !== theme) return null;
    return designPreview.id;
  }
  function designState() {
    if (!state.design) state.design = defaultDesign();
    const d = state.design;
    ['ownedWalls', 'ownedFloors', 'ownedFinishes', 'walls', 'floors', 'art'].forEach((k) => {
      if (!d[k] || typeof d[k] !== 'object') d[k] = {};
    });
    if (!d.finish) d.finish = 'standard';
    d.ownedFinishes.standard = true;
    return d;
  }

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
      design: defaultDesign(),
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

    // Decor no longer earns, so any upgrade tier bought for a piece that
    // has become decor buys nothing and is cleared.
    dropDeadTiers(s.tiers);
    // Staff have caps now. A save from before them keeps what it can and is
    // paid back for the rest at what they cost to hire.
    if (s.staff && typeof s.staff === 'object') {
      STAFF_ROLES.forEach((role) => {
        if (role.perRoom) return;
        const cap = role.max || 0;
        if (!cap) return;
        const had = Math.max(0, s.staff[role.id] | 0);
        if (had <= cap) return;
        s.staff[role.id] = cap;
        for (let k = cap; k < had; k++) {
          s.balance = (s.balance || 0) + Math.ceil(role.baseCost * Math.pow(1.6, k));
        }
      });
    }
    s.design = Object.assign(defaultDesign(), saved.design || {});

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
      if (n > 0) stock[p] = Math.min(LARDER_CAP_MAX, n);
    });
    s.larder = stock;
    // What the time away is worth is settled after the state is in place,
    // by creditTimeAway() below: the sums need the whole gym, and the whole
    // gym is not assembled until this function has returned.
    return s;
  }

  // Loading a save code writes the new gym and reloads the page, and in the
  // moment between the two the old page is still running: an autosave
  // landing there would put the old gym straight back. So a load shuts the
  // door behind it.
  let saveLocked = false;
  function save() {
    if (saveLocked) return;
    state.lastSaved = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  let state = load();

  // ---- What happened while you were away ----
  // Gear used to earn only while you were watching it, so a gym left
  // overnight was a gym that had done nothing, and there was no reason to
  // open it again in the morning. Time away now fills the coin bubbles
  // exactly as watching would, and stops where they stop.
  //
  // That last part is what makes this safe rather than a second economy: a
  // bubble holds a couple of minutes of its machine's takings to begin
  // with and a full hour of them once the Customer Desk is at its best, so
  // a night away and a fortnight away come back to the same full bubbles.
  // Nothing is paid into the balance behind your back either -- it is all
  // still standing on the floor, waiting for you or a Cashier to fetch it.
  // Upgrading the desk is what turns a night away into real money, which is
  // the point: it was the dullest upgrade in the shop.
  const AWAY_CAP_SECONDS = 14 * 24 * 3600;
  function secondsAway() {
    const since = Number(state.lastSaved);
    if (!since) return 0;
    // A clock that has gone backwards -- a machine woken from sleep, a
    // timezone that moved -- credits nothing rather than something strange.
    const away = Math.floor((Date.now() - since) / 1000);
    return away > 0 ? Math.min(AWAY_CAP_SECONDS, away) : 0;
  }
  function creditTimeAway() {
    const away = secondsAway();
    // Under a minute is a page reload, not a night out.
    if (away < 60) return 0;
    let filled = 0;
    THEMES.forEach((t) => {
      const rooms = state.themeRooms[t.id] || [];
      if (!chainHasDesk(rooms)) return;
      rooms.forEach((room, i) => {
        const rates = pieceRates(room, roomShapeFor(t.id, i));
        const cash = roomCash(room);
        const capS = pileCapSecondsFor(room);
        rates.forEach((r, k) => {
          if (r <= 0 || room.layout[k] === 'frontdesk') return;
          const cap = niceCap(r * capS);
          const before = cash[k] || 0;
          cash[k] = Math.min(cap, before + r * away);
          filled += cash[k] - before;
        });
      });
    });
    return filled;
  }
  const awayFor = secondsAway();
  const awayCash = creditTimeAway();

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
    return Math.max(0, larderCap() - larderCount(productId));
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
  // How long a batch takes on this counter: a Gear Fridge in the room
  // makes it quicker.
  function batchSeconds(room, product) {
    return Math.round(product.seconds / (1 + roomEffect(room, 'stock')));
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
    const secs = batchSeconds(room, product);
    q.push({ p: productId, at: startsAt + secs * 1000, secs });
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
  function jobsOnBoard() {
    return JOBS_ON_BOARD + levelPerk('jobs');
  }

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
        + ' pieces placed at once',
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
        const most = Math.min(larderCap(), PRODUCTS[p].seconds > 300 ? 4 : 8);
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
    if (ITEMS.some((i) => i.effect && i.effect.kind === 'vibe' && unlockedFor(i))) kinds.push('vibe');
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
    const pay = mult * (JOB_KINDS[kind].pay || 1) * (1 + gymEffect('jobs'));
    job.cash = Math.max(150, Math.round(gps * 45 * pay));
    job.xp = Math.round(16 * pay * (1 + level * 0.12));
    return job;
  }

  function refillJobs() {
    if (!Array.isArray(state.jobs)) state.jobs = [];
    state.jobs = state.jobs.filter((j) => j && JOB_KINDS[j.kind]);
    const weights = [1, 1.7, 2.6, 3.6, 4.8];
    while (state.jobs.length < jobsOnBoard()) {
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
      toast('Rush order missed. Another in ' + Math.round(RUSH_ORDER_GAP_MISSED / 60) + ' min', null);
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
    addXp(job.xp);
    sfx.cash();
    state.jobsDone = (state.jobsDone || 0) + 1;
    state.rushDone = (state.rushDone || 0) + 1;
    const r = rushState();
    r.job = null;
    r.nextAt = Date.now() + RUSH_ORDER_GAP_DONE * 1000;
    if (currentLevel() > before) announceLevel(currentLevel());
    else toast('Rush order done. $' + formatNum(job.cash) + ' and ' + job.xp + ' XP', 'good');
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
    { id: 'open', name: 'Open For Business', hint: 'Put the Customer Desk down',
      cash: 50, got: (c) => c.open },
    { id: 'ten', name: 'Kitted Out', hint: 'Have ten pieces placed at once',
      cash: 400, got: (c) => c.placed >= 10 },
    { id: 'fullroom', name: 'Not An Inch Spare', hint: 'Fill every slot in one room',
      cash: 1500, got: (c) => c.fullRoom >= 1 },
    { id: 'synergy', name: 'Good Layout', hint: 'Get one piece to a +40% arrangement bonus',
      cash: 2000, got: (c) => c.bestSynergy >= 1.4 },
    { id: 'vibe', name: 'Somewhere Nice', hint: 'Take a room to the top of the vibe scale',
      cash: 250000, got: (c) => c.bestVibe >= VIBE_MAX_POINTS },
    { id: 'fifty', name: 'Proper Gym', hint: 'Have fifty pieces placed at once',
      cash: 500000, got: (c) => c.placed >= 50 },
    { id: 'hundred', name: 'Chain Material', hint: 'Have a hundred pieces placed at once',
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
    { id: 'themes', name: 'Three Addresses', hint: 'Have gear placed in three locations at once',
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
    rower: 'row', boxingring: 'punch', climbingwall: 'climb', stairclimber: 'step',
    cryo: 'sit',
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
    row: 2.6, punch: 6.0, climb: 1.8, step: 4.0,
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

  // What a member looks like, in one string. Two people with the same one
  // are the same person as far as anyone watching is concerned.
  function lookKey(m) {
    return [m.shirt, m.skin, m.hair, m.hairStyle, m.legs, m.capColor].join('|');
  }
  // Roll a look nobody else in the room already has. There are thousands of
  // combinations and four people to a room, so this almost always takes one
  // go; the loop is for the times it does not.
  function freshLook(roomIndex) {
    const taken = members.filter((m) => m.room === roomIndex).map(lookKey);
    let look = null;
    for (let tries = 0; tries < 24; tries++) {
      look = {
        shirt: pickOf(MEMBER_SHIRTS),
        skin: pickOf(MEMBER_SKINS),
        hair: pickOf(MEMBER_HAIR),
        hairStyle: pickOf(MEMBER_HAIRSTYLES),
        legs: pickOf(MEMBER_LEGS),
        capColor: pickOf(MEMBER_CAPS),
      };
      if (taken.indexOf(lookKey(look)) === -1) break;
    }
    return look;
  }
  function spawnMember(room, place, staffRoleId) {
    const at = randomFloorSpot(place);
    const look = freshLook(room);
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
      shirt: staffRoleId ? STAFF_SHIRT : look.shirt,
      skin: look.skin,
      hair: look.hair,
      speed: MEMBER_WALK * (staffRoleId === 'cashier' ? 1.05 : staffRoleId ? 0.75 : 0.85 + Math.random() * 0.35),
      // Which piece they are on, once they get there, so the figure knows
      // whether it is running, curling or sitting in a sauna.
      gearId: null,
      // Build and dress. Rolled once, at spawn, so somebody does not change
      // height between frames.
      build: 0.93 + Math.random() * 0.14,
      broad: 0.92 + Math.random() * 0.20,
      legs: staffRoleId ? STAFF_TROUSERS : look.legs,
      shortsLen: Math.random() < 0.35 ? 0.345 : 0.415,
      // Everyone on staff wears the cap. Members get whatever hair they have.
      hairStyle: staffRoleId ? 'cap' : look.hairStyle,
      capColor: staffRoleId ? STAFF_CAP : look.capColor,
      bagColor: pickOf(MEMBER_BAGS),
      // Staff are at work, not on their way to it: no gym bag, but a towel
      // over the shoulder is exactly what somebody working a floor carries.
      // A cashier carries the takings in a pouch on the hip. Nobody on staff
      // carries a gym bag or a water bottle: those are what members bring.
      carry: staffRoleId === 'cashier' ? 'pouch' : staffRoleId ? 'none' : pickOf(MEMBER_CARRY),
    };
  }

  // ---- Regulars ----
  // The crowd was a crowd: nobody in it was anybody. Each room now has one
  // regular -- a name, a look that stays the same from one visit to the
  // next, and a machine they come in for and head to first. They are worth
  // no more than anyone else in the takings; they are worth something to
  // look at, which is what a crowd was for.
  const REGULAR_NAMES = ['Dee', 'Marco', 'Priya', 'Tomasz', 'Aisha', 'Big Ron', 'Kenji', 'Lena',
    'Otis', 'Yara', 'Bram', 'Nia', 'Sol', 'Ivy', 'Dutch', 'Femi', 'Rosa', 'Jules', 'Hank', 'Mira'];
  function machineSlots(room) {
    const out = [];
    room.layout.forEach((id, i) => {
      if (id && itemById(id) && itemById(id).gps > 0) out.push(i);
    });
    return out;
  }
  // The room's regular, made the first time the room has a machine for
  // them to come in for. The name is one no other room's regular has, and
  // the look is rolled once and kept.
  function regularOf(room) {
    const machines = machineSlots(room);
    if (!machines.length) return null;
    if (!room.regular) {
      const taken = allRoomsEverywhere().map((r) => r.regular && r.regular.name).filter(Boolean);
      const free = REGULAR_NAMES.filter((n) => taken.indexOf(n) === -1);
      room.regular = {
        name: pickOf(free.length ? free : REGULAR_NAMES),
        fav: null,
        look: {
          shirt: pickOf(MEMBER_SHIRTS),
          skin: pickOf(MEMBER_SKINS),
          hair: pickOf(MEMBER_HAIR),
          hairStyle: pickOf(MEMBER_HAIRSTYLES.filter((h) => h !== 'cap')),
          legs: pickOf(MEMBER_LEGS),
          build: 0.93 + Math.random() * 0.14,
          broad: 0.92 + Math.random() * 0.20,
        },
      };
    }
    // Their machine, or a new one if the old one has gone.
    if (!room.regular.fav || room.layout.indexOf(room.regular.fav) === -1) {
      room.regular.fav = room.layout[pickOf(machines)];
    }
    return room.regular;
  }
  // The regular's look, put onto a member.
  function dressAsRegular(m, reg) {
    const look = reg.look || {};
    m.regular = reg.name;
    m.shirt = look.shirt || m.shirt;
    m.skin = look.skin || m.skin;
    m.hair = look.hair || m.hair;
    m.hairStyle = look.hairStyle || m.hairStyle;
    m.legs = look.legs || m.legs;
    m.build = look.build || m.build;
    m.broad = look.broad || m.broad;
    m.carry = 'bottle';
    return m;
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
      // One of them is the room's regular. Whoever already is stays so; a
      // room that has nobody named yet names its first.
      const reg = regularOf(room);
      if (reg && here.length) {
        // A regular who has wandered into the room next door is still that
        // regular, and nobody else may take the name while they are out.
        const away = members.some((m) => m.regular === reg.name && m.room !== roomIndex);
        const mine = here.filter((m) => m.regular === reg.name);
        // Anyone here wearing another room's name gives it back.
        here.forEach((m) => {
          if (m.regular && m.regular !== reg.name) {
            const owner = rooms.find((r) => r.regular && r.regular.name === m.regular);
            if (!owner) m.regular = null;
          }
        });
        if (mine.length > 1) mine.slice(1).forEach((m) => { m.regular = null; });
        if (!mine.length && !away) dressAsRegular(here[0], reg);
      }
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
  // The rooms a walk can go between without crossing a third: on a hub plan
  // the hub and any room off it, on a chain the room either side.
  function roomNextDoor(from, count) {
    if (planFor(state.activeTheme).hub) {
      return from === 0 ? 1 + Math.floor(Math.random() * (count - 1)) : 0;
    }
    const to = from + (Math.random() < 0.5 ? -1 : 1);
    return to >= 0 && to < count ? to : from;
  }
  // corridors[i] joins room i+1 to the hub on a hub plan, and rooms i and
  // i+1 on a chain.
  function corridorJoining(a, b) {
    if (planFor(state.activeTheme).hub) {
      if (a !== 0 && b !== 0) return null;
      return corridors[Math.max(a, b) - 1] || null;
    }
    return corridors[Math.min(a, b)] || null;
  }
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
    if (rooms.length > 1 && Math.random() < MEMBER_ROAM_CHANCE) dest = roomNextDoor(m.room, rooms.length);
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
    // The regular goes to their own machine when it is free, most of the
    // time; everyone else takes whatever is free.
    const reg = m.regular && dest === m.room ? room.regular : null;
    const favSlot = reg && reg.fav ? free.find((i) => room.layout[i] === reg.fav) : undefined;
    if (free.length && Math.random() < 0.82) {
      const i = favSlot !== undefined && Math.random() < 0.75 ? favSlot : pickOf(free);
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
      // A hallway always runs from its nearRoom to its doorRoom -- which of
      // those is the room being left decides which way down it this member
      // is walking.
      const c = corridorJoining(m.room, dest);
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
    if (levelPop && !levelPop.hidden) {
      levelPop.innerHTML = levelPopHtml();
      placeLevelPop();
    }
    if (!levelValueEl) return;
    const p = levelProgress();
    setText(levelValueEl, p.level);
    if (levelWrapEl) levelWrapEl.classList.toggle('is-capped', p.capped);
    setWidth(xpFillEl, (p.frac * 100).toFixed(1) + '%');
    setText(xpTextEl, p.capped
      ? formatNum(Math.floor(state.xp || 0)) + ' XP'
      : formatNum(Math.floor((state.xp || 0) - p.from)) + ' / ' + formatNum(p.to - p.from) + ' XP');
  }

  // What this level just opened up, so a level-up says something more useful
  // than a bigger number.
  function announceLevel(level) {
    sfx.level();
    const opened = levelBrings(level);
    toast(opened.length
      ? 'Level ' + level + '. ' + opened.join(' and ')
      : 'Level ' + level, 'good', opened.length > 1 ? 2600 : 1400);
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
    // A hidden row cannot be claimed, so it must not light the dot.
    const ready = !!document.querySelector('#jobs-list .tycoon-job.is-ready:not([hidden])')
      || !!document.querySelector('#rush-order .tycoon-job.is-ready:not([hidden])');
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
      setText(els.text, JOB_KINDS[job.kind].text(job));
      setWidth(els.fill, ((shown / Math.max(1, p.target)) * 100).toFixed(1) + '%');
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
    addXp(job.xp);
    sfx.cash();
    state.jobs.splice(index, 1);
    state.jobsDone = (state.jobsDone || 0) + 1;
    refillJobs();
    // Rebuild the board whatever the new job looks like: a replacement
    // that happened to read the same as the one just claimed kept the old
    // row, ready state and all.
    jobsSignature = '';
    if (currentLevel() > before) announceLevel(currentLevel());
    else toast('Job done. $' + formatNum(job.cash) + ' and ' + job.xp + ' XP', 'good');
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
      rushRow.row.classList.remove('is-ready');
      rushRow.wait.hidden = false;
      setText(rushRow.wait, 'Next rush order in ' + clockOf(rushNextInSeconds()));
      rushSignature = '';
      return;
    }
    rushRow.wait.hidden = true;
    rushRow.row.hidden = false;
    const signature = job.kind + ':' + job.target + ':' + (job.item || job.cat || '');
    if (signature !== rushSignature) {
      rushSignature = signature;
      setText(rushRow.text, 'RUSH: ' + JOB_KINDS[job.kind].text(job));
      rushRow.last = null;
    }
    const p = jobProgress(job, floorTally());
    const shown = Math.min(p.at, p.target);
    const left = Math.ceil(rushSecondsLeft());
    const stamp = shown + '/' + p.target + '/' + left + (p.ready ? '!' : '');
    if (rushRow.last === stamp) return;
    rushRow.last = stamp;
    setWidth(rushRow.fill, ((shown / Math.max(1, p.target)) * 100).toFixed(1) + '%');
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
    setText(franchiseHeldEl, held
      ? held + ' point' + (held === 1 ? '' : 's') + ', +'
        + Math.round((franchiseMultiplier() - 1) * 100) + '% on everything, forever'
      : 'nothing banked yet');
    setText(franchiseNoteEl, offer
      ? 'Cash this gym in for ' + offer + ' more point' + (offer === 1 ? '' : 's') + '. '
        + 'You keep your level and everything it unlocked, and your points. '
        + 'You lose the gear, every room past the first, and the staff.'
      : 'Keep earning. The next point is worth more the bigger the gym gets.');
    franchiseBtn.disabled = offer === 0;
    franchiseBtn.classList.toggle('is-confirming', franchiseArmed);
    setText(franchiseBtn, !offer ? 'Nothing to cash in yet'
      : franchiseArmed ? 'Really clear the gym?' : 'Franchise out for +' + offer);
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
    toast('Franchised out. ' + banked + ' points, +'
      + Math.round((franchiseMultiplier() - 1) * 100) + '% forever', 'good');
  }

  if (franchiseBtn) franchiseBtn.addEventListener('click', doFranchise);

  // ---- Trophy panel ----
  const trophyGridEl = document.getElementById('trophy-grid');
  const trophyCountEl = document.getElementById('trophy-count');
  const gymNameEl = document.getElementById('gym-name');
  const trophyEls = {};

  // One floating card, shared by every trophy: it is fixed to the window,
  // so the scrolling panel the trophies sit in cannot clip it.
  const tipEl = (() => {
    const el = document.createElement('div');
    el.className = 'tycoon-tip';
    el.setAttribute('role', 'note');
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  })();
  function showTip(target, text) {
    if (!text) return;
    setText(tipEl, text);
    tipEl.hidden = false;
    const box = target.getBoundingClientRect();
    const tip = tipEl.getBoundingClientRect();
    const pad = 8;
    let left = box.left + box.width / 2 - tip.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tip.width - pad));
    // Above the card, or below it when there is no room above.
    let top = box.top - tip.height - 8;
    if (top < pad) top = Math.min(box.bottom + 8, window.innerHeight - tip.height - pad);
    tipEl.style.left = Math.round(left) + 'px';
    tipEl.style.top = Math.round(top) + 'px';
    tipEl.classList.add('is-on');
  }
  function hideTip() {
    tipEl.classList.remove('is-on');
    tipEl.hidden = true;
  }

  function buildTrophyUI() {
    if (!trophyGridEl) return;
    trophyGridEl.innerHTML = '';
    TROPHIES.forEach((t) => {
      const el = document.createElement('div');
      el.className = 'tycoon-trophy';
      el.innerHTML = '<span class="tycoon-trophy-name"></span>'
        + '<span class="tycoon-trophy-hint"></span>'
        + '<span class="tycoon-trophy-got" hidden></span>';
      setText(el.querySelector('.tycoon-trophy-name'), t.name);
      setText(el.querySelector('.tycoon-trophy-hint'), t.hint);
      // What it was for, on hover or a long press, so a won trophy is
      // still a record of what you did rather than the word "Done".
      el.dataset.goal = t.hint + '. +$' + formatNum(t.cash);
      el.tabIndex = 0;
      const tell = () => showTip(el, el.dataset.goal);
      el.addEventListener('mouseenter', tell);
      el.addEventListener('focus', tell);
      el.addEventListener('mouseleave', hideTip);
      el.addEventListener('blur', hideTip);
      // A finger has no hover, so a tap says the same thing.
      el.addEventListener('click', () => {
        if (tipEl.hidden) tell(); else hideTip();
      });
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
      // The objective stays on the card whether it is won or not; what
      // winning adds is the payout under it.
      setText(el.querySelector('.tycoon-trophy-hint'), t.hint);
      const got = el.querySelector('.tycoon-trophy-got');
      setText(got, 'Done. +$' + formatNum(t.cash));
      if (got.hidden !== !won) got.hidden = !won;
    });
    setText(trophyCountEl, trophiesWon() + ' of ' + TROPHIES.length);
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
    sfx.fanfare();
    if (!trophyPopEl) { toast(t.name + '. $' + formatNum(t.cash), 'good'); return; }
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
      setText(none, 'No counter placed yet.');
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
      setText(collect, 'Collect');
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
      setText(none, 'Larder empty.');
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
      setText(pill.querySelector('.tycoon-stock-name'), PRODUCTS[p].name);
      setText(pill.querySelector('.tycoon-stock-n'), larderCount(p)
        + (larderCount(p) >= larderCap() ? ' / full' : ''));
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
          setWidth(pip.fill, '0%');
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
          const frac = 1 - Math.min(1, left / (b.secs || product.seconds));
          setWidth(pip.fill, Math.round(frac * 100) + '%');
          if (!nextDone) nextDone = left;
        }
      });
      setText(row.state, ready
        ? ready + (ready === 1 ? ' batch ready' : ' batches ready')
        : q.length
          ? 'Next in ' + secondsText(nextDone) + ' \u00b7 ' + q.length + ' of ' + QUEUE_SLOTS + ' on'
          : 'Nothing on');
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
      setText(els.count, role.perRoom
        ? ' ' + roomLabel(state.activeRoomIndex) + ' \u00b7 ' + here + ' of ' + cashiersPerRoom()
        : have ? ' x' + have : '');
      els.letGo.hidden = !have;
      if (!unlocked) {
        setText(els.note, 'From level ' + role.unlockLevel);
        setText(els.btn, 'Locked');
        els.btn.disabled = true;
        return;
      }
      if (role.perRoom) {
        const full = here >= cashiersPerRoom();
        setText(els.note, full ? 'Fully staffed'
          : 'Walks to the bubbles and empties them \u00b7 ' + Math.round(WAGE_SHARE_EACH * 100) + '% of the takings each');
        setText(els.btn, full ? 'Room full' : 'Hire here for $' + formatNum(cost));
        els.btn.disabled = full || state.balance < cost;
        return;
      }
      const cap = staffCap(role.id);
      if (cap > 0) setText(els.count, ' ' + have + ' of ' + cap);
      if (staffFull(role.id)) {
        setText(els.note, role.note(have) + ' \u00b7 that is the most you can have');
        setText(els.btn, 'Full');
        els.btn.disabled = true;
        return;
      }
      // What they are worth now, and what one more would add on top.
      const next = staffEffect(role.id, have + 1) - staffEffect(role.id, have);
      setText(els.note, (have ? role.note(have) + ' \u00b7 ' : '')
        + 'next +' + (role.id === 'cleaner'
          ? next.toFixed(1) + ' vibe' : Math.round(next * 100) + '%')
        + ' for ' + Math.round(WAGE_SHARE_EACH * 100) + '% of the takings');
      setText(els.btn, 'Hire for $' + formatNum(cost));
      els.btn.disabled = state.balance < cost;
    });
    const share = wageShare();
    setText(staffWagesEl, share > 0
      ? staffTotal() + ' on staff. Wages: ' + Math.round(share * 100) + '% of the takings'
        + (share >= WAGE_SHARE_MAX ? ' (the cap).' : '.')
      : 'No wages yet.');
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
    if (staffFull(id)) return;
    const cost = staffHireCost(id);
    if (state.balance < cost) return;
    if (id === 'cashier') {
      const room = activeRoom();
      if (!room || roomCashiers(room) >= cashiersPerRoom()) return;
    }
    const before = currentLevel();
    state.balance -= cost;
    sfx.thunk();
    if (id === 'cashier') {
      const room = activeRoom();
      if (!room.staff) room.staff = {};
      room.staff.cashier = roomCashiers(room) + 1;
    } else {
      if (!state.staff) state.staff = {};
      state.staff[id] = staffCount(id) + 1;
    }
    addXp(xpForSpend(cost));
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
  // ---- Where the controls park ----
  // The bar of controls sits on the plan and sticks just below the money
  // stats, which are themselves sticky and a different height on a phone.
  // Both numbers are measured rather than guessed, and re-measured whenever
  // anything about them changes.
  const toolbarEl = document.querySelector('.tycoon-designer .tycoon-toolbar');
  const hudBarEl = document.querySelector('.tycoon-page .game-hud');
  function measureControls() {
    if (!toolbarEl) return;
    const root = document.documentElement;
    const h = Math.round(toolbarEl.getBoundingClientRect().height);
    if (h > 0) root.style.setProperty('--tycoon-bar-h', h + 'px');
    if (hudBarEl) {
      const cs = getComputedStyle(hudBarEl);
      const stickTop = parseFloat(cs.top) || 0;
      const hudH = Math.round(hudBarEl.getBoundingClientRect().height);
      root.style.setProperty('--tycoon-stick-top', Math.round(stickTop + hudH + 6) + 'px');
    }
  }
  if (toolbarEl && typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => measureControls());
    ro.observe(toolbarEl);
    if (hudBarEl) ro.observe(hudBarEl);
  }
  window.addEventListener('resize', measureControls);
  measureControls();

  // The clock the whole day runs on: busy hours, the sky, the lamps. It
  // was invisible, so the gym filling up looked like weather.
  const clockEl = document.getElementById('tycoon-clock-time');
  function refreshClock() {
    if (!clockEl) return;
    const text = gameClockText();
    if (clockEl.textContent !== text) clockEl.textContent = text;
  }
  function refreshRushUI() {
    refreshClock();
    if (!rushEl) return;
    const shut = !gymOpen();
    if (rushEl.hidden !== shut) rushEl.hidden = shut;
    if (shut) return;
    const f = rushFactor();
    const bonus = Math.round(rushBonus() * f * 100);
    const when = rushLabel();
    // Rebuilt only when what it says changes: rebuilding it every tick
    // would swallow the tap that opens it.
    const sig = when + '|' + bonus + '|' + (f * 100).toFixed(0) + '|' + gameClockText();
    if (rushEl.dataset.sig === sig) return;
    rushEl.dataset.sig = sig;
    const hour = Math.floor(gameHourFloat());
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
        + '<span>It is ' + gameClockText() + ' in the gym. ' + when + '. Everything is earning '
          + (bonus > 0 ? '+' + bonus + '%' : 'its normal rate') + '.</span>'
        + '<span>A day in the gym is an hour of real time. It fills up mornings and evenings. '
          + next + '</span>'
        + '<span>Quiet is never a penalty. Rammed is +' + Math.round(rushBonus() * 100) + '%.</span>'
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
      ? 'Promo x' + promoPower() + ' \u00b7 ' + Math.ceil(left) + 's'
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
    toast('Promo on: x' + PROMO_MULT + ' for ' + promoSeconds() + 's', 'good');
  }

  if (promoBtn) promoBtn.addEventListener('click', runOpenDay);
  const promoInfo = document.getElementById('promo-info');
  if (promoWrap && promoInfo) {
    const pop = promoWrap.querySelector('.tycoon-info-pop');
    const fillPop = () => {
      const longer = gymEffect('promo') + levelPerk('promolong');
      pop.innerHTML = '<b>Promo</b>'
        + '<span>Runs a promotion for ' + promoSeconds() + ' seconds: a burst of new members, and everything earns x'
        + promoPower() + ' while it lasts.</span>'
        + (longer ? '<span>' + (gymEffect('promo') ? 'Your Neon Sign' : 'Your level')
          + (gymEffect('promo') && levelPerk('promolong') ? ' and your level make' : ' makes')
          + ' it ' + Math.round(longer * 100) + '% longer.</span>' : '')
        + (levelPerk('promopower') ? '<span>Your level is worth x'
          + levelPerk('promopower').toFixed(1) + ' more while it runs.</span>' : '')
        + '<span>Then it needs ' + Math.round(promoCooldownSeconds() / 60) + ' minutes before the next one.</span>';
    };
    fillPop();
    promoInfo.addEventListener('click', (e) => { e.stopPropagation(); fillPop(); promoWrap.classList.toggle('is-open'); });
    document.addEventListener('click', (e) => { if (!promoWrap.contains(e.target)) promoWrap.classList.remove('is-open'); });
  }

  const toastEl = document.getElementById('game-toast');
  // ---- Sound ----
  // Everything here is made in the browser from oscillators and noise: no
  // files, nothing to load, nothing to fail. It is off until switched on,
  // because a page that starts making noise is a page people close, and
  // the choice is remembered. Three kinds of sound: a chime when you take
  // money, a thunk when you spend it, and under it all a crowd murmur that
  // thickens with the busy hours and thins to nothing at night.
  const SOUND_KEY = 'gymTycoonSound';
  const soundBtn = document.getElementById('btn-sound');
  // On unless it has been switched off. A browser will not let a page make
  // a sound before the first click anyway, so nothing is heard until
  // something is done -- which is the part that made starting muted worth
  // it, and it holds either way.
  let soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) { soundOn = true; }
  let audio = null;

  // The context is made on the first click that wants it, which is the
  // only time a browser will let a page start one.
  function audioReady() {
    if (!soundOn) return null;
    if (audio) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return audio;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    audio = { ctx, master, murmur: null };
    startMurmur();
    return audio;
  }
  // One note: a waveform at a pitch, fading in a hair and out over `dur`,
  // sliding to a second pitch if given.
  function note(a, freq, when, dur, type, gain, slideTo) {
    const osc = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(a.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }
  const sfx = {
    // Money taken: two bright notes a fifth apart, the second a touch later.
    coin() {
      const a = audioReady();
      if (!a) return;
      const t = a.ctx.currentTime;
      note(a, 1318, t, 0.09, 'triangle', 0.22);
      note(a, 1976, t + 0.05, 0.14, 'triangle', 0.16);
    },
    // Money spent: a low thud with a click on the front of it.
    thunk() {
      const a = audioReady();
      if (!a) return;
      const t = a.ctx.currentTime;
      note(a, 150, t, 0.16, 'sine', 0.5, 55);
      note(a, 2400, t, 0.02, 'square', 0.05);
    },
    // A job handed in: the thunk and then the coins.
    cash() {
      if (!audioReady()) return;
      sfx.thunk();
      setTimeout(() => sfx.coin(), 110);
    },
    // Something won: four notes up a major chord.
    fanfare() {
      const a = audioReady();
      if (!a) return;
      const t = a.ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => note(a, f, t + i * 0.09, 0.22, 'triangle', 0.18));
    },
    // A level: two notes, up.
    level() {
      const a = audioReady();
      if (!a) return;
      const t = a.ctx.currentTime;
      note(a, 660, t, 0.12, 'triangle', 0.2);
      note(a, 990, t + 0.1, 0.24, 'triangle', 0.2);
    },
    // A piece lifted off the floor: a short rising blip, light, so it reads
    // as picking something up rather than dropping it.
    lift() {
      const a = audioReady();
      if (!a) return;
      note(a, 420, a.ctx.currentTime, 0.07, 'sine', 0.14, 700);
    },
    // A piece set down: the same the other way, with a soft knock under it.
    place() {
      const a = audioReady();
      if (!a) return;
      const t = a.ctx.currentTime;
      note(a, 700, t, 0.06, 'sine', 0.13, 400);
      note(a, 180, t + 0.02, 0.10, 'sine', 0.26, 110);
    },
    // Walking into another location: a door, low and open.
    door() {
      const a = audioReady();
      if (!a) return;
      const t = a.ctx.currentTime;
      note(a, 300, t, 0.16, 'triangle', 0.16, 460);
      note(a, 120, t + 0.04, 0.18, 'sine', 0.2);
    },
  };
  // The crowd. A loop of soft noise through a band-pass filter, which is
  // what a room of people sounds like from the next room, with its volume
  // set from how busy the gym is and how many people are on the floor.
  function startMurmur() {
    const { ctx, master } = audio;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // Pinkish rather than white: white noise reads as a hiss, not a room.
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.06;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 420;
    band.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0;
    // A slow wobble on the level, so it breathes like a crowd rather than
    // holding one note.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.23;
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    src.connect(band);
    band.connect(g);
    g.connect(master);
    src.start();
    lfo.start();
    audio.murmur = g;
  }
  function tickMurmur() {
    if (!audio || !audio.murmur) return;
    const open = gymOpen();
    let target = 0;
    if (open && soundOn && !document.hidden) {
      const busy = Math.max(rushFactor(), 0.12);
      const crowd = Math.min(1, members.length / 10);
      target = 0.015 + 0.075 * busy * (0.35 + 0.65 * crowd);
    }
    audio.murmur.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.9);
  }
  function refreshSoundBtn() {
    if (!soundBtn) return;
    setAttr(soundBtn, 'aria-pressed', soundOn ? 'true' : 'false');
    setAttr(soundBtn, 'aria-label', soundOn ? 'Sound on' : 'Sound off');
    soundBtn.title = soundOn ? 'Sound on' : 'Sound off';
  }
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch (e) { /* no store */ }
      refreshSoundBtn();
      if (soundOn) {
        audioReady();
        sfx.coin();
      } else if (audio) {
        audio.ctx.suspend();
      }
    });
    refreshSoundBtn();
  }
  document.addEventListener('visibilitychange', () => {
    if (!audio) return;
    if (document.hidden) { if (audio.murmur) audio.murmur.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.2); }
    else tickMurmur();
  });

  function toast(msg, cls, ms) {
    setText(toastEl, msg);
    toastEl.className = 'game-toast show' + (cls ? ' ' + cls : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toastEl.classList.remove('show'); }, ms || 1100);
  }

  // A stretch of time in the words a person would use for it. Rounded hard,
  // because "away for about 8 hours" is the whole of what anybody wants.
  function awayWords(secs) {
    const mins = Math.round(secs / 60);
    if (mins < 60) return mins + (mins === 1 ? ' minute' : ' minutes');
    const hours = Math.round(secs / 3600);
    if (hours < 36) return hours + (hours === 1 ? ' hour' : ' hours');
    const days = Math.round(secs / 86400);
    return days + (days === 1 ? ' day' : ' days');
  }

  // ---- HUD ----
  const hudGps = document.getElementById('hud-gps');
  const hudFloor = document.getElementById('hud-floor');
  function refreshHud() {
    setText(hudTotal, '$' + formatNum(state.balance));
    setText(hudGps, formatNum(gps) + '/s');
    // The figure alone, and never anything else: this box is a fixed size
    // and a longer string in it would resize the whole row of stats and
    // shove the page about.
    if (hudFloor) setText(hudFloor, '$' + formatMoney(floorCash()));
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
    const rushPct = Math.round((rushMultiplierFor(room) - 1) * 100);
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
    let vibeHtml = '';
    const rows = [['Gear in this room', '', formatNum(baseSum) + '/s']];
    const add = (label, pct, from) => {
      if (pct <= 0) return;
      rows.push([label, '+' + pct + '%', '+' + formatNum(baseSum * (pct / 100) * from) + '/s']);
    };
    add('Arrangement', bonusPct, 1);
    // The two goals a whole room can meet. Each is a slice of what the
    // arranged pieces make, in the same terms as the rows around it.
    const goals = roomGoals(room, shape);
    if (goals.specialist) {
      rows.push(['Specialist room', '+' + Math.round(SPECIALIST_BONUS * 100) + '%',
        '+' + formatNum(arrangedGps * SPECIALIST_BONUS) + '/s']);
    }
    if (goals.clearWalk) {
      rows.push(['Easy to get around', '+' + Math.round(CLEAR_WALK_BONUS * 100) + '%',
        '+' + formatNum(arrangedGps * CLEAR_WALK_BONUS) + '/s']);
    }
    if (vibe > 0) {
      rows.push(['Decor' + (vibe > VIBE_MAX_POINTS ? ' (at the cap)' : ''),
        '+' + vibePct + '%', '+' + formatNum(arrangedGps * (vibePct / 100)) + '/s']);
    }
    if (rushPct > 0) {
      const before = arrangedGps * (1 + vibePct / 100);
      rows.push(['Busy hour', '+' + rushPct + '%', '+' + formatNum(before * (rushPct / 100)) + '/s']);
    }
    // How busy the gym is, as a bar: this is what the busy-hour row above
    // comes from, and it used to be a badge in the toolbar with nowhere to
    // explain itself.
    const f = rushFactor();
    const floorF = roomEffect(room, 'floor');
    const busyHere = Math.max(f, floorF);
    const when = rushLabel();
    const hourNow = Math.floor(gameHourFloat());
    const nextRush = hourNow < 7 ? 'The morning rush starts around 7.'
      : hourNow < 9 ? 'This is the morning rush.'
        : hourNow < 17 ? 'The evening rush starts around 5.'
          : hourNow < 20 ? 'This is the evening rush.'
            : 'It quietens down for the night from here.';
    const busyHtml = '<div class="tycoon-busy" id="busy-meter">'
      + '<div class="tycoon-vibe-top">'
        + '<span class="tycoon-vibe-name">Busy hours</span>'
        + '<span class="tycoon-vibe-num"><span class="tycoon-rush-when">' + when + '</span>'
          + ' \u00b7 <span class="tycoon-rush-bonus' + (rushPct > 0 ? '' : ' is-none') + '">'
          + (rushPct > 0 ? '+' + rushPct + '%' : 'no bonus') + '</span></span>'
      + '</div>'
      + '<span class="tycoon-vibe-bar is-busy"><span class="tycoon-vibe-fill" style="width:'
        + Math.round(busyHere * 100) + '%"></span></span>'
      + '<p class="tycoon-vibe-note">It is ' + gameClockText() + ' in the gym. A day here is one real hour. '
        + 'Mornings and evenings earn up to +' + Math.round(rushBonus() * 100) + '%. '
        + nextRush + (floorF > 0 && f < floorF ? ' The Sound System keeps this room busy.' : '') + '</p>'
      + '</div>';
    // The vibe meter, and what else the decor in this room is doing. Vibe
    // is a number with a ceiling, so it reads as a bar rather than a
    // figure: how full it is says how much of it is left to buy.
    const vibeCapped = Math.min(VIBE_MAX_POINTS, vibe + staffEffect('cleaner'));
    const effectLines = roomEffectLines(room);
    vibeHtml = '<div class="tycoon-vibe">'
      + '<div class="tycoon-vibe-top">'
        + '<span class="tycoon-vibe-name">Vibe</span>'
        + '<span class="tycoon-vibe-num">+' + vibePct + '% to this room</span>'
      + '</div>'
      + '<span class="tycoon-vibe-bar"><span class="tycoon-vibe-fill" style="width:'
        + Math.round((vibeCapped / VIBE_MAX_POINTS) * 100) + '%"></span></span>'
      + '<p class="tycoon-vibe-note">' + (vibe >= VIBE_MAX_POINTS
        ? 'Full. More decor adds no more vibe here.'
        : 'How nice this room is to train in. Decor raises it, and it lifts everything the room earns. '
          + 'Full at +' + Math.round(VIBE_MAX_POINTS * VIBE_PER_POINT * 100) + '%.') + '</p>'
      + (effectLines.length
        ? '<ul class="tycoon-vibe-list">' + effectLines.map((l) => '<li>' + l + '</li>').join('') + '</ul>'
        : '')
      + '</div>';
    const reg = regularOf(room);
    const regHtml = reg
      ? '<p class="tycoon-regular"><b>' + reg.name + '</b> is a regular here, and comes in for the '
        + itemById(reg.fav).name + '.</p>'
      : '';
    const kindName = (k) => (CATEGORY_META[k] ? CATEGORY_META[k].name.toLowerCase() : k);
    const specLine = goals.specialist
      ? 'Specialist room: all ' + kindName(goals.kind) + '. +' + Math.round(SPECIALIST_BONUS * 100) + '%'
      : goals.kinds.length > 1
        ? 'Specialist room: mixed (' + goals.kinds.map(kindName).join(', ') + '). One kind of machine only'
        : 'Specialist room: ' + goals.machines + ' of ' + SPECIALIST_MIN
          + (goals.kind ? ' ' + kindName(goals.kind) : '') + ' machines';
    const walkLine = goals.clearWalk
      ? 'Easy to get around: every machine can be walked to. +' + Math.round(CLEAR_WALK_BONUS * 100) + '%'
      : goals.stuck.length
        ? 'Easy to get around: the ' + goals.stuck[0] + ' cannot be walked to'
          + (goals.stuck.length > 1 ? ' (' + (goals.stuck.length - 1) + ' more)' : '')
          + '. Leave a way through'
        : 'Easy to get around: ' + goals.walkers + ' of ' + CLEAR_WALK_MIN + ' machines';
    const goalPct = Math.round((goals.multiplier - 1) * 100);
    const goalsHtml = '<div class="tycoon-goals">'
      + '<div class="tycoon-vibe-top">'
        + '<span class="tycoon-vibe-name">Room goals</span>'
        + '<span class="tycoon-vibe-num' + (goalPct > 0 ? '' : ' is-none') + '">'
          + (goalPct > 0 ? '+' + goalPct + '%' : 'none met') + '</span>'
      + '</div>'
      + '<ul class="tycoon-goal-list">'
        + '<li class="' + (goals.specialist ? 'is-met' : '') + '">' + specLine + '</li>'
        + '<li class="' + (goals.clearWalk ? 'is-met' : '') + '">' + walkLine + '</li>'
      + '</ul>'
      + '<p class="tycoon-vibe-note">Two things a whole room can do. One kind of machine, four or more, '
        + 'is a specialist room. A clear walk from the door to every machine, with nothing to squeeze past, '
        + 'is easy to get around.</p>'
      + '</div>';
    const cell = (text, cls) => '<span class="' + cls + '"></span>';
    synergyEl.innerHTML = busyHtml + vibeHtml + goalsHtml + regHtml + '<p class="tycoon-bd-head"></p>'
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
      setText(el.children[0], r[0]);
      setText(el.children[1], r[1]);
      setText(el.children[2], r[2]);
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
  function capWords(secs) {
    return secs >= 3600
      ? Math.round(secs / 360) / 10 + ' hr'
      : Math.round(secs / 60) + ' min';
  }
  function earnsLine(itemId) {
    const item = itemById(itemId);
    const tier = tierOf(itemId);
    if (item.starter) {
      // The desk is the one thing whose mark buys holding room rather than
      // takings, and that is the whole reason to improve it, so it is what
      // the row says instead of a rate.
      const long = 'Opens the location. Bubbles hold ' + capWords(pileCapSeconds())
        + ' of what a machine makes'
        + (tier > 1 ? ' (' + TIER_NAMES[tier] + ')' : '');
      const short = 'Opens up \u00b7 bubbles hold ' + capWords(pileCapSeconds());
      return '<span class="btn-long">' + long + '</span>'
        + '<span class="btn-short">' + short + '</span>';
    }
    // Decor earns nothing. What it does instead is the reason to buy it,
    // so that is what its row says.
    if (item.effect) {
      // Two lengths of the same sentence. A fitting's line runs to three
      // clauses, which is three lines of a phone's shop row, so the phone
      // gets the short form of each: the stylesheet picks.
      const long = effectLine(item)
        + (makesStock(itemId) ? '. Makes ' + RECIPES_OF[itemId]
          .map((pr) => PRODUCTS[pr].name.toLowerCase() + 's').join(' and ') : '')
        + (onePerRoom(itemId) ? '. Max one per room' : '')
        + (maxPerLocation(itemId) ? '. Max ' + maxPerLocation(itemId) + ' per location' : '');
      const short = effectLine(item, true)
        + (makesStock(itemId) ? ' \u00b7 makes stock' : '')
        + (onePerRoom(itemId) ? ' \u00b7 1 per room' : '')
        + (maxPerLocation(itemId) ? ' \u00b7 ' + maxPerLocation(itemId) + '/location' : '');
      return '<span class="btn-long">' + long + '</span>'
        + '<span class="btn-short">' + short + '</span>';
    }
    return '+' + formatNum(gpsOf(itemId)) + '/s once placed'
      + (tier > 1 ? ' (' + TIER_NAMES[tier] + ')' : '')
      + (maxPerLocation(itemId)
        ? '<span class="btn-long">. Max ' + maxPerLocation(itemId) + ' per location</span>'
          + '<span class="btn-short"> \u00b7 ' + maxPerLocation(itemId) + '/location</span>'
        : '');
  }

  // Which categories the shop is hiding. Empty is everything shown, which
  // is where it starts.
  let shopHidden = {};
  const shopFilterEl = document.getElementById('shop-filter');

  // A menu rather than a row of chips: nine chips did not fit any width
  // short of a desktop, and the ones off the edge might as well not exist.
  function buildShopFilter() {
    if (!shopFilterEl) return;
    const cats = [...new Set(ITEMS.map((i) => CATEGORY[i.id]))];
    // A dropdown that holds a tick box per category. Shut it is one small
    // control; open it, any mix of categories can be hidden at once, which
    // a plain menu of one-at-a-time options could never do.
    shopFilterEl.innerHTML = '<div class="tycoon-filter-menu">'
      + '<button class="tycoon-filter-btn" type="button" aria-expanded="false">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
        + '<path d="M3 5h18v2.2l-7 7.3V20l-4-2v-5.5L3 7.2Z"/></svg>'
        + '<span class="tycoon-filter-word">Filter</span>'
        + '<span class="tycoon-filter-state"></span>'
        + '<svg class="tycoon-filter-caret" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
        + '<path d="M6 9l6 7 6-7Z"/></svg>'
      + '</button>'
      + '<div class="tycoon-filter-drop" hidden>'
        + '<div class="tycoon-filter-boxes"></div>'
        + '<button class="tycoon-filter-reset" type="button" hidden>Show every category</button>'
      + '</div></div>';
    const menu = shopFilterEl.querySelector('.tycoon-filter-menu');
    const btn = shopFilterEl.querySelector('.tycoon-filter-btn');
    const drop = shopFilterEl.querySelector('.tycoon-filter-drop');
    const boxes = shopFilterEl.querySelector('.tycoon-filter-boxes');
    const state = shopFilterEl.querySelector('.tycoon-filter-state');
    const reset = shopFilterEl.querySelector('.tycoon-filter-reset');
    // The button says what the filter is doing, so it can be read shut.
    const sync = () => {
      const off = cats.filter((c) => shopHidden[c]);
      const on = cats.filter((c) => !shopHidden[c]);
      shopFilterEl.classList.toggle('is-on', off.length > 0);
      setText(state, off.length === 0 ? 'All gear'
        : on.length === 1 ? CATEGORY_META[on[0]].name
          : on.length + ' of ' + cats.length);
      reset.hidden = off.length === 0;
      refreshShopUI();
    };
    const setOpen = (open) => {
      menu.classList.toggle('is-open', open);
      drop.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(drop.hidden);
    });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) setOpen(false); });
    menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setOpen(false); btn.focus(); } });
    cats.forEach((cat) => {
      const meta = CATEGORY_META[cat];
      const label = document.createElement('label');
      label.className = 'tycoon-filter-box';
      label.innerHTML = '<input type="checkbox" checked>'
        + '<span class="tycoon-filter-tick" aria-hidden="true">'
        + '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.4 6.6 11.5 12.5 4.8"/></svg></span>'
        + '<span class="tycoon-filter-dot" style="background:' + meta.color + '"></span>'
        + '<span class="tycoon-filter-name">' + meta.name + '</span>';
      const input = label.querySelector('input');
      input.checked = !shopHidden[cat];
      label.classList.toggle('is-off', !!shopHidden[cat]);
      input.addEventListener('change', () => {
        shopHidden[cat] = !input.checked;
        label.classList.toggle('is-off', !input.checked);
        sync();
      });
      boxes.appendChild(label);
    });
    reset.addEventListener('click', () => {
      shopHidden = {};
      boxes.querySelectorAll('input').forEach((i) => { i.checked = true; });
      boxes.querySelectorAll('.tycoon-filter-box').forEach((l) => l.classList.remove('is-off'));
      sync();
    });
    sync();
  }

  // The shop reads as two shops: the machines that earn, and the decor
  // that does everything else. A heading goes in above the first row of
  // each, and hides with the rows if the filter puts them all away.
  const SHOP_SECTIONS = [
    { id: 'gear', name: 'Gym Equipment', note: 'Earns money once placed' },
    { id: 'decor', name: 'Decoration', note: 'Earns nothing. Each piece does one thing' },
  ];
  function sectionOf(itemId) {
    return CATEGORY[itemId] === 'decor' ? 'decor' : 'gear';
  }
  const shopHeadEls = {};
  // The order the shop lists things in, which is not the order they are
  // declared in. Within a section it runs by the level that opens it and
  // then by price, so the list reads as the order you will actually buy
  // things in: everything you can afford today at the top, the next thing
  // to work towards right under it. The Customer Desk is pinned first --
  // it is free, and nothing else in the location works without it.
  function shopOrder() {
    const rank = (item) => [
      sectionOf(item.id) === 'gear' ? 0 : 1,
      item.starter ? 0 : 1,
      item.unlockLevel || 1,
      item.baseCost,
    ];
    return ITEMS.slice().sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < ra.length; i++) {
        if (ra[i] !== rb[i]) return ra[i] - rb[i];
      }
      return 0;
    });
  }
  function buildShop() {
    let section = null;
    shopOrder().forEach((item) => {
      const here = sectionOf(item.id);
      if (here !== section) {
        section = here;
        const meta = SHOP_SECTIONS.find((x) => x.id === here);
        const head = document.createElement('h3');
        head.className = 'tycoon-shop-head';
        head.innerHTML = '<span class="tycoon-shop-head-name">' + meta.name + '</span>'
          + '<span class="tycoon-shop-head-note">' + meta.note + '</span>';
        shopGrid.appendChild(head);
        shopHeadEls[here] = head;
      }
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
        '<span class="shop-item-gps">' + earnsLine(item.id) + '</span>' +
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
    // Nothing here about gear waiting in Storage: the fold says how many
    // are in there, and nagging about it every tick is not advice.
    // Nothing here about money in the bubbles either: the bubbles are on
    // the plan, in front of you, and the stats say what is in them.
    // Nothing is waiting, so the question becomes what to spend on.
    const idle = countersPlaced().find((c) => queueAt(c.room, c.index).length === 0);
    if (idle) {
      return ['The ' + itemById(idle.itemId).name + ' is idle. Start a batch.', 'counter'];
    }
    // Nothing about what you can afford: the Shop already greys out what you
    // cannot buy, so a line saying you can buy a Potted Palm is the screen
    // reading itself out loud. The bar only speaks when something is waiting
    // somewhere you are not looking.
    return null;
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
  const shutCardEl = document.getElementById('shut-card');
  const shutNoteEl = document.getElementById('shut-note');
  const shutGoBtn = document.getElementById('btn-shut-go');
  function refreshOpenHint() {
    const open = gymOpen();
    const theme = THEMES.find((t) => t.id === state.activeTheme) || { name: 'This location' };
    const line = 'Take the free Customer Desk from the Shop and put it down. '
      + 'Nothing earns and nothing sells until it is standing.';
    if (openHintEl) {
      openHintEl.hidden = open;
      if (!open) {
        setText(openHintEl, 'The ' + theme.name
          + ' is closed. Take its free Customer Desk from the Shop and put it down.');
      }
    }
    // The same thing on the plan, which is where somebody who has never
    // played is looking. It steps aside while a piece is being carried.
    if (shutCardEl) {
      const show = !open && !editing;
      if (shutCardEl.hidden !== !show) shutCardEl.hidden = !show;
      if (show) {
        setText(shutCardEl.querySelector('.tycoon-shut-title'), 'The ' + theme.name + ' is closed');
        setText(shutNoteEl, line);
      }
    }
  }
  if (shutGoBtn) {
    shutGoBtn.addEventListener('click', () => {
      showPanel('shop');
      const row = shopEls.frontdesk && shopEls.frontdesk.root;
      if (row) row.scrollIntoView({ block: 'center' });
    });
  }
  // Anything done to a closed gym says why nothing happened. Rate-limited
  // to once every couple of seconds, because a tap on the plan while it is
  // shut is exactly the thing somebody does five times in a row.
  let shutSaidAt = 0;
  function sayShut() {
    if (gymOpen()) return false;
    const now = Date.now();
    if (now - shutSaidAt > 2200) {
      shutSaidAt = now;
      const theme = THEMES.find((t) => t.id === state.activeTheme) || { name: 'This location' };
      toast('The ' + theme.name + ' is closed. Put the Customer Desk down first', null, 2600);
      showPanel('shop');
    }
    return true;
  }

  // The upgrade control on one shop row: what the next mark costs and what
  // it buys, which is takings for a machine and holding room for the desk.
  function refreshUpgradeBtn(btn, itemId) {
    const upgradable = canUpgrade(itemId);
    btn.hidden = !upgradable;
    if (!upgradable) return;
    const tier = tierOf(itemId);
    const upCost = upgradeCost(itemId);
    const gain = upgradeIsCap(itemId)
      ? 'bubbles ' + capWords(PILE_CAP_SECONDS[tier + 1] || pileCapSeconds())
      : 'x' + TIER_STEP.toFixed(1);
    setHtml(btn, '<span class="btn-long">Upgrade to </span>' + TIER_NAMES[tier + 1]
      + '<span class="btn-long"> for</span> $' + formatNum(upCost)
      + '<span class="btn-long"> (' + gain + ')</span>');
    btn.disabled = state.balance < upCost;
  }

  function refreshShopUI() {
    refreshOpenHint();
    // A heading with nothing under it is noise, so each one follows its
    // own rows.
    SHOP_SECTIONS.forEach((sec) => {
      const head = shopHeadEls[sec.id];
      if (!head) return;
      const any = ITEMS.some((item) => sectionOf(item.id) === sec.id && !shopHidden[CATEGORY[item.id]]);
      if (head.hidden !== !any) head.hidden = !any;
    });
    ITEMS.forEach((item) => {
      const els = shopEls[item.id];
      const shown = !shopHidden[CATEGORY[item.id]];
      if (els.root.hidden !== !shown) els.root.hidden = !shown;
      if (!shown) return;
      const unlocked = unlockedFor(item);
      els.root.classList.toggle('is-locked', !unlocked);
      if (!unlocked) {
        setText(els.ownedEl, '');
        setHtml(els.buyBtn, '<span class="btn-lock-icon">' + iconMarkup('lock', 13) + '</span> '
          + '<span class="btn-long">Unlocks at level ' + item.unlockLevel + '</span>'
          + '<span class="btn-short">Level ' + item.unlockLevel + '</span>');
        els.buyBtn.disabled = true;
        els.root.classList.remove('is-affordable');
        els.upBtn.hidden = true;
        return;
      }
      const owned = state.owned[item.id] || 0;
      const cost = costFor(item);
      // "x0" on every row you own none of is noise; the count only shows
      // once there is one to count.
      setText(els.ownedEl, owned ? 'x' + owned : '');
      // The mark, the line and the upgrade first: they are true of the row
      // whether or not there is anything left to buy on it, and a placed
      // desk -- which has nothing left to buy -- is exactly the row whose
      // mark you want to see.
      const tier = tierOf(item.id);
      setText(els.tierEl, item.name + (tier > 1 ? ' ' + TIER_NAMES[tier] : ''));
      setHtml(els.gpsEl, earnsLine(item.id));
      refreshUpgradeBtn(els.upBtn, item.id);
      // Shut until the Customer Desk is down, apart from the desk itself --
      // which is only for sale while some location still has none.
      const shut = item.starter ? !deskWanted() : !gymOpen();
      els.root.classList.toggle('is-shut', shut);
      if (shut) {
        setHtml(els.buyBtn, item.starter ? 'Placed here'
          : '<span class="btn-long">Place the desk first</span>'
            + '<span class="btn-short">Desk first</span>');
        els.buyBtn.disabled = true;
        // Disabled buttons swallow the click, so the row itself answers.
        els.root.onclick = item.starter ? null : sayShut;
        els.root.classList.remove('is-affordable');
        return;
      }
      els.root.onclick = null;
      setHtml(els.buyBtn, item.starter ? 'Take it, free'
        : 'Buy<span class="btn-long"> for</span> $' + formatNum(cost));
      const affordable = item.starter || state.balance >= cost;
      els.buyBtn.disabled = !affordable;
      els.root.classList.toggle('is-affordable', affordable);


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
    addXp(xpForSpend(cost));
    if (!item.starter) sfx.thunk();
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
    // What you buy goes straight into your hands, standing on the plan
    // where you can see it, ready to be dragged somewhere and put down.
    // The trip through Storage was a step that always ended the same way:
    // buy, scroll down, find the chip, pick it up.
    //
    // It still drops into Storage rather than your hands where it cannot go
    // anywhere: your hands are already full, or this room has its one
    // fitting, or this location has its fill of that machine. Where it
    // stands is still a decision -- nothing is ever dropped into a slot for
    // you, which is what made the old shop deal a piece into a room and
    // move the one you were looking at out from under the cursor.
    const idx = state.activeRoomIndex;
    const room = activeRooms()[idx];
    const holdIt = !editing && !roomAlreadyHas(room, id) && !locationFull(state.activeTheme, id);
    if (holdIt) {
      const shape = roomShapeFor(state.activeTheme, idx);
      beginEdit(id, idx, { u: shape.cols / 2, v: shape.rows / 2 }, null);
      scrollToRoom(idx);
    } else {
      toast(item.name + (editing ? ' is in Storage. Your hands are full' : ' is in Storage'), 'good');
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
  // The plan is painted in four named passes, and every drawing function
  // says which of them it belongs to.
  //
  //   'floor'  the whole footprint the gym stands on: every room floor and
  //            every hallway floor, their markings and their slab edges.
  //            All of it is flat and none of it overlaps, so the order
  //            inside this pass cannot matter -- and because every floor
  //            is down before anything is built, no slab edge can ever be
  //            painted across a wall or a machine again.
  //   'build'  what stands on that footprint: walls, doorways, fittings,
  //            the light, the gear. Back to front, floor by floor.
  //   'live'   what moves -- the crowd, the money over a machine, the
  //            piece in your hands.
  //   'over'   the railings along the front of a floor, which stand in
  //            front of everything on it.
  //
  // 'floor' and 'build' together make the still-under bitmap and 'over'
  // the still-over one; both are stamped rather than redrawn, so a frame
  // only paints what actually moves. Before this the whole gym was redrawn
  // twenty times a second, which is what a phone could not keep up with.
  let scenePass = 'live';
  let stillUnder = null;
  let stillOver = null;
  let stillUnderCtx = null;
  let stillOverCtx = null;
  let stillKey = '';
  let stillOverUsed = false;
  let crowdBoxes = [];
  // Where the live pass actually painted on the floor being drawn: one box
  // per person and per piece of gear redrawn beside them. Null while no
  // floor has a wall in front of it to repair (see paintScene), so the
  // usual case costs nothing.
  let liveBoxes = null;
  function markLive(at, w, h) {
    if (liveBoxes) liveBoxes.push({ x: at.x - w / 2, y: at.y - h, w, h: h + 24 });
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
  // site is not drawn here any more -- it has a canvas of its own -- so this
  // is only the space the plan needs to breathe, and it is the same on every
  // side: an uneven margin puts the gym off centre in its own canvas, and
  // that is where it sits in the window whenever the whole plan fits.
  const WORLD_PAD = 34;
  const BLEED_TOP = 150;
  const BLEED_SIDE = 150;
  const BLEED_BOTTOM = 150;
  let PLAN_W = 480;
  let PLAN_H = 380;
  // The same, for the rooms that actually exist: the plot marked out for
  // the next room is part of the plan, but framing the view around it left
  // the gym small in the middle of a lot of empty ground.
  let BUILT_W = 480;
  let BUILT_H = 380;
  // And where it sits on the canvas, so the view can be put on the middle
  // of the gym rather than on the middle of one room.
  const builtBox = { x0: 0, y0: 0, x1: 480, y1: 380 };
  // The plan's extent in tiles, which is what the site is built around.
  const planBounds = { gx0: 0, gy0: 0, gx1: 4, gy1: 3 };
  let placements = [];
  let corridors = [];
  let preview = null;
  let previewCorridor = null;

  // The screen box a set of floors actually takes up, from the corners of
  // each of them rather than from the lattice box around the lot. A plan
  // shaped like a cross never reaches the corners of that box, so measuring
  // it that way claimed a few hundred pixels of empty ground on every side
  // -- which framed the gym smaller than the window could hold it and put
  // the middle of the box somewhere the gym is not.
  function screenBoxOf(rects) {
    const halfW = ROOM.tileW / 2;
    const halfH = ROOM.tileH / 2;
    const box = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity };
    rects.forEach((r) => {
      const gx1 = r.gx0 + r.cols;
      const gy1 = r.gy0 + r.rows;
      [[r.gx0, r.gy0], [gx1, r.gy0], [gx1, gy1], [r.gx0, gy1]].forEach((c) => {
        const x = (c[0] - c[1]) * halfW;
        const y = (c[0] + c[1]) * halfH;
        if (x < box.xMin) box.xMin = x;
        if (x > box.xMax) box.xMax = x;
        if (y < box.yMin) box.yMin = y;
        if (y > box.yMax) box.yMax = y;
      });
    });
    // Room to breathe on every side, and a wall's height above the back.
    box.xMin -= WORLD_PAD;
    box.xMax += WORLD_PAD;
    box.yMin -= ROOM.wallH + WORLD_PAD;
    box.yMax += WORLD_PAD;
    return box;
  }

  function rebuildPlan() {
    const theme = state.activeTheme;
    const count = activeRooms().length;
    placements = roomPlacements(theme, count);
    corridors = [];
    for (let i = 0; i < count - 1; i++) {
      corridors.push(corridorBetween(
        theme, hallwayFrom(theme, placements, i + 1), placements[i + 1], roomDirFor(theme, i),
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
        theme, hallwayFrom(theme, withNext, count), preview, roomDirFor(theme, count - 1),
      );
    }

    let minGx = Infinity;
    let maxGx = -Infinity;
    let minGy = Infinity;
    let maxGy = -Infinity;
    const all = placements.concat(corridors, preview ? [preview, previewCorridor] : []);
    all.forEach((r) => {
      minGx = Math.min(minGx, r.gx0);
      maxGx = Math.max(maxGx, r.gx0 + r.cols);
      minGy = Math.min(minGy, r.gy0);
      maxGy = Math.max(maxGy, r.gy0 + r.rows);
    });

    const full = screenBoxOf(all);
    // The same, for the rooms that actually exist: the plot marked out for
    // the next room is part of the plan, but framing the view around it left
    // the gym small in the middle of a lot of empty ground.
    const built = screenBoxOf(placements.concat(corridors));
    PLAN_W = Math.round(full.xMax - full.xMin);
    PLAN_H = Math.round(full.yMax - full.yMin);
    BUILT_W = Math.round(built.xMax - built.xMin);
    BUILT_H = Math.round(built.yMax - built.yMin);
    planBounds.gx0 = minGx;
    planBounds.gy0 = minGy;
    planBounds.gx1 = maxGx;
    planBounds.gy1 = maxGy;
    worldOrigin.x = -full.xMin + BLEED_SIDE;
    worldOrigin.y = -full.yMin + BLEED_TOP;
    builtBox.x0 = worldOrigin.x + built.xMin;
    builtBox.x1 = worldOrigin.x + built.xMax;
    builtBox.y0 = worldOrigin.y + built.yMin;
    builtBox.y1 = worldOrigin.y + built.yMax;
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

  // The zoom that frames the built gym in the window, whether or not the
  // view is currently using it.
  function fitZoomValue() {
    if (!stageScrollEl) return 0;
    const availW = stageScrollEl.clientWidth;
    // clientHeight counts the padding that keeps the plan clear of the bar
    // of controls standing on it. Fitting against that padding made the
    // plan bigger than the space it actually has, so it overflowed the
    // window and the view scrolled under the drag.
    const padTop = parseFloat(getComputedStyle(stageScrollEl).paddingTop) || 0;
    const availH = stageScrollEl.clientHeight - padTop;
    if (!availW || availH <= 0) return 0;
    // Frame the plan with a little of what it stands in, rather than butting
    // it against the edges: the site around it is drawn now, and a plan
    // fitted edge to edge hides all of it. The margin scales with the window
    // so a phone, where every pixel of plan counts, gives up almost none.
    // Enough of a margin that the place the gym stands in is part of the
    // picture -- the wall behind it, the drop and the steps in front --
    // rather than something out past the edges of the window.
    const margin = Math.min(130, availW * 0.13);
    // Framed on the rooms that are built, with a little of the plot beside
    // them showing: fitting the whole plan, plot included, drew the gym at
    // half the size it could be and left bands of empty ground around it.
    return Math.min(
      availW / (BUILT_W + margin * 2),
      availH / (BUILT_H + margin * 2),
      FIT_MAX,
    );
  }

  // How far out you are allowed to go: a little past the whole gym, and no
  // further. Zooming out to nothing left the map a stamp in the middle of a
  // window it could not fill, which is not a view of anything.
  const ZOOM_OUT_PAST_FIT = 0.7;
  function zoomFloor() {
    const fit = fitZoomValue();
    if (!fit) return ZOOM_MIN;
    return Math.max(ZOOM_MIN, Math.round(fit * ZOOM_OUT_PAST_FIT * 100) / 100);
  }

  // The site reaches this far past the plan on every side. The scrollable
  // area is the plan plus the same margin, so what you can pan over is
  // exactly what is drawn, and the plan sits in the middle of it.
  //
  // Far enough to fill the window at the furthest out the zoom will go, so
  // the site never ends inside the view. It is worked out from the window
  // and the plan, not from the zoom, so that working the zoom does not
  // resize the thing the view is scrolling over underneath it.
  const SITE_PAD_MIN = 400;
  let sitePad = SITE_PAD_MIN;
  // The stage keeps a band of padding at the top for the row of locations
  // that floats over it. The plan is laid out below that band, so the site
  // has to reach back up over it or the strip behind the row is the only
  // part of the window it does not cover.
  let siteTop = SITE_PAD_MIN;
  function measureSitePad() {
    if (!stageScrollEl || !stageScrollEl.clientWidth) return;
    const out = zoomFloor();
    const padTop = parseFloat(getComputedStyle(stageScrollEl).paddingTop) || 0;
    const needX = (stageScrollEl.clientWidth / out - BASE_W) / 2;
    const needY = (stageScrollEl.clientHeight / out - BASE_H) / 2;
    const want = Math.max(SITE_PAD_MIN, needX + 80, needY + 80);
    sitePad = Math.min(3000, Math.ceil(want / 100) * 100);
    siteTop = Math.min(3600, sitePad + Math.ceil(padTop / out / 100) * 100);
  }
  // The outer part of that margin is where the site runs out into the
  // location's own dark -- the same dark the stage behind it carries, so
  // there is no line where one becomes the other.
  function fitZoomToStage() {
    if (!stageScrollEl || userSetZoom) return;
    const fit = fitZoomValue();
    if (!fit) return;
    zoomLevel = Math.max(ZOOM_MIN, Math.round(fit * 100) / 100);
  }

  // `live` is a frame of a pinch. How far the site reaches is worked out
  // from the window and the zoom the plan is fitted at, neither of which
  // moves while fingers are down, so measuring it again on every move of a
  // gesture only costs a forced layout.
  function applyStageSizing(live) {
    forgetVisibleBox();
    if (!live) {
      // How far the site has to reach depends on the window and the plan, so
      // it is measured before anything is laid out against it.
      measureSitePad();
      // Sized before the ground is measured against it.
      queueGroundPaint();
      // Once the window knows its size, put the gym in the middle of it.
      if (!viewParked && stageScrollEl && stageScrollEl.clientWidth) {
        viewParked = true;
        setTimeout(parkView, 0);
      }
    }
    const off = sitePad * zoomLevel;
    if (zoomWrapEl) {
      zoomWrapEl.style.width = ((BASE_W + sitePad * 2) * zoomLevel) + 'px';
      zoomWrapEl.style.height = ((BASE_H + sitePad * 2) * zoomLevel) + 'px';
    }
    // Sized to what it takes up on screen rather than left at the plan's
    // full size and shrunk by a transform. Both look identical; the
    // difference is that the browser has to rasterise and composite a layer
    // the size of the element, and at the zoom a phone starts at that was a
    // two-thousand-pixel layer being redrawn to move somebody one step.
    floorCanvas.style.width = (BASE_W * zoomLevel) + 'px';
    floorCanvas.style.height = (BASE_H * zoomLevel) + 'px';
    floorCanvas.style.transform = 'translate(' + off + 'px,' + off + 'px)';
    floorCanvas.style.transformOrigin = 'top left';
    // The site rides the same transform, so panning and zooming move it
    // with the gym instead of asking for it to be drawn again.
    // The site rides the same zoom, so a pinch moves it with the gym; it is
    // drawn again once the pinch settles and the resolution has changed.
    layOutGround();
  }

  // Re-rendering on every frame of a pinch would mean redrawing a canvas
  // that is getting bigger as the gesture goes, so the gesture itself rides
  // on the cheap CSS transform and the sharper redraw lands once it settles.
  let resRepaintTimer = null;
  function queueResolutionRepaint() {
    clearTimeout(resRepaintTimer);
    resRepaintTimer = setTimeout(renderScene, 110);
  }

  function setZoom(next, live) {
    userSetZoom = true;
    // A hundredth of a step is three per cent of the way out and seven per
    // cent further out still, which a pinch feels as a ratchet. A
    // thousandth is below what the eye can pick out at any zoom.
    // While the fingers are moving the zoom is taken exactly as the span
    // between them gives it; rounding is for where it comes to rest, or the
    // anchor creeps a little on every step of the pinch.
    const want = live ? next : Math.round(next * 1000) / 1000;
    zoomLevel = Math.max(zoomFloor(), Math.min(ZOOM_MAX, want));
    applyStageSizing(live);
    queueResolutionRepaint();
    snapIfWhollyVisible();
  }

  // A gym that fits the window whole has nothing left to look around, so
  // the view goes back to the middle of it rather than staying wherever
  // zooming out from a corner happened to leave it.
  function snapIfWhollyVisible() {
    if (!stageScrollEl || gestureActive) return;
    const padTop = parseFloat(getComputedStyle(stageScrollEl).paddingTop) || 0;
    const availW = stageScrollEl.clientWidth;
    const availH = stageScrollEl.clientHeight - padTop;
    if (BUILT_W * zoomLevel <= availW && BUILT_H * zoomLevel <= availH) centreOnGym(true);
  }

  function centreOn(x, y, jump) {
    if (!stageScrollEl) return;
    // The row of locations floats over the top of the window, so the stage
    // holds that much padding above the plan. It is part of what scrolls,
    // so centring has to allow for it or the gym sits low by half a bar.
    const padTop = parseFloat(getComputedStyle(stageScrollEl).paddingTop) || 0;
    stageScrollEl.scrollTo({
      left: Math.max(0, (x + sitePad) * zoomLevel - stageScrollEl.clientWidth / 2),
      top: Math.max(0, (y + sitePad) * zoomLevel + padTop - stageScrollEl.clientHeight / 2),
      behavior: jump ? 'auto' : 'smooth',
    });
  }
  // The middle of the gym: the rooms that are built, which is also what the
  // auto-fit zoom frames. The plot the next room will stand on is left out
  // of both, or the gym sits off to one side of a lot of empty ground.
  function centreOnGym(jump) {
    centreOn((builtBox.x0 + builtBox.x1) / 2, (builtBox.y0 + builtBox.y1) / 2, jump);
  }
  function scrollToRoom(index, jump) {
    if (!stageScrollEl) return;
    // At the zoom the game picks for you the whole gym is in the window, so
    // there is nothing to scroll to: centre the map. Once you have set a
    // zoom of your own, the room you asked for is what you want to see.
    if (!userSetZoom) { centreOnGym(jump); return; }
    const place = placements[index];
    if (!place) return;
    const mid = cellCenter(place.gx0 + place.cols / 2 - 0.5, place.gy0 + place.rows / 2 - 0.5);
    centreOn(mid.x, mid.y, jump);
  }

  // The view is framed on the rooms that are built, which are now drawn
  // bigger than the window: without this the plan opens on the empty
  // ground in the top corner rather than on the gym. Only while the zoom
  // is the one the game chose -- once it has been pinched or wheeled, the
  // view is the player's to place.
  let viewParked = false;
  function parkView() {
    if (userSetZoom || !stageScrollEl) return;
    scrollToRoom(state.activeRoomIndex, true);
  }

  // Zoom is a CSS transform on the canvas, so a fixed bitmap would be blown
  // up when you zoom in and thrown away when you zoom out. Sizing the
  // backing store to what the plan actually occupies on screen -- its
  // logical size, times the zoom, times the device's pixels per CSS pixel
  // -- is one texel per screen pixel at every zoom level. The bounds stop a
  // big plan on a retina screen asking for an absurd texture, and stop a
  // zoomed-out one asking for a mushy little thumbnail.
  const MAX_BACKING_SCALE = 2.2;
  const MIN_BACKING_SCALE = 0.3;
  // How many bitmap pixels to spend per screen pixel. A phone reports three,
  // and painting the gym three deep is nine times the work of painting it
  // one deep for a sharpness nobody can see at arm's length. Two is the
  // ceiling, and a device that still cannot keep up is stepped down until
  // it can -- a steady picture is worth more than a crisp one.
  const PIXEL_STEPS = [2, 1.5, 1.15, 0.9];
  let pixelStep = 0;
  function pixelBudget() {
    return PIXEL_STEPS[pixelStep];
  }

  function fitCanvasResolution() {
    const dpr = Math.min(pixelBudget(), window.devicePixelRatio || 1);
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

  // A location's colours as painted: the theme's own, with whatever wall
  // and floor paint has been put on over them.
  function colorsFor(theme) {
    const base = THEME_COLORS[theme] || THEME_COLORS.garage;
    const d = designState();
    const wall = WALL_PAINTS.find((w) => w.id === (previewFor('wall', theme) || d.walls[theme]));
    const floor = FLOOR_PAINTS.find((f) => f.id === (previewFor('floor', theme) || d.floors[theme]));
    if (!wall && !floor) return base;
    const out = Object.assign({}, base);
    if (wall) { out.wallL = wall.color; out.wallR = shade(wall.color, -22); }
    if (floor) { out.floorA = floor.a; out.floorB = floor.b; }
    return out;
  }
  const THEME_COLORS = {
    // Concrete bays with steel walls, in a dark yard.
    garage: { floorA: '#6a635a', floorB: '#5e574f', wallL: '#3d434c', wallR: '#30353d', bgTop: '#1a1d22', bg: '#121418' },
    // Stone rooms with board floors, in a cellar cut out of the rock: the
    // same stone as the cellar's own walls and the same timber as its
    // posts, so the rooms belong to the place they stand in.
    basement: { floorA: '#6e4e30', floorB: '#604227', wallL: '#5f5249', wallR: '#4b4038', bgTop: '#1a1613', bg: '#120f0d' },
    // Pavers on a roof at night; the wall colour is the stair housings.
    rooftop: { floorA: '#5d636d', floorB: '#535962', wallL: '#414a5c', wallR: '#333b4b', bgTop: '#1c2638', bg: '#0f1522' },
    // Warm decking over deep water; the wall colour is the timber.
    boardwalk: { floorA: '#d6a663', floorB: '#c69552', wallL: '#8f5e33', wallR: '#6f4523', bgTop: '#106079', bg: '#0b4560' },
  };
  // The colour the ground around the plan is washed with -- the theme's own
  // light spilling out past the rooms.
  const AMBIENT_WASH = {
    garage: 'rgba(150, 110, 60, 0.42)',
    basement: 'rgba(150, 92, 40, 0.17)',
    rooftop: 'rgba(80, 110, 160, 0.30)',
    boardwalk: 'rgba(70, 160, 180, 0.40)',
  };

  // Per-theme light: the colour of the downlights and of the pool they
  // throw on the floor.
  const LIGHT_COLORS = {
    // Strip lights in the bays; sconces in the cellar; small lamps on the
    // roof's railings; lanterns on the pier.
    garage: { glow: 'rgba(255,190,110,0.32)', bulb: '#ffe3ae' },
    basement: { glow: 'rgba(255,170,90,0.30)', bulb: '#ffd08a' },
    rooftop: { glow: 'rgba(255,225,170,0.30)', bulb: '#ffe9b8' },
    boardwalk: { glow: 'rgba(255,205,130,0.34)', bulb: '#ffdf9c' },
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
    rower: 2.1,
    boxingring: 2.8,
    climbingwall: 2.4,
    stairclimber: 1.3,
    cryo: 1.2,
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
  // How much of a shadow a piece casts, as a share of the usual one. Flat
  // things cast none; things on a slim base cast a little.
  const SHADOW_SCALE = {
    mat: 0, boxingring: 0,
    dumbbell: 0.55, palm: 0.6, cooler: 0.6, neon: 0.45, mirrorwall: 0.55, climbingwall: 0.6,
  };

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
  // Swappable, because a finish bought in the design shop repaints every
  // machine: the builders read these by name, and applyFinish() sets them
  // for the duration of one build.
  let STEEL = '#9fb0c6';
  let STEEL_LT = '#c3d0de';
  let FRAME = '#5d6a80';
  let FRAME_DK = '#3d4658';
  let PAD = '#2b3140';
  let RUBBER = '#20232b';
  let WEIGHT = '#454f63';
  let GLOW = '#5fd0e6';
  const STOCK_PALETTE = { STEEL, STEEL_LT, FRAME, FRAME_DK, PAD, RUBBER, WEIGHT, GLOW };
  function setPalette(pal) {
    STEEL = pal.STEEL; STEEL_LT = pal.STEEL_LT; FRAME = pal.FRAME; FRAME_DK = pal.FRAME_DK;
    PAD = pal.PAD; RUBBER = pal.RUBBER; WEIGHT = pal.WEIGHT; GLOW = pal.GLOW;
  }
  // Only the machines take a finish: decor, the desk and the counters keep
  // their own colours whatever the gym's gear is dressed in.
  function finishFor(itemId) {
    const cat = CATEGORY[itemId];
    if (cat !== 'strength' && cat !== 'cardio' && cat !== 'recovery') return 'standard';
    return previewFor('finish') || designState().finish || 'standard';
  }
  function applyFinish(id) {
    const f = FINISHES.find((x) => x.id === id) || FINISHES[0];
    setPalette(Object.assign({}, STOCK_PALETTE, f.palette));
  }

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
    // An A-frame with two tiers of dumbbells racked along it. The ends are
    // posts and a foot rail rather than one slab the depth of the rack,
    // which read as the arm of a sofa; and the ends and the two tiers are
    // drawn back to front for the turn, or on the two turns where the far
    // tier is nearest the viewer it was painted over by the near one.
    dumbbellrack: (ctx, b) => {
      const L = 1.55, D = 0.46, H = 0.76;
      const endU = L / 2 - 0.05;
      const postV = D / 2 - 0.04;
      const endFrame = (su) => () => {
        [-1, 1].forEach((sv) => {
          drawIsoBox(ctx, b, su * endU * M, sv * postV * M, 0.045 * M, 0.045 * M,
            (sv > 0 ? H : H * 0.72) * MH, FRAME, 0);
        });
        // The foot the two posts stand on, and the brace across their tops.
        drawIsoBar(ctx, b, su * endU * M, -(postV + 0.05) * M, su * endU * M, (postV + 0.05) * M,
          0.05 * MH, 7, FRAME_DK);
        drawIsoBar(ctx, b, su * endU * M, -postV * M, su * endU * M, postV * M,
          H * 0.72 * MH, 4, FRAME);
      };
      // One shelf of dumbbells: the rail, then five of them along it.
      const tier = (h, v) => () => {
        drawIsoBox(ctx, b, 0, v * M, (L / 2 - 0.04) * M, 0.10 * M, 0.045 * MH, STEEL, h * MH);
        for (let i = -2; i <= 2; i++) {
          const u = i * 0.30;
          const lift = (h + 0.095) * MH;
          drawIsoBar(ctx, b, u * M, (v - 0.085) * M, u * M, (v + 0.085) * M, lift, 3.5, STEEL_LT);
          [-0.115, 0.115].forEach((dv) => {
            const at = isoScreenPoint(b, u * M, (v + dv) * M, lift);
            drawIsoDisc(ctx, at, 4.4, 5.4, WEIGHT);
            drawIsoDisc(ctx, at, 2.1, 2.6, '#b4453c');
          });
        }
      };
      drawParts([
        { u: -endU, v: 0, draw: endFrame(-1) },
        { u: 0, v: -0.075, draw: tier(0.60, -0.075) },
        { u: 0, v: 0.125, draw: tier(0.33, 0.125) },
        { u: endU, v: 0, draw: endFrame(1) },
      ]);
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
      // The flue off the stove, out through the roof.
      drawIsoBox(ctx, b, -(L / 2 - 0.34) * M, -(D / 2 - 0.30) * M, 0.07 * M, 0.07 * M, 0.52 * MH, '#4a4d55', (H + 0.10) * MH);
      drawIsoBox(ctx, b, -(L / 2 - 0.34) * M, -(D / 2 - 0.30) * M, 0.12 * M, 0.12 * M, 0.05 * MH, '#3a3d44', (H + 0.62) * MH);
      // Board lines down whichever of the two long faces is turned toward
      // the viewer, so the cabin reads as timber from either side.
      ctx.save();
      const boardFace = faceShows(1, 0) ? 1 : -1;
      for (let i = -2; i <= 2; i++) {
        const p0 = isoScreenPoint(b, boardFace * (L / 2) * M, i * 0.24 * M, 0.04 * MH);
        const p1 = isoScreenPoint(b, boardFace * (L / 2) * M, i * 0.24 * M, (H - 0.04) * MH);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p0.x + 1.6, p0.y);
        ctx.lineTo(p1.x + 1.6, p1.y);
        ctx.strokeStyle = 'rgba(255,226,180,0.07)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
      // The door is on one face only: from behind, the cabin is just timber.
      if (!faceShows(1, 0)) return;
      const u = (L / 2) * M;
      const quad = (v0, v1, z0, z1, fill, stroke, lw) => {
        const a = isoScreenPoint(b, u, v0 * M, z0 * MH);
        const c = isoScreenPoint(b, u, v1 * M, z0 * MH);
        const d = isoScreenPoint(b, u, v1 * M, z1 * MH);
        const e = isoScreenPoint(b, u, v0 * M, z1 * MH);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.lineTo(e.x, e.y);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
      };
      // A framed door with a long amber pane in it, a handle, and the warm
      // it lets out at the foot -- rather than one lit rectangle.
      quad(-0.34, 0.38, 0.04, 1.54, '#5c4128', 'rgba(0,0,0,0.45)', 1.5);
      quad(-0.27, 0.31, 0.11, 1.47, '#7a5836', null);
      quad(-0.20, 0.24, 0.46, 1.38, 'rgba(255,168,72,0.9)', '#4a3320', 1.6);
      [0.80, 1.10].forEach((z) => quad(-0.20, 0.24, z, z + 0.025, 'rgba(74,51,32,0.75)', null));
      quad(0.26, 0.30, 0.66, 0.94, '#d9c08a', null);
      // The light out of the pane, and the step under the door.
      const foot = isoScreenPoint(b, u + 0.5, 0.02 * M, 0);
      drawGlow(isoScreenPoint(b, u, 0.02 * M, 0.9 * MH), 26, '#ffb257', 0.42);
      drawIsoSlab(ctx, b, (L / 2 + 0.22) * M, 0.02 * M, 0.22 * M, 0.42 * M, 0.035 * MH, '#6d4e31', 3);
      floorCtx.save();
      floorCtx.globalCompositeOperation = 'lighter';
      const pool = floorCtx.createRadialGradient(foot.x, foot.y, 1, foot.x, foot.y, 34);
      pool.addColorStop(0, 'rgba(255,150,60,0.22)');
      pool.addColorStop(1, 'rgba(255,150,60,0)');
      floorCtx.fillStyle = pool;
      floorCtx.beginPath();
      floorCtx.ellipse(foot.x, foot.y, 34, 17, 0, 0, Math.PI * 2);
      floorCtx.fill();
      floorCtx.restore();
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

    // A rail with a seat that slides on it, a flywheel housing at the far
    // end and the handle on its chain.
    rower: (ctx, b) => {
      const L = 2.10;
      const rail = () => {
        drawIsoBox(ctx, b, 0.15 * M, 0, (L / 2 - 0.30) * M, 0.06 * M, 0.34 * MH, FRAME, 0.09 * MH);
        drawIsoBox(ctx, b, 0.15 * M, 0, (L / 2 - 0.30) * M, 0.11 * M, 0.09 * MH, FRAME_DK, 0);
      };
      const seat = () => {
        drawIsoBox(ctx, b, 0.10 * M, 0, 0.19 * M, 0.16 * M, 0.10 * MH, PAD, 0.43 * MH);
      };
      // The flywheel end: a housing, a real disc for the wheel, and the
      // handle hanging off it on a chain.
      const head = () => {
        const u = -(L / 2 - 0.22);
        drawIsoBox(ctx, b, u * M, 0, 0.22 * M, 0.24 * M, 0.30 * MH, FRAME_DK, 0.06 * MH);
        drawIsoDisc(ctx, isoScreenPoint(b, u * M, 0, 0.46 * MH), 13, 15, WEIGHT);
        drawIsoDisc(ctx, isoScreenPoint(b, u * M, 0, 0.46 * MH), 4, 4.5, STEEL);
        const hook = isoScreenPoint(b, u * M, 0, 0.44 * MH);
        const grip = isoScreenPoint(b, (u + 0.42) * M, 0, 0.40 * MH);
        ctx.beginPath();
        ctx.moveTo(hook.x, hook.y);
        ctx.lineTo(grip.x, grip.y);
        ctx.strokeStyle = 'rgba(210,222,236,0.7)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        drawIsoBar(ctx, b, (u + 0.42) * M, -0.16 * M, (u + 0.42) * M, 0.16 * M,
          0.40 * MH, 5, STEEL_LT);
      };
      // The footplates, at the near end where you sit down.
      const feet = () => {
        [-1, 1].forEach((sgn) => {
          drawIsoBox(ctx, b, (L / 2 - 0.22) * M, sgn * 0.17 * M, 0.14 * M, 0.09 * M,
            0.16 * MH, '#39424f', 0.06 * MH);
        });
      };
      drawParts([
        { u: -(L / 2 - 0.22), v: 0, draw: head },
        { u: 0.15, v: 0, draw: rail },
        { u: 0.10, v: 0, draw: seat },
        { u: L / 2 - 0.22, v: 0, draw: feet },
      ]);
    },

    // A raised canvas with four corner posts and ropes strung between them.
    boxingring: (ctx, b) => {
      const S = 2.45, H = 0.55;
      const apron = 0.19 * MH;
      // The apron round the foot of the platform, the frame above it, and
      // the canvas laid over the top -- in that order. The apron used to
      // go on last, and the top face of it painted over the canvas, which
      // left the ring looking like a red slab with a grey square on it.
      drawIsoBox(ctx, b, 0, 0, (S / 2 + 0.03) * M, (S / 2 + 0.03) * M, apron, '#b0453c', 0);
      drawIsoBox(ctx, b, 0, 0, (S / 2) * M, (S / 2) * M, H * MH - apron, '#3a3f4b', apron);
      drawIsoSlab(ctx, b, 0, 0, (S / 2 - 0.03) * M, (S / 2 - 0.03) * M, H * MH, '#c8d1dc', 4);
      const post = (su, sv) => () => {
        drawIsoBox(ctx, b, su * (S / 2 - 0.10) * M, sv * (S / 2 - 0.10) * M,
          0.07 * M, 0.07 * M, 1.05 * MH, '#d9a53f', H * MH);
        // A padded corner on the two the fighters use.
        if (su === sv) {
          drawIsoBox(ctx, b, su * (S / 2 - 0.10) * M, sv * (S / 2 - 0.10) * M,
            0.13 * M, 0.13 * M, 0.42 * MH, su > 0 ? '#c03a30' : '#2f5f9e', (H + 0.30) * MH);
        }
      };
      const ropes = () => {
        [0.35, 0.62, 0.89].forEach((h) => {
          [[1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1], [-1, 1, 1, 1]].forEach(([au, av, bu, bv]) => {
            drawIsoBar(ctx, b, au * (S / 2 - 0.10) * M, av * (S / 2 - 0.10) * M,
              bu * (S / 2 - 0.10) * M, bv * (S / 2 - 0.10) * M, (H + h) * MH, 3, '#e8e2d6');
          });
        });
      };
      drawParts([
        { u: -1, v: -1, draw: post(-1, -1) },
        { u: -1, v: 1, draw: post(-1, 1) },
        { u: 1, v: -1, draw: post(1, -1) },
        { u: 0, v: 0, draw: ropes },
        { u: 1, v: 1, draw: post(1, 1) },
      ]);
    },

    // A tall panel of holds, with a crash mat at its foot.
    climbingwall: (ctx, b) => {
      const W = 2.30, H = 3.10;
      const face = 0.13 * M;
      // The crash mat at the foot, a thick pad with a border round it.
      drawIsoSlab(ctx, b, 0.46 * M, 0, 0.46 * M, (W / 2 + 0.08) * M, 0.02 * MH, '#22343d', 5);
      drawIsoSlab(ctx, b, 0.46 * M, 0, 0.38 * M, (W / 2 - 0.02) * M, 0.055 * MH, '#33505c', 5);
      // The board, its capping, and the posts it is framed on.
      drawIsoBox(ctx, b, 0, 0, 0.12 * M, W / 2 * M, H * MH, '#5a6270', 0);
      drawIsoBox(ctx, b, 0, 0, 0.145 * M, (W / 2 + 0.04) * M, 0.10 * MH, '#3b424e', H * MH);
      [-1, 1].forEach((sgn) => {
        drawIsoBox(ctx, b, 0, sgn * (W / 2 + 0.07) * M, 0.15 * M, 0.06 * M, (H + 0.05) * MH, FRAME_DK, 0);
      });
      // The face is only worth dressing when it is the one turned toward
      // the viewer; from behind it is the back of a board.
      if (!faceShows(1, 0)) return;
      const at = (v, h) => isoScreenPoint(b, face, v * M, h * MH);
      const line = (a, c, color, width) => {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      };
      ctx.save();
      // The sheets it is built of, and a lit edge along the top of each.
      [0.80, 1.58, 2.36].forEach((h) => {
        line(at(-W / 2 + 0.03, h), at(W / 2 - 0.03, h), 'rgba(0,0,0,0.26)', 1.6);
        line(at(-W / 2 + 0.03, h + 0.03), at(W / 2 - 0.03, h + 0.03), 'rgba(255,255,255,0.06)', 1.2);
      });
      line(at(0, 0.05), at(0, H - 0.08), 'rgba(0,0,0,0.20)', 1.4);
      // The holds: a route up the board, bigger ones where you pull hard.
      const HOLDS = [
        [0.34, -0.78, 5.4], [0.58, 0.42, 4.2], [0.92, -0.22, 6.2], [1.06, 0.86, 4.0],
        [1.28, -0.62, 4.6], [1.52, 0.16, 6.0], [1.74, -0.90, 4.2], [1.92, 0.66, 5.2],
        [2.16, -0.34, 4.4], [2.34, 0.94, 4.0], [2.52, 0.24, 5.6], [2.72, -0.70, 4.4],
        [0.72, -1.00, 4.0], [1.40, 1.00, 4.2], [2.05, -1.02, 4.0], [2.62, 1.00, 4.2],
      ];
      const COLORS = ['#d94f43', '#3fa87e', '#e0b93f', '#4f9ad1', '#c46fd1', '#e08a3f'];
      HOLDS.forEach(([h, v, r], i) => {
        const pt = at(v, h);
        ctx.beginPath();
        ctx.ellipse(pt.x + 1, pt.y + 1.6, r, r * 0.74, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, r, r * 0.74, 0, 0, Math.PI * 2);
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(pt.x - r * 0.28, pt.y - r * 0.3, r * 0.4, r * 0.26, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.34)';
        ctx.fill();
      });
      // The anchors at the top and the rope hanging off them.
      const aL = at(-0.5, H - 0.14);
      const aR = at(0.5, H - 0.14);
      [aL, aR].forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.strokeStyle = STEEL_LT;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      const rope = at(0.5, 0.1);
      ctx.beginPath();
      ctx.moveTo(aR.x, aR.y + 3);
      ctx.quadraticCurveTo(rope.x + 7, (aR.y + rope.y) / 2, rope.x + 2, rope.y);
      ctx.strokeStyle = '#c8b78a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    },

    // A stepper: two pedals on a housing, with rails to hold on to.
    stairclimber: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.42 * M, 0.36 * M, 0.62 * MH, FRAME_DK, 0);
      [-1, 1].forEach((sgn) => {
        drawIsoBox(ctx, b, 0.16 * M, sgn * 0.19 * M, 0.26 * M, 0.14 * M, 0.10 * MH,
          '#39424f', (sgn > 0 ? 0.70 : 0.52) * MH);
      });
      // The mast and the rails you hold, out in front of the pedals.
      drawIsoBox(ctx, b, -0.34 * M, 0, 0.07 * M, 0.10 * M, 1.35 * MH, FRAME, 0.55 * MH);
      [-1, 1].forEach((sgn) => {
        drawIsoBar(ctx, b, -0.32 * M, sgn * 0.30 * M, 0.20 * M, sgn * 0.30 * M,
          1.10 * MH, 5, STEEL_LT);
      });
      if (faceShows(-1, 0)) {
        const p = isoScreenPoint(b, -0.40 * M, 0, 1.60 * MH);
        ctx.fillStyle = FRAME_DK;
        ctx.fillRect(p.x - 11, p.y - 14, 22, 15);
        ctx.fillStyle = GLOW;
        ctx.fillRect(p.x - 8, p.y - 11, 16, 9);
      }
    },

    // A cryo chamber: a drum with a lit rim and a door on the front.
    cryo: (ctx, b) => {
      drawIsoBox(ctx, b, 0, 0, 0.50 * M, 0.50 * M, 0.16 * MH, '#39424f', 0);
      drawIsoBox(ctx, b, 0, 0, 0.44 * M, 0.44 * M, 1.55 * MH, '#dfe7ef', 0.16 * MH);
      drawIsoBox(ctx, b, 0, 0, 0.48 * M, 0.48 * M, 0.09 * MH, '#9fb0c6', 1.71 * MH);
      // A band of cold light round the top, and the door on the face you
      // are looking at.
      drawIsoBox(ctx, b, 0, 0, 0.45 * M, 0.45 * M, 0.07 * MH, 'rgba(120,220,245,0.85)', 1.62 * MH);
      if (faceShows(1, 0)) {
        const top = isoScreenPoint(b, 0.44 * M, -0.26 * M, 1.30 * MH);
        const bot = isoScreenPoint(b, 0.44 * M, 0.26 * M, 0.22 * MH);
        ctx.fillStyle = 'rgba(150,205,230,0.45)';
        ctx.fillRect(Math.min(top.x, bot.x), Math.min(top.y, bot.y),
          Math.abs(bot.x - top.x), Math.abs(bot.y - top.y));
        ctx.strokeStyle = 'rgba(40,60,80,0.5)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(Math.min(top.x, bot.x), Math.min(top.y, bot.y),
          Math.abs(bot.x - top.x), Math.abs(bot.y - top.y));
      }
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
      g.addColorStop(0, 'rgba(206,230,244,0.88)');
      g.addColorStop(0.62, 'rgba(160,192,214,0.78)');
      g.addColorStop(1, 'rgba(118,150,176,0.72)');
      ctx.fillStyle = g;
      ctx.fill();
      // Glass, not a grey panel: the room's own floor coming back at the
      // bottom of it, and a band of light across the face.
      ctx.save();
      ctx.clip();
      const floorTop = a.y - h * 0.34;
      const refl = ctx.createLinearGradient(0, floorTop, 0, a.y);
      refl.addColorStop(0, 'rgba(28,38,52,0)');
      refl.addColorStop(1, 'rgba(28,38,52,0.42)');
      ctx.fillStyle = refl;
      ctx.fillRect(Math.min(a.x, c.x) - 4, floorTop, Math.abs(c.x - a.x) + 8, a.y - floorTop + 4);
      const sheen = ctx.createLinearGradient(a.x, a.y - h, c.x, a.y);
      sheen.addColorStop(0.30, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.44, 'rgba(255,255,255,0.30)');
      sheen.addColorStop(0.52, 'rgba(255,255,255,0.10)');
      sheen.addColorStop(0.62, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(Math.min(a.x, c.x) - 4, a.y - h - 4, Math.abs(c.x - a.x) + 8, h + 8);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y);
      ctx.lineTo(c.x, c.y - h); ctx.lineTo(a.x, a.y - h);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
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
  function maskAmbienceEdges(fade) {
    fade = fade || 46;
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
    const colors = colorsFor(theme);
    drawGroundLattice(colors);
    drawSiteWash(AMBIENT_WASH[theme] || AMBIENT_WASH.garage);
    drawSiteVignette();
    maskAmbienceEdges();
  }

  // The site the plan stands on has a canvas of its own, laid exactly over
  // the plan's and carrying the same transform, so it pans and zooms with
  // the gym without being redrawn. That is the point: the rock a cellar is
  // cut out of and the sea a pier stands in are world content, fixed to the
  // lattice, so they belong in the plan's coordinates.
  //
  // It used to be a window-sized canvas redrawn from the scroll position on
  // every scroll event. On a phone one of those repaints took a third of a
  // second, so a drag stuttered and the site slid about behind the gym.
  // Now it is redrawn only when the plan, the location or the hour changes.
  //
  // The stage behind it carries the location's flat colour, and the site
  // fades out before its own edges, so the two meet with no line to see.
  const groundCanvas = document.getElementById('tycoon-ground');
  const groundCtx = groundCanvas ? groundCanvas.getContext('2d') : null;
  let groundKey = '';
  // The site used to be one picture of the whole plan, and one picture of
  // the whole plan cannot be sharp: at the zoom a phone frames the gym at
  // it is already a couple of thousand pixels across, so it was drawn at
  // about half that and stretched -- and pinching in stretched it further,
  // which is why the water and the buildings went soft the moment you
  // looked closely at them.
  //
  // It is drawn to fit the window instead, at the resolution the screen is
  // actually showing, reaching half a window past every edge so that
  // panning does not need it drawn again. Because it is drawn in the site's
  // own coordinates, with the whole site's rectangle handed to the
  // drawings, the sky, the sea and the yard are laid out exactly where they
  // were: what changes is only how much of them is kept.
  const SITE_MAX_PIXELS = 3.6e6;
  // How far past the window it reaches, as a fraction of the window.
  const SITE_MARGIN = 0.55;
  let groundCover = null;
  // The site reaches this far past the plan canvas on every side, so that
  // at the zoom a phone frames the gym at there is still site out beyond
  // the window rather than an edge in the middle of the view.
  const SITE_FADE = 300;
  function drawSiteFalloff(colors, r) {
    const band = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const g = floorCtx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, hexA(colors.bg, 0));
      g.addColorStop(1, hexA(colors.bg, 1));
      floorCtx.fillStyle = g;
      floorCtx.fillRect(rx, ry, rw, rh);
    };
    const f = SITE_FADE;
    const w = r.x1 - r.x0;
    const h = r.y1 - r.y0;
    band(r.x0 + f, 0, r.x0, 0, r.x0, r.y0, f, h);
    band(r.x1 - f, 0, r.x1, 0, r.x1 - f, r.y0, f, h);
    band(0, r.y0 + f, 0, r.y0, r.x0, r.y0, w, f);
    band(0, r.y1 - f, 0, r.y1, r.x0, r.y1 - f, w, f);
  }
  // The whole site, in the plan's own coordinates: what every drawing below
  // is handed, whichever piece of it is being kept.
  function siteRect() {
    return { x0: -sitePad, y0: -siteTop, x1: BASE_W + sitePad, y1: BASE_H + sitePad };
  }
  // Where the piece in hand sits on the stage. The wrap's own corner is the
  // site's corner plus the margin, so a point of the plan lands that far in.
  function layOutGround() {
    if (!groundCanvas || !groundCover) return;
    groundCanvas.style.transformOrigin = 'top left';
    groundCanvas.style.transform = 'translate(' + ((groundCover.x0 + sitePad) * zoomLevel) + 'px,'
      + ((groundCover.y0 + sitePad) * zoomLevel) + 'px)';
    groundCanvas.style.width = ((groundCover.x1 - groundCover.x0) * zoomLevel) + 'px';
    groundCanvas.style.height = ((groundCover.y1 - groundCover.y0) * zoomLevel) + 'px';
  }
  function paintStageGround(force) {
    if (!groundCtx || !stageScrollEl || !BASE_W || !BASE_H) return;
    const seen = measureVisibleBox();
    if (!seen) return;
    const site = siteRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // The hour's tint is keyed coarsely: a step of a fiftieth is below what
    // the eye picks up, and keying it any finer had the site repainting
    // every few seconds through dusk and dawn.
    const key = [state.activeTheme, placements.length, sitePad, siteTop,
      Math.round(skyWash().a * 50), Math.round(dpr * zoomLevel * 100)].join('|');
    // What of the site the window needs, and whether what is in hand holds
    // it already. Clamped to the site, because past its edges there is
    // nothing to hold.
    const need = {
      x0: Math.max(site.x0, seen.x0), y0: Math.max(site.y0, seen.y0),
      x1: Math.min(site.x1, seen.x1), y1: Math.min(site.y1, seen.y1),
    };
    const held = groundCover && key === groundKey
      && need.x0 >= groundCover.x0 - 0.5 && need.y0 >= groundCover.y0 - 0.5
      && need.x1 <= groundCover.x1 + 0.5 && need.y1 <= groundCover.y1 + 0.5;
    if (held && !force) return;

    const mw = (seen.x1 - seen.x0) * SITE_MARGIN;
    const mh = (seen.y1 - seen.y0) * SITE_MARGIN;
    const cover = {
      x0: Math.max(site.x0, seen.x0 - mw), y0: Math.max(site.y0, seen.y0 - mh),
      x1: Math.min(site.x1, seen.x1 + mw), y1: Math.min(site.y1, seen.y1 + mh),
    };
    const cw = cover.x1 - cover.x0;
    const ch = cover.y1 - cover.y0;
    if (!(cw > 1 && ch > 1)) return;
    const k = Math.max(0.2, Math.min(dpr * zoomLevel, Math.sqrt(SITE_MAX_PIXELS / (cw * ch))));
    const bw = Math.max(1, Math.round(cw * k));
    const bh = Math.max(1, Math.round(ch * k));
    if (groundCanvas.width !== bw || groundCanvas.height !== bh) {
      groundCanvas.width = bw;
      groundCanvas.height = bh;
    }
    groundKey = key;
    groundCover = cover;
    layOutGround();

    const colors = colorsFor(state.activeTheme);
    const live = floorCtx;
    floorCtx = groundCtx;
    // The site's own coordinates, with the corner of this piece of it at the
    // corner of the bitmap. Every drawing is asked for the whole site; the
    // canvas keeps the part of it that lands here.
    groundCtx.setTransform(k, 0, 0, k, -cover.x0 * k, -cover.y0 * k);
    groundCtx.clearRect(cover.x0, cover.y0, cw, ch);
    try {
      groundCtx.fillStyle = colors.bg;
      groundCtx.fillRect(cover.x0, cover.y0, cw, ch);
      drawSiteTexture(state.activeTheme, colors, site);
      drawSiteWash(AMBIENT_WASH[state.activeTheme] || AMBIENT_WASH.garage);
      drawSiteProps(state.activeTheme, colors, site);
      // Out into the dark first, then the hour over all of it -- so the
      // colour the site ends on is the colour the stage carries, tint and
      // all, and there is no edge to see.
      drawSiteFalloff(colors, site);
      const sky = skyWash();
      if (sky.a > 0.002) {
        groundCtx.fillStyle = 'rgba(' + sky.r + ',' + sky.g + ',' + sky.b + ',' + sky.a.toFixed(3) + ')';
        groundCtx.fillRect(cover.x0, cover.y0, cw, ch);
      }
    } finally {
      groundCtx.setTransform(1, 0, 0, 1, 0, 0);
      floorCtx = live;
    }
    paintStageBackdrop(colors);
  }

  // Everything past the site is the location's own dark, tinted by the hour
  // the same way the site is. It is the stage's own background colour, so
  // it reaches the edges of the window at any zoom and costs nothing to
  // keep there.
  function paintStageBackdrop(colors) {
    if (!stageScrollEl) return;
    const sky = skyWash();
    const base = toRgb(colors.bg);
    const a = Math.min(1, Math.max(0, sky.a));
    const mix = (c, s2) => Math.round(c * (1 - a) + s2 * a);
    stageScrollEl.style.backgroundColor = 'rgb(' + mix(base.r, sky.r) + ','
      + mix(base.g, sky.g) + ',' + mix(base.b, sky.b) + ')';
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
  // A kerb along the back edges of the main floor where nothing joins it:
  // the slab's upstand, in the wall colour, so the paint shows on a
  // location that has no room with walls yet.
  const KERB_H = 18;
  function drawHubKerb(place, colors) {
    [['n', 'gx'], ['w', 'gy']].forEach(([side, axis]) => {
      exposedRuns(place, side).forEach(([from, to]) => {
        const a = edgePoint(place, side, from);
        const b = edgePoint(place, side, to);
        drawWallRun([isoPoint(a.gx, a.gy), isoPoint(b.gx, b.gy)], [axis], KERB_H, colors, ['cap', 'cap']);
      });
    });
  }
  function drawHubLight(place, light) {
    const c = isoPoint(place.gx0 + place.cols / 2, place.gy0 + place.rows / 2);
    const rx = (place.cols + place.rows) * ROOM.tileW * 0.22;
    const ry = rx * 0.5;
    const pool = floorCtx.createRadialGradient(c.x, c.y, 2, c.x, c.y, rx);
    pool.addColorStop(0, scaleAlpha(light.glow, lampBoost() * 0.7));
    pool.addColorStop(0.6, scaleAlpha(light.glow, lampBoost() * 0.24));
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    floorCtx.save();
    floorCtx.globalCompositeOperation = 'lighter';
    floorCtx.translate(c.x, c.y);
    floorCtx.scale(1, ry / rx);
    floorCtx.translate(-c.x, -c.y);
    floorCtx.fillStyle = pool;
    floorCtx.beginPath();
    floorCtx.arc(c.x, c.y, rx, 0, Math.PI * 2);
    floorCtx.fill();
    floorCtx.restore();
  }
  function drawCeilingStrip(north, east, west, light) {
    drawLightRails([[north, east], [north, west]], light, styleOf(state.activeTheme).light);
  }
  // The fittings that light a walled room: a rail of downlights, strip
  // lights along the top of the wall, or sconces bracketed to it.
  function drawLightRails(walls, light, style) {
    const bulbColor = light.bulb || '#eaf7ff';
    const lampH = style === 'sconce' ? 0.70 : 0.9;
    walls.forEach(([from, to]) => {
      if (style === 'rail') {
        const railA = wallPoint(from, to, 0.05, 0.92);
        const railB = wallPoint(from, to, 0.95, 0.92);
        // A soft line of light along the rail, then the rail itself over it.
        floorCtx.save();
        floorCtx.globalCompositeOperation = 'lighter';
        floorCtx.beginPath();
        floorCtx.moveTo(railA.x, railA.y);
        floorCtx.lineTo(railB.x, railB.y);
        floorCtx.strokeStyle = hexA(bulbColor, 0.10);
        floorCtx.lineWidth = 9;
        floorCtx.lineCap = 'round';
        floorCtx.stroke();
        floorCtx.restore();
        floorCtx.beginPath();
        floorCtx.moveTo(railA.x, railA.y);
        floorCtx.lineTo(railB.x, railB.y);
        floorCtx.strokeStyle = 'rgba(198, 214, 228, 0.3)';
        floorCtx.lineWidth = 2.5;
        floorCtx.stroke();
      }

      // Longer wall, more lamps -- a bigger room should read as better lit,
      // not as the same three lights stretched further apart.
      const run = Math.hypot(to.x - from.x, to.y - from.y);
      const lamps = Math.max(run < 150 ? 2 : 3, Math.min(style === 'sconce' ? 3 : 5, Math.round(run / 95)));
      for (let i = 0; i < lamps; i++) {
        const t = 0.2 + (i * 0.6) / (lamps - 1);
        const lamp = wallPoint(from, to, t, lampH);
        const foot = wallPoint(from, to, t, 0);

        // The wash down the wall. It used to be one flat cone with a
        // straight top-to-bottom gradient, which read as a grey triangle
        // stuck on the wall: hard down both sides and cut off square at the
        // floor. Now the shape is a wide cone used only as a mask, and the
        // light inside it falls away from the lamp in every direction, so
        // it reaches zero well before the mask's own edges.
        const spread = 0.22;
        const wide = [
          wallPoint(from, to, t - spread * 0.16, lampH + 0.09),
          wallPoint(from, to, t + spread * 0.16, lampH + 0.09),
          wallPoint(from, to, t + spread, -0.02),
          wallPoint(from, to, t - spread, -0.02),
        ];
        const reach = Math.hypot(foot.x - lamp.x, foot.y - lamp.y) * 1.25;
        const wash = floorCtx.createRadialGradient(lamp.x, lamp.y, 1, lamp.x, lamp.y, reach);
        wash.addColorStop(0, hexA(bulbColor, 0.34));
        wash.addColorStop(0.22, hexA(bulbColor, 0.19));
        wash.addColorStop(0.55, hexA(bulbColor, 0.07));
        wash.addColorStop(0.82, hexA(bulbColor, 0.02));
        wash.addColorStop(1, 'rgba(255,255,255,0)');
        floorCtx.save();
        floorCtx.globalCompositeOperation = 'lighter';
        floorCtx.beginPath();
        floorCtx.moveTo(wide[0].x, wide[0].y);
        for (let k = 1; k < wide.length; k++) floorCtx.lineTo(wide[k].x, wide[k].y);
        floorCtx.closePath();
        floorCtx.clip();
        floorCtx.fillStyle = wash;
        floorCtx.fillRect(lamp.x - reach, lamp.y - reach, reach * 2, reach * 2);
        floorCtx.restore();

        // The lamp: a soft bloom around a small bright core, rather than a
        // hard dot with a shadow on it.
        floorCtx.save();
        floorCtx.globalCompositeOperation = 'lighter';
        const halo = floorCtx.createRadialGradient(lamp.x, lamp.y, 0.5, lamp.x, lamp.y, 16);
        halo.addColorStop(0, hexA(bulbColor, 0.55));
        halo.addColorStop(0.35, hexA(bulbColor, 0.22));
        halo.addColorStop(1, 'rgba(255,255,255,0)');
        floorCtx.fillStyle = halo;
        floorCtx.beginPath();
        floorCtx.ellipse(lamp.x, lamp.y, 16, 10, 0, 0, Math.PI * 2);
        floorCtx.fill();
        floorCtx.restore();
        if (style === 'tube') {
          // A strip light: a bar of light along the wall, in a dark housing.
          paintQuad(wallQuad(from, to, t - 0.062, t + 0.062, lampH - 0.015, lampH + 0.03), '#24272d', null);
          floorCtx.save();
          floorCtx.shadowColor = bulbColor;
          floorCtx.shadowBlur = 8;
          paintQuad(wallQuad(from, to, t - 0.055, t + 0.055, lampH - 0.01, lampH + 0.018), bulbColor, null);
          floorCtx.restore();
        } else if (style === 'sconce') {
          // A sconce: a bracket on the wall with the lamp on it, throwing
          // a little light up as well as down.
          paintQuad(wallQuad(from, to, t - 0.018, t + 0.018, lampH - 0.03, lampH + 0.005), '#2a2622', 'rgba(0,0,0,0.5)', 1);
          paintQuad(wallQuad(from, to, t - 0.014, t + 0.014, lampH, lampH + 0.05), bulbColor, null);
          const above = wallPoint(from, to, t, lampH + 0.06);
          drawGlow(above, 14, bulbColor, 0.35);
        } else {
          floorCtx.beginPath();
          floorCtx.ellipse(lamp.x, lamp.y, 4.2, 2.8, 0, 0, Math.PI * 2);
          floorCtx.fillStyle = bulbColor;
          floorCtx.fill();
        }

        // And a pool on the floor at the foot of the wall under it, wider
        // and softer than the wash so the two meet rather than stack.
        const poolR = ROOM.tileW * 1.5;
        const pool = floorCtx.createRadialGradient(foot.x, foot.y, 2, foot.x, foot.y, poolR);
        pool.addColorStop(0, scaleAlpha(light.glow, lampBoost() * 0.85));
        pool.addColorStop(0.45, scaleAlpha(light.glow, lampBoost() * 0.34));
        pool.addColorStop(0.78, scaleAlpha(light.glow, lampBoost() * 0.09));
        pool.addColorStop(1, 'rgba(0,0,0,0)');
        floorCtx.save();
        floorCtx.globalCompositeOperation = 'lighter';
        floorCtx.fillStyle = pool;
        floorCtx.beginPath();
        floorCtx.ellipse(foot.x, foot.y, poolR, ROOM.tileH * 1.5, 0, 0, Math.PI * 2);
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
      // Something already hung there is a position, or a position with a
      // width of its own.
      const clearOfKit = taken.every((u) => (typeof u === 'number'
        ? Math.abs(u - t) >= half * 2 : Math.abs(u.t - t) >= half + u.half));
      if (clearOfDoors && clearOfKit) return t;
    }
    return null;
  }

  function drawRoomFittings(fit, north, east, west, doors, took) {
    // Alternating walls, each piece taking the first free position on its
    // wall. Fixed positions were fine while every room had its doorway in
    // the same place; now a piece that would land on a doorway steps along
    // the wall to the next opening instead, and is dropped if there is none.
    const order = [
      { key: 'ne', wall: [north, east], from: [0.22, 0.38, 0.81, 0.62, 0.1] },
      { key: 'nw', wall: [north, west], from: [0.75, 0.24, 0.55, 0.88, 0.12] },
    ];
    const taken = { ne: (took && took.ne.slice()) || [], nw: (took && took.nw.slice()) || [] };
    const half = 0.075;
    fit.decor.forEach((name, i) => {
      const draw = WALL_FITTINGS[name];
      if (!draw) return;
      // Try its own wall first, then the other one.
      for (let k = 0; k < order.length; k++) {
        const side = order[(i + k) % order.length];
        const t = pickWallSpot(doors[side.key], taken[side.key], side.from, half);
        if (t === null) continue;
        taken[side.key].push({ t, half });
        draw(side.wall[0], side.wall[1], t);
        return;
      }
    });
  }

  // Art bought in the design shop, on top of whatever the theme hangs.
  function drawBoughtArt(theme, north, east, west, doors) {
    const art = previewFor('art', theme) || designState().art[theme];
    if (!art) return;
    if (art === 'posters') {
      // Three posters along the back-left wall, stepping round a doorway.
      const t = pickWallSpot(doors.nw, [], [0.5, 0.3, 0.7, 0.18, 0.82], 0.2);
      if (t === null) return;
      const inks = ['#c94f3a', '#3fa0c9', '#e0b93f'];
      [-1, 0, 1].forEach((k, i) => {
        const at = wallFrame(north, west, t + k * 0.13, 0.66);
        paintQuad([at(-13, 20), at(13, 20), at(13, -18), at(-13, -18)], '#e9e2d2', 'rgba(0,0,0,0.5)', 1);
        paintQuad([at(-10, 17), at(10, 17), at(10, 0), at(-10, 0)], inks[i], null);
        strokePolyline([at(-9, -6), at(6, -6)], '#2a2622', 2.2);
        strokePolyline([at(-9, -12), at(2, -12)], '#2a2622', 2.2);
      });
    } else if (art === 'stripe') {
      const glow = '#ff5fa8';
      [{ from: north, to: east }, { from: north, to: west }].forEach(({ from, to }) => {
        const pts = [];
        for (let i = 0; i <= 8; i++) pts.push(wallPoint(from, to, i / 8, 0.72));
        floorCtx.save();
        floorCtx.shadowColor = glow;
        floorCtx.shadowBlur = 10;
        strokePolyline(pts, glow, 2.6);
        floorCtx.restore();
      });
    } else if (art === 'mural') {
      const t = pickWallSpot(doors.nw, [], [0.5, 0.32, 0.68], 0.3);
      if (t === null) return;
      const quad = (t0, t1, h0, h1, fill) => paintQuad(wallQuad(north, west, t0, t1, h0, h1), fill, null);
      quad(t - 0.28, t + 0.28, 0.12, 0.86, '#1f2a3a');
      quad(t - 0.28, t + 0.28, 0.12, 0.40, '#e3733f');
      quad(t - 0.24, t - 0.02, 0.40, 0.74, '#f0c05a');
      quad(t + 0.02, t + 0.24, 0.30, 0.62, '#3fa8a0');
      quad(t - 0.28, t + 0.28, 0.10, 0.14, '#10141c');
    }
  }

  function drawWallDecor(theme, north, east, west, doors) {
    drawBoughtArt(theme, north, east, west, doors);
    if (theme === 'garage') return drawGarageWalls(north, east, west, doors);
    if (theme === 'basement') return drawBasementWalls(north, east, west, doors);
    return { ne: [], nw: [] };
  }

  // ---- Edges without walls ----
  // Every stretch of one edge of a floor with floor on the inside and
  // nothing on the outside, as spans along that edge. `side` is which
  // edge: 'n' is the gy0 line, 'w' the gx0 line, 's' the far gy line, 'e'
  // the far gx line.
  function exposedRuns(rect, side) {
    const along = side === 'n' || side === 's' ? rect.cols : rect.rows;
    const gx1 = rect.gx0 + rect.cols;
    const gy1 = rect.gy0 + rect.rows;
    const open = (i) => {
      if (side === 'n') return onFloorOf(rect, rect.gx0 + i, rect.gy0) && !siteIsFloor(rect.gx0 + i, rect.gy0 - 1);
      if (side === 's') return onFloorOf(rect, rect.gx0 + i, gy1 - 1) && !siteIsFloor(rect.gx0 + i, gy1);
      if (side === 'w') return onFloorOf(rect, rect.gx0, rect.gy0 + i) && !siteIsFloor(rect.gx0 - 1, rect.gy0 + i);
      return onFloorOf(rect, gx1 - 1, rect.gy0 + i) && !siteIsFloor(gx1, rect.gy0 + i);
    };
    const runs = [];
    let start = null;
    for (let i = 0; i <= along; i++) {
      const isOpen = i < along && open(i);
      if (isOpen && start === null) start = i;
      if (!isOpen && start !== null) {
        runs.push([start, i]);
        start = null;
      }
    }
    return runs;
  }
  // Floor, or the jetty off the end of the pier, which is not a room but is
  // not water either.
  function siteIsFloor(gx, gy) {
    if (tileIsFloor(gx, gy)) return true;
    const j = jettyRect();
    return !!j && inRect(j, gx, gy);
  }
  // The lattice point a distance t along an edge.
  function edgePoint(rect, side, t) {
    if (side === 'n') return { gx: rect.gx0 + t, gy: rect.gy0 };
    if (side === 's') return { gx: rect.gx0 + t, gy: rect.gy0 + rect.rows };
    if (side === 'w') return { gx: rect.gx0, gy: rect.gy0 + t };
    return { gx: rect.gx0 + rect.cols, gy: rect.gy0 + t };
  }
  // The strip of deck running off the pier's far end, where the boat ties
  // up. Boardwalk only.
  // The jetty a boat ties up at: off the seaward end of whatever the pier
  // reaches to, which is the pier head once that is built and the
  // promenade before then. It used to be pinned to the end of the
  // promenade, which is where the walk out to the pier head now goes.
  function jettyRect() {
    if (state.activeTheme !== 'boardwalk') return null;
    let far = null;
    placements.forEach((p) => { if (!far || p.gx0 + p.cols > far.gx0 + far.cols) far = p; });
    if (!far) return null;
    // Off the seaward front of it, not off its right-hand end: the site is
    // drawn under the floors, so a dock tucked behind the deck has most of
    // itself hidden by it.
    return { gx0: far.gx0 + 5, gy0: far.gy0 + far.rows, cols: 13, rows: 8 };
  }

  // ---- Railings ----
  const RAIL = {
    rooftop: { h: 50, post: 2.6, every: 2, postColor: '#252c3a', rail: '#9aa5b6',
      panel: 'rgba(58,74,96,0.42)', mesh: 'rgba(255,255,255,0.07)' },
    boardwalk: { h: 56, post: 4.4, every: 2.5, postColor: '#6b4423', rail: '#b07c44', mid: '#95683a' },
  };
  function railSide(theme, rect, sides, light, colors) {
    const r = RAIL[theme];
    if (!r) return;
    sides.forEach((side) => {
      exposedRuns(rect, side).forEach(([from, to]) => drawRailRun(theme, rect, side, from, to, light, colors));
    });
  }
  function drawRailRun(theme, rect, side, from, to, light, colors) {
    // The pier's timber is the location's wall colour, so the paint shows
    // on it.
    const r = theme === 'boardwalk' && colors
      ? Object.assign({}, RAIL[theme], { postColor: shade(colors.wallL, -22), rail: shade(colors.wallL, 34), mid: shade(colors.wallL, 8) })
      : RAIL[theme];
    const at = (t) => {
      const p = edgePoint(rect, side, t);
      return isoPoint(p.gx, p.gy);
    };
    const a = at(from);
    const b = at(to);
    const up = (p, h) => ({ x: p.x, y: p.y - h });
    const len = to - from;
    const posts = Math.max(1, Math.round(len / r.every));
    if (theme === 'rooftop') {
      // A mesh panel between the posts, the posts, then the top rail.
      paintQuad([a, b, up(b, r.h - 4), up(a, r.h - 4)], r.panel, null);
      for (let h = 8; h < r.h - 6; h += 7) strokePolyline([up(a, h), up(b, h)], r.mesh, 1);
      for (let i = 0; i <= posts; i++) {
        const p = at(from + (len * i) / posts);
        paintQuad([{ x: p.x - r.post / 2, y: p.y }, { x: p.x + r.post / 2, y: p.y },
          { x: p.x + r.post / 2, y: p.y - r.h }, { x: p.x - r.post / 2, y: p.y - r.h }], r.postColor, null);
        // A small light on every third post, so the deck has somewhere lit.
        if (i % 3 === 1 && i < posts) {
          const lamp = up(p, r.h - 8);
          drawGlow(lamp, 22, light.bulb, 0.5);
          floorCtx.fillStyle = light.bulb;
          floorCtx.fillRect(lamp.x - 2.5, lamp.y - 1.5, 5, 3);
          const inward = side === 'n' ? { gx: 0, gy: 1.2 } : side === 's' ? { gx: 0, gy: -1.2 }
            : side === 'w' ? { gx: 1.2, gy: 0 } : { gx: -1.2, gy: 0 };
          const foot = edgePoint(rect, side, from + (len * i) / posts);
          drawFloorPool(isoPoint(foot.gx + inward.gx, foot.gy + inward.gy), light, 1.0);
        }
      }
      strokePolyline([up(a, r.h), up(b, r.h)], r.rail, 2.2);
      strokePolyline([up(a, r.h - 2.4), up(b, r.h - 2.4)], 'rgba(0,0,0,0.35)', 1);
      return;
    }
    // Boardwalk: wooden posts with two rails and a kickboard, and a
    // lifebuoy hung on the longer runs.
    for (let i = 0; i <= posts; i++) {
      const p = at(from + (len * i) / posts);
      drawWoodPost(p, r.post, r.h + 6, r.postColor);
    }
    strokePolyline([up(a, r.h), up(b, r.h)], r.rail, 3.4);
    strokePolyline([up(a, r.h + 1.5), up(b, r.h + 1.5)], shade(r.rail, 34), 1);
    strokePolyline([up(a, r.h * 0.56), up(b, r.h * 0.56)], r.mid, 2.4);
    strokePolyline([up(a, 5), up(b, 5)], shade(r.mid, -28), 1.6);
    if (len >= 8) {
      const t = from + len * (0.35 + 0.3 * noise(rect.gx0 + from, rect.gy0 + to, 3));
      const ring = up(at(t), r.h * 0.6);
      floorCtx.beginPath();
      floorCtx.ellipse(ring.x, ring.y, 6.5, 6.5, 0, 0, Math.PI * 2);
      floorCtx.lineWidth = 4;
      floorCtx.strokeStyle = '#e04a3a';
      floorCtx.stroke();
      floorCtx.beginPath();
      floorCtx.ellipse(ring.x, ring.y, 6.5, 6.5, 0, -0.5, 0.5);
      floorCtx.moveTo(ring.x - 6.5, ring.y);
      floorCtx.ellipse(ring.x, ring.y, 6.5, 6.5, 0, Math.PI - 0.5, Math.PI + 0.5);
      floorCtx.strokeStyle = '#f3efe4';
      floorCtx.stroke();
    }
    // Festoon lights strung post to post over the rail, sagging between
    // them. A pier is a place people come to in the evening; this is what
    // makes it feel like one rather than a deck with a fence round it.
    //
    // The whole run is one path for the cable and one for the bulbs, and
    // the glows go down inside a single composite block: a swag at a time
    // it was hundreds of separate paths and state changes a frame, which
    // is not something a phone can afford twenty times a second.
    const sag = 9;
    const head = (i) => up(at(from + (len * i) / posts), r.h + 13);
    const bulbs = [];
    floorCtx.beginPath();
    for (let i = 0; i < posts; i++) {
      const p0 = head(i);
      const p1 = head(i + 1);
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2 + sag * 2;
      floorCtx.moveTo(p0.x, p0.y);
      floorCtx.quadraticCurveTo(mx, my, p1.x, p1.y);
      [0.32, 0.68].forEach((t) => {
        bulbs.push({
          x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * mx + t * t * p1.x,
          y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * my + t * t * p1.y,
        });
      });
    }
    floorCtx.strokeStyle = 'rgba(24,18,12,0.65)';
    floorCtx.lineWidth = 1.4;
    floorCtx.stroke();
    const halo = lightSprite(light.bulb, 0.55, 'halo');
    floorCtx.save();
    floorCtx.globalCompositeOperation = 'lighter';
    bulbs.forEach((p) => floorCtx.drawImage(halo, p.x - 11, p.y - 2.7, 22, 15.4));
    floorCtx.restore();
    floorCtx.beginPath();
    bulbs.forEach((p) => {
      floorCtx.moveTo(p.x + 2, p.y + 4);
      floorCtx.ellipse(p.x, p.y + 4, 2, 3.2, 0, 0, Math.PI * 2);
    });
    floorCtx.fillStyle = light.bulb;
    floorCtx.fill();
  }
  function drawWoodPost(p, w, h, color) {
    paintQuad([{ x: p.x - w / 2, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - h + 1 }, { x: p.x - w / 2, y: p.y - h }],
      shade(color, -18), null);
    paintQuad([{ x: p.x, y: p.y + 1 }, { x: p.x + w / 2, y: p.y }, { x: p.x + w / 2, y: p.y - h }, { x: p.x, y: p.y - h + 1 }],
      shade(color, 10), null);
    paintQuad([{ x: p.x - w / 2 - 0.6, y: p.y - h }, { x: p.x + w / 2 + 0.6, y: p.y - h },
      { x: p.x + w / 2 + 0.6, y: p.y - h - 2.5 }, { x: p.x - w / 2 - 0.6, y: p.y - h - 2.5 }], shade(color, 30), null);
  }

  // ---- Light ----
  // Every light in the gym used to build its own radial gradient and fill an
  // ellipse with it, every frame -- and a pier hung with festoon lights has
  // hundreds of them. A gradient is the same picture every time, so it is
  // painted once into a little canvas and stamped from then on, which is
  // most of what the frame rate cost.
  const lightSprites = new Map();
  function lightSprite(color, alpha, stops) {
    const key = color + '|' + Math.round(alpha * 40) + '|' + stops;
    let c = lightSprites.get(key);
    if (c) return c;
    const R = 48;
    c = document.createElement('canvas');
    c.width = R * 2;
    c.height = R * 2;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(R, R, 0.5, R, R, R);
    if (stops === 'pool') {
      grad.addColorStop(0, scaleAlpha(color, alpha * 0.85));
      grad.addColorStop(0.45, scaleAlpha(color, alpha * 0.34));
      grad.addColorStop(0.78, scaleAlpha(color, alpha * 0.09));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      grad.addColorStop(0, hexA(color, alpha));
      grad.addColorStop(0.4, hexA(color, alpha * 0.4));
      grad.addColorStop(1, 'rgba(255,255,255,0)');
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, R * 2, R * 2);
    lightSprites.set(key, c);
    return c;
  }
  function stampLight(sprite, cx, cy, rx, ry) {
    floorCtx.save();
    floorCtx.globalCompositeOperation = 'lighter';
    floorCtx.drawImage(sprite, cx - rx, cy - ry, rx * 2, ry * 2);
    floorCtx.restore();
  }
  function drawGlow(p, r, color, alpha) {
    if (!(r > 0)) return;
    stampLight(lightSprite(color, alpha, 'halo'), p.x, p.y, r, r * 0.7);
  }
  function drawFloorPool(foot, light, scale) {
    const k = scale || 1;
    // The hour only moves the lamps a little, so the sprite is keyed to a
    // coarse step of it rather than to every value it passes through.
    const boost = Math.round(lampBoost() * 20) / 20;
    stampLight(lightSprite(light.glow, boost, 'pool'), foot.x, foot.y,
      ROOM.tileW * 1.5 * k, ROOM.tileH * 1.5 * k);
  }

  // A lamp post on the pier: a black post with a lantern on it, and a
  // pennant on some of them.
  function drawLampPost(p, light, flag) {
    const H = 1.85 * PX_PER_METRE_TALL;
    const post = '#1c1e24';
    paintQuad([{ x: p.x - 2.2, y: p.y }, { x: p.x + 2.2, y: p.y }, { x: p.x + 2.2, y: p.y - H }, { x: p.x - 2.2, y: p.y - H }],
      post, null);
    paintQuad([{ x: p.x - 5, y: p.y }, { x: p.x + 5, y: p.y }, { x: p.x + 5, y: p.y - 6 }, { x: p.x - 5, y: p.y - 6 }],
      shade(post, 14), 'rgba(0,0,0,0.4)', 1);
    const top = { x: p.x, y: p.y - H };
    // The lantern: a warm pane under a little cap.
    drawGlow({ x: top.x, y: top.y - 9 }, 46, light.bulb, 0.55);
    paintQuad([{ x: top.x - 6, y: top.y }, { x: top.x + 6, y: top.y }, { x: top.x + 6, y: top.y - 17 }, { x: top.x - 6, y: top.y - 17 }],
      post, null);
    paintQuad([{ x: top.x - 4.5, y: top.y - 2 }, { x: top.x + 4.5, y: top.y - 2 }, { x: top.x + 4.5, y: top.y - 15 }, { x: top.x - 4.5, y: top.y - 15 }],
      light.bulb, null);
    paintQuad([{ x: top.x - 7.5, y: top.y - 17 }, { x: top.x + 7.5, y: top.y - 17 }, { x: top.x, y: top.y - 23 }], post, null);
    if (flag) {
      const pole = { x: p.x, y: top.y - 26 };
      strokePolyline([pole, { x: pole.x, y: pole.y - 30 }], '#3a3d44', 1.5);
      paintQuad([{ x: pole.x, y: pole.y - 30 }, { x: pole.x + 11, y: pole.y - 26 }, { x: pole.x, y: pole.y - 8 }], '#2f74d0', null);
      strokePolyline([{ x: pole.x + 2, y: pole.y - 21 }, { x: pole.x + 6, y: pole.y - 20 }], 'rgba(255,255,255,0.7)', 1.2);
      strokePolyline([{ x: pole.x + 2, y: pole.y - 17 }, { x: pole.x + 6, y: pole.y - 16 }], 'rgba(255,255,255,0.7)', 1.2);
    }
    drawFloorPool(p, light, 1.6);
  }
  // Where a floor's lamp posts stand: just off each corner. `back` picks
  // the two corners behind the floor's contents, `front` the two in front.
  function lampSpots(rect, back) {
    const off = 0.45;
    const gx1 = rect.gx0 + rect.cols;
    const gy1 = rect.gy0 + rect.rows;
    return back
      ? [{ gx: rect.gx0 - off, gy: rect.gy0 - off, flag: true }, { gx: gx1 + off, gy: rect.gy0 - off, flag: false },
        { gx: rect.gx0 - off, gy: gy1 + off, flag: false }]
      : [{ gx: gx1 + off, gy: gy1 + off, flag: true }];
  }

  // ---- Fixtures ----
  function drawFixture(place, f, theme, colors, light) {
    const ctx = floorCtx;
    const hu = (f.u1 - f.u0) / 2;
    const hv = (f.v1 - f.v0) / 2;
    const cu = (f.u0 + f.u1) / 2;
    const cv = (f.v0 + f.v1) / 2;
    if (f.kind === 'planter') {
      // Sits on the edge, half over the floor and half off it.
      const onN = f.v0 === 0 && f.v1 < 1;
      const onW = f.u0 === 0 && f.u1 < 1;
      const base = isoPoint(place.gx0 + (onW ? 0 : cu), place.gy0 + (onN ? 0 : cv));
      drawPlanter(ctx, base, 0.6, theme, noise(place.gx0 + f.u0, place.gy0 + f.v0, 5) < 0.4);
      return;
    }
    const base = isoPoint(place.gx0 + cu, place.gy0 + cv);
    if (f.kind === 'stairs') drawStairHousing(ctx, base, hu, hv, colors, light);
    else if (f.kind === 'ac') drawAirUnit(ctx, base, hu, hv);
    else if (f.kind === 'kiosk') drawKiosk(ctx, base, hu, hv, f.sign, light, colors);
  }
  function drawPlanter(ctx, base, half, theme, palm) {
    const pot = theme === 'boardwalk' ? '#cfc7b8' : '#5e6570';
    drawIsoBox(ctx, base, 0, 0, half, half, 13, pot, 0);
    drawIsoBox(ctx, base, 0, 0, half * 0.84, half * 0.84, 2, '#3a2e22', 13);
    const top = isoScreenPoint(base, 0, 0, 16);
    if (palm) {
      drawIsoBar(ctx, base, 0, 0, 0.12, 0.06, 0.42 * PX_PER_METRE_TALL, 4, '#8a6a44');
      const crown = isoScreenPoint(base, 0.12, 0.06, 0.95 * PX_PER_METRE_TALL);
      ctx.save();
      ctx.strokeStyle = '#4d8a45';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(crown.x, crown.y);
        ctx.quadraticCurveTo(crown.x + Math.cos(a) * 9, crown.y + Math.sin(a) * 4.5 - 5,
          crown.x + Math.cos(a) * 17, crown.y + Math.sin(a) * 8.5);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    // Heads of foliage, darker underneath and lighter on top.
    const greens = ['#3d7236', '#4f8a42', '#65a24d', '#7bb35a'];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.arc(top.x + Math.cos(a) * 6, top.y - 3 + Math.sin(a) * 3 - (i % 2) * 3, 5.5 + (i % 3) * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = greens[i % greens.length];
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(top.x, top.y - 9, 6, 0, Math.PI * 2);
    ctx.fillStyle = greens[3];
    ctx.fill();
  }
  function drawStairHousing(ctx, base, hu, hv, colors, light) {
    const H = 2.2 * PX_PER_METRE_TALL;
    const body = colors.wallL;
    drawIsoBox(ctx, base, 0, 0, hu, hv, H, body, 0);
    drawIsoBox(ctx, base, 0, 0, hu + 0.15, hv + 0.15, 6, shade(body, -26), H);
    // The door in the face looking down-left, a strip of light over it,
    // and its pool on the deck outside.
    const door = 1.9 * PX_PER_METRE_TALL;
    const w = Math.min(hu - 0.3, 1.0);
    // A pair of doors, not a lit panel: dark leaves with a glazed light in
    // the top of each, a push bar across them, and the stairwell showing
    // warm through the glass.
    drawFacePanel(ctx, base, { u: -w, v: hv + 0.02 }, { u: w, v: hv + 0.02 }, 2, door, '#20262f', 2);
    drawFacePanel(ctx, base, { u: -w + 0.1, v: hv + 0.03 }, { u: w - 0.1, v: hv + 0.03 }, 6, door - 6, '#39414d', 1.5);
    [[-w + 0.18, -0.06], [0.06, w - 0.18]].forEach(([d0, d1]) => {
      drawFacePanel(ctx, base, { u: d0, v: hv + 0.04 }, { u: d1, v: hv + 0.04 }, door * 0.52, door - 12, hexA(light.bulb, 0.85), 1);
      drawFacePanel(ctx, base, { u: d0, v: hv + 0.05 }, { u: d1, v: hv + 0.05 }, door * 0.52, door * 0.545, 'rgba(0,0,0,0.3)', 0);
    });
    drawFacePanel(ctx, base, { u: -w + 0.16, v: hv + 0.05 }, { u: w - 0.16, v: hv + 0.05 }, door * 0.40, door * 0.44, '#aab3c0', 0);
    drawFacePanel(ctx, base, { u: -0.02, v: hv + 0.05 }, { u: 0.02, v: hv + 0.05 }, 6, door - 6, 'rgba(0,0,0,0.45)', 0);
    drawFacePanel(ctx, base, { u: -w - 0.25, v: hv + 0.03 }, { u: w + 0.25, v: hv + 0.03 }, door + 9, door + 13, light.bulb, 1);
    drawGlow(isoScreenPoint(base, 0, hv + 0.02, door + 11), 30, light.bulb, 0.55);
    drawFloorPool(isoScreenPoint(base, 0, hv + 1.4, 0), light, 1.5);
    // A vent pipe on the roof.
    drawIsoBox(ctx, base, -hu + 0.55, -hv + 0.55, 0.18, 0.18, 24, '#8a919c', H + 6);
    drawIsoBox(ctx, base, -hu + 0.55, -hv + 0.55, 0.26, 0.26, 4, '#6f767f', H + 30);
  }
  function drawAirUnit(ctx, base, hu, hv) {
    drawIsoBox(ctx, base, 0, 0, hu, hv, 26, '#7b828d', 0);
    const top = isoScreenPoint(base, 0, 0, 27);
    const r = Math.min(hu, hv) * ROOM.tileW * 0.5;
    drawIsoDisc(ctx, top, r, r * 0.5, '#383d45');
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(top.x - Math.cos(a) * r * 0.8, top.y - Math.sin(a) * r * 0.4);
      ctx.lineTo(top.x + Math.cos(a) * r * 0.8, top.y + Math.sin(a) * r * 0.4);
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      drawFacePanel(ctx, base, { u: hu + 0.01, v: -hv + 0.25 }, { u: hu + 0.01, v: hv - 0.25 },
        5 + i * 5, 7 + i * 5, 'rgba(0,0,0,0.28)', 0);
    }
  }
  function drawSignBoard(p, text, board) {
    const ctx = floorCtx;
    ctx.save();
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 22;
    const h = 22;
    paintQuad([{ x: p.x - w / 2, y: p.y }, { x: p.x + w / 2, y: p.y }, { x: p.x + w / 2, y: p.y - h }, { x: p.x - w / 2, y: p.y - h }],
      board, 'rgba(0,0,0,0.6)', 1.2);
    paintQuad([{ x: p.x - w / 2 + 2, y: p.y - 2 }, { x: p.x + w / 2 - 2, y: p.y - 2 }, { x: p.x + w / 2 - 2, y: p.y - h + 2 }, { x: p.x - w / 2 + 2, y: p.y - h + 2 }],
      null, 'rgba(255,255,255,0.35)', 1);
    ctx.fillStyle = '#f7f3e8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, p.x, p.y - h / 2 + 1);
    ctx.restore();
  }
  function drawKiosk(ctx, base, hu, hv, sign, light, colors) {
    const H = 2.0 * PX_PER_METRE_TALL;
    const wood = sign === 'SNACKS' ? colors.wallL : shade(colors.wallL, -10);
    drawIsoBox(ctx, base, 0, 0, hu, hv, H, wood, 0);
    // The serving hatch in the face looking down-right, lit from inside,
    // with a counter under it.
    drawFacePanel(ctx, base, { u: hu + 0.02, v: -hv + 0.5 }, { u: hu + 0.02, v: hv - 0.5 }, H * 0.44, H * 0.84, '#2b1d12', 2);
    drawFacePanel(ctx, base, { u: hu + 0.03, v: -hv + 0.6 }, { u: hu + 0.03, v: hv - 0.6 }, H * 0.48, H * 0.80, hexA(light.bulb, 0.55), 2);
    drawGlow(isoScreenPoint(base, hu + 0.03, 0, H * 0.64), 34, light.bulb, 0.35);
    drawIsoBox(ctx, base, hu + 0.22, 0, 0.24, hv - 0.5, H * 0.44, shade(wood, 16), 0);
    // A striped awning sloping out over the counter.
    const a0 = isoScreenPoint(base, hu + 0.02, -hv, H * 0.94);
    const a1 = isoScreenPoint(base, hu + 0.02, hv, H * 0.94);
    const b0 = isoScreenPoint(base, hu + 1.1, -hv - 0.1, H * 0.76);
    const b1 = isoScreenPoint(base, hu + 1.1, hv + 0.1, H * 0.76);
    const stripes = 7;
    for (let i = 0; i < stripes; i++) {
      const t0 = i / stripes;
      const t1 = (i + 1) / stripes;
      paintQuad([lerpPt(a0, a1, t0), lerpPt(a0, a1, t1), lerpPt(b0, b1, t1), lerpPt(b0, b1, t0)],
        i % 2 ? '#f3efe4' : (sign === 'SNACKS' ? '#d9402f' : '#1f7a80'), 'rgba(0,0,0,0.25)', 0.8);
    }
    // A roof a little wider than the walls, and the sign standing on it.
    drawIsoBox(ctx, base, 0, 0, hu + 0.2, hv + 0.2, 5, shade(wood, -34), H);
    drawSignBoard(isoScreenPoint(base, 0, 0, H + 8), sign, sign === 'SNACKS' ? '#4a2a14' : '#146068');
    if (sign !== 'SNACKS') {
      // Surfboards leaning on the side of the shop.
      [[0, '#f3efe4', '#2f74d0'], [0.45, '#e04a3a', '#f3efe4']].forEach(([dv, fill, stripe]) => {
        const foot = isoScreenPoint(base, -hu + 0.6 + dv * 0.4, hv + 0.35 + dv, 0);
        ctx.save();
        ctx.translate(foot.x, foot.y - 30);
        ctx.rotate(-0.12);
        ctx.beginPath();
        ctx.ellipse(0, 0, 5.5, 31, 0, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(0, 26);
        ctx.strokeStyle = stripe;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.restore();
      });
    }
  }

  // ---- Floor markings ----
  function drawInsetOutline(place, inset, color, width) {
    const q = [
      isoPoint(place.gx0 + inset, place.gy0 + inset),
      isoPoint(place.gx0 + place.cols - inset, place.gy0 + inset),
      isoPoint(place.gx0 + place.cols - inset, place.gy0 + place.rows - inset),
      isoPoint(place.gx0 + inset, place.gy0 + place.rows - inset),
    ];
    paintQuad(q, null, color, width || 2);
  }
  function drawGrate(gx, gy, half, bars) {
    const q = [isoPoint(gx - half, gy - half), isoPoint(gx + half, gy - half),
      isoPoint(gx + half, gy + half), isoPoint(gx - half, gy + half)];
    paintQuad(q, '#1b1b1d', 'rgba(0,0,0,0.7)', 1.2);
    const n = bars || 6;
    for (let i = 1; i < n; i++) {
      const t = -half + (2 * half * i) / n;
      strokePolyline([isoPoint(gx + t, gy - half + 0.15), isoPoint(gx + t, gy + half - 0.15)], 'rgba(150,150,150,0.35)', 1);
      strokePolyline([isoPoint(gx - half + 0.15, gy + t), isoPoint(gx + half - 0.15, gy + t)], 'rgba(150,150,150,0.35)', 1);
    }
  }
  function drawHatch(gx, gy, half) {
    const q = [isoPoint(gx - half, gy - half), isoPoint(gx + half, gy - half),
      isoPoint(gx + half, gy + half), isoPoint(gx - half, gy + half)];
    floorCtx.save();
    paintQuad(q, 'rgba(242,183,5,0.85)', null);
    floorCtx.beginPath();
    floorCtx.moveTo(q[0].x, q[0].y);
    for (let i = 1; i < 4; i++) floorCtx.lineTo(q[i].x, q[i].y);
    floorCtx.closePath();
    floorCtx.clip();
    floorCtx.strokeStyle = 'rgba(20,20,22,0.85)';
    floorCtx.lineWidth = 3;
    for (let t = -half * 2; t <= half * 2; t += 0.55) {
      strokePolyline([isoPoint(gx + t - half, gy - half), isoPoint(gx + t + half, gy + half)], 'rgba(20,20,22,0.85)', 3);
    }
    floorCtx.restore();
    paintQuad(q, null, 'rgba(0,0,0,0.4)', 1);
  }
  function drawWaveMark(gx, gy) {
    floorCtx.save();
    floorCtx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push(isoPoint(gx - 2.2 + t * 4.4 + k * 0.5, gy + k * 0.9 - 0.9 + Math.sin(t * Math.PI * 2) * 0.3));
      }
      strokePolyline(pts, 'rgba(255,255,255,0.5)', 3);
    }
    floorCtx.restore();
  }
  function drawFloorMarks(theme, place, roomIndex) {
    const hub = isHubAt(theme, roomIndex);
    if (theme === 'garage') {
      if (hub) {
        drawGrate(place.gx0 + place.cols * 0.42, place.gy0 + place.rows * 0.5, 0.9, 5);
      } else {
        drawInsetOutline(place, 1.5, 'rgba(255,232,196,0.34)', 2);
        if (roomIndex === 1) drawHatch(place.gx0 + 2.6, place.gy0 + 2.6, 1.3);
      }
    } else if (theme === 'basement') {
      if (hub) drawGrate(place.gx0 + place.cols * 0.5, place.gy0 + place.rows - 4.5, 2.4, 10);
    } else if (theme === 'boardwalk') {
      if (roomIndex === 1 || roomIndex === 2) drawInsetOutline(place, 2, 'rgba(255,255,255,0.42)', 2);
      if (!hub) drawWaveMark(place.gx0 + place.cols / 2, place.gy0 + place.rows / 2);
    }
  }

  // Decking: boards a tile wide and six long, their joints staggered row
  // by row, each a slightly different shade of the same wood.
  function drawPlanks(rect, colors, dim) {
    const L = 6;
    for (let ry = 0; ry < rect.rows; ry++) {
      const gy = rect.gy0 + ry;
      const stagger = (ry * 2) % L;
      for (let rx = -stagger; rx < rect.cols; rx += L) {
        const x0 = Math.max(0, rx);
        const x1 = Math.min(rect.cols, rx + L);
        if (x1 <= x0) continue;
        const gx = rect.gx0 + x0;
        const w = x1 - x0;
        const n = noise(gx, gy, 7);
        const tone = shade(n < 0.5 ? colors.floorA : colors.floorB, (dim || 0) + Math.round((n - 0.5) * 18));
        paintQuad([isoPoint(gx, gy), isoPoint(gx + w, gy), isoPoint(gx + w, gy + 1), isoPoint(gx, gy + 1)],
          tone, 'rgba(70,36,12,0.5)', 1);
        strokePolyline([isoPoint(gx + 0.3, gy + 0.5), isoPoint(gx + w - 0.3, gy + 0.5)], 'rgba(0,0,0,0.07)', 1);
      }
    }
  }

  // ---- Walls, by location ----
  function drawGarageWalls(north, east, west, doors) {
    const took = { ne: [], nw: [] };
    const q = (from, to, t0, t1, h0, h1, fill, stroke, lw) => paintQuad(wallQuad(from, to, t0, t1, h0, h1), fill, stroke, lw);
    // A roller shutter, on the back-right wall unless a doorway is in the
    // way there, and its guide rails and bollards.
    const shutter = (from, to, t, half) => {
      q(from, to, t - half, t + half, 0.02, 0.80, '#5b626b', 'rgba(0,0,0,0.5)', 1);
      for (let h = 0.06; h < 0.78; h += 0.045) {
        q(from, to, t - half + 0.006, t + half - 0.006, h, h + 0.018, 'rgba(255,255,255,0.07)', null);
        q(from, to, t - half + 0.006, t + half - 0.006, h + 0.018, h + 0.045, 'rgba(0,0,0,0.13)', null);
      }
      q(from, to, t - half - 0.012, t + half + 0.012, 0.80, 0.88, '#363b43', 'rgba(0,0,0,0.5)', 1);
      q(from, to, t - half - 0.014, t - half, 0.02, 0.80, '#2a2e34', null);
      q(from, to, t + half, t + half + 0.014, 0.02, 0.80, '#2a2e34', null);
      [t - half - 0.026, t + half + 0.026].forEach((tt) => {
        q(from, to, tt - 0.009, tt + 0.009, 0, 0.17, '#f2b705', 'rgba(0,0,0,0.5)', 1);
        [0.03, 0.09].forEach((h) => q(from, to, tt - 0.009, tt + 0.009, h, h + 0.03, '#15161a', null));
      });
    };
    let t = pickWallSpot(doors.ne, [], [0.5, 0.36, 0.64, 0.3], 0.22);
    if (t !== null) {
      shutter(north, east, t, 0.18);
      took.ne.push({ t, half: 0.23 });
    } else {
      t = pickWallSpot(doors.nw, [], [0.5, 0.36, 0.64], 0.22);
      if (t !== null) {
        shutter(north, west, t, 0.18);
        took.nw.push({ t, half: 0.23 });
      }
    }
    // A bank of lockers on the other wall.
    const lockersOn = took.ne.length ? 'nw' : 'ne';
    const lw = lockersOn === 'nw' ? [north, west] : [north, east];
    t = pickWallSpot(doors[lockersOn], took[lockersOn], [0.72, 0.28, 0.5, 0.85], 0.1);
    if (t !== null) {
      q(lw[0], lw[1], t - 0.09, t + 0.09, 0.02, 0.66, '#4b525c', 'rgba(0,0,0,0.55)', 1);
      q(lw[0], lw[1], t - 0.09, t + 0.09, 0.66, 0.69, '#363c45', null);
      [-0.03, 0.03].forEach((d) => q(lw[0], lw[1], t + d - 0.002, t + d + 0.002, 0.02, 0.66, 'rgba(0,0,0,0.45)', null));
      [-0.06, 0, 0.06].forEach((d) => {
        for (let k = 0; k < 3; k++) q(lw[0], lw[1], t + d - 0.015, t + d + 0.015, 0.55 - k * 0.03, 0.56 - k * 0.03, 'rgba(0,0,0,0.35)', null);
        q(lw[0], lw[1], t + d + 0.012, t + d + 0.02, 0.33, 0.37, '#9aa2ac', null);
      });
      took[lockersOn].push({ t, half: 0.1 });
    }
    // A red tool cabinet on castors.
    const cabOn = lockersOn === 'nw' ? 'ne' : 'nw';
    const cw = cabOn === 'nw' ? [north, west] : [north, east];
    t = pickWallSpot(doors[cabOn], took[cabOn], [0.18, 0.82, 0.3], 0.06);
    if (t !== null) {
      q(cw[0], cw[1], t - 0.045, t + 0.045, 0.03, 0.42, '#b3281f', 'rgba(0,0,0,0.6)', 1);
      for (let h = 0.09; h < 0.4; h += 0.07) q(cw[0], cw[1], t - 0.04, t + 0.04, h, h + 0.006, 'rgba(255,255,255,0.22)', null);
      q(cw[0], cw[1], t - 0.048, t + 0.048, 0.42, 0.45, '#1c1d21', null);
      [-0.03, 0.03].forEach((d) => q(cw[0], cw[1], t + d - 0.006, t + d + 0.006, 0, 0.03, '#15161a', null));
      took[cabOn].push({ t, half: 0.06 });
    }
    // A duct along the top of both walls, and a downpipe in the corner.
    [[north, east], [north, west]].forEach(([from, to]) => {
      q(from, to, 0.0, 1.0, 0.925, 0.965, '#2b3038', null);
      q(from, to, 0.0, 1.0, 0.958, 0.965, 'rgba(255,255,255,0.08)', null);
      for (let s = 0.08; s < 1; s += 0.14) q(from, to, s - 0.006, s + 0.006, 0.92, 0.97, '#1e2228', null);
    });
    q(north, east, 0.006, 0.02, 0, 0.925, '#3a3f47', 'rgba(0,0,0,0.45)', 0.8);
    return took;
  }
  function drawBasementWalls(north, east, west, doors) {
    const took = { ne: [], nw: [] };
    const q = (from, to, t0, t1, h0, h1, fill, stroke, lw) => paintQuad(wallQuad(from, to, t0, t1, h0, h1), fill, stroke, lw);
    // The walls are stone like the cellar's own, laid in smaller courses:
    // the joints drawn faintly over the face, every other course offset,
    // and never across a doorway.
    const courses = (from, to, spans) => {
      const H = 0.115;
      const solid = [];
      let at = 0;
      spans.slice().sort((a, b) => a[0] - b[0]).forEach(([lo, hi]) => {
        if (lo > at) solid.push([at, Math.max(at, lo)]);
        at = Math.max(at, hi);
      });
      if (at < 1) solid.push([at, 1]);
      let row = 0;
      for (let h = H; h < 0.96; h += H, row += 1) {
        solid.forEach(([t0, t1]) => {
          q(from, to, t0, t1, h - 0.004, h + 0.004, 'rgba(0,0,0,0.22)', null);
          q(from, to, t0, t1, h + 0.004, h + 0.012, 'rgba(255,240,220,0.05)', null);
        });
        const off = row % 2 ? 0.04 : 0;
        for (let t = off; t < 1; t += 0.08) {
          if (!solid.some(([t0, t1]) => t >= t0 + 0.004 && t <= t1 - 0.004)) continue;
          q(from, to, t - 0.0018, t + 0.0018, h - H + 0.004, h - 0.004, 'rgba(0,0,0,0.18)', null);
        }
      }
    };
    courses(north, west, doors.nw);
    courses(north, east, doors.ne);
    // Copper pipes down the wall in a pair, with couplings.
    const pipes = (from, to, t) => {
      [t - 0.012, t + 0.012].forEach((tt) => {
        q(from, to, tt - 0.007, tt + 0.007, 0, 0.985, '#8c4f2a', 'rgba(0,0,0,0.5)', 0.8);
        q(from, to, tt - 0.004, tt, 0, 0.985, 'rgba(255,205,160,0.28)', null);
        [0.3, 0.68].forEach((h) => q(from, to, tt - 0.011, tt + 0.011, h, h + 0.03, '#6e3d20', 'rgba(0,0,0,0.5)', 0.8));
      });
    };
    // A grey box with a conduit up from it and a pilot light.
    const box = (from, to, t) => {
      q(from, to, t - 0.03, t + 0.03, 0.48, 0.66, '#9aa0a6', 'rgba(0,0,0,0.6)', 1);
      q(from, to, t - 0.024, t + 0.024, 0.50, 0.64, '#868c93', null);
      q(from, to, t - 0.002, t + 0.002, 0.50, 0.64, 'rgba(0,0,0,0.35)', null);
      q(from, to, t - 0.004, t + 0.004, 0.66, 0.985, '#6d7176', null);
      const led = wallPoint(from, to, t + 0.017, 0.62);
      floorCtx.fillStyle = '#ff5a3c';
      floorCtx.fillRect(led.x - 1, led.y - 1, 2, 2);
    };
    let t = pickWallSpot(doors.nw, [], [0.08, 0.2, 0.9, 0.5], 0.03);
    if (t !== null) {
      pipes(north, west, t);
      took.nw.push({ t, half: 0.03 });
    }
    t = pickWallSpot(doors.ne, [], [0.3, 0.62, 0.15, 0.8], 0.04);
    if (t !== null) {
      box(north, east, t);
      took.ne.push({ t, half: 0.04 });
    }
    t = pickWallSpot(doors.nw, took.nw, [0.72, 0.5, 0.34], 0.1);
    if (t !== null) {
      WALL_FITTINGS.vent(north, west, t);
      took.nw.push({ t, half: 0.08 });
    }
    return took;
  }

  // Square pillars either side of a doorway into the hub, each with a strip
  // of light down its face. Garage only: that is where the doorways are
  // framed rather than simply cut.
  function drawHallwayPosts(c, theme, colors, light) {
    if (theme !== 'garage') return;
    const atFar = c.doorRoom === hubRect();
    let spots;
    if (c.axis === 'gx') {
      const gx = atFar ? c.gx0 + c.cols - 0.5 : c.gx0 + 0.5;
      spots = [{ gx, gy: c.gy0 + 0.5 }, { gx, gy: c.gy0 + c.rows - 0.5 }];
    } else {
      const gy = atFar ? c.gy0 + c.rows - 0.5 : c.gy0 + 0.5;
      spots = [{ gx: c.gx0 + 0.5, gy }, { gx: c.gx0 + c.cols - 0.5, gy }];
    }
    spots.forEach((s) => {
      const base = isoPoint(s.gx, s.gy);
      drawIsoBox(floorCtx, base, 0, 0, 0.5, 0.5, ROOM.wallH, shade(colors.wallL, 6), 0);
      drawFacePanel(floorCtx, base, { u: 0.51, v: -0.1 }, { u: 0.51, v: 0.1 },
        ROOM.wallH * 0.28, ROOM.wallH * 0.72, light.bulb, 1);
      drawGlow(isoScreenPoint(base, 0.51, 0, ROOM.wallH * 0.5), 24, light.bulb, 0.4);
      drawFloorPool(isoScreenPoint(base, 1.0, 0.2, 0), light, 0.9);
    });
  }

  // ---- The site around the plan ----
  // What lies beyond the floors, drawn on the ground layer in the plan's
  // own coordinates: rock and pipework round a cellar, a yard round the
  // garage, a city below a roof, the sea round a pier. `view` is the part
  // of the plan's world the window is looking at.
  function latticeRange(view) {
    const hw = ROOM.tileW / 2;
    const hh = ROOM.tileH / 2;
    let gx0 = Infinity;
    let gx1 = -Infinity;
    let gy0 = Infinity;
    let gy1 = -Infinity;
    [[view.x0, view.y0], [view.x1, view.y0], [view.x0, view.y1], [view.x1, view.y1]].forEach(([x, y]) => {
      const rx = (x - worldOrigin.x) / hw;
      const ry = (y - worldOrigin.y) / hh;
      const gx = (rx + ry) / 2;
      const gy = (ry - rx) / 2;
      gx0 = Math.min(gx0, gx);
      gx1 = Math.max(gx1, gx);
      gy0 = Math.min(gy0, gy);
      gy1 = Math.max(gy1, gy);
    });
    // Only so far out: past this the site has run out into the dark.
    const reach = 150;
    return {
      gx0: Math.max(Math.floor(gx0) - 2, planBounds.gx0 - reach),
      gx1: Math.min(Math.ceil(gx1) + 2, planBounds.gx1 + reach),
      gy0: Math.max(Math.floor(gy0) - 2, planBounds.gy0 - reach),
      gy1: Math.min(Math.ceil(gy1) + 2, planBounds.gy1 + reach),
    };
  }
  // The floors the site is drawn around: every room and hallway, and on
  // the pier the jetty too.
  function siteFloors() {
    const j = jettyRect();
    return placements.concat(corridors, j ? [j] : []);
  }
  function drawSiteTexture(theme, colors, view) {
    if (theme === 'basement') drawCavernFloor(colors, view);
    else if (theme === 'garage') drawYardFloor(colors, view);
    else if (theme === 'rooftop') drawCitySky(colors, view);
    else if (theme === 'boardwalk') drawSea(colors, view);
  }
  function drawSiteProps(theme, colors, view) {
    if (theme === 'basement') drawCellarProps(colors, view);
    else if (theme === 'garage') drawYardProps(colors, view);
    else if (theme === 'rooftop') drawBuildingBelow(colors, view);
    else if (theme === 'boardwalk') drawPierPiles(colors, view);
  }

  // ---- The cellar ----
  // A cellar dug out under the street, drawn the way the yard and the pier
  // are: flat colour, clean shapes, and the light doing the work. The
  // rooms stand on packed earth. Behind them the ground was cut away and
  // stands as stone laid in courses, framed into bays by timber posts and
  // a beam with lanterns hung from it; above that, the dark. Pipework runs
  // along the bays, a plank walk crosses the earth from the foot of the
  // stair, and the stair climbs the stone to a doorway up at the street.
  const CELLAR = {
    earth: '#3a2a1f',
    earthHi: '#463327',
    earthLo: '#2d2018',
    stone: '#4f4845',
    stoneHi: '#6a615b',
    stoneLo: '#36302d',
    mortar: '#1f1a18',
    timber: '#6e4b2c',
    timberHi: '#8c633a',
    timberLo: '#48301d',
    plank: '#8f6b41',
    plankB: '#83603a',
    pipe: '#5c636b',
    copper: '#8b5b35',
    moss: '#4e6b38',
    water: '#24414a',
    wall: 330,
    bay: 7,
  };
  function cellarApron() {
    const b = planBounds;
    const out = 3;
    return {
      gx0: b.gx0 - out,
      gy0: b.gy0 - out,
      cols: (b.gx1 - b.gx0) + out * 2,
      rows: (b.gy1 - b.gy0) + out * 2,
    };
  }

  // ---- The way in ----
  // A flight of steps built against the back stone, climbing from the floor
  // beside the north room to a doorway cut high in the face. Where it
  // stands moves with the rooms, so it is always in the open beside them.
  const STAIR = { out: 3.2, rise: 0.5, treads: 14, landing: 4.2 };
  function cellarStair() {
    const a = cellarApron();
    const north = placements[2] || placements[0];
    const gxB = north ? north.gx0 + north.cols + 3.5 : planBounds.gx1 + 3.5;
    const gxT = north ? north.gx0 + 8 : planBounds.gx0 + 8;
    return { gy: a.gy0, gxB, gxT, zT: CELLAR.wall * STAIR.rise };
  }
  // The plank walk from the foot of the stair down to the gym: it runs
  // to the back of the east room once that is built, and to the main
  // floor before then.
  function cellarWalk() {
    const st = cellarStair();
    const to = placements[3] ? placements[3].gy0 : planBounds.gy1;
    return { gx0: st.gxB - 0.4, gy0: st.gy, cols: 3.6, rows: Math.max(6, to - st.gy + 1) };
  }

  // ---- Earth and stone ----
  // Packed earth over a range of the lattice: one colour, a few broad
  // soft patches of a shade either way, and here and there a stone, a
  // puddle or a clump of moss. Nothing small enough to read as texture.
  function drawDirt(x0, y0, x1, y1, seed) {
    const S = 13;
    for (let gy = Math.floor(y0 / S) * S; gy < y1; gy += S) {
      for (let gx = Math.floor(x0 / S) * S; gx < x1; gx += S) {
        const k = Math.round(gx);
        const j = Math.round(gy);
        const n1 = noise(k, j, seed);
        const n2 = noise(j, k, seed + 1);
        if (n2 < 0.3) continue;
        const c = isoPoint(gx + n1 * S, gy + n2 * S);
        const r = 90 + n1 * 90;
        const tone = n2 < 0.65 ? CELLAR.earthLo : CELLAR.earthHi;
        const g = floorCtx.createRadialGradient(c.x, c.y, 1, c.x, c.y, r);
        g.addColorStop(0, hexA(tone, 0.6));
        g.addColorStop(1, hexA(tone, 0));
        floorCtx.fillStyle = g;
        floorCtx.beginPath();
        floorCtx.ellipse(c.x, c.y, r, r * 0.55, 0, 0, Math.PI * 2);
        floorCtx.fill();
      }
    }
    const P = 6;
    for (let gy = Math.floor(y0 / P) * P; gy < y1; gy += P) {
      for (let gx = Math.floor(x0 / P) * P; gx < x1; gx += P) {
        const k = Math.round(gx);
        const j = Math.round(gy);
        const n = noise(k, j, seed + 2);
        const c = isoPoint(gx + noise(k, j, seed + 3) * P, gy + noise(j, k, seed + 4) * P);
        if (n > 0.965) drawPuddle(c, 14 + n * 18, k * 7 + j);
        else if (n > 0.88) drawMoss(c, 12 + n * 14, k + j * 3);
        else if (n > 0.7) drawStone(c, 4 + (n - 0.7) * 30, k * 31 + j);
        else if (n > 0.67) drawMushrooms(c, k * 5 + j);
      }
    }
  }
  // A flat stone lying on the earth: the top lit, the near side in shadow.
  function drawStone(c, r, seed) {
    const ry = r * 0.55;
    floorCtx.beginPath();
    floorCtx.ellipse(c.x + 1, c.y + 2, r, ry, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = 'rgba(0,0,0,0.35)';
    floorCtx.fill();
    floorCtx.beginPath();
    floorCtx.ellipse(c.x, c.y, r, ry, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = shade(CELLAR.stone, Math.round((noise(seed, 1, 201) - 0.5) * 16));
    floorCtx.fill();
    floorCtx.beginPath();
    floorCtx.ellipse(c.x - r * 0.15, c.y - ry * 0.3, r * 0.6, ry * 0.45, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = hexA(CELLAR.stoneHi, 0.8);
    floorCtx.fill();
  }
  function drawMoss(c, r, seed) {
    for (let i = 0; i < 3; i++) {
      const dx = (noise(seed, i, 202) - 0.5) * r;
      const dy = (noise(seed, i, 203) - 0.5) * r * 0.5;
      const rr = r * (0.5 + noise(seed, i, 204) * 0.5);
      floorCtx.beginPath();
      floorCtx.ellipse(c.x + dx, c.y + dy, rr, rr * 0.5, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = hexA(shade(CELLAR.moss, i * 6), 0.75);
      floorCtx.fill();
    }
  }
  // Standing water: dark, with the sheen of whatever light is about on it.
  function drawPuddle(c, r, seed) {
    const ry = r * 0.42;
    floorCtx.beginPath();
    floorCtx.ellipse(c.x, c.y, r, ry, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = CELLAR.water;
    floorCtx.fill();
    floorCtx.beginPath();
    floorCtx.ellipse(c.x, c.y, r - 2.5, ry - 1.8, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = shade(CELLAR.water, -14);
    floorCtx.fill();
    strokePolyline([{ x: c.x - r * 0.45, y: c.y - ry * 0.25 }, { x: c.x + r * 0.1, y: c.y - ry * 0.5 }], 'rgba(255,220,170,0.28)', 1.5);
    if (noise(seed, 2, 205) > 0.5) {
      strokePolyline([{ x: c.x - r * 0.1, y: c.y + ry * 0.35 }, { x: c.x + r * 0.4, y: c.y + ry * 0.1 }], 'rgba(255,220,170,0.14)', 1.2);
    }
  }
  function drawMushrooms(c, seed) {
    const n = 2 + Math.round(noise(seed, 1, 206) * 2);
    for (let i = 0; i < n; i++) {
      const p = { x: c.x + (i - 1) * 6 + (noise(seed, i, 207) - 0.5) * 4, y: c.y + (noise(seed, i, 208) - 0.5) * 4 };
      const h = 5 + noise(seed, i, 209) * 5;
      strokePolyline([p, { x: p.x, y: p.y - h }], '#c9b48e', 2.2);
      floorCtx.beginPath();
      floorCtx.ellipse(p.x, p.y - h, 4 + h * 0.3, 2.6 + h * 0.15, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = i % 2 ? '#a8543a' : '#c4874f';
      floorCtx.fill();
    }
  }
  // A plank walk: boards laid across it on bearers, the way the pier is.
  // `across` lays the boards the other way, for a walk that runs across
  // the lattice rather than down it.
  function drawPlankWalk(rect, across) {
    const q = [isoPoint(rect.gx0, rect.gy0), isoPoint(rect.gx0 + rect.cols, rect.gy0),
      isoPoint(rect.gx0 + rect.cols, rect.gy0 + rect.rows), isoPoint(rect.gx0, rect.gy0 + rect.rows)];
    paintQuad(q.map((p) => ({ x: p.x, y: p.y + 3 })), 'rgba(0,0,0,0.35)', null);
    const B = 0.55;
    const gx1 = rect.gx0 + rect.cols;
    const gy1 = rect.gy0 + rect.rows;
    const board = (a, b, c, d, j) => {
      const n = noise(j, 3, 211);
      const tone = shade(n < 0.5 ? CELLAR.plank : CELLAR.plankB, Math.round((noise(j, 5, 212) - 0.5) * 14));
      paintQuad([a, b, c, d], tone, 'rgba(60,32,12,0.55)', 1);
    };
    if (across) {
      for (let gx = rect.gx0; gx < gx1; gx += B) {
        const x1 = Math.min(gx + B, gx1);
        board(isoPoint(gx, rect.gy0), isoPoint(x1, rect.gy0), isoPoint(x1, gy1), isoPoint(gx, gy1), Math.round(gx * 4));
      }
      [rect.gy0 + 0.08, gy1 - 0.08].forEach((gy) => {
        strokePolyline([isoPoint(rect.gx0, gy), isoPoint(gx1, gy)], 'rgba(50,28,10,0.5)', 2);
      });
      return;
    }
    for (let gy = rect.gy0; gy < gy1; gy += B) {
      const y1 = Math.min(gy + B, gy1);
      board(isoPoint(rect.gx0, gy), isoPoint(gx1, gy), isoPoint(gx1, y1), isoPoint(rect.gx0, y1), Math.round(gy * 4));
    }
    [rect.gx0 + 0.08, gx1 - 0.08].forEach((gx) => {
      strokePolyline([isoPoint(gx, rect.gy0), isoPoint(gx, gy1)], 'rgba(50,28,10,0.5)', 2);
    });
  }

  // Stone standing where the ground was dug away: blocks laid in courses,
  // each lit along its top and dark along its foot, with the dark of the
  // mortar between; the top of it goes off into the black, which is what
  // lets a lit face read as standing up.
  function drawRockWall(from, to, h, seed) {
    const at = (t, k) => {
      const p = lerpPt(from, to, t);
      return { x: p.x, y: p.y - k * h };
    };
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    paintQuad([at(0, 0), at(1, 0), at(1, 1), at(0, 1)], CELLAR.mortar, null);
    const courses = 7;
    const top = 0.9;
    for (let r = 0; r < courses; r++) {
      const k0 = (r / courses) * top;
      const k1 = ((r + 1) / courses) * top;
      // Walk along the course laying blocks of uneven width.
      let x = -(noise(r, seed, 221) * 60);
      let c = 0;
      while (x < len) {
        const w = 42 + noise(c * 7 + r, seed, 222) * 40;
        const t0 = Math.max(0, x / len);
        const t1 = Math.min(1, (x + w) / len);
        if (t1 > t0) {
          const g = 2.2;
          const a = at(t0, k0);
          const b = at(t1, k0);
          const cc = at(t1, k1);
          const d = at(t0, k1);
          const ux = (b.x - a.x) / (w || 1);
          const uy = (b.y - a.y) / (w || 1);
          const inset = (p, dx, dy) => ({ x: p.x + ux * dx, y: p.y + uy * dx - dy });
          const q0 = inset(a, g, g);
          const q1 = inset(b, -g, g);
          const q2 = inset(cc, -g, -g);
          const q3 = inset(d, g, -g);
          const tone = Math.round((noise(c, r + seed, 223) - 0.5) * 18 - k0 * 20);
          floorCtx.beginPath();
          roundedQuadPath(floorCtx, q0, q1, q2, q3, 3);
          floorCtx.fillStyle = shade(CELLAR.stone, tone);
          floorCtx.fill();
          // Lit along the top, dark along the foot.
          const band = Math.min(5, (h / courses) * 0.16);
          paintQuad([q3, q2, { x: q2.x, y: q2.y + band }, { x: q3.x, y: q3.y + band }], hexA(shade(CELLAR.stoneHi, tone), 0.9), null);
          paintQuad([{ x: q0.x, y: q0.y - band }, { x: q1.x, y: q1.y - band }, q1, q0], hexA(shade(CELLAR.stoneLo, tone), 0.9), null);
        }
        x += w;
        c++;
      }
    }
    // Moss at the foot, where it is damp.
    const clumps = Math.max(2, Math.round(len / 170));
    for (let i = 0; i < clumps; i++) {
      const t = noise(i, seed, 224);
      const p = at(t, 0.03 + noise(i, seed, 225) * 0.07);
      for (let j = 0; j < 3; j++) {
        const rr = 8 + noise(i, j + seed, 226) * 12;
        floorCtx.beginPath();
        floorCtx.ellipse(p.x + (j - 1) * rr * 0.7, p.y + (noise(i, j, 227) - 0.5) * 6, rr, rr * 0.6, 0, 0, Math.PI * 2);
        floorCtx.fillStyle = hexA(shade(CELLAR.moss, j * 5 - 8), 0.55);
        floorCtx.fill();
      }
    }
    // Roots hanging out of the top of the cut.
    const roots = Math.max(2, Math.round(len / 260));
    for (let i = 0; i < roots; i++) {
      let p = at(noise(i, seed, 228), 0.98);
      const pts = [p];
      const segs = 4 + Math.round(noise(i, seed, 229) * 3);
      for (let j = 0; j < segs; j++) {
        p = { x: p.x + (noise(i, j + seed, 230) - 0.5) * 16, y: p.y + 10 + noise(i, j + seed, 231) * 12 };
        pts.push(p);
      }
      strokePolyline(pts, CELLAR.timberLo, 3);
      strokePolyline(pts.slice(2, 4).map((q, j) => ({ x: q.x + 8 + j * 6, y: q.y + 6 + j * 4 })), CELLAR.timberLo, 2);
    }
    // Up at the top it goes off into the dark.
    const gt = floorCtx.createLinearGradient(0, at(0, 0.5).y, 0, at(0, 1).y);
    gt.addColorStop(0, 'rgba(6,4,3,0)');
    gt.addColorStop(0.55, 'rgba(6,4,3,0.55)');
    gt.addColorStop(1, 'rgba(6,4,3,0.98)');
    paintQuad([at(0, 0.5), at(1, 0.5), at(1, 1), at(0, 1)], gt, null);
    // The floor meets the wall in shadow.
    const g = floorCtx.createLinearGradient(0, at(0, 0).y, 0, at(0, 0.14).y);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    paintQuad([at(0, 0), at(1, 0), at(1, 0.14), at(0, 0.14)], g, null);
    strokePolyline([at(0, 0), at(1, 0)], 'rgba(0,0,0,0.75)', 2.5);
  }
  // The timber that frames the face into bays: a post, and the beam across
  // the top of them all.
  function drawTimberPost(p, h) {
    const w = 5;
    paintQuad([{ x: p.x - w - 3, y: p.y + 1 }, { x: p.x + w + 3, y: p.y + 1 }, { x: p.x + w + 3, y: p.y - h }, { x: p.x - w - 3, y: p.y - h }],
      'rgba(0,0,0,0.35)', null);
    paintQuad([{ x: p.x - w, y: p.y }, { x: p.x + w, y: p.y }, { x: p.x + w, y: p.y - h }, { x: p.x - w, y: p.y - h }], CELLAR.timber, null);
    paintQuad([{ x: p.x - w, y: p.y }, { x: p.x - w + 3, y: p.y }, { x: p.x - w + 3, y: p.y - h }, { x: p.x - w, y: p.y - h }], CELLAR.timberHi, null);
    paintQuad([{ x: p.x + w - 2.5, y: p.y }, { x: p.x + w, y: p.y }, { x: p.x + w, y: p.y - h }, { x: p.x + w - 2.5, y: p.y - h }], CELLAR.timberLo, null);
    // The plate it stands on.
    paintQuad([{ x: p.x - w - 3, y: p.y }, { x: p.x + w + 3, y: p.y }, { x: p.x + w + 3, y: p.y - 5 }, { x: p.x - w - 3, y: p.y - 5 }], CELLAR.timberLo, null);
  }
  function drawTimberBeam(from, to, h) {
    const t = 9;
    const up = (p, dy) => ({ x: p.x, y: p.y - h - dy });
    paintQuad([up(from, -3), up(to, -3), up(to, t - 3), up(from, t - 3)], 'rgba(0,0,0,0.4)', null);
    paintQuad([up(from, 0), up(to, 0), up(to, t), up(from, t)], CELLAR.timber, null);
    paintQuad([up(from, t - 3), up(to, t - 3), up(to, t), up(from, t)], CELLAR.timberHi, null);
    paintQuad([up(from, 0), up(to, 0), up(to, 2.5), up(from, 2.5)], CELLAR.timberLo, null);
  }
  // A lantern hung from the beam on a short chain, and what it lights.
  function drawHungLantern(p, light) {
    strokePolyline([p, { x: p.x, y: p.y + 14 }], '#2a2622', 1.6);
    const l = { x: p.x, y: p.y + 14 };
    const post = '#1f1c1a';
    drawGlow({ x: l.x, y: l.y + 9 }, 60, light.bulb, 0.55);
    paintQuad([{ x: l.x - 7.5, y: l.y }, { x: l.x + 7.5, y: l.y }, { x: l.x, y: l.y - 5 }], post, null);
    paintQuad([{ x: l.x - 6, y: l.y }, { x: l.x + 6, y: l.y }, { x: l.x + 6, y: l.y + 17 }, { x: l.x - 6, y: l.y + 17 }], post, null);
    paintQuad([{ x: l.x - 4.5, y: l.y + 2 }, { x: l.x + 4.5, y: l.y + 2 }, { x: l.x + 4.5, y: l.y + 15 }, { x: l.x - 4.5, y: l.y + 15 }], light.bulb, null);
    paintQuad([{ x: l.x - 2, y: l.y + 17 }, { x: l.x + 2, y: l.y + 17 }, { x: l.x + 2, y: l.y + 20 }, { x: l.x - 2, y: l.y + 20 }], post, null);
  }
  // The warm the lanterns throw on the stone and the earth about them.
  function drawWarmth(p, r) {
    floorCtx.save();
    floorCtx.globalCompositeOperation = 'lighter';
    const g = floorCtx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r);
    g.addColorStop(0, 'rgba(255,170,90,0.26)');
    g.addColorStop(0.3, 'rgba(255,150,75,0.13)');
    g.addColorStop(0.65, 'rgba(255,140,70,0.04)');
    g.addColorStop(1, 'rgba(255,130,60,0)');
    floorCtx.fillStyle = g;
    floorCtx.beginPath();
    floorCtx.ellipse(p.x, p.y, r, r * 0.85, 0, 0, Math.PI * 2);
    floorCtx.fill();
    floorCtx.restore();
  }
  // A lamp on the kerb of a drain: a squat timber bollard with a lantern
  // head on it, standing along the edge the way the pier's posts do.
  //
  // Low on purpose. The site is drawn under the floors, so anything
  // standing on the ground in front of a floor has whatever rises above
  // about a metre hidden behind that floor -- which read as a lamp buried
  // under the floorboards with its light leaking out. A bollard this high
  // stays in front of the floor at the closest a drain ever runs to one.
  const KERB_LAMP_H = 30;
  function drawKerbLamp(p, light) {
    const H = KERB_LAMP_H;
    const top = { x: p.x, y: p.y - H };
    paintQuad([{ x: p.x - 7, y: p.y + 1 }, { x: p.x + 7, y: p.y + 1 }, { x: p.x + 7, y: p.y - 5 }, { x: p.x - 7, y: p.y - 5 }], CELLAR.timberLo, 'rgba(0,0,0,0.45)', 1);
    paintQuad([{ x: p.x - 4, y: p.y }, { x: p.x + 4, y: p.y }, { x: p.x + 4, y: top.y }, { x: p.x - 4, y: top.y }], CELLAR.timber, null);
    paintQuad([{ x: p.x - 4, y: p.y }, { x: p.x - 1.6, y: p.y }, { x: p.x - 1.6, y: top.y }, { x: p.x - 4, y: top.y }], CELLAR.timberHi, null);
    // The lantern on top: a warm pane in a dark case under a little cap.
    drawGlow({ x: top.x, y: top.y - 7 }, 44, light.bulb, 0.5);
    const case_ = '#1f1c1a';
    paintQuad([{ x: top.x - 6, y: top.y }, { x: top.x + 6, y: top.y }, { x: top.x + 6, y: top.y - 14 }, { x: top.x - 6, y: top.y - 14 }], case_, null);
    paintQuad([{ x: top.x - 4.5, y: top.y - 2 }, { x: top.x + 4.5, y: top.y - 2 }, { x: top.x + 4.5, y: top.y - 12 }, { x: top.x - 4.5, y: top.y - 12 }], light.bulb, null);
    paintQuad([{ x: top.x - 7.5, y: top.y - 14 }, { x: top.x + 7.5, y: top.y - 14 }, { x: top.x, y: top.y - 19 }], case_, null);
    drawFloorPool(p, light, 1.4);
  }

  // ---- The services ----
  function drawFlange(p, thick) {
    paintQuad([{ x: p.x - 4, y: p.y - thick * 0.8 - 3 }, { x: p.x + 4, y: p.y - thick * 0.8 - 3 },
      { x: p.x + 4, y: p.y + thick * 0.8 + 3 }, { x: p.x - 4, y: p.y + thick * 0.8 + 3 }],
    '#33363b', 'rgba(0,0,0,0.55)', 1);
  }
  function drawValve(p, thick) {
    drawFlange(p, thick);
    strokePolyline([{ x: p.x, y: p.y - thick }, { x: p.x, y: p.y - thick - 11 }], '#4a4d52', 3);
    floorCtx.beginPath();
    floorCtx.ellipse(p.x, p.y - thick - 13, 8, 4, 0, 0, Math.PI * 2);
    floorCtx.strokeStyle = '#b8402c';
    floorCtx.lineWidth = 3;
    floorCtx.stroke();
  }
  // A pipe along a line: the shadow under it, the barrel, the light down
  // its top, a bracket every so often and a flange at every joint.
  function drawBigPipe(pts, thick, colour, valveAt) {
    strokePolyline(pts.map((p) => ({ x: p.x, y: p.y + 4 })), 'rgba(0,0,0,0.45)', thick + 4);
    strokePolyline(pts, shade(colour, -30), thick + 1);
    strokePolyline(pts, colour, thick - 2);
    strokePolyline(pts.map((p) => ({ x: p.x, y: p.y - thick * 0.28 })), 'rgba(255,235,210,0.22)', Math.max(1.5, thick * 0.2));
    for (let i = 1; i < pts.length - 1; i++) drawFlange(pts[i], thick);
    for (let i = 0; i < pts.length - 1; i++) {
      const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      const steps = Math.max(1, Math.round(d / 170));
      for (let k = 1; k < steps; k++) drawFlange(lerpPt(pts[i], pts[i + 1], k / steps), thick);
    }
    if (valveAt != null) drawValve(lerpPt(pts[0], pts[1], valveAt), thick);
  }
  // A grille let into the stone, with the dark behind it.
  function drawRockGrille(p) {
    paintQuad([{ x: p.x - 22, y: p.y - 14 }, { x: p.x + 22, y: p.y - 14 },
      { x: p.x + 22, y: p.y + 14 }, { x: p.x - 22, y: p.y + 14 }], '#3d3a37', 'rgba(0,0,0,0.6)', 1.5);
    paintQuad([{ x: p.x - 18, y: p.y - 10 }, { x: p.x + 18, y: p.y - 10 },
      { x: p.x + 18, y: p.y + 10 }, { x: p.x - 18, y: p.y + 10 }], '#0e0c0b', null);
    for (let k = 0; k < 4; k++) {
      paintQuad([{ x: p.x - 18, y: p.y - 8 + k * 5 }, { x: p.x + 18, y: p.y - 8 + k * 5 },
        { x: p.x + 18, y: p.y - 6 + k * 5 }, { x: p.x - 18, y: p.y - 6 + k * 5 }], '#4d4844', null);
    }
  }

  // ---- What stands about ----
  function drawCrate(p, w, h) {
    drawIsoBox(floorCtx, p, 0, 0, w, w * 0.86, h, '#6b4d2c', 0);
    drawIsoBox(floorCtx, p, 0, 0, w + 0.1, w * 0.86 + 0.1, 4, '#4f3820', h);
  }
  // A wooden barrel: the staves, two hoops and the lid.
  function drawBarrel(p, tone) {
    const r = 11;
    const h = 30;
    const body = shade(CELLAR.plank, tone || 0);
    paintQuad([{ x: p.x - r - 4, y: p.y + 2 }, { x: p.x + r + 6, y: p.y + 4 }, { x: p.x + r, y: p.y + 7 }, { x: p.x - r, y: p.y + 6 }], 'rgba(0,0,0,0.35)', null);
    floorCtx.beginPath();
    floorCtx.ellipse(p.x, p.y, r, r * 0.5, 0, 0, Math.PI);
    floorCtx.lineTo(p.x - r, p.y - h);
    floorCtx.ellipse(p.x, p.y - h, r, r * 0.5, 0, Math.PI, 0, true);
    floorCtx.closePath();
    floorCtx.fillStyle = body;
    floorCtx.fill();
    paintQuad([{ x: p.x - r, y: p.y }, { x: p.x - r + 5, y: p.y }, { x: p.x - r + 5, y: p.y - h }, { x: p.x - r, y: p.y - h }], hexA(CELLAR.plankB, 0.8), null);
    paintQuad([{ x: p.x + r - 5, y: p.y }, { x: p.x + r, y: p.y }, { x: p.x + r, y: p.y - h }, { x: p.x + r - 5, y: p.y - h }], 'rgba(0,0,0,0.25)', null);
    [0.22, 0.72].forEach((f) => {
      floorCtx.beginPath();
      floorCtx.ellipse(p.x, p.y - h * f, r, r * 0.5, 0, 0, Math.PI);
      floorCtx.strokeStyle = '#3a3a3e';
      floorCtx.lineWidth = 2.4;
      floorCtx.stroke();
    });
    floorCtx.beginPath();
    floorCtx.ellipse(p.x, p.y - h, r, r * 0.5, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = shade(body, 12);
    floorCtx.fill();
    floorCtx.strokeStyle = 'rgba(0,0,0,0.45)';
    floorCtx.lineWidth = 1;
    floorCtx.stroke();
  }
  function drawSack(p, seed) {
    const r = 10 + noise(seed, 1, 241) * 4;
    paintQuad([{ x: p.x - r, y: p.y + 2 }, { x: p.x + r + 4, y: p.y + 3 }, { x: p.x + r, y: p.y + 6 }, { x: p.x - r + 2, y: p.y + 5 }], 'rgba(0,0,0,0.3)', null);
    floorCtx.beginPath();
    floorCtx.ellipse(p.x, p.y - r * 0.5, r, r * 0.7, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = '#a8946c';
    floorCtx.fill();
    floorCtx.beginPath();
    floorCtx.ellipse(p.x - r * 0.2, p.y - r * 0.7, r * 0.55, r * 0.35, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = '#bfab80';
    floorCtx.fill();
    strokePolyline([{ x: p.x - 4, y: p.y - r * 1.15 }, { x: p.x + 4, y: p.y - r * 1.15 }], '#6f5d3e', 2);
  }

  // A thin metal railing along an edge.
  function drawCellarRail(from, to) {
    const H = 40;
    const up = (p, h) => ({ x: p.x, y: p.y - h });
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const posts = Math.max(2, Math.round(len / 40));
    for (let i = 0; i <= posts; i++) {
      const p = lerpPt(from, to, i / posts);
      paintQuad([{ x: p.x - 1.5, y: p.y }, { x: p.x + 1.5, y: p.y }, { x: p.x + 1.5, y: p.y - H }, { x: p.x - 1.5, y: p.y - H }],
        '#2a2a2e', null);
    }
    strokePolyline([up(from, H), up(to, H)], '#4a4a50', 2.2);
    strokePolyline([up(from, H * 0.55), up(to, H * 0.55)], '#3a3a40', 1.6);
  }
  // Solid concrete with stone treads, a rail down the open side, a landing
  // at the top and the doorway there, framed in timber with a lantern
  // over it.
  function drawWallStair(light) {
    const s = cellarStair();
    const wp = (gx, out, z) => {
      const p = isoPoint(gx, s.gy + out);
      return { x: p.x, y: p.y - z };
    };
    const O = STAIR.out;
    const n = STAIR.treads;
    const dgx = (s.gxB - s.gxT) / n;
    const dz = s.zT / n;
    const gxL = s.gxT - STAIR.landing;
    // The doorway, cut into the stone behind the landing, with the steps
    // inside going on up into the dark.
    const dH = 2.1 * PX_PER_METRE_TALL;
    paintQuad([wp(gxL + 0.5, 0, s.zT), wp(s.gxT - 0.5, 0, s.zT), wp(s.gxT - 0.5, 0, s.zT + dH), wp(gxL + 0.5, 0, s.zT + dH)], '#050403', null);
    for (let i = 0; i < 5; i++) {
      const z = s.zT + 4 + i * 11;
      paintQuad([wp(gxL + 0.5, 0, z), wp(s.gxT - 0.5, 0, z), wp(s.gxT - 0.5, 0, z + 4.5), wp(gxL + 0.5, 0, z + 4.5)],
        shade('#7a6a58', -i * 14), null);
    }
    // The timber frame round it.
    const frame = (g0, g1, z0, z1, col) => paintQuad([wp(g0, 0, z0), wp(g1, 0, z0), wp(g1, 0, z1), wp(g0, 0, z1)], col, null);
    frame(gxL + 0.05, gxL + 0.5, s.zT - 2, s.zT + dH + 4, CELLAR.timber);
    frame(gxL + 0.05, gxL + 0.2, s.zT - 2, s.zT + dH + 4, CELLAR.timberHi);
    frame(s.gxT - 0.5, s.gxT - 0.05, s.zT - 2, s.zT + dH + 4, CELLAR.timber);
    frame(s.gxT - 0.5, s.gxT - 0.35, s.zT - 2, s.zT + dH + 4, CELLAR.timberHi);
    frame(gxL - 0.1, s.gxT + 0.1, s.zT + dH + 2, s.zT + dH + 12, CELLAR.timber);
    frame(gxL - 0.1, s.gxT + 0.1, s.zT + dH + 9, s.zT + dH + 12, CELLAR.timberHi);
    // The solid side of the flight and the landing.
    paintQuad([wp(s.gxB, O, 0), wp(s.gxT, O, s.zT), wp(gxL, O, s.zT), wp(gxL, O, 0)], '#4a4441', 'rgba(0,0,0,0.6)', 1);
    strokePolyline([wp(s.gxB, O, 1), wp(s.gxT, O, s.zT + 1), wp(gxL, O, s.zT + 1)], 'rgba(0,0,0,0.5)', 2);
    // The treads and risers, bottom to top.
    for (let i = 0; i < n; i++) {
      const g1 = s.gxB - i * dgx;
      const g0 = g1 - dgx;
      const z0 = i * dz;
      const z1 = z0 + dz;
      paintQuad([wp(g1, 0, z0), wp(g1, O, z0), wp(g1, O, z1), wp(g1, 0, z1)], '#332e2b', null);
      paintQuad([wp(g0, 0, z1), wp(g1, 0, z1), wp(g1, O, z1), wp(g0, O, z1)],
        shade('#8a827a', Math.round(-i * 1.2)), 'rgba(0,0,0,0.4)', 1);
      strokePolyline([wp(g1, 0, z1), wp(g1, O, z1)], 'rgba(255,240,220,0.25)', 1);
    }
    // The landing, and the lantern over the door lighting it.
    paintQuad([wp(gxL, 0, s.zT), wp(s.gxT, 0, s.zT), wp(s.gxT, O, s.zT), wp(gxL, O, s.zT)], '#7a726a', 'rgba(0,0,0,0.4)', 1);
    const mid = (gxL + s.gxT) / 2;
    const hang = wp(mid, 0.4, s.zT + dH + 14);
    strokePolyline([wp(mid, 0, s.zT + dH + 12), hang], CELLAR.timberLo, 3);
    drawHungLantern(hang, light);
    drawFloorPool(wp(mid, O * 0.5, s.zT), light, 1.5);
    // A sign by the door.
    const sg = wp(s.gxT + 0.7, 0, s.zT + dH * 0.72);
    paintQuad([{ x: sg.x - 3, y: sg.y - 12 }, { x: sg.x + 15, y: sg.y - 3 }, { x: sg.x + 15, y: sg.y + 11 }, { x: sg.x - 3, y: sg.y + 2 }],
      '#2c7a3a', 'rgba(0,0,0,0.5)', 1);
    strokePolyline([{ x: sg.x + 1, y: sg.y - 3 }, { x: sg.x + 11, y: sg.y + 2 }], 'rgba(255,255,255,0.75)', 2);
    // The rail down the open side and round the landing.
    const H = 42;
    const posts = [];
    for (let i = 0; i <= n; i += 2) posts.push(wp(s.gxB - i * dgx, O, i * dz));
    posts.push(wp(gxL + 0.15, O, s.zT));
    posts.push(wp(gxL + 0.15, O * 0.5, s.zT));
    posts.forEach((p) => strokePolyline([p, { x: p.x, y: p.y - H }], '#2c2c30', 3));
    [1, 0.55].forEach((f) => {
      strokePolyline(posts.slice(0, -1).map((p) => ({ x: p.x, y: p.y - H * f })), f === 1 ? '#55555c' : '#3c3c42', f === 1 ? 2.4 : 1.6);
      const l0 = posts[posts.length - 2];
      const l1 = posts[posts.length - 1];
      strokePolyline([{ x: l0.x, y: l0.y - H * f }, { x: l1.x, y: l1.y - H * f }], f === 1 ? '#55555c' : '#3c3c42', f === 1 ? 2.4 : 1.6);
    });
    // The meter boxes at the foot of it, because that is where they are.
    const foot = isoPoint(s.gxB + 3.4, s.gy + 0.6);
    drawIsoBox(floorCtx, foot, 0, 0, 0.45, 0.35, 34, '#7a7d82', 0);
    drawIsoBox(floorCtx, foot, 0, 1.1, 0.45, 0.35, 28, '#6f7277', 0);
    const hz = isoScreenPoint(foot, 0.46, 0, 22);
    paintQuad([{ x: hz.x - 4, y: hz.y + 3 }, { x: hz.x + 4, y: hz.y + 3 }, { x: hz.x, y: hz.y - 5 }], '#e2b21f', null);
  }

  // ---- The front of the pit ----
  // The two open sides are framed the way the yard is framed by its fence:
  // a stone-lined drain runs along both, a plank bridge crosses each where
  // the way out meets it, lanterns stand along the inner edge, and beyond
  // the drain the earth goes off into the dark. Inside the frame what
  // stands about is a few things in their places -- the boiler, the spoil
  // from the digging, the barrels, the crates -- not a scatter.
  const CHANNEL = { gap: 1.6, width: 2.2, depth: 7, reach: 44 };
  function cellarChannels() {
    const a = cellarApron();
    const gx1 = a.gx0 + a.cols;
    const gy1 = a.gy0 + a.rows;
    const r = CHANNEL.reach;
    const outer = CHANNEL.gap + CHANNEL.width;
    return {
      L: { gx0: a.gx0 - r, gy0: gy1 + CHANNEL.gap, cols: (gx1 + outer) - (a.gx0 - r), rows: CHANNEL.width, along: 'gx' },
      R: { gx0: gx1 + CHANNEL.gap, gy0: a.gy0 - r, cols: CHANNEL.width, rows: (gy1 + outer) - (a.gy0 - r), along: 'gy' },
      bridgeL: { gx0: a.gx0 + a.cols * 0.42, gy0: gy1 + CHANNEL.gap - 0.7, cols: 3.2, rows: CHANNEL.width + 1.4 },
      bridgeR: { gx0: gx1 + CHANNEL.gap - 0.7, gy0: a.gy0 + a.rows * 0.55, cols: CHANNEL.width + 1.4, rows: 3.2 },
    };
  }
  // A drain: the kerb on the far side, its wall going down, the water,
  // and the kerb on the near side over it.
  function drawChannel(ch) {
    const d = CHANNEL.depth;
    const kerb = 0.5;
    const gx1 = ch.gx0 + ch.cols;
    const gy1 = ch.gy0 + ch.rows;
    const dn = (p, dy) => ({ x: p.x, y: p.y + dy });
    const q = (a, b, c, e) => [a, b, c, e];
    if (ch.along === 'gx') {
      // Runs down-right; the far side is the low-gy side.
      const far0 = isoPoint(ch.gx0, ch.gy0);
      const far1 = isoPoint(gx1, ch.gy0);
      paintQuad(q(isoPoint(ch.gx0, ch.gy0 - kerb), isoPoint(gx1, ch.gy0 - kerb), far1, far0), CELLAR.stoneHi, 'rgba(0,0,0,0.5)', 1);
      paintQuad(q(far0, far1, dn(far1, d), dn(far0, d)), CELLAR.stoneLo, null);
      paintQuad(q(dn(far0, d), dn(far1, d), dn(isoPoint(gx1, gy1), d), dn(isoPoint(ch.gx0, gy1), d)), CELLAR.water, null);
      strokePolyline([dn(isoPoint(ch.gx0, ch.gy0 + ch.rows * 0.45), d), dn(isoPoint(gx1, ch.gy0 + ch.rows * 0.45), d)], 'rgba(255,220,170,0.10)', 2);
      paintQuad(q(isoPoint(ch.gx0, gy1), isoPoint(gx1, gy1), isoPoint(gx1, gy1 + kerb), isoPoint(ch.gx0, gy1 + kerb)), CELLAR.stone, 'rgba(0,0,0,0.5)', 1);
    } else {
      // Runs down-left; the far side is the low-gx side.
      const far0 = isoPoint(ch.gx0, ch.gy0);
      const far1 = isoPoint(ch.gx0, gy1);
      paintQuad(q(isoPoint(ch.gx0 - kerb, ch.gy0), far0, far1, isoPoint(ch.gx0 - kerb, gy1)), CELLAR.stoneHi, 'rgba(0,0,0,0.5)', 1);
      paintQuad(q(far0, far1, dn(far1, d), dn(far0, d)), CELLAR.stoneLo, null);
      paintQuad(q(dn(far0, d), dn(far1, d), dn(isoPoint(gx1, gy1), d), dn(isoPoint(gx1, ch.gy0), d)), CELLAR.water, null);
      strokePolyline([dn(isoPoint(ch.gx0 + ch.cols * 0.45, ch.gy0), d), dn(isoPoint(ch.gx0 + ch.cols * 0.45, gy1), d)], 'rgba(255,220,170,0.10)', 2);
      paintQuad(q(isoPoint(gx1, ch.gy0), isoPoint(gx1 + kerb, ch.gy0), isoPoint(gx1 + kerb, gy1), isoPoint(gx1, gy1)), CELLAR.stone, 'rgba(0,0,0,0.5)', 1);
    }
  }
  // Where the two drains meet: a stone sump with a grate over it.
  function drawSumpBox(gx, gy) {
    const h = 2.1;
    const d = CHANNEL.depth;
    const at = (u, v, z) => {
      const p = isoPoint(u, v);
      return { x: p.x, y: p.y + (z || 0) };
    };
    paintQuad([at(gx - h, gy - h), at(gx + h, gy - h), at(gx + h, gy + h), at(gx - h, gy + h)], CELLAR.stoneHi, 'rgba(0,0,0,0.5)', 1);
    paintQuad([at(gx - h + 0.5, gy - h + 0.5), at(gx + h - 0.5, gy - h + 0.5), at(gx + h - 0.5, gy + h - 0.5), at(gx - h + 0.5, gy + h - 0.5)], '#0c0a09', null);
    paintQuad([at(gx - h + 0.5, gy - h + 0.5), at(gx + h - 0.5, gy - h + 0.5), at(gx + h - 0.5, gy + h - 0.5, d), at(gx - h + 0.5, gy + h - 0.5, d)], CELLAR.water, null);
    const n = 7;
    for (let i = 1; i < n; i++) {
      const t = -h + 0.5 + (2 * (h - 0.5) * i) / n;
      strokePolyline([at(gx + t, gy - h + 0.6), at(gx + t, gy + h - 0.6)], '#4a4c50', 2);
    }
    strokePolyline([at(gx - h + 0.5, gy - h + 0.5), at(gx + h - 0.5, gy - h + 0.5), at(gx + h - 0.5, gy + h - 0.5), at(gx - h + 0.5, gy + h - 0.5), at(gx - h + 0.5, gy - h + 0.5)], '#5a5c60', 2);
  }
  // A plank bridge over a drain: the boards laid across the way over, a
  // bearer either side, and a low timber rail.
  function drawBridge(rect, across) {
    drawPlankWalk(rect, across);
    const H = 22;
    const post = (p) => {
      paintQuad([{ x: p.x - 2, y: p.y }, { x: p.x + 2, y: p.y }, { x: p.x + 2, y: p.y - H }, { x: p.x - 2, y: p.y - H }], CELLAR.timber, null);
    };
    const gx1 = rect.gx0 + rect.cols;
    const gy1 = rect.gy0 + rect.rows;
    const sides = across
      ? [[isoPoint(rect.gx0, rect.gy0), isoPoint(gx1, rect.gy0)], [isoPoint(rect.gx0, gy1), isoPoint(gx1, gy1)]]
      : [[isoPoint(rect.gx0, rect.gy0), isoPoint(rect.gx0, gy1)], [isoPoint(gx1, rect.gy0), isoPoint(gx1, gy1)]];
    sides.forEach((s) => {
      post(s[0]);
      post(s[1]);
      strokePolyline([{ x: s[0].x, y: s[0].y - H }, { x: s[1].x, y: s[1].y - H }], CELLAR.timberHi, 2.4);
    });
  }
  // Beyond the drains the earth goes off into the dark.
  function drawDarkBeyond(view) {
    const ch = cellarChannels();
    const r = latticeRange(view);
    const fade = 14;
    const wash = (p0, dir, poly) => {
      const s = 200 / Math.hypot(dir.x, dir.y);
      const g = floorCtx.createLinearGradient(p0.x, p0.y, p0.x + dir.x * s, p0.y + dir.y * s);
      g.addColorStop(0, 'rgba(6,4,3,0)');
      g.addColorStop(0.5, 'rgba(6,4,3,0.55)');
      g.addColorStop(1, 'rgba(6,4,3,0.9)');
      paintQuad(poly, g, null);
    };
    const gyL = ch.L.gy0 + ch.L.rows;
    wash(isoPoint(0, gyL), { x: -1, y: 2 },
      [isoPoint(r.gx0, gyL), isoPoint(r.gx1, gyL), isoPoint(r.gx1, r.gy1 + fade), isoPoint(r.gx0, r.gy1 + fade)]);
    const gxR = ch.R.gx0 + ch.R.cols;
    wash(isoPoint(gxR, 0), { x: 1, y: 2 },
      [isoPoint(gxR, r.gy0), isoPoint(r.gx1 + fade, r.gy0), isoPoint(r.gx1 + fade, r.gy1), isoPoint(gxR, r.gy1)]);
  }

  // ---- What stands in the pit ----
  // The boiler: an iron cylinder on a stone plinth, the firebox glowing at
  // the foot of it, a gauge, a flue, and its pipe running off to the drain.
  function drawBoiler(base, light) {
    const rx = 34;
    const ry = 17;
    const H = 2.6 * PX_PER_METRE_TALL;
    const iron = '#3d4148';
    drawIsoBox(floorCtx, base, 0, 0, 1.6, 1.6, 8, '#4a4441', 0);
    const c = { x: base.x, y: base.y - 8 };
    // The barrel of it.
    floorCtx.beginPath();
    floorCtx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI);
    floorCtx.lineTo(c.x - rx, c.y - H);
    floorCtx.ellipse(c.x, c.y - H, rx, ry, 0, Math.PI, 0, true);
    floorCtx.closePath();
    floorCtx.fillStyle = iron;
    floorCtx.fill();
    paintQuad([{ x: c.x - rx, y: c.y }, { x: c.x - rx + 10, y: c.y }, { x: c.x - rx + 10, y: c.y - H }, { x: c.x - rx, y: c.y - H }], hexA('#6a7079', 0.7), null);
    paintQuad([{ x: c.x + rx - 11, y: c.y }, { x: c.x + rx, y: c.y }, { x: c.x + rx, y: c.y - H }, { x: c.x + rx - 11, y: c.y - H }], 'rgba(0,0,0,0.3)', null);
    [0.3, 0.62].forEach((f) => {
      floorCtx.beginPath();
      floorCtx.ellipse(c.x, c.y - H * f, rx, ry, 0, 0, Math.PI);
      floorCtx.strokeStyle = '#2a2d33';
      floorCtx.lineWidth = 3;
      floorCtx.stroke();
      floorCtx.beginPath();
      floorCtx.ellipse(c.x, c.y - H * f - 2, rx, ry, 0, 0, Math.PI);
      floorCtx.strokeStyle = 'rgba(255,255,255,0.08)';
      floorCtx.lineWidth = 1.5;
      floorCtx.stroke();
    });
    floorCtx.beginPath();
    floorCtx.ellipse(c.x, c.y - H, rx, ry, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = '#50555d';
    floorCtx.fill();
    floorCtx.strokeStyle = 'rgba(0,0,0,0.5)';
    floorCtx.lineWidth = 1;
    floorCtx.stroke();
    // The flue, with its cap.
    const fl = { x: c.x + 9, y: c.y - H - 4 };
    paintQuad([{ x: fl.x - 5, y: fl.y }, { x: fl.x + 5, y: fl.y }, { x: fl.x + 5, y: fl.y - 60 }, { x: fl.x - 5, y: fl.y - 60 }], '#2f3238', null);
    paintQuad([{ x: fl.x - 10, y: fl.y - 60 }, { x: fl.x + 10, y: fl.y - 60 }, { x: fl.x + 7, y: fl.y - 68 }, { x: fl.x - 7, y: fl.y - 68 }], '#2f3238', null);
    // The firebox at the foot, and the warm it throws.
    const fb = { x: c.x - 5, y: c.y - 20 };
    paintQuad([{ x: fb.x - 12, y: fb.y + 9 }, { x: fb.x + 12, y: fb.y + 9 }, { x: fb.x + 12, y: fb.y - 11 }, { x: fb.x - 12, y: fb.y - 11 }], '#1a1a1c', null);
    paintQuad([{ x: fb.x - 9, y: fb.y + 6 }, { x: fb.x + 9, y: fb.y + 6 }, { x: fb.x + 9, y: fb.y - 8 }, { x: fb.x - 9, y: fb.y - 8 }], '#ff8a2a', null);
    paintQuad([{ x: fb.x - 6, y: fb.y + 3 }, { x: fb.x + 6, y: fb.y + 3 }, { x: fb.x + 6, y: fb.y - 4 }, { x: fb.x - 6, y: fb.y - 4 }], '#ffd27a', null);
    strokePolyline([{ x: fb.x - 12, y: fb.y }, { x: fb.x + 12, y: fb.y }], '#1a1a1c', 2);
    drawGlow(fb, 54, '#ff9a3a', 0.5);
    // The gauge.
    const g = { x: c.x - 8, y: c.y - H * 0.78 };
    floorCtx.beginPath();
    floorCtx.arc(g.x, g.y, 8, 0, Math.PI * 2);
    floorCtx.fillStyle = '#e8e2d2';
    floorCtx.fill();
    floorCtx.strokeStyle = '#1a1a1c';
    floorCtx.lineWidth = 1.5;
    floorCtx.stroke();
    strokePolyline([g, { x: g.x + 4, y: g.y - 4.5 }], '#b8402c', 1.8);
    drawFloorPool({ x: base.x - 8, y: base.y + 18 }, { glow: 'rgba(255,150,70,0.4)', bulb: '#ff9a3a' }, 1.5);
  }
  // The spoil from the digging: a mound of earth, a shovel stuck in it and
  // the barrow beside it.
  function drawSpoilHeap(p) {
    const rx = 62;
    const ry = 34;
    paintQuad([{ x: p.x - rx, y: p.y + 4 }, { x: p.x + rx + 10, y: p.y + 6 }, { x: p.x + rx, y: p.y + 12 }, { x: p.x - rx + 6, y: p.y + 10 }], 'rgba(0,0,0,0.3)', null);
    const g = floorCtx.createRadialGradient(p.x - rx * 0.2, p.y - ry * 0.6, 2, p.x, p.y, rx);
    g.addColorStop(0, '#5a4331');
    g.addColorStop(0.55, CELLAR.earthHi);
    g.addColorStop(1, CELLAR.earthLo);
    floorCtx.beginPath();
    floorCtx.moveTo(p.x - rx, p.y + 2);
    floorCtx.quadraticCurveTo(p.x - rx * 0.6, p.y - ry * 1.1, p.x - rx * 0.1, p.y - ry);
    floorCtx.quadraticCurveTo(p.x + rx * 0.5, p.y - ry * 0.9, p.x + rx, p.y + 2);
    floorCtx.quadraticCurveTo(p.x, p.y + ry * 0.45, p.x - rx, p.y + 2);
    floorCtx.closePath();
    floorCtx.fillStyle = g;
    floorCtx.fill();
    drawStone({ x: p.x + 20, y: p.y - 8 }, 8, 1);
    drawStone({ x: p.x - 24, y: p.y - 2 }, 6, 2);
    drawStone({ x: p.x + 4, y: p.y - 22 }, 5, 3);
    drawStone({ x: p.x - 8, y: p.y + 6 }, 4, 4);
    // The shovel.
    const s0 = { x: p.x - 8, y: p.y - 16 };
    const s1 = { x: p.x + 14, y: p.y - 60 };
    strokePolyline([s0, s1], '#8a6238', 3.5);
    strokePolyline([{ x: s1.x - 7, y: s1.y - 1 }, { x: s1.x + 7, y: s1.y + 1 }], '#8a6238', 3.5);
    paintQuad([{ x: s0.x - 8, y: s0.y - 3 }, { x: s0.x + 5, y: s0.y - 11 }, { x: s0.x + 11, y: s0.y + 3 }, { x: s0.x - 3, y: s0.y + 11 }], '#5a5e66', 'rgba(0,0,0,0.5)', 1);
  }
  function drawBarrow(base) {
    // The tray, tipped up a little on its wheel, and the handles.
    drawIsoBox(floorCtx, base, 0, 0, 0.8, 1.2, 18, '#5e6570', 12);
    const w = isoScreenPoint(base, 0, -1.3, 0);
    floorCtx.beginPath();
    floorCtx.ellipse(w.x, w.y - 11, 5.5, 11, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = '#1e1f23';
    floorCtx.fill();
    floorCtx.beginPath();
    floorCtx.ellipse(w.x, w.y - 11, 2.8, 6, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = '#4a4d55';
    floorCtx.fill();
    [-0.5, 0.5].forEach((u) => {
      const h0 = isoScreenPoint(base, u, 1.2, 16);
      const h1 = isoScreenPoint(base, u, 2.3, 3);
      strokePolyline([h0, h1], '#8a6238', 3.5);
    });
    // A load of earth in it.
    const top = isoScreenPoint(base, 0, 0, 30);
    floorCtx.beginPath();
    floorCtx.ellipse(top.x, top.y, 14, 8, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = CELLAR.earthHi;
    floorCtx.fill();
    paintQuad([isoScreenPoint(base, 0.25, 1.25, 1), isoScreenPoint(base, 0.25, 1.25, 8), isoScreenPoint(base, -0.25, 1.25, 8), isoScreenPoint(base, -0.25, 1.25, 1)], '#3a3d44', null);
  }
  // Barrels kept together on a bit of timber, a couple on top.
  function drawBarrelStore(base) {
    const at = (u, v) => isoScreenPoint(base, u, v, 0);
    paintQuad([at(-1.4, -0.9), at(1.4, -0.9), at(1.4, 0.9), at(-1.4, 0.9)], CELLAR.timberLo, 'rgba(0,0,0,0.5)', 1);
    [[-0.9, -0.4], [0, -0.4], [0.9, -0.4], [-0.45, 0.4], [0.45, 0.4]].forEach((uv, i) => drawBarrel(at(uv[0], uv[1]), (i % 2) * 8 - 4));
    [[-0.45, -0.4], [0.45, -0.4]].forEach((uv, i) => {
      const p = at(uv[0], uv[1]);
      drawBarrel({ x: p.x, y: p.y - 30 }, i * 6);
    });
  }
  // Planks stacked on a couple of bearers.
  function drawTimberPile(base) {
    const at = (u, v, z) => isoScreenPoint(base, u, v, z);
    [[-1.0], [1.0]].forEach((u) => paintQuad([at(u[0] - 0.15, -0.9, 0), at(u[0] + 0.15, -0.9, 0), at(u[0] + 0.15, 0.9, 0), at(u[0] - 0.15, 0.9, 0)], CELLAR.timberLo, null));
    for (let i = 0; i < 4; i++) {
      const z = 4 + i * 6;
      const v = -0.8 + i * 0.4 + (i % 2) * 0.1;
      paintQuad([at(-1.6, v, z), at(1.6, v, z), at(1.6, v + 0.45, z), at(-1.6, v + 0.45, z)], shade(CELLAR.plank, i * 4 - 4), 'rgba(50,28,10,0.6)', 1);
      paintQuad([at(-1.6, v + 0.45, z), at(1.6, v + 0.45, z), at(1.6, v + 0.45, z - 6), at(-1.6, v + 0.45, z - 6)], CELLAR.plankB, null);
    }
  }
  function drawCrateStack(base) {
    drawCrate(isoScreenPoint(base, -0.55, 0, 0), 1.0, 30);
    drawCrate(isoScreenPoint(base, 0.6, 0.1, 0), 0.9, 24);
    drawCrate(isoScreenPoint(base, -0.4, -0.1, 30), 0.85, 24);
    drawSack(isoScreenPoint(base, 0.5, 1.2, 0), 3);
  }

  // The floor of the cellar: earth to the edges in front of the walls, and
  // the plank walk from the stair.
  function drawCavernFloor(colors, view) {
    floorCtx.fillStyle = '#060404';
    floorCtx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    const r = latticeRange(view);
    const a = cellarApron();
    const gx0 = Math.max(r.gx0, a.gx0 - 1);
    const gy0 = Math.max(r.gy0, a.gy0 - 1);
    paintQuad([isoPoint(gx0, gy0), isoPoint(r.gx1, gy0), isoPoint(r.gx1, r.gy1), isoPoint(gx0, r.gy1)], CELLAR.earth, null);
    drawDirt(gx0, gy0, r.gx1, r.gy1, 141);
    // Out beyond the drains, in the dark: the odd stone and crate, and the
    // old timber props left standing.
    const ch = cellarChannels();
    const gyL = ch.L.gy0 + ch.L.rows;
    const gxR = ch.R.gx0 + ch.R.cols;
    for (let k = 0; k < 40; k++) {
      const gx = gx0 + noise(k, 21, 161) * (r.gx1 - gx0);
      const gy = gy0 + noise(k, 23, 162) * (r.gy1 - gy0);
      if (gy < gyL + 1.5 && gx < gxR + 1.5) continue;
      const n = noise(k, 27, 163);
      const p = isoPoint(gx, gy);
      if (n < 0.5) drawStone(p, 8 + n * 16, k);
      else if (n < 0.75) drawCrate(p, 0.9 + n * 0.5, 22);
      else if (n < 0.9) drawBarrel(p, 0);
      else drawTimberPost(p, 60 + n * 40);
    }
    drawDarkBeyond(view);
    drawChannel(ch.L);
    drawChannel(ch.R);
    drawSumpBox(ch.R.gx0 + ch.R.cols * 0.5, ch.L.gy0 + ch.L.rows * 0.5);
    drawBridge(ch.bridgeL, false);
    drawBridge(ch.bridgeR, true);
    drawPlankWalk(cellarWalk());
  }

  // The chamber itself, and everything in it.
  function drawCellarProps(colors, view) {
    const light = LIGHT_COLORS.basement;
    const a = cellarApron();
    const gx1 = a.gx0 + a.cols;
    const gy1 = a.gy0 + a.rows;
    const reach = 44;
    const lanterns = [];

    // ---- The stone behind. It runs on past both corners, so the chamber
    // closes at the sides rather than stopping where the rooms do.
    const nw = isoPoint(a.gx0, a.gy0);
    const neFar = isoPoint(gx1 + reach, a.gy0);
    const swFar = isoPoint(a.gx0, gy1 + reach);
    drawRockWall(neFar, nw, CELLAR.wall, 1);
    drawRockWall(nw, swFar, CELLAR.wall, 2);
    const onN = (t, k) => {
      const p = lerpPt(neFar, nw, t);
      return { x: p.x, y: p.y - k * CELLAR.wall };
    };
    const onW = (t, k) => {
      const p = lerpPt(nw, swFar, t);
      return { x: p.x, y: p.y - k * CELLAR.wall };
    };

    // ---- The services along both faces, behind the timber.
    drawBigPipe([onN(0.02, 0.5), onN(0.98, 0.5)], 13, CELLAR.pipe, 0.3);
    drawBigPipe([onN(0.02, 0.38), onN(0.98, 0.38)], 8, CELLAR.copper);
    drawBigPipe([onW(0.02, 0.5), onW(0.98, 0.5)], 13, CELLAR.pipe, 0.62);
    drawBigPipe([onW(0.02, 0.38), onW(0.98, 0.38)], 8, CELLAR.copper);
    drawBigPipe([onN(0.86, 0.5), onN(0.88, 0.2), onN(0.88, 0.02)], 11, CELLAR.pipe);
    drawBigPipe([onW(0.3, 0.5), onW(0.32, 0.2), onW(0.32, 0.02)], 11, CELLAR.pipe);
    drawRockGrille(onN(0.48, 0.26));
    drawRockGrille(onW(0.58, 0.24));

    // ---- The timber: posts every bay along both faces, the beam over
    // them, and a lantern hung from the beam in every bay.
    const beamH = CELLAR.wall * 0.72;
    const bays = (on, gxLen) => {
      const count = Math.max(2, Math.round(gxLen / CELLAR.bay));
      const spots = [];
      for (let i = 0; i <= count; i++) spots.push(i / count);
      spots.forEach((t) => drawTimberPost(on(t, 0), beamH));
      drawTimberBeam(on(0, 0), on(1, 0), beamH);
      for (let i = 0; i < count; i++) {
        if (i % 2) continue;
        lanterns.push(on((i + 0.5) / count, 0.72));
      }
    };
    bays(onN, gx1 + reach - a.gx0);
    bays(onW, gy1 + reach - a.gy0);

    // ---- The way in, against the back stone beside the north room.
    drawWallStair(light);

    // ---- In the pit, each thing in its place: the boiler in front of the
    // east room with its pipe run off to the drain, the spoil from the
    // digging in front of the west room with the barrow by it, the
    // barrels along the left, the crates by the foot of the stair.
    const east = placements[3];
    const west = placements[1];
    const hub = placements[0];
    const ch = cellarChannels();
    const stair = cellarStair();
    // The boiler stands against the back stone beside the foot of the
    // stair, where a tall thing can stand without a floor in front of it
    // hiding its top, and its pipe goes up to join the run along the wall.
    const boilerAt = { gx: stair.gxB + 8.2, gy: a.gy0 + 3.2 };
    const heapAt = west
      ? { gx: west.gx0 + west.cols * 0.3, gy: west.gy0 + west.rows + 5 }
      : { gx: planBounds.gx0 - 5, gy: planBounds.gy1 - 6 };
    const storeAt = west
      ? { gx: west.gx0 + west.cols * 0.5, gy: west.gy0 + west.rows + 11 }
      : { gx: a.gx0 + 2.5, gy: (hub ? hub.gy0 + hub.rows : planBounds.gy1) - 2 };
    const cratesAt = east
      ? { gx: east.gx0 + east.cols * 0.5, gy: east.gy0 + east.rows + 8 }
      : { gx: planBounds.gx1 + 3.5, gy: planBounds.gy1 - 4 };
    const bp = isoPoint(boilerAt.gx, boilerAt.gy);
    drawBoiler(bp, light);
    const px = bp.x + 24;
    const tN = (neFar.x - px) / (neFar.x - nw.x);
    drawBigPipe([{ x: px, y: bp.y - 8 - 2.6 * PX_PER_METRE_TALL + 10 }, { x: px, y: onN(tN, 0.5).y + 6 }], 8, CELLAR.pipe);
    drawSpoilHeap(isoPoint(heapAt.gx, heapAt.gy));
    drawBarrow(isoPoint(heapAt.gx + 4.6, heapAt.gy + 1.2));
    drawBarrelStore(isoPoint(storeAt.gx, storeAt.gy));
    drawCrateStack(isoPoint(cratesAt.gx, cratesAt.gy));
    drawSack(isoPoint(cratesAt.gx + 3.2, cratesAt.gy + 1.4), 5);
    drawSack(isoPoint(cratesAt.gx + 4.0, cratesAt.gy + 0.4), 6);
    // Lamps along the inner edge of both drains -- but never one with a
    // floor standing right behind it. The site is drawn under the floors,
    // so a light there reads as coming out from under the floorboards
    // however low it stands; the rooms have their own lights anyway, and
    // these are here to show the way round the outside.
    const lampGy = ch.L.gy0 - 0.8;
    const lampGx = ch.R.gx0 - 0.8;
    const behind = (gx, gy) => siteIsFloor(Math.round(gx), Math.round(gy));
    const postsL = Math.max(2, Math.round(a.cols / 12));
    for (let i = 0; i <= postsL; i++) {
      const gx = a.gx0 + 1 + (a.cols - 2) * (i / postsL);
      if (Math.abs(gx - (ch.bridgeL.gx0 + ch.bridgeL.cols * 0.5)) < 3) continue;
      if (behind(gx, lampGy - 5)) continue;
      drawKerbLamp(isoPoint(gx, lampGy), light);
    }
    const postsR = Math.max(2, Math.round(a.rows / 12));
    for (let i = 0; i < postsR; i++) {
      const gy = a.gy0 + 1 + (a.rows - 2) * (i / postsR);
      if (Math.abs(gy - (ch.bridgeR.gy0 + ch.bridgeR.rows * 0.5)) < 3) continue;
      if (behind(lampGx - 5, gy)) continue;
      drawKerbLamp(isoPoint(lampGx, gy), light);
    }

    // ---- Lastly the light: every lantern warms whatever is near it, stone,
    // earth and pipe alike, and then the lantern goes on top.
    lanterns.forEach((p) => drawWarmth({ x: p.x, y: p.y + 30 }, 150));
    lanterns.forEach((p) => drawHungLantern(p, light));
    lanterns.forEach((p) => drawFloorPool({ x: p.x, y: p.y + CELLAR.wall * 0.72 }, light, 1.3));
  }

  // ---- The garage yard ----
  // The bays stand on a concrete apron in a yard cut out of the ground:
  // a wall rising behind it with the services strung along it, a drop to a
  // lower deck in front with a handrail along the edge and a steel flight
  // down to it, a gantry overhead, and the clutter of a working garage on
  // both levels. Everything here is placed off the plan's own bounds, so a
  // yard is the same yard on every repaint and from one session to the next.
  const YARD = {
    apron: '#42403c',
    apronB: '#3b3936',
    asphalt: '#1b1c20',
    wallL: '#3d4148',
    wallR: '#31343a',
    steel: '#6d737c',
    rust: '#6a4326',
    drop: 96,
    wall: 240,
  };
  function yardApron() {
    const b = planBounds;
    const out = 4;
    return {
      gx0: b.gx0 - out,
      gy0: b.gy0 - out,
      cols: (b.gx1 - b.gx0) + out * 2,
      rows: (b.gy1 - b.gy0) + out * 2,
    };
  }

  // The yard floor: asphalt everywhere, the apron's concrete over the middle
  // of it, and what is painted and worn onto both.
  function drawYardFloor(colors, view) {
    const r = latticeRange(view);
    const S = 8;
    floorCtx.fillStyle = YARD.asphalt;
    floorCtx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    // Asphalt, laid in big slabs with a joint between them.
    for (let gy = Math.floor(r.gy0 / S) * S; gy < r.gy1; gy += S) {
      for (let gx = Math.floor(r.gx0 / S) * S; gx < r.gx1; gx += S) {
        const n = noise(gx, gy, 21);
        paintQuad([isoPoint(gx, gy), isoPoint(gx + S, gy), isoPoint(gx + S, gy + S), isoPoint(gx, gy + S)],
          shade(YARD.asphalt, Math.round((n - 0.5) * 14)), 'rgba(0,0,0,0.5)', 1);
        // A stain of spilt oil here and there, and a puddle catching the light.
        if (n > 0.86) {
          const c = isoPoint(gx + 2 + n * 4, gy + 2 + noise(gx, gy, 22) * 4);
          floorCtx.save();
          floorCtx.translate(c.x, c.y);
          floorCtx.rotate(-0.46);
          const g = floorCtx.createRadialGradient(0, 0, 2, 0, 0, 22 + n * 14);
          g.addColorStop(0, 'rgba(0,0,0,0.34)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          floorCtx.fillStyle = g;
          floorCtx.beginPath();
          floorCtx.ellipse(0, 0, 22 + n * 14, (11 + n * 7), 0, 0, Math.PI * 2);
          floorCtx.fill();
          floorCtx.restore();
        } else if (n < 0.06) {
          const c = isoPoint(gx + 3, gy + 4);
          floorCtx.beginPath();
          floorCtx.ellipse(c.x, c.y, 20, 10, 0, 0, Math.PI * 2);
          floorCtx.fillStyle = 'rgba(120,150,170,0.10)';
          floorCtx.fill();
        }
      }
    }

    // The apron the bays stand on: concrete, in plates half the size.
    const a = yardApron();
    const P = 4;
    for (let ry = 0; ry < a.rows; ry += P) {
      for (let rx = 0; rx < a.cols; rx += P) {
        const gx = a.gx0 + rx;
        const gy = a.gy0 + ry;
        const w = Math.min(P, a.cols - rx);
        const h = Math.min(P, a.rows - ry);
        const n = noise(gx, gy, 23);
        const tone = shade(((rx / P | 0) + (ry / P | 0)) % 2 === 0 ? YARD.apron : YARD.apronB,
          Math.round((n - 0.5) * 12));
        paintQuad([isoPoint(gx, gy), isoPoint(gx + w, gy), isoPoint(gx + w, gy + h), isoPoint(gx, gy + h)],
          tone, 'rgba(0,0,0,0.34)', 1);
      }
    }
    // Bay markings painted on the apron in front of the shutters, a hatched
    // keep-clear box, and the channel drain that runs the length of it.
    const paint = 'rgba(226,214,186,0.30)';
    // A keep-clear box at the head of the steps, dashes along the edge,
    // and the channel drain that runs the length of the apron.
    drawHatch(a.gx0 + a.cols * 0.34, a.gy0 + a.rows - 2.1, 1.7);
    for (let k = 0; k < 9; k++) {
      const t = 0.08 + k * 0.1;
      strokePolyline([isoPoint(a.gx0 + a.cols * t, a.gy0 + a.rows - 3.4),
        isoPoint(a.gx0 + a.cols * t, a.gy0 + a.rows - 2.9)], paint, 2);
    }
    for (let k = 0; k < 8; k++) {
      drawGrate(a.gx0 + a.cols - 1.9, a.gy0 + 2 + k * 3.4, 0.7, 4);
    }
    // Rubber laid down where vehicles have turned on the apron.
    floorCtx.save();
    floorCtx.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const n = noise(k, 3, 27);
      const u = 2 + n * (a.cols - 5);
      const v = 2 + noise(k, 5, 28) * (a.rows - 5);
      const len = 3 + n * 5;
      const dir = noise(k, 7, 29) < 0.5;
      [0, 0.5].forEach((off) => {
        strokePolyline([isoPoint(a.gx0 + u + (dir ? 0 : off), a.gy0 + v + (dir ? off : 0)),
          isoPoint(a.gx0 + u + (dir ? len : off), a.gy0 + v + (dir ? off : len))],
        'rgba(0,0,0,0.20)', 4);
      });
    }
    floorCtx.restore();
  }

  // A short steel flight, dropping `YARD.drop` from the apron edge down to
  // the yard, with a handrail down each side.
  function drawSteelStairs(gx, gy, along, steps) {
    const rise = YARD.drop / steps;
    const run = 1.5;
    const wide = 3.2;
    const at = (u, v) => (along === 'gx' ? isoPoint(gx + u, gy + v) : isoPoint(gx + v, gy + u));
    for (let i = 0; i < steps; i++) {
      const drop = rise * (i + 1);
      const a0 = at(i * run, 0);
      const a1 = at(i * run, wide);
      const b0 = at((i + 1) * run, 0);
      const b1 = at((i + 1) * run, wide);
      const down = (p, d) => ({ x: p.x, y: p.y + d });
      // The tread, then the riser under its front edge.
      paintQuad([down(a0, drop - rise), down(a1, drop - rise), down(b1, drop - rise), down(b0, drop - rise)],
        shade(YARD.steel, -6), 'rgba(0,0,0,0.5)', 1);
      paintQuad([down(b0, drop - rise), down(b1, drop - rise), down(b1, drop), down(b0, drop)],
        shade(YARD.steel, -40), 'rgba(0,0,0,0.55)', 1);
      // Chequer plate: a couple of scores across each tread.
      strokePolyline([down(a0, drop - rise - 1), down(a1, drop - rise - 1)], 'rgba(255,255,255,0.10)', 1);
    }
    // A handrail down each side: posts every other step, a top rail and a
    // mid rail following the pitch.
    [0, wide].forEach((v) => {
      const H = 46;
      const top = [];
      const mid = [];
      for (let i = 0; i <= steps; i++) {
        const p = at(i * run, v);
        const drop = rise * i;
        const foot = { x: p.x, y: p.y + drop };
        top.push({ x: foot.x, y: foot.y - H });
        mid.push({ x: foot.x, y: foot.y - H * 0.5 });
        if (i % 2 === 0) {
          paintQuad([{ x: foot.x - 1.6, y: foot.y }, { x: foot.x + 1.6, y: foot.y },
            { x: foot.x + 1.6, y: foot.y - H }, { x: foot.x - 1.6, y: foot.y - H }], YARD.steel, null);
        }
      }
      strokePolyline(top, shade(YARD.steel, 26), 2.6);
      strokePolyline(mid, YARD.steel, 1.8);
    });
  }

  // A run of steel handrail along an edge of the apron.
  function drawYardRail(from, to, light) {
    const H = 48;
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const posts = Math.max(2, Math.round(len / 46));
    const up = (p, h) => ({ x: p.x, y: p.y - h });
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const p = lerpPt(from, to, t);
      paintQuad([{ x: p.x - 1.7, y: p.y }, { x: p.x + 1.7, y: p.y },
        { x: p.x + 1.7, y: p.y - H }, { x: p.x - 1.7, y: p.y - H }], YARD.steel, null);
      if (i % 4 === 1 && i < posts) {
        const lamp = up(p, H + 6);
        drawGlow(lamp, 40, light.bulb, 0.55);
        floorCtx.fillStyle = light.bulb;
        floorCtx.fillRect(lamp.x - 3, lamp.y - 2, 6, 4);
        drawFloorPool(p, light, 1.4);
      }
    }
    strokePolyline([up(from, H), up(to, H)], shade(YARD.steel, 30), 2.8);
    strokePolyline([up(from, H * 0.52), up(to, H * 0.52)], YARD.steel, 2);
    strokePolyline([up(from, 4), up(to, 4)], shade(YARD.steel, -30), 3);
  }

  // The clutter of a garage: a drum, a stack of tyres, a pallet of boxes,
  // a cone, a gas bottle, a toolbox, a compressor.
  function drawDrum(p, colour) {
    const H = 44;
    drawIsoDisc(floorCtx, { x: p.x, y: p.y }, 11, 5.5, shade(colour, -34));
    paintQuad([{ x: p.x - 11, y: p.y }, { x: p.x + 11, y: p.y },
      { x: p.x + 11, y: p.y - H }, { x: p.x - 11, y: p.y - H }], colour, 'rgba(0,0,0,0.45)', 1);
    [0.28, 0.62].forEach((h) => paintQuad([{ x: p.x - 11, y: p.y - H * h }, { x: p.x + 11, y: p.y - H * h },
      { x: p.x + 11, y: p.y - H * h - 3 }, { x: p.x - 11, y: p.y - H * h - 3 }], shade(colour, -26), null));
    strokePolyline([{ x: p.x - 8, y: p.y - 6 }, { x: p.x - 8, y: p.y - H + 4 }], 'rgba(255,255,255,0.10)', 3);
    drawIsoDisc(floorCtx, { x: p.x, y: p.y - H }, 11, 5.5, shade(colour, 18));
  }
  function drawTyreStack(p, n) {
    for (let i = 0; i < n; i++) {
      const y = p.y - i * 11;
      drawIsoDisc(floorCtx, { x: p.x, y }, 15, 7.5, i % 2 ? '#1e1f22' : '#232427');
      floorCtx.beginPath();
      floorCtx.ellipse(p.x, y - 1, 7, 3.4, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = 'rgba(0,0,0,0.5)';
      floorCtx.fill();
    }
  }
  function drawPallet(p, boxes) {
    drawIsoBox(floorCtx, p, 0, 0, 1.5, 1.2, 9, '#6b5233', 0);
    for (let i = 0; i < boxes; i++) {
      const n = noise(Math.round(p.x), Math.round(p.y), 40 + i);
      drawIsoBox(floorCtx, p, (n - 0.5) * 0.8, (noise(i, 2, 41) - 0.5) * 0.6,
        0.85, 0.7, 24, i % 2 ? '#7d6647' : '#8a7150', 9 + i * 24);
    }
  }
  function drawCone(p) {
    paintQuad([{ x: p.x - 8, y: p.y }, { x: p.x + 8, y: p.y },
      { x: p.x + 2.6, y: p.y - 26 }, { x: p.x - 2.6, y: p.y - 26 }], '#e2591f', 'rgba(0,0,0,0.45)', 1);
    paintQuad([{ x: p.x - 5.4, y: p.y - 11 }, { x: p.x + 5.4, y: p.y - 11 },
      { x: p.x + 4.3, y: p.y - 17 }, { x: p.x - 4.3, y: p.y - 17 }], '#efe6d6', null);
    drawIsoDisc(floorCtx, p, 10, 4.4, '#c94a17');
  }
  function drawGasBottles(p) {
    [-7, 0, 7].forEach((dx, i) => {
      const H = 52 + i * 3;
      const c = ['#3f6f4a', '#4a5f7a', '#6a4040'][i];
      paintQuad([{ x: p.x + dx - 5, y: p.y + i }, { x: p.x + dx + 5, y: p.y + i },
        { x: p.x + dx + 5, y: p.y + i - H }, { x: p.x + dx - 5, y: p.y + i - H }], c, 'rgba(0,0,0,0.45)', 1);
      drawIsoDisc(floorCtx, { x: p.x + dx, y: p.y + i - H }, 5, 2.4, shade(c, 22));
      paintQuad([{ x: p.x + dx - 1.6, y: p.y + i - H }, { x: p.x + dx + 1.6, y: p.y + i - H },
        { x: p.x + dx + 1.6, y: p.y + i - H - 6 }, { x: p.x + dx - 1.6, y: p.y + i - H - 6 }], '#8a9099', null);
    });
    // The cage they stand in.
    strokePolyline([{ x: p.x - 14, y: p.y - 30 }, { x: p.x + 14, y: p.y - 28 }], 'rgba(160,170,180,0.5)', 2);
  }
  function drawCompressor(p) {
    drawIsoBox(floorCtx, p, 0, 0, 1.5, 0.8, 22, '#2e3238', 0);
    drawIsoBox(floorCtx, p, 0, 0, 1.35, 0.66, 16, '#b03a2a', 22);
    drawIsoBox(floorCtx, p, -0.7, 0, 0.45, 0.45, 14, '#4a4f57', 38);
    const c = isoScreenPoint(p, 0.9, 0, 40);
    drawIsoDisc(floorCtx, c, 6, 6, '#6d737c');
  }
  // A panel van, four and a half metres of it, standing along +u.
  function drawVan(base, colour) {
    const ctx = floorCtx;
    const M = TILES_PER_METRE;
    const wheel = 0.34 * M;
    // Wheels first, then the body over them, then the cab and its glass.
    [[-1.5 * M, 0.86 * M], [-1.5 * M, -0.86 * M], [1.3 * M, 0.86 * M], [1.3 * M, -0.86 * M]]
      .forEach(([u, v]) => drawIsoDisc(ctx, isoScreenPoint(base, u, v, 20), 13, 9, '#17181b'));
    drawIsoBox(ctx, base, -0.55 * M, 0, 1.65 * M, 0.9 * M, 1.45 * PX_PER_METRE_TALL, colour, wheel * 3);
    drawIsoBox(ctx, base, 1.5 * M, 0, 0.65 * M, 0.86 * M, 0.95 * PX_PER_METRE_TALL,
      shade(colour, -8), wheel * 3);
    // The windscreen, and the window down the side you can see.
    drawFacePanel(ctx, base, { u: 2.16 * M, v: -0.84 * M }, { u: 2.16 * M, v: 0.84 * M },
      55, 88, '#2e4256', 3);
    drawFacePanel(ctx, base, { u: 0.9 * M, v: 0.88 * M }, { u: 2.05 * M, v: 0.88 * M },
      55, 88, '#33485e', 3);
    // A stripe down the flank, the bumper, and the lamps at the front.
    drawFacePanel(ctx, base, { u: -2.2 * M, v: 0.91 * M }, { u: 2.05 * M, v: 0.91 * M },
      40, 52, shade(colour, -30), 1);
    drawIsoBox(ctx, base, 2.15 * M, 0, 0.1 * M, 0.94 * M, 12, '#26282c', 22);
    drawGlow(isoScreenPoint(base, 2.2 * M, 0.6 * M, 30), 22, '#ffe6b4', 0.55);
    drawGlow(isoScreenPoint(base, 2.2 * M, -0.6 * M, 30), 22, '#ffe6b4', 0.4);
  }

  function drawWorkbench(p, along) {
    const L = along === 'gx' ? 3.4 : 0.9;
    const W = along === 'gx' ? 0.9 : 3.4;
    drawIsoBox(floorCtx, p, 0, 0, L, W, 40, '#3a3f46', 0);
    drawIsoBox(floorCtx, p, 0, 0, L + 0.12, W + 0.12, 5, '#8a9099', 40);
    // A vice on one end, and a board of tools behind it.
    const v = isoScreenPoint(p, along === 'gx' ? L - 0.6 : 0, along === 'gx' ? 0 : L - 0.6, 45);
    drawIsoDisc(floorCtx, v, 7, 4, '#5a6068');
    paintQuad([{ x: v.x - 5, y: v.y - 2 }, { x: v.x + 5, y: v.y - 2 },
      { x: v.x + 5, y: v.y - 12 }, { x: v.x - 5, y: v.y - 12 }], '#4a5058', null);
  }

  // Chain-link on posts: what a yard is fenced with.
  function drawYardFence(from, to, light) {
    const H = 96;
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    const bays = Math.max(2, Math.round(len / 90));
    const up = (p, h) => ({ x: p.x, y: p.y - h });
    // The mesh: a wash with the weave scratched into it, so it reads as
    // something you see through rather than a panel.
    paintQuad([from, to, up(to, H), up(from, H)], 'rgba(150,165,180,0.07)', null);
    floorCtx.save();
    floorCtx.beginPath();
    floorCtx.moveTo(from.x, from.y);
    floorCtx.lineTo(to.x, to.y);
    floorCtx.lineTo(up(to, H).x, up(to, H).y);
    floorCtx.lineTo(up(from, H).x, up(from, H).y);
    floorCtx.closePath();
    floorCtx.clip();
    for (let d = -H; d < len + H; d += 13) {
      const a0 = lerpPt(from, to, d / len);
      strokePolyline([{ x: a0.x, y: a0.y }, { x: a0.x + H * 0.55, y: a0.y - H }],
        'rgba(180,195,210,0.12)', 1);
      strokePolyline([{ x: a0.x, y: a0.y }, { x: a0.x - H * 0.55, y: a0.y - H }],
        'rgba(180,195,210,0.09)', 1);
    }
    floorCtx.restore();
    for (let i = 0; i <= bays; i++) {
      const p = lerpPt(from, to, i / bays);
      paintQuad([{ x: p.x - 2.2, y: p.y }, { x: p.x + 2.2, y: p.y },
        { x: p.x + 2.2, y: p.y - H }, { x: p.x - 2.2, y: p.y - H }], '#4a5058', 'rgba(0,0,0,0.4)', 1);
      // A floodlight on every third post, aimed back at the yard.
      if (i % 3 === 1) {
        const head = up(p, H + 14);
        paintQuad([{ x: p.x - 1.6, y: p.y - H }, { x: p.x + 1.6, y: p.y - H },
          { x: p.x + 1.6, y: head.y }, { x: p.x - 1.6, y: head.y }], '#4a5058', null);
        paintQuad([{ x: head.x - 11, y: head.y - 7 }, { x: head.x + 11, y: head.y - 7 },
          { x: head.x + 8, y: head.y + 3 }, { x: head.x - 8, y: head.y + 3 }], '#2b2e33', 'rgba(0,0,0,0.5)', 1);
        paintQuad([{ x: head.x - 7, y: head.y + 1 }, { x: head.x + 7, y: head.y + 1 },
          { x: head.x + 7, y: head.y + 3 }, { x: head.x - 7, y: head.y + 3 }], light.bulb, null);
        drawGlow({ x: head.x, y: head.y + 3 }, 62, light.bulb, 0.4);
      }
    }
    strokePolyline([up(from, H), up(to, H)], '#5a6068', 2.4);
    strokePolyline([up(from, H * 0.5), up(to, H * 0.5)], 'rgba(120,132,145,0.35)', 1.4);
  }

  // ---- Outside the yard ----
  // What the yard backs onto, kept simple: it is far off and mostly in the
  // dark, and its job is to be somewhere rather than to be looked at. A
  // strip of garden with a few trees and bushes, the bins, a row of
  // lock-ups, a road with a car or two on it and lamps down it.
  const OUTSIDE = {
    tarmac: '#191a1e',
    kerb: '#3a3c40',
    grass: '#25341f',
    grassB: '#2c3d24',
    leaf: ['#2f4a26', '#375c2c', '#436b33'],
  };
  function drawBush(p, r) {
    [[0, 0, r], [-r * 0.7, r * 0.2, r * 0.7], [r * 0.7, r * 0.25, r * 0.75]].forEach(([dx, dy, rr], i) => {
      floorCtx.beginPath();
      floorCtx.ellipse(p.x + dx, p.y + dy - rr * 0.5, rr, rr * 0.72, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = OUTSIDE.leaf[i % 3];
      floorCtx.fill();
    });
  }
  function drawTree(p, h) {
    paintQuad([{ x: p.x - 3.5, y: p.y }, { x: p.x + 3.5, y: p.y },
      { x: p.x + 2.6, y: p.y - h }, { x: p.x - 2.6, y: p.y - h }], '#3a2c1e', null);
    const top = { x: p.x, y: p.y - h };
    [[0, 0, h * 0.46], [-h * 0.3, h * 0.18, h * 0.34], [h * 0.31, h * 0.2, h * 0.36],
      [0, -h * 0.24, h * 0.3]].forEach(([dx, dy, rr], i) => {
      floorCtx.beginPath();
      floorCtx.ellipse(top.x + dx, top.y + dy, rr, rr * 0.78, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = OUTSIDE.leaf[i % 3];
      floorCtx.fill();
    });
    floorCtx.beginPath();
    floorCtx.ellipse(top.x - h * 0.12, top.y - h * 0.18, h * 0.2, h * 0.15, 0, 0, Math.PI * 2);
    floorCtx.fillStyle = 'rgba(140,180,110,0.16)';
    floorCtx.fill();
  }
  function drawBin(p, colour) {
    const H = 34;
    paintQuad([{ x: p.x - 9, y: p.y }, { x: p.x + 9, y: p.y },
      { x: p.x + 8, y: p.y - H }, { x: p.x - 8, y: p.y - H }], colour, 'rgba(0,0,0,0.5)', 1);
    paintQuad([{ x: p.x - 8.6, y: p.y - H }, { x: p.x + 8.6, y: p.y - H },
      { x: p.x + 8.6, y: p.y - H - 5 }, { x: p.x - 8.6, y: p.y - H - 5 }], shade(colour, 22), 'rgba(0,0,0,0.5)', 1);
    [0.3, 0.6].forEach((h) => strokePolyline([{ x: p.x - 7.6, y: p.y - H * h }, { x: p.x + 7.6, y: p.y - H * h }],
      'rgba(0,0,0,0.22)', 1.4));
    drawIsoDisc(floorCtx, { x: p.x - 5, y: p.y + 1 }, 3, 1.8, '#17181b');
    drawIsoDisc(floorCtx, { x: p.x + 5, y: p.y + 1 }, 3, 1.8, '#17181b');
  }
  function drawCar(base, colour) {
    const ctx = floorCtx;
    const M = TILES_PER_METRE;
    [[-1.1 * M, 0.7 * M], [-1.1 * M, -0.7 * M], [1.1 * M, 0.7 * M], [1.1 * M, -0.7 * M]]
      .forEach(([u, v]) => drawIsoDisc(ctx, isoScreenPoint(base, u, v, 14), 10, 7, '#17181b'));
    drawIsoBox(ctx, base, 0, 0, 1.9 * M, 0.78 * M, 0.5 * PX_PER_METRE_TALL, colour, 20);
    drawIsoBox(ctx, base, -0.15 * M, 0, 0.95 * M, 0.7 * M, 0.42 * PX_PER_METRE_TALL,
      shade(colour, -14), 20 + 0.5 * PX_PER_METRE_TALL);
    drawFacePanel(ctx, base, { u: 0.82 * M, v: 0.72 * M }, { u: -1.1 * M, v: 0.72 * M },
      52, 74, '#33485e', 3);
    drawGlow(isoScreenPoint(base, 2.0 * M, 0.5 * M, 26), 16, '#ffe6b4', 0.4);
  }
  // A row of lock-ups: a long low shed with a shutter to each bay.
  function drawLockups(p, bays, along) {
    const ctx = floorCtx;
    const W = 3.2;
    const D = 4.4;
    const H = 62;
    const half = along === 'gx' ? { a: (bays * W) / 2, b: D / 2 } : { a: D / 2, b: (bays * W) / 2 };
    drawIsoBox(ctx, p, 0, 0, half.a, half.b, H, '#33373d', 0);
    drawIsoBox(ctx, p, 0, 0, half.a + 0.2, half.b + 0.2, 6, '#282b30', H);
    for (let i = 0; i < bays; i++) {
      const t = (i + 0.5) / bays - 0.5;
      const u = along === 'gx' ? t * bays * W : half.a + 0.02;
      const v = along === 'gx' ? half.b + 0.02 : t * bays * W;
      const du = along === 'gx' ? W * 0.36 : 0;
      const dv = along === 'gx' ? 0 : W * 0.36;
      drawFacePanel(ctx, p, { u: u - du, v: v - dv }, { u: u + du, v: v + dv }, 4, H * 0.72,
        i % 2 ? '#4a5058' : '#454b53', 1);
      for (let h = 8; h < H * 0.68; h += 7) {
        drawFacePanel(ctx, p, { u: u - du, v: v - dv }, { u: u + du, v: v + dv }, h, h + 2,
          'rgba(0,0,0,0.16)', 0);
      }
    }
  }
  function drawStreetLamp(p, light) {
    const H = 118;
    paintQuad([{ x: p.x - 2.4, y: p.y }, { x: p.x + 2.4, y: p.y },
      { x: p.x + 2.4, y: p.y - H }, { x: p.x - 2.4, y: p.y - H }], '#3a3d42', null);
    const head = { x: p.x + 9, y: p.y - H - 3 };
    strokePolyline([{ x: p.x, y: p.y - H }, head], '#3a3d42', 3);
    paintQuad([{ x: head.x - 9, y: head.y - 3 }, { x: head.x + 9, y: head.y - 3 },
      { x: head.x + 7, y: head.y + 4 }, { x: head.x - 7, y: head.y + 4 }], '#2b2e33', null);
    paintQuad([{ x: head.x - 6, y: head.y + 2 }, { x: head.x + 6, y: head.y + 2 },
      { x: head.x + 6, y: head.y + 4 }, { x: head.x - 6, y: head.y + 4 }], light.bulb, null);
    drawGlow({ x: head.x, y: head.y + 4 }, 70, light.bulb, 0.34);
    const foot = { x: head.x, y: p.y };
    const g = floorCtx.createRadialGradient(foot.x, foot.y, 3, foot.x, foot.y, 78);
    g.addColorStop(0, scaleAlpha(light.glow, lampBoost() * 0.34));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    floorCtx.save();
    floorCtx.globalCompositeOperation = 'lighter';
    floorCtx.fillStyle = g;
    floorCtx.beginPath();
    floorCtx.ellipse(foot.x, foot.y, 78, 39, 0, 0, Math.PI * 2);
    floorCtx.fill();
    floorCtx.restore();
  }

  // The ground beyond the yard, on both of its levels: the higher ground
  // the wall holds back, and the deck the yard drops to.
  function drawYardOutskirts(a, light, level) {
    const R = 40;
    const gx1 = a.gx0 + a.cols;
    const gy1 = a.gy0 + a.rows;
    const lift = level === 'up' ? -YARD.wall : YARD.drop;
    const at = (gx, gy) => {
      const p = isoPoint(gx, gy);
      return { x: p.x, y: p.y + lift };
    };
    // The two bands of ground, paved coarsely: behind the wall it is the
    // yard's own back lane, past the fence it is the road.
    const bands = level === 'up'
      ? [[a.gx0 - R, a.gy0 - R, gx1 + R, a.gy0], [a.gx0 - R, a.gy0, a.gx0, gy1 + R]]
      : [[a.gx0 - R, gy1 + 13, gx1 + R, gy1 + R], [gx1 + 13, a.gy0 - R, gx1 + R, gy1 + 13]];
    const S = 10;
    bands.forEach(([x0, y0, x1, y1]) => {
      for (let gy = y0; gy < y1; gy += S) {
        for (let gx = x0; gx < x1; gx += S) {
          const w = Math.min(S, x1 - gx);
          const h = Math.min(S, y1 - gy);
          const n = noise(Math.round(gx), Math.round(gy), level === 'up' ? 71 : 72);
          paintQuad([at(gx, gy), at(gx + w, gy), at(gx + w, gy + h), at(gx, gy + h)],
            shade(OUTSIDE.tarmac, Math.round((n - 0.5) * 10)), 'rgba(0,0,0,0.45)', 1);
        }
      }
      // A verge of grass down the far side of each band, with a kerb on it.
      const vergeAlongX = (x1 - x0) > (y1 - y0);
      const v0 = vergeAlongX ? [x0, y0, x1, y0 + 7] : [x0, y0, x0 + 7, y1];
      paintQuad([at(v0[0], v0[1]), at(v0[2], v0[1]), at(v0[2], v0[3]), at(v0[0], v0[3])],
        OUTSIDE.grass, null);
      for (let k = 0; k < 26; k++) {
        const n = noise(k, Math.round(v0[0]), 73);
        const gx = v0[0] + n * (v0[2] - v0[0]);
        const gy = v0[1] + noise(k, Math.round(v0[1]), 74) * (v0[3] - v0[1]);
        paintQuad([at(gx, gy), at(gx + 2.4, gy), at(gx + 2.4, gy + 2.4), at(gx, gy + 2.4)],
          OUTSIDE.grassB, null);
      }
      const kerb = vergeAlongX
        ? [at(v0[0], v0[3]), at(v0[2], v0[3])] : [at(v0[2], v0[1]), at(v0[2], v0[3])];
      strokePolyline(kerb, OUTSIDE.kerb, 3);
      // Trees and bushes standing on the verge.
      const count = vergeAlongX ? 7 : 5;
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count;
        const n = noise(k, Math.round(v0[0] + v0[1]), 75);
        const gx = vergeAlongX ? v0[0] + t * (v0[2] - v0[0]) : v0[0] + 1.6 + n * 3.4;
        const gy = vergeAlongX ? v0[1] + 1.6 + n * 3.4 : v0[1] + t * (v0[3] - v0[1]);
        if (n < 0.62) drawTree(at(gx, gy), 62 + n * 52);
        else drawBush(at(gx, gy), 12 + n * 7);
        if (n > 0.3 && n < 0.42) drawBush(at(gx + 2.6, gy + 1.8), 10);
      }
    });

    // Scrub over whatever the two bands do not cover, so a wide view never
    // runs out of ground with something on it.
    const outside = (gx, gy) => (level === 'up'
      ? (gx < a.gx0 - 2 || gy < a.gy0 - 2)
      : (gx > gx1 + 11 || gy > gy1 + 11));
    for (let k = 0; k < 90; k++) {
      const n1 = noise(k, 11, level === 'up' ? 81 : 82);
      const n2 = noise(k, 13, level === 'up' ? 83 : 84);
      const n3 = noise(k, 17, level === 'up' ? 85 : 86);
      const gx = a.gx0 - R + n1 * (a.cols + R * 2);
      const gy = a.gy0 - R + n2 * (a.rows + R * 2);
      if (!outside(gx, gy)) continue;
      if (n3 < 0.34) drawTree(at(gx, gy), 54 + n3 * 90);
      else if (n3 < 0.82) drawBush(at(gx, gy), 9 + n3 * 9);
      else drawBin(at(gx, gy), ['#2f4a3a', '#3a3f4a', '#4a3a2f'][k % 3]);
    }

    if (level === 'up') {
      // Behind the wall: the bins, a row of lock-ups and a van on the lane.
      ['#2f4a3a', '#3a3f4a', '#4a3a2f', '#2f3a4a'].forEach((c, i) => {
        drawBin(at(a.gx0 + 6 + i * 2.2, a.gy0 - 9), c);
      });
      drawLockups(at(a.gx0 + a.cols * 0.62, a.gy0 - 20), 4, 'gx');
      drawLockups(at(a.gx0 - 20, a.gy0 + a.rows * 0.5), 3, 'gy');
      drawVan(at(a.gx0 + a.cols * 0.28, a.gy0 - 12), '#4a5058');
      drawCar(at(a.gx0 - 11, a.gy0 + a.rows * 0.24), '#5a3a3a');
      drawStreetLamp(at(a.gx0 + a.cols * 0.46, a.gy0 - 28), light);
      drawStreetLamp(at(a.gx0 - 28, a.gy0 + a.rows * 0.7), light);
      return;
    }
    // Past the fence: the road, with a car on it and lamps down the side.
    for (let k = 0; k < 12; k++) {
      const gx = a.gx0 - R + 8 + k * 6;
      strokePolyline([at(gx, gy1 + 26), at(gx + 3, gy1 + 26)], 'rgba(220,208,180,0.16)', 2.6);
    }
    for (let k = 0; k < 10; k++) {
      const gy = a.gy0 - R + 10 + k * 6;
      strokePolyline([at(gx1 + 26, gy), at(gx1 + 26, gy + 3)], 'rgba(220,208,180,0.16)', 2.6);
    }
    drawCar(at(a.gx0 + a.cols * 0.3, gy1 + 24), '#3a4a5a');
    drawCar(at(gx1 + 24, a.gy0 + a.rows * 0.62), '#4a4a3a');
    ['#2f4a3a', '#3a3f4a', '#4a3a2f'].forEach((c, i) => {
      drawBin(at(a.gx0 + a.cols * 0.74 + i * 2.2, gy1 + 17), c);
    });
    drawLockups(at(a.gx0 + a.cols * 0.14, gy1 + 33), 3, 'gx');
    drawStreetLamp(at(a.gx0 + a.cols * 0.56, gy1 + 20), light);
    drawStreetLamp(at(gx1 + 20, a.gy0 + a.rows * 0.28), light);
  }

  // What stands about the yard, and the structure it stands in.
  function drawYardProps(colors, view) {
    const light = LIGHT_COLORS.garage;
    const a = yardApron();
    const gx1 = a.gx0 + a.cols;
    const gy1 = a.gy0 + a.rows;
    const wallColors = { wallL: YARD.wallL, wallR: YARD.wallR };
    const light0 = LIGHT_COLORS.garage;

    // ---- Beyond the wall, on the higher ground it holds back. Drawn first,
    // so the wall stands in front of it.
    drawYardOutskirts(a, light0, 'up');

    // ---- Behind: the ground is higher, so a wall rises off the apron's
    // two back edges, with the services running along it.
    const back = YARD.wall;
    const nw = isoPoint(a.gx0, a.gy0);
    const ne = isoPoint(gx1, a.gy0);
    const sw = isoPoint(a.gx0, gy1);
    drawWallRun([ne, nw, sw], ['gx', 'gy'], back, wallColors, ['cap', 'cap']);
    // Laid in courses, with a capping along the top: a wall somebody built,
    // not a flat band standing behind the bays.
    [[ne, nw], [nw, sw]].forEach(([from, to]) => {
      const len = Math.hypot(to.x - from.x, to.y - from.y);
      const blocks = Math.max(4, Math.round(len / 46));
      for (let k = 0; k < 11; k++) {
        const h = 0.06 + k * 0.085;
        paintQuad(wallQuad(from, to, 0, 1, h, h - 0.006), 'rgba(0,0,0,0.26)', null);
        for (let i = 1; i < blocks; i++) {
          const t = (i + (k % 2) * 0.5) / blocks;
          if (t <= 0 || t >= 1) continue;
          paintQuad(wallQuad(from, to, t - 0.002, t + 0.002, h, h + 0.079), 'rgba(0,0,0,0.2)', null);
        }
      }
      paintQuad(wallQuad(from, to, 0, 1, 1, 0.955), 'rgba(255,255,255,0.06)', null);
    });

    // A run of pipework along both, with couplings and a lamp under it.
    [[ne, nw], [nw, sw]].forEach(([from, to], side) => {
      [0.80, 0.72].forEach((h, k) => {
        const a0 = wallPoint(from, to, 0.02, h);
        const b0 = wallPoint(from, to, 0.98, h);
        strokePolyline([a0, b0], 'rgba(0,0,0,0.45)', 9 - k * 2);
        strokePolyline([a0, b0], k ? '#7a4a2c' : shade(YARD.steel, -18), 7 - k * 2);
        strokePolyline([{ x: a0.x, y: a0.y - 2 }, { x: b0.x, y: b0.y - 2 }], 'rgba(255,255,255,0.10)', 1.6);
      });
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const p = wallPoint(from, to, t, 0.76);
        paintQuad([{ x: p.x - 4, y: p.y - 12 }, { x: p.x + 4, y: p.y - 12 },
          { x: p.x + 4, y: p.y + 10 }, { x: p.x - 4, y: p.y + 10 }], '#2c2f34', 'rgba(0,0,0,0.5)', 1);
        if (i % 2 === (side ? 0 : 1)) {
          // A bulkhead lamp on the wall, and its pool on the apron below.
          const lp = wallPoint(from, to, t, 0.52);
          paintQuad([{ x: lp.x - 7, y: lp.y - 5 }, { x: lp.x + 7, y: lp.y - 5 },
            { x: lp.x + 6, y: lp.y + 4 }, { x: lp.x - 6, y: lp.y + 4 }], '#22252a', 'rgba(0,0,0,0.5)', 1);
          paintQuad([{ x: lp.x - 5, y: lp.y - 3.5 }, { x: lp.x + 5, y: lp.y - 3.5 },
            { x: lp.x + 4.4, y: lp.y + 2.5 }, { x: lp.x - 4.4, y: lp.y + 2.5 }], light.bulb, null);
          drawGlow(lp, 42, light.bulb, 0.5);
          drawFloorPool(wallPoint(from, to, t, 0), light, 1.3);
        }
      }
      // The office over the yard, its lights on, and a vehicle shutter in
      // the wall beside it -- the way in and out of a yard like this.
      if (!side) {
        const o0 = 0.30;
        const o1 = 0.52;
        paintQuad(wallQuad(from, to, o0 - 0.01, o1 + 0.01, 0.88, 0.52), '#2a2d33', 'rgba(0,0,0,0.6)', 1.4);
        for (let k = 0; k < 3; k++) {
          const t0 = o0 + 0.015 + k * 0.072;
          paintQuad(wallQuad(from, to, t0, t0 + 0.055, 0.84, 0.60), hexA(light.bulb, 0.78), 'rgba(0,0,0,0.5)', 1);
          paintQuad(wallQuad(from, to, t0 + 0.024, t0 + 0.031, 0.84, 0.60), 'rgba(0,0,0,0.35)', null);
        }
        paintQuad(wallQuad(from, to, o0 - 0.02, o1 + 0.02, 0.92, 0.88), '#4a4f58', null);
        drawGlow(wallPoint(from, to, (o0 + o1) / 2, 0.72), 70, light.bulb, 0.28);
      } else {
        const d0 = 0.52;
        const d1 = 0.74;
        paintQuad(wallQuad(from, to, d0, d1, 0.02, 0.46), '#4e545c', 'rgba(0,0,0,0.6)', 1.4);
        for (let h = 0.05; h < 0.45; h += 0.042) {
          paintQuad(wallQuad(from, to, d0 + 0.004, d1 - 0.004, h, h + 0.016), 'rgba(255,255,255,0.06)', null);
          paintQuad(wallQuad(from, to, d0 + 0.004, d1 - 0.004, h + 0.016, h + 0.042), 'rgba(0,0,0,0.16)', null);
        }
        paintQuad(wallQuad(from, to, d0 - 0.014, d1 + 0.014, 0.46, 0.51), '#33373d', 'rgba(0,0,0,0.5)', 1);
        [d0 - 0.024, d1 + 0.024].forEach((tt) => {
          paintQuad(wallQuad(from, to, tt - 0.008, tt + 0.008, 0, 0.1), '#f2b705', 'rgba(0,0,0,0.5)', 1);
          [0.02, 0.06].forEach((h) => paintQuad(wallQuad(from, to, tt - 0.008, tt + 0.008, h, h + 0.02), '#15161a', null));
        });
      }
      // A hose reel, and the fire point beside it.
      const hr = wallPoint(from, to, side ? 0.86 : 0.14, 0.38);
      floorCtx.beginPath();
      floorCtx.ellipse(hr.x, hr.y, 11, 11, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = '#b03a2a';
      floorCtx.fill();
      floorCtx.strokeStyle = 'rgba(0,0,0,0.5)';
      floorCtx.lineWidth = 1.2;
      floorCtx.stroke();
      floorCtx.beginPath();
      floorCtx.ellipse(hr.x, hr.y, 4, 4, 0, 0, Math.PI * 2);
      floorCtx.fillStyle = '#2b2e33';
      floorCtx.fill();
      const fp = wallPoint(from, to, side ? 0.92 : 0.08, 0.34);
      paintQuad([{ x: fp.x - 9, y: fp.y - 12 }, { x: fp.x + 9, y: fp.y - 12 },
        { x: fp.x + 9, y: fp.y + 12 }, { x: fp.x - 9, y: fp.y + 12 }], '#8c2f22', 'rgba(0,0,0,0.5)', 1);
      paintQuad([{ x: fp.x - 3, y: fp.y - 8 }, { x: fp.x + 3, y: fp.y - 8 },
        { x: fp.x + 3, y: fp.y + 8 }, { x: fp.x - 3, y: fp.y + 8 }], '#d24a30', null);

      // An extract grille set into the wall.
      const g = wallPoint(from, to, side ? 0.22 : 0.62, 0.42);
      paintQuad([{ x: g.x - 20, y: g.y - 16 }, { x: g.x + 20, y: g.y - 16 },
        { x: g.x + 20, y: g.y + 16 }, { x: g.x - 20, y: g.y + 16 }], '#23262b', 'rgba(0,0,0,0.6)', 1.4);
      for (let k = 0; k < 6; k++) {
        paintQuad([{ x: g.x - 17, y: g.y - 13 + k * 5 }, { x: g.x + 17, y: g.y - 13 + k * 5 },
          { x: g.x + 17, y: g.y - 11 + k * 5 }, { x: g.x - 17, y: g.y - 11 + k * 5 }], 'rgba(255,255,255,0.09)', null);
      }
    });

    // ---- In front: the apron ends and the yard drops away, with a rail
    // along the edge and a flight of steps down at one corner.
    const drop = YARD.drop;
    const down = (p) => ({ x: p.x, y: p.y + drop });
    const se = isoPoint(gx1, gy1);
    const swp = isoPoint(a.gx0, gy1);
    const nep = isoPoint(gx1, a.gy0);
    // The two faces of the drop, lit differently the way the walls are.
    paintQuad([swp, se, down(se), down(swp)], shade(YARD.wallL, -12), 'rgba(0,0,0,0.55)', 1);
    paintQuad([nep, se, down(se), down(nep)], shade(YARD.wallR, -12), 'rgba(0,0,0,0.55)', 1);
    // A concrete lip over each, so the apron reads as a slab and not a fold.
    paintQuad([swp, se, { x: se.x, y: se.y + 9 }, { x: swp.x, y: swp.y + 9 }], YARD.apron, 'rgba(0,0,0,0.5)', 1);
    paintQuad([nep, se, { x: se.x, y: se.y + 9 }, { x: nep.x, y: nep.y + 9 }], YARD.apronB, 'rgba(0,0,0,0.5)', 1);
    // Cast in panels, with a buttress at every joint and the staining that
    // runs down a concrete face left out in the weather.
    for (let i = 1; i < 8; i++) {
      [lerpPt(swp, se, i / 8), lerpPt(nep, se, i / 8)].forEach((p, k) => {
        paintQuad([{ x: p.x - 5, y: p.y + 8 }, { x: p.x + 5, y: p.y + 8 },
          { x: p.x + 5, y: p.y + drop }, { x: p.x - 5, y: p.y + drop }], 'rgba(255,255,255,0.05)', null);
        strokePolyline([{ x: p.x, y: p.y + 8 }, { x: p.x, y: p.y + drop }], 'rgba(0,0,0,0.32)', 1);
        if ((i + k) % 3 === 0) {
          const g = floorCtx.createLinearGradient(0, p.y + 8, 0, p.y + drop);
          g.addColorStop(0, 'rgba(0,0,0,0.30)');
          g.addColorStop(1, 'rgba(0,0,0,0)');
          floorCtx.fillStyle = g;
          floorCtx.fillRect(p.x - 13, p.y + 8, 9, drop - 8);
        }
      });
    }

    // The steps: one flight down off each front edge, with a gap left in
    // the rail at the head of each.
    const stairAt = 0.34;
    drawSteelStairs(a.gx0 + a.cols * stairAt, a.gy0 + a.rows, 'gy', 7);
    drawYardRail(swp, lerpPt(swp, se, stairAt - 0.06), light);
    drawYardRail(lerpPt(swp, se, stairAt + 0.1), se, light);

    const eastAt = 0.46;
    drawSteelStairs(a.gx0 + a.cols, a.gy0 + a.rows * eastAt, 'gx', 7);
    drawYardRail(nep, lerpPt(nep, se, eastAt - 0.06), light);
    drawYardRail(lerpPt(nep, se, eastAt + 0.1), se, light);

    // A caged ladder up the wall behind, to whatever is on the roof.
    const lad = wallPoint(ne, nw, 0.78, 0);
    const ladTop = wallPoint(ne, nw, 0.78, 0.98);
    strokePolyline([{ x: lad.x - 6, y: lad.y }, { x: ladTop.x - 6, y: ladTop.y }], '#5a6068', 2.4);
    strokePolyline([{ x: lad.x + 6, y: lad.y }, { x: ladTop.x + 6, y: ladTop.y }], '#5a6068', 2.4);
    const rungs = Math.max(6, Math.round((lad.y - ladTop.y) / 13));
    for (let i = 1; i < rungs; i++) {
      const y = lad.y + (ladTop.y - lad.y) * (i / rungs);
      strokePolyline([{ x: lad.x - 6, y }, { x: lad.x + 6, y }], '#6d737c', 1.6);
    }
    for (let i = 1; i < rungs; i += 2) {
      const y = lad.y + (ladTop.y - lad.y) * (i / rungs);
      strokePolyline([{ x: lad.x - 11, y }, { x: lad.x + 11, y }], 'rgba(120,132,145,0.4)', 1.2);
    }

    // ---- What is standing about. Against the wall behind, along the
    // edge in front, and more of it on the deck below.
    const on = (u, v) => isoPoint(a.gx0 + u, a.gy0 + v);
    drawWorkbench(on(a.cols * 0.36, 1.5), 'gx');
    drawCompressor(on(a.cols * 0.52, 1.6));
    drawTyreStack(on(a.cols - 1.8, 2.6), 4);
    drawTyreStack(on(a.cols - 1.8, 4.2), 3);
    drawGasBottles(on(a.cols - 1.9, 6.4));
    drawDrum(on(1.7, a.rows * 0.42), '#4a5a3a');
    drawDrum(on(1.7, a.rows * 0.42 + 1.5), '#7a4a20');
    drawDrum(on(2.9, a.rows * 0.42 + 0.7), '#3a4a5a');
    drawPallet(on(1.9, a.rows * 0.62), 2);
    drawCone(on(a.cols * 0.62, a.rows - 1.4));
    drawCone(on(a.cols * 0.68, a.rows - 1.9));
    drawPallet(on(a.cols - 2.2, a.rows - 3.4), 1);
    // Bollards along the head of the steps, and a jack left out beside them.
    for (let i = 0; i < 4; i++) {
      const p = on(a.cols * (0.44 + i * 0.035), a.rows - 1.1);
      paintQuad([{ x: p.x - 3, y: p.y }, { x: p.x + 3, y: p.y },
        { x: p.x + 3, y: p.y - 26 }, { x: p.x - 3, y: p.y - 26 }], '#f2b705', 'rgba(0,0,0,0.5)', 1);
      [0.2, 0.55].forEach((h) => paintQuad([{ x: p.x - 3, y: p.y - 26 * h }, { x: p.x + 3, y: p.y - 26 * h },
        { x: p.x + 3, y: p.y - 26 * h - 5 }, { x: p.x - 3, y: p.y - 26 * h - 5 }], '#15161a', null));
    }
    const jack = on(a.cols * 0.22, a.rows - 1.8);
    drawIsoBox(floorCtx, jack, 0, 0, 1.6, 0.7, 12, '#a33528', 0);
    strokePolyline([{ x: jack.x + 6, y: jack.y - 10 }, { x: jack.x + 22, y: jack.y - 30 }], '#2b2e33', 3);

    // And on the deck below, drawn a drop lower than the lattice puts them.
    const below = (u, v) => {
      const p = isoPoint(a.gx0 + u, a.gy0 + v);
      return { x: p.x, y: p.y + drop };
    };
    drawTyreStack(below(a.cols * 0.62, a.rows + 4), 5);
    drawTyreStack(below(a.cols * 0.69, a.rows + 5.4), 3);
    drawPallet(below(a.cols * 0.5, a.rows + 6), 3);
    drawDrum(below(a.cols * 0.2, a.rows + 3.4), '#6a4326');
    drawDrum(below(a.cols * 0.25, a.rows + 4.8), '#3f4a55');
    drawCone(below(a.cols * 0.42, a.rows + 2.6));
    drawPallet(below(a.cols + 4.5, a.rows * 0.55), 2);
    drawDrum(below(a.cols + 3.4, a.rows * 0.3), '#4a5a3a');
    drawTyreStack(below(a.cols + 5.2, a.rows * 0.2), 4);
    drawCompressor(below(a.cols + 4.2, a.rows * 0.76));
    drawVan(below(a.cols * 0.18, a.rows + 7.5), '#7a4a3a');
    drawVan(below(a.cols * 0.56, a.rows + 9.5), '#3f5f7a');
    drawVan(below(a.cols + 7, a.rows * 0.46), '#3f4a55');
    drawPallet(below(a.cols * 0.82, a.rows + 5.2), 3);
    drawTyreStack(below(a.cols * 0.88, a.rows + 3.6), 4);
    drawDrum(below(a.cols + 7.6, a.rows * 0.86), '#7a4a20');
    drawCone(below(a.cols + 5.6, a.rows * 0.62));

    // The fence the yard ends at, and the floodlights standing on it.
    const fenceOut = 13;
    const f0 = below(-fenceOut, a.rows + fenceOut);
    const f1 = below(a.cols + fenceOut, a.rows + fenceOut);
    const f2 = below(a.cols + fenceOut, -fenceOut);
    drawYardOutskirts(a, light, 'down');
    drawYardFence(f0, f1, light);
    drawYardFence(f1, f2, light);

    // A skip parked on the lower deck, because every yard has one.
    const skip = below(a.cols * 0.32, a.rows + 4.4);
    drawIsoBox(floorCtx, skip, 0, 0, 3.6, 2.1, 40, '#7a4326', 0);
    drawIsoBox(floorCtx, skip, 0, 0, 3.3, 1.85, 6, '#2a2018', 40);
    strokePolyline([{ x: skip.x - 44, y: skip.y - 26 }, { x: skip.x + 44, y: skip.y - 34 }],
      'rgba(255,255,255,0.08)', 3);
  }

  // Roof: night sky, and the city round about, lower down.
  function drawCitySky(colors, view) {
    const g = floorCtx.createLinearGradient(0, view.y0, 0, view.y1);
    g.addColorStop(0, '#1b2538');
    g.addColorStop(0.5, '#121a29');
    g.addColorStop(1, '#0b101a');
    floorCtx.fillStyle = g;
    floorCtx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    const cx = worldOrigin.x + ((planBounds.gx0 + planBounds.gx1) / 2 - (planBounds.gy0 + planBounds.gy1) / 2) * ROOM.tileW / 2;
    const cy = worldOrigin.y + ((planBounds.gx0 + planBounds.gx1) / 2 + (planBounds.gy0 + planBounds.gy1) / 2) * ROOM.tileH / 2;
    const spread = Math.max(PLAN_W, PLAN_H);
    // The sky itself, or the roof floats in a flat void: stars, thinning
    // out towards the city, and the glow the city throws up into the haze
    // along the skyline.
    const horizon = cy - PLAN_H * 0.15;
    for (let i = 0; i < 260; i++) {
      const n1 = noise(i, 21, 51);
      const n2 = noise(i, 22, 52);
      const y = view.y0 + n2 * Math.max(1, horizon - view.y0);
      const x = view.x0 + n1 * (view.x1 - view.x0);
      // Thinner near the horizon, where the city's light drowns them.
      const high = 1 - (y - view.y0) / Math.max(1, horizon - view.y0);
      if (noise(i, 23, 53) > 0.25 + high * 0.7) continue;
      const r = noise(i, 24, 54) > 0.9 ? 1.6 : 1;
      floorCtx.fillStyle = 'rgba(214,226,246,' + (0.16 + high * 0.5).toFixed(3) + ')';
      floorCtx.fillRect(x, y, r, r);
    }
    const glowTop = horizon - PLAN_H * 0.55;
    const glow = floorCtx.createLinearGradient(0, glowTop, 0, view.y1);
    const span = Math.max(1, view.y1 - glowTop);
    glow.addColorStop(0, 'rgba(80,96,132,0)');
    glow.addColorStop(Math.min(0.9, (PLAN_H * 0.4) / span), 'rgba(92,104,138,0.15)');
    glow.addColorStop(Math.min(0.95, (PLAN_H * 0.72) / span), 'rgba(120,116,134,0.24)');
    glow.addColorStop(1, 'rgba(120,116,134,0)');
    floorCtx.fillStyle = glow;
    floorCtx.fillRect(view.x0, glowTop, view.x1 - view.x0, view.y1 - glowTop);
    // Other buildings, their tops around the level of this one's floor
    // and their walls falling away into the haze below. A few of them
    // stand well above it, with a beacon on top, so the skyline has some
    // height to it rather than stopping level with the roof.
    for (let i = 0; i < 22; i++) {
      const n1 = noise(i, 7, 45);
      const n2 = noise(i, 8, 46);
      const n3 = noise(i, 9, 47);
      const tall = noise(i, 10, 49) > 0.62;
      const x = cx + (n1 - 0.5) * spread * 3;
      const w = (tall ? 40 : 50) + n2 * (tall ? 50 : 90);
      const top = cy - PLAN_H * (tall ? 0.55 + n3 * 1.1 : 0.2 + n3 * 0.5);
      floorCtx.fillStyle = 'rgba(30,40,58,0.55)';
      floorCtx.fillRect(x - w / 2, top, w, view.y1 - top);
      floorCtx.fillStyle = 'rgba(150,170,200,0.10)';
      floorCtx.fillRect(x - w / 2, top, w, 2);
      for (let wy = top + 14; wy < cy + PLAN_H; wy += 26) {
        for (let wx = x - w / 2 + 8; wx < x + w / 2 - 8; wx += 18) {
          if (noise(Math.round(wx), Math.round(wy), 48) < 0.2) {
            floorCtx.fillStyle = 'rgba(255,214,150,0.22)';
            floorCtx.fillRect(wx, wy, 7, 10);
          }
        }
      }
      if (tall) {
        floorCtx.fillStyle = 'rgba(226,74,56,0.85)';
        floorCtx.fillRect(x - 1.5, top - 5, 3, 4);
        drawGlow({ x, y: top - 3 }, 9, '#e24a38', 0.5);
      }
    }
    for (let i = 0; i < 26; i++) {
      const n1 = noise(i, 1, 41);
      const n2 = noise(i, 2, 42);
      const n3 = noise(i, 3, 43);
      const x = cx + (n1 - 0.5) * spread * 2.4;
      const w = 70 + n2 * 150;
      const top = cy + (n3 - 0.35) * PLAN_H * 1.1;
      const bottom = view.y1 + 10;
      if (top > bottom) continue;
      const far = Math.abs(n1 - 0.5) * 2;
      const wall = shade('#1a2231', Math.round(far * 10));
      floorCtx.fillStyle = wall;
      floorCtx.fillRect(x - w / 2, top, w, bottom - top);
      floorCtx.fillStyle = 'rgba(255,255,255,0.05)';
      floorCtx.fillRect(x - w / 2, top, w, 3);
      for (let wy = top + 18; wy < bottom; wy += 30) {
        for (let wx = x - w / 2 + 10; wx < x + w / 2 - 12; wx += 22) {
          const lit = noise(Math.round(wx), Math.round(wy), 44);
          floorCtx.fillStyle = lit < 0.32 ? 'rgba(255,214,150,0.55)' : 'rgba(150,170,200,0.10)';
          floorCtx.fillRect(wx, wy, 10, 14);
        }
      }
    }
    // Haze over the lower half, so the city sinks into it.
    const fog = floorCtx.createLinearGradient(0, cy, 0, view.y1);
    fog.addColorStop(0, 'rgba(12,18,30,0)');
    fog.addColorStop(1, 'rgba(12,18,30,0.75)');
    floorCtx.fillStyle = fog;
    floorCtx.fillRect(view.x0, cy, view.x1 - view.x0, view.y1 - cy);
  }
  // The building this roof is the top of: its walls under every edge of
  // the floor that has nothing beyond it, carried all the way down the
  // canvas.
  //
  // It is deliberately not built like the skyline behind it. The city is
  // flat silhouettes in the haze; this is the thing you are standing on,
  // so it is lighter, it has a parapet under the roof edge, a band at
  // every storey, windows in proper columns, and a bright arris where its
  // two faces meet. Without that it read as one more distant block and
  // the roof looked like it was floating.
  function drawBuildingBelow(colors, view) {
    // The haze goes on first now. It used to be painted over the walls,
    // which swallowed the lower half of the building.
    const fog = floorCtx.createLinearGradient(0, view.y0 + (view.y1 - view.y0) * 0.5, 0, view.y1);
    fog.addColorStop(0, 'rgba(12,18,30,0)');
    fog.addColorStop(1, 'rgba(12,18,30,0.85)');
    floorCtx.fillStyle = fog;
    floorCtx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

    const STOREY = 46;
    const corners = [];
    // Every wall of the building, gathered before any of it is drawn and
    // then painted back to front. They used to go down in floor order,
    // which meant a walkway's far wall was painted over the wall of the
    // room standing in front of it, and every junction between the two
    // came out as a corner that could not exist.
    const runs = [];
    siteFloors().forEach((rect) => {
      ['s', 'e'].forEach((side) => {
        exposedRuns(rect, side).forEach(([from, to]) => {
          const a0 = edgePoint(rect, side, from);
          const b0 = edgePoint(rect, side, to);
          runs.push({ side, a0, b0, depth: Math.max(a0.gx + a0.gy, b0.gx + b0.gy) });
        });
      });
    });
    runs.sort((p, q) => p.depth - q.depth);
    runs.forEach(({ side, a0, b0 }) => {
      {
        {
          const a = isoPoint(a0.gx, a0.gy);
          const b = isoPoint(b0.gx, b0.gy);
          // Down to the bottom of whatever the window is showing, with a
          // margin, so the building never stops in mid-air.
          const H = Math.max(view.y1 - a.y, view.y1 - b.y) + 120;
          const wall = side === 's' ? '#3c4761' : '#2c3549';
          const grad = floorCtx.createLinearGradient(0, a.y, 0, a.y + H);
          grad.addColorStop(0, shade(wall, 8));
          grad.addColorStop(0.28, wall);
          grad.addColorStop(1, shade(wall, -30));
          const down = (p, d) => ({ x: p.x, y: p.y + d });
          paintQuad([a, b, down(b, H), down(a, H)], grad, 'rgba(0,0,0,0.45)', 1);
          // The parapet the railing stands on, and the shadow it casts.
          paintQuad([a, b, down(b, 9), down(a, 9)], shade(wall, 26), null);
          paintQuad([down(a, 9), down(b, 9), down(b, 15), down(a, 15)], 'rgba(0,0,0,0.30)', null);
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          const n = Math.max(1, Math.floor(len / 28));
          // A band at every storey, as far down as it can still be told
          // apart; below that the wall carries on into the haze.
          const bands = Math.min(H - 20, 1900);
          for (let y = 22 + STOREY; y < bands; y += STOREY) {
            paintQuad([down(a, y), down(b, y), down(b, y + 3), down(a, y + 3)], 'rgba(0,0,0,0.22)', null);
            paintQuad([down(a, y + 3), down(b, y + 3), down(b, y + 5), down(a, y + 5)], 'rgba(255,255,255,0.05)', null);
          }
          // Windows, in columns, down as far as the haze lets them read.
          const lit = Math.min(H - 40, 1500);
          for (let y = 26; y < lit; y += STOREY) {
            const fade = 1 - Math.max(0, (y - 700) / 1100);
            if (fade <= 0.05) break;
            for (let i = 0; i < n; i++) {
              const p0 = lerpPt(a, b, (i + 0.28) / n);
              const p1 = lerpPt(a, b, (i + 0.72) / n);
              const on = noise(Math.round(a.x + i * 7), Math.round(a.y + y), side === 's' ? 51 : 52) < 0.34;
              paintQuad([down(p0, y), down(p1, y), down(p1, y + 19), down(p0, y + 19)],
                on ? 'rgba(255,216,152,' + (0.55 * fade).toFixed(3) + ')'
                  : 'rgba(148,170,206,' + (0.12 * fade).toFixed(3) + ')', null);
            }
          }
          // A dark edge down both ends of the panel. Where two panels meet
          // at an outside corner the bright arris below covers it; where a
          // nearer wall stands against a further one it is the shadow in
          // the inside corner, which is what tells the two apart.
          [a, b].forEach((p) => {
            const edge = floorCtx.createLinearGradient(p.x - 9, 0, p.x + 9, 0);
            edge.addColorStop(0, 'rgba(0,0,0,0)');
            edge.addColorStop(0.5, 'rgba(0,0,0,0.30)');
            edge.addColorStop(1, 'rgba(0,0,0,0)');
            floorCtx.fillStyle = edge;
            floorCtx.fillRect(p.x - 9, p.y, 18, H);
          });
          corners.push(side === 's' ? b : a, side === 's' ? a : b);
        }
      }
    });
    // The arris where two faces of the same building meet: a bright line
    // straight down, which is what tells the eye it is one solid block
    // rather than a row of flats.
    const seen = new Set();
    corners.forEach((p) => {
      const key = Math.round(p.x) + ':' + Math.round(p.y);
      if (seen.has(key)) return;
      seen.add(key);
      const same = corners.filter((q) => Math.abs(q.x - p.x) < 1.5 && Math.abs(q.y - p.y) < 1.5);
      if (same.length < 2) return;
      const g = floorCtx.createLinearGradient(0, p.y, 0, view.y1);
      g.addColorStop(0, 'rgba(190,206,236,0.30)');
      g.addColorStop(0.35, 'rgba(150,168,200,0.12)');
      g.addColorStop(1, 'rgba(150,168,200,0)');
      floorCtx.fillStyle = g;
      floorCtx.fillRect(p.x - 1.5, p.y, 3, view.y1 - p.y);
    });
  }
  // Pier: the sea, catching the light.
  function drawSea(colors, view) {
    const g = floorCtx.createLinearGradient(0, view.y0, 0, view.y1);
    g.addColorStop(0, '#0f5477');
    g.addColorStop(0.55, '#0c4566');
    g.addColorStop(1, '#093a58');
    floorCtx.fillStyle = g;
    floorCtx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    const r = latticeRange(view);
    // Water is never one colour: broad patches where it shoals lighter and
    // where the depth or a cloud puts it in shadow. Without them the sea
    // is a flat sheet as soon as you pull back from the pier.
    const B = 26;
    for (let gy = Math.floor(r.gy0 / B) * B; gy < r.gy1; gy += B) {
      for (let gx = Math.floor(r.gx0 / B) * B; gx < r.gx1; gx += B) {
        const k = Math.round(gx);
        const j = Math.round(gy);
        const n = noise(k, j, 65);
        const c = isoPoint(gx + noise(k, j, 66) * B, gy + noise(j, k, 67) * B);
        const rad = 150 + n * 190;
        const patch = floorCtx.createRadialGradient(c.x, c.y, 2, c.x, c.y, rad);
        const tone = n > 0.55 ? '46,120,150' : '5,32,58';
        patch.addColorStop(0, 'rgba(' + tone + ',' + (0.09 + n * 0.13).toFixed(3) + ')');
        patch.addColorStop(1, 'rgba(' + tone + ',0)');
        floorCtx.fillStyle = patch;
        floorCtx.beginPath();
        floorCtx.ellipse(c.x, c.y, rad, rad * 0.5, 0, 0, Math.PI * 2);
        floorCtx.fill();
      }
    }
    const S = 2.5;
    floorCtx.lineCap = 'round';
    for (let gy = Math.floor(r.gy0 / S) * S; gy < r.gy1; gy += S) {
      for (let gx = Math.floor(r.gx0 / S) * S; gx < r.gx1; gx += S) {
        const k = Math.round(gx * 2);
        const j = Math.round(gy * 2);
        const n = noise(k, j, 61);
        const p = isoPoint(gx + noise(k, j, 62) * S, gy + noise(k, j, 63) * S);
        const len = 10 + n * 30;
        // Turquoise where the light catches a crest, darker in a trough.
        const crest = noise(k, j, 64) < 0.6;
        floorCtx.beginPath();
        floorCtx.moveTo(p.x - len / 2, p.y);
        floorCtx.quadraticCurveTo(p.x, p.y - 2 - n * 3, p.x + len / 2, p.y);
        floorCtx.strokeStyle = crest
          ? 'rgba(120,225,235,' + (0.08 + n * 0.22).toFixed(3) + ')'
          : 'rgba(0,20,40,' + (0.10 + n * 0.14).toFixed(3) + ')';
        floorCtx.lineWidth = crest ? 1.6 : 2.2;
        floorCtx.stroke();
      }
    }
  }
  // The posts the pier stands on, under every edge that meets the water,
  // the jetty, the boat, and the buoys out past it.
  function drawPierPiles(colors, view) {
    const j = jettyRect();
    if (j) {
      drawPlanks(j, colors, -18);
      const lipR = shade(colors.floorB, -40);
      paintQuad([isoPoint(j.gx0 + j.cols, j.gy0), isoPoint(j.gx0 + j.cols, j.gy0 + j.rows),
        { x: isoPoint(j.gx0 + j.cols, j.gy0 + j.rows).x, y: isoPoint(j.gx0 + j.cols, j.gy0 + j.rows).y + 10 },
        { x: isoPoint(j.gx0 + j.cols, j.gy0).x, y: isoPoint(j.gx0 + j.cols, j.gy0).y + 10 }], lipR, 'rgba(0,0,0,0.5)', 1);
      paintQuad([isoPoint(j.gx0, j.gy0 + j.rows), isoPoint(j.gx0 + j.cols, j.gy0 + j.rows),
        { x: isoPoint(j.gx0 + j.cols, j.gy0 + j.rows).x, y: isoPoint(j.gx0 + j.cols, j.gy0 + j.rows).y + 10 },
        { x: isoPoint(j.gx0, j.gy0 + j.rows).x, y: isoPoint(j.gx0, j.gy0 + j.rows).y + 10 }], shade(colors.floorB, -28), 'rgba(0,0,0,0.5)', 1);
    }
    const pile = (p, h) => {
      paintQuad([{ x: p.x - 4, y: p.y }, { x: p.x, y: p.y + 2 }, { x: p.x, y: p.y + h + 2 }, { x: p.x - 4, y: p.y + h }], '#3a2412', null);
      paintQuad([{ x: p.x, y: p.y + 2 }, { x: p.x + 4, y: p.y }, { x: p.x + 4, y: p.y + h }, { x: p.x, y: p.y + h + 2 }], '#4e321a', null);
      // Its reflection, wavering under it.
      const g = floorCtx.createLinearGradient(0, p.y + h, 0, p.y + h + 26);
      g.addColorStop(0, 'rgba(40,26,14,0.45)');
      g.addColorStop(1, 'rgba(40,26,14,0)');
      floorCtx.fillStyle = g;
      floorCtx.fillRect(p.x - 3, p.y + h, 6, 26);
      strokePolyline([{ x: p.x - 9, y: p.y + h + 1 }, { x: p.x + 9, y: p.y + h + 1 }], 'rgba(190,235,255,0.35)', 1.2);
    };
    siteFloors().forEach((rect) => {
      ['s', 'e'].forEach((side) => {
        exposedRuns(rect, side).forEach(([from, to]) => {
          for (let t = from + 1; t < to; t += 3) {
            const g = edgePoint(rect, side, t);
            pile(isoPoint(g.gx, g.gy), 44);
          }
          const end = edgePoint(rect, side, to - 0.35);
          pile(isoPoint(end.gx, end.gy), 44);
        });
      });
      // Lamplight on the water under the lamp posts at the front corners.
      [[rect.gx0 + rect.cols + 0.45, rect.gy0 + rect.rows + 0.45], [rect.gx0 - 0.45, rect.gy0 + rect.rows + 0.45],
        [rect.gx0 + rect.cols + 0.45, rect.gy0 - 0.45]].forEach(([gx, gy]) => {
        const c = isoPoint(gx, gy);
        const g = floorCtx.createLinearGradient(0, c.y + 10, 0, c.y + 120);
        g.addColorStop(0, 'rgba(255,205,120,0.42)');
        g.addColorStop(1, 'rgba(255,205,120,0)');
        floorCtx.fillStyle = g;
        for (let k = 0; k < 6; k++) {
          const w = 5 + noise(Math.round(gx), Math.round(gy), 70 + k) * 7;
          floorCtx.fillRect(c.x - w / 2 + (noise(Math.round(gx), Math.round(gy), 80 + k) - 0.5) * 8, c.y + 10 + k * 18, w, 12);
        }
      });
    });
    // The dock: what is kept on it, what is tied to it, and the working
    // water round it.
    if (j) {
      drawNetLine(isoPoint(j.gx0 + 3, j.gy0 + j.rows + 6), isoPoint(j.gx0 - 14, j.gy0 + j.rows + 22), 7);
      drawNetLine(isoPoint(j.gx0 + j.cols + 4, j.gy0 + 2), isoPoint(j.gx0 + j.cols + 20, j.gy0 - 10), 5);
      const hullAt = isoPoint(j.gx0 + 9.5, j.gy0 + j.rows + 3.6);
      drawBoat(hullAt);
      drawRowboat(isoPoint(j.gx0 + j.cols + 3.5, j.gy0 + 4.5));
      drawDock(j, hullAt);
      [[j.gx0 - 8, j.gy0 + j.rows + 12], [planBounds.gx0 - 9, planBounds.gy1 + 11]].forEach(([gx, gy]) => drawBuoy(isoPoint(gx, gy)));
    }
    // Out on the water: a channel marker, and small craft standing off,
    // so pulling back from the pier shows a sea with something in it.
    [[planBounds.gx1 + 26, planBounds.gy0 - 18], [planBounds.gx0 - 24, planBounds.gy1 + 30]]
      .forEach(([gx, gy]) => drawBuoy(isoPoint(gx, gy)));
    [[planBounds.gx0 - 30, planBounds.gy0 - 26, 0.55], [planBounds.gx1 + 34, planBounds.gy1 + 22, 0.7],
      [planBounds.gx1 + 10, planBounds.gy0 - 40, 0.45]].forEach(([gx, gy, k]) => drawDinghy(isoPoint(gx, gy), k));
  }
  // A small boat standing off the pier: a hull, its wake, and a sail on
  // the bigger ones.
  function drawDinghy(p, k) {
    const ctx = floorCtx;
    const at = (x, y) => ({ x: p.x + x * k, y: p.y + y * k });
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 7 * k, 26 * k, 7 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    paintQuad([at(-22, -2), at(18, -7), at(22, 2), at(-18, 6)], '#e6e0d2', 'rgba(0,0,0,0.4)', 1);
    paintQuad([at(-18, 3), at(20, -2), at(22, 2), at(-18, 6)], '#2f6f92', null);
    if (k > 0.5) {
      const mast = at(-2, -5);
      strokePolyline([mast, { x: mast.x, y: mast.y - 44 * k }], '#cfc7b4', 1.6 * k);
      paintQuad([{ x: mast.x + 1, y: mast.y - 44 * k }, { x: mast.x + 22 * k, y: mast.y - 6 * k },
        { x: mast.x + 1, y: mast.y - 4 * k }], '#f2ede0', 'rgba(0,0,0,0.25)', 1);
    }
    strokePolyline([at(-24, 4), at(-40, 8)], 'rgba(200,240,255,0.28)', 2 * k);
    strokePolyline([at(-24, 1), at(-36, -1)], 'rgba(200,240,255,0.18)', 1.6 * k);
  }
  function drawBoat(p) {
    const ctx = floorCtx;
    const k = 1.5;
    const at = (x, y) => ({ x: p.x + x * k, y: p.y + y * k });
    // The hull in plan, bow up-right: the deck, and the side falling away
    // below it, white over a red boot-top.
    const deck = [at(-34, -6), at(4, -14), at(30, -4), at(26, 8), at(-10, 14), at(-36, 4)];
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 16 * k, 42 * k, 13 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const side = (dy, fill) => paintQuad([deck[5], deck[4], deck[3], deck[2],
      { x: deck[2].x, y: deck[2].y + dy }, { x: deck[3].x, y: deck[3].y + dy },
      { x: deck[4].x, y: deck[4].y + dy }, { x: deck[5].x, y: deck[5].y + dy }], fill, 'rgba(0,0,0,0.45)', 1);
    side(14 * k, '#b42a22');
    side(9 * k, '#eeeae0');
    paintQuad(deck, '#dcd6c6', 'rgba(0,0,0,0.5)', 1);
    paintQuad([at(-30, -4), at(2, -11), at(24, -3), at(20, 5), at(-8, 10), at(-31, 3)], '#8a6a44', null);
    // The wheelhouse, with a lit window.
    paintQuad([at(-18, 0), at(6, -5), at(6, -24), at(-18, -19)], '#d3d8de', 'rgba(0,0,0,0.5)', 1);
    paintQuad([at(6, -5), at(14, -8), at(14, -26), at(6, -24)], '#aeb6bf', 'rgba(0,0,0,0.5)', 1);
    paintQuad([at(-15, -7), at(3, -11), at(3, -21), at(-15, -17)], '#5a8db8', null);
    paintQuad([at(-20, -19), at(15, -27), at(15, -30), at(-20, -22)], '#8f99a3', null);
    drawGlow(at(-6, -14), 16 * k, '#ffd27a', 0.35);
    drawGlow(at(28, -6), 10 * k, '#ffd27a', 0.7);
  }
  // A line of net floats curving away from the dock, the net hanging
  // under it in the water and a marker at each end.
  function drawNetLine(a, b, floats) {
    const ctx = floorCtx;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 26 };
    const at = (t) => ({
      x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mid.x + t * t * b.x,
      y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * mid.y + t * t * b.y,
    });
    // The net itself: a dark mesh under the surface, drawn as a band of
    // crossing threads that fade as they go down.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    for (let t = 0.05; t <= 1; t += 0.05) { const p = at(t); ctx.lineTo(p.x, p.y); }
    for (let t = 1; t >= 0; t -= 0.05) { const p = at(t); ctx.lineTo(p.x, p.y + 30); }
    ctx.closePath();
    ctx.clip();
    for (let i = -40; i < 60; i++) {
      const x = a.x + i * 9;
      strokePolyline([{ x, y: a.y - 40 }, { x: x + 26, y: a.y + 80 }], 'rgba(12,32,44,0.30)', 1);
      strokePolyline([{ x, y: a.y + 80 }, { x: x + 26, y: a.y - 40 }], 'rgba(12,32,44,0.30)', 1);
    }
    ctx.restore();
    // The float line over it.
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    for (let t = 0.05; t <= 1.001; t += 0.05) { const p = at(t); ctx.lineTo(p.x, p.y); }
    ctx.strokeStyle = 'rgba(226,236,244,0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    for (let i = 0; i <= floats; i++) {
      const p = at(i / floats);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 4.2, 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#e8503a' : '#f2ede0';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // A pole marker at the far end, the way a net is flagged.
    const e = at(1);
    strokePolyline([e, { x: e.x + 2, y: e.y - 34 }], '#3b2a18', 2);
    paintQuad([{ x: e.x + 2, y: e.y - 34 }, { x: e.x + 13, y: e.y - 30 }, { x: e.x + 2, y: e.y - 24 }], '#e8503a', null);
  }
  // A wooden dinghy tied at the dock, with its oars shipped.
  function drawRowboat(p) {
    const ctx = floorCtx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 9, 30, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const hull = [{ x: p.x - 28, y: p.y - 2 }, { x: p.x + 6, y: p.y - 9 }, { x: p.x + 28, y: p.y + 1 },
      { x: p.x + 22, y: p.y + 9 }, { x: p.x - 8, y: p.y + 13 }, { x: p.x - 28, y: p.y + 6 }];
    paintQuad(hull.map((q) => ({ x: q.x, y: q.y + 7 })), '#5a3a20', null);
    paintQuad(hull, '#8a5f34', 'rgba(0,0,0,0.45)', 1);
    paintQuad([{ x: p.x - 23, y: p.y + 1 }, { x: p.x + 4, y: p.y - 4 }, { x: p.x + 22, y: p.y + 3 },
      { x: p.x + 17, y: p.y + 7 }, { x: p.x - 7, y: p.y + 10 }, { x: p.x - 23, y: p.y + 4 }], '#3f2c19', null);
    [[-14, 2], [4, -1]].forEach(([dx, dy]) => {
      paintQuad([{ x: p.x + dx - 9, y: p.y + dy + 1 }, { x: p.x + dx + 9, y: p.y + dy - 2 },
        { x: p.x + dx + 9, y: p.y + dy + 1 }, { x: p.x + dx - 9, y: p.y + dy + 4 }], '#a8794a', null);
    });
    strokePolyline([{ x: p.x - 26, y: p.y - 22 }, { x: p.x + 18, y: p.y - 4 }], '#c8b78a', 1.6);
  }
  // A lobster pot: a slatted basket with a rope tail.
  function drawPot(p, k) {
    const w = 13 * k;
    const h = 9 * k;
    paintQuad([{ x: p.x - w, y: p.y }, { x: p.x + w, y: p.y }, { x: p.x + w, y: p.y - h }, { x: p.x - w, y: p.y - h }], '#6b5433', 'rgba(0,0,0,0.5)', 1);
    for (let i = -2; i <= 2; i++) {
      strokePolyline([{ x: p.x + i * w * 0.4, y: p.y - 1 }, { x: p.x + i * w * 0.4, y: p.y - h + 1 }], 'rgba(0,0,0,0.28)', 1);
    }
    floorCtx.beginPath();
    floorCtx.ellipse(p.x, p.y - h, w, h * 0.6, 0, Math.PI, 0);
    floorCtx.fillStyle = '#7d6440';
    floorCtx.fill();
    floorCtx.strokeStyle = 'rgba(0,0,0,0.45)';
    floorCtx.lineWidth = 1;
    floorCtx.stroke();
  }
  // Everything on the dock: bollards with the boat's lines on them, a
  // davit, pots and crates, tyre fenders over the edge and a ladder down
  // to the water.
  function drawDock(j, hullAt) {
    const ctx = floorCtx;
    const gy1 = j.gy0 + j.rows;
    // The dock's deck is laid at water level, so nothing on it is lifted
    // off the lattice. u runs along the dock, v across it, from the pier.
    const at = (u, v, lift) => {
      const p = isoPoint(j.gx0 + u, j.gy0 + v);
      return { x: p.x, y: p.y - (lift || 0) };
    };
    // Tyre fenders hung over the seaward edge, where a boat comes alongside.
    [1.5, 4, 6.5, 9, 11.5].forEach((u) => {
      const p = at(u, j.rows, -7);
      strokePolyline([{ x: p.x, y: p.y - 14 }, { x: p.x, y: p.y - 5 }], '#c8b78a', 1.6);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 8.5, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#23262c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 3.6, 2.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(18,44,62,0.95)';
      ctx.fill();
    });
    // Bollards on the front edge with the boat's lines run off them.
    [[2.2, 0], [10.5, 1]].forEach(([u, i]) => {
      const b = at(u, j.rows - 0.8, 0);
      paintQuad([{ x: b.x - 5.5, y: b.y }, { x: b.x + 5.5, y: b.y }, { x: b.x + 4.5, y: b.y - 19 }, { x: b.x - 4.5, y: b.y - 19 }], '#2f3239', 'rgba(0,0,0,0.5)', 1);
      paintQuad([{ x: b.x - 7, y: b.y - 19 }, { x: b.x + 7, y: b.y - 19 }, { x: b.x + 7, y: b.y - 23.5 }, { x: b.x - 7, y: b.y - 23.5 }], '#3d424b', null);
      const to = { x: hullAt.x + (i ? 34 : -34), y: hullAt.y - 12 };
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 21);
      ctx.quadraticCurveTo((b.x + to.x) / 2, Math.max(b.y, to.y) + 20, to.x, to.y);
      ctx.strokeStyle = '#cbbb90';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    // Lobster pots, stacked the way they are left on a dock.
    drawPot(at(2, 3.2, 0), 1.15);
    drawPot(at(3.6, 4.2, 0), 1.15);
    drawPot(at(2.8, 3.6, 13), 1);
    // Fish crates.
    drawIsoBox(ctx, at(5.4, 3.4, 0), 0, 0, 1.15, 0.95, 24, '#8a5f34', 0);
    drawIsoBox(ctx, at(5.4, 3.4, 0), 0, 0, 1.2, 1.0, 4, '#5f4222', 24);
    drawIsoBox(ctx, at(6.9, 4.6, 0), 0, 0, 0.95, 0.85, 20, '#7d5730', 0);
    drawIsoBox(ctx, at(6.9, 4.6, 0), 0, 0, 1.0, 0.9, 4, '#55391e', 20);
    // The net hung up to dry between two posts.
    const f0 = at(9.2, 2.6, 0);
    const f1 = at(12.2, 4.2, 0);
    const H = 58;
    [f0, f1].forEach((p) => {
      paintQuad([{ x: p.x - 3, y: p.y }, { x: p.x + 3, y: p.y }, { x: p.x + 3, y: p.y - H }, { x: p.x - 3, y: p.y - H }], '#5a3f22', 'rgba(0,0,0,0.45)', 1);
      paintQuad([{ x: p.x - 3, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x - 1, y: p.y - H }, { x: p.x - 3, y: p.y - H }], '#7c5a31', null);
    });
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(f0.x, f0.y - H + 4);
    ctx.quadraticCurveTo((f0.x + f1.x) / 2, (f0.y + f1.y) / 2 - H + 18, f1.x, f1.y - H + 4);
    ctx.lineTo(f1.x, f1.y - 14);
    ctx.quadraticCurveTo((f0.x + f1.x) / 2, (f0.y + f1.y) / 2 - 2, f0.x, f0.y - 14);
    ctx.closePath();
    ctx.fillStyle = 'rgba(206,196,158,0.34)';
    ctx.fill();
    ctx.clip();
    for (let i = -10; i < 22; i++) {
      const x = f0.x + i * 6;
      strokePolyline([{ x, y: f0.y - 96 }, { x: x + 16, y: f0.y + 18 }], 'rgba(78,68,44,0.7)', 1.1);
      strokePolyline([{ x, y: f0.y + 18 }, { x: x + 16, y: f0.y - 96 }], 'rgba(78,68,44,0.7)', 1.1);
    }
    ctx.restore();
    strokePolyline([{ x: f0.x, y: f0.y - H + 4 }, { x: f1.x, y: f1.y - H + 4 }], '#8a7a52', 1.8);
    // The davit that swings the catch up out of the boat.
    const d = at(12.4, 6.4, 0);
    paintQuad([{ x: d.x - 4, y: d.y }, { x: d.x + 4, y: d.y }, { x: d.x + 4, y: d.y - 62 }, { x: d.x - 4, y: d.y - 62 }], '#4a5058', 'rgba(0,0,0,0.5)', 1);
    paintQuad([{ x: d.x - 4, y: d.y }, { x: d.x - 1.5, y: d.y }, { x: d.x - 1.5, y: d.y - 62 }, { x: d.x - 4, y: d.y - 62 }], '#666d76', null);
    strokePolyline([{ x: d.x, y: d.y - 62 }, { x: d.x - 34, y: d.y - 72 }], '#5a6068', 4.5);
    strokePolyline([{ x: d.x - 34, y: d.y - 72 }, { x: d.x - 34, y: d.y - 34 }], '#cbbb90', 1.8);
    paintQuad([{ x: d.x - 39, y: d.y - 34 }, { x: d.x - 29, y: d.y - 34 }, { x: d.x - 29, y: d.y - 27 }, { x: d.x - 39, y: d.y - 27 }], '#3d424b', 'rgba(0,0,0,0.5)', 1);
    // The ladder down the seaward face.
    const l = at(7.6, j.rows, 0);
    [-6, 6].forEach((dx) => strokePolyline([{ x: l.x + dx, y: l.y - 4 }, { x: l.x + dx, y: l.y + 38 }], '#4a3320', 2.6));
    for (let i = 0; i < 6; i++) strokePolyline([{ x: l.x - 6, y: l.y + 2 + i * 7 }, { x: l.x + 6, y: l.y + 2 + i * 7 }], '#6a4d2c', 2);
    // A gull on one of the mooring posts.
    const g = at(10.5, j.rows - 0.8, 25);
    paintQuad([{ x: g.x - 6, y: g.y }, { x: g.x + 5, y: g.y - 2 }, { x: g.x + 4, y: g.y - 7 }, { x: g.x - 5, y: g.y - 6 }], '#f0ece2', null);
    paintQuad([{ x: g.x + 2, y: g.y - 6 }, { x: g.x + 7, y: g.y - 7 }, { x: g.x + 6, y: g.y - 12 }, { x: g.x + 2, y: g.y - 11 }], '#f0ece2', null);
    paintQuad([{ x: g.x + 6, y: g.y - 10.5 }, { x: g.x + 10, y: g.y - 10 }, { x: g.x + 6, y: g.y - 9 }], '#e8a33a', null);
    paintQuad([{ x: g.x - 6, y: g.y - 4 }, { x: g.x + 2, y: g.y - 5 }, { x: g.x + 1, y: g.y - 2 }, { x: g.x - 5, y: g.y - 1 }], '#b9c2cc', null);
  }

  function drawBuoy(p) {
    const ctx = floorCtx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    paintQuad([{ x: p.x - 9, y: p.y + 2 }, { x: p.x + 9, y: p.y + 2 }, { x: p.x + 3, y: p.y - 22 }, { x: p.x - 3, y: p.y - 22 }], '#f07a1f', 'rgba(0,0,0,0.5)', 1);
    paintQuad([{ x: p.x - 6, y: p.y - 9 }, { x: p.x + 6, y: p.y - 9 }, { x: p.x + 4.5, y: p.y - 15 }, { x: p.x - 4.5, y: p.y - 15 }], '#f3efe4', null);
    drawGlow({ x: p.x, y: p.y - 24 }, 10, '#ffd27a', 0.6);
    const g = ctx.createLinearGradient(0, p.y + 4, 0, p.y + 30);
    g.addColorStop(0, 'rgba(240,122,31,0.35)');
    g.addColorStop(1, 'rgba(240,122,31,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - 4, p.y + 4, 8, 26);
  }
  // The pier's name, on a board at the head of the jetty.
  function drawPierSign(place) {
    const j = jettyRect();
    if (!j) return;
    const at = isoPoint(j.gx0 + 0.9, j.gy0 + j.rows - 1.2);
    [-14, 14].forEach((dx) => strokePolyline([{ x: at.x + dx, y: at.y }, { x: at.x + dx, y: at.y - 44 }], '#4a2f18', 3));
    drawSignBoard({ x: at.x, y: at.y - 44 }, 'BOARDWALK', '#4a2a14');
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
    const style = styleOf(state.activeTheme);
    if (style.planks) {
      drawPlanks(rect, colors, dim);
      return;
    }
    const P = style.plate || PLATE;
    for (let ry = 0; ry < rect.rows; ry += P) {
      for (let rx = 0; rx < rect.cols; rx += P) {
        const gx = rect.gx0 + rx;
        const gy = rect.gy0 + ry;
        const w = Math.min(P, rect.cols - rx);
        const h = Math.min(P, rect.rows - ry);
        const p0 = isoPoint(gx, gy);
        const p1 = isoPoint(gx + w, gy);
        const p2 = isoPoint(gx + w, gy + h);
        const p3 = isoPoint(gx, gy + h);
        const tileColor = shade(((rx / P | 0) + (ry / P | 0)) % 2 === 0
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
    const h = slabDepth();
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
  // How far a floor stands up off the ground it is laid on. A deck over
  // water and pavers on a roof stand a good lip proud; the bays of the
  // garage and the boards of the cellar are laid on the ground they stand
  // in and sit almost flush with it, or the rooms read as raised platforms
  // rather than floors of the place.
  const SLAB_LIP = { garage: 6, basement: 5 };
  function slabDepth() {
    const lip = SLAB_LIP[state.activeTheme];
    return lip == null ? SLAB_DEPTH : lip;
  }
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
    const drop = (p) => ({ x: p.x, y: p.y + slabDepth() });
    const endIndex = [0, n];
    endIndex.forEach((i, which) => {
      if (ends[which] !== 'cap') return;
      const d = dep[i === 0 ? 0 : n - 1];
      paintQuad([drop(pts[i]), drop(shift(pts[i], d)), outer[i], lift(pts[i])],
        shade(faceOf(axes[i === 0 ? 0 : n - 1]), -20), null);
    });

    // The top, as one unbroken band around the whole run -- no seam at the
    // turns because there is nothing there to seam. In the cellar it is a
    // timber plate, the same wood as the posts outside.
    paintQuad(pts.map(lift).concat(outer.slice().reverse()),
      state.activeTheme === 'basement' ? '#8a6238' : shade(colors.wallL, 46), null);

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

  // What a wall run actually covers, as one closed polygon: along the foot
  // of the wall, dropping to the head of every doorway on the way, and back
  // along the top. The still layer gets this right on its own, because a
  // wall is painted after the floors behind it -- but the crowd, and the
  // gear beside them, are painted fresh every frame on top of that layer,
  // and without this they walked straight over any wall standing in front
  // of them (see frontWallCuts).
  function wallBandPath(centreLine, axes, h, ends, apertures) {
    const n = axes.length;
    const dep = axes.map(wallDepth);
    const pts = centreLine.slice();
    if (ends[0] !== 'cap') pts[0] = pushPast(pts[0], pts[1]);
    if (ends[1] !== 'cap') pts[n] = pushPast(pts[n], pts[n - 1]);
    const shift = (p, d, up) => ({ x: p.x + d.x, y: p.y + d.y - (up ? h : 0) });
    // The same mitre the wall's own top band is drawn with, so the polygon
    // follows the silhouette exactly rather than a few pixels inside it.
    const outer = pts.map((p, i) => {
      const before = dep[i - 1];
      const after = dep[i];
      if (!before) return shift(p, after, true);
      if (!after) return shift(p, before, true);
      if (sameVec(before, after)) return shift(p, after, true);
      return shift(p, { x: before.x + after.x, y: before.y + after.y }, true);
    });
    const bottom = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const holes = ((apertures && apertures[i]) || [])
        .map(([t0, t1]) => [Math.max(0, t0), Math.min(1, t1)])
        .filter(([t0, t1]) => t1 > t0)
        .sort((x, y) => x[0] - y[0]);
      bottom.push(a);
      // A doorway is a hole in the wall, so it is a hole in what the wall
      // covers: whoever is standing in it still shows through.
      holes.forEach(([t0, t1]) => {
        const p0 = lerpPt(a, b, t0);
        const p1 = lerpPt(a, b, t1);
        bottom.push(p0, liftPt(p0, DOOR_HEAD), liftPt(p1, DOOR_HEAD), p1);
      });
      bottom.push(b);
    }
    const poly = bottom.concat(outer.slice().reverse());
    // The foot of the wall, segment by segment, so a box can be tested
    // against the wall itself rather than against a rectangle round it --
    // the rectangle round a wall covers half the floor behind it, and every
    // machine on that floor would have asked for a repair it did not need.
    const segs = [];
    for (let i = 0; i < n; i++) segs.push({ a: pts[i], b: pts[i + 1] });
    return { poly, segs, h };
  }

  // Is any part of this box behind that wall -- between the foot of it and
  // the top?
  function boxBehindWall(b, band) {
    for (let i = 0; i < band.segs.length; i++) {
      const a = band.segs[i].a;
      const o = band.segs[i].b;
      const lo = Math.min(a.x, o.x);
      const hi = Math.max(a.x, o.x);
      if (b.x + b.w < lo || b.x > hi) continue;
      const slope = o.x === a.x ? 0 : (o.y - a.y) / (o.x - a.x);
      const at = (x) => a.y + (x - a.x) * slope;
      const yA = at(Math.max(lo, b.x));
      const yB = at(Math.min(hi, b.x + b.w));
      if (b.y > Math.max(yA, yB)) continue;
      // The top band of a wall stands a little above the height of it, so
      // the reach is measured with that on.
      if (b.y + b.h < Math.min(yA, yB) - band.h - 24) continue;
      return true;
    }
    return false;
  }

  // The wall a floor or a hallway stands behind, if it has one. The hub is
  // open floor and the two outdoor locations have railings, which are put
  // back over the crowd by the over layer instead.
  function wallBandOf(piece) {
    const theme = state.activeTheme;
    if (railed(theme)) return null;
    if (piece.roomIndex != null) {
      const i = piece.roomIndex;
      if (isHubAt(theme, i)) return null;
      const place = placements[i];
      if (!place) return null;
      const eastCorner = { gx: place.gx0 + place.cols, gy: place.gy0 };
      const westCorner = { gx: place.gx0, gy: place.gy0 + place.rows };
      const holes = wallApertures(i);
      return wallBandPath(
        [isoPoint(eastCorner.gx, eastCorner.gy), isoPoint(place.gx0, place.gy0),
          isoPoint(westCorner.gx, westCorner.gy)],
        ['gx', 'gy'], ROOM.wallH,
        [roomWallEnd(place, eastCorner), roomWallEnd(place, westCorner)],
        [holes.ne.map(([t0, t1]) => [1 - t1, 1 - t0]), holes.nw],
      );
    }
    const c = piece.corridor;
    if (!c) return null;
    const near = c.nearRoom;
    const hub = hubRect();
    if (near === hub) return null;
    const corner = isoPoint(c.gx0, c.gy0);
    const farEnd = c.doorRoom === hub && !hallwayWallMeets(c) ? 'cap' : 'open';
    if (c.axis === 'gx') {
      const far = isoPoint(c.gx0 + c.cols, c.gy0);
      if (near && c.gy0 > near.gy0) {
        return wallBandPath([isoPoint(c.gx0, near.gy0), corner, far], ['gy', 'gx'],
          ROOM.wallH, ['open', farEnd], null);
      }
      return wallBandPath([corner, far], ['gx'], ROOM.wallH, ['open', farEnd], null);
    }
    const far = isoPoint(c.gx0, c.gy0 + c.rows);
    if (near && c.gx0 > near.gx0) {
      return wallBandPath([isoPoint(near.gx0, c.gy0), corner, far], ['gx', 'gy'],
        ROOM.wallH, ['open', farEnd], null);
    }
    return wallBandPath([corner, far], ['gy'], ROOM.wallH, ['open', farEnd], null);
  }

  // For each floor in the painting order, the walls of everything painted
  // after it -- the walls that stand in front of it. Worked out once and
  // kept until the plan itself changes, because none of it moves.
  let cutKey = '';
  let frontCuts = [];
  function frontWallCuts(order, key) {
    // The list is indexed against the painting order, so how many floors
    // are in that order is part of what it is a picture of -- the plot for
    // the next room comes and goes without the plan itself changing.
    const k = key + '|' + order.length;
    if (cutKey === k) return frontCuts;
    cutKey = k;
    const bands = order.map(wallBandOf);
    frontCuts = order.map((_, i) => {
      const out = [];
      for (let j = i + 1; j < order.length; j++) if (bands[j]) out.push(bands[j]);
      return out;
    });
    return frontCuts;
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
    if (along < 6) return;

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

  // The lattice corner a hallway's wall ends on at the hub, and whether
  // another hallway's wall ends on the same corner.
  function hallwayWallCorner(c) {
    return c.axis === 'gx' ? { gx: c.gx0 + c.cols, gy: c.gy0 } : { gx: c.gx0, gy: c.gy0 + c.rows };
  }
  function hallwayWallMeets(c) {
    const at = hallwayWallCorner(c);
    return corridors.some((o) => o !== c && o.doorRoom === c.doorRoom
      && hallwayWallCorner(o).gx === at.gx && hallwayWallCorner(o).gy === at.gy);
  }

  function drawCorridorShell(c, colors) {
    // The hallway floor, with the step across the mouth it leaves its first
    // room by -- a piece of floor, so it goes down with the rest of the
    // footprint and whoever walks over it is drawn on top. Painted before
    // the pass was tested, as it used to be, it went down again on the live
    // and the over pass as well, on top of the wall of the room in front of
    // it and on top of anybody standing there.
    if (scenePass === 'floor') {
      drawPaving(c, colors, -3);
      drawSlabEdges(c, colors);
      const nearEnd = corridorEnd(c, false);
      drawThreshold(nearEnd[0], nearEnd[1], colors);
      return;
    }

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
    //
    // A hallway leaving the hub gets no wall at all: the hub is open floor,
    // and a wall standing along one side of a doorway in it would be a wall
    // to nowhere. One arriving at the hub keeps its wall, which ends where
    // the hub begins -- cut off, unless another hallway's wall meets it on
    // that corner, in which case the two turn the corner as one.
    const near = c.nearRoom;
    const hub = hubRect();
    const corner = isoPoint(c.gx0, c.gy0);
    const farEnd = c.doorRoom === hub && !hallwayWallMeets(c) ? 'cap' : 'open';
    const theme = state.activeTheme;
    const light = LIGHT_COLORS[theme] || LIGHT_COLORS.garage;
    const rails = railed(theme);
    if (scenePass === 'over') {
      if (rails) railSide(theme, c, [c.axis === 'gx' ? 's' : 'e'], light, colors);
      return;
    }
    if (scenePass === 'live') {
      // Anyone walking between rooms is drawn by the hallway they are in,
      // back to front like everything else, so they pass behind its far
      // wall and in front of its near one.
      membersInside(c)
        .sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy))
        .forEach((m) => {
          const at = isoPoint(m.gx, m.gy);
          drawMember(at, m);
          markLive(at, 92, 148);
          if (rails) crowdBoxes.push({ x: at.x - 46, y: at.y - 140, w: 92, h: 172 });
        });
      return;
    }
    if (rails) {
      railSide(theme, c, [c.axis === 'gx' ? 'n' : 'w'], light, colors);
    } else if (near === hub) {
      // Nothing to build.
    } else if (c.axis === 'gx') {
      // Running east along the gy0 edge; thickness backs off up and right.
      const far = isoPoint(c.gx0 + c.cols, c.gy0);
      if (near && c.gy0 > near.gy0) {
        drawWallRun([isoPoint(c.gx0, near.gy0), corner, far], ['gy', 'gx'],
          ROOM.wallH, colors, ['open', farEnd]);
      } else {
        drawWallRun([corner, far], ['gx'], ROOM.wallH, colors, ['open', farEnd]);
      }
    } else {
      // Running south along the gx0 edge; thickness backs off up and left.
      const far = isoPoint(c.gx0, c.gy0 + c.rows);
      if (near && c.gx0 > near.gx0) {
        drawWallRun([isoPoint(near.gx0, c.gy0), corner, far], ['gx', 'gy'],
          ROOM.wallH, colors, ['open', farEnd]);
      } else {
        drawWallRun([corner, far], ['gy'], ROOM.wallH, colors, ['open', farEnd]);
      }
    }

    drawHallwayFittings(c, colors);
    drawHallwayPosts(c, theme, colors, light);
    if (rails) railSide(theme, c, [c.axis === 'gx' ? 's' : 'e'], light, colors);
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
    // The casing is pale on a painted wall; in the cellar it is timber,
    // like the plate along the top of the wall it stands in.
    const casing = state.activeTheme === 'basement' ? '#9a7044' : shade(colors.wallL, 112);
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

  function plotOutline(rect, accent, faint, lit) {
    for (let ry = 0; ry < rect.rows; ry++) {
      for (let rx = 0; rx < rect.cols; rx++) {
        const gx = rect.gx0 + rx;
        const gy = rect.gy0 + ry;
        if (!onFloorOf(rect, gx, gy)) continue;
        paintQuad([
          isoPoint(gx, gy), isoPoint(gx + 1, gy),
          isoPoint(gx + 1, gy + 1), isoPoint(gx, gy + 1),
        ], faint, lit ? 'rgba(255,209,102,0.22)' : 'rgba(255,255,255,0.05)', 1);
      }
    }
    const corners = floorPolygon(rect).map(([gx, gy]) => isoPoint(gx, gy));
    floorCtx.save();
    floorCtx.setLineDash([8, 7]);
    paintQuad(corners, null, accent, lit ? 3 : 2);
    floorCtx.restore();
    return corners;
  }

  // Where the sign was last drawn, in the plan's own coordinates, so a tap
  // on it can be told from a tap on the floor around it. Also written onto
  // the canvas, so a test can find it.
  let plotSignHit = null;
  // Whether the pointer is on the sign, so it can be drawn as a thing you
  // are about to press rather than as a label.
  let signHovered = false;
  function overPlotSign(px, py) {
    return !!plotSignHit && px >= plotSignHit.x0 && px <= plotSignHit.x1
      && py >= plotSignHit.y0 && py <= plotSignHit.y1;
  }
  function drawPlotSign(centre, index, cost, affordable, accent) {
    const postH = 30;
    const panelW = 132;
    const panelH = 66;
    const top = { x: centre.x, y: centre.y - postH - panelH };
    plotSignHit = { x0: top.x - panelW / 2, y0: top.y, x1: top.x + panelW / 2, y1: top.y + panelH, index };
    floorCanvas.dataset.plotSign = JSON.stringify(plotSignHit);

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
      floorCtx.shadowBlur = signHovered ? 26 : 16;
    }
    // Under the pointer it lifts: a brighter face, a thicker edge and a
    // little more glow, so a sign you can press looks like one.
    paintQuad([
      { x: top.x - panelW / 2, y: top.y },
      { x: top.x + panelW / 2, y: top.y },
      { x: top.x + panelW / 2, y: top.y + panelH },
      { x: top.x - panelW / 2, y: top.y + panelH },
    ], signHovered ? 'rgba(38,31,16,0.97)' : 'rgba(16,15,21,0.94)', accent, signHovered ? 3 : 2);
    floorCtx.restore();

    floorCtx.save();
    floorCtx.textAlign = 'center';
    floorCtx.textBaseline = 'middle';
    floorCtx.fillStyle = accent;
    floorCtx.font = '800 17px Inter, system-ui, sans-serif';
    floorCtx.fillText('Room ' + (index + 1), top.x, top.y + 16);
    floorCtx.fillStyle = 'rgba(244,240,234,0.78)';
    floorCtx.font = '700 14px Inter, system-ui, sans-serif';
    floorCtx.fillText(slotCountFor(state.activeTheme, index) + ' slots', top.x, top.y + 35);
    floorCtx.fillStyle = signHovered && affordable ? '#ffb703'
      : affordable ? '#ffd66b' : 'rgba(244,240,234,0.5)';
    floorCtx.font = '800 16px Inter, system-ui, sans-serif';
    floorCtx.fillText('$' + formatNum(cost), top.x, top.y + 54);
    floorCtx.restore();
  }

  function drawRoomPreview(rect, corridor, colors, index) {
    // The plot for the next room lights up the moment you can afford it, so
    // it is not part of the still layers -- it goes down fresh each frame
    // with the gear and the crowd.
    if (scenePass !== 'live') return;
    plotSignHit = null;
    const cost = ROOM_UNLOCK_COSTS[index];
    const affordable = state.balance >= cost;
    const lit = signHovered && affordable;
    const accent = affordable ? '#ffb703' : 'rgba(168,159,176,0.5)';
    const faint = lit ? 'rgba(255,183,3,0.16)'
      : affordable ? 'rgba(255,183,3,0.05)' : 'rgba(255,255,255,0.022)';

    if (corridor) plotOutline(corridor, accent, faint, lit);
    const corners = plotOutline(rect, accent, faint, lit);

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
    // The site is drawn at the resolution the screen is showing it at, so a
    // zoom that comes to rest at a new one has to have it drawn again. This
    // costs nothing when neither the zoom nor the view has moved.
    paintStageGround();
    paintScene();
  }

  // Repainting only: no plan rebuild, no measuring the stage window back out
  // of the DOM. The members walking around run the canvas many times a
  // second, and asking the browser to re-lay-out the page that often -- which
  // is what reading the stage's size does -- would cost far more than the
  // drawing itself.
  // Which floor stands in front of which. Sorting on the back corner alone
  // is wrong as soon as the floors are different sizes: a walkway that
  // leaves the back of a big floor has a further-along back corner than the
  // floor does, so it was painted last and its railings went over the gear
  // standing on the floor in front of it. One box is behind another when it
  // ends before the other begins along either axis; that is a partial
  // order, so it is walked properly and the back corner only settles ties.
  function sortByDepth(pieces) {
    const n = pieces.length;
    if (n < 2) return pieces;
    const behind = (a, b) => (a.rect.gx0 + a.rect.cols <= b.rect.gx0) || (a.rect.gy0 + a.rect.rows <= b.rect.gy0);
    const after = pieces.map(() => []);
    const need = pieces.map(() => 0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (behind(pieces[i], pieces[j]) && !behind(pieces[j], pieces[i])) {
          after[i].push(j);
          need[j] += 1;
        }
      }
    }
    const ready = [];
    for (let i = 0; i < n; i++) if (!need[i]) ready.push(i);
    const out = [];
    while (ready.length) {
      // Whatever is free to go next, furthest back first.
      ready.sort((a, b) => pieces[a].depth - pieces[b].depth);
      const i = ready.shift();
      out.push(pieces[i]);
      after[i].forEach((j) => { if (--need[j] === 0) ready.push(j); });
    }
    // A cycle should not happen with rectangles, but never drop a floor.
    if (out.length < n) {
      pieces.forEach((p) => { if (out.indexOf(p) < 0) out.push(p); });
    }
    return out;
  }

  // The part of the drawing space the window is actually showing, in the
  // canvas's own units, with a margin so nothing pops in at the edge.
  // Zoomed in on one corner of a pier, most of the plan is off screen, and
  // painting it was most of the frame.
  // The stage's padding only moves when the window is laid out again, so
  // asking the browser for it on every frame is a forced layout for nothing.
  let padTopCache = -1;
  function stagePadTop() {
    if (padTopCache < 0) {
      padTopCache = parseFloat(getComputedStyle(stageScrollEl).paddingTop) || 0;
    }
    return padTopCache;
  }
  function forgetStagePad() {
    padTopCache = -1;
  }

  // Worked out once and kept until the view moves: it reads the scroll
  // position back off the page, and a read like that has to wait for the
  // browser to settle the layout, which is not something to do every frame.
  let seenBox = null;
  function forgetVisibleBox() {
    seenBox = null;
  }
  function visibleCanvasBox() {
    if (seenBox) return seenBox;
    seenBox = measureVisibleBox();
    return seenBox;
  }
  function measureVisibleBox() {
    if (!stageScrollEl || !zoomLevel) return null;
    const w = stageScrollEl.clientWidth;
    const h = stageScrollEl.clientHeight;
    if (!w || !h) return null;
    // Worked out from where the view is scrolled to rather than by asking
    // the browser for the canvas box, which forces a layout every frame.
    const padTop = stagePadTop();
    const pad = 200;
    const x0 = stageScrollEl.scrollLeft / zoomLevel - sitePad;
    const y0 = (stageScrollEl.scrollTop - padTop) / zoomLevel - sitePad;
    void 0;
    return {
      x0: x0 - pad,
      y0: y0 - pad,
      x1: x0 + w / zoomLevel + pad,
      y1: y0 + h / zoomLevel + pad,
    };
  }
  // Where a floor and everything standing on it lands on the canvas. The
  // margins are generous: a wall and a tall machine rise well above the
  // floor's own corners, and a lamp post stands off its front edge.
  function floorScreenBox(rect) {
    const gx1 = rect.gx0 + rect.cols;
    const gy1 = rect.gy0 + rect.rows;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    [[rect.gx0, rect.gy0], [gx1, rect.gy0], [gx1, gy1], [rect.gx0, gy1]].forEach(([gx, gy]) => {
      const p = isoPoint(gx, gy);
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    });
    return { x0: x0 - 90, y0: y0 - (ROOM.wallH + 190), x1: x1 + 90, y1: y1 + 120 };
  }
  function boxesMeet(a, b) {
    return !(a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1);
  }

  // What the still layers are a picture of. When none of this has changed
  // they are stamped again rather than redrawn.
  function stillSignature() {
    const d = designState();
    const theme = state.activeTheme;
    const parts = [theme, floorCanvas.width, floorCanvas.height,
      d.walls[theme], d.floors[theme], Math.round(lampBoost() * 20),
      state.gymName || '', decorSignature()];
    placements.forEach((p) => parts.push(p.gx0, p.gy0, p.cols, p.rows, p.cut ? 1 : 0));
    corridors.forEach((c) => parts.push(c.gx0, c.gy0, c.cols, c.rows, c.axis));
    return parts.join('|');
  }
  // Everything the still layers are a picture of that a player can change:
  // what is on each floor, where it stands, which way it is turned and what
  // mark it has been upgraded to, plus whatever the pointer is resting on.
  function decorSignature() {
    let out = hoverCell ? hoverCell.roomIndex + '.' + hoverCell.index : '-';
    activeRooms().forEach((room) => {
      out += '|' + (room.layout || []).join(',');
      (room.layout || []).forEach((id, i) => {
        if (!id) return;
        const sp = (room.spots || [])[i];
        out += ':' + i + ',' + tierOf(id) + ',' + (sp ? sp.u + ',' + sp.v + ',' + sp.r : '');
      });
    });
    return out;
  }
  function ensureStillLayers() {
    const w = floorCanvas.width;
    const h = floorCanvas.height;
    if (!stillUnder) {
      stillUnder = document.createElement('canvas');
      stillOver = document.createElement('canvas');
    }
    if (stillUnder.width !== w || stillUnder.height !== h) {
      stillUnder.width = w;
      stillUnder.height = h;
      stillOver.width = w;
      stillOver.height = h;
      stillKey = '';
    }
    stillUnderCtx = stillUnder.getContext('2d');
    stillOverCtx = stillOver.getContext('2d');
    const scale = w / BASE_W;
    stillUnderCtx.setTransform(scale, 0, 0, scale, 0, 0);
    stillOverCtx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function paintScene() {
    ratesChanged();
    crowdBoxes = [];
    const colors = colorsFor(state.activeTheme);
    const light = LIGHT_COLORS[state.activeTheme] || LIGHT_COLORS.garage;
    const W = BASE_W;
    const H = BASE_H;
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
    const build = () => {
      const pieces = rooms.map((room, i) => ({
        rect: placements[i],
        roomIndex: i,
        depth: placements[i].gx0 + placements[i].gy0,
        always: !!editing && editing.roomIndex === i,
        draw: () => drawRoom(room.layout, colors, light, i),
      })).concat(corridors.map((c) => ({
        rect: c,
        corridor: c,
        depth: c.gx0 + c.gy0,
        draw: () => drawCorridorShell(c, colors),
      })));
      if (preview) {
        pieces.push({
          rect: preview,
          depth: preview.gx0 + preview.gy0,
          draw: () => drawRoomPreview(preview, previewCorridor, colors, rooms.length),
        });
      }
      return sortByDepth(pieces);
    };

    ensureStillLayers();
    const key = stillSignature();
    // One painting order a frame, shared by the still layers and the live
    // pass -- it was worked out twice, and the cuts below have to line up
    // with it exactly.
    const order = build();
    if (key !== stillKey) {
      stillKey = key;
      const live = floorCtx;
      // The whole footprint first, then everything built on it. Two passes
      // over one list rather than one pass that does both per floor: with
      // both together, a floor drawn later laid its paving and its slab
      // edge over a wall and a machine that belonged to a floor behind it.
      stillUnderCtx.clearRect(0, 0, W, H);
      floorCtx = stillUnderCtx;
      ['floor', 'build'].forEach((pass) => {
        scenePass = pass;
        order.forEach((p) => p.draw());
      });
      // Only the two outdoor locations have a railing along the front of a
      // floor. Everywhere else the over pass has nothing to draw, so it is
      // not run and the blank layer is not stamped every frame either.
      stillOverUsed = railed(state.activeTheme);
      stillOverCtx.clearRect(0, 0, W, H);
      if (stillOverUsed) {
        floorCtx = stillOverCtx;
        scenePass = 'over';
        order.forEach((p) => p.draw());
      }
      floorCtx = live;
      scenePass = 'live';
    }

    // Anything the window cannot see is not drawn. The floor being worked
    // on is always drawn, so a piece in hand never blinks out.
    const seen = visibleCanvasBox();
    const stamp = (src, mode) => {
      floorCtx.save();
      if (mode) floorCtx.globalCompositeOperation = mode;
      floorCtx.drawImage(src, 0, 0, W, H);
      floorCtx.restore();
    };
    // 'copy' puts the still layer down and clears whatever was there in the
    // same pass, rather than wiping the canvas and then drawing over it.
    stamp(stillUnder, 'copy');
    // The crowd, and the gear standing beside them, are painted over the
    // still layer every frame -- so on their own they walk straight over
    // any wall that stands in front of them. After each floor has had its
    // turn, the walls of every floor painted after it are put back over
    // whatever strayed behind them, straight off the still layer.
    //
    // Clipping each floor to a hole cut for those walls instead is the
    // obvious way round and cost a third of the frame rate: the hole is
    // the size of the whole plan, so every floor paid for a full-canvas
    // mask whether anyone was near a wall or not. This pays only where
    // somebody actually is, which is a person or two.
    const cuts = frontWallCuts(order, key);
    order.forEach((p, i) => {
      if (seen && !p.always && !boxesMeet(floorScreenBox(p.rect), seen)) return;
      const cut = cuts[i];
      liveBoxes = cut.length ? [] : null;
      p.draw();
      if (!cut.length || !liveBoxes.length) return;
      const hit = cut.filter((band) => liveBoxes.some((b) => boxBehindWall(b, band)));
      if (!hit.length) return;
      // Only the wall behind the people who strayed onto it, not the whole
      // wall: the repair is the size of a person, wherever they happen to
      // be standing.
      const near = liveBoxes.filter((b) => hit.some((band) => boxBehindWall(b, band)));
      floorCtx.save();
      floorCtx.beginPath();
      hit.forEach(({ poly }) => {
        floorCtx.moveTo(poly[0].x, poly[0].y);
        for (let k = 1; k < poly.length; k++) floorCtx.lineTo(poly[k].x, poly[k].y);
        floorCtx.closePath();
      });
      floorCtx.clip();
      floorCtx.beginPath();
      near.forEach((b) => floorCtx.rect(b.x, b.y, b.w, b.h));
      floorCtx.clip();
      floorCtx.drawImage(stillUnder, 0, 0, W, H);
      floorCtx.restore();
    });
    liveBoxes = null;
    // The railings are already down with their own floors. This puts them
    // back over anybody standing at one, and only there -- stamped whole
    // over the plan it was a far floor's railing crossing a nearer one.
    if (stillOverUsed && crowdBoxes.length) {
      floorCtx.save();
      floorCtx.beginPath();
      crowdBoxes.forEach((b) => floorCtx.rect(b.x, b.y, b.w, b.h));
      floorCtx.clip();
      floorCtx.drawImage(stillOver, 0, 0, W, H);
      floorCtx.restore();
    }

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


  // Nothing can walk behind a fixture set against one of a floor's two
  // back edges, so it need not be sorted with the crowd every frame.
  function fixtureAtBack(f) {
    return f.v1 <= 5 || f.u1 <= 5;
  }

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
    // The hub is open floor: no walls, so nothing that hangs on one. Nor
    // has any floor where the location has railings instead of walls.
    const hub = isHubAt(theme, roomIndex);
    const rails = railed(theme);
    // ---- The floor pass: this room's share of the footprint ----
    // The kerb round an open hub floor, the paving, whatever is painted on
    // it and the edge of the slab. Nothing here stands up off the ground,
    // so it goes down with every other floor before a single wall does.
    if (scenePass === 'floor') {
      if (hub && !rails) drawHubKerb(place, colors);
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
      drawFloorMarks(theme, place, roomIndex);
      floorCtx.restore();
      drawSlabEdges(place, colors);
      return;
    }

    // The railings along the front of the floor stand over everything on
    // it, so they are the whole of the over pass and nothing else is.
    if (scenePass === 'over') {
      if (rails) {
        railSide(theme, place, ['s', 'e'], light, colors);
        if (theme === 'boardwalk') {
          lampSpots(place, false).forEach((l) => drawLampPost(isoPoint(l.gx, l.gy), light, l.flag));
          if (hub) drawPierSign(place);
        }
      }
      return;
    }

    // ---- What is built on it ----
    const buildShell = () => {
      if (hub || rails) return;
      const holes = wallApertures(roomIndex);
      drawWallRun([east, north, west], ['gx', 'gy'], ROOM.wallH, colors, [
        roomWallEnd(place, eastCorner),
        roomWallEnd(place, westCorner),
      ], [holes.ne.map(([t0, t1]) => [1 - t1, 1 - t0]), holes.nw]);

      drawBaseboard(east, north);
      drawBaseboard(north, west);
      const doors = wallDoorSpans(roomIndex);
      const took = drawWallDecor(theme, north, east, west, doors);
      drawRoomFittings(roomFitFor(roomIndex), north, east, west, doors, took);
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
    };

    // Gear stands wherever it was put, not in a grid cell, so the draw
    // order comes from the pieces themselves -- furthest back first, or a
    // piece behind another would paint over it.
    const room = activeRooms()[roomIndex];
    const items = [];
    layout.forEach((itemId, index) => {
      if (!itemId) return;
      const spot = spotOf(room, index, shape);
      items.push({ index, itemId, spot });
    });
    const loose = (place.fixtures || []).filter((f) => !fixtureAtBack(f))
      .map((f) => ({ fixture: f, spot: { u: (f.u0 + f.u1) / 2, v: (f.v0 + f.v1) / 2 } }));
    const depthOf = (e) => e.spot.u + e.spot.v;
    const paintOne = (e) => {
      if (e.member) {
        const at = isoPoint(place.gx0 + e.spot.u, place.gy0 + e.spot.v);
        drawMember(at, e.member);
        markLive(at, 92, 148);
        if (rails) crowdBoxes.push({ x: at.x - 46, y: at.y - 140, w: 92, h: 172 });
        return;
      }
      if (e.fixture) {
        drawFixture(place, e.fixture, theme, colors, light);
        markLive(isoPoint(place.gx0 + e.spot.u, place.gy0 + e.spot.v), 200, 200);
        return;
      }
      const item = itemById(e.itemId);
      if (!item) return;
      const c = isoPoint(place.gx0 + e.spot.u, place.gy0 + e.spot.v);
      if (hoverCell && hoverCell.roomIndex === roomIndex && hoverCell.index === e.index) {
        floorCtx.save();
        floorCtx.beginPath();
        floorCtx.ellipse(c.x, c.y + 2, PROP_TILE * 0.36, PROP_TILE * 0.18, 0, 0, Math.PI * 2);
        floorCtx.strokeStyle = 'rgba(255,255,255,0.75)';
        floorCtx.lineWidth = 1.6;
        floorCtx.stroke();
        floorCtx.restore();
      }
      drawProp(e.itemId, c, tierOf(e.itemId), turnAt(room, e.index));
      markLive(c, 170, 180);
    };

    // Nothing about a piece of gear moves -- who is using it is shown by the
    // person standing there, not by the machine -- so all of it goes down
    // with the room and is not drawn again until something changes. A gym
    // used to get slower the more you put in it because every piece was
    // painted afresh twenty times a second.
    if (scenePass === 'build') {
      // The walls first, then the light on them, then everything that
      // stands on the floor in front of them.
      buildShell();
      // Railings round the back of the floor, and the lamp posts behind
      // it, go down before anything standing on it.
      if (rails) {
        railSide(theme, place, ['n', 'w'], light, colors);
        if (theme === 'boardwalk') lampSpots(place, true).forEach((l) => drawLampPost(isoPoint(l.gx, l.gy), light, l.flag));
      }
      // The light comes from the rail of downlights along the back walls and
      // the pools they throw on the floor beneath them -- there is no longer
      // a fixture in the middle of the room, so nothing pools there either.
      // Drawn before the gear below, not after, so the rail sits behind tall
      // gear like real ceiling hardware instead of floating on top.
      if (!hub && !rails) drawCeilingStrip(north, east, west, light);
      else drawHubLight(place, light);
      // What the location built onto the floor. Everything that stands
      // against a back edge -- the planters, the air units, the stair
      // housings, the two kiosks -- goes down with the room, because
      // nobody can walk behind it. Anything set further in is sorted with
      // the crowd below instead.
      (place.fixtures || []).forEach((f) => {
        if (fixtureAtBack(f)) drawFixture(place, f, theme, colors, light);
      });
      items.concat(loose).sort((a, b) => depthOf(a) - depthOf(b)).forEach(paintOne);
      // And the railings along the front of this floor, over what stands on
      // it -- here, with the floor they belong to, so a floor in front of
      // this one still covers them. Kept in a layer of their own as well,
      // to put back over anybody standing at the rail (see paintScene).
      if (rails) {
        railSide(theme, place, ['s', 'e'], light, colors);
        if (theme === 'boardwalk') {
          lampSpots(place, false).forEach((l) => drawLampPost(isoPoint(l.gx, l.gy), light, l.flag));
          if (hub) drawPierSign(place);
        }
      }
      return;
    }

    // Only the people and the money the window is showing. A big floor half
    // off screen used to draw its whole crowd and lay out every tag on it.
    const seen = visibleCanvasBox();
    const onScreen = (c) => !seen || (c.x > seen.x0 - 60 && c.x < seen.x1 + 60
      && c.y > seen.y0 - 170 && c.y < seen.y1 + 60);
    const people = membersInside(place).map((m) => ({
      member: m, spot: { u: m.gx - place.gx0, v: m.gy - place.gy0 },
    })).filter((e) => onScreen(isoPoint(place.gx0 + e.spot.u, place.gy0 + e.spot.v)));
    // The money over each piece and the bar under a counter both move on
    // their own, so they are worked out every frame whatever else is not.
    items.forEach(({ index, itemId, spot }) => {
      const c = isoPoint(place.gx0 + spot.u, place.gy0 + spot.v);
      if (!onScreen(c)) return;
      if (makesStock(itemId)) drawBatchBar(room, index, c);
      const pile = pileOf(room, shape, index);
      if (pile.level > 0) queuePileTag(roomIndex, index, itemId, turnAt(room, index), c, pile);
    });
    // The people, and anything standing in front of one of them, which has
    // to come back over the top or somebody would walk through a machine.
    const standing = people.slice();
    if (people.length) {
      items.concat(loose).forEach((e) => {
        const d = depthOf(e);
        const covers = people.some((p) => depthOf(p) < d
          && Math.abs(p.spot.u - e.spot.u) < 3.6 && Math.abs(p.spot.v - e.spot.v) < 3.6);
        if (covers) standing.push(e);
      });
      standing.sort((a, b) => depthOf(a) - depthOf(b)).forEach(paintOne);
    }

    if (editing && editing.roomIndex === roomIndex) {
      drawHeldPiece(place, editing);
      markLive(isoPoint(place.gx0 + editing.spot.u, place.gy0 + editing.spot.v), 220, 220);
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
      const frac = left <= 0 ? 1 : 1 - Math.min(1, left / (b.secs || product.seconds));
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
      case 'row':
        // Seated, sliding back and forth: hips low, hands to the ribs and
        // out again, and the whole body travelling with the seat.
        return Object.assign(base, {
          crouch: 0.62 - cycle * 0.10, handY: 0.560 + cycle * 0.045,
          handX: 0.300 - cycle * 0.165, hold: 'bar', spread: 1.1,
          lean: -0.06 + cycle * 0.16,
        });
      case 'punch':
        // Alternating straight punches, weight rolling with them.
        return Object.assign(base, {
          handY: 0.760, handX: 0.110 + cycle * 0.175, spread: 1.0,
          crouch: 0.14, lean: 0.05 + cycle * 0.05, legT: s * 0.20,
        });
      case 'climb':
        // Reaching up one hand at a time, feet stepping under them.
        return Object.assign(base, {
          handY: 0.980 + cycle * 0.180, handX: 0.070, spread: 0.85,
          lift: 0.030 + cycle * 0.075, legT: s * 0.35, lean: 0.06,
        });
      case 'step':
        // Climbing on the spot, hands resting on the rails in front.
        return Object.assign(base, {
          legT: s * 0.55, crouch: 0.10 + cycle * 0.12, bob: Math.abs(c) * 0.020,
          handY: 0.720, handX: 0.145, spread: 1.15, lean: 0.04, lift: 0.030,
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
    // A dozen people on a floor is a dozen outlined limbs apiece, and a
    // stroke costs about what a fill does. Pulled back far enough that a
    // person is under fifty pixels tall the outline is a hairline nobody
    // can see, so it is left off and the crowd costs half as much.
    const fine = H * (floorCanvas.width / BASE_W) > 50;
    const outline = () => {
      if (!fine) return;
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
    if (m.regular) drawNameTag(c, m, H);
  }

  // A regular's name on a small dark tag over their head, so the one person
  // in the room who is somebody can be picked out at a glance.
  // How wide a regular's name is set, by name and by size. Measuring text
  // is one of the more expensive things a canvas does, and a name is the
  // same width every frame for as long as that regular is in the gym.
  const nameWidths = new Map();
  function nameWidth(ctx, name, size) {
    const key = name + '|' + size;
    let w = nameWidths.get(key);
    if (w === undefined) {
      w = ctx.measureText(name).width;
      if (nameWidths.size > 400) nameWidths.clear();
      nameWidths.set(key, w);
    }
    return w;
  }
  function drawNameTag(c, m, H) {
    const ctx = floorCtx;
    const size = Math.max(7, Math.min(11, H * 0.11));
    ctx.save();
    ctx.font = '700 ' + size + 'px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = nameWidth(ctx, m.regular, size) + size * 1.1;
    const h = size * 1.6;
    const x = c.x - w / 2;
    const y = c.y - H - h - size * 0.5;
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(12, 11, 16, 0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.fillText(m.regular, c.x, y + h / 2 + 0.5);
    ctx.restore();
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

  let propShadowSprite = null;
  function propShadow() {
    if (propShadowSprite) return propShadowSprite;
    const R = 40;
    propShadowSprite = document.createElement('canvas');
    propShadowSprite.width = R * 2;
    propShadowSprite.height = R * 2;
    const g = propShadowSprite.getContext('2d');
    const soft = g.createRadialGradient(R, R, R * 0.08, R, R, R);
    soft.addColorStop(0, 'rgba(0,0,0,0.55)');
    soft.addColorStop(0.45, 'rgba(0,0,0,0.34)');
    soft.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = soft;
    g.fillRect(0, 0, R * 2, R * 2);
    return propShadowSprite;
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
    // A thing lying flat on the floor casts no shadow, and a thing on a
    // narrow foot casts a small one. A mat with a machine's shadow under
    // it read as a mat floating over the floor.
    const shadowScale = SHADOW_SCALE[itemId] == null ? 1 : SHADOW_SCALE[itemId];
    const shadowRX = tiles * ROOM.tileW * 0.25 * shadowScale;
    const shadowRY = tiles * ROOM.tileH * 0.27 * shadowScale;
    const shadowY = c.y + 2;
    if (shadowScale > 0) {
      // Every piece on the floor casts one of these, and a full gym has
      // sixty pieces on it. Built fresh each time it was sixty gradients a
      // frame; the shape never changes, so it is one little picture
      // stretched to the piece that is casting it.
      floorCtx.drawImage(propShadow(), c.x - shadowRX, shadowY - shadowRY,
        shadowRX * 2, shadowRY * 2);
    }

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
    const finish = finishFor(itemId);
    const key = itemId + ':' + turn + ':' + finish;
    let entry = propCache.get(key);
    if (!entry) {
      entry = renderPropBitmap(itemId, turn, scale, finish);
      propCache.set(key, entry);
    }
    // Snapped to whole device pixels, or the stamp lands between them and
    // comes out soft on one side.
    const x = Math.round((c.x - entry.ox) * scale) / scale;
    const y = Math.round((c.y - entry.oy) * scale) / scale;
    floorCtx.drawImage(entry.canvas, x, y, entry.w, entry.h);
  }

  function renderPropBitmap(itemId, turn, scale, finish) {
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
    applyFinish(finish || 'standard');
    try {
      PROP_BUILDERS[itemId](ctx, { x: ox, y: oy });
    } finally {
      propTurn = 0;
      floorCtx = live;
      setPalette(STOCK_PALETTE);
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
  if (stageScrollEl) {
    stageScrollEl.addEventListener('scroll', () => {
      forgetVisibleBox();
      // Straight away rather than on a timer: the site reaches half a window
      // past the screen, so this is once every half-screen of panning, and
      // waiting would show the bare stage at the leading edge.
      paintStageGround();
    }, { passive: true });
  }
  const gestureEl = stageScrollEl || floorCanvas;
  const DRAG_THRESHOLD = 6;
  const pointers = new Map();
  let dragState = null;
  let pinchState = null;
  // While fingers are down the stage does not move and its padding does not
  // change, so both are measured once and held: reading them back on every
  // move forced a layout in the middle of the gesture.
  let gestureActive = false;
  let gestureStageRect = null;
  let gesturePads = null;
  const strayPointers = new Map();

  function pointerMid() {
    const pts = Array.from(pointers.values());
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
    };
  }

  // Zoom about a fixed point on screen: work out which point of the plan
  // sits under it, apply the new zoom, then re-scroll so that same point is
  // still under it.
  //
  // Two things used to stop that working. The stage carries padding at the
  // top for the row of locations, which is part of what scrolls -- reading
  // the point through the canvas's own box allowed for it and writing the
  // scroll back did not, so every step of a pinch threw the view up the
  // page by that much and it ran away from the fingers. And the view snaps
  // back to the middle whenever the whole gym fits the window, which is
  // true at the zoom the game picks for you, so the first move of every
  // pinch was overruled. The snap now waits until the fingers are lifted.
  function stagePads() {
    const cs = getComputedStyle(stageScrollEl);
    return { top: parseFloat(cs.paddingTop) || 0, left: parseFloat(cs.paddingLeft) || 0 };
  }
  function zoomAround(nextZoom, clientX, clientY, live) {
    if (!stageScrollEl) return;
    const box = gestureStageRect || stageScrollEl.getBoundingClientRect();
    const pads = gesturePads || stagePads();
    const z = zoomLevel || 1;
    // Measured off the scroll position rather than by asking the browser
    // for the canvas box, which forces a layout on every move of a pinch.
    // Clamped to the ground the plan stands on, not to the plan: pinching
    // about a point out in the background is ordinary, and anchoring that
    // to the nearest corner of the floors is what used to fling the view.
    const clamp = (v, a, c) => Math.max(a, Math.min(c, v));
    const worldX = clamp((clientX - box.left - pads.left + stageScrollEl.scrollLeft) / z - sitePad,
      -sitePad, BASE_W + sitePad);
    const worldY = clamp((clientY - box.top - pads.top + stageScrollEl.scrollTop) / z - sitePad,
      -sitePad, BASE_H + sitePad);

    setZoom(nextZoom, live);

    stageScrollEl.scrollLeft = box.left + pads.left + (worldX + sitePad) * zoomLevel - clientX;
    stageScrollEl.scrollTop = box.top + pads.top + (worldY + sitePad) * zoomLevel - clientY;
    snapIfWhollyVisible();
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

  function onPointerDown(e) {
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
    // A finger that went down off the window a moment ago is part of this
    // gesture too -- see the note on the document listeners below.
    const now = Date.now();
    strayPointers.forEach((at, id) => {
      if (id === e.pointerId) return;
      if (now - at.at > 300) { strayPointers.delete(id); return; }
      pointers.set(id, { x: at.x, y: at.y });
      try { gestureEl.setPointerCapture(id); } catch (err) { /* not critical */ }
    });
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { gestureEl.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }

    if (pointers.size === 2) {
      // Second finger down: stop panning, start pinching.
      dragState = null;
      const mid = pointerMid();
      gestureActive = true;
      gestureStageRect = stageScrollEl.getBoundingClientRect();
      gesturePads = stagePads();
      pinchState = { startDist: mid.dist || 1, startZoom: zoomLevel, lastX: mid.x, lastY: mid.y };
      return;
    }
    if (pointers.size > 2) return;

    // Holding a piece, a drag that starts on the piece carries it. A drag
    // that starts anywhere else pans the view, the same as with empty
    // hands -- so the plan can still be moved about while a piece is held.
    let carrying = false;
    if (editing) {
      const p = pointFromEvent(e);
      const hit = spotFromPoint(p.x, p.y);
      const reach = drawSizeOf(editing.itemId) * TILES_PER_METRE * 0.7 + 1.2;
      carrying = !!hit && hit.roomIndex === editing.roomIndex
        && Math.hypot(hit.u - editing.spot.u, hit.v - editing.spot.v) <= reach;
    }
    dragState = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startScrollLeft: stageScrollEl.scrollLeft,
      startScrollTop: stageScrollEl.scrollTop,
      pageScrolled: 0,
      moved: 0,
      carrying,
    };
    gestureEl.style.cursor = 'grabbing';
  }
  gestureEl.addEventListener('pointerdown', onPointerDown);
  // A pinch is two fingers, and on a phone the plan window is barely three
  // hundred pixels across: the second finger very often lands just off it,
  // on the page beside the gym. Only counting fingers that land on the
  // window itself meant those pinches did nothing but pan, which is most
  // of what made pinching feel unreliable. Once a gesture has started here,
  // a finger put down anywhere joins it.
  document.addEventListener('pointerdown', (e) => {
    if (!pointers.size || gestureEl.contains(e.target)) return;
    onPointerDown(e);
  }, true);

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchState && pointers.size >= 2) {
      const mid = pointerMid();
      if (!mid.dist) return;
      // Both at once, the way every map does it: the span between the
      // fingers sets the zoom, and the midpoint moving drags the view.
      // Zooming first, so the pan is measured in the new scale.
      zoomAround(pinchState.startZoom * (mid.dist / pinchState.startDist), mid.x, mid.y, true);
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
  }
  gestureEl.addEventListener('pointermove', onPointerMove);

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
    gestureEl.style.cursor = (hoverCell || cashUnderPointer || signHovered) ? 'pointer' : 'grab';
  }

  gestureEl.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (dragState || pinchState || editing) {
      if (signHovered) { signHovered = false; renderScene(); }
      setHoverCell(null);
      return;
    }
    const p = pointFromEvent(e);
    cashUnderPointer = overCash(p.x, p.y);
    const onSign = overPlotSign(p.x, p.y);
    if (onSign !== signHovered) {
      signHovered = onSign;
      renderScene();
    }
    setHoverCell(cashUnderPointer || onSign ? null : pieceAtPoint(p.x, p.y));
    restCursor();
  });

  gestureEl.addEventListener('pointerleave', () => {
    cashUnderPointer = false;
    if (signHovered) { signHovered = false; renderScene(); }
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

  // The gesture is over: let the view settle, put the plan back in the
  // middle if the whole gym now fits, and draw it at the resolution the
  // zoom it landed on deserves.
  function endGesture() {
    if (!gestureActive) return;
    gestureActive = false;
    gestureStageRect = null;
    gesturePads = null;
    zoomLevel = Math.round(zoomLevel * 1000) / 1000;
    applyStageSizing();
    snapIfWhollyVisible();
  }

  function onPointerUp(e) {
    const wasPinching = !!pinchState;
    pointers.delete(e.pointerId);
    strayPointers.delete(e.pointerId);
    if (pointers.size < 2) pinchState = null;
    if (!pinchState) endGesture();
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
  }
  gestureEl.addEventListener('pointerup', onPointerUp);

  // A pinch is two fingers, and on a phone the plan window is barely three
  // hundred pixels across: one of them very often lands just off it, on the
  // page beside the gym. Only counting fingers that land on the window
  // itself meant those pinches did nothing but pan, which is most of what
  // made pinching feel unreliable.
  //
  // So every finger that goes down anywhere else is remembered for a
  // moment, and a finger landing on the window takes any of them with it;
  // after that the gesture follows them wherever they go.
  document.addEventListener('pointerdown', (e) => {
    if (gestureEl.contains(e.target)) return;
    strayPointers.set(e.pointerId, { x: e.clientX, y: e.clientY, at: Date.now() });
    if (pointers.size) onPointerDown(e);
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (gestureEl.contains(e.target) || !pointers.has(e.pointerId)) return;
    onPointerMove(e);
  }, true);
  document.addEventListener('pointerup', (e) => {
    strayPointers.delete(e.pointerId);
    if (gestureEl.contains(e.target) || !pointers.has(e.pointerId)) return;
    onPointerUp(e);
  }, true);
  document.addEventListener('pointercancel', (e) => strayPointers.delete(e.pointerId), true);

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
    if (!pinchState) endGesture();
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
    sfx.lift();
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
    const fixture = fixtureAt(shape, editing.itemId, editing.spot, editing.turn);
    if (fixture) return 'fixture:' + fixture;
    if (spotInCut(shape, editing.itemId, editing.spot, editing.turn)) return 'edge';
    if (zoneOffFloor(shape, editing.itemId, editing.spot, editing.turn)) return 'edge';
    return overlapsAnother(room, shape, editing.itemId, editing.spot, editing.turn);
  }
  function blockerName(blocker) {
    if (blocker === 'edge') return 'edge of the floor';
    if (blocker.indexOf('fixture:') === 0) return FIXTURE_NAMES[blocker.slice(8)] || 'fixture';
    return itemById(blocker).name;
  }
  // A second one of the same fitting is not an overlap -- it fits fine, it
  // is simply not allowed -- so it is asked about separately and said
  // differently.
  // Why the held piece cannot go down where it is, other than something
  // being in the way: one fitting to a room, and a cap per location on the
  // big machines. Returns the sentence to say, or null.
  function editRefusal() {
    if (!editing) return null;
    const item = itemById(editing.itemId);
    if (roomAlreadyHas(activeRooms()[editing.roomIndex], editing.itemId)) {
      return { short: 'this room already has one',
        long: 'One ' + item.name + ' per room. This one has one' };
    }
    if (locationFull(state.activeTheme, editing.itemId)) {
      const cap = maxPerLocation(editing.itemId);
      const where = (THEMES.find((t) => t.id === state.activeTheme) || {}).name || 'this location';
      return {
        short: cap === 1 ? 'one to a location' : cap + ' to a location',
        long: cap === 1
          ? 'One ' + item.name + ' to a location. The ' + where + ' has one'
          : 'Only ' + cap + ' ' + item.name + ' to a location. The ' + where + ' has ' + cap,
      };
    }
    return null;
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
      toast("Won't fit. It would overlap the " + blockerName(blocker), null);
      return;
    }
    const refusal = editRefusal();
    if (refusal) {
      toast(refusal.long, null);
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
      toast(roomLabel(editing.roomIndex) + ' is full. Every slot in it is taken', null);
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
    sfx.place();
    endEdit();

    // Straight on to the next one. Only for a piece that came out of
    // Storage -- moving a piece already on the floor is a single act, and
    // handing you another one after it would be baffling.
    if (!fromTray || availableCount(itemId) <= 0) return;
    // One desk per location, so putting one down is the end of it.
    if (itemById(itemId) && itemById(itemId).starter) return;
    // Same for a fitting: the room it would land in already has one.
    if (onePerRoom(itemId)) return;
    // And for anything capped, once the location has its fill.
    if (locationFull(state.activeTheme, itemId)) return;
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
    const finish = finishFor(itemId);
    const key = itemId + ':' + turn + ':' + finish;
    let entry = propCache.get(key);
    if (!entry) {
      entry = renderPropBitmap(itemId, turn, scale, finish);
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
    if (!editing && sayShut()) return;
    if (editing) {
      if (hit) {
        if (hit.roomIndex !== editing.roomIndex) carryEditTo(hit.roomIndex, hit.u, hit.v);
        else moveEditTo(hit.u, hit.v);
      }
      return;
    }
    // The sign on the next room's plot: tapping it buys the room.
    if (plotSignHit && px >= plotSignHit.x0 && px <= plotSignHit.x1
      && py >= plotSignHit.y0 && py <= plotSignHit.y1) {
      buyNextRoom();
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

  // The folded-up line: how many pieces are waiting, so it can be left
  // shut without wondering whether anything is in there.
  // What is in Storage, in one pass: how many pieces, and what they would
  // add to the takings if every one of them were standing.
  function storageTally() {
    let pieces = 0;
    let rate = 0;
    ITEMS.forEach((item) => {
      if (item.starter) return;
      // Clamped per item: a piece standing on a floor that the save never
      // recorded as owned counts as none waiting, not as minus one.
      const n = Math.max(0, availableCount(item.id));
      pieces += n;
      rate += n * gpsOf(item.id);
    });
    return { pieces, rate };
  }
  function refreshStorageSummary() {
    const sum = document.getElementById('storage-sum');
    if (!sum) return;
    const { pieces, rate } = storageTally();
    setText(sum, pieces === 0 ? 'Empty'
      : (pieces === 1 ? '1 piece' : pieces + ' pieces')
        + (rate > 0 ? ' \u00b7 +' + formatNum(rate) + '/s unplaced' : ' waiting'));
  }

  function renderInventory() {
    refreshStorageSummary();
    inventoryEl.innerHTML = '';
    const ownedItems = ITEMS.filter((item) => !item.starter && availableCount(item.id) > 0);
    if (ownedItems.length === 0) {
      const p = document.createElement('p');
      p.className = 'tycoon-inv-empty';
      p.textContent = THEMES.some((t) => state.themeRooms[t.id].some((r) => r.layout.some(Boolean)))
        ? 'Empty. Everything you own is standing somewhere.'
        : 'Empty. What you buy lands in your hands; anything you put back waits here.';
      inventoryEl.appendChild(p);
      return;
    }

    // A line across the top answering the two things you come here to know:
    // how much is waiting, and what it is worth on the floor. It used to be
    // a wrap of identical pills with none of that in it.
    const { pieces, rate } = storageTally();
    const head = document.createElement('div');
    head.className = 'tycoon-store-head';
    head.innerHTML = '<span class="tycoon-store-count">'
      + (pieces === 1 ? '1 piece waiting' : pieces + ' pieces waiting') + '</span>'
      + (rate > 0 ? '<span class="tycoon-store-worth">+' + formatNum(rate) + '/s once placed</span>' : '');
    inventoryEl.appendChild(head);

    // Grouped and ordered the way the shop is, so a tray of ten things
    // reads as machines and then fittings rather than as ten pills in
    // whatever order they were bought.
    const order = shopOrder().filter((item) => ownedItems.indexOf(item) !== -1);
    let section = null;
    order.forEach((item) => {
      const here = sectionOf(item.id);
      if (here !== section) {
        section = here;
        const meta = SHOP_SECTIONS.find((x) => x.id === here);
        const h = document.createElement('p');
        h.className = 'tycoon-store-sect';
        setText(h, meta ? meta.name : here);
        inventoryEl.appendChild(h);
      }
      const cat = CATEGORY_META[CATEGORY[item.id]];
      const spare = availableCount(item.id);
      const held = editing && editing.itemId === item.id && editing.fromIndex === null;
      // A row rather than a pill, since it holds two separate controls --
      // take it out, and sell it -- and a line about what it does. Buttons
      // cannot nest, so the row is a div with buttons inside it.
      const chip = document.createElement('div');
      chip.className = 'tycoon-inv-item' + (held ? ' is-armed' : '');

      // The whole left side is the control that puts it in your hands: a
      // bigger target than the old pill, and the obvious thing to press.
      const armBtn = document.createElement('button');
      armBtn.type = 'button';
      armBtn.className = 'tycoon-inv-arm';
      const note = item.effect ? effectLine(item, true)
        : '+' + formatNum(gpsOf(item.id)) + '/s once placed';
      armBtn.innerHTML = '<span class="inv-cat-dot" style="background:' + cat.color + '"></span>'
        + '<span class="inv-icon" style="color:' + cat.color + '">' + iconMarkup(item.id, 19) + '</span>'
        + '<span class="inv-main">'
          + '<span class="inv-line">'
            + '<span class="inv-name">' + item.name + '</span>'
            + '<span class="inv-count">x' + spare + '</span>'
          + '</span>'
          + '<span class="inv-note">' + note + '</span>'
        + '</span>'
        + '<span class="inv-take">' + (held ? 'Holding' : 'Place') + '</span>';
      armBtn.title = held ? 'Put it back' : 'Take one out and stand it somewhere';
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
        sfx.lift();
        beginEdit(item.id, idx, { u: shape.cols / 2, v: shape.rows / 2 }, null);
        scrollToRoom(idx);
      });
      chip.appendChild(armBtn);

      const acts = document.createElement('span');
      acts.className = 'tycoon-inv-acts';
      const sellBtn = document.createElement('button');
      sellBtn.type = 'button';
      sellBtn.className = 'tycoon-inv-sell';
      setText(sellBtn, 'Sell $' + formatNum(sellPrice(item)));
      sellBtn.title = 'Sell one back for 60% of what you paid for it';
      sellBtn.addEventListener('click', () => sellItem(item.id));
      acts.appendChild(sellBtn);
      // Clearing out a stack of six meant six clicks.
      if (spare > 1) {
        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'tycoon-inv-sell is-all';
        // What the lot is worth, worked out one at a time because each
        // sale drops the price of the next.
        let take = 0;
        let owned = state.owned[item.id] || 0;
        for (let i = 0; i < spare; i++) {
          take += Math.floor(Math.ceil(item.baseCost * Math.pow(COST_GROWTH, owned - 1)) * SELL_REFUND_RATE);
          owned--;
        }
        setText(allBtn, 'Sell all');
        allBtn.title = 'Sell all ' + spare + ' spare for $' + formatNum(take);
        allBtn.dataset.pays = '$' + formatNum(take);
        allBtn.addEventListener('click', () => {
          for (let i = 0; i < spare; i++) sellItem(item.id);
        });
        acts.appendChild(allBtn);
      }
      chip.appendChild(acts);
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
      // A locked chip says "Lv 5" and nothing else, which reads as a
      // label rather than a condition. Hovering it, or tapping it on a
      // phone, spells it out. It is aria-disabled rather than disabled
      // because a disabled button swallows the hover along with the click,
      // so the explanation would never appear on the one chip that needs it.
      const tellLock = () => {
        if (btn.dataset.tip) showTip(btn, btn.dataset.tip);
      };
      btn.addEventListener('mouseenter', tellLock);
      btn.addEventListener('focus', tellLock);
      btn.addEventListener('mouseleave', hideTip);
      btn.addEventListener('blur', hideTip);
      btn.addEventListener('click', () => {
        if (!unlockedFor(t)) {
          if (tipEl.hidden) tellLock(); else hideTip();
          return;
        }
        hideTip();
        if (state.activeTheme === t.id) return;
        sfx.door();
        state.activeTheme = t.id;
        state.activeRoomIndex = Math.min(state.activeRoomIndex, activeRooms().length - 1);
        rebuildPlan();
        renderScene();
        renderInventory();
        refreshThemeRow();
        refreshSynergyText();
        refreshRoomActions();
        refreshShopUI();
        scrollToRoom(state.activeRoomIndex, true);
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
      setAttr(btn, 'aria-disabled', unlocked ? 'false' : 'true');
      btn.dataset.tip = unlocked ? '' : 'Unlocks at level ' + t.unlockLevel;
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
  // Buying the next room happens on the plan: the marked-out plot for it
  // carries a sign with the price, and tapping the sign buys it. There is
  // no button for it in the bar any more.
  function buyNextRoom() {
    const rooms = activeRooms();
    if (rooms.length >= MAX_ROOMS_PER_THEME || !gymOpen()) return false;
    const cost = ROOM_UNLOCK_COSTS[rooms.length];
    if (state.balance < cost) {
      toast('Room ' + (rooms.length + 1) + ' costs $' + formatNum(cost), null);
      return false;
    }
    const before = currentLevel();
    state.balance -= cost;
    sfx.thunk();
    // Taking on a room is progress like any other purchase, and a big one.
    addXp(xpForSpend(cost));
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
    return true;
  }

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
      addXp(xpForSpend(cost));
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
    if (floorCanvas) floorCanvas.dataset.activeRoom = String(state.activeRoomIndex);
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

  const stageWrapEl = document.querySelector('.tycoon-stage-wrap');
  function refreshPlaceHud() {
    if (shutCardEl && !gymOpen()) refreshOpenHint();
    if (!placeHudEl) return;
    placeHudEl.hidden = !editing;
    if (stageWrapEl) stageWrapEl.classList.toggle('is-editing', !!editing);
    if (!editing) return;
    const item = itemById(editing.itemId);
    const blocker = editOverlaps();
    const dupe = editRefusal();
    if (placeLabelEl) {
      const where = activeRooms().length > 1 ? ' in ' + roomLabel(editing.roomIndex) : '';
      setText(placeLabelEl, (item ? item.name : 'Gear')
        + (blocker ? ' \u00b7 too close to the ' + blockerName(blocker)
          : dupe ? ' \u00b7 ' + dupe.short
          : where + ' \u00b7 drag, then Place'));
    }
    if (placeConfirmBtn) placeConfirmBtn.disabled = !!blocker || dupe;
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
  // TESTING ONLY. Delete this block, and the button marked the same way in
  // gym-tycoon.html, when you are done poking at the numbers. It pays into
  // the balance and nothing else: no experience, so it cannot quietly walk
  // the level up and unlock things you have not earned.
  const cheatBtn = document.getElementById('btn-cheat');
  if (cheatBtn) {
    cheatBtn.addEventListener('click', () => {
      state.balance += 1e12;
      state.lifetime += 1e12;
      refreshHud();
      refreshShopUI();
      refreshStaffUI();
      refreshRoomActions();
      renderScene();
      save();
      toast('+$1.00T', 'good');
    });
  }

  // ---- Save code ----
  // The gym lives in one browser storage key, and one cleared browser ended
  // a long game with no way back. The code is the whole save, as text: a
  // prefix that names the format, the save itself in base64 of its UTF-8
  // bytes (JSON can carry any character a gym is named with), and a short
  // hash on the end so a code pasted with a piece missing is refused rather
  // than half-loaded.
  const SAVE_CODE_TAG = 'GYM1';
  function hashOf(text) {
    // FNV-1a, 32 bits, as eight hex digits. Not security, just a check
    // that what was pasted is what was copied.
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function fromBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function saveCode() {
    save();
    const body = toBase64(JSON.stringify(state));
    return SAVE_CODE_TAG + '.' + body + '.' + hashOf(body);
  }
  // What a pasted code holds, or the reason it cannot be used.
  function readSaveCode(text) {
    const parts = String(text || '').trim().replace(/\s+/g, '').split('.');
    if (parts.length !== 3 || parts[0] !== SAVE_CODE_TAG) return { error: 'That is not a save code.' };
    if (hashOf(parts[1]) !== parts[2]) return { error: 'The code is damaged: part of it is missing or changed.' };
    let saved;
    try {
      saved = JSON.parse(fromBase64(parts[1]));
    } catch (e) {
      return { error: 'The code could not be read.' };
    }
    if (!saved || typeof saved !== 'object' || !saved.themeRooms) return { error: 'That code holds no gym.' };
    return { saved };
  }
  const saveBox = document.getElementById('savebox');
  const saveCodeEl = document.getElementById('save-code');
  const saveWhenEl = document.getElementById('save-when');
  const loadCodeEl = document.getElementById('load-code');
  const loadSayEl = document.getElementById('load-say');
  function refreshSaveCode() {
    if (!saveCodeEl) return;
    saveCodeEl.value = saveCode();
    setText(saveWhenEl, 'As of now. Open this fold again for a newer one.');
  }
  if (saveBox) {
    // Made when the fold opens, so it is the gym as it stands rather than
    // as it stood when the page loaded.
    saveBox.addEventListener('toggle', () => { if (saveBox.open) refreshSaveCode(); });
  }
  const copyBtn = document.getElementById('btn-save-copy');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      refreshSaveCode();
      const text = saveCodeEl.value;
      const done = () => {
        setText(copyBtn, 'Copied');
        setTimeout(() => setText(copyBtn, 'Copy code'), 1600);
      };
      const byHand = () => {
        saveCodeEl.focus();
        saveCodeEl.select();
        try { document.execCommand('copy'); done(); } catch (e) {
          setText(saveWhenEl, 'Select the code and copy it yourself.');
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, byHand);
      } else {
        byHand();
      }
    });
  }
  const loadBtn = document.getElementById('btn-save-load');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      const read = readSaveCode(loadCodeEl.value);
      loadSayEl.classList.toggle('is-bad', !!read.error);
      if (read.error) { setText(loadSayEl, read.error); return; }
      const name = read.saved.gymName ? '"' + read.saved.gymName + '"' : 'that gym';
      if (!confirm('Load ' + name + '? The gym in this browser now will be replaced.')) return;
      // Written raw and then read back through load(), which is where every
      // migration lives: a code from an older version of the game gets the
      // same treatment as an older save would.
      saveLocked = true;
      localStorage.setItem(SAVE_KEY, JSON.stringify(read.saved));
      setText(loadSayEl, 'Loading\u2026');
      location.reload();
    });
  }

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
  // ---- The design shop panel ----
  const designEl = document.getElementById('design-panel');
  let designSig = '';
  function designThemeName() {
    const t = THEMES.find((x) => x.id === state.activeTheme);
    return t ? t.name : 'this location';
  }
  function buyDesign(kind, id) {
    const d = designState();
    const theme = state.activeTheme;
    const list = kind === 'wall' ? WALL_PAINTS : kind === 'floor' ? FLOOR_PAINTS : kind === 'art' ? WALL_ART : FINISHES;
    const item = list.find((x) => x.id === id);
    if (!item) return;
    const ownedMap = kind === 'wall' ? d.ownedWalls : kind === 'floor' ? d.ownedFloors : kind === 'finish' ? d.ownedFinishes : null;
    const owned = ownedMap ? !!ownedMap[id] : d.art[theme] === id;
    if (!owned) {
      if (state.balance < item.cost) { toast(item.name + ' costs $' + formatNum(item.cost), null); return; }
      const before = currentLevel();
      state.balance -= item.cost;
      addXp(xpForSpend(item.cost));
      sfx.thunk();
      if (ownedMap) ownedMap[id] = true;
      if (currentLevel() > before) announceLevel(currentLevel());
    }
    if (kind === 'wall') d.walls[theme] = id;
    else if (kind === 'floor') d.floors[theme] = id;
    else if (kind === 'art') d.art[theme] = id;
    else d.finish = id;
    designPreview = null;
    if (kind === 'finish') propCache.clear();
    toast(kind === 'finish' ? item.name + ' on every machine'
      : item.name + (kind === 'art' ? ' in the ' : ' for the ') + designThemeName(), 'good');
    refreshHud();
    refreshLevelUI();
    designSig = '';
    refreshDesignUI();
    renderScene();
    save();
  }
  function setDesignPreview(kind, id) {
    designPreview = { kind, id, theme: state.activeTheme };
    designSig = '';
    refreshDesignUI();
    renderScene();
  }
  function clearDesignPreview() {
    if (!designPreview) return;
    designPreview = null;
    designSig = '';
    refreshDesignUI();
    renderScene();
  }
  function clearDesign(kind) {
    designPreview = null;
    const d = designState();
    if (kind === 'wall') delete d.walls[state.activeTheme];
    else if (kind === 'floor') delete d.floors[state.activeTheme];
    else if (kind === 'art') delete d.art[state.activeTheme];
    designSig = '';
    refreshDesignUI();
    renderScene();
    save();
  }
  function refreshDesignUI() {
    if (!designEl) return;
    const d = designState();
    const theme = state.activeTheme;
    const bal = state.balance;
    // A preview belongs to the location it was tried on: look at another
    // one and it is dropped.
    if (designPreview && designPreview.kind !== 'finish' && designPreview.theme !== theme) {
      designPreview = null;
      renderScene();
    }
    const pv = designPreview ? designPreview.kind + ':' + designPreview.id : '';
    const sig = [theme, d.walls[theme] || '', d.floors[theme] || '', d.art[theme] || '', d.finish, pv,
      Object.keys(d.ownedWalls).join(','), Object.keys(d.ownedFloors).join(','), Object.keys(d.ownedFinishes).join(','),
      Math.floor(bal / 1000)].join('|');
    if (sig === designSig) return;
    designSig = sig;
    const isPv = (kind, id) => !!designPreview && designPreview.kind === kind && designPreview.id === id;
    const priceOf = (owned, cost) => owned ? 'Owned' : '$' + formatNum(cost);
    // A swatch you are trying on grows the button that pays for it, so
    // buying is one more click in the same place rather than a bar
    // somewhere else on the panel.
    const buyBtn = (kind, item) => '<span class="tycoon-swatch-buy" data-buy="' + kind + '" data-id="' + item.id + '"'
      + ' role="button" tabindex="0">Buy $' + formatNum(item.cost) + '</span>';
    const swatch = (kind, item, chosen, owned, bg) => {
      const can = owned || bal >= item.cost;
      const pvHere = isPv(kind, item.id);
      return '<div class="tycoon-swatch' + (chosen ? ' is-on' : '') + (pvHere ? ' is-preview' : '') + (can ? '' : ' is-poor') + '"'
        + ' role="button" tabindex="0"'
        + ' data-kind="' + kind + '" data-id="' + item.id + '" title="' + item.name + '">'
        + '<span class="tycoon-swatch-chip" style="background:' + bg + '"></span>'
        + '<span class="tycoon-swatch-name">' + item.name + '</span>'
        + (pvHere ? buyBtn(kind, item)
          : '<span class="tycoon-swatch-price">' + (chosen ? 'On' : priceOf(owned, item.cost)) + '</span>')
        + '</div>';
    };
    const base = THEME_COLORS[theme] || THEME_COLORS.garage;
    const wallRow = '<div class="tycoon-swatch' + (!d.walls[theme] ? ' is-on' : '') + '" role="button" tabindex="0" data-kind="wall" data-id="">'
      + '<span class="tycoon-swatch-chip" style="background:' + base.wallL + '"></span>'
      + '<span class="tycoon-swatch-name">As built</span><span class="tycoon-swatch-price">' + (!d.walls[theme] ? 'On' : 'Free') + '</span></div>'
      + WALL_PAINTS.map((w) => swatch('wall', w, d.walls[theme] === w.id, !!d.ownedWalls[w.id], w.color)).join('');
    const floorRow = '<div class="tycoon-swatch' + (!d.floors[theme] ? ' is-on' : '') + '" role="button" tabindex="0" data-kind="floor" data-id="">'
      + '<span class="tycoon-swatch-chip" style="background:linear-gradient(135deg,' + base.floorA + ' 50%,' + base.floorB + ' 50%)"></span>'
      + '<span class="tycoon-swatch-name">As built</span><span class="tycoon-swatch-price">' + (!d.floors[theme] ? 'On' : 'Free') + '</span></div>'
      + FLOOR_PAINTS.map((f) => swatch('floor', f, d.floors[theme] === f.id, !!d.ownedFloors[f.id],
        'linear-gradient(135deg,' + f.a + ' 50%,' + f.b + ' 50%)')).join('');
    const artRow = '<div class="tycoon-swatch is-wide' + (!d.art[theme] ? ' is-on' : '') + '" role="button" tabindex="0" data-kind="art" data-id="">'
      + '<span class="tycoon-swatch-chip is-none"></span>'
      + '<span class="tycoon-swatch-name">Bare walls</span><span class="tycoon-swatch-price">' + (!d.art[theme] ? 'On' : 'Free') + '</span></div>'
      + WALL_ART.map((a) => {
        const chosen = d.art[theme] === a.id;
        const can = chosen || bal >= a.cost;
        const pvHere = isPv('art', a.id);
        return '<div class="tycoon-swatch is-wide' + (chosen ? ' is-on' : '') + (pvHere ? ' is-preview' : '') + (can ? '' : ' is-poor') + '"'
          + ' role="button" tabindex="0" data-kind="art" data-id="' + a.id + '">'
          + '<span class="tycoon-swatch-chip is-' + a.id + '"></span>'
          + '<span class="tycoon-swatch-name">' + a.name + '<small>' + a.note + '</small></span>'
          + (pvHere ? buyBtn('art', a)
            : '<span class="tycoon-swatch-price">' + (chosen ? 'On' : '$' + formatNum(a.cost)) + '</span>') + '</div>';
      }).join('');
    const finishRow = FINISHES.map((f) => {
      const chosen = d.finish === f.id;
      const owned = !!d.ownedFinishes[f.id];
      const can = owned || bal >= f.cost;
      const pvHere = isPv('finish', f.id);
      const chip = f.palette.STEEL || STOCK_PALETTE.STEEL;
      return '<div class="tycoon-swatch is-wide' + (chosen ? ' is-on' : '') + (pvHere ? ' is-preview' : '') + (can ? '' : ' is-poor') + '"'
        + ' role="button" tabindex="0" data-kind="finish" data-id="' + f.id + '">'
        + '<span class="tycoon-swatch-chip" style="background:linear-gradient(135deg,' + (f.palette.STEEL_LT || STOCK_PALETTE.STEEL_LT) + ',' + chip + ' 60%,' + (f.palette.FRAME_DK || STOCK_PALETTE.FRAME_DK) + ')"></span>'
        + '<span class="tycoon-swatch-name">' + f.name + '<small>' + f.note + '</small></span>'
        + (pvHere ? buyBtn('finish', f)
          : '<span class="tycoon-swatch-price">' + (chosen ? 'On' : owned ? 'Owned' : f.cost ? '$' + formatNum(f.cost) : 'Free') + '</span>') + '</div>';
    }).join('');
    designEl.innerHTML = '<p class="tycoon-panel-note">Paint and art go on the location you are in. A finish goes on every machine. Click one to see it on the plan, then press its Buy button to keep it. Buy a colour once, use it anywhere.</p>'
      + '<h3 class="tycoon-panel-title">Walls <span class="tycoon-panel-sub">' + designThemeName() + '</span></h3>'
      + '<div class="tycoon-swatches">' + wallRow + '</div>'
      + '<h3 class="tycoon-panel-title">Floor <span class="tycoon-panel-sub">' + designThemeName() + '</span></h3>'
      + '<div class="tycoon-swatches">' + floorRow + '</div>'
      + '<h3 class="tycoon-panel-title">Wall art <span class="tycoon-panel-sub">' + designThemeName() + '</span></h3>'
      + '<div class="tycoon-swatches is-list">' + artRow + '</div>'
      + '<h3 class="tycoon-panel-title">Gear finish <span class="tycoon-panel-sub">whole gym</span></h3>'
      + '<div class="tycoon-swatches is-list">' + finishRow + '</div>';
  }
  // Whether a piece of the design shop is already paid for.
  function designOwned(kind, id) {
    const d = designState();
    if (kind === 'wall') return !!d.ownedWalls[id];
    if (kind === 'floor') return !!d.ownedFloors[id];
    if (kind === 'finish') return !!d.ownedFinishes[id];
    return d.art[state.activeTheme] === id;
  }
  function designItem(kind, id) {
    const list = kind === 'wall' ? WALL_PAINTS : kind === 'floor' ? FLOOR_PAINTS : kind === 'art' ? WALL_ART : FINISHES;
    return list.find((x) => x.id === id);
  }
  if (designEl) {
    designEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const hit = e.target.closest('.tycoon-swatch-buy, .tycoon-swatch');
      if (!hit) return;
      e.preventDefault();
      hit.click();
    });
    designEl.addEventListener('click', (e) => {
      // The Buy button sits inside the swatch it belongs to, so it has to
      // be looked at before the swatch under it.
      const buy = e.target.closest('.tycoon-swatch-buy');
      if (buy) {
        e.stopPropagation();
        buyDesign(buy.dataset.buy, buy.dataset.id);
        return;
      }
      const btn = e.target.closest('.tycoon-swatch');
      if (!btn) return;
      const kind = btn.dataset.kind;
      const id = btn.dataset.id;
      if (!id) { if (kind !== 'finish') clearDesign(kind); return; }
      // Owned already: it goes straight on, for nothing. Not owned: tried on
      // first, and only if it can be paid for -- there is nothing to look at
      // in something you cannot buy, and nothing is bought by one click.
      if (designOwned(kind, id)) { buyDesign(kind, id); return; }
      const item = designItem(kind, id);
      if (!item) return;
      if (state.balance < item.cost) { toast(item.name + ' costs $' + formatNum(item.cost), null); return; }
      if (designPreview && designPreview.kind === kind && designPreview.id === id) { clearDesignPreview(); return; }
      setDesignPreview(kind, id);
    });
  }

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
    const opened = levelBrings(level);
    return opened.length ? opened.join(', ') : null;
  }

  // ---- The level chip opens what it is worth ----
  // The stats strip says "Level 12" and a bar, which is a number without an
  // answer to "so what". Tapping it opens the same card the Gym tab has,
  // over the strip, so the answer is one tap from where the question is
  // asked rather than a tab and a scroll away.
  const levelBtn = document.getElementById('hud-level-btn');
  const levelPop = (() => {
    if (!levelBtn) return null;
    const el = document.createElement('div');
    el.className = 'tycoon-level-pop';
    el.setAttribute('role', 'note');
    el.hidden = true;
    document.body.appendChild(el);
    return el;
  })();
  function levelPopHtml() {
    const level = currentLevel();
    const p = levelProgress();
    const rep = Math.round(reputationBonus() * 100);
    const brings = p.capped ? null : levelBrings(level + 1);
    const perks = LEVEL_PERKS.filter((perk) => perk.level > level).slice(0, 3);
    return '<div class="tycoon-level-pop-head">'
      + '<span class="tycoon-level-pop-now">Level ' + level + '</span>'
      + '<span class="tycoon-level-pop-xp">' + (p.capped ? 'Top level'
        : formatNum(Math.floor((state.xp || 0) - p.from)) + ' / ' + formatNum(p.to - p.from) + ' XP')
      + '</span></div>'
      + '<span class="tycoon-level-pop-bar"><span class="tycoon-level-pop-fill" style="width:'
        + Math.round(p.frac * 100) + '%"></span></span>'
      + (rep > 0 ? '<p class="tycoon-level-pop-rep">Reputation: <b>+' + rep
        + '%</b> on everything, from every level past ' + REPUTATION_FROM_LEVEL + '.</p>' : '')
      + (brings && brings.length
        ? '<p class="tycoon-level-pop-next"><b>Level ' + (level + 1) + '</b> brings '
          + brings.join(', ') + '.</p>'
        : '<p class="tycoon-level-pop-next">There is no level above this one.</p>')
      + (perks.length
        ? '<p class="tycoon-level-pop-head2">Coming up</p>'
          + '<ul class="tycoon-level-pop-list">'
          + perks.map((perk) => '<li><b>' + perk.level + '</b> ' + perk.text + '</li>').join('')
          + '</ul>'
        : '')
      + '<p class="tycoon-level-pop-note">Buying and upgrading gear is what earns XP. '
        + 'Dearer kit earns more.</p>';
  }
  function placeLevelPop() {
    if (!levelPop || levelPop.hidden) return;
    const box = levelBtn.getBoundingClientRect();
    const pop = levelPop.getBoundingClientRect();
    const pad = 8;
    let left = box.left + box.width / 2 - pop.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - pop.width - pad));
    let top = box.bottom + 8;
    if (top + pop.height > window.innerHeight - pad) top = Math.max(pad, box.top - pop.height - 8);
    levelPop.style.left = Math.round(left) + 'px';
    levelPop.style.top = Math.round(top) + 'px';
  }
  function setLevelPop(open) {
    if (!levelPop) return;
    if (open) {
      levelPop.innerHTML = levelPopHtml();
      levelPop.hidden = false;
      placeLevelPop();
      requestAnimationFrame(() => levelPop.classList.add('is-on'));
    } else {
      levelPop.classList.remove('is-on');
      levelPop.hidden = true;
    }
    levelBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (levelBtn && levelPop) {
    levelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setLevelPop(levelPop.hidden);
    });
    document.addEventListener('click', (e) => {
      if (!levelPop.hidden && e.target !== levelBtn && !levelBtn.contains(e.target)
        && !levelPop.contains(e.target)) setLevelPop(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setLevelPop(false); });
    window.addEventListener('resize', placeLevelPop);
    // The card is fixed to the window and pinned to the chip, so a scroll
    // moves it rather than closing it -- clicking the chip scrolls the page
    // a little by itself, which used to shut the card in the same gesture
    // that opened it. It closes only once the chip has left the screen.
    window.addEventListener('scroll', () => {
      if (levelPop.hidden) return;
      const box = levelBtn.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) setLevelPop(false);
      else placeLevelPop();
    }, { passive: true });
  }

  const levelCardEl = document.getElementById('level-card');
  function refreshLevelCard() {
    if (!levelCardEl) return;
    const level = currentLevel();
    const p = levelProgress();
    setText(levelCardEl.querySelector('.tycoon-lvl-now'), 'Level ' + level);
    levelCardEl.querySelector('.tycoon-lvl-fill').style.width =
      Math.round(p.frac * 100) + '%';
    // What the levels so far are worth, standing: the reputation line is
    // the running total of every level past ten.
    const rep = Math.round(reputationBonus() * 100);
    const repLine = rep > 0 ? ' Reputation: +' + rep + '% on everything.' : '';
    if (p.capped) {
      setText(levelCardEl.querySelector('.tycoon-lvl-xp'), 'Top level');
      setText(levelCardEl.querySelector('.tycoon-lvl-next'),
        'There is no level above this one.' + repLine);
      return;
    }
    const into = Math.max(0, (state.xp || 0) - p.from);
    setText(levelCardEl.querySelector('.tycoon-lvl-xp'),
      formatNum(into) + ' / ' + formatNum(p.to - p.from) + ' XP to level ' + (level + 1));
    const brings = nextLevelBrings(level + 1);
    setText(levelCardEl.querySelector('.tycoon-lvl-next'), (brings
      ? 'Level ' + (level + 1) + ' brings ' + brings + '.'
      : 'Buying and upgrading gear is what earns XP. Dearer kit earns more.') + repLine);
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
        sfx.door();
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
        : !open ? 'Closed. Needs a Customer Desk'
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
      + ' · ' + pieces + (pieces === 1 ? ' piece placed' : ' pieces placed')
      + ' · ' + formatNum(gps) + '/s');
  }
  // Writing the same string back into the DOM ten times a second is a lot of
  // needless layout work, so nothing is written unless it changed.
  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }
  function setHtml(el, html) {
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }
  // The same, for a plain string. The panel beside the gym is gone over ten
  // times a second, and almost nothing on it has changed since the last
  // time -- but writing a string back over the identical string still
  // replaces the text node, which is enough to have the browser lay the
  // panel out and paint it again. On a phone that alone was costing a third
  // of the frame rate the gym itself was fighting for.
  function setText(el, text) {
    const s = text == null ? '' : String(text);
    if (el && el.textContent !== s) el.textContent = s;
  }
  // And the same for the two other things the panel writes on every pass:
  // the width of a progress bar and the state on a button.
  function setWidth(el, css) {
    if (el && el.style.width !== css) el.style.width = css;
  }
  function setAttr(el, name, value) {
    if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
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

  // What was earned while the tab was shut, said once, and held on screen
  // long enough to read. A gym that filled nothing -- no gear down yet, or
  // every bubble already full when you left -- says nothing at all.
  if (awayCash >= 1) {
    setTimeout(() => {
      toast('Away ' + awayWords(awayFor) + '. $' + formatNum(awayCash)
        + ' waiting in the bubbles', 'good', 4200);
    }, 700);
  }

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
    refreshDesignUI();
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
  setInterval(tickMurmur, 1000);

  // The stage window is sized off the viewport on desktop, so dragging a
  // browser window between a laptop screen and a monitor changes how much
  // plan fits. renderScene() re-measures the window on every call (that is
  // what fitZoomToStage does), so a repaint is the whole fix -- debounced,
  // because a resize fires on every frame of the drag.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    forgetStagePad();
    forgetVisibleBox();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { renderScene(); parkView(); }, 120);
  });

  // ---- The place in motion ----
  // Members are stepped on a capped frame rate rather than every animation
  // frame: a walk reads fine at twenty a second and costs a third of what
  // sixty would on a phone. An empty gym repaints not at all, and nothing
  // runs at all while the tab is hidden -- the same rule the earnings follow.
  const MEMBER_FPS = 20;
  let lastPaintMs = 0;
  let paintAvg = 0;
  let lastTuneAt = 0;
  // Step the picture down when the device cannot paint it in time, and back
  // up when it can. Slowly, and never on a single slow frame: switching
  // costs a full repaint, so it is not worth doing over a hiccup.
  function tunePixelBudget(now) {
    if (now - lastTuneAt < 2500) return;
    let next = pixelStep;
    if (paintAvg > 42 && pixelStep < PIXEL_STEPS.length - 1) next = pixelStep + 1;
    else if (paintAvg < 14 && pixelStep > 0) next = pixelStep - 1;
    if (next === pixelStep) return;
    lastTuneAt = now;
    pixelStep = next;
    paintAvg = 0;
    renderScene();
  }
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
    // How often to repaint. Twenty times a second is the most it is worth,
    // but on a phone that cannot paint the gym in fifty milliseconds,
    // asking for twenty leaves nothing for the taps and the scrolling and
    // the whole thing feels worse than a slower, steadier picture. So the
    // gap is whichever is longer: the cap, or a bit over what the last
    // paint actually took.
    const wait = Math.max(1000 / MEMBER_FPS, Math.min(120, lastPaintMs * 1.7));
    if (now - lastFrameAt < wait) return;
    const dt = Math.min(0.25, (now - lastFrameAt) / 1000);
    lastFrameAt = now;
    if (members.length) {
      stepMembers(dt);
      const t0 = performance.now();
      paintScene();
      lastPaintMs = performance.now() - t0;
      paintAvg = paintAvg ? paintAvg * 0.85 + lastPaintMs * 0.15 : lastPaintMs;
      tunePixelBudget(now);
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
