// Funding dos perpétuos USDT-M da Binance a partir dos ficheiros públicos mensais de data.binance.vision (sem chaves).
import zlib from 'node:zlib';
const sleep = ms => new Promise(r => setTimeout(r, ms));
export function unzipFirst(buf) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip inválido'); const cd = buf.readUInt32LE(e + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('zip inválido (diretório central)');
  const method = buf.readUInt16LE(cd + 10), csize = buf.readUInt32LE(cd + 20), lho = buf.readUInt32LE(cd + 42), start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28), data = buf.subarray(start, start + csize);
  return method === 0 ? data : zlib.inflateRawSync(data);
}
export function parseFundingCsv(text) { const out = []; for (const ln of text.split(/\r?\n/)) { const c = ln.split(','); const t = +c[0], r = +c[2]; if (Number.isFinite(t) && t > 1e12 && Number.isFinite(r)) out.push({ t, r }); } return out; }
export async function fetchFunding(sym, from = [2019, 9], now = new Date()) {
  const rows = []; let y = from[0], m = from[1];
  while (y < now.getUTCFullYear() || (y === now.getUTCFullYear() && m < now.getUTCMonth() + 1)) {
    const url = `https://data.binance.vision/data/futures/um/monthly/fundingRate/${sym}/${sym}-fundingRate-${y}-${String(m).padStart(2, '0')}.zip`;
    for (let a = 0; a < 3; a++) { try { const r = await fetch(url); if (r.status === 404) break; if (!r.ok) throw new Error('HTTP ' + r.status); rows.push(...parseFundingCsv(unzipFirst(Buffer.from(await r.arrayBuffer())).toString('utf8'))); break; } catch (e) { if (a === 2) throw new Error(`${sym} ${y}-${m}: ${e.message}`); await sleep(500 * (a + 1)); } }
    if (++m > 12) { m = 1; y++; }
  }
  rows.sort((a, b) => a.t - b.t); return rows.filter((x, i) => !i || x.t > rows[i - 1].t);
}
