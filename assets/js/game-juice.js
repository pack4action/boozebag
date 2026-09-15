// What the three minigames share to feel good: sound, a short freeze on a
// big moment, a flash over the board, numbers that float up from where
// something happened, a score that counts rather than jumps, and confetti
// when a best is beaten. None of it touches the rules. A game that has all
// of this and a game that has none of it play out identically; one of them
// is just more fun to be in.
//
// Sound is made in the browser from oscillators and filtered noise, so
// there are no files to load and nothing to fail. It is on until switched
// off, the choice is remembered, and it is one choice for all three games.
// A browser will not let a page make a sound before the first tap anyway,
// so nothing plays until something is done.
(function () {
  const SOUND_KEY = 'boozebagGameSound';
  const stillness = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  const calm = () => !!(stillness && stillness.matches);

  // ---- Sound ----
  let soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) { soundOn = true; }
  let audio = null;
  let noiseBuf = null;

  function ready() {
    if (!soundOn) return null;
    if (audio) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return audio;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    audio = { ctx, master };
    return audio;
  }
  // Half a second of white noise, made once. Every thud, whoosh and crunch
  // is a slice of this through a filter with a shape on its volume.
  function noiseBuffer(ctx) {
    if (noiseBuf) return noiseBuf;
    const len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  // One note: a waveform at a pitch, in fast, out over `dur`, sliding to a
  // second pitch if one is given.
  function note(a, freq, when, dur, type, gain, slideTo) {
    const osc = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(a.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }
  // A burst of noise through a filter. `kind` is lowpass for a thud,
  // bandpass for a whoosh or a crunch, highpass for a sparkle; `slideTo`
  // moves the filter over the burst, which is what makes a whoosh whoosh.
  function noise(a, when, dur, gain, kind, freq, q, slideTo) {
    const src = a.ctx.createBufferSource();
    src.buffer = noiseBuffer(a.ctx);
    const f = a.ctx.createBiquadFilter();
    f.type = kind;
    f.frequency.setValueAtTime(freq, when);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    f.Q.value = q || 0.8;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f);
    f.connect(g);
    g.connect(a.master);
    src.start(when);
    src.stop(when + dur + 0.02);
  }
  const now = (a) => a.ctx.currentTime;
  // A run of notes up a chord, spaced out: what winning sounds like.
  function fanfare(a, freqs, gap, dur, gain) {
    const t = now(a);
    freqs.forEach((f, i) => note(a, f, t + i * gap, dur, 'triangle', gain));
  }

  const sfx = {
    // ---- Shared ----
    // Something worth celebrating: a bright run up the chord and over.
    newBest() {
      const a = ready();
      if (!a) return;
      fanfare(a, [523, 659, 784, 1047, 1319, 1568], 0.08, 0.3, 0.16);
      noise(a, now(a) + 0.1, 0.5, 0.05, 'highpass', 5000);
    },
    // A coin: two bright notes a fifth apart.
    coin() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 1318, t, 0.09, 'triangle', 0.2);
      note(a, 1976, t + 0.05, 0.14, 'triangle', 0.14);
    },
    // Something big falling over: a drop through the floor with debris.
    crash() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 110, t, 0.5, 'sine', 0.55, 32);
      noise(a, t, 0.4, 0.35, 'lowpass', 420, 0.7, 120);
      noise(a, t + 0.05, 0.18, 0.18, 'bandpass', 1600, 1.4);
      [440, 330, 220].forEach((f, i) => note(a, f, t + 0.12 + i * 0.07, 0.08, 'square', 0.05));
    },
    // A whoosh past the ear.
    whoosh(strength) {
      const a = ready();
      if (!a) return;
      const s = Math.max(0.2, Math.min(1, strength === undefined ? 0.7 : strength));
      noise(a, now(a), 0.22, 0.14 + s * 0.16, 'bandpass', 500, 1.1, 2600);
    },

    // ---- Gains Stacker ----
    // A plate set down clean: a chime that climbs with the run, so ten in
    // a row sounds like ten in a row and not the same ding ten times.
    perfect(run) {
      const a = ready();
      if (!a) return;
      const t = now(a);
      const up = Math.pow(2, Math.min(run || 1, 12) / 12);
      note(a, 880 * up, t, 0.14, 'triangle', 0.22);
      note(a, 1320 * up, t + 0.06, 0.2, 'triangle', 0.16);
      noise(a, t, 0.08, 0.05, 'highpass', 6000);
    },
    // Near enough: one soft note.
    nice() {
      const a = ready();
      if (!a) return;
      note(a, 660, now(a), 0.1, 'triangle', 0.16);
    },
    // The overhang cut off: a crunch with a knock under it.
    trim() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      noise(a, t, 0.08, 0.28, 'bandpass', 1900, 1.6);
      note(a, 140, t, 0.1, 'sine', 0.35, 70);
    },
    // A plate landing: a knock.
    thud() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 130, t, 0.1, 'sine', 0.4, 60);
      noise(a, t, 0.05, 0.12, 'lowpass', 600);
    },
    // Width coming back: three quick notes up.
    widen() {
      const a = ready();
      if (!a) return;
      fanfare(a, [523, 659, 784], 0.06, 0.16, 0.16);
    },
    // A milestone: the same, longer, with a fourth.
    milestone() {
      const a = ready();
      if (!a) return;
      fanfare(a, [523, 659, 784, 1047], 0.08, 0.24, 0.17);
    },

    // ---- Degen Pong ----
    // The slingshot stretching: a tick that climbs as the pull deepens.
    stretch(level) {
      const a = ready();
      if (!a) return;
      note(a, 240 + level * 110, now(a), 0.035, 'sine', 0.12);
    },
    // Let go: a whoosh as long as the pull was deep.
    sling(power) {
      sfx.whoosh(power);
    },
    // Off the wall: a knock.
    bounce() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 520, t, 0.06, 'sine', 0.18, 300);
      noise(a, t, 0.03, 0.14, 'highpass', 3000);
    },
    // Into a cup: the plop, then a chime pitched by what the cup was worth.
    sink(points) {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 380, t, 0.12, 'sine', 0.3, 170);
      noise(a, t, 0.06, 0.1, 'lowpass', 900);
      const p = Math.max(0, points || 0);
      note(a, 620 + p * 4, t + 0.09, 0.22, 'triangle', 0.2);
      if (p >= 75) note(a, (620 + p * 4) * 1.5, t + 0.17, 0.26, 'triangle', 0.16);
    },
    // The rug: a buzzer, two low notes beating against each other.
    rug() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 110, t, 0.38, 'square', 0.09);
      note(a, 116, t, 0.38, 'square', 0.09);
      noise(a, t, 0.2, 0.16, 'lowpass', 220);
    },
    // A can gone: a dull thud off the floor.
    miss() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 200, t, 0.18, 'sine', 0.26, 80);
      noise(a, t, 0.08, 0.14, 'lowpass', 500);
    },
    // A rack down.
    rackClear() {
      const a = ready();
      if (!a) return;
      fanfare(a, [523, 659, 784, 1047, 1319], 0.07, 0.26, 0.17);
    },
    // The rack sliding back down the table.
    moveBack() {
      const a = ready();
      if (!a) return;
      noise(a, now(a), 0.4, 0.16, 'bandpass', 1100, 1.2, 280);
    },

    // ---- Beer Mile ----
    // Off the ground: a boing.
    jump() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 300, t, 0.13, 'sine', 0.2, 640);
      noise(a, t, 0.03, 0.06, 'highpass', 2500);
    },
    // Back on it.
    land() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 150, t, 0.07, 'sine', 0.22, 80);
      noise(a, t, 0.04, 0.08, 'lowpass', 700);
    },
    // A swallow, pitched a little higher the emptier the glass.
    gulp(progress) {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 200 + (progress || 0) * 180, t, 0.09, 'sine', 0.24, 130);
      noise(a, t, 0.05, 0.07, 'lowpass', 650);
    },
    // Glass empty: the swallow and then two notes up.
    downed() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 320, t, 0.1, 'sine', 0.24, 140);
      note(a, 660, t + 0.12, 0.12, 'triangle', 0.18);
      note(a, 990, t + 0.22, 0.24, 'triangle', 0.18);
    },
    // Glass knocked over.
    spill() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      noise(a, t, 0.28, 0.2, 'lowpass', 1100, 0.8, 300);
      note(a, 500, t, 0.24, 'triangle', 0.12, 240);
    },
    // A mile marker: a bell.
    bell() {
      const a = ready();
      if (!a) return;
      const t = now(a);
      note(a, 1568, t, 0.42, 'triangle', 0.18);
      note(a, 2093, t + 0.02, 0.3, 'sine', 0.08);
    },
  };

  // ---- Time ----
  // A short freeze on a big moment, or a stretch of slow motion. Games ask
  // `holding()` before they step, or scale their clock by `timeScale()`.
  // Neither runs when the person has asked the browser for less motion.
  let holdUntil = 0;
  let slowUntil = 0;
  let slowBy = 1;
  function hold(ms) {
    if (calm()) return;
    holdUntil = Math.max(holdUntil, performance.now() + ms);
  }
  function slow(factor, ms) {
    if (calm()) return;
    slowBy = factor;
    slowUntil = performance.now() + ms;
  }
  function holding() {
    return performance.now() < holdUntil;
  }
  function timeScale() {
    const t = performance.now();
    if (t < holdUntil) return 0;
    if (t < slowUntil) return slowBy;
    return 1;
  }

  // ---- Over the board ----
  let stage = null;
  let flashEl = null;
  let floatsEl = null;
  function attach(stageEl, hudEl) {
    stage = stageEl;
    if (!stage) return;
    flashEl = document.createElement('div');
    flashEl.className = 'juice-flash';
    floatsEl = document.createElement('div');
    floatsEl.className = 'juice-floats';
    // Under the toast and the overlay, over the canvas.
    const before = stage.querySelector('.game-toast');
    stage.insertBefore(flashEl, before);
    stage.insertBefore(floatsEl, before);
    if (hudEl) mountSoundButton(hudEl);
  }
  // A wash of colour over the whole board that fades straight out.
  function flash(color, ms) {
    if (!flashEl || calm()) return;
    flashEl.style.transition = 'none';
    flashEl.style.background = color;
    flashEl.style.opacity = '0.5';
    // Two frames so the browser sees the jump before the fade.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      flashEl.style.transition = 'opacity ' + (ms || 260) + 'ms ease-out';
      flashEl.style.opacity = '0';
    }));
  }
  // Words that rise from a point on the board and fade. `x` and `y` are
  // fractions of the board, so they land in the right place whatever size
  // it is being shown at.
  function float(text, x, y, cls) {
    if (!floatsEl) return;
    if (floatsEl.childElementCount > 14) floatsEl.firstElementChild.remove();
    const el = document.createElement('span');
    el.className = 'juice-float' + (cls ? ' ' + cls : '');
    el.textContent = text;
    el.style.left = (Math.max(0.06, Math.min(0.94, x)) * 100) + '%';
    el.style.top = (Math.max(0.06, Math.min(0.94, y)) * 100) + '%';
    floatsEl.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    // In case the animation never runs.
    setTimeout(() => el.remove(), 1400);
  }
  // Confetti from the top of the board.
  function celebrate() {
    if (!stage || calm()) return;
    const colours = ['#e3a83b', '#c0483a', '#3d7a9e', '#4f9d6e', '#f0a94e', '#5ec4c9', '#fff'];
    for (let i = 0; i < 46; i++) {
      const bit = document.createElement('i');
      bit.className = 'juice-confetti';
      bit.style.left = (Math.random() * 100) + '%';
      bit.style.background = colours[i % colours.length];
      bit.style.animationDelay = (Math.random() * 0.5) + 's';
      bit.style.animationDuration = (1.3 + Math.random() * 0.9) + 's';
      bit.style.setProperty('--spin', (Math.random() * 720 - 360) + 'deg');
      bit.style.setProperty('--drift', (Math.random() * 120 - 60) + 'px');
      floatsEl.appendChild(bit);
      bit.addEventListener('animationend', () => bit.remove());
      setTimeout(() => bit.remove(), 3000);
    }
  }

  // ---- The HUD ----
  // A number that counts to where it is going instead of jumping, and gives
  // a little jump of its own when it gets there.
  const counting = new WeakMap();
  function count(el, to, ms) {
    if (!el) return;
    const target = Number(to) || 0;
    const from = Number(String(el.textContent).replace(/[^0-9.-]/g, '')) || 0;
    const prev = counting.get(el);
    if (prev) cancelAnimationFrame(prev.raf);
    if (calm() || from === target) {
      el.textContent = String(target);
      pop(el);
      return;
    }
    const start = performance.now();
    const span = ms || 340;
    const state = { raf: 0 };
    const tick = (t) => {
      const k = Math.min(1, (t - start) / span);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(from + (target - from) * eased));
      if (k < 1) state.raf = requestAnimationFrame(tick);
      else { counting.delete(el); pop(el); }
    };
    counting.set(el, state);
    state.raf = requestAnimationFrame(tick);
  }
  function pop(el) {
    if (!el) return;
    el.classList.remove('juice-pop');
    void el.offsetWidth;
    el.classList.add('juice-pop');
  }

  // ---- The switch ----
  let soundBtn = null;
  function mountSoundButton(hud) {
    soundBtn = document.createElement('button');
    soundBtn.type = 'button';
    soundBtn.className = 'hud-stat hud-sound';
    soundBtn.id = 'btn-sound';
    soundBtn.innerHTML = '<span class="hud-label">Sound</span><span class="hud-value"></span>';
    soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      try { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off'); } catch (e) { /* fine */ }
      // Switched on by a click, which is the one moment a page is allowed
      // to start making sound, so start it now and say so.
      if (soundOn) { ready(); sfx.coin(); }
      refreshSoundButton();
    });
    hud.appendChild(soundBtn);
    refreshSoundButton();
  }
  function refreshSoundButton() {
    if (!soundBtn) return;
    soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', soundOn ? 'Sound on' : 'Sound off');
    soundBtn.querySelector('.hud-value').textContent = soundOn ? 'On' : 'Off';
    soundBtn.classList.toggle('is-off', !soundOn);
  }

  window.BoozebagJuice = {
    sfx, attach, flash, float, celebrate, count, pop,
    hold, slow, holding, timeScale,
    soundOn: () => soundOn,
    calm,
  };
})();
