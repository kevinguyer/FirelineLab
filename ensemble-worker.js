import { createPair, stepPair, seedSequence, summarizePair } from './experiments-core.js';

self.onmessage = async ({ data }) => {
  try {
    const { config, baseline, years, count } = data;
    const seeds = seedSequence(config.seed, count), rows = [];
    let example;
    for (const seed of seeds) {
      const pair = createPair({ ...config, seed }, baseline, years);
      while (pair.unmanaged.day < years * 365) {
        stepPair(pair, Math.min(60, years * 365 - pair.unmanaged.day));
        self.postMessage({ type: 'progress', completed: rows.length, total: count,
          fraction: (rows.length + pair.unmanaged.day / (years * 365)) / count, seed });
      }
      rows.push(summarizePair(pair));
      if (!example) example = Object.fromEntries(Object.entries(pair).map(([name, sim]) => [name, {
        config: sim.config, cells: sim.cells, day: sim.day, history: sim.history, events: sim.events, lastLightning: sim.lastLightning,
      }]));
    }
    self.postMessage({ type: 'complete', rows, example });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
