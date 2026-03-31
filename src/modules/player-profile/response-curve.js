export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function weightedAverage(values, weights) {
  let sum = 0;
  let weightSum = 0;
  for (let i = 0; i < values.length; i++) {
    const weight = weights[i] ?? 0;
    const value = values[i] ?? 0;
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(value)) continue;
    sum += value * weight;
    weightSum += weight;
  }
  return weightSum > 0 ? (sum / weightSum) : 0;
}

export function interpolateLogValue(frequenciesHz, values, targetHz) {
  if (!frequenciesHz?.length || !values?.length) return 0;
  if (targetHz <= frequenciesHz[0]) return values[0] ?? 0;
  const last = frequenciesHz.length - 1;
  if (targetHz >= frequenciesHz[last]) return values[last] ?? 0;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frequenciesHz[mid] > targetHz) hi = mid;
    else lo = mid;
  }
  const f0 = Math.max(1e-6, frequenciesHz[lo]);
  const f1 = Math.max(f0 + 1e-6, frequenciesHz[hi]);
  const t = Math.log(targetHz / f0) / Math.log(f1 / f0);
  const a = values[lo] ?? 0;
  const b = values[hi] ?? 0;
  return a + ((b - a) * t);
}

export function resampleCurveToGrid(sourceGridHz, values, targetGridHz) {
  return targetGridHz.map((freq) => interpolateLogValue(sourceGridHz, values, freq));
}

export function smoothLogCurve(frequencyGridHz, values, bandwidthOctaves = 1 / 6) {
  if (!frequencyGridHz.length || !values.length) return [];
  const out = new Array(values.length).fill(0);
  for (let i = 0; i < frequencyGridHz.length; i++) {
    const center = frequencyGridHz[i];
    const minHz = center / Math.pow(2, bandwidthOctaves / 2);
    const maxHz = center * Math.pow(2, bandwidthOctaves / 2);
    let sum = 0;
    let weightSum = 0;
    for (let j = 0; j < frequencyGridHz.length; j++) {
      const freq = frequencyGridHz[j];
      if (freq < minHz || freq > maxHz) continue;
      const logDistance = Math.abs(Math.log2(freq / center));
      const weight = Math.max(0, 1 - (logDistance / Math.max(1e-6, bandwidthOctaves / 2)));
      sum += (values[j] ?? 0) * weight;
      weightSum += weight;
    }
    out[i] = weightSum ? (sum / weightSum) : (values[i] ?? 0);
  }
  return out;
}

export function dbFromAmplitude(amplitude) {
  return 20 * Math.log10(Math.max(amplitude, 1e-12));
}
