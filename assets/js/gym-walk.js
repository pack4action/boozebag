// Walking the gym floor: which tiles you can stand on, and how to get from
// one to another.
//
// The floor plan (gym-plan.js) says where the rooms and hallways are. This
// turns that into something an actor can move across: a grid of walkable
// tiles covering every room and every hallway in a theme's chain, and a
// path between two of them that goes around the furniture and through the
// doorways instead of across the walls.
//
// Pure tile arithmetic, no canvas and no DOM, for the same reason gym-plan.js
// is: a path that quietly cuts a corner through a wall looks almost right on
// screen, and "almost right" is not something you can eyeball forty times a
// second. Tests drive this directly in Node.
//
// Two things about the lattice that a grid must respect, both of which have
// already caught people out:
//   - Tile coordinates go NEGATIVE. The rooftop's fourth room sits at
//     gx0 = -1, so a grid indexed straight off (gx, gy) would write out of
//     bounds. Everything here is offset by the grid's own origin.
//   - The plan's own `planBounds` includes the staked-out plot for the NEXT
//     room, which is deliberately not walkable. Sizing a grid off that would
//     leave a room-shaped hole of walkable-looking nothing. The bounds here
//     are computed from the built rooms and hallways alone.
(function () {
  const DIRS = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
  ];
  const STRAIGHT_COST = 100;
  // 141/100 ~ sqrt(2), in the same integer units, so diagonal steps cost
  // what they actually are and a path does not zig-zag where a straight run
  // would do.
  const DIAGONAL_COST = 141;

  function rectsFor(themeId, roomCount, plan) {
    const rooms = plan.roomPlacements(themeId, roomCount);
    return rooms.concat(plan.corridorsFor(themeId, rooms));
  }

  // The grid: one byte per tile over the bounding box of every room and
  // hallway, 1 where you may stand. Small by construction -- the biggest
  // chain any theme builds to is a couple of hundred tiles -- so a flat
  // array beats anything cleverer, and A* over it is free.
  function buildGrid(themeId, roomCount, options) {
    const opts = options || {};
    const plan = (opts.plan || window.BoozebagGymPlan);
    const rects = rectsFor(themeId, roomCount, plan);

    let minGx = Infinity;
    let minGy = Infinity;
    let maxGx = -Infinity;
    let maxGy = -Infinity;
    rects.forEach((r) => {
      minGx = Math.min(minGx, r.gx0);
      minGy = Math.min(minGy, r.gy0);
      maxGx = Math.max(maxGx, r.gx0 + r.cols);
      maxGy = Math.max(maxGy, r.gy0 + r.rows);
    });

    const cols = maxGx - minGx;
    const rows = maxGy - minGy;
    const grid = {
      themeId,
      roomCount,
      gx0: minGx,
      gy0: minGy,
      cols,
      rows,
      cells: new Uint8Array(cols * rows),
    };

    rects.forEach((r) => {
      for (let gy = r.gy0; gy < r.gy0 + r.rows; gy++) {
        for (let gx = r.gx0; gx < r.gx0 + r.cols; gx++) {
          grid.cells[(gy - minGy) * cols + (gx - minGx)] = 1;
        }
      }
    });

    // Whatever stands on the floor -- equipment, a counter, a plant -- is
    // subtracted here rather than baked into the plan, because what is in
    // the way changes every time the player puts something down, while the
    // plan itself does not.
    if (opts.blocked) {
      const blocked = opts.blocked;
      if (typeof blocked === 'function') {
        for (let gy = minGy; gy < maxGy; gy++) {
          for (let gx = minGx; gx < maxGx; gx++) {
            if (blocked(gx, gy)) grid.cells[(gy - minGy) * cols + (gx - minGx)] = 0;
          }
        }
      } else {
        blocked.forEach((t) => { setWalkable(grid, t.gx, t.gy, false); });
      }
    }

    return grid;
  }

  function inBounds(grid, gx, gy) {
    return gx >= grid.gx0 && gx < grid.gx0 + grid.cols
      && gy >= grid.gy0 && gy < grid.gy0 + grid.rows;
  }

  function indexOf(grid, gx, gy) {
    return (gy - grid.gy0) * grid.cols + (gx - grid.gx0);
  }

  function isWalkable(grid, gx, gy) {
    return inBounds(grid, gx, gy) && grid.cells[indexOf(grid, gx, gy)] === 1;
  }

  function setWalkable(grid, gx, gy, walkable) {
    if (!inBounds(grid, gx, gy)) return;
    grid.cells[indexOf(grid, gx, gy)] = walkable ? 1 : 0;
  }

  function walkableCount(grid) {
    let n = 0;
    for (let i = 0; i < grid.cells.length; i++) n += grid.cells[i];
    return n;
  }

  // A diagonal step may not squeeze between two blocked tiles: without this
  // an actor slips through the corner where two walls meet, which on an
  // isometric floor reads as walking through the join.
  function canStep(grid, gx, gy, dx, dy) {
    if (!isWalkable(grid, gx + dx, gy + dy)) return false;
    if (dx !== 0 && dy !== 0) {
      if (!isWalkable(grid, gx + dx, gy)) return false;
      if (!isWalkable(grid, gx, gy + dy)) return false;
    }
    return true;
  }

  // Octile distance: the true cost of the straight-and-diagonal moves
  // allowed above, so it never over-estimates and A* stays optimal.
  function heuristic(ax, ay, bx, by) {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return STRAIGHT_COST * (dx + dy) + (DIAGONAL_COST - 2 * STRAIGHT_COST) * Math.min(dx, dy);
  }

  // A* from one tile to another. Returns the whole path including both ends,
  // or null when there is no way through -- which is a real answer, not an
  // error: a room can be walled off by its own equipment, and the caller
  // needs to know that rather than have an actor set off hopefully.
  function findPath(grid, from, to) {
    if (!isWalkable(grid, from.gx, from.gy)) return null;
    if (!isWalkable(grid, to.gx, to.gy)) return null;
    if (from.gx === to.gx && from.gy === to.gy) return [{ gx: from.gx, gy: from.gy }];

    const size = grid.cols * grid.rows;
    const cameFrom = new Int32Array(size).fill(-1);
    const gScore = new Float64Array(size).fill(Infinity);
    const closed = new Uint8Array(size);
    const startIdx = indexOf(grid, from.gx, from.gy);
    const goalIdx = indexOf(grid, to.gx, to.gy);
    gScore[startIdx] = 0;

    // A plain array kept in cost order. The grids here are a few hundred
    // tiles, so the binary heap this would need at scale would cost more in
    // code than it saves in time.
    const open = [{ idx: startIdx, gx: from.gx, gy: from.gy, f: heuristic(from.gx, from.gy, to.gx, to.gy) }];

    while (open.length) {
      let bestAt = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bestAt].f) bestAt = i;
      const current = open.splice(bestAt, 1)[0];
      if (current.idx === goalIdx) {
        const path = [];
        let idx = goalIdx;
        while (idx !== -1) {
          path.push({
            gx: grid.gx0 + (idx % grid.cols),
            gy: grid.gy0 + Math.floor(idx / grid.cols),
          });
          idx = cameFrom[idx];
        }
        return path.reverse();
      }
      if (closed[current.idx]) continue;
      closed[current.idx] = 1;

      for (let d = 0; d < DIRS.length; d++) {
        const { dx, dy } = DIRS[d];
        const nx = current.gx + dx;
        const ny = current.gy + dy;
        if (!canStep(grid, current.gx, current.gy, dx, dy)) continue;
        const nIdx = indexOf(grid, nx, ny);
        if (closed[nIdx]) continue;
        const step = (dx !== 0 && dy !== 0) ? DIAGONAL_COST : STRAIGHT_COST;
        const tentative = gScore[current.idx] + step;
        if (tentative >= gScore[nIdx]) continue;
        cameFrom[nIdx] = current.idx;
        gScore[nIdx] = tentative;
        open.push({ idx: nIdx, gx: nx, gy: ny, f: tentative + heuristic(nx, ny, to.gx, to.gy) });
      }
    }
    return null;
  }

  // The closest tile you could actually stand on, for a tap that lands on a
  // wall, on a machine, or off the floor entirely. Breadth-first from the
  // asked-for tile so it returns a genuinely near one rather than the first
  // in scan order, and bounded so a tap far off the plan gives up instead of
  // sweeping the whole grid.
  function nearestWalkable(grid, gx, gy, maxRadius) {
    if (isWalkable(grid, gx, gy)) return { gx, gy };
    const limit = maxRadius || 6;
    for (let r = 1; r <= limit; r++) {
      let best = null;
      let bestDist = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!isWalkable(grid, gx + dx, gy + dy)) continue;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = { gx: gx + dx, gy: gy + dy };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // Every tile reachable from a starting tile, as a Set of "gx,gy" keys.
  // Used to answer "can the player get to this machine at all" without
  // pathfinding to each one in turn.
  function reachableFrom(grid, from) {
    const seen = new Set();
    if (!isWalkable(grid, from.gx, from.gy)) return seen;
    const queue = [from];
    seen.add(from.gx + ',' + from.gy);
    while (queue.length) {
      const cur = queue.shift();
      for (let d = 0; d < DIRS.length; d++) {
        const { dx, dy } = DIRS[d];
        if (!canStep(grid, cur.gx, cur.gy, dx, dy)) continue;
        const key = (cur.gx + dx) + ',' + (cur.gy + dy);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ gx: cur.gx + dx, gy: cur.gy + dy });
      }
    }
    return seen;
  }

  // How far along a path an actor has walked, as a position between tiles.
  // Movement is expressed in tiles per second and resolved here rather than
  // per-frame in the renderer, so the same walk plays out identically
  // whatever the frame rate happens to be.
  function advanceAlongPath(path, fromIndex, progress, distance) {
    let idx = fromIndex;
    let t = progress + distance;
    while (idx < path.length - 1) {
      const a = path[idx];
      const b = path[idx + 1];
      const legLength = (a.gx !== b.gx && a.gy !== b.gy) ? Math.SQRT2 : 1;
      if (t < legLength) {
        const f = legLength === 0 ? 0 : t / legLength;
        return {
          index: idx,
          progress: t,
          gx: a.gx + (b.gx - a.gx) * f,
          gy: a.gy + (b.gy - a.gy) * f,
          done: false,
        };
      }
      t -= legLength;
      idx++;
    }
    const end = path[path.length - 1];
    return { index: path.length - 1, progress: 0, gx: end.gx, gy: end.gy, done: true };
  }

  window.BoozebagGymWalk = {
    buildGrid,
    isWalkable,
    setWalkable,
    walkableCount,
    inBounds,
    findPath,
    nearestWalkable,
    reachableFrom,
    advanceAlongPath,
    STRAIGHT_COST,
    DIAGONAL_COST,
  };
})();
