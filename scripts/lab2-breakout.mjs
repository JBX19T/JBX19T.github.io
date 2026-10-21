// Parte B: diagnóstico do rompimento atual (N=20, EMA 20/50) em dados da Binance até ao fim da validação.
import { f2, pc, sg, pv, mean, sd, pctl, table } from './lib/util.mjs';
const DAY = 864e5;
const BASE = { N: 20, f: 20, s: 50, conf: 0, ext: 0, adx: 0, vol: '', surge: 0, sess: '', mom: '', retest: 0 };
const VARS = [
  ['confirmação: fecho +0,25 ATR além do nível', { conf: .25 }], ['confirmação: +0,5 ATR', { conf: .5 }], ['confirmação: +1 ATR', { conf: 1 }],
  ['rejeitar rompimento esticado (>1 ATR do nível)', { ext: 1 }], ['rejeitar esticado (>2 ATR)', { ext: 2 }],
  ['sem filtro de tendência', { s: 0 }], ['tendência EMA 10/30', { f: 10, s: 30 }], ['tendência EMA 50/200', { f: 50, s: 200 }],
  ['ADX ≥ 20', { adx: 20 }], ['ADX ≥ 25', { adx: 25 }], ['ADX ≥ 30', { adx: 30 }],
  ['volatilidade: ATR% acima da mediana', { vol: 'hi' }], ['volatilidade: ATR% baixo (compressão)', { vol: 'lo' }], ['vela de expansão (≥1,5 ATR)', { vol: 'exp' }],
  ['volume ≥ 1,5× média de 20', { surge: 1.5 }],
  ['sessão 07-15 UTC', { sess: 'eu' }, 'A', null, true], ['sessão 13-21 UTC', { sess: 'us' }, 'A', null, true], ['sem 00-07 UTC', { sess: 'noasia' }, 'A', null, true],
  ['momentum: ROC(10) concorda', { mom: 'roc' }], ['momentum: RSI(14) >55/<45', { mom: 'rsi' }],
  ['reteste do nível (≤6 velas)', { retest: 6 }],
  ['rompimento de 10 velas', { N: 10 }], ['rompimento de 40 velas', { N: 40 }], ['rompimento de 55 velas', { N: 55 }],
  ['saída B: stop 2, alvo 1,5', {}, 'B'], ['saída C: stop 3, stop móvel 3', {}, 'C'], ['saída E: stop 3, canal oposto', {}, 'E'], ['saída F: break-even a 1,5 ATR', {}, 'F'],
  ['execução: ordens limitadas (maker)', {}, 'A', { exec: 'maker' }],
];
const HS = [1, 2, 4, 6, 12, 24, 48];
export async function partB(C) {
  const { pool, DS, out, LAB, ST, IVS } = C;
  out('# Parte B — Diagnóstico do rompimento atual'); out('');
  out('Regra analisada: rompimento do máximo/mínimo de 20 velas a favor de EMA 20/50, stop 2×ATR, alvo 3×ATR (saída A), em ouro (PAXG) e EUR/USD (EURUSDT) da Binance, **só desenvolvimento e validação**. Cada experiência muda **um** fator; a comparação é emparelhada com a referência (mesmos dados) e corrigida por Holm.'); out('');
  for (const iv of ['4h', '1h', '1d'].filter(v => IVS.includes(v))) {
    const d = DS['real:' + iv]; out(`## Velas de ${iv}`); out('');
    // ---------- B1 teste da entrada ----------
    out(`### B1. A entrada tem vantagem, antes de saídas e custos? (${iv})`); out('');
    const hi = d.valEnd, rows = [], pR = [];
    for (const [k, bars] of Object.entries(d.bars)) {
      const X = LAB.makeCtx(bars), e = LAB.byId.brkx.build(BASE, X).entry, sigs = [];
      for (let i = 0; i < X.n - 1; i++) { if (X.t[i] >= hi) break; const v = e(i); if (v) sigs.push({ i, side: v }); }
      const dec = ST.decluster(sigs, 48), res = ST.entryEdge(X, dec, HS, { stopATR: 2, costBps: 12, B: 3000, seed: 3 });
      for (const r of res) if (r.n >= 8) { rows.push([k, r.h, r.n, `${r.nLong}/${r.nShort}`, sg(r.meanR), f2(r.tR), `${sg(r.nullMeanR)} ± ${f2(r.nullSdR)}`, pv(r.pR), f2(r.eRatio), f2(r.nullERatio), pv(r.pE), f2(r.costR), r]); pR.push(r.pR); }
      out(`- ${k}: ${sigs.length} sinais brutos, ${dec.length} sem sobreposição (1 por 48 velas).`);
    }
    const adj = ST.holm(pR); rows.forEach((r, i) => { r.splice(12, 1, pv(adj[i])); });
    out(''); out(table(['mercado', 'horizonte (velas)', 'sinais', 'compra/venda', 'retorno futuro médio (R)', 't', 'aleatório: média ± desvio (R)', 'p (vs aleatório)', 'E-ratio', 'E-ratio aleatório', 'p do E-ratio', 'custo ida-e-volta (R)', 'p Holm'], rows)); out('');
    out('«R» = retorno do ativo na direção do sinal, medido da abertura seguinte, em unidades de 2×ATR. «Aleatório» = o mesmo nº de entradas (mesma proporção de compras) em instantes ao acaso, 3 000 sorteios. O custo de ida e volta é o do bot (12 bps por lado incluindo slippage).'); out('');
    // ---------- B2 experiências controladas ----------
    out(`### B2. Experiências controladas, um fator de cada vez (${iv})`); out('');
    const vars = VARS.filter(v => !(v[4] && (iv === '1d')));   // sessões só fazem sentido com velas intradiárias
    const mkJob = (name, P, ex, over) => ({ ds: 'real:' + iv, conf: LAB.mkConf('brkx', { ...BASE, ...P }, ex || 'A', iv), to: d.valEnd, w0: d.t0, w1: d.valEnd, tag: name, over: over || undefined });
    const jobs = [mkJob('BASE', {}), ...vars.map(([n, P, ex, over]) => mkJob(n, P, ex, over))];
    const res = await pool.run(jobs); const bad = res.filter(r => !r.ok); if (bad.length) out(`> erros: ${bad.slice(0, 2).map(b => b.tag + ': ' + b.err).join(' | ')}`);
    const get = n => res.find(r => r.tag === n), base = get('BASE'), devDay = Math.floor((d.devEnd - d.t0) / DAY);
    const summ = r => { const rr = r.trades.filter(t => t.r != null).map(t => t.r); return { n: rr.length, meanR: mean(rr), gross: mean(r.trades.filter(t => t.g != null).map(t => t.g)) }; };
    const sb = summ(base), pp = [], table1 = [];
    for (const [n] of vars) { const r = get(n); if (!r || !r.ok) continue; const pb = ST.pairedBootstrap(r.daily, base.daily, { B: 2000, meanBlock: 20 });
      const s = summ(r); pp.push(pb.pOne); table1.push({ n, r, s, pb, dDev: mean(r.daily.slice(0, devDay).map((x, i) => x - base.daily[i])), dVal: mean(r.daily.slice(devDay).map((x, i) => x - base.daily[devDay + i])) }); }
    const adj2 = ST.holm(pp);
    // adenda 1: uma variante com <30 trades não conta como melhoria
    const rowsB = table1.map((x, i) => { const formal = adj2[i] < .05 && x.dDev > 0 && x.dVal > 0, better = formal && x.s.n >= 30, worse = x.pb.mean < 0 && (1 - x.pb.pOne) < .05; return [x.n, x.s.n, sg(x.s.meanR), sg(x.s.gross), pc(x.r.netPct), pc(x.r.maxDD), sg(x.pb.mean * 1e4, 1) + ' bp', f2(x.pb.t), pv(x.pb.pOne), pv(adj2[i]), `${x.dDev > 0 ? '+' : '−'}/${x.dVal > 0 ? '+' : '−'}`, better ? '**melhora**' : formal ? 'passa Holm mas <30 trades: inválida' : worse ? 'pior' : 'sem diferença detetável']; });
    out(table(['experiência', 'trades', 'R médio', 'R bruto', 'resultado', 'queda', 'Δ retorno diário vs referência', 't', 'p (variante > ref.)', 'p Holm', 'Δ dev/val', 'veredicto'], [['**REFERÊNCIA (regra atual)**', sb.n, sg(sb.meanR), sg(sb.gross), pc(base.netPct), pc(base.maxDD), '—', '—', '—', '—', '—', '—'], ...rowsB])); out('');
    out(`Veredicto «melhora» exige Holm < 0,05 **e** diferença positiva no desenvolvimento e na validação. Nº de experiências corrigidas: ${table1.length}. Δ em pontos-base de retorno diário médio da conta.`); out('');
    // ---------- B3 atribuição das perdas ----------
    out(`### B3. Onde perde a referência? (${iv})`); out('');
    const tr = base.trades.filter(t => t.r != null), grp = (name, f) => { const m = new Map(); for (const t of tr) { const k = f(t); if (k == null) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(t); } return [...m.entries()].sort().map(([k, a]) => [name, k, a.length, sg(mean(a.map(t => t.r))), sg(mean(a.map(t => t.g))), pc(a.filter(t => t.r > 0).length / a.length, 0)]); };
    const at = tr.map(t => t.atrPct).filter(Number.isFinite).sort((a, b) => a - b), c1 = pctl(at, 1 / 3), c2 = pctl(at, 2 / 3);
    out(table(['dimensão', 'grupo', 'trades', 'R líquido', 'R bruto', 'acerto'], [
      ...grp('direção', t => t.side > 0 ? 'compra' : 'venda'), ...grp('mercado', t => t.k), ...grp('saída', t => t.why),
      ...grp('volatilidade (ATR%)', t => t.atrPct <= c1 ? '1/3 baixo' : t.atrPct <= c2 ? '1/3médio' : '1/3 alto'),
      ...(iv !== '1d' ? grp('hora de abertura (UTC)', t => { const h = new Date(t.o).getUTCHours(); return h < 8 ? '00-08' : h < 16 ? '08-16' : '16-24'; }) : []),
      ...grp('duração', t => t.bars <= 2 ? '≤2 velas' : t.bars <= 8 ? '3-8 velas' : '>8 velas')])); out('');
    C.B ??= {}; C.B[iv] = { base, rowsB };
  }
}
