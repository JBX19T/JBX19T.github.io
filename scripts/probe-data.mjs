// Sondagem de fontes públicas de histórico (só leitura): diz o que está acessível a partir do GitHub Actions e desde que data.
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; dollos-research/1.0)' };
const out = [];
async function get(name, url, parse) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: UA });
    const txt = await r.text();
    let info = '';
    try { info = parse ? parse(txt) : txt.slice(0, 80).replace(/\s+/g, ' '); } catch (e) { info = 'parse: ' + e.message + ' · ' + txt.slice(0, 80).replace(/\s+/g, ' '); }
    out.push(`${r.ok ? 'OK ' : 'ERR'} ${r.status} ${name} (${Date.now() - t0} ms): ${info}`);
  } catch (e) { out.push(`FAIL ${name}: ${e.message}`); }
}
const yahoo = txt => { const j = JSON.parse(txt), r = j.chart.result[0], t = r.timestamp, c = r.indicators.quote[0].close; return `${t.length} pontos, ${new Date(t[0] * 1000).toISOString().slice(0, 10)} → ${new Date(t[t.length - 1] * 1000).toISOString().slice(0, 10)}, nulos ${c.filter(x => x == null).length}`; };
const csv = txt => { const L = txt.trim().split('\n'); return `${L.length - 1} linhas, ${L[1]?.split(',')[0]} → ${L[L.length - 1].split(',')[0]} · cabeçalho: ${L[0]}`; };
const yahooD = txt => { const j = JSON.parse(txt), r = j.chart.result[0], t = r.timestamp, q = r.indicators.quote[0]; let bad = 0, nul = 0, dup = 0; const gaps = [];
  for (let i = 0; i < t.length; i++) { const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i]; if ([o, h, l, c].some(x => x == null)) { nul++; continue; } if (!(h >= Math.max(o, c) - 1e-9 && l <= Math.min(o, c) + 1e-9 && l > 0)) bad++; if (i && t[i] === t[i - 1]) dup++; if (i) gaps.push((t[i] - t[i - 1]) / 86400); }
  gaps.sort((a, b) => a - b); return `${t.length} pontos, ${new Date(t[0] * 1000).toISOString().slice(0, 10)} → ${new Date(t[t.length - 1] * 1000).toISOString().slice(0, 10)}, nulos ${nul}, inválidos ${bad}, duplicados ${dup}, intervalo mediano ${gaps[gaps.length >> 1]} d, máx ${gaps[gaps.length - 1]} d, volume ${q.volume ? q.volume.filter(x => x > 0).length : 0}`; };
for (const [n, s] of [['ouro GLD (ETF)', 'GLD'], ['ouro GC=F', 'GC%3DF'], ['S&P 500 ^GSPC', '%5EGSPC'], ['SPY', 'SPY'], ['EURUSD=X', 'EURUSD%3DX'], ['JPY=X', 'JPY%3DX'], ['dólar DX-Y.NYB', 'DX-Y.NYB'], ['TLT', 'TLT'], ['petróleo CL=F', 'CL%3DF'], ['prata SI=F', 'SI%3DF'], ['ETH-USD', 'ETH-USD'], ['BTC-USD', 'BTC-USD']])
  await get('yahoo-diário ' + n, `https://query1.finance.yahoo.com/v8/finance/chart/${s}?period1=0&period2=${Math.floor(Date.now() / 1000)}&interval=1d`, yahooD);
await get('binance BTC 1d', 'https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=0&limit=2', t => t.slice(0, 60));
console.log(out.join('\n'));
