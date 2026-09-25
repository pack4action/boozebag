// The leaderboard the games post to. It runs on the site's own domain at
// /api/, so a page and its board are the same origin and there is nothing
// in the page for anybody to take.
//
// What it can and cannot do: a score arrives from a browser, and a browser
// will say whatever it is told to say. Nothing here makes a reported score
// true. What it does is keep the board from being ruined by somebody idly
// poking at it -- a number no play could reach is refused, and one wallet
// cannot post faster than somebody playing would.

// What each game can plausibly produce.
//
//   ceiling  the most a score may ever be. Set well above the best run
//            anybody has had, because clipping a real player is worse
//            than letting a cheat through; raise it if somebody ever
//            reaches it honestly.
//   climb    the most a wallet's score may multiply by in an hour, and
//            floor, a flat amount per hour on top, so a small early score
//            can still move. Both are only checked against what the board
//            itself last saw and when, so they cost nothing to keep.
//            null means the game's scores are per run, not cumulative,
//            and only the ceiling applies.
const GAMES = {
  // An idle game's takings run away with themselves by design, so this is
  // the one where the speed limit does the work rather than the ceiling.
  // A gym can multiply its money many times over in an hour of real play,
  // so the limit is generous; what it refuses is the jump from a million
  // to a trillion between one post and the next.
  'gym-tycoon': { ceiling: 1e18, metaCeiling: 1e15, climb: 64, floor: 5e6 },
  // The three below are played in runs: you start at nothing every time,
  // so a score is not something that climbs and only the ceiling applies.
  // A strong run is a few thousand in each, and these sit far above that.
  'degen-pong': { ceiling: 2e5, metaCeiling: 1e4, climb: null },
  'gains-stacker': { ceiling: 2e5, metaCeiling: 1e4, climb: null },
  // A perfect run is 26 miles at 100, 26 drinks at 120 and the 2600 for
  // finishing, so about 8300, plus what is picked up along the way.
  'beer-mile': { ceiling: 3e4, metaCeiling: 100, climb: null },
};

// One post per wallet in this many seconds, and one per address of origin
// in this many. A person playing trips neither.
const WALLET_EVERY = 20;
const ORIGIN_EVERY = 3;
// Taking yourself off is rarer than posting, and destructive, so it gets a
// window of its own rather than sharing the posting one.
const REMOVE_EVERY = 10;
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

// ---- Proving a post came from the wallet it names ----
// The games work out their own numbers, so a score is a claim. This does
// not make the claim true; it makes it yours. Nobody else can post as you,
// and nobody can quietly put a number under somebody else's name.
//
// Signing every post with the wallet itself would mean a wallet prompt
// every thirty seconds, which nobody would put up with. So the wallet
// signs one short note when it connects, handing a key the browser made
// the right to post for a while, and that key signs each score. One
// approval at the door instead of one per drink.
const GRANT_HOURS = 24;         // the longest a note is good for
const POST_WINDOW = 600;        // how far off a post's own clock may be
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58decode(str) {
  if (typeof str !== 'string' || !str) return null;
  let n = 0n;
  for (const c of str) {
    const i = B58.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const out = [];
  while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
  for (const c of str) { if (c === '1') out.unshift(0); else break; }
  return Uint8Array.from(out);
}
async function signedBy(publicKeyB58, signatureB58, text) {
  const pub = b58decode(publicKeyB58);
  const sig = b58decode(signatureB58);
  if (!pub || pub.length !== 32 || !sig || sig.length !== 64) return false;
  try {
    const key = await crypto.subtle.importKey('raw', pub, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, sig, new TextEncoder().encode(text));
  } catch (e) {
    return false;
  }
}
// The two notes, written the same way on both sides. Any difference at
// all, down to a space, and the signature does not check out.
const grantText = (address, key, until) => '$BOOZEBAG leaderboard\n'
  + 'wallet: ' + address + '\n'
  + 'key: ' + key + '\n'
  + 'until: ' + until;
const postText = (game, address, score, ts) => '$BOOZEBAG score\n'
  + 'game: ' + game + '\n'
  + 'wallet: ' + address + '\n'
  + 'score: ' + score + '\n'
  + 'at: ' + ts;

// Answers null when the post is properly signed, or what is wrong with it.
async function badSignature(body, game, address, now, subject) {
  const auth = body && body.auth;
  if (!auth || typeof auth !== 'object') return 'sign in to post a score';
  const { key, until, grant, sig, ts } = auth;
  if (typeof key !== 'string' || typeof grant !== 'string' || typeof sig !== 'string') {
    return 'that is not a signature';
  }
  const good = Math.floor(Number(until));
  if (!isFinite(good) || good <= now) return 'sign in again';
  if (good > now + GRANT_HOURS * 3600 + 300) return 'that lasts too long';
  if (!await signedBy(address, grant, grantText(address, key, good))) {
    return 'the wallet did not sign that';
  }
  const at = Math.floor(Number(ts));
  if (!isFinite(at) || Math.abs(now - at) > POST_WINDOW) return 'check your clock';
  // The score is in what was signed, so the number cannot be changed on
  // the way here without the signature falling apart.
  if (!await signedBy(key, sig, postText(game, address, subject, at))) {
    return 'that score was not signed';
  }
  return null;
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
  const name = raw.replace(UNPRINTABLE, '').replace(/\s+/g, ' ').trim().slice(0, 20).trim();
  return name || null;
}

// Two words at most. A name padded out with spaces pushes the rest of a
// row off the line, and reads as one name here and another there.
function tooManySpaces(name) {
  return name.indexOf(' ') !== name.lastIndexOf(' ');
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

// An RPC call that says why it failed, because "nothing" is no help when
// a count stops arriving and the question is whose fault it is.
async function rpcAsk(url, method, params, ms) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: leash(ms || ASK_MS * 3),
    });
    const body = await r.json().catch(() => null);
    const said = body && body.error && (body.error.message || JSON.stringify(body.error));
    if (!r.ok) return { error: 'http ' + r.status + (said ? ': ' + said : '') };
    if (said) return { error: said };
    return { result: body ? body.result : null };
  } catch (e) {
    return { error: e && e.message ? e.message : String(e) };
  }
}
async function rpcAt(url, method, params) {
  const r = await rpcAsk(url, method, params);
  return r.result === undefined ? null : r.result;
}
const rpcUrl = (env) => env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

// What is still waiting to go out, read from the wallet it waits in.
// Only asked for when AIRDROP_WALLET names one, and null otherwise, so
// the page falls back to the figure written into it.
async function heldBack(env, mint) {
  const owner = env.AIRDROP_WALLET;
  if (!owner) return null;
  const r = await rpcAsk(rpcUrl(env), 'getTokenAccountsByOwner',
    [owner, { mint }, { encoding: 'jsonParsed' }]);
  const list = r.result && r.result.value;
  if (!Array.isArray(list)) return null;
  let n = 0;
  for (const acc of list) {
    const info = acc && acc.account && acc.account.data && acc.account.data.parsed
      && acc.account.data.parsed.info;
    const ui = info && info.tokenAmount && Number(info.tokenAmount.uiAmount);
    if (ui > 0) n += ui;
  }
  return n;
}

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

// ---- Straight off the chain ----
// Every token account of the mint, counting the ones with something in
// them. Two ways of asking, because the heavy one is not always allowed.
const CHAIN_MS = 15000;   // it runs once every ten minutes, so it can take its time
const PAGE = 1000;

// The indexed way, which Helius and a few others answer: pages of the
// mint's accounts, zero balances left out. Light enough that it works
// where the raw scan below is refused.
//
// The arguments go as a bare object, which is how these indexed calls are
// written, and as the usual array if that is refused. One of the two is
// right depending on whose RPC it is, and trying both costs nothing but a
// second call on an RPC that answers neither.
async function chainPaged(url, mint) {
  let wrap = false;
  let n = 0;
  for (let page = 1; page <= 25; page++) {
    const args = { mint, page, limit: PAGE, options: { showZeroBalance: false } };
    let r = await rpcAsk(url, 'getTokenAccounts', wrap ? [args] : args, CHAIN_MS);
    if (r.error && page === 1 && !wrap) {
      wrap = true;
      r = await rpcAsk(url, 'getTokenAccounts', [args], CHAIN_MS);
    }
    if (r.error) return { why: r.error };
    const list = r.result && r.result.token_accounts;
    if (!Array.isArray(list)) return { why: 'no accounts in the answer' };
    for (const acc of list) if (Number(acc.amount) > 0) n += 1;
    if (list.length < PAGE) break;
  }
  return { n };
}

// The plain way, in the words every Solana RPC knows: ask the token
// program for accounts of this mint and read the balance out of each.
// Heavy, and the free public RPC refuses it.
async function chainScan(url, mint) {
  const r = await rpcAsk(url, 'getProgramAccounts', [TOKEN_PROGRAM, {
    encoding: 'base64',
    dataSlice: { offset: 64, length: 8 },
    filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mint } }],
  }], CHAIN_MS);
  if (r.error) return { why: r.error };
  if (!Array.isArray(r.result)) return { why: 'no accounts in the answer' };
  if (!r.result.length) return { why: 'the scan came back empty, which is a refusal in all but name' };
  let n = 0;
  for (const acc of r.result) {
    const raw = acc && acc.account && acc.account.data && acc.account.data[0];
    if (!raw) continue;
    const bytes = atob(raw);
    let amount = 0;
    for (let i = 7; i >= 0; i--) amount = amount * 256 + bytes.charCodeAt(i);
    if (amount > 0) n += 1;
  }
  return { n };
}

async function holdersChain(env, mint) {
  const urls = [rpcUrl(env)];
  if (!env.SOLANA_RPC) urls.push('https://solana-rpc.publicnode.com');
  const why = [];
  for (const url of urls) {
    for (const ask of [chainPaged, chainScan]) {
      const got = await ask(url, mint);
      if (got.n > 0) return got;
      why.push(got.why || 'nothing');
    }
  }
  return { n: null, why: why.join(' / ') };
}

// The four in turn, stopping at the first that answers, and saying which
// one it was so a look at /api/token shows where the figure came from.
// The chain goes first where there is a private RPC to ask it through,
// because that count is the truth and the other three are somebody's
// index of it. Without one it goes last, where it will refuse anyway.
async function tokenHolders(env, mint) {
  const chain = ['chain', (m) => holdersChain(env, m)];
  const indexed = [['solscan', holdersSolscan], ['geckoterminal', holdersGecko],
    ['pump.fun', holdersPump]];
  const sources = env.SOLANA_RPC ? [chain].concat(indexed) : indexed.concat([chain]);
  const tried = [];
  for (const [from, ask] of sources) {
    let n = null;
    let why = 'nothing';
    try {
      // A source can answer with a count, or with a count and the reason
      // there isn't one, which is what /api/token shows under `tried`.
      const got = await ask(mint);
      if (got && typeof got === 'object') {
        n = countOf(got.n);
        if (!n && got.why) why = got.why;
      } else {
        n = countOf(got);
      }
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
    const [supply, counted, waiting] = await Promise.all([tokenSupply(env, mint),
      tokenHolders(env, mint), heldBack(env, mint)]);
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
        heldBack: waiting,
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
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Math.floor(Date.now() / 1000);

    // Nothing is written without the wallet's say so. A removal is signed
    // as well as a score, because taking somebody off is destructive where
    // a score only ever goes up.
    const wrong = await badSignature(body, game, address, now,
      body.remove === true ? 'remove' : body.score);
    if (wrong) return json(request, { error: wrong, signIn: true }, 401);

    // Taking yourself off the board. It carries no score, so it is handled
    // before one is asked for. A post from the game puts the wallet
    // straight back, so the game stops posting when somebody leaves; that
    // switch lives in their browser, which also means a removal somebody
    // else sent on your behalf undoes itself the next time you play.
    if (body.remove === true) {
      if (await tooSoon(env, 'rm:' + ip, REMOVE_EVERY, 0)) {
        return json(request, { error: 'slow down' }, 429);
      }
      await env.DB.prepare('DELETE FROM scores WHERE game = ?1 AND address = ?2')
        .bind(game, address).run();
      return json(request, { game, removed: true, board: await board(env, game, BOARD_SIZE) });
    }

    const score = number(body.score, rules.ceiling);
    if (score === null) return json(request, { error: 'that is not a score' }, 400);
    const meta = body.meta === undefined || body.meta === null
      ? null : number(body.meta, rules.metaCeiling);
    let name = cleanName(body.name);
    // One space is all a name gets. Asked for straight out, it is refused
    // and said so; carried along by a score going up, the score goes up
    // without it.
    if (name !== null && tooManySpaces(name)) {
      if (body.claim === true) return json(request, { error: 'one space', name }, 400);
      name = null;
    }
    // A post that is about the name, from the button in the game, rather
    // than a score going up in passing: it answers straight away and is
    // not held to the wallet's posting window, since a person pressed it.
    const claim = body.claim === true && name !== null;

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

    // A speed limit, for the games whose scores climb rather than being
    // set fresh by each run. The board already remembers what it last saw
    // and when, so it can work out the most that could honestly have been
    // earned since, and refuse anything past it. A patient cheat can still
    // walk a number up over hours, but the jump straight to a silly figure
    // is what makes a board look fake, and that is gone.
    let capped = score;
    if (rules.climb) {
      const seen = await env.DB.prepare(
        'SELECT score, updated_at FROM scores WHERE game = ?1 AND address = ?2',
      ).bind(game, address).first();
      if (seen) {
        const hours = Math.max(0, now - (seen.updated_at || now)) / 3600;
        const most = seen.score * Math.pow(rules.climb, hours) + rules.floor * (hours + 1);
        capped = Math.min(score, Math.max(seen.score, most));
      } else {
        // Nothing to measure against yet, so a first post starts at what
        // an hour of honest play could reach. The next one climbs from it.
        capped = Math.min(score, rules.floor * rules.climb);
      }
    }

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
    ).bind(game, address, name, capped, meta, now).run();

    // Old marks are worth nothing; sweeping them here keeps the table from
    // growing for ever without anything having to run on a timer.
    ctx.waitUntil(env.DB.prepare('DELETE FROM hits WHERE at < ?1').bind(now - 3600).run());

    return json(request, { game, name, board: await board(env, game, BOARD_SIZE) });
  },
};
