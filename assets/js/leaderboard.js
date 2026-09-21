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

  // ---- Proving a score came from the wallet it names ----
  // Signing every score with the wallet itself would be a wallet prompt
  // every thirty seconds. Instead the browser makes a key of its own and
  // the wallet signs one short note handing that key the right to post
  // for a day. The key signs each score after that. One approval at the
  // door instead of one per drink.
  const GRANT_KEY = 'boozebagPostKey';
  const GRANT_HOURS = 24;
  const ALPHA58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58(bytes) {
    let n = 0n;
    for (const b of bytes) n = (n << 8n) | BigInt(b);
    let out = '';
    while (n > 0n) { out = ALPHA58[Number(n % 58n)] + out; n /= 58n; }
    for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
    return out;
  }
  function un58(str) {
    let n = 0n;
    for (const c of str) {
      const i = ALPHA58.indexOf(c);
      if (i < 0) throw new Error('not base58');
      n = n * 58n + BigInt(i);
    }
    const out = [];
    while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
    for (const c of str) { if (c === '1') out.unshift(0); else break; }
    return Uint8Array.from(out);
  }
  // The two notes, written exactly as the board writes them. A single
  // character out of place and the signature does not check out.
  const grantText = (address, key, until) => '$BOOZEBAG leaderboard\n'
    + 'wallet: ' + address + '\nkey: ' + key + '\nuntil: ' + until;
  const postText = (game, address, subject, ts) => '$BOOZEBAG score\n'
    + 'game: ' + game + '\nwallet: ' + address + '\nscore: ' + subject + '\nat: ' + ts;

  function savedGrant(address) {
    let g = null;
    try { g = JSON.parse(localStorage.getItem(GRANT_KEY)); } catch (e) { g = null; }
    if (!g || g.address !== address) return null;
    if (!g.until || g.until <= Math.floor(Date.now() / 1000) + 60) return null;
    return g;
  }
  // The note, made if there is not one. This is the only moment the wallet
  // is asked for anything, and on a phone it leaves the page and comes
  // back, so it is done when somebody connects rather than mid game.
  const PENDING_KEY = 'boozebagPostKeyAsking';
  function keep(where, value) {
    try { localStorage.setItem(where, JSON.stringify(value)); } catch (e) { /* this session only */ }
  }
  let asking = null;
  function grantFor(address) {
    const have = savedGrant(address);
    if (have) return Promise.resolve(have);
    if (asking) return asking;
    const W = window.BoozebagWallet;
    if (!W || !W.signMessage || !W.canSign || !W.canSign()) return Promise.resolve(null);
    asking = loadNacl().then((nacl) => {
      // A key the wallet went off to sign for, on a phone, before the
      // page was taken away. If the app has answered, finish it here.
      let waiting = null;
      try { waiting = JSON.parse(localStorage.getItem(PENDING_KEY)); } catch (e) { waiting = null; }
      const back = W.signBack ? W.signBack() : Promise.resolve(null);
      return back.then((answer) => {
        if (answer && waiting && waiting.address === address
          && answer.text === grantText(address, waiting.key, waiting.until)) {
          localStorage.removeItem(PENDING_KEY);
          const done = { address, key: waiting.key, secret: waiting.secret,
            until: waiting.until, grant: answer.signature };
          keep(GRANT_KEY, done);
          return done;
        }
        // Nothing waiting, so ask. On a phone this leaves the page and
        // comes back through the branch above.
        const kp = nacl.sign.keyPair();
        const key = b58(kp.publicKey);
        const until = Math.floor(Date.now() / 1000) + GRANT_HOURS * 3600;
        keep(PENDING_KEY, { address, key, secret: b58(kp.secretKey), until });
        return W.signMessage(grantText(address, key, until)).then((grant) => {
          localStorage.removeItem(PENDING_KEY);
          const done = { address, key, secret: b58(kp.secretKey), until, grant };
          keep(GRANT_KEY, done);
          return done;
        });
      });
    }).catch(() => null).then((g) => { asking = null; return g; });
    return asking;
  }

  // A wallet arriving is the moment to get the note signed: somebody who
  // has just approved a connection is expecting to be asked, where
  // somebody mid game is not.
  window.addEventListener('boozebag:wallet', (e) => {
    const address = e && e.detail && e.detail.address;
    if (address) grantFor(address);
  });
  // And on the way back from a phone's wallet app, where the answer to a
  // note asked for earlier is sitting in the address bar.
  window.addEventListener('load', () => {
    const W = window.BoozebagWallet;
    const saved = W && W.getSaved ? W.getSaved() : null;
    let waiting = null;
    try { waiting = JSON.parse(localStorage.getItem(PENDING_KEY)); } catch (e2) { waiting = null; }
    if (saved && saved.address && waiting) grantFor(saved.address);
  });
  // tweetnacl again, the same copy the wallet link uses.
  let naclWait = null;
  function loadNacl() {
    if (window.nacl) return Promise.resolve(window.nacl);
    if (!naclWait) {
      naclWait = new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = 'assets/js/vendor/nacl-fast.min.js';
        el.onload = () => resolve(window.nacl);
        el.onerror = () => reject(new Error('Could not load the signer'));
        document.head.appendChild(el);
      });
    }
    return naclWait;
  }
  // What goes on a post. Null when there is nothing to sign with, and the
  // board will say so rather than the score quietly going nowhere.
  function authFor(game, address, subject) {
    return grantFor(address).then((g) => {
      if (!g) return null;
      return loadNacl().then((nacl) => {
        const ts = Math.floor(Date.now() / 1000);
        const sig = nacl.sign.detached(
          new TextEncoder().encode(postText(game, address, subject, ts)),
          un58(g.secret),
        );
        return { key: g.key, until: g.until, grant: g.grant, ts, sig: b58(sig) };
      });
    }).catch(() => null);
  }

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
      return authFor(gameId, entry.address, entry.score).then((auth) => {
        if (!auth) { cannotSign(); return null; }
        saySigned();
        return fetch(API + '/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game: gameId, address: entry.address, score: entry.score,
            meta: entry.meta, name: entry.name || undefined, auth }),
          keepalive: true,
        }).then((r) => (r.ok ? r.json() : null));
      }).catch(() => null);
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
      return authFor(gameId, address, score).then((auth) => {
        if (!auth) { cannotSign(); return { unsigned: true }; }
        saySigned();
        return fetch(API + '/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: gameId, address, score, meta, name, claim: true, auth }),
      }).then((r) => r.json().then((reply) => {
        if (r.status === 409) return 'taken';
        if (r.status === 429) return 'slow';
        if (!r.ok) return 'offline';
        writeLocal(address, score, meta, name);
        tookTheBoard(reply);
        return 'yours';
      }));
      }).then((out) => (out && out.unsigned ? 'offline' : out)).catch(() => 'offline');
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
      return authFor(gameId, address, 'remove').then((auth) => {
        if (!auth) { cannotSign(); return 'offline'; }
        return fetch(API + '/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game: gameId, address, remove: true, auth }),
        }).then((r) => r.json().then((reply) => {
          if (r.status === 429) return 'slow';
          if (!r.ok) return 'offline';
          tookTheBoard(reply);
          return 'gone';
        }));
      }).catch(() => 'offline');
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

    // ---- When nothing can be signed ----
    // A score that cannot be signed is refused by the board, and saying
    // nothing about it is how a wallet linked before any of this existed
    // sat there looking connected and posting nothing for days.
    let noteEl = null;
    function note(text) {
      if (!shown) return;
      if (!noteEl) {
        const panel = shown.listEl.closest('.leaderboard') || shown.listEl.parentNode;
        if (!panel) return;
        noteEl = document.createElement('p');
        noteEl.className = 'lb-note';
        noteEl.hidden = true;
        panel.appendChild(noteEl);
      }
      noteEl.textContent = text || '';
      noteEl.hidden = !text;
    }
    function cannotSign() {
      const W = window.BoozebagWallet;
      const saved = W && W.getSaved ? W.getSaved() : null;
      note(saved
        ? 'Connect your wallet again to post scores. It was linked before the board started checking signatures.'
        : 'Connect a wallet to get on the board.');
    }
    function saySigned() { note(''); }

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
