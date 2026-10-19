// Registo das execuções REAIS (o que se pretendia vs o que a corretora executou). Faltava: sem isto o slippage e o custo real
// ficavam por medir e o backtest usava valores supostos. Guarda só números (sem chaves nem endereços), no máximo 300 registos.
export const EXEC_KEY = 'execLog';

// transforma os resultados de uma sincronização/fecho em registos simples
export function toEntries(desk, res, now = Date.now()) {
  if (!res || res.mode !== 'real') return [];
  const out = [];
  for (const x of res.results || []) {
    if (['cancel', 'trail', 'stop'].includes(x.op) && x.ok) continue;   // só ordens que mexem em dinheiro, ou falhas
    const e = { t: now, desk, op: x.op, ok: !!x.ok };
    if (x.market) e.market = x.market;
    if (x.mint) e.mint = x.mint;
    if (x.mid != null) e.mid = x.mid;
    if (x.avgPx != null) e.avgPx = x.avgPx;
    if (x.slipBps != null) e.slipBps = x.slipBps;
    if (x.usd != null) e.usd = x.usd;
    if (x.motivo) e.motivo = x.motivo;
    if (x.quote) {   // Jupiter: valores brutos da cotação (USDC tem 6 casas)
      e.inAmount = x.quote.inAmount; e.outAmount = x.quote.outAmount; e.impactPct = x.quote.priceImpactPct;
      if (x.op === 'buy') e.usdIn = +(parseInt(x.quote.inAmount, 10) / 1e6).toFixed(4);
      if (x.op === 'sell') e.usdOut = +(parseInt(x.quote.outAmount, 10) / 1e6).toFixed(4);
    }
    if (x.pnlUsd != null) e.pnlUsd = x.pnlUsd;
    if (!x.ok) e.error = String(x.error || (x.detail && (x.detail.error || x.detail.motivo || JSON.stringify(x.detail))) || '').slice(0, 160);
    out.push(e);
  }
  return out;
}
export async function recordExec(store, desk, res, now = Date.now()) {
  if (!store) return 0;
  const es = toEntries(desk, res, now);
  for (const e of es) await store.push(EXEC_KEY, e, 300);
  return es.length;
}
// resumo para mostrar na app e para calibrar o backtest
export function summarizeExec(log = []) {
  const hl = log.filter(e => e.desk === 'hl' && e.ok && e.slipBps != null), sol = log.filter(e => e.desk === 'sol');
  const mean = a => (a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : null);
  const buys = sol.filter(e => e.op === 'buy' && e.ok), sells = sol.filter(e => e.op === 'sell' && e.ok);
  return {
    total: log.length, failed: log.filter(e => !e.ok).length,
    hl: { fills: hl.length, slipBpsMean: mean(hl.map(e => e.slipBps)), slipBpsWorst: hl.length ? Math.max(...hl.map(e => e.slipBps)) : null },
    sol: { buys: buys.length, sells: sells.length, pnlUsd: +sells.reduce((s, e) => s + (e.pnlUsd || 0), 0).toFixed(4), failed: sol.filter(e => !e.ok).length },
  };
}
