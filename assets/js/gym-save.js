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
    const roomShapeFor = config.roomShapeFor;
    const maxRooms = config.maxRooms;
    const defaultTheme = config.defaultTheme || themeIds[0];
    const storage = config.storage;
    const key = config.key;
    const place = config.place || (typeof window !== 'undefined' && window.BoozebagGymPlace);

    function emptyRoom() {
      return { items: [] };
    }

    function defaultThemeRooms() {
      const byTheme = {};
      themeIds.forEach((id) => { byTheme[id] = [emptyRoom()]; });
      return byTheme;
    }

    // A machine's position is stored RELATIVE TO ITS OWN ROOM: {id, gx, gy}
    // where gx is tiles from the room's left corner. Absolute lattice
    // coordinates would have been simpler to draw, and wrong to store --
    // where a room sits on the lattice depends on the size of every room
    // before it in the chain, so retuning any room's footprint would move
    // every gym built after it. Room-relative survives that.
    function normalizedRoom(themeId, index, saved) {
      const shape = roomShapeFor(themeId, index);
      const room = { items: [] };

      if (saved && Array.isArray(saved.items)) {
        room.items = saved.items
          .filter((it) => it && typeof it.id === 'string'
            && Number.isFinite(it.gx) && Number.isFinite(it.gy))
          .map((it) => ({ id: it.id, gx: it.gx, gy: it.gy }));
      } else if (saved && Array.isArray(saved.layout)) {
        // Before machines had positions they had slots: one cell of a
        // cols*rows grid each. Each lands in the middle of the cell it used
        // to occupy, so nobody's gym is rearranged by the upgrade -- it just
        // becomes nudgeable.
        room.items = place
          ? place.fromLayout(saved.layout, shape.cols, 0, 0)
          : [];
      }

      // Anything that would now hang off the edge -- because a footprint
      // changed, or a save is older than the room shapes -- is pulled back
      // on. Better a machine that moved slightly than one standing in a wall.
      if (place) {
        room.items = room.items.map((it) => {
          const f = place.footprintOf(it.id);
          return {
            id: it.id,
            gx: Math.min(Math.max(it.gx, f.w / 2), Math.max(f.w / 2, shape.cols - f.w / 2)),
            gy: Math.min(Math.max(it.gy, f.h / 2), Math.max(f.h / 2, shape.rows - f.h / 2)),
          };
        });
      }
      return room;
    }

    function normalizedRoomChain(themeId, source) {
      const arr = Array.isArray(source) ? source : [];
      const rooms = arr.slice(0, maxRooms).map((r, i) => normalizedRoom(themeId, i, r));
      return rooms.length ? rooms : [emptyRoom()];
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
        byTheme[theme] = [normalizedRoom(theme, 0, { layout: saved.layout })];
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
      // every theme is empty but the player owns gear, lay the owned gear out
      // on the first room of the default theme so returning players don't
      // come back to a sudden $0/s. Laid out in rows with a tile of air
      // between machines, which is a tidy starting gym rather than a raft.
      const allEmpty = themeIds.every((id) => s.themeRooms[id].every((r) => !r.items.length));
      if (allEmpty) {
        const toPlace = [];
        itemIds.forEach((id) => {
          const count = s.owned[id] || 0;
          for (let i = 0; i < count; i++) toPlace.push(id);
        });
        const shape = roomShapeFor(defaultTheme, 0);
        const perRow = Math.max(1, Math.floor((shape.cols - 1) / 2));
        s.themeRooms[defaultTheme][0].items = toPlace
          .slice(0, perRow * Math.max(1, Math.floor((shape.rows - 1) / 2)))
          .map((id, i) => ({
            id,
            gx: 1 + (i % perRow) * 2,
            gy: 1 + Math.floor(i / perRow) * 2,
          }));
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
