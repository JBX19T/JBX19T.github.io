// Sondagem das taxas da Hyperliquid (só leitura, API pública): escala de taxas dos mercados lançados por terceiros (HIP-3, dex «xyz») e taxas base.
const URL = 'https://api.hyperliquid.xyz/info';
async function post(body) { const r = await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const t = await r.text(); try { return { status: r.status, json: JSON.parse(t) }; } catch { return { status: r.status, text: t.slice(0, 200) }; } }
const show = (name, x) => console.log(`## ${name} [${x.status}]\n` + (x.json !== undefined ? JSON.stringify(x.json, null, 1).slice(0, 3500) : x.text));
show('perpDexs', await post({ type: 'perpDexs' }));
show('meta dex xyz (primeiros campos)', await (async () => { const x = await post({ type: 'meta', dex: 'xyz' }); if (x.json) { const u = x.json.universe || []; return { status: x.status, json: { keys: Object.keys(x.json), n: u.length, first: u.slice(0, 3), gold: u.filter(m => /GOLD|SP500|EUR/.test(m.name)) } }; } return x; })());
for (const user of ['0x0000000000000000000000000000000000000000', '0x1111111111111111111111111111111111111111']) show('userFees ' + user.slice(0, 6), await post({ type: 'userFees', user }));
show('perpDexStatus xyz', await post({ type: 'perpDexStatus', dex: 'xyz' }));
