// Memória do worker entre pedidos (Durable Object com SQLite, incluído no plano grátis da Cloudflare).
// Guarda só estado de proteção e registos de execução: máximos da conta, paragens, entradas das memecoins, aprovações, falhas seguidas,
// trava contra pedidos simultâneos e os últimos registos de ordens. Nunca guarda chaves.
export class Guard {
  constructor(state) { this.storage = state.storage; }
  async fetch(req) {
    const { op, key, value, ttl, max, now } = await req.json();
    if (typeof key !== 'string' || !key) return Response.json({ error: 'key' }, { status: 400 });
    if (op === 'get') return Response.json({ value: (await this.storage.get(key)) ?? null });
    if (op === 'put') { await this.storage.put(key, value); return Response.json({ ok: true }); }
    if (op === 'del') { await this.storage.delete(key); return Response.json({ ok: true }); }
    // trava atómica: um único pedido de cada vez (o Durable Object serializa estas operações). Expira sozinha (ttl em ms).
    if (op === 'lock') { const t = Number.isFinite(now) ? now : Date.now(), cur = await this.storage.get(key); if (cur && cur > t) return Response.json({ value: false }); await this.storage.put(key, t + ttl); return Response.json({ value: true }); }
    // registo circular: acrescenta e guarda só os últimos `max`
    if (op === 'push') { const arr = (await this.storage.get(key)) || []; arr.push(value); if (arr.length > max) arr.splice(0, arr.length - max); await this.storage.put(key, arr); return Response.json({ ok: true }); }
    return Response.json({ error: 'op' }, { status: 400 });
  }
}

// sem a ligação GUARD (ex.: worker antigo) devolve null e as funções que precisam de memória ficam desligadas
export function makeStore(env) {
  if (!env.GUARD || typeof env.GUARD.idFromName !== 'function') return null;
  const stub = env.GUARD.get(env.GUARD.idFromName('dollos'));
  const call = async (op, key, extra = {}) => {
    const r = await stub.fetch('https://guard/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, key, ...extra }) });
    const j = await r.json(); if (j.error) throw new Error('memória: ' + j.error);
    return j.value ?? null;
  };
  return {
    get: k => call('get', k), put: (k, v) => call('put', k, { value: v }), del: k => call('del', k),
    push: (k, v, max = 200) => call('push', k, { value: v, max }),
    // devolve true se obteve a trava (e tem de a libertar com unlock), false se outro pedido a tem
    lock: async (k, ttl = 90000, now) => (await call('lock', k, { ttl, now })) === true,
    unlock: k => call('del', k),
  };
}

// para testes: um Durable Object falso que usa a mesma classe Guard
export function fakeNamespace() {
  const m = new Map();
  const storage = { get: async k => (m.has(k) ? structuredClone(m.get(k)) : undefined), put: async (k, v) => { m.set(k, structuredClone(v)); }, delete: async k => { m.delete(k); } };
  const g = new Guard({ storage });
  let chain = Promise.resolve();   // o objeto real processa um pedido de cada vez
  const run = (url, init) => { const p = chain.then(() => g.fetch(new Request(url, init))); chain = p.catch(() => {}); return p; };
  return { idFromName: n => n, get: () => ({ fetch: run }), _map: m };
}
