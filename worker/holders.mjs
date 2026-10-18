// Cloudflare Worker: proxy de holders (Helius) para o DOLLOS Trade Bot. A chave fica em env.HELIUS_API_KEY (segredo).
// GET /wallet?address=<carteira>  ->  { address, swaps:[{signature,timestamp,side,mint}] }  (trades que o bot pode copiar)
// GET /holders?mint=<mint solana>  ->  { topWallet, top10, mintAuthority, freezeAuthority, supply, excluded }
// /hl/*   ->  Hyperliquid (hl.mjs): GET /hl/state, POST /hl/sync {desired}, POST /hl/flatten   (ouro, S&P 500, EUR/USD)
// /sol/*  ->  Solana/Jupiter (sol.mjs): GET /sol/state, POST /sol/sync {desired:[mints]}, POST /sol/flatten   (memecoins)
//             ambos: simulação por omissão; só enviam ordens com HL_LIVE=1 / SOL_LIVE=1; exigem o cabeçalho X-Token = APP_TOKEN
// POST /hl/resume   retoma depois de uma paragem da proteção do servidor     POST /notify/test   envia uma notificação de teste
// cron (a cada 5 min): proteção do servidor (guard.mjs) e, se ligado, piloto automático (autopilot.mjs)
import { makeHL } from './hl.mjs';
import { makeSol } from './sol.mjs';
import { makeStore } from './store.mjs';
import { makeNotify, describe } from './notify.mjs';
import { runGuard, guardCfg, totalEquity } from './guard.mjs';
import { runAutopilot, autopilotCfg } from './autopilot.mjs';
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

// uma volta do cron: proteção primeiro (pode parar tudo), depois o piloto automático (se ligado)
export async function tick(env, { now = Date.now() } = {}) {
  const store = makeStore(env);
  if (!store) return { error: 'sem memória (ligação GUARD em falta no wrangler.toml)' };
  const notify = makeNotify(env);
  const hl = env.HL_AGENT_KEY && env.HL_ACCOUNT ? makeHL(env) : null, sol = env.SOL_KEY ? makeSol(env) : null;
  const g = await runGuard({ env, hl, sol, store, notify, now });
  let ap = null;
  if (hl && !g.hl.error) {
    try {
      ap = await runAutopilot({ env, hl, store, notify, now, st: g.hl.action ? null : g.hl.st, blockOpen: g.hl.halted ? 'parado pela proteção do servidor' : null });
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
    if (url.pathname.startsWith('/hl/') || url.pathname.startsWith('/sol/') || url.pathname.startsWith('/notify/')) {
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
        if (url.pathname.startsWith('/hl/')) {
          const hl = makeHL(env), A = autopilotCfg(env);
          const hlGuard = async () => (store && (await store.get('hlGuard'))) || { peak: 0, halted: null };
          if (route === 'GET /hl/state') {
            const st = await hl.state(), gi = await guardInfo();
            const ap = A.on && store ? await store.get('autopilot') : null;
            return json({ ...st, guard: { ...gi, ...(await hlGuard()), dd: G.hlDD }, autopilot: { on: A.on, strategy: A.strategy, label: A.label, interval: A.iv, last: ap && ap.last } }, 200, ns);
          }
          if (route === 'POST /hl/sync') {
            if (A.on) return json({ network: hl.network, mode: hl.live ? 'real' : 'simulacao', autopilot: true, plan: [], results: [], skipped: [{ market: 'todos', reason: 'piloto automático no servidor ligado: é o worker que decide' }] }, 200, ns);
            const g = await hlGuard();
            return json(tell('Hyperliquid', await hl.sync(body.desired || {}, { blockOpen: g.halted ? 'parado pela proteção do servidor (toca em RETOMAR)' : null })), 200, ns);
          }
          if (route === 'POST /hl/candles') return json(await makeHL({ ...env, HL_NETWORK: 'mainnet', HL_LIVE: '0' }).candles(body.interval, body.days), 200, ns);   // só leitura, sempre na rede real
          if (route === 'POST /hl/flatten') return json(tell('Hyperliquid', await hl.flatten()), 200, ns);
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
          if (route === 'POST /sol/sync') {
            const blocked = store ? (await store.get('solBlock')) || {} : {};
            if (store) await store.put('solBeat', now);   // a app está viva
            const res = await sol.sync(Array.isArray(body.desired) ? body.desired : [], { blocked, now });
            if (store && res.mode === 'real') {   // guarda a entrada de cada compra real para os stops do servidor
              const e = (await store.get('solEntries')) || {};
              for (const x of res.results) if (x.op === 'buy' && x.ok && !x.simulated) e[x.mint] = { t: now, usd: x.usd };
              await store.put('solEntries', e);
            }
            return json(tell('Solana', res), 200, ns);
          }
          if (route === 'POST /sol/flatten') return json(tell('Solana', await sol.flatten()), 200, ns);
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
