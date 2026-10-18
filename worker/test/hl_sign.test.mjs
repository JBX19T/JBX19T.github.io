import fs from 'node:fs';
import { signL1, actionHash, addressOf, toHex, floatToWire, roundPx, roundSz } from '../hl.mjs';
const ref = JSON.parse(fs.readFileSync(new URL('./fixtures/hl_ref.json', import.meta.url),'utf8'));
const KEY = '0x' + '11'.repeat(32);
let bad = 0;
console.log('endereço', addressOf(KEY) === ref.address ? 'ok' : 'FAIL ' + addressOf(KEY) + ' vs ' + ref.address);
for (const c of ref.cases) {
  const h = toHex(actionHash(c.action, c.nonce));
  const s = signL1(KEY, c.action, c.nonce, c.mainnet);
  const okH = h === c.hash, okS = s.r === c.sig.r && s.s === c.sig.s && s.v === c.sig.v;
  if (!okH || !okS) bad++;
  console.log(okH && okS ? 'ok  ' : 'FAIL', c.name, okH ? '' : 'hash ' + h + ' != ' + c.hash, okS ? '' : JSON.stringify(s) + ' != ' + JSON.stringify(c.sig));
}
for (const [x, w] of ref.floats) { let g; try { g = floatToWire(x); } catch (e) { g = 'ERR'; } if (g !== w) { bad++; console.log('FAIL float', x, g, w); } }
console.log('floats conferidos:', ref.floats.length);
console.log('roundPx 4172.4567/sd4', roundPx(4172.4567, 4), 'roundSz', roundSz(0.00241999, 4));
process.exit(bad ? 1 : 0);
