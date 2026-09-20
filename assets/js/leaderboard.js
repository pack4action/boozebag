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
    // Who has taken themselves off this board, in this browser. Kept here
    // rather than on the server because it has to stop the game posting as
    // well: deleting the row alone would only last until the next score
    // went up. It also means a removal sent by somebody else undoes itself
    // the next time the owner plays.
    const offKey = 'bbLbOff:' + gameId;
    function offAddress() {
      try { return localStorage.getItem(offKey) || null; } catch (e) { return null; }
    }
    function isOff(address) {
      const off = offAddress();
      return !!off && !!address && off === address;
    }
    function setOff(address) {
      try {
        if (address) localStorage.setItem(offKey, address);
        else localStorage.removeItem(offKey);
      } catch (e) { /* nothing to come back to, but this session still works */ }
    }
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
      const off = offAddress();
      const list = off ? reply.board.filter((e) => e && e.address !== off) : reply.board;
      store(tidy(list));
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
      if (isOff(address)) return load();
      const out = writeLocal(address, score, meta, name);
      // Drawn from what is on this device straight away, so somebody sees
      // themselves move the moment they have earned it, and corrected when
      // the shared board answers.
      draw();
      pending = { address, score, meta, name: name || null };
      schedule();
      return out;
    }

    // The name, put up right now, from the button in the game. Answers
    // 'yours' when it went up, 'taken' when somebody else has it, 'slow'
    // when the board asked for a moment, and 'offline' when there is no
    // shared board or it did not answer.
    function claim(address, score, meta, name) {
      if (!API) return Promise.resolve('offline');
      if (isOff(address)) return Promise.resolve('off');
      return fetch(API + '/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: gameId, address, score, meta, name, claim: true }),
      }).then((r) => r.json().then((reply) => {
        if (r.status === 409) return 'taken';
        if (r.status === 429) return 'slow';
        if (!r.ok) return 'offline';
        writeLocal(address, score, meta, name);
        tookTheBoard(reply);
        return 'yours';
      })).catch(() => 'offline');
    }

    // Off the board: the row goes, the game stops posting, and the entry
    // goes from this browser's copy too. Answers 'gone' when the board
    // took it, 'offline' when there was nobody to tell -- and it is off
    // here either way, because the switch is what stops it coming back.
    function remove(address) {
      if (!address) return Promise.resolve('offline');
      setOff(address);
      pending = null;
      const list = load().filter((e) => e.address !== address);
      store(list);
      draw();
      if (!API) return Promise.resolve('offline');
      return fetch(API + '/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: gameId, address, remove: true }),
      }).then((r) => r.json().then((reply) => {
        if (r.status === 429) return 'slow';
        if (!r.ok) return 'offline';
        tookTheBoard(reply);
        return 'gone';
      })).catch(() => 'offline');
    }
    // And back on. Nothing is posted here: the next score the game hands
    // over goes up the way it always did.
    function rejoin() {
      setOff(null);
      draw();
      pull();
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
      drawLeave();
    }

    // ---- Taking yourself off, under the board ----
    // One line: a button that asks first. Nothing destructive happens on
    // a single press, the way the name in the game works.
    let leaveBox = null;
    function myAddress() {
      const saved = window.BoozebagWallet && window.BoozebagWallet.getSaved
        ? window.BoozebagWallet.getSaved() : null;
      return (saved && saved.address) || null;
    }
    function drawLeave() {
      if (!leaveBox) return;
      const me = myAddress();
      // Nothing to offer somebody who is not connected, or who is not on
      // the board and has not taken themselves off it.
      const onBoard = !!me && load().some((e) => e.address === me);
      const off = isOff(me);
      leaveBox.hidden = !me || (!onBoard && !off);
      if (leaveBox.hidden) return;
      leaveBox.dataset.state = off ? 'off' : 'on';
      if (leaveBox.dataset.asking === 'yes') return;
      leaveBox.innerHTML = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lb-leave-btn';
      btn.textContent = off ? 'Put me back on the board' : 'Remove me from the board';
      btn.addEventListener('click', () => {
        if (off) {
          rejoin();
          drawLeave();
          return;
        }
        ask();
      });
      leaveBox.appendChild(btn);
    }
    function ask() {
      leaveBox.dataset.asking = 'yes';
      leaveBox.innerHTML = '';
      const say = document.createElement('span');
      say.className = 'lb-leave-say';
      say.textContent = 'Take your score off the board?';
      const yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'lb-leave-btn is-go';
      yes.textContent = 'Confirm';
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'lb-leave-btn is-no';
      no.textContent = 'Cancel';
      no.addEventListener('click', () => {
        leaveBox.dataset.asking = '';
        drawLeave();
      });
      yes.addEventListener('click', () => {
        const me = myAddress();
        yes.disabled = true;
        yes.textContent = 'Removing…';
        remove(me).then((how) => {
          leaveBox.dataset.asking = '';
          if (how === 'slow') {
            // The board asked for a moment. It is off here regardless, and
            // the row goes on the next try.
            drawLeave();
            return;
          }
          drawLeave();
        });
      });
      leaveBox.append(say, yes, no);
    }

    function render(listEl, emptyEl, formatMeta, formatScore) {
      if (!listEl || !emptyEl) return;
      const first = !shown;
      shown = { listEl, emptyEl, formatMeta, formatScore };
      if (first) {
        // Only under a real board on a game page. The short list on the
        // front page is a window onto this one, not somewhere to manage
        // your own row.
        const panel = listEl.closest('.leaderboard');
        if (panel) {
          leaveBox = document.createElement('div');
          leaveBox.className = 'lb-leave';
          leaveBox.hidden = true;
          panel.appendChild(leaveBox);
        }
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

    return { load, upsert, claim, render, refresh: pull, remote: !!API,
      remove, rejoin, isOff, offAddress };
  }

  window.BoozebagLeaderboard = { makeLeaderboard, api: API };
})();
