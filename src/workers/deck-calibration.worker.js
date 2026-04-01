import {
  TEST_TAPE_PROGRAM_SPEC,
  generateTestTapeProgram,
  analyseTestTapeProgram,
  analyseStandardCalibrationTape,
} from "../deck-calibration.js";

function toAudioBufferLike(audio) {
  const left = audio?.left;
  const right = audio?.right || left;
  if (!(left instanceof Float32Array) || !(right instanceof Float32Array)) {
    throw new Error("Invalid audio payload");
  }
  const length = Math.min(left.length, right.length);
  const safeLeft = left.length === length ? left : left.slice(0, length);
  const safeRight = right.length === length ? right : right.slice(0, length);
  return {
    numberOfChannels: 2,
    sampleRate: Number(audio.sampleRate || 48000),
    length,
    getChannelData(channel) {
      return channel === 0 ? safeLeft : safeRight;
    },
  };
}

self.onmessage = (event) => {
  const { command, audio, preset } = event.data || {};
  try {
    const audioBuffer = toAudioBufferLike(audio);
    let result;
    switch (command) {
      case "analyseTestTapeProgram":
        result = analyseTestTapeProgram(audioBuffer, generateTestTapeProgram(TEST_TAPE_PROGRAM_SPEC));
        break;
      case "analyseStandardTape":
        result = analyseStandardCalibrationTape(audioBuffer, preset);
        break;
      default:
        throw new Error("Unknown command: " + command);
    }
    self.postMessage({ ok: true, result });
  } catch (err) {
    self.postMessage({
      ok: false,
      error: err?.message || String(err),
      code: err?.code || null,
      detail: err?.detail || null,
    });
  }
};
