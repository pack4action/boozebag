# $BOOZEBAG

Memecoin site for $BOOZEBAG, inspired by [@BoozebagFitness](https://x.com/BoozebagFitness) — 24 drinks a day, zero lifting, one bodybuilding stage.

Static site, no build step. Open `index.html` directly or serve the folder with any static file server.

## Structure

- `index.html` — page markup
- `assets/css/style.css` — styles
- `assets/js/main.js` — small CA copy-to-clipboard interaction
- `assets/img/` — avatar and proof screenshot assets

## Tests

The site still has no build step; `package.json` exists only to run the tests.

```
npm install
npx playwright install chromium   # once, for the render test
npm test
```

- `tests/plan.test.js` — Gym Tycoon's floor plan: that every hallway fills
  the gap between its two rooms, sits inside both across its width, and
  doors into a back wall rather than an open front. Pure tile arithmetic,
  no browser, so it runs in milliseconds (`npm run test:plan`).
- `tests/doorways.test.js` — loads the page in Chromium and reads the
  canvas back, checking each doorway is framed in the colour of the wall it
  is actually cut into (`npm run test:render`). Skipped with a note if no
  browser is installed, and a hard failure under `CI`.

Both exist because the floor plan is isometric: a hallway wall on the wrong
side or a door in the wrong end looks plausible in a screenshot and has
twice shipped that way.
