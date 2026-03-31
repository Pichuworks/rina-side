import { clamp, weightedAverage } from "./response-curve.js";

export function combineConfidence(...factors) {
  return clamp(
    factors.reduce((product, factor) => product * clamp(Number.isFinite(factor) ? factor : 0, 0, 1), 1),
    0,
    1,
  );
}

export function confidenceFromVariation(stdDb, goodStdDb = 0.75, badStdDb = 4.0) {
  if (!Number.isFinite(stdDb)) return 0;
  if (stdDb <= goodStdDb) return 1;
  if (stdDb >= badStdDb) return 0;
  return 1 - ((stdDb - goodStdDb) / (badStdDb - goodStdDb));
}

export function confidenceFromEnergy(energyDb, lowDb = -90, highDb = -36) {
  if (!Number.isFinite(energyDb)) return 0;
  if (energyDb <= lowDb) return 0;
  if (energyDb >= highDb) return 1;
  return (energyDb - lowDb) / (highDb - lowDb);
}

export function mergeConfidence(...series) {
  if (!series.length) return [];
  const length = series[0].length;
  return Array.from({ length }, (_, index) => weightedAverage(series.map((values) => values[index] ?? 0), series.map(() => 1)));
}
