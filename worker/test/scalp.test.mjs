// Modo scalping (velas de 1 e 5 min): só papel e backtest; o filtro de custo continua igual; o worker nunca o executa em real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import worker from '../holders.mjs';
import { runAutopilot } from '../autopilot.mjs';
import { makeStore, fakeNamespace } from '../store.mjs';
const require = createRequire(import.meta.url);
const BT = require('../../grokbot/backtest.js'), DS = require('../../grokbot/strategy.js');
const ok = n => console.log('ok  ', n);
const T0 = Date.UTC(2026, 0, 5), M5 = 3e5;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function walk(seed, n, vol, p0, ms) { const r = rng(seed); let p = p0; const out = []; for (let i = 0; i < n; i++) { const o = p, c = p * (1 + (r() + r() + r() - 1.5) * 2 * vol); out.push({ t: T0 + i * ms, o, h: Math.max(o, c) * (1 + r() * vol * .5), l: Math.min(o, c) * (1 - r() * vol * .5), c }); p = c; } return out; }

// S1 parâmetros fixados a priori e sem herança entre estratégias
{
  const sc = DS.withStrategy({ ...DS.DEFAULTS }, 'scalp');
  assert.deepEqual([sc.stopATR, sc.tpATR, sc.maxHoldBars, sc.atrN, sc.band, sc.bandN, sc.maxCostR], [1.2, 1, 12, 10, 2.2, 20, 0.15], 'o scalping NÃO afrouxa o limite de custo');
  const back = DS.withStrategy(sc, 'breakout'); assert.deepEqual([back.stopATR, back.tpATR, back.maxHoldBars, back.atrN, back.maxCostR], [2, 3, 96, 14, 0.15]);
  assert.deepEqual(DS.SCALP_INTERVALS, ['1m', '5m']); assert.ok(DS.isScalp('scalp', '15m') && DS.isScalp('breakout', '5m') && !DS.isScalp('breakout', '15m'));
  ok('S1 scalping: stop 1,2×ATR, alvo 1×ATR, 12 velas, banda 2,2σ; o limite de custo (15% do risco) não é afrouxado');
}
// S2 a matemática dos custos: em velas de 5 min o ouro mexe-se ~0,12%; o custo de ida e volta (0,18%) vale mais de 1 R
{
  const data = { GOLD: walk(1, 20000, .0007, 4000, M5), EURUSD: walk(2, 20000, .00035, 1.1, M5) };
  const cfg = DS.withStrategy({ ...DS.DEFAULTS, start: 10000, ddStop: .99, dayLoss: .99 }, 'scalp');
  const filtered = BT.summarize(BT.simulate(data, cfg));
  assert.ok(filtered.n < 5, 'com o filtro de custo quase não há trades em velas de 5 min (' + filtered.n + ')');
  const raw = BT.summarize(BT.simulate(data, { ...cfg, minATRpct: 0 }));
  assert.ok(raw.n > 500, 'sem filtro há centenas de trades: ' + raw.n); assert.ok(raw.costR > 0.8, 'custo médio ' + raw.costR.toFixed(2) + ' R por trade'); assert.ok(raw.avgR < -0.5, 'R líquido médio ' + raw.avgR.toFixed(2) + ': sem vantagem, o custo come tudo');
  console.log('     sem filtro: ' + raw.n + ' trades, custo ' + raw.costR.toFixed(2) + ' R, R líquido ' + raw.avgR.toFixed(2) + ' | com filtro: ' + filtered.n + ' trades');
  ok('S2 5 min em mercado sem vantagem: custo > 0,8 R por trade; o filtro corta quase tudo (é o comportamento correto)');
}
// S3 o sinal existe: queda de 2,2σ com volatilidade suficiente → compra; subida → vende
{
  const st = DS.make({ ...DS.withStrategy({ ...DS.DEFAULTS }, 'scalp'), minATRpct: 0 }), n = 60, mk = k => Array.from({ length: n }, (_, i) => { const c = 100 * (1 + Math.sin(i * 1.3) * 0.004 + (i === n - 1 ? k : 0)); return { t: T0 + i * M5, o: c, h: c * 1.006, l: c * 0.994, c }; });
  assert.equal(st.signal(mk(-0.05)).dir, 'long'); assert.equal(st.signal(mk(0.05)).dir, 'short'); assert.equal(st.signal(mk(0)).dir, 'flat');
  ok('S3 sinal de scalping: queda brusca compra, subida brusca vende, sem excesso fica de fora');
}
// S4 o worker nunca executa scalping em real: nem pela app nem pelo piloto, e nem na rede de teste
{
  const prev = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => { const b = o.body ? JSON.parse(o.body) : {}, R = j => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
    if (b.type === 'perpDexs') return R([null, { name: 'xyz' }]); if (b.type === 'meta') return R({ universe: b.dex === 'xyz' ? [{ name: 'xyz:GOLD', szDecimals: 4, maxLeverage: 10 }] : [] });
    if (b.type === 'allMids') return R(b.dex === 'xyz' ? { 'xyz:GOLD': '4000' } : {}); if (b.type === 'clearinghouseState') return R({ marginSummary: { accountValue: '50' }, assetPositions: [] }); return R([]); };
  const env = { ALLOWED_ORIGIN: 'https://jbx19t.github.io', APP_TOKEN: 'segredo', HL_AGENT_KEY: '0x' + '22'.repeat(32), HL_ACCOUNT: '0x' + '33'.repeat(20), GUARD: fakeNamespace(), HL_REQUIRE_APPROVAL: '0' };
  const sync = body => worker.fetch(new Request('https://w.example/hl/sync', { method: 'POST', headers: { Origin: 'https://jbx19t.github.io', 'x-token': 'segredo', 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then(r => r.json());
  const want = { GOLD: { side: 'long', frac: 0.5, slPct: 0.01, tpPct: 0.015 } };
  const good = { at: Date.now() - 1000, n: 400, avgR: .3, pf: 1.5, tR: 3 };
  let j = await sync({ desired: want, strategy: 'scalp', iv: '5m', approval: good }); assert.equal(j.plan.filter(p => p.op === 'open').length, 0); assert.match(JSON.stringify(j.skipped), /scalping/i);
  j = await sync({ desired: want, strategy: 'breakout', iv: '1m', approval: good }); assert.match(JSON.stringify(j.skipped), /scalping/i);
  const hl = { live: true, state: async () => ({ markets: {}, positions: [] }), candles: async () => ({ markets: {} }), sync: async (d, o) => { hl.o = o; return { mode: 'real', plan: [], results: [], skipped: [] }; } };
  const store = makeStore({ GUARD: fakeNamespace() });
  await store.put('approvals', { 'scalp|5m': { strategy: 'scalp', iv: '5m', at: Date.now() - 1000, n: 400, avgR: .3, pf: 1.5, tR: 3 } });
  await runAutopilot({ env: { HL_AUTOPILOT: '1', HL_STRATEGY: 'scalp', HL_INTERVAL: '5m' }, hl, store, notify: { send: async () => true }, now: Date.UTC(2026, 9, 18, 12, 1), force: true });
  assert.match(hl.o.blockOpen, /scalping/, 'o piloto automático também recusa'); globalThis.fetch = prev;
  ok('S4 o worker recusa abrir scalping (app e piloto), mesmo com aprovação válida');
}
// S5 modo no Macro Desk: guarda a escolha, muda as velas e pede-as mais vezes
{
  const read = p => fs.readFileSync(new URL('../../grokbot/' + p, import.meta.url), 'utf8');
  const load = (store, fetchImpl) => { const ctx = { console, Date, Math, JSON, Promise, URLSearchParams, setTimeout, clearTimeout, setInterval() {}, Number, String, Array, Object, Set, Map, isFinite, parseFloat, document: { getElementById: () => null }, location: { search: '' }, log() {},
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, fetch: fetchImpl || (async () => { throw new Error('sem rede'); }) }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('strategy.js'), ctx); vm.runInContext(read('macro.js'), ctx); return ctx.MACRO; };
  const store = {}; let M = load(store); assert.equal(M.CHOICE.iv, '15m'); assert.equal(M.SCALP, false); assert.equal(M.CFG.candlePoll, 60000);
  assert.equal(M.setStrategy('scalp', '5m'), true); M = load(store); assert.deepEqual([M.CFG.res, M.CFG.resMs, M.CFG.strategy, M.SCALP, M.CFG.candlePoll], ['5m', 3e5, 'scalp', true, 60000]);
  M.setStrategy('scalp', '1m'); M = load(store); assert.deepEqual([M.CFG.res, M.CFG.resMs, M.CFG.candlePoll], ['1m', 6e4, 15000]);
  const reqs = []; M = load(store, async (u, o) => { reqs.push(JSON.parse(o.body)); return { ok: true, status: 200, json: async () => [] }; }); await M.pollHLCandles('GOLD').catch(() => {});
  assert.equal(reqs.at(-1).req.interval, '1m'); assert.equal(reqs.at(-1).req.coin, 'xyz:GOLD'); assert.ok(reqs.at(-1).req.endTime - reqs.at(-1).req.startTime >= 6e4 * 200);
  assert.equal(M.setStrategy('nada', '5m'), false);
  ok('S5 Macro Desk: modo scalping 5 min / 1 min guardado, velas e cadência de pedidos ajustadas');
}
// S6 backtest: em velas de scalping compara só o scalping e mostra o efeito do filtro de custo
{
  const data = { GOLD: walk(3, 3000, .004, 4000, M5) };
  const cfg = DS.withStrategy({ ...DS.DEFAULTS, start: 10000 }, 'scalp'), all = BT.runAll(data, cfg, { base: DS.DEFAULTS, only: ['scalp'] });
  assert.deepEqual([...new Set(all.research.rows.map(r => r.strategy))], ['scalp']); assert.equal(all.research.rows.length, 2);
  assert.ok(all.variants.some(v => /sem filtro de custo/.test(v.label)), 'variante sem filtro'); assert.equal(all.main.s.strategy, 'scalp');
  ok('S6 backtest em velas de scalping: só o scalping, com a variante "sem filtro de custo" para ver o estrago');
}
console.log('scalp ok');
