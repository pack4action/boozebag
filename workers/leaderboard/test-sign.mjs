// Signing, for the tests: a stand-in wallet and the two notes the Worker
// checks. Kept next to the tests rather than in the Worker so the Worker
// carries nothing it does not need in production.
import { webcrypto } from 'node:crypto';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
  return out;
}

export async function keypair() {
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const raw = new Uint8Array(await webcrypto.subtle.exportKey('raw', kp.publicKey));
  return {
    pub: b58encode(raw),
    async sign(text) {
      const sig = await webcrypto.subtle.sign('Ed25519', kp.privateKey,
        new TextEncoder().encode(text));
      return b58encode(new Uint8Array(sig));
    },
  };
}

export const grantText = (address, key, until) => '$BOOZEBAG leaderboard\n'
  + 'wallet: ' + address + '\nkey: ' + key + '\nuntil: ' + until;
export const postText = (game, address, score, ts) => '$BOOZEBAG score\n'
  + 'game: ' + game + '\nwallet: ' + address + '\nscore: ' + score + '\nat: ' + ts;

// A wallet with a session key already signed for, which can sign a post
// the way the site does.
export async function signer() {
  const wallet = await keypair();
  const session = await keypair();
  const until = Math.floor(Date.now() / 1000) + 3600;
  const grant = await wallet.sign(grantText(wallet.pub, session.pub, until));
  return {
    address: wallet.pub,
    wallet,
    session,
    async auth(game, subject) {
      const ts = Math.floor(Date.now() / 1000);
      return { key: session.pub, until, grant, ts,
        sig: await session.sign(postText(game, wallet.pub, subject, ts)) };
    },
  };
}
