import { normalizeEqBasisToGrid } from "./eq-basis-normalizer.js";

export function measureEqBasisFromProfiles(baseProfile, steppedProfiles, stepCount) {
  if (!baseProfile || !Array.isArray(steppedProfiles) || !steppedProfiles.length || !(stepCount > 0)) {
    throw new Error("Invalid measured-basis input");
  }
  const baseCurve = baseProfile.responseDb?.L?.map((value, index) => ((value + (baseProfile.responseDb?.R?.[index] ?? value)) * 0.5)) || [];
  const basis = steppedProfiles.map(({ bandId, profile }) => {
    const steppedCurve = profile.responseDb?.L?.map((value, index) => ((value + (profile.responseDb?.R?.[index] ?? value)) * 0.5)) || [];
    return {
      bandId,
      frequencyGridHz: [...baseProfile.frequencyGridHz],
      effectDbPerStep: steppedCurve.map((value, index) => (value - baseCurve[index]) / stepCount),
    };
  });
  return normalizeEqBasisToGrid(basis, baseProfile.frequencyGridHz);
}
