import { PROFILE_TYPE, PROFILE_VERSION, PROGRAM_KIND } from "../player-profile/constants.js";
import { validateCanonicalProfile } from "../player-profile/validator.js";
import { normalizeTrackPairs } from "./track-pairing.js";
import { alignProgramPair, trimAlignedStereo } from "./program-alignment.js";
import { aggregateProgramTracks } from "./program-aggregation.js";
import { analyseProgramTransfer, extractProgramStereo } from "./program-transfer.js";

/**
 * Build a program (song-based) player profile.
 *
 * Now async — yields main thread between pairs so the UI stays responsive.
 * Individual pair failures are collected instead of aborting the whole run.
 *
 * @param {Array} trackPairs
 * @param {object} [options]
 * @param {string} [options.name]
 * @param {(progress: object) => void} [onProgress]
 * @returns {Promise<{profile: object, failedPairs: Array}>}
 */
export async function buildProgramProfile(trackPairs, options = {}, onProgress) {
  const normalizedPairs = normalizeTrackPairs(trackPairs);
  const total = normalizedPairs.length;
  const validAnalyses = [];
  const failedPairs = [];

  for (let i = 0; i < total; i++) {
    const pair = normalizedPairs[i];

    onProgress?.({ phase: "analyzing", current: i + 1, total, title: pair.title });

    // Yield main thread so the browser can repaint & stay responsive
    await new Promise((r) => setTimeout(r, 0));

    try {
      const referenceStereo = extractProgramStereo(pair.referenceBuffer);
      const recordedStereo = extractProgramStereo(pair.recordedBuffer);
      const alignment = alignProgramPair(referenceStereo, recordedStereo);
      const trimmed = trimAlignedStereo(referenceStereo, recordedStereo, alignment.sampleOffset);
      const analysis = analyseProgramTransfer(
        { ...trimmed.reference, sampleRate: referenceStereo.sampleRate },
        { ...trimmed.recorded, sampleRate: recordedStereo.sampleRate },
      );
      validAnalyses.push({
        ...analysis,
        title: pair.title,
        alignmentScore: alignment.alignmentScore,
      });
    } catch (err) {
      failedPairs.push({
        title: pair.title,
        error: err.message || err.code || "Unknown error",
        code: err.code || null,
        detail: err.detail || null,
      });
    }
  }

  if (!validAnalyses.length) {
    const err = new Error(
      "All " + total + " track pair(s) failed analysis. "
      + failedPairs.map((p) => "[" + p.title + ": " + p.error + "]").join("; "),
    );
    err.code = "PROGRAM_NO_VALID_TRACKS";
    err.failedPairs = failedPairs;
    throw err;
  }

  onProgress?.({ phase: "aggregating" });
  await new Promise((r) => setTimeout(r, 0));

  const aggregated = aggregateProgramTracks(validAnalyses);
  const profile = {
    type: PROFILE_TYPE,
    version: PROFILE_VERSION,
    name: options.name || "Program Profile",
    createdAt: new Date().toISOString(),
    sourceType: "program",
    generator: "SIDE",
    frequencyGridHz: aggregated.frequencyGridHz,
    responseDb: aggregated.responseDb,
    confidence: aggregated.confidence,
    usableMask: aggregated.usableMask,
    anchor: aggregated.anchor,
    sourceMeta: {
      kind: PROGRAM_KIND,
      trackCount: total,
      validTrackCount: validAnalyses.length,
      failedTrackCount: failedPairs.length,
      titles: normalizedPairs.map((pair) => pair.title),
      coverageScore: aggregated.coverageScore,
      holdoutTrackCount: 0,
    },
    eqModel: null,
    validation: {},
  };

  onProgress?.({ phase: "done", current: total, total });

  return {
    profile: validateCanonicalProfile(profile),
    failedPairs,
  };
}
