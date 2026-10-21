// Ciclo 1 (previsão conjunta com limiar de custo): com sinal plantado encontra finalistas e candidatas; sem sinal, não encontra nada; o TEST só abre para finalistas.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const script = new URL('../../scripts/research/edgemap.mjs', import.meta.url).pathname;
const run = flag => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c1-')); const out = execFileSync(process.execPath, [script, '--synthetic', ...flag, '--small', '--out', dir], { encoding: 'utf8', timeout: 250000, stdio: ['ignore', 'pipe', 'pipe'] }); return { out, dir }; };
const real = run([]), nul = run(['null']);
for (const h of ['## Etapa 1', '## Etapa 2', '## Etapa 3', '## Diagnósticos exploratórios', '# Contagens efetivas']) assert.ok(real.out.includes(h) && nul.out.includes(h), 'falta ' + h);
const sum = d => JSON.parse(fs.readFileSync(path.join(d, 'resumo.json'), 'utf8'));
assert.equal(sum(real.dir).verdict, 'candidata', 'com sinal plantado há candidata');
assert.ok(sum(real.dir).finalists.length >= 1 && sum(real.dir).finalists.length <= 2, 'no máximo 2 finalistas vão a TEST');
assert.equal(sum(nul.dir).verdict, 'negativo', 'sem sinal o resultado é negativo');
assert.equal(sum(nul.dir).finalists.length, 0);
assert.ok(nul.out.includes('o TEST não foi aberto'), 'TEST não se abre sem finalistas');
assert.equal(sum(real.dir).nConfigs, 16, '16 configurações pré-registadas');
console.log('ok   edgemap: sinal plantado → candidata; sem sinal → negativo e TEST fechado; 16 configurações');
