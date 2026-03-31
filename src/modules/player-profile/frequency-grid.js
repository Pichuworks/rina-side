import {
  DEFAULT_GRID_MAX_HZ,
  DEFAULT_GRID_MIN_HZ,
  DEFAULT_POINTS_PER_OCTAVE,
} from "./constants.js";

export function buildFrequencyGridHz(
  minHz = DEFAULT_GRID_MIN_HZ,
  maxHz = DEFAULT_GRID_MAX_HZ,
  pointsPerOctave = DEFAULT_POINTS_PER_OCTAVE,
) {
  if (!(minHz > 0) || !(maxHz > minHz) || !(pointsPerOctave > 0)) {
    throw new Error("Invalid frequency grid arguments");
  }
  const out = [];
  const ratio = Math.pow(2, 1 / pointsPerOctave);
  let current = minHz;
  while (current <= maxHz * 1.000001) {
    out.push(Number(current.toFixed(6)));
    current *= ratio;
  }
  if (out[out.length - 1] < maxHz * 0.999) out.push(Number(maxHz.toFixed(6)));
  return out;
}

export function isStrictlyIncreasing(values) {
  if (!Array.isArray(values) || values.length < 2) return false;
  for (let i = 1; i < values.length; i++) {
    if (!(values[i] > values[i - 1])) return false;
  }
  return true;
}

export function findFrequencyIndexRange(frequencyGridHz, minHz, maxHz) {
  let start = -1;
  let end = -1;
  for (let i = 0; i < frequencyGridHz.length; i++) {
    const f = frequencyGridHz[i];
    if (f >= minHz && start < 0) start = i;
    if (f <= maxHz) end = i;
  }
  return { start, end };
}
