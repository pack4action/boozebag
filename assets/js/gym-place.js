// Where a piece of equipment stands on the floor.
//
// It used to be a slot. A room was an array of cols*rows cells, a machine
// was the string sitting in one of them, and "placing" meant writing that
// string into the cell you tapped. Every gym built that way looks the same:
// everything on a 96px grid, everything centred in its square, no two
// layouts distinguishable at a glance.
//
// Now a machine has a POSITION -- a point on the tile lattice in tile units,
// free to sit anywhere, snapped to a sixteenth of a tile. A sixteenth is
// three screen pixels across and one and a half down, which is fine enough
// that two gyms never look alike and coarse enough that a machine never
// looks accidentally crooked, and that nudging one with an arrow button
// feels like a step rather than a twitch.
//
// Everything here is pure: no canvas, no DOM, no state. It answers "may this
// go here", "what does it cover", and "where does it land if I nudge it",
// and it converts an old slot-based room into a positioned one. The renderer
// and the edit-mode HUD are somewhere else entirely.
(function () {
  // A sixteenth of a tile. The tile is 96x48 on screen, so one step is 3px
  // horizontally and 1.5px vertically -- about 3.4px along the diagonal an
  // arrow actually moves something.
  const SNAP = 1 / 16;

  // Most gym equipment reads as about a tile square. The exceptions are the
  // long ones: a treadmill and a bench are noticeably deeper than they are
  // wide, and a reception desk is a counter, not a box. Footprints are in
  // tiles, and they are what stops two machines occupying the same floor and
  // what the pathfinder treats as solid.
  const FOOTPRINTS = {
    treadmill: { w: 1, h: 1.6 },
    bench: { w: 1, h: 1.5 },
    rack: { w: 1.3, h: 1.3 },
    cable: { w: 1.2, h: 1.2 },
    mat: { w: 1.4, h: 1 },
    sauna: { w: 1.5, h: 1.5 },
    desk: { w: 2, h: 1 },
    cubicle: { w: 1.6, h: 1.6 },
    manager: { w: 2, h: 1.6 },
    hq: { w: 1.6, h: 1.6 },
  };
  const DEFAULT_FOOTPRINT = { w: 1, h: 1 };

  // How close two machines may stand. Without a gap they read as one lump of
  // metal, and the floor between them stops being floor you could walk.
  const CLEARANCE = 0.08;

  // A tile only counts as blocked if a machine really sits on it, not if it
  // grazes the edge by a pixel -- otherwise a machine nudged a sixteenth of a
  // tile silently walls off the row behind it.
  const TILE_BITE = 0.2;

  function footprintOf(itemId) {
    return FOOTPRINTS[itemId] || DEFAULT_FOOTPRINT;
  }

  function snap(v) {
    return Math.round(v / SNAP) * SNAP;
  }

  function snapped(item) {
    return { id: item.id, gx: snap(item.gx), gy: snap(item.gy) };
  }

  // An item's footprint on the floor, in tile units. The stored position is
  // the CENTRE, which is where the sprite is anchored and where it rotates
  // about, so the rectangle is derived rather than stored -- two numbers to
  // keep in step instead of four.
  function rectOf(item) {
    const f = footprintOf(item.id);
    return {
      x0: item.gx - f.w / 2,
      y0: item.gy - f.h / 2,
      x1: item.gx + f.w / 2,
      y1: item.gy + f.h / 2,
    };
  }

  function rectsOverlap(a, b, pad) {
    const p = pad || 0;
    return a.x0 < b.x1 + p && a.x1 > b.x0 - p && a.y0 < b.y1 + p && a.y1 > b.y0 - p;
  }

  function insideRoom(item, room) {
    const r = rectOf(item);
    return r.x0 >= room.gx0 && r.y0 >= room.gy0
      && r.x1 <= room.gx0 + room.cols && r.y1 <= room.gy0 + room.rows;
  }

  // Why a position is no good, or null if it is fine. A reason rather than a
  // boolean because the edit HUD says it out loud -- "that is off the floor"
  // and "that is on top of the squat rack" are different problems and the
  // player can only fix the one they are told about.
  //
  // `ignore` is the index of the item being moved, so a machine being nudged
  // one step does not collide with where it currently stands.
  function placementProblem(items, candidate, room, ignore) {
    if (!insideRoom(candidate, room)) return 'off the floor';
    const rect = rectOf(candidate);
    for (let i = 0; i < items.length; i++) {
      if (i === ignore) continue;
      if (rectsOverlap(rect, rectOf(items[i]), CLEARANCE)) return 'too close to the ' + items[i].id;
    }
    return null;
  }

  function canPlace(items, candidate, room, ignore) {
    return placementProblem(items, candidate, room, ignore) === null;
  }

  // The nearest position that works, searched outwards from where the player
  // let go. Dropping a machine a hair inside its neighbour should shuffle it
  // clear, not refuse.
  function nudgeToFit(items, candidate, room, ignore) {
    if (canPlace(items, candidate, room, ignore)) return snapped(candidate);
    for (let ring = 1; ring <= 24; ring++) {
      const step = ring * SNAP * 2;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const tryItem = snapped({ id: candidate.id, gx: candidate.gx + dx * step, gy: candidate.gy + dy * step });
          if (canPlace(items, tryItem, room, ignore)) return tryItem;
        }
      }
    }
    return null;
  }

  // One arrow press. The four directions are the lattice's, not the screen's:
  // pressing the arrow that points down-right on screen moves the machine
  // along +gx, which is what it looks like it does.
  const DIRECTIONS = {
    gxPlus: { dgx: 1, dgy: 0 },
    gxMinus: { dgx: -1, dgy: 0 },
    gyPlus: { dgx: 0, dgy: 1 },
    gyMinus: { dgx: 0, dgy: -1 },
  };

  function nudge(item, direction, steps) {
    const d = DIRECTIONS[direction];
    if (!d) return snapped(item);
    const n = steps || 1;
    return snapped({ id: item.id, gx: item.gx + d.dgx * SNAP * n, gy: item.gy + d.dgy * SNAP * n });
  }

  // The tiles a set of machines actually stands on, as "gx,gy" keys, for the
  // pathfinder to treat as solid.
  function blockedTiles(items) {
    const blocked = new Set();
    items.forEach((item) => {
      const r = rectOf(item);
      for (let gy = Math.floor(r.y0); gy < Math.ceil(r.y1); gy++) {
        for (let gx = Math.floor(r.x0); gx < Math.ceil(r.x1); gx++) {
          // How much of this tile the machine really covers.
          const over = Math.max(0, Math.min(r.x1, gx + 1) - Math.max(r.x0, gx))
            * Math.max(0, Math.min(r.y1, gy + 1) - Math.max(r.y0, gy));
          if (over >= TILE_BITE) blocked.add(gx + ',' + gy);
        }
      }
    });
    return blocked;
  }

  // Items sorted back-to-front, so nearer machines paint over further ones.
  // The same ordering the floor tiles use, on a continuous position.
  function backToFront(items) {
    return items.slice().sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
  }

  // The topmost item under a point, for picking one up. Back-to-front order
  // reversed, so the machine drawn last is the one you grab.
  function itemAt(items, gx, gy) {
    const ordered = backToFront(items);
    for (let i = ordered.length - 1; i >= 0; i--) {
      const r = rectOf(ordered[i]);
      if (gx >= r.x0 && gx <= r.x1 && gy >= r.y0 && gy <= r.y1) return ordered[i];
    }
    return null;
  }

  // An old slot-based room becomes a positioned one, each machine landing in
  // the middle of the cell it used to occupy. Nobody's gym moves: a layout
  // that was neat stays neat, and the player can now nudge it off the grid
  // if they want to.
  function fromLayout(layout, cols, gx0, gy0) {
    const items = [];
    if (!Array.isArray(layout) || !cols) return items;
    layout.forEach((id, index) => {
      if (!id) return;
      const rx = index % cols;
      const ry = Math.floor(index / cols);
      items.push({ id, gx: (gx0 || 0) + rx + 0.5, gy: (gy0 || 0) + ry + 0.5 });
    });
    return items;
  }

  window.BoozebagGymPlace = {
    SNAP,
    CLEARANCE,
    FOOTPRINTS,
    footprintOf,
    snap,
    snapped,
    rectOf,
    insideRoom,
    placementProblem,
    canPlace,
    nudgeToFit,
    nudge,
    blockedTiles,
    backToFront,
    itemAt,
    fromLayout,
  };
})();
