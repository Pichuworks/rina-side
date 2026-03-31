import {
  PROGRAM_MIN_TRACK_COVERAGE,
  PROGRAM_MIN_TRACK_MID_CONFIDENCE,
  PROGRAM_MIN_USABLE_BAND_HZ,
  WORKBENCH_ERROR,
} from "../player-profile/constants.js";
import { createDefaultAnchor, normalizeStereoResponseByAnchor } from "../player-profile/anchor.js";
import { findFrequencyIndexRange } from "../player-profile/frequency-grid.js";
import { buildUsableMaskFromConfidence } from "../player-profile/usable-mask.js";

function coverageScore(confidence) {
  if (!confidence.length) return 0;
  const usable = confidence.filter((value) => value >= 0.35).length;
  return usable / confidence.length;
}

function meanInRange(frequencyGridHz, values, rangeHz) {
  const { start, end } = findFrequencyIndexRange(frequencyGridHz, rangeHz[0], rangeHz[1]);
  if (start < 0 || end < start) return 0;
  let sum = 0;
  let count = 0;
  for (let i = start; i <= end; i++) {
    sum += values[i] ?? 0;
    count += 1;
  }
  return count ? (sum / count) : 0;
}

export function findUsableBand(frequencyGridHz, mask) {
  let start = -1;
  let end = -1;
  for (let i = 0; i < frequencyGridHz.length; i++) {
    if (mask[i]) {
      if (start < 0) start = i;
      end = i;
    }
  }
  return start >= 0 && end >= start ? [frequencyGridHz[start], frequencyGridHz[end]] : null;
}

export function aggregateProgramTracks(trackAnalyses) {
  if (!trackAnalyses.length) {
    const error = new Error("No valid program tracks");
    error.code = WORKBENCH_ERROR.PROGRAM_NO_VALID_TRACKS;
    throw error;
  }
  const gridHz = trackAnalyses[0].frequencyGridHz;
  const length = gridHz.length;
  const responseDb = { L: new Array(length).fill(0), R: new Array(length).fill(0) };
  const confidence = { L: new Array(length).fill(0), R: new Array(length).fill(0) };
  for (const channel of ["L", "R"]) {
    for (let i = 0; i < length; i++) {
      let sum = 0;
      let weightSum = 0;
      for (const analysis of trackAnalyses) {
        const weight = analysis.confidence[channel][i] ?? 0;
        sum += (analysis.responseDb[channel][i] ?? 0) * weight;
        weightSum += weight;
      }
      responseDb[channel][i] = weightSum > 0 ? sum / weightSum : 0;
      confidence[channel][i] = Math.max(0, Math.min(1, trackAnalyses.reduce((sumConf, analysis) => sumConf + (analysis.confidence[channel][i] ?? 0), 0) / trackAnalyses.length));
    }
  }
  const anchor = createDefaultAnchor();
  const normalizedResponse = normalizeStereoResponseByAnchor(gridHz, responseDb, anchor);
  const usableMask = {
    L: buildUsableMaskFromConfidence(confidence.L),
    R: buildUsableMaskFromConfidence(confidence.R),
  };
  const coverageL = coverageScore(confidence.L);
  const coverageR = coverageScore(confidence.R);
  const midConfL = meanInRange(gridHz, confidence.L, [500, 2000]);
  const midConfR = meanInRange(gridHz, confidence.R, [500, 2000]);
  const bandL = findUsableBand(gridHz, usableMask.L);
  const bandR = findUsableBand(gridHz, usableMask.R);
  const coverage = Math.min(coverageL, coverageR);
  const midConfidence = Math.min(midConfL, midConfR);
  const bandOk = bandL && bandR
    && bandL[0] <= PROGRAM_MIN_USABLE_BAND_HZ[0]
    && bandL[1] >= PROGRAM_MIN_USABLE_BAND_HZ[1]
    && bandR[0] <= PROGRAM_MIN_USABLE_BAND_HZ[0]
    && bandR[1] >= PROGRAM_MIN_USABLE_BAND_HZ[1];
  if (coverage < PROGRAM_MIN_TRACK_COVERAGE || midConfidence < PROGRAM_MIN_TRACK_MID_CONFIDENCE || !bandOk) {
    const error = new Error("Program profile coverage is insufficient");
    error.code = WORKBENCH_ERROR.PROGRAM_INSUFFICIENT_COVERAGE;
    throw error;
  }
  return {
    frequencyGridHz: gridHz,
    responseDb: normalizedResponse,
    confidence,
    usableMask,
    anchor,
    coverageScore: coverage,
  };
}
