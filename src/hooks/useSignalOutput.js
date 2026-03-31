import { useState, useRef, useCallback, useEffect } from "react";

const CALIBRATION_FREQ_HZ = 1000;
const CALIBRATION_HIGH_FREQ_HZ = 10000;
const CALIBRATION_HF_OFFSET_DB = -20;

function toDb(v) { return v > 0 ? 20 * Math.log10(v) : -Infinity; }

export const SIGNAL_OUTPUT_PRESETS = [
  { id: "rec_level_balance", nameKey: "toolSignalRecBalance", descKey: "toolSignalRecBalanceDesc" },
  { id: "cal", nameKey: "toolSignalCal", descKey: "toolSignalCalDesc" },
  { id: "bias", nameKey: "toolSignalBias", descKey: "toolSignalBiasDesc" },
];

export default function useSignalOutput({ getAC, stopPlaybackRef, tracks, buildPreviewGains, targetDb, showTools }) {
  const [calibrationSide, setCalibrationSide] = useState("A");
  const [signalOutputType, setSignalOutputType] = useState("rec_level_balance");
  const [signalOutputRunning, setSignalOutputRunning] = useState(false);
  const signalOutputRef = useRef({ osc: null, gain: null, merger: null });

  const stopSignalOutput = useCallback(() => {
    const so = signalOutputRef.current;
    if (so.osc) {
      so.osc.onended = null;
      try { so.osc.stop(); } catch { }
    }
    [so.osc, so.gain, so.merger].forEach((node) => {
      try { node?.disconnect(); } catch { }
    });
    signalOutputRef.current = { osc: null, gain: null, merger: null };
    setSignalOutputRunning(false);
  }, []);

  const resolveSignalOutput = useCallback((signalType, side) => {
    const sideTracks = tracks.filter((track) => track.side === side && track.audioBuffer);
    const gains = buildPreviewGains(sideTracks);
    const programPeak = sideTracks.reduce((maxPeak, track, index) => (
      Math.max(maxPeak, (track.peak || 0) * (gains[index] || 1))
    ), 0);
    if (signalType === "rec_level_balance") {
      if (programPeak > 0) {
        return {
          side,
          signalType,
          freqHz: CALIBRATION_FREQ_HZ,
          amplitude: programPeak,
          levelDb: toDb(programPeak),
          sourceKey: "toolProgramPeakSource",
        };
      }
      const targetAmp = Math.pow(10, targetDb / 20);
      return {
        side,
        signalType,
        freqHz: CALIBRATION_FREQ_HZ,
        amplitude: targetAmp,
        levelDb: targetDb,
        sourceKey: "toolTapeTargetSource",
      };
    }
    if (signalType === "cal") {
      const targetAmp = Math.pow(10, targetDb / 20);
      return {
        side,
        signalType,
        freqHz: CALIBRATION_FREQ_HZ,
        amplitude: targetAmp,
        levelDb: targetDb,
        sourceKey: "toolTapeTargetSource",
      };
    }
    const hfLevelDb = targetDb + CALIBRATION_HF_OFFSET_DB;
    const hfAmp = Math.pow(10, hfLevelDb / 20);
    return {
      side,
      signalType,
      freqHz: CALIBRATION_HIGH_FREQ_HZ,
      amplitude: hfAmp,
      levelDb: hfLevelDb,
      sourceKey: "toolHighFreqSource",
    };
  }, [buildPreviewGains, targetDb, tracks]);

  const startSignalOutput = useCallback(async () => {
    if (stopPlaybackRef.current) stopPlaybackRef.current();
    stopSignalOutput();
    const ctx = getAC();
    if (ctx.state === "suspended") await ctx.resume();
    const signal = resolveSignalOutput(signalOutputType, calibrationSide);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = signal.freqHz;
    const gain = ctx.createGain();
    gain.gain.value = signal.amplitude;
    const merger = ctx.createChannelMerger(2);
    osc.connect(gain);
    gain.connect(merger, 0, 0);
    gain.connect(merger, 0, 1);
    merger.connect(ctx.destination);
    osc.start();
    signalOutputRef.current = { osc, gain, merger };
    setSignalOutputRunning(true);
  }, [calibrationSide, signalOutputType, getAC, resolveSignalOutput, stopSignalOutput, stopPlaybackRef]);

  useEffect(() => {
    if (!showTools) stopSignalOutput();
  }, [showTools, stopSignalOutput]);

  return {
    calibrationSide, setCalibrationSide,
    signalOutputType, setSignalOutputType,
    signalOutputRunning,
    resolveSignalOutput,
    startSignalOutput,
    stopSignalOutput,
    signalOutputRef,
  };
}
