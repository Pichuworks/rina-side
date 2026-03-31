import { resampleLinear } from "../../deck-calibration.js";
import { STANDARD_SAMPLE_RATE, PROGRAM_FRAME_SIZE, PROGRAM_HOP_SIZE } from "../player-profile/constants.js";
import { combineConfidence, confidenceFromEnergy, confidenceFromVariation } from "../player-profile/confidence.js";
import { buildFrequencyGridHz } from "../player-profile/frequency-grid.js";
import { dbFromAmplitude, smoothLogCurve, weightedAverage } from "../player-profile/response-curve.js";

function extractStereo(audioBuffer, sampleRate = STANDARD_SAMPLE_RATE) {
  const channels = Math.max(1, audioBuffer.numberOfChannels || 1);
  const leftIn = audioBuffer.getChannelData(0);
  const rightIn = audioBuffer.getChannelData(Math.min(1, channels - 1));
  return {
    left: audioBuffer.sampleRate === sampleRate ? leftIn.slice() : resampleLinear(leftIn, audioBuffer.sampleRate, sampleRate),
    right: audioBuffer.sampleRate === sampleRate ? rightIn.slice() : resampleLinear(rightIn, audioBuffer.sampleRate, sampleRate),
    sampleRate,
  };
}

function hannWindow(length) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = 0.5 - (0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, length - 1)));
  return out;
}

function goertzelMagnitude(frame, freqHz, sampleRate) {
  const coeff = 2 * Math.cos((2 * Math.PI * freqHz) / sampleRate);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < frame.length; i++) {
    s0 = frame[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return Math.sqrt(Math.max(power, 1e-18));
}

function analyseTrackChannel(reference, recorded, sampleRate, gridHz) {
  const window = hannWindow(PROGRAM_FRAME_SIZE);
  const weightedSums = new Array(gridHz.length).fill(0);
  const weightTotals = new Array(gridHz.length).fill(0);
  const valuesPerFreq = gridHz.map(() => []);
  for (let start = 0; start + PROGRAM_FRAME_SIZE <= Math.min(reference.length, recorded.length); start += PROGRAM_HOP_SIZE) {
    const refFrame = new Float32Array(PROGRAM_FRAME_SIZE);
    const recFrame = new Float32Array(PROGRAM_FRAME_SIZE);
    for (let i = 0; i < PROGRAM_FRAME_SIZE; i++) {
      refFrame[i] = reference[start + i] * window[i];
      recFrame[i] = recorded[start + i] * window[i];
    }
    for (let f = 0; f < gridHz.length; f++) {
      const freq = gridHz[f];
      const refMag = goertzelMagnitude(refFrame, freq, sampleRate);
      const recMag = goertzelMagnitude(recFrame, freq, sampleRate);
      const refDb = dbFromAmplitude(refMag);
      const recDb = dbFromAmplitude(recMag);
      const deltaDb = dbFromAmplitude((recMag + 1e-12) / (refMag + 1e-12));
      const conf = combineConfidence(
        confidenceFromEnergy(refDb, -72, -24),
        confidenceFromEnergy(recDb, -78, -24),
      );
      if (conf <= 0) continue;
      weightedSums[f] += deltaDb * conf;
      weightTotals[f] += conf;
      valuesPerFreq[f].push(deltaDb);
    }
  }
  const responseDb = new Array(gridHz.length).fill(0);
  const confidence = new Array(gridHz.length).fill(0);
  for (let i = 0; i < gridHz.length; i++) {
    responseDb[i] = weightTotals[i] > 0 ? weightedSums[i] / weightTotals[i] : 0;
    const localValues = valuesPerFreq[i];
    const variance = localValues.length
      ? localValues.reduce((sum, value) => sum + ((value - responseDb[i]) ** 2), 0) / localValues.length
      : Infinity;
    const std = Number.isFinite(variance) ? Math.sqrt(variance) : 99;
    const stability = confidenceFromVariation(std, 1.25, 6.0);
    const coverage = weightTotals[i] > 0 ? Math.min(1, weightTotals[i] / 12) : 0;
    confidence[i] = Math.max(0, Math.min(1, weightedAverage([stability, coverage], [0.6, 0.4])));
  }
  return {
    responseDb: smoothLogCurve(gridHz, responseDb),
    confidence: smoothLogCurve(gridHz, confidence).map((value) => Math.max(0, Math.min(1, value))),
  };
}

export function extractProgramStereo(audioBuffer) {
  return extractStereo(audioBuffer, STANDARD_SAMPLE_RATE);
}

export function analyseProgramTransfer(referenceStereo, recordedStereo) {
  const gridHz = buildFrequencyGridHz();
  const left = analyseTrackChannel(referenceStereo.left, recordedStereo.left, referenceStereo.sampleRate, gridHz);
  const right = analyseTrackChannel(referenceStereo.right, recordedStereo.right, referenceStereo.sampleRate, gridHz);
  return {
    frequencyGridHz: gridHz,
    responseDb: {
      L: left.responseDb,
      R: right.responseDb,
    },
    confidence: {
      L: left.confidence,
      R: right.confidence,
    },
  };
}
