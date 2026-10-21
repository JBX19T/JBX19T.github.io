import { parentPort, workerData } from 'node:worker_threads';
import { makeTasks } from './tasks.mjs';
const T = makeTasks(workerData.datasets);
parentPort.on('message', msg => {
  const out = [];
  for (const job of msg.jobs) { try { out.push(T[job.task || 'sim'](job)); } catch (e) { out.push({ id: job.conf && job.conf.id, ds: job.ds, tag: job.tag, ok: false, err: String(e && e.message || e) }); } }
  parentPort.postMessage(out);
});
