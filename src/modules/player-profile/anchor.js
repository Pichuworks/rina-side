import { DEFAULT_ANCHOR_RANGE_HZ } from "./constants.js";
import { findFrequencyIndexRange } from "./frequency-grid.js";

export function createDefaultAnchor() {
  return { type: "midband-average", rangeHz: [...DEFAULT_ANCHOR_RANGE_HZ] };
}

export function computeAnchorMeanDb(frequencyGridHz, valuesDb, anchor = createDefaultAnchor()) {
  const [minHz, maxHz] = anchor.rangeHz || DEFAULT_ANCHOR_RANGE_HZ;
  const { start, end } = findFrequencyIndexRange(frequencyGridHz, minHz, maxHz);
  if (start < 0 || end < start) return 0;
  let sum = 0;
  let count = 0;
  for (let i = start; i <= end; i++) {
    const value = valuesDb[i];
    if (Number.isFinite(value)) {
      sum += value;
      count += 1;
    }
  }
  return count ? sum / count : 0;
}

export function normalizeCurveByAnchor(frequencyGridHz, valuesDb, anchor = createDefaultAnchor()) {
  const shift = computeAnchorMeanDb(frequencyGridHz, valuesDb, anchor);
  return valuesDb.map((value) => value - shift);
}

export function normalizeStereoResponseByAnchor(frequencyGridHz, responseDb, anchor = createDefaultAnchor()) {
  return {
    L: normalizeCurveByAnchor(frequencyGridHz, responseDb.L || [], anchor),
    R: normalizeCurveByAnchor(frequencyGridHz, responseDb.R || [], anchor),
  };
}
