// Proteção no servidor: corre a cada 5 minutos (cron da Cloudflare), mesmo com a app fechada. Só FECHA e VENDE; nunca abre nada.
//   Hyperliquid: se o saldo total cair HL_GUARD_DD (20%) desde o máximo, fecha tudo e não deixa abrir mais até tocares em RETOMAR.
//   Solana:      vende uma memecoin se cair SOL_GUARD_SL (30%) ou subir SOL_GUARD_TP (100%) face à entrada, se estiver há mais de
//                SOL_GUARD_MAX_HOURS (6 h) na carteira, ou — se a app não sincronizar há SOL_STALE_MIN (30 min; 0 desliga) — vende tudo.
//                Depois de vendida pela proteção, a app não a volta a comprar durante 6 h.
//   Em simulação (sem HL_LIVE / SOL_LIVE) não envia nada: só avisa o que faria.
const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : d; };
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const short = m => m.slice(0, 4) + '…' + m.slice(-4);
const BLOCK_H = 6, WARN_H = 6;

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

export async function guardHL({ env, hl, store, notify, now = Date.now(), st = null }) {
  if (!hl) return { skipped: 'Hyperliquid não configurada' };
  const C = guardCfg(env);
  st ??= await hl.state();
  const eq = totalEquity(st);
  const g = (await store.get('hlGuard')) || { peak: 0, halted: null };
  const out = { eq, st };
  if (!g.halted) {
    if (eq > g.peak) g.peak = eq;
    if (g.peak > 0 && eq <= g.peak * (1 - C.hlDD)) {
      const r = await hl.flatten();
      g.halted = { t: now, eq, peak: g.peak, mode: r.mode };
      out.action = 'flatten'; out.result = r;
      await notify.send('DOLLOS · Hyperliquid PARADA',
        `O saldo caiu ${((1 - eq / g.peak) * 100).toFixed(1)}% desde o máximo ($${g.peak.toFixed(2)} → $${eq.toFixed(2)}). ` +
        (r.mode === 'real' ? 'Fechei todas as posições. ' : 'Simulação: nada foi enviado. ') +
        'Não abro mais nada até tocares em RETOMAR no painel HYPERLIQUID. (Se só levantaste dinheiro, toca em RETOMAR.)',
        { priority: 5, tags: ['rotating_light'] });
    }
  }
  await store.put('hlGuard', { peak: g.peak, halted: g.halted });
  out.peak = g.peak; out.halted = g.halted;
  return out;
}

export async function guardSol({ env, sol, store, notify, now = Date.now() }) {
  if (!sol) return { skipped: 'Solana não configurada' };
  const C = guardCfg(env);
  const st = await sol.state();
  const entries = (await store.get('solEntries')) || {}, block = (await store.get('solBlock')) || {}, warned = (await store.get('solWarned')) || {};
  const beat = (await store.get('solBeat')) || 0;
  const held = new Set(st.tokens.map(t => t.mint));
  for (const m of Object.keys(entries)) if (!held.has(m)) delete entries[m];
  for (const m of Object.keys(block)) if (block[m] <= now) delete block[m];
  for (const m of Object.keys(warned)) if (warned[m] <= now - WARN_H * 36e5) delete warned[m];
  const silentMs = beat ? now - beat : 0;
  const stale = C.solStaleMin > 0 && beat > 0 && silentMs > C.solStaleMin * 60e3;
  const actions = [];
  for (const t of st.tokens) {
    const e = entries[t.mint], basis = (e && e.usd) || sol.ticket, age = e ? now - e.t : null;
    const value = await sol.valueOf(t.mint, t.rawAmount);
    let why = null;
    if (stale) why = `a app não sincroniza há ${Math.round(silentMs / 60e3)} min`;
    else if (value != null && value <= basis * (1 - C.solSL)) why = `stop do servidor: vale $${value.toFixed(2)} (entrada $${basis.toFixed(2)})`;
    else if (value != null && value >= basis * (1 + C.solTP)) why = `alvo do servidor: vale $${value.toFixed(2)} (entrada $${basis.toFixed(2)})`;
    else if (age != null && age > C.solMaxH * 36e5) why = `mais de ${C.solMaxH} h na carteira`;
    if (!why) continue;
    if (!sol.live && warned[t.mint]) continue;   // simulação: avisa uma vez a cada 6 h
    const r = await sol.sellOne(t.mint, st), x = r.results[0] || null;
    actions.push({ mint: t.mint, why, value, mode: r.mode, ok: x ? x.ok : false, error: x && x.error });
    block[t.mint] = now + BLOCK_H * 36e5;
    if (!sol.live) warned[t.mint] = now; else if (x && x.ok) delete entries[t.mint];
    const head = r.mode !== 'real' ? 'Simulação: venderia' : x && x.ok ? 'VENDI' : 'FALHOU a venda de';
    await notify.send('DOLLOS · Solana · proteção', `${head} ${short(t.mint)} — ${why}${x && !x.ok ? '\n' + x.error : ''}`, { priority: x && !x.ok && r.mode === 'real' ? 5 : 4, tags: ['shield'] });
  }
  await store.put('solEntries', entries); await store.put('solBlock', block); await store.put('solWarned', warned);
  return { tokens: st.tokens.length, stale, actions };
}

export async function runGuard({ env, hl, sol, store, notify, now = Date.now() }) {
  const out = {};
  try { out.hl = await guardHL({ env, hl, store, notify, now }); } catch (e) { out.hl = { error: String(e.message || e) }; }
  try { out.sol = await guardSol({ env, sol, store, notify, now }); } catch (e) { out.sol = { error: String(e.message || e) }; }
  const brief = x => (x ? { error: x.error, skipped: x.skipped, action: x.action, actions: x.actions && x.actions.length, halted: !!x.halted } : null);
  await store.put('guardLast', { t: now, hl: brief(out.hl), sol: brief(out.sol) });
  return out;
}
