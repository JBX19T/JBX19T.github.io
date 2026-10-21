// Sondagem (só leitura, dados públicos): que históricos de funding / open interest / posicionamento estão acessíveis a partir do GitHub Actions.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, init) { try { const r = await fetch(url, init); const t = await r.text(); return { status: r.status, text: t.slice(0, 600), len: t.length }; } catch (e) { return { status: 'ERR', text: e.message }; } }
const show = (n, x) => console.log(`## ${n} [${x.status}] ${x.len ?? ''}\n${x.text}\n`);
const HL = 'https://api.hyperliquid.xyz/info', post = body => get(HL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
for (const coin of ['BTC', 'ETH', 'SOL', 'xyz:GOLD']) {
  const x = await post({ type: 'fundingHistory', coin, startTime: Date.UTC(2023, 0, 1) });
  let n = '?'; try { const r = await fetch(HL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'fundingHistory', coin, startTime: Date.UTC(2023, 0, 1) }) }); const j = await r.json(); n = Array.isArray(j) ? `${j.length} linhas; primeira ${new Date(j[0]?.time).toISOString()}; última ${new Date(j[j.length - 1]?.time).toISOString()}` : JSON.stringify(j).slice(0, 200); } catch (e) { n = e.message; }
  console.log(`## HL fundingHistory ${coin} [${x.status}] ${n}\n`); await sleep(300);
}
show('HL metaAndAssetCtxs (campos)', await post({ type: 'metaAndAssetCtxs' }));
show('Binance fapi fundingRate', await get('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=3'));
show('Binance fapi openInterestHist', await get('https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=3'));
show('Binance data-api (spot) ping', await get('https://data-api.binance.vision/api/v3/ping'));
for (const u of [
  'https://data.binance.vision/data/futures/um/monthly/fundingRate/BTCUSDT/BTCUSDT-fundingRate-2021-01.zip',
  'https://data.binance.vision/data/futures/um/monthly/klines/BTCUSDT/1h/BTCUSDT-1h-2021-01.zip',
  'https://data.binance.vision/data/futures/um/daily/metrics/BTCUSDT/BTCUSDT-metrics-2021-06-01.zip',
  'https://data.binance.vision/data/futures/um/daily/metrics/BTCUSDT/BTCUSDT-metrics-2023-06-01.zip',
  'https://data.binance.vision/data/futures/um/monthly/premiumIndexKlines/BTCUSDT/1h/BTCUSDT-1h-2021-01.zip',
]) { const x = await get(u, { method: 'HEAD' }); console.log(`## HEAD ${u.replace('https://data.binance.vision/', '')} [${x.status}]`); }
show('Bybit funding history', await get('https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=3'));
show('OKX funding history', await get('https://www.okx.com/api/v5/public/funding-rate-history?instId=BTC-USDT-SWAP&limit=3'));
