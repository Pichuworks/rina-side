import React, { useMemo, useRef, useState } from "react";

export const PLAYER_PROFILE_WORKBENCH_PLUGIN_ID = "player-profile-workbench";

const LABELS = {
  "zh-CN": {
    title: "播放器听感测量 & EQ 匹配",
    descTitle: "工具说明",
    desc: "测量播放器的频率响应，然后——让它趋向平直，或者模仿另一台设备的声音。",
    probeTitle: "测试信号法",
    probeDesc: "用标准测试信号来精确测量。精度最高，但需要专门录一次。",
    exportProbe: "导出测试信号",
    importProbeCapture: "导入回放录音",
    generateProbeProfile: "生成测量结果",
    saveProbeProfile: "保存测量结果",
    probeCapture: "回放录音",
    probeProfileName: "测量结果名称",
    songTitle: "曲目对比法",
    songDesc: "用已有曲目的原曲和内录做对比测量。不需要额外录测试信号，有一首歌就够。",
    importSongFiles: "导入曲目文件",
    generateSongProfile: "生成测量结果",
    saveSongProfile: "保存测量结果",
    songProfileName: "测量结果名称",
    refCount: "原曲",
    recCount: "内录",
    pairCount: "已配对",
    pairError: "配对状态",
    pairingRule: "文件命名规则",
    pairingRuleText: "每首歌准备两个文件：原曲文件名加 .1（如 song.1.wav），内录文件名加 .2（如 song.2.wav）。全部选中导入，系统自动配对。",
    pairPreview: "当前配对结果",
    pairDetails: "配对问题详情",
    noPairs: "还没有有效配对",
    analysisFailedTitle: "分析时跳过的曲目",
    eqTitle: "设备 EQ 建模",
    eqDesc: "告诉系统你的设备能调哪些频段、每档多少 dB，就能帮你算出最优 EQ。",
    eqAutoQHint: "频段宽度已内置，不需要填 Q 值。",
    useProbeAsBase: "用测试信号法的结果",
    useSongAsBase: "用曲目对比法的结果",
    importBaseProfile: "导入已有测量结果",
    buildEqProfile: "生成 EQ 模型",
    saveEqProfile: "保存 EQ 模型",
    eqBaseProfile: "基础频响",
    eqAdjustableProfile: "EQ 模型",
    eqBandPreset: "频段预设",
    customBands: "中心频率列表",
    customBandsHint: "逗号分隔，例如：31,46,63,125,...",
    gainStep: "每档增益 (dB)",
    minStep: "最小档位",
    maxStep: "最大档位",
    qValue: "Q 值",
    eqParamExplain: "这几个参数：每档 dB、最小档位、最大档位。",
    compilerTitle: "EQ 匹配",
    compilerDesc: "有了设备的频响数据，系统能自动算出——调哪些频段、调多少格，就能让声音趋向目标。",
    targetMode: "目标",
    targetProfile: "模仿另一台设备",
    targetFlat: "趋向平直",
    importAProfile: "导入设备频响",
    importBProfile: "导入目标频响",
    useEqAsA: "用上面的 EQ 模型",
    useProbeAsB: "用测试信号法的结果",
    useSongAsB: "用曲目对比法的结果",
    compileNow: "计算 EQ",
    compileNowFlat: "计算趋平 EQ",
    loadCompileProfile: "加载到试听",
    exportLoadProfile: "导出补偿档案",
    profileA: "设备频响",
    profileB: "目标",
    compileResult: "计算结果",
    fitScore: "拟合分数",
    usableBand: "有效频段",
    eqSteps: "EQ 档位",
    eqVisualization: "EQ 可视化",
    correctedVisualization: "修正后听感",
    curveLegendTarget: "目标差值",
    curveLegendPredicted: "EQ 预测",
    curveLegendTargetResponse: "目标听感",
    curveLegendCorrected: "修正后听感",
    exportText: "导出文本",
    exportJson: "导出 JSON",
    loadFullRes: "加载全分辨率补偿",
    exportFullRes: "导出全分辨率补偿档案",
    fullResHint: "不受 EQ 频段限制，精度最高。适合不能调 EQ 的设备——把补偿烧进导出音频里。",
    analysisProgress: "分析进度",
    profileResult: "测量结果",
    invalidNames: "文件名格式不对",
    duplicateSource: "重复的原曲",
    duplicateRecorded: "重复的内录",
    missingRecorded: "缺少对应内录",
    extraRecorded: "多余的内录",
    none: "无",
    idle: "-",
    car16Band: "车机 16 段",
    exactNameHint: "有文件没配上对、或者文件名格式不对的话，就没法生成了哦。",
  },
  en: {
    title: "Player Response & EQ Matching",
    descTitle: "Tool Description",
    desc: "Measure player frequency response and compute EQ to make A sound like B.",
    probeTitle: "Probe Profile",
    probeDesc: "Precise measurement using a standard test signal. High accuracy, but requires a dedicated recording.",
    exportProbe: "Export Standard Probe",
    importProbeCapture: "Import Probe Capture",
    generateProbeProfile: "Build Probe Profile",
    saveProbeProfile: "Save Probe Profile",
    probeCapture: "Probe Capture",
    probeProfileName: "Profile Name",
    songTitle: "Song Profile",
    songDesc: "Compare existing source tracks with their recordings. No extra test signal needed — even a single track pair works.",
    importSongFiles: "Import Song Set",
    generateSongProfile: "Build Song Profile",
    saveSongProfile: "Save Song Profile",
    songProfileName: "Profile Name",
    refCount: "Source Count",
    recCount: "Recorded Count",
    pairCount: "Matched Pairs",
    pairError: "Pairing",
    pairingRule: "Pairing Rule",
    pairingRuleText: "Filenames must be `xxx.1.ext` and `xxx.2.ext`. `.1` is the source track and `.2` is the recorded track.",
    pairPreview: "Current Matches",
    pairDetails: "Pairing Failure Details",
    noPairs: "No valid pairs yet",
    analysisFailedTitle: "Tracks skipped during analysis",
    eqTitle: "A EQ Model",
    eqDesc: "Set the adjustable EQ range for device A. Currently supports fixed-band graphic EQ.",
    eqAutoQHint: "Band width is built in. Q is not required in the default flow.",
    useProbeAsBase: "Use Probe as A Default Profile",
    useSongAsBase: "Use Song as A Default Profile",
    importBaseProfile: "Import A Default Profile",
    buildEqProfile: "Build A Adjustable Profile",
    saveEqProfile: "Save A Adjustable Profile",
    eqBaseProfile: "A Default Profile",
    eqAdjustableProfile: "A Adjustable Profile",
    eqBandPreset: "Band Preset",
    customBands: "Center Frequencies",
    customBandsHint: "Comma-separated, for example: 31,46,63,125,...",
    gainStep: "Gain per Step (dB)",
    minStep: "Min Step",
    maxStep: "Max Step",
    qValue: "Q",
    eqParamExplain: "These four values mean: gain per step, minimum step, maximum step, and band Q.",
    compilerTitle: "A to B Compiler",
    compilerDesc: "Import A and B response data, and automatically compute the EQ needed to make A sound like B.",
    targetMode: "Target Mode",
    targetProfile: "B Profile",
    targetFlat: "Flat",
    importAProfile: "Import A Profile",
    importBProfile: "Import B Profile",
    useEqAsA: "Use A Adjustable Profile",
    useProbeAsB: "Use Probe as B",
    useSongAsB: "Use Song as B",
    compileNow: "Compile A->B EQ",
    compileNowFlat: "Compile A->Flat EQ",
    loadCompileProfile: "Load Preview Profile",
    exportLoadProfile: "Export Load Profile",
    profileA: "A Profile",
    profileB: "Target Profile",
    compileResult: "Compile Result",
    fitScore: "Fit Score",
    usableBand: "Usable Band",
    eqSteps: "EQ Steps",
    eqVisualization: "EQ Visualization",
    correctedVisualization: "Corrected Response",
    curveLegendTarget: "Target Delta",
    curveLegendPredicted: "Predicted EQ",
    curveLegendTargetResponse: "Target Response",
    curveLegendCorrected: "Corrected Response",
    exportText: "Export Text",
    exportJson: "Export JSON",
    loadFullRes: "Load Full-Res Correction",
    exportFullRes: "Export Full-Res Correction",
    fullResHint: "No EQ band quantization — highest precision. For devices without adjustable EQ — bake the correction into exported audio.",
    analysisProgress: "Analysis Progress",
    profileResult: "Result",
    invalidNames: "Invalid filenames",
    duplicateSource: "Duplicate source keys",
    duplicateRecorded: "Duplicate recorded keys",
    missingRecorded: "Missing recorded partner",
    extraRecorded: "Extra recorded file",
    none: "None",
    idle: "-",
    car16Band: "Car 16-band",
    exactNameHint: "Generation is rejected if any file is unmatched or if its name does not follow the `xxx.1.ext / xxx.2.ext` rule.",
  },
  ja: {
    title: "プレイヤー周波数応答 & EQ マッチング",
    descTitle: "ツール説明",
    desc: "probe/song profile を生成し、A に EQ モデルを付与し、A が B を模擬する EQ を生成します。",
    probeTitle: "Probe Profile",
    probeDesc: "標準テスト信号で精密測定。精度は高いですが、専用の録音が必要です。",
    exportProbe: "標準プローブを書き出し",
    importProbeCapture: "プローブ回録を読み込む",
    generateProbeProfile: "Probe Profile 生成",
    saveProbeProfile: "Probe Profile 保存",
    probeCapture: "プローブ回録",
    probeProfileName: "Profile 名",
    songTitle: "Song Profile",
    songDesc: "既存の原曲と内録から比較測定。テスト信号の録音は不要で、1 曲でも測定できます。",
    importSongFiles: "Song 一式を読み込む",
    generateSongProfile: "Song Profile 生成",
    saveSongProfile: "Song Profile 保存",
    songProfileName: "Profile 名",
    refCount: "原曲数",
    recCount: "回録数",
    pairCount: "対応数",
    pairError: "対応状態",
    pairingRule: "対応規則",
    pairingRuleText: "ファイル名は `xxx.1.ext` と `xxx.2.ext` でなければなりません。`.1` は原曲、`.2` は回録です。",
    pairPreview: "現在の対応結果",
    pairDetails: "対応失敗の詳細",
    noPairs: "まだ有効な対応はありません",
    analysisFailedTitle: "分析時にスキップされたトラック",
    eqTitle: "A の EQ Model",
    eqDesc: "A デバイスの EQ 調整範囲を設定します。現在は固定帯域 graphic EQ に対応しています。",
    eqAutoQHint: "帯域幅はシステム内蔵です。通常フローでは Q の入力は不要です。",
    useProbeAsBase: "Probe を A 基準プロファイルにする",
    useSongAsBase: "Song を A 基準プロファイルにする",
    importBaseProfile: "A 基準プロファイルを読み込む",
    buildEqProfile: "A 調整可能プロファイルを生成",
    saveEqProfile: "A 調整可能プロファイルを保存",
    eqBaseProfile: "A 基準プロファイル",
    eqAdjustableProfile: "A 調整可能プロファイル",
    eqBandPreset: "帯域プリセット",
    customBands: "中心周波数一覧",
    customBandsHint: "カンマ区切り。例: 31,46,63,125,...",
    gainStep: "1 step の dB",
    minStep: "最小 step",
    maxStep: "最大 step",
    qValue: "Q",
    eqParamExplain: "この 4 つは順に、1 step の dB、最小 step、最大 step、band の Q を意味します。",
    compilerTitle: "A 模擬 B Compiler",
    compilerDesc: "A と B の周波数応答を取り込み、A を B に近づける EQ パラメータを自動算出します。",
    targetMode: "目標モード",
    targetProfile: "B Profile",
    targetFlat: "Flat",
    importAProfile: "A Profile 読み込み",
    importBProfile: "B Profile 読み込み",
    useEqAsA: "A 調整可能プロファイルを使う",
    useProbeAsB: "Probe を B に使う",
    useSongAsB: "Song を B に使う",
    compileNow: "A->B EQ 生成",
    compileNowFlat: "A->Flat EQ 生成",
    loadCompileProfile: "試聴用 Profile 読み込み",
    exportLoadProfile: "読込用 Profile 書き出し",
    profileA: "A Profile",
    profileB: "目標プロファイル",
    compileResult: "生成結果",
    fitScore: "適合度",
    usableBand: "有効帯域",
    eqSteps: "EQ 値",
    eqVisualization: "EQ 可視化",
    correctedVisualization: "補正後プロファイル",
    curveLegendTarget: "目標 Delta",
    curveLegendPredicted: "予測 EQ",
    curveLegendTargetResponse: "目標プロファイル",
    curveLegendCorrected: "補正後プロファイル",
    exportText: "テキスト出力",
    exportJson: "JSON 出力",
    loadFullRes: "フル解像度補正を読込",
    exportFullRes: "フル解像度補正を書出し",
    fullResHint: "EQ 帯域の制約なし。最高精度。EQ 非搭載デバイス向け——補正を書き出し音声に焼き込みます。",
    analysisProgress: "分析進捗",
    profileResult: "測定結果",
    invalidNames: "規則外ファイル名",
    duplicateSource: "重複した原曲キー",
    duplicateRecorded: "重複した回録キー",
    missingRecorded: "対応する回録不足",
    extraRecorded: "余分な回録",
    none: "なし",
    idle: "-",
    car16Band: "車載 16 バンド",
    exactNameHint: "未対応ファイルがある場合、または `xxx.1.ext / xxx.2.ext` 規則に合わない場合は生成しません。",
  },
};

function sectionStyle() {
  return {
    padding: "14px 16px",
    border: "1px solid var(--border)",
    borderRadius: 12,
    background: "var(--bg-card)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
}

function actionBtnStyle(primary = false) {
  return {
    padding: "8px 14px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: primary ? "var(--accent)" : "var(--bg-deep)",
    color: primary ? "var(--accent-contrast)" : "var(--text)",
    cursor: "pointer",
  };
}

function inputStyle() {
  return {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    width: "100%",
    boxSizing: "border-box",
  };
}

function fieldLabel(label) {
  return <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{label}</div>;
}

function statBox(label, value) {
  return (
    <div style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}

function EqBars({ steps }) {
  const filtered = steps.filter((step) => step.value !== 0);
  if (!filtered.length) return null;
  const maxAbs = Math.max(...filtered.map((step) => Math.abs(step.value)), 1);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 8 }}>
      {filtered.map((step) => {
        const positive = step.value >= 0;
        const magnitude = (Math.abs(step.value) / maxAbs) * 100;
        return (
          <div key={step.bandId} style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span>{step.bandId}</span>
              <span>{positive ? `+${step.value}` : step.value}</span>
            </div>
            <div style={{ height: 6, background: "var(--bg-deep)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                width: `${magnitude}%`,
                height: "100%",
                background: positive ? "var(--accent)" : "var(--warning)",
                borderRadius: 999,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CurveChart({ frequencyGridHz, targetDeltaDb, predictedEqDb, legendTarget, legendPredicted }) {
  if (!frequencyGridHz?.length || !targetDeltaDb?.length || !predictedEqDb?.length) return null;
  const width = 720;
  const height = 220;
  const padX = 36;
  const padY = 20;
  const allValues = [...targetDeltaDb, ...predictedEqDb];
  const peak = Math.max(1, ...allValues.map((value) => Math.abs(value)));
  const maxDb = Math.ceil(peak);
  const minLog = Math.log10(Math.max(20, frequencyGridHz[0]));
  const maxLog = Math.log10(frequencyGridHz[frequencyGridHz.length - 1]);

  const pointFor = (freq, db) => {
    const x = padX + ((Math.log10(freq) - minLog) / (maxLog - minLog)) * (width - padX * 2);
    const y = padY + ((maxDb - db) / (maxDb * 2)) * (height - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  const targetPoints = frequencyGridHz.map((freq, index) => pointFor(freq, targetDeltaDb[index] ?? 0)).join(" ");
  const predictedPoints = frequencyGridHz.map((freq, index) => pointFor(freq, predictedEqDb[index] ?? 0)).join(" ");
  const guideValues = [-maxDb, -maxDb / 2, 0, maxDb / 2, maxDb];
  const ticks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter((freq) => freq >= frequencyGridHz[0] && freq <= frequencyGridHz[frequencyGridHz.length - 1]);

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", padding: 10 }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 220, display: "block" }}>
        {guideValues.map((db) => {
          const y = padY + ((maxDb - db) / (maxDb * 2)) * (height - padY * 2);
          return (
            <g key={db}>
              <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={8} y={y + 4} fill="var(--text-dim)" fontSize="10">{db.toFixed(0)} dB</text>
            </g>
          );
        })}
        {ticks.map((freq) => {
          const x = padX + ((Math.log10(freq) - minLog) / (maxLog - minLog)) * (width - padX * 2);
          const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
          return (
            <g key={freq}>
              <line x1={x} x2={x} y1={padY} y2={height - padY} stroke="var(--border)" strokeWidth="1" />
              <text x={x} y={height - 4} fill="var(--text-dim)" fontSize="10" textAnchor="middle">{label}</text>
            </g>
          );
        })}
        <polyline fill="none" stroke="var(--warning)" strokeWidth="2" points={targetPoints} />
        <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={predictedPoints} />
      </svg>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: "var(--text-dim)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 2, background: "var(--warning)", display: "inline-block" }} />
          {legendTarget}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 14, height: 2, background: "var(--accent)", display: "inline-block" }} />
          {legendPredicted}
        </div>
      </div>
    </div>
  );
}

function ChannelChartBlock({ title, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{title}</div>
      {children}
    </div>
  );
}

export function PlayerProfileWorkbenchPlugin(props) {
  const {
    lang = "zh-CN",
    processing,
    probeCaptureName,
    probeProfile,
    songRefNames,
    songRecNames,
    songPairCount,
    songPairError,
    songPairPreview = [],
    songPairingDetails,
    songAnalysisFailedPairs = [],
    songProfile,
    eqBaseProfileName,
    eqReadyProfile,
    compilerProfileAName,
    compilerProfileBName,
    compilerTargetMode = "profile",
    compileResult,
    compileLoadProfileName,
    onExportProbe,
    onImportProbeCapture,
    onBuildProbeProfile,
    onSaveProbeProfile,
    onImportSongFiles,
    onBuildSongProfile,
    onSaveSongProfile,
    onUseProbeAsEqBase,
    onUseSongAsEqBase,
    onImportEqBaseProfile,
    onBuildFixedEqModel,
    onSaveEqReadyProfile,
    onImportCompilerProfile,
    onUseEqReadyAsCompilerA,
    onUseProbeAsCompilerB,
    onUseSongAsCompilerB,
    onSetCompilerTargetMode,
    onCompileProfiles,
    onLoadCompileProfile,
    onExportCompileLoadProfile,
    onExportCompileText,
    onExportCompileJson,
    onLoadFullResProfile,
    onExportFullResProfile,
    procMsg,
  } = props;

  const t = LABELS[lang] || LABELS.en;
  const probeCaptureRef = useRef(null);
  const songFilesInputRef = useRef(null);
  const eqBaseRef = useRef(null);
  const compilerARef = useRef(null);
  const compilerBRef = useRef(null);

  const [probeProfileName, setProbeProfileName] = useState("Probe Profile");
  const [songProfileName, setSongProfileName] = useState("Song Profile");
  const [customBandsText, setCustomBandsText] = useState("31,46,63,125,230,400,630,810,1000,2000,4000,6000,8000,12000,14000,16000");
  const [gainStepDb, setGainStepDb] = useState("1");
  const [minStep, setMinStep] = useState("-12");
  const [maxStep, setMaxStep] = useState("12");
  const [selectedPreset, setSelectedPreset] = useState("car16");

  const EQ_PRESETS = useMemo(() => [
    { id: "car16", label: lang === "ja" ? "車載 16 バンド" : lang === "en" ? "Car 16-band" : "车机 16 段", bands: "31,46,63,125,230,400,630,810,1000,2000,4000,6000,8000,12000,14000,16000", step: "1", min: "-12", max: "12" },
    { id: "sony10", label: "Sony 10 段", bands: "31,62,125,250,500,1000,2000,4000,8000,16000", step: "1", min: "-10", max: "10" },
    { id: "pcm_d100", label: "Sony PCM-D100", bands: "400,1000,2500,6300,16000", step: "1", min: "-3", max: "3" },
    { id: "icd_sx2000", label: "Sony ICD-SX2000", bands: "100,300,1000,3000,10000", step: "1", min: "-3", max: "3" },
    { id: "rockbox_peq", label: "Rockbox PEQ 10 段", bands: "60,150,400,1000,2500,4000,6000,8000,12000,16000", step: "0.1", min: "-24", max: "24" },
    { id: "cayin_n3u", label: "Cayin N3 Ultra PEQ", bands: "60,150,400,1000,2500,4000,6000,8000,12000,16000", step: "0.1", min: "-12", max: "12" },
    { id: "generic15", label: lang === "ja" ? "汎用 15 段" : lang === "en" ? "Generic 15-band" : "通用 15 段", bands: "25,40,63,100,160,250,400,630,1000,1600,2500,4000,6300,10000,16000", step: "1", min: "-12", max: "12" },
    { id: "generic20", label: lang === "ja" ? "汎用 20 段" : lang === "en" ? "Generic 20-band" : "通用 20 段", bands: "25,31,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,2000,4000", step: "0.5", min: "-12", max: "12" },
    { id: "custom", label: lang === "ja" ? "カスタム" : lang === "en" ? "Custom" : "自定义", bands: "", step: "1", min: "-12", max: "12" },
  ], [lang]);

  const applyPreset = (presetId) => {
    setSelectedPreset(presetId);
    const preset = EQ_PRESETS.find((p) => p.id === presetId);
    if (!preset || presetId === "custom") return;
    setCustomBandsText(preset.bands);
    setGainStepDb(preset.step);
    setMinStep(preset.min);
    setMaxStep(preset.max);
  };

  const compileSummary = useMemo(() => {
    if (!compileResult?.ok) return null;
    return {
      fitScore: compileResult.fitScore?.toFixed(3) || t.idle,
      usableBand: compileResult.usableBandHz ? `${Math.round(compileResult.usableBandHz[0])} - ${Math.round(compileResult.usableBandHz[1])} Hz` : t.none,
      eqSteps: compileResult.eqSteps?.filter((step) => step.value !== 0) || [],
    };
  }, [compileResult, t]);

  const compileActionDisabled = processing || !compilerProfileAName || (compilerTargetMode === "profile" && !compilerProfileBName);
  const compileTargetName = compilerTargetMode === "flat" ? t.targetFlat : (compilerProfileBName || t.idle);

  return (
    <>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-ink)", marginBottom: 6 }}>{t.descTitle}</div>
        <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-dim)" }}>{t.desc}</div>
      </div>

      <div style={sectionStyle()}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.probeTitle}</div>
        <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-dim)" }}>{t.probeDesc}</div>
        <div>
          {fieldLabel(t.probeProfileName)}
          <input
            value={probeProfileName}
            onChange={(event) => setProbeProfileName(event.target.value)}
            style={inputStyle()}
            placeholder={t.probeProfileName}
          />
        </div>
        <input
          ref={probeCaptureRef}
          type="file"
          accept="audio/*,.wav,.flac,.aiff,.aif,.m4a,.ogg,.webm"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportProbeCapture(file);
            event.target.value = "";
          }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onExportProbe} disabled={processing} style={actionBtnStyle()}>{t.exportProbe}</button>
          <button onClick={() => probeCaptureRef.current?.click()} disabled={processing} style={actionBtnStyle()}>{t.importProbeCapture}</button>
          <button onClick={() => onBuildProbeProfile(probeProfileName)} disabled={processing || !probeCaptureName} style={actionBtnStyle(true)}>{t.generateProbeProfile}</button>
          <button onClick={onSaveProbeProfile} disabled={!probeProfile} style={actionBtnStyle()}>{t.saveProbeProfile}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 8 }}>
          {statBox(t.probeCapture, probeCaptureName || t.idle)}
          {probeProfile && statBox(t.profileResult, probeProfile.name)}
        </div>
      </div>

      <div style={sectionStyle()}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.songTitle}</div>
        <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-dim)" }}>{t.songDesc}</div>
        <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{t.pairingRule}</div>
          <div style={{ fontSize: 12, lineHeight: 1.7 }}>{t.pairingRuleText}</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>{t.exactNameHint}</div>
        </div>
        <div>
          {fieldLabel(t.songProfileName)}
          <input
            value={songProfileName}
            onChange={(event) => setSongProfileName(event.target.value)}
            style={inputStyle()}
            placeholder={t.songProfileName}
          />
        </div>
        <input
          ref={songFilesInputRef}
          type="file"
          multiple
          accept="audio/*,.wav,.flac,.aiff,.aif,.m4a,.ogg,.webm"
          style={{ display: "none" }}
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            if (files.length) onImportSongFiles(files);
            event.target.value = "";
          }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => songFilesInputRef.current?.click()} disabled={processing} style={actionBtnStyle()}>{t.importSongFiles}</button>
          <button onClick={() => onBuildSongProfile(songProfileName)} disabled={processing || !songPairCount || !!songPairError} style={actionBtnStyle(true)}>{t.generateSongProfile}</button>
          <button onClick={onSaveSongProfile} disabled={!songProfile} style={actionBtnStyle()}>{t.saveSongProfile}</button>
        </div>
        {processing && procMsg && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--accent-dim)", fontSize: 12, color: "var(--accent-ink)" }}>
            {procMsg}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 8 }}>
          {statBox(t.refCount, String(songRefNames?.length || 0))}
          {statBox(t.recCount, String(songRecNames?.length || 0))}
          {statBox(t.pairCount, String(songPairCount || 0))}
          {statBox(t.pairError, songPairError === "" ? "✓" : (songPairError || t.none))}
          {songProfile && statBox(t.profileResult, songProfile.name)}
        </div>
        {!!songPairError && (
          <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }}>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{t.pairDetails}</div>
            <div style={{ display: "grid", gap: 6 }}>
              {!!songPairingDetails?.invalidNames?.length && statBox(t.invalidNames, songPairingDetails.invalidNames.join(", "))}
              {!!songPairingDetails?.duplicateReference?.length && statBox(t.duplicateSource, songPairingDetails.duplicateReference.join(", "))}
              {!!songPairingDetails?.duplicateRecorded?.length && statBox(t.duplicateRecorded, songPairingDetails.duplicateRecorded.join(", "))}
              {!!songPairingDetails?.missingRecorded?.length && statBox(t.missingRecorded, songPairingDetails.missingRecorded.join(", "))}
              {!!songPairingDetails?.extraRecorded?.length && statBox(t.extraRecorded, songPairingDetails.extraRecorded.join(", "))}
            </div>
          </div>
        )}
        <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{t.pairPreview}</div>
          {!songPairPreview.length && <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{t.noPairs}</div>}
          {songPairPreview.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              {songPairPreview.map((pair) => (
                <div key={pair.id} style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{pair.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>SRC: {pair.referenceName}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>REC: {pair.recordedName}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {!!songAnalysisFailedPairs.length && (
          <div style={{ padding: "10px 12px", border: "1px solid var(--warning, #e8a040)", borderRadius: 8, background: "var(--bg)" }}>
            <div style={{ fontSize: 11, color: "var(--warning, #e8a040)", marginBottom: 6, fontWeight: 600 }}>{t.analysisFailedTitle} ({songAnalysisFailedPairs.length})</div>
            <div style={{ display: "grid", gap: 6 }}>
              {songAnalysisFailedPairs.map((fp, idx) => (
                <div key={idx} style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{fp.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", wordBreak: "break-all" }}>{fp.error}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={sectionStyle()}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.eqTitle}</div>
        <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-dim)" }}>{t.eqDesc}</div>
        <input
          ref={eqBaseRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportEqBaseProfile(file);
            event.target.value = "";
          }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onUseProbeAsEqBase} disabled={!probeProfile} style={actionBtnStyle()}>{t.useProbeAsBase}</button>
          <button onClick={onUseSongAsEqBase} disabled={!songProfile} style={actionBtnStyle()}>{t.useSongAsBase}</button>
          <button onClick={() => eqBaseRef.current?.click()} style={actionBtnStyle()}>{t.importBaseProfile}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 8 }}>
          {statBox(t.eqBaseProfile, eqBaseProfileName || t.idle)}
        </div>
        <div>
          {fieldLabel(t.eqBandPreset)}
          <select
            value={selectedPreset}
            onChange={(event) => applyPreset(event.target.value)}
            style={{ ...inputStyle(), cursor: "pointer" }}
          >
            {EQ_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          {fieldLabel(t.customBands)}
          <textarea
            value={customBandsText}
            onChange={(event) => setCustomBandsText(event.target.value)}
            rows={3}
            style={{ ...inputStyle(), resize: "vertical" }}
            placeholder={t.customBandsHint}
          />
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{t.customBandsHint}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 8 }}>
          <div>
            {fieldLabel(t.gainStep)}
            <input value={gainStepDb} onChange={(event) => setGainStepDb(event.target.value)} style={inputStyle()} />
          </div>
          <div>
            {fieldLabel(t.minStep)}
            <input value={minStep} onChange={(event) => setMinStep(event.target.value)} style={inputStyle()} />
          </div>
          <div>
            {fieldLabel(t.maxStep)}
            <input value={maxStep} onChange={(event) => setMaxStep(event.target.value)} style={inputStyle()} />
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.eqAutoQHint}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => onBuildFixedEqModel({
              customBandsText,
              gainStepDb,
              minStep,
              maxStep,
            })}
            disabled={!eqBaseProfileName || processing}
            style={actionBtnStyle(true)}
          >
            {t.buildEqProfile}
          </button>
          <button onClick={onSaveEqReadyProfile} disabled={!eqReadyProfile} style={actionBtnStyle()}>{t.saveEqProfile}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 8 }}>
          {statBox(t.eqBaseProfile, eqBaseProfileName || t.idle)}
          {statBox(t.eqAdjustableProfile, eqReadyProfile?.name || t.idle)}
        </div>
      </div>

      <div style={sectionStyle()}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.compilerTitle}</div>
        <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-dim)" }}>{t.compilerDesc}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.targetMode}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => onSetCompilerTargetMode("profile")}
              style={actionBtnStyle(compilerTargetMode === "profile")}
            >
              {t.targetProfile}
            </button>
            <button
              onClick={() => onSetCompilerTargetMode("flat")}
              style={actionBtnStyle(compilerTargetMode === "flat")}
            >
              {t.targetFlat}
            </button>
          </div>
        </div>
        <input
          ref={compilerARef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportCompilerProfile("A", file);
            event.target.value = "";
          }}
        />
        <input
          ref={compilerBRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onImportCompilerProfile("B", file);
            event.target.value = "";
          }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => compilerARef.current?.click()} style={actionBtnStyle()}>{t.importAProfile}</button>
          <button onClick={onUseEqReadyAsCompilerA} disabled={!eqReadyProfile} style={actionBtnStyle()}>{t.useEqAsA}</button>
          {compilerTargetMode === "profile" && (
            <>
              <button onClick={() => compilerBRef.current?.click()} style={actionBtnStyle()}>{t.importBProfile}</button>
              <button onClick={onUseProbeAsCompilerB} disabled={!probeProfile} style={actionBtnStyle()}>{t.useProbeAsB}</button>
              <button onClick={onUseSongAsCompilerB} disabled={!songProfile} style={actionBtnStyle()}>{t.useSongAsB}</button>
            </>
          )}
          <button onClick={onCompileProfiles} disabled={compileActionDisabled} style={actionBtnStyle(true)}>
            {compilerTargetMode === "flat" ? t.compileNowFlat : t.compileNow}
          </button>
          <button onClick={onLoadCompileProfile} disabled={!compileResult?.ok} style={actionBtnStyle()}>{t.loadCompileProfile}</button>
          <button onClick={onExportCompileLoadProfile} disabled={!compileResult?.ok} style={actionBtnStyle()}>{t.exportLoadProfile}</button>
          <button onClick={onExportCompileText} disabled={!compileResult} style={actionBtnStyle()}>{t.exportText}</button>
          <button onClick={onExportCompileJson} disabled={!compileResult} style={actionBtnStyle()}>{t.exportJson}</button>
        </div>
        <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)" }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{t.fullResHint}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={onLoadFullResProfile}
              disabled={!compilerProfileAName || (compilerTargetMode === "profile" && !compilerProfileBName)}
              style={actionBtnStyle()}
            >{t.loadFullRes}</button>
            <button
              onClick={onExportFullResProfile}
              disabled={!compilerProfileAName || (compilerTargetMode === "profile" && !compilerProfileBName)}
              style={actionBtnStyle()}
            >{t.exportFullRes}</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 8 }}>
          {statBox(t.eqAdjustableProfile, compilerProfileAName || t.idle)}
          {statBox(t.targetMode, compilerTargetMode === "flat" ? t.targetFlat : t.targetProfile)}
          {statBox(t.profileB, compileTargetName)}
          {statBox(t.loadCompileProfile, compileLoadProfileName || t.idle)}
        </div>
        <div style={{ padding: "12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.compileResult}</div>
          {!compileResult && <div style={{ fontSize: 12 }}>{t.idle}</div>}
          {compileResult && !compileResult.ok && <div style={{ fontSize: 12, color: "var(--warning)" }}>{compileResult.message || compileResult.errorCode}</div>}
          {compileSummary && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 8 }}>
                {statBox(t.fitScore, compileSummary.fitScore)}
                {statBox(t.usableBand, compileSummary.usableBand)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.eqSteps}</div>
                <EqBars steps={compileSummary.eqSteps} />
                {!compileSummary.eqSteps.length && <div style={{ fontSize: 12 }}>{t.none}</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.eqVisualization}</div>
                <ChannelChartBlock title="L">
                  <CurveChart
                    frequencyGridHz={compileResult.frequencyGridHz}
                    targetDeltaDb={compileResult.targetDeltaDb?.L || []}
                    predictedEqDb={compileResult.predictedEqDb || []}
                    legendTarget={t.curveLegendTarget}
                    legendPredicted={t.curveLegendPredicted}
                  />
                </ChannelChartBlock>
                <ChannelChartBlock title="R">
                  <CurveChart
                    frequencyGridHz={compileResult.frequencyGridHz}
                    targetDeltaDb={compileResult.targetDeltaDb?.R || []}
                    predictedEqDb={compileResult.predictedEqDb || []}
                    legendTarget={t.curveLegendTarget}
                    legendPredicted={t.curveLegendPredicted}
                  />
                </ChannelChartBlock>
              </div>
              {!!compileResult.targetResponseDb?.L?.length && !!compileResult.correctedResponseDb?.L?.length && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.correctedVisualization}</div>
                  <ChannelChartBlock title="L">
                    <CurveChart
                      frequencyGridHz={compileResult.frequencyGridHz}
                      targetDeltaDb={compileResult.targetResponseDb?.L || []}
                      predictedEqDb={compileResult.correctedResponseDb?.L || []}
                      legendTarget={t.curveLegendTargetResponse}
                      legendPredicted={t.curveLegendCorrected}
                    />
                  </ChannelChartBlock>
                  <ChannelChartBlock title="R">
                    <CurveChart
                      frequencyGridHz={compileResult.frequencyGridHz}
                      targetDeltaDb={compileResult.targetResponseDb?.R || []}
                      predictedEqDb={compileResult.correctedResponseDb?.R || []}
                      legendTarget={t.curveLegendTargetResponse}
                      legendPredicted={t.curveLegendCorrected}
                    />
                  </ChannelChartBlock>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export const PLAYER_PROFILE_WORKBENCH_PLUGIN = {
  id: PLAYER_PROFILE_WORKBENCH_PLUGIN_ID,
  titleKey: null,
  descKey: null,
  title: {
    "zh-CN": "播放器听感测量 & EQ 匹配",
    ja: "プレイヤー周波数応答 & EQ マッチング",
    en: "Player Profiles and A->B EQ",
  },
  desc: {
    "zh-CN": "测量播放器频响，让声音趋向平直或模仿另一台设备",
    ja: "プレイヤーの周波数応答を測定し、A の音を B に近づけます",
    en: "Generate profiles, attach EQ models, and compile A->B EQ",
  },
  Component: PlayerProfileWorkbenchPlugin,
};
