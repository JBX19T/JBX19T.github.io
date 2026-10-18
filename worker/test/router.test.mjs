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
// a Alpaca foi removida: as rotas já não existem
assert.equal((await call('/alpaca/state', { token: 'segredo' })).status, 404);
console.log('alpaca removida ok');
// /hl/candles: só leitura, sempre na rede real, com validação do intervalo
{
  const urls = [];
  const prev = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    const b = o.body ? JSON.parse(o.body) : {}, R = j => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
    urls.push(String(u));
    if (b.type === 'perpDexs') return R([null, { name: 'xyz' }]);
    if (b.type === 'meta') return R({ universe: b.dex === 'xyz' ? [{ name: 'xyz:GOLD', szDecimals: 4, maxLeverage: 10 }, { name: 'xyz:SP500', szDecimals: 3 }, { name: 'xyz:EUR', szDecimals: 2 }] : [] });
    if (b.type === 'allMids') return R(b.dex === 'xyz' ? { 'xyz:GOLD': '4400', 'xyz:SP500': '7600', 'xyz:EUR': '1.12' } : {});
    if (b.type === 'candleSnapshot') return R([{ t: 1, T: 2, s: b.req.coin, i: b.req.interval, o: '1', c: '2', h: '3', l: '0.5', v: '10', n: 5 }]);
    throw new Error('fetch inesperado');
  };
  const envTest = { ...env, HL_NETWORK: 'testnet' };
  const ask = (body, token = 'segredo') => worker.fetch(new Request('https://w.example/hl/candles', { method: 'POST', headers: { Origin: 'https://jbx19t.github.io', 'x-token': token, 'content-type': 'application/json' }, body: JSON.stringify(body) }), envTest, { waitUntil() {} });
  const ok = await ask({ interval: '15m', days: 30 }); assert.equal(ok.status, 200);
  const j = await ok.json();
  assert.equal(j.markets.GOLD.coin, 'xyz:GOLD'); assert.deepEqual(j.markets.GOLD.bars[0], [1, 1, 3, 0.5, 2, 10]);
  assert.ok(urls.every(u => u.startsWith('https://api.hyperliquid.xyz/')), 'sempre na rede real: ' + urls[0]);
  assert.equal((await ask({ interval: '5m' })).status, 502);
  assert.equal((await ask({ interval: '15m' }, 'errado')).status, 401);
  globalThis.fetch = prev;
  console.log('candles ok');
}
