// Auditoria quantitativa em dados reais (Hyperliquid + Binance), com o MESMO motor de teste da app (grokbot/backtest.js).
// Só lê dados públicos de mercado; não usa chaves nem envia ordens. Corre no GitHub Actions (.github/workflows/audit.yml)
// ou localmente: node scripts/audit-real.mjs [pasta-de-saída]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const BT = require('../grokbot/backtest.js'), DS = require('../grokbot/strategy.js');
const OUT = process.argv[2] || 'audit-out';
fs.mkdirSync(OUT, { recursive: true });
const MS = { '1m': 6e4, '5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5, '1d': 864e5 };
const HL = 'https://api.hyperliquid.xyz/info', BINANCE = ['https://data-api.binance.vision', 'https://api.binance.com'];
const COINS = { GOLD: 'xyz:GOLD', SPX: 'xyz:SP500', EURUSD: 'xyz:EUR' }, LONG = { GOLD: 'PAXGUSDT', EURUSD: 'EURUSDT' };
const BASE = { ...DS.DEFAULTS, start: 10000, ddStop: .20, dayLoss: .05 };   // = MACRO.BASE do Macro Desk
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lines = [];
const out = (s = '') => { lines.push(s); console.log(s); };
const f2 = (v, d = 2) => v == null || !Number.isFinite(v) ? '—' : v.toFixed(d);
const pc = (v, d = 1) => v == null || !Number.isFinite(v) ? '—' : (v * 100).toFixed(d) + '%';
const usd = v => v == null ? '—' : (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
const sg = v => v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2);
const iso = t => new Date(t).toISOString().slice(0, 10);

async function post(body) {
  for (let a = 0; a < 5; a++) {
    try { const r = await fetch(HL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (r.status === 429) { await sleep(1500 * (a + 1)); continue; } if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    catch (e) { if (a === 4) throw e; await sleep(800); }
  }
}
async function fetchHL(iv) {
  const end = Date.now(), start = Math.floor(end - 5000 * MS[iv] * .999), markets = {};
  for (const [k, coin] of Object.entries(COINS)) {
    const arr = await post({ type: 'candleSnapshot', req: { coin, interval: iv, startTime: start, endTime: end } });
    if (Array.isArray(arr) && arr.length) markets[k] = { coin, bars: arr.map(x => ({ t: x.t, o: +x.o, h: +x.h, l: +x.l, c: +x.c })) };
    await sleep(250);
  }
  return markets;
}
async function fetchFunding(markets, from, to) {
  const out = {}, cover = {};
  for (const [k, m] of Object.entries(markets)) {
    const pts = []; let t = Math.max(from, to - 4 * 500 * 36e5);
    for (let page = 0; page < 4 && t < to; page++) {
      const arr = await post({ type: 'fundingHistory', coin: m.coin, startTime: Math.floor(t), endTime: to }).catch(() => null);
      if (!Array.isArray(arr) || !arr.length) break;
      for (const x of arr) pts.push([x.time, +x.fundingRate]);
      t = arr[arr.length - 1].time + 1; await sleep(250); if (arr.length < 500) break;
    }
    if (pts.length) { out[k] = pts; cover[k] = Math.min(1, pts.length / ((to - from) / 36e5)); }
  }
  return { funding: out, cover };
}
async function fetchBinance(iv) {
  const markets = {}, end = Date.now(), LONG_FROM = Date.UTC(2020, 0, 1), LONG_MAX = 30000;
  for (const [k, sym] of Object.entries(LONG)) {
    const rows = []; let t = Math.max(LONG_FROM, end - LONG_MAX * MS[iv]), host = 0, fails = 0;
    while (t < end && rows.length < LONG_MAX) {
      let arr = null;
      try { const r = await fetch(`${BINANCE[host]}/api/v3/klines?symbol=${sym}&interval=${iv}&startTime=${t}&limit=1000`); if (r.status === 429 || r.status === 418) { await sleep(2000); continue; } if (!r.ok) throw new Error('HTTP ' + r.status); arr = await r.json(); }
      catch (e) { if (++fails > 4) throw new Error(sym + ': ' + e.message); host = (host + 1) % BINANCE.length; await sleep(700); continue; }
      if (!Array.isArray(arr) || !arr.length) break;
      for (const x of arr) if (x[0] + MS[iv] <= end) rows.push({ t: x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4] });
      t = arr[arr.length - 1][0] + MS[iv]; if (arr.length < 1000) break; await sleep(120);
    }
    if (rows.length) markets[k] = { coin: sym + ' (Binance)', bars: rows };
  }
  return markets;
}
// qualidade dos dados: ordem, duplicados, lacunas, velas impossíveis
function quality(markets, iv) {
  const rows = [];
  for (const [k, m] of Object.entries(markets)) {
    const b = m.bars; let unordered = 0, dup = 0, gaps = 0, gapMax = 0, bad = 0;
    for (let i = 0; i < b.length; i++) {
      const x = b[i]; if (!(x.h >= x.l && x.h >= Math.max(x.o, x.c) - 1e-9 && x.l <= Math.min(x.o, x.c) + 1e-9) || !(x.o > 0 && x.c > 0)) bad++;
      if (i) { const d = x.t - b[i - 1].t; if (d < 0) unordered++; else if (d === 0) dup++; else if (d > MS[iv] * 1.5) { gaps++; gapMax = Math.max(gapMax, d / MS[iv]); } }
    }
    rows.push({ k, coin: m.coin, n: b.length, from: b[0].t, to: b[b.length - 1].t, unordered, dup, gaps, gapMax, bad });
  }
  return rows;
}
const toBars = markets => { const o = {}; for (const [k, m] of Object.entries(markets)) o[k] = m.bars.slice().sort((a, b) => a.t - b.t); return o; };

// ---------- apresentação ----------
function statsBlock(name, res, A, sm, extra = {}) {
  out(`#### ${name}`);
  out(`Período ${iso(sm.from)} → ${iso(sm.to)} (${sm.days.toFixed(0)} dias) · mercados: ${Object.entries(sm.bars).map(([k, n]) => `${k} ${n} velas`).join(', ')} · funding ${extra.funding ? 'real (parcial)' : 'não incluído'}`);
  out('');
  out('| métrica | valor |'); out('|---|---|');
  out(`| trades (fechadas) | ${A.n} (${A.wins}G ${A.losses}P) · abertas no fim: ${A.openAtEnd} |`);
  out(`| taxa de acerto | ${pc(A.hit, 0)} |`);
  out(`| ganhos brutos / perdas brutas | ${usd(A.grossWin)} / ${usd(-A.grossLoss)} |`);
  out(`| resultado líquido | ${usd(A.net)} (${pc(A.netPct)}) |`);
  out(`| fator de lucro | ${f2(A.pf)} |`);
  out(`| ganho médio / perda média / relação | ${usd(A.avgWin)} / ${usd(A.avgLoss)} / ${f2(A.payoff)} |`);
  out(`| expectativa por trade | ${usd(A.expUsd)} · ${sg(A.expR)} R (R ponderado pelo risco ${sg(sm.avgRw)}) |`);
  out(`| incerteza da expectativa em R | desvio ${f2(A.sdR)} · IC95% por blocos [${sg(A.ci.lo)}, ${sg(A.ci.hi)}] · P(média>0) ${A.ci.pPos == null ? '—' : pc(A.ci.pPos, 0)} · t ${f2(A.tR)} (n=${A.n}) |`);
  out(`| antes de custos / custos | ${sg(sm.avgGrossR)} R / ${f2(sm.costR)} R por trade · taxas ${usd(A.costs.fees)} · slippage ${usd(A.costs.slip)} · funding (custo; negativo = recebido) ${usd(A.costs.funding)} |`);
  { const rk = res.trades.filter(t => t.risk > 0).map(t => t.risk).sort((x, y) => x - y); if (rk.length) { const rs = res.trades.filter(t => t.risk > 0).map(t => t.pnl / t.risk); out(`| risco por trade ($ = 1 R) | mín ${usd(rk[0])} · mediana ${usd(rk[rk.length >> 1])} · máx ${usd(rk[rk.length - 1])} (varia com a conta) · Σ R ${sg(rs.reduce((x, y) => x + y, 0))} · Σ $ ${usd(A.net)} · Σ $ ÷ risco médio ${sg(A.net / (rk.reduce((x, y) => x + y, 0) / rk.length))} R |`); } }
  out(`| queda máxima | ${usd(A.maxDDusd)} (${pc(A.maxDDpct)}) · maior sequência de perdas ${A.maxLossStreak} |`);
  const bh = Object.entries(sm.bh).map(([k, v]) => `${k} ${pc(v)}`).join(' · ');
  out(`| comprar e manter | ${bh} |`);
  out('');
  const tbl = (title, o) => { const r = Object.entries(o).sort((a, b) => a[0].localeCompare(b[0])); if (!r.length) return; out(`| ${title} | trades | acerto | P/L | R médio |`); out('|---|---|---|---|---|'); for (const [k, v] of r) out(`| ${k} | ${v.n} | ${pc(v.wins / v.n, 0)} | ${usd(v.pnl)} | ${sg(v.avgR)} |`); out(''); };
  tbl('mercado', A.byMarket); tbl('saída', A.byExit); tbl('sessão (abertura)', A.bySession); tbl('regime de volatilidade', A.byVol); tbl('mês', A.byMonth);
}
function diagBlock(sm) {
  const d = sm.diag; if (!d) return;
  const reasons = Object.entries(d.reasons).sort((a, b) => b[1] - a[1]), tot = reasons.reduce((s, [, v]) => s + v, 0) + d.accepted.long + d.accepted.short;
  out('Diagnóstico por vela (porque entrou ou não):'); out(''); out('| razão | velas | % |'); out('|---|---|---|');
  for (const [k, v] of reasons) out(`| ${k} | ${v} | ${pc(v / tot, 1)} |`);
  out(`| sinal aceite | ${d.accepted.long + d.accepted.short} | ${pc((d.accepted.long + d.accepted.short) / tot, 1)} |`); out('');
  out(`Sinais → ordens → execuções → trades: ${sm.orders.signals} → ${sm.orders.placed} → ${sm.orders.filled} → ${sm.n}. Sinais que o filtro de custo bloqueou: ${d.wouldBe.long + d.wouldBe.short} (${d.wouldBe.long} compra, ${d.wouldBe.short} venda).`);
  out(`ATR em % do preço — mínimo exigido pelo filtro: ${pc(d.minATRpct, 2)}. ` + Object.entries(d.atr).map(([k, a]) => `${k}: p10 ${pc(a.p10, 2)} · mediana ${pc(a.p50, 2)} · p90 ${pc(a.p90, 2)} · velas acima do mínimo ${pc(a.aboveMin, 0)}`).join(' | '));
  out('');
}
function variantsBlock(bars, cfg, funding) {
  const V = [['regras atuais', {}], ['custo 2 bps', { costBps: 2 }], ['custo 15 bps', { costBps: 15 }], ['slippage 3×', { slipBps: (cfg.slipBps || 0) * 3 || 9, slipStopBps: (cfg.slipStopBps ?? cfg.slipBps ?? 0) * 3 || 15 }], ['sem slippage', { slipBps: 0, slipStopBps: 0 }], ['sem filtro de custo', { minATRpct: 0 }], ['ordens limitadas', { exec: 'maker' }]];
  out('| variante | trades | resultado | fator lucro | R médio | queda |'); out('|---|---|---|---|---|---|');
  for (const [l, o] of V) { const r = BT.simulate(bars, cfg, { override: o, funding }), s = BT.summarize(r); out(`| ${l} | ${s.n} | ${pc(s.netPct)} | ${f2(s.pf)} | ${sg(s.avgR)} | ${pc(s.maxDD)} |`); }
  out('');
}
function protocolBlock(P) {
  if (!P) { out('Protocolo em 3 partes: dados insuficientes.'); out(''); return; }
  out(`Partições cronológicas: desenvolvimento até ${iso(P.split[0])} · validação até ${iso(P.split[1])} · teste final depois. Variantes testadas: ${P.variantsTested}; limiar |t| individual 1,96, corrigido (Bonferroni) ${f2(P.tCrit.adjusted)}.`); out('');
  out('| id | hipótese (1 parâmetro) | dev n / R | validação n / R [IC95%] | promissora | teste final n / R [IC95%] · t |'); out('|---|---|---|---|---|---|');
  for (const r of P.rows) {
    const T = r.test;
    out(`| ${r.id} | ${r.hypothesis} | ${r.dev.n} / ${sg(r.dev.avgR)} | ${r.val.n} / ${sg(r.val.avgR)} [${sg(r.val.ciLo)}, ${sg(r.val.ciHi)}] | ${r.id === 'base' ? 'ref.' : r.promising ? 'sim' : 'não'} | ${T ? `${T.n} / ${sg(T.avgR)} [${sg(T.ciLo)}, ${sg(T.ciHi)}] · t ${f2(T.tR)}` : 'não calculado'} |`);
  }
  out('');
}

const HYP = {
  swing: [
    { id: 'S1', hypothesis: 'stop móvel 4×ATR (em vez de 3): deixa a tendência respirar', override: { trailATR: 4 } },
    { id: 'S2', hypothesis: 'EMA lenta 100 (em vez de 50): filtro de tendência mais lento', override: { slow: 100 } },
    { id: 'S3', hypothesis: 'rompimento de 40 velas (em vez de 20): menos falsos rompimentos', override: { brk: 40 } },
    { id: 'S4', hypothesis: 'stop inicial 3×ATR (em vez de 2)', override: { stopATR: 3 } }],
  daytrade: [
    { id: 'D1', hypothesis: 'sem alvo (só stop ou fim do dia)', override: { tpATR: 0 } },
    { id: 'D2', hypothesis: 'alvo 2×ATR (em vez de 3)', override: { tpATR: 2 } },
    { id: 'D3', hypothesis: 'stop 3×ATR (em vez de 2)', override: { stopATR: 3 } },
    { id: 'D4', hypothesis: 'rompimento de 40 velas (em vez de 20)', override: { brk: 40 } }],
};

(async () => {
  out(`# Auditoria quantitativa em dados reais — ${new Date().toISOString()}`); out('');
  out('Motor: grokbot/backtest.js (o mesmo da app). Custos: taxa 9 bps (taker) / 3 bps (maker), slippage 3 bps (stop 5 bps), conta $10 000, risco 1% por trade, alavancagem máx. 5×, paragens −20% / −5% dia. Execução: sinal ao fecho da vela, ordem a mercado à abertura seguinte.'); out('');
  const D = {};
  for (const [id, src, iv] of [['HL-15m', 'hl', '15m'], ['HL-1h', 'hl', '1h'], ['HL-4h', 'hl', '4h'], ['BIN-1h', 'bin', '1h'], ['BIN-4h', 'bin', '4h'], ['BIN-1d', 'bin', '1d']]) {
    try {
      const mk = src === 'hl' ? await fetchHL(iv) : await fetchBinance(iv), end = Date.now();
      for (const m of Object.values(mk)) m.bars = m.bars.filter(b => b.t + MS[iv] <= end);   // só velas fechadas
      const bars = toBars(mk), ks = Object.keys(bars);
      if (!ks.length) { out(`- ${id}: sem velas`); continue; }
      const from = Math.min(...ks.map(k => bars[k][0].t)), to = Math.max(...ks.map(k => bars[k][bars[k].length - 1].t));
      const fund = src === 'hl' ? await fetchFunding(mk, from, to).catch(() => ({ funding: {}, cover: {} })) : { funding: {}, cover: {} };
      D[id] = { id, src, iv, mk, bars, fund, quality: quality(mk, iv) };
    } catch (e) { out(`- ${id}: falhou (${e.message})`); }
  }
  out('## 0. Qualidade dos dados'); out(''); out('| conjunto | mercado | velas | de | até | fora de ordem | duplicadas | lacunas (máx. velas) | velas inválidas |'); out('|---|---|---|---|---|---|---|---|---|');
  for (const d of Object.values(D)) for (const q of d.quality) out(`| ${d.id} | ${q.coin} | ${q.n} | ${iso(q.from)} | ${iso(q.to)} | ${q.unordered} | ${q.dup} | ${q.gaps} (${q.gapMax.toFixed(0)}) | ${q.bad} |`);
  out('');
  const studies = [
    ['Rompimento 15 min', 'breakout', 'HL-15m'],
    ['Day trade 4h', 'daytrade', 'HL-4h'], ['Swing 4h', 'swing', 'HL-4h'],
    ['Day trade 1h', 'daytrade', 'HL-1h'], ['Day trade 4h (histórico longo)', 'daytrade', 'BIN-4h'],
    ['Swing 4h (histórico longo)', 'swing', 'BIN-4h'], ['Swing 1d (histórico longo)', 'swing', 'BIN-1d'], ['Rompimento 4h (histórico longo)', 'breakout', 'BIN-4h']];
  const json = { generated: new Date().toISOString(), studies: [] };
  let n = 0;
  for (const [name, strat, did] of studies) {
    const d = D[did]; if (!d) { out(`## ${name}: sem dados (${did})`); continue; }
    out(`## ${++n}. ${name}  [${did}]`); out('');
    const cfg = DS.withStrategy(BASE, strat), fund = d.fund.funding;
    const res = BT.simulate(d.bars, cfg, { funding: fund, log: strat === 'breakout' && d.iv === '15m' }), sm = BT.summarize(res), A = BT.analyze(res), cc = BT.crossCheck(res, sm);
    statsBlock(name, res, A, sm, { funding: Object.keys(fund).length });
    out(`Recálculo cruzado a partir das trades: ${cc.length ? '**inconsistências**: ' + cc.join('; ') : 'coerente (conta final − inicial = Σ trades; PF, acerto, R e custos recalculados batem)'}.`); out('');
    diagBlock(sm);
    out('Sensibilidade a custos e execução:'); out(''); variantsBlock(d.bars, cfg, fund);
    let P = null;
    if (strat !== 'breakout' || d.iv !== '15m') { P = BT.protocol(d.bars, cfg, HYP[strat] || [], { funding: fund }); out('Protocolo em 3 partes (hipóteses fixadas antes de correr; teste final só para a referência e as promissoras):'); out(''); protocolBlock(P); }
    const wf = BT.research(d.bars, BASE, { only: [strat], funding: fund });
    out(`Teste em duas partes da app (60/40): ${wf.rows.map(r => `${r.exec}: A ${r.A.n} trades ${sg(r.A.avgR)} R · B ${r.B.n} trades ${sg(r.B.avgR)} R (t ${f2(r.B.tR)})`).join(' | ')} → ${wf.pass ? 'PASSA' : 'não passa'}`); out('');
    if (strat === 'breakout' && d.iv === '15m' && res.diag.log) fs.writeFileSync(path.join(OUT, 'diagnostico-15m.csv'), 't_utc,mercado,sinal,motivo,atr_pct,acao\n' + res.diag.log.map(x => [new Date(x.t).toISOString(), x.k, x.dir, '"' + String(x.why).replace(/"/g, '') + '"', x.atrPct == null ? '' : (x.atrPct * 100).toFixed(4), x.action || ''].join(',')).join('\n'));
    const csv = ['mercado,lado,aberta_utc,fechada_utc,entrada,saida,valor_usd,pnl_usd,taxas_usd,slip_usd,funding_usd,risco_usd,R,motivo', ...res.trades.map(t => [t.k, t.side > 0 ? 'long' : 'short', new Date(t.o).toISOString(), new Date(t.c).toISOString(), t.en.toFixed(5), t.ex.toFixed(5), t.nt.toFixed(2), t.pnl.toFixed(2), t.fees.toFixed(2), t.slipUsd.toFixed(2), t.fund.toFixed(2), t.risk.toFixed(2), t.risk > 0 ? (t.pnl / t.risk).toFixed(3) : '', t.why].join(','))].join('\n');
    fs.writeFileSync(path.join(OUT, `trades-${strat}-${did}.csv`), csv);
    json.studies.push({ name, strat, did, summary: { ...sm, _trades: undefined, sparkline: undefined, diag: undefined }, analysis: A, crossCheck: cc, protocol: P, walkForward: { pass: wf.pass, rows: wf.rows.map(r => ({ exec: r.exec, A: { n: r.A.n, avgR: r.A.avgR }, B: { n: r.B.n, avgR: r.B.avgR, tR: r.B.tR, pf: r.B.pf } })) } });
  }
  fs.writeFileSync(path.join(OUT, 'relatorio.md'), lines.join('\n'));
  fs.writeFileSync(path.join(OUT, 'dados.json'), JSON.stringify(json, null, 1));
})().catch(e => { console.error('ERRO', e); process.exit(1); });
