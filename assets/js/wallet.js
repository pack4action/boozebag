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
    localStorage.setItem(LINK_KEY, JSON.stringify({ wallet: name, secret: b58encode(kp.secretKey),
      dappKey: b58encode(kp.publicKey), at: Date.now() }));
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
    // The session token and the shared secret are what a later signMessage
    // over the same link has to carry, so they are kept with the address.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      wallet: pending.wallet,
      address: answer.public_key,
      linked: true,
      session: answer.session || null,
      shared: b58encode(shared),
      dappKey: pending.dappKey || null,
    }));
    told(answer.public_key);
    return answer.public_key;
  }

  // ---- Asking the wallet to sign something ----
  // An extension answers in the page. A wallet linked from a phone's own
  // browser answers the way it connected: out to the app and back, with
  // the note sealed to the same key pair the connection used. Either way
  // the answer is the signature, base58, the way Solana writes them.
  const SIGN_KEY = 'boozebagWalletSign';
  // Whether a signature can be asked for at all: an extension has to be
  // there and able to sign, and a linked wallet has to have kept its
  // session from the connection.
  function canSign() {
    const saved = getSaved();
    if (!saved) return false;
    if (saved.linked) return !!(saved.session && saved.shared && saved.dappKey);
    const provider = getProvider(saved.wallet);
    return !!(provider && provider.signMessage);
  }
  async function signMessage(text) {
    const saved = getSaved();
    if (!saved) throw new Error('No wallet connected');
    if (!saved.linked) {
      const provider = getProvider(saved.wallet);
      if (!provider || !provider.signMessage) throw new Error('This wallet cannot sign');
      const out = await provider.signMessage(new TextEncoder().encode(text), 'utf8');
      const sig = out && (out.signature || out);
      return b58encode(sig instanceof Uint8Array ? sig : new Uint8Array(sig));
    }
    // Out to the app. This leaves the page, so what is being signed is put
    // down first and picked up on the way back in.
    if (!saved.session || !saved.shared) throw new Error('Connect the wallet again');
    const nacl = await loadNacl();
    const shared = b58decode(saved.shared);
    const nonce = nacl.randomBytes(24);
    const payload = new TextEncoder().encode(JSON.stringify({
      session: saved.session,
      message: b58encode(new TextEncoder().encode(text)),
      display: 'utf8',
    }));
    const sealed = nacl.box.after(payload, nonce, shared);
    localStorage.setItem(SIGN_KEY, JSON.stringify({ wallet: saved.wallet, text, at: Date.now() }));
    const q = new URLSearchParams({
      dapp_encryption_public_key: saved.dappKey || '',
      nonce: b58encode(nonce),
      redirect_link: hereWithoutLinkParams().href,
      payload: b58encode(sealed),
    });
    location.href = (saved.wallet === 'phantom'
      ? 'https://phantom.app/ul/v1/signMessage'
      : 'https://solflare.com/ul/v1/signMessage') + '?' + q.toString();
    // The page is going away; nothing after this runs.
    return new Promise(() => {});
  }
  // Back from the app with a signature. Returns { text, signature } once,
  // or null when there is nothing to pick up.
  async function signBack() {
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(SIGN_KEY)); } catch (e) { pending = null; }
    if (!pending) return null;
    const p = new URL(location.href).searchParams;
    const nonce = p.get('nonce');
    const data = p.get('data');
    const errorCode = p.get('errorCode');
    if (!data && !errorCode) {
      if (Date.now() - (pending.at || 0) > 600000) localStorage.removeItem(SIGN_KEY);
      return null;
    }
    localStorage.removeItem(SIGN_KEY);
    history.replaceState(null, '', hereWithoutLinkParams().href);
    if (errorCode) throw new Error('The wallet did not sign it');
    const saved = getSaved();
    if (!saved || !saved.shared) throw new Error('Connect the wallet again');
    const nacl = await loadNacl();
    const opened = nacl.box.open.after(b58decode(data), b58decode(nonce), b58decode(saved.shared));
    if (!opened) throw new Error('The wallet\u2019s answer did not open');
    const answer = JSON.parse(new TextDecoder().decode(opened));
    if (!answer.signature) throw new Error('The wallet sent no signature');
    return { text: pending.text, signature: answer.signature };
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
    told(address);
    return address;
  }

  // Everything that wants to know when a wallet arrives hears about it
  // here, rather than each page watching the button itself.
  function told(address) {
    try {
      window.dispatchEvent(new CustomEvent('boozebag:wallet', { detail: { address } }));
    } catch (e) { /* an old browser simply does not get the nudge */ }
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

  window.BoozebagWallet = { connect, tryReconnect, disconnect, getSaved, short, attachUI,
    signMessage, signBack, canSign };

  // Pages with no game still have the button in the bar, so wire it up once
  // everything else has had its chance to claim it.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => attachUI());
  } else {
    setTimeout(() => attachUI(), 0);
  }
})();
