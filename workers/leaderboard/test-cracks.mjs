// The shared crack counter, against a stand-in for the database.
const WORKER = new URL('./src/worker.js', import.meta.url).href;
const fails = [];
const ok = (n, c, saw) => { if (!c) fails.push(n + (saw !== undefined ? ' saw ' + JSON.stringify(saw) : '')); };

function fakeDb() {
  const cracks = new Map();   // day -> n
  const hits = new Map();     // key -> at
  const made = [];
  const run = (sql, args) => {
    if (/CREATE TABLE/i.test(sql)) { made.push(sql.match(/EXISTS (\w+)/)[1]); return { success: true }; }
    if (/INSERT INTO cracks/i.test(sql)) {
      const [day, n] = args;
      cracks.set(day, (cracks.get(day) || 0) + n);
      return { success: true };
    }
    if (/INSERT OR REPLACE INTO hits/i.test(sql)) { hits.set(args[0], args[1]); return { success: true }; }
    if (/DELETE FROM hits/i.test(sql)) return { success: true };
    throw new Error('unexpected write: ' + sql);
  };
  const first = (sql, args) => {
    if (/SELECT n FROM cracks/i.test(sql)) { const n = cracks.get(args[0]); return n === undefined ? null : { n }; }
    if (/SELECT SUM\(n\) AS n FROM cracks/i.test(sql)) {
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
    const req = new Request('https://x/api/cracks', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { Origin: 'https://boozebag.xyz', 'CF-Connecting-IP': ip || '1.2.3.4' },
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
  ok('empty: allowed on the site', r.cors === 'https://boozebag.xyz', r.cors);
  ok('empty: made its own table', db.made.includes('cracks'), db.made);
}

// A press, then more.
{
  const { call } = await fresh();
  let r = await call('POST', { n: 1 });
  ok('one press counts', r.status === 200 && r.body.today === 1 && r.body.total === 1, r.body);
  r = await call('POST', { n: 5 }, '9.9.9.9');
  ok('a batch of five counts', r.body.today === 6 && r.body.total === 6, r.body);
  r = await call('GET');
  ok('and reading agrees', r.body.today === 6, r.body);
}

// The limits.
{
  const { call } = await fresh();
  let r = await call('POST', { n: 9999 }, '5.5.5.5');
  ok('a silly number is capped', r.body.today === 25, r.body);
  r = await call('POST', { n: 1 }, '5.5.5.5');
  ok('the same place is told to wait', r.status === 429, r.status);
  ok('and still gets the count', r.body.today === 25, r.body);
  r = await call('POST', { n: 1 }, '6.6.6.6');
  ok('but somewhere else is fine', r.status === 200 && r.body.today === 26, r.body);
}

// Rubbish in the body.
{
  const { call } = await fresh();
  const req = new Request('https://x/api/cracks', { method: 'POST', body: 'not json',
    headers: { 'CF-Connecting-IP': '7.7.7.7' } });
  const mod = await import(WORKER + '?fresh=' + (++n));
  const res = await mod.default.fetch(req, { DB: fakeDb() }, { waitUntil() {} });
  ok('rubbish counts as one', res.status === 200, res.status);
  const r2 = await call('POST', { n: -4 }, '8.8.8.8');
  ok('a negative counts as one', r2.body.today === 1, r2.body);
}

// The wrong method.
{
  const { call } = await fresh();
  const r = await call('DELETE');
  ok('delete is refused', r.status === 405, r.status);
}

console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'PASS');
