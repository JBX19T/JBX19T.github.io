// Laboratório de descoberta de estratégias (investigação; só lê dados públicos de mercado; não envia ordens).
// Uso: node scripts/lab-run.mjs [--out pasta] [--workers N] [--ivs 1h,4h,1d] [--small] [--synthetic]
//   --small: só as primeiras 40 configurações por tamanho de vela (teste de fumo)   --synthetic: dados inventados (só para testar o código, sem rede)
// Protocolo (fixado ANTES de ver resultados; ver docs/LABORATORIO.md):
//   1. dados de cada tamanho de vela divididos no tempo: desenvolvimento 50%, validação 25%, teste final 25%
//   2. fase A: todas as configurações são simuladas SÓ até ao fim da validação (o teste final não é tocado)
//   3. portões: G1 >=40 trades (dev+val); G2 R médio >0 no desenvolvimento E na validação; G3 t agrupado acima do limiar corrigido para testes múltiplos
//      (Bonferroni sobre o nº efetivo de hipóteses = grupos de configurações com resultados diários correlacionados >=0,9 → camada A; Benjamini-Hochberg q=10% → camada B);
//      G4 com custos ×1,5 o R médio agrupado continua >0; G5 >=2/3 das vizinhas (um parâmetro ao lado) com R médio >0; G6 queda máxima <20%
//   4. teste final (últimos 25%) calculado SÓ para as finalistas; confirmação: R médio >0 com >=20 trades
//   5. controlo negativo: as mesmas configurações e portões em dados baralhados (sem estrutura temporal): mostra quantas "descobertas" o puro acaso produz
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DSTRAT = require('../grokbot/strategy.js'), BT = require('../grokbot/backtest.js'), LAB = require('../grokbot/lab.js'), ST = require('../grokbot/labstats.js');
const MS = { '1m': 6e4, '5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5, '1d': 864e5 };
const DAY = 864e5;
const R_OF = t => t.risk > 0 ? t.pnl / t.risk : null;

// ================= trabalho de um worker =================
function runOne(DS, conf, opts) {
  const bars = DS.bars, barMs = MS[conf.iv];
  const cfg = LAB.cfgFor(conf, barMs, opts.over || {});
  const res = BT.simulate(bars, cfg, { signalAt: LAB.signalAtFor(conf, cfg), nMarkets: Object.keys(bars).length, from: opts.from, to: opts.to });
  return { res, cfg };
}
function compact(res, devEnd) {
  const tr = res.trades, rs = t => R_OF(t);
  const dev = tr.filter(t => t.o < devEnd).map(rs).filter(x => x != null), val = tr.filter(t => t.o >= devEnd).map(rs).filter(x => x != null);
  const sm = BT.summarize(res), pf = BT.perf(res);
  const t0 = res.start, days = Math.max(1, Math.ceil((res.end - t0) / DAY) + 1), daily = new Array(days).fill(0);
  for (const t of tr) daily[Math.min(days - 1, Math.max(0, Math.floor((t.c - t0) / DAY)))] += t.pnl;
  return { n: tr.length, dev, val, maxDD: res.maxDD, net: sm.net, netPct: sm.netPct, pf: sm.pf, avgR: sm.avgR, grossR: sm.avgGrossR, costR: sm.costR, exposure: res.exposure,
    sharpe: pf.sharpe, sortino: pf.sortino, calmar: pf.calmar, recovery: pf.recovery, uw: pf.underwaterDays, hit: sm.winRate, daily };
}
if (!isMainThread) {
  const D = workerData.datasets;
  parentPort.on('message', msg => {
    const out = [];
    for (const job of msg.jobs) {
      try {
        const DS = D[job.ds];
        const { res } = runOne(DS, job.conf, { to: job.to, from: job.from, over: job.over });
        out.push({ id: job.conf.id, ds: job.ds, kind: job.kind, ok: true, ...(job.kind === 'full' ? { trades: res.trades.map(t => ({ k: t.k, o: t.o, c: t.c, pnl: t.pnl, risk: t.risk, why: t.why })), maxDD: res.maxDD, perf: BT.perf(res), sum: (({ n, net, netPct, pf, avgR, avgGrossR, costR, winRate }) => ({ n, net, netPct, pf, avgR, avgGrossR, costR, winRate }))(BT.summarize(res)) } : compact(res, DS.devEnd)) });
      } catch (e) { out.push({ id: job.conf.id, ds: job.ds, kind: job.kind, ok: false, err: String(e && e.message || e) }); }
    }
    parentPort.postMessage(out);
  });
}

// ================= dados =================
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HL = 'https://api.hyperliquid.xyz/info', BINANCE = ['https://data-api.binance.vision', 'https://api.binance.com'];
async function hlPost(body) { for (let a = 0; a < 5; a++) { try { const r = await fetch(HL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); if (r.status === 429) { await sleep(1500 * (a + 1)); continue; } if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } catch (e) { if (a === 4) throw e; await sleep(800); } } }
async function fetchBinance(sym, iv, fromMs = Date.UTC(2020, 0, 1)) {
  const rows = [], end = Date.now(); let t = Math.max(fromMs, end - 30000 * MS[iv]), host = 0, fails = 0;
  while (t < end && rows.length < 30000) {
    let arr = null;
    try { const r = await fetch(`${BINANCE[host]}/api/v3/klines?symbol=${sym}&interval=${iv}&startTime=${t}&limit=1000`); if (r.status === 429 || r.status === 418) { await sleep(2000); continue; } if (!r.ok) throw new Error('HTTP ' + r.status); arr = await r.json(); }
    catch (e) { if (++fails > 4) throw new Error(sym + ': ' + e.message); host = (host + 1) % BINANCE.length; await sleep(700); continue; }
    if (!Array.isArray(arr) || !arr.length) break;
    for (const x of arr) if (x[0] + MS[iv] <= end) rows.push({ t: x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: +x[5] });
    t = arr[arr.length - 1][0] + MS[iv]; if (arr.length < 1000) break; await sleep(120);
  }
  return rows;
}
async function fetchHL(coin, iv) {
  const end = Date.now(), start = Math.floor(end - 5000 * MS[iv] * .999);
  const arr = await hlPost({ type: 'candleSnapshot', req: { coin, interval: iv, startTime: start, endTime: end } });
  return (arr || []).map(x => ({ t: x.t, o: +x.o, h: +x.h, l: +x.l, c: +x.c, v: +x.v })).filter(b => b.t + MS[iv] <= end).sort((a, b) => a.t - b.t);
}
function synthetic(n, step, seed, p0) { const r = ST.rng(seed); let p = p0; const out = []; for (let i = 0; i < n; i++) { const o = p; p *= 1 + Math.sin(i / 70) * .002 + (r() - .5) * .016; out.push({ t: Date.UTC(2021, 0, 1) + i * step, o, h: Math.max(o, p) * (1 + .003 * r()), l: Math.min(o, p) * (1 - .003 * r()), c: p, v: 100 + r() * 50 }); } return out; }
const fingerprint = bars => { let h = 2166136261; for (const b of bars) { h ^= Math.round(b.c * 1e6) % 4294967296; h = Math.imul(h, 16777619) >>> 0; } return `${bars.length}:${bars[0].t}:${bars[bars.length - 1].t}:${h.toString(16)}`; };
function split(bars) {
  const times = [...new Set(Object.values(bars).flatMap(b => b.map(x => x.t)))].sort((a, b) => a - b);
  return { devEnd: times[Math.floor(times.length * .5)], valEnd: times[Math.floor(times.length * .75)], t0: times[0], t1: times[times.length - 1] };
}

// ================= pool de workers =================
function makePool(datasets, size) {
  const workers = Array.from({ length: size }, () => { const w = new Worker(new URL(import.meta.url), { workerData: { datasets } }); w.busy = false; return w; });
  const queue = []; let pending = 0, onIdle = null;
  const pump = () => {
    for (const w of workers) {
      if (w.busy || !queue.length) continue;
      const task = queue.shift(); w.busy = true;
      const onMsg = out => { w.off('error', onErr); w.busy = false; pending--; task.resolve(out); pump(); if (!pending && onIdle) onIdle(); };
      const onErr = e => { w.off('message', onMsg); task.reject(e); };
      w.once('message', onMsg); w.once('error', onErr);
      w.postMessage({ jobs: task.jobs });
    }
  };
  return {
    run(jobs, chunk = 8) { return new Promise((resolve, reject) => { const parts = []; for (let i = 0; i < jobs.length; i += chunk) parts.push(jobs.slice(i, i + chunk)); if (!parts.length) return resolve([]); const all = []; let left = parts.length;
      for (const p of parts) { pending++; queue.push({ jobs: p, resolve: out => { all.push(...out); if (!--left) resolve(all); }, reject }); } pump(); }); },
    close() { workers.forEach(w => w.terminate()); },
  };
}

// ================= análise =================
const f2 = (v, d = 2) => v == null || !Number.isFinite(v) ? '—' : v.toFixed(d), pc = (v, d = 1) => v == null || !Number.isFinite(v) ? '—' : (v * 100).toFixed(d) + '%', sg = v => v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2);
const P_ONE = t => t == null ? 1 : 1 - ST.normCdf(t);   // p unilateral: só interessa expectativa positiva
const pctl = (a, q) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))] : null; };
function neighbors(conf, byId) {
  const S = LAB.byId[conf.sid], out = [];
  for (const k of Object.keys(S.grid)) {
    const vals = S.grid[k], idx = vals.findIndex(v => JSON.stringify(v) === JSON.stringify(conf.P[k]));
    for (const d of [-1, 1]) { const v = vals[idx + d]; if (v === undefined) continue; const id = `${conf.sid}[${LAB.pkey({ ...conf.P, [k]: v })}]/${conf.exit}`; if (byId.has(id)) out.push(id); }
  }
  return out;
}
function evaluate(rows, label) {
  // rows: resultados da fase A (um por configuração). Calcula t agrupado, grupos efetivos e limiares.
  const elig = rows.filter(r => r.ok && r.dev.length + r.val.length >= 40);
  elig.forEach(r => { const all = [...r.dev, ...r.val], s = ST.tstat(all); r.pooled = s; r.tDev = ST.tstat(r.dev), r.tVal = ST.tstat(r.val); r.p1 = P_ONE(s.t); r.posBoth = (r.tDev.mean > 0 && r.tVal.mean > 0); });
  const cl = ST.cluster(elig.map(r => r.daily), .9);
  const nEff = Math.max(1, cl.count), zB = ST.bonferroniZ(nEff, .10);   // unilateral: 2·alpha/… equivale a alpha=0,05 unilateral
  const bh = ST.benjaminiHochberg(elig.map(r => r.p1), .10);
  elig.forEach((r, i) => { r.cluster = cl.group[i]; r.bonf = r.pooled.t != null && r.pooled.t >= zB; r.bh = bh.has(i); r.dd6 = r.maxDD < .20; });
  return { elig, nEff, nTotal: elig.length, zB, nAll: rows.length, label };
}
const preTier = r => r.posBoth && r.dd6 && (r.bonf || r.bh);   // antes de G4/G5

async function main() {
  const A = process.argv.slice(2), arg = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? (A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true) : d; };
  const OUT = arg('out', 'lab-out'), SMALL = !!arg('small', false), SYN = !!arg('synthetic', false), IVS = String(arg('ivs', '1h,4h,1d')).split(',');
  const NW = Math.max(1, Math.min(+arg('workers', os.cpus().length) || 2, 8));
  fs.mkdirSync(OUT, { recursive: true });
  const L = []; const out = (s = '') => { L.push(s); console.log(s); };
  const jsonl = fs.createWriteStream(path.join(OUT, 'experimentos.jsonl'));
  const log = o => jsonl.write(JSON.stringify(o) + '\n');
  const t00 = Date.now();
  out(`# Laboratório de estratégias — ${new Date().toISOString()}${SYN ? ' (DADOS SINTÉTICOS: só teste do código)' : ''}`); out('');
  // ---- dados ----
  const datasets = {}, meta = {};
  for (const iv of IVS) {
    let bars;
    if (SYN) bars = { GOLD: synthetic(SMALL ? 2500 : 6000, MS[iv], 1, 2000), EURUSD: synthetic(SMALL ? 2500 : 6000, MS[iv], 2, 1) };
    else { bars = { GOLD: await fetchBinance('PAXGUSDT', iv), EURUSD: await fetchBinance('EURUSDT', iv) }; }
    for (const k of Object.keys(bars)) if (!bars[k].length) delete bars[k];
    const sp = split(bars);
    datasets['real:' + iv] = { bars, ...sp, iv, kind: 'real' };
    meta[iv] = { fp: Object.fromEntries(Object.entries(bars).map(([k, b]) => [k, fingerprint(b)])), ...sp };
    for (const [name, block, seed] of [['null1', 1, 11], ...(iv === '4h' ? [['null20', 20, 12]] : [])]) {
      const nb = Object.fromEntries(Object.entries(bars).map(([k, b]) => [k, ST.shuffleBars(b, seed + k.length, block)]));
      datasets[name + ':' + iv] = { bars: nb, ...sp, iv, kind: name };
    }
  }
  const iso = t => new Date(t).toISOString().slice(0, 10);
  out('## 1. Dados e partições (cronológicas)'); out(''); out('| velas | mercados | de | fim do desenvolvimento | fim da validação | até | impressão digital dos dados |'); out('|---|---|---|---|---|---|---|');
  for (const iv of IVS) { const m = meta[iv]; out(`| ${iv} | ${Object.entries(datasets['real:' + iv].bars).map(([k, b]) => `${k} ${b.length}`).join(', ')} | ${iso(m.t0)} | ${iso(m.devEnd)} | ${iso(m.valEnd)} | ${iso(m.t1)} | ${Object.values(m.fp).join(' · ')} |`); }
  out(''); out('Mercados: ouro = PAXGUSDT e EUR/USD = EURUSDT (Binance spot, proxies). Custos como no bot: taxa taker 9 bps, maker 3 bps, slippage 3 bps (stop 5 bps), risco 1% por trade, alavancagem máx. 5×, filtro de custo por risco ≤15%.'); out('');
  const pool = makePool(datasets, NW);
  let sims = 0;
  // ---- fase A ----
  const confsBy = {}; for (const iv of IVS) { let c = LAB.configs(iv); if (SMALL) c = c.filter((_, i) => i % Math.ceil(c.length / 40) === 0); confsBy[iv] = c; }
  const nConfs = Object.values(confsBy).reduce((s, c) => s + c.length, 0);
  out(`Configurações na biblioteca (${LAB.LIB.length} famílias): ${IVS.map(iv => `${iv}: ${confsBy[iv].length}`).join(' · ')} → ${nConfs}.`); out('');
  const real = {}, nulls = {};
  for (const iv of IVS) {
    const t0 = Date.now();
    const key = 'real:' + iv, DS = datasets[key];
    const jobs = confsBy[iv].map(conf => ({ ds: key, conf, to: DS.valEnd, kind: 'A' }));
    const res = await pool.run(jobs); sims += jobs.length;
    real[iv] = res.filter(r => r.ok).map(r => ({ ...r, conf: confsBy[iv].find(c => c.id === r.id) })); const bad = res.filter(r => !r.ok);
    if (bad.length) out(`> ${bad.length} configurações com erro em ${iv}: ${bad.slice(0, 3).map(b => b.id + ' ' + b.err).join(' | ')}`);
    for (const r of real[iv]) log({ fase: 'A', dados: 'real', iv, id: r.id, n: r.n, nDev: r.dev.length, nVal: r.val.length, rDev: ST.mean(r.dev), rVal: ST.mean(r.val), pf: r.pf, maxDD: r.maxDD, sharpe: r.sharpe, grossR: r.grossR, costR: r.costR });
    console.error(`fase A real ${iv}: ${jobs.length} em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    for (const nk of Object.keys(datasets).filter(k => k.endsWith(':' + iv) && !k.startsWith('real'))) {
      const t1 = Date.now(), j2 = confsBy[iv].map(conf => ({ ds: nk, conf, to: datasets[nk].valEnd, kind: 'A' }));
      const rr = await pool.run(j2); sims += j2.length; (nulls[nk] = rr.filter(r => r.ok)).forEach(r => log({ fase: 'A', dados: nk.split(':')[0], iv, id: r.id, n: r.n, nDev: r.dev.length, nVal: r.val.length, rDev: ST.mean(r.dev), rVal: ST.mean(r.val), pf: r.pf, maxDD: r.maxDD }));
      console.error(`fase A ${nk}: ${j2.length} em ${((Date.now() - t1) / 1000).toFixed(0)} s`);
    }
  }
  // ---- avaliação (portões G1-G3, G6) ----
  out('## 2. Testes múltiplos e distribuição dos resultados (desenvolvimento + validação)'); out('');
  out('| dados | velas | configs simuladas | elegíveis (≥40 trades) | grupos efetivos (corr. ≥0,9) | limiar t de Bonferroni | positivas em dev **e** val | t agrupado: mediana · p90 · p99 · máx | passam G1-G3+G6 (camada A / B) |'); out('|---|---|---|---|---|---|---|---|---|');
  const EV = {};
  const fmtEv = (e, tag, iv) => { const ts = e.elig.map(r => r.pooled.t), both = e.elig.filter(r => r.posBoth).length; const A_ = e.elig.filter(r => r.posBoth && r.dd6 && r.bonf).length, B_ = e.elig.filter(r => preTier(r)).length;
    out(`| ${tag} | ${iv} | ${e.nAll} | ${e.nTotal} | ${e.nEff} | ${f2(e.zB)} | ${both} (${pc(e.nTotal ? both / e.nTotal : 0, 0)}) | ${f2(pctl(ts, .5))} · ${f2(pctl(ts, .9))} · ${f2(pctl(ts, .99))} · ${f2(Math.max(...ts.filter(Number.isFinite), -Infinity))} | ${A_} / ${B_} |`); };
  for (const iv of IVS) {
    EV['real:' + iv] = evaluate(real[iv], 'real'); fmtEv(EV['real:' + iv], 'real', iv);
    for (const nk of Object.keys(nulls).filter(k => k.endsWith(':' + iv))) { EV[nk] = evaluate(nulls[nk], nk); fmtEv(EV[nk], nk.split(':')[0] === 'null1' ? 'controlo (baralhado)' : 'controlo (blocos de 20: mantém dependência curta)', iv); }
  }
  out(''); out('Leitura: as linhas «controlo» usam as mesmas configurações e os mesmos portões em dados sem estrutura temporal. Se os dados reais não se distinguirem do controlo, não há vantagem detetável.'); out('');
  // ---- candidatas: G4 (custos ×1,5) e G5 (vizinhas) ----
  const finalists = [], candidates = [];
  for (const iv of IVS) {
    const E = EV['real:' + iv], byId = new Map(E.elig.map(r => [r.id, r]));
    for (const r of E.elig) if (preTier(r)) candidates.push({ iv, r, byId });
  }
  out(`## 3. Candidatas e robustez`); out(''); out(`Candidatas que passam G1-G3 e G6 em dados reais: ${candidates.length}.`); out('');
  if (candidates.length) {
    const jobs = candidates.map(({ iv, r }) => ({ ds: 'real:' + iv, conf: r.conf, to: datasets['real:' + iv].valEnd, kind: 'A', over: { costBps: 13.5, slipBps: 4.5, slipStopBps: 7.5, minATRpct: DSTRAT.minATRpct(LAB.BASE) } }));   // mesmos sinais (filtro de custo do cenário base), execução 50% mais cara
    const rr = await pool.run(jobs); sims += jobs.length;
    candidates.forEach(c => { const same = rr.find(q => q.id === c.r.id && q.ds === 'real:' + c.iv); c.cost15 = same && same.ok ? ST.tstat([...same.dev, ...same.val]).mean : null; });
    out('| velas | configuração | dev n / R | val n / R | t agrupado | camada | custos ×1,5 (R) | vizinhas >0 | queda | G4 | G5 | finalista |'); out('|---|---|---|---|---|---|---|---|---|---|---|---|');
    let shown = 0;
    for (const c of candidates) {
      const nb = neighbors(c.r.conf, c.byId), pos = nb.filter(id => { const q = c.byId.get(id); return q && q.pooled.mean > 0; }).length, g5 = nb.length >= 1 && pos / nb.length >= 2 / 3, g4 = c.cost15 != null && c.cost15 > 0;
      c.g4 = g4; c.g5 = g5; c.tier = c.r.bonf ? 'A' : 'B'; c.fin = g4 && g5;
      if (shown++ < 60) out(`| ${c.iv} | ${c.r.id} | ${c.r.dev.length} / ${sg(ST.mean(c.r.dev))} | ${c.r.val.length} / ${sg(ST.mean(c.r.val))} | ${f2(c.r.pooled.t)} | ${c.tier} | ${sg(c.cost15)} | ${pos}/${nb.length} | ${pc(c.r.maxDD)} | ${g4 ? 'sim' : 'não'} | ${g5 ? 'sim' : 'não'} | ${c.fin ? '**sim**' : 'não'} |`);
      if (c.fin) finalists.push(c);
    }
    if (candidates.length > 60) out(`… (${candidates.length - 60} candidatas não mostradas; estão em experimentos.jsonl)`);
    out('');
  }
  // ---- os 20 melhores por t agrupado (mesmo sem passarem): negativos também são resultados ----
  out('## 4. As 20 configurações com maior t agrupado (dev+val), passem ou não os portões'); out(''); out('| velas | configuração | dev n / R | val n / R | t agrupado | positiva dev e val | queda | R bruto / custos |'); out('|---|---|---|---|---|---|---|---|');
  const all = IVS.flatMap(iv => EV['real:' + iv].elig.map(r => ({ iv, r }))).sort((a, b) => (b.r.pooled.t ?? -9) - (a.r.pooled.t ?? -9)).slice(0, 20);
  for (const { iv, r } of all) out(`| ${iv} | ${r.id} | ${r.dev.length} / ${sg(ST.mean(r.dev))} | ${r.val.length} / ${sg(ST.mean(r.val))} | ${f2(r.pooled.t)} | ${r.posBoth ? 'sim' : 'não'} | ${pc(r.maxDD)} | ${sg(r.grossR)} / ${f2(r.costR)} |`);
  out('');
  // ---- por família ----
  out('## 5. Resultado por família (todas as configurações elegíveis em dados reais)'); out(''); out('| família | elegíveis | com R>0 em dev e val | melhor t agrupado | R médio agrupado (mediana das configs) |'); out('|---|---|---|---|---|');
  const fam = {};
  for (const iv of IVS) for (const r of EV['real:' + iv].elig) { (fam[r.conf.sid] ??= []).push(r); }
  for (const [sid, rs] of Object.entries(fam).sort((a, b) => Math.max(...b[1].map(r => r.pooled.t ?? -9)) - Math.max(...a[1].map(r => r.pooled.t ?? -9)))) out(`| ${sid} — ${LAB.byId[sid].name} | ${rs.length} | ${rs.filter(r => r.posBoth).length} | ${f2(Math.max(...rs.map(r => r.pooled.t ?? -9)))} | ${sg(pctl(rs.map(r => r.pooled.mean), .5))} |`);
  out('');
  // ---- fase final: SÓ finalistas ----
  out('## 6. Teste final (últimos 25%, tocado só para as finalistas)'); out('');
  if (!finalists.length) out('**Nenhuma configuração passou todos os portões: nenhuma estratégia é aprovada e o teste final não foi usado.**');
  else {
    const jobs = finalists.flatMap(c => [{ ds: 'real:' + c.iv, conf: c.r.conf, kind: 'full' }]);
    const rr = await pool.run(jobs, 2); sims += jobs.length;
    out('| velas | configuração | camada | teste final n / R | t | IC95% (blocos) | confirmada (R>0, n≥20) | Sharpe / Sortino (período todo) | queda | exposição |'); out('|---|---|---|---|---|---|---|---|---|---|');
    for (const c of finalists) {
      const x = rr.find(q => q.id === c.r.id && q.ds === 'real:' + c.iv); if (!x || !x.ok) continue;
      const DSx = datasets['real:' + c.iv], test = x.trades.filter(t => t.o >= DSx.valEnd && t.risk > 0).map(t => t.pnl / t.risk), s = ST.tstat(test), ci = BT.blockBootstrap(test);
      c.test = { n: test.length, mean: s.mean, t: s.t, ci }; c.confirmed = test.length >= 20 && s.mean > 0;
      out(`| ${c.iv} | ${c.r.id} | ${c.tier} | ${test.length} / ${sg(s.mean)} | ${f2(s.t)} | [${sg(ci.lo)}, ${sg(ci.hi)}] | ${c.confirmed ? 'sim' : 'não'} | ${f2(x.perf.sharpe)} / ${f2(x.perf.sortino)} | ${pc(x.maxDD)} | ${pc(x.perf.exposure, 0)} |`);
      log({ fase: 'final', iv: c.iv, id: c.r.id, tier: c.tier, test: c.test, confirmed: c.confirmed });
    }
  }
  out('');
  // ---- generalização das finalistas: cripto (BTC, ETH) e dados recentes da Hyperliquid ----
  if (finalists.length) {
    out('## 6b. Generalização das finalistas (período todo; não serve para escolher)'); out('');
    const xd = {};
    for (const iv of [...new Set(finalists.map(c => c.iv))]) {
      try {
        const bars = SYN ? { BTC: synthetic(4000, MS[iv], 5, 30000), ETH: synthetic(4000, MS[iv], 6, 2000) } : { BTC: await fetchBinance('BTCUSDT', iv), ETH: await fetchBinance('ETHUSDT', iv) };
        xd['x:' + iv] = { bars, ...split(bars), iv };
      } catch (e) { out(`- cripto ${iv}: sem dados (${e.message})`); }
      if (!SYN && (iv === '1h' || iv === '4h' || iv === '1d')) { try { const hb = { GOLD: await fetchHL('xyz:GOLD', iv), SPX: await fetchHL('xyz:SP500', iv), EURUSD: await fetchHL('xyz:EUR', iv) }; for (const k of Object.keys(hb)) if (!hb[k].length) delete hb[k]; if (Object.keys(hb).length) xd['hl:' + iv] = { bars: hb, ...split(hb), iv }; } catch (e) { out(`- Hyperliquid ${iv}: sem dados (${e.message})`); } }
    }
    const xpool = makePool(xd, Math.min(NW, 4));
    const xjobs = finalists.flatMap(c => ['x:' + c.iv, 'hl:' + c.iv].filter(k => xd[k]).map(k => ({ ds: k, conf: c.r.conf, kind: 'full' })));
    const xr = await xpool.run(xjobs, 2); sims += xjobs.length; xpool.close();
    out('| velas | configuração | BTC+ETH (Binance) n / R / t | Hyperliquid xyz (ouro, S&P, EUR/USD; recente) n / R / t |'); out('|---|---|---|---|');
    const fmt = x => { if (!x || !x.ok) return '—'; const rs = x.trades.filter(t => t.risk > 0).map(t => t.pnl / t.risk), s = ST.tstat(rs); return `${rs.length} / ${sg(s.mean)} / ${f2(s.t)}`; };
    for (const c of finalists) out(`| ${c.iv} | ${c.r.id} | ${fmt(xr.find(q => q.id === c.r.id && q.ds === 'x:' + c.iv))} | ${fmt(xr.find(q => q.id === c.r.id && q.ds === 'hl:' + c.iv))} |`);
    out('');
  }
  // ---- demonstração isolada de métodos perigosos (martingale) ----
  out('## 7. Métodos perigosos, só em ambiente isolado: martingale'); out('');
  const baseConf = LAB.configs('4h', { only: ['brk_ema'] }).find(c => c.P.brk === 20 && c.exit === 'A'), bk = IVS.includes('4h') ? real['4h'].find(r => r.id === baseConf.id) : null;
  if (bk) { const Rs = [...bk.dev, ...bk.val], r = ST.rng(77), N = 150, paths = 3000, sim = mult => { let ruined = 0, fin = [], dd = []; for (let p = 0; p < paths; p++) { let eq = 1, peak = 1, mdd = 0, size = .01, dead = false; for (let i = 0; i < N; i++) { const R = Rs[Math.floor(r() * Rs.length)]; eq += eq * size * R; peak = Math.max(peak, eq); mdd = Math.max(mdd, 1 - eq / peak); if (eq <= .5) { dead = true; break; } size = R < 0 ? Math.min(.01 * mult * (size / .01), .32) : .01; } if (dead) ruined++; fin.push(eq); dd.push(mdd); } fin.sort((a, b) => a - b); return { ruined: ruined / paths, med: fin[fin.length >> 1], p5: fin[Math.floor(paths * .05)], dd: ST.mean(dd) }; };
    const flat = sim(1), mart = sim(2);
    out(`Série: ${Rs.length} trades reais (R) da regra atual do bot (brk_ema, brk 20, saída A), reamostrada (3 000 caminhos de 150 trades, risco inicial 1%). Martingale: dobra o risco após cada perda (teto 32%), volta a 1% após um ganho.`); out('');
    out('| dimensionamento | capital final (mediana) | pior 5% | queda máxima média | probabilidade de perder ≥50% |'); out('|---|---|---|---|---|');
    out(`| fixo 1% | ${f2(flat.med)}× | ${f2(flat.p5)}× | ${pc(flat.dd)} | ${pc(flat.ruined)} |`); out(`| martingale ×2 | ${f2(mart.med)}× | ${f2(mart.p5)}× | ${pc(mart.dd)} | ${pc(mart.ruined)} |`); out('');
    const mR = ST.mean(Rs); out(`R médio da série: ${sg(mR)} por trade. ` + (mart.ruined > flat.ruined || mart.dd > flat.dd ? 'O martingale não altera a expectativa por trade; só concentra o risco (queda máxima média e/ou probabilidade de ruína mais altas). Não é usado.' : 'Nesta amostra o martingale não piorou os números, mas não altera a expectativa por trade e o risco de cauda não fica bem medido com 150 trades por caminho; a decisão de não o usar mantém-se.')); out('');
  }
  // ---- contagens finais ----
  out('## 8. Contagens efetivas'); out('');
  out(`- Famílias na biblioteca: ${LAB.LIB.length}; configurações distintas (família × parâmetros × saída × velas): ${nConfs}.`);
  out(`- Simulações executadas: ${sims} (reais ${nConfs}, controlo ${Object.values(nulls).reduce((s, a) => s + a.length, 0)}, robustez ${candidates.length}, teste final ${finalists.length}).`);
  out(`- Candidatas após G1-G3+G6: ${candidates.length}; finalistas após G4-G5: ${finalists.length}; confirmadas no teste final: ${finalists.filter(c => c.confirmed).length}.`);
  out(`- Tempo: ${((Date.now() - t00) / 60000).toFixed(1)} min com ${NW} processos.`);
  pool.close(); jsonl.end();
  fs.writeFileSync(path.join(OUT, 'relatorio.md'), L.join('\n'));
  fs.writeFileSync(path.join(OUT, 'finalistas.json'), JSON.stringify(finalists.map(c => ({ iv: c.iv, id: c.r.id, tier: c.tier, dev: ST.mean(c.r.dev), val: ST.mean(c.r.val), t: c.r.pooled.t, test: c.test || null, confirmed: !!c.confirmed })), null, 1));
}
if (isMainThread) main().catch(e => { console.error('ERRO', e); process.exit(1); });
