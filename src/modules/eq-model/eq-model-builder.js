import { validateEqModel } from "../player-profile/validator.js";
import { measureEqBasisFromProfiles } from "./eq-basis-measurement.js";

export function buildFixedBandEqModel(input) {
  const model = {
    kind: "graphic-fixed-band",
    bands: input.bands.map((band) => ({ ...band })),
    basis: null,
    preferredSolveMode: "integer",
  };
  return validateEqModel(model);
}

export function buildMeasuredBasisEqModel(input) {
  const basis = measureEqBasisFromProfiles(input.baseProfile, input.steppedProfiles, input.stepCount);
  const model = {
    kind: "graphic-measured-basis",
    bands: input.bands.map((band) => ({ ...band })),
    basis,
    preferredSolveMode: "integer",
  };
  return validateEqModel(model);
}

export function attachEqModel(profile, eqModel) {
  return {
    ...profile,
    eqModel,
  };
}
