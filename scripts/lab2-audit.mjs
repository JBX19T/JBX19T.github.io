// Parte A: auditoria das 1 655 experiências do laboratório (re-executadas aqui, só até ao fim da validação).
import { f2, pc, sg, pv, mean, sd, pctl, month, table } from './lib/util.mjs';
const DAY = 864e5;
export async function partA(C) {
  const { pool, DS, out, LAB, ST, BT, IVS } = C;
  out('# Parte A — Auditoria das 1 655 experiências'); out('');
  out('Todas as configurações foram simuladas outra vez com o motor atual, **só até ao fim da validação** (o teste final continua intacto). Corrida adicional **sem custos** (taxa 0, slippage 0) para medir se há previsibilidade bruta, e as mesmas configurações em dados baralhados (controlo).'); out('');
  const FREE = { costBps: 0, makerBps: 0, slipBps: 0, slipStopBps: 0 };
  const R = {};
  for (const iv of IVS) {
    const d = DS['real:' + iv], confs = LAB.configs(iv), t0 = Date.now();
    const mk = (ds, tag, over, slim) => confs.map(conf => ({ ds, conf, to: d.valEnd, w0: d.t0, w1: d.valEnd, tag, over, slim }));
    const [real, free, nullFree, nullCost] = [await pool.run(mk('real:' + iv, 'real')), await pool.run(mk('real:' + iv, 'free', FREE, true)), await pool.run(mk('null1:' + iv, 'nullfree', FREE, true)), await pool.run(mk('null1:' + iv, 'nullcost', undefined, true))];
    R[iv] = { real, free, nullFree, nullCost, confs, d };
    console.error(`parte A ${iv}: ${confs.length}×4 simulações em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    const bad = [real, free, nullFree, nullCost].flat().filter(x => !x.ok); if (bad.length) out(`> ${bad.length} simulações com erro em ${iv}: ${bad[0].err}`);
  }
  const byId = arr => new Map(arr.filter(x => x.ok).map(x => [x.id, x]));
  // ---------- A1 contagens ----------
  out('## A1. Quantas estratégias verdadeiramente distintas?'); out('');
  const rowsA1 = []; const dupExamples = [];
  let totCfg = 0, totDistinct = 0;
  for (const iv of IVS) {
    const { confs, d } = R[iv], bars = d.bars, ctxs = Object.fromEntries(Object.entries(bars).map(([k, b]) => [k, LAB.makeCtx(b)]));
    const sigKey = new Map(); const fp = new Map();   // (sid|P) -> impressão digital dos sinais
    for (const c of confs) { const key = c.sid + '|' + LAB.pkey(c.P); if (sigKey.has(key)) continue;
      let h = 2166136261, cnt = 0; for (const [k, X] of Object.entries(ctxs)) { const e = LAB.byId[c.sid].build(c.P, X).entry; for (let i = 0; i < X.n; i++) { const v = e(i); if (v) { cnt++; h = Math.imul(h ^ (i * 3 + (v > 0 ? 1 : 2)) ^ (k.length << 20), 16777619) >>> 0; } } }
      sigKey.set(key, `${cnt}:${h.toString(16)}`); }
    const groups = new Map(); let zero = 0; for (const [key, f] of sigKey) { if (f.startsWith('0:')) { zero++; continue; } if (!groups.has(f)) groups.set(f, []); groups.get(f).push(key); }   // combinações sem nenhum sinal não são «duplicadas», são vazias
    const dupGroups = [...groups.values()].filter(g => g.length > 1);
    for (const g of dupGroups.slice(0, 3)) dupExamples.push(`${iv}: ${g.join(' = ')}`);
    const real = byId(R[iv].real), elig = confs.map(c => real.get(c.id)).filter(x => x && x.n >= 40);
    const cl = th => ST.cluster(elig.map(x => x.daily), th).count;
    rowsA1.push([iv, confs.length, new Set(confs.map(c => c.sid)).size, sigKey.size, zero, groups.size, elig.length, cl(.8), cl(.9), cl(.95)]);
    totCfg += confs.length; totDistinct += groups.size;
  }
  out(table(['velas', 'configurações', 'famílias', 'combinações família×parâmetros', 'sem nenhum sinal', 'conjuntos de sinais de entrada distintos', 'elegíveis (≥40 trades)', 'grupos efetivos (corr ≥0,8)', '(≥0,9)', '(≥0,95)'], rowsA1)); out('');
  out(`Resposta: 29 famílias; ${totCfg} configurações são combinações de **${totDistinct} conjuntos de sinais de entrada realmente distintos** (as outras variam só a saída, que muda o que acontece depois da entrada mas não a entrada). Ver quais famílias dão exatamente os mesmos sinais:`); out('');
  for (const e of dupExamples) out(`- ${e}`);
  out(''); out('Para testes múltiplos o número que conta não é o das configurações, é o dos grupos efetivos com resultados diários correlacionados (colunas à direita; o laboratório usou ≥0,9).'); out('');
  // ---------- A2/A3 por família, ativo, vela e período ----------
  out('## A2/A3. Por mercado, tamanho de vela e período (todas as configurações, trades de desenvolvimento+validação)'); out('');
  const rowsM = [];
  for (const iv of IVS) {
    const d = R[iv].d, agg = {};
    for (const x of R[iv].real) if (x.ok) for (const t of x.trades) { if (t.r == null) continue; const per = t.o < d.devEnd ? 'dev' : 'val';
      const keys = [t.k, per, t.side > 0 ? 'compra' : 'venda']; for (const k of keys) { (agg[k] ??= []).push(t.r); } }
    for (const k of Object.keys(agg).sort()) rowsM.push([iv, k, agg[k].length, sg(mean(agg[k])), pc(agg[k].filter(v => v > 0).length / agg[k].length, 0)]);
  }
  out(table(['velas', 'grupo', 'trades (todas as configs)', 'R médio por trade', 'trades >0'], rowsM)); out('');
  out('Nota: cada trade conta tantas vezes quantas as configurações que a abriram; serve para ver **onde** está o resultado, não para medir significância.'); out('');
  // ---------- A4 perdas ----------
  out('## A4. Principais fatores das perdas (decomposição por trade, em R)'); out('');
  const rowsL = [];
  for (const iv of IVS) {
    const all = R[iv].real.filter(x => x.ok).flatMap(x => x.trades.filter(t => t.r != null).map(t => ({ ...t, ex: x.id.split('/').pop() })));
    const grp = (name, arr) => rowsL.push([iv, name, arr.length, sg(mean(arr.map(t => t.g))), sg(-mean(arr.map(t => t.fee))), sg(-mean(arr.map(t => t.slip))), sg(mean(arr.map(t => t.r))), pc(arr.filter(t => t.g > 0 && t.r <= 0).length / arr.length, 0)]);
    grp('todas', all); for (const e of ['A', 'B', 'C', 'E', 'F']) grp('saída ' + e, all.filter(t => t.ex === e));
  }
  out(table(['velas', 'grupo', 'trades', 'R bruto', 'taxas', 'slippage', 'R líquido', 'trades com bruto>0 mas líquido≤0'], rowsL)); out('');
  // ---------- A5 métricas e limiar ----------
  out('## A5. As métricas estão calculadas corretamente? De onde vem o limiar de 3,4–3,7?'); out('');
  const rowsT = [];
  for (const iv of IVS) {
    const real = byId(R[iv].real), elig = R[iv].confs.map(c => real.get(c.id)).filter(x => x && x.n >= 40);
    const pooled = elig.map(x => { const r = x.trades.filter(t => t.r != null).map(t => t.r); return { x, r, s: ST.tstat(r) }; });
    // verificação independente do t (Welford, uma passagem)
    let maxErr = 0; for (const p of pooled.slice(0, 40)) { let m = 0, M2 = 0, n = 0; for (const v of p.r) { n++; const dlt = v - m; m += dlt / n; M2 += dlt * (v - m); } const t2 = m / (Math.sqrt(M2 / (n - 1)) / Math.sqrt(n)); maxErr = Math.max(maxErr, Math.abs(t2 - p.s.t)); }
    const cl9 = ST.cluster(elig.map(x => x.daily), .9).count, zB = ST.bonferroniZ(cl9, .10), zAll = ST.bonferroniZ(elig.length, .10);
    const top = pooled.slice().sort((a, b) => (b.s.t ?? -9) - (a.s.t ?? -9)).slice(0, 15);
    let ratio = [];
    for (const p of top) { const cb = ST.clusterBootstrap(p.r, p.x.trades.filter(t => t.r != null).map(t => month(t.c)), { B: 1500 }); if (cb.se) ratio.push(cb.se / (p.s.sd / Math.sqrt(p.s.n))); }
    const rc = ST.realityCheck(elig.map(x => x.daily), { B: 600, meanBlock: 10 });
    const nullElig = R[iv].nullCost.filter(x => x.ok && x.n >= 40), rcN = nullElig.length ? ST.realityCheck(nullElig.map(x => x.daily), { B: 600, meanBlock: 10 }) : null;
    rowsT.push([iv, elig.length, cl9, f2(zAll), f2(zB), f2(maxErr, 12), f2(mean(ratio)), `${f2(rc.bestT)} / ${pv(rc.pRC)} / ${pv(rc.pSPA)}`, rcN ? `${f2(rcN.bestT)} / ${pv(rcN.pRC)} / ${pv(rcN.pSPA)}` : '—']);
  }
  out(table(['velas', 'elegíveis', 'grupos efetivos', 'z Bonferroni (N=elegíveis)', 'z Bonferroni (N=grupos) = limiar usado', 'erro máx. do t (Welford vs código)', 'razão SE por clusters de mês / SE ingénuo (15 melhores)', 'Reality Check/SPA reais: melhor t / p(RC) / p(SPA)', 'controlo baralhado: melhor t / p(RC) / p(SPA)'], rowsT)); out('');
  out('Leitura: (1) o t do código coincide com o cálculo independente; (2) o limiar vem de dividir 5 % (unilateral) pelo nº de grupos efetivos, z = Φ⁻¹(1 − 0,05/N); (3) se a razão dos erros-padrão for >1, o t ingénuo **sobrestima** a significância (as trades vizinhas não são independentes), por isso o limiar de 3,4–3,7 não é excessivo; (4) o *Reality Check* e o SPA (bootstrap estacionário sobre as séries diárias de todas as configurações elegíveis) dão uma segunda opinião sobre o melhor resultado, sem depender do número de grupos.'); out('');
  // ---------- A6 poder ----------
  out('## A6. O tamanho da amostra chega? (poder estatístico)'); out('');
  const rowsP = [];
  for (const iv of IVS) {
    const real = byId(R[iv].real), elig = R[iv].confs.map(c => real.get(c.id)).filter(x => x && x.n >= 40), cl9 = ST.cluster(elig.map(x => x.daily), .9).count, zB = ST.bonferroniZ(cl9, .10);
    const mde = elig.map(x => { const r = x.trades.filter(t => t.r != null).map(t => t.r), s = sd(r); return s ? (zB + .8416) * s / Math.sqrt(r.length) : null; }).filter(Number.isFinite);
    const ns = elig.map(x => x.trades.filter(t => t.r != null).length), sds = elig.map(x => sd(x.trades.filter(t => t.r != null).map(t => t.r))).filter(Number.isFinite);
    const need = (zB + .8416) ** 2 * (mean(sds) ** 2) / .15 ** 2;
    rowsP.push([iv, elig.length, f2(pctl(ns, .5), 0), f2(mean(sds)), sg(pctl(mde, .5)), `${sg(pctl(mde, .1))} … ${sg(pctl(mde, .9))}`, f2(need, 0)]);
  }
  out(table(['velas', 'elegíveis', 'trades (mediana)', 'desvio do R por trade (média)', 'vantagem mínima detetável (R, mediana; poder 80%)', 'intervalo p10…p90', 'trades necessários para detetar +0,15 R']  , rowsP)); out('');
  out('Conclusão: o laboratório só detetaria vantagens **grandes** (acima do valor da coluna «mínima detetável»). Uma vantagem verdadeira de +0,15 R por trade precisaria de muitas mais trades por configuração do que as que existem. Por isso um resultado nulo aqui é **inconclusivo para vantagens pequenas**.'); out('');
  // ---------- A7 sem custos ----------
  out('## A7. Existe previsibilidade bruta (sem custos)?'); out('');
  const rowsF = [];
  for (const iv of IVS) {
    const fr = byId(R[iv].free), nf = R[iv].nullFree.filter(x => x.ok);
    const tOf = x => { const r = x.trades.filter(t => t.r != null).map(t => t.r); return r.length >= 40 ? ST.tstat(r).t : null; };
    const tr = R[iv].confs.map(c => fr.get(c.id)).filter(Boolean).map(tOf).filter(Number.isFinite), tn = nf.map(tOf).filter(Number.isFinite);
    const rcR = ST.realityCheck(R[iv].confs.map(c => fr.get(c.id)).filter(x => x && x.n >= 40).map(x => x.daily), { B: 500 }), rcN = ST.realityCheck(nf.filter(x => x.n >= 40).map(x => x.daily), { B: 500 });
    rowsF.push([iv, tr.length, `${f2(pctl(tr, .5))} · ${f2(pctl(tr, .9))} · ${f2(pctl(tr, .99))} · ${f2(Math.max(...tr))}`, tr.filter(t => t > 3.5).length, tn.length, `${f2(pctl(tn, .5))} · ${f2(pctl(tn, .9))} · ${f2(pctl(tn, .99))} · ${f2(Math.max(...tn))}`, tn.filter(t => t > 3.5).length, `${pv(rcR.pRC)} / ${pv(rcR.pSPA)}`, `${pv(rcN.pRC)} / ${pv(rcN.pSPA)}`]);
  }
  out(table(['velas', 'configs (reais, sem custos)', 't agrupado: mediana · p90 · p99 · máx', 'com t>3,5', 'configs (controlo)', 't controlo: mediana · p90 · p99 · máx', 'controlo com t>3,5', 'RC/SPA reais', 'RC/SPA controlo'], rowsF)); out('');
  const topFree = [];
  for (const iv of IVS) for (const x of R[iv].free) if (x.ok && x.n >= 40) { const r = x.trades.filter(t => t.r != null).map(t => t.r), s = ST.tstat(r); topFree.push([iv, x.id, r.length, sg(s.mean), f2(s.t)]); }
  topFree.sort((a, b) => b[4] - a[4]);
  out('As 10 configurações com maior t **sem custos** (previsibilidade bruta), em desenvolvimento+validação:'); out(''); out(table(['velas', 'configuração', 'trades', 'R médio bruto', 't'], topFree.slice(0, 10))); out('');
  C.A = R;
}
