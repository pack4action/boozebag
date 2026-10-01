# $BOOZEBAG

Memecoin site for $BOOZEBAG, inspired by [@BoozebagFitness](https://x.com/BoozebagFitness) — 24 drinks a day, zero lifting, one bodybuilding stage.

Static site, no build step. Open `index.html` directly or serve the folder with any static file server.

## Structure

- `index.html` — page markup
- `assets/css/style.css` — styles
- `assets/js/main.js` — small CA copy-to-clipboard interaction
- `assets/img/` — avatar and proof screenshot assets

## Moving to boozebag.us

Until the domain is live, the share cards, canonical links, sitemap and the
meme maker's Post on X link all point at `https://pack4action.github.io/boozebag/`,
so a posted link shows its picture and goes somewhere. On the day of the
move, replace that address with `https://boozebag.us/` everywhere it
appears: the heads of the six pages, `sitemap.xml`, `robots.txt` and
`assets/js/meme.js`.
