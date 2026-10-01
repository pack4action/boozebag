// The memes made counter, against a stand-in for the database.
const WORKER = new URL('./src/worker.js', import.meta.url).href;
const fails = [];
const ok = (n, c, saw) => { if (!c) fails.push(n + (saw !== undefined ? ' saw ' + JSON.stringify(saw) : '')); };

function fakeDb() {
  const cracks = new Map();   // day -> n
  const hits = new Map();     // key -> at
  const made = [];
  const run = (sql, args) => {
    if (/CREATE TABLE/i.test(sql)) { made.push(sql.match(/EXISTS (\w+)/)[1]); return { success: true }; }
    if (/INSERT INTO memes/i.test(sql)) {
      const [day] = args;
      cracks.set(day, (cracks.get(day) || 0) + 1);
      return { success: true };
    }
    if (/INSERT OR REPLACE INTO hits/i.test(sql)) { hits.set(args[0], args[1]); return { success: true }; }
    if (/DELETE FROM hits/i.test(sql)) return { success: true };
    throw new Error('unexpected write: ' + sql);
  };
  const first = (sql, args) => {
    if (/SELECT n FROM memes/i.test(sql)) { const n = cracks.get(args[0]); return n === undefined ? null : { n }; }
    if (/SELECT SUM\(n\) AS n FROM memes/i.test(sql)) {
      let t = 0; cracks.forEach((v) => { t += v; });
      return { n: t || null };
    }
    if (/SELECT at FROM hits/i.test(sql)) { const at = hits.get(args[0]); return at === undefined ? null : { at }; }
    if (/COUNT\(\*\)/i.test(sql)) return { n: 0 };
    throw new Error('unexpected read: ' + sql);
  };
  return {
    cracks, hits, made,
    prepare(sql) {
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async run() { return run(sql, args); },
        async first() { return first(sql, args); },
        async all() { return { results: [] }; },
      };
      return api;
    },
  };
}

let n = 0;
async function fresh() {
  const db = fakeDb();
  const mod = await import(WORKER + '?fresh=' + (++n));
  const call = async (method, body, ip) => {
    const req = new Request('https://x/api/memes', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { Origin: 'https://boozebag.us', 'CF-Connecting-IP': ip || '1.2.3.4' },
    });
    const res = await mod.default.fetch(req, { DB: db }, { waitUntil() {} });
    return { status: res.status, body: await res.json(), cors: res.headers.get('access-control-allow-origin') };
  };
  return { db, call };
}

// Reading an empty counter.
{
  const { call, db } = await fresh();
  const r = await call('GET');
  ok('empty: answers', r.status === 200, r.status);
  ok('empty: zeroes', r.body.today === 0 && r.body.total === 0, r.body);
  ok('empty: allowed on the site', r.cors === 'https://boozebag.us', r.cors);
  ok('empty: made its own table', db.made.includes('memes'), db.made);
}

// A meme, then another from somewhere else.
{
  const { call } = await fresh();
  let r = await call('POST', {});
  ok('one counts', r.status === 200 && r.body.today === 1 && r.body.total === 1, r.body);
  r = await call('POST', { n: 500 }, '9.9.9.9');
  ok('a number asked for is ignored, it is one', r.body.today === 2 && r.body.total === 2, r.body);
}

// The same place straight away is told to wait, and still gets the count.
{
  const { call } = await fresh();
  await call('POST', {}, '5.5.5.5');
  const r = await call('POST', {}, '5.5.5.5');
  ok('too soon', r.status === 429 && r.body.total === 1, r);
}

// The wrong method.
{
  const { call } = await fresh();
  const r = await call('DELETE');
  ok('delete is refused', r.status === 405, r.status);
}

console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'PASS');
