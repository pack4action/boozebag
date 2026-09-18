// The leaderboard the games post to. It runs on the site's own domain at
// /api/, so a page and its board are the same origin and there is nothing
// in the page for anybody to take.
//
// What it can and cannot do: a score arrives from a browser, and a browser
// will say whatever it is told to say. Nothing here makes a reported score
// true. What it does is keep the board from being ruined by somebody idly
// poking at it -- a number no play could reach is refused, and one wallet
// cannot post faster than somebody playing would.

const GAMES = {
  // An idle game's takings run away with themselves by design, so the
  // ceiling is only there to refuse a number that means nothing.
  'gym-tycoon': { ceiling: 1e18, metaCeiling: 1e15 },
  'degen-pong': { ceiling: 1e7, metaCeiling: 1e5 },
  'gains-stacker': { ceiling: 1e7, metaCeiling: 1e5 },
  // A perfect run is 26 miles at 100, 26 drinks at 120 and the 2600 for
  // finishing, so about 8300. The ceiling is well clear of that.
  'beer-mile': { ceiling: 1e6, metaCeiling: 100 },
};

// One post per wallet in this many seconds, and one per address of origin
// in this many. A person playing trips neither.
const WALLET_EVERY = 20;
const ORIGIN_EVERY = 3;
const ORIGIN_PER_HOUR = 240;
const BOARD_SIZE = 25;
const BODY_MAX = 2048;

const ALLOWED_ORIGINS = [
  'https://boozebag.xyz',
  'https://www.boozebag.xyz',
  'https://pack4action.github.io',
  'http://localhost:8791',
  'http://127.0.0.1:8791',
];

function corsFor(request) {
  const origin = request.headers.get('Origin') || '';
  const ok = ALLOWED_ORIGINS.indexOf(origin) !== -1 || /\.pages\.dev$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request, body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    }, corsFor(request)),
  });
}

// A Solana address as it is written: base58, and never the characters that
// look like other characters.
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// Anything that would not sit on one line of a board: control characters,
// and the invisible ones people use to make a name look like somebody
// else's.
const UNPRINTABLE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028\\u2029]', 'g');

// Whatever somebody types for a name is theirs to choose, but it has to fit
// on one line and be made of things that show up.
function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(UNPRINTABLE, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return name || null;
}

function number(v, ceiling) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > ceiling) return null;
  return n;
}

async function board(env, game, limit) {
  const r = await env.DB.prepare(
    'SELECT address, name, score, meta, updated_at FROM scores'
    + ' WHERE game = ?1 ORDER BY score DESC, updated_at ASC LIMIT ?2',
  ).bind(game, limit).all();
  return (r.results || []).map((row) => ({
    address: row.address,
    name: row.name || null,
    score: row.score,
    meta: row.meta,
    at: row.updated_at,
  }));
}

// Has this key been used inside `every` seconds? The mark is written as it
// is read, so the next post within the window is refused. For the address a
// post came from there is an hourly count as well, kept as one row per post
// so counting them is a single statement.
async function tooSoon(env, key, every, perHour) {
  const now = Math.floor(Date.now() / 1000);
  const last = await env.DB.prepare('SELECT at FROM hits WHERE key = ?1').bind(key).first();
  if (last && now - last.at < every) return true;
  if (perHour) {
    const c = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM hits WHERE key LIKE ?1 AND at > ?2',
    ).bind(key + ':%', now - 3600).first();
    if (c && c.n >= perHour) return true;
    await env.DB.prepare('INSERT OR REPLACE INTO hits (key, at) VALUES (?1, ?2)')
      .bind(key + ':' + now + ':' + Math.random().toString(36).slice(2, 8), now).run();
  }
  await env.DB.prepare('INSERT OR REPLACE INTO hits (key, at) VALUES (?1, ?2)')
    .bind(key, now).run();
  return false;
}

// ---- Is he live? ----
// A browser cannot ask Kick itself: kick.com sits behind bot protection
// and does not answer other sites. So the site asks from here, and every
// page gets the one answer for the next three quarters of a minute rather
// than each of them knocking. Two ways to ask, tried in turn: Kick's own
// API when an app has been made for it and its two secrets are set on
// the Worker, and otherwise the channel record the Kick site itself
// reads. Discord's invite count comes along in the same answer.
const LIVE_HOLD_MS = 45000;
let liveHeld = null;

async function kickOfficial(env, slug) {
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.KICK_CLIENT_ID,
    client_secret: env.KICK_CLIENT_SECRET,
  });
  const tok = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  }).then((r) => (r.ok ? r.json() : null));
  if (!tok || !tok.access_token) return null;
  const r = await fetch('https://api.kick.com/public/v1/channels?slug=' + encodeURIComponent(slug), {
    headers: { Authorization: 'Bearer ' + tok.access_token, Accept: 'application/json' },
  });
  if (!r.ok) return null;
  const body = await r.json();
  const ch = body && Array.isArray(body.data) ? body.data[0] : null;
  if (!ch) return null;
  const s = ch.stream || null;
  return {
    live: !!(s && s.is_live),
    viewers: s ? Number(s.viewer_count) || 0 : 0,
    title: (s && s.stream_title) || ch.stream_title || '',
    followers: null,
  };
}

async function kickSite(slug) {
  const r = await fetch('https://kick.com/api/v2/channels/' + encodeURIComponent(slug), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) boozebag-site/1.0',
    },
  });
  if (!r.ok) return null;
  const ch = await r.json();
  if (!ch || typeof ch !== 'object') return null;
  const s = ch.livestream || null;
  return {
    live: !!(s && s.is_live !== false),
    viewers: s ? Number(s.viewer_count) || 0 : 0,
    title: s ? (s.session_title || '') : '',
    followers: Number(ch.followers_count) || null,
  };
}

async function kickStatus(env) {
  const slug = env.KICK_SLUG || 'petermossfield';
  if (env.KICK_CLIENT_ID && env.KICK_CLIENT_SECRET) {
    try {
      const got = await kickOfficial(env, slug);
      if (got) return got;
    } catch (e) { /* fall through to the site */ }
  }
  try {
    return await kickSite(slug);
  } catch (e) {
    return null;
  }
}

async function discordCount(env) {
  const code = env.DISCORD_INVITE || 'K6QfX6e7Yn';
  try {
    const r = await fetch('https://discord.com/api/v10/invites/' + encodeURIComponent(code) + '?with_counts=true', {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return null;
    const inv = await r.json();
    const n = Number(inv && inv.approximate_member_count);
    return n > 0 ? n : null;
  } catch (e) {
    return null;
  }
}

// The last answer each source gave, kept while this instance lives. Kick
// and Discord both refuse a call now and then, and a refusal should not
// blank the page for two minutes when the last good answer is minutes old.
const LAST_GOOD_MS = 30 * 60 * 1000;
let lastKick = null;
let lastDiscord = null;

async function liveAnswer(env) {
  const now = Date.now();
  if (liveHeld && now - liveHeld.at < LIVE_HOLD_MS) return liveHeld.body;
  let [kick, discord] = await Promise.all([kickStatus(env), discordCount(env)]);
  if (kick) lastKick = { at: now, kick };
  else if (lastKick && now - lastKick.at < LAST_GOOD_MS) kick = lastKick.kick;
  if (discord) lastDiscord = { at: now, discord };
  else if (lastDiscord && now - lastDiscord.at < LAST_GOOD_MS) discord = lastDiscord.discord;
  const body = { kick, discord: discord ? { members: discord } : null, at: now };
  liveHeld = { at: now, body };
  return body;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsFor(request) });
    }
    if (url.pathname === '/api/live') {
      if (request.method !== 'GET') return json(request, { error: 'GET' }, 405);
      const body = await liveAnswer(env);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: Object.assign({
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=30',
        }, corsFor(request)),
      });
    }
    if (url.pathname !== '/api/scores') {
      return json(request, { error: 'no such thing here' }, 404);
    }

    if (request.method === 'GET') {
      const game = url.searchParams.get('game');
      if (!GAMES[game]) return json(request, { error: 'no such game' }, 400);
      const asked = parseInt(url.searchParams.get('limit'), 10);
      const limit = Math.max(1, Math.min(BOARD_SIZE, asked > 0 ? asked : BOARD_SIZE));
      return json(request, { game, board: await board(env, game, limit) });
    }

    if (request.method !== 'POST') {
      return json(request, { error: 'GET or POST' }, 405);
    }

    const raw = await request.text();
    if (raw.length > BODY_MAX) return json(request, { error: 'too much' }, 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch (e) {
      return json(request, { error: 'not json' }, 400);
    }

    const game = body && body.game;
    const rules = GAMES[game];
    if (!rules) return json(request, { error: 'no such game' }, 400);
    const address = body.address;
    if (typeof address !== 'string' || !ADDRESS.test(address)) {
      return json(request, { error: 'that is not a wallet' }, 400);
    }
    const score = number(body.score, rules.ceiling);
    if (score === null) return json(request, { error: 'that is not a score' }, 400);
    const meta = body.meta === undefined || body.meta === null
      ? null : number(body.meta, rules.metaCeiling);
    const name = cleanName(body.name);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await tooSoon(env, 'ip:' + ip, ORIGIN_EVERY, ORIGIN_PER_HOUR)) {
      return json(request, { error: 'slow down' }, 429);
    }
    if (await tooSoon(env, 'w:' + game + ':' + address, WALLET_EVERY, 0)) {
      return json(request, { error: 'slow down' }, 429);
    }

    const now = Math.floor(Date.now() / 1000);
    // Only ever upwards: a wallet's row is its best, so a later smaller
    // score leaves the board as it was. The name follows the newest post,
    // because that is somebody changing what they are called.
    await env.DB.prepare(
      'INSERT INTO scores (game, address, name, score, meta, updated_at)'
      + ' VALUES (?1, ?2, ?3, ?4, ?5, ?6)'
      + ' ON CONFLICT (game, address) DO UPDATE SET'
      + '   name = COALESCE(excluded.name, scores.name),'
      + '   meta = CASE WHEN excluded.score >= scores.score THEN excluded.meta ELSE scores.meta END,'
      + '   score = MAX(scores.score, excluded.score),'
      + '   updated_at = excluded.updated_at',
    ).bind(game, address, name, score, meta, now).run();

    // Old marks are worth nothing; sweeping them here keeps the table from
    // growing for ever without anything having to run on a timer.
    ctx.waitUntil(env.DB.prepare('DELETE FROM hits WHERE at < ?1').bind(now - 3600).run());

    return json(request, { game, board: await board(env, game, BOARD_SIZE) });
  },
};
