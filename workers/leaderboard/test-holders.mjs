// The Worker's holder lookup, with each source made to answer or refuse.
const WORKER = new URL('./src/worker.js', import.meta.url).href;
const MINT = '3kxChnv5tabrhuuNUyMLPNYAF4XXodRFfDAmKjvcpump';
const fails = [];
const ok = (n, c, saw) => { if (!c) fails.push(n + (saw !== undefined ? ' saw ' + JSON.stringify(saw) : '')); };

function stubFetch(plan) {
  const seen = [];
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    seen.push(u);
    const J = (o) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
    if (u.includes('solscan')) return plan.solscan ? J(plan.solscan) : new Response('no', { status: 403 });
    if (u.includes('geckoterminal')) return plan.gecko ? J(plan.gecko) : new Response('no', { status: 404 });
    if (u.includes('pump.fun')) return plan.pump ? J(plan.pump) : new Response('no', { status: 500 });
    // an RPC POST
    const body = JSON.parse(opts.body);
    if (body.method === 'getTokenSupply') return J({ result: { value: { uiAmount: 1e9, decimals: 6 } } });
    if (body.method === 'getTokenAccounts') {
      // The indexed way, which only some RPCs answer.
      if (!plan.paged) return J({ error: { message: 'Method not found' } });
      const page = body.params[0].page;
      const rows = page === 1 ? plan.paged.map((amt) => ({ amount: amt })) : [];
      return J({ result: { token_accounts: rows } });
    }
    if (body.method === 'getProgramAccounts') {
      if (!plan.chain) return new Response('no', { status: 410 });
      const acc = (amt) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(amt)); return { account: { data: [b.toString('base64')] } }; };
      return J({ result: [acc(5), acc(0), acc(7), acc(3)] });   // three with a balance
    }
    return new Response('no', { status: 404 });
  };
  return seen;
}

let n = 0;
async function run(name, plan, expectHolders, expectFrom, env) {
  const seen = stubFetch(plan);
  const mod = await import(WORKER + '?fresh=' + (++n));
  const req = new Request('https://x/api/token', { headers: { Origin: 'https://boozebag.xyz' } });
  const res = await mod.default.fetch(req, env || {}, { waitUntil() {} });
  const body = await res.json();
  ok(name + ': status', res.status === 200, res.status);
  ok(name + ': holders', body.holders === expectHolders, { got: body.holders, want: expectHolders });
  ok(name + ': from', body.holdersFrom === expectFrom, { got: body.holdersFrom, want: expectFrom });
  return { body, seen };
}

const SOLSCAN = { data: { holder: 1234 } };
const GECKO = { data: { attributes: { holders: { count: 987 } } } };
const PUMP = { usd_market_cap: 3800.5, holder_count: 654 };
const PUMP_NOHOLD = { usd_market_cap: 3800.5 };

// Each source in turn is the first that answers.
let r = await run('solscan first', { solscan: SOLSCAN, gecko: GECKO, pump: PUMP, chain: true }, 1234, 'solscan');
ok('solscan first: gecko never asked', !r.seen.some((u) => u.includes('geckoterminal')), r.seen);
ok('solscan first: cap still read', r.body.marketCap === 3801, r.body.marketCap);

r = await run('gecko when solscan is out', { gecko: GECKO, pump: PUMP, chain: true }, 987, 'geckoterminal');
r = await run('pump when those two are out', { pump: PUMP, chain: true }, 654, 'pump.fun');
r = await run('chain when nobody else has it', { pump: PUMP_NOHOLD, chain: true }, 3, 'chain');
ok('chain: counts only the accounts holding something', r.body.holders === 3, r.body.holders);

// Nothing answers at all.
r = await run('all out', { pump: PUMP_NOHOLD }, null, null);
ok('all out: supply and cap still there', r.body.supply === 1e9 && r.body.marketCap === 3801, r.body);

// A junk answer is not mistaken for a count.
await run('junk ignored', { solscan: { data: { holder: 'lots' } }, gecko: GECKO, pump: PUMP, chain: true }, 987, 'geckoterminal');
await run('zero ignored', { solscan: { data: { holder: 0 } }, gecko: GECKO, pump: PUMP, chain: true }, 987, 'geckoterminal');

// The last good count is kept for a day when a later look finds nothing.
{
  const realNow = Date.now;
  let clock = realNow.call(Date);
  Date.now = () => clock;
  stubFetch({ solscan: SOLSCAN, pump: PUMP });
  const mod = await import(WORKER + '?fresh=' + (++n));
  const call = async () => (await (await mod.default.fetch(new Request('https://x/api/token'), {}, { waitUntil() {} })).json());
  const first = await call();
  ok('held: first look finds it', first.holders === 1234, first.holders);

  stubFetch({ pump: PUMP_NOHOLD });                 // every source now refuses
  clock += 11 * 60 * 1000;                          // past the ten minute hold
  const later = await call();
  ok('held: the figure survives a refusal', later.holders === 1234, later.holders);
  ok('held: and says it is being held', later.holdersFrom === 'solscan (held)', later.holdersFrom);

  clock += 25 * 60 * 60 * 1000;                     // past the day it is kept for
  const stale = await call();
  ok('held: after a day it lets go', stale.holders === null, stale.holders);
  Date.now = realNow;
}

// With a private RPC to ask through, the chain is asked first: that count
// is the truth, where the other three are somebody's index of it.
{
  const RPC = { SOLANA_RPC: 'https://mainnet.example/?api-key=x' };
  let r2 = await run('a key puts the chain first',
    { solscan: SOLSCAN, gecko: GECKO, pump: PUMP, chain: true }, 3, 'chain', RPC);
  ok('a key puts the chain first: nobody else is asked',
    !r2.seen.some((u) => u.includes('solscan') || u.includes('geckoterminal')), r2.seen);
  // And when the chain refuses anyway, the indexers still answer.
  r2 = await run('a chain that refuses falls back',
    { solscan: SOLSCAN, gecko: GECKO, pump: PUMP, chain: false }, 1234, 'solscan', RPC);
  // Where the RPC answers the indexed call, that is what is used, and
  // the heavy scan is never sent.
  r2 = await run('the indexed call is preferred',
    { paged: [5, 9, 12], solscan: SOLSCAN, chain: true }, 3, 'chain', RPC);
  ok('the indexed call is preferred: no heavy scan',
    !r2.seen.some((u) => u.includes('publicnode')), r2.seen);
  // A refusal of the chain says why, rather than "nothing".
  r2 = await run('a refusal says why', { chain: false }, null, null, RPC);
  ok('a refusal says why: the reason is passed on',
    r2.body.tried[0].includes('chain: ') && !r2.body.tried[0].endsWith('nothing'), r2.body.tried);
}

console.log(fails.length ? 'FAIL\n' + fails.join('\n') : 'PASS');
