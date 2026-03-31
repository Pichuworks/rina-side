import { WORKBENCH_ERROR } from "../player-profile/constants.js";

export function normalizeTrackPairs(trackPairs) {
  if (!Array.isArray(trackPairs) || trackPairs.length < 1) {
    const error = new Error("Song mode requires at least one track pair");
    error.code = WORKBENCH_ERROR.PROGRAM_NO_TRACK_PAIRS;
    throw error;
  }
  return trackPairs.map((pair, index) => {
    if (!pair?.referenceBuffer || !pair?.recordedBuffer) {
      throw new Error(`trackPairs[${index}] is incomplete`);
    }
    return {
      id: pair.id || `track-${index + 1}`,
      title: pair.title || `Track ${index + 1}`,
      referenceBuffer: pair.referenceBuffer,
      recordedBuffer: pair.recordedBuffer,
    };
  });
}
