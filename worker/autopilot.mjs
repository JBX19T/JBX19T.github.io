// Piloto automático no servidor (opcional, DESLIGADO por omissão): o próprio worker corre a estratégia do Macro Desk sobre as velas
// da Hyperliquid e decide as posições, mesmo com a app fechada. Quando está ligado, a app deixa de decidir a Hyperliquid.
//   HL_AUTOPILOT=1      liga (continua em simulação sem HL_LIVE=1, e na rede de teste sem HL_NETWORK=mainnet)
//   HL_STRATEGY         breakout (omissão) | reversion | trend        HL_INTERVAL   15m (omissão) | 1h | 4h
// Usa exatamente as mesmas regras (grokbot/strategy.js) que o desk e o teste histórico. Os stops e alvos ficam na própria Hyperliquid.
// Trava: só abre posições novas se a estratégia e as velas tiverem passado o teste histórico na app há menos de 45 dias
// (a app envia a aprovação para POST /hl/approve). Sem isso só gere o que já existe (stop móvel, limite de tempo).
import DS from '../grokbot/strategy.js';
import { MARKET_KEYS } from './hl.mjs';

const IV_MS = { '1m': 6e4, '5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5 };
const WINDOW_MS = 6 * 60e3;   // só decide nos primeiros minutos depois do fecho de uma vela (o cron corre a cada 5 min)

export function autopilotCfg(env) {
  const iv = IV_MS[env.HL_INTERVAL] ? env.HL_INTERVAL : '15m';
  const strategy = DS.PRESETS[env.HL_STRATEGY] ? env.HL_STRATEGY : 'breakout';
  return { on: env.HL_AUTOPILOT === '1', iv, ms: IV_MS[iv], strategy, label: DS.PRESETS[strategy].label };
}

export async function runAutopilot({ env, hl, store, notify, now = Date.now(), st = null, blockOpen = null, force = false }) {
  const A = autopilotCfg(env);
  if (!A.on || !hl) return null;
  if (!force && now % A.ms > WINDOW_MS) return { waiting: true };
  const cfg = DS.withStrategy({ ...DS.DEFAULTS }, A.strategy);
  const S = DS.make(cfg, MARKET_KEYS.length);
  st ??= await hl.state();
  const c = await hl.candles(A.iv, Math.ceil(210 * A.ms / 864e5));
  const ap = (await store.get('autopilot')) || { lastBar: {}, opened: {} };
  ap.atr ??= {};
  const approvals = (await store.get('approvals')) || {};
  const approved = DS.approvalOk(approvals[A.strategy + '|' + A.iv], A.strategy, A.iv, now);
  if (!approved) blockOpen = blockOpen || `sem aprovação do teste histórico para ${A.label} · ${A.iv}`;
  if (DS.isScalp(A.strategy, A.iv)) blockOpen = 'scalping não é executado em real: o worker sincroniza de 5 em 5 min';
  const desired = {}, notes = {}, barOf = {}, atrOf = {};
  for (const k of MARKET_KEYS) {
    const coin = st.markets && st.markets[k] && st.markets[k].coin;
    const pos = coin && (st.positions || []).find(p => p.coin === coin && p.szi !== 0);
    const m = c.markets && c.markets[k];
    const bars = m && m.bars ? m.bars.map(a => ({ t: a[0], o: a[1], h: a[2], l: a[3], c: a[4] })).filter(b => b.t + A.ms <= now).slice(-200) : [];
    const lastT = bars.length ? bars[bars.length - 1].t : null;
    if (pos) {   // em posição: mantém (stop e alvo estão na corretora) até ao limite de tempo
      ap.opened[k] ??= lastT || now;
      const held = lastT ? Math.round((lastT - ap.opened[k]) / A.ms) : 0;
      if (held >= cfg.maxHoldBars) { notes[k] = `limite de ${cfg.maxHoldBars} velas: fecha`; continue; }
      desired[k] = { side: pos.szi > 0 ? 'long' : 'short', frac: 0 };
      if (cfg.trailATR > 0 && bars.length) {   // stop móvel: melhor preço desde a entrada menos 3×ATR (a corretora só o aperta)
        const side = pos.szi > 0 ? 1 : -1, since = bars.filter(b => b.t >= ap.opened[k]), atr = ap.atr[k] || S.atr(bars, cfg.atrN);
        if (since.length && atr > 0) {
          const best = side > 0 ? Math.max(...since.map(b => b.h)) : Math.min(...since.map(b => b.l));
          desired[k].slPx = +(best - side * cfg.trailATR * atr).toPrecision(6);
        }
      }
      notes[k] = `em posição há ${held} velas`;
      continue;
    }
    delete ap.opened[k];
    if (!lastT) { notes[k] = 'sem velas'; continue; }
    if (ap.lastBar[k] === lastT) { notes[k] = 'vela já avaliada'; continue; }
    ap.lastBar[k] = lastT;
    const sig = S.signal(bars);
    notes[k] = sig.why;
    if (sig.dir !== 'long' && sig.dir !== 'short') continue;
    const entry = bars[bars.length - 1].c, stopDist = cfg.stopATR * sig.atr;
    desired[k] = { side: sig.dir, frac: +S.sizeFor(1, entry, stopDist).toFixed(4), slPct: +(stopDist / entry).toFixed(5), tpPct: S.hasTarget ? +(cfg.tpATR * sig.atr / entry).toFixed(5) : null };
    barOf[k] = lastT; atrOf[k] = sig.atr;
  }
  const res = await hl.sync(desired, { blockOpen });
  for (const x of res.results || []) if (x.op === 'open' && x.ok) { ap.opened[x.market] = barOf[x.market] || now; ap.atr[x.market] = atrOf[x.market]; }
  for (const k of Object.keys(ap.atr)) if (!ap.opened[k]) delete ap.atr[k];
  ap.last = { t: now, notes, plan: res.plan, skipped: res.skipped, mode: res.mode, approved };
  await store.put('autopilot', ap);
  const moves = (res.plan || []).filter(p => p.op === 'open' || p.op === 'close');
  if (res.mode !== 'real' && moves.length)
    await notify.send('DOLLOS · piloto automático (simulação)', moves.map(p => p.op === 'open' ? `Abriria ${p.side === 'buy' ? 'LONG' : 'SHORT'} ${p.market} $${p.usd} · SL ${p.sl} · TP ${p.tp}` : `Fecharia ${p.market}`).join('\n'), { tags: ['robot'] });
  return { desired, res, notes, approved };
}
