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

  // Wires up the standard wallet-bar markup (#btn-connect, #wallet-picker,
  // #wallet-connected, #wallet-address, #btn-disconnect) that every game
  // page includes identically, so each game doesn't re-implement the same
  // toggle/outside-click/connect/disconnect plumbing.
  function attachUI({ onChange, onError }) {
    const btnConnect = document.getElementById('btn-connect');
    const walletPicker = document.getElementById('wallet-picker');
    const walletConnected = document.getElementById('wallet-connected');
    const walletAddress = document.getElementById('wallet-address');
    const btnDisconnect = document.getElementById('btn-disconnect');
    if (!btnConnect) return;

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
    btnDisconnect.addEventListener('click', () => {
      disconnect();
      setWalletUI(null);
    });
    tryReconnect().then((address) => {
      if (address) setWalletUI(address);
    });
  }

  window.BoozebagWallet = { connect, tryReconnect, disconnect, getSaved, short, attachUI };
})();
