// Ciclo 1 da missão «estratégia original»: previsão conjunta (ridge walk-forward) com limiar de custo. Regras: docs/PREREGISTO-CICLO1.md
// Uso: node scripts/research/edgemap.mjs [--out pasta] [--synthetic [null]] [--small]
// Só lê dados públicos de mercado; não envia ordens.
import fs from 'node:fs';
import path from 'node:path';
import { fetchBinance } from '../lib/data.mjs';
import { f2, pc, sg, pv, iso, table } from '../lib/util.mjs';
import { toGrid } from './lib/panel.mjs';
import { buildRows, FEATURES, LOCAL_ONLY } from './lib/panel.mjs';
import { walkForward, shiftedTarget, trades, summarize, portfolio, pearson, ST } from './lib/model.mjs';

const A = process.argv.slice(2), arg = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? (A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true) : d; };
const OUT = arg('out', 'ciclo1-out'), SYN = arg('synthetic', false), SMALL = !!arg('small', false);
const UNIVERSE = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'LTC', 'LINK', 'BCH', 'TRX', 'XLM', 'ATOM', 'ETC', 'VET', 'THETA', 'EOS', 'XTZ', 'NEO', 'IOTA', 'ALGO', 'ZEC', 'DASH', 'ONT', 'QTUM', 'ZIL', 'BAT', 'ENJ', 'MATIC', 'SOL', 'DOT', 'AVAX', 'UNI', 'FIL', 'AAVE', 'SUSHI', 'COMP', 'SNX', 'MKR', 'YFI', '1INCH', 'PAXG', 'EUR'];
const T0 = Date.UTC(2019, 0, 1), EVAL0 = Date.UTC(2020, 0, 1), H1 = 36e5, C = 12, CSTRESS = 24;
const TFS = [{ tf: '1h', step: H1, h: 6, retrain: 30 * 24 }, { tf: '1h', step: H1, h: 24, retrain: 30 * 24 }, { tf: '4h', step: 4 * H1, h: 6, retrain: 30 * 6 }, { tf: '1d', step: 24 * H1, h: 5, retrain: 90 }];
const KS = [1, 1.5, 2, 3];
let buf = []; const out = (s = '') => { buf.push(s); console.log(s); };
fs.mkdirSync(OUT, { recursive: true });

function synthetic(names, N1, seed, a) {   // a = força do momentum plantado em 6 barras (0 = passeio aleatório)
  const r = ST.rng(seed), gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) * Math.SQRT2; }, res = {};
  const mkt = new Float64Array(N1); for (let i = 0; i < N1; i++) mkt[i] = .0015 * gauss();
  for (const n of names) { const bars = []; let p = 100 * (1 + r()), lr = new Array(6).fill(0); const base = .0035 * (.7 + r() * .6);
    for (let i = 0; i < N1; i++) { const sg_ = base * Math.exp(.4 * Math.sin(i / 700 + n.length)), z = Math.max(-2, Math.min(2, lr.reduce((s, x) => s + x, 0) / (sg_ * Math.sqrt(6)))), ret = sg_ * gauss() + mkt[i] + a * sg_ * z; const o = p; p *= Math.exp(ret); lr.shift(); lr.push(ret);
      bars.push({ t: T0 + i * H1, o, h: Math.max(o, p) * (1 + .001 * r()), l: Math.min(o, p) * (1 - .001 * r()), c: p, v: 100 + 80 * r() }); }
    res[n] = bars; }
  return res;
}
async function load() {
  const series = {}, info = [];
  if (SYN) { const names = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'LTC', 'DOT', 'LINK']; const s = synthetic(names, SMALL ? 24000 : 30000, 7, SYN === 'null' ? 0 : .15); for (const n of names) series[n] = s[n]; return { series, info: [] }; }
  const q = [...UNIVERSE]; await Promise.all(Array.from({ length: 4 }, async () => { while (q.length) { const n = q.shift(); const sym = n === 'EUR' ? 'EURUSDT' : n + 'USDT'; try { const b = await fetchBinance(sym, '1h', T0, 120000); if (b.length > 5000) series[n] = b; else info.push(`${n}: poucas barras (${b.length}), ignorada`); } catch (e) { info.push(`${n}: sem dados (${e.message})`); } } }));
  return { series, info };
}
const monthOf = (R) => g => new Date(R.t0 + (g + 1) * R.stepMs).toISOString().slice(0, 7);
const yearOf = (R, g) => new Date(R.t0 + (g + 1) * R.stepMs).getUTCFullYear();

(async () => {
  const t00 = Date.now(); let runs = 0;
  out(`# Ciclo 1 — previsão conjunta com limiar de custo — ${new Date().toISOString()}${SYN ? ` (DADOS SINTÉTICOS ${SYN === 'null' ? 'SEM sinal' : 'COM sinal plantado'}: só teste do código)` : ''}`); out('');
  const { series, info } = await load(), names = Object.keys(series).sort((a, b) => (a === 'BTC' ? -1 : b === 'BTC' ? 1 : a.localeCompare(b)));
  if (!series.BTC) throw new Error('sem BTC');
  const tEnd = Math.min(...names.map(n => series[n][series[n].length - 1].t)), N1 = Math.floor((tEnd - T0) / H1) + 1, grids = {};
  for (const n of names) grids[n] = toGrid(series[n], T0, N1);
  out('## Dados'); out('');
  out(table(['moeda', 'barras 1 h', 'primeira barra', 'última barra'], names.map(n => [n, series[n].length, iso(series[n][0].t), iso(series[n][series[n].length - 1].t)]))); out('');
  if (info.length) { out('Ignoradas: ' + info.join('; ')); out(''); }
  out(`${names.length} moedas; grelha de 1 h até ${iso(tEnd)}. Custo de referência C = ${C} bps (ida e volta); stress ${CSTRESS} bps. Avaliação desde ${iso(EVAL0)}; DEV/VAL/TEST = 50/25/25 % do tempo.`); out('');

  // ---------- modelos walk-forward por (prazo, horizonte) ----------
  const M = [];
  for (const c of TFS) {
    const R = buildRows({ names, grids, tf: c.tf, h: c.h, t0: T0, stepMs: c.step }), gEval = Math.ceil((EVAL0 - T0) / c.step), N = R.N, g50 = gEval + Math.floor((N - gEval) * .5), g75 = gEval + Math.floor((N - gEval) * .75);
    const wf = walkForward(R, { retrain: c.retrain, gEval }), ct = shiftedTarget(R), wfc = walkForward(R, { y: ct.y, retrain: c.retrain, gEval }), wfl = walkForward(R, { retrain: c.retrain, gEval, skip: LOCAL_ONLY.map(f => FEATURES(c.tf).indexOf(f)) });
    runs += 3; M.push({ ...c, R, wf, wfc, wfl, ct, gEval, g50, g75, N, id: `${c.tf} h=${c.h}` }); console.error(`modelo ${c.tf} h=${c.h}: ${R.n} linhas, ${wf.betas.length} reajustes`);
  }
  const NU = names.length;

  // ---------- Etapa 1: existência (diagnóstico) ----------
  out('## Etapa 1 — existe previsibilidade fora da amostra? (DEV+VAL; diagnóstico, não decide)'); out('');
  const rows1 = M.map(m => { const { R } = m, lo = R.off[m.gEval], hi = R.off[m.g75];
    const ic = (pred, y) => pearson(Array.from(pred.subarray(lo, hi)), Array.from(y.subarray(lo, hi)));
    const real = summarize(trades(R, m.wf.pred, { k: 0, C, gLo: m.gEval, gHi: m.g75 }), monthOf(R)), ctl = summarize(trades(R, m.wfc.pred, { k: 0, C, raw: m.ct.raw, gLo: m.gEval, gHi: m.g75 }), monthOf(R)), loc = summarize(trades(R, m.wfl.pred, { k: 0, C, gLo: m.gEval, gHi: m.g75 }), monthOf(R));
    return [m.id, R.n, f2(ic(m.wf.pred, R.y), 4), f2(ic(m.wfc.pred, m.ct.y), 4), real.n, `${sg(real.gross, 1)} [${sg(real.lo + C, 1)}, ${sg(real.hi + C, 1)}]`, f2(real.t), `${sg(ctl.gross, 1)}`, f2(ctl.t), `${sg(loc.gross, 1)} (t ${f2(loc.t)})`]; });
  out(table(['modelo', 'linhas', 'correlação OOS ŷ–y', 'idem controlo', 'trades (todos os sinais)', 'bruto médio bps [IC95 %]', 't do líquido (clusters de mês)', 'controlo: bruto bps', 'controlo: t do líquido', 'só características locais: bruto bps'], rows1)); out('');
  out(`Referência: o custo de ida e volta é ${C} bps. «Bruto» = retorno médio de seguir o sinal, antes de custos.`); out('');

  // ---------- Etapa 2: 16 configurações em DEV+VAL ----------
  out('## Etapa 2 — configurações em DEV e VAL (custo 12 bps)'); out('');
  const cfgs = []; for (const m of M) for (const k of KS) { const { R } = m, tdv = trades(R, m.wf.pred, { k, C, gLo: m.gEval, gHi: m.g75 }), mo = monthOf(R);
    const dev = summarize(tdv.filter(t => t.g < m.g50), mo), val = summarize(tdv.filter(t => t.g >= m.g50), mo), dv = summarize(tdv, mo, { B: 3000 }); cfgs.push({ m, k, id: `${m.id}, k=${k}`, dev, val, dv }); }
  const adj = ST.holm(cfgs.map(c => c.dv.pOne ?? 1));
  cfgs.forEach((c, i) => { c.p = adj[i]; c.finalist = c.dv.n >= 300 && c.dev.n > 0 && c.val.n > 0 && c.dev.net > 0 && c.val.net > 0 && c.p < .05; });
  const fmt = s => s.n ? `${s.n} · ${sg(s.net, 1)} · t ${f2(s.t)}` : '—';
  out(table(['configuração', 'DEV: n · líquido bps · t', 'VAL: n · líquido bps · t', 'DEV+VAL: líquido [IC95 %]', 'bruto', 'p unilateral', 'p Holm (16)', 'finalista'], cfgs.map(c => [c.id, fmt(c.dev), fmt(c.val), c.dv.n ? `${sg(c.dv.net, 1)} [${sg(c.dv.lo, 1)}, ${sg(c.dv.hi, 1)}]` : '—', c.dv.n ? sg(c.dv.gross, 1) : '—', pv(c.dv.pOne), pv(c.p), c.finalist ? '**sim**' : 'não']))); out('');
  const fin = cfgs.filter(c => c.finalist).sort((a, b) => b.dv.t - a.dv.t).slice(0, 2);

  // ---------- Etapa 3: TEST só para finalistas ----------
  out('## Etapa 3 — teste final (abre-se uma vez, só para finalistas)'); out('');
  let verdict = 'negativo';
  if (!fin.length) out('**Nenhuma configuração é finalista: o TEST não foi aberto.** Resultado do Ciclo 1: **negativo** (ver as razões na Etapa 2).');
  else {
    const rowsT = [], pT = [];
    const T = fin.map(c => { const { m } = c, R = m.R, tt = trades(R, m.wf.pred, { k: c.k, C, gLo: m.g75, gHi: m.N }), s = summarize(tt, monthOf(R), { B: 5000 }), all = trades(R, m.wf.pred, { k: c.k, C, gLo: m.gEval, gHi: m.N });
      const ctlT = summarize(trades(R, m.wfc.pred, { k: c.k, C, raw: m.ct.raw, gLo: m.g75, gHi: m.N }), monthOf(R), { B: 3000 }), pf = portfolio(tt, R, NU), byY = {}; for (const t of all) (byY[yearOf(R, t.g)] ??= []).push(t.net);
      const years = Object.entries(byY).filter(([, a]) => a.length >= 30), yearsPos = years.filter(([, a]) => a.reduce((x, y) => x + y, 0) / a.length > 0).length; return { c, s, ctlT, pf, years, yearsPos, stress: s.n ? s.net - (CSTRESS - C) : null }; });
    const hp = ST.holm(T.map(x => x.s.pOne ?? 1));
    T.forEach((x, i) => { const s = x.s; x.pass = { a: s.n > 0 && s.net > 0 && hp[i] < .05, b: x.stress > 0, c: x.years.length > 0 && x.yearsPos / x.years.length >= 2 / 3, d: x.pf.maxDD <= .25, e: (s.long == null || s.long >= 0) && (s.short == null || s.short >= 0), f: !(x.ctlT.n > 0 && x.ctlT.pOne < .05 && x.ctlT.net > 0) }; x.ok = Object.values(x.pass).every(Boolean);
      rowsT.push([x.c.id, s.n, `${sg(s.net, 1)} [${sg(s.lo, 1)}, ${sg(s.hi, 1)}]`, sg(s.gross, 1), f2(s.t), pv(hp[i]), pc(s.hit, 0), f2(s.pf), `${sg(s.long, 1)} / ${sg(s.short, 1)}`, sg(x.stress, 1), `${x.yearsPos}/${x.years.length}`, `${pc(x.pf.ret)} · queda ${pc(x.pf.maxDD)} · Sharpe ${f2(x.pf.sharpe)}`, `${Object.entries(x.pass).map(([k, v]) => k + (v ? '✓' : '✗')).join(' ')}`, x.ok ? '**candidata**' : 'não passa']); });
    out(table(['configuração', 'trades TEST', 'líquido bps [IC95 %]', 'bruto', 't', 'p Holm (≤2)', 'acerto', 'fator de lucro', 'compras / vendas (bps)', 'stress 24 bps', 'anos >0', 'carteira (TEST)', 'critérios a–f', 'resultado'], rowsT)); out('');
    out('Critérios: a) líquido>0 com p corrigido<0,05; b) líquido>0 a 24 bps; c) ≥2/3 dos anos>0; d) queda máx. ≤25 %; e) compras e vendas ≥0; f) o controlo negativo não passa em (a).'); out('');
    verdict = T.some(x => x.ok) ? 'candidata' : 'sem candidata';
    out(`**Resultado do Ciclo 1: ${verdict === 'candidata' ? 'há candidata (validada apenas em histórico/proxy; faltam paper, funding, taxa real e capital mínimo)' : 'nenhuma candidata'}.**`);
  }
  out('');

  // ---------- diagnósticos exploratórios (só DEV+VAL) ----------
  out('## Diagnósticos exploratórios (DEV+VAL, não decidem)'); out('');
  for (const m of M) { const { R } = m, lo = R.off[m.gEval], hi = R.off[m.g75], idx = []; for (let r = lo; r < hi; r++) if (Number.isFinite(m.wf.pred[r])) idx.push(r);
    idx.sort((a, b) => m.wf.pred[a] - m.wf.pred[b]); const nb = 10, rowsD = []; for (let b = 0; b < nb; b++) { const sl = idx.slice(Math.floor(b * idx.length / nb), Math.floor((b + 1) * idx.length / nb)); const mp = sl.reduce((s, r) => s + m.wf.pred[r] * R.sigBps[r], 0) / sl.length, mr = sl.reduce((s, r) => s + R.raw[r], 0) / sl.length; rowsD.push([b + 1, sl.length, sg(mp, 1), sg(mr, 1)]); }
    out(`### ${m.id}: decis da previsão (1 = mais negativa)`); out(''); out(table(['decil', 'linhas', 'movimento previsto (bps)', 'movimento realizado (bps)'], rowsD)); out('');
    const FN = R.FN, sd = FN.map((_, j) => { let s = 0, s2 = 0, n = 0; for (let r = lo; r < hi; r += 7) { const x = R.X[r * R.F + j]; s += x; s2 += x * x; n++; } return Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)); });
    const imp = FN.map((f, j) => [f, m.wf.betas.reduce((s, b) => s + Math.abs(b.beta[j + 1]), 0) / m.wf.betas.length * sd[j], m.wf.betas.reduce((s, b) => s + b.beta[j + 1], 0) / m.wf.betas.length]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    out(`Características mais usadas (|β|×desvio; sinal médio de β): ${imp.map(([f, v, b]) => `${f} ${v.toFixed(3)} (${b >= 0 ? '+' : '−'})`).join(' · ')}`); out(''); }
  const m0 = M[0], tr0 = trades(m0.R, m0.wf.pred, { k: 1, C, gLo: m0.gEval, gHi: m0.g75 }), btcJ = m0.R.FN.indexOf('btc24');
  const grp = (f, labels) => table(['grupo', 'trades', 'líquido médio (bps)'], labels.map(l => { const a = tr0.filter(t => f(t) === l); return [l, a.length, a.length ? sg(a.reduce((s, t) => s + t.net, 0) / a.length, 1) : '—']; }));
  out(`### ${m0.id}, k=1: por bloco de 6 h UTC e regime do BTC`); out('');
  out(grp(t => `${String(Math.floor(new Date(m0.R.t0 + (t.g + 1) * m0.R.stepMs).getUTCHours() / 6) * 6).padStart(2, '0')}h`, ['00h', '06h', '12h', '18h'])); out('');
  out(grp(t => m0.R.X[t.r * m0.R.F + btcJ] >= 0 ? 'BTC subiu nas últimas 24 h' : 'BTC desceu nas últimas 24 h', ['BTC subiu nas últimas 24 h', 'BTC desceu nas últimas 24 h'])); out('');
  out('# Contagens efetivas'); out(''); out(`- Modelos treinados: ${runs} (4 prazos × {real, controlo, só características locais}); configurações de decisão: ${cfgs.length}; finalistas: ${fin.length}.`); out(`- Tempo: ${((Date.now() - t00) / 60000).toFixed(1)} min.`);
  fs.writeFileSync(path.join(OUT, 'ciclo1.md'), buf.join('\n')); fs.writeFileSync(path.join(OUT, 'resumo.json'), JSON.stringify({ verdict, finalists: fin.map(c => c.id), nConfigs: cfgs.length }));
})().catch(e => { console.error('ERRO', e); process.exit(1); });
