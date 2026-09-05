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
