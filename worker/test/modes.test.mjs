// Modos day trade (fecha no fim do dia) e swing trade (dias a semanas): regras de sessão, desk, piloto e execução.
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
const H = 36e5, DAY = 864e5, T0 = Date.UTC(2026, 0, 5, 0, 0);

// M1 definições e ausência de herança entre famílias
{
  const d = DS.withStrategy({ ...DS.DEFAULTS }, 'daytrade'), s = DS.withStrategy({ ...DS.DEFAULTS }, 'swing');
  assert.deepEqual([d.flatEOD, d.noEntryHours, d.maxHoldBars, d.tpATR, d.trailATR], [true, 2, 24, 3, 0]);
  assert.deepEqual([s.flatEOD, s.tpATR, s.trailATR, s.maxHoldBars, s.brk], [false, 0, 3, 60, 20]);
  const back = DS.withStrategy(d, 'breakout'); assert.deepEqual([back.flatEOD, back.noEntryHours], [false, 0], 'o breakout não herda o fim do dia');
  assert.deepEqual(Object.keys(DS.PRESETS).filter(k => DS.PRESETS[k].mode === 'classic'), ['breakout', 'reversion', 'trend', 'trail', 'pullback']);
  assert.deepEqual(Object.keys(DS.MODES), ['all', 'scalp', 'day', 'swing']); assert.deepEqual(DS.MODES.swing.ivs, ['4h', '1d']);
  assert.equal(DS.isScalp('daytrade', '1h') || DS.isScalp('swing', '1d'), false, 'day trade e swing não são scalping');
  ok('M1 day trade (fim do dia, sem entradas nas últimas 2 h) e swing (stop móvel 3×ATR, até 60 velas); sem herança');
}
// M2 backtest: à última vela do dia UTC fecha tudo; nas últimas horas não abre
{
  const cfg = { start: 10000, riskPct: .01, maxLev: 5, fast: 3, slow: 6, brk: 3, atrN: 3, stopATR: 2, tpATR: 30, maxHoldBars: 40, costBps: 0, makerBps: 0, ddStop: .5, dayLoss: .5, maxATRpct: .03 };
  const flat = (n, t0 = 0, p = 100) => Array.from({ length: n }, (_, i) => ({ t: T0 + (t0 + i) * H, o: p, h: p + .1, l: p - .1, c: p }));
  const bar = (i, o, h, l, c) => ({ t: T0 + i * H, o, h, l, c });
  // rompimento ao fecho das 20:00-21:00; entra à abertura das 21:00; a vela das 23:00-24:00 é a última do dia
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101, 101.3, 100.9, 101.1), bar(22, 101.1, 101.3, 100.9, 101.1), bar(23, 101.1, 101.3, 100.9, 101.15), ...flat(10, 24, 101.1)];
  const eod = BT.simulate({ GOLD: bars }, { ...cfg, flatEOD: true }).trades[0], noEod = BT.simulate({ GOLD: bars }, cfg).trades[0];
  assert.equal(eod.why, 'fim do dia'); assert.equal(eod.c, T0 + 23 * H, 'fecha na vela que termina à meia-noite'); assert.ok(Math.abs(eod.ex - 101.15) < 1e-9, 'ao fecho dessa vela');
  assert.notEqual(noEod.why, 'fim do dia'); assert.ok(noEod.c > T0 + 23 * H, 'sem a regra a posição dorme');
  // sinal às 22:00-23:00 (termina às 23:00, faltam 1 h < 2 h): não abre
  const late = [...flat(22), bar(22, 100, 101.2, 100, 101), ...flat(12, 23, 101)];
  assert.equal(BT.simulate({ GOLD: late }, { ...cfg, flatEOD: true, noEntryHours: 2 }).trades.length, 0, 'sinal tardio ignorado');
  assert.ok(BT.simulate({ GOLD: late }, { ...cfg, flatEOD: true, noEntryHours: 0 }).trades.length >= 1, 'controlo: sem a janela abriria');
  ok('M2 backtest: fecha tudo à vela das 23:00 UTC ("fim do dia"); um sinal a menos de 2 h do fim do dia não abre');
}
// M3 swing em velas diárias: segura dias, sem alvo fixo, e o backtest compara só o swing
{
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const r = rng(11); let p = 1800; const bars = [];
  for (let i = 0; i < 1500; i++) { const o = p; p *= 1 + (Math.sin(i / 60) * 0.0012) + (r() - .5) * .018; bars.push({ t: T0 + i * DAY, o, h: Math.max(o, p) * 1.004, l: Math.min(o, p) * .996, c: p }); }
  const cfg = DS.withStrategy({ ...DS.DEFAULTS, start: 10000 }, 'swing'), res = BT.simulate({ GOLD: bars }, cfg);
  assert.ok(res.trades.length >= 10, 'há trades em velas diárias: ' + res.trades.length); assert.ok(res.trades.every(t => t.why !== 'take-profit' && t.why !== 'fim do dia'), 'sem alvo fixo e sem fecho de fim do dia');
  assert.ok(res.trades.some(t => t.bars >= 5), 'segura posições vários dias'); assert.ok(Math.max(...res.trades.map(t => t.bars)) <= 60, 'no máximo 60 velas');
  const all = BT.runAll({ GOLD: bars }, cfg, { base: DS.DEFAULTS, only: ['swing'] }); assert.deepEqual([...new Set(all.research.rows.map(x => x.strategy))], ['swing']);
  const classic = BT.runAll({ GOLD: bars }, DS.withStrategy(DS.DEFAULTS, 'breakout'), { base: DS.DEFAULTS }); assert.equal(classic.research.rows.length, 10, 'por omissão só as 5 famílias clássicas');
  ok('M3 swing diário: ' + res.trades.length + ' trades, até ' + Math.max(...res.trades.map(t => t.bars)) + ' dias, sem alvo nem fecho de fim do dia; modos comparam-se à parte');
}
// M4 Macro Desk: guarda o modo, fecha à última vela do dia e não abre tarde
{
  const read = p => fs.readFileSync(new URL('../../grokbot/' + p, import.meta.url), 'utf8');
  const clock = { now: Date.now() }; class FakeDate extends Date { static now() { return clock.now; } constructor(...a) { if (a.length) super(...a); else super(clock.now); } }
  const load = store => { const ctx = { console, Date: FakeDate, Math, JSON, Promise, URLSearchParams, setTimeout, clearTimeout, setInterval() {}, Number, String, Array, Object, Set, Map, isFinite, parseFloat, document: { getElementById: () => null }, location: { search: '' }, log() {},
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, fetch: async () => { throw new Error('sem rede'); } }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('strategy.js'), ctx); vm.runInContext(read('macro.js'), ctx); return ctx.MACRO; };
  const store = {}; load(store).setStrategy('swing', '1d'); let M = load(store); assert.deepEqual([M.CFG.res, M.CFG.resMs, M.CFG.strategy, M.CFG.flatEOD], ['1d', DAY, 'swing', false]);
  load(store).setStrategy('daytrade', '1h'); M = load(store); assert.deepEqual([M.CFG.res, M.CFG.strategy, M.CFG.flatEOD, M.CFG.noEntryHours], ['1h', 'daytrade', true, 2]);
  const lastMidnight = Math.floor(Date.now() / DAY) * DAY;
  const hourly = endAt => Array.from({ length: 150 }, (_, i) => { const c = 100 * (1 + 0.0004 * i + Math.sin(i * 1.7) * 0.003); return { t: endAt - (150 - i) * H, o: c, h: c * 1.006, l: c * 0.994, c }; });
  // fim do dia: a última vela fechada termina à meia-noite -> fecha a posição aberta
  clock.now = lastMidnight + 60e3; M.reset(); M.P.GOLD.bars = hourly(lastMidnight); M.P.GOLD.px = 4000; M.P.GOLD.src = 'hl'; M.open('GOLD', 'long', { atr: 20, why: 'teste' }); assert.ok(M.state().pos.GOLD);
  M.onBar('GOLD'); assert.equal(M.state().pos.GOLD, undefined); assert.equal(M.state().trades.at(-1).why, 'fim do dia');
  // sem a regra (rompimento padrão) a posição fica
  const std = load({}); clock.now = lastMidnight + 60e3; std.reset(); std.P.GOLD.bars = hourly(lastMidnight); std.P.GOLD.px = 4000; std.P.GOLD.src = 'hl'; std.open('GOLD', 'long', { atr: 20, why: 'teste' }); std.onBar('GOLD'); assert.ok(std.state().pos.GOLD, 'o modo padrão não fecha ao fim do dia');
  // entradas tardias: sinal perfeito a menos de 2 h da meia-noite não abre; às 20:00 abre
  const spike = endAt => { const b = hourly(endAt - H), last = b.at(-1); b.push({ t: endAt - H, o: last.c, h: last.c * 1.05, l: last.c, c: last.c * 1.05 }); return b; };
  clock.now = lastMidnight - H + 60e3; M.reset(); M.P.GOLD.bars = spike(lastMidnight - H); M.P.GOLD.px = 4000; M.onBar('GOLD'); assert.equal(M.state().pos.GOLD, undefined, 'às 23:00 não abre');
  clock.now = lastMidnight - 4 * H + 60e3; M.reset(); M.P.GOLD.bars = spike(lastMidnight - 4 * H); M.P.GOLD.px = 4000; M.onBar('GOLD'); assert.ok(M.state().pos.GOLD, 'às 20:00 abre (' + M.P.GOLD.sig.dir + ')');
  ok('M4 Macro Desk: modos guardados; day trade fecha à vela da meia-noite e não abre às 23:00; o modo padrão não fecha');
}
// M5 piloto automático: as mesmas regras
{
  const lastMidnight = Math.floor(Date.now() / DAY) * DAY, now = lastMidnight + 60e3;
  const hourly = (endAt, spike) => { const out = []; for (let i = 150; i >= 1; i--) { const c = 4000 * (1 + 0.0004 * (150 - i) + Math.sin(i * 1.7) * 0.003); out.push([endAt - i * H, c, c * 1.006, c * 0.994, c, 1]); } if (spike) { const l = out.at(-1)[4]; out.push([endAt - H, l, l * 1.05, l, l * 1.05, 1]); out.splice(-2, 1); } return out; };
  const mk = (positions, bars) => { const H_ = { live: true, state: async () => ({ markets: { GOLD: { coin: 'xyz:GOLD' } }, positions }), candles: async () => ({ markets: { GOLD: { coin: 'xyz:GOLD', bars } } }), sync: async (d, o) => { H_.d = d; H_.o = o; return { mode: 'real', plan: [], results: [], skipped: [] }; } }; return H_; };
  const run = async (hl, env, at) => { const store = makeStore({ GUARD: fakeNamespace() }); return runAutopilot({ env: { HL_AUTOPILOT: '1', HL_INTERVAL: '1h', ...env }, hl, store, notify: { send: async () => true }, now: at, force: true }); };
  let hl = mk([{ coin: 'xyz:GOLD', szi: 0.01 }], hourly(lastMidnight)); let r = await run(hl, { HL_STRATEGY: 'daytrade' }, now);
  assert.equal(hl.d.GOLD, undefined, 'day trade: fim do dia, não pede a posição'); assert.match(r.notes.GOLD, /fim do dia/);
  hl = mk([{ coin: 'xyz:GOLD', szi: 0.01 }], hourly(lastMidnight)); await run(hl, { HL_STRATEGY: 'breakout' }, now); assert.ok(hl.d.GOLD, 'o rompimento padrão mantém a posição');
  hl = mk([], hourly(lastMidnight - H, true)); r = await run(hl, { HL_STRATEGY: 'daytrade' }, lastMidnight - H + 60e3); assert.equal(hl.d.GOLD, undefined); assert.match(r.notes.GOLD, /não abre/);
  hl = mk([], hourly(lastMidnight - 4 * H, true)); r = await run(hl, { HL_STRATEGY: 'daytrade' }, lastMidnight - 4 * H + 60e3); assert.ok(hl.d.GOLD, 'às 20:00 pede a abertura: ' + JSON.stringify(r.notes));
  hl = mk([], hourly(lastMidnight, false).map(b => b)); await run(hl, { HL_STRATEGY: 'swing', HL_INTERVAL: '1d' }, now);   // swing diário aceite pelo piloto (sem erro)
  ok('M5 piloto automático: day trade fecha ao fim do dia e não abre tarde; swing diário aceite');
}
// M6 a execução real de day trade e swing não é bloqueada como o scalping (só pela aprovação)
{
  const prev = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => { const b = o.body ? JSON.parse(o.body) : {}, R = j => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
    if (b.type === 'perpDexs') return R([null, { name: 'xyz' }]); if (b.type === 'meta') return R({ universe: b.dex === 'xyz' ? [{ name: 'xyz:GOLD', szDecimals: 4, maxLeverage: 10 }] : [] });
    if (b.type === 'allMids') return R(b.dex === 'xyz' ? { 'xyz:GOLD': '4000' } : {}); if (b.type === 'clearinghouseState') return R({ marginSummary: { accountValue: '50' }, assetPositions: [] }); return R([]); };
  const env = { ALLOWED_ORIGIN: 'https://jbx19t.github.io', APP_TOKEN: 'segredo', HL_AGENT_KEY: '0x' + '22'.repeat(32), HL_ACCOUNT: '0x' + '33'.repeat(20), GUARD: fakeNamespace() };
  const sync = body => worker.fetch(new Request('https://w.example/hl/sync', { method: 'POST', headers: { Origin: 'https://jbx19t.github.io', 'x-token': 'segredo', 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then(r => r.json());
  const want = { GOLD: { side: 'long', frac: 0.5, slPct: 0.02, tpPct: null } }, good = { at: Date.now() - 1000, n: 60, avgR: .3, pf: 1.5, tR: 3 };
  for (const [strategy, iv] of [['swing', '1d'], ['swing', '4h'], ['daytrade', '1h']]) { const j = await sync({ desired: want, strategy, iv, approval: good }); assert.equal(j.plan.filter(p => p.op === 'open').length, 1, strategy + ' ' + iv + ' com aprovação abre'); }
  const j = await sync({ desired: want, strategy: 'swing', iv: '1d' }); assert.equal(j.plan.filter(p => p.op === 'open').length, 1, 'a aprovação de swing|1d já ficou guardada');
  const k = await sync({ desired: want, strategy: 'daytrade', iv: '4h' }); assert.equal(k.plan.filter(p => p.op === 'open').length, 0, 'day trade 4 h sem a sua aprovação continua bloqueado');
  globalThis.fetch = prev;
  ok('M6 swing e day trade podem ser executados (com aprovação própria por estratégia e velas); o scalping nunca');
}
console.log('modos ok');
