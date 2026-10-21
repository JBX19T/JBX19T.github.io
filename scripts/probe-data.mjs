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
for (const [n, s] of [['ouro GC=F', 'GC%3DF'], ['ouro XAUUSD=X', 'XAUUSD%3DX'], ['S&P 500 ^GSPC', '%5EGSPC'], ['EURUSD=X', 'EURUSD%3DX'], ['petróleo CL=F', 'CL%3DF'], ['dólar DX-Y.NYB', 'DX-Y.NYB'], ['prata SI=F', 'SI%3DF'], ['BTC-USD', 'BTC-USD'], ['Nasdaq ^IXIC', '%5EIXIC'], ['JPY=X', 'JPY%3DX']])
  await get('yahoo ' + n, `https://query1.finance.yahoo.com/v8/finance/chart/${s}?range=max&interval=1d`, yahoo);
for (const [n, s] of [['xauusd', 'xauusd'], ['^spx', '%5Espx'], ['eurusd', 'eurusd'], ['cl.f', 'cl.f'], ['gc.f', 'gc.f']])
  await get('stooq ' + n, `https://stooq.com/q/d/l/?s=${s}&i=d`, csv);
for (const id of ['DEXUSEU', 'SP500', 'GOLDAMGBD228NLBM', 'DCOILWTICO', 'DTWEXBGS'])
  await get('fred ' + id, `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, csv);
await get('binance PAXG 1d', 'https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval=1d&startTime=0&limit=2', t => t.slice(0, 120));
await get('binance BTC 1d', 'https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=0&limit=2', t => t.slice(0, 120));
await get('hyperliquid meta', 'https://api.hyperliquid.xyz/info', t => t.slice(0, 60)); 
console.log(out.join('\n'));
