// What the page actually draws where the plan says a doorway goes.
//
// plan.test.js checks the model; this checks the paint. A doorway's casing
// is drawn a fixed amount paler than the wall it is cut into, and a room
// paints its two back walls in different colours -- north in wallR, west in
// wallL. So the casing's colour says which wall the renderer thought it was
// cutting through, and counting casing pixels of each colour says whether
// every doorway went into the right one. That is the fault this test was
// written for: the casing was shaded off wallL whichever wall it pierced,
// so all four north-wall doorways were framed in the wrong material.
//
// Pixels rather than a screenshot comparison because the plan is lit,
// vignetted and auto-zoomed to the window: a reference image would have to
// be regenerated for every unrelated change to any of that, and would stop
// being read. A colour, scaled by whatever the vignette does to it, still
// pins down the one thing under test.

const test = require('node:test');
const assert = require('node:assert');
const { loadPlan } = require('./helpers/load-plan');
const { serveRepo } = require('./helpers/serve');
const { wallColors, casingShadeAmount, shade } = require('./helpers/tycoon-source');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  chromium = null;
}

const plan = loadPlan();
const WALLS = wallColors();
const CASING_SHADE = casingShadeAmount();
const MAX_ROOMS = 4;

// A save with every room of every theme already built and money to spare,
// so one page load has all nine hallways on it.
function fullSave() {
  const themeRooms = {};
  plan.themeIds().forEach((id) => {
    themeRooms[id] = [];
    for (let i = 0; i < MAX_ROOMS; i++) {
      themeRooms[id].push({ layout: new Array(plan.slotCountFor(id, i)).fill(null) });
    }
  });
  return {
    balance: 1e9, lifetime: 1e9, owned: {}, themeRooms,
    activeTheme: plan.themeIds()[0], activeRoomIndex: 0, lastSaved: Date.now(),
  };
}

// Doorways per wall for a theme's full chain, straight off the plan: an
// east-west hallway doors into a west wall, a north-south one into a north
// wall.
function expectedDoors(themeId) {
  const corridors = plan.corridorsFor(themeId, plan.roomPlacements(themeId, MAX_ROOMS));
  return {
    west: corridors.filter((c) => c.axis === 'gx').length,
    north: corridors.filter((c) => c.axis === 'gy').length,
  };
}

// Attribute canvas pixels to one casing colour or the other. The vignette
// painted over the finished scene is black at some alpha, so a casing pixel
// arrives darkened -- casing * (1 - alpha). Matching a colour up to that
// uniform scaling still separates the two, because the walls differ in hue
// and no amount of darkening turns one into the other.
const COUNT_CASINGS = (colours) => {
  const canvas = document.getElementById('tycoon-floor');
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const residual = (px, c) => {
    const scale = (px[0] * c[0] + px[1] * c[1] + px[2] * c[2])
      / (c[0] * c[0] + c[1] * c[1] + c[2] * c[2]);
    if (scale < 0.55 || scale > 1.02) return Infinity;
    return Math.max(
      Math.abs(px[0] - scale * c[0]),
      Math.abs(px[1] - scale * c[1]),
      Math.abs(px[2] - scale * c[2]),
    );
  };
  const counts = { west: 0, north: 0 };
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 250) continue;
    const px = [data[i], data[i + 1], data[i + 2]];
    const ew = residual(px, colours.west);
    const en = residual(px, colours.north);
    if (ew > 1.2 && en > 1.2) continue;
    if (ew < en) counts.west++; else counts.north++;
  }
  return counts;
};

// A missing browser is a skip on a dev box that has not run `npx playwright
// install chromium` yet, and a failure in CI, where a silently skipped
// render test would be worse than no test at all.
async function launchOrSkip(t) {
  if (!chromium) {
    if (process.env.CI) throw new Error('playwright is not installed');
    t.skip('playwright is not installed -- run npm install');
    return null;
  }
  try {
    return await chromium.launch();
  } catch (e) {
    if (process.env.CI) throw e;
    t.diagnostic(e.message.split('\n')[0]);
    t.skip('no browser to render with -- run npx playwright install chromium');
    return null;
  }
}

test('every doorway is framed in the wall it is cut into', async (t) => {
  const browser = await launchOrSkip(t);
  if (!browser) return;
  const site = await serveRepo();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    // Seeded before any page script runs: the game loads its save on the
    // way in, and writes it back on the way out, so a save planted after
    // load would be overwritten by the empty one already in hand.
    await page.addInitScript((save) => {
      localStorage.setItem('gymTycoonSave', JSON.stringify(save));
    }, fullSave());
    await page.goto(`${site.origin}/gym-tycoon.html`);
    await page.waitForFunction(() => {
      const c = document.getElementById('tycoon-floor');
      return c && c.width > 0;
    });

    for (const theme of plan.themeIds()) {
      await t.test(theme, async () => {
        await page.evaluate((id) => {
          const buttons = Array.from(document.querySelectorAll('#theme-row button'));
          const match = buttons.find((b) => b.textContent.trim().toLowerCase().startsWith(id));
          if (!match) throw new Error('no theme button for ' + id);
          match.click();
        }, theme);
        // The scene redraws synchronously on the click; one frame settles
        // the canvas resize that comes with it.
        await page.evaluate(() => new Promise(requestAnimationFrame));

        const colours = {
          west: shade(WALLS[theme].wallL, CASING_SHADE),
          north: shade(WALLS[theme].wallR, CASING_SHADE),
        };
        const counts = await page.evaluate(COUNT_CASINGS, colours);
        const want = expectedDoors(theme);

        // Enough pixels to be a drawn casing rather than a stray edge.
        const FLOOR = 50;
        for (const wall of ['west', 'north']) {
          if (want[wall] > 0) {
            assert.ok(
              counts[wall] > FLOOR,
              `${theme} should draw ${want[wall]} ${wall}-wall doorway(s) in `
              + `${WALLS[theme][wall === 'west' ? 'wallL' : 'wallR']}, but only `
              + `${counts[wall]} pixels came back in that colour`,
            );
          } else {
            assert.ok(
              counts[wall] <= FLOOR,
              `${theme} has no ${wall}-wall doorways, yet ${counts[wall]} pixels `
              + 'came back framed as though it did',
            );
          }
        }

        // Every hallway in a theme is the same width and the whole plan is
        // drawn at one zoom, so each doorway contributes about the same area:
        // the share of casing pixels landing on each wall should follow the
        // share of doorways cut into it. This is what fails loudly if the
        // casings all come out of one palette entry again -- on the theme
        // where both walls have doorways, the pixel floor above cannot catch
        // that on its own.
        //
        // A share, not a ratio. This was a ratio, which is unstable by
        // construction: it divides by a count that can be small, so a modest
        // wobble in attribution reads as a large error. And attribution IS
        // wobbly here, because the two casing colours are a shade of each
        // wall and those can be nearly identical -- the basement's come out
        // rgb(140,148,156) and rgb(134,139,145), six points apart, so pixels
        // near the boundary land on either side. A share stays bounded in
        // 0..1 whatever the counts are, and the fault this test exists for
        // moves it by 0.26 to 0.66, far outside anything attribution noise
        // does.
        if (want.west > 0 && want.north > 0) {
          const wantShare = want.west / (want.west + want.north);
          const gotShare = counts.west / (counts.west + counts.north);
          assert.ok(
            Math.abs(gotShare - wantShare) < 0.18,
            `${theme}: ${(gotShare * 100).toFixed(0)}% of casing pixels are on the west `
            + `wall (${counts.west} west, ${counts.north} north), but the plan cuts `
            + `${want.west} of its ${want.west + want.north} doorways into it, so it `
            + `should be about ${(wantShare * 100).toFixed(0)}%`,
          );
        }
      });
    }
  } finally {
    await browser.close();
    await site.close();
  }
});
