// Fase 2 do laboratório: auditoria das 1 655 experiências (A), diagnóstico do rompimento (B) e hipóteses de tendência em dados independentes (C).
// Uso: node scripts/lab2.mjs [--out pasta] [--parts A,B,C] [--workers N] [--synthetic] [--small]
// Só lê dados públicos de mercado; não envia ordens. Hipóteses e regras de decisão: docs/PREREGISTO-FASE2.md
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DSTRAT = require('../grokbot/strategy.js'), BT = require('../grokbot/backtest.js'), LAB = require('../grokbot/lab.js'), ST = require('../grokbot/labstats.js');
import { MS, fetchBinance, fetchYahooDaily, splitTimes, fingerprint } from './lib/data.mjs';
import { makePool } from './lib/pool.mjs';
import { partA } from './lab2-audit.mjs';
import { partB } from './lab2-breakout.mjs';
import { partC, partD, SERIES } from './lab2-swing.mjs';
import { iso, table } from './lib/util.mjs';

const A = process.argv.slice(2), arg = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? (A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true) : d; };
const OUT = arg('out', 'lab2-out'), PARTS = String(arg('parts', 'A,B,C')).split(','), SYN = !!arg('synthetic', false), SMALL = !!arg('small', false);
const NW = Math.max(1, Math.min(+arg('workers', os.cpus().length) || 2, 8));
fs.mkdirSync(OUT, { recursive: true });
let buf = []; const parts = {};
const out = (s = '') => { buf.push(s); console.log(s); };
function synthetic(n, step, seed, p0, weekdays = false) { const r = ST.rng(seed); let p = p0; const o = []; let t = Date.UTC(2005, 0, 3); for (let i = 0; i < n; i++) { const op = p; p *= 1 + Math.sin(i / 70) * .002 + (r() - .5) * .016; o.push({ t, o: op, h: Math.max(op, p) * (1 + .003 * r()), l: Math.min(op, p) * (1 - .003 * r()), c: p, v: 100 + r() * 50 }); t += step; if (weekdays && new Date(t).getUTCDay() === 6) t += 2 * step; } return o; }

(async () => {
  const t00 = Date.now(), IVS = ['1h', '4h', '1d'];
  out(`# Fase 2 — relatório de investigação — ${new Date().toISOString()}${SYN ? ' (DADOS SINTÉTICOS: só teste do código)' : ''}`); out('');
  const datasets = {}, DS = {};
  for (const iv of IVS) {
    const bars = SYN ? { GOLD: synthetic(SMALL ? 2600 : 6000, MS[iv], 1, 2000), EURUSD: synthetic(SMALL ? 2600 : 6000, MS[iv], 2, 1) } : { GOLD: await fetchBinance('PAXGUSDT', iv, Date.UTC(2020, 0, 1)), EURUSD: await fetchBinance('EURUSDT', iv, Date.UTC(2020, 0, 1)) };
    for (const k of Object.keys(bars)) if (!bars[k].length) delete bars[k];
    const sp = splitTimes(bars);
    datasets['real:' + iv] = { bars, ...sp, iv, barMs: MS[iv], fp: Object.fromEntries(Object.entries(bars).map(([k, b]) => [k, fingerprint(b)])) };
    datasets['null1:' + iv] = { bars: Object.fromEntries(Object.entries(bars).map(([k, b]) => [k, ST.shuffleBars(b, 11 + k.length, 1)])), ...sp, iv, barMs: MS[iv] };
  }
  if (PARTS.includes('C') || PARTS.includes('D')) for (const s of SERIES) {
    try {
      let bars = SYN ? synthetic(SMALL ? 3000 : 6000, MS['1d'], 10 + s.key.length, 100, true) : await fetchYahooDaily(s.sym); const meta = bars.meta;
      if (s.to) bars = bars.filter(b => b.t <= s.to);
      if (bars.length < 300) { out(`- ${s.key}: poucas barras (${bars.length}), ignorada`); continue; }
      const sp = splitTimes({ [s.key]: bars }); datasets['ind:' + s.key] = { bars: { [s.key]: bars }, ...sp, iv: '1d', barMs: MS['1d'], meta, fp: fingerprint(bars) };
    } catch (e) { out(`- ${s.key}: sem dados (${e.message})`); }
  }
  out('## Dados'); out('');
  out(table(['conjunto', 'barras por mercado', 'período', 'fim do desenvolvimento', 'fim da validação', 'impressão digital'], Object.entries(datasets).filter(([k]) => !k.startsWith('null')).map(([k, d]) => [k, Object.entries(d.bars).map(([m, b]) => `${m} ${b.length}`).join(', '), `${iso(d.t0)} → ${iso(d.t1)}`, k.startsWith('real') ? iso(d.devEnd) : '—', k.startsWith('real') ? iso(d.valEnd) : '—', Object.values(d.fp || {}).join(' · ') || d.fp || '']))); out('');
  parts.dados = buf.join('\n'); buf = [];
  const pool0 = makePool(datasets, NW); let sims = 0;
  const pool = { run: async (jobs, chunk) => { sims += jobs.length; return pool0.run(jobs, chunk); } };
  const C = { pool, DS: datasets, out, LAB, ST, BT, DSTRAT, IVS: SMALL ? ['4h'] : IVS };
  for (const P of PARTS) {
    const t0 = Date.now(); buf = [];
    try { if (P === 'A') await partA(C); else if (P === 'B') await partB(C); else if (P === 'C') await partC(C); else if (P === 'D') await partD(C); }
    catch (e) { out(`> ERRO na parte ${P}: ${e && e.stack || e}`); console.error('ERRO parte', P, e); }
    parts[P] = buf.join('\n'); console.error(`parte ${P} em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  buf = [];
  out('# Contagens efetivas'); out(''); out(`- Simulações executadas nesta corrida: ${sims}.`); out(`- Tempo: ${((Date.now() - t00) / 60000).toFixed(1)} min com ${NW} processos.`);
  parts.fim = buf.join('\n');
  pool0.close();
  const all = [parts.dados, ...PARTS.map(p => parts[p]), parts.fim].join('\n\n');
  fs.writeFileSync(path.join(OUT, 'relatorio-fase2.md'), all);
  for (const p of PARTS) fs.writeFileSync(path.join(OUT, `parte-${p}.md`), parts[p]);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
