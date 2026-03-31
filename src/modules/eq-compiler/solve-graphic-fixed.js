import { solveGraphicBasis } from "./solve-graphic-basis.js";

function buildBellBasisForBand(band, frequencyGridHz) {
  const q = band.q || 1;
  const sigmaOct = 1 / Math.max(0.25, q * 1.5);
  const effectDbPerStep = frequencyGridHz.map((freq) => {
    const logDistance = Math.log2(freq / band.centerHz);
    return Math.exp(-(logDistance * logDistance) / (2 * sigmaOct * sigmaOct)) * band.gainStepDb;
  });
  return {
    bandId: band.id,
    frequencyGridHz,
    effectDbPerStep,
  };
}

export function solveGraphicFixed(targetDeltaDb, weights, usableMask, eqModel, frequencyGridHz) {
  const derivedModel = {
    ...eqModel,
    basis: eqModel.bands.map((band) => buildBellBasisForBand(band, frequencyGridHz)),
  };
  return solveGraphicBasis(targetDeltaDb, weights, usableMask, derivedModel);
}
