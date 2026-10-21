// Ciclo 4: colheita de funding (comprado no spot + vendido no perpétuo, mesma quantidade). Regras: docs/PREREGISTO-CICLO4-CARRY.md
// Uso: node scripts/research/carry.mjs [--out pasta] [--synthetic [null]]
// Só lê dados públicos de mercado; não envia ordens.
import fs from 'node:fs';
import path from 'node:path';
import { fetchBinance } from '../lib/data.mjs';
import { fetchFunding, unzipFirst } from './lib/funding.mjs';
import { ST } from './lib/model.mjs';
import { f2, pc, sg, pv, iso, table } from '../lib/util.mjs';

const A = process.argv.slice(2), arg = (k, d) => { const i = A.indexOf('--' + k); return i >= 0 ? (A[i + 1] && !A[i + 1].startsWith('--') ? A[i + 1] : true) : d; };
const OUT = arg('out', 'ciclo4-out'), SYN = arg('synthetic', false);
const DAY = 864e5, D0 = Date.UTC(2019, 8, 1), EVAL0 = Date.UTC(2020, 0, 1), HL0 = Date.UTC(2023, 4, 1);
const CORE = ['BTC', 'ETH', 'SOL'], ROBUST = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'LINK', 'LTC', 'AVAX'];
const RULE = { IN: 5e-5, OUT: 0, L: 2, rebal: .30, liq: .45, cost: 15.5e-4 }, PRIOR = 47;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let buf = []; const out = (s = '') => { buf.push(s); console.log(s); };
fs.mkdirSync(OUT, { recursive: true });

// ---------------- dados ----------------
async function zipCsv(url) { for (let a = 0; a < 3; a++) { try { const r = await fetch(url); if (r.status === 404) return null; if (!r.ok) throw new Error('HTTP ' + r.status); return unzipFirst(Buffer.from(await r.arrayBuffer())).toString('utf8'); } catch (e) { if (a === 2) throw e; await sleep(600 * (a + 1)); } } }
async function fetchPerpDaily(sym, now = new Date()) {
  const rows = [], base = 'https://data.binance.vision/data/futures/um', push = txt => { if (!txt) return; for (const ln of txt.split(/\r?\n/)) { const c = ln.split(','), t = +c[0]; if (t > 1e12 && +c[1] > 0) rows.push({ t, o: +c[1], h: +c[2], l: +c[3], c: +c[4] }); } };
  let y = 2019, m = 9; const cy = now.getUTCFullYear(), cm = now.getUTCMonth() + 1;
  while (y < cy || (y === cy && m < cm)) { push(await zipCsv(`${base}/monthly/klines/${sym}/1d/${sym}-1d-${y}-${String(m).padStart(2, '0')}.zip`)); if (++m > 12) { m = 1; y++; } }
  for (let d = 1; d < now.getUTCDate(); d++) push(await zipCsv(`${base}/daily/klines/${sym}/1d/${sym}-1d-${cy}-${String(cm).padStart(2, '0')}-${String(d).padStart(2, '0')}.zip`));
  rows.sort((a, b) => a.t - b.t); return rows.filter((x, i) => !i || x.t > rows[i - 1].t);
}
async function fetchHLFunding(coin, start = HL0) {
  const out = []; let t = start;
  for (let guard = 0; guard < 400; guard++) {
    let arr = null; for (let a = 0; a < 4 && !arr; a++) { try { const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'fundingHistory', coin, startTime: t }) }); if (r.status === 429) { await sleep(2000); continue; } arr = await r.json(); } catch (e) { await sleep(1000); } }
    if (!Array.isArray(arr) || !arr.length) break; for (const x of arr) out.push({ t: x.time, r: +x.fundingRate });
    const last = arr[arr.length - 1].time; if (arr.length < 500 || last <= t) break; t = last + 1; await sleep(250);
  }
  out.sort((a, b) => a.t - b.t); return out.filter((x, i) => !i || x.t > out[i - 1].t);
}
function synthetic(nul) {
  const r = ST.rng(nul ? 5 : 3), g = () => { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) * Math.SQRT2; }, end = Date.UTC(2026, 9, 1), D = Math.floor((end - D0) / DAY), res = {};
  for (const n of ROBUST) { let p = 100 * (1 + r()), b = 0; const spot = [], perp = [], fb = [], fh = [], mu = nul ? 0 : 1e-4;
    for (let d = 0; d < D; d++) { const t = D0 + d * DAY, o = p; p *= Math.exp(.035 * g()); b = .9 * b + .0005 * g(); spot.push({ t, o, h: Math.max(o, p) * 1.01, l: Math.min(o, p) * .99, c: p }); perp.push({ t, o: o * (1 + b), h: Math.max(o, p) * 1.01 * (1 + b), l: Math.min(o, p) * .99 * (1 + b), c: p * (1 + b) });
      for (let k = 0; k < 3; k++) fb.push({ t: t + k * 8 * 36e5, r: mu + 1.2e-4 * g() }); if (t >= HL0) for (let k = 0; k < 24; k++) fh.push({ t: t + k * 36e5, r: mu / 8 + 2e-5 * g() }); }
    res[n] = { spot, perp, fb, fh: CORE.includes(n) ? fh : null }; }
  return res;
}
async function load() {
  if (SYN) return { data: synthetic(SYN === 'null'), info: [] };
  const data = {}, info = [], q = [...ROBUST];
  await Promise.all(Array.from({ length: 4 }, async () => { while (q.length) { const n = q.shift(), sym = n + 'USDT'; try {
    const [spot, perp, fb] = [await fetchBinance(sym, '1d', D0, 5000), await fetchPerpDaily(sym), await fetchFunding(sym)], fh = CORE.includes(n) ? await fetchHLFunding(n) : null;
    data[n] = { spot, perp, fb, fh }; console.error(`${n}: spot ${spot.length}, perp ${perp.length}, funding Binance ${fb.length}, Hyperliquid ${fh ? fh.length : '—'}`);
  } catch (e) { info.push(`${n}: ${e.message}`); } } }));
  return { data, info };
}

// ---------------- simulação ----------------
const ND = Math.floor((Date.now() - D0) / DAY) + 2;
function grid(rows, f) { const a = new Float64Array(ND).fill(NaN); for (const x of rows || []) { const d = Math.round((x.t - D0) / DAY); if (d >= 0 && d < ND) a[d] = f(x); } return a; }
/* sinal (média por 8 h dos últimos 3 dias) e funding acumulado em cada dia (eventos em ]início, início + 1 dia]) */
function fundingDays(ev) {
  const sig = new Float64Array(ND).fill(NaN), day = new Float64Array(ND).fill(NaN); if (!ev || !ev.length) return { sig, day };
  let lo = 0, hi = 0, s = 0; const E = ev.length;
  for (let d = 0; d < ND; d++) { const t = D0 + d * DAY;
    while (hi < E && ev[hi].t <= t) { s += ev[hi].r; hi++; } while (lo < hi && ev[lo].t <= t - 3 * DAY) { s -= ev[lo].r; lo++; }
    if (hi - lo >= 3 && t - ev[hi - 1].t <= 12 * 36e5) sig[d] = s / 9;
    let k = hi, sd = 0, n = 0; while (k < E && ev[k].t <= t + DAY) { sd += ev[k].r; n++; k++; } if (n) day[d] = sd; }
  return { sig, day };
}
function simCoin(P, F, { IN, OUT, cost, rebal, liq }, d0, d1) {
  const pnl = new Float64Array(ND), comp = { funding: 0, basis: 0, cost: 0, daysIn: 0, entries: 0, exits: 0, rebals: 0, liqs: 0, missing: 0 }; let inPos = false, Se = 0, Fe = 0;
  for (let d = d0; d < d1; d++) {
    const ok = P.so[d] > 0 && P.po[d] > 0 && P.so[d + 1] > 0 && P.po[d + 1] > 0 && Number.isFinite(F.sig[d]);
    if (!ok) { if (inPos) { comp.missing++; inPos = false; pnl[d] -= cost; comp.cost += cost; comp.exits++; } continue; }
    if (!inPos && F.sig[d] >= IN) { inPos = true; Se = P.so[d]; Fe = P.po[d]; pnl[d] -= cost; comp.cost += cost; comp.entries++; }
    else if (inPos && F.sig[d] < OUT) { inPos = false; pnl[d] -= cost; comp.cost += cost; comp.exits++; continue; }
    else if (inPos && P.po[d] / Fe - 1 >= rebal) { pnl[d] -= 2 * cost; comp.cost += 2 * cost; Se = P.so[d]; Fe = P.po[d]; comp.rebals++; }
    if (!inPos) continue;
    if (P.ph[d] / Fe - 1 >= liq) { pnl[d] -= .01 + cost; comp.cost += .01 + cost; comp.liqs++; inPos = false; continue; }
    const fu = (Number.isFinite(F.day[d]) ? F.day[d] : 0) * P.po[d] / Fe, ba = (P.so[d + 1] - P.so[d]) / Se - (P.po[d + 1] - P.po[d]) / Fe;
    pnl[d] += fu + ba; comp.funding += fu; comp.basis += ba; comp.daysIn++;
  }
  return { pnl, comp };
}
function portfolio(coins, Ps, Fs, rule, d0, d1) {
  const r = new Float64Array(ND), w = 1 / coins.length * rule.L / (1 + rule.L), per = {};
  for (const n of coins) { if (!Ps[n] || !Fs[n]) continue; const s = simCoin(Ps[n], Fs[n], rule, d0, d1); per[n] = s.comp; for (let d = d0; d < d1; d++) r[d] += w * s.pnl[d]; per[n].w = w; }
  return { r, per };
}
function stats(r, a, b, B = 10000) {
  const v = [], m = []; for (let d = a; d < b; d++) { v.push(r[d]); m.push(new Date(D0 + d * DAY).toISOString().slice(0, 7)); }
  if (v.length < 30) return { n: v.length };
  const cb = ST.clusterBootstrap(v, m, { B }), mean = cb.mean, sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (v.length - 1));
  let eq = 1, pk = 1, dd = 0; for (const x of v) { eq *= 1 + x; if (eq > pk) pk = eq; dd = Math.max(dd, 1 - eq / pk); }
  return { n: v.length, ann: mean * 365, lo: cb.lo * 365, hi: cb.hi * 365, t: cb.t, pOne: cb.pOne, vol: sd * Math.sqrt(365), sharpe: sd > 0 ? mean / sd * Math.sqrt(365) : null, maxDD: dd, cagr: Math.pow(eq, 365 / v.length) - 1, total: eq - 1 };
}
const years = (r, a, b) => { const by = {}; for (let d = a; d < b; d++) { const y = new Date(D0 + d * DAY).getUTCFullYear(); (by[y] ??= []).push(r[d]); } return Object.entries(by).map(([y, v]) => ({ y, n: v.length, ret: v.reduce((e, x) => e * (1 + x), 1) - 1 })); };

(async () => {
  const t00 = Date.now();
  out(`# Ciclo 4 — colheita de funding (spot comprado + perpétuo vendido) — ${new Date().toISOString()}${SYN ? ` (DADOS SINTÉTICOS ${SYN === 'null' ? 'com funding médio ZERO' : 'com funding positivo'}: só teste do código)` : ''}`); out('');
  out('**Tudo o que segue é simulado com dados históricos; não são resultados reais.** Regras e critérios: `docs/PREREGISTO-CICLO4-CARRY.md` (escrito antes desta corrida).'); out('');
  const { data, info } = await load(), Ps = {}, FB = {}, FH = {};
  for (const [n, x] of Object.entries(data)) { Ps[n] = { so: grid(x.spot, b => b.o), po: grid(x.perp, b => b.o), ph: grid(x.perp, b => b.h) }; FB[n] = fundingDays(x.fb); if (x.fh) FH[n] = fundingDays(x.fh); }
  const lastDay = d => { let k = ND - 2; while (k > 0 && !(Ps[d].so[k + 1] > 0 && Ps[d].po[k + 1] > 0)) k--; return k + 1; };
  const dEval = Math.round((EVAL0 - D0) / DAY), dEnd = Math.min(...CORE.filter(n => Ps[n]).map(lastDay)), dHL = Math.round((HL0 - D0) / DAY);
  const d50 = dEval + Math.floor((dEnd - dEval) * .5), d75 = dEval + Math.floor((dEnd - dEval) * .75);
  out('## Dados'); out('');
  out(table(['mercado', 'spot (dias)', 'perpétuo (dias)', 'funding Binance (eventos)', 'funding Hyperliquid (eventos)', 'primeiro funding'], Object.entries(data).map(([n, x]) => [n, x.spot.length, x.perp.length, x.fb.length, x.fh ? x.fh.length : '—', x.fb.length ? iso(x.fb[0].t) : '—']))); out('');
  if (info.length) { out('Falhas: ' + info.join('; ')); out(''); }
  out(`Avaliação E1 (funding Binance): ${iso(D0 + dEval * DAY)} → ${iso(D0 + dEnd * DAY)}; DEV até ${iso(D0 + d50 * DAY)}, VAL até ${iso(D0 + d75 * DAY)}, TEST até ao fim. E2 (funding Hyperliquid): ${iso(HL0)} → ${iso(D0 + dEnd * DAY)}.`); out('');

  const main = portfolio(CORE, Ps, FB, RULE, dEval, dEnd), stress = portfolio(CORE, Ps, FB, { ...RULE, cost: 2 * RULE.cost }, dEval, dEnd), hl = portfolio(CORE, Ps, FH, RULE, dHL, dEnd), rob = portfolio(ROBUST, Ps, FB, RULE, dEval, dEnd);
  const always = portfolio(CORE, Ps, FB, { ...RULE, IN: -1, OUT: -1 }, dEval, dEnd);
  const S = { full: stats(main.r, dEval, dEnd), dev: stats(main.r, dEval, d50), val: stats(main.r, d50, d75), test: stats(main.r, d75, dEnd), testStress: stats(stress.r, d75, dEnd), hl: stats(hl.r, dHL, dEnd), rob: stats(rob.r, dEval, dEnd), always: stats(always.r, dEval, dEnd), hlStress: stats(portfolio(CORE, Ps, FH, { ...RULE, cost: 2 * RULE.cost }, dHL, dEnd).r, dHL, dEnd) };
  const row = (lab, s) => [lab, s.n, pc(s.ann), `[${pc(s.lo)}, ${pc(s.hi)}]`, f2(s.t), pv(s.pOne), pc(s.vol), f2(s.sharpe), pc(s.maxDD), pc(s.total)];
  out('## Resultados da carteira (3 mercados, capital igual, retorno sobre o capital total)'); out('');
  out(table(['período / variante', 'dias', 'retorno anual (média × 365)', 'IC95 %', 't', 'p unilateral', 'volatilidade anual', 'Sharpe', 'queda máx.', 'retorno acumulado'], [
    row('E1 completo', S.full), row('E1 DEV', S.dev), row('E1 VAL', S.val), row('**E1 TEST**', S.test), row('E1 TEST, custos ×2', S.testStress), row('**E2 funding Hyperliquid**', S.hl), row('E2, custos ×2', S.hlStress), row('Robustez: 10 mercados (E1 completo)', S.rob), row('Referência: sempre ligado (E1 completo)', S.always)]));
  out('');
  out('### Por ano (E1, regra principal)'); out('');
  const Y = years(main.r, dEval, dEnd), Yhl = years(hl.r, dHL, dEnd);
  out(table(['ano', 'dias', 'retorno E1', 'retorno E2 (Hyperliquid)'], Y.map(y => [y.y, y.n, pc(y.ret), (Yhl.find(z => z.y === y.y) ? pc(Yhl.find(z => z.y === y.y).ret) : '—')]))); out('');
  out('### De onde vem o resultado (por mercado, em % do nocional, soma no período; E1 completo)'); out('');
  out(table(['mercado', 'dias posicionado', 'entradas', 'saídas', 'reequilíbrios', 'liquidações', 'funding recebido', 'base (perp − spot)', 'custos'], Object.entries(main.per).map(([n, c]) => [n, c.daysIn, c.entries, c.exits, c.rebals, c.liqs, pc(c.funding), pc(c.basis), pc(-c.cost)]))); out('');
  out('### E2 (funding Hyperliquid) por mercado'); out('');
  out(table(['mercado', 'dias posicionado', 'entradas', 'liquidações', 'funding recebido', 'base', 'custos'], Object.entries(hl.per).map(([n, c]) => [n, c.daysIn, c.entries, c.liqs, pc(c.funding), pc(c.basis), pc(-c.cost)]))); out('');

  // ---------------- sensibilidade (diagnóstico) ----------------
  out('## Sensibilidade aos limiares (E1 completo, só diagnóstico: a decisão usa a regra fixa 0,005 % / 0 %)'); out('');
  const rowsS = []; for (const IN of [0, 2.5e-5, 5e-5, 1e-4]) for (const OUTv of [-5e-5, 0, 2.5e-5]) { if (OUTv > IN) continue; const s = stats(portfolio(CORE, Ps, FB, { ...RULE, IN, OUT: OUTv }, dEval, dEnd).r, dEval, dEnd, 1000); rowsS.push([`${(IN * 100).toFixed(4)} %`, `${(OUTv * 100).toFixed(4)} %`, pc(s.ann), f2(s.sharpe), pc(s.maxDD)]); }
  out(table(['entrar se média ≥', 'sair se média <', 'retorno anual', 'Sharpe', 'queda máx.'], rowsS)); out('');
  const bh = Ps.BTC ? (() => { const r = new Float64Array(ND); for (let d = dEval; d < dEnd; d++) if (Ps.BTC.so[d] > 0 && Ps.BTC.so[d + 1] > 0) r[d] = Ps.BTC.so[d + 1] / Ps.BTC.so[d] - 1; return stats(r, dEval, dEnd, 500); })() : null;
  if (bh) { out(`Para comparação (não é a mesma coisa): comprar e manter BTC no mesmo período deu ${pc(bh.cagr)} por ano composto, com queda máxima de ${pc(bh.maxDD)}.`); out(''); }

  // ---------------- decisão ----------------
  const yOk = Y.filter(y => y.n >= 182), liqs = [...Object.values(main.per), ...Object.values(hl.per)].reduce((s, c) => s + c.liqs, 0), pAdj = Math.min(1, (PRIOR + 1) * (S.test.pOne ?? 1));
  const crit = { a: S.test.ann > 0 && pAdj < .05, b: S.testStress.ann > 0, c: yOk.length > 0 && yOk.filter(y => y.ret > 0).length / yOk.length >= 2 / 3, d: S.full.maxDD <= .10, e: S.hl.ann > 0 && (S.hl.pOne ?? 1) < .05, f: liqs === 0, g: S.rob.ann > 0 };
  const pass = Object.values(crit).every(Boolean);
  out('## Decisão (critérios do pré-registo)'); out('');
  out(table(['critério', 'valor', 'passa'], [
    ['a) TEST > 0, p corrigido (Holm, 48 hipóteses) < 0,05', `${pc(S.test.ann)} por ano; p = ${pv(S.test.pOne)} → corrigido ${pv(pAdj)}`, crit.a ? 'sim' : 'não'],
    ['b) TEST com custos ×2 > 0', pc(S.testStress.ann), crit.b ? 'sim' : 'não'],
    ['c) ≥ 2/3 dos anos positivos', `${yOk.filter(y => y.ret > 0).length}/${yOk.length}`, crit.c ? 'sim' : 'não'],
    ['d) queda máxima ≤ 10 %', pc(S.full.maxDD), crit.d ? 'sim' : 'não'],
    ['e) E2 (funding Hyperliquid) > 0 com p < 0,05', `${pc(S.hl.ann)}; p = ${pv(S.hl.pOne)}`, crit.e ? 'sim' : 'não'],
    ['f) nenhuma liquidação', String(liqs), crit.f ? 'sim' : 'não'],
    ['g) 10 mercados > 0', pc(S.rob.ann), crit.g ? 'sim' : 'não']])); out('');
  out(`**Resultado do Ciclo 4: ${pass ? 'CANDIDATA A PAPER/DEMO (passou todos os critérios em simulação histórica; não é garantia de lucro)' : 'não aprovada'}.**`); out('');
  if (pass) {
    const ann = Math.min(S.test.ann, S.hl.ann);
    out('### O que isto significaria em dinheiro (ilustração com o retorno anual mais baixo entre TEST e E2; simulado)'); out('');
    out(table(['capital', 'executável na Hyperliquid?', 'ganho anual esperado (simulado)'], [[ '10 USD', 'não (cada perna exige ordem ≥ 10 USD)', '—'], ['50 USD', 'à justa (3 mercados × ~11 USD por perna)', `${(50 * ann).toFixed(2)} USD`], ['1 000 USD', 'sim', `${(1000 * ann).toFixed(0)} USD`]])); out('');
  }
  out('# Contagens efetivas'); out(''); out(`- Regra de decisão: 1 (mais ${PRIOR} hipóteses anteriores no Holm). Diagnósticos: sempre ligado, 10 mercados, ${rowsS.length} combinações de limiares (não decidem).`); out(`- Tempo: ${((Date.now() - t00) / 60000).toFixed(1)} min.`);
  fs.writeFileSync(path.join(OUT, 'ciclo4.md'), buf.join('\n')); fs.writeFileSync(path.join(OUT, 'resumo.json'), JSON.stringify({ pass, crit, test: S.test.ann, hl: S.hl.ann }));
})().catch(e => { console.error('ERRO', e); process.exit(1); });
