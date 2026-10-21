// Leitor de zip e de CSV de funding (Binance data vision) e modo --funding do Ciclo 1/2.
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { unzipFirst, parseFundingCsv } from '../../scripts/research/lib/funding.mjs';
import { fundingGrid } from '../../scripts/research/lib/panel.mjs';
function makeZip(name, text, deflate = true) {
  const raw = Buffer.from(text), comp = deflate ? zlib.deflateRawSync(raw) : raw, nm = Buffer.from(name);
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(deflate ? 8 : 0, 8); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(nm.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(deflate ? 8 : 0, 10); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(raw.length, 24); cd.writeUInt16LE(nm.length, 28); cd.writeUInt32LE(0, 42);
  const body = Buffer.concat([lh, nm, comp]), cdOff = body.length, cdAll = Buffer.concat([cd, nm]), eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(cdAll.length, 12); eocd.writeUInt32LE(cdOff, 16);
  return Buffer.concat([body, cdAll, eocd]);
}
const csv = 'calc_time,funding_interval_hours,last_funding_rate\n1609459200000,8,0.00010000\n1609488000000,8,-0.00005000\n';
for (const d of [true, false]) assert.equal(unzipFirst(makeZip('x.csv', csv, d)).toString(), csv, 'zip ' + (d ? 'deflate' : 'store'));
const ev = parseFundingCsv(csv); assert.deepEqual(ev, [{ t: 1609459200000, r: 1e-4 }, { t: 1609488000000, r: -5e-5 }]);
// grelha: causal (um evento só é visto depois do fim da barra em que ocorre) e soma acumulada em bps
const t0 = Date.UTC(2021, 0, 1), events = Array.from({ length: 400 }, (_, i) => ({ t: t0 + i * 8 * 36e5, r: i % 2 ? -1e-4 : 1e-4 }));
const g = fundingGrid(events, t0, 24 * 40);
assert.equal(g.last[0], 1, 'o evento de t0 (+1 bps) vê-se no fim da barra 0'); assert.ok(Number.isNaN(g.m3[0]), 'média só com 9 eventos');
assert.equal(g.cum[0], 0); assert.ok(Math.abs(g.cum[1] - 1) < 1e-9); assert.ok(Math.abs(g.cum[9] - 0) < 1e-9, '+1 −1'); assert.ok(Math.abs(g.cum[17] - 1) < 1e-9);
for (const flag of [[], ['null']]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c2-')); const out = execFileSync(process.execPath, [new URL('../../scripts/research/edgemap.mjs', import.meta.url).pathname, '--synthetic', ...flag, '--funding', '--small', '--out', dir], { encoding: 'utf8', timeout: 250000, stdio: ['ignore', 'pipe', 'pipe'] });
  const sum = JSON.parse(fs.readFileSync(path.join(dir, 'resumo.json'), 'utf8')); assert.ok(out.includes('Ciclo 2') && out.includes('p Holm (32)'), 'Holm sobre 16 + 16 acumuladas');
  if (flag.length) { assert.equal(sum.verdict, 'negativo'); assert.ok(out.includes('o TEST não foi aberto')); } else assert.equal(sum.verdict, 'candidata');
}
console.log('ok   funding: zip/CSV, grelha causal e Ciclo 2 sintético (sinal → candidata; nulo → negativo; Holm 32)');
