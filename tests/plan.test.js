// The floor plan itself: no browser, no canvas. Checks that every hallway
// in every theme's chain actually joins the two rooms it is meant to join.
//
// These are the invariants the renderer leans on. It draws a hallway's wall
// down one side and cuts its door into the far room's back wall, which only
// lands right if the hallway really does fill the gap and sit inside both
// rooms across its width -- so a fault here shows up on screen as a wall in
// mid-air or a door in the wrong place, which is exactly what went wrong
// the last two times the plans changed.

const test = require('node:test');
const assert = require('node:assert');
const { loadPlan } = require('./helpers/load-plan');

const plan = loadPlan();
const MAX_ROOMS = 4; // ROOM_UNLOCK_COSTS.length in gym-tycoon.js

function overlaps(r1, r2) {
  return r1.gx0 < r2.gx0 + r2.cols && r1.gx0 + r1.cols > r2.gx0
    && r1.gy0 < r2.gy0 + r2.rows && r1.gy0 + r1.rows > r2.gy0;
}
function contains(outer, inner, axis) {
  return axis === 'gx'
    ? inner.gy0 >= outer.gy0 && inner.gy0 + inner.rows <= outer.gy0 + outer.rows
    : inner.gx0 >= outer.gx0 && inner.gx0 + inner.cols <= outer.gx0 + outer.cols;
}

for (const theme of plan.themeIds()) {
  const cfg = plan.planFor(theme);

  test(`${theme}: every room shape holds at least the 12 starting slots`, () => {
    cfg.shapes.forEach((s, i) => {
      assert.ok(
        s.cols * s.rows >= 12,
        `room ${i} has ${s.cols * s.rows} slots; a save written before rooms `
        + 'varied in size would lose the gear past the end',
      );
    });
  });

  for (let count = 1; count <= MAX_ROOMS; count++) {
    const placements = plan.roomPlacements(theme, count);

    test(`${theme} x${count}: rooms match their shapes and never overlap`, () => {
      assert.equal(placements.length, count);
      placements.forEach((p, i) => {
        const shape = plan.roomShapeFor(theme, i);
        assert.equal(p.cols, shape.cols, `room ${i} cols`);
        assert.equal(p.rows, shape.rows, `room ${i} rows`);
        assert.equal(plan.slotCountFor(theme, i), shape.cols * shape.rows);
      });
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          assert.ok(!overlaps(placements[i], placements[j]), `room ${i} overlaps room ${j}`);
        }
      }
    });

    const corridors = plan.corridorsFor(theme, placements);

    test(`${theme} x${count}: one hallway per pair of rooms`, () => {
      assert.equal(corridors.length, Math.max(0, count - 1));
    });

    corridors.forEach((c, i) => {
      const a = placements[i];
      const b = placements[i + 1];
      const dir = plan.roomDirFor(theme, i);

      test(`${theme} x${count}: hallway ${i}->${i + 1} (${dir}) runs the right way`, () => {
        // The axis is recorded when the hallway is built, not inferred from
        // its rectangle -- inferring it as cols > rows silently broke every
        // hallway that was square (the garage's 2x2, the rooftop's 3x3).
        assert.equal(c.axis, dir === 'east' || dir === 'west' ? 'gx' : 'gy');
        const along = c.axis === 'gx' ? c.cols : c.rows;
        const across = c.axis === 'gx' ? c.rows : c.cols;
        assert.equal(along, cfg.corridorLen, 'length');
        assert.equal(across, cfg.corridorWidth, 'width');
      });

      test(`${theme} x${count}: hallway ${i}->${i + 1} (${dir}) fills the gap exactly`, () => {
        if (c.axis === 'gx') {
          const left = dir === 'east' ? a : b;
          const right = dir === 'east' ? b : a;
          assert.equal(c.gx0, left.gx0 + left.cols, 'starts at the left room’s east edge');
          assert.equal(c.gx0 + c.cols, right.gx0, 'ends at the right room’s west edge');
        } else {
          const top = dir === 'south' ? a : b;
          const bottom = dir === 'south' ? b : a;
          assert.equal(c.gy0, top.gy0 + top.rows, 'starts at the top room’s south edge');
          assert.equal(c.gy0 + c.rows, bottom.gy0, 'ends at the bottom room’s north edge');
        }
      });

      test(`${theme} x${count}: hallway ${i}->${i + 1} (${dir}) opens into both rooms`, () => {
        // Across its width the hallway has to sit inside both rooms, or one
        // end opens onto a room's blank wall instead of into the room.
        assert.ok(contains(a, c, c.axis), 'within room a');
        assert.ok(contains(b, c, c.axis), 'within room b');
      });

      test(`${theme} x${count}: hallway ${i}->${i + 1} (${dir}) covers no room's floor`, () => {
        placements.forEach((p, j) => {
          assert.ok(!overlaps(c, p), `hallway ${i} overlaps room ${j}`);
        });
      });

      test(`${theme} x${count}: hallway ${i}->${i + 1} (${dir}) doors into a back wall`, () => {
        // Rooms are walled along their north and west edges and cut away
        // along the south and east ones. So the door belongs on the room the
        // hallway reaches through a wall, and the other end comes out of the
        // near room's open front, where there is nothing to cut a door into.
        assert.notEqual(c.doorRoom, c.nearRoom);
        assert.ok(c.doorRoom === a || c.doorRoom === b);
        assert.ok(c.nearRoom === a || c.nearRoom === b);
        if (c.axis === 'gx') {
          assert.equal(c.doorWall, 'west');
          // The door room is the eastern one: its west edge is a back wall.
          assert.equal(c.doorRoom.gx0, c.gx0 + c.cols);
          // The near room is the western one: the hallway leaves through its
          // east edge, which is open front.
          assert.equal(c.nearRoom.gx0 + c.nearRoom.cols, c.gx0);
        } else {
          assert.equal(c.doorWall, 'north');
          assert.equal(c.doorRoom.gy0, c.gy0 + c.rows);
          assert.equal(c.nearRoom.gy0 + c.nearRoom.rows, c.gy0);
        }
      });

      test(`${theme} x${count}: hallway ${i}->${i + 1} (${dir}) wall meets the near room's`, () => {
        // The hallway's own wall runs along its back edge and has to start
        // at or behind the near room's back wall -- if it started in front
        // of it, the return stub that carries one wall into the other would
        // have to run backwards, and drawCorridorShell only draws it one way.
        const near = c.nearRoom;
        if (c.axis === 'gx') assert.ok(c.gy0 >= near.gy0);
        else assert.ok(c.gx0 >= near.gx0);
      });
    });
  }
}

test('a chain longer than the shapes list wraps round them', () => {
  // roomShapeFor indexes with a modulo, so a fifth room would reuse the
  // first shape rather than come back undefined. Nothing buys a fifth room
  // today; this pins the behaviour in case ROOM_UNLOCK_COSTS grows.
  const theme = plan.themeIds()[0];
  const shapes = plan.planFor(theme).shapes;
  assert.deepEqual(plan.roomShapeFor(theme, shapes.length), shapes[0]);
});
