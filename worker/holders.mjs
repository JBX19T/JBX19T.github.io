// Cloudflare Worker: proxy de holders (Helius) para o DOLLOS Trade Bot. A chave fica em env.HELIUS_API_KEY (segredo).
// GET /wallet?address=<carteira>  ->  { address, swaps:[{signature,timestamp,side,mint}] }  (trades que o bot pode copiar)
// GET /holders?mint=<mint solana>  ->  { topWallet, top10, mintAuthority, freezeAuthority, supply, excluded }
// /hl/*   ->  Hyperliquid (hl.mjs): GET /hl/state, POST /hl/sync {desired}, POST /hl/flatten   (ouro, S&P 500, EUR/USD)
// /sol/*  ->  Solana/Jupiter (sol.mjs): GET /sol/state, POST /sol/sync {desired:[mints]}, POST /sol/flatten   (memecoins)
//             ambos: simulação por omissão; só enviam ordens com HL_LIVE=1 / SOL_LIVE=1; exigem o cabeçalho X-Token = APP_TOKEN
import { makeHL } from './hl.mjs';
import { makeSol } from './sol.mjs';
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

// comparação de palavras-passe em tempo constante (X-Token)
function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export default {
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
    if (url.pathname.startsWith('/hl/') || url.pathname.startsWith('/sol/')) {
      if (allowed.length && !allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403);
      if (!env.APP_TOKEN) return json({ error: 'APP_TOKEN em falta no worker' }, 503);
      if (!safeEq(req.headers.get('x-token') || '', env.APP_TOKEN)) return json({ error: 'token inválido' }, 401);
      let body = {};
      if (req.method === 'POST') { try { body = await req.json(); } catch (e) { return json({ error: 'json inválido' }, 400); } }
      try {
        const route = req.method + ' ' + url.pathname;
        if (url.pathname.startsWith('/hl/')) {
          const hl = makeHL(env);
          if (route === 'GET /hl/state') return json(await hl.state(), 200, { 'cache-control': 'no-store' });
          if (route === 'POST /hl/sync') return json(await hl.sync(body.desired || {}), 200, { 'cache-control': 'no-store' });
          if (route === 'POST /hl/flatten') return json(await hl.flatten(), 200, { 'cache-control': 'no-store' });
        } else {
          const sol = makeSol(env);
          if (route === 'GET /sol/state') return json(await sol.state(), 200, { 'cache-control': 'no-store' });
          if (route === 'POST /sol/sync') return json(await sol.sync(Array.isArray(body.desired) ? body.desired : []), 200, { 'cache-control': 'no-store' });
          if (route === 'POST /sol/flatten') return json(await sol.flatten(), 200, { 'cache-control': 'no-store' });
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
