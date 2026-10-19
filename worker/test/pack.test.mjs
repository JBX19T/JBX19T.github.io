// O zip do worker tem de ser completo: tudo o que o código e os testes importam (incluindo grokbot/backtest.js) tem de ir dentro.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { closure } from '../../scripts/pack-worker.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { files, missing } = closure();
assert.deepEqual(missing, [], 'imports sem ficheiro: ' + missing.join(', '));
for (const f of ['grokbot/strategy.js', 'grokbot/backtest.js', 'worker/holders.mjs', 'worker/guard.mjs', 'worker/execlog.mjs', 'worker/store.mjs', 'worker/test/fixtures/sol_ref.json', 'worker/wrangler.toml', 'worker/package-lock.json'])
  assert.ok(files.includes(f), 'falta no zip: ' + f);
console.log('ok   fecho de dependências: ' + files.length + ' ficheiros, incluindo grokbot/backtest.js e grokbot/strategy.js');
// extrai o zip para uma pasta limpa e corre um teste que depende de grokbot/backtest.js (o que falhava com o zip antigo)
if (spawnSync('zip', ['-v'], { stdio: 'ignore' }).status !== 0) { console.log('skip zip não instalado'); }
else {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dollos-pack-')), zip = path.join(tmp, 'w.zip'), out = path.join(tmp, 'x');
  execFileSync('node', [path.join(root, 'scripts/pack-worker.mjs'), zip], { stdio: 'ignore' });
  fs.mkdirSync(out); execFileSync('unzip', ['-q', zip, '-d', out]);
  fs.symlinkSync(path.join(root, 'worker/node_modules'), path.join(out, 'worker/node_modules'));   // dependências npm: npm ci num ambiente com rede
  const r = spawnSync('node', ['test/backtest.test.mjs'], { cwd: path.join(out, 'worker'), encoding: 'utf8' });
  assert.equal(r.status, 0, 'o teste do backtest falha a partir do zip extraído:\n' + (r.stderr || '').slice(-400));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('ok   zip extraído numa pasta limpa: o teste do backtest corre e passa');
}
console.log('pack ok');
