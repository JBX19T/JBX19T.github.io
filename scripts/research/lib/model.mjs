// Ridge walk-forward com purga, simulação de trades com limiar de custo, estatística.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ST = require('../../../grokbot/labstats.js');
export { ST };

function solve(A, b, D) { const M = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < D; i++) { let p = i; for (let k = i + 1; k < D; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; const d = M[i][i] || 1e-12; for (let k = i + 1; k < D; k++) { const f = M[k][i] / d; if (f) for (let j = i; j <= D; j++) M[k][j] -= f * M[i][j]; } } const x = new Array(D).fill(0); for (let i = D - 1; i >= 0; i--) { let s = M[i][D]; for (let j = i + 1; j < D; j++) s -= M[i][j] * x[j]; x[i] = s / (M[i][i] || 1e-12); } return x; }

/* alvo opcional (y) para o controlo negativo; devolve previsões fora da amostra e os coeficientes de cada reajuste */
export function walkForward(R, { y = R.y, lambda = 1000, retrain, gEval, skip = [] }) {
  const { F, N, off } = R, sk = new Uint8Array(F); for (const j of skip) sk[j] = 1; const X = sk.some(Boolean) ? R.X.map((v, i) => sk[i % F] ? 0 : v) : R.X, D = F + 1, XtX = new Float64Array(D * D), Xty = new Float64Array(D), pred = new Float32Array(R.n).fill(NaN), betas = [], xa = new Float64Array(D);
  let added = 0;
  for (let T = gEval; T < N; T += retrain) {
    const lim = off[Math.max(0, Math.min(N, T - R.h + 1))];
    for (; added < lim; added++) { xa[0] = 1; for (let j = 0; j < F; j++) xa[j + 1] = X[added * F + j]; const yy = y[added]; for (let i = 0; i < D; i++) { Xty[i] += xa[i] * yy; for (let j = i; j < D; j++) XtX[i * D + j] += xa[i] * xa[j]; } }
    if (added < 500) continue;
    const A = []; for (let i = 0; i < D; i++) { A.push([]); for (let j = 0; j < D; j++) A[i].push(j >= i ? XtX[i * D + j] : XtX[j * D + i]); if (i > 0) A[i][i] += lambda; else A[i][i] += 1e-9; }
    const beta = solve(A, Array.from(Xty), D); betas.push({ T, beta });
    const end = off[Math.min(N, T + retrain)];
    for (let r = off[T]; r < end; r++) { let s = beta[0]; for (let j = 0; j < F; j++) s += beta[j + 1] * X[r * F + j]; pred[r] = s; }
  }
  return { pred, betas };
}
/* alvo deslocado circularmente por moeda (controlo negativo) */
export function shiftedTarget(R, S = 2000, yArr = R.y) {
  const y = new Float32Array(R.n), raw = new Float32Array(R.n), fund = new Float32Array(R.n), per = new Map();
  for (let r = 0; r < R.n; r++) { if (!per.has(R.coin[r])) per.set(R.coin[r], []); per.get(R.coin[r]).push(r); }
  for (const idx of per.values()) for (let j = 0; j < idx.length; j++) { const s = idx[(j + S) % idx.length]; y[idx[j]] = yArr[s]; raw[idx[j]] = R.raw[s]; fund[idx[j]] = R.fund[s]; }
  return { y, raw, fund };
}
/* trades: limiar k·C (k = 0 → todos os sinais); posição única por moeda, sem sobreposição */
export function trades(R, pred, { k, C, raw = R.raw, fund = R.fund, gLo, gHi }) {
  const free = new Int32Array(R.names.length), out = [];
  for (let r = 0; r < R.n; r++) { const g = R.g[r]; if (g < gLo || g >= gHi) continue; const p = pred[r]; if (!Number.isFinite(p)) continue; const c = R.coin[r]; if (g < free[c]) continue;
    const pb = Math.abs(p) * R.sigBps[r]; if (k > 0 && pb < k * C) continue; if (p === 0) continue;
    const side = p > 0 ? 1 : -1, gross = side * raw[r]; const fc = side * fund[r]; free[c] = g + R.h; out.push({ r, g, c, side, gross, net: gross - C - fc, pb }); }
  return out;
}
/* estatística de um conjunto de trades; month(g) → rótulo de cluster */
export function summarize(tr, monthOf, { B = 2000, vs = false, C = 0 } = {}) {
  const n = tr.length; if (!n) return { n: 0 };
  const net = tr.map(t => t.net), cb = ST.clusterBootstrap(net, tr.map(t => monthOf(t.g)), { B }), gross = tr.reduce((s, t) => s + t.gross, 0) / n;
  const w = net.filter(x => x > 0).reduce((s, x) => s + x, 0), l = -net.filter(x => x < 0).reduce((s, x) => s + x, 0), sub = s => { const a = tr.filter(t => t.side === s); return a.length ? a.reduce((x, t) => x + t.net, 0) / a.length : null; };
  let vsL = null; if (vs) { const d = tr.map(t => t.side === 1 ? 0 : 2 * t.net + 2 * C), cv = ST.clusterBootstrap(d, tr.map(t => monthOf(t.g)), { B: Math.min(B, 1500) }); vsL = { mean: cv.mean, pOne: cv.pOne }; }   // ganho face a «sempre comprado» nas mesmas entradas
  return { vs: vsL, n, net: cb.mean, gross, lo: cb.lo, hi: cb.hi, t: cb.t, pOne: cb.pOne, clusters: cb.clusters, hit: net.filter(x => x > 0).length / n, pf: l > 0 ? w / l : null, long: sub(1), short: sub(-1), nLong: tr.filter(t => t.side === 1).length };
}
/* carteira: cada trade pesa 1/NU do capital; PnL diário com saída à data de saída */
export function portfolio(tr, R, NU, costExtra = 0) {
  const day = g => Math.floor((R.t0 + (g + 1 + R.h) * R.stepMs) / 864e5), by = new Map(); let d0 = Infinity, d1 = -Infinity;
  for (const t of tr) { const d = day(t.g); by.set(d, (by.get(d) || 0) + (t.net - costExtra) / 1e4 / NU); if (d < d0) d0 = d; if (d > d1) d1 = d; }
  if (!isFinite(d0)) return { sharpe: null, maxDD: 0, ret: 0 };
  let eq = 1, pk = 1, dd = 0; const rs = []; for (let d = d0; d <= d1; d++) { const x = by.get(d) || 0; rs.push(x); eq *= 1 + x; if (eq > pk) pk = eq; dd = Math.max(dd, 1 - eq / pk); }
  const m = rs.reduce((s, x) => s + x, 0) / rs.length, sd = Math.sqrt(rs.reduce((s, x) => s + (x - m) ** 2, 0) / (rs.length - 1 || 1));
  return { sharpe: sd > 0 ? m / sd * Math.sqrt(365) : null, maxDD: dd, ret: eq - 1, days: rs.length };
}
export function pearson(a, b) { let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0; for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (!Number.isFinite(x) || !Number.isFinite(y)) continue; n++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; } const cv = sab - sa * sb / n, va = saa - sa * sa / n, vb = sbb - sb * sb / n; return n > 2 && va > 0 && vb > 0 ? cv / Math.sqrt(va * vb) : null; }
