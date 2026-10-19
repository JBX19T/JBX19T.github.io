// Proteção no servidor: corre a cada 5 minutos (cron da Cloudflare), mesmo com a app fechada. Só FECHA, VENDE e PÕE STOPS; nunca abre nada.
//   Hyperliquid: se o saldo total cair HL_GUARD_DD (20%) desde o máximo, fecha tudo e não deixa abrir mais até tocares em RETOMAR.
//                Se o fecho falhar, INSISTE a cada 5 min até a posição desaparecer. Garante que cada posição tem stop (repõe-no se faltar).
//   Solana:      vende uma memecoin se cair SOL_GUARD_SL (30%) ou subir SOL_GUARD_TP (100%) face à entrada, se estiver há mais de
//                SOL_GUARD_MAX_HOURS (6 h) na carteira, ou — se a app não sincronizar há SOL_STALE_MIN (30 min; 0 desliga) — vende tudo.
//                Depois de vendida pela proteção, a app não a volta a comprar durante 6 h. Um token que já estava na carteira sem
//                registo de entrada ADOTA o valor atual como base (nunca é vendido como se tivesse subido milhares de %).
//   Cegueira:    se a proteção não conseguir ler a corretora 3 vezes seguidas (15 min) avisa; volta a avisar a cada 6 h e quando recupera.
//   Em simulação (sem HL_LIVE / SOL_LIVE) não envia nada: só avisa o que faria.
import { recordExec } from './execlog.mjs';
const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : d; };
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const short = m => m.slice(0, 4) + '…' + m.slice(-4);
const BLOCK_H = 6, WARN_H = 6, BLIND_AFTER = 3, BLIND_REPEAT = 72;   // 72 ciclos de 5 min = 6 h

export function guardCfg(env) {
  return {
    hlDD: clamp(num(env.HL_GUARD_DD, 0.2), 0.02, 0.9),
    solSL: clamp(num(env.SOL_GUARD_SL, 0.3), 0.05, 0.95),
    solTP: clamp(num(env.SOL_GUARD_TP, 1), 0.1, 50),
    solMaxH: clamp(num(env.SOL_GUARD_MAX_HOURS, 6), 0.5, 720),
    solStaleMin: num(env.SOL_STALE_MIN, 30),
  };
}
export const totalEquity = st => Object.values((st && st.account) || {}).reduce((s, v) => s + (+v || 0), 0);

// corre fn com a trava da plataforma; se outro pedido a tem (ex.: a app a sincronizar), salta este ciclo
async function withLock(store, name, now, fn) {
  if (!store.lock) return fn();
  if (!(await store.lock(name, 90000, now))) return { skipped: 'ocupado: outra sincronização em curso' };
  try { return await fn(); } finally { await store.unlock(name); }
}

export async function guardHL({ env, hl, store, notify, now = Date.now(), st = null }) {
  if (!hl) return { skipped: 'Hyperliquid não configurada' };
  const C = guardCfg(env);
  st ??= await hl.state();
  const eq = totalEquity(st), held = (st.positions || []).filter(p => p.szi !== 0);
  const g = (await store.get('hlGuard')) || { peak: 0, halted: null };
  const out = { eq, st };
  if (!g.halted) {
    if (eq > g.peak) g.peak = eq;
    if (g.peak > 0 && eq <= g.peak * (1 - C.hlDD)) {
      const r = await hl.flatten(), failed = (r.results || []).filter(x => x.ok === false);
      g.halted = { t: now, eq, peak: g.peak, mode: r.mode, retries: 0 };
      out.action = 'flatten'; out.result = r;
      await recordExec(store, 'hl', r, now);
      await notify.send('DOLLOS · Hyperliquid PARADA',
        `O saldo caiu ${((1 - eq / g.peak) * 100).toFixed(1)}% desde o máximo ($${g.peak.toFixed(2)} → $${eq.toFixed(2)}). ` +
        (r.mode !== 'real' ? 'Simulação: nada foi enviado. ' : failed.length ? `A proteção não conseguiu fechar ${failed.length} ordem(ns): vai insistir a cada 5 min. Confirma já na Hyperliquid. ` : 'Fechei todas as posições. ') +
        'Não abro mais nada até tocares em RETOMAR no painel HYPERLIQUID. (Se só levantaste dinheiro, toca em RETOMAR.)',
        { priority: 5, tags: ['rotating_light'] });
    } else if (hl.live && ((held.length && held.some(p => p.stop === null && !p.ordersShapeUnknown)) || (!held.length && st.openOrders > 0))) {   // posição sem stop, ou ordens órfãs sem posição
      // há uma posição sem stop (ex.: a ligação caiu entre a entrada e o stop): repõe-o (ou fecha se o preço já passou o nível); ordens órfãs: cancela
      const r = await withLock(store, 'lock:hl', now, () => hl.sync({}, { keepHeld: true, blockOpen: 'proteção do servidor' }));
      out.action = 'protect'; out.result = r;
      if (r.results) {
        await recordExec(store, 'hl', r, now);
        const fixed = r.results.filter(x => x.op === 'stop' || x.op === 'close');
        if (fixed.length) await notify.send('DOLLOS · Hyperliquid · proteção', `Uma posição estava sem stop: ${fixed.map(x => `${x.op === 'stop' ? 'repus o stop' : 'fechei'} ${x.market}${x.ok ? '' : ' (FALHOU)'}`).join('; ')}.`, { priority: 4, tags: ['shield'] });
      }
    }
  } else if (held.length && hl.live) {
    // já estava parada, mas ainda há posições abertas: o fecho anterior falhou ou foi parcial. Insiste.
    const r = await hl.flatten(), failed = (r.results || []).filter(x => x.ok === false);
    g.halted.retries = (g.halted.retries || 0) + 1;
    out.action = 'flatten-retry'; out.result = r;
    await recordExec(store, 'hl', r, now);
    if (failed.length && (g.halted.retries === 1 || g.halted.retries % 6 === 0))
      await notify.send('DOLLOS · Hyperliquid · fecho em falta', `Continuam ${held.length} posição(ões) abertas depois da paragem e a proteção não conseguiu fechar (tentativa ${g.halted.retries}). Confirma na Hyperliquid.`, { priority: 5, tags: ['rotating_light'] });
  }
  await store.put('hlGuard', { peak: g.peak, halted: g.halted });
  out.peak = g.peak; out.halted = g.halted;
  return out;
}

export async function guardSol({ env, sol, store, notify, now = Date.now() }) {
  if (!sol) return { skipped: 'Solana não configurada' };
  const C = guardCfg(env);
  return withLock(store, 'lock:sol', now, async () => {
    const st = await sol.state();
    const entries = (await store.get('solEntries')) || {}, block = (await store.get('solBlock')) || {}, warned = (await store.get('solWarned')) || {};
    const fails = (await store.get('solSellFails')) || {};
    const beat = (await store.get('solBeat')) || 0;
    const held = new Set(st.tokens.map(t => t.mint));
    for (const m of Object.keys(entries)) if (!held.has(m)) delete entries[m];
    for (const m of Object.keys(fails)) if (!held.has(m)) delete fails[m];
    for (const m of Object.keys(block)) if (block[m] <= now) delete block[m];
    for (const m of Object.keys(warned)) if (warned[m] <= now - WARN_H * 36e5) delete warned[m];
    const silentMs = beat ? now - beat : 0;
    const stale = C.solStaleMin > 0 && beat > 0 && silentMs > C.solStaleMin * 60e3;
    const actions = [];
    for (const t of st.tokens) {
      const value = await sol.valueOf(t.mint, t.rawAmount);
      let e = entries[t.mint];
      if (!e) e = entries[t.mint] = { t: now, usd: null, adopted: true };   // já estava na carteira sem registo: conta a partir de agora
      if (e.usd == null && value != null) e.usd = value;
      const basis = e.usd, age = now - e.t;
      let why = null;
      if (stale) why = `a app não sincroniza há ${Math.round(silentMs / 60e3)} min`;
      else if (basis > 0 && value != null && value <= basis * (1 - C.solSL)) why = `stop do servidor: vale $${value.toFixed(2)} (base $${basis.toFixed(2)})`;
      else if (basis > 0 && value != null && value >= basis * (1 + C.solTP)) why = `alvo do servidor: vale $${value.toFixed(2)} (base $${basis.toFixed(2)})`;
      else if (age > C.solMaxH * 36e5) why = `mais de ${C.solMaxH} h na carteira`;
      if (!why) continue;
      if (!sol.live && warned[t.mint]) continue;   // simulação: avisa uma vez a cada 6 h
      const r = await sol.sellOne(t.mint, st), x = r.results[0] || null;
      if (x && x.ok && !x.simulated && basis > 0 && x.quote) x.pnlUsd = +(parseInt(x.quote.outAmount, 10) / 1e6 - basis).toFixed(4);   // resultado realizado desta memecoin
      await recordExec(store, 'sol', r, now);
      actions.push({ mint: t.mint, why, value, mode: r.mode, ok: x ? x.ok : false, error: x && x.error });
      block[t.mint] = now + BLOCK_H * 36e5;
      if (!sol.live) warned[t.mint] = now; else if (x && x.ok) { delete entries[t.mint]; delete fails[t.mint]; }
      const failedReal = r.mode === 'real' && x && !x.ok;
      if (failedReal) fails[t.mint] = (fails[t.mint] || 0) + 1;
      if (failedReal && !(fails[t.mint] === 1 || fails[t.mint] === 3 || fails[t.mint] % 12 === 0)) continue;   // sem spam: 1.ª, 3.ª e depois de hora a hora
      const head = r.mode !== 'real' ? 'Simulação: venderia' : x && x.ok ? 'VENDI' : `FALHOU a venda (tentativa ${fails[t.mint]}) de`;
      const hint = failedReal && /rota/i.test(x.error || '') ? '\nSem rota de saída: pode ser um rug ou falta de liquidez; o token continua na carteira.' : '';
      await notify.send('DOLLOS · Solana · proteção', `${head} ${short(t.mint)} — ${why}${x && !x.ok ? '\n' + x.error : ''}${hint}`, { priority: failedReal ? 5 : 4, tags: ['shield'] });
    }
    await store.put('solEntries', entries); await store.put('solBlock', block); await store.put('solWarned', warned); await store.put('solSellFails', fails);
    return { tokens: st.tokens.length, stale, actions };
  });
}

export async function runGuard({ env, hl, sol, store, notify, now = Date.now() }) {
  const out = {};
  try { out.hl = await guardHL({ env, hl, store, notify, now }); } catch (e) { out.hl = { error: String(e.message || e) }; }
  try { out.sol = await guardSol({ env, sol, store, notify, now }); } catch (e) { out.sol = { error: String(e.message || e) }; }
  // cegueira: se não conseguir ler a corretora várias vezes seguidas, a proteção não está a proteger. Avisa (sem repetir a cada ciclo).
  const fails = (await store.get('guardFails')) || { hl: 0, sol: 0 };
  for (const [k, nome] of [['hl', 'Hyperliquid'], ['sol', 'Solana']]) {
    const x = out[k]; if (!x || x.skipped) continue;
    if (x.error) {
      fails[k] = (fails[k] || 0) + 1;
      if (fails[k] === BLIND_AFTER || (fails[k] > BLIND_AFTER && (fails[k] - BLIND_AFTER) % BLIND_REPEAT === 0))
        await notify.send(`DOLLOS · proteção sem dados (${nome})`, `Há ${fails[k] * 5} min que a proteção não consegue ler a ${nome}: ${String(x.error).slice(0, 120)}. Enquanto isto, só os stops que já estão na corretora te protegem.`, { priority: 5, tags: ['warning'] });
    } else {
      if ((fails[k] || 0) >= BLIND_AFTER) await notify.send(`DOLLOS · proteção recuperada (${nome})`, `A proteção voltou a ler a ${nome}.`, { priority: 3, tags: ['white_check_mark'] });
      fails[k] = 0;
    }
  }
  await store.put('guardFails', fails);
  const brief = x => (x ? { error: x.error, skipped: x.skipped, action: x.action, actions: x.actions && x.actions.length, halted: !!x.halted } : null);
  await store.put('guardLast', { t: now, hl: brief(out.hl), sol: brief(out.sol), fails });
  return out;
}
