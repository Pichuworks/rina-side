import { WORKBENCH_ERROR } from "../player-profile/constants.js";
import { loadAndNormalizeProfile } from "../player-profile/normalizer.js";
import { mergeUsableMasks } from "../player-profile/usable-mask.js";
import { findUsableBand } from "../program-profile/program-aggregation.js";
import { computeFitScore, fitScoreStatus } from "./fit-score.js";
import { solveGraphicBasis } from "./solve-graphic-basis.js";
import { solveGraphicFixed } from "./solve-graphic-fixed.js";
import { solveParametric } from "./solve-parametric.js";
import { solveParametricFull } from "./solve-parametric-full.js";

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
    solved = solveParametricFull(
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

/**
 * Built-in target response curves.
 * Each is an array of [frequencyHz, dB] pairs relative to 1kHz = 0dB.
 */
export const TARGET_CURVES = {
  "vdsf-5128": {
    name: "VDSF 5128 Demo",
    points: [[20,-0.5],[50,0],[100,0],[200,0.3],[500,0.5],[1000,0],[2000,-1.5],[3000,-3],[4000,-3.5],[5000,-2.5],[6000,-1.5],[8000,-3],[10000,-5],[12000,-6],[15000,-8],[20000,-12]],
  },
  "harman-2019": {
    name: "Harman 2019 In-Ear",
    points: [[20,0.5],[50,1],[100,0.5],[200,0],[500,0],[1000,0],[2000,-0.5],[3000,-2],[4000,-2.5],[5000,-1.5],[6000,-0.5],[8000,-3],[10000,-4.5],[12000,-5.5],[15000,-7],[20000,-10]],
  },
  "diffuse-field": {
    name: "Diffuse Field",
    points: [[20,0],[100,0],[200,0],[500,0],[1000,0],[2000,2],[3000,2.5],[4000,1.5],[5000,0],[6000,-1],[8000,-3],[10000,-5],[12000,-7],[15000,-10],[20000,-14]],
  },
};

function interpolateTargetCurve(points, frequencyGridHz) {
  // points = [[freq, dB], ...] sorted by freq
  return frequencyGridHz.map((freq) => {
    if (freq <= points[0][0]) return points[0][1];
    if (freq >= points[points.length - 1][0]) return points[points.length - 1][1];
    let lo = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i][0] >= freq) { lo = i - 1; break; }
    }
    const [f0, d0] = points[lo];
    const [f1, d1] = points[lo + 1];
    const t = Math.log(freq / f0) / Math.log(f1 / f0);
    return d0 + (d1 - d0) * t;
  });
}

function buildCurveStereoTarget(frequencyGridHz, targetCurvePoints, label) {
  const db = interpolateTargetCurve(targetCurvePoints, frequencyGridHz);
  const length = frequencyGridHz.length;
  return {
    mode: "curve",
    label: label || "Target Curve",
    responseDb: { L: [...db], R: [...db] },
    confidence: { L: new Array(length).fill(1), R: new Array(length).fill(1) },
    usableMask: { L: new Array(length).fill(true), R: new Array(length).fill(true) },
  };
}

export function compileEqAToTarget(profileA, targetCurve) {
  const normalizedA = loadAndNormalizeProfile(profileA);
  const target = buildCurveStereoTarget(
    normalizedA.frequencyGridHz,
    targetCurve.points,
    targetCurve.name,
  );
  return solveAgainstTarget(normalizedA, target);
}

export function computeFullResolutionTarget(profileA, targetCurve) {
  const normalizedA = loadAndNormalizeProfile(profileA);
  const grid = normalizedA.frequencyGridHz;
  const targetDb = interpolateTargetCurve(targetCurve.points, grid);
  const correctionL = grid.map((_, i) => (targetDb[i] || 0) - (normalizedA.responseDb.L[i] || 0));
  const correctionR = grid.map((_, i) => (targetDb[i] || 0) - (normalizedA.responseDb.R[i] || 0));
  return {
    frequencyGridHz: [...grid],
    correctionDb: { L: correctionL, R: correctionR },
    sourceLabel: normalizedA.name || "A",
    targetLabel: targetCurve.name || "Target Curve",
  };
}

/**
 * Compute raw full-resolution delta between two profiles — no EQ model needed.
 * Returns a correction curve: when baked into audio and played through device A,
 * the listener hears device B's frequency character.
 *
 * correction[i] = responseB[i] - responseA[i]
 */
export function computeFullResolutionDelta(profileA, profileB) {
  const normalizedA = loadAndNormalizeProfile(profileA);
  const normalizedB = loadAndNormalizeProfile(profileB, normalizedA.frequencyGridHz);
  const grid = normalizedA.frequencyGridHz;
  const correctionL = grid.map((_, i) => (normalizedB.responseDb.L[i] || 0) - (normalizedA.responseDb.L[i] || 0));
  const correctionR = grid.map((_, i) => (normalizedB.responseDb.R[i] || 0) - (normalizedA.responseDb.R[i] || 0));
  return {
    frequencyGridHz: [...grid],
    correctionDb: { L: correctionL, R: correctionR },
    sourceLabel: normalizedA.name || "A",
    targetLabel: normalizedB.name || "B",
  };
}

export function computeFullResolutionFlat(profileA) {
  const normalizedA = loadAndNormalizeProfile(profileA);
  const grid = normalizedA.frequencyGridHz;
  // correction = flat(0) - responseA = -responseA
  const correctionL = grid.map((_, i) => -(normalizedA.responseDb.L[i] || 0));
  const correctionR = grid.map((_, i) => -(normalizedA.responseDb.R[i] || 0));
  return {
    frequencyGridHz: [...grid],
    correctionDb: { L: correctionL, R: correctionR },
    sourceLabel: normalizedA.name || "A",
    targetLabel: "Flat",
  };
}
