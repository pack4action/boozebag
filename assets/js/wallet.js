// Solana wallet sign-in (Phantom + Solflare). No transactions, no funds ever
// move -- this only requests a connection and a signed message to prove the
// visitor holds the wallet, then remembers the address locally.
(function () {
  const STORAGE_KEY = 'boozebagWallet';

  function short(address) {
    return address.slice(0, 4) + '…' + address.slice(-4);
  }

  function getProvider(name) {
    if (name === 'phantom') {
      const p = window.phantom && window.phantom.solana;
      if (p && p.isPhantom) return p;
      if (window.solana && window.solana.isPhantom) return window.solana;
      return null;
    }
    if (name === 'solflare') {
      return window.solflare && window.solflare.isSolflare ? window.solflare : null;
    }
    return null;
  }

  function getSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return null;
    }
  }

  function save(name, address) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallet: name, address }));
  }

  function clearSaved() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ---- Connecting from a phone's own browser ----
  // A phone's browser has no wallet in it, but the wallet apps answer a
  // link: the page sends the visitor to the app with a fresh public key,
  // the app asks them to approve, and sends them back to this page with
  // the wallet's address sealed to that key. The page opens it and is
  // connected, in the browser they started in. The sealing needs a small
  // library, fetched only on a phone and only when it is needed.
  const onPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  const LINK_KEY = 'boozebagWalletLink';
  const NACL_SRC = 'assets/js/vendor/nacl-fast.min.js';
  const ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58encode(bytes) {
    let n = 0n;
    for (const b of bytes) n = (n << 8n) | BigInt(b);
    let out = '';
    while (n > 0n) { out = ALPHA[Number(n % 58n)] + out; n /= 58n; }
    for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
    return out;
  }
  function b58decode(str) {
    let n = 0n;
    for (const c of str) {
      const i = ALPHA.indexOf(c);
      if (i < 0) throw new Error('not base58');
      n = n * 58n + BigInt(i);
    }
    const out = [];
    while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
    for (const c of str) { if (c === '1') out.unshift(0); else break; }
    return Uint8Array.from(out);
  }
  let naclLoading = null;
  function loadNacl() {
    if (window.nacl) return Promise.resolve(window.nacl);
    if (!naclLoading) {
      naclLoading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = NACL_SRC;
        s.onload = () => resolve(window.nacl);
        s.onerror = () => reject(new Error('Could not load the wallet link'));
        document.head.appendChild(s);
      });
    }
    return naclLoading;
  }
  const LINK_PARAMS = ['phantom_encryption_public_key', 'solflare_encryption_public_key', 'nonce', 'data', 'errorCode', 'errorMessage'];
  function hereWithoutLinkParams() {
    const u = new URL(location.href);
    LINK_PARAMS.forEach((k) => u.searchParams.delete(k));
    return u;
  }
  async function linkOut(name) {
    const nacl = await loadNacl();
    const kp = nacl.box.keyPair();
    localStorage.setItem(LINK_KEY, JSON.stringify({ wallet: name, secret: b58encode(kp.secretKey), at: Date.now() }));
    const q = new URLSearchParams({
      app_url: location.origin,
      dapp_encryption_public_key: b58encode(kp.publicKey),
      redirect_link: hereWithoutLinkParams().href,
      cluster: 'mainnet-beta',
    });
    location.href = (name === 'phantom' ? 'https://phantom.app/ul/v1/connect' : 'https://solflare.com/ul/v1/connect') + '?' + q.toString();
  }
  // Back from the app: the answer is in the address bar. Returns the
  // wallet's address, null when there is nothing to pick up, and throws
  // when the app said no.
  async function linkBack() {
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(LINK_KEY)); } catch (e) { pending = null; }
    if (!pending) return null;
    const p = new URL(location.href).searchParams;
    const theirKey = p.get(pending.wallet + '_encryption_public_key');
    const nonce = p.get('nonce');
    const data = p.get('data');
    const errorCode = p.get('errorCode');
    if (!theirKey && !errorCode) {
      // Nothing came back; a link older than ten minutes is forgotten.
      if (Date.now() - (pending.at || 0) > 600000) localStorage.removeItem(LINK_KEY);
      return null;
    }
    localStorage.removeItem(LINK_KEY);
    history.replaceState(null, '', hereWithoutLinkParams().href);
    if (errorCode) throw new Error((pending.wallet === 'phantom' ? 'Phantom' : 'Solflare') + ' said no');
    const nacl = await loadNacl();
    const shared = nacl.box.before(b58decode(theirKey), b58decode(pending.secret));
    const opened = nacl.box.open.after(b58decode(data), b58decode(nonce), shared);
    if (!opened) throw new Error('The wallet’s answer did not open');
    const answer = JSON.parse(new TextDecoder().decode(opened));
    if (!answer.public_key) throw new Error('The wallet sent no address');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallet: pending.wallet, address: answer.public_key, linked: true }));
    return answer.public_key;
  }

  async function connect(name) {
    const provider = getProvider(name);
    const label = name === 'phantom' ? 'Phantom' : 'Solflare';
    if (!provider) {
      if (onPhone) {
        await linkOut(name);
        throw new Error('Asking ' + label + '…');
      }
      const url = name === 'phantom' ? 'https://phantom.app/' : 'https://solflare.com/';
      window.open(url, '_blank', 'noopener');
      throw new Error(label + ' isn’t installed');
    }
    const resp = await provider.connect();
    const address = resp.publicKey.toString();
    if (provider.signMessage) {
      const msg = new TextEncoder().encode('Sign in to $BOOZEBAG\nWallet: ' + address);
      await provider.signMessage(msg, 'utf8');
    }
    save(name, address);
    return address;
  }

  async function tryReconnect() {
    const saved = getSaved();
    if (!saved) return null;
    // A wallet linked from the app stays connected until it is
    // disconnected here; there is no extension to ask again.
    if (saved.linked && saved.address) return saved.address;
    const provider = getProvider(saved.wallet);
    if (!provider) { clearSaved(); return null; }
    try {
      const resp = await provider.connect({ onlyIfTrusted: true });
      const address = resp.publicKey.toString();
      save(saved.wallet, address);
      return address;
    } catch (e) {
      clearSaved();
      return null;
    }
  }

  function disconnect() {
    const saved = getSaved();
    if (saved) {
      const provider = getProvider(saved.wallet);
      if (provider && provider.disconnect) {
        try { provider.disconnect(); } catch (e) {}
      }
    }
    clearSaved();
  }

  // Wires up the standard wallet-bar markup (#btn-connect, #wallet-picker,
  // #wallet-connected, #wallet-address, #btn-disconnect) that every game
  // page includes identically, so each game doesn't re-implement the same
  // toggle/outside-click/connect/disconnect plumbing.
  // Guarded because the wallet now lives in the site navigation, which is on
  // every page: a game page wires it up with its own callbacks, and the
  // fallback below wires up the pages that have no game.
  let attached = false;
  function attachUI({ onChange, onError } = {}) {
    if (attached) return;
    const btnConnect = document.getElementById('btn-connect');
    const walletPicker = document.getElementById('wallet-picker');
    const walletConnected = document.getElementById('wallet-connected');
    const walletAddress = document.getElementById('wallet-address');
    const btnDisconnect = document.getElementById('btn-disconnect');
    if (!btnConnect) return;
    attached = true;

    function setWalletUI(address) {
      if (address) {
        btnConnect.hidden = true;
        walletPicker.hidden = true;
        btnConnect.setAttribute('aria-expanded', 'false');
        walletConnected.hidden = false;
        walletAddress.textContent = short(address);
      } else {
        btnConnect.hidden = false;
        walletConnected.hidden = true;
      }
      if (onChange) onChange(address);
    }

    function setPickerOpen(open) {
      walletPicker.hidden = !open;
      btnConnect.setAttribute('aria-expanded', String(open));
    }

    btnConnect.addEventListener('click', (e) => {
      e.stopPropagation();
      setPickerOpen(walletPicker.hidden);
    });
    document.addEventListener('click', (e) => {
      if (!walletPicker.hidden && !walletPicker.contains(e.target) && e.target !== btnConnect) {
        setPickerOpen(false);
      }
    });
    walletPicker.querySelectorAll('button[data-wallet]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const address = await connect(btn.dataset.wallet);
          setWalletUI(address);
        } catch (e) {
          setPickerOpen(false);
          if (onError) onError(e.message || 'Connection failed');
        }
      });
    });
    btnDisconnect.addEventListener('click', (e) => {
      e.stopPropagation();
      disconnect();
      walletConnected.classList.remove('is-open');
      setWalletUI(null);
    });
    // Where the bar is too tight to show the word, a tap on the pill
    // brings Disconnect out, and a tap anywhere else puts it away.
    walletConnected.addEventListener('click', (e) => {
      e.stopPropagation();
      walletConnected.classList.toggle('is-open');
    });
    document.addEventListener('click', () => walletConnected.classList.remove('is-open'));
    linkBack().then((address) => address || tryReconnect()).then((address) => {
      if (address) setWalletUI(address);
    }).catch((e) => {
      if (onError) onError(e.message || 'Connection failed');
    });
  }

  window.BoozebagWallet = { connect, tryReconnect, disconnect, getSaved, short, attachUI };

  // Pages with no game still have the button in the bar, so wire it up once
  // everything else has had its chance to claim it.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => attachUI());
  } else {
    setTimeout(() => attachUI(), 0);
  }
})();
