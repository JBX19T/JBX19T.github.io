import { Worker } from 'node:worker_threads';
export function makePool(datasets, size) {
  const workers = Array.from({ length: size }, () => { const w = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { datasets } }); w.busy = false; return w; });
  const queue = [];
  const pump = () => {
    for (const w of workers) {
      if (w.busy || !queue.length) continue;
      const task = queue.shift(); w.busy = true;
      const onMsg = out => { w.off('error', onErr); w.busy = false; task.resolve(out); pump(); };
      const onErr = e => { w.off('message', onMsg); w.busy = false; task.reject(e); pump(); };
      w.once('message', onMsg); w.once('error', onErr); w.postMessage({ jobs: task.jobs });
    }
  };
  return {
    run(jobs, chunk = 6) { return new Promise((resolve, reject) => { const parts = []; for (let i = 0; i < jobs.length; i += chunk) parts.push(jobs.slice(i, i + chunk)); if (!parts.length) return resolve([]); const all = []; let left = parts.length;
      for (const p of parts) queue.push({ jobs: p, resolve: out => { all.push(...out); if (!--left) resolve(all); }, reject }); pump(); }); },
    close() { workers.forEach(w => w.terminate()); },
  };
}
