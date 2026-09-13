// What the board accepts and what it refuses, run against a Worker that is
// already up. Start one first:
//
//   npx wrangler@3 d1 execute boozebag --local --file=./schema.sql
//   npx wrangler@3 dev --port 8799 --local
//   node test.mjs
//
// Every wallet here is a different one, because a wallet may only post
// every twenty seconds and the point is to test that, not to wait for it.
const BASE = process.env.BASE || 'http://127.0.0.1:8799';
// Rolled fresh each run: a wallet may only post every twenty seconds, and
// the local database remembers the last run.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const wallet = () => Array.from({ length: 44 },
  () => B58[Math.floor(Math.random() * B58.length)]).join('');
const W = [wallet(), wallet(), wallet(), wallet(), wallet()];
// The IP limit is one post every three seconds, and everything here comes
// from the same machine.
const GAP = 3200;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(body) {
  const r = await fetch(BASE + '/api/scores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function get(game) {
  const r = await fetch(BASE + '/api/scores?game=' + game);
  return { status: r.status, body: await r.json().catch(() => null) };
}

const fails = [];
const ok = (name, cond, saw) => {
  if (!cond) fails.push(name + (saw === undefined ? '' : ' (saw ' + JSON.stringify(saw) + ')'));
};

const good = await post({ game: 'gym-tycoon', address: W[0], score: 500, meta: 2, name: 'Sweatbox' });
ok('a score is taken', good.status === 200, good.status);
ok('and comes back on the board',
  good.body && good.body.board && good.body.board.some((e) => e.address === W[0] && e.score === 500));

await wait(GAP);
const dearer = await post({ game: 'gym-tycoon', address: W[1], score: 90000, meta: 12, name: 'Iron Palace' });
ok('a second wallet is taken', dearer.status === 200, dearer.status);
// Ranked against each other rather than against the whole board: the
// local database keeps whatever earlier runs left in it.
const rank = (b, a) => (b || []).findIndex((e) => e.address === a);
ok('and the dearer of the two ranks above the cheaper',
  dearer.body && dearer.body.board
  && rank(dearer.body.board, W[1]) >= 0
  && rank(dearer.body.board, W[1]) < rank(dearer.body.board, W[0]),
  dearer.body && dearer.body.board && dearer.body.board.slice(0, 3));

await wait(GAP);
const again = await post({ game: 'gym-tycoon', address: W[0], score: 700, meta: 3 });
ok('the same wallet inside twenty seconds is refused', again.status === 429, again.status);

await wait(GAP);
const noGame = await post({ game: 'not-a-game', address: W[2], score: 10 });
ok('a game that does not exist is refused', noGame.status === 400, noGame.status);

await wait(GAP);
const noWallet = await post({ game: 'gym-tycoon', address: 'hello', score: 10 });
ok('something that is not a wallet is refused', noWallet.status === 400, noWallet.status);

await wait(GAP);
const silly = await post({ game: 'gym-tycoon', address: W[2], score: 1e30 });
ok('a score no play could reach is refused', silly.status === 400, silly.status);

await wait(GAP);
const negative = await post({ game: 'gym-tycoon', address: W[2], score: -5 });
ok('a score below nothing is refused', negative.status === 400, negative.status);

await wait(GAP);
const dressed = await post({ game: 'gym-tycoon', address: W[3], score: 40,
  name: '  Iron​Palace  and a great deal more than twenty characters  ' });
const row = dressed.body && dressed.body.board
  && dressed.body.board.find((e) => e.address === W[3]);
ok('a name is taken', dressed.status === 200, dressed.status);
ok('with the invisible characters out and cut to twenty',
  row && row.name === 'IronPalace and a gre', row && row.name);

// More than twenty seconds have passed by now, so this one is taken --
// and a wallet's row is its best, so a worse run leaves it where it was.
await wait(GAP);
const lower = await post({ game: 'gym-tycoon', address: W[1], score: 1, meta: 1 });
ok('a later worse run is taken', lower.status === 200, lower.status);
const kept = lower.body && lower.body.board && lower.body.board.find((e) => e.address === W[1]);
ok('and does not pull the wallet down', kept && kept.score === 90000, kept);

const board = await get('gym-tycoon');
ok('the board reads back', board.status === 200, board.status);
ok('in order, best first', board.body && board.body.board
  && board.body.board.every((e, i, all) => i === 0 || all[i - 1].score >= e.score),
  board.body && board.body.board && board.body.board.map((e) => e.score));
const badGame = await get('nope');
ok('a board for a game that does not exist is refused', badGame.status === 400, badGame.status);

console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS');
process.exit(fails.length ? 1 : 0);
