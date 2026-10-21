// Parte C: hipóteses de tendência diária em séries independentes e longas (pré-registadas em docs/PREREGISTO-FASE2.md) e estudo do Swing diário.
import { f2, pc, sg, pv, mean, sd, pctl, month, iso, table } from './lib/util.mjs';
const DAY = 864e5;
export const SERIES = [
  { key: 'GSPC', sym: '^GSPC', label: 'S&P 500 (índice)' },
  { key: 'GLD', sym: 'GLD', to: Date.UTC(2020, 7, 27, 23, 59), label: 'ouro (GLD) até 2020-08-27' },
  { key: 'EURUSD', sym: 'EURUSD=X', to: Date.UTC(2019, 11, 31, 23, 59), label: 'EUR/USD até 2019-12-31' },
  { key: 'JPY', sym: 'JPY=X', label: 'USD/JPY' },
  { key: 'TLT', sym: 'TLT', label: 'obrigações longas (TLT)' },
  { key: 'BTC', sym: 'BTC-USD', label: 'Bitcoin' },
  { key: 'ETH', sym: 'ETH-USD', label: 'Ethereum' },
];
export async function partC(C) {
  const { pool, DS, out, LAB, ST, BT, DSTRAT } = C;
  const keys = SERIES.filter(s => DS['ind:' + s.key]).map(s => s.key);
  out('# Parte C — Swing diário e outras hipóteses de tendência em dados independentes'); out('');
  out('Hipóteses, dados e regras de decisão: `docs/PREREGISTO-FASE2.md` (enviado antes desta corrida). Cada série é simulada em separado (conta $10 000, risco 1 %, alavancagem máx. 5×).'); out('');
  out(table(['série', 'período usado', 'barras', 'nota'], keys.map(k => { const d = DS['ind:' + k], m = d.meta; return [SERIES.find(s => s.key === k).label, `${iso(d.t0)} → ${iso(d.t1)}`, d.bars[k].length, m ? `Yahoo: ${m.raw} linhas, ${m.dropped} removidas, ${m.fixed} com high/low corrigidos` : '']; }))); out('');
  const HYP = [
    { id: 'H1', name: 'Swing diário de produção (compra e venda)', conf: LAB.mkConf('brk_ema', { brk: 20 }, 'S', '1d') },
    { id: 'H2', name: 'Donchian 55 + EMA 20/50, stop móvel 3×ATR', conf: LAB.mkConf('don', { N: 55, tr: 1 }, 'C', '1d') },
    { id: 'H3', name: 'Momentum de série temporal (120 velas)', conf: LAB.mkConf('tsmom', { Ldays: 120 }, 'C', '1d') },
    { id: 'H4', name: 'Só comprado acima da EMA 200', conf: LAB.mkConf('long200', { N: 200 }, 'E', '1d') },
    { id: 'REF', name: 'Referência: rompimento atual do bot (não é hipótese)', conf: LAB.mkConf('brk_ema', { brk: 20 }, 'A', '1d') },
  ];
  const minATR = DSTRAT.minATRpct(LAB.BASE);
  const SC = { base: undefined, x2: { costBps: 18, slipBps: 6, slipStopBps: 10, minATRpct: minATR }, low: { costBps: 3, slipBps: 1, slipStopBps: 2, minATRpct: minATR } };
  const jobs = []; for (const h of HYP) for (const k of keys) for (const [sc, over] of Object.entries(SC)) jobs.push({ ds: 'ind:' + k, conf: h.conf, tag: `${h.id}|${k}|${sc}`, over });
  const res = await pool.run(jobs, 4), bad = res.filter(r => !r.ok); if (bad.length) out(`> erros: ${bad.slice(0, 3).map(b => b.tag + ': ' + b.err).join(' | ')}`);
  const get = (h, k, sc) => res.find(r => r.tag === `${h}|${k}|${sc}`);
  const rOf = r => r.trades.filter(t => t.r != null);
  // ---------- resultados por hipótese ----------
  const verdicts = {}, pOne = {};
  for (const h of HYP) {
    out(`## ${h.id} — ${h.name}`); out(''); out('Configuração: `' + h.conf.id + '`'); out('');
    const rows = [], pooled = [], pooledX2 = [], pooledLow = []; let okSeries = 0, posSeries = 0, halvesOk = 0, halvesN = 0, ddOk = true, nElig = 0;
    for (const k of keys) {
      const b = get(h.id, k, 'base'); if (!b || !b.ok) continue; const d = DS['ind:' + k], tr = rOf(b), mid = (d.t0 + d.t1) / 2;
      const rr = tr.map(t => t.r), h1 = tr.filter(t => t.o < mid).map(t => t.r), h2 = tr.filter(t => t.o >= mid).map(t => t.r);
      pooled.push(...tr.map(t => ({ ...t, k }))); pooledX2.push(...rOf(get(h.id, k, 'x2')).map(t => ({ ...t, k }))); pooledLow.push(...rOf(get(h.id, k, 'low')).map(t => ({ ...t, k })));
      if (tr.length >= 10) { nElig++; if (mean(rr) > 0) posSeries++; if (b.maxDD > .25) ddOk = false; }
      if (tr.length > 20) { halvesN++; if (mean(h1) > 0 && mean(h2) > 0) halvesOk++; }
      const bh = Object.values(b.bh)[0];
      rows.push([k, tr.length, sg(mean(rr)), pc(tr.filter(t => t.r > 0).length / (tr.length || 1), 0), pc(b.netPct), pc(b.maxDD), pc(bh), `${h1.length}: ${sg(mean(h1))} · ${h2.length}: ${sg(mean(h2))}`]);
    }
    out(table(['série', 'trades', 'R médio', 'acerto', 'resultado da conta', 'queda máx.', 'comprar e manter', '1.ª metade n: R · 2.ª metade n: R'], rows)); out('');
    const R = pooled.map(t => t.r), cb = ST.clusterBootstrap(R, pooled.map(t => month(t.c)), { B: 5000 });
    const sorted = R.slice().sort((a, b) => b - a), top3Out = mean(sorted.slice(3)), mx2 = mean(pooledX2.map(t => t.r)), mlow = mean(pooledLow.map(t => t.r));
    const longs = pooled.filter(t => t.side > 0).map(t => t.r), shorts = pooled.filter(t => t.side < 0).map(t => t.r);
    const totalPnl = pooled.reduce((s, t) => s + t.pnl, 0), pnlSorted = pooled.map(t => t.pnl).sort((a, b) => b - a), top10 = pnlSorted.slice(0, Math.ceil(pnlSorted.length * .1)).reduce((s, x) => s + x, 0);
    pOne[h.id] = cb.pOne; verdicts[h.id] = { cb, n: R.length, mean: mean(R), top3Out, mx2, mlow, posSeries, nElig, halvesOk, halvesN, ddOk, longs, shorts, totalPnl, top10 };
    out(`**Agrupado (${keys.length} séries):** ${R.length} trades, R médio **${sg(mean(R))}**, IC95 % por clusters de mês [${sg(cb.lo)}, ${sg(cb.hi)}], t = ${f2(cb.t)}, p unilateral = ${pv(cb.pOne)} (${cb.clusters} meses). Desvio do R: ${f2(sd(R))}; percentis 5/25/50/75/95: ${[.05, .25, .5, .75, .95].map(q => sg(pctl(R, q))).join(' · ')}.`); out('');
    out(`Compras: ${longs.length} trades, ${sg(mean(longs))} R · Vendas: ${shorts.length} trades, ${sg(mean(shorts))} R. Sem as 3 melhores trades: ${sg(top3Out)} R. Os 10 % melhores trades dão ${pc(top10 / (totalPnl || 1), 0)} do resultado total. Custos ×2 (18 bps): ${sg(mx2)} R · custos 3 bps: ${sg(mlow)} R.`); out('');
  }
  // ---------- decisão (pré-registada) ----------
  out('## Decisão (regras de `PREREGISTO-FASE2.md` §1)'); out('');
  const hs = HYP.filter(h => h.id !== 'REF'), adj = ST.holm(hs.map(h => pOne[h.id] ?? 1));
  const rowsD = hs.map((h, i) => { const v = verdicts[h.id], c1 = v.cb.t != null && v.cb.t >= 1.645 && adj[i] < .05, c2 = v.nElig > 0 && v.posSeries / v.nElig >= 2 / 3, c3 = v.mx2 > 0, c4 = v.top3Out > 0, c5 = v.ddOk, c6 = v.halvesN === 0 ? false : v.halvesOk / v.halvesN >= 2 / 3;
    const all = c1 && c2 && c3 && c4 && c5 && c6, cls = all ? '**aprovada para paper**' : (v.mean > 0 && v.cb.hi > 0 ? 'inconclusiva' : (v.mean <= 0 || v.cb.hi < .05 ? 'rejeitada' : 'inconclusiva'));
    return [h.id, h.name, v.n, sg(v.mean), `[${sg(v.cb.lo)}, ${sg(v.cb.hi)}]`, f2(v.cb.t), pv(v.cb.pOne), pv(adj[i]), c1 ? 'sim' : 'não', `${v.posSeries}/${v.nElig} ${c2 ? 'sim' : 'não'}`, c3 ? 'sim' : 'não', c4 ? 'sim' : 'não', c5 ? 'sim' : 'não', `${v.halvesOk}/${v.halvesN} ${c6 ? 'sim' : 'não'}`, cls]; });
  out(table(['id', 'hipótese', 'trades', 'R médio', 'IC95 %', 't', 'p', 'p Holm (4)', '1) t≥1,645 corrigido', '2) ≥2/3 séries >0', '3) custos ×2 >0', '4) sem top-3 >0', '5) queda ≤25 %', '6) duas metades >0', 'classificação'], rowsD)); out('');
  const need = Math.ceil((1.645 * 1.3 / .15) ** 2);
  out(`Poder: para detetar +0,15 R com desvio 1,3 R a t = 1,645 são precisos cerca de **${need} trades agrupados**; cada hipótese teve ${hs.map(h => `${h.id}: ${verdicts[h.id].n}`).join(', ')}.`); out('');
  // ---------- estabilidade temporal (H1) ----------
  const b1 = keys.map(k => get('H1', k, 'base')).filter(Boolean).flatMap(r => rOf(r).map(t => ({ ...t, y: new Date(t.c).getUTCFullYear() })));
  const byY = {}; for (const t of b1) (byY[t.y] ??= []).push(t.r);
  out('## H1: estabilidade por ano (séries independentes juntas)'); out('');
  out(table(['ano', 'trades', 'R médio'], Object.keys(byY).sort().map(y => [y, byY[y].length, sg(mean(byY[y]))]))); out('');
  out(`Anos com R médio > 0: ${Object.values(byY).filter(a => mean(a) > 0).length} de ${Object.keys(byY).length}.`); out('');
  // ---------- sensibilidade de parâmetros do Swing ----------
  out('## H1: sensibilidade aos parâmetros (séries independentes juntas; 27 combinações à volta da regra de produção)'); out('');
  const gridJobs = [], BR = [10, 20, 40], ST_ = [1.5, 2, 3], TR = [2, 3, 4];
  for (const br of BR) for (const sa of ST_) for (const tr of TR) for (const k of keys) gridJobs.push({ ds: 'ind:' + k, conf: LAB.mkConf('brk_ema', { brk: br }, 'S', '1d'), tag: `G|${br}|${sa}|${tr}|${k}`, over: { stopATR: sa, trailATR: tr }, noDaily: true });
  const gres = await pool.run(gridJobs, 6), gcells = [];
  for (const br of BR) for (const sa of ST_) for (const tr of TR) { const tt = gres.filter(r => r.ok && r.tag.startsWith(`G|${br}|${sa}|${tr}|`)).flatMap(r => rOf(r).map(t => ({ r: t.r, m: month(t.c) }))); const cb = ST.clusterBootstrap(tt.map(x => x.r), tt.map(x => x.m), { B: 1500 }); gcells.push([br, sa, tr, tt.length, sg(mean(tt.map(x => x.r))), f2(cb.t), sg(cb.lo), sg(cb.hi)]); }
  out(table(['rompimento', 'stop (ATR)', 'stop móvel (ATR)', 'trades', 'R médio', 't', 'IC95 % inf.', 'IC95 % sup.'], gcells)); out('');
  const pos = gcells.filter(c => parseFloat(c[4]) > 0).length;
  out(`${pos} de 27 combinações têm R médio > 0 nas séries independentes. (A regra de produção é 20 / 2 / 3.)`); out('');
  // ---------- Swing diário em dados já usados (Binance), só como referência ----------
  out('## Swing diário em ouro e EUR/USD da Binance (dados já usados no laboratório; **não é evidência independente**)'); out('');
  const d = DS['real:1d'], full = await pool.run([{ ds: 'real:1d', conf: HYP[0].conf, tag: 'S1d', w0: d.t0, w1: d.t1 }]), s1 = full[0];
  if (s1 && s1.ok) { const tr = rOf(s1), cb = ST.clusterBootstrap(tr.map(t => t.r), tr.map(t => month(t.c)), { B: 5000 }); out(`Período completo: ${tr.length} trades, R médio ${sg(mean(tr.map(t => t.r)))}, IC95 % por clusters [${sg(cb.lo)}, ${sg(cb.hi)}], t = ${f2(cb.t)}, queda máx. ${pc(s1.maxDD)}, resultado ${pc(s1.netPct)}.`); out('');
    const byM = {}; for (const t of tr) (byM[t.k] ??= []).push(t.r); out(table(['mercado', 'trades', 'R médio'], Object.entries(byM).map(([k, a]) => [k, a.length, sg(mean(a))]))); out(''); }
  C.C = { verdicts, res };
}
