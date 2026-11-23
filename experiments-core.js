import { Simulation, validateConfig } from './engine.js';

export const MODEL_VERSION = 'FirelineLab 1.1';

// Every pair shares a landscape and exogenous event seed. Only treatment differs.
export function createPair(settings, baseline, years = settings.horizon) {
  const config = validateConfig({ ...settings, horizon: years });
  return {
    unmanaged: new Simulation({ ...config, prescribed: false }, baseline),
    managed: new Simulation({ ...config, prescribed: true }, baseline),
  };
}

export function stepPair(pair, days = 1) {
  if (pair.unmanaged.day !== pair.managed.day) throw Error('Pair clocks diverged.');
  for (let i = 0; i < days; i++) {
    if (!pair.unmanaged.step()) return false;
    if (!pair.managed.step()) throw Error('Pair horizons diverged.');
  }
  return true;
}

export function seedSequence(start, count) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw Error('Choose 1–100 seeds.');
  if (!Number.isInteger(start) || start < 1 || start > 999999999) throw Error('Invalid seed.');
  return Array.from({ length: count }, (_, i) => ((start - 1 + i * 104729) % 999999999) + 1);
}

export function summarizeSimulation(simulation) {
  return {
    ...simulation.stats(),
    lightning: simulation.lightningStrikes,
    spots: simulation.spotFires,
    treatments: simulation.rxEvents,
    peak: simulation.peak,
  };
}

export function summarizePair(pair) {
  return {
    seed: pair.unmanaged.config.seed,
    unmanaged: summarizeSimulation(pair.unmanaged),
    managed: summarizeSimulation(pair.managed),
  };
}

export function quantile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index), high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

export const measures = {
  cover: { label: 'Forest cover', unit: 'pp', direction: 1 },
  matureSurvival: { label: 'Original mature stand survival', unit: 'pp', direction: 1 },
  wildArea: { label: 'Wild/manual cumulative burned area', unit: 'ha', direction: -1 },
  loss: { label: 'Cumulative fire-caused stand losses', unit: 'stands', direction: -1 },
  fuel: { label: 'Surface fuel index', unit: 'points', direction: -1 },
};

export function aggregate(rows, key) {
  const measure = measures[key];
  if (!measure) throw Error('Unknown measure.');
  const valid = rows.filter(r => Number.isFinite(r.unmanaged[key]) && Number.isFinite(r.managed[key]));
  const deltas = valid.map(r => r.managed[key] - r.unmanaged[key]);
  const improved = deltas.filter(d => d * measure.direction > 1e-9).length;
  const tied = deltas.filter(d => Math.abs(d) <= 1e-9).length;
  return {
    count: valid.length, deltas, improved, tied, worse: valid.length - improved - tied,
    median: quantile(deltas, .5), p10: quantile(deltas, .1), p90: quantile(deltas, .9),
    min: quantile(deltas, 0), max: quantile(deltas, 1),
    unmanagedMedian: quantile(valid.map(r => r.unmanaged[key]), .5),
    managedMedian: quantile(valid.map(r => r.managed[key]), .5),
  };
}

export function ensembleCSV(rows) {
  const keys = ['cover','matureSurvival','burned','wildArea','rxArea','loss','fuel','lightning','treatments','peak'];
  return ['seed,day,' + keys.flatMap(k => [`unmanaged_${k}`, `managed_${k}`, `delta_${k}`]).join(','),
    ...rows.map(r => [r.seed, r.unmanaged.day, ...keys.flatMap(k => {
      const a = r.unmanaged[k], b = r.managed[k];
      return Number.isFinite(a) && Number.isFinite(b) ? [a,b,b-a] : ['','',''];
    })].join(','))].join('\n');
}
