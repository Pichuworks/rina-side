import { WORKBENCH_ERROR } from "../player-profile/constants.js";
import { loadAndNormalizeProfile } from "../player-profile/normalizer.js";
import { mergeUsableMasks } from "../player-profile/usable-mask.js";
import { findUsableBand } from "../program-profile/program-aggregation.js";
import { computeFitScore, fitScoreStatus } from "./fit-score.js";
import { solveGraphicBasis } from "./solve-graphic-basis.js";
import { solveGraphicFixed } from "./solve-graphic-fixed.js";
import { solveParametric } from "./solve-parametric.js";

function fail(errorCode, message) {
  return {
    ok: false,
    errorCode,
    message,
    targetMode: null,
    targetLabel: null,
    eqSteps: [],
    frequencyGridHz: [],
    sourceResponseDb: { L: [], R: [] },
    targetResponseDb: { L: [], R: [] },
    correctedResponseDb: { L: [], R: [] },
    targetDeltaDb: { L: [], R: [] },
    predictedEqDb: [],
    residualDb: { L: [], R: [] },
    fitScore: 0,
    usableBandHz: null,
  };
}

function duplicateStereoCurve(curve) {
  return [...curve, ...curve];
}

function buildStereoTargetFromProfile(normalizedB) {
  return {
    mode: "profile",
    label: normalizedB.name || "Profile B",
    responseDb: {
      L: [...normalizedB.responseDb.L],
      R: [...normalizedB.responseDb.R],
    },
    confidence: {
      L: [...normalizedB.confidence.L],
      R: [...normalizedB.confidence.R],
    },
    usableMask: {
      L: [...normalizedB.usableMask.L],
      R: [...normalizedB.usableMask.R],
    },
  };
}

function buildFlatStereoTarget(length) {
  return {
    mode: "flat",
    label: "Flat",
    responseDb: {
      L: new Array(length).fill(0),
      R: new Array(length).fill(0),
    },
    confidence: {
      L: new Array(length).fill(1),
      R: new Array(length).fill(1),
    },
    usableMask: {
      L: new Array(length).fill(true),
      R: new Array(length).fill(true),
    },
  };
}

function buildStereoSolveInput(normalizedA, target) {
  const deltaDb = {
    L: normalizedA.responseDb.L.map((value, index) => (target.responseDb.L[index] ?? 0) - value),
    R: normalizedA.responseDb.R.map((value, index) => (target.responseDb.R[index] ?? 0) - value),
  };
  const confidence = {
    L: normalizedA.confidence.L.map((value, index) => value * (target.confidence.L[index] ?? 0)),
    R: normalizedA.confidence.R.map((value, index) => value * (target.confidence.R[index] ?? 0)),
  };
  const usableMask = {
    L: mergeUsableMasks(normalizedA.usableMask.L, target.usableMask.L).map((enabled, index) => enabled && (confidence.L[index] ?? 0) >= 0.15),
    R: mergeUsableMasks(normalizedA.usableMask.R, target.usableMask.R).map((enabled, index) => enabled && (confidence.R[index] ?? 0) >= 0.15),
  };
  return {
    sourceResponseDb: {
      L: [...normalizedA.responseDb.L],
      R: [...normalizedA.responseDb.R],
    },
    targetResponseDb: {
      L: [...target.responseDb.L],
      R: [...target.responseDb.R],
    },
    deltaDb,
    confidence,
    usableMask,
    combinedDeltaDb: [...deltaDb.L, ...deltaDb.R],
    combinedWeights: [...confidence.L.map((value, index) => usableMask.L[index] ? value : 0), ...confidence.R.map((value, index) => usableMask.R[index] ? value : 0)],
    combinedUsableMask: [...usableMask.L, ...usableMask.R],
    sharedUsableMask: mergeUsableMasks(usableMask.L, usableMask.R),
  };
}

function duplicateEqModelBasis(eqModel) {
  if (!eqModel?.basis) return eqModel;
  return {
    ...eqModel,
    basis: eqModel.basis.map((basis) => ({
      ...basis,
      effectDbPerStep: duplicateStereoCurve(basis.effectDbPerStep),
    })),
  };
}

function solveAgainstTarget(normalizedA, target) {
  if (!normalizedA.eqModel) {
    return fail(WORKBENCH_ERROR.COMPILER_MISSING_EQ_MODEL, "Profile A requires an eqModel");
  }
  const stereo = buildStereoSolveInput(normalizedA, target);
  let solved;
  if (normalizedA.eqModel.kind === "graphic-measured-basis") {
    solved = solveGraphicBasis(
      stereo.combinedDeltaDb,
      stereo.combinedWeights,
      stereo.combinedUsableMask,
      duplicateEqModelBasis(normalizedA.eqModel),
    );
  } else if (normalizedA.eqModel.kind === "graphic-fixed-band") {
    solved = solveGraphicFixed(
      stereo.combinedDeltaDb,
      stereo.combinedWeights,
      stereo.combinedUsableMask,
      normalizedA.eqModel,
      duplicateStereoCurve(normalizedA.frequencyGridHz),
    );
  } else if (normalizedA.eqModel.kind === "parametric") {
    solved = solveParametric(
      stereo.combinedDeltaDb,
      stereo.combinedWeights,
      stereo.combinedUsableMask,
      normalizedA.eqModel,
      duplicateStereoCurve(normalizedA.frequencyGridHz),
    );
  } else {
    return fail(WORKBENCH_ERROR.COMPILER_INCOMPATIBLE_PROFILES, `Unsupported eqModel kind: ${normalizedA.eqModel.kind}`);
  }
  const channelLength = normalizedA.frequencyGridHz.length;
  const sharedPredictedEqDb = solved.predictedEqDb.slice(0, channelLength);
  const correctedResponseDb = {
    L: stereo.sourceResponseDb.L.map((value, index) => value + (sharedPredictedEqDb[index] ?? 0)),
    R: stereo.sourceResponseDb.R.map((value, index) => value + (sharedPredictedEqDb[index] ?? 0)),
  };
  const residualDb = {
    L: stereo.targetResponseDb.L.map((value, index) => value - (correctedResponseDb.L[index] ?? 0)),
    R: stereo.targetResponseDb.R.map((value, index) => value - (correctedResponseDb.R[index] ?? 0)),
  };
  const fitScore = computeFitScore(
    stereo.combinedDeltaDb,
    duplicateStereoCurve(sharedPredictedEqDb),
    stereo.combinedWeights,
    stereo.combinedUsableMask,
  );
  if (fitScoreStatus(fitScore) === "fail") {
    return fail(WORKBENCH_ERROR.COMPILER_FIT_TOO_LOW, "Fit score is too low");
  }
  return {
    ok: true,
    errorCode: null,
    message: null,
    targetMode: target.mode,
    targetLabel: target.label,
    eqSteps: solved.eqSteps,
    frequencyGridHz: [...normalizedA.frequencyGridHz],
    sourceResponseDb: stereo.sourceResponseDb,
    targetResponseDb: stereo.targetResponseDb,
    correctedResponseDb,
    targetDeltaDb: stereo.deltaDb,
    predictedEqDb: sharedPredictedEqDb,
    residualDb,
    fitScore,
    usableBandHz: findUsableBand(normalizedA.frequencyGridHz, stereo.sharedUsableMask),
  };
}

export function compileEqAToB(profileA, profileB) {
  const normalizedA = loadAndNormalizeProfile(profileA);
  const normalizedB = loadAndNormalizeProfile(profileB, normalizedA.frequencyGridHz);
  return solveAgainstTarget(normalizedA, buildStereoTargetFromProfile(normalizedB));
}

export function compileEqAToFlat(profileA) {
  const normalizedA = loadAndNormalizeProfile(profileA);
  return solveAgainstTarget(normalizedA, buildFlatStereoTarget(normalizedA.frequencyGridHz.length));
}
