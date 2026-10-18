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
// proteção do servidor, piloto automático, notificações e cron (com memória falsa)
{
  const { fakeNamespace } = await import('../store.mjs');
  const { tick } = await import('../holders.mjs');
  const pushes = []; let equity = '50';
  const prev = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    const b = o.body ? JSON.parse(o.body) : {}, R = j => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
    if (String(u).startsWith('https://ntfy.sh')) { pushes.push(b); return R({ id: 'x' }); }
    if (b.type === 'perpDexs') return R([null, { name: 'xyz' }]);
    if (b.type === 'meta') return R({ universe: b.dex === 'xyz' ? [{ name: 'xyz:GOLD', szDecimals: 4, maxLeverage: 10 }] : [] });
    if (b.type === 'allMids') return R(b.dex === 'xyz' ? { 'xyz:GOLD': '4000' } : {});
    if (b.type === 'clearinghouseState') return R({ marginSummary: { accountValue: b.dex === 'xyz' ? equity : '0' }, assetPositions: [] });
    if (b.type === 'openOrders') return R([]);
    throw new Error('fetch inesperado ' + u);
  };
  const env2 = { ...env, GUARD: fakeNamespace(), NTFY_TOPIC: 'dollos-teste-123' };
  const ask = (path, { method = 'GET', body, e = env2 } = {}) => worker.fetch(new Request('https://w.example' + path, { method, headers: { Origin: 'https://jbx19t.github.io', 'x-token': 'segredo', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), e, { waitUntil(p) { return p; } });
  let r = await (await ask('/notify/test', { method: 'POST' })).json(); assert.deepEqual(r, { configured: true, sent: true }); assert.equal(pushes[0].topic, 'dollos-teste-123');
  r = await (await ask('/notify/test', { method: 'POST', e: env })).json(); assert.deepEqual(r, { configured: false, sent: false });
  // cron: primeiro regista o máximo ($50), depois a conta cai para $35 (-30%) -> para
  let t = await tick(env2); assert.equal(t.guard.hl.peak, 50); assert.equal(t.guard.hl.st, undefined, 'o estado completo não sai no resultado');
  equity = '35'; t = await tick(env2); assert.ok(t.guard.hl.halted); assert.match(pushes.at(-1).title, /PARADA/);
  let st = await (await ask('/hl/state')).json(); assert.ok(st.guard.halted); assert.equal(st.guard.on, true); assert.ok(st.guard.last.t > 0); assert.equal(st.autopilot.on, false);
  let s = await (await ask('/hl/sync', { method: 'POST', body: { desired: { GOLD: { side: 'long', frac: 0.5 } } } })).json();
  assert.equal(s.plan.length, 0); assert.match(s.skipped[0].reason, /proteção do servidor/);
  r = await (await ask('/hl/resume', { method: 'POST' })).json(); assert.equal(r.peak, 35);
  s = await (await ask('/hl/sync', { method: 'POST', body: { desired: { GOLD: { side: 'long', frac: 0.5 } } } })).json(); assert.equal(s.plan[0].op, 'open');
  // piloto automático ligado: a app deixa de decidir
  s = await (await ask('/hl/sync', { method: 'POST', body: { desired: { GOLD: { side: 'long', frac: 0.5 } } }, e: { ...env2, HL_AUTOPILOT: '1' } })).json();
  assert.equal(s.autopilot, true); assert.equal(s.plan.length, 0);
  st = await (await ask('/hl/state', { e: { ...env2, HL_AUTOPILOT: '1', HL_STRATEGY: 'reversion' } })).json(); assert.equal(st.autopilot.strategy, 'reversion');
  // worker antigo sem memória: tudo continua a funcionar, só a proteção fica desligada
  assert.match((await tick(env)).error, /GUARD/);
  st = await (await ask('/hl/state', { e: env })).json(); assert.equal(st.guard.on, false);
  // o cron chama tick através de scheduled
  let waited = null; await worker.scheduled({ scheduledTime: Date.now() }, env2, { waitUntil(p) { waited = p; } }); assert.ok(waited); await waited;
  globalThis.fetch = prev;
  console.log('proteção, piloto e notificações (rotas e cron) ok');
}
