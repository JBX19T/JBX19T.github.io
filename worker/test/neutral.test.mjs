// Ciclo 3 (carteira neutra ao mercado): com sinal transversal plantado há candidata; sem sinal é negativo e o TEST fica fechado.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const script = new URL('../../scripts/research/neutral.mjs', import.meta.url).pathname;
for (const flag of [[], ['null']]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c3-')), out = execFileSync(process.execPath, [script, '--synthetic', ...flag, '--small', '--out', dir], { encoding: 'utf8', timeout: 250000, stdio: ['ignore', 'pipe', 'pipe'] });
  const sum = JSON.parse(fs.readFileSync(path.join(dir, 'resumo.json'), 'utf8'));
  for (const h of ['## Etapa 1', '## Etapa 2', '## Etapa 3', '# Contagens efetivas']) assert.ok(out.includes(h), 'falta ' + h);
  assert.equal(sum.nConfigs, 15, '15 configurações pré-registadas'); assert.ok(out.includes('p Holm (47)'), 'Holm sobre 15 + 32');
  if (flag.length) { assert.equal(sum.verdict, 'negativo'); assert.equal(sum.finalists.length, 0); assert.ok(out.includes('o TEST não foi aberto')); } else { assert.equal(sum.verdict, 'candidata'); assert.ok(sum.finalists.length >= 1 && sum.finalists.length <= 2); }
}
console.log('ok   neutral: sinal transversal → candidata; sem sinal → negativo e TEST fechado; 15 configurações, Holm 47');
