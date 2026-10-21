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

// L9 inferência da Fase 2: Holm, Reality Check/SPA, bootstrap por clusters e emparelhado, teste da entrada
{
  assert.deepEqual(ST.holm([.01, .04, .03, .005]), [.03, .06, .06, .02]);
  const idx = ST.statIdx(5000, 20, ST.rng(1)); assert.ok(idx.every(v => v >= 0 && v < 5000)); let jumps = 0; for (let i = 1; i < idx.length; i++) if (idx[i] !== (idx[i - 1] + 1) % 5000) jumps++; assert.ok(jumps > 150 && jumps < 400, 'blocos de média ~20: saltos ' + jumps);
  const gauss = seed => { const r = ST.rng(seed); return () => { let a = 0; for (let i = 0; i < 12; i++) a += r(); return a - 6; }; };
  let rej = 0; for (let t = 0; t < 12; t++) { const g = gauss(100 + t), M = Array.from({ length: 60 }, () => Array.from({ length: 500 }, g)); if (ST.realityCheck(M, { B: 200, seed: t + 1 }).pSPA < .05) rej++; }
  assert.ok(rej <= 3, 'em ruído puro a taxa de falsos positivos fica perto de 5%: ' + rej + '/12');
  const g = gauss(7), M = Array.from({ length: 60 }, () => Array.from({ length: 500 }, g)); M.push(Array.from({ length: 500 }, () => g() + .25));
  const rc = ST.realityCheck(M, { B: 300 }); assert.equal(rc.best, 60); assert.ok(rc.pRC < .02 && rc.pSPA < .02, `edge plantado: RC ${rc.pRC} SPA ${rc.pSPA}`);
  const vals = Array.from({ length: 400 }, (_, i) => (i % 7 === 0 ? 2 : -.5)), cl = Array.from({ length: 400 }, (_, i) => Math.floor(i / 20));
  const cb = ST.clusterBootstrap(vals, cl, { B: 2000 }); assert.ok(Math.abs(cb.mean - ST.mean(vals)) < 1e-12 && cb.lo < cb.mean && cb.hi > cb.mean && cb.clusters === 20);
  const g2 = gauss(3), A = Array.from({ length: 600 }, () => g2()), Bz = A.map(x => x - .3 + g2() * .3), pb = ST.pairedBootstrap(A, Bz, { B: 1500 }); assert.ok(pb.mean > .2 && pb.pOne < .01, 'diferença emparelhada positiva: ' + JSON.stringify(pb));
  const pb0 = ST.pairedBootstrap(A, A.map(x => x + g2() * .01), { B: 1500 }); assert.ok(pb0.pOne > .05 && pb0.pOne < .95, 'sem diferença: ' + pb0.pOne);
  // teste da entrada: série de ruído com subidas plantadas depois de cada sinal
  const r = ST.rng(21); let p = 100; const bars = [];
  for (let i = 0; i < 3000; i++) { const o = p; p *= 1 + (r() - .5) * .006; bars.push({ t: T0 + i * H4, o, h: Math.max(o, p) * 1.001, l: Math.min(o, p) * .999, c: p }); }
  const sigs = []; for (let i = 100; i < 2900; i += 50) { sigs.push({ i, side: 1 }); for (let k = 1; k <= 6; k++) { const b = bars[i + k], o = bars[i + k - 1].c, c = o * 1.006; Object.assign(b, { o, c, h: c * 1.001, l: o * .999 }); if (i + k + 1 < bars.length) { /* continuidade */ } } }
  for (let i = 1; i < bars.length; i++) { const sh = bars[i - 1].c - bars[i].o; if (Math.abs(sh) > 0) { const f = bars[i - 1].c / bars[i].o; bars[i].o *= f; bars[i].h *= f; bars[i].l *= f; bars[i].c *= f; } }
  const X = LAB.makeCtx(bars), ee = ST.entryEdge(X, sigs, [6], { B: 800 })[0];
  assert.ok(ee.meanR > .8 && ee.pR < .01 && ee.eRatio > 2, 'entrada com vantagem plantada: ' + JSON.stringify(ee));
  const rnd = ST.rng(5), fake = Array.from({ length: 56 }, () => ({ i: 100 + Math.floor(rnd() * 2800), side: 1 })).sort((a, b) => a.i - b.i), X2 = LAB.makeCtx(series(3000, H4, .006, 77, 100, false));
  let sig = 0; for (let t = 0; t < 8; t++) { const rr = ST.rng(40 + t), f = Array.from({ length: 56 }, () => ({ i: 100 + Math.floor(rr() * 2800), side: rr() < .5 ? 1 : -1 })); const e = ST.entryEdge(X2, f, [6], { B: 400, seed: t + 1 })[0]; if (e.pR < .05) sig++; }
  assert.ok(sig <= 2, 'entradas aleatórias raramente «têm vantagem»: ' + sig + '/8');
  assert.deepEqual(ST.decluster([{ i: 1 }, { i: 5 }, { i: 60 }, { i: 70 }, { i: 130 }], 50).map(x => x.i), [1, 60, 130]);
  ok(`L9 Holm, Reality Check/SPA (ruído: ${rej}/12 falsos positivos; edge plantado p=${rc.pRC.toFixed(3)}), bootstrap por clusters e emparelhado, teste da entrada (plantada: R ${ee.meanR.toFixed(2)}, p ${ee.pR.toFixed(3)}; aleatória: ${sig}/8)`);
}
// L10 família de diagnóstico brkx: reproduz a regra atual e cada filtro só pode REMOVER sinais
{
  const bars = series(3000, H4, .008, 12, 100), X = LAB.makeCtx(bars), base = { N: 20, f: 20, s: 50, conf: 0, ext: 0, adx: 0, vol: '', surge: 0, sess: '', mom: '', retest: 0 };
  const b0 = LAB.byId.brkx.build(base, X), ref = LAB.byId.brk_ema.build({ brk: 20 }, X);
  let nb = 0; for (let i = 0; i < bars.length; i++) { assert.equal(b0.entry(i), ref.entry(i), 'brkx base = regra atual em ' + i); if (ref.entry(i)) nb++; }
  assert.ok(nb > 40, 'sinais base: ' + nb);
  const filters = [{ ext: 1 }, { ext: 2 }, { adx: 20 }, { adx: 30 }, { vol: 'hi' }, { vol: 'lo' }, { vol: 'exp' }, { surge: 1.5 }, { sess: 'eu' }, { sess: 'us' }, { sess: 'noasia' }, { mom: 'roc' }, { mom: 'rsi' }, { conf: .5 }, { conf: 1 }];
  let removed = 0;
  for (const f of filters) { const v = LAB.byId.brkx.build({ ...base, ...f }, X); let n = 0; for (let i = 0; i < bars.length; i++) { const a = v.entry(i); if (a) { n++; assert.equal(a, ref.entry(i), `${JSON.stringify(f)} só remove sinais (vela ${i})`); } } assert.ok(n <= nb, JSON.stringify(f)); removed += nb - n; }
  assert.ok(removed > 0, 'os filtros removem sinais');
  for (const f of [{ retest: 6 }, { s: 0 }, { N: 40 }, { f: 10, s: 30 }]) { const full = LAB.byId.brkx.build({ ...base, ...f }, X); for (const i of [900, 1500, 2100, 2700]) assert.equal(full.entry(i), LAB.byId.brkx.build({ ...base, ...f }, LAB.makeCtx(bars.slice(0, i + 1))).entry(i), 'sem dados futuros ' + JSON.stringify(f)); }
  const conf = LAB.mkConf('brkx', base, 'A', '4h'), cfg = LAB.cfgFor(conf, H4), r = BT.simulate({ GOLD: bars }, cfg, { signalAt: LAB.signalAtFor(conf, cfg), nMarkets: 1 }); assert.ok(r.trades.length >= 0);
  assert.equal(LAB.configs('4h').filter(c => c.sid === 'brkx').length, 0, 'brkx fica fora da enumeração normal');
  ok(`L10 brkx: igual à regra atual (${nb} sinais); 15 filtros só removem sinais (${removed} removidos); reteste, sem filtro de tendência, N=40 e EMA 10/30 sem dados futuros`);
}
console.log('lab ok');
