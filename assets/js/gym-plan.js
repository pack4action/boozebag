// The Gym Tycoon floor plan: where each room in a theme's chain stands on
// the tile lattice, and where the hallways joining them run.
//
// This is the model the renderer draws and the one the tests check. It
// lives in its own file for the second reason: the game itself is one big
// closure around a canvas, so nothing inside it can be reached from a test
// runner, and eyeballing isometric junctions is how the last round of
// hallway faults got missed. Everything here is pure -- tile arithmetic,
// no canvas, no DOM -- so tests/plan.test.js can load it in plain Node.
//
// The whole floor plan lives on ONE isometric lattice: every room and
// corridor is a rectangle of tiles on it, at absolute tile coordinates.
// (An earlier version parked each room in its own screen-space cell, which
// meant corridors between them could never line up with the tile grid and
// read as planks bridging a gap rather than hallways.)
(function () {
  // Each theme builds to its own floor plan, because a unit, a cellar and a
  // roof are not the same shape of place. Rooms are not one bay stamped out
  // N times either: every position in a chain has its own footprint, and the
  // later ones are bigger, which is most of what they are bought for.
  //
  // ROOM SIZES ARE FOR A PLACE YOU WALK AROUND IN.
  //
  // These used to be much smaller -- the starter bay was 6x2, and the biggest
  // room in any theme was 21 tiles. That was the right size for a board you
  // fill: every tile was a slot, and a full room was a solid raft of
  // equipment with no gaps, which is exactly what you want when arranging
  // gear IS the game.
  //
  // It is the wrong size for a room. A gym floor has to hold a front desk, a
  // shelf of things to sell, the equipment itself, and -- most of it -- the
  // space between them, wide enough that a member, an employee and the owner
  // can pass each other without anybody standing still. Two machines in a
  // 6x2 bay cut it in half; you cannot walk a 6x2 bay at all.
  //
  // So the footprints below are roughly three times the area they were, and
  // the extra is circulation, not slots. Half of a room is meant to stay
  // empty. A room is not full when every tile is covered -- it is full when
  // there is no longer a sensible way through it.
  //
  // Growing is the safe direction for a save: normalizedRoomChain copies a
  // saved layout into the new footprint by flat index, so a room that gets
  // bigger only ever gains empty tiles at the end and never drops gear.
  // Shrinking any of these numbers later would throw away whatever sat in
  // the tiles that vanished.
  //
  // The three chains come to 217, 219 and 215 tiles, so no theme is a better
  // buy than another for the same run of prices -- what differs is the shape
  // of the space you are arranging a gym in.
  const ROOM_PLANS = {
    // Vehicle bays: wide and shallow, side by side down one unit. Deep
    // enough now for equipment along the back wall and a lane in front of it.
    garage: {
      shapes: [
        { cols: 8, rows: 5 }, // 40 -- the starter bay
        { cols: 9, rows: 6 }, // 54
        { cols: 10, rows: 6 }, // 60 -- the long bay
        { cols: 9, rows: 7 }, // 63 -- deep enough for an island in the middle
      ],
      dirs: ['east', 'east', 'south'],
      corridorLen: 2,
      corridorWidth: 3,
    },
    // Cellar rooms: still narrow and deep relative to the others, still
    // strung together by real tunnels that turn corners rather than opening
    // straight onto each other -- but now wide enough for two people to pass.
    basement: {
      shapes: [
        { cols: 6, rows: 7 }, // 42
        { cols: 7, rows: 7 }, // 49 -- the long cell
        { cols: 7, rows: 8 }, // 56
        { cols: 8, rows: 9 }, // 72
      ],
      dirs: ['south', 'east', 'south'],
      corridorLen: 4,
      corridorWidth: 3,
    },
    // Open deck: broad, shallow platforms that spread across the roof,
    // joined by walkways wide enough to read as outdoors.
    rooftop: {
      shapes: [
        { cols: 9, rows: 5 }, // 45
        { cols: 10, rows: 5 }, // 50
        { cols: 11, rows: 6 }, // 66 -- the wide deck
        { cols: 9, rows: 6 }, // 54
      ],
      dirs: ['east', 'south', 'west'],
      corridorLen: 3,
      corridorWidth: 4,
    },
  };

  function planFor(themeId) {
    return ROOM_PLANS[themeId] || ROOM_PLANS.garage;
  }
  function roomShapeFor(themeId, index) {
    const shapes = planFor(themeId).shapes;
    return shapes[index % shapes.length];
  }
  function slotCountFor(themeId, index) {
    const s = roomShapeFor(themeId, index);
    return s.cols * s.rows;
  }
  function roomDirFor(themeId, step) {
    const dirs = planFor(themeId).dirs;
    return dirs[step % dirs.length];
  }

  // Tile rectangles for a chain of `count` rooms, each butted up against the
  // previous one with a corridor's worth of space between them and centred on
  // the shared edge.
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

  // Every hallway in a chain of `count` rooms, in room order.
  function corridorsFor(themeId, placements) {
    const out = [];
    for (let i = 0; i < placements.length - 1; i++) {
      out.push(corridorBetween(
        themeId, placements[i], placements[i + 1], roomDirFor(themeId, i),
      ));
    }
    return out;
  }

  window.BoozebagGymPlan = {
    ROOM_PLANS,
    themeIds: () => Object.keys(ROOM_PLANS),
    planFor,
    roomShapeFor,
    slotCountFor,
    roomDirFor,
    roomPlacements,
    corridorBetween,
    corridorsFor,
  };
})();
