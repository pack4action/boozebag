// The front page's own behaviour: the menu, copying the address, the
// numbers that count up, and the handful of things that make the page
// answer when it is touched. Everything here is a nice-to-have on top of a
// page that reads fine without it, so the first thing it does is say it is
// here, and the styles that hide anything only apply once it has.
document.documentElement.classList.add('js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

// ---- The menu on a phone ----
// A sheet under the bar with a dim over the page, which does not scroll
// while it is open. The buy button the bar has no room for on a phone is
// copied into the bottom of the list. The dim, the cross, Escape and any
// link all close it.
if (navToggle && navLinks) {
  const shade = document.createElement('div');
  shade.className = 'nav-shade';
  shade.setAttribute('aria-hidden', 'true');
  document.body.appendChild(shade);
  navToggle.setAttribute('aria-controls', 'nav-links');
  const cta = document.querySelector('.nav-cta');
  if (cta && !navLinks.querySelector('.nav-menu-buy')) {
    const buy = cta.cloneNode(true);
    buy.classList.remove('nav-cta');
    buy.classList.add('nav-menu-buy');
    navLinks.appendChild(buy);
  }
  const setOpen = (open) => {
    navLinks.classList.toggle('open', open);
    shade.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  navToggle.addEventListener('click', () => setOpen(!navLinks.classList.contains('open')));
  shade.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks.classList.contains('open')) { setOpen(false); navToggle.focus(); }
  });
  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });
  // Widened past the point where the bar shows the links itself, the
  // sheet has no business being open.
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1040 && navLinks.classList.contains('open')) setOpen(false);
  });
}

// ---- Copying the address ----
// The one thing most people come here to do. The whole box takes the tap,
// not only the little button, and a phone gives a tick under the thumb.
const copyBtn = document.getElementById('ca-copy');
const caValue = document.getElementById('ca-value');
const caBox = copyBtn && copyBtn.closest('.ca-box');

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
}
function buzz(ms) {
  if (reduceMotion) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* fine */ }
}

// A few bubbles of beer, popped off the button and gone in under a
// second. Each gets its own direction, size and colour.
function popBubbles(from) {
  if (reduceMotion || !caBox) return;
  const box = caBox.getBoundingClientRect();
  const at = from.getBoundingClientRect();
  const x = at.left + at.width / 2 - box.left;
  const y = at.top + at.height / 2 - box.top;
  for (let i = 0; i < 12; i++) {
    const b = document.createElement('span');
    b.className = 'ca-bub';
    const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.6;
    const reach = 46 + Math.random() * 44;
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    b.style.setProperty('--dx', (Math.cos(angle) * reach).toFixed(1) + 'px');
    b.style.setProperty('--dy', (Math.sin(angle) * reach - 14).toFixed(1) + 'px');
    b.style.setProperty('--s', (5 + Math.random() * 7).toFixed(1) + 'px');
    b.style.setProperty('--c', i % 3 === 0 ? '#fff3d2' : i % 3 === 1 ? 'var(--amber)' : 'var(--green)');
    caBox.appendChild(b);
    b.addEventListener('animationend', () => b.remove());
  }
}

if (copyBtn && caValue) {
  let stampTimer = 0;
  const copyAddress = async () => {
    const done = await copyText(caValue.textContent.trim());
    if (!done) {
      copyBtn.textContent = 'Follow @BoozebagFitness';
      return;
    }
    buzz(14);
    copyBtn.innerHTML = '<svg class="ca-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Copied';
    copyBtn.classList.add('is-done');
    if (caBox) {
      // Restarted from the top when pressed again mid-effect.
      caBox.classList.remove('is-copied');
      void caBox.offsetWidth;
      caBox.classList.add('is-copied');
    }
    popBubbles(copyBtn);
    clearTimeout(stampTimer);
    stampTimer = setTimeout(() => {
      copyBtn.textContent = 'Copy';
      copyBtn.classList.remove('is-done');
      if (caBox) caBox.classList.remove('is-copied');
    }, 1700);
  };
  copyBtn.addEventListener('click', (e) => { e.stopPropagation(); copyAddress(); });
  if (caBox) {
    caBox.setAttribute('tabindex', '0');
    caBox.setAttribute('role', 'button');
    caBox.setAttribute('aria-label', 'Copy the contract address');
    caBox.addEventListener('click', (e) => {
      // A drag across the address to select it by hand is not a tap.
      if (String(window.getSelection && window.getSelection())) return;
      copyAddress();
    });
    caBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyAddress(); }
    });
  }
}
// And the one in the how-to-buy steps.
document.querySelectorAll('.copy-code').forEach((code) => {
  code.setAttribute('title', 'Tap to copy');
  code.addEventListener('click', async () => {
    if (!(await copyText(code.textContent.trim()))) return;
    buzz(10);
    code.classList.add('is-copied');
    setTimeout(() => code.classList.remove('is-copied'), 1200);
  });
});

// ---- The numbers ----
const statEls = document.querySelectorAll('.stat-num[data-target]');

function animateCount(el) {
  const target = el.dataset.target;
  const match = target.match(/^([\d.]+)([KM])?(\+)?$/);
  if (!match) { el.textContent = target; return; }
  const value = parseFloat(match[1]);
  const suffix = (match[2] || '') + (match[3] || '');
  const decimals = match[1].includes('.') ? 1 : 0;
  if (reduceMotion) { el.textContent = value.toFixed(decimals) + suffix; return; }
  const duration = 900;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (value * eased).toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = value.toFixed(decimals) + suffix;
  }
  requestAnimationFrame(tick);
}

if (statEls.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        if (!reduceMotion) {
          entry.target.closest('.stat')?.classList.add('pop');
        }
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  statEls.forEach((el) => io.observe(el));
}

// ---- A line of marker under each title ----
// Drawn the first time the title is reached. The same stroke every time,
// squashed to the width of whatever word it is under.
const titles = document.querySelectorAll('.section-title');
if (titles.length) {
  titles.forEach((title) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'title-stroke');
    svg.setAttribute('viewBox', '0 0 400 14');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M4 9 C 60 2, 130 12, 210 6 S 340 3, 396 9');
    path.setAttribute('pathLength', '1');
    svg.appendChild(path);
    title.appendChild(svg);
  });
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      seen.unobserve(entry.target);
    });
  }, { threshold: 0.6 });
  titles.forEach((t) => seen.observe(t));
}

// ---- The roadmap stops, the ledger rows and the stamp, one at a time ----
const stops = document.querySelectorAll('.road-item, .ledger-row, .proof-stamp, .supply');
if (stops.length) {
  let pending = 0;
  const arrive = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      // The ones that come into view together arrive a beat apart.
      const wait = reduceMotion ? 0 : pending * 90;
      pending += 1;
      setTimeout(() => { entry.target.classList.add('in'); pending = Math.max(0, pending - 1); }, wait);
      arrive.unobserve(entry.target);
    });
  }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });
  stops.forEach((s) => arrive.observe(s));
  // Whatever happens, nothing stays hidden.
  setTimeout(() => stops.forEach((s) => s.classList.add('in')), 2500);
}

// ---- Where you are ----
// The bar lights the link for the part of the page on screen, and grows a
// shadow once the page is under it. The props in the hero drift a little
// as you scroll, each at its own speed.
const nav = document.querySelector('.nav');
const hero = document.querySelector('.hero');
const sectionLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
const sections = sectionLinks
  .map((a) => document.getElementById(a.getAttribute('href').slice(1)))
  .filter(Boolean);
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = window.scrollY || 0;
    if (nav) nav.classList.toggle('is-scrolled', y > 8);
    if (hero && !reduceMotion) hero.style.setProperty('--py', Math.min(y, 900) + 'px');
    if (sections.length) {
      const line = y + window.innerHeight * 0.35;
      let here = null;
      for (const s of sections) if (s.offsetTop <= line) here = s;
      sectionLinks.forEach((a) => {
        a.classList.toggle('is-here', !!here && a.getAttribute('href') === '#' + here.id);
      });
    }
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();


// ---- Today's regimen ----
// One drink an hour, every hour, on whoever is looking's own clock. The
// number is the hour plus one: the day's first goes down at midnight and
// the twenty-fourth at eleven, and the strip says which one is next.
const regimenCans = document.getElementById('regimen-cans');
const regimenLine = document.getElementById('regimen-line');
const regimenMood = document.getElementById('regimen-mood');
const crackBtn = document.getElementById('btn-crack');
const regimenSay = document.getElementById('regimen-say');

function moodAt(hour) {
  if (hour < 5) return 'blackout gains';
  if (hour < 9) return 'hungover, still up';
  if (hour < 12) return 'first ones down';
  if (hour < 16) return 'warming up';
  if (hour < 21) return 'peak form';
  return 'degen mode';
}
function twoDigits(n) { return (n < 10 ? '0' : '') + n; }

if (regimenCans && regimenLine) {
  const cans = [];
  for (let i = 0; i < 24; i++) {
    const can = document.createElement('span');
    can.className = 'regimen-can';
    can.innerHTML = '<svg class="icon"><use href="#i-beer"></use></svg>';
    regimenCans.appendChild(can);
    cans.push(can);
  }
  let shownDown = -1;
  const tick = () => {
    const now = new Date();
    const hour = now.getHours();
    const down = hour + 1;
    if (down !== shownDown) {
      shownDown = down;
      cans.forEach((can, i) => {
        can.classList.toggle('is-down', i < down);
        can.classList.toggle('is-next', i === down);
      });
      const next = down < 24 ? twoDigits(down) + ':00' : 'midnight, when it starts again';
      regimenLine.innerHTML = 'One an hour, every hour. Drink <b>' + down + ' of 24</b> is down. '
        + (down < 24 ? 'Next one at <b>' + next + '</b>.' : 'That\'s the day. Next one at <b>midnight</b>.');
      if (regimenMood) regimenMood.textContent = moodAt(hour);
    }
  };
  tick();
  setInterval(tick, 20000);
}

// ---- Cracking one ----
// A tap on the button: a can on the strip jumps, foam goes up off the
// button, he says something, and the sound of it if sound is on. The
// same switch the games use, so somebody who turned them off stays in
// quiet.
let cracks = null;
const CRACK_LINES = [
  'That\'s breakfast.',
  'Hydration.',
  'This counts as cardio.',
  'Sober Steve could never.',
  'One more never hurt. Historically.',
  'Rest day. Wrist day.',
  'The regimen doesn\'t drink itself.',
  'Protein. Liquid protein.',
  'Nobody sells. Everybody drinks.',
  'Arms every day. Curls count.',
  'Stage ready. Bar ready.',
  'Chart\'s red. Beer\'s cold.',
];
let lastLine = -1;
function crackLine() {
  let i = Math.floor(Math.random() * CRACK_LINES.length);
  if (i === lastLine) i = (i + 1) % CRACK_LINES.length;
  lastLine = i;
  return CRACK_LINES[i];
}
let audio = null;
function crackSound() {
  try { if (localStorage.getItem('boozebagGameSound') === 'off') return; } catch (e) { /* fine */ }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    if (!audio) audio = new AC();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime;
    // The crack: a burst of noise, sharp at the front, through a high pass,
    // trailing off into the hiss.
    const len = Math.floor(audio.sampleRate * 0.42);
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i / len;
      d[i] = (Math.random() * 2 - 1) * (p < 0.025 ? 1 : Math.pow(1 - p, 2.4) * 0.3);
    }
    const src = audio.createBufferSource();
    src.buffer = buf;
    const hp = audio.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1600;
    const g = audio.createGain();
    g.gain.value = 0.45;
    src.connect(hp);
    hp.connect(g);
    g.connect(audio.destination);
    src.start(t);
    // And the pop under it.
    const osc = audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.09);
    const og = audio.createGain();
    og.gain.setValueAtTime(0.3, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc.connect(og);
    og.connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  } catch (e) { /* no sound is fine */ }
}
function foam(fromEl) {
  if (reduceMotion) return;
  const r = fromEl.getBoundingClientRect();
  const cx = r.left + r.width * (0.35 + Math.random() * 0.3);
  const cy = r.top + 4;
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('span');
    b.className = 'foam';
    const size = 4 + Math.random() * 10;
    b.style.width = size + 'px';
    b.style.height = size + 'px';
    b.style.left = cx + 'px';
    b.style.top = cy + 'px';
    b.style.background = Math.random() < 0.65 ? '#fff6dc' : '#ffb703';
    document.body.appendChild(b);
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    const v = 70 + Math.random() * 150;
    const dx = Math.cos(ang) * v;
    const dy = Math.sin(ang) * v;
    b.animate([
      { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 1 },
      { transform: 'translate(calc(-50% + ' + dx.toFixed(0) + 'px), calc(-50% + ' + (dy * 0.55).toFixed(0) + 'px)) scale(1.1)', opacity: 1, offset: 0.35 },
      { transform: 'translate(calc(-50% + ' + (dx * 1.2).toFixed(0) + 'px), calc(-50% + ' + (dy * 0.2 + 140).toFixed(0) + 'px)) scale(0.5)', opacity: 0 },
    ], { duration: 650 + Math.random() * 450, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' }).onfinish = () => b.remove();
  }
}
if (crackBtn) {
  const dayKey = () => 'boozebagCracks:' + new Date().toDateString();
  const tallyEl = document.createElement('span');
  tallyEl.className = 'regimen-tally';
  tallyEl.hidden = true;
  crackBtn.parentNode.appendChild(tallyEl);
  const showTally = () => {
    if (cracks === null) {
      try { cracks = parseInt(localStorage.getItem(dayKey()), 10) || 0; } catch (e) { cracks = 0; }
    }
    if (cracks <= 0) return;
    tallyEl.hidden = false;
    tallyEl.textContent = cracks === 1 ? 'You\'ve had one with him today.'
      : 'You\'ve had ' + cracks + ' with him today.' + (cracks >= 24 ? ' That\'s the full regimen. Respect.' : '');
  };
  showTally();
  let sayTimer = 0;
  crackBtn.addEventListener('click', () => {
    cracks = (cracks || 0) + 1;
    try { localStorage.setItem(dayKey(), String(cracks)); } catch (e) { /* fine */ }
    crackSound();
    buzz(18);
    foam(crackBtn);
    if (regimenCans) {
      const lit = regimenCans.querySelectorAll('.regimen-can.is-down');
      const can = lit[Math.floor(Math.random() * lit.length)] || regimenCans.firstChild;
      if (can) {
        can.classList.remove('is-wobble');
        void can.offsetWidth;
        can.classList.add('is-wobble');
      }
    }
    if (regimenSay) {
      regimenSay.textContent = crackLine();
      regimenSay.classList.remove('is-in');
      void regimenSay.offsetWidth;
      regimenSay.classList.add('is-in');
      clearTimeout(sayTimer);
      sayTimer = setTimeout(() => { regimenSay.textContent = ''; }, 4200);
    }
    showTally();
  });
}

// ---- Top bags ----
// The richest gyms off the shared board, on the front page: the same
// list the game shows, cut to five by the stylesheet. Drawn once every
// script on the page is in, since the rows use the wallet's short form
// of an address.
function shortNum(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return (v / 1e9).toFixed(v >= 1e10 ? 0 : 1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + 'K';
  return String(Math.round(v));
}
const topbagsList = document.getElementById('topbags-list');
const topbagsEmpty = document.getElementById('topbags-empty');
if (topbagsList && topbagsEmpty) {
  const drawBoard = () => {
    if (!window.BoozebagLeaderboard) return;
    const board = window.BoozebagLeaderboard.makeLeaderboard('gym-tycoon', 'gymTycoonLeaderboard');
    board.render(topbagsList, topbagsEmpty, (rate) => shortNum(rate) + '/s', (score) => '$' + shortNum(score));
  };
  if (document.readyState === 'complete') drawBoard();
  else window.addEventListener('load', drawBoard);
}


// ---- The market, live ----
// DexScreener's token endpoint needs no key and answers from a browser.
// The pair with the most liquidity is the one that matters; the tiles
// stay hidden until it has answered, and if it never does the page is as
// it was.
const CA = '3kxChnv5tabrhuuNUyMLPNYAF4XXodRFfDAmKjvcpump';
const marketEl = document.getElementById('market');
function money(n) {
  const v = Number(n);
  if (!isFinite(v)) return '';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(0);
}
function price(n) {
  const v = Number(n);
  if (!isFinite(v)) return '';
  if (v >= 1) return '$' + v.toFixed(2);
  if (v >= 0.01) return '$' + v.toFixed(4);
  // A memecoin price is mostly zeros: show the first few figures that are
  // not, the way the charts do.
  const s = v.toFixed(12);
  const m = s.match(/^0\.(0*)(\d{1,4})/);
  return m ? '$0.' + m[1] + m[2] : '$' + v.toPrecision(3);
}
function setFresh(el, text) {
  if (!el || el.textContent === text) return;
  el.textContent = text;
  el.classList.remove('is-fresh');
  void el.offsetWidth;
  el.classList.add('is-fresh');
}
if (marketEl) {
  const pull = () => {
    fetch('https://api.dexscreener.com/latest/dex/tokens/' + CA)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const pairs = data && Array.isArray(data.pairs) ? data.pairs.filter((p) => p && p.priceUsd) : [];
        if (!pairs.length) return;
        pairs.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
        const p = pairs[0];
        setFresh(document.getElementById('mk-price'), price(p.priceUsd));
        setFresh(document.getElementById('mk-mc'), money(p.marketCap || p.fdv));
        setFresh(document.getElementById('mk-vol'), money(p.volume && p.volume.h24));
        const ch = p.priceChange && Number(p.priceChange.h24);
        const chEl = document.getElementById('mk-change');
        if (chEl && isFinite(ch)) {
          setFresh(chEl, (ch > 0 ? '+' : '') + ch.toFixed(1) + '%');
          chEl.classList.toggle('is-up', ch > 0);
          chEl.classList.toggle('is-down', ch < 0);
        }
        if (p.url) marketEl.href = p.url;
        if (p.pairAddress) pairAddress = p.pairAddress;
        marketEl.hidden = false;
      })
      .catch(() => {});
  };
  pull();
  setInterval(() => { if (!document.hidden) pull(); }, 60000);
}

// ---- The chart, on request ----
// DexScreener's own chart, put on the page the first time the button is
// pressed and left there after. The embed only works for a trading pair,
// not the coin itself, so the button waits for the pair: the market call
// above learns it, and failing that the button asks once more. If
// DexScreener will not say, the chart opens in a new tab instead of an
// empty frame.
let pairAddress = '';
function findPair() {
  if (pairAddress) return Promise.resolve(pairAddress);
  return fetch('https://api.dexscreener.com/latest/dex/tokens/' + CA)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const pairs = data && Array.isArray(data.pairs) ? data.pairs.filter((p) => p && p.pairAddress) : [];
      pairs.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
      if (pairs.length) pairAddress = pairs[0].pairAddress;
      return pairAddress;
    })
    .catch(() => '');
}
const chartToggle = document.getElementById('chart-toggle');
const chartFrame = document.getElementById('chart-frame');
if (chartToggle && chartFrame) {
  let asking = false;
  chartToggle.addEventListener('click', () => {
    if (asking) return;
    const open = chartFrame.hidden;
    if (open && !chartFrame.firstChild) {
      asking = true;
      chartToggle.textContent = 'Finding the pair…';
      findPair().then((pair) => {
        asking = false;
        if (!pair) {
          chartToggle.textContent = 'Show the chart';
          window.open('https://dexscreener.com/solana/' + CA, '_blank', 'noopener');
          return;
        }
        const iframe = document.createElement('iframe');
        iframe.src = 'https://dexscreener.com/solana/' + pair + '?embed=1&theme=dark&trades=0&info=0';
        iframe.title = '$BOOZEBAG price chart';
        iframe.loading = 'lazy';
        iframe.setAttribute('allow', 'clipboard-write');
        chartFrame.appendChild(iframe);
        chartFrame.hidden = false;
        chartToggle.textContent = 'Hide the chart';
        chartToggle.setAttribute('aria-expanded', 'true');
      });
      return;
    }
    chartFrame.hidden = !open;
    chartToggle.textContent = open ? 'Hide the chart' : 'Show the chart';
    chartToggle.setAttribute('aria-expanded', String(open));
  });
}

// ---- Kick: is he on? ----
// The channel's public record says whether a stream is up and how many
// are watching. Read from a browser that may or may not be let through;
// when it is, the pill in the hero goes red with the number watching and
// the regimen strip says so, and when it is not, the page keeps its word
// that he is on every day.
function metaValue(name) {
  const tag = document.querySelector('meta[name="' + name + '"]');
  return tag && tag.content ? tag.content.trim() : '';
}
function countText(n, word) {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return '';
  const s = v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v));
  return s + ' ' + word;
}
function setCount(kind, text) {
  const card = document.querySelector('.community-card[data-live="' + kind + '"]');
  const el = card && card.querySelector('.community-count');
  if (el && text) el.textContent = text;
}
// Where the site's own Worker is, if there is one: named in the head, or
// found by the leaderboard on the real domain. It asks Kick on the page's
// behalf, since Kick does not answer a browser from another site.
const siteApi = metaValue('boozebag-api').replace(/\/+$/, '')
  || (window.BoozebagLeaderboard && window.BoozebagLeaderboard.api) || '';
const kickSlug = metaValue('boozebag-kick');
const livePill = document.getElementById('live-pill');
function showLive(status) {
  const onAir = document.getElementById('regimen-onair');
  const num = document.getElementById('live-num');
  const label = document.getElementById('live-label');
  if (status.followers) setCount('kick', countText(status.followers, 'followers'));
  livePill.classList.toggle('is-on', !!status.live);
  if (status.live) {
    const watching = Number(status.viewers) || 0;
    if (num) num.textContent = 'live now';
    if (label) label.innerHTML = (watching > 0 ? watching + ' watching<br />on Kick' : 'on Kick<br />right now');
    if (onAir) onAir.hidden = false;
  } else {
    if (num) num.textContent = 'live';
    if (label) label.innerHTML = 'on Kick<br />every day';
    if (onAir) onAir.hidden = true;
  }
}
// Straight from Kick, for a page with no Worker to ask. Kick usually does
// not answer, and then nothing changes.
function askKickDirect() {
  return fetch('https://kick.com/api/v2/channels/' + encodeURIComponent(kickSlug))
    .then((r) => (r.ok ? r.json() : null))
    .then((ch) => {
      if (!ch) return;
      const s = ch.livestream;
      showLive({ live: !!(s && s.is_live !== false), viewers: s ? (s.viewer_count || s.viewers) : 0,
        followers: ch.followers_count || ch.followersCount });
    });
}
if (kickSlug && livePill) {
  const check = () => {
    const viaSite = siteApi
      ? fetch(siteApi + '/live').then((r) => (r.ok ? r.json() : null)).then((a) => {
        if (!a) throw new Error('no answer');
        if (a.kick) showLive(a.kick);
        if (a.discord && a.discord.members) setCount('discord', countText(a.discord.members, 'members'));
        else askDiscordDirect();
        if (!a.kick) return askKickDirect();
        return null;
      })
      : Promise.reject(new Error('no site api'));
    viaSite.catch(() => { askDiscordDirect(); return askKickDirect(); }).catch(() => {});
  };
  check();
  setInterval(() => { if (!document.hidden) check(); }, 120000);
}

// ---- Discord: how many are in ----
// Asked straight when there is no Worker to ask, or when the Worker's
// answer had nothing from Discord; with one, it comes in the same answer
// as Kick.
const discordInvite = metaValue('boozebag-discord');
function askDiscordDirect() {
  if (!discordInvite || !document.querySelector('.community-card[data-live="discord"]')) return;
  fetch('https://discord.com/api/v10/invites/' + encodeURIComponent(discordInvite) + '?with_counts=true')
    .then((r) => (r.ok ? r.json() : null))
    .then((inv) => { if (inv) setCount('discord', countText(inv.approximate_member_count, 'members')); })
    .catch(() => {});
}
if (!siteApi) askDiscordDirect();
// ---- The coin's own numbers ----
// Supply and holders, from the Worker, which reads them off the chain.
// Holders shows only when there is a count; the Worker cannot always
// get one (workers/leaderboard/README.md).
function askToken() {
  if (!siteApi) return;
  fetch(siteApi + '/token')
    .then((r) => (r.ok ? r.json() : null))
    .then((t) => {
      if (!t) return;
      const holders = Number(t.holders);
      if (holders > 0) {
        const tile = document.getElementById('mk-holders-tile');
        const stat = document.getElementById('tk-holders-stat');
        setFresh(document.getElementById('mk-holders'), shortNum(holders));
        if (tile) tile.hidden = false;
        const tk = document.getElementById('tk-holders');
        if (tk) tk.textContent = holders.toLocaleString('en-US');
        if (stat) stat.hidden = false;
      }
      const supply = Number(t.supply);
      const sup = document.getElementById('tk-supply');
      if (sup && supply > 0) sup.textContent = Math.round(supply).toLocaleString('en-US');
    })
    .catch(() => {});
}
askToken();
setInterval(() => { if (!document.hidden) askToken(); }, 600000);

// The counts written by hand on the cards, for the places with no open door.
document.querySelectorAll('.community-card[data-count]').forEach((card) => {
  const el = card.querySelector('.community-count');
  if (el && card.dataset.count) el.textContent = card.dataset.count;
});

// ---- The bar at the bottom of a phone ----
// Up once the hero, with its own buttons, has gone off the top.
const buybar = document.getElementById('buybar');
const heroEl = document.querySelector('.hero');
if (buybar && heroEl && window.IntersectionObserver) {
  document.body.classList.add('has-buybar');
  const io = new IntersectionObserver((entries) => {
    const heroSeen = entries[0].isIntersecting;
    buybar.classList.toggle('is-on', !heroSeen);
    buybar.setAttribute('aria-hidden', heroSeen ? 'true' : 'false');
  }, { threshold: 0 });
  io.observe(heroEl);
  const copyBar = document.getElementById('buybar-copy');
  if (copyBar) {
    copyBar.addEventListener('click', async () => {
      if (!(await copyText(CA))) return;
      buzz(14);
      copyBar.textContent = 'Copied';
      setTimeout(() => { copyBar.textContent = 'Copy CA'; }, 1600);
    });
  }
}

// ---- The wave of beer under the hero ----
// The stats ride a wave: a band of beer with a foam edge, the words bent
// along it and foam on every crest. One run of the words is drawn as a
// strip, a whole number of waves wide, and a few copies of the strip sit
// side by side and slide across as one piece on the graphics chip: the
// browser paints them once and only moves them, which is what keeps a
// phone smooth. The beer's own life, streaks sliding along it and
// bubbles rising to pop, is drawn on a small canvas over the top.
(function () {
  const wave = document.getElementById('wave');
  const track = document.getElementById('wave-track');
  const live = document.getElementById('wave-live');
  const words = document.querySelector('.wave-words');
  if (!wave || !track || !live || !words) return;
  const NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';
  const PERIOD = 640;   // one crest to the next
  const AMP = 24;       // how high the crests rise
  const MID = 64;       // the middle of the band, in the drawing
  const THICK = 23;     // half the band's height
  const TOP = -36;      // headroom above the band for the foam
  const HEIGHT = 164;
  const GAP = 34;       // between a word and its icon, at least
  const ICON = 24;
  const SPEED = 62;     // drawing units a second
  const stillness = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  const el = (name, attrs, parent) => {
    const e = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  };
  const r = (n) => Math.round(n * 10) / 10;
  const topY = (x) => MID - THICK + AMP * Math.sin(x / PERIOD * Math.PI * 2);
  // A smooth curve through points, as cubic pieces.
  function curve(pts, first) {
    let d = first + r(pts[0][0]) + ' ' + r(pts[0][1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      d += ' C' + r(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + r(p1[1] + (p2[1] - p0[1]) / 6)
        + ' ' + r(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + r(p2[1] - (p3[1] - p1[1]) / 6)
        + ' ' + r(p2[0]) + ' ' + r(p2[1]);
    }
    return d;
  }
  function wavePoints(y0, x0, x1) {
    const pts = [];
    for (let x = x0; x <= x1; x += PERIOD / 8) pts.push([x, y0 + AMP * Math.sin(x / PERIOD * Math.PI * 2)]);
    return pts;
  }
  // The same numbers every time for a given seed, so a crest looks the
  // same on every strip and every visit.
  function rng(seed) {
    let a = (seed * 2654435761) >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const bell = (u) => { const v = Math.max(0, 1 - u * u); return v * v; };

  // The colour of the beer, once, for every strip to share.
  const shared = el('svg', { width: 0, height: 0, style: 'position:absolute', 'aria-hidden': 'true' }, wave);
  const grad = el('linearGradient', { id: 'wave-beer', x1: '0', y1: '0', x2: '0', y2: '1' }, el('defs', {}, shared));
  el('stop', { offset: '0', 'stop-color': '#ffc632' }, grad);
  el('stop', { offset: '1', 'stop-color': '#ff9a12' }, grad);

  let items = [];
  let cycle = PERIOD;
  let gap = GAP;
  // The line the words follow is longer than the width it spans, since
  // it goes up and down: this is how much longer, per unit of width.
  let ratio = 1;
  function measure() {
    const probeSvg = el('svg', { width: 10, height: 10, style: 'position:absolute;visibility:hidden' }, wave);
    const onePeriod = el('path', { d: curve(wavePoints(MID, 0, PERIOD), 'M'), fill: 'none' }, probeSvg);
    ratio = onePeriod.getTotalLength() / PERIOD;
    const probe = el('text', { class: 'wave-text', x: 0, y: 0 }, probeSvg);
    items = Array.from(words.querySelectorAll('li')).map((li) => {
      probe.textContent = li.textContent.toUpperCase();
      return { text: li.textContent.toUpperCase(), icon: li.dataset.icon, len: probe.getComputedTextLength() };
    });
    wave.removeChild(probeSvg);
    // One run of the words is stretched to a whole number of waves, so a
    // strip ends where the next one begins. The words are measured along
    // the line, so the run has to fill the line's length over the strip.
    const bare = items.reduce((n, it) => n + it.len + ICON + GAP * 2, 0);
    cycle = Math.ceil(bare / (PERIOD * ratio)) * PERIOD;
    gap = GAP + (cycle * ratio - bare) / (items.length * 2);
    let at = 0;
    items.forEach((it) => {
      it.at = at;
      at += it.len + gap;
      it.iconAt = at + ICON / 2;
      at += ICON + gap;
    });
  }

  // One strip: a run of the words on a whole number of waves. It is drawn
  // a wave past each end and cut off at its edges, so whatever crosses
  // the edge carries on, identically, on the copy beside it.
  function makeStrip(svg, defs) {
    const x0 = -PERIOD, x1 = cycle + PERIOD;
    const top = wavePoints(MID - THICK, x0, x1);
    const bottom = wavePoints(MID + THICK, x0, x1).reverse();
    const band = curve(top, 'M') + curve(bottom, ' L') + ' Z';
    const lineId = 'wave-line';
    el('path', { id: lineId, d: curve(wavePoints(MID, x0, x1), 'M'), fill: 'none' }, defs);
    // Cut two units past its end, under the next copy, so the two edges
    // never meet on the same pixel and let the dark through.
    el('rect', { x: 0, y: TOP, width: cycle + 2, height: HEIGHT }, el('clipPath', { id: 'wave-clip' }, defs));
    // Drawn in layers, each its own group: every copy's shadow goes
    // down before any copy's beer, and so on up. Where two copies meet,
    // an edge then only ever lands on its own colour, and the join is
    // invisible.
    const layers = ['shadow', 'beer', 'froth', 'top'].map((name) => el('g', { id: 'wave-layer-' + name, 'clip-path': 'url(#wave-clip)' }));
    el('path', { class: 'wave-shadow', d: band, transform: 'translate(0 7)' }, layers[0]);
    el('path', { class: 'wave-band', d: band }, layers[1]);
    el('path', { class: 'wave-foam', d: curve(wavePoints(MID - THICK + 2.5, x0, x1), 'M') }, layers[2]);
    const strip = layers[3];
    // Foam on every crest, no two heads alike: a skirt that rises from
    // the surface, and a head of blobs drawn twice, outlined and then
    // filled, so only the outer edge keeps its line.
    const perCycle = Math.round(cycle / PERIOD);
    for (let k = -1; k <= perCycle; k++) {
      const x = PERIOD * 3 / 4 + k * PERIOD;
      const seed = ((k % perCycle) + perCycle) % perCycle;
      const rand = rng(seed + 1);
      const kind = seed % 3;
      const reach = kind === 0 ? 150 : kind === 1 ? 95 : 120;
      const rise = kind === 0 ? 9 : kind === 1 ? 6 : 8;
      const over = [], under = [];
      for (let u = -reach; u <= reach; u += 15) {
        over.push([x + u, topY(x + u) - (rise + 1.5) * bell(u / reach)]);
        under.push([x + u, topY(x + u) + 5]);
      }
      const count = kind === 0 ? 7 : kind === 1 ? 4 : 5;
      const spread = kind === 0 ? 118 : kind === 1 ? 62 : 86;
      const blobs = [];
      for (let i = 0; i < count; i++) {
        const mid = (count - 1) / 2;
        const cx = x - spread / 2 + spread * (i / (count - 1)) + (rand() - 0.5) * 12;
        const rad = (7.5 + rand() * 8) * (1 + 0.7 * (1 - Math.abs(i - mid) / (mid || 1)));
        blobs.push([cx, topY(cx) - rad * 0.8, rad]);
      }
      const head = el('g', {}, strip);
      el('path', { class: 'wave-skirt-edge', d: curve(over, 'M') }, head);
      blobs.forEach((b) => el('circle', { class: 'wave-head-line', cx: r(b[0]), cy: r(b[1]), r: r(b[2]) }, head));
      el('path', { class: 'wave-skirt', d: curve(over, 'M') + curve(under.slice().reverse(), ' L') + ' Z' }, head);
      blobs.forEach((b) => el('circle', { class: 'wave-head', cx: r(b[0]), cy: r(b[1]), r: r(b[2]) }, head));
      blobs.forEach((b) => {
        if (b[2] < 10) return;
        el('circle', { class: 'wave-head-shade', cx: r(b[0] + b[2] * 0.2), cy: r(b[1] + b[2] * 0.3), r: r(b[2] * 0.6) }, head);
        el('circle', { class: 'wave-head-hole', cx: r(b[0] + (rand() - 0.5) * b[2]), cy: r(b[1] + (rand() - 0.5) * b[2] * 0.8), r: r(1 + rand() * 1.2) }, head);
      });
      if (kind === 2) {
        for (let i = 0; i < 3; i++) {
          const fx = x + (rand() - 0.5) * 90;
          el('circle', { class: 'wave-fleck', cx: r(fx), cy: r(topY(fx) - 18 - rand() * 12), r: r(1.8 + rand() * 1.8) }, strip);
        }
      }
    }
    // The words, bent along the wave, with the icons between them. The
    // run either side is drawn too, for the words that cross an edge.
    const line = defs.querySelector('#' + lineId);
    const pathLen = line.getTotalLength ? line.getTotalLength() : 0;
    // Where a point along the line is, by distance from its start: the
    // line starts a wave before the strip, so the first run is offset.
    const lead = PERIOD * ratio;
    const cycleLen = cycle * ratio;
    for (let k = -1; k <= 1; k++) {
      items.forEach((it) => {
        const s = lead + it.at + k * cycleLen;
        if (s + it.len < 0 || s > pathLen) return;
        const t = el('text', { class: 'wave-text' }, strip);
        const tp = el('textPath', { startOffset: String(r(s)) }, t);
        tp.setAttributeNS(XLINK, 'xlink:href', '#' + lineId);
        tp.setAttribute('href', '#' + lineId);
        tp.textContent = it.text;
        const si = lead + it.iconAt + k * cycleLen;
        if (si < 0 || si > pathLen) return;
        const p = line.getPointAtLength(si);
        const use = el('use', { class: 'wave-icon', x: r(p.x - ICON / 2), y: r(p.y - ICON / 2), width: ICON, height: ICON }, strip);
        use.setAttributeNS(XLINK, 'xlink:href', '#' + it.icon);
        use.setAttribute('href', '#' + it.icon);
      });
    }
    return layers;
  }

  let run = null;
  let width = 0;
  function build() {
    measure();
    while (track.firstChild) track.removeChild(track.firstChild);
    width = wave.clientWidth || window.innerWidth;
    // Enough copies of the strip to cover the screen with one more to
    // slide in, all in one drawing, so there is no edge between them.
    const copies = Math.ceil(width * 1.1 / cycle) + 1;
    const svg = el('svg', { viewBox: '0 ' + TOP + ' ' + (cycle * copies) + ' ' + HEIGHT, width: cycle * copies, height: HEIGHT, focusable: 'false' }, track);
    const defs = el('defs', {}, svg);
    makeStrip(svg, defs).forEach((layer) => {
      svg.appendChild(layer);
      for (let i = 1; i < copies; i++) {
        const copy = el('use', { x: cycle * i, y: 0 }, svg);
        copy.setAttributeNS(XLINK, 'xlink:href', '#' + layer.id);
        copy.setAttribute('href', '#' + layer.id);
      }
    });
    if (run) run.cancel();
    run = null;
    if (!stillness && track.animate) {
      run = track.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-' + cycle + 'px)' }],
        { duration: cycle / SPEED * 1000, iterations: Infinity });
    }
    seedBubbles();
  }

  // ---- The life in the beer, on the canvas ----
  const ctx = live.getContext('2d');
  const streaks = [
    // offset from the middle, width, colour, dash, gap, extra speed
    [-15, 5, 'rgba(255, 250, 220, 0.34)', 70, 120, 84],
    [-8, 3, 'rgba(255, 250, 220, 0.26)', 30, 100, 118],
    [0, 4, 'rgba(255, 244, 190, 0.18)', 46, 110, 62],
    [8, 3, 'rgba(255, 250, 220, 0.2)', 24, 105, 96],
    [15, 6, 'rgba(120, 45, 0, 0.16)', 96, 130, 48],
    [19, 3, 'rgba(120, 45, 0, 0.2)', 28, 110, 70],
  ].slice(0, coarse ? 4 : 6);
  let bubbles = [];
  function seedBubbles() {
    bubbles = [];
    const rand = rng(99);
    const per = coarse ? 3 : 4;
    for (let k = 0; k < Math.round(cycle / PERIOD); k++) {
      for (let i = 0; i < per; i++) {
        bubbles.push({ x: k * PERIOD + rand() * PERIOD, depth: 12 + rand() * 28, r: 1.4 + rand() * 2,
          period: 3000 + rand() * 2400, phase: rand() });
      }
    }
  }
  let dpr = 1;
  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wave.clientWidth, h = wave.clientHeight;
    if (live.width !== Math.round(w * dpr) || live.height !== Math.round(h * dpr)) {
      live.width = Math.round(w * dpr);
      live.height = Math.round(h * dpr);
    }
  }
  function offsetNow() {
    if (!run || run.currentTime === null) return 0;
    const dur = cycle / SPEED * 1000;
    return ((run.currentTime % dur) + dur) % dur / dur * cycle;
  }
  let lastDraw = 0;
  function draw(now) {
    const w = wave.clientWidth, h = wave.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const off = offsetNow();
    const t = now / 1000;
    ctx.lineCap = 'round';
    streaks.forEach((ln) => {
      ctx.beginPath();
      for (let x = -20; x <= w + 20; x += 12) {
        const y = MID + ln[0] + AMP * Math.sin((x + off) / PERIOD * Math.PI * 2) - TOP;
        if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.setLineDash([ln[3], ln[4]]);
      ctx.lineDashOffset = -(off + t * ln[5]) % (ln[3] + ln[4]);
      ctx.strokeStyle = ln[2];
      ctx.lineWidth = ln[1];
      ctx.stroke();
    });
    ctx.setLineDash([]);
    // Bubbles float up from their own depth, wobbling, and pop at the top.
    bubbles.forEach((b) => {
      const p = ((now / b.period) + b.phase) % 1;
      for (let k = -1; k <= Math.ceil(w / cycle); k++) {
        const sx = b.x - off + k * cycle;
        if (sx < -10 || sx > w + 10) continue;
        const surface = topY(b.x) - TOP + 2;
        if (p < 0.88) {
          const climb = Math.min(1, p / 0.88);
          const y = surface + b.depth * (1 - climb);
          const wob = Math.sin(p * Math.PI * 6) * 2;
          const size = b.r * (0.6 + 0.4 * climb);
          ctx.globalAlpha = Math.min(1, p / 0.08);
          ctx.fillStyle = 'rgba(255, 248, 222, 0.8)';
          ctx.beginPath();
          ctx.arc(sx + wob, y, size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const q = (p - 0.88) / 0.12;
          ctx.globalAlpha = 0.95 * (1 - q);
          ctx.strokeStyle = 'rgba(255, 246, 214, 0.9)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(sx, surface, 2 + q * 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    });
    ctx.globalAlpha = 1;
  }
  let seen = true;
  let raf = 0;
  function loop(now) {
    raf = 0;
    if (!seen || stillness) return;
    // A phone draws every other frame; nothing in here needs more.
    if (!coarse || now - lastDraw >= 30) {
      lastDraw = now;
      sizeCanvas();
      draw(now);
    }
    raf = requestAnimationFrame(loop);
  }
  function settle() {
    if (run) { if (seen) run.play(); else run.pause(); }
    if (seen && !raf && !stillness) raf = requestAnimationFrame(loop);
  }

  build();
  sizeCanvas();
  if (stillness) { draw(0); }
  settle();
  // The words are measured in the page's font, which may land later.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { build(); settle(); });
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (Math.abs(wave.clientWidth - width) > 40) { build(); settle(); } }, 200);
  });
  // Still while it is off the screen, so it costs nothing there.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { seen = es[0].isIntersecting; settle(); }).observe(wave);
  }
})();
