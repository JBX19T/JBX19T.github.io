#!/usr/bin/env node
// Empacota o worker num .zip COMPLETO: calcula os ficheiros de que o código e os testes dependem (imports/requires relativos), incluindo
// os que vivem fora de worker/ (grokbot/strategy.js, grokbot/backtest.js). O zip enviado antes não levava grokbot/backtest.js e o teste
// do backtest falhava ao ser extraído sozinho. Uso:  node scripts/pack-worker.mjs [saida.zip]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXED = ['worker/package.json', 'worker/package-lock.json', 'worker/wrangler.toml', 'worker/README.md', 'worker/.gitignore'];
const REL = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
const URLREL = /new URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url/g;

const exists = f => fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile();
const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
const resolveRel = (from, spec) => {
  const base = path.normalize(path.join(path.dirname(from), spec));
  for (const c of [base, base + '.js', base + '.mjs', path.join(base, 'index.js')]) if (exists(c)) return c;
  return null;
};

export function closure() {
  const entries = walk('worker').filter(f => /\.(mjs|js)$/.test(f) && !f.includes('node_modules'));
  const seen = new Set(), missing = [], queue = [...entries];
  while (queue.length) {
    const f = queue.pop(); if (seen.has(f)) continue; seen.add(f);
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const re of [REL, URLREL]) { re.lastIndex = 0; let m; while ((m = re.exec(src))) {
      const r = resolveRel(f, m[1]);
      if (!r) { if (!/fixtures\//.test(m[1])) missing.push(`${f} -> ${m[1]}`); continue; }
      if (/\.(mjs|js)$/.test(r)) queue.push(r); else seen.add(r);
    } }
  }
  for (const f of walk('worker/test/fixtures')) seen.add(f);
  for (const f of FIXED) if (exists(f)) seen.add(f);
  return { files: [...seen].map(f => f.split(path.sep).join('/')).sort(), missing };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, missing } = closure();
  if (missing.length) { console.error('Dependências em falta:\n' + missing.join('\n')); process.exit(1); }
  const out = path.resolve(process.argv[2] || path.join(root, 'dist', 'dollos-worker.zip'));
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.rmSync(out, { force: true });
  execFileSync('zip', ['-q', out, ...files], { cwd: root });
  console.log(`${files.length} ficheiros -> ${out}`); console.log(files.join('\n'));
}
