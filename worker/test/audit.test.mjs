// Testes da auditoria: cada bloco prova (ou refuta) uma suspeita levantada ao ler o código.
// Escritos ANTES das correções: os que falhavam no código antigo estão marcados com [FALHAVA].
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import worker from '../holders.mjs';
import { guardHL, guardSol, runGuard } from '../guard.mjs';
import { makeStore, fakeNamespace } from '../store.mjs';
import { makeHL } from '../hl.mjs';
const require = createRequire(import.meta.url);
const BT = require('../../grokbot/backtest.js'), DS = require('../../grokbot/strategy.js');
const ok = n => console.log('ok  ', n);
const store = () => makeStore({ GUARD: fakeNamespace() });
const notifier = () => { const sent = []; return { sent, on: true, send: async (t, m, o) => { sent.push({ t, m, o }); return true; } }; };
const MA = 'A'.repeat(43), MB = 'B'.repeat(43);

// ===== B1 [FALHAVA] a paragem de -20% dava a posição por fechada mesmo quando o fecho falhava =====
{
  const S = store(), N = notifier(); let flat = 0, i = 0, positions = [{ coin: 'xyz:GOLD', szi: 1 }];
  const eqs = [10, 7, 7, 7, 7, 7];
  const hl = { live: true, state: async () => ({ account: { xyz: eqs[Math.min(i++, eqs.length - 1)] }, positions: [...positions], markets: {} }),
    flatten: async () => { flat++; if (flat >= 3) positions = []; return { mode: 'real', results: [{ op: 'close', market: 'GOLD', ok: flat >= 3 }] }; } };
  for (let k = 0; k < 6; k++) await guardHL({ env: {}, hl, store: S, notify: N, now: Date.now() + k * 3e5 });
  assert.equal(positions.length, 0, 'a proteção tem de insistir até a posição estar mesmo fechada (tentativas: ' + flat + ')');
  assert.ok(N.sent.some(x => /não conseguiu fechar|FALHOU/i.test(x.t + x.m)), 'tem de avisar que o fecho falhou');
  ok('B1 paragem de -20%: insiste no fecho até a posição desaparecer e avisa das falhas');
}

// ===== B2 [FALHAVA] falhas de rede deixavam a proteção cega sem avisar =====
{
  const S = store(), N = notifier(); const hl = { live: true, state: async () => { throw new Error('hyperliquid info 429'); } };
  for (let k = 0; k < 4; k++) await runGuard({ env: {}, hl, sol: null, store: S, notify: N, now: 1e12 + k * 3e5 });
  assert.ok(N.sent.some(x => /sem dados/i.test(x.t)), 'após 3 falhas seguidas tem de avisar que a proteção está cega');
  const n = N.sent.length; await runGuard({ env: {}, hl, sol: null, store: S, notify: N, now: 1e12 + 5 * 3e5 }); assert.equal(N.sent.length, n, 'não repete o aviso a cada 5 min');
  ok('B2 falhas seguidas (3 × 5 min) geram um aviso, sem spam');
}

// ===== B3 [FALHAVA] posições já existentes na carteira eram vendidas pelo "alvo do servidor" =====
{
  const S = store(), N = notifier(), sold = [];
  const sol = { live: true, ticket: 2, state: async () => ({ tokens: [{ mint: MA, rawAmount: '1', amount: 1 }] }), valueOf: async () => 50,
    sellOne: async m => { sold.push(m); return { mode: 'real', results: [{ op: 'sell', mint: m, ok: true }] }; } };
  const now = Date.now(); await guardSol({ env: {}, sol, store: S, notify: N, now });
  assert.equal(sold.length, 0, 'um token sem entrada registada vale $50 e foi vendido como se tivesse subido 2400%');
  assert.equal((await S.get('solEntries'))[MA].usd, 50, 'adota o valor atual como base');
  ok('B3 token já existente: adota a base ao valor atual em vez de o vender como "alvo"');
}

// ===== B4 [FALHAVA] duas sincronizações simultâneas compravam duas vezes na Jupiter =====
{
  const ref = JSON.parse(fs.readFileSync(new URL('./fixtures/sol_ref.json', import.meta.url), 'utf8'));
  const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', tx = Buffer.from(ref.cases[0].tx, 'hex').toString('base64');
  const M1 = (await import('../sol.mjs')).b58encode(new Uint8Array(32).fill(21));
  let sent = 0; const prev = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => {
    const R = j => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
    if (String(u).includes('helius')) { const b = JSON.parse(o.body);
      if (b.method === 'getBalance') return R({ result: { value: 5e8 } });
      if (b.method === 'getTokenAccountsByOwner') { const kegs = b.params[1].programId.startsWith('Tokenkeg'); return R({ result: { value: kegs ? [{ account: { data: { parsed: { info: { mint: USDC, tokenAmount: { amount: '10000000', decimals: 6, uiAmountString: '10' } } } } } }] : [] } }); }
      if (b.method === 'sendTransaction') { sent++; return R({ result: 'sig' }); }
      if (b.method === 'getSignatureStatuses') return R({ result: { value: [{ confirmationStatus: 'confirmed', err: null }] } }); }
    if (String(u).includes('/quote')) { const q = new URL(u); return R({ inputMint: q.searchParams.get('inputMint'), outputMint: q.searchParams.get('outputMint'), inAmount: q.searchParams.get('amount'), outAmount: '12345', priceImpactPct: '0.001' }); }
    if (String(u).endsWith('/swap')) { await new Promise(r => setTimeout(r, 30)); return R({ swapTransaction: tx }); }
    throw new Error('fetch inesperado ' + u);
  };
  const env = { ALLOWED_ORIGIN: 'https://jbx19t.github.io', APP_TOKEN: 'segredo', SOL_KEY: ref.key64, HELIUS_API_KEY: 'k', SOL_LIVE: '1', GUARD: fakeNamespace() };
  const call = () => worker.fetch(new Request('https://w.example/sol/sync', { method: 'POST', headers: { Origin: 'https://jbx19t.github.io', 'x-token': 'segredo', 'content-type': 'application/json' }, body: JSON.stringify({ desired: [M1] }) }), env, { waitUntil() {} });
  const [a, b] = await Promise.all([call(), call()]);
  globalThis.fetch = prev;
  assert.equal(sent, 1, 'duas sincronizações ao mesmo tempo enviaram ' + sent + ' compras');
  const jb = [await a.json(), await b.json()]; assert.ok(jb.some(j => (j.skipped || []).some(s => /em curso/.test(s.reason))), 'a segunda é recusada com motivo');
  ok('B4 sincronizações simultâneas: só uma compra é enviada');
}

// ===== B5 [FALHAVA] a trava de aprovação só existia na app (um cliente antigo ignorava-a) =====
{
  const prev = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => { const b = o.body ? JSON.parse(o.body) : {}, R = j => ({ ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) });
    if (b.type === 'perpDexs') return R([null, { name: 'xyz' }]);
    if (b.type === 'meta') return R({ universe: b.dex === 'xyz' ? [{ name: 'xyz:GOLD', szDecimals: 4, maxLeverage: 10 }] : [] });
    if (b.type === 'allMids') return R(b.dex === 'xyz' ? { 'xyz:GOLD': '4000' } : {});
    if (b.type === 'clearinghouseState') return R({ marginSummary: { accountValue: '50' }, assetPositions: [] });
    if (b.type === 'openOrders' || b.type === 'frontendOpenOrders') return R([]);
    throw new Error('fetch inesperado ' + u); };
  const env = { ALLOWED_ORIGIN: 'https://jbx19t.github.io', APP_TOKEN: 'segredo', HL_AGENT_KEY: '0x' + '22'.repeat(32), HL_ACCOUNT: '0x' + '33'.repeat(20), GUARD: fakeNamespace() };
  const sync = body => worker.fetch(new Request('https://w.example/hl/sync', { method: 'POST', headers: { Origin: 'https://jbx19t.github.io', 'x-token': 'segredo', 'content-type': 'application/json' }, body: JSON.stringify(body) }), env, { waitUntil() {} }).then(r => r.json());
  const want = { GOLD: { side: 'long', frac: 0.5, slPct: 0.01, tpPct: 0.015 } };
  let j = await sync({ desired: want });
  assert.equal(j.plan.filter(p => p.op === 'open').length, 0, 'sem aprovação não pode planear aberturas'); assert.match(JSON.stringify(j.skipped), /aprova/i);
  const good = { strategy: 'trail', iv: '4h', at: Date.now() - 1000, n: 40, avgR: .2, pf: 1.3, tR: 2.4 };
  j = await sync({ desired: want, strategy: 'trail', iv: '4h', approval: good }); assert.equal(j.plan.filter(p => p.op === 'open').length, 1, 'com aprovação válida abre');
  j = await sync({ desired: want, strategy: 'trail', iv: '4h', approval: { ...good, n: 5 } }); assert.equal(j.plan.filter(p => p.op === 'open').length, 1, 'a aprovação válida já guardada continua a valer');
  j = await sync({ desired: want, strategy: 'breakout', iv: '15m' }); assert.equal(j.plan.filter(p => p.op === 'open').length, 0, 'outra estratégia continua bloqueada');
  globalThis.fetch = prev;
  ok('B5 o worker recusa aberturas sem aprovação válida (não depende só da app)');
}

// ===== B6 (verificação) o tamanho real da posição respeita o risco pretendido em todos os casos =====
{
  const sim = (eq) => { const f = async (url, o) => { const b = JSON.parse(o.body), R = j => ({ ok: true, status: 200, text: async () => JSON.stringify(j), json: async () => j });
    if (b.type === 'perpDexs') return R([null, { name: 'xyz' }]); if (b.type === 'meta') return R({ universe: b.dex === 'xyz' ? [{ name: 'xyz:GOLD', szDecimals: 4, maxLeverage: 10 }] : [] });
    if (b.type === 'allMids') return R(b.dex === 'xyz' ? { 'xyz:GOLD': '4000' } : {}); if (b.type === 'clearinghouseState') return R({ marginSummary: { accountValue: String(eq) }, assetPositions: [] });
    return R([]); }; return f; };
  const st = DS.make({ ...DS.DEFAULTS, minATRpct: 0 }, 3); let worst = 0, opened = 0, skipped = 0;
  for (const eq of [10, 25, 50, 100, 300, 1000]) for (const stopPct of [0.004, 0.008, 0.015, 0.03, 0.06]) {
    const frac = st.sizeFor(1, 1, stopPct);   // fração do saldo do desk (por unidade de saldo)
    const hl = makeHL({ HL_AGENT_KEY: '0x' + '22'.repeat(32), HL_ACCOUNT: '0x' + '33'.repeat(20), HL_MAX_ORDER_USD: '1e9', HL_MAX_GROSS_USD: '1e9' }, sim(eq));
    const r = await hl.sync({ GOLD: { side: 'long', frac, slPct: stopPct, tpPct: stopPct * 1.5 } });
    const p = r.plan.find(x => x.op === 'open'); if (!p) { skipped++; continue; } opened++;
    const risk = p.usd * stopPct / eq; worst = Math.max(worst, risk);
    assert.ok(risk <= DS.DEFAULTS.riskPct * 1.02, `risco real ${(risk * 100).toFixed(2)}% > 1% (equity ${eq}, stop ${stopPct})`);
    assert.ok(p.usd / eq <= 3 * 0.9 + 1e-9, 'nunca acima de 2,7× o saldo');
  }
  assert.ok(opened > 10 && skipped > 0, 'abre quando há tamanho e recusa quando fica abaixo do mínimo de $10');
  ok(`B6 tamanho: risco real máximo ${(worst * 100).toFixed(2)}% do saldo (pretendido 1%); ${opened} casos abertos, ${skipped} recusados por mínimo`);
}

// ===== B9 [FALHAVA] se a corretora não devolver os campos esperados, o worker empilhava stops a cada sincronização =====
{
  const orders = []; let posted = 0;
  const f = async (url, o) => { const b = JSON.parse(o.body), R = j => ({ ok: true, status: 200, text: async () => JSON.stringify(j), json: async () => j });
    if (url.endsWith('/info')) {
      if (b.type === 'perpDexs') return R([null, { name: 'xyz' }]); if (b.type === 'meta') return R({ universe: b.dex === 'xyz' ? [{ name: 'xyz:GOLD', szDecimals: 4, maxLeverage: 10 }] : [] });
      if (b.type === 'allMids') return R(b.dex === 'xyz' ? { 'xyz:GOLD': '4000' } : {});
      if (b.type === 'clearinghouseState') return R({ marginSummary: { accountValue: '100' }, assetPositions: [{ position: { coin: 'xyz:GOLD', szi: '0.003', entryPx: '4000', unrealizedPnl: '0' } }] });
      return R(orders.map(x => ({ coin: x.coin, oid: x.oid, reduceOnly: true })));   // resposta SEM isTrigger/orderType/triggerPx
    }
    const a = b.action; if (a.type === 'order') { posted++; a.orders.forEach(() => orders.push({ coin: 'xyz:GOLD', oid: 100 + orders.length })); return R({ status: 'ok', response: { data: { statuses: a.orders.map(() => ({ resting: { oid: 1 } })) } } }); }
    return R({ status: 'ok', response: { data: { statuses: [] } } }); };
  const hl = makeHL({ HL_AGENT_KEY: '0x' + '22'.repeat(32), HL_ACCOUNT: '0x' + '33'.repeat(20), HL_LIVE: '1' }, f);
  for (let k = 0; k < 6; k++) await hl.sync({ GOLD: { side: 'long', frac: 0, slPct: 0.01 } });
  assert.ok(orders.length <= 3, `${orders.length} ordens empilhadas em 6 sincronizações`);
  ok('B9 campos em falta na resposta da corretora: no máximo 3 ordens de proteção, nunca uma por sincronização');
}

// ===== backtest: fidelidade com a execução real =====
const cfg = { start: 10000, riskPct: .01, maxLev: 5, fast: 3, slow: 6, brk: 3, atrN: 3, stopATR: 2, tpATR: 3, maxHoldBars: 10, costBps: 0, ddStop: .5, dayLoss: .5, maxATRpct: .03, minATRpct: 0 };
const T0 = Date.UTC(2026, 0, 5), H = 36e5;
const flat = (n, t0 = 0) => Array.from({ length: n }, (_, i) => ({ t: T0 + (t0 + i) * H, o: 100, h: 100.1, l: 99.9, c: 100 }));
const bar = (i, o, h, l, c) => ({ t: T0 + i * H, o, h, l, c });
{ // [FALHAVA] entrava ao fecho da própria vela que gerou o sinal
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101.5, 103.5, 101.4, 103), ...flat(4, 22).map(b => ({ ...b, o: 103, h: 103.1, l: 102.9, c: 103 }))];
  const t = BT.simulate({ GOLD: bars }, cfg).trades[0];
  assert.ok(Math.abs(t.en - 101.5) < 1e-9, 'o sinal fecha a 101 mas a ordem só pode ser enviada depois: entrada à abertura seguinte (101,5), não ' + t.en);
  const s = BT.simulate({ GOLD: bars }, { ...cfg, slipBps: 10 }).trades[0]; assert.ok(Math.abs(s.en - 101.5 * 1.001) < 1e-9, 'slippage de 10 bps na entrada');
  ok('Bt1 entrada à abertura da vela seguinte + slippage explícito');
}
{ // [FALHAVA] o alvo é uma ordem limitada na corretora (maker), mas o backtest cobrava taxa de mercado
  const bars = [...flat(20), bar(20, 100, 101.2, 100, 101), bar(21, 101, 102.9, 100.95, 102.8), ...flat(4, 22).map(b => ({ ...b, o: 102.8, h: 102.9, l: 102.7, c: 102.8 }))];
  const t = BT.simulate({ GOLD: bars }, { ...cfg, costBps: 9, makerBps: 3 }).trades[0];
  assert.equal(t.why, 'take-profit'); assert.ok(Math.abs(t.fees - t.nt * (0.0009 + 0.0003)) < 1e-6, 'entrada taker 9 bps + alvo maker 3 bps; fees=' + t.fees / t.nt);
  const m = BT.simulate({ GOLD: bars }, { ...cfg, costBps: 9, makerBps: 3, tpMode: 'market' }).trades[0]; assert.ok(Math.abs(m.fees - m.nt * 0.0018) < 1e-6, 'HL_TP_TRIGGER=1: alvo a mercado paga taxa taker');
  ok('Bt2 alvo como ordem limitada paga taxa maker (como na execução), alvo a mercado paga taker');
}
{ // [FALHAVA] o filtro deixava entrar com custos de 0,5 R (ATR >= 2× custo olha para o alvo, não para o risco)
  const st = DS.make({ ...DS.DEFAULTS }, 3), bars = Array.from({ length: 140 }, (_, i) => { const c = 100 * (1 + 0.002 * i) * (i === 139 ? 1.006 : 1); return { t: T0 + i * H, o: i ? 100 * (1 + 0.002 * (i - 1)) : 100, h: c * 1.002, l: c * 0.998, c }; });
  const a = st.atr(bars, 14) / bars[139].c; assert.ok(a > 0.0018, 'ATR=' + a + ' passa no filtro antigo');
  const sg = st.signal(bars); assert.equal(sg.dir, 'flat', 'com ATR de ' + (a * 100).toFixed(2) + '% o custo de ida e volta (0,18%) é ' + (0.0018 / (2 * a)).toFixed(2) + ' R: não entra'); assert.match(sg.why, /custo/i);
  ok('Bt3 filtro por custo/risco: não abre trades em que o custo de ida e volta passa de 0,15 R');
}

console.log('auditoria ok');
