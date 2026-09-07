// The few constants the render test has to know about, read out of
// assets/js/gym-tycoon.js rather than copied into the test.
//
// They live inside the game's closure, so a running page can't be asked for
// them, and a copy in the test would go stale the first time someone
// retunes a palette -- which is the sort of change that should not quietly
// stop a test from checking anything. Parsing the source keeps the two in
// step, and throws if the shape it expects has moved.

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', '..', 'assets', 'js', 'gym-tycoon.js');

function source() {
  return fs.readFileSync(SRC, 'utf8');
}

// The wallL/wallR of each theme in THEME_COLORS: the colours a room paints
// its west and north back walls.
function wallColors() {
  const src = source();
  const block = /const THEME_COLORS = \{([\s\S]*?)\n  \};/.exec(src);
  if (!block) throw new Error('could not find THEME_COLORS in ' + SRC);
  const out = {};
  const row = /(\w+):\s*\{[^}]*wallL:\s*'(#[0-9a-fA-F]{3,6})'[^}]*wallR:\s*'(#[0-9a-fA-F]{3,6})'[^}]*\}/g;
  let m;
  while ((m = row.exec(block[1]))) {
    out[m[1]] = { wallL: m[2], wallR: m[3] };
  }
  if (!Object.keys(out).length) throw new Error('no themes parsed out of THEME_COLORS');
  return out;
}

// How much paler than its wall a door casing is drawn.
function casingShadeAmount() {
  const m = /const casing = shade\(wallColor,\s*(-?\d+)\)/.exec(source());
  if (!m) throw new Error('could not find the door casing shade in ' + SRC);
  return Number(m[1]);
}

// Mirrors shade() in gym-tycoon.js: a clamped per-channel offset.
function shade(hex, amt) {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const num = parseInt(full, 16);
  const clamp = (v) => Math.max(0, Math.min(255, v + amt));
  return [clamp((num >> 16) & 0xff), clamp((num >> 8) & 0xff), clamp(num & 0xff)];
}

module.exports = { wallColors, casingShadeAmount, shade };
