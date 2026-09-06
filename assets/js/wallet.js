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

  async function connect(name) {
    const provider = getProvider(name);
    if (!provider) {
      const url = name === 'phantom' ? 'https://phantom.app/' : 'https://solflare.com/';
      window.open(url, '_blank', 'noopener');
      throw new Error((name === 'phantom' ? 'Phantom' : 'Solflare') + ' isn’t installed');
    }
    const resp = await provider.connect();
    const address = resp.publicKey.toString();
    if (provider.signMessage) {
      const msg = new TextEncoder().encode('Sign in to Degen Pong\nWallet: ' + address);
      await provider.signMessage(msg, 'utf8');
    }
    save(name, address);
    return address;
  }

  async function tryReconnect() {
    const saved = getSaved();
    if (!saved) return null;
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

  window.BoozebagWallet = { connect, tryReconnect, disconnect, getSaved, short };
})();
