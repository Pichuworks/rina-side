import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { transcodeToWav, likelyNeedsTranscode } from "./ffmpeg-helper.js";
import { IconAdd, IconAutoAwesome, IconFileOpen, IconSave, IconPlay, IconStop, IconExport, IconHelp, IconClearSide, IconClearAll, IconPalette, IconInfo, IconTool } from "./Icons.jsx";
import Player from "./Player.jsx";
import SideWaveform from "./SideWaveform.jsx";
import SideSpectrogram from "./SideSpectrogram.jsx";

// ═══════════════════════════════════════════════════════════════
// SIDE — Sequential Interleaved Dubbing Engine
// 阿佐谷202室 磁带転写ツール
// Ver 0.9 Release Candidate II
// by 天使天才天王寺璃奈 (Angel, Genius, Tennoji Rina)
// ═══════════════════════════════════════════════════════════════

const APP_VERSION = "0.9 Release Candidate II";
const APP_GITHUB = "https://github.com/Pichuworks/rina-side";

// ── i18n ─────────────────────────────────────────────────────
const LANGS = { "zh-CN": { label: "简体中文" }, ja: { label: "日本語" }, en: { label: "EN" } };

const I18N = {
  appTitle: { "zh-CN": "SIDE — 磁带转录引擎", ja: "SIDE — 磁帯転写エンジン", en: "SIDE — Cassette Dubbing Engine" },
  appSubtitle: { "zh-CN": "阿佐谷202室 · 磁带转录工具", ja: "阿佐ヶ谷202号室 · 磁帯転写ツール", en: "Asagaya Room 202 · Cassette Transcription Tool" },
  appVersion: { "zh-CN": `Ver ${APP_VERSION} · by 天使天才天王寺璃奈`, ja: `Ver ${APP_VERSION} · by 天使天才天王寺璃奈`, en: `Ver ${APP_VERSION} · by Angel, Genius, Tennoji Rina` },
  tapeSpec: { "zh-CN": "磁带规格", ja: "テープ規格", en: "Tape Format" },
  tapeCustom: { "zh-CN": "自定义", ja: "カスタム", en: "Custom" },
  minPerSide: { "zh-CN": "分钟/面", ja: "min/面", en: "min/side" },
  tapeType: { "zh-CN": "磁带类型", ja: "テープ種類", en: "Tape Type" },
  recLevel: { "zh-CN": "录音电平", ja: "録音レベル", en: "Rec Level" },
  defaultGap: { "zh-CN": "默认曲间间隔", ja: "デフォルト曲間", en: "Default Track Gap" },
  normalize: { "zh-CN": "响度归一化", ja: "ラウドネス正規化", en: "Loudness Normalization" },
  normPeak: { "zh-CN": "峰值", ja: "ピーク", en: "Peak" },
  normRms: { "zh-CN": "均方根", ja: "RMS", en: "RMS" },
  normOff: { "zh-CN": "关闭", ja: "OFF", en: "OFF" },
  tailFill: { "zh-CN": "尾部静音填充", ja: "末尾無音パディング", en: "Tail Silence Padding" },
  tailMargin: { "zh-CN": "尾部预留余量", ja: "末尾マージン", en: "Tail Margin Reserve" },
  smartGap: { "zh-CN": "智能间隔检测", ja: "スマートギャップ検出", en: "Smart Gap Detection" },
  smartGapDesc: { "zh-CN": "分析音轨首尾静音，自动计算最优间隔", ja: "トラック先頭/末尾の無音を解析し最適ギャップを自動算出", en: "Analyze head/tail silence of tracks to compute optimal gaps" },
  addFiles: { "zh-CN": "添加文件", ja: "ファイル追加", en: "Add Files" },
  autoDistribute: { "zh-CN": "自动分面", ja: "自動振り分け", en: "Auto Distribute" },
  exportSide: { "zh-CN": "导出", ja: "書出し", en: "Export" },
  importPlaylist: { "zh-CN": "导入歌单", ja: "プレイリスト読込", en: "Import Playlist" },
  exportPlaylist: { "zh-CN": "导出歌单", ja: "プレイリスト保存", en: "Export Playlist" },
  dropHere: { "zh-CN": "将音频文件拖放至此处", ja: "ここにオーディオファイルをドロップ", en: "Drop audio files here" },
  dropHint: { "zh-CN": "或点击上方按钮选择文件", ja: "または上のボタンでファイルを選択", en: "or use the button above to browse" },
  tracks: { "zh-CN": "曲", ja: "曲", en: " tracks" },
  exceeded: { "zh-CN": "超出", ja: "超過", en: "over" },
  remaining: { "zh-CN": "剩余", ja: "残り", en: "left" },
  moveUp: { "zh-CN": "上移", ja: "上へ", en: "Move up" },
  moveDown: { "zh-CN": "下移", ja: "下へ", en: "Move down" },
  moveToSide: { "zh-CN": "移至 SIDE", ja: "SIDE へ移動", en: "Move to SIDE" },
  deleteTrack: { "zh-CN": "删除音轨", ja: "トラック削除", en: "Delete track" },
  gap: { "zh-CN": "间隔", ja: "ギャップ", en: "gap" },
  resetGap: { "zh-CN": "重置", ja: "リセット", en: "reset" },
  tipSampleRate: { "zh-CN": "采样率", ja: "サンプルレート", en: "Sample rate" },
  tipBitDepth: { "zh-CN": "位深", ja: "ビット深度", en: "Bit depth" },
  tipChannels: { "zh-CN": "声道数", ja: "チャンネル数", en: "Channels" },
  tipPeakLevel: { "zh-CN": "峰值电平", ja: "ピークレベル", en: "Peak level" },
  tipHeadSilence: { "zh-CN": "音轨头部静音", ja: "トラック先頭の無音", en: "Head silence" },
  tipTailSilence: { "zh-CN": "音轨尾部静音", ja: "トラック末尾の無音", en: "Tail silence" },
  tapeTypeNote: { "zh-CN": "影响归一化目标电平", ja: "正規化ターゲットレベルに影響", en: "Affects normalization target level" },
  appTagline: { "zh-CN": "……把声音编译进磁带里。", ja: "……音をテープにコンパイルする。", en: "…compile your sound into tape." },
  decoding: { "zh-CN": "解码中", ja: "デコード中", en: "Decoding" },
  rendering: { "zh-CN": "离线渲染中", ja: "オフラインレンダリング中", en: "Offline rendering" },
  encoding: { "zh-CN": "WAV 编码中", ja: "WAVエンコード中", en: "Encoding WAV" },
  total: { "zh-CN": "共计", ja: "計", en: "Total" },
  tape: { "zh-CN": "磁带", ja: "テープ", en: "Tape" },
  type: { "zh-CN": "类型", ja: "種類", en: "Type" },
  playlistExported: { "zh-CN": "歌单已导出", ja: "プレイリストを保存しました", en: "Playlist exported" },
  playlistImportNoAudio: { "zh-CN": "歌单已加载（含占位曲目）。请重新添加对应音频文件，系统会自动按文件名匹配。", ja: "プレイリストを読み込みました（プレースホルダあり）。対応するオーディオファイルを再追加してください。", en: "Playlist loaded (with placeholders). Re-add audio files — they will auto-match by filename." },
  stubsHydrated: { "zh-CN": "个 stub 音轨已匹配到音频文件", ja: "個のstubトラックにオーディオを紐付けました", en: "stub track(s) matched to audio" },
  exportHasStubs: { "zh-CN": "当前面包含未匹配音频的 stub 音轨，导出时将跳过这些音轨。确定继续？", ja: "この面には未マッチングのstubトラックがあります。書出し時にスキップされます。続行しますか？", en: "This side contains stub tracks without audio. They will be skipped during export. Continue?" },
  sampleRate: { "zh-CN": "采样率", ja: "サンプルレート", en: "Sample Rate" },
  bitDepth: { "zh-CN": "位深", ja: "ビット深度", en: "Bit Depth" },
  play: { "zh-CN": "试听", ja: "試聴", en: "Preview" },
  stop: { "zh-CN": "停止", ja: "停止", en: "Stop" },
  pause: { "zh-CN": "暂停", ja: "一時停止", en: "Pause" },
  resume: { "zh-CN": "继续", ja: "再開", en: "Resume" },
  nowPlaying: { "zh-CN": "正在播放", ja: "再生中", en: "Now playing" },
  previewWave: { "zh-CN": "波形", ja: "波形", en: "Wave" },
  previewSpectrogram: { "zh-CN": "声谱图", ja: "スペクトログラム", en: "Spectrogram" },
  stubLabel: { "zh-CN": "占位曲目", ja: "プレースホルダ", en: "placeholder" },
  clearSide: { "zh-CN": "清空当前面", ja: "この面をクリア", en: "Clear this side" },
  clearAll: { "zh-CN": "清空全部", ja: "全てクリア", en: "Clear all" },
  resampleWarn: { "zh-CN": "以下音轨将被降采样", ja: "以下のトラックはダウンサンプリングされます", en: "The following tracks will be downsampled" },
  bitDepthWarn: { "zh-CN": "以下音轨将发生位深转换", ja: "以下のトラックはビット深度変換されます", en: "The following tracks will change bit depth" },
  prevTrack: { "zh-CN": "上一曲", ja: "前の曲", en: "Previous" },
  nextTrack: { "zh-CN": "下一曲", ja: "次の曲", en: "Next" },
  playlistImportError: { "zh-CN": "歌单文件解析失败", ja: "プレイリスト解析エラー", en: "Failed to parse playlist" },
  effectiveCapacity: { "zh-CN": "有效容量", ja: "実効容量", en: "Effective capacity" },
  help: { "zh-CN": "帮助", ja: "ヘルプ", en: "Help" },
  tools: { "zh-CN": "工具", ja: "ツール", en: "Tools" },
  theme: { "zh-CN": "主题配色", ja: "テーマ配色", en: "Theme" },
  about: { "zh-CN": "关于", ja: "About", en: "About" },
  toolDescTitle: { "zh-CN": "工具说明", ja: "ツール説明", en: "Tool Description" },
  toolRecCal: { "zh-CN": "录制校准", ja: "録音キャリブレーション", en: "Recording Calibration" },
  toolRecCalCardDesc: { "zh-CN": "录音电平与高频校准", ja: "録音レベルと高域校正", en: "Rec level and HF calibration" },
  toolRecCalDesc: {
    "zh-CN": "同一时刻只输出一个校准信号。每种信号都对应一个明确的频率和电平规则，输出统一为双声道同相信号。",
    ja: "同時に出力する校正信号は 1 つだけです。各信号には明確な周波数とレベル規則があり、出力は常にデュアルモノです。",
    en: "Only one calibration signal can be output at a time. Each signal has a specific frequency and level rule, and output is always dual mono.",
  },
  toolSelectedSide: { "zh-CN": "校准 SIDE", ja: "校正 SIDE", en: "Calibration Side" },
  toolSignalPick: { "zh-CN": "校准信号", ja: "校正信号", en: "Calibration Signal" },
  toolSignalFreq: { "zh-CN": "输出信号", ja: "出力信号", en: "Output Signal" },
  toolSignalLevel: { "zh-CN": "输出电平", ja: "出力レベル", en: "Output Level" },
  toolSignalSource: { "zh-CN": "电平依据", ja: "レベル根拠", en: "Level Source" },
  toolStereoMode: { "zh-CN": "声道方式", ja: "チャンネル方式", en: "Channel Mode" },
  toolStereoDualMono: { "zh-CN": "双声道同相（dual mono）", ja: "デュアルモノ", en: "Dual mono" },
  toolSignalRecBalance: { "zh-CN": "REC LEVEL / BALANCE", ja: "REC LEVEL / BALANCE", en: "REC LEVEL / BALANCE" },
  toolSignalRecBalanceDesc: {
    "zh-CN": "1kHz 中频参考音。REC LEVEL 用它对准最终节目峰值；BALANCE 也用同一个信号，因为左右输入必须完全一致。",
    ja: "1kHz の中域基準音です。REC LEVEL は最終プログラムピーク基準、BALANCE も同一入力が必要なので同じ信号を使います。",
    en: "A 1 kHz mid-band reference. REC LEVEL uses it against the final program peak, and BALANCE uses the same signal because L/R input must remain identical.",
  },
  toolSignalCal: { "zh-CN": "CAL", ja: "CAL", en: "CAL" },
  toolSignalCalDesc: {
    "zh-CN": "1kHz 固定参考音。它不跟节目走，只跟当前磁带类型的目标录音电平走。",
    ja: "1kHz の固定基準音です。プログラムには追従せず、現在のテープ種別の録音目標レベルだけを使います。",
    en: "A fixed 1 kHz reference tone. It does not follow program material, only the current tape type's recording target.",
  },
  toolSignalBias: { "zh-CN": "BIAS / REC EQ", ja: "BIAS / REC EQ", en: "BIAS / REC EQ" },
  toolSignalBiasDesc: {
    "zh-CN": "10kHz 高频测试音，电平比当前目标录音电平低 20dB。这个信号同时覆盖 BIAS 和 REC EQ 的观察场景。",
    ja: "10kHz の高域テストトーンで、現在の録音目標レベルより 20dB 低く設定します。BIAS と REC EQ の確認を同じ信号で兼用します。",
    en: "A 10 kHz high-frequency tone set 20 dB below the current recording target. The same signal is shared for both bias and REC EQ checks.",
  },
  toolSignalRecEq: { "zh-CN": "REC EQ", ja: "REC EQ", en: "REC EQ" },
  toolSignalRecEqDesc: {
    "zh-CN": "10kHz 高频测试音，电平同样比当前目标录音电平低 20dB，用于观察录音端高频响应。",
    ja: "10kHz の高域テストトーンで、同じく現在の録音目標レベルより 20dB 低く、録音側の高域応答を確認します。",
    en: "A 10 kHz high-frequency tone, also 20 dB below the current recording target, used to inspect recording HF response.",
  },
  toolProgramPeakSource: { "zh-CN": "所选 SIDE 的最终节目峰值", ja: "選択 SIDE の最終プログラムピーク", en: "Selected side's final program peak" },
  toolTapeTargetSource: { "zh-CN": "当前磁带类型的目标录音电平", ja: "現在のテープ種別の録音目標レベル", en: "Current tape type recording target" },
  toolHighFreqSource: {
    "zh-CN": "当前磁带类型目标录音电平下移 20dB 的高频测试电平",
    ja: "現在のテープ種別の録音目標レベルから 20dB 下げた高域テストレベル",
    en: "High-frequency test level set 20 dB below the current tape type recording target",
  },
  toolStart: { "zh-CN": "开始输出", ja: "出力開始", en: "Start Output" },
  toolStop: { "zh-CN": "停止输出", ja: "出力停止", en: "Stop Output" },
  ctlSim: { "zh-CN": "模拟", ja: "モデリング", en: "Simulation" },
  ctlDeck: { "zh-CN": "卡座", ja: "デッキ", en: "Deck" },
  ctlTone: { "zh-CN": "音色", ja: "音色", en: "Tone" },
  ctlTube: { "zh-CN": "管级", ja: "真空管", en: "Tube" },
  ctlVinylEra: { "zh-CN": "年代", ja: "年代", en: "Era" },
  ctlCrackle: { "zh-CN": "爆豆", ja: "ポップ", en: "Crackle" },
  // ── 介质模拟 short labels ──────────────────────────────────
  simStateOffShort: { "zh-CN": "关闭", ja: "OFF", en: "OFF" },
  simStateTapeIShort: { "zh-CN": "一类带", ja: "TYPE I", en: "Type I" },
  simStateTapeIIShort: { "zh-CN": "二类带", ja: "TYPE II", en: "Type II" },
  simStateTapeIVShort: { "zh-CN": "四类带", ja: "TYPE IV", en: "Type IV" },
  simStateVinylShort: { "zh-CN": "黑胶", ja: "VINYL", en: "Vinyl" },
  // ── 介质模拟 tooltips ─────────────────────────────────────
  simStateOffTip: {
    "zh-CN": "关闭介质模拟，输出干净的数字信号。",
    ja: "媒体シミュレーションを無効にします。クリーンなデジタル出力になります。",
    en: "No medium simulation. Output is clean digital.",
  },
  simStateTapeITip: {
    "zh-CN": "模拟 Type I 普通偏磁磁带的频响特性——高频自然滚降、轻微饱和感。",
    ja: "Type I ノーマルバイアスの周波数特性を再現します。高域の自然なロールオフと軽い飽和感。",
    en: "Simulates Type I normal-bias tape — gentle high-frequency roll-off and light saturation.",
  },
  simStateTapeIITip: {
    "zh-CN": "模拟 Type II 铬带的频响特性——高频延伸更好，噪底更低，质感更亮。",
    ja: "Type II クロームバイアスの特性。高域の伸びが良く、ノイズフロアが低め。",
    en: "Simulates Type II chrome-bias tape — extended highs, lower noise floor, slightly brighter character.",
  },
  simStateTapeIVTip: {
    "zh-CN": "模拟 Type IV 金属带的频响特性——动态更宽，高频清晰度最佳，录音电平更高。",
    ja: "Type IV メタルテープの特性。ダイナミクスが広く、高域の鮮明さと高い録音レベルが特徴。",
    en: "Simulates Type IV metal tape — widest dynamic range, clearest highs, highest recording level.",
  },
  simStateVinylTip: {
    "zh-CN": "模拟黑胶唱片的回放特性——RIAA 均衡曲线、内圈失真与轻微的机械质感。",
    ja: "レコード再生の特性を再現。RIAA EQ カーブ、内周歪み、軽微な機械感。",
    en: "Simulates vinyl playback — RIAA EQ curve, inner-groove distortion, and subtle mechanical character.",
  },
  // ── 卡座 short labels ──────────────────────────────────────
  deckStateOffShort: { "zh-CN": "关闭", ja: "OFF", en: "OFF" },
  deckStatePortableShort: { "zh-CN": "随身", ja: "携帯", en: "PORT" },
  deckState2HeadShort: { "zh-CN": "2磁头", ja: "2ヘッド", en: "2HD" },
  deckState3HeadShort: { "zh-CN": "3磁头", ja: "3ヘッド", en: "3HD" },
  // ── 卡座 tooltips ──────────────────────────────────────────
  deckStateOffTip: {
    "zh-CN": "关闭卡座模拟，不附加 transport 特性。",
    ja: "デッキシミュレーションを無効にします。",
    en: "No deck simulation applied.",
  },
  deckStatePortableTip: {
    "zh-CN": "随身听级别的 transport——轻微的速度波动（wow/flutter）、较窄的频率响应和左右串音。",
    ja: "ポータブルプレイヤー相当の transport。速度変動（wow/flutter）、帯域の狭さ、チャンネル間クロストークが出ます。",
    en: "Portable player transport — subtle wow/flutter, narrower bandwidth, and channel crosstalk.",
  },
  deckState2HeadTip: {
    "zh-CN": "高端二磁头卡座的 transport——速度稳定性好，频率响应宽，整体更干净。",
    ja: "高級 2 ヘッドデッキの transport。速度安定性が高く、帯域が広い。",
    en: "High-end 2-head deck transport — stable speed, wide bandwidth, cleaner overall.",
  },
  deckState3HeadTip: {
    "zh-CN": "高端三磁头卡座的 transport——最佳速度稳定性与分离度，接近开盘机的精度。",
    ja: "高級 3 ヘッドデッキの transport。最高の速度安定性とチャンネルセパレーション。オープンリールに近い精度。",
    en: "High-end 3-head deck transport — best speed stability and separation, approaching open-reel precision.",
  },
  // ── 音色 short labels ──────────────────────────────────────
  toneStateDefaultShort: { "zh-CN": "中性", ja: "中立", en: "Neutral" },
  toneStateCoolShort: { "zh-CN": "冷色", ja: "クール", en: "Cool" },
  toneStateWarmShort: { "zh-CN": "暖色", ja: "ウォーム", en: "Warm" },
  // ── 音色 tooltips ──────────────────────────────────────────
  toneStateDefaultTip: {
    "zh-CN": "中性频谱，不对高低频做额外的倾向性处理。",
    ja: "中立的な周波数特性。高域・低域への追加の色付けはありません。",
    en: "Neutral frequency response. No additional spectral coloring.",
  },
  toneStateCoolTip: {
    "zh-CN": "偏冷——高频稍亮，低中频收紧，整体通透感更强。",
    ja: "クール寄り。高域が少し開き、低中域が引き締まります。",
    en: "Cool tilt — slightly brighter highs, tighter low-mids, more open overall.",
  },
  toneStateWarmTip: {
    "zh-CN": "偏暖——低中频更厚实，高频收敛，听感更柔和沉稳。",
    ja: "ウォーム寄り。低中域が厚くなり、高域がなだらかになります。",
    en: "Warm tilt — fuller low-mids, softer highs, rounder and more settled sound.",
  },
  // ── 电子管 short labels ────────────────────────────────────
  tubeStateOffShort: { "zh-CN": "关闭", ja: "OFF", en: "OFF" },
  tubeStateOnShort: { "zh-CN": "电子管", ja: "真空管", en: "Tube" },
  // ── 电子管 tooltips ────────────────────────────────────────
  tubeStateOffTip: {
    "zh-CN": "关闭电子管前级模拟。",
    ja: "真空管プリアンプのシミュレーションを無効にします。",
    en: "No tube preamp stage applied.",
  },
  tubeStateOnTip: {
    "zh-CN": "加入轻微的电子管饱和——极轻的谐波着色与高频圆润感，是那种听不出来但去掉就会少点什么的效果。",
    ja: "軽微な真空管飽和を加えます。わずかな倍音の色付けと高域の丸み。消すとなぜか物足りなくなる、あの感じ。",
    en: "Adds subtle tube saturation — light harmonic coloring and high-frequency rounding. You might not notice it, but you'd miss it if it were gone.",
  },
  // ── 黑胶年代 short labels ──────────────────────────────────
  vinylEraModernShort: { "zh-CN": "现代", ja: "現代", en: "Modern" },
  vinylEraClassicShort: { "zh-CN": "经典", ja: "定番", en: "Classic" },
  vinylEraVintageShort: { "zh-CN": "复古", ja: "旧式", en: "Vintage" },
  vinylEraEffectShort: { "zh-CN": "效果", ja: "効果", en: "Effect" },
  // ── 黑胶年代 tooltips ──────────────────────────────────────
  vinylEraModernTip: {
    "zh-CN": "现代黑胶：宽频响、低噪底，内圈失真轻微，听感干净。",
    ja: "現代盤の再生特性。広い帯域、低ノイズ、内周歪みは控えめ。",
    en: "Modern vinyl — wide bandwidth, low noise, minimal inner-groove distortion.",
  },
  vinylEraClassicTip: {
    "zh-CN": "经典黑胶：适度的高频滚降与唱片磨损感，是大多数人印象里的黑胶声。",
    ja: "定番のレコード再生。適度な高域減衰と盤面の経年感。多くの人が思い浮かべるレコードサウンド。",
    en: "Classic vinyl — moderate high-frequency roll-off and record wear. The sound most people picture when they think 'vinyl'.",
  },
  vinylEraVintageTip: {
    "zh-CN": "复古黑胶：更早的高频衰减、更明显的磨损颗粒感、更窄的立体声分离度。",
    ja: "古いレコードの再生特性。高域の早い減衰、強めの経年劣化感、狭いステレオ分離。",
    en: "Vintage vinyl — earlier high-frequency roll-off, stronger surface wear character, narrower stereo separation.",
  },
  vinylEraEffectTip: {
    "zh-CN": "重度效果档：夸张的带宽限制、磨损噪声与机械伪声，适合刻意追求老旧质感的场合。",
    ja: "エフェクト用途の強め設定。帯域制限・磨耗ノイズ・機械的なアーティファクトが強調されます。意図的なレトロ感が欲しいときに。",
    en: "Heavy effect mode — exaggerated bandwidth loss, surface noise, and mechanical artifacts. For when you want it to sound deliberately old.",
  },
  // ── 爆豆 short labels ──────────────────────────────────────
  crackleStateOffShort: { "zh-CN": "爆豆关", ja: "POP OFF", en: "CRK OFF" },
  crackleStateLowShort: { "zh-CN": "爆豆低", ja: "POP LOW", en: "CRK LOW" },
  crackleStateMidShort: { "zh-CN": "爆豆中", ja: "POP MID", en: "CRK MID" },
  crackleStateHighShort: { "zh-CN": "爆豆高", ja: "POP HI", en: "CRK HI" },
  // ── 爆豆 tooltips ──────────────────────────────────────────
  crackleStateOffTip: {
    "zh-CN": "关闭 click/pop 噪声层。",
    ja: "クリック/ポップノイズ層を無効にします。",
    en: "No click/pop noise layer.",
  },
  crackleStateLowTip: {
    "zh-CN": "低密度的唱针爆豆声——偶尔的轻微 click，听起来像保养良好的老唱片。",
    ja: "低密度のスクラッチ/クリックノイズ。たまに軽いクリックが入る程度。手入れされた古盤の雰囲気。",
    en: "Low-density crackle — occasional light clicks, like a well-kept old record.",
  },
  crackleStateMidTip: {
    "zh-CN": "中等密度的爆豆声——明显但不刺耳，日常播放老唱片的质感。",
    ja: "中密度のスクラッチ/クリック。気にはなるが耳障りではない、普段使いの古盤感。",
    en: "Medium-density crackle — present but not distracting. Sounds like an everyday old record.",
  },
  crackleStateHighTip: {
    "zh-CN": "高密度的爆豆声——持续的噪声与 pop，像一张从二手店买来、没有好好保管过的黑胶。",
    ja: "高密度のスクラッチ/クリック。持続的なノイズとポップ音。中古店で状態の悪い盤を買ってきたような感じ。",
    en: "High-density crackle — continuous noise and pops, like a second-hand record that's had a rough life.",
  },
};

function t(key, lang) { const e = I18N[key]; return e ? (e[lang] || e["zh-CN"] || key) : key; }
function themeName(key, lang) {
  const names = THEME_NAMES[key];
  return names ? (names[lang] || names["zh-CN"] || key) : key;
}
const RINA_SMILE = "[^_^]";

// ── Constants ────────────────────────────────────────────────
// ── Character Themes ────────────────────────────────────────
const THEMES = {
  default: { accent: "#D4859A", bg: "#E8ECF2", bgCard: "#F4F6FA", bgDeep: "#DCE2EA", border: "#C8CED8", accentDim: "#F2D6DE", group: "" },
  keke: { accent: "#49BDF0", bg: "#F2F7FA", bgCard: "#FAFCFF", bgDeep: "#E4EEF5", border: "#C8D8E4", accentDim: "#CCE8FA", group: "liella" },
  omgkawaiiangel: { accent: "#8FDDF7", bg: "#FAF7FD", bgCard: "#FFFDFF", bgDeep: "#EEE9F6", border: "#DDD4E8", accentDim: "#EAF8FE", sideA: "#8FDDF7", sideB: "#F2A8E2", accentInk: "#557A95", warning: "#F0A4D2", group: "ngo" },
  amechan: { accent: "#B54857", bg: "#F4F1F3", bgCard: "#FBFAFB", bgDeep: "#E8E2E6", border: "#D4CBD1", accentDim: "#F0D8DD", sideA: "#B54857", sideB: "#70758F", accentInk: "#883030", warning: "#B29663", group: "ngo" },
  tomori: { accent: "#77BBDD", bg: "#F2F6F9", bgCard: "#FAFCFF", bgDeep: "#E4EDF4", border: "#C8D5DF", accentDim: "#D0E5F3", group: "mygo" },
  raana: { accent: "#77DD77", bg: "#F2F8F2", bgCard: "#FAFFFA", bgDeep: "#E2EEE2", border: "#C5D8C5", accentDim: "#C8F0C8", group: "mygo" },
  soyo: { accent: "#FFDD88", bg: "#FAF8F2", bgCard: "#FFFEF8", bgDeep: "#F2EEDD", border: "#DDD8C8", accentDim: "#F5EDC8", group: "mygo" },
  anon: { accent: "#FF8899", bg: "#FAF3F4", bgCard: "#FFFAFB", bgDeep: "#F2E6E8", border: "#E0D0D4", accentDim: "#FFD8DF", group: "mygo" },
  taki: { accent: "#7777AA", bg: "#F4F3F8", bgCard: "#FBFAFF", bgDeep: "#E6E3F0", border: "#D0CDD9", accentDim: "#D4D0E8", group: "mygo" },
  sakiko: { accent: "#7799CC", bg: "#F2F5F9", bgCard: "#FAFBFF", bgDeep: "#E4ECF4", border: "#C8D2DF", accentDim: "#CCDCF0", group: "mujica" },
  mutsumi: { accent: "#779977", bg: "#F3F7F3", bgCard: "#FAFFF9", bgDeep: "#E4EDE3", border: "#C8D5C6", accentDim: "#CCE0CC", group: "mujica" },
  nyamu: { accent: "#AA4477", bg: "#F8F2F5", bgCard: "#FFFAFC", bgDeep: "#F0E4EA", border: "#DDD0D6", accentDim: "#E8C4D6", group: "mujica" },
  hatsuka: { accent: "#BB9955", bg: "#F8F6F0", bgCard: "#FFFDF8", bgDeep: "#EFEBDF", border: "#D8D2C2", accentDim: "#E8DCC0", group: "mujica" },
  uika: { accent: "#335566", bg: "#F0F4F6", bgCard: "#F8FBFC", bgDeep: "#E0E8EC", border: "#C4D0D6", accentDim: "#BCCDD8", group: "mujica" },
  mana: { accent: "#E8A68F", bg: "#FBF6F2", bgCard: "#FFFDFC", bgDeep: "#F2E8E1", border: "#E3D3C8", accentDim: "#F7DDD0", sideA: "#E8A68F", sideB: "#C7B48C", accentInk: "#9A5E4C", warning: "#D9B15E", group: "sumimi" },
  nozomu: { accent: "#D4600A", bg: "#F8F4EE", bgCard: "#FFFBF7", bgDeep: "#EDE5D8", border: "#D8CCBC", accentDim: "#F2DCC0", sideA: "#D4600A", sideB: "#6A7A8F", accentInk: "#8A3A08", warning: "#B89040", group: "crisiris" },
  eri: { accent: "#800020", bg: "#F6EFF1", bgCard: "#FFFDFB", bgDeep: "#ECDDE2", bgHover: "#F3E6EA", border: "#D6BEC6", accentDim: "#E8CDD5", sideA: "#800020", sideB: "#D9A11E", accentInk: "#5E1021", accentContrast: "#F7E8C1", warning: "#B06A1F", text: "#34292C", textDim: "#75656A", group: "crisiris" },
};  

const THEME_ORDER = [
  "default",
  "keke",
  "omgkawaiiangel", "amechan",
  "tomori", "raana", "soyo", "anon", "taki",
  "sakiko", "mutsumi", "nyamu", "hatsuka", "uika",
  "mana",
  "nozomu", "eri",
];

const THEME_NAMES = {
  default: { "zh-CN": "天王寺璃奈", ja: "天王寺 璃奈", en: "Rina Tennoji" },
  keke: { "zh-CN": "唐可可", ja: "唐 可可", en: "Keke Tang" },
  omgkawaiiangel: { "zh-CN": "超绝最可爱天使酱", ja: "超絶最かわてんしちゃん", en: "OMGkawaiiAngel" },
  amechan: { "zh-CN": "糖糖", ja: "あめちゃん", en: "Ame-chan" },
  tomori: { "zh-CN": "高松灯", ja: "高松 燈", en: "Tomori Takamatsu" },
  raana: { "zh-CN": "要乐奈", ja: "要 楽奈", en: "Rana Kaname" },
  soyo: { "zh-CN": "长崎爽世", ja: "長崎 そよ", en: "Soyo Nagasaki" },
  anon: { "zh-CN": "千早爱音", ja: "千早 愛音", en: "Anon Chihaya" },
  taki: { "zh-CN": "椎名立希", ja: "椎名 立希", en: "Taki Shiina" },
  sakiko: { "zh-CN": "丰川祥子", ja: "豊川 祥子", en: "Sakiko Togawa" },
  mutsumi: { "zh-CN": "若叶睦", ja: "若葉 睦", en: "Mutsumi Wakaba" },
  nyamu: { "zh-CN": "祐天寺若麦", ja: "祐天寺 にゃむ", en: "Nyamu Yutenji" },
  hatsuka: { "zh-CN": "三角初华", ja: "三角 初華", en: "Uika Misumi" },
  uika: { "zh-CN": "八幡海铃", ja: "八幡 海鈴", en: "Umiri Yahata" },
  mana: { "zh-CN": "纯田真奈", ja: "純田 まな", en: "Mana Sumita" },
  nozomu: { "zh-CN": "星街望", ja: "星街 望", en: "Nozomu Hoshimachi" },
  eri: { "zh-CN": "高桥绘理", ja: "高橋 絵理", en: "Eri Takahashi" },
};

// Derive SIDE A/B colors from accent: A = accent, B = accent hue-rotated ~150° + desaturated
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6; else if (mx === g) h = ((b - r) / d + 2) / 6; else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}
function mixHex(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const mix = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`;
}
function getContrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 170 ? "#2D2D38" : "#FFFFFF";
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100; const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))); };
  return `#${[f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}
function deriveSideColors(accent) {
  const [h, s, l] = hexToHsl(accent);
  return { sideA: accent, sideB: hslToHex((h + 150) % 360, Math.max(s * 0.6, 20), Math.min(Math.max(l, 40), 60)) };
}
function deriveAccentInk(accent) {
  return mixHex(accent, "#1F2430", 0.6);
}
function deriveWarningColor(accent) {
  const warmed = mixHex(accent, "#C97A5A", 0.62);
  const [h, s, l] = hexToHsl(warmed);
  return hslToHex(h, Math.max(42, s * 0.88), Math.min(Math.max(l, 50), 60));
}
function deriveTapeTypeColors(accent) {
  return {
    TYPE_I: mixHex("#8F5A33", accent, 0.28),
    TYPE_II: mixHex("#3A9FB3", accent, 0.22),
    TYPE_IV: mixHex("#585E74", accent, 0.34),
  };
}

const TAPE_PRESETS = {
  C46: { label: "C-46", sideMinutes: 23 }, C60: { label: "C-60", sideMinutes: 30 },
  C90: { label: "C-90", sideMinutes: 45 }, C120: { label: "C-120", sideMinutes: 60 },
};
const TAPE_TYPES = {
  TYPE_I: { label: "Type I (Normal)", peakDb: -3, desc: "TDK D, Maxell UR" },
  TYPE_II: { label: "Type II (Chrome)", peakDb: -1, desc: "TDK SA, Maxell XLII" },
  TYPE_IV: { label: "Type IV (Metal)", peakDb: 0, desc: "TDK MA, Maxell MX" },
};
const TAPE_SIM_PROFILES = {
  TAPE_I: {
    drive: 1.55,
    headBumpHz: 105,
    headBumpDb: 1.6,
    preEmphasisHz: 3400,
    preEmphasisDb: 1.8,
    deEmphasisHz: 5600,
    deEmphasisDb: -3.1,
    bandwidthHz: 12500,
    compThreshold: -16,
    compRatio: 1.45,
    hissLevel: 0.007,
  },
  TAPE_II: {
    drive: 1.38,
    headBumpHz: 100,
    headBumpDb: 1.15,
    preEmphasisHz: 3800,
    preEmphasisDb: 1.15,
    deEmphasisHz: 6200,
    deEmphasisDb: -2.2,
    bandwidthHz: 14500,
    compThreshold: -15,
    compRatio: 1.32,
    hissLevel: 0.0045,
  },
  TAPE_IV: {
    drive: 1.24,
    headBumpHz: 95,
    headBumpDb: 0.75,
    preEmphasisHz: 4200,
    preEmphasisDb: 0.7,
    deEmphasisHz: 7000,
    deEmphasisDb: -1.4,
    bandwidthHz: 17500,
    compThreshold: -14,
    compRatio: 1.2,
    hissLevel: 0.0025,
  },
};
const TAPE_TRANSPORT_PROFILE = {
  baseDelayMs: 1.8,
  wowDepthMs: 0.035,
  wowStepSec: 0.18,
  flutterHz: 7.2,
  flutterDepthMs: 0.006,
};
const DECK_SIM_PROFILES = {
  off: {
    wowMul: 1.0,
    flutterMul: 1.0,
    wowStepSec: 0.18,
    playbackBandwidthHz: 22050,
    crosstalk: 0.0,
    hissMul: 1.0,
  },
  portable: {
    wowMul: 1.8,
    flutterMul: 1.6,
    wowStepSec: 0.22,
    playbackBandwidthHz: 12800,
    crosstalk: 0.12,
    hissMul: 1.35,
  },
  deck_2: {
    wowMul: 1.0,
    flutterMul: 1.0,
    wowStepSec: 0.17,
    playbackBandwidthHz: 16000,
    crosstalk: 0.05,
    hissMul: 1.0,
  },
  deck_3: {
    wowMul: 0.65,
    flutterMul: 0.65,
    wowStepSec: 0.15,
    playbackBandwidthHz: 18500,
    crosstalk: 0.025,
    hissMul: 0.72,
  },
};
const TONE_SIM_PROFILES = {
  default: {
    headBumpDb: 0,
    preEmphasisDb: 0,
    deEmphasisDb: 0,
    bandwidthMul: 1.0,
    driveMul: 1.0,
    compRatioMul: 1.0,
    compThresholdDb: 0,
  },
  cool: {
    headBumpDb: -0.5,
    preEmphasisDb: 0.6,
    deEmphasisDb: 0.6,
    bandwidthMul: 1.08,
    driveMul: 0.9,
    compRatioMul: 0.92,
    compThresholdDb: 1.0,
  },
  warm: {
    headBumpDb: 0.7,
    preEmphasisDb: -0.5,
    deEmphasisDb: -0.8,
    bandwidthMul: 0.92,
    driveMul: 1.12,
    compRatioMul: 1.08,
    compThresholdDb: -1.0,
  },
};
const TUBE_SIM_PROFILE = {
  drive: 1.02,
  asymmetry: 0.03,
  lowpassHz: 9600,
  outputTrim: 0.99,
};
const VINYL_SIM_PROFILE = {
  bassHz: 170,
  bassDb: 0.9,
  wearHz: 3400,
  wearDb: -2.4,
  lowpassHz: 12800,
  highpassHz: 26,
  warpBaseDelayMs: 2.4,
  warpDepthMs: 0.14,
  warpStepSec: 0.14,
  eccentricityHz: 0.56,
  eccentricityDepthMs: 0.09,
  surfaceLevel: 0.0032,
  crackleLevel: 0.06,
  rumbleLevel: 0.0025,
};
const VINYL_ERA_PROFILES = {
  modern: {
    lowpassMul: 1.04,
    wearHz: 5200,
    wearDb: -0.4,
    humLevel: 0.00003,
    narrow: 0.025,
    grooveDrive: 0.014,
    knockLevel: 0.0005,
  },
  classic: {
    lowpassMul: 0.88,
    wearHz: 3600,
    wearDb: -2.1,
    humLevel: 0.00008,
    narrow: 0.075,
    grooveDrive: 0.04,
    knockLevel: 0.0011,
  },
  vintage: {
    lowpassMul: 0.74,
    wearHz: 2500,
    wearDb: -3.5,
    humLevel: 0.00016,
    narrow: 0.135,
    grooveDrive: 0.072,
    knockLevel: 0.0018,
  },
  effect: {
    lowpassMul: 0.68,
    wearHz: 2100,
    wearDb: -4.4,
    humLevel: 0.0012,
    narrow: 0.18,
    grooveDrive: 0.11,
    knockLevel: 0.005,
  },
};
const VINYL_CRACKLE_PROFILES = {
  off: { dust: 0, scratch: 0, click: 0 },
  low: { dust: 0.75, scratch: 0.7, click: 1.0 },
  mid: { dust: 1.35, scratch: 1.35, click: 1.85 },
  high: { dust: 2.1, scratch: 2.1, click: 3.0 },
};
const DEFAULT_GAP = 3.0;
const SILENCE_THRESHOLD = 0.005;
const SILENCE_MIN_DUR = 0.3;
const CALIBRATION_FREQ_HZ = 1000;
const CALIBRATION_HIGH_FREQ_HZ = 10000;
const CALIBRATION_HF_OFFSET_DB = -20;
const CALIBRATION_SIGNAL_PRESETS = [
  { id: "rec_level_balance", nameKey: "toolSignalRecBalance", descKey: "toolSignalRecBalanceDesc" },
  { id: "cal", nameKey: "toolSignalCal", descKey: "toolSignalCalDesc" },
  { id: "bias", nameKey: "toolSignalBias", descKey: "toolSignalBiasDesc" },
];

// ── Audio helpers ────────────────────────────────────────────
function encodeWAV(ab, bitsPerSample = 16) {
  const nCh = ab.numberOfChannels, sr = ab.sampleRate, nS = ab.length;
  const byPS = bitsPerSample / 8;
  const ds = nS * nCh * byPS, buf = new ArrayBuffer(44 + ds), dv = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); dv.setUint32(4, 36 + ds, true); ws(8, "WAVE"); ws(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nCh, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * nCh * byPS, true); dv.setUint16(32, nCh * byPS, true);
  dv.setUint16(34, bitsPerSample, true); ws(36, "data"); dv.setUint32(40, ds, true);
  const chs = []; for (let c = 0; c < nCh; c++) chs.push(ab.getChannelData(c));
  let off = 44;
  if (bitsPerSample === 16) {
    for (let i = 0; i < nS; i++) for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, chs[c][i]));
      dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2;
    }
  } else { // 24-bit
    for (let i = 0; i < nS; i++) for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, chs[c][i]));
      const v = s < 0 ? Math.round(s * 0x800000) : Math.round(s * 0x7FFFFF);
      dv.setUint8(off, v & 0xFF); dv.setUint8(off + 1, (v >> 8) & 0xFF); dv.setUint8(off + 2, (v >> 16) & 0xFF); off += 3;
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}
function createSoftSatCurve(drive = 1.0, samples = 2048) {
  const curve = new Float32Array(samples);
  const amount = Math.max(0.01, drive);
  const norm = Math.tanh(amount);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
}
function createTubeCurve(drive = 1.0, asymmetry = 0.15, samples = 2048) {
  const curve = new Float32Array(samples);
  const amount = Math.max(0.01, drive);
  const bias = Math.max(-0.45, Math.min(0.45, asymmetry));
  let peak = 1e-9;
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    const shifted = x + bias * (1 - x * x);
    const shaped = Math.tanh(amount * shifted);
    curve[i] = shaped;
    peak = Math.max(peak, Math.abs(shaped));
  }
  for (let i = 0; i < samples; i++) curve[i] /= peak;
  return curve;
}
function createWhiteNoiseBuffer(ctx, durationSec) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
function createSmoothRandomBuffer(ctx, durationSec, stepSec = 0.1) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(stepSec * ctx.sampleRate));
  const anchors = [];
  for (let i = 0; i <= Math.ceil(length / step); i++) anchors.push(Math.random() * 2 - 1);
  anchors.push(anchors[0]);
  let peak = 1e-9;
  for (let i = 0; i < length; i++) {
    const phase = i / step;
    const base = Math.floor(phase);
    const frac = phase - base;
    const prev = anchors[base];
    const next = anchors[base + 1];
    const smooth = frac * frac * (3 - 2 * frac);
    const value = prev + (next - prev) * smooth;
    data[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  for (let i = 0; i < length; i++) data[i] /= peak;
  return buffer;
}
function createCrackleBuffer(ctx, durationSec) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const addBurst = (index, amp, width) => {
    for (let i = 0; i < width; i++) {
      const pos = index + i;
      if (pos >= length) break;
      const x = i / Math.max(1, width - 1);
      const env = Math.exp(-8 * x);
      data[pos] += (Math.random() * 2 - 1) * amp * env;
    }
  };
  const dustCount = Math.floor(durationSec * 30);
  const clickCount = Math.floor(durationSec * 8);
  for (let i = 0; i < dustCount; i++) {
    addBurst(
      Math.floor(Math.random() * length),
      0.05 + Math.random() * 0.04,
      8 + Math.floor(Math.random() * 14)
    );
  }
  for (let i = 0; i < clickCount; i++) {
    addBurst(
      Math.floor(Math.random() * length),
      0.16 + Math.random() * 0.12,
      22 + Math.floor(Math.random() * 48)
    );
  }
  return buffer;
}
function createBurstNoiseBuffer(ctx, durationSec, eventRate, ampMin, ampMax, widthMin, widthMax) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const count = Math.floor(durationSec * eventRate);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(Math.random() * length);
    const width = widthMin + Math.floor(Math.random() * Math.max(1, widthMax - widthMin + 1));
    const amp = ampMin + Math.random() * (ampMax - ampMin);
    for (let j = 0; j < width; j++) {
      const pos = start + j;
      if (pos >= length) break;
      const x = j / Math.max(1, width - 1);
      const env = Math.exp(-10 * x);
      data[pos] += (Math.random() * 2 - 1) * amp * env;
    }
  }
  return buffer;
}
function createMechanicalKnockBuffer(ctx, durationSec, level = 0.004) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const interval = Math.max(1, Math.floor(ctx.sampleRate * 1.8));
  for (let start = 0; start < length; start += interval) {
    const width = Math.min(Math.floor(ctx.sampleRate * 0.018), length - start);
    for (let i = 0; i < width; i++) {
      const pos = start + i;
      if (pos >= length) break;
      const x = i / Math.max(1, width - 1);
      const body = Math.sin(x * Math.PI) * Math.exp(-6 * x);
      data[pos] += (Math.random() * 2 - 1) * level * body;
    }
  }
  return buffer;
}
function buildToneTubeStage(ctx, inputNode, toneProfileKey, tubeEnabled) {
  const toneProfile = TONE_SIM_PROFILES[toneProfileKey] || TONE_SIM_PROFILES.default;
  if (toneProfileKey === "default" && !tubeEnabled) {
    return { output: inputNode, nodes: [] };
  }

  let current = inputNode;
  const nodes = [];

  if (tubeEnabled) {
    const tubeInput = ctx.createGain();
    tubeInput.gain.value = TUBE_SIM_PROFILE.drive;
    const tubeSaturator = ctx.createWaveShaper();
    tubeSaturator.curve = createTubeCurve(TUBE_SIM_PROFILE.drive, TUBE_SIM_PROFILE.asymmetry);
    tubeSaturator.oversample = "4x";
    const tubeLowpass = ctx.createBiquadFilter();
    tubeLowpass.type = "lowpass";
    tubeLowpass.frequency.value = TUBE_SIM_PROFILE.lowpassHz;
    tubeLowpass.Q.value = 0.4;
    const tubeTrim = ctx.createGain();
    tubeTrim.gain.value = TUBE_SIM_PROFILE.outputTrim;
    current.connect(tubeInput);
    tubeInput.connect(tubeSaturator);
    tubeSaturator.connect(tubeLowpass);
    tubeLowpass.connect(tubeTrim);
    current = tubeTrim;
    nodes.push(tubeInput, tubeSaturator, tubeLowpass, tubeTrim);
  }

  if (toneProfileKey !== "default") {
    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 160;
    lowShelf.gain.value = toneProfile.headBumpDb;

    const preEmphasis = ctx.createBiquadFilter();
    preEmphasis.type = "highshelf";
    preEmphasis.frequency.value = 4200;
    preEmphasis.gain.value = toneProfile.preEmphasisDb;

    const saturator = ctx.createWaveShaper();
    saturator.curve = createSoftSatCurve(toneProfile.driveMul);
    saturator.oversample = "4x";

    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -18 + toneProfile.compThresholdDb;
    glue.knee.value = 8;
    glue.ratio.value = 1.18 * toneProfile.compRatioMul;
    glue.attack.value = 0.004;
    glue.release.value = 0.11;

    const deEmphasis = ctx.createBiquadFilter();
    deEmphasis.type = "highshelf";
    deEmphasis.frequency.value = 5400;
    deEmphasis.gain.value = toneProfile.deEmphasisDb;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 18000 * toneProfile.bandwidthMul;
    lowpass.Q.value = 0.25;

    current.connect(lowShelf);
    lowShelf.connect(preEmphasis);
    preEmphasis.connect(saturator);
    saturator.connect(glue);
    glue.connect(deEmphasis);
    deEmphasis.connect(lowpass);
    current = lowpass;
    nodes.push(lowShelf, preEmphasis, saturator, glue, deEmphasis, lowpass);
  }

  return { output: current, nodes };
}
function buildTapeSimulation(ctx, inputNode, mode, deckProfileKey) {
  const profile = TAPE_SIM_PROFILES[mode];
  const transportProfile = TAPE_TRANSPORT_PROFILE;
  const deckProfile = DECK_SIM_PROFILES[deckProfileKey] || DECK_SIM_PROFILES.off;
  const bus = ctx.createGain();
  bus.gain.value = 0.96;

  const headBump = ctx.createBiquadFilter();
  headBump.type = "lowshelf";
  headBump.frequency.value = profile.headBumpHz;
  headBump.gain.value = profile.headBumpDb;

  const preEmphasis = ctx.createBiquadFilter();
  preEmphasis.type = "highshelf";
  preEmphasis.frequency.value = profile.preEmphasisHz;
  preEmphasis.gain.value = profile.preEmphasisDb;

  const saturator = ctx.createWaveShaper();
  saturator.curve = createSoftSatCurve(profile.drive);
  saturator.oversample = "4x";

  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = profile.compThreshold;
  glue.knee.value = 8;
  glue.ratio.value = profile.compRatio;
  glue.attack.value = 0.003;
  glue.release.value = 0.12;

  const deEmphasis = ctx.createBiquadFilter();
  deEmphasis.type = "highshelf";
  deEmphasis.frequency.value = profile.deEmphasisHz;
  deEmphasis.gain.value = profile.deEmphasisDb;

  const bandwidth = ctx.createBiquadFilter();
  bandwidth.type = "lowpass";
  bandwidth.frequency.value = Math.min(profile.bandwidthHz, deckProfile.playbackBandwidthHz);
  bandwidth.Q.value = 0.3;

  const transport = ctx.createDelay(0.03);
  transport.delayTime.value = transportProfile.baseDelayMs / 1000;

  const deckSplitter = ctx.createChannelSplitter(2);
  const deckMerger = ctx.createChannelMerger(2);
  const leftDirect = ctx.createGain();
  const rightDirect = ctx.createGain();
  const leftLeak = ctx.createGain();
  const rightLeak = ctx.createGain();
  leftDirect.gain.value = 1 - deckProfile.crosstalk;
  rightDirect.gain.value = 1 - deckProfile.crosstalk;
  leftLeak.gain.value = deckProfile.crosstalk;
  rightLeak.gain.value = deckProfile.crosstalk;

  inputNode.connect(headBump);
  headBump.connect(preEmphasis);
  preEmphasis.connect(saturator);
  saturator.connect(glue);
  glue.connect(deEmphasis);
  deEmphasis.connect(bandwidth);
  bandwidth.connect(transport);
  transport.connect(deckSplitter);
  deckSplitter.connect(leftDirect, 0);
  deckSplitter.connect(leftLeak, 0);
  deckSplitter.connect(rightLeak, 1);
  deckSplitter.connect(rightDirect, 1);
  leftDirect.connect(deckMerger, 0, 0);
  rightLeak.connect(deckMerger, 0, 0);
  rightDirect.connect(deckMerger, 0, 1);
  leftLeak.connect(deckMerger, 0, 1);
  deckMerger.connect(bus);

  const wowSource = ctx.createBufferSource();
  wowSource.buffer = createSmoothRandomBuffer(ctx, 11, deckProfile.wowStepSec);
  wowSource.loop = true;
  const wowDepth = ctx.createGain();
  wowDepth.gain.value = (transportProfile.wowDepthMs * deckProfile.wowMul) / 1000;
  wowSource.connect(wowDepth);
  wowDepth.connect(transport.delayTime);
  wowSource.start();

  const flutter = ctx.createOscillator();
  flutter.type = "sine";
  flutter.frequency.value = transportProfile.flutterHz;
  const flutterDepth = ctx.createGain();
  flutterDepth.gain.value = (transportProfile.flutterDepthMs * deckProfile.flutterMul) / 1000;
  flutter.connect(flutterDepth);
  flutterDepth.connect(transport.delayTime);
  flutter.start();

  const hissSource = ctx.createBufferSource();
  hissSource.buffer = createWhiteNoiseBuffer(ctx, 6);
  hissSource.loop = true;
  const hissHighpass = ctx.createBiquadFilter();
  hissHighpass.type = "highpass";
  hissHighpass.frequency.value = 3800;
  const hissLowpass = ctx.createBiquadFilter();
  hissLowpass.type = "lowpass";
  hissLowpass.frequency.value = 12000;
  const hissGain = ctx.createGain();
  hissGain.gain.value = profile.hissLevel * deckProfile.hissMul;
  hissSource.connect(hissHighpass);
  hissHighpass.connect(hissLowpass);
  hissLowpass.connect(hissGain);
  hissGain.connect(bus);
  hissSource.start();

  return {
    output: bus,
    auxSources: [wowSource, flutter, hissSource],
    nodes: [
      bus,
      headBump,
      preEmphasis,
      saturator,
      glue,
      deEmphasis,
      bandwidth,
      transport,
      deckSplitter,
      deckMerger,
      leftDirect,
      rightDirect,
      leftLeak,
      rightLeak,
      wowDepth,
      flutterDepth,
      hissHighpass,
      hissLowpass,
      hissGain,
    ],
  };
}
function buildVinylSimulation(ctx, inputNode, eraKey, crackleKey, currentProgress = 0, remainingDur = 30) {
  const profile = VINYL_SIM_PROFILE;
  const eraProfile = VINYL_ERA_PROFILES[eraKey] || VINYL_ERA_PROFILES.modern;
  const crackleProfile = VINYL_CRACKLE_PROFILES[crackleKey] || VINYL_CRACKLE_PROFILES.low;
  const bus = ctx.createGain();
  bus.gain.value = 0.95;

  const warp = ctx.createDelay(0.03);
  warp.delayTime.value = profile.warpBaseDelayMs / 1000;

  const bass = ctx.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = profile.bassHz;
  bass.gain.value = profile.bassDb;

  const wear = ctx.createBiquadFilter();
  wear.type = "highshelf";
  wear.frequency.value = eraProfile.wearHz || profile.wearHz;
  wear.gain.value = eraProfile.wearDb;

  const grooveWet = ctx.createGain();
  grooveWet.gain.value = eraProfile.grooveDrive * currentProgress;
  const grooveShape = ctx.createWaveShaper();
  grooveShape.curve = createTubeCurve(1.05, 0.04, 2048);
  grooveShape.oversample = "4x";
  const grooveTone = ctx.createBiquadFilter();
  grooveTone.type = "highshelf";
  grooveTone.frequency.value = 3200;
  grooveTone.gain.value = 1.2;
  const grooveDry = ctx.createGain();
  grooveDry.gain.value = 1.0;
  const grooveMix = ctx.createGain();

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = profile.lowpassHz * eraProfile.lowpassMul;
  lowpass.Q.value = 0.4;

  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = profile.highpassHz;
  highpass.Q.value = 0.5;

  const stereoSplit = ctx.createChannelSplitter(2);
  const stereoMerge = ctx.createChannelMerger(2);
  const leftDirect = ctx.createGain();
  const rightDirect = ctx.createGain();
  const leftLeak = ctx.createGain();
  const rightLeak = ctx.createGain();
  leftDirect.gain.value = 1 - eraProfile.narrow;
  rightDirect.gain.value = 1 - eraProfile.narrow;
  leftLeak.gain.value = eraProfile.narrow;
  rightLeak.gain.value = eraProfile.narrow;

  inputNode.connect(warp);
  warp.connect(bass);
  bass.connect(wear);
  wear.connect(grooveDry);
  wear.connect(grooveWet);
  grooveWet.connect(grooveShape);
  grooveShape.connect(grooveTone);
  grooveDry.connect(grooveMix);
  grooveTone.connect(grooveMix);
  grooveMix.connect(lowpass);
  lowpass.connect(highpass);
  highpass.connect(stereoSplit);
  stereoSplit.connect(leftDirect, 0);
  stereoSplit.connect(leftLeak, 0);
  stereoSplit.connect(rightLeak, 1);
  stereoSplit.connect(rightDirect, 1);
  leftDirect.connect(stereoMerge, 0, 0);
  rightLeak.connect(stereoMerge, 0, 0);
  rightDirect.connect(stereoMerge, 0, 1);
  leftLeak.connect(stereoMerge, 0, 1);
  stereoMerge.connect(bus);

  if (remainingDur > 0.25) {
    grooveWet.gain.linearRampToValueAtTime(
      eraProfile.grooveDrive,
      ctx.currentTime + Math.max(0.25, remainingDur)
    );
  }

  const warpSource = ctx.createBufferSource();
  warpSource.buffer = createSmoothRandomBuffer(ctx, 13, profile.warpStepSec);
  warpSource.loop = true;
  const warpDepth = ctx.createGain();
  warpDepth.gain.value = profile.warpDepthMs / 1000;
  warpSource.connect(warpDepth);
  warpDepth.connect(warp.delayTime);
  warpSource.start();

  const eccentricity = ctx.createOscillator();
  eccentricity.type = "sine";
  eccentricity.frequency.value = profile.eccentricityHz;
  const eccentricityDepth = ctx.createGain();
  eccentricityDepth.gain.value = profile.eccentricityDepthMs / 1000;
  eccentricity.connect(eccentricityDepth);
  eccentricityDepth.connect(warp.delayTime);
  eccentricity.start();

  const surfaceSource = ctx.createBufferSource();
  surfaceSource.buffer = createWhiteNoiseBuffer(ctx, 7);
  surfaceSource.loop = true;
  const surfaceHighpass = ctx.createBiquadFilter();
  surfaceHighpass.type = "highpass";
  surfaceHighpass.frequency.value = 1800;
  const surfaceLowpass = ctx.createBiquadFilter();
  surfaceLowpass.type = "lowpass";
  surfaceLowpass.frequency.value = 9000;
  const surfaceGain = ctx.createGain();
  surfaceGain.gain.value = profile.surfaceLevel;
  surfaceSource.connect(surfaceHighpass);
  surfaceHighpass.connect(surfaceLowpass);
  surfaceLowpass.connect(surfaceGain);
  surfaceGain.connect(bus);
  surfaceSource.start();

  const dustSource = ctx.createBufferSource();
  dustSource.buffer = createBurstNoiseBuffer(ctx, 11, 26, 0.01, 0.035, 4, 10);
  dustSource.loop = true;
  const dustHighpass = ctx.createBiquadFilter();
  dustHighpass.type = "highpass";
  dustHighpass.frequency.value = 2600;
  const dustGain = ctx.createGain();
  dustGain.gain.value = 0.02 * crackleProfile.dust;
  dustSource.connect(dustHighpass);
  dustHighpass.connect(dustGain);
  dustGain.connect(bus);
  dustSource.start();

  const scratchSource = ctx.createBufferSource();
  scratchSource.buffer = createBurstNoiseBuffer(ctx, 13, 1.2, 0.05, 0.12, 120, 420);
  scratchSource.loop = true;
  const scratchBandpass = ctx.createBiquadFilter();
  scratchBandpass.type = "bandpass";
  scratchBandpass.frequency.value = 3200;
  scratchBandpass.Q.value = 0.7;
  const scratchGain = ctx.createGain();
  scratchGain.gain.value = 0.028 * crackleProfile.scratch;
  scratchSource.connect(scratchBandpass);
  scratchBandpass.connect(scratchGain);
  scratchGain.connect(bus);
  scratchSource.start();

  const crackleSource = ctx.createBufferSource();
  crackleSource.buffer = createCrackleBuffer(ctx, 11);
  crackleSource.loop = true;
  const crackleHighpass = ctx.createBiquadFilter();
  crackleHighpass.type = "highpass";
  crackleHighpass.frequency.value = 1600;
  const crackleGain = ctx.createGain();
  crackleGain.gain.value = profile.crackleLevel * crackleProfile.click;
  crackleSource.connect(crackleHighpass);
  crackleHighpass.connect(crackleGain);
  crackleGain.connect(bus);
  crackleSource.start();

  const rumbleSource = ctx.createBufferSource();
  rumbleSource.buffer = createWhiteNoiseBuffer(ctx, 8);
  rumbleSource.loop = true;
  const rumbleLowpass = ctx.createBiquadFilter();
  rumbleLowpass.type = "lowpass";
  rumbleLowpass.frequency.value = 80;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = profile.rumbleLevel;
  rumbleSource.connect(rumbleLowpass);
  rumbleLowpass.connect(rumbleGain);
  rumbleGain.connect(bus);
  rumbleSource.start();

  const humFundamental = ctx.createOscillator();
  humFundamental.type = "sine";
  humFundamental.frequency.value = 60;
  const humFirst = ctx.createOscillator();
  humFirst.type = "sine";
  humFirst.frequency.value = 120;
  const humGainA = ctx.createGain();
  const humGainB = ctx.createGain();
  humGainA.gain.value = eraProfile.humLevel;
  humGainB.gain.value = eraProfile.humLevel * 0.55;
  humFundamental.connect(humGainA);
  humFirst.connect(humGainB);
  humGainA.connect(bus);
  humGainB.connect(bus);
  humFundamental.start();
  humFirst.start();

  const knockSource = ctx.createBufferSource();
  knockSource.buffer = createMechanicalKnockBuffer(ctx, 12, eraProfile.knockLevel);
  knockSource.loop = true;
  const knockLowpass = ctx.createBiquadFilter();
  knockLowpass.type = "lowpass";
  knockLowpass.frequency.value = 180;
  const knockGain = ctx.createGain();
  knockGain.gain.value = 1.0;
  knockSource.connect(knockLowpass);
  knockLowpass.connect(knockGain);
  knockGain.connect(bus);
  knockSource.start();

  return {
    output: bus,
    auxSources: [
      warpSource,
      eccentricity,
      surfaceSource,
      dustSource,
      scratchSource,
      crackleSource,
      rumbleSource,
      humFundamental,
      humFirst,
      knockSource,
    ],
    nodes: [
      bus,
      warp,
      bass,
      wear,
      grooveWet,
      grooveShape,
      grooveTone,
      grooveDry,
      grooveMix,
      lowpass,
      highpass,
      stereoSplit,
      stereoMerge,
      leftDirect,
      rightDirect,
      leftLeak,
      rightLeak,
      warpDepth,
      eccentricityDepth,
      surfaceHighpass,
      surfaceLowpass,
      surfaceGain,
      dustHighpass,
      dustGain,
      scratchBandpass,
      scratchGain,
      crackleHighpass,
      crackleGain,
      rumbleLowpass,
      rumbleGain,
      humGainA,
      humGainB,
      knockLowpass,
      knockGain,
    ],
  };
}

// Format tag colors
const FMT_COLORS = {
  FLAC: { bg: "#2D6A4F", fg: "#fff" }, WAV: { bg: "#1B4965", fg: "#fff" }, AIFF: { bg: "#1B4965", fg: "#fff" },
  AIF: { bg: "#1B4965", fg: "#fff" }, MP3: { bg: "#E07A5F", fg: "#fff" }, AAC: { bg: "#D4859A", fg: "#fff" },
  OGG: { bg: "#7B6B8A", fg: "#fff" }, OPUS: { bg: "#7B6B8A", fg: "#fff" }, M4A: { bg: "#D4859A", fg: "#fff" },
  APE: { bg: "#3A5A40", fg: "#fff" }, WV: { bg: "#3A5A40", fg: "#fff" }, DSD: { bg: "#5C4033", fg: "#fff" },
};
function fmtColor(fmt) { return FMT_COLORS[fmt] || { bg: "var(--bg-deep)", fg: "var(--text-dim)" }; }

function detectSilence(ab) {
  const d = ab.getChannelData(0), sr = ab.sampleRate; let h = 0, tl = 0;
  for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > SILENCE_THRESHOLD) { h = i / sr; break; }
  for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > SILENCE_THRESHOLD) { tl = (d.length - 1 - i) / sr; break; }
  return { headSilence: Math.max(0, h), tailSilence: Math.max(0, tl) };
}
function getPeak(ab) { let p = 0; for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; } } return p; }
function getRMS(ab) { let s = 0, n = 0; for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; n++; } } return Math.sqrt(s / n); }
function toDb(v) { return v > 0 ? 20 * Math.log10(v) : -Infinity; }
function readExtended80(dv, off) {
  const raw = dv.getUint16(off, false);
  if (raw === 0) return 0;
  const sign = (raw & 0x8000) !== 0 ? -1 : 1;
  const exp = (raw & 0x7FFF) - 16383;
  const hi = dv.getUint32(off + 2, false);
  const lo = dv.getUint32(off + 6, false);
  const mant = Number((BigInt(hi) << 32n) | BigInt(lo));
  return sign * mant * (2 ** (exp - 63));
}
function detectSourceAudioMeta(filename, buf) {
  const ext = (filename.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
  const meta = { sampleRate: null, channels: null, bitDepth: null };
  if (!buf || !(buf instanceof ArrayBuffer)) return meta;
  const dv = new DataView(buf);
  try {
    if ((ext === "wav" || ext === "wave") && buf.byteLength >= 44) {
      for (let off = 12; off + 8 <= buf.byteLength;) {
        const id = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
        const size = dv.getUint32(off + 4, true);
        if (id === "fmt " && off + 8 + size <= buf.byteLength && size >= 16) {
          meta.channels = dv.getUint16(off + 10, true);
          meta.sampleRate = dv.getUint32(off + 12, true);
          meta.bitDepth = dv.getUint16(off + 22, true);
          return meta;
        }
        off += 8 + size + (size % 2);
      }
    }
    if ((ext === "aif" || ext === "aiff") && buf.byteLength >= 12) {
      for (let off = 12; off + 8 <= buf.byteLength;) {
        const id = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
        const size = dv.getUint32(off + 4, false);
        if (id === "COMM" && off + 8 + size <= buf.byteLength && size >= 18) {
          meta.channels = dv.getUint16(off + 8, false);
          meta.bitDepth = dv.getUint16(off + 14, false);
          meta.sampleRate = Math.round(readExtended80(dv, off + 16));
          return meta;
        }
        off += 8 + size + (size % 2);
      }
    }
    if (ext === "flac" && buf.byteLength >= 42) {
      let off = 4;
      while (off + 4 <= buf.byteLength) {
        const header = dv.getUint8(off);
        const isLast = (header & 0x80) !== 0;
        const type = header & 0x7F;
        const size = (dv.getUint8(off + 1) << 16) | (dv.getUint8(off + 2) << 8) | dv.getUint8(off + 3);
        off += 4;
        if (type === 0 && off + size <= buf.byteLength && size >= 18) {
          const b10 = dv.getUint8(off + 10);
          const b11 = dv.getUint8(off + 11);
          const b12 = dv.getUint8(off + 12);
          const b13 = dv.getUint8(off + 13);
          meta.sampleRate = (b10 << 12) | (b11 << 4) | (b12 >> 4);
          meta.channels = ((b12 & 0x0E) >> 1) + 1;
          meta.bitDepth = (((b12 & 0x01) << 4) | (b13 >> 4)) + 1;
          return meta;
        }
        off += size;
        if (isLast) break;
      }
    }
  } catch { }
  return meta;
}
// Pre-downsample AudioBuffer to N min/max peak pairs per channel — O(samples) once at load
function downsamplePeaks(ab, N = 4096) {
  const result = [];
  for (let c = 0; c < Math.min(ab.numberOfChannels, 2); c++) {
    const data = ab.getChannelData(c);
    const step = Math.max(1, Math.floor(data.length / N));
    const peaks = new Float32Array(N * 2); // [min0,max0,min1,max1,...]
    for (let i = 0; i < N; i++) {
      const start = Math.floor(i * data.length / N);
      const end = Math.min(start + step, data.length);
      let mn = 0, mx = 0;
      for (let j = start; j < end; j++) { if (data[j] < mn) mn = data[j]; if (data[j] > mx) mx = data[j]; }
      peaks[i * 2] = mn; peaks[i * 2 + 1] = mx;
    }
    result.push(peaks);
  }
  return result;
}
function computeSpectrogramPreview(ab, frames = Math.max(96, Math.min(320, Math.round(ab.duration * 10))), bands = 80) {
  const sampleRate = ab.sampleRate;
  const maxHz = Math.min(22050, sampleRate / 2);
  const minHz = 40;
  const winSize = 1536;
  const half = Math.floor(winSize / 2);
  const data = ab.getChannelData(0);
  const len = data.length;
  const window = new Float32Array(winSize);
  for (let i = 0; i < winSize; i++) window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winSize - 1)));
  const freqs = Array.from({ length: bands }, (_, i) => minHz * Math.pow(maxHz / minHz, i / Math.max(1, bands - 1)));
  const coeffs = freqs.map(f => 2 * Math.cos((2 * Math.PI * f) / sampleRate));
  const valuesDb = new Float32Array(frames * bands);
  for (let fi = 0; fi < frames; fi++) {
    const center = Math.floor((fi / Math.max(1, frames - 1)) * Math.max(0, len - 1));
    let start = Math.max(0, center - half);
    if (start + winSize > len) start = Math.max(0, len - winSize);
    for (let bi = 0; bi < bands; bi++) {
      const coeff = coeffs[bi];
      let s0 = 0, s1 = 0, s2 = 0;
      for (let n = 0; n < winSize; n++) {
        const sample = (data[start + n] || 0) * window[n];
        s0 = sample + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }
      const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
      const db = 10 * Math.log10(power / winSize + 1e-12);
      valuesDb[fi * bands + bi] = db;
    }
  }
  return { frames, bands, maxHz, valuesDb };
}
function fmtTime(s) { if (!s || s < 0) return "0:00"; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`; }
function fmtTimeMs(s) { if (!s || s < 0) return "0:00.0"; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`; }
let _id = 0; const uid = () => `t_${++_id}_${Date.now()}`;

const HeaderControls = React.memo(function HeaderControls({ lang, setLang, theme, setTheme, onOpenTools, T }) {
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
        {Object.entries(LANGS).map(([k, l]) => (
          <button key={k} onClick={() => setLang(k)} style={{
            ...btnTab, fontSize: 12, padding: "5px 10px", minWidth: 36, textAlign: "center",
            background: lang === k ? "var(--accent)" : "var(--bg-card)", color: lang === k ? "var(--accent-contrast)" : "var(--text-dim)"
          }}>{l.label}</button>
        ))}
        <button onClick={onOpenTools} style={{ ...btnTab, fontSize: 12, padding: "5px 10px", background: "var(--bg-card)", color: "var(--text-dim)" }} title={T("tools")}>
          <IconTool size={16} />
        </button>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowThemePicker(p => !p)} style={{
            ...btnTab, fontSize: 12, padding: "5px 10px",
            background: showThemePicker ? "var(--accent)" : "var(--bg-card)",
            color: showThemePicker ? "var(--accent-contrast)" : "var(--text-dim)"
          }} title={T("theme")}>
            <IconPalette size={16} />
          </button>
          {showThemePicker && <div onClick={() => setShowThemePicker(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />}
          {showThemePicker && <div style={{
            position: "absolute", right: 0, top: "100%", marginTop: 6, zIndex: 51,
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 6px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.12)", width: "max-content", minWidth: 220, maxWidth: "min(320px, calc(100vw - 32px))", maxHeight: "70vh", overflowY: "auto"
          }}>
            {(() => {
              let lastGrp = "";
              return THEME_ORDER.map(k => {
                const t = THEMES[k];
                const sep = t.group && t.group !== lastGrp;
                lastGrp = t.group;
                return (<div key={k}>
                  {sep && <div style={{ borderTop: "1px solid var(--border)", margin: "4px 6px" }} />}
                  <button onClick={() => { setTheme(k); setShowThemePicker(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px",
                      border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
                      background: theme === k ? "var(--accent-dim)" : "transparent",
                      color: theme === k ? "var(--accent-ink)" : "var(--text)"
                    }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: "50%", background: t.accent, flexShrink: 0,
                      border: theme === k ? "2px solid var(--accent-ink)" : "2px solid transparent"
                    }} />
                    <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>{themeName(k, lang)}</span>
                    {theme === k && <span style={{ fontSize: 10 }}>✓</span>}
                  </button>
                </div>);
              });
            })()}
          </div>}
        </div>
        <button onClick={() => setShowHelp(true)} style={{ ...btnTab, fontSize: 12, padding: "5px 10px", background: "var(--bg-card)", color: "var(--text-dim)" }} title={T("help")}>
          <IconHelp size={16} />
        </button>
        <button onClick={() => setShowAbout(true)} style={{ ...btnTab, fontSize: 12, padding: "5px 10px", background: "var(--bg-card)", color: "var(--text-dim)" }} title={T("about")}>
          <IconInfo size={16} />
        </button>
      </div>

      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bg)", borderRadius: 12, maxWidth: 560, width: "min(560px, calc(100vw - 32px))", maxHeight: "80vh", overflow: "hidden",
              border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontSize: 14, lineHeight: 1.8, color: "var(--text)", display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontSize: 16, color: "var(--accent-ink)" }}>
                {lang === "ja" ? "S.I.D.E ヘルプ" : lang === "en" ? "S.I.D.E Help" : "S.I.D.E 帮助"}
              </span>
              <button onClick={() => setShowHelp(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-dim)" }}>✕</button>
            </div>

            <div className="modalScroll" style={{ padding: "18px 24px 22px", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
              {lang === "zh-CN" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <p>
                    <b>S</b>equential <b>I</b>nterleaved <b>D</b>ubbing <b>E</b>ngine<br />
                    把数字音频文件编排到磁带 A/B 面，导出可直接送入卡座录制的 WAV 文件。<br />
                    <span style={{ color: "var(--text-dim)", fontSize: 12 }}>璃奈觉得，把音乐放进磁带这件事，是值得认真对待的。</span>
                  </p>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <p><b>// 基本流程</b><br />
                      先确认当前选中的 SIDE，再添加文件。可以点「添加文件」，也可以直接把音频拖进来。<br />
                      支持格式：MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A。<br />
                      FLAC 和 AIFF 会优先读取原始文件头的采样率和位深。只有在浏览器无法直接解码时，才会调用 ffmpeg.wasm 进行格式转换。<br />
                      顺序可以拖动调整。↑↓ 可以微调。→A / →B 可以把音轨移到另一面。</p>
                    <p><b>// 磁带规格</b><br />
                      选择磁带型号（C-46 / C-60 / C-90 / C-120 / 自定义）和类型（Type I / II / IV）。<br />
                      磁带类型会影响响度归一化的目标电平。Type II 和 Type IV 可以录制更高的电平。这不是小事。</p>
                    <p><b>// 编排</b><br />
                      「自动分面」会按时长重新分配，让 A/B 两面的容量尽量接近。<br />
                      曲间间隔可以手动填写。开启「智能间隔检测」后，会自动扣除音轨首尾已有的静音，只计算实际需要的间隔长度。<br />
                      采样率和位深按每一面单独决定。音轨旁边会显示转换方向和目标值，请注意确认。<br />
                      Auto 采样率 = 该面音轨中最高的采样率。Auto 位深 = 有无损格式时为 24bit，否则 16bit。</p>
                    <p><b>// 试听</b><br />
                      按整面时间线播放。曲间间隔、归一化增益、尾部填充都会计算在内。<br />
                      进度条和音轨节点可以跳转。支持暂停、继续、上下曲。<br />
                      电平表有五种显示模式：VFD 峰值 / VU 表头 / FFT 频谱 / 波形 / 声谱图。</p>
                    <p><b>// 介质模拟</b><br />
                      这部分只作用于试听，不会影响导出的 WAV 文件。<br />
                      <b>模拟</b>：Type I / II / IV 磁带，或黑胶。模拟对应介质的频响特性。<br />
                      <b>卡座</b>：随身听 / 二磁头 / 三磁头。不同档次的 transport 特性不同。<br />
                      <b>音色</b>：中性 / 偏冷 / 偏暖。对整体频谱做倾向性调整。<br />
                      <b>管级</b>：加入轻微的电子管谐波着色和高频圆润感。<br />
                      <b>年代</b>（黑胶）：现代 / 经典 / 复古 / 重效果。控制磨损程度和频响衰减。<br />
                      <b>爆豆</b>（黑胶）：click/pop 噪声的密度。</p>
                    <p><b>// 导出</b><br />
                      导出为 WAV 文件。连接卡座线路输入，直接录制即可。<br />
                      需要降采样或位深转换的音轨，导出前会弹出确认提示。<br />
                      尾部填充：自动补足静音，使总时长对齐磁带标称容量。</p>
                    <p><b>// 歌单</b><br />
                      可以导出和导入 JSON 格式的歌单。导入后为占位模式。<br />
                      重新添加同名的音频文件，会自动完成匹配。不需要重新配置。</p>
                    <p><b>// 波形 / 声谱图</b><br />
                      每一面下方可以切换显示静态波形或 FFT 声谱图。<br />
                      声谱图的纵轴是对数频率。颜色深浅对应电平强度。</p>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right", marginTop: 4 }}>
                    ……把声音编译进磁带里。 {RINA_SMILE}<br />
                    <span style={{ fontSize: 10 }}>{T("appVersion")}</span>
                  </p>
                </div>

              ) : lang === "ja" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <p>
                    <b>S</b>equential <b>I</b>nterleaved <b>D</b>ubbing <b>E</b>ngine<br />
                    デジタル音源をカセットテープの A/B 面に配置して、デッキのライン入力に直結できる WAV ファイルを書き出すツール。<br />
                    <span style={{ color: "var(--text-dim)", fontSize: 12 }}>音楽をテープに記録することは、丁寧に扱う価値があると璃奈は思っています。</span>
                  </p>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <p><b>// 基本的な使い方</b><br />
                      まず現在の SIDE を確認してから、ファイルを追加してください。「ファイル追加」ボタンを使うか、音声ファイルを直接ドラッグ＆ドロップできます。<br />
                      対応フォーマット：MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A。<br />
                      FLAC と AIFF はまずファイルヘッダから元の SR とビット深度を読み取ります。ブラウザでデコードできない場合のみ、ffmpeg.wasm が呼ばれます。<br />
                      ドラッグで順番を変えられます。↑↓ で細かく調整。→A / →B で面を移動。</p>
                    <p><b>// テープ規格</b><br />
                      テープ長（C-46 / C-60 / C-90 / C-120 / カスタム）と種類（Type I / II / IV）を選びます。<br />
                      テープ種類はラウドネス正規化のターゲットレベルに影響します。Type II と Type IV はより高い録音レベルが使えます。これは小さくない違いです。</p>
                    <p><b>// 配置</b><br />
                      「自動振り分け」は時間をもとに再配置して、A/B 面の使用率を揃えます。<br />
                      曲間ギャップは手動でも入力できます。スマートギャップ検出を有効にすると、先頭と末尾の無音を差し引いて適切な値を算出します。<br />
                      SR とビット深度は面ごとに決まります。各トラックに変換の方向と目標値が表示されるので、確認してください。<br />
                      Auto SR = 面内の最高 SR。Auto ビット深度 = ロスレスあり → 24bit、なし → 16bit。</p>
                    <p><b>// 試聴</b><br />
                      面全体のタイムラインで再生されます。ギャップ・正規化ゲイン・末尾パディングも含まれます。<br />
                      シークバーとトラックノードでジャンプできます。一時停止・再開・前後スキップに対応しています。<br />
                      メーターは 5 モードで切り替えられます：VFD ピーク / VU ニードル / FFT スペクトラム / 波形 / スペクトログラム。</p>
                    <p><b>// 媒体シミュレーション</b><br />
                      試聴専用の処理です。書き出した WAV ファイルには影響しません。<br />
                      <b>モデリング</b>：Type I / II / IV テープ、またはレコード盤の周波数特性を再現します。<br />
                      <b>デッキ</b>：ポータブル機 / 2 ヘッド / 3 ヘッドのトランスポート特性を適用します。<br />
                      <b>音色</b>：中立 / クール / ウォーム。全体的な周波数の傾向を調整します。<br />
                      <b>真空管</b>：軽微な倍音の着色と、高域の柔らかさを加えます。<br />
                      <b>年代</b>（レコードモード）：現代 / 定番 / 旧式 / 効果。磨耗と帯域減衰の強度を選びます。<br />
                      <b>ポップ</b>（レコードモード）：クリック/ポップノイズの密度を設定します。</p>
                    <p><b>// 書き出し</b><br />
                      WAV ファイルとして書き出します。デッキのライン入力に繋いで、そのまま録音できます。<br />
                      ダウンサンプルやビット深度の変換が必要なトラックは、書き出し前に確認ダイアログが表示されます。<br />
                      末尾パディング：テープの標準長に合わせて無音を補填します。</p>
                    <p><b>// プレイリスト</b><br />
                      JSON 形式で書き出し・読み込みができます。読み込み後はプレースホルダモードです。<br />
                      同じファイル名の音声ファイルを再追加すると、自動でマッチングされます。再設定は不要です。</p>
                    <p><b>// 波形 / スペクトログラム</b><br />
                      各面の下に静的波形または FFT スペクトログラムを切り替えて表示できます。<br />
                      スペクトログラムの縦軸は対数周波数スケールです。色の濃淡がレベルに対応しています。</p>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right", marginTop: 4 }}>
                    ……音をテープにコンパイルする。 {RINA_SMILE}<br />
                    <span style={{ fontSize: 10 }}>{T("appVersion")}</span>
                  </p>
                </div>

              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <p>
                    <b>S</b>equential <b>I</b>nterleaved <b>D</b>ubbing <b>E</b>ngine<br />
                    Arrange digital audio files onto cassette tape sides A and B, then export WAV files ready for direct recording through a deck's line input.<br />
                    <span style={{ color: "var(--text-dim)", fontSize: 12 }}>Rina thinks that putting music onto tape is something worth doing carefully.</span>
                  </p>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <p><b>// Getting started</b><br />
                      Confirm the active SIDE first, then add files. Use the "Add Files" button, or drag audio directly into the side.<br />
                      Supported formats: MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A.<br />
                      For FLAC and AIFF, the original sample rate and bit depth are read from the file header first. ffmpeg.wasm is only called when the browser cannot decode the file natively.<br />
                      Drag to reorder. ↑↓ to nudge. →A / →B to move a track to the other side.</p>
                    <p><b>// Tape settings</b><br />
                      Choose a tape length (C-46 / C-60 / C-90 / C-120 / Custom) and type (Type I / II / IV).<br />
                      Tape type sets the normalization target level. Type II and Type IV support higher recording levels. That is not a small difference.</p>
                    <p><b>// Arrangement</b><br />
                      "Auto Distribute" reallocates tracks by duration to keep A and B sides balanced.<br />
                      Track gaps can also be entered manually. With Smart Gap Detection enabled, existing head and tail silence is subtracted automatically, so only the silence that is actually needed gets added.<br />
                      Sample rate and bit depth are resolved per side. Each track shows the conversion direction and target value — please check these.<br />
                      Auto SR = highest SR on the side. Auto bit depth = 24-bit if any lossless source is present, 16-bit otherwise.</p>
                    <p><b>// Preview</b><br />
                      Plays the full side timeline. Gaps, normalization gain, and tail padding are all included.<br />
                      The seekbar and track markers can be used to jump to any point. Pause, resume, and previous/next track are supported.<br />
                      The meter has five modes: VFD peak / VU needle / FFT spectrum / Waveform / Spectrogram.</p>
                    <p><b>// Medium simulation</b><br />
                      This only affects preview. The exported WAV is not changed.<br />
                      <b>Simulation</b>: Type I / II / IV tape, or vinyl. Applies the frequency response of the chosen medium.<br />
                      <b>Deck</b>: Portable / 2-head / 3-head transport characteristics.<br />
                      <b>Tone</b>: Neutral / Cool / Warm. Adjusts the overall spectral tilt.<br />
                      <b>Tube</b>: Adds subtle harmonic coloring and softness in the high frequencies.<br />
                      <b>Era</b> (vinyl): Modern / Classic / Vintage / Effect. Controls wear and bandwidth roll-off.<br />
                      <b>Crackle</b> (vinyl): Sets the density of click and pop surface noise.</p>
                    <p><b>// Export</b><br />
                      Exports as a WAV file. Connect to the deck's line input and record directly.<br />
                      Tracks that require downsampling or bit-depth conversion will show a confirmation dialog before export.<br />
                      Tail fill: silence is padded to match the tape's rated length.</p>
                    <p><b>// Playlists</b><br />
                      Playlists can be exported and imported as JSON. An imported playlist starts in placeholder mode.<br />
                      Re-adding audio files with matching filenames will hydrate the stubs automatically. No reconfiguration is needed.</p>
                    <p><b>// Waveform / Spectrogram</b><br />
                      Each side can display a static waveform or an FFT spectrogram below the track list.<br />
                      The spectrogram's vertical axis is logarithmic frequency. Color intensity maps to level.</p>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right", marginTop: 4 }}>
                    …compile your sound into tape. {RINA_SMILE}<br />
                    <span style={{ fontSize: 10 }}>{T("appVersion")}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAbout && <div onClick={() => setShowAbout(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: "var(--bg)", borderRadius: 12, width: "fit-content", maxWidth: "calc(100vw - 32px)", maxHeight: "80vh", overflow: "hidden",
          border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontSize: 14, lineHeight: 1.9, color: "var(--text)", display: "flex", flexDirection: "column"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <span style={{ fontSize: 16, color: "var(--accent-ink)" }}>About</span>
            <button onClick={() => setShowAbout(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-dim)" }}>✕</button>
          </div>
          <div className="modalScroll" style={{ padding: "18px 24px 22px", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
            <div>Sequential Interleaved Dubbing Engine</div>
            <div>Developed by 天使天才天王寺璃奈</div>
            <div>With Claude Opus 4.6 Extended & GPT 5.4 (reasoning high, summaries auto)</div>
            <div>{APP_VERSION}</div>
            <a href={APP_GITHUB} target="_blank" rel="noreferrer" style={{ color: "var(--accent-ink)", textDecoration: "none" }}>
              {`Github: ${APP_GITHUB}`}
            </a>
          </div>
        </div>
      </div>}
    </>
  );
});

// ═══════════════════════════════════════════════════════════════
export default function CassetteTool() {
  const [lang, setLang] = useState("zh-CN");
  const [theme, setTheme] = useState("default");
  const th = THEMES[theme] || THEMES.default;
  const sideColors = useMemo(
    () => (th.sideA && th.sideB
      ? { sideA: th.sideA, sideB: th.sideB }
      : deriveSideColors(th.accent)),
    [th.sideA, th.sideB, th.accent]
  );
  const accentInk = useMemo(
    () => th.accentInk || deriveAccentInk(th.accent),
    [th.accentInk, th.accent]
  );
  const warningColor = useMemo(
    () => th.warning || deriveWarningColor(th.accent),
    [th.warning, th.accent]
  );
  const tapeTypeColors = useMemo(() => deriveTapeTypeColors(th.accent), [th.accent]);
  const accentContrast = useMemo(() => th.accentContrast || getContrastColor(th.accent), [th.accentContrast, th.accent]);
  const T = useCallback((k) => t(k, lang), [lang]);

  const [tapePreset, setTapePreset] = useState("C60");
  const [tapeType, setTapeType] = useState("TYPE_I");
  const [customMin, setCustomMin] = useState(30);
  const [tracks, setTracks] = useState([]);
  const [defaultGap, setDefaultGap] = useState(DEFAULT_GAP);
  const [fillTail, setFillTail] = useState(true);
  const [tailMargin, setTailMargin] = useState(2); // minutes
  const [smartGap, setSmartGap] = useState(true);
  const [normalizeMode, setNormalizeMode] = useState("off");
  const [targetDb, setTargetDb] = useState(-3.0);
  const [exportSr, setExportSr] = useState("auto"); // "auto" | 44100 | 48000
  const [exportBits, setExportBits] = useState("auto"); // "auto" | 16 | 24
  // Playback state
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playingSide, setPlayingSide] = useState(null);
  const [playbackView, setPlaybackView] = useState({ token: 0, schedule: [], totalDur: 0 });
  const playingIdxRef = useRef(-1);
  const playPosRef = useRef(0);
  const displayIdxRef = useRef(-1);
  const displayPosRef = useRef(0);
  const displayDelayRef = useRef(0);
  const playRef = useRef({
    sources: [],
    sourceNodes: [],
    simGraphs: [],
    outputNodes: [],
    simCleanupTimers: [],
    startTime: 0,
    raf: null,
    ctx: null,
    schedule: [],
    totalDur: 0,
    stopping: false,
  });
  const stopPlaybackRef = useRef(null);
  const meterRef = useRef({ el: null, peakL: 0, peakR: 0, decayL: 0, decayR: 0 });
  const analyserRef = useRef({ L: null, R: null });
  const [meterMode, setMeterMode] = useState("vfd"); // vfd | vu | spectrum | waveform
  const [simMode, setSimMode] = useState("off"); // off | TAPE_I | TAPE_II | TAPE_IV | vinyl
  const [deckProfile, setDeckProfile] = useState("off"); // off | portable | deck_2 | deck_3
  const [toneProfile, setToneProfile] = useState("default"); // default | cool | warm
  const [tubeEnabled, setTubeEnabled] = useState(false);
  const [vinylEra, setVinylEra] = useState("classic"); // modern | classic | vintage | effect
  const [vinylCrackle, setVinylCrackle] = useState("low"); // off | low | high
  const [playerVolume, setPlayerVolume] = useState(1.0);
  const [processing, setProcessing] = useState(false);
  const [procMsg, setProcMsg] = useState("");
  const [expProg, setExpProg] = useState(null);
  const [dragOverSide, setDragOverSide] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [activeTab, setActiveTab] = useState("A");
  const [sidePreviewMode, setSidePreviewMode] = useState("waveform");
  const [toast, setToast] = useState(null);
  const [ffmpegStatus, setFfmpegStatus] = useState("idle"); // idle | loading | ready | unavailable
  const [showTools, setShowTools] = useState(false);
  const [activeTool, setActiveTool] = useState("rec-cal");
  const [calibrationSide, setCalibrationSide] = useState("A");
  const [calibrationSignalType, setCalibrationSignalType] = useState("rec_level_balance");
  const [calibrationRunning, setCalibrationRunning] = useState(false);

  const acRef = useRef(null);
  const fileRef = useRef(null);
  const plRef = useRef(null);
  const calibrationRef = useRef({ osc: null, gain: null, merger: null });

  const showToast = useCallback((m, d = 4000) => { setToast(m); setTimeout(() => setToast(null), d); }, []);
  const getAC = useCallback(() => {
    if (!acRef.current) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      acRef.current = new AudioContextCtor({ latencyHint: "interactive" });
    }
    return acRef.current;
  }, []);
  const openTools = useCallback(() => {
    setCalibrationSide(activeTab);
    setActiveTool("rec-cal");
    setCalibrationSignalType("rec_level_balance");
    const ctx = getAC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    setShowTools(true);
  }, [activeTab, getAC]);

  const sideMin = tapePreset === "CUSTOM" ? customMin : TAPE_PRESETS[tapePreset].sideMinutes;
  const sideSec = sideMin * 60;
  const effectiveSec = Math.max(0, sideSec - tailMargin * 60);
  const playbackStructureKey = useMemo(() => JSON.stringify({
    defaultGap, smartGap, fillTail, sideSec,
    tracks: tracks.map(t => ({ id: t.id, side: t.side, gapOverride: t.gapOverride, hasAudio: !!t.audioBuffer }))
  }), [tracks, defaultGap, smartGap, fillTail, sideSec]);
  const activeDeckProfile = simMode.startsWith("TAPE_") ? deckProfile : "off";

  const sideA = useMemo(() => tracks.filter(t => t.side === "A"), [tracks]);
  const sideB = useMemo(() => tracks.filter(t => t.side === "B"), [tracks]);

  // Resolve export sample rate: "auto" picks max SR from the side's tracks
  const resolveExportSr = useCallback((sideTracks) => {
    if (exportSr !== "auto") return exportSr;
    const maxSr = sideTracks.filter(t => t.audioBuffer).reduce((m, t) => Math.max(m, t.sampleRate), 44100);
    return maxSr;
  }, [exportSr]);

  const LOSSLESS_FMT = new Set(["FLAC", "WAV", "AIFF", "AIF", "APE", "WV", "DSD", "DSF", "DFF"]);
  // Resolve export bit depth: "auto" → 24 if any lossless source, else 16
  const resolveExportBits = useCallback((sideTracks) => {
    if (exportBits !== "auto") return exportBits;
    const hasLossless = sideTracks.some(t => LOSSLESS_FMT.has(t.format));
    return hasLossless ? 24 : 16;
  }, [exportBits]);

  const stopCalibration = useCallback(() => {
    const calibration = calibrationRef.current;
    if (calibration.osc) {
      calibration.osc.onended = null;
      try { calibration.osc.stop(); } catch { }
    }
    [calibration.osc, calibration.gain, calibration.merger].forEach((node) => {
      try { node?.disconnect(); } catch { }
    });
    calibrationRef.current = { osc: null, gain: null, merger: null };
    setCalibrationRunning(false);
  }, []);

  useEffect(() => {
    if (!showTools) stopCalibration();
  }, [showTools, stopCalibration]);

  // Compute effective gap for a track (considering smartGap)
  const getGap = useCallback((tr, nextTr) => {
    if (tr.gapOverride != null) return tr.gapOverride;
    if (!smartGap) return defaultGap;
    // Smart: target gap = defaultGap, subtract existing tail+head silence
    const existing = (tr.tailSilence || 0) + (nextTr?.headSilence || 0);
    return Math.max(0, defaultGap - existing);
  }, [defaultGap, smartGap]);

  const calcDur = useCallback((st) => {
    if (st.length === 0) return 0;
    let total = 0;
    st.forEach((tr, i) => {
      total += tr.duration;
      if (i < st.length - 1) total += getGap(tr, st[i + 1]);
    });
    return total;
  }, [getGap]);

  const durA = useMemo(() => calcDur(sideA), [sideA, calcDur]);
  const durB = useMemo(() => calcDur(sideB), [sideB, calcDur]);

  // ── File loading ─────────────────────────────────────────
  const loadFiles = useCallback(async (files, side) => {
    const ctx = getAC(); setProcessing(true);
    const nw = [];
    const hydratedIds = new Set(); // track which stubs got matched
    for (const f of files) {
      setProcMsg(`${T("decoding")}: ${f.name}`);
      let ab = null;
      let fileBuf = null;
      let sourceMeta = null;
      try {
        fileBuf = await f.arrayBuffer();
        sourceMeta = detectSourceAudioMeta(f.name, fileBuf);
        if (likelyNeedsTranscode(f.name)) {
          throw new Error("format likely unsupported natively, try ffmpeg");
        }
        ab = await ctx.decodeAudioData(fileBuf.slice(0));
      } catch (nativeErr) {
        try {
          setProcMsg(`ffmpeg: ${f.name}`);
          if (ffmpegStatus === "idle") setFfmpegStatus("loading");
          const wavBuf = await transcodeToWav(f, (msg) => setProcMsg(`ffmpeg: ${msg}`));
          setFfmpegStatus("ready");
          ab = await ctx.decodeAudioData(wavBuf);
        } catch (ffErr) {
          console.error(`Failed to decode ${f.name} (native + ffmpeg):`, ffErr);
          if (ffErr.message?.includes("SharedArrayBuffer")) {
            setFfmpegStatus("unavailable");
            showToast("SharedArrayBuffer unavailable — COOP/COEP headers missing. FLAC/AIFF decoding disabled.", 6000);
          }
        }
      }
      if (!ab) continue;
      const sil = detectSilence(ab); const pk = getPeak(ab); const rms = getRMS(ab);
      const ext = (f.name.match(/\.([^.]+)$/) || [])[1]?.toUpperCase() || "?";
      const peaks = downsamplePeaks(ab, 4096);
      const spectrogram = computeSpectrogramPreview(ab);
      const audioMeta = {
        audioBuffer: ab, duration: ab.duration, sampleRate: sourceMeta?.sampleRate || ab.sampleRate,
        channels: sourceMeta?.channels || ab.numberOfChannels, headSilence: sil.headSilence, tailSilence: sil.tailSilence,
        peakDb: toDb(pk), rmsDb: toDb(rms), peak: pk, rms, format: ext, bitDepth: sourceMeta?.bitDepth ?? null, peaks, spectrogram
      };
      // Check for stub match: same fileName, no audioBuffer, not already matched this batch
      const stubMatch = tracks.find(t => !t.audioBuffer && !hydratedIds.has(t.id) &&
        (t.fileName === f.name || t.name === f.name.replace(/\.[^.]+$/, "")));
      if (stubMatch) {
        hydratedIds.add(stubMatch.id);
        setTracks(p => p.map(t => t.id === stubMatch.id ? { ...t, ...audioMeta } : t));
      } else {
        nw.push({
          id: uid(), name: f.name.replace(/\.[^.]+$/, ""), fileName: f.name,
          side: side || "A", gapOverride: null, format: ext, ...audioMeta
        });
      }
    }
    if (nw.length > 0) setTracks(p => [...p, ...nw]);
    const matched = hydratedIds.size;
    if (matched > 0) showToast(`${matched} ${T("stubsHydrated")}`, 3000);
    setProcessing(false); setProcMsg("");
  }, [getAC, T, ffmpegStatus, showToast, tracks]);

  const handleDrop = useCallback((e, side) => {
    e.preventDefault(); e.stopPropagation(); setDragOverSide(null);
    if (dragItem) { setTracks(p => p.map(t => t.id === dragItem ? { ...t, side } : t)); setDragItem(null); }
    else if (e.dataTransfer.files.length > 0) loadFiles(Array.from(e.dataTransfer.files), side);
  }, [dragItem, loadFiles]);

  const removeTrack = useCallback(id => setTracks(p => p.filter(t => t.id !== id)), []);
  const moveTrack = useCallback((id, dir) => {
    setTracks(p => {
      const i = p.findIndex(t => t.id === id); if (i === -1) return p;
      const tr = p[i], ss = p.filter(t => t.side === tr.side), si = ss.findIndex(t => t.id === id), sw = si + dir;
      if (sw < 0 || sw >= ss.length) return p;
      const r = [...p], ai = r.findIndex(t => t.id === id), bi = r.findIndex(t => t.id === ss[sw].id);
      [r[ai], r[bi]] = [r[bi], r[ai]]; return r;
    });
  }, []);
  const toggleSide = useCallback(id => setTracks(p => p.map(t => t.id === id ? { ...t, side: t.side === "A" ? "B" : "A" } : t)), []);
  const setTrackGap = useCallback((id, g) => setTracks(p => p.map(t => t.id === id ? { ...t, gapOverride: g } : t)), []);

  const autoDistribute = useCallback(() => {
    if (!tracks.length) return;
    const sorted = [...tracks].sort((a, b) => b.duration - a.duration);
    let sA = 0, sB = 0; const m = new Map();
    const eff = effectiveSec;
    for (const tr of sorted) {
      // Prefer the side that's still under effective capacity; if both under or both over, pick lighter
      const aUnder = sA < eff, bUnder = sB < eff;
      if (aUnder && !bUnder) { m.set(tr.id, "A"); sA += tr.duration; }
      else if (!aUnder && bUnder) { m.set(tr.id, "B"); sB += tr.duration; }
      else if (sA <= sB) { m.set(tr.id, "A"); sA += tr.duration; }
      else { m.set(tr.id, "B"); sB += tr.duration; }
    }
    setTracks(p => p.map(t => ({ ...t, side: m.get(t.id) || t.side })));
  }, [tracks, effectiveSec]);

  // ── Playlist I/O ─────────────────────────────────────────
  const exportPL = useCallback(() => {
    const pl = {
      version: "0.3", generator: "SIDE",
      config: { tapePreset, tapeType, customMin, defaultGap, fillTail, tailMargin, smartGap, normalizeMode, targetDb, exportSr, exportBits },
      tracks: tracks.map(t => ({
        name: t.name, fileName: t.fileName, side: t.side, duration: t.duration,
        sampleRate: t.sampleRate, bitDepth: t.bitDepth, channels: t.channels, peakDb: t.peakDb, rmsDb: t.rmsDb,
        gapOverride: t.gapOverride, headSilence: t.headSilence, tailSilence: t.tailSilence, format: t.format || "?"
      }))
    };
    const b = new Blob([JSON.stringify(pl, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(b), a = document.createElement("a");
    a.href = u; a.download = `SIDE_playlist_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(u); showToast(T("playlistExported"));
  }, [tracks, tapePreset, tapeType, customMin, defaultGap, fillTail, tailMargin, smartGap, normalizeMode, targetDb, exportSr, exportBits, T, showToast]);

  const importPL = useCallback(async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const pl = JSON.parse(await f.text());
      if (!pl.tracks) throw new Error("no tracks");
      const c = pl.config || {};
      if (c.tapePreset) setTapePreset(c.tapePreset); if (c.tapeType) { setTapeType(c.tapeType); setTargetDb(TAPE_TYPES[c.tapeType]?.peakDb ?? -3); }
      if (c.customMin != null) setCustomMin(c.customMin); if (c.defaultGap != null) setDefaultGap(c.defaultGap);
      if (c.fillTail != null) setFillTail(c.fillTail); if (c.tailMargin != null) setTailMargin(c.tailMargin);
      if (c.smartGap != null) setSmartGap(c.smartGap); if (c.normalizeMode) setNormalizeMode(c.normalizeMode);
      if (c.targetDb != null) setTargetDb(c.targetDb); if (c.exportSr) setExportSr(c.exportSr); if (c.exportBits) setExportBits(c.exportBits);
      setTracks(pl.tracks.map(t => ({
        id: uid(), name: t.name || "?", fileName: t.fileName || "", side: t.side || "A",
        duration: t.duration || 0, sampleRate: t.sampleRate || 44100, bitDepth: t.bitDepth ?? null, channels: t.channels || 2, audioBuffer: null,
        headSilence: t.headSilence || 0, tailSilence: t.tailSilence || 0,
        peakDb: t.peakDb ?? -Infinity, rmsDb: t.rmsDb ?? -Infinity,
        peak: t.peakDb != null ? Math.pow(10, t.peakDb / 20) : 0, rms: t.rmsDb != null ? Math.pow(10, t.rmsDb / 20) : 0,
        gapOverride: t.gapOverride ?? null, format: t.format || "?"
      })));
      showToast(T("playlistImportNoAudio"), 6000);
    } catch (err) { showToast(T("playlistImportError") + ": " + err.message); }
    e.target.value = "";
  }, [T, showToast]);

  // ── Export Audio ──────────────────────────────────────────
  const expSide = useCallback(async (side) => {
    stopCalibration();
    const allSide = tracks.filter(t => t.side === side);
    const st = allSide.filter(t => t.audioBuffer);
    const stubCount = allSide.length - st.length;
    if (!st.length) return;
    if (stubCount > 0) {
      const ok = window.confirm(T("exportHasStubs"));
      if (!ok) return;
    }
    const sr = resolveExportSr(st);
    const bits = resolveExportBits(st);
    // Warn about downsampled tracks
    const downsampled = st.filter(t => t.sampleRate > sr);
    if (downsampled.length > 0) {
      const names = downsampled.map(t => `${t.name} (${t.sampleRate / 1000}kHz→${sr / 1000}kHz)`).join("\n");
      const ok = window.confirm(`${T("resampleWarn")}:\n${names}\n\nContinue?`);
      if (!ok) return;
    }
    const bitDepthChanged = st.filter(t => t.bitDepth != null && t.bitDepth !== bits);
    if (bitDepthChanged.length > 0) {
      const names = bitDepthChanged.map(t => `${t.name} (${t.bitDepth}bit→${bits}bit)`).join("\n");
      const ok = window.confirm(`${T("bitDepthWarn")}:\n${names}\n\nContinue?`);
      if (!ok) return;
    }
    setProcessing(true); setExpProg({ side, step: 0, total: st.length + 2 });
    try {
      const ch = 2;
      let gains = st.map(() => 1.0);
      if (normalizeMode === "peak") { const tl = Math.pow(10, targetDb / 20); gains = st.map(t => t.peak > 0 ? tl / t.peak : 1.0); }
      else if (normalizeMode === "rms") { const avg = st.reduce((s, t) => s + t.rms, 0) / st.length; gains = st.map(t => t.rms > 0 ? avg / t.rms : 1.0); }
      let len = 0;
      st.forEach((tr, i) => { len += tr.duration * sr; if (i < st.length - 1) len += getGap(tr, st[i + 1]) * sr; });
      if (fillTail) len = Math.max(len, sideSec * sr);
      len = Math.ceil(len);
      const oc = new OfflineAudioContext(ch, len, sr); let cur = 0;
      for (let i = 0; i < st.length; i++) {
        setExpProg({ side, step: i + 1, total: st.length + 2 }); setProcMsg(`SIDE ${side}: [${i + 1}/${st.length}] ${st[i].name}`);
        const tr = st[i], src = oc.createBufferSource(), gn = oc.createGain();
        src.buffer = tr.audioBuffer; gn.gain.value = gains[i]; src.connect(gn); gn.connect(oc.destination);
        src.start(cur / sr); cur += Math.ceil(tr.duration * sr);
        if (i < st.length - 1) cur += Math.ceil(getGap(tr, st[i + 1]) * sr);
      }
      setProcMsg(`SIDE ${side}: ${T("rendering")}...`); setExpProg({ side, step: st.length + 1, total: st.length + 2 });
      const r = await oc.startRendering();
      setProcMsg(`SIDE ${side}: ${T("encoding")}...`); setExpProg({ side, step: st.length + 2, total: st.length + 2 });
      const blob = encodeWAV(r, bits), u = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = u; a.download = `SIDE_${side}_${sr}hz_${bits}bit.wav`; a.click(); URL.revokeObjectURL(u);
    } catch (e) { console.error(e); alert(`Export failed: ${e.message}`); }
    setProcessing(false); setProcMsg(""); setExpProg(null);
  }, [tracks, defaultGap, fillTail, normalizeMode, targetDb, sideSec, getAC, T, getGap, resolveExportSr, resolveExportBits, stopCalibration]);

  // ── Playback Engine ───────────────────────────────────────
  const playGenRef = useRef(0); // generation counter to prevent stale callbacks
  const appliedSimKeyRef = useRef(`${simMode}|${activeDeckProfile}|${toneProfile}|${tubeEnabled ? 1 : 0}|${vinylEra}|${vinylCrackle}`);
  const appliedPlaybackStructureRef = useRef(playbackStructureKey);
  const getPlaybackCursor = useCallback((schedule, pos, contentDur, totalDur) => {
    if (!schedule.length) return -1;
    if (totalDur > contentDur && pos >= contentDur) return schedule.length;
    const current = [...schedule].reverse().find((seg) => pos >= seg.start);
    return current ? current.idx : schedule[0].idx;
  }, []);

  const getPlaybackDisplayDelay = useCallback((ctx) => {
    const baseLatency = Number.isFinite(ctx?.baseLatency) ? ctx.baseLatency : 0;
    const outputLatency = Number.isFinite(ctx?.outputLatency) ? ctx.outputLatency : 0;
    const mediumDelay = simMode.startsWith("TAPE_")
      ? TAPE_TRANSPORT_PROFILE.baseDelayMs / 1000
      : simMode === "vinyl"
        ? VINYL_SIM_PROFILE.warpBaseDelayMs / 1000
        : 0;
    return Math.max(0, baseLatency + outputLatency + mediumDelay);
  }, [simMode]);

  const stopAuxSources = useCallback((sources) => {
    sources.forEach((source) => {
      try { source.stop(); } catch { }
    });
  }, []);

  const disconnectNodes = useCallback((nodes) => {
    nodes.forEach((node) => {
      try { node.disconnect(); } catch { }
    });
  }, []);

  const SIM_SWITCH_FADE_SEC = 0.045;

  const clearSimCleanupTimers = useCallback((playback) => {
    (playback.simCleanupTimers || []).forEach((id) => window.clearTimeout(id));
    playback.simCleanupTimers = [];
  }, []);

  const disposePlaybackSimGraph = useCallback((graph) => {
    if (!graph) return;
    stopAuxSources(graph.auxSources || []);
    disconnectNodes(graph.nodes || []);
  }, [disconnectNodes, stopAuxSources]);

  const clearSimulationGraphs = useCallback((playback) => {
    clearSimCleanupTimers(playback);
    (playback.simGraphs || []).forEach((graph) => disposePlaybackSimGraph(graph));
    playback.simGraphs = [];
  }, [clearSimCleanupTimers, disposePlaybackSimGraph]);

  const clearPlaybackOutputChain = useCallback((playback) => {
    if (playback.masterGain) {
      try { playback.masterGain.disconnect(); } catch { }
    }
    disconnectNodes(playback.outputNodes || []);
    playback.outputNodes = [];
    playback.masterGain = null;
    playback.simOutput = null;
    playback.volumeGain = null;
    playback.splitter = null;
    playback.analyserL = null;
    playback.analyserR = null;
  }, [disconnectNodes]);

  const buildPlaybackOutputChain = useCallback((ctx) => {
    const simOutput = ctx.createGain();
    simOutput.gain.value = 1.0;

    const volumeGain = ctx.createGain();
    volumeGain.gain.value = playerVolume;
    simOutput.connect(volumeGain);
    volumeGain.connect(ctx.destination);

    const splitter = ctx.createChannelSplitter(2);
    volumeGain.connect(splitter);
    const analyserL = ctx.createAnalyser(); analyserL.fftSize = 4096; analyserL.smoothingTimeConstant = 0.18;
    const analyserR = ctx.createAnalyser(); analyserR.fftSize = 4096; analyserR.smoothingTimeConstant = 0.18;
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);

    return {
      simOutput,
      volumeGain,
      splitter,
      analyserL,
      analyserR,
      outputNodes: [simOutput, volumeGain, splitter, analyserL, analyserR],
    };
  }, [playerVolume]);

  const buildPlaybackSimulationGraph = useCallback((ctx, inputNode, simOutput, playPos, totalDur, initialGain = 1) => {
    let outputNode = inputNode;
    const nodes = [];
    const auxSources = [];

    const toneTubeStage = buildToneTubeStage(ctx, inputNode, toneProfile, tubeEnabled);
    outputNode = toneTubeStage.output;
    nodes.push(...toneTubeStage.nodes);

    if (simMode.startsWith("TAPE_")) {
      const sim = buildTapeSimulation(ctx, outputNode, simMode, activeDeckProfile);
      outputNode = sim.output;
      auxSources.push(...sim.auxSources);
      nodes.push(...sim.nodes);
    } else if (simMode === "vinyl") {
      const sim = buildVinylSimulation(
        ctx,
        outputNode,
        vinylEra,
        vinylCrackle,
        totalDur > 0 ? playPos / totalDur : 0,
        Math.max(0.25, totalDur - playPos)
      );
      outputNode = sim.output;
      auxSources.push(...sim.auxSources);
      nodes.push(...sim.nodes);
    }

    const outputGain = ctx.createGain();
    outputGain.gain.value = initialGain;
    outputNode.connect(outputGain);
    outputGain.connect(simOutput);
    nodes.push(outputGain);

    return { auxSources, nodes, outputGain };
  }, [simMode, activeDeckProfile, toneProfile, tubeEnabled, vinylEra, vinylCrackle]);

  const rebuildPlaybackSimulationGraph = useCallback(() => {
    const playback = playRef.current;
    if (!playback.ctx || !playback.masterGain || !playback.simOutput) return;
    clearSimCleanupTimers(playback);
    const playPos = Math.max(0, Math.min(playPosRef.current, playback.totalDur || 0));
    const nextGraph = buildPlaybackSimulationGraph(
      playback.ctx,
      playback.masterGain,
      playback.simOutput,
      playPos,
      playback.totalDur || 0,
      0.0001
    );
    const now = playback.ctx.currentTime;
    nextGraph.outputGain.gain.setValueAtTime(0.0001, now);
    nextGraph.outputGain.gain.linearRampToValueAtTime(1.0, now + SIM_SWITCH_FADE_SEC);

    const retiringGraphs = playback.simGraphs || [];
    retiringGraphs.forEach((graph) => {
      graph.outputGain?.gain.cancelScheduledValues(now);
      graph.outputGain?.gain.setValueAtTime(Math.max(0.0001, graph.outputGain.gain.value || 1), now);
      graph.outputGain?.gain.linearRampToValueAtTime(0.0001, now + SIM_SWITCH_FADE_SEC);
      const timer = window.setTimeout(() => {
        disposePlaybackSimGraph(graph);
        playback.simGraphs = (playback.simGraphs || []).filter((item) => item !== graph);
        playback.simCleanupTimers = (playback.simCleanupTimers || []).filter((id) => id !== timer);
      }, Math.ceil((SIM_SWITCH_FADE_SEC + 0.03) * 1000));
      playback.simCleanupTimers = [...(playback.simCleanupTimers || []), timer];
    });

    playback.simGraphs = [...retiringGraphs, nextGraph];
    displayDelayRef.current = getPlaybackDisplayDelay(playback.ctx);
  }, [buildPlaybackSimulationGraph, clearSimCleanupTimers, disposePlaybackSimGraph, getPlaybackDisplayDelay]);

  const stopPlayback = useCallback(() => {
    const cleanup = () => {
      playGenRef.current++;
      const p = playRef.current;
      p.stopping = false;
      p.sources.forEach(s => { s.onended = null; try { s.stop(); } catch (e) { } });
      disconnectNodes(p.sourceNodes || []);
      clearSimulationGraphs(p);
      clearPlaybackOutputChain(p);
      p.sources = [];
      p.sourceNodes = [];
      if (p.raf) cancelAnimationFrame(p.raf);
      p.raf = null; p.pausedAt = null;
      p.schedule = []; p.totalDur = 0;
      analyserRef.current = { L: null, R: null };
      setPlaybackView(v => ({ token: v.token + 1, schedule: [], totalDur: 0 }));
      setPlaying(false); setPaused(false); setPlayingSide(null);
      playingIdxRef.current = -1; playPosRef.current = 0;
      displayIdxRef.current = -1; displayPosRef.current = 0; displayDelayRef.current = 0;
    };

    const p = playRef.current;
    if (simMode === "vinyl" && p.ctx && p.volumeGain && p.sources.length && !p.stopping) {
      p.stopping = true;
      const now = p.ctx.currentTime;
      p.sources.forEach((src) => {
        try {
          src.playbackRate.cancelScheduledValues(now);
          src.playbackRate.setValueAtTime(Math.max(0.82, src.playbackRate.value || 1), now);
          src.playbackRate.exponentialRampToValueAtTime(0.72, now + 0.65);
        } catch { }
      });
      try {
        p.volumeGain.gain.cancelScheduledValues(now);
        p.volumeGain.gain.setValueAtTime(Math.max(0.0001, p.volumeGain.gain.value || 1), now);
        p.volumeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      } catch { }
      window.setTimeout(cleanup, 680);
      return;
    }

    cleanup();
  }, [simMode, clearPlaybackOutputChain, clearSimulationGraphs, disconnectNodes]);

  useEffect(() => {
    stopPlaybackRef.current = stopPlayback;
  }, [stopPlayback]);

  const togglePause = useCallback(() => {
    const ctx = getAC();
    if (!playing) return;
    if (paused) {
      ctx.resume(); setPaused(false);
    } else {
      ctx.suspend(); setPaused(true);
    }
  }, [playing, paused, getAC]);

  // Build schedule from side tracks (reusable)
  const buildSchedule = useCallback((side) => {
    const st = tracks.filter(t => t.side === side && t.audioBuffer);
    const schedule = []; let offset = 0;
    const gains = st.map(tr => {
      if (normalizeMode === "peak") { const tl = Math.pow(10, targetDb / 20); return tr.peak > 0 ? tl / tr.peak : 1.0; }
      if (normalizeMode === "rms") { const avg = st.reduce((s, t) => s + t.rms, 0) / st.length; return tr.rms > 0 ? avg / tr.rms : 1.0; }
      return 1.0;
    });
    st.forEach((tr, i) => {
      schedule.push({ id: tr.id, name: tr.name, start: offset, dur: tr.duration, idx: i, buffer: tr.audioBuffer, gain: gains[i] });
      offset += tr.duration;
      if (i < st.length - 1) offset += getGap(tr, st[i + 1]);
    });
    // If tail fill enabled, extend to tape side length
    const dur = fillTail ? Math.max(offset, sideSec) : offset;
    return { schedule, totalDur: dur, contentDur: offset, trackCount: st.length };
  }, [tracks, normalizeMode, targetDb, getGap, fillTail, sideSec]);

  // Start playback from a given position (seconds)
  const playFromPos = useCallback((side, fromPos) => {
    stopCalibration();
    const p = playRef.current;
    p.sources.forEach(s => { s.onended = null; });
    p.sources.forEach(s => { try { s.stop(); } catch (e) { } });
    disconnectNodes(p.sourceNodes || []);
    clearSimulationGraphs(p);
    clearPlaybackOutputChain(p);
    p.sources = [];
    p.sourceNodes = [];
    if (p.raf) cancelAnimationFrame(p.raf);

    const gen = ++playGenRef.current;
    const ctx = getAC();
    // Resume if suspended (from pause)
    if (ctx.state === "suspended") ctx.resume();
    const { schedule, totalDur, contentDur } = buildSchedule(side);
    if (!schedule.length) { stopPlayback(); return; }
    const clampedPos = Math.max(0, Math.min(fromPos, totalDur));

    const masterGain = ctx.createGain(); masterGain.gain.value = 1.0;
    const outputChain = buildPlaybackOutputChain(ctx);
    const sourceNodes = [];
    const simGraph = buildPlaybackSimulationGraph(ctx, masterGain, outputChain.simOutput, clampedPos, totalDur);

    const sources = [];
    const now = ctx.currentTime;

    schedule.forEach(s => {
      const trackEnd = s.start + s.dur;
      if (trackEnd <= clampedPos) return;
      const src = ctx.createBufferSource();
      src.buffer = s.buffer;
      const gn = ctx.createGain(); gn.gain.value = s.gain;
      src.connect(gn); gn.connect(masterGain);
      sourceNodes.push(gn, src);
      if (clampedPos > s.start) {
        const skipSec = clampedPos - s.start;
        src.start(now, skipSec, s.dur - skipSec);
      } else {
        src.start(now + (s.start - clampedPos));
      }
      sources.push(src);
    });

    const startTime = now - clampedPos;
    const currentIdx = getPlaybackCursor(schedule, clampedPos, contentDur, totalDur);
    const displayDelay = getPlaybackDisplayDelay(ctx);
    const currentDisplayPos = Math.max(0, Math.min(totalDur, clampedPos - displayDelay));
    const currentDisplayIdx = getPlaybackCursor(schedule, currentDisplayPos, contentDur, totalDur);
    analyserRef.current = { L: outputChain.analyserL, R: outputChain.analyserR };
    playRef.current = {
      ...playRef.current,
      sources,
      sourceNodes,
      simGraphs: [simGraph],
      outputNodes: outputChain.outputNodes,
      simCleanupTimers: [],
      startTime,
      raf: null,
      ctx,
      schedule,
      totalDur,
      contentDur,
      analyserL: outputChain.analyserL,
      analyserR: outputChain.analyserR,
      masterGain,
      simOutput: outputChain.simOutput,
      splitter: outputChain.splitter,
      volumeGain: outputChain.volumeGain,
    };
    setPlaybackView({ token: gen, schedule, totalDur, contentDur });
    setPlaying(true); setPlayingSide(side); setPaused(false);
    playingIdxRef.current = currentIdx; playPosRef.current = clampedPos;
    displayDelayRef.current = displayDelay;
    displayPosRef.current = currentDisplayPos;
    displayIdxRef.current = currentDisplayIdx;

    const tick = () => {
      if (playGenRef.current !== gen) return;
      const elapsed = ctx.currentTime - startTime;
      const nextPos = Math.max(0, Math.min(elapsed, totalDur));
      playPosRef.current = nextPos;
      playingIdxRef.current = getPlaybackCursor(schedule, nextPos, contentDur, totalDur);
      const nextDisplayPos = Math.max(0, Math.min(totalDur, nextPos - displayDelayRef.current));
      displayPosRef.current = nextDisplayPos;
      displayIdxRef.current = getPlaybackCursor(schedule, nextDisplayPos, contentDur, totalDur);
      if (nextPos >= totalDur) {
        stopPlayback();
        return;
      }
      playRef.current.raf = requestAnimationFrame(tick);
    };
    playRef.current.raf = requestAnimationFrame(tick);
  }, [getAC, buildPlaybackOutputChain, buildSchedule, getPlaybackCursor, buildPlaybackSimulationGraph, clearPlaybackOutputChain, clearSimulationGraphs, disconnectNodes, getPlaybackDisplayDelay, stopPlayback, stopCalibration]);

  const playSide = useCallback((side) => {
    playFromPos(side, 0);
  }, [playFromPos]);

  const seekTo = useCallback((pos) => {
    if (!playingSide) return;
    playFromPos(playingSide, Math.max(0, pos));
  }, [playingSide, playFromPos]);

  const skipTrack = useCallback((dir) => {
    if (!playingSide) return;
    const schedule = playRef.current.schedule || [];
    const contentDur = playRef.current.contentDur || 0;
    const totalDur = playRef.current.totalDur || 0;
    if (!schedule.length) return;
    const curIdx = playingIdxRef.current;
    if (curIdx >= schedule.length) {
      if (dir < 0) {
        playFromPos(playingSide, schedule[schedule.length - 1].start);
      } else if (totalDur > contentDur) {
        playFromPos(playingSide, contentDur);
      }
      return;
    }
    const newIdx = Math.max(0, Math.min(schedule.length - 1, curIdx + dir));
    playFromPos(playingSide, schedule[newIdx]?.start || 0);
  }, [playingSide, playFromPos]);

  useEffect(() => {
    const appliedKey = `${simMode}|${activeDeckProfile}|${toneProfile}|${tubeEnabled ? 1 : 0}|${vinylEra}|${vinylCrackle}`;
    if (appliedSimKeyRef.current === appliedKey) return;
    appliedSimKeyRef.current = appliedKey;
    if (!playing || !playingSide) return;
    rebuildPlaybackSimulationGraph();
  }, [simMode, activeDeckProfile, toneProfile, tubeEnabled, vinylEra, vinylCrackle, playing, playingSide, rebuildPlaybackSimulationGraph]);

  useEffect(() => {
    if (simMode.startsWith("TAPE_")) return;
    if (deckProfile !== "off") setDeckProfile("off");
  }, [simMode, deckProfile]);

  useEffect(() => {
    const p = playRef.current;
    if (!p.volumeGain) return;
    p.volumeGain.gain.cancelScheduledValues(p.ctx.currentTime);
    p.volumeGain.gain.setValueAtTime(playerVolume, p.ctx.currentTime);
  }, [playerVolume]);

  useEffect(() => {
    if (appliedPlaybackStructureRef.current === playbackStructureKey) return;
    appliedPlaybackStructureRef.current = playbackStructureKey;
    if (!playing || !playingSide) return;

    const schedule = playRef.current.schedule || [];
    if (!schedule.length) {
      stopPlayback();
      return;
    }

    const curIdx = playingIdxRef.current;
    const wasPaused = paused;

    if (curIdx >= schedule.length) {
      const prevContentDur = playRef.current.contentDur || 0;
      const blankOffset = Math.max(0, playPosRef.current - prevContentDur);
      const { contentDur, totalDur } = buildSchedule(playingSide);
      if (totalDur <= 0) {
        stopPlayback();
        return;
      }
      playFromPos(playingSide, Math.min(totalDur, contentDur + blankOffset));
    } else {
      const currentSeg = schedule[curIdx];
      const currentTrack = tracks.find((track) => track.id === currentSeg.id && track.audioBuffer);
      if (!currentTrack) {
        stopPlayback();
        return;
      }

      const offsetInTrack = Math.max(0, Math.min(currentSeg.dur, playPosRef.current - currentSeg.start));
      const { schedule: nextSchedule } = buildSchedule(currentTrack.side);
      const nextSeg = nextSchedule.find((seg) => seg.id === currentTrack.id);
      if (!nextSeg) {
        stopPlayback();
        return;
      }
      playFromPos(currentTrack.side, nextSeg.start + Math.min(offsetInTrack, nextSeg.dur));
    }

    if (wasPaused) {
      const ctx = getAC();
      ctx.suspend();
      setPaused(true);
    }
  }, [playbackStructureKey, playing, playingSide, paused, tracks, buildSchedule, playFromPos, stopPlayback, getAC]);

  // Cleanup on unmount only. Do not bind cleanup to sim-mode-dependent callback identity.
  useEffect(() => () => {
    stopCalibration();
    stopPlaybackRef.current?.();
  }, [stopCalibration]);

  // ── Sub-components ───────────────────────────────────────
  const buildPreviewGains = useCallback((audioTracks) => {
    const gains = audioTracks.map(() => 1.0);
    if (normalizeMode === "peak") {
      const tl = Math.pow(10, targetDb / 20);
      audioTracks.forEach((t, i) => { gains[i] = t.peak > 0 ? tl / t.peak : 1.0; });
    } else if (normalizeMode === "rms") {
      const avg = audioTracks.reduce((s, t) => s + t.rms, 0) / audioTracks.length;
      audioTracks.forEach((t, i) => { gains[i] = t.rms > 0 ? avg / t.rms : 1.0; });
    }
    return gains;
  }, [normalizeMode, targetDb]);

  const resolveCalibrationSignal = useCallback((signalType, side) => {
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

  const startCalibration = useCallback(async () => {
    stopPlayback();
    stopCalibration();
    const ctx = getAC();
    if (ctx.state === "suspended") await ctx.resume();
    const signal = resolveCalibrationSignal(calibrationSignalType, calibrationSide);
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
    calibrationRef.current = { osc, gain, merger };
    setCalibrationRunning(true);
  }, [calibrationSide, calibrationSignalType, getAC, resolveCalibrationSignal, stopCalibration, stopPlayback]);

  const renderCapBar = (used, total, eff, side) => {
    const hardOver = used > total, softOver = !hardOver && used > eff;
    const barBase = total;
    const pct = Math.min((used / barBase) * 100, 100);
    const effPct = (eff / barBase) * 100;
    const okPct = Math.min((Math.min(used, eff) / barBase) * 100, 100);
    const softPct = softOver ? Math.min(((used - eff) / barBase) * 100, 100 - okPct) : 0;
    const rem = eff - used;
    const barColor = hardOver ? "var(--danger)" : `var(--side-${side.toLowerCase()})`;
    const sideColor = `var(--side-${side.toLowerCase()})`;
    const statusColor = hardOver ? "var(--danger)" : softOver ? "var(--warning)" : "var(--text-dim)";
    const statusText = hardOver ? `${T("exceeded")} ${fmtTime(used - total)}` : softOver ? `⚠ +${fmtTime(used - eff)} (${T("remaining")} ${fmtTime(total - used)})` : `${T("remaining")} ${fmtTime(rem)}`;
    return (<div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4, color: "var(--text)" }}>
        <span>SIDE {side} — {fmtTime(used)} / {fmtTime(eff)}{tailMargin > 0 && <span style={{ opacity: 0.5 }}> (tape {fmtTime(total)})</span>}</span>
        <span style={{ color: statusColor }}>{statusText}</span>
      </div>
      <div style={{ height: 6, background: "var(--bg-deep)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
        {softOver && !hardOver ? <>
          <div style={{ height: "100%", width: `${okPct}%`, background: sideColor, borderRadius: 3, transition: "width 0.3s,background 0.3s" }} />
          <div style={{ position: "absolute", left: `${okPct}%`, top: 0, bottom: 0, width: `${softPct}%`, background: "var(--warning)", transition: "left 0.3s,width 0.3s" }} />
        </> : <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 3, transition: "width 0.3s,background 0.3s" }} />}
        {tailMargin > 0 && <div style={{ position: "absolute", left: `${effPct}%`, top: 0, bottom: 0, width: 1, background: "var(--warning)", opacity: 0.6 }} />}
      </div>
    </div>);
  };

  const renderTimeLine = (st, total, eff, side) => {
    if (!st.length) return <div style={{ height: 40, background: "var(--bg-deep)", borderRadius: 6, border: "1px solid var(--border)" }} />;
    const segs = []; let off = 0;
    st.forEach((tr, i) => {
      segs.push({ type: "t", track: tr, start: off, dur: tr.duration }); off += tr.duration;
      if (i < st.length - 1) { const g = getGap(tr, st[i + 1]); segs.push({ type: "g", start: off, dur: g }); off += g; }
    });
    const dt = Math.max(off, total);
    const softOver = off > eff;
    const hardOver = off > total;
    return (<div style={{ height: 40, position: "relative", background: "var(--bg-deep)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
      {segs.map((s, i) => {
        const l = (s.start / dt) * 100, w = (s.dur / dt) * 100;
        if (s.type === "g") return null;
        const hue = (i * 47 + 25) % 360;
        return <div key={s.track.id} title={`${s.track.name} (${fmtTime(s.dur)})`} style={{
          position: "absolute", left: `${l}%`, width: `${Math.max(w, 0.5)}%`, height: "100%",
          background: `hsla(${hue},45%,55%,0.7)`, borderRight: "1px solid var(--bg-deep)",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          fontSize: 9, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.5)", padding: "0 2px", whiteSpace: "nowrap",
        }}>{w > 5 ? s.track.name : ""}</div>;
      })}
      {eff < total && <div style={{
        position: "absolute", left: `${(eff / dt) * 100}%`, top: 0, bottom: 0, width: 2,
        background: "var(--warning)", opacity: softOver ? 0.95 : 0.55, zIndex: 5
      }} />}
      {hardOver && <div style={{ position: "absolute", left: `${(total / dt) * 100}%`, top: 0, bottom: 0, width: 2, background: "var(--danger)", zIndex: 6 }} />}
    </div>);
  };

  const renderTrackRow = (tr, idx, st, targetSr, targetBits) => {
    const last = idx === st.length - 1;
    const first = idx === 0;
    const lvlPct = Math.min(100, Math.max(0, (tr.peakDb + 40) / 40 * 100));
    const lvlCol = tr.peakDb > -1 ? "var(--danger)" : tr.peakDb > -3 ? "var(--warning)" : "var(--accent)";
    const noA = !tr.audioBuffer;
    const effGap = last ? null : getGap(tr, st[idx + 1]);
    const fc = fmtColor(tr.format);
    const willResample = tr.audioBuffer && targetSr && tr.sampleRate !== targetSr;
    const srDir = willResample ? (tr.sampleRate > targetSr ? "↓" : "↑") : null;
    const willChangeBits = tr.audioBuffer && tr.bitDepth != null && targetBits && tr.bitDepth !== targetBits;
    const bitDir = willChangeBits ? (tr.bitDepth > targetBits ? "↓" : "↑") : null;
    return (<div key={tr.id} style={{ marginBottom: last ? 0 : 3 }}>
      <div draggable onDragStart={() => setDragItem(tr.id)} onDragEnd={() => setDragItem(null)}
        style={{
          display: "grid", gridTemplateColumns: "30px 1fr 70px 52px 32px 32px 42px 32px",
          alignItems: "center", gap: 5, padding: "8px 10px",
          background: dragItem === tr.id ? "var(--bg-hover)" : "var(--bg-card)", borderRadius: 5, fontSize: 14, cursor: "grab",
          border: `1px solid ${noA ? "var(--warning)" : "var(--border)"}`, opacity: noA ? 0.65 : 1, transition: "background 0.15s"
        }}>
        <span style={{ color: "var(--text-dim)", fontSize: 12, textAlign: "center" }}>{String(idx + 1).padStart(2, "0")}</span>
        <div style={{ overflow: "hidden" }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)", display: "flex", alignItems: "center", gap: 5, fontSize: 14 }}>
            {tr.format && tr.format !== "?" && <span style={{ fontSize: 9, background: fc.bg, color: fc.fg, padding: "1px 5px", borderRadius: 3, flexShrink: 0, letterSpacing: "0.03em" }}>{tr.format}</span>}
            {noA && <span style={{ fontSize: 9, background: "var(--warning)", color: "#fff", padding: "1px 5px", borderRadius: 3, flexShrink: 0 }}>{T("stubLabel")}</span>}
            {tr.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--text)", opacity: 0.65, display: "flex", gap: 8, marginTop: 3, alignItems: "center" }}>
            <span title={T("tipSampleRate")} style={willResample ? { color: srDir === "↓" ? "var(--warning)" : "var(--side-b)" } : {}}>{tr.sampleRate / 1000}kHz{willResample && <span style={{ fontSize: 9 }}> {srDir}{targetSr / 1000}k</span>}</span>
            <span title={T("tipBitDepth")} style={willChangeBits ? { color: bitDir === "↓" ? "var(--warning)" : "var(--side-b)" } : {}}>
              {tr.bitDepth != null ? `${tr.bitDepth}bit` : "—bit"}{willChangeBits && <span style={{ fontSize: 9 }}> {bitDir}{targetBits}bit</span>}
            </span>
            <span title={T("tipChannels")}>{tr.channels}ch</span>
            <span title={T("tipPeakLevel")} style={{ color: lvlCol }}>{tr.peakDb > -Infinity ? `${tr.peakDb.toFixed(1)}dB pk` : "—"}</span>
            {tr.headSilence > SILENCE_MIN_DUR && <span title={T("tipHeadSilence")} style={{ fontSize: 10 }}>head {tr.headSilence.toFixed(1)}s</span>}
            {tr.tailSilence > SILENCE_MIN_DUR && <span title={T("tipTailSilence")} style={{ fontSize: 10 }}>tail {tr.tailSilence.toFixed(1)}s</span>}
          </div>
        </div>
        <span style={{ fontSize: 13, color: "var(--text)", textAlign: "right" }}>{fmtTimeMs(tr.duration)}</span>
        <div style={{ height: 5, background: "var(--bg-deep)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${lvlPct}%`, background: lvlCol, borderRadius: 2 }} />
        </div>
        <button onClick={() => moveTrack(tr.id, -1)} disabled={first} style={btnSm} title={T("moveUp")}>↑</button>
        <button onClick={() => moveTrack(tr.id, 1)} disabled={last} style={btnSm} title={T("moveDown")}>↓</button>
        <button onClick={() => toggleSide(tr.id)} style={{ ...btnSm, color: "var(--accent)" }} title={`${T("moveToSide")} ${tr.side === "A" ? "B" : "A"}`}>{tr.side === "A" ? "→B" : "→A"}</button>
        <button onClick={() => removeTrack(tr.id)} style={{ ...btnSm, color: "var(--danger)" }} title={T("deleteTrack")}>✕</button>
      </div>
      {!last && effGap != null && (<div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px 3px 40px", fontSize: 12, color: "var(--text)", opacity: 0.75 }}>
        <span style={{ opacity: 0.4 }}>┄</span><span>{T("gap")}</span>
        <input type="number" value={tr.gapOverride != null ? tr.gapOverride : Number(effGap.toFixed(1))}
          onChange={e => setTrackGap(tr.id, e.target.value === "" ? null : parseFloat(e.target.value))}
          step="0.5" min="0" max="30" style={{ ...inpSm, width: 72 }} />
        <span>s</span>
        {smartGap && tr.gapOverride == null && <span style={{ fontSize: 11, color: "var(--text)", opacity: 0.5 }}>auto</span>}
        {tr.gapOverride != null && <button onClick={() => setTrackGap(tr.id, null)} style={{ ...btnSm, fontSize: 11, padding: "2px 6px", color: "var(--text)" }}>{T("resetGap")}</button>}
      </div>)}
    </div>);
  };

  const renderSidePanel = (side, st, dur) => {
    const active = activeTab === side;
    const audioTracks = st.filter(t => t.audioBuffer);
    const tSr = resolveExportSr(audioTracks);
    const tBits = resolveExportBits(audioTracks);
    const gains = buildPreviewGains(audioTracks);
    const wfSegments = audioTracks.map((t, i) => ({
      id: t.id,
      dur: t.duration,
      gain: gains[i],
      gap: i < audioTracks.length - 1 ? getGap(t, audioTracks[i + 1]) : 0,
      peaks: t.peaks || [],
      channels: t.channels,
    }));
    const specSegments = audioTracks.map((t, i) => ({
      id: t.id,
      dur: t.duration,
      gain: gains[i],
      gap: i < audioTracks.length - 1 ? getGap(t, audioTracks[i + 1]) : 0,
      spectrogram: t.spectrogram || null,
    }));
    return (<div onDragOver={e => { e.preventDefault(); setDragOverSide(side); }} onDragLeave={() => setDragOverSide(null)} onDrop={e => handleDrop(e, side)}
      style={{
        flex: 1, display: active ? "flex" : "none", flexDirection: "column", gap: 8, minHeight: 200,
        border: dragOverSide === side ? `2px dashed var(--side-${side.toLowerCase()})` : "2px solid transparent", transition: "border-color 0.2s"
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ flex: 1 }}>{renderCapBar(dur, sideSec, effectiveSec, side)}</div>
        {audioTracks.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>→ {tSr / 1000}kHz / {tBits}bit</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setSidePreviewMode("waveform")} style={segBtn(sidePreviewMode === "waveform")}>{T("previewWave")}</button>
            <button onClick={() => setSidePreviewMode("spectrogram")} style={segBtn(sidePreviewMode === "spectrogram")}>{T("previewSpectrogram")}</button>
          </div>
        </div>}
      </div>
      {renderTimeLine(st, sideSec, effectiveSec, side)}
      {(wfSegments.length > 0 || specSegments.length > 0) && (
        <div style={{ position: "relative", height: 128 }}>
          <div style={{
            position: "absolute", inset: 0,
            opacity: sidePreviewMode === "waveform" ? 1 : 0,
            pointerEvents: sidePreviewMode === "waveform" ? "auto" : "none"
          }}>
            <SideWaveform segments={wfSegments} />
          </div>
          <div style={{
            position: "absolute", inset: 0,
            opacity: sidePreviewMode === "spectrogram" ? 1 : 0,
            pointerEvents: sidePreviewMode === "spectrogram" ? "auto" : "none"
          }}>
            <SideSpectrogram segments={specSegments} />
          </div>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
        {st.length === 0 ? (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px dashed var(--border)", borderRadius: 6, minHeight: 120,
            color: "var(--text-dim)", fontSize: 13, flexDirection: "column", gap: 6
          }}>
            <span style={{ fontSize: 24, opacity: 0.3 }}>📼</span>
            <span>{T("dropHere")}</span>
            <span style={{ fontSize: 10, opacity: 0.6 }}>{T("dropHint")}</span>
          </div>
        ) : st.map((tr, i) => renderTrackRow(tr, i, st, tSr, tBits))}
      </div>
    </div>);
  };

  const aHas = sideA.some(t => t.audioBuffer), bHas = sideB.some(t => t.audioBuffer);
  const calibrationSignal = resolveCalibrationSignal(calibrationSignalType, calibrationSide);

  return (
    <div style={{
      "--bg": th.bg, "--bg-card": th.bgCard, "--bg-deep": th.bgDeep, "--bg-hover": th.bgHover || "#F0EDEA",
      "--text": th.text || "#2D2D38", "--text-dim": th.textDim || "#706B78", "--accent": th.accent, "--accent-dim": th.accentDim,
      "--accent-contrast": accentContrast, "--accent-ink": accentInk,
      "--border": th.border, "--danger": "#C45C5C", "--warning": warningColor,
      "--side-a": sideColors.sideA, "--side-b": sideColors.sideB,
      "--font-mono": "'JetBrains Mono','SF Mono','Fira Code',monospace",
      "--font-body": "'Noto Sans SC','Noto Sans JP','Hiragino Sans','Microsoft YaHei',sans-serif",
      fontFamily: "var(--font-body)", color: "var(--text)", background: "var(--bg)",
      minHeight: "100vh", padding: "20px 24px", boxSizing: "border-box", position: "relative"
    }}>

      {toast && <div style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 999,
        background: "var(--bg-card)", border: "1px solid var(--accent)", borderRadius: 8,
        padding: "10px 20px", fontSize: 12, color: "var(--accent)", maxWidth: "90vw",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)", animation: "fadeIn 0.2s ease"
      }}>{toast}</div>}

      {showTools && <div onClick={() => setShowTools(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: "var(--bg)", borderRadius: 14, width: "min(840px, calc(100vw - 32px))", maxHeight: "80vh", overflow: "hidden",
          border: "1px solid var(--border)", boxShadow: "0 12px 36px rgba(0,0,0,0.16)", color: "var(--text)", display: "flex", flexDirection: "column"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ fontSize: 16, color: "var(--accent-ink)" }}>{T("tools")}</div>
            <button onClick={() => setShowTools(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-dim)" }}>✕</button>
          </div>

          <div className="modalScroll" style={{ display: "grid", gridTemplateColumns: "180px minmax(0,1fr)", minHeight: 0, overflowY: "auto" }}>
            <div style={{ padding: 16, borderRight: "1px solid var(--border)", background: "var(--bg-card)" }}>
              <button onClick={() => setActiveTool("rec-cal")} style={{
                width: "100%", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left",
                background: activeTool === "rec-cal" ? "var(--accent-dim)" : "var(--bg)", color: activeTool === "rec-cal" ? "var(--accent-ink)" : "var(--text)"
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{T("toolRecCal")}</div>
                <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-dim)" }}>{T("toolRecCalCardDesc")}</div>
              </button>
            </div>

            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
              {activeTool === "rec-cal" && <>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-ink)", marginBottom: 6 }}>{T("toolDescTitle")}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-dim)" }}>{T("toolRecCalDesc")}</div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <label style={{ ...lb, margin: 0 }}>{T("toolSelectedSide")}</label>
                  {["A", "B"].map((side) => (
                    <button key={side} onClick={() => setCalibrationSide(side)} style={{
                      ...btnTab, minWidth: 54,
                      background: calibrationSide === side ? `var(--side-${side.toLowerCase()})` : "var(--bg-deep)",
                      color: calibrationSide === side ? getContrastColor(side === "A" ? sideColors.sideA : sideColors.sideB) : "var(--text)"
                    }} disabled={calibrationRunning || calibrationSignalType !== "rec_level_balance"}>
                      SIDE {side}
                    </button>
                  ))}
                  <button onClick={calibrationRunning ? stopCalibration : startCalibration} disabled={processing} style={{
                    ...btnS, padding: "8px 14px",
                    borderColor: calibrationRunning ? "var(--danger)" : "var(--accent)",
                    color: calibrationRunning ? "var(--danger)" : "var(--accent-ink)"
                  }}>
                    {calibrationRunning ? T("toolStop") : T("toolStart")}
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ ...lb, margin: 0 }}>{T("toolSignalPick")}</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    {CALIBRATION_SIGNAL_PRESETS.map((preset) => (
                      <button key={preset.id} onClick={() => setCalibrationSignalType(preset.id)} disabled={calibrationRunning} style={{
                        border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left",
                        background: calibrationSignalType === preset.id ? "var(--accent-dim)" : "var(--bg-card)",
                        color: calibrationSignalType === preset.id ? "var(--accent-ink)" : "var(--text)"
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{T(preset.nameKey)}</div>
                        <div style={{ fontSize: 11, lineHeight: 1.7, color: "var(--text-dim)" }}>{T(preset.descKey)}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
                  <div style={{ minWidth: 210, flex: "1.35 1 0", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{T("toolSignalSource")}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.7 }}>{T(calibrationSignal.sourceKey)}</div>
                  </div>
                  <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{T("toolSignalFreq")}</div>
                    <div style={{ fontSize: 15, color: "var(--text)" }}>{calibrationSignal.freqHz} Hz sine</div>
                  </div>
                  <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{T("toolSignalLevel")}</div>
                    <div style={{ fontSize: 15, color: "var(--text)" }}>{Number.isFinite(calibrationSignal.levelDb) ? `${calibrationSignal.levelDb.toFixed(1)} dBFS peak` : "−∞ dBFS"}</div>
                  </div>
                  <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{T("toolStereoMode")}</div>
                    <div style={{ fontSize: 15, color: "var(--text)" }}>{T("toolStereoDualMono")}</div>
                  </div>
                </div>
              </>}
            </div>
          </div>
        </div>
      </div>}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 14, fontWeight: 400, margin: 0, letterSpacing: "0.02em", lineHeight: 1.4 }}>
            <span style={{ color: "var(--accent)" }}>◉ </span>
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--accent)" }}>S</span><span style={{ fontSize: 11, opacity: 0.55 }}>equential</span>{" "}
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--accent)" }}>I</span><span style={{ fontSize: 11, opacity: 0.55 }}>nterleaved</span>{" "}
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--accent)" }}>D</span><span style={{ fontSize: 11, opacity: 0.55 }}>ubbing</span>{" "}
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--accent)" }}>E</span><span style={{ fontSize: 11, opacity: 0.55 }}>ngine</span>
          </h1>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3, fontStyle: "italic", opacity: 0.75 }}>{T("appTagline")}</div>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{T("appVersion")}</span>
        <HeaderControls lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} onOpenTools={openTools} T={T} />
      </div>

      {/* Config */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {/* Row 1: Tape physical params */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", padding: "12px 16px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={lb}>{T("tapeSpec")}</label>
            <div style={{ display: "flex", gap: 3 }}>
              {Object.entries(TAPE_PRESETS).map(([k, p]) => (
                <button key={k} onClick={() => setTapePreset(k)} style={{
                  ...btnTab,
                  background: tapePreset === k ? "var(--accent)" : "var(--bg-deep)", color: tapePreset === k ? "var(--accent-contrast)" : "var(--text)"
                }}>{p.label}</button>
              ))}
              <button onClick={() => setTapePreset("CUSTOM")} style={{
                ...btnTab,
                background: tapePreset === "CUSTOM" ? "var(--accent)" : "var(--bg-deep)", color: tapePreset === "CUSTOM" ? "var(--accent-contrast)" : "var(--text)"
              }}>{T("tapeCustom")}</button>
            </div>
            {tapePreset === "CUSTOM" && <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              <input type="number" value={customMin} onChange={e => setCustomMin(Number(e.target.value))} min={1} max={120} style={{ ...inpSm, width: 52 }} />
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{T("minPerSide")}</span>
            </div>}
          </div>

          <div style={{ width: 1, height: 40, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <label style={lb}>{T("tapeType")}</label>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{TAPE_TYPES[tapeType].desc} · {T("recLevel")} {TAPE_TYPES[tapeType].peakDb}dB · {T("tapeTypeNote")}</span>
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              {Object.entries(TAPE_TYPES).map(([k, tp]) => {
                const tapeColor = tapeTypeColors[k];
                return (
                  <button key={k} onClick={() => { setTapeType(k); setTargetDb(tp.peakDb); }} style={{
                    ...btnTab,
                    background: tapeType === k ? tapeColor : "var(--bg-deep)",
                    color: tapeType === k ? getContrastColor(tapeColor) : tapeColor,
                    border: `1px solid ${tapeColor}`,
                    boxShadow: tapeType === k ? "inset 0 0 0 1px rgba(255,255,255,0.18)" : "none"
                  }}>{tp.label.split(" ")[0]} {tp.label.split(" ")[1]}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: Audio processing params */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 16px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)", flexWrap: "wrap" }}>
          {/* Gap */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ ...lb, margin: 0 }}>{T("defaultGap")}</label>
            <input type="range" min={0} max={10} step={0.5} value={defaultGap} onChange={e => setDefaultGap(Number(e.target.value))} style={{ width: 72, accentColor: "var(--accent)" }} />
            <span style={{ fontSize: 12, minWidth: 32 }}>{defaultGap.toFixed(1)}s</span>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />

          {/* Smart gap toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ ...lb, margin: 0 }}>{T("smartGap")}</label>
            <button onClick={() => setSmartGap(!smartGap)} style={toggleStyle(smartGap)}>{smartGap ? "ON" : "OFF"}</button>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />

          {/* Normalize */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ ...lb, margin: 0 }}>{T("normalize")}</label>
            <div style={{ display: "flex", gap: 2 }}>
              {[["off", "normOff"], ["peak", "normPeak"], ["rms", "normRms"]].map(([v, k]) => (
                <button key={v} onClick={() => setNormalizeMode(v)} style={{
                  ...btnTab, fontSize: 12, padding: "4px 10px",
                  background: normalizeMode === v ? "var(--accent-dim)" : "var(--bg-deep)", color: normalizeMode === v ? "var(--accent-ink)" : "var(--text)"
                }}>{T(k)}</button>
              ))}
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />

          {/* Tail fill */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ ...lb, margin: 0 }}>{T("tailFill")}</label>
            <button onClick={() => setFillTail(!fillTail)} style={toggleStyle(fillTail)}>{fillTail ? "ON" : "OFF"}</button>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />

          {/* Tail margin */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ ...lb, margin: 0 }}>{T("tailMargin")}</label>
            <input type="number" value={tailMargin} onChange={e => setTailMargin(Math.max(0, Number(e.target.value)))} min={0} max={10} step={0.5} style={{ ...inpSm, width: 52 }} />
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>min</span>
          </div>

          <div style={{ flexBasis: "100%", height: 0 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ ...lb, margin: 0 }}>{T("sampleRate")}</label>
              <div style={{ display: "flex", gap: 2 }}>
                {[["auto", "Auto"], ["44100", "44.1k"], ["48000", "48k"]].map(([v, label]) => {
                  const val = v === "auto" ? "auto" : Number(v);
                  return <button key={v} onClick={() => setExportSr(val)} style={{
                    ...btnTab, fontSize: 12, padding: "5px 10px",
                    background: exportSr === val ? "var(--accent-dim)" : "var(--bg-deep)", color: exportSr === val ? "var(--accent-ink)" : "var(--text)"
                  }}>{label}</button>;
                })}
              </div>
            </div>
            <div style={{ width: 1, height: 20, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ ...lb, margin: 0 }}>{T("bitDepth")}</label>
              <div style={{ display: "flex", gap: 2 }}>
                {[["auto", "Auto"], ["16", "16bit"], ["24", "24bit"]].map(([v, label]) => {
                  const val = v === "auto" ? "auto" : Number(v);
                  return <button key={v} onClick={() => setExportBits(val)} style={{
                    ...btnTab, fontSize: 12, padding: "5px 10px",
                    background: exportBits === val ? "var(--accent-dim)" : "var(--bg-deep)", color: exportBits === val ? "var(--accent-ink)" : "var(--text)"
                  }}>{label}</button>;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="actionBar" style={{ marginBottom: 12 }}>
        <input ref={fileRef} type="file" multiple accept="audio/*" style={{ display: "none" }}
          onChange={e => { if (e.target.files.length > 0) loadFiles(Array.from(e.target.files), activeTab); e.target.value = ""; }} />
        <input ref={plRef} type="file" accept=".json" style={{ display: "none" }} onChange={importPL} />
        <div className="actionBarMain">
          <button onClick={() => fileRef.current?.click()} style={btnP} disabled={processing}><IconAdd size={16} /> {T("addFiles")} → SIDE {activeTab}</button>
          <button onClick={autoDistribute} style={btnS} disabled={processing || !tracks.length}><IconAutoAwesome size={16} /> {T("autoDistribute")}</button>
          <button onClick={() => plRef.current?.click()} style={btnS} disabled={processing}><IconFileOpen size={16} /> {T("importPlaylist")}</button>
          <button onClick={exportPL} style={btnS} disabled={processing || !tracks.length}><IconSave size={16} /> {T("exportPlaylist")}</button>
          <button onClick={() => { if (tracks.some(t => t.side === activeTab)) setTracks(p => p.filter(t => t.side !== activeTab)); }} style={{ ...btnS, display: "flex", alignItems: "center", gap: 4 }} disabled={processing || !tracks.some(t => t.side === activeTab)}><IconClearSide size={14} />{T("clearSide")}</button>
          <button onClick={() => { if (tracks.length > 0 && window.confirm(T("clearAll") + "?")) setTracks([]); }} style={{ ...btnS, display: "flex", alignItems: "center", gap: 4 }} disabled={processing || !tracks.length}><IconClearAll size={14} />{T("clearAll")}</button>
        </div>
        <div className="actionBarPlayback">
          {playing ?
            <button onClick={stopPlayback} style={{ ...btnE, borderColor: "var(--danger)", color: "var(--danger)" }}><IconStop size={16} /> {T("stop")}</button>
            : <>
              <button onClick={() => playSide("A")} style={{ ...btnE, borderColor: "var(--side-a)", color: "var(--side-a)", background: mixHex(sideColors.sideA, th.bgCard, 0.9) }} disabled={processing || !aHas}><IconPlay size={16} /> A {T("play")}</button>
              <button onClick={() => playSide("B")} style={{ ...btnE, borderColor: "var(--side-b)", color: "var(--side-b)", background: mixHex(sideColors.sideB, th.bgCard, 0.92) }} disabled={processing || !bHas}><IconPlay size={16} /> B {T("play")}</button>
            </>}
          <button onClick={() => expSide("A")} style={{ ...btnE, borderColor: "var(--side-a)", color: "var(--side-a)", background: mixHex(sideColors.sideA, th.bgCard, 0.9) }} disabled={processing || playing || !aHas}><IconExport size={16} /> A {T("exportSide")}</button>
          <button onClick={() => expSide("B")} style={{ ...btnE, borderColor: "var(--side-b)", color: "var(--side-b)", background: mixHex(sideColors.sideB, th.bgCard, 0.92) }} disabled={processing || playing || !bHas}><IconExport size={16} /> B {T("exportSide")}</button>
        </div>
      </div>

      {/* Player */}
      {playing && <Player
        playing={playing} paused={paused} playingSide={playingSide}
        playingIdxRef={displayIdxRef} playPosRef={displayPosRef}
        playToken={playbackView.token}
        schedule={playbackView.schedule} totalDur={playbackView.totalDur}
        meterMode={meterMode} setMeterMode={setMeterMode}
        simMode={simMode} setSimMode={setSimMode}
        deckProfile={deckProfile} setDeckProfile={setDeckProfile}
        toneProfile={toneProfile} setToneProfile={setToneProfile}
        tubeEnabled={tubeEnabled} setTubeEnabled={setTubeEnabled}
        vinylEra={vinylEra} setVinylEra={setVinylEra}
        vinylCrackle={vinylCrackle} setVinylCrackle={setVinylCrackle}
        playerVolume={playerVolume} setPlayerVolume={setPlayerVolume}
        togglePause={togglePause} stopPlayback={stopPlayback}
        skipTrack={skipTrack} seekTo={seekTo}
        analyserL={analyserRef.current.L} analyserR={analyserRef.current.R}
        T={T} fmtTime={fmtTime}
      />}

      {processing && <div style={{
        padding: "8px 12px", marginBottom: 12, background: "var(--bg-deep)", borderRadius: 6,
        fontSize: 13, color: "var(--accent-ink)", display: "flex", alignItems: "center", gap: 8
      }}>
        <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
        <span>{procMsg}</span>
      </div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
        {["A", "B"].map(s => {
          const st = s === "A" ? sideA : sideB, dur = s === "A" ? durA : durB, hardOver = dur > sideSec, softOver = !hardOver && dur > effectiveSec;
          const badgeColor = hardOver ? "var(--danger)" : softOver ? "var(--warning)" : "var(--text-dim)";
          const sideColor = s === "A" ? sideColors.sideA : sideColors.sideB;
          return (<button key={s} onClick={() => setActiveTab(s)} onDragOver={e => { e.preventDefault(); setActiveTab(s); }}
            style={{
              flex: 1, padding: "10px 16px",
              background: activeTab === s ? mixHex(sideColor, th.bgCard, 0.9) : "transparent",
              color: activeTab === s ? `var(--side-${s.toLowerCase()})` : "var(--text-dim)",
              border: "none", borderBottom: activeTab === s ? `2px solid var(--side-${s.toLowerCase()})` : "2px solid var(--border)",
              cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "var(--font-body)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s"
            }}>
            <span style={{ fontSize: 13, letterSpacing: "0.1em" }}>SIDE {s}</span>
            <span style={{
              fontSize: 12, color: activeTab === s ? sideColor : badgeColor,
              background: activeTab === s ? mixHex(sideColor, th.bgDeep, 0.82) : "var(--bg-deep)", padding: "2px 6px", borderRadius: 3
            }}>
              {st.length}{T("tracks")} · {fmtTime(dur)}
            </span>
          </button>);
        })}
      </div>

      <div style={{ minHeight: 300 }}>
        {renderSidePanel("A", sideA, durA)}
        {renderSidePanel("B", sideB, durB)}
      </div>

      {tracks.length > 0 && <div style={{
        position: "sticky", bottom: 0, zIndex: 10, padding: "10px 20px",
        background: "var(--bg)", borderTop: "1px solid var(--border)",
        fontSize: 12, color: "var(--text)", opacity: 0.8, display: "flex", gap: 16, flexWrap: "wrap"
      }}>
        <span>{T("total")} {tracks.length}{T("tracks")}</span>
        <span>A: {fmtTime(durA)} / {fmtTime(effectiveSec)}</span>
        <span>B: {fmtTime(durB)} / {fmtTime(effectiveSec)}</span>
        <span>{T("tape")}: {tapePreset === "CUSTOM" ? `${customMin * 2}min` : TAPE_PRESETS[tapePreset].label}</span>
        <span>{T("type")}: {TAPE_TYPES[tapeType].label}</span>
        {tailMargin > 0 && <span>{T("tailMargin")}: {tailMargin}min</span>}
        <span>{T("smartGap")}: {smartGap ? "ON" : "OFF"}</span>
        <span>{T("normalize")}: {normalizeMode === "off" ? "OFF" : normalizeMode === "peak" ? T("normPeak") : T("normRms")}</span>
        <span>WAV: {exportSr === "auto" ? "Auto" : exportSr / 1000 + "kHz"}/{exportBits === "auto" ? "Auto" : exportBits + "bit"}</span>
        <span style={{ color: ffmpegStatus === "ready" ? "#82B891" : ffmpegStatus === "unavailable" ? "var(--danger)" : "var(--text-dim)" }}>
          ffmpeg: {ffmpegStatus === "ready" ? "✓" : ffmpegStatus === "loading" ? "…" : ffmpegStatus === "unavailable" ? "✕" : "standby"}
        </span>
      </div>}

      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        *{box-sizing:border-box}
        .actionBar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}
        .actionBarMain,.actionBarPlayback{display:flex;gap:8px;flex-wrap:wrap}
        .actionBarPlayback{justify-content:flex-end}
        @media (max-width: 1220px){
          .actionBar{grid-template-columns:1fr}
          .actionBarPlayback{justify-content:flex-start}
        }
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--bg-deep)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
        .modalScroll{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
        .modalScroll::-webkit-scrollbar{width:10px}
        .modalScroll::-webkit-scrollbar-track{background:transparent;margin:10px 0}
        .modalScroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px;border:3px solid transparent;background-clip:content-box}
        input[type="number"]{-moz-appearance:textfield}input[type="number"]::-webkit-inner-spin-button{opacity:0.5}
        .playerVolRange{-webkit-appearance:none;appearance:none;height:16px;background:transparent;outline:none}
        .playerVolRange::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:linear-gradient(to right,var(--accent) 0,var(--accent) var(--vol-pct),var(--accent-dim) var(--vol-pct),var(--accent-dim) 100%)}
        .playerVolRange::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;border-radius:50%;background:var(--bg-card);border:2px solid var(--accent);margin-top:-4px;box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 18%, transparent)}
        .playerVolRange::-moz-range-track{height:4px;border:none;border-radius:999px;background:var(--accent-dim)}
        .playerVolRange::-moz-range-progress{height:4px;border:none;border-radius:999px;background:var(--accent)}
        .playerVolRange::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--bg-card);border:2px solid var(--accent)}
        button:disabled{opacity:0.35;cursor:not-allowed}button:not(:disabled):hover{filter:brightness(0.95)}
      `}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────
const lb = { fontSize: 13, color: "var(--text)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 400 };
const btnTab = { padding: "7px 14px", border: "1px solid var(--border)", borderRadius: 5, cursor: "pointer", fontSize: 14, fontFamily: "inherit", transition: "all 0.15s", fontWeight: 400 };
const btnSm = { background: "transparent", border: "1px solid var(--border)", borderRadius: 3, color: "var(--text-dim)", cursor: "pointer", fontSize: 12, padding: "3px 8px", transition: "all 0.15s" };
const inpSm = { background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: 14, padding: "5px 9px", outline: "none" };
const btnP = { padding: "10px 20px", background: "var(--accent)", color: "var(--accent-contrast)", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 400, fontFamily: "inherit", transition: "all 0.15s" };
const btnS = { padding: "10px 20px", background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 14, fontFamily: "inherit", transition: "all 0.15s" };
const btnE = { padding: "10px 20px", background: "var(--bg-deep)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 14, transition: "all 0.15s" };
const segBtn = (on) => ({ padding: "4px 10px", background: on ? "var(--accent-dim)" : "var(--bg-deep)", color: on ? "var(--accent-ink)" : "var(--text-dim)", border: "1px solid var(--border)", borderRadius: 999, cursor: "pointer", fontSize: 11, fontFamily: "inherit", transition: "all 0.15s" });
const toggleStyle = (on) => ({
  padding: "5px 16px", borderRadius: 12, border: "none", cursor: "pointer",
  fontSize: 12, fontWeight: 600, transition: "all 0.2s", letterSpacing: "0.05em",
  background: on ? "var(--accent)" : "var(--bg-deep)", color: on ? "var(--accent-contrast)" : "var(--text-dim)"
});
