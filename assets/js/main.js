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

if (copyBtn && caValue) {
  let stampTimer = 0;
  const copyAddress = async () => {
    const done = await copyText(caValue.textContent.trim());
    if (!done) {
      copyBtn.textContent = 'Follow @BoozebagFitness';
      return;
    }
    buzz(14);
    copyBtn.textContent = 'Copied';
    if (caBox) caBox.classList.add('is-copied');
    clearTimeout(stampTimer);
    stampTimer = setTimeout(() => {
      copyBtn.textContent = 'Copy';
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

// ---- The roadmap stops, one at a time ----
const stops = document.querySelectorAll('.road-item');
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
        marketEl.hidden = false;
      })
      .catch(() => {});
  };
  pull();
  setInterval(() => { if (!document.hidden) pull(); }, 60000);
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
const kickSlug = metaValue('boozebag-kick');
const livePill = document.getElementById('live-pill');
if (kickSlug && livePill) {
  const onAir = document.getElementById('regimen-onair');
  const num = document.getElementById('live-num');
  const label = document.getElementById('live-label');
  const check = () => {
    fetch('https://kick.com/api/v2/channels/' + encodeURIComponent(kickSlug))
      .then((r) => (r.ok ? r.json() : null))
      .then((ch) => {
        if (!ch) return;
        setCount('kick', countText(ch.followers_count || ch.followersCount, 'followers'));
        const live = ch.livestream && (ch.livestream.is_live !== false);
        livePill.classList.toggle('is-on', !!live);
        if (live) {
          const watching = Number(ch.livestream.viewer_count || ch.livestream.viewers || 0);
          if (num) num.textContent = 'live now';
          if (label) label.innerHTML = (watching > 0 ? watching + ' watching<br />on Kick' : 'on Kick<br />right now');
          if (onAir) onAir.hidden = false;
        } else {
          if (num) num.textContent = 'live';
          if (label) label.innerHTML = 'on Kick<br />every day';
          if (onAir) onAir.hidden = true;
        }
      })
      .catch(() => {});
  };
  check();
  setInterval(() => { if (!document.hidden) check(); }, 120000);
}

// ---- Discord: how many are in ----
const discordInvite = metaValue('boozebag-discord');
if (discordInvite && document.querySelector('.community-card[data-live="discord"]')) {
  fetch('https://discord.com/api/v10/invites/' + encodeURIComponent(discordInvite) + '?with_counts=true')
    .then((r) => (r.ok ? r.json() : null))
    .then((inv) => { if (inv) setCount('discord', countText(inv.approximate_member_count, 'members')); })
    .catch(() => {});
}
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
