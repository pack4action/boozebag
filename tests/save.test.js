// Loading and migrating a save.
//
// Every assertion here is about somebody's existing progress. Four save
// shapes have now shipped -- a single layout, room slots with a layout per
// theme, a theme map of layouts, and the positioned rooms the game uses now
// -- and all four exist in real browsers. A player whose gym rearranges
// itself does not file a bug, they stop playing.
//
// The store is built with a fake localStorage so a save from any era can be
// handed to it directly.

const test = require('node:test');
const assert = require('node:assert');
const { loadSite } = require('./helpers/load-plan');

const site = loadSite(['gym-plan.js', 'gym-place.js', 'gym-save.js']);
const plan = site.BoozebagGymPlan;
const place = site.BoozebagGymPlace;

const THEME_IDS = plan.themeIds();
const ITEM_IDS = ['dumbbell', 'dumbbellrack', 'mat', 'bench', 'rack', 'cable', 'treadmill'];
const MAX_ROOMS = 4;

function fakeStorage(initial) {
  const cell = { value: initial === undefined ? null : initial };
  return {
    getItem: () => cell.value,
    setItem: (k, v) => { cell.value = v; },
    removeItem: () => { cell.value = null; },
    peek: () => cell.value,
  };
}

function makeStore(saved) {
  const storage = fakeStorage(saved === undefined ? null : JSON.stringify(saved));
  const store = site.BoozebagGymSave.makeStore({
    themeIds: THEME_IDS,
    itemIds: ITEM_IDS,
    roomShapeFor: plan.roomShapeFor,
    maxRooms: MAX_ROOMS,
    defaultTheme: 'garage',
    place,
    storage,
    key: 'gymTycoonSave',
  });
  return { store, storage };
}

function idsIn(state, themeId) {
  return (state.themeRooms[themeId] || []).map((r) => r.items.map((i) => i.id));
}

test('a browser with no save gets a fresh, empty gym', () => {
  const { store } = makeStore();
  const s = store.load();
  assert.equal(s.balance, 0);
  assert.equal(s.lifetime, 0);
  assert.equal(s.activeTheme, 'garage');
  assert.equal(s.activeRoomIndex, 0);
  THEME_IDS.forEach((id) => {
    assert.equal(s.themeRooms[id].length, 1, `${id} starts with one room`);
    assert.deepEqual(s.themeRooms[id][0].items, []);
  });
});

test('corrupt JSON in storage is a fresh gym, not a crash', () => {
  const storage = fakeStorage('{not json at all');
  const store = site.BoozebagGymSave.makeStore({
    themeIds: THEME_IDS, itemIds: ITEM_IDS, roomShapeFor: plan.roomShapeFor,
    maxRooms: MAX_ROOMS, defaultTheme: 'garage', place, storage, key: 'gymTycoonSave',
  });
  assert.equal(store.load().balance, 0);
});

test('positions round-trip exactly, including off-grid ones', () => {
  // The whole point of free placement: a machine at 3.5625 is at 3.5625
  // when the player comes back, not rounded to the nearest tile.
  const saved = {
    balance: 1234.5,
    lifetime: 99999,
    owned: { dumbbell: 3, bench: 1 },
    themeRooms: {
      garage: [{ items: [{ id: 'dumbbell', gx: 3.5625, gy: 2.1875 }, { id: 'bench', gx: 6, gy: 4 }] }],
      basement: [{ items: [{ id: 'mat', gx: 1.5, gy: 1.5 }] }],
      rooftop: [{ items: [] }],
    },
    activeTheme: 'basement',
    activeRoomIndex: 0,
    lastSaved: 1,
  };
  const { store } = makeStore(saved);
  const s = store.load();
  assert.equal(s.balance, 1234.5);
  assert.equal(s.activeTheme, 'basement');
  assert.deepEqual(s.themeRooms.garage[0].items, [
    { id: 'dumbbell', gx: 3.5625, gy: 2.1875 },
    { id: 'bench', gx: 6, gy: 4 },
  ]);
});

test('junk in the items list is dropped rather than loaded', () => {
  const { store } = makeStore({
    owned: {},
    themeRooms: {
      garage: [{
        items: [
          { id: 'mat', gx: 2, gy: 2 },
          null,
          { id: 'mat' },
          { gx: 1, gy: 1 },
          { id: 'mat', gx: 'over there', gy: 2 },
          { id: 'mat', gx: NaN, gy: 2 },
        ],
      }],
    },
  });
  const s = store.load();
  assert.deepEqual(s.themeRooms.garage[0].items, [{ id: 'mat', gx: 2, gy: 2 }]);
});

test('a machine that would hang off the floor is pulled back on', () => {
  const shape = plan.roomShapeFor('garage', 0);
  const { store } = makeStore({
    owned: {},
    themeRooms: { garage: [{ items: [{ id: 'mat', gx: 999, gy: -999 }] }] },
  });
  const item = store.load().themeRooms.garage[0].items[0];
  const f = place.footprintOf('mat');
  assert.ok(item.gx <= shape.cols - f.w / 2 && item.gx >= f.w / 2, 'pulled inside horizontally');
  assert.ok(item.gy <= shape.rows - f.h / 2 && item.gy >= f.h / 2, 'pulled inside vertically');
});

test('migration: a slot-based room becomes positions, without rearranging it', () => {
  // Machines land in the middle of the cell they used to occupy, so a gym
  // that was neat stays neat -- and every one of them can now be nudged.
  const { store } = makeStore({
    owned: { dumbbell: 2 },
    themeRooms: { garage: [{ layout: ['dumbbell', null, 'bench', null, 'mat'] }] },
  });
  const items = store.load().themeRooms.garage[0].items;
  const cols = plan.roomShapeFor('garage', 0).cols;
  assert.ok(cols > 4, 'this fixture assumes the row did not wrap');
  assert.deepEqual(items.map((i) => i.id), ['dumbbell', 'bench', 'mat']);
  // Column order is preserved exactly: one tile per slot, centred.
  assert.deepEqual(items.map((i) => i.gx), [0.5, 2.5, 4.5]);
  // The dumbbell is a tile square and stays in the middle of its cell. The
  // bench is a tile and a half DEEP, so a bench in the old top row would now
  // poke through the back wall -- it is pulled far enough in to stand
  // clear. Slots had no size; positions do, and this is where that shows.
  assert.equal(items[0].gy, 0.5);
  assert.equal(items[1].gy, place.footprintOf('bench').h / 2);
  assert.ok(items[1].gy > 0.5, 'the deeper machine was nudged off the wall');
});

test('migration 1: the original single-layout save', () => {
  const { store } = makeStore({
    balance: 500,
    lifetime: 2000,
    owned: { dumbbell: 2 },
    layout: ['dumbbell', 'dumbbell', null, 'mat'],
    theme: 'basement',
  });
  const s = store.load();
  assert.equal(s.activeTheme, 'basement', 'the saved theme is where the player was');
  assert.deepEqual(idsIn(s, 'basement'), [['dumbbell', 'dumbbell', 'mat']]);
  // The other themes come back empty rather than missing.
  assert.deepEqual(idsIn(s, 'garage'), [[]]);
  // The dead fields do not survive into the new save.
  assert.equal(s.layout, undefined);
  assert.equal(s.theme, undefined);
});

test('migration 2: room slots each holding a layout per theme', () => {
  const { store } = makeStore({
    balance: 10,
    owned: { bench: 2 },
    rooms: [
      { theme: 'garage', layouts: { garage: ['bench'], basement: ['mat'] } },
      { theme: 'garage', layouts: { garage: ['rack', 'rack'] } },
    ],
    activeRoom: 1,
  });
  const s = store.load();
  assert.equal(s.themeRooms.garage.length, 2, 'two slots became two garage rooms');
  assert.deepEqual(idsIn(s, 'garage'), [['bench'], ['rack', 'rack']]);
  assert.deepEqual(idsIn(s, 'basement'), [['mat'], []]);
  assert.equal(s.activeRoomIndex, 1, 'the player stays in the room they were in');
  assert.equal(s.rooms, undefined);
  assert.equal(s.activeRoom, undefined);
});

test('migration 2 also accepts a slot with a bare layout and no theme map', () => {
  const { store } = makeStore({ rooms: [{ layout: ['mat', 'mat'] }], activeRoom: 0 });
  const s = store.load();
  THEME_IDS.forEach((id) => {
    assert.deepEqual(idsIn(s, id)[0], ['mat', 'mat'], `${id} got the bare layout`);
  });
});

test('migration 3: gear owned but nowhere placed is laid out on the floor', () => {
  const { store } = makeStore({
    balance: 100,
    owned: { dumbbell: 2, bench: 1 },
    themeRooms: { garage: [{ items: [] }] },
  });
  const s = store.load();
  const items = s.themeRooms.garage[0].items;
  assert.deepEqual(items.map((i) => i.id), ['dumbbell', 'dumbbell', 'bench'],
    'owned gear is laid out in shop order so the gym earns again');
  // Laid out with air between machines, not stacked on one spot.
  const room = plan.roomPlacements('garage', 1)[0];
  const rect = { gx0: 0, gy0: 0, cols: room.cols, rows: room.rows };
  items.forEach((item, i) => {
    assert.equal(place.placementProblem(items, item, rect, i), null,
      `${item.id} was laid down somewhere legal`);
  });
});

test('a player who owns gear and has placed some is left alone', () => {
  const { store } = makeStore({
    owned: { dumbbell: 5 },
    themeRooms: {
      garage: [{ items: [] }],
      basement: [{ items: [{ id: 'dumbbell', gx: 2, gy: 2 }] }],
    },
  });
  const s = store.load();
  assert.deepEqual(idsIn(s, 'garage'), [[]], 'the empty room stays empty');
  assert.deepEqual(idsIn(s, 'basement'), [['dumbbell']]);
});

test('more rooms than the game allows are dropped, not kept', () => {
  const rooms = [];
  for (let i = 0; i < 9; i++) rooms.push({ items: [{ id: 'mat', gx: 2, gy: 2 }] });
  const { store } = makeStore({ themeRooms: { garage: rooms }, owned: {} });
  assert.equal(store.load().themeRooms.garage.length, MAX_ROOMS);
});

test('a theme or room the player is no longer in falls back safely', () => {
  const cases = [
    { activeTheme: 'atlantis', activeRoomIndex: 0 },
    { activeTheme: 'garage', activeRoomIndex: 7 },
    { activeTheme: 'garage', activeRoomIndex: -1 },
    { activeTheme: 'garage', activeRoomIndex: 'two' },
  ];
  cases.forEach((c) => {
    const { store } = makeStore(Object.assign({ owned: {}, themeRooms: { garage: [{ items: [] }] } }, c));
    const s = store.load();
    assert.ok(THEME_IDS.includes(s.activeTheme), `${c.activeTheme} fell back to a real theme`);
    const chain = s.themeRooms[s.activeTheme];
    assert.ok(s.activeRoomIndex >= 0 && s.activeRoomIndex < chain.length,
      `${c.activeRoomIndex} fell back into the chain`);
  });
});

test('an unknown field in a save is carried, not dropped', () => {
  const { store } = makeStore({ owned: {}, somethingNew: 42 });
  assert.equal(store.load().somethingNew, 42);
});

test('writing puts the state back where load found it', () => {
  const { store, storage } = makeStore({ balance: 7, owned: {} });
  const s = store.load();
  s.balance = 99;
  s.themeRooms.garage[0].items.push({ id: 'mat', gx: 1.25, gy: 3.75 });
  store.write(s);
  const raw = JSON.parse(storage.peek());
  assert.equal(raw.balance, 99);
  assert.deepEqual(raw.themeRooms.garage[0].items, [{ id: 'mat', gx: 1.25, gy: 3.75 }]);
  assert.ok(raw.lastSaved > 0, 'the save is dated as it is written');
  assert.deepEqual(store.load().themeRooms.garage[0].items, [{ id: 'mat', gx: 1.25, gy: 3.75 }]);
});

test('the save no longer carries the slot arrays it replaced', () => {
  const { store, storage } = makeStore({ owned: {}, themeRooms: { garage: [{ layout: ['mat'] }] } });
  const s = store.load();
  store.write(s);
  const raw = JSON.parse(storage.peek());
  assert.equal(raw.themeRooms.garage[0].layout, undefined,
    'a converted room is written back as positions only');
  // A mat is wider than a tile, so it too is pulled clear of the side wall.
  assert.deepEqual(raw.themeRooms.garage[0].items,
    [{ id: 'mat', gx: place.footprintOf('mat').w / 2, gy: 0.5 }]);
});

test('clearing storage returns the player to a fresh gym', () => {
  const { store, storage } = makeStore({ balance: 500, owned: { bench: 2 } });
  store.clear();
  assert.equal(storage.peek(), null);
  assert.equal(store.load().balance, 0);
});

test('every theme in the game gets a chain, whatever the save mentioned', () => {
  const { store } = makeStore({ owned: {}, themeRooms: { garage: [{ items: [] }] } });
  const s = store.load();
  THEME_IDS.forEach((id) => {
    assert.ok(Array.isArray(s.themeRooms[id]) && s.themeRooms[id].length >= 1, `${id} has a chain`);
  });
});
