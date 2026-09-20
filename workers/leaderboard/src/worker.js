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

// ---- The token's own numbers ----
// How much of the coin there is, what it is worth, and how many wallets
// hold it. Supply is one cheap call to the chain. The market cap comes
// from pump.fun, which knows it from the first trade. The holder count
// is the awkward one: counting it on the chain means asking for every
// token account of the mint, which the free public RPC refuses, so four
// places are tried in turn and the first that answers wins. Supply and
// holders are held ten minutes and the market cap one, and the last good
// holder count is kept for a day so a refusal never blanks the figure.
const TOKEN_MINT = '3kxChnv5tabrhuuNUyMLPNYAF4XXodRFfDAmKjvcpump';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_HOLD_MS = 10 * 60 * 1000;
const TOKEN_KEEP_MS = 24 * 60 * 60 * 1000;
const CAP_HOLD_MS = 60 * 1000;
const ASK_MS = 6000;
let tokenHeld = null;
let lastHolders = null;
let coinHeld = null;

// A whole number of holders, or null for anything that is not one.
function countOf(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1e9 ? Math.round(n) : null;
}

// Nothing here is worth holding the answer up for, so every call out has
// a short leash -- where the runtime offers one. An older runtime without
// AbortSignal.timeout gets no leash rather than no answer.
function leash(ms) {
  try {
    return AbortSignal.timeout(ms);
  } catch (e) {
    return undefined;
  }
}

async function getJson(url, headers) {
  try {
    const r = await fetch(url, {
      headers: Object.assign({ Accept: 'application/json' }, headers || {}),
      signal: leash(ASK_MS),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

async function rpcAt(url, method, params) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: leash(ASK_MS * 3),
    });
    if (!r.ok) return null;
    const body = await r.json().catch(() => null);
    return body && body.result !== undefined ? body.result : null;
  } catch (e) {
    return null;
  }
}
const rpcUrl = (env) => env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

async function tokenSupply(env, mint) {
  const res = await rpcAt(rpcUrl(env), 'getTokenSupply', [mint]);
  const v = res && res.value;
  if (!v) return null;
  return { supply: Number(v.uiAmount), decimals: v.decimals };
}

// pump.fun's record of the coin, which carries the market cap and, on the
// newer address, the holder count too. Fetched once and shared.
async function pumpCoin(mint) {
  const now = Date.now();
  if (coinHeld && now - coinHeld.at < CAP_HOLD_MS) return coinHeld.coin;
  let coin = null;
  for (const base of ['https://frontend-api-v3.pump.fun/coins/', 'https://frontend-api.pump.fun/coins/']) {
    coin = await getJson(base + mint);
    if (coin && typeof coin === 'object') break;
    coin = null;
  }
  coinHeld = { at: now, coin: coin || (coinHeld ? coinHeld.coin : null) };
  return coinHeld.coin;
}

// ---- Where a holder count can come from ----
// Solscan's own record of the token.
async function holdersSolscan(mint) {
  for (const url of ['https://public-api.solscan.io/token/meta?tokenAddress=' + mint,
    'https://api.solscan.io/token/meta?token=' + mint]) {
    const j = await getJson(url);
    if (!j) continue;
    const d = j.data && typeof j.data === 'object' ? j.data : j;
    const n = countOf(d.holder !== undefined ? d.holder : d.holderCount);
    if (n) return n;
  }
  return null;
}

// GeckoTerminal keeps a holder count alongside the rest of a token's info.
async function holdersGecko(mint) {
  const j = await getJson('https://api.geckoterminal.com/api/v2/networks/solana/tokens/' + mint + '/info',
    { Accept: 'application/json;version=20230302' });
  const a = j && j.data && j.data.attributes;
  if (!a) return null;
  const h = a.holders;
  return countOf(h && typeof h === 'object' ? h.count : h);
}

// pump.fun, from the record already fetched for the market cap.
async function holdersPump(mint) {
  const c = await pumpCoin(mint);
  if (!c) return null;
  return countOf(c.holder_count !== undefined ? c.holder_count : c.holders);
}

// Straight off the chain: every token account of the mint, asking for
// only its balance, counting the ones with something in them. Heavy, and
// the free public RPC refuses it, so this runs last and only really
// answers when SOLANA_RPC names a private one.
async function holdersChain(env, mint) {
  const urls = [rpcUrl(env)];
  if (!env.SOLANA_RPC) urls.push('https://solana-rpc.publicnode.com');
  for (const url of urls) {
    const res = await rpcAt(url, 'getProgramAccounts', [TOKEN_PROGRAM, {
      encoding: 'base64',
      dataSlice: { offset: 64, length: 8 },
      filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mint } }],
    }]);
    if (!Array.isArray(res)) continue;
    let n = 0;
    for (const acc of res) {
      const raw = acc && acc.account && acc.account.data && acc.account.data[0];
      if (!raw) continue;
      const bytes = atob(raw);
      let amount = 0;
      for (let i = 7; i >= 0; i--) amount = amount * 256 + bytes.charCodeAt(i);
      if (amount > 0) n += 1;
    }
    if (n > 0) return n;
  }
  return null;
}

// The four in turn, stopping at the first that answers, and saying which
// one it was so a look at /api/token shows where the figure came from.
async function tokenHolders(env, mint) {
  const sources = [['solscan', holdersSolscan], ['geckoterminal', holdersGecko],
    ['pump.fun', holdersPump], ['chain', (m) => holdersChain(env, m)]];
  const tried = [];
  for (const [from, ask] of sources) {
    let n = null;
    let why = 'nothing';
    try {
      n = await ask(mint);
    } catch (e) {
      why = 'threw: ' + (e && e.message ? e.message : e);
    }
    tried.push(from + ': ' + (n ? n : why));
    if (n) return { holders: n, from, tried };
  }
  return { holders: null, from: null, tried };
}

async function tokenAnswer(env) {
  const now = Date.now();
  const mint = env.TOKEN_MINT || TOKEN_MINT;
  if (!tokenHeld || now - tokenHeld.at >= TOKEN_HOLD_MS) {
    const [supply, counted] = await Promise.all([tokenSupply(env, mint), tokenHolders(env, mint)]);
    let holders = counted.holders;
    let holdersFrom = counted.from;
    if (holders !== null) lastHolders = { at: now, holders, from: holdersFrom };
    else if (lastHolders && now - lastHolders.at < TOKEN_KEEP_MS) {
      holders = lastHolders.holders;
      holdersFrom = lastHolders.from + ' (held)';
    }
    tokenHeld = {
      at: now,
      body: {
        supply: supply ? supply.supply : null,
        decimals: supply ? supply.decimals : null,
        holders,
        holdersFrom,
        tried: counted.tried,
      },
    };
  }
  const coin = await pumpCoin(mint);
  const cap = coin ? countOf(coin.usd_market_cap) : null;
  return Object.assign({ mint }, tokenHeld.body, { marketCap: cap, at: now });
}

// ---- Cracked together ----
// The button on the front page is the one thing on this site everybody
// can press at once, so the count belongs to the site rather than to a
// browser: press it and the figure everyone is looking at goes up. The
// table is made on first use, so nothing has to be run by hand for it.
const CRACK_MAX = 25;        // the most one run of presses can add
const CRACK_EVERY = 2;       // seconds between posts from one place
const CRACK_HOLD_MS = 5000;  // how long a read is reused
let crackTableReady = false;
let crackHeld = null;

async function crackTable(env) {
  if (crackTableReady) return;
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS cracks (day TEXT PRIMARY KEY, n INTEGER NOT NULL)',
  ).run();
  crackTableReady = true;
}

const crackDay = () => new Date().toISOString().slice(0, 10);

async function crackCounts(env, fresh) {
  const now = Date.now();
  if (!fresh && crackHeld && now - crackHeld.at < CRACK_HOLD_MS) return crackHeld.body;
  await crackTable(env);
  const day = await env.DB.prepare('SELECT n FROM cracks WHERE day = ?1').bind(crackDay()).first();
  const all = await env.DB.prepare('SELECT SUM(n) AS n FROM cracks').first();
  const body = { today: (day && day.n) || 0, total: (all && all.n) || 0, at: now };
  crackHeld = { at: now, body };
  return body;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsFor(request) });
    }
    if (url.pathname === '/api/cracks') {
      if (request.method === 'GET') {
        return new Response(JSON.stringify(await crackCounts(env)), {
          status: 200,
          headers: Object.assign({
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=5',
          }, corsFor(request)),
        });
      }
      if (request.method !== 'POST') return json(request, { error: 'GET or POST' }, 405);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (await tooSoon(env, 'crack:' + ip, CRACK_EVERY, 0)) {
        return json(request, Object.assign({ error: 'slow down' }, await crackCounts(env)), 429);
      }
      const raw = await request.text();
      if (raw.length > BODY_MAX) return json(request, { error: 'too much' }, 413);
      let asked = 1;
      try {
        asked = Number(JSON.parse(raw || '{}').n) || 1;
      } catch (e) {
        asked = 1;
      }
      const n = Math.max(1, Math.min(CRACK_MAX, Math.round(asked)));
      await crackTable(env);
      await env.DB.prepare(
        'INSERT INTO cracks (day, n) VALUES (?1, ?2)'
        + ' ON CONFLICT (day) DO UPDATE SET n = cracks.n + excluded.n',
      ).bind(crackDay(), n).run();
      return json(request, await crackCounts(env, true));
    }
    if (url.pathname === '/api/token') {
      if (request.method !== 'GET') return json(request, { error: 'GET' }, 405);
      const body = await tokenAnswer(env);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: Object.assign({
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
        }, corsFor(request)),
      });
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
    let name = cleanName(body.name);
    // A post that is about the name, from the button in the game, rather
    // than a score going up in passing: it answers straight away and is
    // not held to the wallet's posting window, since a person pressed it.
    const claim = body.claim === true && name !== null;

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (await tooSoon(env, 'ip:' + ip, ORIGIN_EVERY, ORIGIN_PER_HOUR)) {
      return json(request, { error: 'slow down' }, 429);
    }
    if (!claim && await tooSoon(env, 'w:' + game + ':' + address, WALLET_EVERY, 0)) {
      return json(request, { error: 'slow down' }, 429);
    }

    // A name is one wallet's, first come first served, spelt any way.
    // A claim on somebody else's is refused; a score post carrying one
    // just goes up without it.
    if (name !== null) {
      const holder = await env.DB.prepare(
        'SELECT address FROM scores WHERE game = ?1 AND lower(name) = lower(?2) AND address != ?3 LIMIT 1',
      ).bind(game, name, address).first();
      if (holder) {
        if (claim) return json(request, { error: 'taken', name }, 409);
        name = null;
      }
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

    return json(request, { game, name, board: await board(env, game, BOARD_SIZE) });
  },
};
