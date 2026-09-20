// A post has to be signed by the wallet it names, through a key the
// wallet handed the right to post.
import { keypair, grantText, postText } from './test-sign.mjs';
const WORKER = new URL('./src/worker.js', import.meta.url).href;
const fails = [];
const ok = (n, c, saw) => { if (!c) fails.push(n + (saw !== undefined ? ' saw ' + JSON.stringify(saw) : '')); };

function fakeDb() {
  const scores = new Map();
  const hits = new Map();
  const key = (g, a) => g + '|' + a;
  const run = (sql, args) => {
    if (/CREATE TABLE/i.test(sql)) return { success: true };
    if (/INSERT INTO scores/i.test(sql)) {
      const [game, address, name, score, meta, at] = args;
      const k = key(game, address); const was = scores.get(k);
      scores.set(k, was ? { score: Math.max(was.score, score), meta, name: name === null ? was.name : name, updated_at: at }
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
    if (/SELECT address FROM scores/i.test(sql)) return null;
    if (/SELECT at FROM hits/i.test(sql)) { const at = hits.get(args[0]); return at === undefined ? null : { at }; }
    if (/COUNT\(\*\)/i.test(sql)) return { n: 0 };
    throw new Error('unexpected read: ' + sql);
  };
  return {
    scores,
    prepare(sql) {
      let args = [];
      const api = { bind(...a) { args = a; return api; },
        async run() { return run(sql, args); },
        async first() { return first(sql, args); },
        async all() { return { results: [] }; } };
      return api;
    },
  };
}

let n = 0;
async function fresh() {
  const db = fakeDb();
  const mod = await import(WORKER + '?sign=' + (++n));
  let ip = 0;
  const post = async (body) => {
    const req = new Request('https://x/api/scores', { method: 'POST', body: JSON.stringify(body),
      headers: { Origin: 'https://boozebag.xyz', 'CF-Connecting-IP': '10.1.0.' + (++ip) } });
    const res = await mod.default.fetch(req, { DB: db }, { waitUntil() {} });
    return { status: res.status, body: await res.json() };
  };
  return { db, post, scoreOf: (g, a) => (db.scores.get(g + '|' + a) || {}).score ?? null };
}

const now = () => Math.floor(Date.now() / 1000);
const GAME = 'beer-mile';

// A wallet, a session key it has signed for, and a properly signed post.
async function signedPost(wallet, session, score, over) {
  const until = (over && over.until) || now() + 3600;
  const ts = (over && over.ts) || now();
  const subject = over && 'subject' in over ? over.subject : score;
  return {
    game: GAME, address: wallet.pub, score,
    auth: {
      key: (over && over.key) || session.pub,
      until,
      grant: (over && over.grant) || await wallet.sign(grantText(wallet.pub, session.pub, until)),
      sig: (over && over.sig) || await session.sign(postText(GAME, wallet.pub, subject, ts)),
      ts,
    },
  };
}

const wallet = await keypair();
const session = await keypair();
const other = await keypair();

{
  const { post, scoreOf } = await fresh();
  const r = await post(await signedPost(wallet, session, 5000));
  ok('a properly signed score goes up', r.status === 200 && scoreOf(GAME, wallet.pub) === 5000, r);
}
{
  const { post } = await fresh();
  const r = await post({ game: GAME, address: wallet.pub, score: 5000 });
  ok('an unsigned post is refused', r.status === 401, r);
  ok('and is told to sign in', r.body.signIn === true, r.body);
}
{
  // The number changed after the signature was made.
  const { post, scoreOf } = await fresh();
  const body = await signedPost(wallet, session, 5000);
  body.score = 29000;
  const r = await post(body);
  ok('a score changed after signing is refused', r.status === 401, r);
  ok('and nothing was written', scoreOf(GAME, wallet.pub) === null);
}
{
  // Somebody else's key, signed by their own wallet, put under this name.
  const { post } = await fresh();
  const body = await signedPost(wallet, session, 5000);
  body.auth.grant = await other.sign(grantText(wallet.pub, session.pub, body.auth.until));
  const r = await post(body);
  ok('a note signed by another wallet is refused', r.status === 401, r);
}
{
  // A key that was never granted anything.
  const { post } = await fresh();
  const body = await signedPost(wallet, session, 5000);
  body.auth.sig = await other.sign(postText(GAME, wallet.pub, 5000, body.auth.ts));
  const r = await post(body);
  ok('a score signed by a key with no note is refused', r.status === 401, r);
}
{
  const { post } = await fresh();
  const r = await post(await signedPost(wallet, session, 5000, { until: now() - 60 }));
  ok('an expired note is refused', r.status === 401, r);
}
{
  const { post } = await fresh();
  const r = await post(await signedPost(wallet, session, 5000, { until: now() + 400 * 86400 }));
  ok('a note that lasts for ever is refused', r.status === 401, r);
}
{
  const { post } = await fresh();
  const r = await post(await signedPost(wallet, session, 5000, { ts: now() - 4000 }));
  ok('a post from hours ago is refused', r.status === 401, r);
}
{
  const { post } = await fresh();
  const r = await post({ game: GAME, address: wallet.pub, score: 5000,
    auth: { key: session.pub, until: now() + 3600, grant: 'not base58 !!', sig: 'nor this', ts: now() } });
  ok('rubbish where a signature should be is refused', r.status === 401, r);
}
{
  // Taking yourself off has to be signed too.
  const { post, scoreOf } = await fresh();
  await post(await signedPost(wallet, session, 5000));
  let r = await post({ game: GAME, address: wallet.pub, remove: true });
  ok('an unsigned removal is refused', r.status === 401, r);
  ok('and the row is still there', scoreOf(GAME, wallet.pub) === 5000);
  const until = now() + 3600;
  const ts = now();
  r = await post({ game: GAME, address: wallet.pub, remove: true,
    auth: { key: session.pub, until, ts,
      grant: await wallet.sign(grantText(wallet.pub, session.pub, until)),
      sig: await session.sign(postText(GAME, wallet.pub, 'remove', ts)) } });
  ok('a signed removal goes through', r.status === 200, r);
  ok('and the row is gone', scoreOf(GAME, wallet.pub) === null);
}
{
  // One note covers a run of posts; the wallet is only asked once.
  const { post, scoreOf } = await fresh();
  const until = now() + 3600;
  const grant = await wallet.sign(grantText(wallet.pub, session.pub, until));
  const saw = [];
  for (const score of [1000, 2000, 3000]) {
    const ts = now();
    const r = await post({ game: GAME, address: wallet.pub, score,
      auth: { key: session.pub, until, grant, ts,
        sig: await session.sign(postText(GAME, wallet.pub, score, ts)) } });
    saw.push(r.status);
  }
  // The same note is good for every one of them: none comes back as not
  // signed. A wallet may only post every twenty seconds, so the later two
  // are told to wait, which is the posting window doing its job and not
  // the signature failing.
  ok('one note covers a run of posts', saw.every((st) => st !== 401), saw);
  ok('and the posting window still applies', saw[0] === 200 && saw[1] === 429, saw);
  ok('with the first one on the board', scoreOf(GAME, wallet.pub) === 1000, scoreOf(GAME, wallet.pub));
}

console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'PASS');
process.exit(fails.length ? 1 : 0);
