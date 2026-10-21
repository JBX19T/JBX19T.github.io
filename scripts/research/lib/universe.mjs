// Universo, dados sintéticos e carregamento (partilhado pelos Ciclos 1-3).
import { fetchBinance } from '../../lib/data.mjs';
import { fetchFunding } from './funding.mjs';
import { ST } from './model.mjs';
export const UNIVERSE = ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'DOGE', 'LTC', 'LINK', 'BCH', 'TRX', 'XLM', 'ATOM', 'ETC', 'VET', 'THETA', 'EOS', 'XTZ', 'NEO', 'IOTA', 'ALGO', 'ZEC', 'DASH', 'ONT', 'QTUM', 'ZIL', 'BAT', 'ENJ', 'MATIC', 'SOL', 'DOT', 'AVAX', 'UNI', 'FIL', 'AAVE', 'SUSHI', 'COMP', 'SNX', 'MKR', 'YFI', '1INCH', 'PAXG', 'EUR'];
export const T0 = Date.UTC(2019, 0, 1), EVAL0 = Date.UTC(2020, 0, 1), H1 = 36e5;
export function synthetic(names, N1, seed, a, b = 0) {   // a = momentum plantado em 6 barras; b = reversão plantada ligada ao funding (0 = passeio aleatório)
  const r = ST.rng(seed), gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) * Math.SQRT2; }, res = {}, fund = {};
  const mkt = new Float64Array(N1); for (let i = 0; i < N1; i++) mkt[i] = .0015 * gauss();
  for (const n of names) { const bars = [], ev = []; let p = 100 * (1 + r()), lr = new Array(6).fill(0), r24 = new Array(24).fill(0), fr = 0; const base = .0035 * (.7 + r() * .6);
    for (let i = 0; i < N1; i++) { const sg_ = base * Math.exp(.4 * Math.sin(i / 700 + n.length)), z = Math.max(-2, Math.min(2, lr.reduce((s, x) => s + x, 0) / (sg_ * Math.sqrt(6))));
      if (i % 8 === 0) { const z24 = Math.max(-2, Math.min(2, r24.reduce((s_, x) => s_ + x, 0) / (base * Math.sqrt(24)))); fr = 1e-4 * z24 + 2e-5 * gauss(); ev.push({ t: T0 + i * H1, r: fr }); }
      const ret = sg_ * gauss() + mkt[i] + a * sg_ * z - b * sg_ * (fr / 1e-4); const o = p; r24.shift(); r24.push(ret); p *= Math.exp(ret); lr.shift(); lr.push(ret);
      bars.push({ t: T0 + i * H1, o, h: Math.max(o, p) * (1 + .001 * r()), l: Math.min(o, p) * (1 - .001 * r()), c: p, v: 100 + 80 * r() }); }
    res[n] = bars; fund[n] = ev; }
  return { res, fund };
}
export async function load({ SYN, SMALL, FUNDING, planted }) {
  const series = {}, info = [], fund = {};
  if (SYN) { const names = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'LTC', 'DOT', 'LINK'], nul = SYN === 'null', s = synthetic(names, SMALL ? 24000 : 30000, 7, nul ? 0 : (planted === 'neutral' ? .15 : FUNDING ? 0 : .15), nul ? 0 : (planted === 'neutral' ? 0 : FUNDING ? .25 : 0)); for (const n of names) { series[n] = s.res[n]; fund[n] = s.fund[n]; } return { series, info: [], fund }; }
  const q = [...UNIVERSE]; await Promise.all(Array.from({ length: 4 }, async () => { while (q.length) { const n = q.shift(); const sym = n === 'EUR' ? 'EURUSDT' : n + 'USDT'; try { const b = await fetchBinance(sym, '1h', T0, 120000); if (b.length > 5000) series[n] = b; else info.push(`${n}: poucas barras (${b.length}), ignorada`); } catch (e) { info.push(`${n}: sem dados (${e.message})`); } } }));
  if (FUNDING) { const q2 = Object.keys(series); await Promise.all(Array.from({ length: 6 }, async () => { while (q2.length) { const n = q2.shift(); try { const ev = await fetchFunding(n + 'USDT'); if (ev.length > 200) fund[n] = ev; else info.push(`${n}: sem funding (${ev.length} eventos)`); } catch (e) { info.push(`${n}: funding falhou (${e.message})`); } } })); }
  return { series, info, fund };
}
