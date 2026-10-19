// Macro Desk (grokbot/macro.js) corrido sem navegador: feed da Hyperliquid, sinais só em velas fechadas, custos e R registados.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ok = n => console.log('ok  ', n);
const read = p => fs.readFileSync(new URL('../../grokbot/' + p, import.meta.url), 'utf8');

function load({ search = '', store = {}, fetchImpl } = {}) {
  const ctx = { console, Date, Math, JSON, Promise, URLSearchParams, setTimeout, clearTimeout, setInterval() {}, Number, String, Array, Object, Set, Map, isFinite, parseFloat,
    document: { getElementById: () => null }, location: { search }, log() {},
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, fetch: fetchImpl || (async () => { throw new Error('rede indisponível'); }) };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('strategy.js'), ctx, { filename: 'strategy.js' }); vm.runInContext(read('macro.js'), ctx, { filename: 'macro.js' });
  return ctx;
}
const RES = 15 * 60e3, now0 = Date.now(), slot = Math.floor(now0 / RES) * RES;
// série com volatilidade suficiente para passar o filtro custo/risco (ATR ~1%); sobe devagar para dar tendência de alta
const series = (n, { endClosed = true, lastClose = null } = {}) => { const out = []; let c = 100; for (let i = 0; i < n; i++) { c *= 1 + 0.0004 + Math.sin(i * 1.7) * 0.003; out.push({ t: slot - (n - i) * RES, o: c, h: c * 1.006, l: c * 0.994, c }); } if (lastClose) out[out.length - 1] = { ...out[out.length - 1], c: lastClose, h: Math.max(lastClose, out[out.length - 1].h) }; return out; };

// M1 feed por omissão e opção
{
  assert.equal(load().MACRO.feed(), 'hl'); assert.equal(load({ search: '?feed=lighter' }).MACRO.feed(), 'lighter'); assert.equal(load({ store: { dollosFeedV1: 'lighter' } }).MACRO.feed(), 'lighter');
  assert.equal(load({ search: '?feed=hl', store: { dollosFeedV1: 'lighter' } }).MACRO.feed(), 'hl', 'o URL manda');
  ok('M1 o feed por omissão é a Hyperliquid (o mesmo mercado onde o worker executa)');
}
// M2 preços e velas da Hyperliquid, com os nomes dos mercados xyz
{
  const calls = [];
  const f = async (u, o) => { const b = JSON.parse(o.body); calls.push(b); const R = j => ({ ok: true, status: 200, json: async () => j });
    if (b.type === 'allMids') return R({ 'xyz:GOLD': '4400.5', 'xyz:SP500': '7600', 'xyz:EUR': '1.12', BTC: '1' });
    if (b.type === 'candleSnapshot') { const bars = series(210).map(x => ({ t: x.t, o: String(x.o), h: String(x.h), l: String(x.l), c: String(x.c) })); bars.push({ t: slot, o: '100', h: '101', l: '99', c: '100.5' }); return R(bars); } };
  const { MACRO: M } = load({ fetchImpl: f });
  await M.pollHLPrices(); assert.equal(M.P.GOLD.px, 4400.5); assert.equal(M.P.SPX.px, 7600); assert.equal(M.P.EURUSD.px, 1.12); assert.equal(M.P.GOLD.src, 'hl'); assert.equal(M.P.SPX.sym, 'xyz:SP500');
  assert.deepEqual(calls[0], { type: 'allMids', dex: 'xyz' });
  await M.pollHLCandles('GOLD'); assert.equal(M.P.GOLD.bars.length, 200); assert.equal(calls.at(-1).req.coin, 'xyz:GOLD'); assert.equal(calls.at(-1).req.interval, '15m');
  const cb = M.closedBars('GOLD'); assert.equal(cb.length, 199, 'a vela em formação fica de fora'); assert.ok(cb.at(-1).t + RES <= Date.now());
  ok('M2 preços (allMids xyz) e velas (candleSnapshot 15m) dos mercados xyz:GOLD, xyz:SP500 e xyz:EUR; a vela em formação é excluída');
}
// M3 [FALHAVA] o desk antigo decidia com a vela ainda aberta; agora o sinal só olha para velas fechadas
{
  const build = formingBar => {
    const { MACRO: M } = load(), bars = series(150), last = bars.at(-1);
    const spike = { t: formingBar ? slot : last.t + RES, o: last.c, h: last.c * 1.05, l: last.c, c: last.c * 1.05 };   // +5%: rompimento perfeito
    M.P.GOLD.bars = [...bars, spike]; M.P.GOLD.px = spike.c; M.P.GOLD.src = 'hl'; return M;
  };
  const f = build(true);   // o salto está na vela que ainda não fechou
  assert.ok(['long', 'short'].includes(f.signal(f.P.GOLD.bars).dir), 'controlo: com a vela aberta incluída (como antes) haveria entrada');
  f.onBar('GOLD'); assert.equal(f.state().pos.GOLD, undefined, 'agora a vela aberta não gera entrada'); assert.ok(!['long', 'short'].includes(f.P.GOLD.sig.dir));
  const c = build(false); c.P.GOLD.bars = c.P.GOLD.bars.map(b => ({ ...b, t: b.t - RES }));   // o mesmo salto numa vela já fechada
  c.onBar('GOLD'); assert.ok(['long', 'short'].includes(c.P.GOLD.sig.dir), 'a vela fechada é avaliada: ' + c.P.GOLD.sig.dir); assert.ok(c.state().pos.GOLD, 'e abre posição');
  ok('M3 o sinal ignora a vela em formação (o desk antigo decidia com ela) e usa-a quando fecha');
}
// M4 no arranque não decide sobre uma vela antiga; só decide quando fecha uma vela nova, e só uma vez
{
  const { MACRO: M } = load(); const bars0 = series(150).map(b => ({ ...b, t: b.t - RES })); M.P.GOLD.bars = bars0; M.P.GOLD.px = bars0.at(-1).c; M.P.GOLD.src = 'hl';
  const decisions = () => Object.values(M.state().sigStats.GOLD || {}).reduce((a, b) => a + b, 0);
  M.afterCandles('GOLD'); assert.equal(decisions(), 0, 'primeira leitura: não decide');
  M.P.GOLD.bars = [...bars0, { t: slot - RES, o: 100, h: 101, l: 99, c: 100 }];   // fechou uma vela nova
  M.afterCandles('GOLD'); assert.equal(decisions(), 1, 'a vela nova gera uma decisão'); M.afterCandles('GOLD'); assert.equal(decisions(), 1, 'a mesma vela não decide duas vezes');
  ok('M4 uma decisão por vela fechada, nunca no arranque nem repetida');
}
// M5 custos de entrada/saída, R e custos registados em cada trade (dados que faltavam)
{
  const { MACRO: M } = load(); M.reset(); const eq0 = M.equity();
  M.P.GOLD.px = 4000; M.P.GOLD.src = 'hl'; M.open('GOLD', 'long', { atr: 20, why: 'teste' });
  const p = M.state().pos.GOLD, C = M.CFG;
  const entry = 4000 * (1 + (C.costBps + C.slipBps) / 1e4); assert.ok(Math.abs(p.entry - entry) < 1e-9, 'entrada com taxa e slippage'); assert.ok(Math.abs(p.risk - eq0 * C.riskPct) / (eq0 * C.riskPct) < 1e-9 || p.notional >= eq0 * C.maxLev / 3 - 1, 'risco registado = 1% (ou limitado pela alavancagem)');
  const stopPx = p.stop - 1; M.setPrice('GOLD', stopPx); M.checkExits('GOLD');
  let t = M.state().trades.at(-1); assert.equal(t.why, 'stop-loss'); assert.ok(Math.abs(t.ex - stopPx * (1 - C.slipStopBps / 1e4)) < 1e-9, 'stop paga slippage de stop');
  assert.ok(t.risk > 0 && t.cost > 0, 'risk e cost gravados'); const R = t.pnl / t.risk; assert.ok(R < -1 && R > -1.4, 'perda de stop ~ -1 R mais custos: ' + R.toFixed(2));
  M.P.GOLD.px = 4000; M.open('GOLD', 'long', { atr: 20, why: 'teste' }); const q = M.state().pos.GOLD; M.setPrice('GOLD', q.tp + 1); M.checkExits('GOLD'); t = M.state().trades.at(-1);
  assert.equal(t.why, 'take-profit'); assert.ok(Math.abs(t.ex - (q.tp + 1)) < 1e-9, 'o alvo (ordem limitada) não paga slippage'); assert.ok(Math.abs(t.cost - t.nt * ((C.costBps + C.slipBps) / 1e4 + C.makerBps / 1e4)) < 1e-6, 'taxa maker no alvo');
  assert.deepEqual(JSON.parse(JSON.stringify(M.exitCost('time-stop'))), { fee: C.costBps / 1e4, slip: C.slipBps / 1e4 });
  ok('M5 trades com taxa+slippage na entrada, slippage de stop, taxa maker no alvo, e risk/custo gravados');
}
// M6 o filtro custo/risco chega ao desk (mesmas regras do backtest)
{
  const { MACRO: M } = load(), bars = series(150).map(b => ({ ...b, h: b.c * 1.0012, l: b.c * 0.9988 }));   // ATR ~0,2%: o custo de ida e volta valeria > 0,4 R
  const sg = M.signal(bars); assert.equal(sg.dir, 'flat'); assert.match(sg.why, /custo|volatilidade/);
  ok('M6 volatilidade baixa demais para os custos: o desk não entra');
}
console.log('macro ok');
