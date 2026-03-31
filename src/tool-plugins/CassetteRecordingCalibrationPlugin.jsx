import React, { useRef, useState } from "react";

export const CASSETTE_RECORDING_CALIBRATION_PLUGIN_ID = "deck-rec-cal";

const LABELS = {
  "zh-CN": {
    descTitle: "工具说明",
    desc: "给卡座做一次体检。录一条校准带，就能知道它的频率响应和走带稳定性。测出来的结果可以补偿试听和导出，也可以把这盒带拿去测别的机器。",
    scenarioSelf: "校准这台卡座",
    scenarioSelfDesc: "导出校准信号 → 录到空白带 → 同一台卡座回放 → 分析结果",
    scenarioTest: "用校准带测其它机器",
    scenarioTestDesc: "加载之前保存的基准数据，导入其它机器的回放录音",
    exportProgram: "导出校准信号",
    importCapture: "导入回放录音",
    startRecord: "浏览器录音",
    stopRecord: "停止录音",
    analyseNow: "开始分析",
    saveProfile: "保存校准档案",
    saveManifest: "保存基准数据",
    loadManifest: "加载基准数据",
    clearManifest: "清除基准数据",
    manifestMissing: "还没有基准数据",
    manifestReady: "基准数据已就绪",
    captureMissing: "还没有回放录音",
    captureReady: "回放录音已就绪",
    recordingBusy: "录音中……",
    refTone: "测试音",
    responseTitle: "频响结果",
    transportTitle: "走带诊断结果",
    meanFreq: "平均频率",
    speedError: "速度偏差",
    wfRms: "Wow/Flutter RMS",
    wfPk: "Wow/Flutter 峰峰值",
    refWfFloor: "参考带 W/F 底噪",
    correctionPoints: "校准点",
    helpTitle: "怎么操作呢",
    helpSelf: "① 准备一盘空白带\n② 点「导出校准信号」，录到空白带上\n③ 用同一台卡座回放这盒带\n④ 点「导入回放录音」或用浏览器录音\n⑤ 点「开始分析」\n⑥ 保存校准档案（补偿用）或基准数据（拿去测别的机器用）",
    helpTest: "① 切换到「用校准带测其它机器」\n② 加载之前保存的基准数据\n③ 在另一台机器上回放这盒校准带\n④ 导入回放录音\n⑤ 点「开始分析」",
  },
  ja: {
    descTitle: "ツール説明",
    desc: "キャリブレーション用テープを録音して、デッキの周波数応答と走行安定性を測定します。補正ファイルを生成して試聴と書き出しに適用したり、このテープで別のデッキを測定することもできます。",
    scenarioSelf: "このデッキを校正",
    scenarioSelfDesc: "キャリブレーション信号を書き出し → 空テープに録音 → 同じデッキで再生 → 結果を分析",
    scenarioTest: "このテープで他機を測定",
    scenarioTestDesc: "本機の基準データを読み込み、他機で再生した録音を取り込む",
    exportProgram: "キャリブレーション信号を書き出す",
    importCapture: "再生録音を読み込む",
    startRecord: "ブラウザ録音を開始",
    stopRecord: "ブラウザ録音を停止",
    analyseNow: "分析を開始",
    saveProfile: "校正ファイルを保存",
    saveManifest: "基準データを保存",
    loadManifest: "基準データを読み込む",
    clearManifest: "基準データを解除",
    manifestMissing: "基準データ 未読込",
    manifestReady: "基準データ 読込済み",
    captureMissing: "再生録音がまだありません",
    captureReady: "再生録音を読み込み済み",
    recordingBusy: "録音中……",
    refTone: "テストトーン",
    responseTitle: "周波数応答結果",
    transportTitle: "走行診断結果",
    meanFreq: "平均周波数",
    speedError: "速度偏差",
    wfRms: "Wow/Flutter RMS",
    wfPk: "Wow/Flutter P-P",
    refWfFloor: "基準テープ W/F フロア",
    correctionPoints: "校正ポイント",
    helpTitle: "操作手順",
    helpSelf: "① 空テープを用意\n② 「キャリブレーション信号を書き出す」→ テープに録音\n③ 同じデッキで再生\n④ 「再生録音を読み込む」またはブラウザ録音\n⑤ 「分析を開始」\n⑥ 校正ファイルまたは基準データを保存",
    helpTest: "① 「このテープで他機を測定」に切り替え\n② 以前保存した基準データを読み込む\n③ 別のデッキでこのテープを再生\n④ 再生録音を読み込む\n⑤ 「分析を開始」",
  },
  en: {
    descTitle: "Tool Description",
    desc: "Record a calibration tape to measure your deck's frequency response and transport stability. Generate correction files for preview and export, or use the same tape to test other devices.",
    scenarioSelf: "Calibrate This Deck",
    scenarioSelfDesc: "Export calibration signal → record to blank tape → play back on same deck → analyse",
    scenarioTest: "Test Other Devices With This Tape",
    scenarioTestDesc: "Load saved baseline data, import another device's playback recording",
    exportProgram: "Export Calibration Signal",
    importCapture: "Import Playback Recording",
    startRecord: "Browser Recording",
    stopRecord: "Stop Recording",
    analyseNow: "Start Analysis",
    saveProfile: "Save Calibration File",
    saveManifest: "Save Baseline Data",
    loadManifest: "Load Baseline Data",
    clearManifest: "Clear Baseline Data",
    manifestMissing: "No baseline data",
    manifestReady: "Baseline data ready",
    captureMissing: "No playback recording yet",
    captureReady: "Playback recording ready",
    recordingBusy: "Recording…",
    refTone: "Test Tone",
    responseTitle: "Response Result",
    transportTitle: "Transport Result",
    meanFreq: "Mean Frequency",
    speedError: "Speed Error",
    wfRms: "Wow/Flutter RMS",
    wfPk: "Wow/Flutter Peak-to-Peak",
    refWfFloor: "Reference W/F Floor",
    correctionPoints: "Correction Points",
    helpTitle: "How To",
    helpSelf: "① Prepare a blank tape\n② Click Export Calibration Signal, record it to the tape\n③ Play it back on the same deck\n④ Import Playback Recording (or use browser recording)\n⑤ Start Analysis\n⑥ Save calibration file (for compensation) or baseline data (for testing other devices)",
    helpTest: "① Switch to Test Other Devices With This Tape\n② Load previously saved baseline data\n③ Play the tape on another device\n④ Import the playback recording\n⑤ Start Analysis",
  },
};

export function CassetteRecordingCalibrationPlugin({
  lang = "zh-CN",
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
  const t = LABELS[lang] || LABELS.en;
  const isSelfScenario = activeScenario === "self";
  const isRecording = recordingKind === "program";
  const responsePreviewStride = responseAnalysis
    ? Math.max(1, Math.ceil(responseAnalysis.frequenciesHz.length / 18))
    : 1;
  const responsePreviewIndices = responseAnalysis
    ? responseAnalysis.frequenciesHz.reduce((indices, _, index, array) => {
      if (index % responsePreviewStride === 0 || index === array.length - 1) indices.push(index);
      return indices;
    }, [])
    : [];
  // help text selected by scenario

  return (
    <>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-ink)", marginBottom: 6 }}>{t.descTitle}</div>
        <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-dim)" }}>{t.desc}</div>
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
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.scenarioSelf}</div>
          <div style={{ fontSize: 11, lineHeight: 1.7, color: "var(--text-dim)" }}>{t.scenarioSelfDesc}</div>
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
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.scenarioTest}</div>
          <div style={{ fontSize: 11, lineHeight: 1.7, color: "var(--text-dim)" }}>{t.scenarioTestDesc}</div>
        </button>
      </div>

      <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{t.helpTitle}</div>
        <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-line" }}>{isSelfScenario ? t.helpSelf : t.helpTest}</div>
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
            {programManifestName ? t.manifestReady : t.manifestMissing}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>{programManifestName || "-"}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => manifestFileRef.current?.click()}
              disabled={processing}
              style={{ padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
            >
              {t.loadManifest}
            </button>
            <button
              onClick={onClearProgramManifest}
              disabled={!programManifestName}
              style={{ padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
            >
              {t.clearManifest}
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
            {t.exportProgram}
          </button>
        )}
        <button
          onClick={() => captureFileRef.current?.click()}
          disabled={processing}
          style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
        >
          {t.importCapture}
        </button>
        <button
          onClick={() => (isRecording ? onStopRecording() : onStartRecording("program"))}
          disabled={processing}
          style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: isRecording ? "var(--accent-dim)" : "var(--bg-deep)", cursor: "pointer", color: isRecording ? "var(--accent-ink)" : "var(--text)" }}
        >
          {isRecording ? t.stopRecord : t.startRecord}
        </button>
        <button
          onClick={() => onAnalyseCapture(activeScenario)}
          disabled={processing || !captureName}
          style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--accent)", cursor: "pointer", color: "var(--accent-contrast)" }}
        >
          {t.analyseNow}
        </button>
        <button
          onClick={onSaveResponseProfile}
          disabled={!responseAnalysis}
          style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
        >
          {t.saveProfile}
        </button>
        {isSelfScenario && (
          <button
            onClick={onSaveProgramManifest}
            disabled={!responseAnalysis || !transportAnalysis}
            style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
          >
            {t.saveManifest}
          </button>
        )}
      </div>

      <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>
          {recordingKind ? t.recordingBusy : captureName ? t.captureReady : t.captureMissing}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          {recordingKind ? `${recordingKind}.webm` : captureName || "-"}
        </div>
      </div>

      {responseAnalysis && (
        <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t.responseTitle}</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{t.correctionPoints}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
            {responsePreviewIndices.map((actualIndex) => {
              const freq = responseAnalysis.frequenciesHz[actualIndex];
              return (
                <div key={freq} style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{Math.round(freq)} Hz</div>
                  <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                    <div>L {responseAnalysis.channels.L.correctionDb[actualIndex].toFixed(1)} dB</div>
                    <div>R {responseAnalysis.channels.R.correctionDb[actualIndex].toFixed(1)} dB</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {transportAnalysis && (
        <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t.transportTitle}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.refTone}</div>
              <div style={{ fontSize: 14 }}>{transportAnalysis.nominalHz.toFixed(2)} Hz</div>
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.meanFreq}</div>
              <div style={{ fontSize: 14 }}>{transportAnalysis.meanHz.toFixed(2)} Hz</div>
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.speedError}</div>
              <div style={{ fontSize: 14 }}>{transportAnalysis.speedErrorPercent.toFixed(3)} %</div>
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.wfRms}</div>
              <div style={{ fontSize: 14 }}>{transportAnalysis.wowFlutterPercentRms.toFixed(3)} %</div>
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.wfPk}</div>
              <div style={{ fontSize: 14 }}>{transportAnalysis.wowFlutterPercentPkPk.toFixed(3)} %</div>
            </div>
            {typeof transportAnalysis.writerWowFlutterFloorPercentRms === "number" && transportAnalysis.writerWowFlutterFloorPercentRms > 0 && (
              <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.refWfFloor}</div>
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
  titleKey: null,
  descKey: null,
  title: {
    "zh-CN": "卡座录制校准",
    ja: "デッキ録音キャリブレーション",
    en: "Deck Recording Calibration",
  },
  desc: {
    "zh-CN": "频响校准与走带诊断",
    ja: "周波数応答校正と走行診断",
    en: "Response calibration and transport diagnostics",
  },
  Component: CassetteRecordingCalibrationPlugin,
};
