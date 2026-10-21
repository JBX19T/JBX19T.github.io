// Fase 2 do laboratório (auditoria, diagnóstico do rompimento, hipóteses independentes) corre de ponta a ponta com dados sintéticos.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab2-'));
const out = execFileSync(process.execPath, [new URL('../../scripts/lab2.mjs', import.meta.url).pathname, '--synthetic', '--small', '--workers', '2', '--out', dir], { encoding: 'utf8', timeout: 250000, stdio: ['ignore', 'pipe', 'pipe'] });
for (const h of ['# Parte A', '## A1.', '## A4.', '## A5.', '## A6.', '## A7.', '# Parte B', '### B1.', '### B2.', '### B3.', '# Parte C', '## Decisão', '## H1: estabilidade por ano', '## H1: sensibilidade aos parâmetros']) assert.ok(out.includes(h), 'falta a secção ' + h);
assert.ok(!out.includes('ERRO na parte'), 'sem erros nas partes');
const dec = out.split('## Decisão')[1].split('\n').filter(l => /^\| H[1-4] /.test(l)); assert.equal(dec.length, 4, 'as 4 hipóteses pré-registadas');
for (const l of dec) assert.ok(/aprovada para paper|inconclusiva|rejeitada/.test(l), 'classificação: ' + l.slice(0, 60));
const grid = out.split('## H1: sensibilidade')[1].split('\n').filter(l => /^\| (10|20|40) \|/.test(l)); assert.equal(grid.length, 27, '27 combinações de parâmetros');
for (const f of ['relatorio-fase2.md', 'parte-A.md', 'parte-B.md', 'parte-C.md']) assert.ok(fs.existsSync(path.join(dir, f)), f);
console.log('ok   lab2: partes A, B e C completas; 4 hipóteses classificadas; 27 combinações de sensibilidade');
