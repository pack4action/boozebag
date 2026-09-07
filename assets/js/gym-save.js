// Loading, migrating and writing back a Gym Tycoon save.
//
// This is the most dangerous code in the game and it had no tests, for the
// same reason nothing else in gym-tycoon.js did: it lived inside a closure
// no test runner could reach. Everything it does is a decision about
// somebody's existing progress -- a save written months ago, by a version of
// the game that stored rooms differently, belonging to a player who will
// notice immediately if their gear moves or disappears. There are three
// historical save shapes in the wild and every one of them still has to
// load.
//
// So it lives here, as a factory taking the parts of the game it needs
// (which themes exist, which items exist, how many slots a room has at a
// given position) plus its storage, so a test can hand it a fake localStorage
// and a save from any era and check what comes out.
//
// A note on why there is no `version` field, since adding one is the first
// thing anybody suggests: every save that already exists in the wild has no
// version, so the three structural branches below have to stay regardless.
// A version field would be a fourth way of asking the same question.
(function () {
  function makeStore(config) {
    const themeIds = config.themeIds;
    const itemIds = config.itemIds || [];
    const slotCountFor = config.slotCountFor;
    const maxRooms = config.maxRooms;
    const defaultTheme = config.defaultTheme || themeIds[0];
    const storage = config.storage;
    const key = config.key;

    function emptyRoom(themeId, index) {
      return { layout: new Array(slotCountFor(themeId, index)).fill(null) };
    }

    function defaultThemeRooms() {
      const byTheme = {};
      themeIds.forEach((id) => { byTheme[id] = [emptyRoom(id, 0)]; });
      return byTheme;
    }

    // Resizes each saved room to the footprint its position now calls for.
    // Every footprint holds at least the 12 slots rooms used to have, so a
    // save written before rooms varied in size only ever gains slots, never
    // drops gear off the end.
    function normalizedRoomChain(themeId, source) {
      const arr = Array.isArray(source) ? source : [];
      const rooms = arr.slice(0, maxRooms).map((r, i) => {
        const old = Array.isArray(r && r.layout) ? r.layout : [];
        return { layout: new Array(slotCountFor(themeId, i)).fill(null).map((_, s) => old[s] || null) };
      });
      return rooms.length ? rooms : [emptyRoom(themeId, 0)];
    }

    function defaultState() {
      return {
        balance: 0,
        lifetime: 0,
        owned: {},
        themeRooms: defaultThemeRooms(),
        activeTheme: defaultTheme,
        activeRoomIndex: 0,
        lastSaved: Date.now(),
      };
    }

    // Turns whatever is in storage into a state object of the current shape.
    // `saved` can be passed directly instead of read from storage, which is
    // how the tests drive the migrations.
    function migrate(saved) {
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
        themeIds.forEach((id) => {
          byTheme[id] = normalizedRoomChain(id, saved.rooms.map((r) => ({
            layout: (r && r.layouts && r.layouts[id]) || (r && r.layout) || [],
          })));
        });
        s.themeRooms = byTheme;
        const oldActiveSlot = saved.rooms[saved.activeRoom];
        s.activeTheme = (oldActiveSlot && oldActiveSlot.theme) || defaultTheme;
        s.activeRoomIndex = Number.isInteger(saved.activeRoom) ? saved.activeRoom : 0;
      } else if (Array.isArray(saved.layout)) {
        // Migrate from the original single top-level layout/theme shape.
        const theme = saved.theme || defaultTheme;
        const byTheme = defaultThemeRooms();
        byTheme[theme] = [{
          layout: new Array(slotCountFor(theme, 0)).fill(null).map((_, i) => saved.layout[i] || null),
        }];
        s.themeRooms = byTheme;
        s.activeTheme = theme;
        s.activeRoomIndex = 0;
      } else {
        const byTheme = {};
        themeIds.forEach((id) => {
          byTheme[id] = normalizedRoomChain(id, saved.themeRooms && saved.themeRooms[id]);
        });
        s.themeRooms = byTheme;
      }

      if (!themeIds.some((id) => id === s.activeTheme)) s.activeTheme = defaultTheme;
      const activeChain = s.themeRooms[s.activeTheme] || [];
      s.activeRoomIndex = Number.isInteger(s.activeRoomIndex)
        && s.activeRoomIndex >= 0 && s.activeRoomIndex < activeChain.length
        ? s.activeRoomIndex
        : 0;

      // Migration for saves from before placement mattered: if every room in
      // every theme is empty but the player owns gear, auto-fill the first
      // room of the default theme so returning players don't come back to a
      // sudden $0/s.
      const allEmpty = themeIds.every((id) => s.themeRooms[id].every((r) => r.layout.every((x) => !x)));
      if (allEmpty) {
        const toPlace = [];
        itemIds.forEach((id) => {
          const count = s.owned[id] || 0;
          for (let i = 0; i < count; i++) toPlace.push(id);
        });
        const firstLayout = s.themeRooms[defaultTheme][0].layout;
        toPlace.slice(0, firstLayout.length).forEach((id, i) => { firstLayout[i] = id; });
      }

      // Nothing is credited for the time the tab was gone: gear earns while
      // you are watching it and not otherwise. lastSaved is still written --
      // it dates the save -- it just no longer buys anything.
      return s;
    }

    function read() {
      try {
        return JSON.parse(storage.getItem(key));
      } catch (e) {
        return null;
      }
    }

    function load() {
      return migrate(read());
    }

    function write(state) {
      state.lastSaved = Date.now();
      storage.setItem(key, JSON.stringify(state));
    }

    return {
      defaultState,
      defaultThemeRooms,
      emptyRoom,
      normalizedRoomChain,
      migrate,
      load,
      write,
      clear: () => storage.removeItem(key),
    };
  }

  window.BoozebagGymSave = { makeStore };
})();
