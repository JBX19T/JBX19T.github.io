import assert from 'node:assert/strict';
import worker from '../holders.mjs';
const env = { ALLOWED_ORIGIN: 'https://jbx19t.github.io,https://localhost', APP_TOKEN: 'segredo', HL_AGENT_KEY: '0x' + '22'.repeat(32), HL_ACCOUNT: '0x' + '33'.repeat(20), SOL_KEY: undefined };
globalThis.fetch = async (u, o = {}) => {
  const b = o.body ? JSON.parse(o.body) : {}, R = j => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
  if (String(u).endsWith('/info')) {
    if (b.type === 'perpDexs') return R([null, { name: 'xyz' }]);
    if (b.type === 'meta') return R({ universe: b.dex === 'xyz' ? [{ name: 'xyz:GOLD', szDecimals: 4, maxLeverage: 10 }] : [] });
    if (b.type === 'allMids') return R(b.dex === 'xyz' ? { 'xyz:GOLD': '4000' } : {});
    if (b.type === 'clearinghouseState') return R({ marginSummary: { accountValue: '50' }, assetPositions: [] });
    if (b.type === 'openOrders') return R([]);
  }
  throw new Error('fetch inesperado ' + u);
};
const call = (path, { method = 'GET', token, origin = 'https://jbx19t.github.io', body } = {}) =>
  worker.fetch(new Request('https://w.example' + path, { method, headers: { Origin: origin, ...(token ? { 'x-token': token } : {}), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {} });
assert.equal((await call('/hl/state')).status, 401);
assert.equal((await call('/hl/state', { token: 'errado' })).status, 401);
assert.equal((await call('/hl/state', { token: 'segredo', origin: 'https://evil.example' })).status, 403);
assert.equal((await call('/sol/state', { token: 'segredo' })).status, 502);   // sem SOL_KEY: erro claro, nada enviado
const ok = await call('/hl/state', { token: 'segredo' }); assert.equal(ok.status, 200);
const j = await ok.json(); assert.equal(j.mode, 'simulacao'); assert.equal(j.network, 'testnet'); assert.equal(j.markets.GOLD.coin, 'xyz:GOLD'); assert.equal(j.account.xyz, 50);
const s = await call('/hl/sync', { method: 'POST', token: 'segredo', body: { desired: { GOLD: { side: 'long', frac: 0.5 } } } }); const sj = await s.json();
assert.equal(s.status, 200); assert.equal(sj.mode, 'simulacao'); assert.equal(sj.results.length, 0); assert.equal(sj.plan[0].op, 'open'); assert.ok(sj.plan[0].usd <= 15);
assert.equal((await call('/hl/nada', { token: 'segredo' })).status, 404);
assert.equal((await worker.fetch(new Request('https://w.example/hl/state', { method: 'OPTIONS', headers: { Origin: 'https://jbx19t.github.io' } }), env, {})).status, 200);
console.log('router ok');
