import { useState, useRef, useCallback, useEffect } from "react";
import {
  RESPONSE_MEASUREMENT_SPEC,
  TRANSPORT_MEASUREMENT_SPEC,
  TEST_TAPE_PROGRAM_SPEC,
  generateTestTapeProgram,
  analyseTestTapeProgram,
} from "../deck-calibration.js";
import { getProfileCorrectionDb } from "../calibration-profile.js";

export default function useDeckCalibration({ T, showToast, downloadBlob, encodeWAV, decodeExternalAudioFile, setProcessing, setProcMsg, showTools }) {
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
    if (!baseline?.nominalOnTapeToneHz) return analysis;
    const nominalHz = baseline.nominalOnTapeToneHz;
    return {
      ...analysis,
      nominalHz,
      speedErrorPercent: ((analysis.meanHz - nominalHz) / nominalHz) * 100,
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

  const startDeckCalRecording = useCallback(async (kind) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showToast(T("toolRecordUnavailable"), 5000);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 2, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const ext = recorder.mimeType?.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `${kind}-capture.${ext}`, { type: blob.type });
        setDeckCalRecordingKind("");
        stream.getTracks().forEach((track) => track.stop());
        deckCalRecordRef.current = { recorder: null, stream: null, chunks: [], kind: "" };
        await importDeckCalCaptureFile(file);
      };
      recorder.start();
      deckCalRecordRef.current = { recorder, stream, chunks, kind };
      setDeckCalRecordingKind(kind);
    } catch (err) {
      console.error(err);
      showToast(`${T("toolRecordFailed")}: ${err.message}`, 5000);
    }
  }, [T, importDeckCalCaptureFile, showToast]);

  const stopDeckCalRecording = useCallback(() => {
    const active = deckCalRecordRef.current;
    if (active.recorder && active.recorder.state !== "inactive") active.recorder.stop();
  }, []);

  useEffect(() => {
    if (!showTools && deckCalRecordingKind) stopDeckCalRecording();
  }, [deckCalRecordingKind, showTools, stopDeckCalRecording]);

  const analyseDeckCalCapture = useCallback((scenario = "self") => {
    if (!deckCalCapture) return;
    try {
      const rawResult = analyseTestTapeProgram(deckCalCapture, generateTestTapeProgram(TEST_TAPE_PROGRAM_SPEC));
      const shouldApplyManifest = scenario === "test-tape" && deckCalProgramManifest;
      const nextResponse = shouldApplyManifest ? applyProgramManifestToResponse(rawResult.response, deckCalProgramManifest) : rawResult.response;
      const nextTransport = shouldApplyManifest ? applyProgramManifestToTransport(rawResult.transport, deckCalProgramManifest) : rawResult.transport;
      setResponseAnalysis(nextResponse);
      setTransportAnalysis(nextTransport);
    } catch (err) {
      showToast(`Test tape analysis failed: ${err.message}`, 5000);
    }
  }, [applyProgramManifestToResponse, applyProgramManifestToTransport, deckCalCapture, deckCalProgramManifest, showToast]);

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
          nominalOnTapeToneHz: transportAnalysis.meanHz,
          wowFlutterFloorPercentRms: transportAnalysis.wowFlutterPercentRms || 0,
          speedOffsetPercent: transportAnalysis.speedErrorPercent || 0,
        },
      },
    };
    downloadBlob(new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }), "self-test-tape-program.manifest.json");
    showToast(T("toolBaselineSaved"));
  }, [T, downloadBlob, responseAnalysis, showToast, transportAnalysis]);

  return {
    deckCalProgramManifestName,
    deckCalRecordingKind,
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
  };
}
