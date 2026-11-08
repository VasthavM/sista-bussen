#!/usr/bin/env node
/**
 * Balance harness CLI. Runs N seeded maps per config headlessly, in parallel worker threads.
 * Same inputs give the same report regardless of worker count (results are re-ordered by seed).
 *
 *   node tools/balance.mjs --depths 1-5 --weapons all --n 200 --out specs/balance/baseline.json \
 *        --md specs/balance/baseline.tables.md
 *
 * Options (all optional):
 *   --depths 1-5 | 1,3       --weapons all | nyckel,korv      --character nattvandraren
 *   --quota <fuel> (default: fuelQuotaFor(depth))   --policy rush | greedy | random | rush:<weapon>   --mods damage=0.1,hp=20,startWeaponLevel=2
 *   --n 200   --seed 1000   --workers <cpus-2>   --out report.json   --md tables.md   --layout baseline|configs
 */
import './balance-boot.mjs';
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';

const { WEAPON_ORDER } = await import('../src/sim/content.ts');
const { EMPTY_MODS } = await import('../src/sim/types.ts');
const { summarise, renderConfigTable, renderBaselineTables } = await import('./balance-lib.ts');

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) throw new Error(`unexpected argument ${argv[i]}`);
    o[argv[i].slice(2)] = argv[++i];
  }
  return o;
}

function parseList(spec, all) {
  if (spec === 'all') return all;
  return spec.split(',').flatMap((part) => {
    const m = /^(\d+)-(\d+)$/.exec(part);
    if (!m) return [part];
    return Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, i) => String(Number(m[1]) + i));
  });
}

function parseMods(spec) {
  const mods = {};
  if (!spec) return mods;
  for (const kv of spec.split(',')) {
    const [k, v] = kv.split('=');
    if (!(k in EMPTY_MODS) || Number.isNaN(Number(v))) throw new Error(`bad mod ${kv}`);
    mods[k] = Number(v);
  }
  return mods;
}

const args = parseArgs(process.argv.slice(2));
const depths = parseList(args.depths ?? '1', []).map(Number);
const weapons = parseList(args.weapons ?? 'all', WEAPON_ORDER);
const n = Number(args.n ?? 200);
const baseSeed = Number(args.seed ?? 1000);
const workers = Math.max(1, Number(args.workers ?? availableParallelism() - 2));
const configs = weapons.flatMap((weapon) =>
  depths.map((depth) => ({
    depth,
    quota: args.quota === undefined ? undefined : Number(args.quota),
    character: args.character ?? 'nattvandraren',
    weapon,
    policy: args.policy ?? 'rush',
    mods: parseMods(args.mods),
    n,
    baseSeed,
  })),
);

const CHUNK = 10;
const tasks = configs.flatMap((cfg, ci) =>
  Array.from({ length: Math.ceil(n / CHUNK) }, (_, k) => ({ ci, from: k * CHUNK, count: Math.min(CHUNK, n - k * CHUNK) })),
);
const results = configs.map(() => []);
const started = Date.now();
let next = 0;
let done = 0;

await new Promise((resolve, reject) => {
  let live = Math.min(workers, tasks.length);
  const finish = () => --live === 0 && resolve();
  for (let w = 0; w < Math.min(workers, tasks.length); w++) {
    const worker = new Worker(new URL('./balance-worker.mjs', import.meta.url));
    const feed = () => {
      if (next >= tasks.length) return worker.terminate().then(finish);
      const t = tasks[next++];
      worker.postMessage({ id: t, cfg: configs[t.ci], from: t.from, count: t.count });
    };
    worker.on('message', (msg) => {
      if (msg.ready) return feed();
      results[msg.id.ci].push(...msg.runs);
      done++;
      if (process.stderr.isTTY) process.stderr.write(`\r${done}/${tasks.length} chunks`);
      feed();
    });
    worker.on('error', reject);
  }
});

const reports = configs.map((cfg, i) => summarise(cfg, results[i].sort((a, b) => a.seed - b.seed)));
const seconds = (Date.now() - started) / 1000;
process.stderr.write(`\n${configs.length} configs x ${n} maps on ${workers} workers: ${seconds.toFixed(1)}s\n`);

const json = JSON.stringify({ reports }, null, 2) + '\n';
const md =
  (args.layout ?? (configs.length > 1 ? 'baseline' : 'configs')) === 'baseline'
    ? renderBaselineTables(reports)
    : reports.map(renderConfigTable).join('\n\n');
if (args.out) writeFileSync(args.out, json);
else if (!args.md) process.stdout.write(json);
if (args.md) writeFileSync(args.md, md + '\n');
else process.stderr.write('\n' + md + '\n');
