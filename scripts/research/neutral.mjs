// Ciclo 3: carteira neutra ao mercado (long/short transversal) com limiar de custo. Regras: docs/PREREGISTO-CICLO3.md
// Uso: node scripts/research/neutral.mjs [--out pasta] [--synthetic [null]] [--small]
import fs from 'node:fs';
import path from 'node:path';
import { f2, pc, sg, pv, iso, table } from '../lib/util.mjs';
import { toGrid, fundingGrid, buildRows, FUND } from './lib/panel.mjs';
import { walkForward, shiftedTarget, portfolio, pearson, ST } from './lib/model.mjs';
import { load, T0, EVAL0, H1 } from './lib/universe.mjs';

const A = process.argv.slice(2), arg = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? (A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true) : d; };
const OUT = arg('out', 'ciclo3-out'), SYN = arg('synthetic', false), SMALL = !!arg('small', false), C = 12, CSTRESS = 24, Q = .2, PRIOR = 32, KS = [0, 1, 2];
const TFS = [{ tf: '1h', step: H1, h: 6, retrain: 720 }, { tf: '1h', step: H1, h: 24, retrain: 720 }, { tf: '4h', step: 4 * H1, h: 6, retrain: 180 }, { tf: '1d', step: 24 * H1, h: 5, retrain: 90 }, { tf: '1d', step: 24 * H1, h: 10, retrain: 90 }];
let buf = []; const out = (s = '') => { buf.push(s); console.log(s); };
fs.mkdirSync(OUT, { recursive: true });
const monthOf = R => g => new Date(R.t0 + (g + 1) * R.stepMs).toISOString().slice(0, 7), yearOf = (R, g) => new Date(R.t0 + (g + 1) * R.stepMs).getUTCFullYear();

/* coortes sem sobreposição: compra o quintil superior de ŷ, vende o inferior; custo 2C + funding líquido */
function cohorts(R, pred, { k, g0, gLo, gHi, raw = R.raw, fund = R.fund, rawDm, minN }) {
  const out = [], h = R.h;
  for (let g = g0; g < gHi; g += h) { if (g < gLo) continue;
    const idx = []; for (let r = R.off[g]; r < R.off[g + 1]; r++) if (Number.isFinite(pred[r])) idx.push(r);
    if (idx.length < minN) continue;
    idx.sort((a, b) => pred[a] - pred[b]); const m = Math.max(1, Math.round(Q * idx.length)), sh = idx.slice(0, m), lg = idx.slice(-m), mean = (a, f) => a.reduce((s, r) => s + f(r), 0) / a.length;
    const ps = mean(lg, r => pred[r] * R.sigBps[r]) - mean(sh, r => pred[r] * R.sigBps[r]);
    if (k > 0 && ps < k * 2 * C) continue;
    const gross = mean(lg, r => raw[r]) - mean(sh, r => raw[r]), fn = mean(lg, r => fund[r]) - mean(sh, r => fund[r]);
    out.push({ g, gross, net: gross - 2 * C - fn, legL: mean(lg, r => rawDm[r]), legS: mean(sh, r => rawDm[r]), ps }); }
  return out;
}
function summ(cs, mo, B = 2000) { if (!cs.length) return { n: 0 }; const cb = ST.clusterBootstrap(cs.map(c => c.net), cs.map(c => mo(c.g)), { B }); return { n: cs.length, net: cb.mean, lo: cb.lo, hi: cb.hi, t: cb.t, pOne: cb.pOne, gross: cs.reduce((s, c) => s + c.gross, 0) / cs.length, legL: cs.reduce((s, c) => s + c.legL, 0) / cs.length, legS: cs.reduce((s, c) => s + c.legS, 0) / cs.length }; }

(async () => {
  const t00 = Date.now();
  out(`# Ciclo 3 — carteira neutra ao mercado — ${new Date().toISOString()}${SYN ? ` (DADOS SINTÉTICOS ${SYN === 'null' ? 'SEM sinal' : 'COM sinal plantado'}: só teste do código)` : ''}`); out('');
  const { series: series0, info, fund } = await load({ SYN, SMALL, FUNDING: true, planted: 'neutral' }), series = Object.fromEntries(Object.entries(series0).filter(([n]) => n === 'BTC' || fund[n])), names = Object.keys(series).sort((a, b) => (a === 'BTC' ? -1 : b === 'BTC' ? 1 : a.localeCompare(b)));
  const tEnd = Math.max(...names.map(n => series[n][series[n].length - 1].t)), N1 = Math.floor((tEnd - T0) / H1) + 1, grids = {};
  for (const n of names) grids[n] = toGrid(series[n], T0, N1);
  const fgrids = Object.fromEntries(names.map(n => [n, fundingGrid(fund[n], T0, N1)])), minN = Math.min(20, Math.floor(names.length / 2));
  out(`${names.length} moedas (${info.length ? 'ignoradas: ' + info.join('; ') + '; ' : ''}sem funding fora); grelha de 1 h até ${iso(tEnd)}; quintis de ${Math.round(Q * 100)} %; mínimo de ${minN} moedas por coorte; custo 2 × ${C} bps + funding líquido; avaliação desde ${iso(EVAL0)}; DEV/VAL/TEST = 50/25/25 %.`); out('');
  const M = [];
  for (const c of TFS) {
    const R = buildRows({ names, grids, tf: c.tf, h: c.h, t0: T0, stepMs: c.step, fgrids }), gEval = Math.ceil((EVAL0 - T0) / c.step), N = R.N, g50 = gEval + Math.floor((N - gEval) * .5), g75 = gEval + Math.floor((N - gEval) * .75);
    const yxs = new Float32Array(R.n), rawDm = new Float32Array(R.n);
    for (let g = 0; g < N; g++) { const a = R.off[g], b = R.off[g + 1]; if (b <= a) continue; let sy = 0, sr = 0; for (let r = a; r < b; r++) { sy += R.y[r]; sr += R.raw[r]; } sy /= b - a; sr /= b - a; for (let r = a; r < b; r++) { yxs[r] = R.y[r] - sy; rawDm[r] = R.raw[r] - sr; } }
    const skip = R.FN.map((f, j) => FUND.includes(f) ? j : -1).filter(j => j >= 0), wf = walkForward(R, { y: yxs, retrain: c.retrain, gEval, skip }), ct = shiftedTarget(R, 2000, yxs), wfc = walkForward(R, { y: ct.y, retrain: c.retrain, gEval, skip });
    M.push({ ...c, R, wf, wfc, ct, yxs, rawDm, gEval, g50, g75, N, id: `${c.tf} h=${c.h}` }); console.error(`modelo ${c.tf} h=${c.h}: ${R.n} linhas`);
  }
  // ---------- Etapa 1 ----------
  out('## Etapa 1 — previsibilidade transversal fora da amostra (DEV+VAL; diagnóstico)'); out('');
  const rows1 = M.map(m => { const { R } = m, lo = R.off[m.gEval], hi = R.off[m.g75], mo = monthOf(R), run = (pred, o = {}) => cohorts(R, pred, { k: 0, g0: m.gEval, gLo: m.gEval, gHi: m.g75, minN, rawDm: m.rawDm, ...o });
    const real = summ(run(m.wf.pred), mo), ctl = summ(run(m.wfc.pred, { raw: m.ct.raw, fund: m.ct.fund, rawDm: m.ct.raw }), mo);
    return [m.id, R.n, f2(pearson(Array.from(m.wf.pred.subarray(lo, hi)), Array.from(m.yxs.subarray(lo, hi))), 4), f2(pearson(Array.from(m.wfc.pred.subarray(lo, hi)), Array.from(m.ct.y.subarray(lo, hi))), 4), real.n, `${sg(real.gross, 1)}`, `${sg(real.legL, 1)} / ${sg(real.legS, 1)}`, `${sg(real.net, 1)} [${sg(real.lo, 1)}, ${sg(real.hi, 1)}]`, f2(real.t), `${sg(ctl.gross, 1)} (líquido t ${f2(ctl.t)})`]; });
  out(table(['modelo', 'linhas', 'correlação OOS ŷ–y transversal', 'idem controlo', 'coortes (k=0)', 'spread bruto médio (bps)', 'perna comprada / vendida vs média (bps)', 'líquido médio [IC95 %]', 't', 'controlo: spread bruto'], rows1)); out('');
  out(`Referência: custo de uma coorte = 2 × ${C} = ${2 * C} bps (+ funding líquido). A perna comprada deve ficar acima da média e a vendida abaixo.`); out('');
  // ---------- Etapa 2 ----------
  out(`## Etapa 2 — configurações em DEV e VAL (custo ${2 * C} bps por coorte + funding)`); out('');
  const cfgs = []; for (const m of M) for (const k of KS) { const { R } = m, mo = monthOf(R), all = cohorts(R, m.wf.pred, { k, g0: m.gEval, gLo: m.gEval, gHi: m.g75, minN, rawDm: m.rawDm }); cfgs.push({ m, k, id: `${m.id}, k=${k}`, dev: summ(all.filter(c => c.g < m.g50), mo), val: summ(all.filter(c => c.g >= m.g50), mo), dv: summ(all, mo, 3000) }); }
  const adj = ST.holm([...cfgs.map(c => c.dv.pOne ?? 1), ...Array(PRIOR).fill(1)]).slice(0, cfgs.length);
  cfgs.forEach((c, i) => { c.p = adj[i]; c.finalist = c.dv.n >= 150 && c.dev.n > 0 && c.val.n > 0 && c.dev.net > 0 && c.val.net > 0 && c.p < .05; });
  const fmt = s => s.n ? `${s.n} · ${sg(s.net, 1)} · t ${f2(s.t)}` : '—';
  out(table(['configuração', 'DEV: coortes · líquido bps · t', 'VAL: coortes · líquido bps · t', 'DEV+VAL: líquido [IC95 %]', 'bruto', 'p unilateral', `p Holm (${cfgs.length + PRIOR})`, 'finalista'], cfgs.map(c => [c.id, fmt(c.dev), fmt(c.val), c.dv.n ? `${sg(c.dv.net, 1)} [${sg(c.dv.lo, 1)}, ${sg(c.dv.hi, 1)}]` : '—', c.dv.n ? sg(c.dv.gross, 1) : '—', pv(c.dv.pOne), pv(c.p), c.finalist ? '**sim**' : 'não']))); out('');
  const fin = cfgs.filter(c => c.finalist).sort((a, b) => b.dv.t - a.dv.t).slice(0, 2);
  // ---------- Etapa 3 ----------
  out('## Etapa 3 — teste final (abre-se uma vez, só para finalistas)'); out('');
  let verdict = 'negativo';
  if (!fin.length) out('**Nenhuma configuração é finalista: o TEST não foi aberto.** Resultado do Ciclo 3: **negativo** (ver as razões na Etapa 2).');
  else {
    const T = fin.map(c => { const { m } = c, R = m.R, mo = monthOf(R), tt = cohorts(R, m.wf.pred, { k: c.k, g0: m.gEval, gLo: m.g75, gHi: m.N, minN, rawDm: m.rawDm }), all = cohorts(R, m.wf.pred, { k: c.k, g0: m.gEval, gLo: m.gEval, gHi: m.N, minN, rawDm: m.rawDm }),
      ctlT = summ(cohorts(R, m.wfc.pred, { k: c.k, g0: m.gEval, gLo: m.g75, gHi: m.N, minN, raw: m.ct.raw, fund: m.ct.fund, rawDm: m.ct.raw }), mo, 3000), s = summ(tt, mo, 5000), pf = portfolio(tt.map(x => ({ g: x.g, net: x.net / 2 })), R, 1), byY = {}; for (const x of all) (byY[yearOf(R, x.g)] ??= []).push(x.net);
      const years = Object.entries(byY).filter(([, a]) => a.length >= 20), yearsPos = years.filter(([, a]) => a.reduce((x, y) => x + y, 0) / a.length > 0).length; return { c, s, ctlT, pf, years, yearsPos, stress: s.n ? s.net - 2 * (CSTRESS - C) : null }; });
    const hp = ST.holm(T.map(x => x.s.pOne ?? 1)), rowsT = [];
    T.forEach((x, i) => { const s = x.s; x.pass = { a: s.n > 0 && s.net > 0 && hp[i] < .05, b: x.stress > 0, c: x.years.length > 0 && x.yearsPos / x.years.length >= 2 / 3, d: x.pf.maxDD <= .25, e: s.n > 0 && s.legL >= 0 && s.legS <= 0, f: !(x.ctlT.n > 0 && x.ctlT.pOne < .05 && x.ctlT.net > 0) }; x.ok = Object.values(x.pass).every(Boolean);
      rowsT.push([x.c.id, s.n, `${sg(s.net, 1)} [${sg(s.lo, 1)}, ${sg(s.hi, 1)}]`, sg(s.gross, 1), f2(s.t), pv(hp[i]), `${sg(s.legL, 1)} / ${sg(s.legS, 1)}`, sg(x.stress, 1), `${x.yearsPos}/${x.years.length}`, `${pc(x.pf.ret)} · queda ${pc(x.pf.maxDD)} · Sharpe ${f2(x.pf.sharpe)}`, Object.entries(x.pass).map(([k, v]) => k + (v ? '✓' : '✗')).join(' '), x.ok ? '**candidata**' : 'não passa']); });
    out(table(['configuração', 'coortes TEST', 'líquido bps [IC95 %]', 'bruto', 't', 'p Holm (≤2)', 'perna comprada / vendida vs média', 'stress 2×24 bps', 'anos >0', 'carteira (TEST)', 'critérios a–f', 'resultado'], rowsT)); out('');
    out('Critérios: a) líquido>0 com p corrigido<0,05; b) líquido>0 com custo 2×24 bps; c) ≥2/3 dos anos>0; d) queda máx. ≤25 %; e) as duas pernas contribuem; f) o controlo negativo não passa em (a).'); out('');
    verdict = T.some(x => x.ok) ? 'candidata' : 'sem candidata'; out(`**Resultado do Ciclo 3: ${verdict === 'candidata' ? 'há candidata (validada apenas em histórico/proxy; carteira de ~8+8 posições, não executável com 10 USD; faltam paper/demo, taxa e execução reais)' : 'nenhuma candidata'}.**`);
  }
  out(''); out('# Contagens efetivas'); out(''); out(`- Modelos treinados: ${M.length * 2}; configurações de decisão: ${cfgs.length} (+ ${PRIOR} de ciclos anteriores no Holm); finalistas: ${fin.length}.`); out(`- Tempo: ${((Date.now() - t00) / 60000).toFixed(1)} min.`);
  fs.writeFileSync(path.join(OUT, 'ciclo3.md'), buf.join('\n')); fs.writeFileSync(path.join(OUT, 'resumo.json'), JSON.stringify({ verdict, finalists: fin.map(c => c.id), nConfigs: cfgs.length }));
})().catch(e => { console.error('ERRO', e); process.exit(1); });
