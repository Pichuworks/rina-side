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

export default function useDeckCalibration({ T, showToast, downloadBlob, encodeWAV, decodeExternalAudioFile, setProcessing, setProcMsg, showTools }) {
  const deckCalBrowserRecordingEnabled = false;
  const [deckCalProgramManifest, setDeckCalProgramManifest] = useState(null);
  const [deckCalProgramManifestName, setDeckCalProgramManifestName] = useState("");
  const [deckCalRecordingKind, setDeckCalRecordingKind] = useState("");
  const [deckCalCapture, setDeckCalCapture] = useState(null);
  const [deckCalCaptureName, setDeckCalCaptureName] = useState("");
  const [responseAnalysis, setResponseAnalysis] = useState(null);
  const [transportAnalysis, setTransportAnalysis] = useState(null);
  const deckCalRecordRef = useRef({ recorder: null, stream: null, chunks: [], kind: "" });

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

  const adjustResponseChannelWithBaseline = useCallback((analysisChannel, baselineChannel, frequenciesHz, channel) => {
    if (!analysisChannel?.measuredDb?.length || !baselineChannel?.frequenciesHz?.length || !baselineChannel?.referenceDb?.length) {
      throw new Error(`Baseline response data is invalid for channel ${channel}`);
    }
    const baselineProfile = {
      channels: {
        [channel]: {
          frequenciesHz: baselineChannel.frequenciesHz,
          correctionDb: baselineChannel.referenceDb,
        },
      },
    };
    const measuredDb = frequenciesHz.map((freq, index) => (
      analysisChannel.measuredDb[index] - getProfileCorrectionDb(baselineProfile, freq, channel)
    ));
    const correctionDb = frequenciesHz.map((freq, index) => (
      analysisChannel.correctionDb[index] + getProfileCorrectionDb(baselineProfile, freq, channel)
    ));
    return { measuredDb, correctionDb };
  }, []);

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
    return {
      ...analysis,
      channels: {
        L: adjustedLeft,
        R: adjustedRight,
      },
      manifestName: manifest.name,
      profile: {
        ...analysis.profile,
        sourceManifest: { name: manifest.name, createdAt: manifest.createdAt },
        channels: {
          L: { frequenciesHz: analysis.frequenciesHz, correctionDb: adjustedLeft.correctionDb },
          R: { frequenciesHz: analysis.frequenciesHz, correctionDb: adjustedRight.correctionDb },
        },
      },
    };
  }, [adjustResponseChannelWithBaseline]);

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

      // Average frequency-domain results across passes
      const firstResp = results[0].response;
      const freqs = firstResp.frequenciesHz;
      const avgL_measured = new Float64Array(freqs.length);
      const avgR_measured = new Float64Array(freqs.length);
      const avgL_correction = new Float64Array(freqs.length);
      const avgR_correction = new Float64Array(freqs.length);
      for (const r of results) {
        for (let j = 0; j < freqs.length; j++) {
          avgL_measured[j] += (r.response.channels?.L?.measuredDb?.[j] || 0);
          avgR_measured[j] += (r.response.channels?.R?.measuredDb?.[j] || 0);
          avgL_correction[j] += (r.response.channels?.L?.correctionDb?.[j] || 0);
          avgR_correction[j] += (r.response.channels?.R?.correctionDb?.[j] || 0);
        }
      }
      const n = results.length;
      for (let j = 0; j < freqs.length; j++) {
        avgL_measured[j] /= n;
        avgR_measured[j] /= n;
        avgL_correction[j] /= n;
        avgR_correction[j] /= n;
      }

      // Build averaged response analysis
      const avgResponse = {
        ...firstResp,
        channels: {
          L: { measuredDb: Array.from(avgL_measured), correctionDb: Array.from(avgL_correction) },
          R: { measuredDb: Array.from(avgR_measured), correctionDb: Array.from(avgR_correction) },
        },
        profile: {
          ...firstResp.profile,
          name: `${firstResp.profile?.name || "Calibration"} (${n}-pass avg)`,
          channels: {
            L: { frequenciesHz: [...freqs], correctionDb: Array.from(avgL_correction) },
            R: { frequenciesHz: [...freqs], correctionDb: Array.from(avgR_correction) },
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
      const nextResponse = shouldApplyManifest ? applyProgramManifestToResponse(avgResponse, deckCalProgramManifest) : avgResponse;
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
  }, [applyProgramManifestToResponse, applyProgramManifestToTransport, deckCalProgramManifest, multiCaptures, runDeckCalibrationWorker, setProcessing, setProcMsg, showToast]);

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
      setProcMsg("Analyzing playback recording...");
      const workerResult = await runDeckCalibrationWorker("analyseTestTapeProgram", deckCalCapture);
      if (!workerResult?.ok) throw new Error(workerResult?.error || "Worker error");
      const rawResult = workerResult.result;
      const shouldApplyManifest = scenario === "test-tape" && deckCalProgramManifest;
      const nextResponse = shouldApplyManifest ? applyProgramManifestToResponse(rawResult.response, deckCalProgramManifest) : rawResult.response;
      const nextTransport = shouldApplyManifest ? applyProgramManifestToTransport(rawResult.transport, deckCalProgramManifest) : rawResult.transport;
      setResponseAnalysis(nextResponse);
      setTransportAnalysis(nextTransport);
    } catch (err) {
      showToast(`Test tape analysis failed: ${err.message}`, 5000);
    } finally {
      setProcessing(false);
      setProcMsg("");
    }
  }, [applyProgramManifestToResponse, applyProgramManifestToTransport, deckCalCapture, deckCalProgramManifest, runDeckCalibrationWorker, setProcessing, setProcMsg, showToast]);

  // ── Standard calibration tape analysis ──────────────────────
  const [standardTapePreset, setStandardTapePreset] = useState("aiwa-3freq");

  const analyseStandardTape = useCallback(async () => {
    if (!deckCalCapture) return;
    const preset = STANDARD_TAPE_PRESETS[standardTapePreset];
    if (!preset) {
      showToast("No standard tape preset selected", 5000);
      return;
    }
    setProcessing(true);
    try {
      setProcMsg("Analyzing standard calibration tape...");
      const workerResult = await runDeckCalibrationWorker("analyseStandardTape", deckCalCapture, { preset });
      if (!workerResult?.ok) throw new Error(workerResult?.error || "Worker error");
      const result = workerResult.result;
      if (result.missingFreqs.length) {
        showToast(`Missing detections: ${result.missingFreqs.join(", ")} Hz`, 6000);
      }
      setResponseAnalysis(result);
      setTransportAnalysis(null); // Standard tapes don't have transport analysis
      showToast(`${preset.name} analysis complete (${result.frequencies.length - result.missingFreqs.length}/${result.frequencies.length} frequencies detected)`);
    } catch (err) {
      showToast(`Standard tape analysis failed: ${err.message}`, 5000);
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
            },
            R: {
              frequenciesHz: responseAnalysis.frequenciesHz,
              referenceDb: responseAnalysis.channels.R.measuredDb,
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
