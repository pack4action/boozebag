// Loading and migrating a save.
//
// Every assertion here is about somebody's existing progress. Three save
// shapes have shipped, all three still exist in real browsers, and a player
// whose gear moves rooms or vanishes will not file a bug -- they will just
// stop playing. This code had no tests at all until it was lifted out of the
// game's closure, which is the only reason it could not have them.
//
// The store is built with a fake localStorage so a save from any era can be
// handed to it directly.

const test = require('node:test');
const assert = require('node:assert');
const { loadSite } = require('./helpers/load-plan');

const site = loadSite(['gym-plan.js', 'gym-save.js']);
const plan = site.BoozebagGymPlan;

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
    slotCountFor: plan.slotCountFor,
    maxRooms: MAX_ROOMS,
    defaultTheme: 'garage',
    storage,
    key: 'gymTycoonSave',
  });
  return { store, storage };
}

function placedIn(state, themeId) {
  return (state.themeRooms[themeId] || []).map((r) => r.layout.filter(Boolean));
}

test('a browser with no save gets a fresh gym', () => {
  const { store } = makeStore();
  const s = store.load();
  assert.equal(s.balance, 0);
  assert.equal(s.lifetime, 0);
  assert.equal(s.activeTheme, 'garage');
  assert.equal(s.activeRoomIndex, 0);
  THEME_IDS.forEach((id) => {
    assert.equal(s.themeRooms[id].length, 1, `${id} starts with one room`);
    assert.equal(s.themeRooms[id][0].layout.length, plan.slotCountFor(id, 0));
    assert.ok(s.themeRooms[id][0].layout.every((x) => x === null));
  });
});

test('corrupt JSON in storage is a fresh gym, not a crash', () => {
  const storage = fakeStorage('{not json at all');
  const store = site.BoozebagGymSave.makeStore({
    themeIds: THEME_IDS, itemIds: ITEM_IDS, slotCountFor: plan.slotCountFor,
    maxRooms: MAX_ROOMS, defaultTheme: 'garage', storage, key: 'gymTycoonSave',
  });
  const s = store.load();
  assert.equal(s.balance, 0);
  assert.equal(s.themeRooms.garage.length, 1);
});

test('the current save shape round-trips with everything intact', () => {
  const saved = {
    balance: 1234.5,
    lifetime: 99999,
    owned: { dumbbell: 3, bench: 1 },
    themeRooms: {
      garage: [{ layout: ['dumbbell', null, 'bench'] }],
      basement: [{ layout: ['mat'] }],
      rooftop: [{ layout: [] }],
    },
    activeTheme: 'basement',
    activeRoomIndex: 0,
    lastSaved: 1,
  };
  const { store } = makeStore(saved);
  const s = store.load();
  assert.equal(s.balance, 1234.5);
  assert.equal(s.lifetime, 99999);
  assert.deepEqual(s.owned, { dumbbell: 3, bench: 1 });
  assert.equal(s.activeTheme, 'basement');
  assert.deepEqual(s.themeRooms.garage[0].layout.slice(0, 3), ['dumbbell', null, 'bench']);
  assert.deepEqual(placedIn(s, 'basement'), [['mat']]);
});

test('a short layout is padded to the room it now sits in, keeping slot order', () => {
  // Rooms used to be a flat 12 everywhere. Every footprint since holds at
  // least 12, so an old layout only ever gains slots -- it must never lose
  // gear off the end, and it must not shuffle.
  const twelve = ['dumbbell', 'mat', null, 'bench', null, null, 'rack', null, null, null, null, 'cable'];
  const { store } = makeStore({
    themeRooms: { garage: [{ layout: twelve.slice() }] },
    owned: {},
  });
  const s = store.load();
  const layout = s.themeRooms.garage[0].layout;
  assert.equal(layout.length, plan.slotCountFor('garage', 0));
  assert.ok(layout.length >= 12);
  twelve.forEach((id, i) => assert.equal(layout[i], id, `slot ${i} kept its contents`));
});

test('migration 1: the original single-layout save', () => {
  // The oldest shape: one top-level layout array and one theme name.
  const { store } = makeStore({
    balance: 500,
    lifetime: 2000,
    owned: { dumbbell: 2 },
    layout: ['dumbbell', 'dumbbell', null, 'mat'],
    theme: 'basement',
  });
  const s = store.load();
  assert.equal(s.activeTheme, 'basement', 'the saved theme is where the player was');
  assert.equal(s.activeRoomIndex, 0);
  assert.deepEqual(s.themeRooms.basement[0].layout.slice(0, 4), ['dumbbell', 'dumbbell', null, 'mat']);
  assert.equal(s.themeRooms.basement[0].layout.length, plan.slotCountFor('basement', 0));
  // The other themes come back empty rather than missing.
  assert.equal(s.themeRooms.garage.length, 1);
  assert.ok(s.themeRooms.garage[0].layout.every((x) => x === null));
  // The dead fields do not survive into the new save.
  assert.equal(s.layout, undefined);
  assert.equal(s.theme, undefined);
});

test('migration 2: room slots each holding a layout per theme', () => {
  // The middle shape: an array of room slots, each with a layouts map keyed
  // by theme. Each slot becomes one room in that theme's own chain, in the
  // same order, so nothing placed anywhere is lost.
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
  assert.deepEqual(placedIn(s, 'garage'), [['bench'], ['rack', 'rack']]);
  assert.deepEqual(placedIn(s, 'basement'), [['mat'], []]);
  assert.equal(s.activeTheme, 'garage');
  assert.equal(s.activeRoomIndex, 1, 'the player stays in the room they were in');
  assert.equal(s.rooms, undefined);
  assert.equal(s.activeRoom, undefined);
});

test('migration 2 also accepts a slot with a bare layout and no theme map', () => {
  const { store } = makeStore({ rooms: [{ layout: ['mat', 'mat'] }], activeRoom: 0 });
  const s = store.load();
  THEME_IDS.forEach((id) => {
    assert.deepEqual(placedIn(s, id)[0], ['mat', 'mat'], `${id} got the bare layout`);
  });
});

test('migration 3: gear owned but nowhere placed is put on the floor', () => {
  // From before placement mattered: everything was owned, nothing was
  // placed, and income came from ownership. Loading that as-is would show a
  // returning player a gym earning nothing.
  const { store } = makeStore({
    balance: 100,
    owned: { dumbbell: 2, bench: 1 },
    themeRooms: { garage: [{ layout: [] }] },
  });
  const s = store.load();
  const placed = s.themeRooms.garage[0].layout.filter(Boolean);
  assert.deepEqual(placed, ['dumbbell', 'dumbbell', 'bench'],
    'owned gear is laid out in shop order so the gym earns again');
});

test('a player who owns gear and has placed some is left alone', () => {
  // The auto-fill above must only fire when EVERY room of EVERY theme is
  // empty. Someone who deliberately packed a room away keeps that decision.
  const { store } = makeStore({
    owned: { dumbbell: 5 },
    themeRooms: {
      garage: [{ layout: [] }],
      basement: [{ layout: ['dumbbell'] }],
    },
  });
  const s = store.load();
  assert.deepEqual(placedIn(s, 'garage'), [[]], 'the empty room stays empty');
  assert.deepEqual(placedIn(s, 'basement'), [['dumbbell']]);
});

test('more rooms than the game allows are dropped, not kept', () => {
  const rooms = [];
  for (let i = 0; i < 9; i++) rooms.push({ layout: ['mat'] });
  const { store } = makeStore({ themeRooms: { garage: rooms }, owned: {} });
  const s = store.load();
  assert.equal(s.themeRooms.garage.length, MAX_ROOMS);
});

test('a theme or room the player is no longer in falls back safely', () => {
  const cases = [
    { activeTheme: 'atlantis', activeRoomIndex: 0 },
    { activeTheme: 'garage', activeRoomIndex: 7 },
    { activeTheme: 'garage', activeRoomIndex: -1 },
    { activeTheme: 'garage', activeRoomIndex: 'two' },
  ];
  cases.forEach((c) => {
    const { store } = makeStore(Object.assign({ owned: {}, themeRooms: { garage: [{ layout: [] }] } }, c));
    const s = store.load();
    assert.ok(THEME_IDS.includes(s.activeTheme), `${c.activeTheme} fell back to a real theme`);
    const chain = s.themeRooms[s.activeTheme];
    assert.ok(s.activeRoomIndex >= 0 && s.activeRoomIndex < chain.length,
      `${c.activeRoomIndex} fell back into the chain`);
  });
});

test('an unknown field in a save is carried, not dropped', () => {
  // Object.assign over the defaults is what gives new fields their default
  // for free, and it is also why anything hung on state persists forever.
  // Pinning it so the next person to add a field knows which they are getting.
  const { store } = makeStore({ owned: {}, somethingNew: 42 });
  const s = store.load();
  assert.equal(s.somethingNew, 42);
});

test('writing puts the state back where load found it', () => {
  const { store, storage } = makeStore({ balance: 7, owned: {} });
  const s = store.load();
  s.balance = 99;
  store.write(s);
  const raw = JSON.parse(storage.peek());
  assert.equal(raw.balance, 99);
  assert.ok(raw.lastSaved > 0, 'the save is dated as it is written');
  // And it loads back identically.
  assert.equal(store.load().balance, 99);
});

test('clearing storage returns the player to a fresh gym', () => {
  const { store, storage } = makeStore({ balance: 500, owned: { bench: 2 } });
  assert.ok(storage.peek());
  store.clear();
  assert.equal(storage.peek(), null);
  assert.equal(store.load().balance, 0);
});

test('every theme in the game gets a chain, whatever the save mentioned', () => {
  // A save written when there were fewer themes must not leave a theme
  // missing -- switching to it would read rooms off undefined.
  const { store } = makeStore({ owned: {}, themeRooms: { garage: [{ layout: [] }] } });
  const s = store.load();
  THEME_IDS.forEach((id) => {
    assert.ok(Array.isArray(s.themeRooms[id]), `${id} has a chain`);
    assert.ok(s.themeRooms[id].length >= 1, `${id} has at least one room`);
  });
});
