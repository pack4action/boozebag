// The board each game posts to, shared across the minigame pages.
//
// There are two of them, really. On the real domain the scores live in one
// place and everybody sees the same board; anywhere else -- a preview
// build, a file opened off disk, somebody's own checkout -- there is
// nowhere to send them, so the same board is kept in the browser and says
// so. Nothing about a page changes between the two: a game hands over a
// score and asks for a list, and gets one either way.
(function () {
  // Where the scores live. Same origin as the page on the real site, so
  // there is no key in the markup and nothing to configure; a meta tag
  // overrides it for anybody pointing a local build at a deployed board.
  function apiBase() {
    const tag = document.querySelector('meta[name="boozebag-api"]');
    if (tag && tag.content) return tag.content.replace(/\/+$/, '');
    const host = location.hostname;
    if (host === 'boozebag.xyz' || host === 'www.boozebag.xyz'
      || /\.pages\.dev$/.test(host)) return '/api';
    return null;
  }
  const API = apiBase();

  // A wallet posts at most this often. The games call in whenever anything
  // happens, which for an idle game is constantly, and the board does not
  // need to hear about every coin.
  const POST_EVERY = 30000;
  // And the list is re-read about this often while a page is open.
  const PULL_EVERY = 60000;

  function makeLeaderboard(gameId, storageKey) {
    const key = storageKey || ('bbLb:' + gameId);
    let shown = null;
    let pending = null;
    let postedAt = 0;
    let postTimer = null;
    let pulledAt = 0;

    function load() {
      try {
        const list = JSON.parse(localStorage.getItem(key));
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }
    function store(list) {
      try {
        localStorage.setItem(key, JSON.stringify(list.slice(0, 25)));
      } catch (e) {
        // A browser with storage turned off still gets a working board for
        // as long as the page is open; there is just nothing to come back to.
      }
    }

    // The list as it stands, whoever last wrote it. Sorted and trimmed here
    // so a board built locally and one that came back from the server are
    // the same shape.
    function tidy(list) {
      const out = list.filter((e) => e && typeof e.address === 'string' && isFinite(e.score));
      out.sort((a, b) => b.score - a.score);
      return out.slice(0, 25);
    }

    function writeLocal(address, score, meta, name) {
      const list = load();
      const mine = list.find((e) => e.address === address);
      if (mine) {
        if (score > mine.score) {
          mine.score = score;
          mine.meta = meta;
        }
        if (name) mine.name = name;
      } else {
        list.push({ address, score, meta, name: name || null });
      }
      const out = tidy(list);
      store(out);
      return out;
    }

    function send(entry) {
      if (!API) return Promise.resolve(null);
      return fetch(API + '/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: gameId, address: entry.address, score: entry.score,
          meta: entry.meta, name: entry.name || undefined }),
        keepalive: true,
      }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    }

    function tookTheBoard(reply) {
      if (!reply || !Array.isArray(reply.board)) return false;
      store(tidy(reply.board));
      draw();
      return true;
    }

    // Posting is held back to one in POST_EVERY, and what is held is always
    // the latest thing handed over rather than the first -- a score that
    // has climbed twice while waiting goes up once, at its highest.
    function flush() {
      if (!pending || !API) return;
      const entry = pending;
      pending = null;
      postedAt = Date.now();
      send(entry).then(tookTheBoard);
    }
    function schedule() {
      if (postTimer || !API) return;
      const wait = Math.max(0, POST_EVERY - (Date.now() - postedAt));
      postTimer = setTimeout(() => {
        postTimer = null;
        flush();
      }, wait);
    }

    function upsert(address, score, meta, name) {
      if (!address || !isFinite(score)) return load();
      const out = writeLocal(address, score, meta, name);
      // Drawn from what is on this device straight away, so somebody sees
      // themselves move the moment they have earned it, and corrected when
      // the shared board answers.
      draw();
      pending = { address, score, meta, name: name || null };
      schedule();
      return out;
    }

    function pull() {
      if (!API) return;
      pulledAt = Date.now();
      fetch(API + '/scores?game=' + encodeURIComponent(gameId))
        .then((r) => (r.ok ? r.json() : null))
        .then(tookTheBoard)
        .catch(() => {});
    }

    function draw() {
      if (!shown) return;
      const list = load();
      const saved = window.BoozebagWallet && window.BoozebagWallet.getSaved
        ? window.BoozebagWallet.getSaved() : null;
      const me = saved && saved.address;
      shown.listEl.innerHTML = '';
      shown.emptyEl.hidden = list.length > 0;
      list.forEach((entry) => {
        const li = document.createElement('li');
        if (me && entry.address === me) li.className = 'is-you';
        const who = document.createElement('span');
        who.className = 'lb-addr';
        who.textContent = entry.name || (window.BoozebagWallet
          ? window.BoozebagWallet.short(entry.address) : entry.address);
        const meta = document.createElement('span');
        meta.className = 'lb-meta';
        meta.textContent = shown.formatMeta && entry.meta !== null && entry.meta !== undefined
          ? shown.formatMeta(entry.meta) : '';
        const score = document.createElement('span');
        score.className = 'lb-score';
        score.textContent = shown.formatScore ? shown.formatScore(entry.score)
          : String(entry.score);
        li.append(who, meta, score);
        shown.listEl.appendChild(li);
      });
    }

    function render(listEl, emptyEl, formatMeta, formatScore) {
      if (!listEl || !emptyEl) return;
      const first = !shown;
      shown = { listEl, emptyEl, formatMeta, formatScore };
      if (first) {
        // Say which board this is, once, where the heading already has room
        // for it -- "this browser" is a promise the real one does not make.
        const sub = document.querySelector('.leaderboard-sub');
        if (sub) sub.textContent = API ? 'everybody playing' : 'this browser only';
        if (API) {
          setInterval(() => {
            if (!document.hidden && Date.now() - pulledAt > PULL_EVERY) pull();
          }, 5000);
          // A score still waiting when the page goes away goes now: a tab
          // closed on a good run should still count.
          window.addEventListener('pagehide', flush);
          document.addEventListener('visibilitychange', () => {
            if (document.hidden) flush();
          });
          pull();
        }
      }
      draw();
    }

    return { load, upsert, render, refresh: pull, remote: !!API };
  }

  window.BoozebagLeaderboard = { makeLeaderboard, api: API };
})();
