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
