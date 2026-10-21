// Painel de moedas: agrega velas de 1 h, calcula características causais e monta as linhas (moeda, barra) para o modelo.
const H1 = 36e5;
const clip = (x, c) => x > c ? c : x < -c ? -c : x;
export const FUND = ['fr_last', 'fr_m3', 'fr_z', 'fr_xs', 'fr_tr'];
export const FEATURES = (tf, fund = false) => ['z1', 'z3', 'z6', 'z12', 'z24', 'z48', 'vr', 'vol', 'pos', 'xs24', 'btc24', 'btcvr', 'lsig', 'dow_s', 'dow_c', ...(tf === '1h' ? ['hr_s', 'hr_c'] : []), ...(fund ? FUND : [])];
export const LOCAL_ONLY = ['xs24', 'btc24', 'btcvr'];

/* velas (ordenadas) → grelha de 1 h alinhada a t0 */
export function toGrid(bars, t0, N1) {
  const g = { o: new Float64Array(N1).fill(NaN), h: new Float64Array(N1).fill(NaN), l: new Float64Array(N1).fill(NaN), c: new Float64Array(N1).fill(NaN), v: new Float64Array(N1).fill(NaN) };
  for (const b of bars) { const i = Math.round((b.t - t0) / H1); if (i >= 0 && i < N1) { g.o[i] = b.o; g.h[i] = b.h; g.l[i] = b.l; g.c[i] = b.c; g.v[i] = b.v ?? NaN; } }
  return g;
}
/* agrega f barras de 1 h (exige todas presentes) */
export function aggregate(g, f) {
  if (f === 1) return g; const N = Math.floor(g.o.length / f), r = { o: new Float64Array(N).fill(NaN), h: new Float64Array(N).fill(NaN), l: new Float64Array(N).fill(NaN), c: new Float64Array(N).fill(NaN), v: new Float64Array(N).fill(NaN) };
  for (let i = 0; i < N; i++) { let ok = true, hi = -Infinity, lo = Infinity, v = 0; for (let k = 0; k < f; k++) { const j = i * f + k; if (!(g.c[j] > 0)) { ok = false; break; } if (g.h[j] > hi) hi = g.h[j]; if (g.l[j] < lo) lo = g.l[j]; v += g.v[j]; }
    if (ok) { r.o[i] = g.o[i * f]; r.c[i] = g.c[i * f + f - 1]; r.h[i] = hi; r.l[i] = lo; r.v[i] = v; } }
  return r;
}
function prefix(arr) { const N = arr.length, P = new Float64Array(N + 1), C = new Int32Array(N + 1); for (let i = 0; i < N; i++) { const ok = Number.isFinite(arr[i]); P[i + 1] = P[i] + (ok ? arr[i] : 0); C[i + 1] = C[i] + (ok ? 1 : 0); } return { P, C }; }

export function coinFeatures(a, lam = .97) {
  const N = a.c.length, lr = new Float64Array(N).fill(NaN), sig = new Float64Array(N).fill(NaN);
  for (let i = 1; i < N; i++) if (a.c[i] > 0 && a.c[i - 1] > 0) lr[i] = Math.log(a.c[i] / a.c[i - 1]);
  let s2 = NaN, cnt = 0, acc = 0;
  for (let i = 0; i < N; i++) { const x = lr[i]; if (Number.isFinite(x)) { if (Number.isNaN(s2)) { acc += x * x; if (++cnt === 30) s2 = acc / 30; } else s2 = lam * s2 + (1 - lam) * x * x; } sig[i] = Number.isNaN(s2) ? NaN : Math.sqrt(s2); }
  const z = {}; for (const k of [1, 3, 6, 12, 24, 48]) { const za = new Float32Array(N).fill(NaN), sk = Math.sqrt(k); for (let i = k; i < N; i++) if (a.c[i] > 0 && a.c[i - k] > 0 && sig[i] > 0) za[i] = clip(Math.log(a.c[i] / a.c[i - k]) / (sig[i] * sk), 6); z[k] = za; }
  const l2 = new Float64Array(N); for (let i = 0; i < N; i++) l2[i] = Number.isFinite(lr[i]) ? lr[i] * lr[i] : NaN;
  const { P, C } = prefix(l2), vr = new Float32Array(N).fill(NaN);
  for (let i = 96; i < N; i++) { const cs = C[i + 1] - C[i - 5], cl = C[i + 1] - C[i - 95]; if (cs >= 5 && cl >= 77) { const ss = (P[i + 1] - P[i - 5]) / cs, sl = (P[i + 1] - P[i - 95]) / cl; if (ss > 0 && sl > 0) vr[i] = clip(.5 * Math.log(ss / sl), 3); } }
  const { P: PV, C: CV } = prefix(a.v), vol = new Float32Array(N).fill(NaN);
  for (let i = 24; i < N; i++) { const c = CV[i] - CV[i - 24]; if (c >= 18 && Number.isFinite(a.v[i])) { const m = (PV[i] - PV[i - 24]) / c; vol[i] = clip(Math.log((a.v[i] + 1e-12) / (m + 1e-12)), 3); } }
  const pos = new Float32Array(N).fill(NaN);
  for (let i = 47; i < N; i++) { let hi = -Infinity, lo = Infinity, ok = true; for (let k = i - 47; k <= i; k++) { if (!(a.h[k] > 0)) { ok = false; break; } if (a.h[k] > hi) hi = a.h[k]; if (a.l[k] < lo) lo = a.l[k]; } if (ok && a.c[i] > 0) pos[i] = hi > lo ? (a.c[i] - lo) / (hi - lo) - .5 : 0; }
  return { lr, sig, z, vr, vol, pos };
}

/* funding (eventos {t,r}) → grelha de 1 h: última taxa, média dos últimos 9, z-score (270), soma acumulada (bps) */
export function fundingGrid(ev, t0, N1) {
  const nan = () => new Float32Array(N1).fill(NaN), g = { last: nan(), m3: nan(), z: nan(), cum: new Float64Array(N1 + 1) };
  if (!ev || ev.length < 20) return null;
  const E = ev.length, m3 = new Float64Array(E).fill(NaN), z = new Float64Array(E).fill(NaN);
  for (let e = 0; e < E; e++) { if (e >= 8) { let s = 0; for (let k = e - 8; k <= e; k++) s += ev[k].r; m3[e] = s / 9; } if (e >= 99) { const lo = Math.max(0, e - 269), n = e - lo + 1; let s = 0, s2 = 0; for (let k = lo; k <= e; k++) { s += ev[k].r; s2 += ev[k].r * ev[k].r; } const mu = s / n, sd = Math.sqrt(Math.max(0, s2 / n - mu * mu)); if (sd > 0) z[e] = clip((ev[e].r - mu) / sd, 5); } }
  let p = -1, acc = 0, q = 0;
  for (let i = 0; i <= N1; i++) { const tStart = t0 + i * H1; while (q < E && ev[q].t < tStart) { acc += ev[q].r * 1e4; q++; } g.cum[i] = acc; }
  for (let i = 0; i < N1; i++) { const tEnd = t0 + (i + 1) * H1; while (p + 1 < E && ev[p + 1].t < tEnd) p++; if (p >= 0 && tEnd - ev[p].t <= 12 * H1) { g.last[i] = clip(ev[p].r * 1e4, 30); g.m3[i] = Number.isNaN(m3[p]) ? NaN : m3[p] * 1e4; g.z[i] = Number.isNaN(z[p]) ? NaN : z[p]; } }
  return g;
}

/* monta as linhas para um prazo (tf) e horizonte h */
export function buildRows({ names, grids, tf, h, t0, stepMs, mask = [], fgrids = null }) {
  const f = Math.round(stepMs / H1), cg = names.map(n => aggregate(grids[n], f)), N = cg[0].c.length, NC = names.length;
  const cf = cg.map(a => coinFeatures(a)), btc = names.indexOf('BTC');
  const xs24 = names.map(() => new Float32Array(N).fill(NaN));
  for (let i = 0; i < N; i++) { const v = []; for (let c = 0; c < NC; c++) { const x = cf[c].z[24][i]; if (Number.isFinite(x)) v.push([x, c]); } if (v.length >= Math.min(10, NC)) { v.sort((p, q) => p[0] - q[0]); const n = v.length; v.forEach(([, c], r) => { xs24[c][i] = r / (n - 1) - .5; }); } }
  const useF = !!fgrids, FN = FEATURES(tf, useF), F = FN.length, fxs = names.map(() => new Float32Array(N).fill(NaN)), j1 = g => (g + 1) * f - 1;
  if (useF) for (let g = 0; g < N; g++) { const v = []; for (let c = 0; c < NC; c++) { const fg = fgrids[names[c]]; const x = fg ? fg.m3[j1(g)] : NaN; if (Number.isFinite(x)) v.push([x, c]); } if (v.length >= Math.min(10, NC)) { v.sort((p, q) => p[0] - q[0]); const n = v.length; v.forEach(([, c], r) => { fxs[c][g] = r / (n - 1) - .5; }); } }
  const maskIdx = new Set(mask.map(m => FN.indexOf(m)));
  const fOk = (c, g) => { if (!useF) return true; const fg = fgrids[names[c]]; if (!fg) return false; const j = j1(g); return Number.isFinite(fg.last[j]) && Number.isFinite(fg.m3[j]) && Number.isFinite(fg.z[j]) && Number.isFinite(fxs[c][g]); };
  const valid = (c, g) => { const x = cf[c]; if (!(x.sig[g] > 0) || !(cg[c].o[g + 1] > 0) || !(cg[c].o[g + 1 + h] > 0)) return false; for (const k of [1, 3, 6, 12, 24, 48]) if (!Number.isFinite(x.z[k][g])) return false; return Number.isFinite(x.vr[g]) && Number.isFinite(x.vol[g]) && Number.isFinite(x.pos[g]) && Number.isFinite(xs24[c][g]) && btc >= 0 && Number.isFinite(cf[btc].z[24][g]) && Number.isFinite(cf[btc].vr[g]) && fOk(c, g); };
  let n = 0; for (let g = 0; g < N - 1 - h; g++) for (let c = 0; c < NC; c++) if (valid(c, g)) n++;
  const R = { n, N, F, FN, names, tf, h, t0, stepMs, g: new Int32Array(n), coin: new Uint8Array(n), X: new Float32Array(n * F), y: new Float32Array(n), raw: new Float32Array(n), fund: new Float32Array(n), sigBps: new Float32Array(n), off: new Int32Array(N + 2) };
  let r = 0;
  for (let g = 0; g < N; g++) { R.off[g] = r; if (g >= N - 1 - h) continue;
    const ts = t0 + g * stepMs, dow = new Date(ts).getUTCDay(), hr = new Date(ts).getUTCHours();
    for (let c = 0; c < NC; c++) { if (!valid(c, g)) continue; const x = cf[c], o = r * F;
      const v = [x.z[1][g], x.z[3][g], x.z[6][g], x.z[12][g], x.z[24][g], x.z[48][g], x.vr[g], x.vol[g], x.pos[g], xs24[c][g], cf[btc].z[24][g], cf[btc].vr[g], Math.log(x.sig[g]), Math.sin(2 * Math.PI * dow / 7), Math.cos(2 * Math.PI * dow / 7)];
      if (tf === '1h') v.push(Math.sin(2 * Math.PI * hr / 24), Math.cos(2 * Math.PI * hr / 24));
      if (useF) { const fg = fgrids[names[c]], j = j1(g); v.push(fg.last[j], fg.m3[j], fg.z[j], fxs[c][g], fg.last[j] - fg.m3[j]); R.fund[r] = fg.cum[(g + 1 + h) * f] - fg.cum[(g + 1) * f]; }
      for (let j = 0; j < F; j++) R.X[o + j] = maskIdx.has(j) ? 0 : v[j];
      const lret = Math.log(cg[c].o[g + 1 + h] / cg[c].o[g + 1]), sh = x.sig[g] * Math.sqrt(h);
      R.g[r] = g; R.coin[r] = c; R.y[r] = clip(lret / sh, 5); R.raw[r] = lret * 1e4; R.sigBps[r] = sh * 1e4; r++; } }
  R.off[N] = r; R.off[N + 1] = r; return R;
}
