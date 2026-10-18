// Memória do worker entre pedidos (Durable Object com SQLite, incluído no plano grátis da Cloudflare).
// Guarda só estado da proteção: máximo da conta, paragens, hora da última sincronização da app, entradas das memecoins.
// Nunca guarda chaves.
export class Guard {
  constructor(state) { this.storage = state.storage; }
  async fetch(req) {
    const { op, key, value } = await req.json();
    if (typeof key !== 'string' || !key) return Response.json({ error: 'key' }, { status: 400 });
    if (op === 'get') return Response.json({ value: (await this.storage.get(key)) ?? null });
    if (op === 'put') { await this.storage.put(key, value); return Response.json({ ok: true }); }
    if (op === 'del') { await this.storage.delete(key); return Response.json({ ok: true }); }
    return Response.json({ error: 'op' }, { status: 400 });
  }
}

// sem a ligação GUARD (ex.: worker antigo) devolve null e as funções que precisam de memória ficam desligadas
export function makeStore(env) {
  if (!env.GUARD || typeof env.GUARD.idFromName !== 'function') return null;
  const stub = env.GUARD.get(env.GUARD.idFromName('dollos'));
  const call = async (op, key, value) => {
    const r = await stub.fetch('https://guard/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op, key, value }) });
    const j = await r.json(); if (j.error) throw new Error('memória: ' + j.error);
    return j.value ?? null;
  };
  return { get: k => call('get', k), put: (k, v) => call('put', k, v), del: k => call('del', k) };
}

// para testes: um Durable Object falso que usa a mesma classe Guard
export function fakeNamespace() {
  const m = new Map();
  const storage = { get: async k => (m.has(k) ? structuredClone(m.get(k)) : undefined), put: async (k, v) => { m.set(k, structuredClone(v)); }, delete: async k => { m.delete(k); } };
  const g = new Guard({ storage });
  return { idFromName: n => n, get: () => ({ fetch: (url, init) => g.fetch(new Request(url, init)) }), _map: m };
}
