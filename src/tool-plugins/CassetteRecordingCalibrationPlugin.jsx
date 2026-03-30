import React, { useRef, useState } from "react";

export const CASSETTE_RECORDING_CALIBRATION_PLUGIN_ID = "deck-rec-cal";

export function CassetteRecordingCalibrationPlugin({
  T,
  processing,
  captureName,
  responseAnalysis,
  transportAnalysis,
  programManifestName,
  recordingKind,
  onLoadProgramManifest,
  onClearProgramManifest,
  onExportProgram,
  onImportCapture,
  onStartRecording,
  onStopRecording,
  onAnalyseCapture,
  onSaveResponseProfile,
  onSaveProgramManifest,
}) {
  const [activeScenario, setActiveScenario] = useState("self");
  const captureFileRef = useRef(null);
  const manifestFileRef = useRef(null);
  const isSelfScenario = activeScenario === "self";
  const isRecording = recordingKind === "program";
  const helpKey = isSelfScenario ? "toolSelfProgramHelp" : "toolTestTapeProgramHelp";

  return (
    <>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-ink)", marginBottom: 6 }}>{T("toolDescTitle")}</div>
        <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-dim)" }}>{T("toolDeckRecCalDesc")}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        <button
          onClick={() => setActiveScenario("self")}
          style={{
            padding: "12px 14px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: isSelfScenario ? "var(--accent-dim)" : "var(--bg-card)",
            color: isSelfScenario ? "var(--accent-ink)" : "var(--text)",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{T("toolScenarioSelfDeck")}</div>
          <div style={{ fontSize: 11, lineHeight: 1.7, color: "var(--text-dim)" }}>{T("toolScenarioSelfDeckDesc")}</div>
        </button>
        <button
          onClick={() => setActiveScenario("test-tape")}
          style={{
            padding: "12px 14px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: !isSelfScenario ? "var(--accent-dim)" : "var(--bg-card)",
            color: !isSelfScenario ? "var(--accent-ink)" : "var(--text)",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{T("toolScenarioTestTape")}</div>
          <div style={{ fontSize: 11, lineHeight: 1.7, color: "var(--text-dim)" }}>{T("toolScenarioTestTapeDesc")}</div>
        </button>
      </div>

      <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{T("toolDeckRecCalProgramTitle")}</div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{T("toolDeckRecCalProgramFocusTitle")}</div>
        <div style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 10 }}>{T("toolDeckRecCalProgramFocusDesc")}</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{T("toolDeckRecCalWorkflowTitle")}</div>
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>{T("toolDeckRecCalProgramWorkflowDesc")}</div>
      </div>

      <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{T("toolHelpTitle")}</div>
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>{T(helpKey)}</div>
      </div>

      <input
        ref={captureFileRef}
        type="file"
        accept="audio/*,.wav,.flac,.aiff,.aif,.m4a,.ogg,.webm"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImportCapture(file);
          event.target.value = "";
        }}
      />
      <input
        ref={manifestFileRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onLoadProgramManifest(file);
          event.target.value = "";
        }}
      />

      {!isSelfScenario && (
        <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>
            {programManifestName ? T("toolProgramManifestReady") : T("toolProgramManifestMissing")}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>{programManifestName || "-"}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => manifestFileRef.current?.click()}
              disabled={processing}
              style={{ padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
            >
              {T("toolLoadProgramManifest")}
            </button>
            <button
              onClick={onClearProgramManifest}
              disabled={!programManifestName}
              style={{ padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
            >
              {T("toolClearProgramManifest")}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {isSelfScenario && (
          <button
            onClick={onExportProgram}
            disabled={processing}
            style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
          >
            {T("toolExportProgram")}
          </button>
        )}
        <button
          onClick={() => captureFileRef.current?.click()}
          disabled={processing}
          style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
        >
          {T("toolImportCapture")}
        </button>
        <button
          onClick={() => (isRecording ? onStopRecording() : onStartRecording("program"))}
          disabled={processing}
          style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: isRecording ? "var(--accent-dim)" : "var(--bg-deep)", cursor: "pointer", color: isRecording ? "var(--accent-ink)" : "var(--text)" }}
        >
          {isRecording ? T("toolStopRecord") : T("toolStartRecord")}
        </button>
        <button
          onClick={() => onAnalyseCapture(activeScenario)}
          disabled={processing || !captureName}
          style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--accent)", cursor: "pointer", color: "var(--accent-contrast)" }}
        >
          {T("toolAnalyseNow")}
        </button>
        <button
          onClick={onSaveResponseProfile}
          disabled={!responseAnalysis}
          style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
        >
          {T("toolSaveProfile")}
        </button>
        {isSelfScenario && (
          <button
            onClick={onSaveProgramManifest}
            disabled={!responseAnalysis || !transportAnalysis}
            style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
          >
            {T("toolSaveProgramManifest")}
          </button>
        )}
      </div>

      <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>
          {recordingKind ? T("toolRecordingBusy") : captureName ? T("toolCaptureReady") : T("toolCaptureMissing")}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          {recordingKind ? `${recordingKind}.webm` : captureName || "-"}
        </div>
      </div>

      {responseAnalysis && (
        <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{T("toolResponseResultTitle")}</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{T("toolTopCorrection")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 6 }}>
            {responseAnalysis.frequenciesHz.filter((_, index) => index % 8 === 0).map((freq, index) => {
              const actualIndex = index * 8;
              return (
                <div key={freq} style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{Math.round(freq)} Hz</div>
                  <div style={{ fontSize: 14 }}>{responseAnalysis.correctionDb[actualIndex].toFixed(1)} dB</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {transportAnalysis && (
        <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{T("toolTransportResultTitle")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{T("toolRefToneLabel")}</div>
              <div style={{ fontSize: 14 }}>{transportAnalysis.nominalHz.toFixed(2)} Hz</div>
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{T("toolMeanFreq")}</div>
              <div style={{ fontSize: 14 }}>{transportAnalysis.meanHz.toFixed(2)} Hz</div>
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{T("toolSpeedError")}</div>
              <div style={{ fontSize: 14 }}>{transportAnalysis.speedErrorPercent.toFixed(3)} %</div>
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{T("toolWowFlutterRms")}</div>
              <div style={{ fontSize: 14 }}>{transportAnalysis.wowFlutterPercentRms.toFixed(3)} %</div>
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{T("toolWowFlutterPk")}</div>
              <div style={{ fontSize: 14 }}>{transportAnalysis.wowFlutterPercentPkPk.toFixed(3)} %</div>
            </div>
            {typeof transportAnalysis.writerWowFlutterFloorPercentRms === "number" && transportAnalysis.writerWowFlutterFloorPercentRms > 0 && (
              <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{T("toolReferenceWowFloor")}</div>
                <div style={{ fontSize: 14 }}>{transportAnalysis.writerWowFlutterFloorPercentRms.toFixed(3)} % RMS</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export const CASSETTE_RECORDING_CALIBRATION_PLUGIN = {
  id: CASSETTE_RECORDING_CALIBRATION_PLUGIN_ID,
  titleKey: "toolDeckRecCal",
  descKey: "toolDeckRecCalCardDesc",
  Component: CassetteRecordingCalibrationPlugin,
};
