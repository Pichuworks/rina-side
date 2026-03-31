import { PROFILE_ERROR, PROFILE_TYPE, PROFILE_VERSION, PROBE_KIND, PROGRAM_KIND } from "./constants.js";
import { isStrictlyIncreasing } from "./frequency-grid.js";

function assert(condition, message, code = PROFILE_ERROR.INVALID_SCHEMA) {
  if (!condition) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
}

function validateNumberArray(values, name) {
  assert(Array.isArray(values), `${name} must be an array`);
  values.forEach((value, index) => {
    assert(Number.isFinite(value), `${name}[${index}] must be finite`);
  });
}

function validateBoolArray(values, name) {
  assert(Array.isArray(values), `${name} must be an array`);
  values.forEach((value, index) => {
    assert(typeof value === "boolean", `${name}[${index}] must be boolean`);
  });
}

export function validateEqModel(raw) {
  assert(raw && typeof raw === "object", "EQ model must be an object", PROFILE_ERROR.INVALID_EQ_MODEL);
  assert(["graphic-fixed-band", "graphic-measured-basis", "parametric", "fir-convolution"].includes(raw.kind), "Unsupported EQ model kind", PROFILE_ERROR.INVALID_EQ_MODEL);
  assert(Array.isArray(raw.bands) && raw.bands.length > 0, "EQ model bands are required", PROFILE_ERROR.INVALID_EQ_MODEL);
  const seen = new Set();
  raw.bands.forEach((band, index) => {
    assert(band && typeof band === "object", `bands[${index}] must be an object`, PROFILE_ERROR.INVALID_EQ_MODEL);
    assert(typeof band.id === "string" && band.id, `bands[${index}].id is required`, PROFILE_ERROR.INVALID_EQ_MODEL);
    assert(!seen.has(band.id), `Duplicate band id ${band.id}`, PROFILE_ERROR.INVALID_EQ_MODEL);
    seen.add(band.id);
    assert(Number.isFinite(band.centerHz) && band.centerHz > 0, `bands[${index}].centerHz must be > 0`, PROFILE_ERROR.INVALID_EQ_MODEL);
    assert(["peak", "low-shelf", "high-shelf"].includes(band.filterType), `bands[${index}].filterType is invalid`, PROFILE_ERROR.INVALID_EQ_MODEL);
    assert(Number.isFinite(band.gainStepDb) && band.gainStepDb > 0, `bands[${index}].gainStepDb must be > 0`, PROFILE_ERROR.INVALID_EQ_MODEL);
    assert(Number.isInteger(band.minStep), `bands[${index}].minStep must be integer`, PROFILE_ERROR.INVALID_EQ_MODEL);
    assert(Number.isInteger(band.maxStep), `bands[${index}].maxStep must be integer`, PROFILE_ERROR.INVALID_EQ_MODEL);
    assert(band.minStep <= 0 && band.maxStep >= 0, `bands[${index}] must include zero`, PROFILE_ERROR.INVALID_EQ_MODEL);
    assert(typeof band.integerOnly === "boolean", `bands[${index}].integerOnly must be boolean`, PROFILE_ERROR.INVALID_EQ_MODEL);
    if (band.q != null) assert(Number.isFinite(band.q) && band.q > 0, `bands[${index}].q must be > 0`, PROFILE_ERROR.INVALID_EQ_MODEL);
  });
  if (raw.kind === "graphic-measured-basis") {
    assert(Array.isArray(raw.basis) && raw.basis.length === raw.bands.length, "Measured-basis EQ model requires full basis", PROFILE_ERROR.INVALID_EQ_MODEL);
    raw.basis.forEach((basis, index) => {
      assert(basis && typeof basis === "object", `basis[${index}] must be object`, PROFILE_ERROR.INVALID_EQ_MODEL);
      assert(seen.has(basis.bandId), `basis[${index}].bandId does not match a band`, PROFILE_ERROR.INVALID_EQ_MODEL);
      validateNumberArray(basis.frequencyGridHz, `basis[${index}].frequencyGridHz`);
      validateNumberArray(basis.effectDbPerStep, `basis[${index}].effectDbPerStep`);
      assert(basis.frequencyGridHz.length === basis.effectDbPerStep.length, `basis[${index}] length mismatch`, PROFILE_ERROR.INVALID_EQ_MODEL);
      assert(isStrictlyIncreasing(basis.frequencyGridHz), `basis[${index}].frequencyGridHz must be increasing`, PROFILE_ERROR.INVALID_EQ_MODEL);
    });
  }
  assert(["integer", "continuous"].includes(raw.preferredSolveMode), "preferredSolveMode is invalid", PROFILE_ERROR.INVALID_EQ_MODEL);
  return raw;
}

export function validateCanonicalProfile(raw) {
  assert(raw && typeof raw === "object", "Profile must be an object");
  assert(raw.type === PROFILE_TYPE, `Profile type must be ${PROFILE_TYPE}`);
  assert(raw.version === PROFILE_VERSION, `Profile version must be ${PROFILE_VERSION}`);
  assert(typeof raw.name === "string" && raw.name, "Profile name is required");
  assert(typeof raw.createdAt === "string" && raw.createdAt, "Profile createdAt is required");
  assert(raw.sourceType === "probe" || raw.sourceType === "program", "Profile sourceType is invalid");
  assert(typeof raw.generator === "string" && raw.generator, "Profile generator is required");
  validateNumberArray(raw.frequencyGridHz, "frequencyGridHz");
  assert(isStrictlyIncreasing(raw.frequencyGridHz), "frequencyGridHz must be strictly increasing", PROFILE_ERROR.INVALID_GRID);
  ["L", "R"].forEach((channel) => {
    validateNumberArray(raw.responseDb?.[channel], `responseDb.${channel}`);
    validateNumberArray(raw.confidence?.[channel], `confidence.${channel}`);
    validateBoolArray(raw.usableMask?.[channel], `usableMask.${channel}`);
    assert(raw.responseDb[channel].length === raw.frequencyGridHz.length, `responseDb.${channel} length mismatch`);
    assert(raw.confidence[channel].length === raw.frequencyGridHz.length, `confidence.${channel} length mismatch`);
    assert(raw.usableMask[channel].length === raw.frequencyGridHz.length, `usableMask.${channel} length mismatch`);
    raw.confidence[channel].forEach((value, index) => {
      assert(value >= 0 && value <= 1, `confidence.${channel}[${index}] must be in [0,1]`);
    });
  });
  assert(raw.anchor && typeof raw.anchor === "object", "anchor is required", PROFILE_ERROR.INVALID_ANCHOR);
  assert(raw.anchor.type === "midband-average", "Only midband-average anchor is supported", PROFILE_ERROR.INVALID_ANCHOR);
  assert(Array.isArray(raw.anchor.rangeHz) && raw.anchor.rangeHz.length === 2, "anchor.rangeHz must be a pair", PROFILE_ERROR.INVALID_ANCHOR);
  assert(Number.isFinite(raw.anchor.rangeHz[0]) && Number.isFinite(raw.anchor.rangeHz[1]) && raw.anchor.rangeHz[0] < raw.anchor.rangeHz[1], "anchor.rangeHz is invalid", PROFILE_ERROR.INVALID_ANCHOR);
  assert(raw.sourceMeta && typeof raw.sourceMeta === "object", "sourceMeta is required");
  if (raw.sourceType === "probe") assert(raw.sourceMeta.kind === PROBE_KIND, "Probe profile sourceMeta.kind is invalid");
  if (raw.sourceType === "program") assert(raw.sourceMeta.kind === PROGRAM_KIND, "Program profile sourceMeta.kind is invalid");
  if (raw.eqModel != null) validateEqModel(raw.eqModel);
  return raw;
}
