// Cloudflare Worker: proxy de holders (Helius) para o DOLLOS Trade Bot. A chave fica em env.HELIUS_API_KEY (segredo).
// GET /wallet?address=<carteira>  ->  { address, swaps:[{signature,timestamp,side,mint}] }  (trades que o bot pode copiar)
// GET /holders?mint=<mint solana>  ->  { topWallet, top10, mintAuthority, freezeAuthority, supply, excluded }
// /alpaca/*  ->  espelho das posições do Macro Desk numa conta de PAPER da Alpaca (segredos: ALPACA_KEY, ALPACA_SECRET, APP_TOKEN)
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

// ===== Alpaca (só PAPER) =====
// Os endereços abaixo são fixos: não existe nenhum caminho para a conta real. Só ETFs de uma lista, valor máximo por ordem,
// e todas as chamadas exigem o cabeçalho X-Token igual a env.APP_TOKEN (a origem sozinha não autentica ninguém).
const AL_TRADE = 'https://paper-api.alpaca.markets/v2', AL_DATA = 'https://data.alpaca.markets/v2';
const AL_ALLOW = new Set(['SPY', 'GLD', 'FXE']);   // S&P 500, ouro, euro: proxies ETF dos três mercados do Macro Desk
const AL_MAX_NOTIONAL = 5000;

function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// devolve [status, corpo]; f permite simular a rede nos testes
export async function alpaca(method, path, body, token, env, f = fetch) {
  if (!env.APP_TOKEN || !env.ALPACA_KEY || !env.ALPACA_SECRET) return [503, { error: 'alpaca não configurado (faltam segredos)' }];
  if (!safeEq(token || '', env.APP_TOKEN)) return [401, { error: 'token inválido' }];
  const H = { 'APCA-API-KEY-ID': env.ALPACA_KEY, 'APCA-API-SECRET-KEY': env.ALPACA_SECRET, 'content-type': 'application/json' };
  const call = async (u, opt = {}) => {
    const r = await f(u, { ...opt, headers: H });
    const t = await r.text();
    let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* corpo não-JSON */ }
    if (!r.ok) throw Object.assign(new Error(`alpaca ${r.status}: ${(j && j.message) || t.slice(0, 120)}`), { status: r.status });
    return j;
  };
  const symbolOk = s => typeof s === 'string' && AL_ALLOW.has(s);
  try {
    if (method === 'GET' && path === '/alpaca/state') {
      const [clock, acct, pos] = await Promise.all([call(AL_TRADE + '/clock'), call(AL_TRADE + '/account'), call(AL_TRADE + '/positions')]);
      return [200, { paper: true, open: !!clock.is_open, nextOpen: clock.next_open, nextClose: clock.next_close,
        equity: +acct.equity, cash: +acct.cash, status: acct.status,
        positions: (pos || []).filter(p => AL_ALLOW.has(p.symbol)).map(p => ({ symbol: p.symbol, qty: +p.qty, side: p.side, avg: +p.avg_entry_price, value: +p.market_value, pl: +p.unrealized_pl })) }];
    }
    if (method === 'POST' && path === '/alpaca/order') {
      const { symbol, side } = body || {}, notional = Math.min(+(body || {}).notional, AL_MAX_NOTIONAL);
      if (!symbolOk(symbol)) return [400, { error: 'símbolo não permitido' }];
      if (side !== 'buy' && side !== 'sell') return [400, { error: 'side inválido' }];
      if (!(notional > 0)) return [400, { error: 'valor inválido' }];
      const clock = await call(AL_TRADE + '/clock');
      if (!clock.is_open) return [200, { skipped: 'mercado fechado' }];
      const [pos, open] = await Promise.all([
        call(AL_TRADE + '/positions').then(a => a.some(p => p.symbol === symbol)),
        call(AL_TRADE + `/orders?status=open&symbols=${symbol}`).then(a => a.length > 0),
      ]);
      if (pos) return [200, { skipped: 'já existe posição' }];
      if (open) return [200, { skipped: 'ordem pendente' }];
      const px = (await call(AL_DATA + `/stocks/${symbol}/trades/latest?feed=iex`))?.trade?.p;
      if (!(px > 0)) throw new Error('sem preço para ' + symbol);
      const qty = Math.floor(notional / px);   // ações inteiras: a Alpaca só deixa vender a descoberto quantidades inteiras
      if (qty < 1) return [200, { skipped: 'valor abaixo de 1 ação' }];
      const o = await call(AL_TRADE + '/orders', { method: 'POST', body: JSON.stringify({ symbol, qty: String(qty), side, type: 'market', time_in_force: 'day' }) });
      return [200, { id: o.id, symbol, side, qty, status: o.status, price: px }];
    }
    if (method === 'POST' && path === '/alpaca/close') {
      const { symbol } = body || {};
      if (!symbolOk(symbol)) return [400, { error: 'símbolo não permitido' }];
      const clock = await call(AL_TRADE + '/clock');
      if (!clock.is_open) return [200, { skipped: 'mercado fechado' }];
      try {
        const o = await call(AL_TRADE + `/positions/${symbol}`, { method: 'DELETE' });
        return [200, { id: o && o.id, symbol, status: o && o.status }];
      } catch (e) {
        if (e.status === 404) return [200, { skipped: 'sem posição' }];
        throw e;
      }
    }
  } catch (e) { return [502, { error: String(e.message || e) }]; }
  return [404, { error: 'not found' }];
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
    if (url.pathname.startsWith('/alpaca/')) {
      if (allowed.length && !allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403);
      let body = null;
      if (req.method === 'POST') { try { body = await req.json(); } catch (e) { return json({ error: 'json inválido' }, 400); } }
      const [st, out] = await alpaca(req.method, url.pathname, body, req.headers.get('x-token'), env);
      return json(out, st, { 'cache-control': 'no-store' });
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
