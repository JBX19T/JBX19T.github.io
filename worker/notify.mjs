// Notificações no telemóvel pelo ntfy (https://ntfy.sh): app grátis para Android e iPhone, sem conta.
//   NTFY_TOPIC  nome do tópico, longo e difícil de adivinhar (quem souber o nome lê as notificações) — guarda-o como segredo
//   NTFY_URL    servidor (por omissão https://ntfy.sh)
// Nunca envia chaves nem saldos completos; só o que o bot fez.
export function makeNotify(env, f = fetch) {
  const topic = env.NTFY_TOPIC || '';
  const on = /^[A-Za-z0-9_-]{8,64}$/.test(topic);
  const base = (env.NTFY_URL || 'https://ntfy.sh').replace(/\/$/, '');
  async function send(title, message, { priority = 3, tags = [] } = {}) {
    if (!on) return false;
    try {
      const r = await f(base + '/', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic, title: String(title).slice(0, 120), message: String(message).slice(0, 3000), priority, tags }) });
      return r.ok;
    } catch (e) { return false; }
  }
  return { on, send };
}

// resumo legível de uma sincronização (só ordens enviadas de verdade, ou falhas)
export function describe(desk, res) {
  if (!res || res.mode !== 'real') return null;
  const lines = [];
  for (const x of res.results || []) {
    const nm = x.market || (x.mint ? x.mint.slice(0, 4) + '…' + x.mint.slice(-4) : '');
    const what = { open: 'ABRIU', close: 'FECHOU', buy: 'COMPROU', sell: 'VENDEU', cancel: 'CANCELOU ordens' }[x.op] || x.op;
    lines.push(x.ok ? `${what} ${nm}${x.usd ? ' $' + x.usd : ''}` : `FALHOU ${x.op} ${nm}: ${String(x.error || JSON.stringify(x.detail || '')).slice(0, 120)}`);
  }
  if (!lines.length) return null;
  const failed = (res.results || []).some(x => !x.ok);
  return { title: `DOLLOS · ${desk}${failed ? ' · FALHA' : ''}`, message: lines.join('\n'), priority: failed ? 4 : 3, tags: [failed ? 'warning' : 'chart_with_upwards_trend'] };
}
