import './balance-boot.mjs';
import { parentPort } from 'node:worker_threads';

const { simulateRange } = await import('./balance-lib.ts');
parentPort.on('message', ({ id, cfg, from, count }) => {
  parentPort.postMessage({ id, runs: simulateRange(cfg, from, count) });
});
parentPort.postMessage({ ready: true });
