import React, { useRef, useState, useMemo } from "react";
import { ReportCard } from "./ReportCard.jsx";
import { generateDeckCalibrationReport } from "../modules/report/report-generator.js";
import {
  getProfileCorrectionDb,
  getProfileLevelCurves,
  getProfilePhaseRad,
  normalizeCalibrationProfile,
} from "../calibration-profile.js";
import { analyseClarity } from "../modules/report/curve-analyzer.js";

export const CASSETTE_RECORDING_CALIBRATION_PLUGIN_ID = "deck-rec-cal";

const LABELS = {
  "zh-CN": {
    descTitle: "工具说明",
    desc: "给卡座做一次体检。录一条校准带，就能知道它的频率响应和走带稳定性。还可以单独测量回放特性、推导录制特性。",
    scenarioSelf: "综合校准",
    scenarioSelfDesc: "导出校准信号 → 录到空白带 → 同一台卡座回放 → 得到录放综合结果",
    scenarioTest: "测其它机器",
    scenarioTestDesc: "加载基准数据，导入其它机器的回放录音",
    scenarioPlayback: "回放特性",
    scenarioPlaybackDesc: "用标准校准带直接回放，测量纯回放偏差",
    scenarioRecording: "推导录制",
    scenarioRecordingDesc: "用综合结果减去回放偏差，得到纯录制特性",
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
    responseGraphHint: "下面分成两张图：第一张是未修正实测响应，第二张是系统将施加的修正 EQ。0 dB 是 1 kHz 锚点；实测低于 0 dB 的地方，修正 EQ 会在对应频段抬升。",
    measuredChartTitle: "未修正实测响应",
    correctionChartTitle: "修正 EQ",
    enlargeChart: "放大",
    shrinkChart: "缩小",
    transportTitle: "走带诊断结果",
    meanFreq: "平均频率",
    speedError: "速度偏差",
    wfRms: "Wow/Flutter RMS",
    wfPk: "Wow/Flutter 峰峰值",
    refWfFloor: "参考带 W/F 底噪",
    correctionPoints: "校准点",
    measuredResponse: "实测响应",
    correctionEq: "修正 EQ",
    curveLegendMeasuredL: "L 实测",
    curveLegendMeasuredR: "R 实测",
    curveLegendCorrectionL: "L 修正",
    curveLegendCorrectionR: "R 修正",
    clarityTitle: "清晰度",
    clarityHint: "这些值直接从现有扫频 / 1kHz 校准音里推出来。它们不是主观听感分数，而是和“发糊 / 不够锐利”高度相关的客观代理量。",
    clarityVerdict: "清晰度判断",
    clarityClear: "偏清晰",
    clarityNeutral: "中等",
    claritySoft: "偏糊",
    groupDelayResidual: "残余群时延离散",
    transientSpread: "瞬态展宽",
    thdValidate: "1kHz THD（验证电平）",
    thdHot: "1kHz THD（最高电平）",
    helpTitle: "怎么操作呢",
    helpSelf: "① 准备一盘空白带\n② 点「导出校准信号」，录到空白带上\n③ 用同一台卡座回放这盒带\n④ 点「导入回放录音」或用浏览器录音\n⑤ 点「开始分析」\n⑥ 保存校准档案（补偿用）或基准数据（拿去测别的机器用）",
    helpTest: "① 切换到「测其它机器」\n② 加载之前保存的基准数据\n③ 在另一台机器上回放这盒校准带\n④ 导入回放录音\n⑤ 点「开始分析」",
    helpPlayback: "① 准备一盒标准校准带（ABEX / TDK / Victor 等）\n② 在本机上回放这盒带\n③ 用数字录音设备内录 LINE OUT，导入到 SIDE\n④ 点「开始分析」——结果就是本机的纯回放偏差\n⑤ 保存校准档案（可用于后续推导录制特性）",
    helpRecording: "① 先完成「综合校准」，保存校准档案\n② 再完成「回放特性」测量，保存校准档案\n③ 切换到「推导录制」\n④ 加载综合校准档案和回放校准档案\n⑤ 点「计算录制特性」——系统会自动做减法\n⑥ 结果 = 综合 − 回放 = 纯录制偏差",
    loadCompositeProfile: "加载综合校准档案",
    loadPlaybackProfile: "加载回放校准档案",
    clearCompositeProfile: "清除综合档案",
    clearPlaybackProfile: "清除回放档案",
    computeRecording: "计算录制特性",
    compositeProfileMissing: "还没有综合校准档案",
    compositeProfileReady: "综合校准档案已就绪",
    playbackProfileMissing: "还没有回放校准档案",
    playbackProfileReady: "回放校准档案已就绪",
    recordingResultTitle: "推导结果：纯录制偏差",
    multiCaptureTitle: "多次回放均值",
    multiCaptureDesc: "导入多个回放录音文件，逐个分析后取均值——减少随机误差，结果更准确。",
    multiCaptureImport: "添加回放录音",
    multiCaptureClear: "清空全部",
    multiCaptureCount: "已加载",
    multiCaptureAnalyse: "均值分析",
  },
  ja: {
    descTitle: "ツール説明",
    desc: "デッキの周波数応答と走行安定性を測定します。再生特性の単独測定や録音特性の推定も可能です。",
    scenarioSelf: "総合校正",
    scenarioSelfDesc: "自己録再で録音+再生の総合結果を取得",
    scenarioTest: "他機を測定",
    scenarioTestDesc: "基準データを読み込み、他機の再生録音を取り込む",
    scenarioPlayback: "再生特性",
    scenarioPlaybackDesc: "標準校正テープを直接再生して純粋な再生偏差を測定",
    scenarioRecording: "録音特性の推定",
    scenarioRecordingDesc: "総合結果から再生偏差を差し引いて録音特性を得る",
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
    responseGraphHint: "下に 2 枚のグラフを分けて表示します。1 枚目は未補正の実測応答、2 枚目はシステムが適用する補正 EQ です。0 dB は 1 kHz アンカーで、実測が 0 dB を下回る帯域はそのぶん持ち上げます。",
    measuredChartTitle: "未補正の実測応答",
    correctionChartTitle: "補正 EQ",
    enlargeChart: "拡大",
    shrinkChart: "縮小",
    transportTitle: "走行診断結果",
    meanFreq: "平均周波数",
    speedError: "速度偏差",
    wfRms: "Wow/Flutter RMS",
    wfPk: "Wow/Flutter P-P",
    refWfFloor: "基準テープ W/F フロア",
    correctionPoints: "校正ポイント",
    measuredResponse: "実測応答",
    correctionEq: "補正 EQ",
    curveLegendMeasuredL: "L 実測",
    curveLegendMeasuredR: "R 実測",
    curveLegendCorrectionL: "L 補正",
    curveLegendCorrectionR: "R 補正",
    clarityTitle: "明瞭度",
    clarityHint: "既存の sweep / 1kHz 校正音から直接推定した客観指標です。主観スコアではありませんが、音のにごりや輪郭の甘さと強く相関します。",
    clarityVerdict: "明瞭度判定",
    clarityClear: "比較的明瞭",
    clarityNeutral: "中間",
    claritySoft: "やや鈍い",
    groupDelayResidual: "残留群遅延のばらつき",
    transientSpread: "瞬態の広がり",
    thdValidate: "1kHz THD（検証レベル）",
    thdHot: "1kHz THD（最高レベル）",
    helpTitle: "操作手順",
    helpSelf: "① 空テープを用意\n② 信号を書き出してテープに録音\n③ 同じデッキで再生して取り込み\n④ 「分析を開始」\n⑤ 校正ファイルまたは基準データを保存",
    helpTest: "① 「他機を測定」に切替\n② 基準データを読み込む\n③ 別のデッキで再生して取り込む\n④ 「分析を開始」",
    helpPlayback: "① 標準校正テープを用意\n② 本機で再生\n③ LINE OUT を内録して読み込む\n④ 「分析を開始」→ 純粋な再生偏差\n⑤ 校正ファイルを保存",
    helpRecording: "① 「総合校正」を完了して保存\n② 「再生特性」を測定して保存\n③ 「録音特性の推定」に切替\n④ 総合と再生の両方を読み込む\n⑤ 「録音特性を計算」",
    loadCompositeProfile: "総合校正ファイルを読込",
    loadPlaybackProfile: "再生校正ファイルを読込",
    clearCompositeProfile: "総合ファイルを解除",
    clearPlaybackProfile: "再生ファイルを解除",
    computeRecording: "録音特性を計算",
    compositeProfileMissing: "総合校正ファイル 未読込",
    compositeProfileReady: "総合校正ファイル 読込済み",
    playbackProfileMissing: "再生校正ファイル 未読込",
    playbackProfileReady: "再生校正ファイル 読込済み",
    recordingResultTitle: "推定結果：純粋な録音偏差",
    multiCaptureTitle: "複数回再生の平均化",
    multiCaptureDesc: "複数の再生録音を読み込み、それぞれ分析して平均——ランダムな誤差を低減します。",
    multiCaptureImport: "再生録音を追加",
    multiCaptureClear: "全てクリア",
    multiCaptureCount: "読込済み",
    multiCaptureAnalyse: "平均化分析",
  },
  en: {
    descTitle: "Tool Description",
    desc: "Record a calibration tape to measure your deck's frequency response and transport stability. Generate correction files for preview and export, or use the same tape to test other devices.",
    scenarioSelf: "Combined Cal",
    scenarioSelfDesc: "Self-record-self-play → combined record+playback result",
    scenarioTest: "Test Other Device",
    scenarioTestDesc: "Load baseline, import another device's playback",
    scenarioPlayback: "Playback Only",
    scenarioPlaybackDesc: "Play a standard calibration tape to measure pure playback deviation",
    scenarioRecording: "Derive Recording",
    scenarioRecordingDesc: "Subtract playback from combined result to isolate recording characteristics",
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
    responseGraphHint: "The graphs below are split by role: the first shows the uncorrected measured response, and the second shows the corrective EQ that SIDE will apply. 0 dB is the 1 kHz anchor; where measured response falls below 0 dB, the corrective EQ boosts that band.",
    measuredChartTitle: "Measured Response",
    correctionChartTitle: "Corrective EQ",
    enlargeChart: "Enlarge",
    shrinkChart: "Shrink",
    transportTitle: "Transport Result",
    meanFreq: "Mean Frequency",
    speedError: "Speed Error",
    wfRms: "Wow/Flutter RMS",
    wfPk: "Wow/Flutter Peak-to-Peak",
    refWfFloor: "Reference W/F Floor",
    correctionPoints: "Correction Points",
    measuredResponse: "Measured Response",
    correctionEq: "Corrective EQ",
    curveLegendMeasuredL: "L meas.",
    curveLegendMeasuredR: "R meas.",
    curveLegendCorrectionL: "L corr.",
    curveLegendCorrectionR: "R corr.",
    clarityTitle: "Clarity",
    clarityHint: "These values are derived directly from the existing sweep / 1 kHz calibration tones. They are not subjective listening scores, but objective proxies strongly related to blur and loss of edge definition.",
    clarityVerdict: "Clarity Verdict",
    clarityClear: "Fairly Clear",
    clarityNeutral: "Middle",
    claritySoft: "Somewhat Soft",
    groupDelayResidual: "Residual Group Delay",
    transientSpread: "Transient Spread",
    thdValidate: "1 kHz THD (Validation)",
    thdHot: "1 kHz THD (Hottest)",
    helpTitle: "How To",
    helpSelf: "① Prepare blank tape\n② Export calibration signal, record to tape\n③ Play back on the same deck\n④ Import recording\n⑤ Start Analysis\n⑥ Save calibration file or baseline data",
    helpTest: "① Switch to Test Other Device\n② Load baseline\n③ Play tape on another device\n④ Import recording\n⑤ Start Analysis",
    helpPlayback: "① Get a standard calibration tape\n② Play on this deck\n③ Record LINE OUT digitally, import\n④ Start Analysis → pure playback deviation\n⑤ Save calibration file",
    helpRecording: "① Complete Combined Cal and save\n② Complete Playback Only and save\n③ Switch to Derive Recording\n④ Load both files\n⑤ Click Compute Recording → result = combined − playback",
    loadCompositeProfile: "Load Combined Profile",
    loadPlaybackProfile: "Load Playback Profile",
    clearCompositeProfile: "Clear Combined",
    clearPlaybackProfile: "Clear Playback",
    computeRecording: "Compute Recording",
    compositeProfileMissing: "No combined profile",
    compositeProfileReady: "Combined profile loaded",
    playbackProfileMissing: "No playback profile",
    playbackProfileReady: "Playback profile loaded",
    recordingResultTitle: "Derived Result: Pure Recording Deviation",
    multiCaptureTitle: "Multi-Pass Averaging",
    multiCaptureDesc: "Import multiple playback recordings, analyse each and average — reduces random error.",
    multiCaptureImport: "Add Recordings",
    multiCaptureClear: "Clear All",
    multiCaptureCount: "Loaded",
    multiCaptureAnalyse: "Averaged Analysis",
  },
};

function CalibrationCurveChart({ title, buttonLabel, onToggleSize, frequencyGridHz, curves, large = false }) {
  if (!frequencyGridHz?.length || !curves?.length) return null;
  const W = 760;
  const H = large ? 300 : 180;
  const PAD = { l: 42, r: 12, t: 20, b: 24 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const logMin = Math.log10(Math.max(20, frequencyGridHz[0]));
  const logMax = Math.log10(Math.min(20000, frequencyGridHz[frequencyGridHz.length - 1]));
  const logRange = logMax - logMin || 1;
  let yMin = -12;
  let yMax = 12;
  for (const curve of curves) {
    for (const value of (curve.db || [])) {
      if (!Number.isFinite(value)) continue;
      yMin = Math.min(yMin, value - 1);
      yMax = Math.max(yMax, value + 1);
    }
  }
  const yRange = yMax - yMin || 1;
  const toX = (freq) => PAD.l + ((Math.log10(Math.max(1, freq)) - logMin) / logRange) * plotW;
  const toY = (db) => PAD.t + (1 - ((db - yMin) / yRange)) * plotH;
  const gridFreqs = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const gridDbStep = yRange > 24 ? 6 : yRange > 12 ? 3 : 2;
  const gridDbs = [];
  for (let db = Math.ceil(yMin / gridDbStep) * gridDbStep; db <= yMax; db += gridDbStep) gridDbs.push(db);

  return (
    <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{title}</div>
        <button
          onClick={onToggleSize}
          style={{ padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)", fontSize: 11 }}
        >
          {buttonLabel}
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {gridFreqs.map((freq) => freq >= frequencyGridHz[0] && freq <= frequencyGridHz[frequencyGridHz.length - 1] ? (
          <line key={`gf${freq}`} x1={toX(freq)} x2={toX(freq)} y1={PAD.t} y2={H - PAD.b} stroke="var(--border)" strokeWidth={0.6} />
        ) : null)}
        {gridDbs.map((db) => (
          <g key={`gd${db}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={toY(db)} y2={toY(db)} stroke={db === 0 ? "var(--text-dim)" : "var(--border)"} strokeWidth={db === 0 ? 1 : 0.6} />
            <text x={PAD.l - 6} y={toY(db) + 4} textAnchor="end" fontSize={10} fill="var(--text-dim)">{db > 0 ? `+${db}` : db}</text>
          </g>
        ))}
        {[100, 1000, 10000].map((freq) => (
          <text key={`fl${freq}`} x={toX(freq)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
            {freq >= 1000 ? `${freq / 1000}k` : freq}
          </text>
        ))}
        {curves.map((curve, index) => {
          const points = [];
          for (let i = 0; i < frequencyGridHz.length; i++) {
            const db = curve.db?.[i];
            if (!Number.isFinite(db)) continue;
            points.push(`${toX(frequencyGridHz[i]).toFixed(1)},${toY(db).toFixed(1)}`);
          }
          return (
            <polyline
              key={index}
              points={points.join(" ")}
              fill="none"
              stroke={curve.color || "#888"}
              strokeWidth={1.6}
            />
          );
        })}
        {curves.filter((curve) => curve.label).map((curve, index) => (
          <g key={`lg${index}`}>
            <line x1={PAD.l + index * 110} x2={PAD.l + index * 110 + 18} y1={8} y2={8} stroke={curve.color || "#888"} strokeWidth={1.8} />
            <text x={PAD.l + index * 110 + 24} y={11} fontSize={10} fill="var(--text-dim)">{curve.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function CassetteRecordingCalibrationPlugin({
  lang = "zh-CN",
  processing,
  captureName,
  responseAnalysis,
  transportAnalysis,
  programManifestName,
  recordingKind,
  browserRecordingEnabled = false,
  onLoadProgramManifest,
  onClearProgramManifest,
  onExportProgram,
  onImportCapture,
  onStartRecording,
  onStopRecording,
  onAnalyseCapture,
  onSaveResponseProfile,
  onSaveProgramManifest,
  multiCaptures = [],
  onImportMultiCaptures,
  onClearMultiCaptures,
  onAnalyseMultiCaptures,
  standardTapePreset = "aiwa-3freq",
  onSetStandardTapePreset,
  onAnalyseStandardTape,
  standardTapePresets = {},
}) {
  const [activeScenario, setActiveScenario] = useState("self");
  const captureFileRef = useRef(null);
  const manifestFileRef = useRef(null);
  const compositeFileRef = useRef(null);
  const playbackFileRef = useRef(null);
  const t = LABELS[lang] || LABELS.en;
  const isRecording = recordingKind === "program";
  const transportRefLabel = transportAnalysis?.transportReferenceMode
    ? (lang === "zh-CN" ? "写入机参考频率" : lang === "ja" ? "録音機基準周波数" : "Writer Reference")
    : t.refTone;
  const transportSpeedLabel = transportAnalysis?.transportReferenceMode
    ? (lang === "zh-CN" ? "相对速度偏差" : lang === "ja" ? "相対速度偏差" : "Relative Speed")
    : t.speedError;

  // Recording derivation state
  const [compositeProfile, setCompositeProfile] = useState(null);
  const [compositeProfileName, setCompositeProfileName] = useState("");
  const [playbackProfile, setPlaybackProfile] = useState(null);
  const [playbackProfileName, setPlaybackProfileName] = useState("");
  const [recordingResult, setRecordingResult] = useState(null);
  const [largeChart, setLargeChart] = useState("");

  const loadJsonProfile = (file, setProfile, setName) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = normalizeCalibrationProfile(JSON.parse(reader.result));
        setProfile(parsed);
        setName(file.name);
      } catch { setProfile(null); setName(""); }
    };
    reader.readAsText(file);
  };

  const computeRecordingProfile = () => {
    if (!compositeProfile?.channels?.L?.correctionDb || !playbackProfile?.channels?.L?.correctionDb) return;
    const deriveCurve = (channel, curve) => {
      const frequenciesHz = [...(curve?.frequenciesHz || [])];
      return {
        ...(curve?.inputDb != null ? { inputDb: curve.inputDb } : {}),
        ...(curve?.role ? { role: curve.role } : {}),
        frequenciesHz,
        correctionDb: frequenciesHz.map((freq) => (
          getProfileCorrectionDb(compositeProfile, freq, channel)
          - getProfileCorrectionDb(playbackProfile, freq, channel)
        )),
        phaseRad: frequenciesHz.map((freq) => (
          getProfilePhaseRad(compositeProfile, freq, channel)
          - getProfilePhaseRad(playbackProfile, freq, channel)
        )),
      };
    };
    const topCurveL = deriveCurve("L", compositeProfile.channels.L);
    const topCurveR = deriveCurve("R", compositeProfile.channels.R || compositeProfile.channels.L);
    const levelCurvesL = getProfileLevelCurves(compositeProfile, "L").map((curve) => deriveCurve("L", curve));
    const levelCurvesR = getProfileLevelCurves(compositeProfile, "R").map((curve) => deriveCurve("R", curve));
    const result = {
      type: "deck.recording-correction-profile",
      name: `${compositeProfileName} − ${playbackProfileName} (recording)`,
      createdAt: new Date().toISOString(),
      channels: {
        L: {
          frequenciesHz: topCurveL.frequenciesHz,
          correctionDb: topCurveL.correctionDb,
          phaseRad: topCurveL.phaseRad,
          levelCurves: levelCurvesL,
        },
        R: {
          frequenciesHz: topCurveR.frequenciesHz,
          correctionDb: topCurveR.correctionDb,
          phaseRad: topCurveR.phaseRad,
          levelCurves: levelCurvesR,
        },
      },
    };
    setRecordingResult(result);
  };

  const responsePreviewStride = responseAnalysis
    ? Math.max(1, Math.ceil(responseAnalysis.frequenciesHz.length / 18))
    : 1;
  const responsePreviewIndices = responseAnalysis
    ? responseAnalysis.frequenciesHz.reduce((indices, _, index, array) => {
      if (index % responsePreviewStride === 0 || index === array.length - 1) indices.push(index);
      return indices;
    }, [])
    : [];

  const report = useMemo(
    () => (responseAnalysis ? generateDeckCalibrationReport(responseAnalysis, transportAnalysis, lang) : null),
    [responseAnalysis, transportAnalysis, lang],
  );
  const clarity = useMemo(
    () => (responseAnalysis ? analyseClarity(responseAnalysis) : null),
    [responseAnalysis],
  );
  const clarityL = responseAnalysis?.channels?.L?.clarity || null;
  const clarityR = responseAnalysis?.channels?.R?.clarity || null;
  const toneMapL = responseAnalysis?.dynamicModel?.toneMap?.L || [];
  const toneMapR = responseAnalysis?.dynamicModel?.toneMap?.R || [];
  const validationToneL = toneMapL.find((point) => point.role === "validate") || null;
  const validationToneR = toneMapR.find((point) => point.role === "validate") || null;
  const hotToneL = [...toneMapL].sort((a, b) => (b.inputDb || 0) - (a.inputDb || 0))[0] || null;
  const hotToneR = [...toneMapR].sort((a, b) => (b.inputDb || 0) - (a.inputDb || 0))[0] || null;

  const helpText = activeScenario === "self" ? t.helpSelf : activeScenario === "test-tape" ? t.helpTest : activeScenario === "playback" ? t.helpPlayback : t.helpRecording;
  const showCaptureControls = activeScenario !== "recording";
  const captureCount = multiCaptures.length || (captureName ? 1 : 0);
  const captureReady = multiCaptures.length >= 2 || !!captureName;
  const handleImportCaptures = (files) => {
    if (!files?.length) return;
    if (files.length === 1) {
      onClearMultiCaptures();
      onImportCapture(files[0]);
      return;
    }
    onImportMultiCaptures(files);
  };
  const handleAnalyse = () => {
    if (multiCaptures.length >= 2) {
      onAnalyseMultiCaptures(activeScenario);
      return;
    }
    if (activeScenario === "playback") {
      onAnalyseStandardTape();
      return;
    }
    onAnalyseCapture(activeScenario);
  };

  return (
    <>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-ink)", marginBottom: 6 }}>{t.descTitle}</div>
        <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-dim)" }}>{t.desc}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        {[
          { id: "self", label: t.scenarioSelf, desc: t.scenarioSelfDesc },
          { id: "test-tape", label: t.scenarioTest, desc: t.scenarioTestDesc },
          { id: "playback", label: t.scenarioPlayback, desc: t.scenarioPlaybackDesc },
          { id: "recording", label: t.scenarioRecording, desc: t.scenarioRecordingDesc },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveScenario(s.id)}
            style={{
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: activeScenario === s.id ? "var(--accent-dim)" : "var(--bg-card)",
              color: activeScenario === s.id ? "var(--accent-ink)" : "var(--text)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 10, lineHeight: 1.5, color: "var(--text-dim)" }}>{s.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{t.helpTitle}</div>
        <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-line" }}>{helpText}</div>
      </div>

      {/* ── Recording derivation UI ──────────────────── */}
      {activeScenario === "recording" && (
        <>
          <input ref={compositeFileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadJsonProfile(f, setCompositeProfile, setCompositeProfileName); e.target.value = ""; }} />
          <input ref={playbackFileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadJsonProfile(f, setPlaybackProfile, setPlaybackProfileName); e.target.value = ""; }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>
                {compositeProfileName ? t.compositeProfileReady : t.compositeProfileMissing}
              </div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>{compositeProfileName || "-"}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => compositeFileRef.current?.click()} style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)", fontSize: 12 }}>{t.loadCompositeProfile}</button>
                <button onClick={() => { setCompositeProfile(null); setCompositeProfileName(""); setRecordingResult(null); }} disabled={!compositeProfile} style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)", fontSize: 12 }}>{t.clearCompositeProfile}</button>
              </div>
            </div>
            <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>
                {playbackProfileName ? t.playbackProfileReady : t.playbackProfileMissing}
              </div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>{playbackProfileName || "-"}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => playbackFileRef.current?.click()} style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)", fontSize: 12 }}>{t.loadPlaybackProfile}</button>
                <button onClick={() => { setPlaybackProfile(null); setPlaybackProfileName(""); setRecordingResult(null); }} disabled={!playbackProfile} style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)", fontSize: 12 }}>{t.clearPlaybackProfile}</button>
              </div>
            </div>
          </div>

          <button
            onClick={computeRecordingProfile}
            disabled={!compositeProfile || !playbackProfile}
            style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: compositeProfile && playbackProfile ? "var(--accent)" : "var(--bg-deep)", cursor: "pointer", color: compositeProfile && playbackProfile ? "var(--accent-contrast)" : "var(--text)" }}
          >
            {t.computeRecording}
          </button>

          {recordingResult && (
            <div style={{ padding: "12px 14px", border: "1px solid var(--accent-dim, var(--border))", borderRadius: 10, background: "var(--bg-card)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t.recordingResultTitle}</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-dim)", marginBottom: 8 }}>{recordingResult.name}</div>
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(recordingResult, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "recording-only-profile.json"; a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)" }}
              >
                {t.saveProfile}
              </button>
            </div>
          )}
        </>
      )}

      <input
        ref={captureFileRef}
        type="file"
        accept="audio/*,.wav,.flac,.aiff,.aif,.m4a,.ogg,.webm"
        multiple
        style={{ display: "none" }}
        onChange={(event) => {
          const files = event.target.files ? Array.from(event.target.files) : [];
          handleImportCaptures(files);
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

      {showCaptureControls && (<>
      {activeScenario === "test-tape" && (
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

      <div style={{ borderTop: "1px solid var(--border)" }} />

      {/* ── Standard tape preset (playback scenario) ──── */}
      {activeScenario === "playback" && (
        <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{lang === "zh-CN" ? "测试带型号" : lang === "ja" ? "テストテープ種類" : "Test Tape Preset"}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(standardTapePresets).map(([id, preset]) => (
              <button key={id} onClick={() => onSetStandardTapePreset(id)}
                style={{
                  padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8,
                  background: standardTapePreset === id ? "var(--accent-dim)" : "var(--bg-deep)",
                  color: standardTapePreset === id ? "var(--accent-ink)" : "var(--text)",
                  cursor: "pointer", fontSize: 11,
                }}>
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {activeScenario === "self" && (
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
        {browserRecordingEnabled && (
          <button
            onClick={() => (isRecording ? onStopRecording() : onStartRecording("program"))}
            disabled={processing}
            style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: 8, background: isRecording ? "var(--accent-dim)" : "var(--bg-deep)", cursor: "pointer", color: isRecording ? "var(--accent-ink)" : "var(--text)" }}
          >
            {isRecording ? t.stopRecord : t.startRecord}
          </button>
        )}
        <button
          onClick={handleAnalyse}
          disabled={processing || !captureReady}
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
        {activeScenario === "self" && (
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
          {recordingKind ? t.recordingBusy : captureReady ? t.captureReady : t.captureMissing}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          {recordingKind
            ? `${recordingKind}.webm`
            : multiCaptures.length
              ? `${t.multiCaptureCount}: ${captureCount}`
              : captureName || "-"}
        </div>
        {multiCaptures.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
            {multiCaptures.map((capture, index) => <div key={`${capture.name}-${index}`}>{index + 1}. {capture.name}</div>)}
          </div>
        )}
      </div>
      </>)}

      {responseAnalysis && (
        <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t.responseTitle}</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 8 }}>
            {t.responseGraphHint}
          </div>
          {responseAnalysis.dynamicModel?.fitLevelsDb?.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 8 }}>
              <div>
                {lang === "zh-CN"
                  ? `建模电平：${responseAnalysis.dynamicModel.fitLevelsDb.join(" / ")} dB`
                  : lang === "ja"
                    ? `モデル化レベル: ${responseAnalysis.dynamicModel.fitLevelsDb.join(" / ")} dB`
                    : `Model levels: ${responseAnalysis.dynamicModel.fitLevelsDb.join(" / ")} dB`}
              </div>
              {responseAnalysis.dynamicModel.validationErrorDb?.L && (
                <div>
                  {lang === "zh-CN"
                    ? `保留验证误差：L ${responseAnalysis.dynamicModel.validationErrorDb.L.rmsDb.toFixed(2)} dB / R ${responseAnalysis.dynamicModel.validationErrorDb.R?.rmsDb?.toFixed(2) || "0.00"} dB RMS`
                    : lang === "ja"
                      ? `ホールドアウト誤差: L ${responseAnalysis.dynamicModel.validationErrorDb.L.rmsDb.toFixed(2)} dB / R ${responseAnalysis.dynamicModel.validationErrorDb.R?.rmsDb?.toFixed(2) || "0.00"} dB RMS`
                      : `Holdout error: L ${responseAnalysis.dynamicModel.validationErrorDb.L.rmsDb.toFixed(2)} dB / R ${responseAnalysis.dynamicModel.validationErrorDb.R?.rmsDb?.toFixed(2) || "0.00"} dB RMS`}
                </div>
              )}
            </div>
          )}
          {(clarityL || clarityR) && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{t.clarityTitle}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 8 }}>{t.clarityHint}</div>
              <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 8 }}>
                {t.clarityVerdict}：
                {clarity?.label === "clear"
                  ? t.clarityClear
                  : clarity?.label === "soft"
                    ? t.claritySoft
                    : t.clarityNeutral}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>
                {[
                  { label: `L ${t.groupDelayResidual}`, value: clarityL?.groupDelayResidualRmsMs != null ? `${clarityL.groupDelayResidualRmsMs.toFixed(3)} ms RMS` : "-" },
                  { label: `R ${t.groupDelayResidual}`, value: clarityR?.groupDelayResidualRmsMs != null ? `${clarityR.groupDelayResidualRmsMs.toFixed(3)} ms RMS` : "-" },
                  { label: `L ${t.transientSpread}`, value: clarityL?.transientSpreadMs != null ? `${clarityL.transientSpreadMs.toFixed(3)} ms` : "-" },
                  { label: `R ${t.transientSpread}`, value: clarityR?.transientSpreadMs != null ? `${clarityR.transientSpreadMs.toFixed(3)} ms` : "-" },
                  { label: `L ${t.thdValidate}`, value: validationToneL?.thdPercent != null ? `${validationToneL.thdPercent.toFixed(2)} %` : "-" },
                  { label: `R ${t.thdValidate}`, value: validationToneR?.thdPercent != null ? `${validationToneR.thdPercent.toFixed(2)} %` : "-" },
                  { label: `L ${t.thdHot}`, value: hotToneL?.thdPercent != null ? `${hotToneL.thdPercent.toFixed(2)} % @ ${hotToneL.inputDb} dB` : "-" },
                  { label: `R ${t.thdHot}`, value: hotToneR?.thdPercent != null ? `${hotToneR.thdPercent.toFixed(2)} % @ ${hotToneR.inputDb} dB` : "-" },
                ].map((item) => (
                  <div key={item.label} style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{item.label}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.7 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 }}>
            <CalibrationCurveChart
              title={t.measuredChartTitle}
              buttonLabel={largeChart === "measured" ? t.shrinkChart : t.enlargeChart}
              onToggleSize={() => setLargeChart((value) => value === "measured" ? "" : "measured")}
              frequencyGridHz={responseAnalysis.frequenciesHz}
              large={largeChart === "measured"}
              curves={[
                { db: responseAnalysis.channels?.L?.measuredDb, color: "#7aa2ff", label: t.curveLegendMeasuredL },
                { db: responseAnalysis.channels?.R?.measuredDb, color: "#ffab86", label: t.curveLegendMeasuredR },
              ]}
            />
            <CalibrationCurveChart
              title={t.correctionChartTitle}
              buttonLabel={largeChart === "correction" ? t.shrinkChart : t.enlargeChart}
              onToggleSize={() => setLargeChart((value) => value === "correction" ? "" : "correction")}
              frequencyGridHz={responseAnalysis.frequenciesHz}
              large={largeChart === "correction"}
              curves={[
                { db: responseAnalysis.channels?.L?.correctionDb, color: "#4080e8", label: t.curveLegendCorrectionL },
                { db: responseAnalysis.channels?.R?.correctionDb, color: "#e87040", label: t.curveLegendCorrectionR },
              ]}
            />
          </div>
        </div>
      )}

      {transportAnalysis && (
        <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t.transportTitle}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{transportRefLabel}</div>
              <div style={{ fontSize: 14 }}>{(transportAnalysis.referenceMeanHz || transportAnalysis.nominalHz).toFixed(2)} Hz</div>
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.meanFreq}</div>
              <div style={{ fontSize: 14 }}>{transportAnalysis.meanHz.toFixed(2)} Hz</div>
            </div>
            <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{transportSpeedLabel}</div>
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

      {report && (
        <ReportCard
          summary={report.summary}
          full={report.full}
          tags={report.tags}
          lang={lang}
        />
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
