// Laboratório: biblioteca de estratégias (sem dados futuros), indicadores, ganchos do motor, estatística e dados de controlo.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const BT = require('../../grokbot/backtest.js'), DS = require('../../grokbot/strategy.js'), LAB = require('../../grokbot/lab.js'), ST = require('../../grokbot/labstats.js');
const ok = n => console.log('ok  ', n);
const T0 = Date.UTC(2024, 0, 1, 0, 0), H = 36e5, H4 = 4 * H;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function series(n, step, vol, seed, p0 = 100, withVol = true) {
  const r = rng(seed); let p = p0; const out = [];
  for (let i = 0; i < n; i++) { const o = p; p *= 1 + Math.sin(i / 40) * vol * .35 + (r() - .5) * vol * 2; out.push({ t: T0 + i * step, o, h: Math.max(o, p) * (1 + vol * .3 * r()), l: Math.min(o, p) * (1 - vol * .3 * r()), c: p, ...(withVol ? { v: 100 + r() * 50 } : {}) }); }
  return out;
}

// L1 integridade da biblioteca
{
  const seen = new Set(); let total = 0;
  for (const iv of ['1h', '4h', '1d']) for (const c of LAB.configs(iv)) { const k = iv + '|' + c.id; assert.ok(!seen.has(k), 'id duplicado ' + k); seen.add(k); total++; }
  for (const S of LAB.LIB) { assert.ok(S.id && S.family && S.name && S.src && S.src.length && S.grid && typeof S.build === 'function', S.id); assert.ok(S.ivs.every(v => ['1h', '4h', '1d'].includes(v))); }
  assert.equal(new Set(LAB.LIB.map(s => s.id)).size, LAB.LIB.length);
  assert.ok(LAB.LIB.length >= 25 && total >= 1500, `${LAB.LIB.length} famílias, ${total} configurações`);
  ok(`L1 biblioteca: ${LAB.LIB.length} famílias, ${total} configurações (1h/4h/1d), ids únicos`);
}
// L2 nenhum sinal usa dados futuros: o sinal em i é igual com todas as velas ou só com as velas até i
{
  const bars = series(2600, H4, .006, 5, 100), checks = [];
  const idx = [1100, 1311, 1522, 1733, 1944, 2155, 2399];
  let nChecked = 0, nSignals = 0;
  for (const S of LAB.LIB) {
    const grid = []; const keys = Object.keys(S.grid); const first = {}, last = {}; for (const k of keys) { first[k] = S.grid[k][0]; last[k] = S.grid[k][S.grid[k].length - 1]; }
    for (const P of [first, last]) {
      if (S.valid && !S.valid(P)) continue;
      const full = S.build(P, LAB.makeCtx(bars));
      for (const i of idx) {
        const part = S.build(P, LAB.makeCtx(bars.slice(0, i + 1)));
        const a = full.entry(i), b = part.entry(i); assert.equal(a, b, `${S.id} ${JSON.stringify(P)} entry(${i}) usa o futuro`); if (a) nSignals++;
        if (full.exit) assert.equal(full.exit(i), part.exit(i), `${S.id} exit(${i}) usa o futuro`);
        if (i > 0 && S.edge) assert.equal(full.entry(i - 1), part.entry(i - 1), `${S.id} entry(${i - 1})`);
        nChecked++;
      }
    }
  }
  assert.ok(nSignals > 20, 'o teste tem de exercitar sinais reais: ' + nSignals);
  ok(`L2 sem dados futuros: ${nChecked} comparações (todas as famílias, 2 combinações, 7 instantes), ${nSignals} com sinal ativo`);
}
// L3 indicadores com valores calculados à mão
{
  const mk = cs => cs.map((c, i) => ({ t: T0 + i * H4, o: c, h: c + 1, l: c - 1, c }));
  const X = LAB.makeCtx(mk([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]));
  assert.equal(X.sma(X.c, 3)[2], 11); assert.equal(X.sma(X.c, 3)[5], 14); assert.ok(Number.isNaN(X.sma(X.c, 3)[1]));
  const e = X.ema(X.c, 3); assert.equal(e[2], 11); assert.ok(Math.abs(e[3] - (13 * .5 + 11 * .5)) < 1e-12);   // k = 2/(3+1) = 0,5
  assert.equal(X.roc(5)[7], 17 / 12 - 1);
  assert.equal(X.don(3, true)[5], 15);    // máximos das 3 velas anteriores (índices 2..4): 12+1, 13+1, 14+1 → 15
  assert.equal(X.don(3, false)[5], 11);   // mínimos das mesmas velas: 12−1 = 11, 13−1, 14−1 → 11
  assert.equal(X.rsi(2)[15], 100);   // série sempre a subir: RSI = 100
  const A = X.atr(3); assert.equal(A[3], 2);   // intervalo 2 em todas as velas e saltos de 1: TR = 2
  const Y = LAB.makeCtx(mk([10, 9, 10, 9, 10, 9, 10, 9, 10, 9]));
  assert.ok(Y.rsi(2)[9] > 0 && Y.rsi(2)[9] < 100);
  const b = Y.bb(4, 2); assert.ok(Math.abs(b.mid[3] - 9.5) < 1e-12 && Math.abs(b.up[3] - (9.5 + 2 * .5)) < 1e-12);   // sd populacional de [10,9,10,9] = 0,5
  const up = LAB.makeCtx(mk(Array.from({ length: 80 }, (_, i) => 100 + i * 2))); const a = up.adx(14);
  assert.ok(a.adx[79] > 25 && a.pdi[79] > a.mdi[79], 'tendência limpa: ADX alto e +DI > −DI');
  ok('L3 indicadores: SMA, EMA (k=2/(n+1)), ROC, Donchian, RSI, ATR, Bollinger (sd populacional) e ADX conferidos');
}
// L4 paridade com a regra de produção (rompimento + EMA 20/50): concordam em quase todas as velas
{
  const bars = series(1800, H4, .012, 9, 100);
  const cfg = { ...DS.DEFAULTS, minATRpct: 0 }, prod = DS.make(cfg, 2), X = LAB.makeCtx(bars), lab = LAB.byId.brk_ema.build({ brk: 20 }, X);
  let diff = 0, n = 0, sig = 0;
  for (let i = 300; i < bars.length; i++) { const p = prod.signal(bars.slice(Math.max(0, i - 199), i + 1)), d = p.dir === 'long' ? 1 : p.dir === 'short' ? -1 : 0, l = lab.entry(i); n++; if (d) sig++; if (d !== l) diff++; }
  assert.ok(sig > 20 && diff / n < .02, `${diff} diferenças em ${n} velas (${sig} sinais)`);
  ok(`L4 paridade com a produção: ${diff} diferenças em ${n} velas, ${sig} sinais (a janela de 200 velas muda a EMA só no arranque)`);
}
// L5 ganchos do motor: saída por sinal, break-even, exposição e perf
{
  // velas de 4h: sobe, depois cai; um sinal de entrada na vela 30 e de saída na vela 40
  const flat = [], mk = (i, o, h, l, c) => ({ t: T0 + i * H4, o, h, l, c });
  for (let i = 0; i < 80; i++) flat.push(mk(i, 100, 100.3, 99.7, 100));
  const bars = { GOLD: flat };
  const cfg = { ...DS.DEFAULTS, start: 10000, ddStop: .5, dayLoss: .5, stopATR: 3, tpATR: 0, maxHoldBars: 70, costBps: 0, slipBps: 0, slipStopBps: 0, minATRpct: 0 };
  const sigAt = (k, i) => ({ dir: i === 30 ? 'long' : 'flat', atr: .6, exit: i === 40 ? 1 : undefined, why: 'x' });
  const r = BT.simulate(bars, cfg, { signalAt: sigAt });
  assert.equal(r.trades.length, 1); assert.equal(r.trades[0].why, 'sinal de saída'); assert.equal(r.trades[0].o, T0 + 31 * H4, 'entra à abertura seguinte'); assert.equal(r.trades[0].c, T0 + 41 * H4, 'sai à abertura seguinte ao sinal de saída');
  assert.ok(r.exposure > 0 && r.exposure < 1, 'exposição ' + r.exposure);
  // break-even: sobe 1,8 ATR e volta à entrada -> com beATR fecha ~0; sem ele chega ao stop inicial (-3 ATR)
  const mv = []; for (let i = 0; i < 40; i++) mv.push(mk(i, 100, 100.2, 99.8, 100));
  mv.push(mk(40, 100, 101.4, 99.9, 101.3)); mv.push(mk(41, 101.3, 101.5, 99.0, 99.2)); mv.push(mk(42, 99.2, 99.3, 94, 94.5)); for (let i = 43; i < 60; i++) mv.push(mk(i, 94.5, 94.7, 94.3, 94.5));
  const entryAt = (k, i) => ({ dir: i === 38 ? 'long' : 'flat', atr: .5, why: 'x' });
  const noBE = BT.simulate({ GOLD: mv }, { ...cfg, stopATR: 3 }, { signalAt: entryAt }).trades[0], be = BT.simulate({ GOLD: mv }, { ...cfg, stopATR: 3, beATR: 1.5 }, { signalAt: entryAt }).trades[0];
  assert.ok(noBE.pnl < -50, 'sem break-even perde ~3 ATR: ' + noBE.pnl); assert.ok(be.pnl > -5 && be.pnl <= 5, 'com break-even sai perto da entrada: ' + be.pnl); assert.equal(be.why, 'stop-loss');
  const pf = BT.perf(r); assert.ok(pf.exposure > 0 && pf.days > 0); assert.equal(typeof pf.returnPct, 'number');
  ok('L5 motor: saída por sinal à abertura seguinte, break-even (' + be.pnl.toFixed(1) + ' contra ' + noBE.pnl.toFixed(1) + ' sem ele), exposição ' + r.exposure.toFixed(2));
}
// L6 perf: valores conhecidos
{
  const eq = [10000, 10100, 10050, 10200, 10150, 10300]; const curve = eq.map((e, i) => [T0 + i * 864e5, e]);
  const p = BT.perf({ curve, cfg: { start: 10000 }, finalCash: 10300, maxDD: .0049, exposure: .5 });
  assert.ok(Math.abs(p.returnPct - .03) < 1e-12 && p.exposure === .5); assert.equal(p.underwaterDays, 1);
  const all = eq.map((e, i) => e / (i ? eq[i - 1] : 10000) - 1);
  const m = all.reduce((a, b) => a + b, 0) / all.length, sd = Math.sqrt(all.reduce((a, b) => a + (b - m) ** 2, 0) / (all.length - 1));
  assert.ok(Math.abs(p.sharpe - m / sd * Math.sqrt(365)) < 1e-9, 'Sharpe ' + p.sharpe); assert.ok(p.sortino > p.sharpe * 0, 'Sortino definido'); assert.ok(Math.abs(p.recovery - 300 / 50) < 1e-9);
  ok('L6 Sharpe anualizado, fator de recuperação ($300 ÷ $50), dias debaixo de água e exposição conferidos à mão');
}
// L7 estatística: t, Bonferroni, Benjamini-Hochberg, clusters e dados de controlo
{
  const t = ST.tstat([1, 2, 3, 4, 5]); assert.equal(t.mean, 3); assert.ok(Math.abs(t.t - 3 / (Math.sqrt(2.5) / Math.sqrt(5))) < 1e-12);
  assert.ok(Math.abs(ST.normCdf(1.96) - .975) < 1e-4 && Math.abs(ST.pTwo(1.96) - .05) < 2e-4);
  assert.ok(Math.abs(ST.bonferroniZ(1) - 1.96) < 1e-3 && Math.abs(ST.bonferroniZ(100) - 3.4808) < 1e-3, 'z(100)=' + ST.bonferroniZ(100));
  assert.deepEqual([...ST.benjaminiHochberg([.001, .008, .039, .041, .042, .06, .074, .205, .212, .216], .05)].sort(), [0, 1]);   // exemplo clássico: com q=5% só rejeita 2
  const r = ST.rng(3), a = Array.from({ length: 300 }, () => r() - .5), b = a.map(x => x * 2 + 1e-9), c = Array.from({ length: 300 }, () => r() - .5);
  const cl = ST.cluster([a, b, c], .9); assert.equal(cl.count, 2); assert.deepEqual(cl.group, [0, 0, 1]);
  const bars = series(500, H4, .006, 4), a1 = ST.shuffleBars(bars, 1), a2 = ST.shuffleBars(bars, 1), a3 = ST.shuffleBars(bars, 2);
  assert.deepEqual(a1, a2, 'determinístico'); assert.notDeepEqual(a1.map(x => x.c), a3.map(x => x.c)); assert.equal(a1.length, bars.length);
  assert.ok(a1.every((x, i) => x.t === bars[i].t && x.h >= Math.max(x.o, x.c) - 1e-9 && x.l <= Math.min(x.o, x.c) + 1e-9), 'datas mantidas e velas válidas');
  const lr = bs => bs.slice(1).map((x, i) => Math.log(x.c / bs[i].c)), ac = xs => ST.corr(xs.slice(1), xs.slice(0, -1));
  const sorted = series(3000, H4, .006, 8), sh = ST.shuffleBars(sorted, 5);
  assert.ok(Math.abs(ac(lr(sh))) < .06 && Math.abs(ac(lr(sorted))) > Math.abs(ac(lr(sh))), `autocorrelação original ${ac(lr(sorted)).toFixed(3)} → baralhada ${ac(lr(sh)).toFixed(3)}`);
  ok('L7 estatística: t, z de Bonferroni (N=100 → 3,48), Benjamini-Hochberg (exemplo clássico), clusters e dados de controlo sem autocorrelação');
}
// L8 todas as famílias correm no motor sem erros, com custos e filtro de custo reais
{
  const bars = { GOLD: series(2200, H4, .01, 31, 2000), EURUSD: series(2200, H4, .01, 32, 1) };
  let ran = 0, withTrades = 0; const t0 = Date.now();
  for (const S of LAB.LIB) { const conf = LAB.configs('4h', { only: [S.id] })[0]; if (!conf) continue;
    const cfg = LAB.cfgFor(conf, H4), r = BT.simulate(bars, cfg, { signalAt: LAB.signalAtFor(conf, cfg) }); ran++; if (r.trades.length) withTrades++;
    assert.deepEqual(BT.crossCheck(r), [], S.id); }
  assert.ok(ran >= 25 && withTrades >= 15, `${ran} famílias, ${withTrades} com trades`);
  ok(`L8 ${ran} famílias correm no motor (${withTrades} com trades) e o recálculo cruzado fica coerente; ${(Date.now() - t0)} ms`);
}
console.log('lab ok');
