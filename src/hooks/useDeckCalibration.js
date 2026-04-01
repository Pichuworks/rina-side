import { useState, useRef, useCallback, useEffect } from "react";
import {
  RESPONSE_MEASUREMENT_SPEC,
  TRANSPORT_MEASUREMENT_SPEC,
  TEST_TAPE_PROGRAM_SPEC,
  generateTestTapeProgram,
  STANDARD_TAPE_PRESETS,
} from "../deck-calibration.js";
import { getProfileCorrectionDb } from "../calibration-profile.js";

function extractRawStereo(audioBuffer) {
  const channels = Math.max(1, audioBuffer.numberOfChannels || 1);
  return {
    left: audioBuffer.getChannelData(0).slice(),
    right: audioBuffer.getChannelData(Math.min(1, channels - 1)).slice(),
    sampleRate: audioBuffer.sampleRate,
  };
}

function interpolateLogValue(frequenciesHz, values, targetHz) {
  if (!frequenciesHz?.length || !values?.length) return 0;
  if (targetHz <= frequenciesHz[0]) return values[0] ?? 0;
  const last = frequenciesHz.length - 1;
  if (targetHz >= frequenciesHz[last]) return values[last] ?? 0;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frequenciesHz[mid] > targetHz) hi = mid;
    else lo = mid;
  }
  const f0 = Math.max(1e-6, frequenciesHz[lo]);
  const f1 = Math.max(f0 + 1e-6, frequenciesHz[hi]);
  const t = Math.log(targetHz / f0) / Math.log(f1 / f0);
  const a = values[lo] ?? 0;
  const b = values[hi] ?? 0;
  return a + ((b - a) * t);
}

function normalizeMeasuredCurve(curve, anchorHz = 1000) {
  if (!curve?.frequenciesHz?.length) return curve;
  const measuredDb = Array.isArray(curve.measuredDb) ? curve.measuredDb : null;
  const correctionDb = Array.isArray(curve.correctionDb) ? curve.correctionDb : null;
  if (!measuredDb?.length && !correctionDb?.length) return curve;
  const measuredSource = measuredDb?.length ? measuredDb : correctionDb.map((value) => -(value ?? 0));
  const anchorDb = interpolateLogValue(curve.frequenciesHz, measuredSource, anchorHz);
  const normalizedMeasured = measuredSource.map((value) => (value ?? 0) - anchorDb);
  return {
    ...curve,
    measuredDb: normalizedMeasured,
    correctionDb: normalizedMeasured.map((value) => -value),
    phaseRad: Array.isArray(curve.phaseRad) ? [...curve.phaseRad] : curve.phaseRad,
  };
}

function normalizeResponseAnalysisAnchoring(responseAnalysis, anchorHz = 1000) {
  if (!responseAnalysis?.frequenciesHz?.length) return responseAnalysis;
  const normalizeTopCurve = (channel) => normalizeMeasuredCurve({
    frequenciesHz: responseAnalysis.frequenciesHz,
    measuredDb: channel?.measuredDb,
    correctionDb: channel?.correctionDb,
    phaseRad: channel?.phaseRad,
  }, anchorHz);
  const normalizeChannel = (channel) => {
    if (!channel) return channel;
    const normalizedTop = normalizeTopCurve(channel);
    return {
      ...channel,
      measuredDb: normalizedTop?.measuredDb || [],
      correctionDb: normalizedTop?.correctionDb || [],
      phaseRad: normalizedTop?.phaseRad || [],
      levelCurves: (channel.levelCurves || []).map((curve) => normalizeMeasuredCurve(curve, anchorHz)),
      validationCurve: channel.validationCurve ? normalizeMeasuredCurve(channel.validationCurve, anchorHz) : null,
    };
  };
  const next = {
    ...responseAnalysis,
    channels: {
      L: normalizeChannel(responseAnalysis.channels?.L),
      R: normalizeChannel(responseAnalysis.channels?.R),
    },
  };
  if (next.profile?.channels) {
    next.profile = {
      ...next.profile,
      channels: {
        L: {
          ...(next.profile.channels.L || {}),
          frequenciesHz: next.channels.L?.validationCurve?.frequenciesHz || next.channels.L?.frequenciesHz || next.profile.channels.L?.frequenciesHz || [],
          correctionDb: next.channels.L?.correctionDb || next.profile.channels.L?.correctionDb || [],
          phaseRad: next.channels.L?.phaseRad || next.profile.channels.L?.phaseRad || [],
          levelCurves: (next.channels.L?.levelCurves || []).map((curve) => ({
            inputDb: curve.inputDb,
            role: curve.role,
            frequenciesHz: curve.frequenciesHz,
            correctionDb: curve.correctionDb,
            phaseRad: curve.phaseRad,
          })),
        },
        R: {
          ...(next.profile.channels.R || {}),
          frequenciesHz: next.channels.R?.validationCurve?.frequenciesHz || next.channels.R?.frequenciesHz || next.profile.channels.R?.frequenciesHz || [],
          correctionDb: next.channels.R?.correctionDb || next.profile.channels.R?.correctionDb || [],
          phaseRad: next.channels.R?.phaseRad || next.profile.channels.R?.phaseRad || [],
          levelCurves: (next.channels.R?.levelCurves || []).map((curve) => ({
            inputDb: curve.inputDb,
            role: curve.role,
            frequenciesHz: curve.frequenciesHz,
            correctionDb: curve.correctionDb,
            phaseRad: curve.phaseRad,
          })),
        },
      },
    };
  }
  return next;
}

export default function useDeckCalibration({
  T,
  showToast,
  downloadBlob,
  encodeWAV,
  decodeExternalAudioFile,
  setProcessing,
  setProcMsg,
  showTools,
}) {
  const deckCalBrowserRecordingEnabled = false;
  const [deckCalProgramManifest, setDeckCalProgramManifest] = useState(null);
  const [deckCalProgramManifestName, setDeckCalProgramManifestName] = useState("");
  const [deckCalRecordingKind, setDeckCalRecordingKind] = useState("");
  const [deckCalCapture, setDeckCalCapture] = useState(null);
  const [deckCalCaptureName, setDeckCalCaptureName] = useState("");
  const [responseAnalysis, setResponseAnalysis] = useState(null);
  const [transportAnalysis, setTransportAnalysis] = useState(null);
  const deckCalRecordRef = useRef({ recorder: null, stream: null, chunks: [], kind: "" });
  const [standardTapePreset, setStandardTapePreset] = useState("aiwa-3freq");

  const loadDeckCalProgramManifestFile = useCallback(async (file) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      if (raw?.type !== "side.test-tape-program-manifest") throw new Error("Not a test tape program manifest");
      setDeckCalProgramManifest(raw);
      setDeckCalProgramManifestName(file.name);
      showToast(T("toolManifestImported"));
    } catch (err) {
      showToast(`${T("playlistImportError")}: ${err.message}`, 5000);
    }
  }, [T, showToast]);

  const clearDeckCalProgramManifest = useCallback(() => {
    setDeckCalProgramManifest(null);
    setDeckCalProgramManifestName("");
  }, []);

  const baselineProfileForChannel = useCallback((baselineChannel, channel) => ({
    channels: {
      [channel]: {
        frequenciesHz: baselineChannel?.frequenciesHz || [],
        correctionDb: baselineChannel?.referenceDb || baselineChannel?.correctionDb || [],
      },
    },
  }), []);

  const adjustCurveWithBaseline = useCallback((curve, baselineChannel, channel) => {
    if (!curve?.frequenciesHz?.length || !curve?.measuredDb?.length || !curve?.correctionDb?.length) return null;
    const baselineProfile = baselineProfileForChannel(baselineChannel, channel);
    const measuredDb = curve.frequenciesHz.map((freq, index) => (
      curve.measuredDb[index] - getProfileCorrectionDb(baselineProfile, freq, channel)
    ));
    const correctionDb = curve.frequenciesHz.map((freq, index) => (
      curve.correctionDb[index] + getProfileCorrectionDb(baselineProfile, freq, channel)
    ));
    return {
      ...curve,
      measuredDb,
      correctionDb,
    };
  }, [baselineProfileForChannel]);

  const pickBaselineCurve = useCallback((baselineChannel, inputDb) => {
    const levelCurves = baselineChannel?.levelCurves || [];
    if (!levelCurves.length) return baselineChannel;
    const exact = levelCurves.find((curve) => Number(curve.inputDb) === Number(inputDb));
    if (exact) return exact;
    return baselineChannel;
  }, []);

  const pickRepresentativeCurve = useCallback((channel) => {
    if (channel?.validationCurve?.correctionDb?.length) return channel.validationCurve;
    if (channel?.correctionDb?.length && channel?.frequenciesHz?.length) return channel;
    const levelCurves = channel?.levelCurves || [];
    if (!levelCurves.length) return { frequenciesHz: [], correctionDb: [], measuredDb: [] };
    return levelCurves[Math.floor(levelCurves.length / 2)];
  }, []);

  const adjustResponseChannelWithBaseline = useCallback((analysisChannel, baselineChannel, frequenciesHz, channel) => {
    if (!analysisChannel?.measuredDb?.length || !baselineChannel?.frequenciesHz?.length || !baselineChannel?.referenceDb?.length) {
      throw new Error(`Baseline response data is invalid for channel ${channel}`);
    }
    const representative = adjustCurveWithBaseline({
      frequenciesHz,
      measuredDb: analysisChannel.measuredDb,
      correctionDb: analysisChannel.correctionDb,
      phaseRad: analysisChannel.phaseRad,
      residualGroupDelayMs: analysisChannel.residualGroupDelayMs,
      clarity: analysisChannel.clarity,
    }, baselineChannel, channel);
    const levelCurves = (analysisChannel.levelCurves || [])
      .map((curve) => adjustCurveWithBaseline(curve, pickBaselineCurve(baselineChannel, curve.inputDb), channel))
      .filter(Boolean);
    const validationCurve = analysisChannel.validationCurve
      ? adjustCurveWithBaseline(
        analysisChannel.validationCurve,
        pickBaselineCurve(baselineChannel, analysisChannel.validationCurve.inputDb),
        channel,
      )
      : null;
    return {
      measuredDb: representative?.measuredDb || [],
      correctionDb: representative?.correctionDb || [],
      phaseRad: representative?.phaseRad || analysisChannel.phaseRad || [],
      residualGroupDelayMs: representative?.residualGroupDelayMs || analysisChannel.residualGroupDelayMs || [],
      clarity: representative?.clarity || analysisChannel.clarity || null,
      levelCurves,
      validationCurve,
    };
  }, [adjustCurveWithBaseline, pickBaselineCurve]);

  const applyProgramManifestToResponse = useCallback((analysis, manifest) => {
    const baseline = manifest?.baselines?.response;
    if (!baseline?.channels?.L || !baseline?.channels?.R) {
      throw new Error("Baseline response data is invalid");
    }
    const adjustedLeft = adjustResponseChannelWithBaseline(
      analysis.channels?.L,
      baseline.channels.L,
      analysis.frequenciesHz,
      "L",
    );
    const adjustedRight = adjustResponseChannelWithBaseline(
      analysis.channels?.R,
      baseline.channels.R,
      analysis.frequenciesHz,
      "R",
    );
    const representativeLeft = pickRepresentativeCurve(adjustedLeft);
    const representativeRight = pickRepresentativeCurve(adjustedRight);
    return {
      ...analysis,
      frequenciesHz: representativeLeft?.frequenciesHz || analysis.frequenciesHz,
      channels: {
        L: {
          ...adjustedLeft,
          frequenciesHz: representativeLeft?.frequenciesHz || analysis.frequenciesHz,
          measuredDb: representativeLeft?.measuredDb || adjustedLeft.measuredDb,
          correctionDb: representativeLeft?.correctionDb || adjustedLeft.correctionDb,
          residualGroupDelayMs: representativeLeft?.residualGroupDelayMs || adjustedLeft.residualGroupDelayMs || [],
          clarity: representativeLeft?.clarity || adjustedLeft.clarity || null,
        },
        R: {
          ...adjustedRight,
          frequenciesHz: representativeRight?.frequenciesHz || analysis.frequenciesHz,
          measuredDb: representativeRight?.measuredDb || adjustedRight.measuredDb,
          correctionDb: representativeRight?.correctionDb || adjustedRight.correctionDb,
          residualGroupDelayMs: representativeRight?.residualGroupDelayMs || adjustedRight.residualGroupDelayMs || [],
          clarity: representativeRight?.clarity || adjustedRight.clarity || null,
        },
      },
      dynamicModel: analysis.dynamicModel,
      manifestName: manifest.name,
      profile: {
        ...analysis.profile,
        sourceManifest: { name: manifest.name, createdAt: manifest.createdAt },
        dynamicModel: analysis.profile?.dynamicModel || analysis.dynamicModel,
        channels: {
          L: {
            frequenciesHz: representativeLeft?.frequenciesHz || analysis.frequenciesHz,
            correctionDb: representativeLeft?.correctionDb || adjustedLeft.correctionDb,
            phaseRad: representativeLeft?.phaseRad || adjustedLeft.phaseRad || [],
            levelCurves: adjustedLeft.levelCurves.map((curve) => ({
              inputDb: curve.inputDb,
              role: curve.role,
              frequenciesHz: curve.frequenciesHz,
              correctionDb: curve.correctionDb,
              phaseRad: curve.phaseRad,
            })),
          },
          R: {
            frequenciesHz: representativeRight?.frequenciesHz || analysis.frequenciesHz,
            correctionDb: representativeRight?.correctionDb || adjustedRight.correctionDb,
            phaseRad: representativeRight?.phaseRad || adjustedRight.phaseRad || [],
            levelCurves: adjustedRight.levelCurves.map((curve) => ({
              inputDb: curve.inputDb,
              role: curve.role,
              frequenciesHz: curve.frequenciesHz,
              correctionDb: curve.correctionDb,
              phaseRad: curve.phaseRad,
            })),
          },
        },
      },
    };
  }, [adjustResponseChannelWithBaseline, pickRepresentativeCurve]);

  const applyProgramManifestToTransport = useCallback((analysis, manifest) => {
    const baseline = manifest?.baselines?.transport;
    if (!analysis || !baseline?.referenceMeanHz) return analysis;
    const referenceMeanHz = baseline.referenceMeanHz;
    return {
      ...analysis,
      referenceMeanHz,
      transportReferenceMode: baseline.referenceMode || "writer-relative",
      speedErrorPercent: ((analysis.meanHz - referenceMeanHz) / referenceMeanHz) * 100,
      writerWowFlutterFloorPercentRms: baseline.wowFlutterFloorPercentRms || 0,
      manifestName: manifest.name,
    };
  }, []);

  const exportTestTapeProgram = useCallback(async () => {
    const program = generateTestTapeProgram(TEST_TAPE_PROGRAM_SPEC);
    downloadBlob(encodeWAV(program.bufferLike, 24), "deck-cal-test-tape-program.wav");
    showToast(T("toolRefExported"));
  }, [T, downloadBlob, encodeWAV, showToast]);

  const importDeckCalCaptureFile = useCallback(async (file) => {
    if (!file) return;
    setProcessing(true);
    try {
      const ab = await decodeExternalAudioFile(file);
      setDeckCalCapture(ab);
      setDeckCalCaptureName(file.name);
      setResponseAnalysis(null);
      setTransportAnalysis(null);
      showToast(T("toolCaptureImported"));
    } catch (err) {
      showToast(`${T("playlistImportError")}: ${err.message}`, 5000);
    } finally {
      setProcessing(false);
      setProcMsg("");
    }
  }, [T, decodeExternalAudioFile, setProcessing, setProcMsg, showToast]);

  const averageCurves = useCallback((curves) => {
    if (!curves?.length) return null;
    const first = curves[0];
    if (!first?.correctionDb?.length) return null;
    const count = curves.length;
    const avgMeasured = new Float64Array(first.measuredDb?.length || 0);
    const avgCorrection = new Float64Array(first.correctionDb.length);
    const avgPhase = first.phaseRad?.length ? new Float64Array(first.phaseRad.length) : null;
    const avgResidualGroupDelay = first.residualGroupDelayMs?.length ? new Float64Array(first.residualGroupDelayMs.length) : null;
    let sumGroupDelayResidualRmsMs = 0;
    let sumGroupDelayResidualMaxMs = 0;
    let sumGroupDelayResidualMaxFreqHz = 0;
    let sumTransientSpreadMs = 0;
    let clarityCount = 0;
    for (const curve of curves) {
      for (let i = 0; i < avgMeasured.length; i++) avgMeasured[i] += curve.measuredDb?.[i] || 0;
      for (let i = 0; i < avgCorrection.length; i++) avgCorrection[i] += curve.correctionDb?.[i] || 0;
      if (avgPhase) {
        for (let i = 0; i < avgPhase.length; i++) avgPhase[i] += curve.phaseRad?.[i] || 0;
      }
      if (avgResidualGroupDelay) {
        for (let i = 0; i < avgResidualGroupDelay.length; i++) avgResidualGroupDelay[i] += curve.residualGroupDelayMs?.[i] || 0;
      }
      if (curve.clarity) {
        sumGroupDelayResidualRmsMs += Number(curve.clarity.groupDelayResidualRmsMs || 0);
        sumGroupDelayResidualMaxMs += Number(curve.clarity.groupDelayResidualMaxMs || 0);
        sumGroupDelayResidualMaxFreqHz += Number(curve.clarity.groupDelayResidualMaxFreqHz || 0);
        sumTransientSpreadMs += Number(curve.clarity.transientSpreadMs || 0);
        clarityCount += 1;
      }
    }
    for (let i = 0; i < avgMeasured.length; i++) avgMeasured[i] /= count;
    for (let i = 0; i < avgCorrection.length; i++) avgCorrection[i] /= count;
    if (avgPhase) {
      for (let i = 0; i < avgPhase.length; i++) avgPhase[i] /= count;
    }
    if (avgResidualGroupDelay) {
      for (let i = 0; i < avgResidualGroupDelay.length; i++) avgResidualGroupDelay[i] /= count;
    }
    return {
      ...first,
      measuredDb: Array.from(avgMeasured),
      correctionDb: Array.from(avgCorrection),
      phaseRad: avgPhase ? Array.from(avgPhase) : [],
      residualGroupDelayMs: avgResidualGroupDelay ? Array.from(avgResidualGroupDelay) : [],
      clarity: clarityCount ? {
        groupDelayResidualRmsMs: sumGroupDelayResidualRmsMs / clarityCount,
        groupDelayResidualMaxMs: sumGroupDelayResidualMaxMs / clarityCount,
        groupDelayResidualMaxFreqHz: Math.round(sumGroupDelayResidualMaxFreqHz / clarityCount),
        transientSpreadMs: sumTransientSpreadMs / clarityCount,
      } : null,
    };
  }, []);

  const averageToneSeries = useCallback((series) => {
    if (!series?.length) return [];
    const first = series[0];
    const out = [];
    for (let i = 0; i < first.length; i++) {
      let sumMeasured = 0;
      let sumThdPercent = 0;
      let sumThdDb = 0;
      for (const set of series) {
        sumMeasured += set[i]?.measuredDb || 0;
        sumThdPercent += set[i]?.thdPercent || 0;
        sumThdDb += set[i]?.thdDb || 0;
      }
      out.push({
        ...first[i],
        measuredDb: sumMeasured / series.length,
        thdPercent: sumThdPercent / series.length,
        thdDb: sumThdDb / series.length,
      });
    }
    return out;
  }, []);

  const averageNullableSeries = useCallback((series) => {
    if (!series?.length) return [];
    const maxLength = series.reduce((max, values) => Math.max(max, values?.length || 0), 0);
    const out = [];
    for (let index = 0; index < maxLength; index++) {
      let sum = 0;
      let count = 0;
      for (const values of series) {
        const value = values?.[index];
        if (value == null || !Number.isFinite(value)) continue;
        sum += value;
        count += 1;
      }
      out.push(count ? (sum / count) : null);
    }
    return out;
  }, []);

  const averageNumericSeries = useCallback((series) => {
    if (!series?.length) return [];
    const maxLength = series.reduce((max, values) => Math.max(max, values?.length || 0), 0);
    const out = [];
    for (let index = 0; index < maxLength; index++) {
      let sum = 0;
      let count = 0;
      for (const values of series) {
        const value = values?.[index];
        if (!Number.isFinite(value)) continue;
        sum += value;
        count += 1;
      }
      out.push(count ? (sum / count) : 0);
    }
    return out;
  }, []);

  const averageStandardTapeResults = useCallback((results, preset) => {
    if (!results?.length) return null;
    const first = results[0];
    const measuredDbL = averageNullableSeries(results.map((result) => result.measuredDbL || []));
    const measuredDbR = averageNullableSeries(results.map((result) => result.measuredDbR || []));
    const correctionDbL = averageNumericSeries(results.map((result) => result.channels?.L?.correctionDb || []));
    const correctionDbR = averageNumericSeries(results.map((result) => result.channels?.R?.correctionDb || []));
    const missingFreqs = (first.frequencies || []).filter((_, index) => (
      results.every((result) => result.measuredDbL?.[index] == null || result.measuredDbR?.[index] == null)
    ));
    return {
      ...first,
      preset: preset?.name || first.preset,
      measuredDbL,
      measuredDbR,
      missingFreqs,
      channels: {
        L: {
          ...(first.channels?.L || {}),
          measuredDb: measuredDbL.map((value) => value ?? 0),
          correctionDb: correctionDbL,
        },
        R: {
          ...(first.channels?.R || {}),
          measuredDb: measuredDbR.map((value) => value ?? 0),
          correctionDb: correctionDbR,
        },
      },
      profile: {
        ...(first.profile || {}),
        name: `${first.profile?.name || `Playback Cal (${preset?.name || first.preset || "Standard Tape"})`} (${results.length}-pass avg)`,
        channels: {
          L: {
            ...(first.profile?.channels?.L || {}),
            correctionDb: correctionDbL,
          },
          R: {
            ...(first.profile?.channels?.R || {}),
            correctionDb: correctionDbR,
          },
        },
      },
      passCount: results.length,
    };
  }, [averageNullableSeries, averageNumericSeries]);

  // ── Multi-pass capture accumulation ───────────────────────
  const [multiCaptures, setMultiCaptures] = useState([]);

  const importMultiCaptureFiles = useCallback(async (files) => {
    if (!files?.length) return;
    setProcessing(true);
    const loaded = [];
    try {
      for (let i = 0; i < files.length; i++) {
        setProcMsg(`读取回放录音 [${i + 1}/${files.length}] ${files[i].name}`);
        const ab = await decodeExternalAudioFile(files[i]);
        loaded.push({ name: files[i].name, audioBuffer: ab });
      }
      setMultiCaptures((prev) => [...prev, ...loaded]);
      setResponseAnalysis(null);
      setTransportAnalysis(null);
      showToast(`已加载 ${loaded.length} 个回放录音（共 ${multiCaptures.length + loaded.length} 个）`);
    } catch (err) {
      showToast(`导入失败: ${err.message}`, 5000);
    } finally {
      setProcessing(false);
      setProcMsg("");
    }
  }, [decodeExternalAudioFile, multiCaptures.length, setProcessing, setProcMsg, showToast]);

  const clearMultiCaptures = useCallback(() => {
    setMultiCaptures([]);
    setResponseAnalysis(null);
    setTransportAnalysis(null);
  }, []);

  const runDeckCalibrationWorker = useCallback((command, audioBuffer, extra = {}) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("../workers/deck-calibration.worker.js", import.meta.url),
        { type: "module" },
      );
      const audio = extractRawStereo(audioBuffer);
      worker.onmessage = (event) => {
        worker.terminate();
        resolve(event.data);
      };
      worker.onerror = (event) => {
        worker.terminate();
        reject(new Error(event.message || "Deck calibration worker failed"));
      };
      worker.postMessage(
        { command, audio, ...extra },
        [audio.left.buffer, audio.right.buffer],
      );
    });
  }, []);

  const analyseMultiCaptures = useCallback(async (scenario = "self") => {
    if (!multiCaptures.length) return;
    setProcessing(true);
    try {
      if (scenario === "playback") {
        const preset = STANDARD_TAPE_PRESETS[standardTapePreset];
        if (!preset) throw new Error("No standard tape preset selected");
        const results = [];
        const failedPasses = [];
        for (let i = 0; i < multiCaptures.length; i++) {
          setProcMsg(`分析 [${i + 1}/${multiCaptures.length}] ${multiCaptures[i].name}`);
          try {
            const workerResult = await runDeckCalibrationWorker(
              "analyseStandardTape",
              multiCaptures[i].audioBuffer,
              { preset },
            );
            if (!workerResult?.ok) throw new Error(workerResult?.error || "Worker error");
            results.push(workerResult.result);
          } catch (err) {
            failedPasses.push({ name: multiCaptures[i].name, error: err.message });
          }
        }
        if (!results.length) throw new Error("所有回放录音分析均失败");
        const averaged = averageStandardTapeResults(results, preset);
        setResponseAnalysis(averaged);
        setTransportAnalysis(null);
        if (failedPasses.length) {
          showToast(`分析完成：${results.length}/${multiCaptures.length} 个成功，${failedPasses.length} 个跳过`, 6000);
        } else {
          showToast(`${results.length} 次回放均值分析完成`);
        }
        return;
      }

      const results = [];
      const failedPasses = [];
      for (let i = 0; i < multiCaptures.length; i++) {
        setProcMsg(`分析 [${i + 1}/${multiCaptures.length}] ${multiCaptures[i].name}`);
        try {
          const workerResult = await runDeckCalibrationWorker(
            "analyseTestTapeProgram",
            multiCaptures[i].audioBuffer,
          );
          if (!workerResult?.ok) throw new Error(workerResult?.error || "Worker error");
          results.push(workerResult.result);
        } catch (err) {
          failedPasses.push({ name: multiCaptures[i].name, error: err.message });
        }
      }
      if (!results.length) throw new Error("所有回放录音分析均失败");

      const firstResp = results[0].response;
      const n = results.length;
      const avgTopL = averageCurves(results.map((result) => ({
        frequenciesHz: result.response.frequenciesHz,
        measuredDb: result.response.channels?.L?.measuredDb || [],
        correctionDb: result.response.channels?.L?.correctionDb || [],
        residualGroupDelayMs: result.response.channels?.L?.residualGroupDelayMs || [],
        phaseRad: result.response.channels?.L?.phaseRad || [],
        clarity: result.response.channels?.L?.clarity || null,
      })));
      const avgTopR = averageCurves(results.map((result) => ({
        frequenciesHz: result.response.frequenciesHz,
        measuredDb: result.response.channels?.R?.measuredDb || [],
        correctionDb: result.response.channels?.R?.correctionDb || [],
        residualGroupDelayMs: result.response.channels?.R?.residualGroupDelayMs || [],
        phaseRad: result.response.channels?.R?.phaseRad || [],
        clarity: result.response.channels?.R?.clarity || null,
      })));
      const avgLevelCurvesL = (firstResp.channels?.L?.levelCurves || []).map((curve, index) => averageCurves(
        results.map((result) => result.response.channels?.L?.levelCurves?.[index]).filter(Boolean),
      )).filter(Boolean);
      const avgLevelCurvesR = (firstResp.channels?.R?.levelCurves || []).map((curve, index) => averageCurves(
        results.map((result) => result.response.channels?.R?.levelCurves?.[index]).filter(Boolean),
      )).filter(Boolean);
      const avgValidationL = firstResp.channels?.L?.validationCurve
        ? averageCurves(results.map((result) => result.response.channels?.L?.validationCurve).filter(Boolean))
        : null;
      const avgValidationR = firstResp.channels?.R?.validationCurve
        ? averageCurves(results.map((result) => result.response.channels?.R?.validationCurve).filter(Boolean))
        : null;
      const avgToneMapL = averageToneSeries(results.map((result) => result.response.dynamicModel?.toneMap?.L || []));
      const avgToneMapR = averageToneSeries(results.map((result) => result.response.dynamicModel?.toneMap?.R || []));

      const avgResponse = {
        ...firstResp,
        frequenciesHz: avgTopL?.frequenciesHz || firstResp.frequenciesHz,
        channels: {
          L: {
            measuredDb: avgTopL?.measuredDb || [],
            correctionDb: avgTopL?.correctionDb || [],
            phaseRad: avgTopL?.phaseRad || [],
            residualGroupDelayMs: avgTopL?.residualGroupDelayMs || [],
            clarity: avgTopL?.clarity || null,
            levelCurves: avgLevelCurvesL,
            validationCurve: avgValidationL,
          },
          R: {
            measuredDb: avgTopR?.measuredDb || [],
            correctionDb: avgTopR?.correctionDb || [],
            phaseRad: avgTopR?.phaseRad || [],
            residualGroupDelayMs: avgTopR?.residualGroupDelayMs || [],
            clarity: avgTopR?.clarity || null,
            levelCurves: avgLevelCurvesR,
            validationCurve: avgValidationR,
          },
        },
        dynamicModel: {
          ...(firstResp.dynamicModel || {}),
          toneMap: {
            L: avgToneMapL,
            R: avgToneMapR,
          },
        },
        profile: {
          ...firstResp.profile,
          name: `${firstResp.profile?.name || "Calibration"} (${n}-pass avg)`,
          dynamicModel: {
            ...(firstResp.profile?.dynamicModel || firstResp.dynamicModel || {}),
            toneMap: {
              L: avgToneMapL,
              R: avgToneMapR,
            },
          },
          channels: {
            L: {
              frequenciesHz: avgTopL?.frequenciesHz || [],
              correctionDb: avgTopL?.correctionDb || [],
              phaseRad: avgTopL?.phaseRad || [],
              levelCurves: avgLevelCurvesL.map((curve) => ({
                inputDb: curve.inputDb,
                role: curve.role,
                frequenciesHz: curve.frequenciesHz,
                correctionDb: curve.correctionDb,
                phaseRad: curve.phaseRad,
              })),
            },
            R: {
              frequenciesHz: avgTopR?.frequenciesHz || [],
              correctionDb: avgTopR?.correctionDb || [],
              phaseRad: avgTopR?.phaseRad || [],
              levelCurves: avgLevelCurvesR.map((curve) => ({
                inputDb: curve.inputDb,
                role: curve.role,
                frequenciesHz: curve.frequenciesHz,
                correctionDb: curve.correctionDb,
                phaseRad: curve.phaseRad,
              })),
            },
          },
        },
        passCount: n,
        failedPasses,
      };

      // Average transport
      let avgTransport = results[0].transport;
      if (results.length > 1 && results[0].transport) {
        const sumSpeed = results.reduce((s, r) => s + (r.transport?.speedErrorPercent || 0), 0);
        const sumWfRms = results.reduce((s, r) => s + (r.transport?.wowFlutterPercentRms || 0), 0);
        const sumWfPk = results.reduce((s, r) => s + (r.transport?.wowFlutterPercentPkPk || 0), 0);
        const sumMean = results.reduce((s, r) => s + (r.transport?.meanHz || 0), 0);
        avgTransport = {
          ...results[0].transport,
          speedErrorPercent: sumSpeed / n,
          wowFlutterPercentRms: sumWfRms / n,
          wowFlutterPercentPkPk: sumWfPk / n,
          meanHz: sumMean / n,
        };
      }

      const shouldApplyManifest = scenario === "test-tape" && deckCalProgramManifest;
      const normalizedResponse = normalizeResponseAnalysisAnchoring(avgResponse);
      const nextResponse = shouldApplyManifest ? applyProgramManifestToResponse(normalizedResponse, deckCalProgramManifest) : normalizedResponse;
      const nextTransport = shouldApplyManifest ? applyProgramManifestToTransport(avgTransport, deckCalProgramManifest) : avgTransport;
      setResponseAnalysis(nextResponse);
      setTransportAnalysis(nextTransport);

      if (failedPasses.length) {
        showToast(`分析完成：${n}/${multiCaptures.length} 个成功，${failedPasses.length} 个跳过`, 6000);
      } else {
        showToast(`${n} 次回放均值分析完成`);
      }
    } catch (err) {
      showToast(`多次分析失败: ${err.message}`, 5000);
    } finally {
      setProcessing(false);
      setProcMsg("");
    }
  }, [
    applyProgramManifestToResponse,
    applyProgramManifestToTransport,
    averageCurves,
    averageStandardTapeResults,
    averageToneSeries,
    deckCalProgramManifest,
    multiCaptures,
    runDeckCalibrationWorker,
    setProcessing,
    setProcMsg,
    showToast,
    standardTapePreset,
  ]);

  const startDeckCalRecording = useCallback(async (kind) => {
    void kind;
    showToast(T("toolRecordLossyDisabled"), 5000);
  }, [T, showToast]);

  const stopDeckCalRecording = useCallback(() => {
    const active = deckCalRecordRef.current;
    if (active.recorder && active.recorder.state !== "inactive") active.recorder.stop();
  }, []);

  useEffect(() => {
    if (!showTools && deckCalRecordingKind) stopDeckCalRecording();
  }, [deckCalRecordingKind, showTools, stopDeckCalRecording]);

  const analyseDeckCalCapture = useCallback(async (scenario = "self") => {
    if (!deckCalCapture) return;
    setProcessing(true);
    try {
      setProcMsg("正在分析回放录音……");
      const workerResult = await runDeckCalibrationWorker("analyseTestTapeProgram", deckCalCapture);
      if (!workerResult?.ok) throw new Error(workerResult?.error || "Worker error");
      const rawResult = workerResult.result;
      const shouldApplyManifest = scenario === "test-tape" && deckCalProgramManifest;
      const normalizedResponse = normalizeResponseAnalysisAnchoring(rawResult.response);
      const nextResponse = shouldApplyManifest ? applyProgramManifestToResponse(normalizedResponse, deckCalProgramManifest) : normalizedResponse;
      const nextTransport = shouldApplyManifest ? applyProgramManifestToTransport(rawResult.transport, deckCalProgramManifest) : rawResult.transport;
      setResponseAnalysis(nextResponse);
      setTransportAnalysis(nextTransport);
    } catch (err) {
      showToast(`分析失败：${err.message}`, 5000);
    } finally {
      setProcessing(false);
      setProcMsg("");
    }
  }, [applyProgramManifestToResponse, applyProgramManifestToTransport, deckCalCapture, deckCalProgramManifest, runDeckCalibrationWorker, setProcessing, setProcMsg, showToast]);

  // ── Standard calibration tape analysis ──────────────────────

  const analyseStandardTape = useCallback(async () => {
    if (!deckCalCapture) return;
    const preset = STANDARD_TAPE_PRESETS[standardTapePreset];
    if (!preset) {
      showToast("还没有选择标准校准带", 5000);
      return;
    }
    setProcessing(true);
    try {
      setProcMsg("正在分析标准校准带……");
      const workerResult = await runDeckCalibrationWorker("analyseStandardTape", deckCalCapture, { preset });
      if (!workerResult?.ok) throw new Error(workerResult?.error || "Worker error");
      const result = workerResult.result;
      if (result.missingFreqs.length) {
        showToast(`以下频率未检测到：${result.missingFreqs.join(", ")} Hz`, 6000);
      }
      setResponseAnalysis(result);
      setTransportAnalysis(null); // Standard tapes don't have transport analysis
      showToast(`${preset.name} 分析完成（检测到 ${result.frequencies.length - result.missingFreqs.length}/${result.frequencies.length} 个频率点）`);
    } catch (err) {
      showToast(`标准校准带分析失败：${err.message}`, 5000);
    } finally {
      setProcessing(false);
      setProcMsg("");
    }
  }, [deckCalCapture, runDeckCalibrationWorker, setProcessing, setProcMsg, standardTapePreset, showToast]);

  const saveResponseProfile = useCallback(() => {
    if (!responseAnalysis?.profile) return;
    const blob = new Blob([JSON.stringify(responseAnalysis.profile, null, 2)], { type: "application/json" });
    downloadBlob(blob, "deck-calibration-profile.json");
    showToast(T("toolProfileSaved"));
  }, [T, downloadBlob, responseAnalysis, showToast]);

  const saveDeckCalProgramManifest = useCallback(() => {
    if (!responseAnalysis || !transportAnalysis) return;
    const manifest = {
      version: 1,
      type: "side.test-tape-program-manifest",
      name: "Self Deck Test Tape Program",
      createdAt: new Date().toISOString(),
      program: {
        sampleRate: TEST_TAPE_PROGRAM_SPEC.sampleRate,
        interSegmentSec: TEST_TAPE_PROGRAM_SPEC.interSegmentSec,
        response: {
          startHz: RESPONSE_MEASUREMENT_SPEC.startHz,
          endHz: RESPONSE_MEASUREMENT_SPEC.endHz,
          durationSec: RESPONSE_MEASUREMENT_SPEC.mainSec,
        },
        transport: {
          toneHz: TRANSPORT_MEASUREMENT_SPEC.toneHz,
          durationSec: TRANSPORT_MEASUREMENT_SPEC.mainSec,
        },
      },
      baselines: {
        response: {
          channels: {
            L: {
              frequenciesHz: responseAnalysis.frequenciesHz,
              referenceDb: responseAnalysis.channels.L.measuredDb,
              levelCurves: (responseAnalysis.channels.L.levelCurves || []).map((curve) => ({
                inputDb: curve.inputDb,
                role: curve.role,
                frequenciesHz: curve.frequenciesHz,
                referenceDb: curve.measuredDb,
              })),
            },
            R: {
              frequenciesHz: responseAnalysis.frequenciesHz,
              referenceDb: responseAnalysis.channels.R.measuredDb,
              levelCurves: (responseAnalysis.channels.R.levelCurves || []).map((curve) => ({
                inputDb: curve.inputDb,
                role: curve.role,
                frequenciesHz: curve.frequenciesHz,
                referenceDb: curve.measuredDb,
              })),
            },
          },
        },
        transport: {
          referenceMode: "writer-relative",
          referenceMeanHz: transportAnalysis.meanHz,
          wowFlutterFloorPercentRms: transportAnalysis.wowFlutterPercentRms || 0,
        },
      },
    };
    downloadBlob(new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }), "self-test-tape-program.manifest.json");
    showToast(T("toolBaselineSaved"));
  }, [T, downloadBlob, responseAnalysis, showToast, transportAnalysis]);

  return {
    deckCalProgramManifestName,
    deckCalRecordingKind,
    deckCalBrowserRecordingEnabled,
    deckCalCaptureName,
    responseAnalysis,
    transportAnalysis,
    deckCalRecordRef,
    loadDeckCalProgramManifestFile,
    clearDeckCalProgramManifest,
    exportTestTapeProgram,
    importDeckCalCaptureFile,
    startDeckCalRecording,
    stopDeckCalRecording,
    analyseDeckCalCapture,
    saveResponseProfile,
    saveDeckCalProgramManifest,
    // Multi-pass
    multiCaptures,
    importMultiCaptureFiles,
    clearMultiCaptures,
    analyseMultiCaptures,
    // Standard tape
    standardTapePreset,
    setStandardTapePreset,
    analyseStandardTape,
    standardTapePresets: STANDARD_TAPE_PRESETS,
  };
}
