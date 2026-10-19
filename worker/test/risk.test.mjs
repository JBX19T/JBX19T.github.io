// Gestão de risco central: proteção de stops, ordens órfãs, paragem de emergência, aprovações e registo de execuções.
import assert from 'node:assert/strict';
import worker from '../holders.mjs';
import { guardHL } from '../guard.mjs';
import { makeHL } from '../hl.mjs';
import { makeStore, fakeNamespace } from '../store.mjs';
import { toEntries, summarizeExec } from '../execlog.mjs';
const ok = n => console.log('ok  ', n);
const AGENT = '0x' + '22'.repeat(32), ACC = '0x' + '33'.repeat(20);
const notifier = () => { const sent = []; return { sent, on: true, send: async (t, m, o) => { sent.push({ t, m, o }); return true; } }; };

// corretora simulada: guarda posições e ordens e responde como a Hyperliquid (stops com isTrigger/orderType/triggerPx)
function exchange({ mid = 4000, equity = 100, positions = [], orders = [], fillBps = 10 } = {}) {
  const S = { mid, positions: [...positions], orders: [...orders], posted: [], cancels: 0 };
  const f = async (url, o) => {
    const b = JSON.parse(o.body), R = j => ({ ok: true, status: 200, text: async () => JSON.stringify(j), json: async () => j });
    if (url.endsWith('/info')) {
      if (b.type === 'perpDexs') return R([null, { name: 'xyz' }]);
      if (b.type === 'meta') return R({ universe: b.dex === 'xyz' ? [{ name: 'xyz:GOLD', szDecimals: 4, maxLeverage: 10 }] : [] });
      if (b.type === 'allMids') return R(b.dex === 'xyz' ? { 'xyz:GOLD': String(S.mid) } : {});
      if (b.type === 'clearinghouseState') return R({ marginSummary: { accountValue: String(equity) }, assetPositions: S.positions.map(p => ({ position: { coin: p.coin, szi: String(p.szi), entryPx: '4000', unrealizedPnl: '0' } })) });
      return R(S.orders);
    }
    const a = b.action; S.posted.push(a);
    if (a.type === 'cancel') { S.cancels += a.cancels.length; S.orders = S.orders.filter(x => !a.cancels.some(c => c.o === x.oid)); return R({ status: 'ok', response: { data: { statuses: a.cancels.map(() => 'success') } } }); }
    if (a.type === 'updateLeverage') return R({ status: 'ok', response: { type: 'default' } });
    const st = a.orders.map(od => {
      if (od.t.trigger) { S.orders.push({ coin: 'xyz:GOLD', oid: 500 + S.orders.length, reduceOnly: true, isTrigger: true, orderType: od.t.trigger.tpsl === 'sl' ? 'Stop Market' : 'Take Profit Market', triggerPx: od.t.trigger.triggerPx }); return { resting: { oid: 1 } }; }
      if (od.r && od.t.limit.tif === 'Gtc') { S.orders.push({ coin: 'xyz:GOLD', oid: 600 + S.orders.length, reduceOnly: true, isTrigger: false, orderType: 'Limit' }); return { resting: { oid: 2 } }; }
      const avg = S.mid * (1 + (od.b ? 1 : -1) * fillBps / 1e4);
      if (od.r) S.positions = S.positions.filter(p => p.coin !== 'xyz:GOLD'); else S.positions.push({ coin: 'xyz:GOLD', szi: (od.b ? 1 : -1) * parseFloat(od.s) });
      return { filled: { totalSz: od.s, avgPx: String(avg), oid: 3 } };
    });
    return R({ status: 'ok', response: { type: 'order', data: { statuses: st } } });
  };
  return { S, f };
}

// R1: o preço realmente executado fica registado e mede o slippage real (era um dado em falta)
{
  const { S, f } = exchange({ fillBps: 10 }), hl = makeHL({ HL_AGENT_KEY: AGENT, HL_ACCOUNT: ACC, HL_LIVE: '1' }, f);
  const r = await hl.sync({ GOLD: { side: 'long', frac: 0.6, slPct: 0.01, tpPct: 0.015 } });
  const x = r.results.find(z => z.op === 'open'); assert.equal(x.ok, true); assert.ok(Math.abs(x.slipBps - 10) < 0.01, 'slippage medido ' + x.slipBps); assert.equal(x.mid, 4000);
  const es = toEntries('hl', r); assert.equal(es.length, 1); assert.equal(es[0].slipBps, x.slipBps); assert.ok(es[0].usd > 0);
  const sum = summarizeExec([...es, ...es.map(e => ({ ...e, slipBps: 30 }))]); assert.equal(sum.hl.slipBpsMean, 20); assert.equal(sum.hl.slipBpsWorst, 30);
  ok('R1 o preço executado e o slippage real (10 bps) ficam registados');
}
// R2: posição sem stop (ligação caiu entre a entrada e o stop): a proteção repõe-no, uma vez, sem duplicar
{
  const { S, f } = exchange({ positions: [{ coin: 'xyz:GOLD', szi: 0.003 }] }), hl = makeHL({ HL_AGENT_KEY: AGENT, HL_ACCOUNT: ACC, HL_LIVE: '1' }, f);
  const store = makeStore({ GUARD: fakeNamespace() }), N = notifier();
  const r1 = await guardHL({ env: {}, hl, store, notify: N }); assert.equal(r1.action, 'protect');
  const stops = S.orders.filter(o => o.orderType === 'Stop Market'); assert.equal(stops.length, 1); assert.equal(stops[0].triggerPx, '3920', 'stop de emergência a 2% da entrada');
  assert.match(N.sent[0].m, /repus o stop/);
  for (let k = 0; k < 3; k++) await guardHL({ env: {}, hl, store, notify: N }); assert.equal(S.orders.filter(o => o.orderType === 'Stop Market').length, 1, 'não duplica');
  ok('R2 posição sem stop: a proteção repõe-no a 2% da entrada, avisa, e não duplica');
}
// R3: o stop fechou a posição na corretora e o alvo ficou a pairar: a proteção cancela a ordem órfã
{
  const { S, f } = exchange({ positions: [], orders: [{ coin: 'xyz:GOLD', oid: 77, reduceOnly: true, isTrigger: false, orderType: 'Limit' }] }), hl = makeHL({ HL_AGENT_KEY: AGENT, HL_ACCOUNT: ACC, HL_LIVE: '1' }, f);
  await guardHL({ env: {}, hl, store: makeStore({ GUARD: fakeNamespace() }), notify: notifier() }); assert.equal(S.cancels, 1); assert.equal(S.orders.length, 0);
  ok('R3 ordem órfã sem posição: cancelada pela proteção');
}
// R4: a proteção só põe stops e cancela; nunca abre posições, nem em simulação nem por engano
{
  const { S, f } = exchange({ positions: [] }), hl = makeHL({ HL_AGENT_KEY: AGENT, HL_ACCOUNT: ACC, HL_LIVE: '1' }, f);
  const r = await hl.sync({}, { keepHeld: true, blockOpen: 'proteção' }); assert.equal(S.posted.length, 0); assert.equal(r.plan.length, 0);
  const sim = exchange({ positions: [{ coin: 'xyz:GOLD', szi: 0.003 }] }), hs = makeHL({ HL_AGENT_KEY: AGENT, HL_ACCOUNT: ACC }, sim.f);
  const rs = await hs.sync({}, { keepHeld: true }); assert.equal(sim.S.posted.length, 0, 'em simulação nada é enviado'); assert.equal(rs.plan[0].op, 'stop');
  ok('R4 keepHeld nunca abre nada; em simulação só planeia');
}

// ===== rotas: paragem de emergência, aprovações, registo =====
const env = () => { const { f } = exchange(); return { env: { ALLOWED_ORIGIN: 'https://jbx19t.github.io', APP_TOKEN: 'segredo', HL_AGENT_KEY: AGENT, HL_ACCOUNT: ACC, GUARD: fakeNamespace(), NTFY_TOPIC: 'dollos-teste-123' }, f }; };
const call = (e, path, { method = 'GET', body } = {}) => worker.fetch(new Request('https://w.example' + path, { method, headers: { Origin: 'https://jbx19t.github.io', 'x-token': 'segredo', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), e, { waitUntil() {} });
const prev = globalThis.fetch;
const want = { GOLD: { side: 'long', frac: 0.6, slPct: 0.01, tpPct: 0.015 } };
const good = () => ({ strategy: 'trail', iv: '4h', approval: { at: Date.now() - 864e5, n: 40, avgR: .2, pf: 1.3, tR: 2.4 } });
{
  const { env: e, f } = env(), pushes = []; globalThis.fetch = (u, o) => String(u).startsWith('https://ntfy.sh') ? (pushes.push(JSON.parse(o.body)), Promise.resolve({ ok: true })) : f(u, o);
  let j = await (await call(e, '/hl/sync', { method: 'POST', body: { desired: want, ...good() } })).json(); assert.equal(j.plan.filter(p => p.op === 'open').length, 1, 'com aprovação abre');
  assert.equal((await (await call(e, '/risk/state')).json()).riskHalt, null);
  const pj = await (await call(e, '/risk/panic', { method: 'POST' })).json(); assert.equal(pj.ok, true); assert.ok(pushes.some(p => /EMERGÊNCIA/.test(p.title)));
  j = await (await call(e, '/hl/sync', { method: 'POST', body: { desired: want, ...good() } })).json(); assert.equal(j.plan.filter(p => p.op === 'open').length, 0); assert.match(JSON.stringify(j.skipped), /PARAGEM GLOBAL/);
  assert.ok((await (await call(e, '/risk/state')).json()).riskHalt.t > 0);
  await call(e, '/risk/resume', { method: 'POST' }); j = await (await call(e, '/hl/sync', { method: 'POST', body: { desired: want, ...good() } })).json(); assert.equal(j.plan.filter(p => p.op === 'open').length, 1, 'depois de retomar volta a abrir');
  ok('R5 paragem de emergência bloqueia as aberturas e é levantada só por RETOMAR TUDO');
}
{
  const { env: e, f } = env(); globalThis.fetch = f;
  const old = good(); old.approval.at = Date.now() - 46 * 864e5;
  let j = await (await call(e, '/hl/sync', { method: 'POST', body: { desired: want, ...old } })).json(); assert.equal(j.plan.filter(p => p.op === 'open').length, 0, 'aprovação com 46 dias expirou');
  const real = { ...e, HL_NETWORK: 'mainnet', HL_REQUIRE_APPROVAL: '0' };   // na rede real o desligar não vale
  j = await (await call(real, '/hl/sync', { method: 'POST', body: { desired: want } })).json(); assert.equal(j.plan.filter(p => p.op === 'open').length, 0); assert.match(JSON.stringify(j.skipped), /aprova/i);
  const tn = { ...e, HL_REQUIRE_APPROVAL: '0' };   // na rede de teste pode desligar-se (para experimentar a ligação)
  j = await (await call(tn, '/hl/sync', { method: 'POST', body: { desired: want } })).json(); assert.equal(j.plan.filter(p => p.op === 'open').length, 1);
  assert.equal((await call(e, '/hl/approve', { method: 'POST', body: { strategy: 'trail', iv: '4h', n: 12, avgR: .3, pf: 1.5, tR: 2.5, at: Date.now() } })).status, 400);
  ok('R6 aprovação expira aos 45 dias; HL_REQUIRE_APPROVAL=0 só vale na rede de teste');
}
{
  const { env: e, f } = env(); globalThis.fetch = f; e.HL_LIVE = '1';
  await call(e, '/hl/sync', { method: 'POST', body: { desired: want, ...good() } });
  const j = await (await call(e, '/exec/log')).json(); assert.equal(j.log.length, 1); assert.equal(j.log[0].desk, 'hl'); assert.ok(Math.abs(j.log[0].slipBps - 10) < 0.01); assert.equal(j.summary.hl.fills, 1);
  const rs = await (await call(e, '/risk/state')).json(); assert.equal(rs.exec.hl.slipBpsMean, j.log[0].slipBps); assert.equal(rs.notifyOn, true);
  const st = await (await call(e, '/hl/state')).json(); assert.equal(st.positions[0].stop > 0, true, 'o estado mostra o stop de cada posição'); assert.equal(st.guard.notifyOn, true);
  ok('R7 registo de execuções real exposto em /exec/log e /risk/state; o estado mostra o stop de cada posição');
}
// R8 taxas reais: o worker lê as execuções da conta (userFills) e guarda a taxa efetiva taker/maker, para calibrar o backtest
{
  const { env: e, f } = env(); e.HL_LIVE = '1';
  const fills = [{ coin: 'xyz:GOLD', px: '4000', sz: '0.01', fee: '0.0144', crossed: true, time: 3, closedPnl: '0', side: 'B' }, { coin: 'xyz:GOLD', px: '4100', sz: '0.01', fee: '0.0164', crossed: true, time: 2, closedPnl: '0', side: 'A' },
    { coin: 'xyz:GOLD', px: '4050', sz: '0.01', fee: '0.01215', crossed: false, time: 1, closedPnl: '1', side: 'A' }, { coin: 'BTC', px: '60000', sz: '1', fee: '99', crossed: true, time: 4, closedPnl: '0', side: 'B' }];
  globalThis.fetch = async (u, o) => { const b = o && o.body ? JSON.parse(o.body) : {}; if (b.type === 'userFills') return { ok: true, status: 200, json: async () => fills, text: async () => JSON.stringify(fills) }; return f(u, o); };
  const { tick } = await import('../holders.mjs'); await tick(e);
  const rs = await (await call(e, '/risk/state')).json(); assert.equal(rs.feeStats.n, 3, 'só os 3 mercados do bot (BTC fica de fora)'); assert.ok(Math.abs(rs.feeStats.takerBps - 3.8) < 0.01, 'taker = (0.0144+0.0164)/(40+41) = 3,80 bps; deu ' + rs.feeStats.takerBps); assert.ok(Math.abs(rs.feeStats.makerBps - 3.0) < 0.01, 'maker = 0.01215/40.5 = 3,0 bps');
  console.log('     taxa taker medida', rs.feeStats.takerBps, 'bps · maker', rs.feeStats.makerBps, 'bps');
  const fj = await (await call(e, '/hl/fills')).json(); assert.equal(fj.nTaker, 2); assert.equal(fj.nMaker, 1);
  ok('R8 taxas reais cobradas (userFills) medidas por tick e expostas em /risk/state e /hl/fills');
}
globalThis.fetch = prev;
console.log('risco ok');
