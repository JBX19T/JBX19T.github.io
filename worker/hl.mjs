// Hyperliquid: executa no worker as posições que o Macro Desk quer (ouro, S&P 500, EUR/USD) com uma carteira de API.
// A carteira de API só assina ordens (não levanta fundos). Tudo é limitado e começa em SIMULAÇÃO na rede de TESTE.
//   Segredos:   HL_AGENT_KEY (chave privada da carteira de API, 0x + 64 hex)   HL_ACCOUNT (endereço da conta principal, 0x...)
//   Interruptores (variáveis):
//     HL_LIVE=1                  só então envia ordens; sem isto só calcula o plano (simulação)
//     HL_NETWORK=mainnet         por omissão é testnet; mainnet exige também HL_CONFIRM_MAINNET=YES
//     HL_PAUSED=1                bloqueia aberturas (só fecha)
//   Limites:    HL_MAX_ORDER_USD (15)  HL_MAX_GROSS_USD (30)  HL_MIN_ORDER_USD (10)  HL_SLIPPAGE_BPS (50)  HL_LEVERAGE (3)
//   Mercados:   HL_DEXES (xyz)   HL_MARKETS = {"GOLD":"xyz:GOLD",...} para fixar os nomes exatos
//   Alvo:       por omissão é uma ordem limitada reduce-only (paga a taxa de maker, mais baixa); HL_TP_TRIGGER=1 volta ao alvo a mercado
//   Proteção:   HL_DEFAULT_STOP_PCT (0.02) = stop de emergência para uma posição que apareça sem stop
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { encode as mpEncode } from '@msgpack/msgpack';

const te = new TextEncoder();
const keccak = b => keccak_256(b);
const concat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
export const toHex = b => '0x' + [...b].map(x => x.toString(16).padStart(2, '0')).join('');
export const fromHex = h => { const s = h.replace(/^0x/, ''); if (!/^[0-9a-fA-F]*$/.test(s) || s.length % 2) throw new Error('hex inválido'); return Uint8Array.from(s.match(/../g) || [], x => parseInt(x, 16)); };
const u64 = n => { const o = new Uint8Array(8); new DataView(o.buffer).setBigUint64(0, BigInt(n)); return o; };
const u256 = n => { const o = new Uint8Array(32); let v = BigInt(n); for (let i = 31; i >= 0; i--) { o[i] = Number(v & 0xffn); v >>= 8n; } return o; };

// ===== assinatura de ações L1 (mesmo esquema do SDK oficial em Python) =====
const DOMAIN_TYPEHASH = keccak(te.encode('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'));
const AGENT_TYPEHASH = keccak(te.encode('Agent(string source,bytes32 connectionId)'));
const DOMAIN_SEP = keccak(concat(DOMAIN_TYPEHASH, keccak(te.encode('Exchange')), keccak(te.encode('1')), u256(1337), new Uint8Array(32)));

export function actionHash(action, nonce, expiresAfter = null) {
  let data = concat(mpEncode(action), u64(nonce), Uint8Array.of(0));   // 0 = sem vault
  if (expiresAfter != null) data = concat(data, Uint8Array.of(0), u64(expiresAfter));
  return keccak(data);
}
export function signL1(privKeyHex, action, nonce, isMainnet, expiresAfter = null) {
  const connectionId = actionHash(action, nonce, expiresAfter);
  const structHash = keccak(concat(AGENT_TYPEHASH, keccak(te.encode(isMainnet ? 'a' : 'b')), connectionId));
  const digest = keccak(concat(Uint8Array.of(0x19, 0x01), DOMAIN_SEP, structHash));
  const sig = secp256k1.sign(digest, fromHex(privKeyHex), { prehash: false, format: 'recovered' });   // [recid, r(32), s(32)]
  const minHex = b => '0x' + BigInt(toHex(b)).toString(16);   // como o SDK oficial: sem zeros à esquerda
  return { r: minHex(sig.slice(1, 33)), s: minHex(sig.slice(33, 65)), v: 27 + sig[0] };
}
export function addressOf(privKeyHex) {
  const pub = secp256k1.getPublicKey(fromHex(privKeyHex), false);   // 0x04 + X + Y
  return toHex(keccak(pub.slice(1)).slice(-20));
}

// ===== formatação de preços e tamanhos =====
export function floatToWire(x) {
  const s = x.toFixed(8);
  if (Math.abs(Number(s) - x) >= 1e-12) throw new Error('arredondamento inválido: ' + x);
  const t = s.replace(/\.?0+$/, '');
  return t === '' || t === '-0' ? '0' : t;
}
// preço: 5 algarismos significativos e no máximo (6 - szDecimals) casas decimais (regra dos perps)
export const roundPx = (px, szDecimals) => Number(Number(px.toPrecision(5)).toFixed(Math.max(0, 6 - szDecimals)));
export const roundSz = (sz, szDecimals) => { const k = 10 ** szDecimals; return Math.floor(sz * k + 1e-9) / k; };

// ===== ordens =====
export const orderWire = (a, isBuy, px, sz, reduceOnly, t) => ({ a, b: isBuy, p: floatToWire(px), s: floatToWire(sz), r: reduceOnly, t });
export const ioc = { limit: { tif: 'Ioc' } };
export const trigger = (triggerPx, tpsl) => ({ trigger: { isMarket: true, triggerPx: floatToWire(triggerPx), tpsl } });
export const gtc = { limit: { tif: 'Gtc' } };

const MARKET_PATTERNS = {
  GOLD: /^(?:[a-z0-9_-]+:)?(?:XAU|GOLD)(?:[-/]?USD)?$/i,
  SPX: /^(?:[a-z0-9_-]+:)?(?:SPX|SP500|S&P500|US500)(?:[-/]?USD)?$/i,
  EURUSD: /^(?:[a-z0-9_-]+:)?(?:EUR|EURUSD)(?:[-/]?USD)?$/i,
};
export const MARKET_KEYS = Object.keys(MARKET_PATTERNS);
// o preço tem de fazer sentido para o ativo (evita apanhar, por nome, uma memecoin do mercado principal como se fosse o S&P 500)
export const PLAUSIBLE = { GOLD: [300, 30000], SPX: [500, 60000], EURUSD: [0.5, 2] };
const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : d; };
// Reconhece o stop de uma posição pela GEOMETRIA (gatilho abaixo do preço numa posição longa, acima numa curta), não pelo texto de orderType,
// cujo valor exato não está verificado. Ordens sem os campos esperados contam como "formato desconhecido" (nunca se empilham stops por cima).
const trigPx = o => { const v = parseFloat(o.triggerPx); return Number.isFinite(v) && v > 0 ? v : null; };
const isTriggerOrder = o => o.isTrigger === true || trigPx(o) != null;
const isStopOf = (o, isLong, mid) => isTriggerOrder(o) && !/take|tp/i.test(o.orderType || '') && trigPx(o) != null && (isLong ? trigPx(o) < mid : trigPx(o) > mid);
const unknownShape = o => o.isTrigger === undefined && o.triggerPx === undefined;
const ADDR = /^0x[0-9a-fA-F]{40}$/;
let lastNonce = 0;
const nextNonce = () => (lastNonce = Math.max(Date.now(), lastNonce + 1));

export function makeHL(env, f = fetch) {
  const mainnet = env.HL_NETWORK === 'mainnet';
  const network = mainnet ? 'mainnet' : 'testnet';
  const base = mainnet ? 'https://api.hyperliquid.xyz' : 'https://api.hyperliquid-testnet.xyz';
  const live = env.HL_LIVE === '1' && (!mainnet || env.HL_CONFIRM_MAINNET === 'YES');
  const caps = {
    maxOrder: num(env.HL_MAX_ORDER_USD, 15), maxGross: num(env.HL_MAX_GROSS_USD, 30), minOrder: num(env.HL_MIN_ORDER_USD, 10),
    slipBps: Math.min(num(env.HL_SLIPPAGE_BPS, 50), 300), leverage: Math.max(1, Math.min(num(env.HL_LEVERAGE, 3), 10)),
  };
  const dexNames = (env.HL_DEXES ?? 'xyz').split(',').map(s => s.trim()).filter(Boolean);
  let pinned = {}; try { pinned = env.HL_MARKETS ? JSON.parse(env.HL_MARKETS) : {}; } catch (e) { /* ignora */ }

  const need = () => {
    if (!env.HL_AGENT_KEY || !/^0x[0-9a-fA-F]{64}$/.test(env.HL_AGENT_KEY)) throw new Error('HL_AGENT_KEY em falta ou inválida');
    if (!ADDR.test(env.HL_ACCOUNT || '')) throw new Error('HL_ACCOUNT em falta ou inválido');
  };
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  const info = async body => {
    for (let a = 0; ; a++) {   // a Hyperliquid limita pedidos por endereço (429): espera e repete
      const r = await f(base + '/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 429 && a < 3) { await sleep(700 * (a + 1)); continue; }
      if (!r.ok) throw new Error(`hyperliquid info ${r.status}`);
      return r.json();
    }
  };
  const post = async action => {
    need();
    const nonce = nextNonce();
    const signature = signL1(env.HL_AGENT_KEY, action, nonce, mainnet);
    const r = await f(base + '/exchange', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, nonce, signature, vaultAddress: null, expiresAfter: null }) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { j = { status: 'err', response: t.slice(0, 200) }; }
    if (!r.ok && j.status !== 'err') j = { status: 'err', response: `HTTP ${r.status}` };
    return j;
  };
  const statuses = j => (j && j.status === 'ok' && j.response && j.response.data && j.response.data.statuses) || null;

  // descobre os mercados (nome -> asset id, decimais, preço médio) nos dexes configurados
  async function discover() {
    const dexes = await info({ type: 'perpDexs' });
    const coins = new Map();
    const scan = [{ name: '', offset: 0 }];
    dexNames.forEach(n => { const i = (dexes || []).findIndex(d => d && d.name === n); if (i > 0) scan.push({ name: n, offset: 110000 + (i - 1) * 10000 }); });
    for (const d of scan) {
      const [meta, mids] = await Promise.all([info({ type: 'meta', dex: d.name }), info({ type: 'allMids', dex: d.name })]);
      (meta.universe || []).forEach((u, i) => coins.set(u.name, { coin: u.name, dex: d.name, asset: d.offset + i, szDecimals: u.szDecimals, maxLeverage: u.maxLeverage, mid: parseFloat(mids[u.name]) || null }));
    }
    const resolved = {}, rejected = [];
    for (const k of MARKET_KEYS) {
      const want = pinned[k];
      if (want && coins.get(want)) { resolved[k] = coins.get(want); continue; }   // nome fixado por ti: usa-se como está
      const [lo, hi] = PLAUSIBLE[k];
      // só nos mercados de builders (xyz...), nunca no principal, e só com preço plausível
      const cands = [...coins.values()].filter(c => c.dex !== '' && MARKET_PATTERNS[k].test(c.coin));
      const good = cands.find(c => c.mid && c.mid >= lo && c.mid <= hi);
      cands.filter(c => c !== good && !(c.mid && c.mid >= lo && c.mid <= hi)).forEach(c => rejected.push(`${k}: ${c.coin} (preço ${c.mid})`));
      resolved[k] = good || null;
    }
    const seen = [...coins.values()].filter(c => /GOLD|XAU|SPX|SP500|US500|EUR/i.test(c.coin)).map(c => `${c.coin} ${c.mid ?? ''}`.trim()).slice(0, 30);
    return { coins, resolved, seen, rejected, dexes: scan.map(d => d.name || 'main') };
  }

  async function accountOf(dex) {
    if (!ADDR.test(env.HL_ACCOUNT || '')) throw new Error('HL_ACCOUNT em falta ou inválido (endereço 0x… da conta principal da Hyperliquid)');
    const [st, oo] = await Promise.all([info({ type: 'clearinghouseState', user: env.HL_ACCOUNT, dex }), info({ type: 'frontendOpenOrders', user: env.HL_ACCOUNT, dex })]);
    const positions = (st.assetPositions || []).map(a => a.position).filter(Boolean).map(p => ({ coin: p.coin, szi: parseFloat(p.szi), entryPx: parseFloat(p.entryPx), pnl: parseFloat(p.unrealizedPnl) }));
    return { equity: parseFloat(st.marginSummary && st.marginSummary.accountValue) || 0, positions, orders: oo || [] };
  }

  async function state() {
    const out = { network, mode: live ? 'real' : 'simulacao', paused: env.HL_PAUSED === '1', caps, configured: !!(env.HL_AGENT_KEY && env.HL_ACCOUNT) };
    if (env.HL_AGENT_KEY && /^0x[0-9a-fA-F]{64}$/.test(env.HL_AGENT_KEY)) out.agentAddress = addressOf(env.HL_AGENT_KEY);
    const d = await discover();
    out.dexes = d.dexes; out.seen = d.seen; out.rejected = d.rejected;
    out.markets = Object.fromEntries(MARKET_KEYS.map(k => [k, d.resolved[k] ? { coin: d.resolved[k].coin, asset: d.resolved[k].asset, mid: d.resolved[k].mid, maxLeverage: d.resolved[k].maxLeverage } : null]));
    if (ADDR.test(env.HL_ACCOUNT || '')) {
      out.account = {}; out.positions = []; out.openOrders = 0;
      for (const dx of new Set(['', ...Object.values(d.resolved).filter(Boolean).map(c => c.dex)])) {   // o principal também (saldo total para a proteção)
        const a = await accountOf(dx);
        out.account[dx || 'main'] = a.equity;
        const mine = new Set(Object.values(d.resolved).filter(Boolean).map(c => c.coin));
        for (const p of a.positions.filter(p => mine.has(p.coin))) {
          const c = [...Object.values(d.resolved)].find(x => x && x.coin === p.coin), os = a.orders.filter(o => o.coin === p.coin);
          const stop = c && c.mid ? os.find(o => isStopOf(o, p.szi > 0, c.mid)) : null;
          out.positions.push({ ...p, stop: stop ? trigPx(stop) : null, orders: os.length, ordersShapeUnknown: os.some(unknownShape) });
        }
        out.openOrders += a.orders.filter(o => mine.has(o.coin)).length;
      }
    }
    return out;
  }

  const slipPx = (mid, isBuy, sd) => roundPx(mid * (1 + (isBuy ? 1 : -1) * caps.slipBps / 1e4), sd);
  const defaultStopPct = Math.min(Math.max(num(env.HL_DEFAULT_STOP_PCT, 0.02), 0.005), 0.1);
  // preço médio realmente executado vs preço de referência (mid): é isto que mede o slippage real de cada ordem
  const fillInfo = (s0, isBuy, mid) => { const f = s0 && s0.filled; if (!f) return {}; const avg = parseFloat(f.avgPx), sz = parseFloat(f.totalSz); return { mid, avgPx: avg, filledSz: sz, slipBps: Number.isFinite(avg) && mid ? +(((isBuy ? 1 : -1) * (avg - mid) / mid) * 1e4).toFixed(2) : null }; };

  // desired: { GOLD:{side:'long'|'short', frac, slPct, tpPct, slPx}, ... }  frac = posição / saldo do Macro Desk
  //   tpPct null = sem alvo (estratégia de stop móvel)   slPx = stop atual pedido pelo desk (sobe/desce com o stop móvel)
  // blockOpen: motivo para não abrir nada (ex.: parado pela proteção do servidor)
  // keepHeld: nunca fecha por "não estar desejado" as posições existentes; só garante que têm stop (usado pela proteção do servidor)
  async function sync(desired = {}, { flattenAll = false, blockOpen = null, keepHeld = false } = {}) {
    const d = await discover();
    const res = { network, mode: live ? 'real' : 'simulacao', plan: [], results: [], skipped: [] };
    const accounts = {};
    const acct = async dex => (accounts[dex] ??= await accountOf(dex));
    let gross = 0;
    for (const k of MARKET_KEYS) { const c = d.resolved[k]; if (!c) continue; const a = await acct(c.dex); const p = a.positions.find(x => x.coin === c.coin); if (p && c.mid) gross += Math.abs(p.szi) * c.mid; }
    for (const k of MARKET_KEYS) {
      const c = d.resolved[k];
      let want = flattenAll ? null : desired[k];
      if (!c) { if (want) res.skipped.push({ market: k, reason: 'mercado não encontrado na Hyperliquid' }); continue; }
      if (!c.mid) { res.skipped.push({ market: k, reason: 'sem preço' }); continue; }
      const a = await acct(c.dex), pos = a.positions.find(x => x.coin === c.coin && x.szi !== 0);
      if (!want && keepHeld && !flattenAll && pos) want = { side: pos.szi > 0 ? 'long' : 'short', frac: 0, slPct: defaultStopPct };
      const myOrders = a.orders.filter(o => o.coin === c.coin);
      // 1) ordens órfãs (stops de uma posição que já não existe)
      if (!pos && myOrders.length) {
        res.plan.push({ op: 'cancel', market: k, coin: c.coin, count: myOrders.length });
        if (live) res.results.push({ op: 'cancel', market: k, ok: statuses(await post({ type: 'cancel', cancels: myOrders.map(o => ({ a: c.asset, o: o.oid })) })) !== null });
      }
      const wantLong = want && want.side === 'long';
      // 2) fechar
      if (pos && (!want || (pos.szi > 0) !== wantLong)) {
        const isBuy = pos.szi < 0, px = slipPx(c.mid, isBuy, c.szDecimals), sz = Math.abs(pos.szi);
        res.plan.push({ op: 'close', market: k, coin: c.coin, side: isBuy ? 'buy' : 'sell', sz, px });
        if (live) {
          const r = await post({ type: 'order', orders: [orderWire(c.asset, isBuy, px, sz, true, ioc)], grouping: 'na' });
          const s0 = statuses(r) && statuses(r)[0];
          res.results.push({ op: 'close', market: k, ok: !!(s0 && s0.filled), detail: s0 || r, ...fillInfo(s0, isBuy, c.mid) });
          if (s0 && s0.filled && myOrders.length) await post({ type: 'cancel', cancels: myOrders.map(o => ({ a: c.asset, o: o.oid })) });
        }
        gross -= sz * c.mid;
        continue;   // a abertura do lado contrário fica para a próxima sincronização
      }
      // 2b) posição mantida: aperta o stop móvel, ou repõe o stop se faltar (nunca deixa uma posição sem stop)
      if (pos && want) {
        const isLong = pos.szi > 0, sz = Math.abs(pos.szi);
        const sls = myOrders.filter(o => isStopOf(o, isLong, c.mid));
        const cur = sls.length ? Math.max(...sls.map(trigPx).map(v => (isLong ? v : -v))) * (isLong ? 1 : -1) : null;   // o stop mais apertado
        if (cur == null && myOrders.some(unknownShape)) {   // não se sabe ler as ordens da corretora: não se empilham stops por cima de ordens que talvez já protejam
          res.skipped.push({ market: k, reason: 'formato das ordens da corretora desconhecido: não repõe o stop sozinho (confirma na Hyperliquid)' });
          continue;
        }
        let target = want.slPx > 0 ? want.slPx : null;
        if (cur == null && target == null) { const pct = Math.min(Math.max(want.slPct || defaultStopPct, 0.002), 0.2); target = (pos.entryPx || c.mid) * (isLong ? 1 - pct : 1 + pct); }
        if (target != null) {
          target = roundPx(target, c.szDecimals);
          const valid = isLong ? target < c.mid * 0.999 : target > c.mid * 1.001;
          const tighter = cur == null || (isLong ? target > cur * 1.001 : target < cur * 0.999);
          if (cur == null && !valid) {   // sem stop e o preço já passou o nível do stop: fecha
            const px = slipPx(c.mid, !isLong, c.szDecimals);
            res.plan.push({ op: 'close', market: k, coin: c.coin, side: isLong ? 'sell' : 'buy', sz, px, mid: c.mid, motivo: 'sem stop e preço além do stop' });
            if (live) { const r = await post({ type: 'order', orders: [orderWire(c.asset, !isLong, px, sz, true, ioc)], grouping: 'na' }); const s0 = statuses(r) && statuses(r)[0]; res.results.push({ op: 'close', market: k, ok: !!(s0 && s0.filled), detail: s0 || r, motivo: 'sem stop', ...fillInfo(s0, !isLong, c.mid) }); }
          } else if (valid && tighter) {
            const op = cur == null ? 'stop' : 'trail';
            res.plan.push({ op, market: k, coin: c.coin, from: cur, to: target });
            if (live) {   // primeiro o stop novo, só depois cancela o antigo: nunca fica sem proteção
              const r = await post({ type: 'order', orders: [orderWire(c.asset, !isLong, target, sz, true, trigger(target, 'sl'))], grouping: 'na' });
              const s0 = statuses(r) && statuses(r)[0], ok = !!(s0 && !s0.error);
              if (ok && sls.length) await post({ type: 'cancel', cancels: sls.map(o => ({ a: c.asset, o: o.oid })) });
              res.results.push({ op, market: k, ok, detail: s0 || r });
            }
          }
        }
        continue;
      }
      // 3) abrir
      if (want && !pos) {
        if (env.HL_PAUSED === '1' || blockOpen) { res.skipped.push({ market: k, reason: blockOpen || 'pausado (HL_PAUSED)' }); continue; }
        const equityNow = (a.equity > 0 ? a.equity : (await acct('')).equity);
        const lev = Math.min(caps.leverage, c.maxLeverage || caps.leverage);
        let usd = Math.min(want.frac * equityNow, caps.maxOrder, equityNow * lev * 0.9);
        if (gross + usd > caps.maxGross) usd = Math.max(0, caps.maxGross - gross);
        const isBuy = wantLong, px = slipPx(c.mid, isBuy, c.szDecimals), sz = roundSz(usd / px, c.szDecimals);
        if (!(equityNow > 0)) { res.skipped.push({ market: k, reason: 'sem saldo na conta (transfere USDC para o dex ' + (c.dex || 'main') + ')' }); continue; }
        if (sz * px < caps.minOrder) { res.skipped.push({ market: k, reason: `ordem de $${(sz * px).toFixed(2)} abaixo do mínimo de $${caps.minOrder}` }); continue; }
        const noTp = want.tpPct === null || want.tpPct === 0;   // estratégia de stop móvel: sem alvo
        const slPct = Math.min(Math.max(want.slPct || 0.01, 0.002), 0.2), tpPct = Math.min(Math.max(want.tpPct || 0.015, 0.002), 0.5);
        const sl = roundPx(c.mid * (isBuy ? 1 - slPct : 1 + slPct), c.szDecimals), tp = noTp ? null : roundPx(c.mid * (isBuy ? 1 + tpPct : 1 - tpPct), c.szDecimals);
        res.plan.push({ op: 'open', market: k, coin: c.coin, side: isBuy ? 'buy' : 'sell', sz, px, mid: c.mid, usd: +(sz * px).toFixed(2), leverage: lev, sl, tp });
        gross += sz * px;
        if (live) {
          // outra sincronização (ex.: a app aberta em dois aparelhos) pode ter aberto entretanto: confirma antes de enviar
          const again = await accountOf(c.dex);
          if (again.positions.some(x => x.coin === c.coin && x.szi !== 0)) { res.results.push({ op: 'open', market: k, ok: false, detail: 'já existe posição (outra sincronização)' }); continue; }
          const lv = await post({ type: 'updateLeverage', asset: c.asset, isCross: false, leverage: lev });
          if (!lv || lv.status !== 'ok') { res.results.push({ op: 'open', market: k, ok: false, detail: { leverage: lv } }); continue; }
          const r = await post({ type: 'order', orders: [orderWire(c.asset, isBuy, px, sz, false, ioc)], grouping: 'na' });
          const s0 = statuses(r) && statuses(r)[0];
          if (!(s0 && s0.filled)) { res.results.push({ op: 'open', market: k, ok: false, detail: s0 || r }); continue; }
          const fsz = parseFloat(s0.filled.totalSz);
          const tpOrder = env.HL_TP_TRIGGER === '1' ? trigger(tp, 'tp') : gtc;   // alvo como ordem limitada: fica no livro e paga taxa de maker
          const protOrders = [orderWire(c.asset, !isBuy, sl, fsz, true, trigger(sl, 'sl'))];
          if (tp != null) protOrders.push(orderWire(c.asset, !isBuy, tp, fsz, true, tpOrder));
          const prot = await post({ type: 'order', orders: protOrders, grouping: 'na' });
          const ps = statuses(prot);
          if (!ps || ps.some(x => x.error)) {   // sem stop não há posição: fecha logo
            const cpx = slipPx(c.mid, !isBuy, c.szDecimals);
            const cl = await post({ type: 'order', orders: [orderWire(c.asset, !isBuy, cpx, fsz, true, ioc)], grouping: 'na' });
            res.results.push({ op: 'open', market: k, ok: false, detail: { motivo: 'stop não aceite; posição fechada', prot, fechado: statuses(cl) }, ...fillInfo(s0, isBuy, c.mid) });
            continue;
          }
          res.results.push({ op: 'open', market: k, ok: true, filled: s0.filled, stops: ps, usd: +(fsz * (parseFloat(s0.filled.avgPx) || px)).toFixed(2), ...fillInfo(s0, isBuy, c.mid) });
        }
      }
    }
    return res;
  }

  // histórico de velas para o teste histórico (só leitura). A Hyperliquid só guarda as últimas 5000 velas por mercado.
  const IV_MS = { '15m': 9e5, '1h': 36e5, '4h': 144e5 };
  async function candles(interval = '15m', days = 50) {
    const ms = IV_MS[interval];
    if (!ms) throw new Error('intervalo inválido (15m, 1h ou 4h)');
    const d = await discover();
    const end = Date.now(), start = Math.floor(end - Math.min(Math.max(+days || 1, 1) * 864e5, 5000 * ms));
    const markets = {};
    for (const k of MARKET_KEYS) {
      const c = d.resolved[k];
      if (!c) { markets[k] = null; continue; }
      const arr = await info({ type: 'candleSnapshot', req: { coin: c.coin, interval, startTime: start, endTime: end } });
      markets[k] = { coin: c.coin, bars: (arr || []).map(x => [x.t, +x.o, +x.h, +x.l, +x.c, +x.v]) };
    }
    return { interval, start, end, markets, rejected: d.rejected };
  }

  // execuções reais da conta nos 3 mercados, com a taxa efetivamente cobrada (taker = ordem que atravessou o livro). Serve para MEDIR o custo
  // por lado que o backtest assume (9 bps taker / 3 bps maker): o campo `fee` de cada execução vem da corretora, não é estimado.
  // (Os nomes dos campos de userFills seguem a documentação da Hyperliquid mas não foram verificados contra a API real nesta sessão.)
  async function fills(limit = 200) {
    if (!ADDR.test(env.HL_ACCOUNT || '')) throw new Error('HL_ACCOUNT em falta ou inválido');
    const [arr, d] = await Promise.all([info({ type: 'userFills', user: env.HL_ACCOUNT }), discover()]);
    const mine = new Set(Object.values(d.resolved).filter(Boolean).map(c => c.coin));
    const rows = (Array.isArray(arr) ? arr : []).filter(x => mine.has(x.coin)).slice(0, limit)
      .map(x => ({ t: x.time, coin: x.coin, side: x.side, px: +x.px, sz: +x.sz, fee: +x.fee, taker: !!x.crossed, pnl: +x.closedPnl })).filter(x => x.px > 0 && x.sz > 0 && Number.isFinite(x.fee));
    const bps = a => { const nt = a.reduce((t, x) => t + x.px * x.sz, 0); return nt > 0 ? +((a.reduce((t, x) => t + x.fee, 0) / nt) * 1e4).toFixed(2) : null; };
    return { n: rows.length, takerBps: bps(rows.filter(x => x.taker)), makerBps: bps(rows.filter(x => !x.taker)), nTaker: rows.filter(x => x.taker).length, nMaker: rows.filter(x => !x.taker).length, rows: rows.slice(0, 50) };
  }

  const flatten = () => sync({}, { flattenAll: true });
  return { state, sync, flatten, discover, candles, fills, caps, live, network };
}
