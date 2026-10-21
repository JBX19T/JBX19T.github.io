// Fontes de dados públicas (só leitura): Binance (spot), Hyperliquid, Yahoo Finance (diário). Sem chaves.
export const MS = { '1m': 6e4, '5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5, '1d': 864e5 };
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; dollos-research/1.0)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BINANCE = ['https://data-api.binance.vision', 'https://api.binance.com'];
export async function fetchBinance(sym, iv, fromMs = Date.UTC(2017, 0, 1), max = 30000) {
  const rows = [], end = Date.now(); let t = Math.max(fromMs, end - max * MS[iv]), host = 0, fails = 0;
  while (t < end && rows.length < max) {
    let arr = null;
    try { const r = await fetch(`${BINANCE[host]}/api/v3/klines?symbol=${sym}&interval=${iv}&startTime=${t}&limit=1000`); if (r.status === 429 || r.status === 418) { await sleep(2000); continue; } if (!r.ok) throw new Error('HTTP ' + r.status); arr = await r.json(); }
    catch (e) { if (++fails > 4) throw new Error(sym + ': ' + e.message); host = (host + 1) % BINANCE.length; await sleep(700); continue; }
    if (!Array.isArray(arr) || !arr.length) break;
    for (const x of arr) if (x[0] + MS[iv] <= end) rows.push({ t: x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: +x[5] });
    t = arr[arr.length - 1][0] + MS[iv]; if (arr.length < 1000) break; await sleep(120);
  }
  return rows;
}
/* Yahoo Finance, barras diárias com datas explícitas (range=max devolve barras mensais). Limpeza fixada no pré-registo:
   linhas com algum OHLC nulo são removidas; high/low são corrigidos para o extremo quando contradizem open/close; preços brutos (sem ajustes de dividendos). */
export async function fetchYahooDaily(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=0&period2=${Math.floor(Date.now() / 1000)}&interval=1d`;
  let j = null;
  for (let a = 0; a < 4 && !j; a++) { try { const r = await fetch(url, { headers: UA }); if (r.status === 429) { await sleep(2000 * (a + 1)); continue; } if (!r.ok) throw new Error('HTTP ' + r.status); j = await r.json(); } catch (e) { if (a === 3) throw new Error(sym + ': ' + e.message); await sleep(800); } }
  const res = j.chart.result[0], t = res.timestamp, q = res.indicators.quote[0], bars = []; let dropped = 0, fixed = 0;
  for (let i = 0; i < t.length; i++) {
    let o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
    if ([o, h, l, c].some(x => x == null || !(x > 0))) { dropped++; continue; }
    const H = Math.max(h, o, c), L = Math.min(l, o, c); if (H !== h || L !== l) fixed++;
    const v = q.volume && q.volume[i] > 0 ? q.volume[i] : undefined;
    bars.push({ t: t[i] * 1000, o, h: H, l: L, c, ...(v ? { v } : {}) });
  }
  bars.sort((a, b) => a.t - b.t);
  const out = []; for (const b of bars) if (!out.length || b.t > out[out.length - 1].t) out.push(b);   // sem duplicados
  out.meta = { sym, raw: t.length, dropped, fixed };
  return out;
}
const HLURL = 'https://api.hyperliquid.xyz/info';
export async function fetchHL(coin, iv) {
  const end = Date.now(), start = Math.floor(end - 5000 * MS[iv] * .999);
  for (let a = 0; a < 5; a++) { try { const r = await fetch(HLURL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'candleSnapshot', req: { coin, interval: iv, startTime: start, endTime: end } }) }); if (r.status === 429) { await sleep(1500 * (a + 1)); continue; } if (!r.ok) throw new Error('HTTP ' + r.status); const arr = await r.json(); return arr.map(x => ({ t: x.t, o: +x.o, h: +x.h, l: +x.l, c: +x.c, v: +x.v })).filter(b => b.t + MS[iv] <= end).sort((p, q) => p.t - q.t); } catch (e) { if (a === 4) throw e; await sleep(800); } }
}
export const fingerprint = bars => { let h = 2166136261; for (const b of bars) { h ^= Math.round(b.c * 1e6) % 4294967296; h = Math.imul(h, 16777619) >>> 0; } return `${bars.length}:${new Date(bars[0].t).toISOString().slice(0, 10)}:${new Date(bars[bars.length - 1].t).toISOString().slice(0, 10)}:${h.toString(16)}`; };
export function splitTimes(bars) {
  const times = [...new Set(Object.values(bars).flatMap(b => b.map(x => x.t)))].sort((a, b) => a - b);
  return { devEnd: times[Math.floor(times.length * .5)], valEnd: times[Math.floor(times.length * .75)], t0: times[0], t1: times[times.length - 1] };
}
