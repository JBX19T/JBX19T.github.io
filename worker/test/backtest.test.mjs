import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const BT = require('../../grokbot/backtest.js');
const DS = require('../../grokbot/strategy.js');
const approx = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} !~ ${b}`);

// parâmetros pequenos para fazer contas à mão
const cfg = { start: 10000, riskPct: .01, maxLev: 5, fast: 3, slow: 6, brk: 3, atrN: 3, stopATR: 2, tpATR: 3, maxHoldBars: 10, costBps: 0, ddStop: .5, dayLoss: .5, maxATRpct: .03 };
const T0 = Date.UTC(2026, 0, 5, 0, 0);
const flat = (n, t0 = 0) => Array.from({ length: n }, (_, i) => ({ t: T0 + (t0 + i) * 9e5, o: 100, h: 100.1, l: 99.9, c: 100 }));
const bar = (i, o, h, l, c) => ({ t: T0 + i * 9e5, o, h, l, c });

// 1) cálculo à mão: rompimento a 101, alvo a 102.6, ganho = 1.5R = $150
{
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101.2, 102.7, 101, 102.5), ...flat(5, 22).map(b => ({ ...b, o: 102.5, h: 102.6, l: 102.4, c: 102.5 }))];
  const r = BT.simulate({ GOLD: bars }, cfg);
  const t = r.trades[0];
  assert.equal(t.k, 'GOLD'); assert.equal(t.side, 1); assert.equal(t.why, 'take-profit');
  approx(t.en, 101, 1e-9, 'entrada'); approx(t.ex, 102.6, 1e-9, 'saída');
  approx(t.nt, 100 / ((2 * (0.2 + 0.2 + 1.2) / 3) / 101), 1e-6, 'tamanho = 1% de risco / distância do stop');
  approx(t.pnl, 150, 1e-6, 'ganho de 1.5R');
  console.log('ok   1 cálculo à mão: entrada 101, alvo 102.6, ganho $150,00');
}
// 2) salto (gap) abaixo do stop: enche à abertura, pior que o stop
{
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 99, 99.5, 98.5, 99.2), ...flat(3, 22).map(b => ({ ...b, o: 99.2, h: 99.3, l: 99.1, c: 99.2 }))];
  const t = BT.simulate({ GOLD: bars }, cfg).trades[0];
  assert.equal(t.why, 'stop-loss'); approx(t.ex, 99, 1e-9, 'enche à abertura do gap');
  assert.ok(t.pnl < -100, 'perda maior do que 1R por causa do gap: ' + t.pnl);
  console.log('ok   2 gap abaixo do stop enche à abertura (perda $' + t.pnl.toFixed(2) + ' > 1R)');
}
// 3) stop e alvo na mesma vela: conta o stop
{
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101, 103, 99, 101), ...flat(3, 22)];
  const t = BT.simulate({ GOLD: bars }, cfg).trades[0];
  assert.equal(t.why, 'stop-loss'); console.log('ok   3 stop e alvo na mesma vela: conta o stop');
}
// 4) custos: cada lado custa costBps do valor da posição
{
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101.2, 102.7, 101, 102.5), ...flat(5, 22).map(b => ({ ...b, o: 102.5, h: 102.6, l: 102.4, c: 102.5 }))];
  const a = BT.simulate({ GOLD: bars }, cfg).trades[0], b = BT.simulate({ GOLD: bars }, { ...cfg, costBps: 9 }).trades[0];
  assert.ok(b.pnl < a.pnl); console.log('ok   4 custo de 9 bps reduz o ganho: $' + a.pnl.toFixed(2) + ' -> $' + b.pnl.toFixed(2));
}
// 5) paragem de capital: com limite mínimo fecha tudo e conta a paragem
{
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101, 101.1, 100.0, 100.2), bar(22, 100.2, 100.3, 99.9, 100), ...flat(3, 23)];
  const r = BT.simulate({ GOLD: bars }, { ...cfg, ddStop: 0.0005 });
  assert.ok(r.halts.dd >= 1); assert.ok(r.trades.some(t => t.why === 'kill-switch')); console.log('ok   5 paragem de -x% fecha tudo (halts.dd=' + r.halts.dd + ')');
}
// 6) série aleatória (sem saltos): propriedades gerais
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function walk(seed, n, drift, vol, p0 = 100) {
  const r = rng(seed); let p = p0; const out = [];
  for (let i = 0; i < n; i++) { const o = p; const c = p * (1 + drift + (r() - .5) * 2 * vol); const h = Math.max(o, c) * (1 + r() * vol * .4), l = Math.min(o, c) * (1 - r() * vol * .4); out.push({ t: T0 + i * 9e5, o, h, l, c }); p = c; }
  return out;
}
const liveCfg = { start: 10000, riskPct: .01, maxLev: 5, fast: 20, slow: 50, brk: 20, atrN: 14, stopATR: 2, tpATR: 3, maxHoldBars: 96, costBps: 9, ddStop: .2, dayLoss: .05, maxATRpct: .03 };
{
  const data = { GOLD: walk(1, 4000, .0001, .003), SPX: walk(2, 4000, 0, .003), EURUSD: walk(3, 4000, 0, .002, 1.12) };
  const r1 = BT.simulate(data, liveCfg), r2 = BT.simulate(data, liveCfg);
  assert.deepEqual(r1.trades, r2.trades); console.log('ok   6a determinístico (' + r1.trades.length + ' trades)');
  const s = BT.summarize(r1);
  approx(s.finalEquity, 10000 + s.net, 1e-6, 'equity final = início + soma dos resultados'); approx(r1.finalCash, 10000 + r1.trades.reduce((a, t) => a + t.pnl, 0), 1e-6, 'caixa final = início + soma dos P/L');
  assert.ok(r1.trades.every(t => t.pnl > -liveCfg.start * 0.05), 'nenhuma trade perde mais de 5% da conta');
  const stops = r1.trades.filter(t => t.why === 'stop-loss');
  const worst = Math.min(...stops.map(t => t.pnl), 0);
  assert.ok(worst > -10000 * 0.02, 'perdas de stop ficam perto de 1% (sem saltos): ' + worst.toFixed(2));
  console.log('ok   6b equity final = 10000 + soma dos P/L; pior stop $' + worst.toFixed(2));
  const all = BT.runAll(data, liveCfg); assert.equal(all.variants.length, 4); assert.ok(all.main.s.n >= 0);
  console.log('ok   6c runAll devolve principal + 4 variantes:', all.variants.map(v => v.label + ' ' + v.s.n + ' trades').join(' | '));
}
// 7) tendência forte e limpa: a estratégia tem de ganhar (sinal de que a lógica está do lado certo)
{
  const up = []; let p = 100; const r = rng(7);
  for (let i = 0; i < 3000; i++) { const o = p; p *= 1 + 0.0012 + (r() - .5) * 0.002; up.push({ t: T0 + i * 9e5, o, h: Math.max(o, p) * 1.0008, l: Math.min(o, p) * .9992, c: p }); }
  const s = BT.summarize(BT.simulate({ GOLD: up }, { ...liveCfg, costBps: 2 }));
  assert.ok(s.net > 0, 'tendência forte deve dar lucro: ' + s.net); console.log('ok   7 tendência forte e limpa dá lucro ($' + s.net.toFixed(0) + ', ' + s.n + ' trades)');
}
// 8) a estratégia partilhada dá o mesmo que o desk ao vivo (mesma função)
{
  const st = DS.make(liveCfg, 3), bars = walk(9, 300, 0, .003);
  const a = st.signal(bars), b = DS.make(liveCfg, 3).signal(bars); assert.deepEqual(a, b); console.log('ok   8 strategy.js estável');
}
console.log('backtest ok');
// 9) registo da primeira paragem de capital
{
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101, 101.1, 100.0, 100.2), bar(22, 100.2, 100.3, 99.9, 100), ...flat(3, 23)];
  const r = BT.simulate({ GOLD: bars }, { ...cfg, ddStop: 0.0005 }); const s = BT.summarize(r);
  assert.ok(s.firstHalt && s.firstHalt.equity < cfg.start); console.log('ok   9 primeira paragem registada: conta $' + s.firstHalt.equity.toFixed(2));
}
