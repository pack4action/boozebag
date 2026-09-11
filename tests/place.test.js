// Free placement: where a machine may stand, and what it covers.
//
// The rules here are the difference between a gym you arrange and a gym that
// arranges itself. They are also the rules that decide whether the floor is
// still walkable after you put something down, which is the failure nobody
// sees until an employee is stuck behind a treadmill.

const test = require('node:test');
const assert = require('node:assert');
const { loadSite } = require('./helpers/load-plan');

const site = loadSite(['gym-plan.js', 'gym-walk.js', 'gym-place.js']);
const plan = site.BoozebagGymPlan;
const walk = site.BoozebagGymWalk;
const place = site.BoozebagGymPlace;

const ROOM = plan.roomPlacements('garage', 1)[0];

function at(id, gx, gy) { return { id, gx, gy }; }

test('a position snaps to a sixteenth of a tile', () => {
  assert.equal(place.SNAP, 1 / 16);
  assert.equal(place.snap(0.5), 0.5);
  assert.equal(place.snap(0.51), 0.5);
  // 0.53125 is the midpoint between two steps; either side of it rounds the
  // way you would expect.
  assert.equal(place.snap(0.53), 0.5);
  assert.equal(place.snap(0.54), 0.5625);
  // Snapping is idempotent: nudging a snapped value never drifts.
  const once = place.snap(3.14159);
  assert.equal(place.snap(once), once);
});

test('an item covers a rectangle centred on its position', () => {
  const r = place.rectOf(at('dumbbell', 4, 3));
  assert.deepEqual(r, { x0: 3.5, y0: 2.5, x1: 4.5, y1: 3.5 });
  // A treadmill is deeper than it is wide, so it covers more of the y axis.
  const t = place.rectOf(at('treadmill', 4, 3));
  assert.equal(t.x1 - t.x0, 1);
  // Sixteenths are exact in binary; 1.6 is not, so compare with a tolerance
  // rather than pretending float subtraction lands on the nose.
  assert.ok(Math.abs((t.y1 - t.y0) - 1.6) < 1e-9);
});

test('a machine may not hang off the edge of the floor', () => {
  const inside = at('dumbbell', ROOM.gx0 + 0.5, ROOM.gy0 + 0.5);
  assert.equal(place.placementProblem([], inside, ROOM, -1), null);

  const overEdge = at('dumbbell', ROOM.gx0, ROOM.gy0 + 0.5);
  assert.equal(place.placementProblem([], overEdge, ROOM, -1), 'off the floor');

  const farOut = at('dumbbell', ROOM.gx0 + ROOM.cols + 5, ROOM.gy0 + 1);
  assert.equal(place.placementProblem([], farOut, ROOM, -1), 'off the floor');
});

test('two machines may not stand on top of each other', () => {
  const existing = [at('dumbbell', ROOM.gx0 + 2.5, ROOM.gy0 + 2.5)];
  const onTop = at('bench', ROOM.gx0 + 2.5, ROOM.gy0 + 2.5);
  assert.match(place.placementProblem(existing, onTop, ROOM, -1), /too close/);

  // Far enough away is fine.
  const clear = at('bench', ROOM.gx0 + 5.5, ROOM.gy0 + 2.5);
  assert.equal(place.placementProblem(existing, clear, ROOM, -1), null);
});

test('machines keep a little clearance, so they do not read as one lump', () => {
  const existing = [at('dumbbell', ROOM.gx0 + 2.5, ROOM.gy0 + 2.5)];
  // Exactly touching: the rectangles meet at x = gx0+3, which the clearance
  // rejects.
  const touching = at('dumbbell', ROOM.gx0 + 3.5, ROOM.gy0 + 2.5);
  assert.match(place.placementProblem(existing, touching, ROOM, -1), /too close/);

  const spaced = at('dumbbell', ROOM.gx0 + 3.5 + place.CLEARANCE * 2, ROOM.gy0 + 2.5);
  assert.equal(place.placementProblem(existing, spaced, ROOM, -1), null);
});

test('moving a machine does not collide with where it already stands', () => {
  const items = [at('dumbbell', ROOM.gx0 + 2.5, ROOM.gy0 + 2.5)];
  const nudged = place.nudge(items[0], 'gxPlus');
  // Without ignoring itself this would be "too close to the dumbbell".
  assert.equal(place.placementProblem(items, nudged, ROOM, 0), null);
  assert.match(place.placementProblem(items, nudged, ROOM, -1), /too close/);
});

test('an arrow press moves one step along a lattice axis', () => {
  const item = at('dumbbell', 4, 3);
  assert.deepEqual(place.nudge(item, 'gxPlus'), { id: 'dumbbell', gx: 4 + place.SNAP, gy: 3 });
  assert.deepEqual(place.nudge(item, 'gxMinus'), { id: 'dumbbell', gx: 4 - place.SNAP, gy: 3 });
  assert.deepEqual(place.nudge(item, 'gyPlus'), { id: 'dumbbell', gx: 4, gy: 3 + place.SNAP });
  assert.deepEqual(place.nudge(item, 'gyMinus'), { id: 'dumbbell', gx: 4, gy: 3 - place.SNAP });
  // Sixteen presses is exactly one tile, with no floating-point drift.
  let walked = item;
  for (let i = 0; i < 16; i++) walked = place.nudge(walked, 'gxPlus');
  assert.equal(walked.gx, 5);
});

test('an unknown direction leaves the machine where it is', () => {
  const item = at('dumbbell', 4, 3);
  assert.deepEqual(place.nudge(item, 'sideways'), { id: 'dumbbell', gx: 4, gy: 3 });
});

test('dropping a machine slightly inside another shuffles it clear', () => {
  const items = [at('dumbbell', ROOM.gx0 + 2.5, ROOM.gy0 + 2.5)];
  const overlapping = at('dumbbell', ROOM.gx0 + 2.9, ROOM.gy0 + 2.5);
  const fitted = place.nudgeToFit(items, overlapping, ROOM, -1);
  assert.ok(fitted, 'expected a nearby spot');
  assert.equal(place.placementProblem(items, fitted, ROOM, -1), null);
  // And it stayed near where it was dropped.
  assert.ok(Math.hypot(fitted.gx - overlapping.gx, fitted.gy - overlapping.gy) < 2);
});

test('a position that already works is left exactly where it is', () => {
  const fitted = place.nudgeToFit([], at('dumbbell', ROOM.gx0 + 2.5, ROOM.gy0 + 2.5), ROOM, -1);
  assert.deepEqual(fitted, { id: 'dumbbell', gx: ROOM.gx0 + 2.5, gy: ROOM.gy0 + 2.5 });
});

test('a machine blocks the tiles it stands on, and not the ones it grazes', () => {
  // Dead centre of one tile: that tile and nothing else.
  const blocked = place.blockedTiles([at('dumbbell', 4.5, 3.5)]);
  assert.deepEqual([...blocked], ['4,3']);

  // Nudged a sixteenth: it now overlaps the neighbour by 1/16 of a tile,
  // which must NOT wall it off.
  const grazing = place.blockedTiles([at('dumbbell', 4.5 + place.SNAP, 3.5)]);
  assert.deepEqual([...grazing], ['4,3']);

  // Straddling two tiles properly: both.
  const straddling = place.blockedTiles([at('dumbbell', 5, 3.5)]);
  assert.deepEqual([...straddling].sort(), ['4,3', '5,3']);
});

test('placing machines never silently seals the floor off', () => {
  // The whole point of blockedTiles: it feeds the pathfinder. A gym with a
  // few machines in it must still be walkable end to end.
  const items = [
    at('treadmill', ROOM.gx0 + 1.5, ROOM.gy0 + 1.5),
    at('bench', ROOM.gx0 + 3.5, ROOM.gy0 + 2.5),
    at('rack', ROOM.gx0 + 5.5, ROOM.gy0 + 1.5),
  ];
  const blocked = place.blockedTiles(items);
  const grid = walk.buildGrid('garage', 1, {
    plan,
    blocked: (gx, gy) => blocked.has(gx + ',' + gy),
  });
  const free = [];
  for (let gy = grid.gy0; gy < grid.gy0 + grid.rows; gy++) {
    for (let gx = grid.gx0; gx < grid.gx0 + grid.cols; gx++) {
      if (walk.isWalkable(grid, gx, gy)) free.push({ gx, gy });
    }
  }
  assert.ok(free.length > 10, 'most of the floor is still floor');
  const reached = walk.reachableFrom(grid, free[0]);
  assert.equal(reached.size, free.length,
    'every free tile is reachable from every other -- nothing is walled in');
});

test('the topmost machine under a point is the one you pick up', () => {
  const items = [
    at('dumbbell', 2.5, 2.5),
    at('bench', 6.5, 3.5),
  ];
  assert.equal(place.itemAt(items, 2.5, 2.5).id, 'dumbbell');
  assert.equal(place.itemAt(items, 6.5, 3.5).id, 'bench');
  assert.equal(place.itemAt(items, 4.5, 1.2), null, 'empty floor picks up nothing');
  // Just inside the edge of the footprint still counts.
  assert.equal(place.itemAt(items, 2.01, 2.5).id, 'dumbbell');
});

test('machines paint back to front', () => {
  const items = [at('a', 5, 5), at('b', 1, 1), at('c', 3, 2)];
  assert.deepEqual(place.backToFront(items).map((i) => i.id), ['b', 'c', 'a']);
  // And the original array is untouched.
  assert.deepEqual(items.map((i) => i.id), ['a', 'b', 'c']);
});

test('an old slot-based room converts without moving anybody’s gym', () => {
  // Every machine lands in the middle of the cell it used to occupy, so a
  // layout that was neat stays neat -- and can now be nudged off the grid.
  const layout = ['dumbbell', null, 'bench', null, 'mat', null];
  const items = place.fromLayout(layout, 3, 0, 0);
  assert.deepEqual(items, [
    { id: 'dumbbell', gx: 0.5, gy: 0.5 },
    { id: 'bench', gx: 2.5, gy: 0.5 },
    { id: 'mat', gx: 1.5, gy: 1.5 },
  ]);
});

test('conversion respects where the room actually sits on the lattice', () => {
  const items = place.fromLayout(['mat'], 4, 17, -3);
  assert.deepEqual(items, [{ id: 'mat', gx: 17.5, gy: -2.5 }]);
});

test('an empty or missing layout converts to nothing, not a crash', () => {
  assert.deepEqual(place.fromLayout([], 4, 0, 0), []);
  assert.deepEqual(place.fromLayout(null, 4, 0, 0), []);
  assert.deepEqual(place.fromLayout(['a'], 0, 0, 0), []);
});

test('everything a real room holds still fits in it', () => {
  // A sanity check on the footprints against the room sizes: if the biggest
  // item could not be placed in the smallest room, the numbers are wrong.
  const smallest = plan.themeIds()
    .map((t) => plan.roomPlacements(t, 1)[0])
    .sort((a, b) => (a.cols * a.rows) - (b.cols * b.rows))[0];
  Object.keys(place.FOOTPRINTS).forEach((id) => {
    const middle = at(id, smallest.gx0 + smallest.cols / 2, smallest.gy0 + smallest.rows / 2);
    assert.equal(place.placementProblem([], middle, smallest, -1), null,
      `${id} does not fit in the smallest room`);
  });
});
