# $BOOZEBAG

Memecoin site for $BOOZEBAG, inspired by [@BoozebagFitness](https://x.com/BoozebagFitness) — 24 drinks a day, zero lifting, one bodybuilding stage.

Static site, no build step. Open `index.html` directly or serve the folder with any static file server.

## Structure

- `index.html` — page markup
- `assets/css/style.css` — styles
- `assets/js/main.js` — small CA copy-to-clipboard interaction
- `assets/img/` — avatar and proof screenshot assets

## The domain

The site is served by GitHub Pages at https://boozebag.us. Cloudflare
holds the DNS (two CNAMEs, `@` and `www`, both to `pack4action.github.io`,
DNS only), and the custom domain is set in the repo's Settings, Pages.
The old `pack4action.github.io/boozebag/` address forwards here by itself.
The share cards, canonical links, sitemap and the meme maker's Post on X
link all use `https://boozebag.us/`.
