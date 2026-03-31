import { solveGraphicFixed } from "./solve-graphic-fixed.js";

export function solveParametric(targetDeltaDb, weights, usableMask, eqModel, frequencyGridHz) {
  return solveGraphicFixed(targetDeltaDb, weights, usableMask, eqModel, frequencyGridHz);
}
