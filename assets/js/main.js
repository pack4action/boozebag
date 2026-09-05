const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const copyBtn = document.getElementById('ca-copy');
const caValue = document.getElementById('ca-value');

if (copyBtn && caValue) {
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(caValue.textContent.trim());
      const original = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = original; }, 1500);
    } catch (err) {
      copyBtn.textContent = 'Follow @BoozebagFitness';
    }
  });
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
