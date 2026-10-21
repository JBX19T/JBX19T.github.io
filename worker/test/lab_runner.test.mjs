// O executor do laboratório corre de ponta a ponta com dados sintéticos: controlo negativo sem descobertas, controlo positivo com tendência plantada.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-'));
const out = execFileSync(process.execPath, [new URL('../../scripts/lab-run.mjs', import.meta.url).pathname, '--synthetic', '--small', '--ivs', '4h', '--workers', '2', '--out', dir], { encoding: 'utf8', timeout: 200000 });
for (const h of ['## 1. Dados e partições', '## 2. Testes múltiplos', '## 3. Candidatas e robustez', '## 4.', '## 5.', '## 6.', '## 7. Métodos perigosos', '## 8. Contagens efetivas']) assert.ok(out.includes(h), 'falta a secção ' + h);
const row = tag => out.split('\n').find(l => l.startsWith('| ' + tag));
const cell = (l, i) => l.split('|')[i + 1].trim();
const real = row('real'), nullIid = row('controlo (baralhado)');
assert.ok(real && nullIid, 'linhas de resultados');
const hits = l => cell(l, 8).split('/').map(x => +x.trim());   // camada A / B
assert.deepEqual(hits(nullIid), [0, 0], 'o controlo sem estrutura temporal não produz descobertas: ' + nullIid);
assert.ok(hits(real)[0] > 0, 'com tendência plantada o laboratório encontra-a: ' + real);
for (const f of ['relatorio.md', 'experimentos.jsonl', 'finalistas.json']) assert.ok(fs.existsSync(path.join(dir, f)), f);
const lines = fs.readFileSync(path.join(dir, 'experimentos.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
assert.ok(lines.some(x => x.dados === 'real') && lines.some(x => x.dados === 'null1'), 'resultados positivos e negativos guardados');
console.log('ok   lab runner: controlo negativo 0 descobertas, controlo positivo ' + hits(real).join(' / ') + ', ' + lines.length + ' experiências registadas');
