import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const BT = require('../../grokbot/backtest.js');
const DS = require('../../grokbot/strategy.js');
const approx = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} !~ ${b}`);

// parâmetros pequenos para fazer contas à mão
const cfg = { start: 10000, riskPct: .01, maxLev: 5, fast: 3, slow: 6, brk: 3, atrN: 3, stopATR: 2, tpATR: 3, maxHoldBars: 10, costBps: 0, makerBps: 0, ddStop: .5, dayLoss: .5, maxATRpct: .03 };
const T0 = Date.UTC(2026, 0, 5, 0, 0);
const flat = (n, t0 = 0) => Array.from({ length: n }, (_, i) => ({ t: T0 + (t0 + i) * 9e5, o: 100, h: 100.1, l: 99.9, c: 100 }));
const bar = (i, o, h, l, c) => ({ t: T0 + i * 9e5, o, h, l, c });

// 1) cálculo à mão: rompimento a 101, alvo a 102.6, ganho = 1.5R = $150
{
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101, 102.7, 101, 102.5), ...flat(5, 22).map(b => ({ ...b, o: 102.5, h: 102.6, l: 102.4, c: 102.5 }))];
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
  // a ordem entra à abertura da vela 21 (101); na vela 22 o preço salta para 99, abaixo do stop (~99,93): enche à abertura
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101, 101.3, 100.9, 101.1), bar(22, 99, 99.5, 98.5, 99.2), ...flat(3, 23).map(b => ({ ...b, o: 99.2, h: 99.3, l: 99.1, c: 99.2 }))];
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
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101, 102.7, 101, 102.5), ...flat(5, 22).map(b => ({ ...b, o: 102.5, h: 102.6, l: 102.4, c: 102.5 }))];
  const a = BT.simulate({ GOLD: bars }, cfg).trades[0], b = BT.simulate({ GOLD: bars }, { ...cfg, costBps: 9, makerBps: 9, minATRpct: 0 }).trades[0];
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
  const data = { GOLD: walk(1, 4000, .0001, .012), SPX: walk(2, 4000, 0, .012), EURUSD: walk(3, 4000, 0, .012, 1.12) };
  const r1 = BT.simulate(data, liveCfg), r2 = BT.simulate(data, liveCfg);
  assert.deepEqual(r1.trades, r2.trades); console.log('ok   6a determinístico (' + r1.trades.length + ' trades)');
  const s = BT.summarize(r1);
  approx(s.finalEquity, 10000 + s.net, 1e-6, 'equity final = início + soma dos resultados'); approx(r1.finalCash, 10000 + r1.trades.reduce((a, t) => a + t.pnl, 0), 1e-6, 'caixa final = início + soma dos P/L');
  assert.ok(r1.trades.every(t => t.pnl > -liveCfg.start * 0.05), 'nenhuma trade perde mais de 5% da conta');
  const stops = r1.trades.filter(t => t.why === 'stop-loss');
  const worst = Math.min(...stops.map(t => t.pnl), 0);
  assert.ok(worst > -10000 * 0.02, 'perdas de stop ficam perto de 1% (sem saltos): ' + worst.toFixed(2));
  console.log('ok   6b equity final = 10000 + soma dos P/L; pior stop $' + worst.toFixed(2));
  const all = BT.runAll(data, liveCfg); assert.equal(all.variants.length, 7); assert.ok(all.main.s.n >= 0);
  console.log('ok   6c runAll devolve principal + 7 variantes:', all.variants.map(v => v.label + ' ' + v.s.n + ' trades').join(' | '));
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
// 10) métricas em R: o caso à mão vale exatamente 1.5 R; com 9 bps os custos aparecem em R
{
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101, 102.7, 101, 102.5), ...flat(5, 22).map(b => ({ ...b, o: 102.5, h: 102.6, l: 102.4, c: 102.5 }))];
  const r = BT.simulate({ GOLD: bars }, cfg); const t = r.trades[0];
  approx(t.risk, 100, 1e-6, 'risco = 1% da conta'); approx(t.pnl / t.risk, 1.5, 1e-9, '1.5 R');
  const s9 = BT.summarize(BT.simulate({ GOLD: bars }, { ...cfg, costBps: 9, makerBps: 9, minATRpct: 0 }));
  assert.ok(s9.costR > 0.1 && s9.costR < 0.3, 'custo em R ' + s9.costR); approx(s9.breakEvenWin, 0.4, 1e-12, 'empate a 40%');
  approx(s9.avgGrossR - s9.costR, s9.avgR, 1e-12, 'R líquido = bruto - custos');
  console.log('ok   10 R: caso à mão 1.5 R; custo de 9 bps = ' + s9.costR.toFixed(3) + ' R; empate a 40%');
}
// 11) ordens limitadas: só enchem se o preço passar para lá do limite; tocar não chega
{
  const up = (i, o, h, l, c) => bar(i, o, h, l, c);
  const touch = [...flat(20), up(20, 100, 101.2, 100, 101), up(21, 101.2, 102.7, 101, 102.5), ...flat(5, 22).map(b => ({ ...b, o: 102.5, h: 102.6, l: 102.4, c: 102.5 }))];
  const r1 = BT.simulate({ GOLD: touch }, { ...cfg, exec: 'maker' });
  assert.ok(!r1.trades.some(t => t.o === T0 + 21 * 9e5), 'tocar no limite não enche'); assert.ok(r1.orders.placed > r1.orders.filled);
  const through = [...flat(20), up(20, 100, 101.2, 100, 101), up(21, 101, 101.3, 100.9, 101.2), up(22, 101.2, 102.7, 101.1, 102.5), ...flat(5, 23).map(b => ({ ...b, o: 102.5, h: 102.6, l: 102.4, c: 102.5 }))];
  const r2 = BT.simulate({ GOLD: through }, { ...cfg, exec: 'maker', makerBps: 3, costBps: 9, minATRpct: 0 }); const t = r2.trades[0];
  assert.ok(r2.orders.filled >= 1); assert.equal(t.o, T0 + 21 * 9e5); assert.equal(t.why, 'take-profit');
  approx(t.en, 101 * 1.0003, 1e-9, 'entrada ao limite + taxa maker'); approx(t.fees, t.nt * 0.0006, 1e-9, 'entrada e alvo com taxa maker');
  const rt = BT.simulate({ GOLD: through }, { ...cfg, costBps: 9, minATRpct: 0 }).trades[0];
  assert.ok(t.fees < rt.fees, 'limitadas pagam menos taxas'); console.log('ok   11 limitadas: tocar não enche; atravessar enche; taxas $' + t.fees.toFixed(2) + ' vs $' + rt.fees.toFixed(2) + ' a mercado');
}
// 12) funding: taxa constante de 0,01%/h numa posição longa custa horas x taxa x valor
{
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), ...Array.from({ length: 8 }, (_, j) => bar(21 + j, 101, 101.3, 100.9, 101))];
  const fund = { GOLD: [[T0, 0.0001]] };   // só uma hora conhecida: as outras usam a média (a mesma)
  const r = BT.simulate({ GOLD: bars }, { ...cfg, maxHoldBars: 8 }, { funding: fund }); const t = r.trades[0];
  const hours = Math.floor(t.c / 36e5) - Math.floor(t.o / 36e5);
  approx(t.fund, hours * 0.0001 * t.nt, 1e-9, 'funding'); assert.ok(hours >= 2);
  const r0 = BT.simulate({ GOLD: bars }, { ...cfg, maxHoldBars: 8 }).trades[0]; approx(r0.pnl - t.pnl, t.fund, 1e-9, 'funding sai do P/L');
  const sh = BT.simulate({ GOLD: bars.map(b => ({ ...b, o: 200 - b.o, h: 200 - b.l, l: 200 - b.h, c: 200 - b.c })) }, { ...cfg, maxHoldBars: 8 }, { funding: fund }).trades[0];
  assert.equal(sh.side, -1); assert.ok(sh.fund < 0, 'short recebe funding positivo'); console.log('ok   12 funding: long paga $' + t.fund.toFixed(2) + ' em ' + hours + ' h; short recebe');
}
// 13) janelas from/to e teste em duas partes
{
  const data = { GOLD: walk(11, 3000, .00005, .012), SPX: walk(12, 3000, 0, .012), EURUSD: walk(13, 3000, 0, .012, 1.12) };
  const mid = data.GOLD[1800].t;
  const a = BT.simulate(data, liveCfg, { to: mid }), b = BT.simulate(data, liveCfg, { from: mid });
  assert.ok(a.trades.every(t => t.o < mid && t.c < mid), 'parte A só antes'); assert.ok(b.trades.every(t => t.o >= mid), 'parte B só depois');
  const R = BT.research(data, liveCfg);
  assert.equal(R.rows.length, 10); assert.equal(R.split, data.GOLD[1800].t);
  if (R.best) { const cands = R.rows.filter(r => r.A.n >= R.minA); assert.ok(cands.every(r => r.A.avgR <= R.best.A.avgR), 'escolhida só pela parte A'); }
  console.log('ok   13 duas partes:', R.rows.map(r => r.strategy + '/' + r.exec + ' A' + r.A.n + ' B' + r.B.n).join(' | '), '· aprovada:', R.pass);
}
// 14) famílias de estratégia
{
  const s = { ...liveCfg, minATRpct: 0 };
  const drop = [...walk(21, 60, 0, .001), ...Array.from({ length: 3 }, (_, j) => ({ t: T0 + (60 + j) * 9e5, o: 100 - j * 2, h: 100 - j * 2, l: 98 - j * 2, c: 98 - j * 2 }))];
  assert.equal(DS.make(DS.withStrategy(s, 'reversion')).signal(drop).dir, 'long');
  const ramp = Array.from({ length: 160 }, (_, i) => { const c = i < 140 ? 100 - i * 0.05 : 93 + (i - 140) * 1.5; return { t: T0 + i * 9e5, o: c, h: c + .2, l: c - .2, c }; });
  let seen = null; const st = DS.make(DS.withStrategy(s, 'trend'));
  for (let i = 120; i <= ramp.length; i++) { const g = st.signal(ramp.slice(0, i)); if (g.dir === 'long') { seen = i; break; } }
  assert.ok(seen, 'tendência lenta deve dar long no cruzamento'); assert.notEqual(st.signal(ramp.slice(0, seen + 1)).dir, 'long', 'só na vela do cruzamento');
  assert.equal(DS.withStrategy(s, 'xxx').strategy, 'breakout');
  console.log('ok   14 reversão compra a queda; tendência entra só no cruzamento (vela ' + seen + ')');
}
// 15) o critério de aprovação não deixa passar o acaso, mas deixa passar uma vantagem real
{
  const H1 = 36e5, cfgD = { ...DS.DEFAULTS, start: 10000, ddStop: .2, dayLoss: .05 };
  const walkH = (seed, n, vol, p0) => walk(seed, n, 0, vol, p0).map((b, i) => ({ ...b, t: T0 + i * H1 }));
  for (const sd of [101, 202, 303]) {
    const R = BT.research({ GOLD: walkH(sd, 3000, .012, 4400), SPX: walkH(sd + 1, 3000, .012, 7600), EURUSD: walkH(sd + 2, 3000, .012, 1.12) }, cfgD);
    assert.equal(R.pass, false, 'dados aleatórios não podem passar (semente ' + sd + ')');
  }
  const ou = (seed, n, p0, k, vol) => { const r = rng(seed); let x = 0, prev = p0; const out = []; for (let i = 0; i < n; i++) { x = x * k + (r() - .5) * 2 * vol; const c = p0 * (1 + x), o = prev; out.push({ t: T0 + i * H1, o, h: Math.max(o, c) * (1 + r() * vol * .2), l: Math.min(o, c) * (1 - r() * vol * .2), c }); prev = c; } return out; };
  const R = BT.research({ GOLD: ou(3, 5000, 4400, .93, .008), SPX: ou(4, 5000, 7600, .93, .008), EURUSD: ou(5, 5000, 1.12, .93, .008) }, cfgD);
  assert.equal(R.pass, true); assert.equal(R.best.strategy, 'reversion');
  console.log('ok   15 acaso não passa (3 séries aleatórias); mercado que reverte à média passa com a reversão (t = ' + R.best.B.tR.toFixed(1) + ')');
}
// 16) stop móvel: numa subida longa deixa correr o ganho muito além de 3×ATR; o stop só sobe
{
  const s = DS.withStrategy({ ...DS.DEFAULTS, start: 10000, ddStop: .5, dayLoss: .5 }, 'trail');
  const bars = []; let p = 100; const r = rng(5);
  for (let i = 0; i < 400; i++) { const o = p; p *= 1 + (i < 150 ? (r() - .5) * .014 : .002 + (r() - .5) * .01); bars.push({ t: T0 + i * 36e5, o, h: Math.max(o, p) * 1.002, l: Math.min(o, p) * .998, c: p }); }
  const res = BT.simulate({ GOLD: bars }, s), tr = res.trades.filter(t => t.side > 0);
  const best = Math.max(...tr.map(t => t.pnl / t.risk));
  assert.ok(best > 3, 'uma trade de tendência deve render mais do que 3 R: ' + best.toFixed(2));
  assert.ok(res.trades.every(t => t.why !== 'take-profit'), 'sem alvo fixo');
  const st = DS.make(s), q = { side: 1, stop: 90, best: 100, atr: 2 };
  assert.equal(st.trailStop(q, { h: 110, l: 108 }), 104); assert.equal(st.trailStop(q, { h: 105, l: 100 }), 104, 'nunca desce');
  const qs = { side: -1, stop: 110, best: 100, atr: 2 }; assert.equal(st.trailStop(qs, { h: 95, l: 90 }), 96);
  assert.equal(DS.make(DS.withStrategy(s, 'breakout')).trailStop({ ...q }, { h: 200, l: 199 }), q.stop, 'as outras estratégias não mexem no stop');
  console.log('ok   16 stop móvel: melhor trade ' + best.toFixed(1) + ' R; o stop só aperta');
}
// 17) trava do dinheiro real
{
  const now = Date.now(), a = { strategy: 'trail', iv: '4h', at: now - 864e5, n: 40, avgR: .2, pf: 1.3, tR: 2.4 };
  assert.equal(DS.approvalOk(a, 'trail', '4h', now), true);
  assert.equal(DS.approvalOk(a, 'trail', '1h', now), false, 'outras velas não');
  assert.equal(DS.approvalOk(a, 'breakout', '4h', now), false, 'outra estratégia não');
  assert.equal(DS.approvalOk({ ...a, at: now - 46 * 864e5 }, 'trail', '4h', now), false, 'expira aos 45 dias');
  for (const bad of [{ n: 29 }, { avgR: 0 }, { pf: 1.1 }, { tR: 1.9 }, { at: now + 36e5 }]) assert.equal(DS.approvalOk({ ...a, ...bad }, 'trail', '4h', now), false, JSON.stringify(bad));
  assert.equal(DS.approvalOk(null, 'trail', '4h', now), false);
  console.log('ok   17 trava: só a estratégia e as velas aprovadas, com os números exigidos, durante 45 dias');
}
// 18) RSI 2 dentro da tendência: compra uma queda curta numa tendência de alta, nunca contra a tendência
{
  const s = DS.withStrategy({ ...DS.DEFAULTS, minATRpct: 0 }, 'pullback'), st = DS.make(s);
  const up = Array.from({ length: 150 }, (_, i) => { const c = 100 + i * 0.3 + Math.sin(i / 3); return { t: T0 + i * 36e5, o: c, h: c + .5, l: c - .5, c }; });
  const dip = [...up, ...[-1.5, -1.5, -1.5].map((d, j) => { const c = up[149].c + d * (j + 1); return { t: T0 + (150 + j) * 36e5, o: c, h: c + .3, l: c - .3, c }; })];
  assert.equal(st.signal(dip).dir, 'long');
  const down = dip.map(b => ({ ...b, o: 300 - b.o, h: 300 - b.l, l: 300 - b.h, c: 300 - b.c }));
  assert.equal(st.signal(down).dir, 'short', 'espelho: subida curta em tendência de baixa');
  const crash = Array.from({ length: 150 }, (_, i) => { const c = 200 - i * 0.3; return { t: T0 + i * 36e5, o: c, h: c + .5, l: c - .5, c }; }).concat([{ t: T0 + 150 * 36e5, o: 155, h: 155, l: 150, c: 150 }]);
  assert.notEqual(st.signal(crash).dir, 'long', 'queda em tendência de baixa não é compra');
  console.log('ok   18 RSI 2: compra a queda na alta, vende a subida na baixa, não compra contra a tendência');
}
