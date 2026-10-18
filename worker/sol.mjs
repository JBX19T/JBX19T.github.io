// Solana: compra/vende memecoins pela Jupiter com uma carteira dedicada (burner) com poucos dólares.
//   Segredos:   SOL_KEY (chave da carteira: base58 de 64 bytes como exporta a Phantom, ou lista JSON de 64 números, ou seed base58 de 32 bytes)
//               HELIUS_API_KEY (já usado pelo resto do worker)   JUP_API_KEY (opcional)
//   Variáveis:  SOL_LIVE=1 só então assina e envia; sem isto só calcula o plano e pede cotações (simulação)
//               SOL_PAUSED=1 bloqueia compras (só vende)
//   Limites:    SOL_TICKET_USD (2)  SOL_MAX_TICKET_USD (5, teto)  SOL_MAX_OPEN (3)  SOL_SLIPPAGE_BPS (300, máx 1000)  JUP_BASE
//               impacto no preço: compras até 5%; vendas até SOL_SELL_MAX_IMPACT (20%) — sair de uma memecoin a cair vale mais do que ficar preso nela
// Só assina swaps USDC <-> token construídos pela Jupiter a partir de uma cotação nossa. Nunca envia tokens ou SOL para outro endereço.
import { ed25519 } from '@noble/curves/ed25519.js';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58encode(bytes) {
  let n = 0n; for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b === 0) s = '1' + s; else break; }
  return s;
}
export function b58decode(str) {
  let n = 0n;
  for (const c of str) { const i = B58.indexOf(c); if (i < 0) throw new Error('base58 inválido'); n = n * 58n + BigInt(i); }
  const out = []; while (n > 0n) { out.unshift(Number(n & 0xffn)); n >>= 8n; }
  let z = 0; for (const c of str) { if (c === '1') z++; else break; }
  return Uint8Array.from([...new Array(z).fill(0), ...out]);
}
const b64 = { enc: u8 => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); }, dec: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)) };

// aceita 3 formatos e devolve { seed(32), pub(32) }
export function parseKeypair(raw) {
  if (!raw) throw new Error('SOL_KEY em falta');
  let bytes;
  const t = raw.trim();
  if (t.startsWith('[')) bytes = Uint8Array.from(JSON.parse(t)); else bytes = b58decode(t);
  if (bytes.length !== 64 && bytes.length !== 32) throw new Error('SOL_KEY deve ter 32 ou 64 bytes');
  const seed = bytes.slice(0, 32), pub = ed25519.getPublicKey(seed);
  if (bytes.length === 64 && b58encode(bytes.slice(32)) !== b58encode(pub)) throw new Error('SOL_KEY inconsistente (a chave pública não corresponde à privada)');
  return { seed, pub };
}

function shortvec(bytes, i) { let n = 0, shift = 0, k = i; for (;;) { const b = bytes[k++]; n |= (b & 0x7f) << shift; if (!(b & 0x80)) break; shift += 7; } return [n, k]; }
// assina a mensagem de uma VersionedTransaction (v0 ou legacy) e escreve a assinatura na posição 0
export function signVersionedTx(txBytes, seed, pub) {
  const [nsig, o1] = shortvec(txBytes, 0);
  const msgStart = o1 + nsig * 64, msg = txBytes.slice(msgStart);
  let p = 0; const versioned = (msg[0] & 0x80) !== 0; if (versioned) p = 1;
  const numRequired = msg[p];
  if (nsig !== numRequired) throw new Error('transação inconsistente');
  if (numRequired !== 1) throw new Error('a transação pede mais do que uma assinatura: recusada');
  const [nkeys, k0] = shortvec(msg, p + 3);
  if (nkeys < 1) throw new Error('transação sem contas');
  const payer = msg.slice(k0, k0 + 32);
  if (b58encode(payer) !== b58encode(pub)) throw new Error('o pagador da transação não é a nossa carteira: recusada');
  const sig = ed25519.sign(msg, seed);
  const out = txBytes.slice(); out.set(sig, o1);
  return { tx: out, signature: b58encode(sig) };
}

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', WSOL = 'So11111111111111111111111111111111111111112';
const TOKEN_PROGRAMS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : d; };
const validMint = m => { try { return typeof m === 'string' && b58decode(m).length === 32; } catch (e) { return false; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function makeSol(env, f = fetch) {
  const live = env.SOL_LIVE === '1';
  const cap = num(env.SOL_MAX_TICKET_USD, 5), ticket = Math.min(num(env.SOL_TICKET_USD, 2), cap);
  const maxOpen = Math.max(1, Math.floor(num(env.SOL_MAX_OPEN, 3)));
  const slip = Math.min(Math.max(Math.floor(num(env.SOL_SLIPPAGE_BPS, 300)), 10), 1000);
  const JUP = (env.JUP_BASE || 'https://lite-api.jup.ag/swap/v1').replace(/\/$/, '');
  const jh = () => ({ 'content-type': 'application/json', ...(env.JUP_API_KEY ? { 'x-api-key': env.JUP_API_KEY } : {}) });
  let kp = null;
  const key = () => (kp ??= parseKeypair(env.SOL_KEY));
  const address = () => b58encode(key().pub);

  const rpc = async (method, params) => {
    if (!env.HELIUS_API_KEY) throw new Error('HELIUS_API_KEY em falta');
    const r = await f('https://mainnet.helius-rpc.com/?api-key=' + env.HELIUS_API_KEY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    if (!r.ok) throw new Error(`rpc ${method} ${r.status}`);
    const j = await r.json(); if (j.error) throw new Error(`rpc ${method}: ${j.error.message}`);
    return j.result;
  };

  async function state() {
    const addr = address();
    const [bal, ...accs] = await Promise.all([rpc('getBalance', [addr]), ...TOKEN_PROGRAMS.map(p => rpc('getTokenAccountsByOwner', [addr, { programId: p }, { encoding: 'jsonParsed' }]))]);
    const tokens = []; let usdc = 0;
    for (const a of accs) for (const v of (a && a.value) || []) {
      const i = v.account.data.parsed.info, amt = i.tokenAmount;
      if (i.mint === USDC) { usdc += parseFloat(amt.uiAmountString || amt.uiAmount || 0); continue; }
      if (i.mint === WSOL || amt.amount === '0') continue;
      tokens.push({ mint: i.mint, rawAmount: amt.amount, decimals: amt.decimals, amount: parseFloat(amt.uiAmountString || amt.uiAmount || 0) });
    }
    return { address: addr, mode: live ? 'real' : 'simulacao', paused: env.SOL_PAUSED === '1', sol: (bal.value ?? bal) / 1e9, usdc, tokens, ticket, maxOpen, slippageBps: slip };
  }

  const sellImpact = Math.min(Math.max(num(env.SOL_SELL_MAX_IMPACT, 20), 1), 50);
  async function quote(inputMint, outputMint, amount, maxImpact = 5) {
    const u = `${JUP}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slip}&restrictIntermediateTokens=true`;
    const r = await f(u, { headers: jh() });
    if (!r.ok) throw new Error(`jupiter quote ${r.status}`);
    const q = await r.json();
    if (!q || q.error || !q.outAmount) throw new Error('sem rota: ' + ((q && q.error) || 'cotação vazia'));
    if (q.inputMint !== inputMint || q.outputMint !== outputMint) throw new Error('cotação não corresponde ao pedido: recusada');
    if (parseFloat(q.priceImpactPct || 0) * 100 > maxImpact) throw new Error(`impacto no preço de ${(parseFloat(q.priceImpactPct) * 100).toFixed(1)}%: recusado`);
    return q;
  }

  async function swap(q) {
    const r = await f(JUP + '/swap', { method: 'POST', headers: jh(), body: JSON.stringify({
      quoteResponse: q, userPublicKey: address(), dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 200000, priorityLevel: 'high' } } }) });
    if (!r.ok) throw new Error(`jupiter swap ${r.status}`);
    const j = await r.json(); if (!j.swapTransaction) throw new Error('jupiter sem transação');
    const { tx, signature } = signVersionedTx(b64.dec(j.swapTransaction), key().seed, key().pub);
    await rpc('sendTransaction', [b64.enc(tx), { encoding: 'base64', skipPreflight: false, maxRetries: 3 }]);
    for (let i = 0; i < 20; i++) {
      await sleep(1500);
      const st = (await rpc('getSignatureStatuses', [[signature]])).value[0];
      if (st) { if (st.err) throw new Error('transação falhou: ' + JSON.stringify(st.err)); if (['confirmed', 'finalized'].includes(st.confirmationStatus)) return signature; }
    }
    throw new Error('sem confirmação em 30s (assinatura ' + signature + ')');
  }

  async function exec(op, mint, inMint, outMint, amount, extra, res) {
    try {
      const q = await quote(inMint, outMint, amount, op === 'sell' ? sellImpact : 5);
      const quoteInfo = { inAmount: q.inAmount, outAmount: q.outAmount, priceImpactPct: q.priceImpactPct };
      if (!live) { res.results.push({ op, mint, ok: true, simulated: true, quote: quoteInfo, ...extra }); return; }
      const signature = await swap(q);
      res.results.push({ op, mint, ok: true, signature, quote: quoteInfo, ...extra });
    } catch (e) { res.results.push({ op, mint, ok: false, error: String(e.message || e), ...extra }); }
  }

  // blocked: { mint: até quando (ms) } — memecoins vendidas pela proteção do servidor não se voltam a comprar logo
  async function sync(desired = [], { sellAll = false, blocked = {}, now = Date.now() } = {}) {
    const res = { mode: live ? 'real' : 'simulacao', plan: [], results: [], skipped: [] };
    const want = [];
    for (const m of desired || []) { if (validMint(m)) { if (m !== USDC && m !== WSOL && !want.includes(m)) want.push(m); } else res.skipped.push({ mint: String(m).slice(0, 12), reason: 'mint inválido' }); }
    const st = await state(); res.address = st.address;
    const held = new Map(st.tokens.map(t => [t.mint, t]));
    // vender o que já não é desejado
    for (const t of st.tokens) if (sellAll || !want.includes(t.mint)) {
      res.plan.push({ op: 'sell', mint: t.mint, amount: t.amount });
      await exec('sell', t.mint, t.mint, USDC, t.rawAmount, { amount: t.amount }, res);
      if (live) held.delete(t.mint);
    }
    if (sellAll) return res;
    // comprar o que falta
    let open = [...held.keys()].length, usdc = st.usdc;
    for (const m of want) {
      if (held.has(m)) continue;
      if (blocked[m] && blocked[m] > now) { res.skipped.push({ mint: m, reason: 'vendida pela proteção do servidor; bloqueada até ' + new Date(blocked[m]).toISOString().slice(11, 16) + ' UTC' }); continue; }
      if (env.SOL_PAUSED === '1') { res.skipped.push({ mint: m, reason: 'pausado (SOL_PAUSED)' }); continue; }
      if (open >= maxOpen) { res.skipped.push({ mint: m, reason: `máximo de ${maxOpen} posições` }); continue; }
      if (usdc < ticket) { res.skipped.push({ mint: m, reason: `USDC insuficiente ($${usdc.toFixed(2)} < $${ticket})` }); continue; }
      if (st.sol < 0.01) { res.skipped.push({ mint: m, reason: `SOL insuficiente para taxas (${st.sol.toFixed(4)})` }); continue; }
      res.plan.push({ op: 'buy', mint: m, usd: ticket });
      await exec('buy', m, USDC, m, String(Math.round(ticket * 1e6)), { usd: ticket }, res);
      const last = res.results[res.results.length - 1];
      if (last.ok) { open++; usdc -= ticket; }
    }
    return res;
  }

  // valor atual em USDC de uma quantidade de token (cotação de venda na Jupiter); null se não houver rota
  async function valueOf(mint, rawAmount) {
    try { const q = await quote(mint, USDC, rawAmount, 100); return parseInt(q.outAmount, 10) / 1e6; } catch (e) { return null; }
  }
  // vende uma só memecoin (usado pela proteção do servidor)
  async function sellOne(mint, st = null) {
    st ??= await state();
    const res = { mode: live ? 'real' : 'simulacao', plan: [], results: [], skipped: [] };
    const t = st.tokens.find(x => x.mint === mint);
    if (!t) { res.skipped.push({ mint, reason: 'já não está na carteira' }); return res; }
    res.plan.push({ op: 'sell', mint, amount: t.amount });
    await exec('sell', mint, mint, USDC, t.rawAmount, { amount: t.amount }, res);
    return res;
  }
  const flatten = () => sync([], { sellAll: true });
  return { state, sync, flatten, address, live, ticket, maxOpen, valueOf, sellOne };
}
