import assert from 'node:assert/strict';
import { guardHL, guardSol, runGuard } from '../guard.mjs';
import { runAutopilot } from '../autopilot.mjs';
import { makeStore, fakeNamespace } from '../store.mjs';
import { describe as describeRes, makeNotify } from '../notify.mjs';

const store = () => makeStore({ GUARD: fakeNamespace() });
const notifier = () => { const sent = []; return { sent, on: true, send: async (t, m, o) => { sent.push({ t, m, o }); return true; } }; };

// ---- Hyperliquid: paragem de -20% desde o máximo ----
function fakeHL(eqs, { live = true, positions = [{ coin: 'xyz:GOLD', szi: 1 }], candles = null } = {}) {
  let i = 0; const H = { flat: 0, syncs: [], positions };
  H.hl = { live, network: 'testnet',
    state: async () => ({ account: { main: 1, xyz: eqs[Math.min(i++, eqs.length - 1)] }, positions: H.positions, markets: { GOLD: { coin: 'xyz:GOLD' }, SPX: { coin: 'xyz:SP500' }, EURUSD: null } }),
    flatten: async () => { H.flat++; if (live) H.positions = []; return { mode: live ? 'real' : 'simulacao', results: [] }; },   // em modo real o fecho funciona: a posição desaparece
    candles: async () => candles,
    sync: async (d, o) => { H.syncs.push({ d, o }); const plan = Object.entries(d).filter(([k]) => !H.positions.some(p => p.coin === 'xyz:' + (k === 'SPX' ? 'SP500' : k))).map(([k, w]) => ({ op: 'open', market: k, side: w.side === 'long' ? 'buy' : 'sell', usd: 10, sl: 1, tp: 2 }));
      return { mode: live ? 'real' : 'simulacao', plan, results: live ? plan.map(p => ({ op: 'open', market: p.market, ok: true })) : [], skipped: [] }; } };
  return H;
}
{
  const S = store(), N = notifier(), H = fakeHL([9, 11, 9.8, 8.6, 5, 20]);   // total = xyz + 1 do principal
  const run = () => guardHL({ env: {}, hl: H.hl, store: S, notify: N });
  let r = await run(); assert.equal(r.peak, 10);
  r = await run(); assert.equal(r.peak, 12);
  r = await run(); assert.ok(!r.halted, '-9%: ainda não');
  r = await run(); assert.ok(r.halted, '9,6 = 12 × 0,8: para'); assert.equal(H.flat, 1); assert.equal(r.action, 'flatten');
  assert.equal(N.sent.length, 1); assert.equal(N.sent[0].o.priority, 5); assert.match(N.sent[0].m, /Fechei todas/);
  r = await run(); r = await run(); assert.equal(H.flat, 1, 'parado: não volta a fechar nem a avisar'); assert.equal(N.sent.length, 1); assert.equal(r.peak, 12, 'máximo não sobe enquanto parado');
  console.log('ok   1 Hyperliquid: -20% desde o máximo fecha tudo uma vez, avisa e fica parado');
}
{
  const S = store(), N = notifier(), H = fakeHL([10, 7], { live: false });
  await guardHL({ env: { HL_GUARD_DD: '0.25' }, hl: H.hl, store: S, notify: N }); const r = await guardHL({ env: { HL_GUARD_DD: '0.25' }, hl: H.hl, store: S, notify: N });
  assert.ok(r.halted); assert.match(N.sent[0].m, /Simulação/); console.log('ok   2 simulação: só avisa; limite configurável (HL_GUARD_DD)');
}
{
  const S = store(), N = notifier(), H = fakeHL([0, 0, 0]);
  await guardHL({ env: {}, hl: H.hl, store: S, notify: N }); const r = await guardHL({ env: {}, hl: H.hl, store: S, notify: N });
  assert.ok(!r.halted); assert.equal(H.flat, 0); console.log('ok   3 conta só com $1 no principal: sem falsos alarmes');
}

// ---- Solana: stops/alvos/tempo/app sem contacto ----
const MA = 'A'.repeat(43), MB = 'B'.repeat(43), MC = 'C'.repeat(43);
function fakeSol(tokens, values, { live = true, fail = {} } = {}) {
  const F = { sold: [] };
  F.sol = { live, ticket: 2,
    state: async () => ({ tokens: tokens.filter(t => !F.sold.includes(t.mint) || !live).map(t => ({ ...t, rawAmount: '1', amount: 1 })) }),
    valueOf: async m => values[m] ?? null,
    sellOne: async m => { if (live && !fail[m]) F.sold.push(m); return { mode: live ? 'real' : 'simulacao', results: [{ op: 'sell', mint: m, ok: !fail[m], error: fail[m] }] }; } };
  return F;
}
{
  const S = store(), N = notifier(), now = Date.now();
  await S.put('solEntries', { [MA]: { t: now - 36e5, usd: 2 }, [MB]: { t: now - 36e5, usd: 2 }, [MC]: { t: now - 7 * 36e5, usd: 2 } });
  await S.put('solBeat', now - 60e3);
  const F = fakeSol([{ mint: MA }, { mint: MB }, { mint: MC }], { [MA]: 1.3, [MB]: 4.5, [MC]: 2.1 });
  const r = await guardSol({ env: {}, sol: F.sol, store: S, notify: N, now });
  assert.deepEqual(r.actions.map(a => a.mint).sort(), [MA, MB, MC].sort());
  assert.match(r.actions.find(a => a.mint === MA).why, /stop do servidor/); assert.match(r.actions.find(a => a.mint === MB).why, /alvo/); assert.match(r.actions.find(a => a.mint === MC).why, /mais de 6 h/);
  const b = await S.get('solBlock'); assert.ok(b[MA] > now + 5 * 36e5, 'bloqueada 6 h'); assert.equal(Object.keys(await S.get('solEntries')).length, 0);
  assert.equal(N.sent.length, 3); assert.match(N.sent[0].m, /VENDI/);
  console.log('ok   4 Solana: -30% vende, +100% vende, 6 h vende; bloqueia recompra 6 h');
}
{
  const S = store(), N = notifier(), now = Date.now();
  await S.put('solEntries', { [MA]: { t: now - 60e3, usd: 2 } }); await S.put('solBeat', now - 31 * 60e3);
  const F = fakeSol([{ mint: MA }, { mint: MB }], { [MA]: 2, [MB]: 2 });
  const r = await guardSol({ env: {}, sol: F.sol, store: S, notify: N, now });
  assert.equal(r.stale, true); assert.equal(r.actions.length, 2); assert.match(r.actions[0].why, /não sincroniza há 31 min/);
  const r0 = await guardSol({ env: { SOL_STALE_MIN: '0' }, sol: fakeSol([{ mint: MC }], { [MC]: 2 }).sol, store: S, notify: N, now });
  assert.equal(r0.actions.length, 0); console.log('ok   5 app sem sincronizar há 30+ min: vende tudo (SOL_STALE_MIN=0 desliga); sem entrada usa o ticket');
}
{
  const S = store(), N = notifier(), now = Date.now();
  const F = fakeSol([{ mint: MA }], { [MA]: 1 }, { live: false });
  await S.put('solEntries', { [MA]: { t: now - 1000, usd: 2 } });   // entrada registada ($2): agora vale $1 (-50%)
  await guardSol({ env: {}, sol: F.sol, store: S, notify: N, now }); await guardSol({ env: {}, sol: F.sol, store: S, notify: N, now: now + 5 * 60e3 });
  assert.equal(N.sent.length, 1, 'simulação avisa uma vez'); assert.match(N.sent[0].m, /Simulação: venderia/);
  await S.put('solEntries', { [MA]: { t: now - 1000, usd: 2 }, [MB]: { t: now - 1000, usd: 2 } });
  const F2 = fakeSol([{ mint: MB }], { [MB]: 1 }, { fail: { [MB]: 'sem rota' } }); const r = await guardSol({ env: {}, sol: F2.sol, store: S, notify: N, now });
  assert.equal(r.actions[0].ok, false); assert.equal(N.sent.at(-1).o.priority, 5); console.log('ok   6 simulação avisa uma vez; venda falhada avisa com prioridade máxima');
}
{
  const S = store(), N = notifier();
  const r = await runGuard({ env: {}, hl: null, sol: null, store: S, notify: N });
  assert.match(r.hl.skipped, /não configurada/); const last = await S.get('guardLast'); assert.ok(last.t > 0);
  const bad = { live: true, state: async () => { throw new Error('rpc caiu'); } };
  const r2 = await runGuard({ env: {}, hl: null, sol: bad, store: S, notify: N }); assert.match(r2.sol.error, /rpc caiu/);
  console.log('ok   7 sem nada configurado não faz nada; erros ficam registados sem parar o resto');
}

// ---- piloto automático ----
const T = 9e5, now = Date.UTC(2026, 9, 18, 12, 1);   // 1 min depois do fecho de uma vela de 15 min
function series(n, f) { const out = []; const t0 = Math.floor(now / T) * T - n * T; for (let i = 0; i < n; i++) { const c = f(i); out.push([t0 + i * T, c, c * 1.006, c * 0.994, c, 1]); } return out; }
{
  // tendência de alta e rompimento na última vela fechada; a vela em formação (t >= now - T) é ignorada
  const up = series(120, i => (i < 119 ? 4000 + i * 0.5 + Math.sin(i) * 2 : 4100));
  up.push([Math.floor(now / T) * T, 3000, 3000, 3000, 3000, 1]);   // vela ainda aberta: absurda de propósito
  const H = fakeHL([100], { positions: [], candles: { markets: { GOLD: { coin: 'xyz:GOLD', bars: up }, SPX: { coin: 'xyz:SP500', bars: series(120, () => 7000) } } } });
  const S = store(), N = notifier(), env = { HL_AUTOPILOT: '1' };
  const r = await runAutopilot({ env, hl: H.hl, store: S, notify: N, now });
  assert.equal(r.desired.GOLD.side, 'long'); assert.ok(r.desired.GOLD.frac > 0 && r.desired.GOLD.slPct > 0 && r.desired.GOLD.tpPct > r.desired.GOLD.slPct);
  assert.ok(!r.desired.SPX, 'S&P sem sinal'); assert.ok(r.notes.EURUSD, 'EUR/USD sem mercado: nota');
  const r2 = await runAutopilot({ env, hl: H.hl, store: S, notify: N, now: now + 60e3 });
  assert.deepEqual(r2.desired, {}, 'a mesma vela não é avaliada duas vezes');
  assert.deepEqual(await runAutopilot({ env, hl: H.hl, store: S, notify: N, now: now + 8 * 60e3 }), { waiting: true });
  assert.equal(await runAutopilot({ env: {}, hl: H.hl, store: S, notify: N, now }), null, 'desligado por omissão');
  console.log('ok   8 piloto: rompimento -> LONG ouro com stop/alvo; ignora a vela aberta; não repete; só decide depois do fecho; desligado por omissão');
  // em posição: mantém; passado o limite de 96 velas fecha (fica fora do desejado)
  H.positions = [{ coin: 'xyz:GOLD', szi: 0.01 }];
  const ap = await S.get('autopilot'); ap.opened.GOLD = Math.floor(now / T) * T - 50 * T; await S.put('autopilot', ap);
  let r3 = await runAutopilot({ env, hl: H.hl, store: S, notify: N, now: now + T });
  assert.equal(r3.desired.GOLD.side, 'long'); assert.equal(r3.desired.GOLD.frac, 0);
  ap.opened.GOLD = Math.floor(now / T) * T - 200 * T; await S.put('autopilot', { ...(await S.get('autopilot')), opened: ap.opened });
  r3 = await runAutopilot({ env, hl: H.hl, store: S, notify: N, now: now + 2 * T });
  assert.ok(!r3.desired.GOLD, 'limite de tempo: fecha'); assert.match(r3.notes.GOLD, /limite/);
  await runAutopilot({ env, hl: H.hl, store: S, notify: N, now: now + 3 * T, blockOpen: 'parado' });
  assert.equal(H.syncs.at(-1).o.blockOpen, 'parado');
  console.log('ok   9 piloto: mantém a posição, fecha no limite de tempo, respeita a paragem da proteção');
}
{
  const H = fakeHL([100], { live: false, positions: [], candles: { markets: { GOLD: { coin: 'xyz:GOLD', bars: series(120, i => (i < 119 ? 4000 + i * 0.5 + Math.sin(i) * 2 : 4100)) } } } });
  const N = notifier(); await runAutopilot({ env: { HL_AUTOPILOT: '1', HL_STRATEGY: 'trend', HL_INTERVAL: '1h' }, hl: H.hl, store: store(), notify: N, now, force: true });
  const N2 = notifier(); const r = await runAutopilot({ env: { HL_AUTOPILOT: '1' }, hl: H.hl, store: store(), notify: N2, now });
  assert.ok(r.desired.GOLD); assert.match(N2.sent[0].m, /Abriria LONG GOLD/); console.log('ok   10 simulação do piloto avisa o que abriria; aceita outra estratégia e velas');
}

// ---- notificações ----
{
  const calls = []; const f = async (u, o) => { calls.push({ u, b: JSON.parse(o.body) }); return { ok: true }; };
  assert.equal(makeNotify({}, f).on, false); assert.equal(await makeNotify({}, f).send('a', 'b'), false); assert.equal(makeNotify({ NTFY_TOPIC: 'curto' }, f).on, false);
  const n = makeNotify({ NTFY_TOPIC: 'dollos-abc12345' }, f); assert.equal(await n.send('Título ç', 'olá'), true);
  assert.equal(calls[0].u, 'https://ntfy.sh/'); assert.equal(calls[0].b.topic, 'dollos-abc12345'); assert.equal(calls[0].b.title, 'Título ç');
  assert.equal(describeRes('X', { mode: 'simulacao', results: [{ op: 'open', ok: true }] }), null);
  const d = describeRes('Solana', { mode: 'real', results: [{ op: 'buy', mint: MA, ok: true, usd: 2 }, { op: 'sell', mint: MB, ok: false, error: 'sem rota' }] });
  assert.match(d.message, /COMPROU AAAA…AAAA \$2/); assert.match(d.message, /FALHOU sell/); assert.equal(d.priority, 4);
  console.log('ok   11 notificações: só com tópico válido; JSON em UTF-8; resumo só de ordens reais');
}
// ---- trava do piloto: sem aprovação não abre; com aprovação abre; stop móvel nas posições ----
{
  const up = series(120, i => (i < 119 ? 4000 + i * 0.5 + Math.sin(i) * 2 : 4100));
  const mk = () => fakeHL([100], { positions: [], candles: { markets: { GOLD: { coin: 'xyz:GOLD', bars: up } } } });
  let H = mk(), S = store(); const env = { HL_AUTOPILOT: '1' };
  let r = await runAutopilot({ env, hl: H.hl, store: S, notify: notifier(), now });
  assert.equal(r.approved, false); assert.match(H.syncs[0].o.blockOpen, /sem aprovação/);
  H = mk(); S = store();
  await S.put('approvals', { 'breakout|15m': { strategy: 'breakout', iv: '15m', at: now - 864e5, n: 35, avgR: .15, pf: 1.25, tR: 3.0 } });
  r = await runAutopilot({ env, hl: H.hl, store: S, notify: notifier(), now });
  assert.equal(r.approved, true); assert.equal(H.syncs[0].o.blockOpen, null);
  console.log('ok   12 piloto: sem aprovação do teste não abre nada; com aprovação abre');
  // stop móvel: estratégia trail, posição longa aberta há 50 velas -> slPx = máximo desde a entrada - 3×ATR
  H = mk(); S = store(); H.positions = [{ coin: 'xyz:GOLD', szi: 0.01 }];
  const t0 = up[up.length - 50][0];
  await S.put('autopilot', { lastBar: {}, opened: { GOLD: t0 }, atr: { GOLD: 10 } });
  r = await runAutopilot({ env: { HL_AUTOPILOT: '1', HL_STRATEGY: 'trail' }, hl: H.hl, store: S, notify: notifier(), now });
  const hi = Math.max(...up.filter(b => b[0] >= t0).map(b => b[2]));
  assert.ok(Math.abs(r.desired.GOLD.slPx - (hi - 30)) < 0.01, r.desired.GOLD.slPx + ' vs ' + (hi - 30));
  console.log('ok   13 piloto com stop móvel envia o stop novo (máximo ' + hi.toFixed(1) + ' - 3×ATR)');
}
console.log('guard ok');
