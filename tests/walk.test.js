// Walking the floor: the grid of standable tiles, and paths across it.
//
// A path that cuts a corner through a wall, or a grid that quietly drops the
// hallways, looks almost right on screen -- and "almost right" is not
// something anyone catches by eye at forty frames a second. So the rules are
// pinned here instead: every room and hallway tile is walkable, nothing else
// is, a path only ever steps between adjacent walkable tiles, it never
// squeezes diagonally between two blocked ones, and a room sealed off by its
// own equipment reports no path rather than pretending there is one.

const test = require('node:test');
const assert = require('node:assert');
const { loadWalk } = require('./helpers/load-plan');

const { plan, walk } = loadWalk();
const MAX_ROOMS = 4;

function key(t) { return t.gx + ',' + t.gy; }

function roomAndCorridorTiles(themeId, count) {
  const rooms = plan.roomPlacements(themeId, count);
  const rects = rooms.concat(plan.corridorsFor(themeId, rooms));
  const tiles = new Set();
  rects.forEach((r) => {
    for (let gy = r.gy0; gy < r.gy0 + r.rows; gy++) {
      for (let gx = r.gx0; gx < r.gx0 + r.cols; gx++) tiles.add(gx + ',' + gy);
    }
  });
  return tiles;
}

for (const theme of plan.themeIds()) {
  for (let count = 1; count <= MAX_ROOMS; count++) {
    const grid = walk.buildGrid(theme, count, { plan });

    test(`${theme} x${count}: every room and hallway tile is walkable, nothing else`, () => {
      const want = roomAndCorridorTiles(theme, count);
      assert.equal(walk.walkableCount(grid), want.size,
        'walkable count should be exactly the floor area');
      want.forEach((k) => {
        const [gx, gy] = k.split(',').map(Number);
        assert.ok(walk.isWalkable(grid, gx, gy), `expected ${k} to be walkable`);
      });
      // And a sweep of the whole bounding box finds nothing walkable that
      // is not floor -- this is what catches a grid that forgot to subtract
      // the gaps between rooms.
      for (let gy = grid.gy0; gy < grid.gy0 + grid.rows; gy++) {
        for (let gx = grid.gx0; gx < grid.gx0 + grid.cols; gx++) {
          if (walk.isWalkable(grid, gx, gy)) {
            assert.ok(want.has(gx + ',' + gy), `${gx},${gy} is walkable but is not floor`);
          }
        }
      }
    });

    test(`${theme} x${count}: the whole floor is reachable from any of it`, () => {
      // The hallways exist precisely so that every room connects. If a
      // doorway or a corridor ever stops lining up, this is what says so.
      const first = { gx: grid.gx0, gy: grid.gy0 };
      const start = walk.nearestWalkable(grid, first.gx, first.gy, 20);
      assert.ok(start, 'expected at least one walkable tile');
      const reached = walk.reachableFrom(grid, start);
      assert.equal(reached.size, walk.walkableCount(grid),
        `only ${reached.size} of ${walk.walkableCount(grid)} floor tiles are reachable `
        + '-- a room or hallway is walled off from the rest');
    });

    if (count > 1) {
      test(`${theme} x${count}: you can walk from the first room to the last`, () => {
        const rooms = plan.roomPlacements(theme, count);
        const a = rooms[0];
        const z = rooms[count - 1];
        const from = { gx: a.gx0, gy: a.gy0 };
        const to = { gx: z.gx0 + z.cols - 1, gy: z.gy0 + z.rows - 1 };
        const path = walk.findPath(grid, from, to);
        assert.ok(path, 'expected a path between the first and last room');
        assert.deepEqual(path[0], from);
        assert.deepEqual(path[path.length - 1], to);

        // Every step is onto an adjacent, walkable tile.
        for (let i = 1; i < path.length; i++) {
          const dx = Math.abs(path[i].gx - path[i - 1].gx);
          const dy = Math.abs(path[i].gy - path[i - 1].gy);
          assert.ok(dx <= 1 && dy <= 1 && (dx + dy) > 0,
            `step ${i} jumps from ${key(path[i - 1])} to ${key(path[i])}`);
          assert.ok(walk.isWalkable(grid, path[i].gx, path[i].gy),
            `step ${i} lands on ${key(path[i])}, which is not floor`);
        }
      });
    }
  }
}

test('a diagonal squeeze between two machines is not a way through', () => {
  // Two machines on opposite corners of a 2x2 leave a gap that looks
  // passable on a square grid and is not: stepping across it would take the
  // actor through the point where they touch. The garage's starter bay is
  // only two tiles deep, so blocking that pair really does cut the room in
  // half -- and "no path" is the honest answer, not a squeeze.
  const grid = walk.buildGrid('garage', 1, { plan });
  walk.setWalkable(grid, 1, 0, false);
  walk.setWalkable(grid, 2, 1, false);
  assert.equal(walk.findPath(grid, { gx: 1, gy: 1 }, { gx: 2, gy: 0 }), null);
});

test('where a legal way round exists, the path takes it', () => {
  // Same pinch, but in a room deep enough to walk around it: the basement's
  // first cell is 3 wide and 4 deep.
  const grid = walk.buildGrid('basement', 1, { plan });
  walk.setWalkable(grid, 1, 1, false);
  walk.setWalkable(grid, 2, 2, false);
  const path = walk.findPath(grid, { gx: 1, gy: 2 }, { gx: 2, gy: 1 });
  assert.ok(path, 'there is a way round the top');
  path.forEach((t) => {
    assert.ok(walk.isWalkable(grid, t.gx, t.gy), `path stands on ${key(t)}, which is blocked`);
  });
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].gx - path[i - 1].gx;
    const dy = path[i].gy - path[i - 1].gy;
    if (dx !== 0 && dy !== 0) {
      assert.ok(walk.isWalkable(grid, path[i - 1].gx + dx, path[i - 1].gy)
        && walk.isWalkable(grid, path[i - 1].gx, path[i - 1].gy + dy),
      `diagonal step ${i} cuts a corner between two blocked tiles`);
    }
  }
});

test('a room sealed off by its own equipment reports no path', () => {
  // Filling every tile of the starter bay except one corner is exactly what
  // an old save looks like -- rooms could be filled 100%. The answer has to
  // be "you cannot get there", not a path through the furniture.
  const grid = walk.buildGrid('garage', 2, { plan });
  const rooms = plan.roomPlacements('garage', 2);
  const a = rooms[0];
  for (let gy = a.gy0; gy < a.gy0 + a.rows; gy++) {
    for (let gx = a.gx0; gx < a.gx0 + a.cols; gx++) {
      if (gx === a.gx0 && gy === a.gy0) continue;
      walk.setWalkable(grid, gx, gy, false);
    }
  }
  const z = rooms[1];
  const path = walk.findPath(grid, { gx: a.gx0, gy: a.gy0 }, { gx: z.gx0, gy: z.gy0 });
  assert.equal(path, null, 'a walled-in actor should report no path, not walk through gear');
});

test('the grid is not sized off the plan bounds, which include the next plot', () => {
  // planBounds in gym-tycoon.js folds in the staked-out plot for the room
  // you have not bought yet. A grid sized off that would have a room-shaped
  // patch of walkable-looking nothing in it.
  const grid = walk.buildGrid('garage', 1, { plan });
  const only = plan.roomPlacements('garage', 1)[0];
  assert.equal(grid.cols, only.cols);
  assert.equal(grid.rows, only.rows);
  assert.equal(walk.walkableCount(grid), only.cols * only.rows);
});

test('negative tile coordinates are handled', () => {
  // The rooftop's fourth room sits at gx0 = -1. A grid indexed straight off
  // (gx, gy) would write outside its own array.
  const rooms = plan.roomPlacements('rooftop', 4);
  const negative = rooms.filter((r) => r.gx0 < 0 || r.gy0 < 0);
  assert.ok(negative.length > 0, 'expected the rooftop chain to run negative');
  const grid = walk.buildGrid('rooftop', 4, { plan });
  negative.forEach((r) => {
    assert.ok(walk.isWalkable(grid, r.gx0, r.gy0),
      `tile ${r.gx0},${r.gy0} should be walkable floor`);
  });
  assert.ok(grid.gx0 <= -1, 'the grid origin should cover the negative coordinates');
});

test('a tap on a machine or a wall resolves to the nearest floor tile', () => {
  const grid = walk.buildGrid('garage', 1, { plan });
  walk.setWalkable(grid, 2, 1, false);
  const near = walk.nearestWalkable(grid, 2, 1);
  assert.ok(near, 'expected a nearby floor tile');
  assert.ok(walk.isWalkable(grid, near.gx, near.gy));
  assert.ok(Math.max(Math.abs(near.gx - 2), Math.abs(near.gy - 1)) === 1, 'should be adjacent');

  // Far off the plan, it gives up rather than sweeping the whole grid.
  assert.equal(walk.nearestWalkable(grid, 400, 400, 4), null);
});

test('blocked tiles can be supplied when the grid is built', () => {
  const asList = walk.buildGrid('garage', 1, { plan, blocked: [{ gx: 0, gy: 0 }, { gx: 1, gy: 0 }] });
  assert.ok(!walk.isWalkable(asList, 0, 0));
  assert.ok(!walk.isWalkable(asList, 1, 0));
  assert.ok(walk.isWalkable(asList, 2, 0));

  const asFn = walk.buildGrid('garage', 1, { plan, blocked: (gx) => gx === 0 });
  assert.ok(!walk.isWalkable(asFn, 0, 0));
  assert.ok(!walk.isWalkable(asFn, 0, 1));
  assert.ok(walk.isWalkable(asFn, 1, 0));
});

test('walking along a path is resolved by distance, not by frame', () => {
  // Movement has to come out the same whatever the frame rate, so the walk
  // is expressed in tiles travelled and resolved here.
  const path = [{ gx: 0, gy: 0 }, { gx: 1, gy: 0 }, { gx: 2, gy: 0 }];
  const half = walk.advanceAlongPath(path, 0, 0, 0.5);
  assert.equal(half.gx, 0.5);
  assert.equal(half.gy, 0);
  assert.equal(half.done, false);

  const oneAndAHalf = walk.advanceAlongPath(path, 0, 0, 1.5);
  assert.equal(oneAndAHalf.gx, 1.5);
  assert.equal(oneAndAHalf.index, 1);

  const past = walk.advanceAlongPath(path, 0, 0, 99);
  assert.deepEqual({ gx: past.gx, gy: past.gy }, { gx: 2, gy: 0 });
  assert.equal(past.done, true);

  // A diagonal leg is longer than a straight one, so the same distance gets
  // you less far along it.
  const diag = [{ gx: 0, gy: 0 }, { gx: 1, gy: 1 }];
  const onDiag = walk.advanceAlongPath(diag, 0, 0, 1);
  assert.ok(onDiag.gx < 1 && onDiag.gx > 0.7, 'a diagonal tile takes sqrt(2) of walking');
  assert.equal(onDiag.done, false);
});

test('paths are optimal, and prefer diagonals over dog-legs', () => {
  const grid = walk.buildGrid('garage', 1, { plan });
  // A clear 3x2 corner: the diagonal route is two steps, the dog-leg three.
  const path = walk.findPath(grid, { gx: 0, gy: 0 }, { gx: 2, gy: 1 });
  assert.ok(path);
  assert.equal(path.length, 3, 'expected two steps: one diagonal, one straight');
});
