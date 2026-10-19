// Cloudflare Worker: proxy de holders (Helius) para o DOLLOS Trade Bot. A chave fica em env.HELIUS_API_KEY (segredo).
// GET /wallet?address=<carteira>  ->  { address, swaps:[{signature,timestamp,side,mint}] }  (trades que o bot pode copiar)
// GET /holders?mint=<mint solana>  ->  { topWallet, top10, mintAuthority, freezeAuthority, supply, excluded }
// /hl/*   ->  Hyperliquid (hl.mjs): GET /hl/state, POST /hl/sync {desired}, POST /hl/flatten   (ouro, S&P 500, EUR/USD)
// /sol/*  ->  Solana/Jupiter (sol.mjs): GET /sol/state, POST /sol/sync {desired:[mints]}, POST /sol/flatten   (memecoins)
//             ambos: simulação por omissão; só enviam ordens com HL_LIVE=1 / SOL_LIVE=1; exigem o cabeçalho X-Token = APP_TOKEN
// POST /hl/resume   retoma depois de uma paragem da proteção do servidor     POST /notify/test   envia uma notificação de teste
// GET /risk/state   estado do gestor de risco (paragens, falhas, aprovações, execuções)    POST /risk/panic   PARAGEM DE EMERGÊNCIA: fecha tudo nas duas plataformas
// POST /risk/resume   levanta a paragem global      GET /exec/log   últimas execuções reais (preço pretendido vs executado)
// Aprovação: POST /hl/sync só abre posições se a estratégia (strategy+iv) tiver uma aprovação válida do teste histórico (HL_REQUIRE_APPROVAL=0 só vale na rede de teste)
// cron (a cada 5 min): proteção do servidor (guard.mjs) e, se ligado, piloto automático (autopilot.mjs)
import { makeHL } from './hl.mjs';
import { makeSol } from './sol.mjs';
import { makeStore } from './store.mjs';
import { makeNotify, describe } from './notify.mjs';
import { runGuard, guardCfg, totalEquity } from './guard.mjs';
import { runAutopilot, autopilotCfg } from './autopilot.mjs';
import { recordExec, summarizeExec, EXEC_KEY } from './execlog.mjs';
import DS from '../grokbot/strategy.js';
export { Guard } from './store.mjs';
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SYSTEM = '11111111111111111111111111111111';
// Donos conhecidos de pools/curvas (não são carteiras de investidores): Raydium AMM v4 e CPMM, pump.fun curve/AMM
const KNOWN_POOL_OWNERS = new Set([
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
  'GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL',
  'CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM',
  'GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR',
]);

// Normaliza swaps da Helius Enhanced Transactions -> [{signature,timestamp,side:'buy'|'sell',mint}]
const BASE = new Set([
  'So11111111111111111111111111111111111111112',   // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',  // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',  // USDT
]);
export function parseSwaps(txs) {
  const out = [];
  for (const tx of txs || []) {
    const sw = tx?.events?.swap;
    if (!sw) continue;
    const ins = (sw.tokenInputs || []).map(t => t.mint);
    const outs = (sw.tokenOutputs || []).map(t => t.mint);
    if (sw.nativeInput) ins.push([...BASE][0]);
    if (sw.nativeOutput) outs.push([...BASE][0]);
    for (const m of outs) if (!BASE.has(m)) out.push({ signature: tx.signature, timestamp: tx.timestamp, side: 'buy', mint: m });
    for (const m of ins) if (!BASE.has(m)) out.push({ signature: tx.signature, timestamp: tx.timestamp, side: 'sell', mint: m });
  }
  return out;
}

export async function analyze(mint, rpc) {
  const [largest, mintInfo] = await rpc([
    ['getTokenLargestAccounts', [mint]],
    ['getAccountInfo', [mint, { encoding: 'jsonParsed' }]],
  ]);
  const mi = mintInfo?.value?.data?.parsed?.info;
  if (!mi) throw new Error('not a token mint');
  const supply = Number(mi.supply);
  const accts = largest.value || [];
  if (!supply || !accts.length) throw new Error('no holders');

  // dono de cada token account
  const [taRes] = await rpc([['getMultipleAccounts', [accts.map(a => a.address), { encoding: 'jsonParsed' }]]]);
  const owners = taRes.value.map(v => v?.data?.parsed?.info?.owner || null);
  // dono é carteira normal (conta System) ou PDA/programa (pool, curva, cofre)?
  const uniq = [...new Set(owners.filter(Boolean))];
  const [ownRes] = await rpc([['getMultipleAccounts', [uniq, { encoding: 'base64', dataSlice: { offset: 0, length: 0 } }]]]);
  const kind = new Map(uniq.map((o, i) => [o, ownRes.value[i]]));

  const rows = accts.map((a, i) => {
    const o = owners[i], acc = o ? kind.get(o) : null;
    const isPool = !o || KNOWN_POOL_OWNERS.has(o) || acc === null || acc.owner !== SYSTEM;
    return { owner: o, amount: Number(a.amount), isPool };
  });
  const holders = rows.filter(r => !r.isPool).sort((a, b) => b.amount - a.amount);
  const sum10 = holders.slice(0, 10).reduce((s, r) => s + r.amount, 0);
  return {
    topWallet: holders.length ? holders[0].amount / supply : 0,
    top10: sum10 / supply,
    mintAuthority: mi.mintAuthority || null,
    freezeAuthority: mi.freezeAuthority || null,
    supply: supply / 10 ** (mi.decimals || 0),
    excluded: rows.length - holders.length,
  };
}

// aprovação do teste histórico: a app envia {strategy, iv, approval}; o worker verifica os números e guarda (o prazo conta a partir do teste).
// Limitação: os números vêm da app (o worker não recalcula o teste: não cabe no tempo de CPU do plano grátis).
async function approvalFor(store, body, now = Date.now()) {
  const strategy = String(body.strategy || ''), iv = String(body.iv || ''), key = strategy + '|' + iv;
  const all = store ? (await store.get('approvals')) || {} : {};
  let a = all[key];
  const g = body.approval && typeof body.approval === 'object' ? { strategy, iv, at: +body.approval.at, n: +body.approval.n, avgR: +body.approval.avgR, pf: +body.approval.pf, tR: +body.approval.tR } : null;
  if (g && DS.approvalOk(g, strategy, iv, now) && (!a || g.at > a.at)) { a = g; if (store) { all[key] = a; await store.put('approvals', all); } }
  return { ok: DS.approvalOk(a, strategy, iv, now), strategy, iv, approval: a };
}
// regista as compras/vendas reais da Jupiter: base de custo exata (USDC gasto na cotação) e resultado realizado de cada venda
async function trackSol(store, res, now = Date.now()) {
  if (!store || !res || res.mode !== 'real') return;
  const e = (await store.get('solEntries')) || {};
  for (const x of res.results || []) {
    if (!x.ok || x.simulated) continue;
    if (x.op === 'buy') e[x.mint] = { t: now, usd: x.quote ? +(parseInt(x.quote.inAmount, 10) / 1e6).toFixed(4) : x.usd, tokens: x.quote && x.quote.outAmount };
    if (x.op === 'sell') { const b = e[x.mint]; if (b && b.usd > 0 && x.quote) x.pnlUsd = +(parseInt(x.quote.outAmount, 10) / 1e6 - b.usd).toFixed(4); delete e[x.mint]; }
  }
  await store.put('solEntries', e);
  await recordExec(store, 'sol', res, now);
}
// uma volta do cron: proteção primeiro (pode parar tudo), depois o piloto automático (se ligado)
export async function tick(env, { now = Date.now() } = {}) {
  const store = makeStore(env);
  if (!store) return { error: 'sem memória (ligação GUARD em falta no wrangler.toml)' };
  const notify = makeNotify(env);
  const hl = env.HL_AGENT_KEY && env.HL_ACCOUNT ? makeHL(env) : null, sol = env.SOL_KEY ? makeSol(env) : null;
  const g = await runGuard({ env, hl, sol, store, notify, now });
  if (hl && hl.live) { try { const fl = await hl.fills(200); await store.put('feeStats', { t: now, n: fl.n, takerBps: fl.takerBps, makerBps: fl.makerBps, nTaker: fl.nTaker, nMaker: fl.nMaker }); } catch (e) { /* só informativo */ } }   // taxas reais cobradas
  let ap = null;
  if (hl && !g.hl.error) {
    try {
      const rh = await store.get('riskHalt'), blockOpen = rh ? 'PARAGEM GLOBAL ativa' : g.hl.halted ? 'parado pela proteção do servidor' : null;
      if (await store.lock('lock:hl', 90000, now)) {
        try {
          ap = await runAutopilot({ env, hl, store, notify, now, st: g.hl.action ? null : g.hl.st, blockOpen });
          if (ap && ap.res) await recordExec(store, 'hl', ap.res, now);
        } finally { await store.unlock('lock:hl'); }
      } else ap = { skipped: 'ocupado: outra sincronização em curso' };
      const d = ap && ap.res && describe('Hyperliquid (piloto automático)', ap.res);
      if (d) await notify.send(d.title, d.message, d);
    } catch (e) { ap = { error: String(e.message || e) }; }
  }
  if (g.hl) delete g.hl.st;
  return { guard: g, autopilot: ap };
}

// comparação de palavras-passe em tempo constante (X-Token)
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(tick(env, { now: event.scheduledTime || Date.now() }).catch(() => {})); },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || ''),
      'Vary': 'Origin',
    };
    const json = (b, s = 200, extra = {}) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors, ...extra } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'X-Token, Content-Type' } });
    if (/^\/(hl|sol|notify|risk|exec)\//.test(url.pathname)) {
      if (allowed.length && !allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403);
      if (!env.APP_TOKEN) return json({ error: 'APP_TOKEN em falta no worker' }, 503);
      if (!safeEq(req.headers.get('x-token') || '', env.APP_TOKEN)) return json({ error: 'token inválido' }, 401);
      let body = {};
      if (req.method === 'POST') { try { const t = await req.text(); body = t ? JSON.parse(t) : {}; } catch (e) { return json({ error: 'json inválido' }, 400); } }
      try {
        const route = req.method + ' ' + url.pathname, ns = { 'cache-control': 'no-store' };
        const store = makeStore(env), notify = makeNotify(env), G = guardCfg(env);
        const tell = (desk, res) => { const d = describe(desk, res); if (d) ctx.waitUntil(notify.send(d.title, d.message, d)); return res; };
        const guardInfo = async () => store ? { on: true, last: await store.get('guardLast') } : { on: false };
        if (route === 'POST /notify/test') return json({ configured: notify.on, sent: await notify.send('DOLLOS · teste', 'As notificações do bot estão a funcionar.', { tags: ['white_check_mark'] }) }, 200, ns);
        const locked = async (name, fn, busy) => { if (!store) return fn(); if (!(await store.lock(name, 90000))) return busy; try { return await fn(); } finally { await store.unlock(name); } };
        const riskHalt = async () => (store && (await store.get('riskHalt'))) || null;
        if (route === 'GET /exec/log') { const log = store ? (await store.get(EXEC_KEY)) || [] : []; return json({ summary: summarizeExec(log), log: log.slice(-100) }, 200, ns); }
        if (route === 'GET /risk/state') {
          if (!store) return json({ on: false }, 200, ns);
          const log = (await store.get(EXEC_KEY)) || [], appr = (await store.get('approvals')) || {}, block = (await store.get('solBlock')) || {}, now = Date.now();
          return json({ on: true, notifyOn: notify.on, riskHalt: await riskHalt(), hlGuard: (await store.get('hlGuard')) || null, last: await store.get('guardLast'), fails: (await store.get('guardFails')) || { hl: 0, sol: 0 },
            solBlocked: Object.keys(block).filter(m => block[m] > now).length, exec: summarizeExec(log), feeStats: (await store.get('feeStats')) || null, approvals: Object.fromEntries(Object.entries(appr).map(([k, a]) => [k, { at: a.at, n: a.n, ok: DS.approvalOk(a, a.strategy, a.iv) }])) }, 200, ns);
        }
        if (route === 'POST /risk/panic') {   // paragem de emergência: bloqueia tudo e fecha tudo, nas duas plataformas
          if (!store) return json({ error: 'sem memória no worker' }, 503);
          const now = Date.now(), out = { ok: true }; await store.put('riskHalt', { t: now, why: 'manual' });
          if (env.HL_AGENT_KEY && env.HL_ACCOUNT) { try { out.hl = await makeHL(env).flatten(); await recordExec(store, 'hl', out.hl, now); } catch (e) { out.hlError = String(e.message || e); } }
          if (env.SOL_KEY) { try { out.sol = await makeSol(env).flatten(); await trackSol(store, out.sol, now); } catch (e) { out.solError = String(e.message || e); } }
          const bad = [out.hlError, out.solError, ...[out.hl, out.sol].flatMap(r => ((r && r.results) || []).filter(x => x.ok === false).map(x => x.error || 'falhou'))].filter(Boolean);
          await notify.send('DOLLOS · PARAGEM DE EMERGÊNCIA', 'Paragem global ativada: nada abre até tocares em RETOMAR TUDO. ' + (bad.length ? `Atenção, ${bad.length} ordem(ns) falharam: confirma nas corretoras.` : 'Fechei tudo.'), { priority: 5, tags: ['rotating_light'] });
          return json(out, 200, ns);
        }
        if (route === 'POST /risk/resume') { if (!store) return json({ error: 'sem memória no worker' }, 503); await store.del('riskHalt'); return json({ ok: true }, 200, ns); }
        if (url.pathname.startsWith('/hl/')) {
          const hl = makeHL(env), A = autopilotCfg(env);
          const hlGuard = async () => (store && (await store.get('hlGuard'))) || { peak: 0, halted: null };
          if (route === 'GET /hl/state') {
            const st = await hl.state(), gi = await guardInfo();
            const ap = A.on && store ? await store.get('autopilot') : null;
            gi.notifyOn = notify.on; gi.riskHalt = await riskHalt();
            const appr = store ? (await store.get('approvals')) || {} : {};
            return json({ ...st, guard: { ...gi, ...(await hlGuard()), dd: G.hlDD }, autopilot: { on: A.on, strategy: A.strategy, label: A.label, interval: A.iv, approved: DS.approvalOk(appr[A.strategy + '|' + A.iv], A.strategy, A.iv), last: ap && ap.last } }, 200, ns);
          }
          if (route === 'POST /hl/sync') {
            if (A.on) return json({ network: hl.network, mode: hl.live ? 'real' : 'simulacao', autopilot: true, plan: [], results: [], skipped: [{ market: 'todos', reason: 'piloto automático no servidor ligado: é o worker que decide' }] }, 200, ns);
            const g = await hlGuard(), now = Date.now();
            let blockOpen = (await riskHalt()) ? 'PARAGEM GLOBAL ativa (toca em RETOMAR TUDO)' : g.halted ? 'parado pela proteção do servidor (toca em RETOMAR)' : null;
            if (!blockOpen && DS.isScalp(String(body.strategy || ''), String(body.iv || ''))) blockOpen = 'scalping não é executado em real (o worker sincroniza de 30 s a 5 min; a ordem chegaria minutos depois do sinal)';
            if (!blockOpen && !(env.HL_REQUIRE_APPROVAL === '0' && hl.network === 'testnet')) {   // na rede real a aprovação é sempre obrigatória
              const ap = await approvalFor(store, body, now);
              if (!ap.ok) blockOpen = `sem aprovação válida do teste histórico para ${ap.strategy || '(estratégia não enviada)'} · ${ap.iv || '?'}`;
            }
            const busy = { network: hl.network, mode: hl.live ? 'real' : 'simulacao', plan: [], results: [], skipped: [{ market: 'todos', reason: 'sincronização em curso (outra app ou o servidor): tenta daqui a pouco' }] };
            const res = await locked('lock:hl', () => hl.sync(body.desired || {}, { blockOpen }), busy);
            if (store) await recordExec(store, 'hl', res, now);
            return json(tell('Hyperliquid', res), 200, ns);
          }
          if (route === 'POST /hl/candles') return json(await makeHL({ ...env, HL_NETWORK: 'mainnet', HL_LIVE: '0' }).candles(body.interval, body.days), 200, ns);   // só leitura, sempre na rede real
          if (route === 'GET /hl/fills') return json(await hl.fills(+url.searchParams.get('limit') || 100), 200, ns);
          if (route === 'POST /hl/flatten') { const res = await hl.flatten(); if (store) await recordExec(store, 'hl', res); return json(tell('Hyperliquid', res), 200, ns); }
          if (route === 'POST /hl/approve') {   // a app diz que uma estratégia passou o teste histórico (o worker verifica os números; o prazo conta desde o teste)
            if (!store) return json({ error: 'sem memória no worker' }, 503);
            const ap = await approvalFor(store, { strategy: body.strategy, iv: body.iv, approval: body });
            if (!ap.ok) return json({ error: 'os números não cumprem as exigências do teste (ou a data é inválida/expirada)' }, 400);
            return json({ ok: true, approval: ap.approval }, 200, ns);
          }
          if (route === 'POST /hl/resume') {
            if (!store) return json({ error: 'sem memória no worker' }, 503);
            const eq = totalEquity(await hl.state());
            await store.put('hlGuard', { peak: eq, halted: null });
            return json({ ok: true, peak: eq }, 200, ns);
          }
        } else if (url.pathname.startsWith('/sol/')) {
          const sol = makeSol(env), now = Date.now();
          if (route === 'GET /sol/state') {
            const st = await sol.state(), gi = await guardInfo();
            const block = store ? (await store.get('solBlock')) || {} : {};
            return json({ ...st, guard: { ...gi, sl: G.solSL, tp: G.solTP, maxHours: G.solMaxH, staleMin: G.solStaleMin, blocked: Object.keys(block).filter(m => block[m] > now).length } }, 200, ns);
          }
          const solBusy = { mode: sol.live ? 'real' : 'simulacao', plan: [], results: [], skipped: [{ mint: '*', reason: 'sincronização em curso (outra app ou o servidor): tenta daqui a pouco' }] };
          if (route === 'POST /sol/sync') {
            const blocked = store ? (await store.get('solBlock')) || {} : {};
            if (store) await store.put('solBeat', now);   // a app está viva
            const noBuy = (await riskHalt()) ? 'PARAGEM GLOBAL ativa (toca em RETOMAR TUDO)' : null;
            // uma sincronização de cada vez: duas ao mesmo tempo (dois aparelhos, ou a app e o servidor) comprariam duas vezes
            const res = await locked('lock:sol', async () => { const r = await sol.sync(Array.isArray(body.desired) ? body.desired : [], { blocked, now, noBuy }); await trackSol(store, r, now); return r; }, solBusy);
            return json(tell('Solana', res), 200, ns);
          }
          if (route === 'POST /sol/flatten') return json(tell('Solana', await locked('lock:sol', async () => { const r = await sol.flatten(); await trackSol(store, r, now); return r; }, solBusy)), 200, ns);
        }
        return json({ error: 'not found' }, 404);
      } catch (e) { return json({ error: String(e.message || e) }, 502); }
    }
    if (url.pathname !== '/holders' && url.pathname !== '/wallet') return json({ error: 'not found' }, 404);
    if (allowed.length && !allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403);
    if (url.pathname === '/wallet') {
      const address = url.searchParams.get('address') || '';
      if (!B58.test(address)) return json({ error: 'bad address' }, 400);
      if (!env.HELIUS_API_KEY) return json({ error: 'server not configured' }, 500);
      const ck = new Request(url.origin + '/wallet?address=' + address), c = caches.default;
      const h = await c.match(ck);
      if (h) return new Response(h.body, { headers: { 'content-type': 'application/json', ...cors, 'x-cache': 'HIT' } });
      try {
        const r = await fetch(`https://api.helius.xyz/v0/addresses/${address}/transactions?type=SWAP&limit=15&api-key=${env.HELIUS_API_KEY}`);
        if (!r.ok) throw new Error('helius ' + r.status);
        const body = JSON.stringify({ address, swaps: parseSwaps(await r.json()) });
        ctx.waitUntil(c.put(ck, new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=20' } })));
        return new Response(body, { headers: { 'content-type': 'application/json', ...cors, 'x-cache': 'MISS' } });
      } catch (e) { return json({ error: String(e.message || e) }, 502); }
    }
    const mint = url.searchParams.get('mint') || '';
    if (!B58.test(mint)) return json({ error: 'bad mint' }, 400);
    if (!env.HELIUS_API_KEY) return json({ error: 'server not configured' }, 500);

    const cache = caches.default, key = new Request(url.origin + '/holders?mint=' + mint);
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, { status: 200, headers: { 'content-type': 'application/json', ...cors, 'x-cache': 'HIT' } });

    const endpoint = 'https://mainnet.helius-rpc.com/?api-key=' + env.HELIUS_API_KEY;
    const rpc = async calls => {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(calls.map(([method, params], id) => ({ jsonrpc: '2.0', id, method, params }))) });
      if (!r.ok) throw new Error('helius ' + r.status);
      const out = await r.json();
      return out.sort((a, b) => a.id - b.id).map(o => { if (o.error) throw new Error(o.error.message); return o.result; });
    };
    try {
      const data = await analyze(mint, rpc);
      const body = JSON.stringify(data);
      ctx.waitUntil(cache.put(key, new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=300' } })));
      return new Response(body, { headers: { 'content-type': 'application/json', ...cors, 'x-cache': 'MISS' } });
    } catch (e) {
      return json({ error: String(e.message || e) }, 502);
    }
  },
};
