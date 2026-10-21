// Ciclo 4 (colheita de funding): com funding positivo passa; com funding médio zero não passa (perde os custos).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const script = new URL('../../scripts/research/carry.mjs', import.meta.url).pathname;
for (const flag of [[], ['null']]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c4-')), out = execFileSync(process.execPath, [script, '--synthetic', ...flag, '--out', dir], { encoding: 'utf8', timeout: 250000, stdio: ['ignore', 'pipe', 'pipe'] });
  const s = JSON.parse(fs.readFileSync(path.join(dir, 'resumo.json'), 'utf8'));
  for (const h of ['## Resultados da carteira', '## Decisão', 'Holm, 48 hipóteses', '# Contagens efetivas']) assert.ok(out.includes(h), 'falta ' + h);
  if (flag.length) { assert.equal(s.pass, false); assert.ok(s.test < 0, 'sem funding, os custos dão prejuízo'); } else { assert.equal(s.pass, true); assert.ok(s.test > .03 && s.test < .08, 'retorno coerente com 0,01 %/8 h × 2/3 − custos: ' + s.test); }
}
console.log('ok   carry: funding positivo → candidata (~5 %/ano); funding nulo → não passa');
