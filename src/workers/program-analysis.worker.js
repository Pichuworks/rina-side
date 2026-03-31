/**
 * program-analysis.worker.js
 *
 * Offloads the heavy per-pair analysis (resample → align → trim → FFT)
 * off the main thread so the UI never freezes.
 *
 * Protocol:
 *   Main → Worker:
 *     { command: "analyse", id, title,
 *       ref: { left: Float32Array, right: Float32Array, sampleRate },
 *       rec: { left: Float32Array, right: Float32Array, sampleRate } }
 *
 *   Worker → Main:
 *     { id, ok: true, result: { frequencyGridHz, responseDb, confidence, alignmentScore } }
 *     { id, ok: false, error, code, detail }
 */

import { resampleLinear } from "../deck-calibration.js";
import { STANDARD_SAMPLE_RATE } from "../modules/player-profile/constants.js";
import { alignProgramPair, trimAlignedStereo } from "../modules/program-profile/program-alignment.js";
import { analyseProgramTransfer } from "../modules/program-profile/program-transfer.js";

function toStandardRate(stereo) {
  const sr = STANDARD_SAMPLE_RATE;
  if (stereo.sampleRate === sr) return stereo;
  return {
    left: resampleLinear(stereo.left, stereo.sampleRate, sr),
    right: resampleLinear(stereo.right, stereo.sampleRate, sr),
    sampleRate: sr,
  };
}

self.onmessage = (event) => {
  const { command, id, title, ref, rec } = event.data;
  if (command !== "analyse") return;

  try {
    const refStereo = toStandardRate(ref);
    const recStereo = toStandardRate(rec);
    const alignment = alignProgramPair(refStereo, recStereo);
    const trimmed = trimAlignedStereo(refStereo, recStereo, alignment.sampleOffset);
    const analysis = analyseProgramTransfer(
      { ...trimmed.reference, sampleRate: refStereo.sampleRate },
      { ...trimmed.recorded, sampleRate: recStereo.sampleRate },
    );
    self.postMessage({
      id,
      ok: true,
      result: {
        ...analysis,
        title,
        alignmentScore: alignment.alignmentScore,
      },
    });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err.message || String(err),
      code: err.code || null,
      detail: err.detail || null,
    });
  }
};
