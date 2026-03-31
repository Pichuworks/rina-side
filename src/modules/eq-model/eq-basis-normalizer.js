import { buildFrequencyGridHz } from "../player-profile/frequency-grid.js";
import { resampleCurveToGrid } from "../player-profile/response-curve.js";

export function normalizeEqBasisToGrid(basis, targetGridHz = buildFrequencyGridHz()) {
  return basis.map((entry) => ({
    bandId: entry.bandId,
    frequencyGridHz: [...targetGridHz],
    effectDbPerStep: resampleCurveToGrid(entry.frequencyGridHz, entry.effectDbPerStep, targetGridHz),
  }));
}
