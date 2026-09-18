# The leaderboard

One board per game, shared by everybody playing. A Cloudflare Worker at
`boozebag.xyz/api/scores` in front of a D1 database, and about a hundred
lines of client in `assets/js/leaderboard.js`.

Nothing needs deploying for the site to work. Off the real domain the games
keep their board in the browser and the heading says `this browser only`;
on `boozebag.xyz` (or a `*.pages.dev` preview) the same code finds `/api`
by itself and the heading says `everybody playing`. There is no key, no
config file and nothing to paste into the markup.

## What it stores

`scores` — one row per wallet per game: the best that wallet has posted, a
display name if it gave one, the second figure each game shows beside the
score (money per second, the rack, the height), and when it last posted.

`hits` — what has posted recently, so a script cannot sit there hammering
it. Swept on write; nothing in it is worth keeping.

## Deploying it

No domain needed. A free Cloudflare account and `npx wrangler` are all it
takes; the Worker gets a free address at `workers.dev` and the site on
GitHub Pages calls it there. About ten minutes.

```sh
# 0. A free account at https://dash.cloudflare.com/sign-up if there is
#    not one yet. Then, from the repo:
cd workers/leaderboard

# 1. Log in. This opens a browser once.
npx wrangler login

# 2. Make the database. This prints a database_id.
npx wrangler d1 create boozebag

# 3. Put that id into wrangler.toml, replacing PUT-THE-DATABASE-ID-HERE.

# 4. Create the tables, in the real database rather than the local one.
npx wrangler d1 execute boozebag --remote --file=./schema.sql

# 5. Put the Worker up. The last line it prints is its address, like
#    https://boozebag-leaderboard.<your-account>.workers.dev
npx wrangler deploy
```

Check it, with the address it printed:

```sh
curl 'https://boozebag-leaderboard.<your-account>.workers.dev/api/scores?game=gym-tycoon'
# {"game":"gym-tycoon","board":[]}
curl 'https://boozebag-leaderboard.<your-account>.workers.dev/api/live'
# {"kick":{"live":false,...},"discord":{"members":...},"at":...}
```

Then tell the site where it is: in the head of `index.html` and of each
game page there is a commented-out tag; put the address in it and push.

```html
<meta name="boozebag-api" content="https://boozebag-leaderboard.<your-account>.workers.dev/api" />
```

From then on the games say `everybody playing` over their boards, the
front page's Top bags fills from the same board, and the Kick pill goes
red when he is on.

### Once there is a domain

When boozebag.xyz is bought and its DNS is on Cloudflare, uncomment the
`routes` in `wrangler.toml` and deploy again. The Worker then also answers
at `boozebag.xyz/api/`, the same origin as the page, and the page finds it
there by itself; the tag can stay or go.

## Is he live

`GET /api/live` says whether the Kick channel is streaming, how many are
watching, and how many are in the Discord:

```json
{"kick":{"live":true,"viewers":87,"title":"...","followers":2340},"discord":{"members":1512},"at":1726660000000}
```

A browser cannot ask Kick itself (kick.com does not answer other sites),
so the front page asks here, and the Worker asks Kick at most once every
forty-five seconds however many people are looking.

It asks two ways. If a Kick app has been made at
https://kick.com/settings/developer and its two values are put on the
Worker, it uses Kick's own API:

```sh
npx wrangler secret put KICK_CLIENT_ID
npx wrangler secret put KICK_CLIENT_SECRET
```

Without them it reads the channel record the Kick site itself uses,
which works until Kick decides it should not. Either way `kick` is `null`
when nothing answered, and the page keeps its plain "live on Kick every
day" pill. The channel is `petermossfield` unless `KICK_SLUG` is set, and
the Discord invite is the one on the page unless `DISCORD_INVITE` is set.

## What it will and will not stop

A score arrives from a browser, and a browser will say whatever it is told
to say. Nothing here makes a reported score true, and no amount of checking
on this side would — the only way to be sure is to replay the run on the
server, which is a game's worth of work for each game.

What it does do:

- a game has to be one of the three, and a wallet has to look like a wallet;
- a score has to be a number, and under a ceiling no play would reach;
- a name is cut to twenty characters with the invisible ones taken out, so
  nobody can pass themselves off as somebody else with a zero-width space;
- one post per wallet per twenty seconds, one per address of origin per
  three, and 240 an hour from any one address;
- a wallet's row only ever goes up, so nothing is lost by posting often.

That stops somebody idly poking at it. Somebody determined will get a
number on the board, and the answer to that is to watch it and delete the
silly ones:

```sh
npx wrangler d1 execute boozebag --remote \
  --command "DELETE FROM scores WHERE game='gym-tycoon' AND address='...'"
```

## Changing the ceilings

`GAMES` at the top of `src/worker.js`. `ceiling` is the highest score the
board will take, `metaCeiling` the highest second figure. They are meant to
be loose: refusing a real player's score is worse than letting a silly one
through, because the silly one can be deleted and the real one is somebody
leaving.

## Checking it before you deploy

```sh
npx wrangler@3 d1 execute boozebag --local --file=./schema.sql
npx wrangler@3 dev --port 8799 --local     # leave this running
node test.mjs                              # in another shell
```

`test.mjs` posts a score, a second wallet, a name full of invisible
characters, a game that does not exist, a wallet that is not a wallet, a
score no play could reach, and the same wallet twice in a row, and says what
each one did. It talks to whatever is at `BASE` (default
`http://127.0.0.1:8799`), so the same file checks the real thing after a
deploy:

```sh
BASE=https://boozebag.xyz node test.mjs
```
