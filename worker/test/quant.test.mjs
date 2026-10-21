// Auditoria quantitativa: diagnóstico por vela, estatísticas recalculadas a partir das trades, R ponderado, bootstrap e protocolo.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const BT = require('../../grokbot/backtest.js'), DS = require('../../grokbot/strategy.js');
const ok = n => console.log('ok  ', n);
const T0 = Date.UTC(2026, 0, 5, 0, 0), M15 = 9e5, H4 = 144e5;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
// série com tendências lentas + ruído; vol = movimento típico por vela (fração do preço)
function series(n, step, vol, seed, p0 = 100) {
  const r = rng(seed); let p = p0; const out = [];
  for (let i = 0; i < n; i++) { const o = p; p *= 1 + Math.sin(i / 40) * vol * .35 + (r() - .5) * vol * 2; out.push({ t: T0 + i * step, o, h: Math.max(o, p) * (1 + vol * .3), l: Math.min(o, p) * (1 - vol * .3), c: p }); }
  return out;
}
const cfgOf = (name, extra = {}) => ({ ...DS.withStrategy({ ...DS.DEFAULTS, start: 10000, ddStop: .5, dayLoss: .5 }, name), ...extra });

// Q1 o diagnóstico mostra porque o rompimento de 15 min não entra: o filtro de custo, demonstrado por contraste
{
  const bars = { GOLD: series(1500, M15, .0011, 7, 4000) };
  const a = BT.simulate(bars, cfgOf('breakout')), b = BT.simulate(bars, cfgOf('breakout', { minATRpct: 0 }));
  assert.equal(a.trades.length, 0, 'com o filtro de custo, 0 trades');
  assert.ok(b.trades.length >= 5, 'sem o filtro há sinais: ' + b.trades.length);
  const cost = a.diag.reasons['filtro de custo (custo por trade acima do máximo em R)'] || 0;
  assert.ok(cost > 500, 'o filtro é a razão dominante: ' + cost);
  assert.ok(a.diag.wouldBe.long + a.diag.wouldBe.short >= 5, 'sinais que o filtro bloqueou: ' + JSON.stringify(a.diag.wouldBe));
  assert.ok(a.diag.atr.GOLD.p50 < a.diag.minATRpct && a.diag.atr.GOLD.aboveMin < .1, 'ATR típico abaixo do mínimo exigido');
  ok('Q1 15 min: ' + cost + ' velas bloqueadas pelo filtro de custo; ATR mediano ' + (a.diag.atr.GOLD.p50 * 100).toFixed(2) + '% < mínimo ' + (a.diag.minATRpct * 100).toFixed(2) + '%; sem filtro ' + b.trades.length + ' trades');
}
// Q2 conservação: cada vela avaliada tem exatamente uma razão (ou é sinal aceite); sinais ≥ ordens ≥ execuções = trades
{
  const bars = { GOLD: series(2500, H4, .006, 3, 2000), SPX: series(2500, H4, .005, 4, 5000) };
  const r = BT.simulate(bars, cfgOf('swing')), d = r.diag, engine = /^(proteção|posição ou ordem|janela|ordem )/;
  const sigReasons = Object.entries(d.reasons).filter(([k]) => !engine.test(k)).reduce((s, [, v]) => s + v, 0);
  assert.equal(sigReasons + d.accepted.long + d.accepted.short, d.bars, 'razões + sinais aceites = velas avaliadas');
  assert.ok(r.orders.signals >= r.orders.placed && r.orders.placed >= r.orders.filled && r.orders.filled === r.trades.length, JSON.stringify(r.orders) + ' trades ' + r.trades.length);
  assert.ok(r.trades.length >= 5);
  ok('Q2 conservação: ' + d.bars + ' velas = razões + sinais; ' + JSON.stringify(r.orders) + ' → ' + r.trades.length + ' trades');
}
// Q3 recálculo cruzado: coerente numa corrida real, e deteta adulterações
{
  const bars = { GOLD: series(3000, H4, .006, 11, 2000), SPX: series(3000, H4, .005, 12, 5000) };
  for (const name of ['daytrade', 'swing', 'breakout']) {
    const r = BT.simulate(bars, cfgOf(name, { minATRpct: 0 })), s = BT.summarize(r);
    assert.deepEqual(BT.crossCheck(r, s).filter(x => !/fim do teste/.test(x)), [], name);
    const bad = { ...s, net: s.net + 5 }; assert.ok(BT.crossCheck(r, bad).some(x => /líquido/.test(x)), 'deteta resultado adulterado');
    const r2 = { ...r, finalCash: r.finalCash + 1 }; assert.ok(BT.crossCheck(r2).some(x => /conta final/.test(x)), 'deteta conta final incoerente');
  }
  ok('Q3 recálculo cruzado coerente em day trade, swing e rompimento; adulterações detetadas');
}
// Q4 estatísticas com resultado conhecido de antemão
{
  const mk = (pnl, i) => ({ k: 'GOLD', side: 1, o: T0 + i * H4, c: T0 + i * H4 + H4, en: 100, ex: 100, nt: 1000, pnl, why: 'stop-loss', bars: 1, risk: 10, atrPct: .01 * (1 + i % 3), costUsd: 2, fees: 1, slipUsd: 1, fund: 0 });
  const trades = [30, -10, -10, 20, -10, -10, -10].map(mk);
  const curve = [1000, 1030, 1020, 1010, 1030, 1020, 1010, 1000].map((e, i) => [T0 + i * H4, e]);
  const a = BT.analyze({ trades, curve, cfg: { start: 1000 }, maxDD: .0291, openAtEnd: 0 });
  assert.deepEqual([a.n, a.wins, a.losses, a.grossWin, a.grossLoss, a.net, a.pf], [7, 2, 5, 50, 50, 0, 1]);
  assert.deepEqual([a.avgWin, a.avgLoss, a.payoff, a.expUsd, a.expR, a.maxLossStreak, a.maxDDusd], [25, -10, 2.5, 0, 0, 3, 30]);
  assert.ok(Math.abs(a.hit - 2 / 7) < 1e-12); assert.equal(a.grossBeforeCosts, 14);   // 0 + 7 trades × $2 de custos
  assert.ok(a.byMonth['2026-01'].n === 7 && a.bySession['Ásia 00-08 UTC'] != null);
  ok('Q4 estatísticas: pf 1,00 · payoff 2,5 · sequência de 3 perdas · queda $30 · custos somados — valores definidos antes de correr');
}
// Q5 o caso "Swing": média simples em R positiva com resultado em $ negativo é possível; o R ponderado pelo risco concorda com o $
{
  const t = (pnl, risk, i) => ({ k: 'GOLD', side: 1, o: T0 + i * H4, c: T0 + i * H4 + H4, en: 100, ex: 100, nt: 1000, pnl, why: 'stop-loss', bars: 1, risk, costUsd: 0, fees: 0, slipUsd: 0, fund: 0 });
  const trades = [t(20, 10, 0), t(-30, 100, 1)];   // +2 R com risco pequeno; −0,3 R com risco grande (a conta já maior)
  const res = { trades, curve: [[T0, 10000], [T0 + 1, 9990]], cfg: { start: 10000 }, maxDD: .001, finalCash: 9990, halts: {}, openAtEnd: 0, bh: {}, bars: {}, orders: {}, start: T0, end: T0 + 2 };
  const s = BT.summarize(res);
  assert.ok(s.avgR > 0.8 && s.net < 0, `R simples ${s.avgR} com resultado ${s.net}`);
  assert.ok(s.avgRw < 0, 'R ponderado pelo risco ' + s.avgRw); assert.ok(Math.abs(s.avgRw - (-10 / 110)) < 1e-12);
  ok('Q5 R simples +' + s.avgR.toFixed(2) + ' com resultado $' + s.net + ' é aritmética, não erro; R ponderado ' + s.avgRw.toFixed(3) + ' tem o sinal do resultado');
}
// Q6 bootstrap por blocos: determinístico, cobre o zero sem vantagem e exclui o zero com vantagem clara
{
  const r = rng(5), noise = Array.from({ length: 120 }, () => r() * 2 - 1), edge = Array.from({ length: 120 }, () => 1 + (r() - .5));
  const a = BT.blockBootstrap(noise), a2 = BT.blockBootstrap(noise), e = BT.blockBootstrap(edge);
  assert.deepEqual(a, a2, 'determinístico'); assert.ok(a.lo < 0 && a.hi > 0, 'sem vantagem: o IC inclui 0'); assert.ok(e.lo > .8 && e.pPos === 1, 'com vantagem clara: IC acima de 0');
  assert.equal(BT.blockBootstrap([1, 2, 3]).lo, null, 'amostra pequena: sem IC');
  ok('Q6 bootstrap por blocos: IC [' + a.lo.toFixed(2) + ', ' + a.hi.toFixed(2) + '] em ruído (inclui 0); [' + e.lo.toFixed(2) + ', ' + e.hi.toFixed(2) + '] com vantagem');
}
// Q7 protocolo: partições cronológicas, teste final só para a referência e as promissoras, limiar corrigido pelo nº de variantes
{
  const bars = { GOLD: series(4000, H4, .006, 21, 2000) };
  const P = BT.protocol(bars, cfgOf('swing', { minATRpct: 0 }), [
    { id: 'H1', hypothesis: 'stop móvel mais largo', override: { trailATR: 4 } },
    { id: 'H2', hypothesis: 'EMA lenta 100', override: { slow: 100 } },
    { id: 'H3', hypothesis: 'igual à referência', override: {} }]);
  assert.equal(P.variantsTested, 4); assert.ok(P.tCrit.adjusted > P.tCrit.single && Math.abs(P.tCrit.adjusted - 2.4977) < .01, 'z ajustado k=4: ' + P.tCrit.adjusted);
  assert.ok(P.split[0] < P.split[1]);
  const base = P.rows[0], h3 = P.rows.find(r => r.id === 'H3');
  assert.ok(base.test && base.test.n >= 0, 'a referência tem teste final');
  assert.equal(h3.promising, false, 'uma variante idêntica não é estritamente melhor'); assert.equal(h3.test, null, 'e o teste final não é calculado para ela');
  for (const r of P.rows) assert.equal(r.test != null, r.id === 'base' || r.promising, r.id);
  assert.deepEqual(h3.dev, base.dev); assert.deepEqual(h3.val, base.val);
  ok('Q7 protocolo: ' + P.rows.map(r => r.id + (r.promising ? '*' : '')).join(' ') + ' · limiar t ajustado ' + P.tCrit.adjusted.toFixed(2) + ' (4 variantes)');
}
// Q8 casos extremos: sem trades, dados em falta e velas inválidas não rebentam
{
  const e = BT.simulate({ GOLD: [] }, cfgOf('breakout')), s = BT.summarize(e), a = BT.analyze(e);
  assert.deepEqual([s.n, s.avgR, s.pf, a.maxLossStreak, a.expR], [0, null, null, 0, null]); assert.deepEqual(BT.crossCheck(e, s), []);
  const few = BT.simulate({ GOLD: series(30, H4, .006, 1) }, cfgOf('swing')); assert.equal(few.trades.length, 0); assert.ok(few.diag.reasons['aquecimento (velas insuficientes)'] >= 1);
  const gap = series(500, H4, .006, 2); gap.splice(200, 40);   // lacuna de 40 velas
  assert.doesNotThrow(() => BT.simulate({ GOLD: gap }, cfgOf('swing')));
  assert.equal(BT.protocol({ GOLD: series(50, H4, .006, 1) }, cfgOf('swing'), []), null, 'sem dados suficientes: não há protocolo');
  ok('Q8 sem trades, aquecimento, lacuna de velas e dados insuficientes: sem erros e sem números inventados');
}
console.log('quant ok');
