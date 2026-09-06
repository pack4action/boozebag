// Tiny per-game local leaderboard, shared across minigame pages. Local
// storage only for now (see the wallet/leaderboard TODOs in each game's
// own JS) -- this just avoids duplicating the same 30 lines per game.
(function () {
  function makeLeaderboard(storageKey) {
    function load() {
      try {
        const list = JSON.parse(localStorage.getItem(storageKey));
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    }

    function upsert(address, score, meta) {
      const list = load();
      const existing = list.find((e) => e.address === address);
      if (existing) {
        if (score > existing.score) {
          existing.score = score;
          existing.meta = meta;
        }
      } else {
        list.push({ address, score, meta });
      }
      list.sort((a, b) => b.score - a.score);
      list.length = Math.min(list.length, 10);
      localStorage.setItem(storageKey, JSON.stringify(list));
      return list;
    }

    function render(listEl, emptyEl, formatMeta, formatScore) {
      const list = load();
      listEl.innerHTML = '';
      emptyEl.hidden = list.length > 0;
      list.forEach((entry) => {
        const li = document.createElement('li');
        const addr = document.createElement('span');
        addr.className = 'lb-addr';
        addr.textContent = window.BoozebagWallet ? window.BoozebagWallet.short(entry.address) : entry.address;
        const meta = document.createElement('span');
        meta.className = 'lb-meta';
        meta.textContent = formatMeta(entry.meta);
        const score = document.createElement('span');
        score.className = 'lb-score';
        score.textContent = formatScore ? formatScore(entry.score) : String(entry.score);
        li.append(addr, meta, score);
        listEl.appendChild(li);
      });
    }

    return { load, upsert, render };
  }

  window.BoozebagLeaderboard = { makeLeaderboard };
})();
