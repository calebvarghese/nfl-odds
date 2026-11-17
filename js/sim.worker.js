import { createSim } from './simcore.js';

let sim = null;
let runId = 0;

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    sim = createSim(msg.data);
    self.postMessage({ type: 'ready', R: sim.R });
    return;
  }
  if (msg.type === 'run') {
    runId = msg.runId;
    if (msg.reset) sim.reset();
    const locks = msg.locks;
    const total = msg.count;
    const batch = msg.batch || 4000;
    let done = 0;
    const step = () => {
      if (runId !== msg.runId) return;
      const k = Math.min(batch, total - done);
      sim.run(locks, k);
      done += k;
      self.postMessage({ type: 'progress', runId, done, total, acc: snapshot() });
      if (done < total) setTimeout(step, 0);
    };
    step();
  }
};

function snapshot() {
  const a = sim.acc;
  return { n: a.n, seed: a.seed.slice(), divWin: a.divWin.slice(), pick1: a.pick1.slice(),
    wins: a.wins.slice(), gameN: a.gameN.slice(), cond: a.cond.slice() };
}
