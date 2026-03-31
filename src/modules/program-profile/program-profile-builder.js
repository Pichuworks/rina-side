import { PROFILE_TYPE, PROFILE_VERSION, PROGRAM_KIND } from "../player-profile/constants.js";
import { validateCanonicalProfile } from "../player-profile/validator.js";
import { normalizeTrackPairs } from "./track-pairing.js";
import { aggregateProgramTracks } from "./program-aggregation.js";

/**
 * Extract raw stereo Float32Arrays from an AudioBuffer.
 * AudioBuffer cannot be posted to a Worker — raw typed arrays can.
 */
function extractRawStereo(audioBuffer) {
  const ch = Math.max(1, audioBuffer.numberOfChannels || 1);
  return {
    left: audioBuffer.getChannelData(0).slice(),
    right: audioBuffer.getChannelData(Math.min(1, ch - 1)).slice(),
    sampleRate: audioBuffer.sampleRate,
  };
}

/**
 * Run a single pair through the Worker and return a Promise.
 */
function analysePairInWorker(worker, pair, id) {
  return new Promise((resolve) => {
    const handler = (event) => {
      if (event.data.id !== id) return;
      worker.removeEventListener("message", handler);
      resolve(event.data);
    };
    worker.addEventListener("message", handler);

    const ref = extractRawStereo(pair.referenceBuffer);
    const rec = extractRawStereo(pair.recordedBuffer);

    // Transfer the underlying ArrayBuffers so the copy is zero-cost
    worker.postMessage(
      { command: "analyse", id, title: pair.title, ref, rec },
      [ref.left.buffer, ref.right.buffer, rec.left.buffer, rec.right.buffer],
    );
  });
}

/**
 * Build a program (song-based) player profile.
 *
 * Heavy per-pair analysis runs in a Web Worker. The main thread stays
 * responsive and reports progress via onProgress callback.
 *
 * @param {Array} trackPairs
 * @param {object} [options]
 * @param {(progress: object) => void} [onProgress]
 * @returns {Promise<{profile: object, failedPairs: Array}>}
 */
export async function buildProgramProfile(trackPairs, options = {}, onProgress) {
  const normalizedPairs = normalizeTrackPairs(trackPairs);
  const total = normalizedPairs.length;
  const validAnalyses = [];
  const failedPairs = [];

  // Spin up a dedicated worker — terminated when we're done
  const worker = new Worker(
    new URL("../../workers/program-analysis.worker.js", import.meta.url),
    { type: "module" },
  );

  try {
    for (let i = 0; i < total; i++) {
      const pair = normalizedPairs[i];
      onProgress?.({ phase: "analyzing", current: i + 1, total, title: pair.title });

      const result = await analysePairInWorker(worker, pair, i);

      if (result.ok) {
        validAnalyses.push(result.result);
      } else {
        failedPairs.push({
          title: pair.title,
          error: result.error || "Unknown error",
          code: result.code || null,
          detail: result.detail || null,
        });
      }
    }
  } finally {
    worker.terminate();
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
