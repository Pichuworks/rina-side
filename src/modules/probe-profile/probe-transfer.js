import { buildFrequencyGridHz } from "../player-profile/frequency-grid.js";
import { combineConfidence, confidenceFromEnergy, confidenceFromVariation } from "../player-profile/confidence.js";
import { dbFromAmplitude, smoothLogCurve } from "../player-profile/response-curve.js";

const TWO_PI = Math.PI * 2;

function goertzelMagnitude(data, center, length, freqHz, sampleRate) {
  const half = Math.floor(length / 2);
  const start = Math.max(0, center - half);
  const end = Math.min(data.length, start + length);
  const coeff = 2 * Math.cos((TWO_PI * freqHz) / sampleRate);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = start; i < end; i++) {
    const local = i - start;
    const w = 0.5 - 0.5 * Math.cos((TWO_PI * local) / Math.max(1, end - start - 1));
    s0 = data[i] * w + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return Math.sqrt(Math.max(power, 1e-18));
}

function analyseSweepChannel(referenceSweep, recordedSweep, sampleRate, gridHz, startHz, endHz) {
  const measuredDb = [];
  const confidence = [];
  const logSpan = Math.log(endHz / startHz);
  for (let i = 0; i < gridHz.length; i++) {
    const freq = gridHz[i];
    const t = Math.log(freq / startHz) / logSpan;
    const center = Math.round(t * (referenceSweep.length - 1));
    const cycles = Math.max(8, Math.min(96, Math.round((sampleRate / Math.max(freq, 1)) * 10)));
    const refMag = goertzelMagnitude(referenceSweep, center, cycles, freq, sampleRate);
    const recMag = goertzelMagnitude(recordedSweep, center, cycles, freq, sampleRate);
    const response = dbFromAmplitude((recMag + 1e-12) / (refMag + 1e-12));
    measuredDb.push(response);
    const refDb = dbFromAmplitude(refMag);
    const recDb = dbFromAmplitude(recMag);
    confidence.push(combineConfidence(
      confidenceFromEnergy(refDb),
      confidenceFromEnergy(recDb),
      confidenceFromVariation(Math.abs(response), 1.5, 18.0),
    ));
  }
  return {
    responseDb: smoothLogCurve(gridHz, measuredDb),
    confidence: smoothLogCurve(gridHz, confidence).map((value) => Math.max(0, Math.min(1, value))),
  };
}

export function estimateProbeTransfer(referenceSweep, recordedSegments, manifest) {
  const gridHz = buildFrequencyGridHz();
  const left = analyseSweepChannel(referenceSweep, recordedSegments["l-only-ess"].left, manifest.sampleRate, gridHz, manifest.startHz, manifest.endHz);
  const right = analyseSweepChannel(referenceSweep, recordedSegments["r-only-ess"].right, manifest.sampleRate, gridHz, manifest.startHz, manifest.endHz);
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
