import { useState, useCallback, useMemo, useEffect } from "react";
import {
  createProbeManifest,
  generateProbeSequence,
  buildProbeProfile,
  buildProgramProfile,
  buildFixedBandEqModel,
  attachEqModel,
  parseAndNormalizeProfileJson,
  serializeProfileJson,
  compileEqAToB,
  compileEqAToFlat,
} from "../modules/index.js";
import { normalizeCalibrationProfile } from "../calibration-profile.js";

const DEFAULT_FIXED_BAND_Q = 1;

export default function usePlayerProfile({ showToast, downloadBlob, encodeWAV, decodeExternalAudioFile, setProcessing, setProcMsg, onLoadCalibrationProfile }) {
  const [probeCaptureBuffer, setProbeCaptureBuffer] = useState(null);
  const [probeCaptureName, setProbeCaptureName] = useState("");
  const [playerProbeProfile, setPlayerProbeProfile] = useState(null);
  const [songReferenceTracks, setSongReferenceTracks] = useState([]);
  const [songRecordedTracks, setSongRecordedTracks] = useState([]);
  const [playerSongProfile, setPlayerSongProfile] = useState(null);
  const [songPairingDetails, setSongPairingDetails] = useState(null);
  const [eqWorkbenchBaseProfile, setEqWorkbenchBaseProfile] = useState(null);
  const [eqWorkbenchBaseProfileName, setEqWorkbenchBaseProfileName] = useState("");
  const [playerEqReadyProfile, setPlayerEqReadyProfile] = useState(null);
  const [compilerProfileA, setCompilerProfileA] = useState(null);
  const [compilerProfileAName, setCompilerProfileAName] = useState("");
  const [compilerProfileB, setCompilerProfileB] = useState(null);
  const [compilerProfileBName, setCompilerProfileBName] = useState("");
  const [compilerTargetMode, setCompilerTargetMode] = useState("profile");
  const [playerEqCompileResult, setPlayerEqCompileResult] = useState(null);

  // ── Song pairing ────────────────────────────────────────────

  const parseSongTaggedName = useCallback((filename) => {
    const clean = String(filename || "").trim();
    const stem = clean.replace(/\.[^.]+$/, "");
    const parts = stem.split(".");
    if (parts.length < 2) return null;
    const tag = parts[parts.length - 1];
    if (tag !== "1" && tag !== "2") return null;
    const base = parts.slice(0, -1).join(".").trim().toLowerCase();
    if (!base) return null;
    return { base, role: tag === "1" ? "reference" : "recorded" };
  }, []);

  const songPairing = useMemo(() => {
    const invalidNames = [];
    const recordedMap = new Map();
    const duplicateRecorded = new Set();
    songRecordedTracks.forEach((track) => {
      const parsed = parseSongTaggedName(track.name);
      if (!parsed || parsed.role !== "recorded") { invalidNames.push(track.name); return; }
      if (recordedMap.has(parsed.base)) duplicateRecorded.add(parsed.base);
      else recordedMap.set(parsed.base, track);
    });
    const referenceMap = new Map();
    const duplicateReference = new Set();
    songReferenceTracks.forEach((track) => {
      const parsed = parseSongTaggedName(track.name);
      if (!parsed || parsed.role !== "reference") { invalidNames.push(track.name); return; }
      if (referenceMap.has(parsed.base)) duplicateReference.add(parsed.base);
      else referenceMap.set(parsed.base, track);
    });
    if (invalidNames.length) {
      return { pairs: [], error: `Invalid song filenames: ${invalidNames.join(", ")}`, details: { invalidNames, duplicateRecorded: [], duplicateReference: [], missingRecorded: [], extraRecorded: [] } };
    }
    if (duplicateRecorded.size) {
      return { pairs: [], error: `Duplicate recorded names: ${[...duplicateRecorded].join(", ")}`, details: { invalidNames: [], duplicateRecorded: [...duplicateRecorded], duplicateReference: [], missingRecorded: [], extraRecorded: [] } };
    }
    if (duplicateReference.size) {
      return { pairs: [], error: `Duplicate source names: ${[...duplicateReference].join(", ")}`, details: { invalidNames: [], duplicateRecorded: [], duplicateReference: [...duplicateReference], missingRecorded: [], extraRecorded: [] } };
    }
    const missingRecorded = [];
    const extraRecorded = [];
    const pairs = [];
    referenceMap.forEach((referenceTrack, stem) => {
      const recordedTrack = recordedMap.get(stem);
      if (!recordedTrack) missingRecorded.push(referenceTrack.name);
      else pairs.push({ id: stem, title: referenceTrack.name.replace(/\.[^.]+$/, ""), referenceName: referenceTrack.name, recordedName: recordedTrack.name, referenceBuffer: referenceTrack.audioBuffer, recordedBuffer: recordedTrack.audioBuffer });
    });
    recordedMap.forEach((recordedTrack, stem) => {
      if (!referenceMap.has(stem)) extraRecorded.push(recordedTrack.name);
    });
    if (missingRecorded.length || extraRecorded.length) {
      const missingText = missingRecorded.length ? `missing recorded: ${missingRecorded.join(", ")}` : "";
      const extraText = extraRecorded.length ? `extra recorded: ${extraRecorded.join(", ")}` : "";
      return { pairs: [], error: [missingText, extraText].filter(Boolean).join(" | "), details: { invalidNames: [], duplicateRecorded: [], duplicateReference: [], missingRecorded, extraRecorded } };
    }
    return { pairs, error: "", details: { invalidNames: [], duplicateRecorded: [], duplicateReference: [], missingRecorded: [], extraRecorded: [] } };
  }, [parseSongTaggedName, songRecordedTracks, songReferenceTracks]);

  useEffect(() => {
    setSongPairingDetails(songPairing.details || null);
  }, [songPairing]);

  // ── Probe ───────────────────────────────────────────────────

  const exportPlayerProbe = useCallback(() => {
    const probe = generateProbeSequence(createProbeManifest());
    downloadBlob(encodeWAV(probe.bufferLike, 24), "player-probe-v1.wav");
    showToast("Player probe exported");
  }, [downloadBlob, encodeWAV, showToast]);

  const importPlayerProbeCaptureFile = useCallback(async (file) => {
    if (!file) return;
    setProcessing(true);
    try {
      const audioBuffer = await decodeExternalAudioFile(file);
      setProbeCaptureBuffer(audioBuffer);
      setProbeCaptureName(file.name);
      setPlayerProbeProfile(null);
      showToast("Probe capture imported");
    } catch (err) {
      showToast(`Probe import failed: ${err.message}`, 5000);
    } finally {
      setProcessing(false);
      setProcMsg("");
    }
  }, [decodeExternalAudioFile, setProcessing, setProcMsg, showToast]);

  const buildPlayerProbeProfile = useCallback((name) => {
    if (!probeCaptureBuffer) return;
    try {
      const profile = buildProbeProfile(null, probeCaptureBuffer, createProbeManifest(), { name: name || "Probe Profile" });
      setPlayerProbeProfile(profile);
      showToast("Probe profile generated");
    } catch (err) {
      showToast(`Probe profile failed: ${err.message}`, 5000);
    }
  }, [probeCaptureBuffer, showToast]);

  const savePlayerProbeProfile = useCallback(() => {
    if (!playerProbeProfile) return;
    downloadBlob(new Blob([serializeProfileJson(playerProbeProfile)], { type: "application/json" }), `${playerProbeProfile.name || "probe-profile"}.json`);
    showToast("Probe profile saved");
  }, [downloadBlob, playerProbeProfile, showToast]);

  // ── Song ────────────────────────────────────────────────────

  const [songAnalysisFailedPairs, setSongAnalysisFailedPairs] = useState([]);

  const importTrackBufferList = useCallback(async (files, onFileProgress) => {
    const loaded = [];
    for (let i = 0; i < files.length; i++) {
      onFileProgress?.(i + 1, files.length, files[i].name);
      const audioBuffer = await decodeExternalAudioFile(files[i]);
      loaded.push({ name: files[i].name, audioBuffer });
    }
    return loaded;
  }, [decodeExternalAudioFile]);

  const importSongFiles = useCallback(async (files) => {
    if (!files?.length) return;
    setProcessing(true);
    setSongAnalysisFailedPairs([]);
    try {
      const loaded = await importTrackBufferList(files, (current, total, name) => {
        setProcMsg(`读取文件 [${current}/${total}] ${name}`);
      });
      const references = [];
      const recorded = [];
      const invalid = [];
      loaded.forEach((track) => {
        const parsed = parseSongTaggedName(track.name);
        if (!parsed) { invalid.push(track.name); return; }
        if (parsed.role === "reference") references.push(track);
        else recorded.push(track);
      });
      if (invalid.length) throw new Error(`Invalid song filenames: ${invalid.join(", ")}`);
      setSongReferenceTracks(references);
      setSongRecordedTracks(recorded);
      setPlayerSongProfile(null);
      showToast(`Loaded ${references.length} source / ${recorded.length} recorded files`);
    } catch (err) {
      showToast(`Song import failed: ${err.message}`, 5000);
    } finally {
      setProcessing(false);
      setProcMsg("");
    }
  }, [importTrackBufferList, parseSongTaggedName, setProcessing, setProcMsg, showToast]);

  const buildPlayerSongProfile = useCallback(async (name) => {
    if (!songPairing.pairs.length || songPairing.error) {
      showToast(songPairing.error || "No valid song pairs", 5000);
      return;
    }
    setProcessing(true);
    setSongAnalysisFailedPairs([]);
    try {
      const { profile, failedPairs } = await buildProgramProfile(
        songPairing.pairs,
        { name: name || "Song Profile" },
        (progress) => {
          if (progress.phase === "analyzing") {
            setProcMsg(`分析中 [${progress.current}/${progress.total}] ${progress.title}`);
          } else if (progress.phase === "aggregating") {
            setProcMsg("汇总分析结果……");
          }
        },
      );
      setPlayerSongProfile(profile);
      setSongAnalysisFailedPairs(failedPairs);
      if (failedPairs.length) {
        showToast(
          `测量结果已生成（${songPairing.pairs.length - failedPairs.length}/${songPairing.pairs.length} 对成功，${failedPairs.length} 对跳过）`,
          6000,
        );
      } else {
        showToast("测量结果已生成");
      }
    } catch (err) {
      if (err.failedPairs) setSongAnalysisFailedPairs(err.failedPairs);
      showToast(`分析失败：${err.message}`, 8000);
    } finally {
      setProcessing(false);
      setProcMsg("");
    }
  }, [showToast, songPairing, setProcessing, setProcMsg]);

  const savePlayerSongProfile = useCallback(() => {
    if (!playerSongProfile) return;
    downloadBlob(new Blob([serializeProfileJson(playerSongProfile)], { type: "application/json" }), `${playerSongProfile.name || "song-profile"}.json`);
    showToast("Song profile saved");
  }, [downloadBlob, playerSongProfile, showToast]);

  // ── EQ Workbench ────────────────────────────────────────────

  const useProbeAsEqBase = useCallback(() => {
    if (!playerProbeProfile) return;
    setEqWorkbenchBaseProfile(playerProbeProfile);
    setEqWorkbenchBaseProfileName(playerProbeProfile.name);
  }, [playerProbeProfile]);

  const useSongAsEqBase = useCallback(() => {
    if (!playerSongProfile) return;
    setEqWorkbenchBaseProfile(playerSongProfile);
    setEqWorkbenchBaseProfileName(playerSongProfile.name);
  }, [playerSongProfile]);

  const importEqBaseProfileFile = useCallback(async (file) => {
    if (!file) return;
    try {
      const profile = parseAndNormalizeProfileJson(await file.text());
      setEqWorkbenchBaseProfile(profile);
      setEqWorkbenchBaseProfileName(file.name);
      showToast("A base profile imported");
    } catch (err) {
      showToast(`EQ base import failed: ${err.message}`, 5000);
    }
  }, [showToast]);

  const buildFixedEqWorkbenchProfile = useCallback((config) => {
    if (!eqWorkbenchBaseProfile) return;
    try {
      const centers = String(config.customBandsText || "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
      if (!centers.length) throw new Error("No valid EQ band centers");
      const uniqueCenters = [...new Set(centers)];
      const gainStepDb = Number(config.gainStepDb);
      const minStep = Number(config.minStep);
      const maxStep = Number(config.maxStep);
      if (!(gainStepDb > 0)) throw new Error("Invalid gain step");
      if (!Number.isInteger(minStep) || !Number.isInteger(maxStep) || minStep > 0 || maxStep < 0) throw new Error("Invalid EQ step range");
      const eqModel = buildFixedBandEqModel({
        name: `${eqWorkbenchBaseProfile.name} Adjustable Model`,
        bands: uniqueCenters.map((centerHz) => ({
          id: `${centerHz}`,
          centerHz,
          filterType: "peak",
          q: DEFAULT_FIXED_BAND_Q,
          gainStepDb,
          minStep,
          maxStep,
          integerOnly: true,
        })),
      });
      const nextProfile = attachEqModel({
        ...eqWorkbenchBaseProfile,
        name: `${eqWorkbenchBaseProfile.name} + Adjustable`,
      }, eqModel);
      setPlayerEqReadyProfile(nextProfile);
      showToast("A adjustable profile generated");
    } catch (err) {
      showToast(`EQ model build failed: ${err.message}`, 5000);
    }
  }, [eqWorkbenchBaseProfile, showToast]);

  const saveEqReadyProfile = useCallback(() => {
    if (!playerEqReadyProfile) return;
    downloadBlob(new Blob([serializeProfileJson(playerEqReadyProfile)], { type: "application/json" }), `${playerEqReadyProfile.name || "a-adjustable-profile"}.json`);
    showToast("A adjustable profile saved");
  }, [downloadBlob, playerEqReadyProfile, showToast]);

  // ── Compiler ────────────────────────────────────────────────

  const importCompilerProfileFile = useCallback(async (role, file) => {
    if (!file) return;
    try {
      const profile = parseAndNormalizeProfileJson(await file.text());
      if (role === "A") {
        setCompilerProfileA(profile);
        setCompilerProfileAName(file.name);
      } else {
        setCompilerProfileB(profile);
        setCompilerProfileBName(file.name);
        setCompilerTargetMode("profile");
      }
      setPlayerEqCompileResult(null);
      showToast(`${role} profile imported`);
    } catch (err) {
      showToast(`Profile import failed: ${err.message}`, 5000);
    }
  }, [showToast]);

  const useEqReadyAsCompilerA = useCallback(() => {
    if (!playerEqReadyProfile) return;
    setCompilerProfileA(playerEqReadyProfile);
    setCompilerProfileAName(playerEqReadyProfile.name);
    setPlayerEqCompileResult(null);
  }, [playerEqReadyProfile]);

  const useProbeAsCompilerB = useCallback(() => {
    if (!playerProbeProfile) return;
    setCompilerProfileB(playerProbeProfile);
    setCompilerProfileBName(playerProbeProfile.name);
    setCompilerTargetMode("profile");
    setPlayerEqCompileResult(null);
  }, [playerProbeProfile]);

  const useSongAsCompilerB = useCallback(() => {
    if (!playerSongProfile) return;
    setCompilerProfileB(playerSongProfile);
    setCompilerProfileBName(playerSongProfile.name);
    setCompilerTargetMode("profile");
    setPlayerEqCompileResult(null);
  }, [playerSongProfile]);

  const changeCompilerTargetMode = useCallback((mode) => {
    setCompilerTargetMode(mode);
    setPlayerEqCompileResult(null);
  }, []);

  const compilePlayerProfiles = useCallback(() => {
    if (!compilerProfileA) return;
    if (compilerTargetMode === "profile" && !compilerProfileB) return;
    try {
      const result = compilerTargetMode === "flat"
        ? compileEqAToFlat(compilerProfileA)
        : compileEqAToB(compilerProfileA, compilerProfileB);
      setPlayerEqCompileResult(result);
      showToast(
        result.ok
          ? (compilerTargetMode === "flat" ? "A->Flat EQ generated" : "A->B EQ generated")
          : (result.message || result.errorCode || "Compile failed"),
        result.ok ? 3000 : 5000,
      );
    } catch (err) {
      showToast(`Compile failed: ${err.message}`, 5000);
    }
  }, [compilerProfileA, compilerProfileB, compilerTargetMode, showToast]);

  const compileLoadableProfile = useMemo(() => {
    if (!playerEqCompileResult?.ok) return null;
    const targetLabel = playerEqCompileResult.targetMode === "flat"
      ? "Flat"
      : (playerEqCompileResult.targetLabel || compilerProfileBName || "Target");
    return normalizeCalibrationProfile({
      type: "deck.playback-correction-profile",
      name: `${compilerProfileAName || "A"} -> ${targetLabel} EQ`,
      createdAt: new Date().toISOString(),
      channels: {
        L: {
          frequenciesHz: [...playerEqCompileResult.frequencyGridHz],
          correctionDb: [...(playerEqCompileResult.correctedResponseDb?.L || [])],
        },
        R: {
          frequenciesHz: [...playerEqCompileResult.frequencyGridHz],
          correctionDb: [...(playerEqCompileResult.correctedResponseDb?.R || [])],
        },
      },
    });
  }, [compilerProfileAName, compilerProfileBName, playerEqCompileResult]);

  const loadCompileResultProfile = useCallback(() => {
    if (!compileLoadableProfile) return;
    onLoadCalibrationProfile(compileLoadableProfile);
    showToast("Compiled EQ profile loaded");
  }, [compileLoadableProfile, onLoadCalibrationProfile, showToast]);

  const exportCompileLoadableProfile = useCallback(() => {
    if (!compileLoadableProfile) return;
    downloadBlob(
      new Blob([JSON.stringify(compileLoadableProfile, null, 2)], { type: "application/json" }),
      `${compileLoadableProfile.name || "compiled-eq-profile"}.json`,
    );
    showToast("Compiled EQ loadable profile exported");
  }, [compileLoadableProfile, downloadBlob, showToast]);

  const exportCompileResultJson = useCallback(() => {
    if (!playerEqCompileResult) return;
    downloadBlob(
      new Blob([JSON.stringify(playerEqCompileResult, null, 2)], { type: "application/json" }),
      "compiled-eq-result.json",
    );
    showToast("Compile result JSON exported");
  }, [downloadBlob, playerEqCompileResult, showToast]);

  const exportCompileResultText = useCallback(() => {
    if (!playerEqCompileResult) return;
    const targetLabel = playerEqCompileResult.targetMode === "flat"
      ? "Flat"
      : (playerEqCompileResult.targetLabel || compilerProfileBName || "Target");
    const correctedProfileName = `${compilerProfileAName || "A"} -> ${targetLabel} corrected`;
    const lines = [];
    lines.push(playerEqCompileResult.targetMode === "flat" ? "A -> Flat EQ Result" : "A -> B EQ Result");
    lines.push("");
    lines.push(`A Profile: ${compilerProfileAName || "-"}`);
    lines.push(`Target: ${targetLabel}`);
    lines.push(`Corrected: ${correctedProfileName}`);
    lines.push("");
    lines.push(`ok: ${playerEqCompileResult.ok ? "true" : "false"}`);
    if (playerEqCompileResult.targetMode) lines.push(`targetMode: ${playerEqCompileResult.targetMode}`);
    if (playerEqCompileResult.targetLabel) lines.push(`targetLabel: ${playerEqCompileResult.targetLabel}`);
    if (playerEqCompileResult.errorCode) lines.push(`errorCode: ${playerEqCompileResult.errorCode}`);
    if (playerEqCompileResult.message) lines.push(`message: ${playerEqCompileResult.message}`);
    if (playerEqCompileResult.fitScore != null) lines.push(`fitScore: ${playerEqCompileResult.fitScore}`);
    if (playerEqCompileResult.usableBandHz) {
      lines.push(`usableBandHz: ${playerEqCompileResult.usableBandHz[0]} - ${playerEqCompileResult.usableBandHz[1]}`);
    }
    lines.push("");
    lines.push("EQ Steps:");
    (playerEqCompileResult.eqSteps || []).forEach((step) => {
      lines.push(`${step.bandId}: ${step.value > 0 ? `+${step.value}` : step.value}`);
    });
    downloadBlob(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
      "compiled-eq-result.txt",
    );
    showToast("Compile result text exported");
  }, [compilerProfileAName, compilerProfileBName, downloadBlob, playerEqCompileResult, showToast]);

  return {
    // Probe
    probeCaptureName,
    playerProbeProfile,
    exportPlayerProbe,
    importPlayerProbeCaptureFile,
    buildPlayerProbeProfile,
    savePlayerProbeProfile,
    // Song
    songReferenceTracks,
    songRecordedTracks,
    songPairCount: songPairing.pairs.length,
    songPairError: songPairing.error,
    songPairingDetails,
    songPairPreview: songPairing.pairs.map((pair) => ({
      id: pair.id, title: pair.title, referenceName: pair.referenceName, recordedName: pair.recordedName,
    })),
    songAnalysisFailedPairs,
    playerSongProfile,
    importSongFiles,
    buildPlayerSongProfile,
    savePlayerSongProfile,
    // EQ Workbench
    eqWorkbenchBaseProfileName,
    playerEqReadyProfile,
    useProbeAsEqBase,
    useSongAsEqBase,
    importEqBaseProfileFile,
    buildFixedEqWorkbenchProfile,
    saveEqReadyProfile,
    // Compiler
    compilerProfileAName,
    compilerProfileBName,
    compilerTargetMode,
    playerEqCompileResult,
    compileLoadableProfile,
    importCompilerProfileFile,
    useEqReadyAsCompilerA,
    useProbeAsCompilerB,
    useSongAsCompilerB,
    changeCompilerTargetMode,
    compilePlayerProfiles,
    loadCompileResultProfile,
    exportCompileLoadableProfile,
    exportCompileResultJson,
    exportCompileResultText,
  };
}
