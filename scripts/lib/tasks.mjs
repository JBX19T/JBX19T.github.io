// Tarefas executadas nos processos de trabalho: simular uma configuração do laboratório numa janela e devolver o que as análises precisam.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const BT = require('../../grokbot/backtest.js'), LAB = require('../../grokbot/lab.js');
const DAY = 864e5;
/* retornos diários da conta (marcados ao mercado), alinhados por dia de calendário na janela [w0,w1]; dias sem velas repetem a conta anterior (retorno 0) */
function dailyReturns(curve, start, w0, w1) {
  const nD = Math.max(1, Math.floor((w1 - w0) / DAY) + 1), eq = new Array(nD).fill(null);
  for (const [t, e] of curve) { const d = Math.floor((t - w0) / DAY); if (d >= 0 && d < nD) eq[d] = e; }
  const out = new Float64Array(nD); let prev = start;
  for (let d = 0; d < nD; d++) { const e = eq[d] == null ? prev : eq[d]; out[d] = e / prev - 1; prev = e; }
  return out;
}
export function makeTasks(D) {
  return {
    sim(job) {
      const DS = D[job.ds], conf = job.conf, barMs = DS.barMs;
      const cfg = LAB.cfgFor(conf, barMs, job.over || {});
      const opts = { signalAt: LAB.signalAtFor(conf, cfg), nMarkets: Object.keys(DS.bars).length, from: job.from, to: job.to };
      const res = BT.simulate(DS.bars, cfg, opts), sm = BT.summarize(res);
      const w0 = job.w0 ?? DS.t0, w1 = job.w1 ?? (job.to ?? DS.t1);
      const trades = job.slim ? res.trades.map(t => ({ k: t.k, side: t.side, o: t.o, c: t.c, r: t.risk > 0 ? t.pnl / t.risk : null })) : res.trades.map(t => ({ k: t.k, side: t.side, o: t.o, c: t.c, why: t.why, risk: t.risk, pnl: t.pnl, r: t.risk > 0 ? t.pnl / t.risk : null, g: t.risk > 0 ? (t.pnl + t.costUsd) / t.risk : null, fee: t.risk > 0 ? t.fees / t.risk : null, slip: t.risk > 0 ? t.slipUsd / t.risk : null, bars: t.bars, atrPct: t.atrPct }));
      return { id: conf.id, ds: job.ds, tag: job.tag, ok: true, n: trades.length, trades, daily: job.noDaily ? null : dailyReturns(res.curve, cfg.start, w0, w1), maxDD: res.maxDD, netPct: sm.netPct, pf: sm.pf, exposure: res.exposure, bh: res.bh, from: res.start, to: res.end };
    },
  };
}
