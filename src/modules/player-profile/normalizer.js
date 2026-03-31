import { createDefaultAnchor, normalizeStereoResponseByAnchor } from "./anchor.js";
import { buildFrequencyGridHz } from "./frequency-grid.js";
import { resampleCurveToGrid } from "./response-curve.js";
import { validateCanonicalProfile } from "./validator.js";

function resampleMask(mask, sourceGridHz, targetGridHz) {
  const sampled = resampleCurveToGrid(sourceGridHz, mask.map((value) => (value ? 1 : 0)), targetGridHz);
  return sampled.map((value) => value >= 0.5);
}

export function normalizeProfileToGrid(profile, targetGridHz = buildFrequencyGridHz()) {
  validateCanonicalProfile(profile);
  const responseDb = {
    L: resampleCurveToGrid(profile.frequencyGridHz, profile.responseDb.L, targetGridHz),
    R: resampleCurveToGrid(profile.frequencyGridHz, profile.responseDb.R, targetGridHz),
  };
  const confidence = {
    L: resampleCurveToGrid(profile.frequencyGridHz, profile.confidence.L, targetGridHz).map((value) => Math.max(0, Math.min(1, value))),
    R: resampleCurveToGrid(profile.frequencyGridHz, profile.confidence.R, targetGridHz).map((value) => Math.max(0, Math.min(1, value))),
  };
  const usableMask = {
    L: resampleMask(profile.usableMask.L, profile.frequencyGridHz, targetGridHz),
    R: resampleMask(profile.usableMask.R, profile.frequencyGridHz, targetGridHz),
  };
  return {
    ...profile,
    frequencyGridHz: [...targetGridHz],
    responseDb,
    confidence,
    usableMask,
  };
}

export function normalizeProfileAnchor(profile) {
  validateCanonicalProfile(profile);
  const anchor = createDefaultAnchor();
  return {
    ...profile,
    anchor,
    responseDb: normalizeStereoResponseByAnchor(profile.frequencyGridHz, profile.responseDb, anchor),
  };
}

export function loadAndNormalizeProfile(raw, targetGridHz = buildFrequencyGridHz()) {
  const validated = validateCanonicalProfile(raw);
  return normalizeProfileAnchor(normalizeProfileToGrid(validated, targetGridHz));
}
