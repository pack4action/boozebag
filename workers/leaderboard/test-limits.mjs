// What the board will and will not believe: the ceiling on each game, and
// the speed limit on the one whose score climbs.
import { signer } from './test-sign.mjs';
const WORKER = new URL('./src/worker.js', import.meta.url).href;
const fails = [];
const ok = (n, c, saw) => { if (!c) fails.push(n + (saw !== undefined ? ' saw ' + JSON.stringify(saw) : '')); };

// Two stand-in players, each with a wallet that can sign.
const P1 = await signer();
const P2 = await signer();
const W1 = P1.address;
const W2 = P2.address;
const who = { [W1]: P1, [W2]: P2 };

// A stand-in for the scores table, enough of it for these.
function fakeDb(rows) {
  const scores = new Map(rows || []);   // game|address -> {score, updated_at, name}
  const hits = new Map();
  const key = (g, a) => g + '|' + a;
  const run = (sql, args) => {
    if (/CREATE TABLE/i.test(sql)) return { success: true };
    if (/INSERT INTO scores/i.test(sql)) {
      const [game, address, name, score, meta, at] = args;
      const k = key(game, address);
      const was = scores.get(k);
      scores.set(k, was
        ? { score: Math.max(was.score, score), meta: score >= was.score ? meta : was.meta,
            name: name === null ? was.name : name, updated_at: at }
        : { score, meta, name, updated_at: at });
      return { success: true };
    }
    if (/DELETE FROM scores/i.test(sql)) { scores.delete(key(args[0], args[1])); return { success: true }; }
    if (/INSERT OR REPLACE INTO hits/i.test(sql)) { hits.set(args[0], args[1]); return { success: true }; }
    if (/DELETE FROM hits/i.test(sql)) return { success: true };
    throw new Error('unexpected write: ' + sql);
  };
  const first = (sql, args) => {
    if (/SELECT score, updated_at FROM scores/i.test(sql)) return scores.get(key(args[0], args[1])) || null;
    if (/SELECT address FROM scores/i.test(sql)) {
      for (const [k, v] of scores) {
        const [g, a] = k.split('|');
        if (g === args[0] && v.name && v.name.toLowerCase() === String(args[1]).toLowerCase() && a !== args[2]) {
          return { address: a };
        }
      }
      return null;
    }
    if (/SELECT at FROM hits/i.test(sql)) { const at = hits.get(args[0]); return at === undefined ? null : { at }; }
    if (/COUNT\(\*\)/i.test(sql)) return { n: 0 };
    throw new Error('unexpected read: ' + sql);
  };
  const all = (sql, args) => {
    if (/FROM scores/i.test(sql)) {
      const out = [];
      for (const [k, v] of scores) {
        const [g, a] = k.split('|');
        if (g === args[0]) out.push({ address: a, name: v.name, score: v.score, meta: v.meta, updated_at: v.updated_at });
      }
      out.sort((x, y) => y.score - x.score);
      return { results: out };
    }
    return { results: [] };
  };
  return {
    scores,
    prepare(sql) {
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async run() { return run(sql, args); },
        async first() { return first(sql, args); },
        async all() { return all(sql, args); },
      };
      return api;
    },
  };
}

let n = 0;
async function fresh(rows) {
  const db = fakeDb(rows);
  const mod = await import(WORKER + '?limits=' + (++n));
  // Every post comes from its own address of origin, because the point
  // here is what the board believes, not how fast it is asked.
  let ip = 0;
  const post = async (body) => {
    // Everything the board is asked to write has to be signed, so the
    // tests sign it the way the site does.
    if (!body.auth && who[body.address]) {
      body = { ...body, auth: await who[body.address].auth(body.game,
        body.remove === true ? 'remove' : body.score) };
    }
    const req = new Request('https://x/api/scores', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { Origin: 'https://boozebag.xyz', 'CF-Connecting-IP': '10.0.0.' + (++ip) },
    });
    const res = await mod.default.fetch(req, { DB: db }, { waitUntil() {} });
    return { status: res.status, body: await res.json() };
  };
  const scoreOf = (game, address) => {
    const row = db.scores.get(game + '|' + address);
    return row ? row.score : null;
  };
  return { db, post, scoreOf };
}

const HOUR = 3600;
const nowS = () => Math.floor(Date.now() / 1000);

// The ceilings on the games played in runs.
{
  const { post, scoreOf } = await fresh();
  let r = await post({ game: 'beer-mile', address: W1, score: 8320 });
  ok('beer mile: a perfect run goes up whole', scoreOf('beer-mile', W1) === 8320, r.body);
  r = await post({ game: 'beer-mile', address: W2, score: 1e6 });
  ok('beer mile: a million is refused', r.status === 400, r.status);
  r = await post({ game: 'degen-pong', address: W2, score: 1e7 });
  ok('pong: ten million is refused', r.status === 400, r.status);
  r = await post({ game: 'degen-pong', address: W2, score: 4200 });
  ok('pong: a strong run is fine', scoreOf('degen-pong', W2) === 4200, r.body);
  r = await post({ game: 'gains-stacker', address: W2, score: 1e7 });
  ok('stacker: ten million is refused', r.status === 400, r.status);
}

// The speed limit on the gym.
{
  const { post, scoreOf } = await fresh();
  // A first post is held to what an hour could reach.
  let r = await post({ game: 'gym-tycoon', address: W1, score: 1e15 });
  const first = scoreOf('gym-tycoon', W1);
  ok('gym: a first post cannot be anything at all', first < 1e15 && first > 0, first);
  ok('gym: and what it is allowed is generous', first === 5e6 * 64, first);
}
{
  // A wallet the board saw an hour ago at two million.
  const seen = { score: 2e6, meta: 100, name: 'them', updated_at: nowS() - HOUR };
  const { post, scoreOf } = await fresh([['gym-tycoon|' + W1, seen]]);
  let r = await post({ game: 'gym-tycoon', address: W1, score: 1e18 });
  const got = scoreOf('gym-tycoon', W1);
  ok('gym: a trillion out of nowhere is cut down', got < 1e18, got);
  ok('gym: to what an hour of play could earn', got <= 2e6 * 64 + 5e6 * 2 && got > 2e6, got);
  // An honest climb in that hour goes up whole.
  const { post: p2, scoreOf: s2 } = await fresh([['gym-tycoon|' + W1, seen]]);
  await p2({ game: 'gym-tycoon', address: W1, score: 9e6 });
  ok('gym: an honest hour goes up whole', s2('gym-tycoon', W1) === 9e6, s2('gym-tycoon', W1));
  // And a score that has not moved is left alone.
  const { post: p3, scoreOf: s3 } = await fresh([['gym-tycoon|' + W1, seen]]);
  await p3({ game: 'gym-tycoon', address: W1, score: 1e6 });
  ok('gym: a smaller score leaves the board as it was', s3('gym-tycoon', W1) === 2e6, s3('gym-tycoon', W1));
}
{
  // Seconds after the last post, not an hour: the allowance is tiny.
  const seen = { score: 2e6, meta: 100, name: 'them', updated_at: nowS() - 30 };
  const { post, scoreOf } = await fresh([['gym-tycoon|' + W1, seen]]);
  await post({ game: 'gym-tycoon', address: W1, score: 1e12 });
  const got = scoreOf('gym-tycoon', W1);
  ok('gym: thirty seconds does not buy a trillion', got < 2e7, got);
  ok('gym: but it does buy thirty seconds of earning', got > 2e6, got);
}

// A name holds one space at most.
{
  const { post, db } = await fresh();
  const nameOf = (g, a) => (db.scores.get(g + '|' + a) || {}).name;
  let r = await post({ game: 'beer-mile', address: W1, score: 5000, name: 'Booze Bag', claim: true });
  ok('one space is a name', r.status === 200 && nameOf('beer-mile', W1) === 'Booze Bag', r.body);
  r = await post({ game: 'beer-mile', address: W1, score: 5100, name: 'Booze Bag Gym', claim: true });
  ok('two spaces are refused', r.status === 400 && r.body.error === 'one space', r.body);
  ok('and the old name stands', nameOf('beer-mile', W1) === 'Booze Bag', nameOf('beer-mile', W1));
  r = await post({ game: 'beer-mile', address: W2, score: 5200, name: 'a  b  c' });
  ok('a score carrying one goes up without the name',
    r.status === 200 && !nameOf('beer-mile', W2), r.body);
  r = await post({ game: 'beer-mile', address: W2, score: 5300, name: '  padded  name  ', claim: true });
  ok('padding is squeezed out before the count',
    r.status === 200 && nameOf('beer-mile', W2) === 'padded name', r.body);
}

console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'PASS');
process.exit(fails.length ? 1 : 0);
