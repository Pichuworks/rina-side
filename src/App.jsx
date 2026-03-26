import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { transcodeToWav, likelyNeedsTranscode } from "./ffmpeg-helper.js";
import { IconAdd, IconAutoAwesome, IconFileOpen, IconSave, IconPlay, IconStop, IconExport, IconHelp, IconClearSide, IconClearAll, IconPalette, IconInfo } from "./Icons.jsx";
import Player from "./Player.jsx";
import SideWaveform from "./SideWaveform.jsx";
import SideSpectrogram from "./SideSpectrogram.jsx";

// ═══════════════════════════════════════════════════════════════
// SIDE — Sequential Interleaved Dubbing Engine
// 阿佐谷202室 磁带転写ツール
// ver 0.9 Release Candidate I
// by 天使天才天王寺璃奈 (Angel, Genius, Tennoji Rina)
// ═══════════════════════════════════════════════════════════════

const APP_VERSION = "0.9 Release Candidate I";
const APP_GITHUB = "https://github.com/Pichuworks/rina-side";

// ── i18n ─────────────────────────────────────────────────────
const LANGS = { "zh-CN": { label: "简体中文" }, ja: { label: "日本語" }, en: { label: "EN" } };

const I18N = {
  appTitle:        { "zh-CN": "SIDE — 磁带转录引擎", ja: "SIDE — 磁帯転写エンジン", en: "SIDE — Cassette Dubbing Engine" },
  appSubtitle:     { "zh-CN": "阿佐谷202室 · 磁带转录工具", ja: "阿佐ヶ谷202号室 · 磁帯転写ツール", en: "Asagaya Room 202 · Cassette Transcription Tool" },
  appVersion:      { "zh-CN": `Ver ${APP_VERSION} · by 天使天才天王寺璃奈`, ja: `Ver ${APP_VERSION} · by 天使天才天王寺璃奈`, en: `Ver ${APP_VERSION} · by Angel, Genius, Tennoji Rina` },
  tapeSpec:        { "zh-CN": "磁带规格", ja: "テープ規格", en: "Tape Format" },
  tapeCustom:      { "zh-CN": "自定义", ja: "カスタム", en: "Custom" },
  minPerSide:      { "zh-CN": "分钟/面", ja: "min/面", en: "min/side" },
  tapeType:        { "zh-CN": "磁带类型", ja: "テープ種類", en: "Tape Type" },
  recLevel:        { "zh-CN": "录音电平", ja: "録音レベル", en: "Rec Level" },
  defaultGap:      { "zh-CN": "默认曲间间隔", ja: "デフォルト曲間", en: "Default Track Gap" },
  normalize:       { "zh-CN": "响度归一化", ja: "ラウドネス正規化", en: "Loudness Normalization" },
  normPeak:        { "zh-CN": "峰值", ja: "ピーク", en: "Peak" },
  normRms:         { "zh-CN": "均方根", ja: "RMS", en: "RMS" },
  normOff:         { "zh-CN": "关闭", ja: "OFF", en: "OFF" },
  tailFill:        { "zh-CN": "尾部静音填充", ja: "末尾無音パディング", en: "Tail Silence Padding" },
  tailMargin:      { "zh-CN": "尾部预留余量", ja: "末尾マージン", en: "Tail Margin Reserve" },
  smartGap:        { "zh-CN": "智能间隔检测", ja: "スマートギャップ検出", en: "Smart Gap Detection" },
  smartGapDesc:    { "zh-CN": "分析音轨首尾静音，自动计算最优间隔", ja: "トラック先頭/末尾の無音を解析し最適ギャップを自動算出", en: "Analyze head/tail silence of tracks to compute optimal gaps" },
  addFiles:        { "zh-CN": "添加文件", ja: "ファイル追加", en: "Add Files" },
  autoDistribute:  { "zh-CN": "自动分面", ja: "自動振り分け", en: "Auto Distribute" },
  exportSide:      { "zh-CN": "导出", ja: "書出し", en: "Export" },
  importPlaylist:  { "zh-CN": "导入歌单", ja: "プレイリスト読込", en: "Import Playlist" },
  exportPlaylist:  { "zh-CN": "导出歌单", ja: "プレイリスト保存", en: "Export Playlist" },
  dropHere:        { "zh-CN": "将音频文件拖放至此处", ja: "ここにオーディオファイルをドロップ", en: "Drop audio files here" },
  dropHint:        { "zh-CN": "或点击上方按钮选择文件", ja: "または上のボタンでファイルを選択", en: "or use the button above to browse" },
  tracks:          { "zh-CN": "曲", ja: "曲", en: " tracks" },
  exceeded:        { "zh-CN": "超出", ja: "超過", en: "over" },
  remaining:       { "zh-CN": "剩余", ja: "残り", en: "left" },
  moveUp:          { "zh-CN": "上移", ja: "上へ", en: "Move up" },
  moveDown:        { "zh-CN": "下移", ja: "下へ", en: "Move down" },
  moveToSide:      { "zh-CN": "移至 SIDE", ja: "SIDE へ移動", en: "Move to SIDE" },
  deleteTrack:     { "zh-CN": "删除音轨", ja: "トラック削除", en: "Delete track" },
  gap:             { "zh-CN": "间隔", ja: "ギャップ", en: "gap" },
  resetGap:        { "zh-CN": "重置", ja: "リセット", en: "reset" },
  tipSampleRate:   { "zh-CN": "采样率", ja: "サンプルレート", en: "Sample rate" },
  tipBitDepth:     { "zh-CN": "位深", ja: "ビット深度", en: "Bit depth" },
  tipChannels:     { "zh-CN": "声道数", ja: "チャンネル数", en: "Channels" },
  tipPeakLevel:    { "zh-CN": "峰值电平", ja: "ピークレベル", en: "Peak level" },
  tipHeadSilence:  { "zh-CN": "音轨头部静音长度", ja: "トラック先頭の無音", en: "Head silence duration" },
  tipTailSilence:  { "zh-CN": "音轨尾部静音长度", ja: "トラック末尾の無音", en: "Tail silence duration" },
  tapeTypeNote:    { "zh-CN": "影响归一化目标电平", ja: "正規化ターゲットレベルに影響", en: "Affects normalization target level" },
  appTagline:      { "zh-CN": "……把声音编译进磁带里。", ja: "……音をテープにコンパイルする。", en: "…compile your sound into tape." },
  decoding:        { "zh-CN": "解码中", ja: "デコード中", en: "Decoding" },
  rendering:       { "zh-CN": "离线渲染中", ja: "オフラインレンダリング中", en: "Offline rendering" },
  encoding:        { "zh-CN": "WAV 编码中", ja: "WAVエンコード中", en: "Encoding WAV" },
  total:           { "zh-CN": "共计", ja: "計", en: "Total" },
  tape:            { "zh-CN": "磁带", ja: "テープ", en: "Tape" },
  type:            { "zh-CN": "类型", ja: "種類", en: "Type" },
  playlistExported:       { "zh-CN": "歌单已导出", ja: "プレイリストを保存しました", en: "Playlist exported" },
  playlistImportNoAudio:  { "zh-CN": "歌单已加载（含占位曲目）。请重新添加对应音频文件，系统会自动按文件名匹配。", ja: "プレイリストを読み込みました（プレースホルダあり）。対応するオーディオファイルを再追加してください。", en: "Playlist loaded (with placeholders). Re-add audio files — they will auto-match by filename." },
  stubsHydrated:          { "zh-CN": "个 stub 音轨已匹配到音频文件", ja: "個のstubトラックにオーディオを紐付けました", en: "stub track(s) matched to audio" },
  exportHasStubs:         { "zh-CN": "当前面包含未匹配音频的 stub 音轨，导出时将跳过这些音轨。确定继续？", ja: "この面には未マッチングのstubトラックがあります。書出し時にスキップされます。続行しますか？", en: "This side contains stub tracks without audio. They will be skipped during export. Continue?" },
  sampleRate:             { "zh-CN": "采样率", ja: "サンプルレート", en: "Sample Rate" },
  bitDepth:               { "zh-CN": "位深", ja: "ビット深度", en: "Bit Depth" },
  play:                   { "zh-CN": "试听", ja: "試聴", en: "Preview" },
  stop:                   { "zh-CN": "停止", ja: "停止", en: "Stop" },
  pause:                  { "zh-CN": "暂停", ja: "一時停止", en: "Pause" },
  resume:                 { "zh-CN": "继续", ja: "再開", en: "Resume" },
  nowPlaying:             { "zh-CN": "正在播放", ja: "再生中", en: "Now playing" },
  previewWave:            { "zh-CN": "波形", ja: "波形", en: "Wave" },
  previewSpectrogram:     { "zh-CN": "声谱图", ja: "スペクトログラム", en: "Spectrogram" },
  stubLabel:              { "zh-CN": "占位曲目", ja: "プレースホルダ", en: "placeholder" },
  clearSide:              { "zh-CN": "清空当前面", ja: "この面をクリア", en: "Clear this side" },
  clearAll:               { "zh-CN": "清空全部", ja: "全てクリア", en: "Clear all" },
  resampleWarn:           { "zh-CN": "以下音轨将被降采样", ja: "以下のトラックはダウンサンプリングされます", en: "The following tracks will be downsampled" },
  bitDepthWarn:           { "zh-CN": "以下音轨将发生位深转换", ja: "以下のトラックはビット深度変換されます", en: "The following tracks will change bit depth" },
  prevTrack:              { "zh-CN": "上一曲", ja: "前の曲", en: "Previous" },
  nextTrack:              { "zh-CN": "下一曲", ja: "次の曲", en: "Next" },
  playlistImportError:    { "zh-CN": "歌单文件解析失败", ja: "プレイリスト解析エラー", en: "Failed to parse playlist" },
  effectiveCapacity:      { "zh-CN": "有效容量", ja: "実効容量", en: "Effective capacity" },
  help:                   { "zh-CN": "帮助", ja: "ヘルプ", en: "Help" },
  theme:                  { "zh-CN": "主题配色", ja: "テーマ配色", en: "Theme" },
  about:                  { "zh-CN": "关于", ja: "About", en: "About" },
};

function t(key, lang) { const e = I18N[key]; return e ? (e[lang] || e["zh-CN"] || key) : key; }
function themeName(key, lang) {
  const names = THEME_NAMES[key];
  return names ? (names[lang] || names["zh-CN"] || key) : key;
}
const RINA_SMILE = "[^_^]";

// ── Constants ────────────────────────────────────────────────
// ── Character Themes ────────────────────────────────────────
// Colors based on official 応援色, adjusted for UI readability
const THEMES = {
  default:  {accent:"#D4859A",bg:"#E8ECF2",bgCard:"#F4F6FA",bgDeep:"#DCE2EA",border:"#C8CED8",accentDim:"#F2D6DE",group:""},
  keke:     {accent:"#49BDF0",bg:"#F2F7FA",bgCard:"#FAFCFF",bgDeep:"#E4EEF5",border:"#C8D8E4",accentDim:"#CCE8FA",group:"liella"},
  tomori:   {accent:"#77BBDD",bg:"#F2F6F9",bgCard:"#FAFCFF",bgDeep:"#E4EDF4",border:"#C8D5DF",accentDim:"#D0E5F3",group:"mygo"},
  raana:    {accent:"#77DD77",bg:"#F2F8F2",bgCard:"#FAFFFA",bgDeep:"#E2EEE2",border:"#C5D8C5",accentDim:"#C8F0C8",group:"mygo"},
  soyo:     {accent:"#FFDD88",bg:"#FAF8F2",bgCard:"#FFFEF8",bgDeep:"#F2EEDD",border:"#DDD8C8",accentDim:"#F5EDC8",group:"mygo"},
  anon:     {accent:"#FF8899",bg:"#FAF3F4",bgCard:"#FFFAFB",bgDeep:"#F2E6E8",border:"#E0D0D4",accentDim:"#FFD8DF",group:"mygo"},
  taki:     {accent:"#7777AA",bg:"#F4F3F8",bgCard:"#FBFAFF",bgDeep:"#E6E3F0",border:"#D0CDD9",accentDim:"#D4D0E8",group:"mygo"},
  sakiko:   {accent:"#7799CC",bg:"#F2F5F9",bgCard:"#FAFBFF",bgDeep:"#E4ECF4",border:"#C8D2DF",accentDim:"#CCDCF0",group:"mujica"},
  mutsumi:  {accent:"#779977",bg:"#F3F7F3",bgCard:"#FAFFF9",bgDeep:"#E4EDE3",border:"#C8D5C6",accentDim:"#CCE0CC",group:"mujica"},
  nyamu:    {accent:"#AA4477",bg:"#F8F2F5",bgCard:"#FFFAFC",bgDeep:"#F0E4EA",border:"#DDD0D6",accentDim:"#E8C4D6",group:"mujica"},
  hatsuka:  {accent:"#BB9955",bg:"#F8F6F0",bgCard:"#FFFDF8",bgDeep:"#EFEBDF",border:"#D8D2C2",accentDim:"#E8DCC0",group:"mujica"},
  uika:     {accent:"#335566",bg:"#F0F4F6",bgCard:"#F8FBFC",bgDeep:"#E0E8EC",border:"#C4D0D6",accentDim:"#BCCDD8",group:"mujica"},
};
const THEME_ORDER = ["default","keke","tomori","raana","soyo","anon","taki","sakiko","mutsumi","nyamu","hatsuka","uika"];
const THEME_NAMES = {
  default: { "zh-CN": "天王寺璃奈", ja: "天王寺 璃奈", en: "Rina Tennoji" },
  keke:    { "zh-CN": "唐可可",     ja: "唐 可可",     en: "Keke Tang" },
  tomori:  { "zh-CN": "高松灯",     ja: "高松 燈",     en: "Tomori Takamatsu" },
  raana:   { "zh-CN": "要乐奈",     ja: "要 楽奈",     en: "Rana Kaname" },
  soyo:    { "zh-CN": "长崎爽世",   ja: "長崎 そよ",   en: "Soyo Nagasaki" },
  anon:    { "zh-CN": "千早爱音",   ja: "千早 愛音",   en: "Anon Chihaya" },
  taki:    { "zh-CN": "椎名立希",   ja: "椎名 立希",   en: "Taki Shiina" },
  sakiko:  { "zh-CN": "丰川祥子",   ja: "豊川 祥子",   en: "Sakiko Togawa" },
  mutsumi: { "zh-CN": "若叶睦",     ja: "若葉 睦",     en: "Mutsumi Wakaba" },
  nyamu:   { "zh-CN": "祐天寺若麦", ja: "祐天寺 にゃむ", en: "Nyamu Yutenji" },
  hatsuka: { "zh-CN": "三角初华",   ja: "三角 初華",   en: "Uika Misumi" },
  uika:    { "zh-CN": "八幡海铃",   ja: "八幡 海鈴",   en: "Umiri Yahata" },
};

// Derive SIDE A/B colors from accent: A = accent, B = accent hue-rotated ~150° + desaturated
function hexToHsl(hex){const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;
  if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);
    if(mx===r)h=((g-b)/d+(g<b?6:0))/6;else if(mx===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}
  return[h*360,s*100,l*100];}
function mixHex(a,b,t){
  const ar=parseInt(a.slice(1,3),16),ag=parseInt(a.slice(3,5),16),ab=parseInt(a.slice(5,7),16);
  const br=parseInt(b.slice(1,3),16),bg=parseInt(b.slice(3,5),16),bb=parseInt(b.slice(5,7),16);
  const mix=(x,y)=>Math.round(x+(y-x)*t).toString(16).padStart(2,"0");
  return `#${mix(ar,br)}${mix(ag,bg)}${mix(ab,bb)}`;
}
function getContrastColor(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  const yiq=(r*299+g*587+b*114)/1000;
  return yiq>=170?"#2D2D38":"#FFFFFF";
}
function hslToHex(h,s,l){h=((h%360)+360)%360;s/=100;l/=100;const a=s*Math.min(l,1-l);
  const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(Math.min(k-3,9-k,1),-1)));};
  return`#${[f(0),f(8),f(4)].map(v=>v.toString(16).padStart(2,"0")).join("")}`;}
function deriveSideColors(accent){const[h,s,l]=hexToHsl(accent);
  return{sideA:accent,sideB:hslToHex((h+150)%360,Math.max(s*0.6,20),Math.min(Math.max(l,40),60))};}
function deriveAccentInk(accent){
  return mixHex(accent,"#1F2430",0.6);
}
function deriveWarningColor(accent){
  const warmed=mixHex(accent,"#C97A5A",0.62);
  const[h,s,l]=hexToHsl(warmed);
  return hslToHex(h,Math.max(42,s*0.88),Math.min(Math.max(l,50),60));
}
function deriveTapeTypeColors(accent){
  return{
    TYPE_I:mixHex("#8F5A33",accent,0.28),
    TYPE_II:mixHex("#3A9FB3",accent,0.22),
    TYPE_IV:mixHex("#585E74",accent,0.34),
  };
}


const TAPE_PRESETS = {
  C46: { label: "C-46", sideMinutes: 23 }, C60: { label: "C-60", sideMinutes: 30 },
  C90: { label: "C-90", sideMinutes: 45 }, C120: { label: "C-120", sideMinutes: 60 },
};
const TAPE_TYPES = {
  TYPE_I:  { label: "Type I (Normal)", peakDb: -3, desc: "TDK D, Maxell UR" },
  TYPE_II: { label: "Type II (Chrome)", peakDb: -1, desc: "TDK SA, Maxell XLII" },
  TYPE_IV: { label: "Type IV (Metal)", peakDb: 0, desc: "TDK MA, Maxell MX" },
};
const TAPE_SIM_PROFILES = {
  TAPE_I: {
    drive: 1.8,
    headBumpFreq: 118,
    headBumpGain: 1.2,
    presenceFreq: 3200,
    presenceGain: 0.6,
    highShelfFreq: 5000,
    highShelfGain: -2.9,
    lowpassFreq: 12800,
    lowpassQ: 0.42,
    compThreshold: -22,
    compKnee: 10,
    compRatio: 1.85,
    hissLevel: 0.03,
  },
  TAPE_II: {
    drive: 1.6,
    headBumpFreq: 108,
    headBumpGain: 0.9,
    presenceFreq: 3600,
    presenceGain: 1.0,
    highShelfFreq: 5900,
    highShelfGain: -1.8,
    lowpassFreq: 14500,
    lowpassQ: 0.34,
    compThreshold: -19,
    compKnee: 9,
    compRatio: 1.55,
    hissLevel: 0.022,
  },
  TAPE_IV: {
    drive: 1.42,
    headBumpFreq: 96,
    headBumpGain: 0.6,
    presenceFreq: 4000,
    presenceGain: 1.1,
    highShelfFreq: 6900,
    highShelfGain: -0.9,
    lowpassFreq: 17200,
    lowpassQ: 0.26,
    compThreshold: -16,
    compKnee: 7,
    compRatio: 1.28,
    hissLevel: 0.014,
  },
};
const DEFAULT_GAP = 3.0;
const SILENCE_THRESHOLD = 0.005;
const SILENCE_MIN_DUR = 0.3;

// ── Audio helpers ────────────────────────────────────────────
function encodeWAV(ab, bitsPerSample = 16) {
  const nCh = ab.numberOfChannels, sr = ab.sampleRate, nS = ab.length;
  const byPS = bitsPerSample / 8;
  const ds = nS * nCh * byPS, buf = new ArrayBuffer(44 + ds), dv = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0,"RIFF"); dv.setUint32(4,36+ds,true); ws(8,"WAVE"); ws(12,"fmt ");
  dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,nCh,true);
  dv.setUint32(24,sr,true); dv.setUint32(28,sr*nCh*byPS,true); dv.setUint16(32,nCh*byPS,true);
  dv.setUint16(34,bitsPerSample,true); ws(36,"data"); dv.setUint32(40,ds,true);
  const chs=[]; for(let c=0;c<nCh;c++) chs.push(ab.getChannelData(c));
  let off=44;
  if(bitsPerSample===16){
    for(let i=0;i<nS;i++) for(let c=0;c<nCh;c++){
      const s=Math.max(-1,Math.min(1,chs[c][i]));
      dv.setInt16(off,s<0?s*0x8000:s*0x7FFF,true); off+=2;
    }
  } else { // 24-bit
    for(let i=0;i<nS;i++) for(let c=0;c<nCh;c++){
      const s=Math.max(-1,Math.min(1,chs[c][i]));
      const v=s<0?Math.round(s*0x800000):Math.round(s*0x7FFFFF);
      dv.setUint8(off,v&0xFF); dv.setUint8(off+1,(v>>8)&0xFF); dv.setUint8(off+2,(v>>16)&0xFF); off+=3;
    }
  }
  return new Blob([buf],{type:"audio/wav"});
}

// Format tag colors
const FMT_COLORS={
  FLAC:{bg:"#2D6A4F",fg:"#fff"}, WAV:{bg:"#1B4965",fg:"#fff"}, AIFF:{bg:"#1B4965",fg:"#fff"},
  AIF:{bg:"#1B4965",fg:"#fff"}, MP3:{bg:"#E07A5F",fg:"#fff"}, AAC:{bg:"#D4859A",fg:"#fff"},
  OGG:{bg:"#7B6B8A",fg:"#fff"}, OPUS:{bg:"#7B6B8A",fg:"#fff"}, M4A:{bg:"#D4859A",fg:"#fff"},
  APE:{bg:"#3A5A40",fg:"#fff"}, WV:{bg:"#3A5A40",fg:"#fff"}, DSD:{bg:"#5C4033",fg:"#fff"},
};
function fmtColor(fmt){return FMT_COLORS[fmt]||{bg:"var(--bg-deep)",fg:"var(--text-dim)"};}

function detectSilence(ab) {
  const d=ab.getChannelData(0), sr=ab.sampleRate; let h=0,tl=0;
  for(let i=0;i<d.length;i++) if(Math.abs(d[i])>SILENCE_THRESHOLD){h=i/sr;break;}
  for(let i=d.length-1;i>=0;i--) if(Math.abs(d[i])>SILENCE_THRESHOLD){tl=(d.length-1-i)/sr;break;}
  return {headSilence:Math.max(0,h), tailSilence:Math.max(0,tl)};
}
function getPeak(ab){let p=0;for(let c=0;c<ab.numberOfChannels;c++){const d=ab.getChannelData(c);for(let i=0;i<d.length;i++){const a=Math.abs(d[i]);if(a>p)p=a;}}return p;}
function getRMS(ab){let s=0,n=0;for(let c=0;c<ab.numberOfChannels;c++){const d=ab.getChannelData(c);for(let i=0;i<d.length;i++){s+=d[i]*d[i];n++;}}return Math.sqrt(s/n);}
function toDb(v){return v>0?20*Math.log10(v):-Infinity;}
function readExtended80(dv, off){
  const raw=dv.getUint16(off,false);
  if(raw===0) return 0;
  const sign=(raw&0x8000)!==0?-1:1;
  const exp=(raw&0x7FFF)-16383;
  const hi=dv.getUint32(off+2,false);
  const lo=dv.getUint32(off+6,false);
  const mant=Number((BigInt(hi)<<32n)|BigInt(lo));
  return sign * mant * (2 ** (exp - 63));
}
function detectSourceAudioMeta(filename, buf){
  const ext=(filename.match(/\.([^.]+)$/)||[])[1]?.toLowerCase();
  const meta={sampleRate:null,channels:null,bitDepth:null};
  if(!buf || !(buf instanceof ArrayBuffer)) return meta;
  const dv=new DataView(buf);
  try{
    if((ext==="wav"||ext==="wave") && buf.byteLength>=44){
      for(let off=12;off+8<=buf.byteLength;){
        const id=String.fromCharCode(dv.getUint8(off),dv.getUint8(off+1),dv.getUint8(off+2),dv.getUint8(off+3));
        const size=dv.getUint32(off+4,true);
        if(id==="fmt "&&off+8+size<=buf.byteLength&&size>=16){
          meta.channels=dv.getUint16(off+10,true);
          meta.sampleRate=dv.getUint32(off+12,true);
          meta.bitDepth=dv.getUint16(off+22,true);
          return meta;
        }
        off+=8+size+(size%2);
      }
    }
    if((ext==="aif"||ext==="aiff") && buf.byteLength>=12){
      for(let off=12;off+8<=buf.byteLength;){
        const id=String.fromCharCode(dv.getUint8(off),dv.getUint8(off+1),dv.getUint8(off+2),dv.getUint8(off+3));
        const size=dv.getUint32(off+4,false);
        if(id==="COMM"&&off+8+size<=buf.byteLength&&size>=18){
          meta.channels=dv.getUint16(off+8,false);
          meta.bitDepth=dv.getUint16(off+14,false);
          meta.sampleRate=Math.round(readExtended80(dv,off+16));
          return meta;
        }
        off+=8+size+(size%2);
      }
    }
    if(ext==="flac"&&buf.byteLength>=42){
      let off=4;
      while(off+4<=buf.byteLength){
        const header=dv.getUint8(off);
        const isLast=(header&0x80)!==0;
        const type=header&0x7F;
        const size=(dv.getUint8(off+1)<<16)|(dv.getUint8(off+2)<<8)|dv.getUint8(off+3);
        off+=4;
        if(type===0&&off+size<=buf.byteLength&&size>=18){
          const b10=dv.getUint8(off+10);
          const b11=dv.getUint8(off+11);
          const b12=dv.getUint8(off+12);
          const b13=dv.getUint8(off+13);
          meta.sampleRate=(b10<<12)|(b11<<4)|(b12>>4);
          meta.channels=((b12&0x0E)>>1)+1;
          meta.bitDepth=(((b12&0x01)<<4)|(b13>>4))+1;
          return meta;
        }
        off+=size;
        if(isLast) break;
      }
    }
  }catch{}
  return meta;
}
// Pre-downsample AudioBuffer to N min/max peak pairs per channel — O(samples) once at load
function downsamplePeaks(ab, N=4096){
  const result=[];
  for(let c=0;c<Math.min(ab.numberOfChannels,2);c++){
    const data=ab.getChannelData(c);
    const step=Math.max(1,Math.floor(data.length/N));
    const peaks=new Float32Array(N*2); // [min0,max0,min1,max1,...]
    for(let i=0;i<N;i++){
      const start=Math.floor(i*data.length/N);
      const end=Math.min(start+step,data.length);
      let mn=0,mx=0;
      for(let j=start;j<end;j++){if(data[j]<mn)mn=data[j];if(data[j]>mx)mx=data[j];}
      peaks[i*2]=mn;peaks[i*2+1]=mx;
    }
    result.push(peaks);
  }
  return result;
}
function computeSpectrogramPreview(ab, frames=Math.max(80,Math.min(256,Math.round(ab.duration*8))), bands=64){
  const sampleRate=ab.sampleRate;
  const maxHz=Math.min(22050,sampleRate/2);
  const minHz=40;
  const winSize=1536;
  const half=Math.floor(winSize/2);
  const data=ab.getChannelData(0);
  const len=data.length;
  const window=new Float32Array(winSize);
  for(let i=0;i<winSize;i++) window[i]=0.5*(1-Math.cos((2*Math.PI*i)/(winSize-1)));
  const freqs=Array.from({length:bands},(_,i)=>minHz*Math.pow(maxHz/minHz,i/Math.max(1,bands-1)));
  const coeffs=freqs.map(f=>2*Math.cos((2*Math.PI*f)/sampleRate));
  const valuesDb=new Float32Array(frames*bands);
  for(let fi=0;fi<frames;fi++){
    const center=Math.floor((fi/Math.max(1,frames-1))*Math.max(0,len-1));
    let start=Math.max(0,center-half);
    if(start+winSize>len) start=Math.max(0,len-winSize);
    for(let bi=0;bi<bands;bi++){
      const coeff=coeffs[bi];
      let s0=0,s1=0,s2=0;
      for(let n=0;n<winSize;n++){
        const sample=(data[start+n]||0)*window[n];
        s0=sample+coeff*s1-s2;
        s2=s1;
        s1=s0;
      }
      const power=s1*s1+s2*s2-coeff*s1*s2;
      const db=10*Math.log10(power/winSize+1e-12);
      valuesDb[fi*bands+bi]=db;
    }
  }
  return{frames,bands,maxHz,valuesDb};
}
function fmtTime(s){if(!s||s<0)return"0:00";return`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;}
function fmtTimeMs(s){if(!s||s<0)return"0:00.0";return`${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,"0")}`;}
let _id=0; const uid=()=>`t_${++_id}_${Date.now()}`;

// ═══════════════════════════════════════════════════════════════
export default function CassetteTool() {
  const [lang,setLang] = useState("zh-CN");
  const [theme,setTheme] = useState("default");
  const [showThemePicker,setShowThemePicker] = useState(false);
  const th = THEMES[theme] || THEMES.default;
  const sideColors = useMemo(()=>deriveSideColors(th.accent),[th.accent]);
  const accentInk = useMemo(()=>deriveAccentInk(th.accent),[th.accent]);
  const warningColor = useMemo(()=>deriveWarningColor(th.accent),[th.accent]);
  const tapeTypeColors = useMemo(()=>deriveTapeTypeColors(th.accent),[th.accent]);
  const accentContrast = useMemo(()=>getContrastColor(th.accent),[th.accent]);
  const T = useCallback((k) => t(k, lang), [lang]);

  const [tapePreset,setTapePreset] = useState("C60");
  const [tapeType,setTapeType] = useState("TYPE_I");
  const [customMin,setCustomMin] = useState(30);
  const [tracks,setTracks] = useState([]);
  const [defaultGap,setDefaultGap] = useState(DEFAULT_GAP);
  const [fillTail,setFillTail] = useState(true);
  const [tailMargin,setTailMargin] = useState(2); // minutes
  const [smartGap,setSmartGap] = useState(true);
  const [normalizeMode,setNormalizeMode] = useState("off");
  const [targetDb,setTargetDb] = useState(-3.0);
  const [exportSr,setExportSr] = useState("auto"); // "auto" | 44100 | 48000
  const [exportBits,setExportBits] = useState("auto"); // "auto" | 16 | 24
  // Playback state
  const [playing,setPlaying] = useState(false);
  const [paused,setPaused] = useState(false);
  const [playingSide,setPlayingSide] = useState(null);
  const [playbackView,setPlaybackView] = useState({ token: 0, schedule: [], totalDur: 0 });
  const playingIdxRef = useRef(-1);
  const playPosRef = useRef(0);
  const playRef = useRef({sources:[],auxSources:[],nodes:[],startTime:0,raf:null,ctx:null,schedule:[],totalDur:0});
  const meterRef = useRef({el:null,peakL:0,peakR:0,decayL:0,decayR:0});
  const analyserRef = useRef({L:null,R:null});
  const [meterMode,setMeterMode] = useState("vfd"); // vfd | vu | spectrum | waveform
  const [simMode,setSimMode] = useState("off"); // off | TAPE_I | TAPE_II | TAPE_IV | vinyl
  const [processing,setProcessing] = useState(false);
  const [procMsg,setProcMsg] = useState("");
  const [expProg,setExpProg] = useState(null);
  const [dragOverSide,setDragOverSide] = useState(null);
  const [dragItem,setDragItem] = useState(null);
  const [activeTab,setActiveTab] = useState("A");
  const [sidePreviewMode,setSidePreviewMode] = useState("waveform");
  const [toast,setToast] = useState(null);
  const [showHelp,setShowHelp] = useState(false);
  const [showAbout,setShowAbout] = useState(false);
  const [ffmpegStatus,setFfmpegStatus] = useState("idle"); // idle | loading | ready | unavailable

  const acRef = useRef(null);
  const fileRef = useRef(null);
  const plRef = useRef(null);

  const showToast = useCallback((m,d=4000)=>{setToast(m);setTimeout(()=>setToast(null),d);},[]);
  const getAC = useCallback(()=>{if(!acRef.current) acRef.current=new(window.AudioContext||window.webkitAudioContext)();return acRef.current;},[]);

  const sideMin = tapePreset==="CUSTOM"?customMin:TAPE_PRESETS[tapePreset].sideMinutes;
  const sideSec = sideMin * 60;
  const effectiveSec = Math.max(0, sideSec - tailMargin * 60);
  const playbackStructureKey = useMemo(()=>JSON.stringify({
    defaultGap, smartGap, fillTail, sideSec,
    tracks: tracks.map(t=>({id:t.id,side:t.side,gapOverride:t.gapOverride,hasAudio:!!t.audioBuffer}))
  }),[tracks,defaultGap,smartGap,fillTail,sideSec]);

  const sideA = useMemo(()=>tracks.filter(t=>t.side==="A"),[tracks]);
  const sideB = useMemo(()=>tracks.filter(t=>t.side==="B"),[tracks]);

  // Resolve export sample rate: "auto" picks max SR from the side's tracks
  const resolveExportSr = useCallback((sideTracks)=>{
    if(exportSr!=="auto") return exportSr;
    const maxSr=sideTracks.filter(t=>t.audioBuffer).reduce((m,t)=>Math.max(m,t.sampleRate),44100);
    return maxSr;
  },[exportSr]);

  const LOSSLESS_FMT=new Set(["FLAC","WAV","AIFF","AIF","APE","WV","DSD","DSF","DFF"]);
  // Resolve export bit depth: "auto" → 24 if any lossless source, else 16
  const resolveExportBits = useCallback((sideTracks)=>{
    if(exportBits!=="auto") return exportBits;
    const hasLossless=sideTracks.some(t=>LOSSLESS_FMT.has(t.format));
    return hasLossless?24:16;
  },[exportBits]);

  // Compute effective gap for a track (considering smartGap)
  const getGap = useCallback((tr, nextTr) => {
    if (tr.gapOverride != null) return tr.gapOverride;
    if (!smartGap) return defaultGap;
    // Smart: target gap = defaultGap, subtract existing tail+head silence
    const existing = (tr.tailSilence || 0) + (nextTr?.headSilence || 0);
    return Math.max(0, defaultGap - existing);
  }, [defaultGap, smartGap]);

  const calcDur = useCallback((st) => {
    if (st.length===0) return 0;
    let total=0;
    st.forEach((tr,i)=>{
      total+=tr.duration;
      if(i<st.length-1) total+=getGap(tr, st[i+1]);
    });
    return total;
  },[getGap]);

  const durA = useMemo(()=>calcDur(sideA),[sideA,calcDur]);
  const durB = useMemo(()=>calcDur(sideB),[sideB,calcDur]);

  // ── File loading ─────────────────────────────────────────
  const loadFiles = useCallback(async(files,side)=>{
    const ctx=getAC(); setProcessing(true);
    const nw=[];
    const hydratedIds=new Set(); // track which stubs got matched
    for(const f of files){
      setProcMsg(`${T("decoding")}: ${f.name}`);
      let ab = null;
      let fileBuf = null;
      let sourceMeta = null;
      try{
        fileBuf=await f.arrayBuffer();
        sourceMeta=detectSourceAudioMeta(f.name,fileBuf);
        if(likelyNeedsTranscode(f.name)){
          throw new Error("format likely unsupported natively, try ffmpeg");
        }
        ab=await ctx.decodeAudioData(fileBuf.slice(0));
      }catch(nativeErr){
        try{
          setProcMsg(`ffmpeg: ${f.name}`);
          if(ffmpegStatus==="idle") setFfmpegStatus("loading");
          const wavBuf=await transcodeToWav(f, (msg)=>setProcMsg(`ffmpeg: ${msg}`));
          setFfmpegStatus("ready");
          ab=await ctx.decodeAudioData(wavBuf);
        }catch(ffErr){
          console.error(`Failed to decode ${f.name} (native + ffmpeg):`, ffErr);
          if(ffErr.message?.includes("SharedArrayBuffer")){
            setFfmpegStatus("unavailable");
            showToast("SharedArrayBuffer unavailable — COOP/COEP headers missing. FLAC/AIFF decoding disabled.",6000);
          }
        }
      }
      if(!ab) continue;
      const sil=detectSilence(ab); const pk=getPeak(ab); const rms=getRMS(ab);
      const ext=(f.name.match(/\.([^.]+)$/)||[])[1]?.toUpperCase()||"?";
      const peaks=downsamplePeaks(ab,4096);
      const spectrogram=computeSpectrogramPreview(ab);
      const audioMeta={audioBuffer:ab,duration:ab.duration,sampleRate:sourceMeta?.sampleRate||ab.sampleRate,
        channels:sourceMeta?.channels||ab.numberOfChannels,headSilence:sil.headSilence,tailSilence:sil.tailSilence,
        peakDb:toDb(pk),rmsDb:toDb(rms),peak:pk,rms,format:ext,bitDepth:sourceMeta?.bitDepth??null,peaks,spectrogram};
      // Check for stub match: same fileName, no audioBuffer, not already matched this batch
      const stubMatch=tracks.find(t=>!t.audioBuffer && !hydratedIds.has(t.id) &&
        (t.fileName===f.name || t.name===f.name.replace(/\.[^.]+$/,"")));
      if(stubMatch){
        hydratedIds.add(stubMatch.id);
        setTracks(p=>p.map(t=>t.id===stubMatch.id?{...t,...audioMeta}:t));
      }else{
        nw.push({id:uid(),name:f.name.replace(/\.[^.]+$/,""),fileName:f.name,
          side:side||"A",gapOverride:null,format:ext,...audioMeta});
      }
    }
    if(nw.length>0) setTracks(p=>[...p,...nw]);
    const matched=hydratedIds.size;
    if(matched>0) showToast(`${matched} ${T("stubsHydrated")}`,3000);
    setProcessing(false); setProcMsg("");
  },[getAC,T,ffmpegStatus,showToast,tracks]);

  const handleDrop=useCallback((e,side)=>{
    e.preventDefault();e.stopPropagation();setDragOverSide(null);
    if(dragItem){setTracks(p=>p.map(t=>t.id===dragItem?{...t,side}:t));setDragItem(null);}
    else if(e.dataTransfer.files.length>0) loadFiles(Array.from(e.dataTransfer.files),side);
  },[dragItem,loadFiles]);

  const removeTrack=useCallback(id=>setTracks(p=>p.filter(t=>t.id!==id)),[]);
  const moveTrack=useCallback((id,dir)=>{
    setTracks(p=>{
      const i=p.findIndex(t=>t.id===id);if(i===-1)return p;
      const tr=p[i],ss=p.filter(t=>t.side===tr.side),si=ss.findIndex(t=>t.id===id),sw=si+dir;
      if(sw<0||sw>=ss.length)return p;
      const r=[...p],ai=r.findIndex(t=>t.id===id),bi=r.findIndex(t=>t.id===ss[sw].id);
      [r[ai],r[bi]]=[r[bi],r[ai]];return r;
    });
  },[]);
  const toggleSide=useCallback(id=>setTracks(p=>p.map(t=>t.id===id?{...t,side:t.side==="A"?"B":"A"}:t)),[]);
  const setTrackGap=useCallback((id,g)=>setTracks(p=>p.map(t=>t.id===id?{...t,gapOverride:g}:t)),[]);

  const autoDistribute=useCallback(()=>{
    if(!tracks.length)return;
    const sorted=[...tracks].sort((a,b)=>b.duration-a.duration);
    let sA=0,sB=0;const m=new Map();
    const eff=effectiveSec;
    for(const tr of sorted){
      // Prefer the side that's still under effective capacity; if both under or both over, pick lighter
      const aUnder=sA<eff, bUnder=sB<eff;
      if(aUnder&&!bUnder){m.set(tr.id,"A");sA+=tr.duration;}
      else if(!aUnder&&bUnder){m.set(tr.id,"B");sB+=tr.duration;}
      else if(sA<=sB){m.set(tr.id,"A");sA+=tr.duration;}
      else{m.set(tr.id,"B");sB+=tr.duration;}
    }
    setTracks(p=>p.map(t=>({...t,side:m.get(t.id)||t.side})));
  },[tracks,effectiveSec]);

  // ── Playlist I/O ─────────────────────────────────────────
  const exportPL=useCallback(()=>{
    const pl={version:"0.3",generator:"SIDE",
      config:{tapePreset,tapeType,customMin,defaultGap,fillTail,tailMargin,smartGap,normalizeMode,targetDb,exportSr,exportBits},
      tracks:tracks.map(t=>({name:t.name,fileName:t.fileName,side:t.side,duration:t.duration,
        sampleRate:t.sampleRate,bitDepth:t.bitDepth,channels:t.channels,peakDb:t.peakDb,rmsDb:t.rmsDb,
        gapOverride:t.gapOverride,headSilence:t.headSilence,tailSilence:t.tailSilence,format:t.format||"?"}))};
    const b=new Blob([JSON.stringify(pl,null,2)],{type:"application/json"});
    const u=URL.createObjectURL(b),a=document.createElement("a");
    a.href=u;a.download=`SIDE_playlist_${new Date().toISOString().slice(0,10)}.json`;a.click();
    URL.revokeObjectURL(u); showToast(T("playlistExported"));
  },[tracks,tapePreset,tapeType,customMin,defaultGap,fillTail,tailMargin,smartGap,normalizeMode,targetDb,exportSr,exportBits,T,showToast]);

  const importPL=useCallback(async(e)=>{
    const f=e.target.files?.[0];if(!f)return;
    try{
      const pl=JSON.parse(await f.text());
      if(!pl.tracks) throw new Error("no tracks");
      const c=pl.config||{};
      if(c.tapePreset)setTapePreset(c.tapePreset);if(c.tapeType){setTapeType(c.tapeType);setTargetDb(TAPE_TYPES[c.tapeType]?.peakDb??-3);}
      if(c.customMin!=null)setCustomMin(c.customMin);if(c.defaultGap!=null)setDefaultGap(c.defaultGap);
      if(c.fillTail!=null)setFillTail(c.fillTail);if(c.tailMargin!=null)setTailMargin(c.tailMargin);
      if(c.smartGap!=null)setSmartGap(c.smartGap);if(c.normalizeMode)setNormalizeMode(c.normalizeMode);
      if(c.targetDb!=null)setTargetDb(c.targetDb);if(c.exportSr)setExportSr(c.exportSr);if(c.exportBits)setExportBits(c.exportBits);
      setTracks(pl.tracks.map(t=>({id:uid(),name:t.name||"?",fileName:t.fileName||"",side:t.side||"A",
        duration:t.duration||0,sampleRate:t.sampleRate||44100,bitDepth:t.bitDepth??null,channels:t.channels||2,audioBuffer:null,
        headSilence:t.headSilence||0,tailSilence:t.tailSilence||0,
        peakDb:t.peakDb??-Infinity,rmsDb:t.rmsDb??-Infinity,
        peak:t.peakDb!=null?Math.pow(10,t.peakDb/20):0,rms:t.rmsDb!=null?Math.pow(10,t.rmsDb/20):0,
        gapOverride:t.gapOverride??null,format:t.format||"?"})));
      showToast(T("playlistImportNoAudio"),6000);
    }catch(err){showToast(T("playlistImportError")+": "+err.message);}
    e.target.value="";
  },[T,showToast]);

  // ── Export Audio ──────────────────────────────────────────
  const expSide=useCallback(async(side)=>{
    const allSide=tracks.filter(t=>t.side===side);
    const st=allSide.filter(t=>t.audioBuffer);
    const stubCount=allSide.length-st.length;
    if(!st.length)return;
    if(stubCount>0){
      const ok=window.confirm(T("exportHasStubs"));
      if(!ok)return;
    }
    const sr=resolveExportSr(st);
    const bits=resolveExportBits(st);
    // Warn about downsampled tracks
    const downsampled=st.filter(t=>t.sampleRate>sr);
    if(downsampled.length>0){
      const names=downsampled.map(t=>`${t.name} (${t.sampleRate/1000}kHz→${sr/1000}kHz)`).join("\n");
      const ok=window.confirm(`${T("resampleWarn")}:\n${names}\n\nContinue?`);
      if(!ok)return;
    }
    const bitDepthChanged=st.filter(t=>t.bitDepth!=null&&t.bitDepth!==bits);
    if(bitDepthChanged.length>0){
      const names=bitDepthChanged.map(t=>`${t.name} (${t.bitDepth}bit→${bits}bit)`).join("\n");
      const ok=window.confirm(`${T("bitDepthWarn")}:\n${names}\n\nContinue?`);
      if(!ok)return;
    }
    setProcessing(true);setExpProg({side,step:0,total:st.length+2});
    try{
      const ch=2;
      let gains=st.map(()=>1.0);
      if(normalizeMode==="peak"){const tl=Math.pow(10,targetDb/20);gains=st.map(t=>t.peak>0?tl/t.peak:1.0);}
      else if(normalizeMode==="rms"){const avg=st.reduce((s,t)=>s+t.rms,0)/st.length;gains=st.map(t=>t.rms>0?avg/t.rms:1.0);}
      let len=0;
      st.forEach((tr,i)=>{len+=tr.duration*sr;if(i<st.length-1)len+=getGap(tr,st[i+1])*sr;});
      if(fillTail)len=Math.max(len,sideSec*sr);
      len=Math.ceil(len);
      const oc=new OfflineAudioContext(ch,len,sr);let cur=0;
      for(let i=0;i<st.length;i++){
        setExpProg({side,step:i+1,total:st.length+2});setProcMsg(`SIDE ${side}: [${i+1}/${st.length}] ${st[i].name}`);
        const tr=st[i],src=oc.createBufferSource(),gn=oc.createGain();
        src.buffer=tr.audioBuffer;gn.gain.value=gains[i];src.connect(gn);gn.connect(oc.destination);
        src.start(cur/sr);cur+=Math.ceil(tr.duration*sr);
        if(i<st.length-1)cur+=Math.ceil(getGap(tr,st[i+1])*sr);
      }
      setProcMsg(`SIDE ${side}: ${T("rendering")}...`);setExpProg({side,step:st.length+1,total:st.length+2});
      const r=await oc.startRendering();
      setProcMsg(`SIDE ${side}: ${T("encoding")}...`);setExpProg({side,step:st.length+2,total:st.length+2});
      const blob=encodeWAV(r,bits),u=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=u;a.download=`SIDE_${side}_${sr}hz_${bits}bit.wav`;a.click();URL.revokeObjectURL(u);
    }catch(e){console.error(e);alert(`Export failed: ${e.message}`);}
    setProcessing(false);setProcMsg("");setExpProg(null);
  },[tracks,defaultGap,fillTail,normalizeMode,targetDb,sideSec,getAC,T,getGap,resolveExportSr,resolveExportBits]);

  // ── Playback Engine ───────────────────────────────────────
  const playGenRef = useRef(0); // generation counter to prevent stale callbacks
  const appliedSimKeyRef = useRef(simMode);
  const appliedPlaybackStructureRef = useRef(playbackStructureKey);
  const getPlaybackCursor = useCallback((schedule, pos, contentDur, totalDur) => {
    if (!schedule.length) return -1;
    if (totalDur > contentDur && pos >= contentDur) return schedule.length;
    const current = [...schedule].reverse().find((seg) => pos >= seg.start);
    return current ? current.idx : schedule[0].idx;
  }, []);

  const stopPlayback = useCallback(()=>{
    playGenRef.current++;
    const p=playRef.current;
    p.sources.forEach(s=>{s.onended=null;try{s.stop();}catch(e){}});
    p.auxSources.forEach(s=>{try{s.stop();}catch(e){}});
    p.nodes.forEach((node)=>{try{node.disconnect();}catch(e){}});
    p.sources=[];
    p.auxSources=[];
    p.nodes=[];
    if(p.raf) cancelAnimationFrame(p.raf);
    p.raf=null;p.pausedAt=null;
    p.schedule=[];p.totalDur=0;
    analyserRef.current={L:null,R:null};
    setPlaybackView(v=>({token:v.token+1,schedule:[],totalDur:0}));
    setPlaying(false);setPaused(false);setPlayingSide(null);
    playingIdxRef.current=-1;playPosRef.current=0;
  },[]);

  const togglePause = useCallback(()=>{
    const ctx=getAC();
    if(!playing) return;
    if(paused){
      ctx.resume(); setPaused(false);
    } else {
      ctx.suspend(); setPaused(true);
    }
  },[playing,paused,getAC]);

  // Build schedule from side tracks (reusable)
  const buildSchedule = useCallback((side)=>{
    const st=tracks.filter(t=>t.side===side&&t.audioBuffer);
    const schedule=[];let offset=0;
    const gains=st.map(tr=>{
      if(normalizeMode==="peak"){const tl=Math.pow(10,targetDb/20);return tr.peak>0?tl/tr.peak:1.0;}
      if(normalizeMode==="rms"){const avg=st.reduce((s,t)=>s+t.rms,0)/st.length;return tr.rms>0?avg/tr.rms:1.0;}
      return 1.0;
    });
    st.forEach((tr,i)=>{
      schedule.push({id:tr.id,name:tr.name,start:offset,dur:tr.duration,idx:i,buffer:tr.audioBuffer,gain:gains[i]});
      offset+=tr.duration;
      if(i<st.length-1) offset+=getGap(tr,st[i+1]);
    });
    // If tail fill enabled, extend to tape side length
    const dur=fillTail?Math.max(offset,sideSec):offset;
    return {schedule,totalDur:dur,contentDur:offset,trackCount:st.length};
  },[tracks,normalizeMode,targetDb,getGap,fillTail,sideSec]);

  // Start playback from a given position (seconds)
  const playFromPos = useCallback((side,fromPos)=>{
    const p=playRef.current;
    p.sources.forEach(s=>{s.onended=null;});
    p.sources.forEach(s=>{try{s.stop();}catch(e){}});
    p.auxSources.forEach(s=>{try{s.stop();}catch(e){}});
    p.nodes.forEach((node)=>{try{node.disconnect();}catch(e){}});
    p.sources=[];
    p.auxSources=[];
    p.nodes=[];
    if(p.raf) cancelAnimationFrame(p.raf);

    const gen=++playGenRef.current;
    const ctx=getAC();
    // Resume if suspended (from pause)
    if(ctx.state==="suspended") ctx.resume();
    const {schedule,totalDur,contentDur}=buildSchedule(side);
    if(!schedule.length){stopPlayback();return;}
    const clampedPos=Math.max(0,Math.min(fromPos,totalDur));

    // Analyser chain: masterGain → [simulation] → outputNode → splitter → analysers + destination
    const masterGain=ctx.createGain();masterGain.gain.value=1.0;
    let outputNode=masterGain; // default: direct passthrough
    const extraNodes=[]; // disconnect on stop/seek
    const auxSources=[]; // stop on stop/seek

    // Tape / Vinyl simulation
    if(simMode.startsWith("TAPE_")){
      const tapeProfile=TAPE_SIM_PROFILES[simMode];
      const shaper=ctx.createWaveShaper();
      const curve=new Float32Array(1024);
      for(let i=0;i<1024;i++){const x=i/512-1;curve[i]=Math.tanh(x*tapeProfile.drive);}
      shaper.curve=curve;shaper.oversample="4x";
      const headBump=ctx.createBiquadFilter();headBump.type="lowshelf";headBump.frequency.value=tapeProfile.headBumpFreq;headBump.gain.value=tapeProfile.headBumpGain;
      const presence=ctx.createBiquadFilter();presence.type="peaking";presence.frequency.value=tapeProfile.presenceFreq;presence.Q.value=0.8;presence.gain.value=tapeProfile.presenceGain;
      const highShelf=ctx.createBiquadFilter();highShelf.type="highshelf";highShelf.frequency.value=tapeProfile.highShelfFreq;highShelf.gain.value=tapeProfile.highShelfGain;
      const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=tapeProfile.lowpassFreq;lp.Q.value=tapeProfile.lowpassQ;
      const comp=ctx.createDynamicsCompressor();
      comp.threshold.value=tapeProfile.compThreshold;
      comp.knee.value=tapeProfile.compKnee;
      comp.ratio.value=tapeProfile.compRatio;
      comp.attack.value=0.004;
      comp.release.value=0.18;
      const noiseLen=ctx.sampleRate*2;
      const noiseBuf=ctx.createBuffer(1,noiseLen,ctx.sampleRate);
      const noiseData=noiseBuf.getChannelData(0);
      for(let i=0;i<noiseLen;i++) noiseData[i]=(Math.random()*2-1)*0.012;
      const noiseSrc=ctx.createBufferSource();noiseSrc.buffer=noiseBuf;noiseSrc.loop=true;
      const noiseBP=ctx.createBiquadFilter();noiseBP.type="bandpass";noiseBP.frequency.value=5000;noiseBP.Q.value=0.8;
      const noiseGain=ctx.createGain();noiseGain.gain.value=tapeProfile.hissLevel;
      noiseSrc.connect(noiseBP);noiseBP.connect(noiseGain);noiseSrc.start();
      masterGain.connect(headBump);headBump.connect(shaper);shaper.connect(comp);comp.connect(presence);presence.connect(highShelf);highShelf.connect(lp);
      outputNode=lp;
      noiseGain.connect(ctx.destination);
      auxSources.push(noiseSrc);
      extraNodes.push(noiseBP,noiseGain,headBump,shaper,comp,presence,highShelf,lp);
    } else if(simMode==="vinyl"){
      // Vinyl: bandwidth limit + surface noise + crackle + rumble + wow/flutter
      const bass=ctx.createBiquadFilter();bass.type="lowshelf";bass.frequency.value=180;bass.gain.value=1.1;
      const presence=ctx.createBiquadFilter();presence.type="peaking";presence.frequency.value=2600;presence.Q.value=0.9;presence.gain.value=1.8;
      const highShelf=ctx.createBiquadFilter();highShelf.type="highshelf";highShelf.frequency.value=6200;highShelf.gain.value=-3.8;
      const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=11800;lp.Q.value=0.55;
      const delay=ctx.createDelay(0.03);delay.delayTime.value=0.005;
      const wow=ctx.createOscillator();wow.type="sine";wow.frequency.value=0.6;
      const wowDepth=ctx.createGain();wowDepth.gain.value=0.0009;
      const flutter=ctx.createOscillator();flutter.type="sine";flutter.frequency.value=7.2;
      const flutterDepth=ctx.createGain();flutterDepth.gain.value=0.00018;
      const noiseLen=ctx.sampleRate*4;
      const surfaceBuf=ctx.createBuffer(1,noiseLen,ctx.sampleRate);
      const crackleBuf=ctx.createBuffer(1,noiseLen,ctx.sampleRate);
      const rumbleBuf=ctx.createBuffer(1,noiseLen,ctx.sampleRate);
      const surfaceData=surfaceBuf.getChannelData(0);
      const crackleData=crackleBuf.getChannelData(0);
      const rumbleData=rumbleBuf.getChannelData(0);
      for(let i=0;i<noiseLen;i++){
        surfaceData[i]=(Math.random()*2-1)*0.012;
        crackleData[i]=Math.random()<0.0015?((Math.random()>0.5?1:-1)*0.18):0;
        rumbleData[i]=(Math.random()*2-1)*0.03;
      }
      const surfaceSrc=ctx.createBufferSource();surfaceSrc.buffer=surfaceBuf;surfaceSrc.loop=true;
      const crackleSrc=ctx.createBufferSource();crackleSrc.buffer=crackleBuf;crackleSrc.loop=true;
      const rumbleSrc=ctx.createBufferSource();rumbleSrc.buffer=rumbleBuf;rumbleSrc.loop=true;
      const surfaceHP=ctx.createBiquadFilter();surfaceHP.type="highpass";surfaceHP.frequency.value=1600;surfaceHP.Q.value=0.7;
      const crackleHP=ctx.createBiquadFilter();crackleHP.type="highpass";crackleHP.frequency.value=2200;crackleHP.Q.value=0.9;
      const rumbleLP=ctx.createBiquadFilter();rumbleLP.type="lowpass";rumbleLP.frequency.value=90;rumbleLP.Q.value=0.8;
      const surfaceGain=ctx.createGain();surfaceGain.gain.value=0.08;
      const crackleGain=ctx.createGain();crackleGain.gain.value=0.12;
      const rumbleGain=ctx.createGain();rumbleGain.gain.value=0.05;
      surfaceSrc.connect(surfaceHP);surfaceHP.connect(surfaceGain);surfaceSrc.start();
      crackleSrc.connect(crackleHP);crackleHP.connect(crackleGain);crackleSrc.start();
      rumbleSrc.connect(rumbleLP);rumbleLP.connect(rumbleGain);rumbleSrc.start();
      wow.connect(wowDepth);wowDepth.connect(delay.delayTime);wow.start();
      flutter.connect(flutterDepth);flutterDepth.connect(delay.delayTime);flutter.start();
      masterGain.connect(bass);bass.connect(presence);presence.connect(highShelf);highShelf.connect(lp);lp.connect(delay);
      outputNode=delay;
      surfaceGain.connect(ctx.destination);
      crackleGain.connect(ctx.destination);
      rumbleGain.connect(ctx.destination);
      auxSources.push(surfaceSrc,crackleSrc,rumbleSrc,wow,flutter);
      extraNodes.push(surfaceHP,crackleHP,rumbleLP,surfaceGain,crackleGain,rumbleGain,bass,presence,highShelf,lp,delay,wowDepth,flutterDepth);
    }

    outputNode.connect(ctx.destination);
    const splitter=ctx.createChannelSplitter(2);
    outputNode.connect(splitter);
    const analyserL=ctx.createAnalyser();analyserL.fftSize=4096;analyserL.smoothingTimeConstant=0.68;
    const analyserR=ctx.createAnalyser();analyserR.fftSize=4096;analyserR.smoothingTimeConstant=0.68;
    splitter.connect(analyserL,0);splitter.connect(analyserR,1);

    const sources=[];
    const now=ctx.currentTime;

    schedule.forEach(s=>{
      const trackEnd=s.start+s.dur;
      if(trackEnd<=clampedPos) return;
      const src=ctx.createBufferSource();
      src.buffer=s.buffer;
      const gn=ctx.createGain();gn.gain.value=s.gain;
      src.connect(gn);gn.connect(masterGain);
      extraNodes.push(gn, src);
      if(clampedPos>s.start){
        const skipSec=clampedPos-s.start;
        src.start(now,skipSec,s.dur-skipSec);
      } else {
        src.start(now+(s.start-clampedPos));
      }
      sources.push(src);
    });

    const startTime=now-clampedPos;
    const currentIdx=getPlaybackCursor(schedule, clampedPos, contentDur, totalDur);
    analyserRef.current={L:analyserL,R:analyserR};
    playRef.current={sources,auxSources,nodes:[masterGain,outputNode,splitter,analyserL,analyserR,...extraNodes],startTime,raf:null,ctx,schedule,totalDur,contentDur,analyserL,analyserR,masterGain,splitter};
    setPlaybackView({token:gen,schedule,totalDur,contentDur});
    setPlaying(true);setPlayingSide(side);setPaused(false);
    playingIdxRef.current=currentIdx;playPosRef.current=clampedPos;

    const tick=()=>{
      if(playGenRef.current!==gen) return;
      const elapsed=ctx.currentTime-startTime;
      const nextPos=Math.max(0,Math.min(elapsed,totalDur));
      playPosRef.current=nextPos;
      playingIdxRef.current=getPlaybackCursor(schedule, nextPos, contentDur, totalDur);
      if(nextPos>=totalDur){
        stopPlayback();
        return;
      }
      playRef.current.raf=requestAnimationFrame(tick);
    };
    playRef.current.raf=requestAnimationFrame(tick);
  },[getAC,buildSchedule,getPlaybackCursor,simMode,stopPlayback]);

  const playSide = useCallback((side)=>{
    playFromPos(side,0);
  },[playFromPos]);

  const seekTo = useCallback((pos)=>{
    if(!playingSide) return;
    playFromPos(playingSide,Math.max(0,pos));
  },[playingSide,playFromPos]);

  const skipTrack = useCallback((dir)=>{
    if(!playingSide) return;
    const schedule=playRef.current.schedule||[];
    const contentDur=playRef.current.contentDur||0;
    const totalDur=playRef.current.totalDur||0;
    if(!schedule.length) return;
    const curIdx=playingIdxRef.current;
    if(curIdx>=schedule.length){
      if(dir<0){
        playFromPos(playingSide,schedule[schedule.length-1].start);
      }else if(totalDur>contentDur){
        playFromPos(playingSide,contentDur);
      }
      return;
    }
    const newIdx=Math.max(0,Math.min(schedule.length-1,curIdx+dir));
    playFromPos(playingSide,schedule[newIdx]?.start||0);
  },[playingSide,playFromPos]);

  useEffect(() => {
    if (appliedSimKeyRef.current === simMode) return;
    appliedSimKeyRef.current = simMode;
    if (!playing || !playingSide) return;

    const pos = playPosRef.current;
    const wasPaused = paused;
    playFromPos(playingSide, pos);

    if (wasPaused) {
      const ctx = getAC();
      ctx.suspend();
      setPaused(true);
    }
  }, [simMode, playing, playingSide, paused, playFromPos, getAC]);

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

  // Cleanup on unmount
  useEffect(()=>()=>stopPlayback(),[stopPlayback]);

  // ── Sub-components ───────────────────────────────────────
  const CapBar=({used,total,eff,side})=>{
    // Three zones: <=eff (ok), eff<x<=total (soft warning), >total (hard exceeded)
    const hardOver=used>total, softOver=!hardOver&&used>eff;
    const barBase=total; // bar always scaled to physical tape length
    const pct=Math.min((used/barBase)*100,100);
    const effPct=(eff/barBase)*100;
    const okPct=Math.min((Math.min(used,eff)/barBase)*100,100);
    const softPct=softOver?Math.min(((used-eff)/barBase)*100,100-okPct):0;
    const rem=eff-used;
    const barColor=hardOver?"var(--danger)":`var(--side-${side.toLowerCase()})`;
    const sideColor=`var(--side-${side.toLowerCase()})`;
    const statusColor=hardOver?"var(--danger)":softOver?"var(--warning)":"var(--text-dim)";
    const statusText=hardOver?`${T("exceeded")} ${fmtTime(used-total)}`:softOver?`⚠ +${fmtTime(used-eff)} (${T("remaining")} ${fmtTime(total-used)})`:`${T("remaining")} ${fmtTime(rem)}`;
    return(<div style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4,color:"var(--text)"}}>
        <span>SIDE {side} — {fmtTime(used)} / {fmtTime(eff)}{tailMargin>0&&<span style={{opacity:0.5}}> (tape {fmtTime(total)})</span>}</span>
        <span style={{color:statusColor}}>{statusText}</span>
      </div>
      <div style={{height:6,background:"var(--bg-deep)",borderRadius:3,overflow:"hidden",position:"relative"}}>
        {softOver&&!hardOver?<>
          <div style={{height:"100%",width:`${okPct}%`,background:sideColor,borderRadius:3,transition:"width 0.3s,background 0.3s"}}/>
          <div style={{position:"absolute",left:`${okPct}%`,top:0,bottom:0,width:`${softPct}%`,background:"var(--warning)",transition:"left 0.3s,width 0.3s"}}/>
        </>:<div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:barColor,borderRadius:3,transition:"width 0.3s,background 0.3s"}}/>}
        {tailMargin>0&&<div style={{position:"absolute",left:`${effPct}%`,top:0,bottom:0,width:1,background:"var(--warning)",opacity:0.6}}/>}
      </div>
    </div>);
  };

  const TimeLine=({st,total,eff,side})=>{
    if(!st.length) return <div style={{height:40,background:"var(--bg-deep)",borderRadius:6,border:"1px solid var(--border)"}} />;
    const segs=[];let off=0;
    st.forEach((tr,i)=>{
      segs.push({type:"t",track:tr,start:off,dur:tr.duration});off+=tr.duration;
      if(i<st.length-1){const g=getGap(tr,st[i+1]);segs.push({type:"g",start:off,dur:g});off+=g;}
    });
    const dt=Math.max(off,total);
    const softOver=off>eff;
    const hardOver=off>total;
    return(<div style={{height:40,position:"relative",background:"var(--bg-deep)",borderRadius:6,overflow:"hidden",border:"1px solid var(--border)"}}>
      {segs.map((s,i)=>{
        const l=(s.start/dt)*100,w=(s.dur/dt)*100;
        if(s.type==="g") return null;
        const hue=(i*47+25)%360;
        return <div key={s.track.id} title={`${s.track.name} (${fmtTime(s.dur)})`} style={{
          position:"absolute",left:`${l}%`,width:`${Math.max(w,0.5)}%`,height:"100%",
          background:`hsla(${hue},45%,55%,0.7)`,borderRight:"1px solid var(--bg-deep)",
          display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",
          fontSize:9,color:"#fff",textShadow:"0 1px 2px rgba(0,0,0,0.5)",padding:"0 2px",whiteSpace:"nowrap",
        }}>{w>5?s.track.name:""}</div>;
      })}
      {eff<total&&<div style={{position:"absolute",left:`${(eff/dt)*100}%`,top:0,bottom:0,width:2,
        background:"var(--warning)",opacity:softOver?0.95:0.55,zIndex:5}}/>}
      {hardOver&&<div style={{position:"absolute",left:`${(total/dt)*100}%`,top:0,bottom:0,width:2,background:"var(--danger)",zIndex:6}}/>}
    </div>);
  };

  const TRow=({track:tr,index:idx,st,targetSr,targetBits})=>{
    const last=idx===st.length-1;
    const first=idx===0;
    const lvlPct=Math.min(100,Math.max(0,(tr.peakDb+40)/40*100));
    const lvlCol=tr.peakDb>-1?"var(--danger)":tr.peakDb>-3?"var(--warning)":"var(--accent)";
    const noA=!tr.audioBuffer;
    const effGap=last?null:getGap(tr,st[idx+1]);
    const fc=fmtColor(tr.format);
    // Resample indicator
    const willResample=tr.audioBuffer&&targetSr&&tr.sampleRate!==targetSr;
    const srDir=willResample?(tr.sampleRate>targetSr?"↓":"↑"):null;
    const willChangeBits=tr.audioBuffer&&tr.bitDepth!=null&&targetBits&&tr.bitDepth!==targetBits;
    const bitDir=willChangeBits?(tr.bitDepth>targetBits?"↓":"↑"):null;
    return(<div style={{marginBottom:last?0:3}}>
      <div draggable onDragStart={()=>setDragItem(tr.id)} onDragEnd={()=>setDragItem(null)}
        style={{display:"grid",gridTemplateColumns:"30px 1fr 70px 52px 32px 32px 42px 32px",
          alignItems:"center",gap:5,padding:"8px 10px",
          background:dragItem===tr.id?"var(--bg-hover)":"var(--bg-card)",borderRadius:5,fontSize:14,cursor:"grab",
          border:`1px solid ${noA?"var(--warning)":"var(--border)"}`,opacity:noA?0.65:1,transition:"background 0.15s"}}>
        <span style={{color:"var(--text-dim)",fontSize:12,textAlign:"center"}}>{String(idx+1).padStart(2,"0")}</span>
        <div style={{overflow:"hidden"}}>
          <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--text)",display:"flex",alignItems:"center",gap:5,fontSize:14}}>
            {tr.format&&tr.format!=="?"&&<span style={{fontSize:9,background:fc.bg,color:fc.fg,padding:"1px 5px",borderRadius:3,flexShrink:0,letterSpacing:"0.03em"}}>{tr.format}</span>}
            {noA&&<span style={{fontSize:9,background:"var(--warning)",color:"#fff",padding:"1px 5px",borderRadius:3,flexShrink:0}}>{T("stubLabel")}</span>}
            {tr.name}
          </div>
          <div style={{fontSize:11,color:"var(--text)",opacity:0.65,display:"flex",gap:8,marginTop:3,alignItems:"center"}}>
            <span title={T("tipSampleRate")} style={willResample?{color:srDir==="↓"?"var(--warning)":"var(--side-b)"}:{}}>{tr.sampleRate/1000}kHz{willResample&&<span style={{fontSize:9}}> {srDir}{targetSr/1000}k</span>}</span>
            <span title={T("tipBitDepth")} style={willChangeBits?{color:bitDir==="↓"?"var(--warning)":"var(--side-b)"}:{}}>
              {tr.bitDepth!=null?`${tr.bitDepth}bit`:"—bit"}{willChangeBits&&<span style={{fontSize:9}}> {bitDir}{targetBits}bit</span>}
            </span>
            <span title={T("tipChannels")}>{tr.channels}ch</span>
            <span title={T("tipPeakLevel")} style={{color:lvlCol}}>{tr.peakDb>-Infinity?`${tr.peakDb.toFixed(1)}dB pk`:"—"}</span>
            {tr.headSilence>SILENCE_MIN_DUR&&<span title={T("tipHeadSilence")} style={{fontSize:10}}>head {tr.headSilence.toFixed(1)}s</span>}
            {tr.tailSilence>SILENCE_MIN_DUR&&<span title={T("tipTailSilence")} style={{fontSize:10}}>tail {tr.tailSilence.toFixed(1)}s</span>}
          </div>
        </div>
        <span style={{fontSize:13,color:"var(--text)",textAlign:"right"}}>{fmtTimeMs(tr.duration)}</span>
        <div style={{height:5,background:"var(--bg-deep)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${lvlPct}%`,background:lvlCol,borderRadius:2}}/>
        </div>
        <button onClick={()=>moveTrack(tr.id,-1)} disabled={first} style={btnSm} title={T("moveUp")}>↑</button>
        <button onClick={()=>moveTrack(tr.id,1)} disabled={last} style={btnSm} title={T("moveDown")}>↓</button>
        <button onClick={()=>toggleSide(tr.id)} style={{...btnSm,color:"var(--accent)"}} title={`${T("moveToSide")} ${tr.side==="A"?"B":"A"}`}>{tr.side==="A"?"→B":"→A"}</button>
        <button onClick={()=>removeTrack(tr.id)} style={{...btnSm,color:"var(--danger)"}} title={T("deleteTrack")}>✕</button>
      </div>
      {!last&&effGap!=null&&(<div style={{display:"flex",alignItems:"center",gap:6,padding:"3px 10px 3px 40px",fontSize:12,color:"var(--text)",opacity:0.75}}>
        <span style={{opacity:0.4}}>┄</span><span>{T("gap")}</span>
        <input type="number" value={tr.gapOverride!=null?tr.gapOverride:Number(effGap.toFixed(1))}
          onChange={e=>setTrackGap(tr.id,e.target.value===""?null:parseFloat(e.target.value))}
          step="0.5" min="0" max="30" style={{...inpSm,width:72}}/>
        <span>s</span>
        {smartGap&&tr.gapOverride==null&&<span style={{fontSize:11,color:"var(--text)",opacity:0.5}}>auto</span>}
        {tr.gapOverride!=null&&<button onClick={()=>setTrackGap(tr.id,null)} style={{...btnSm,fontSize:11,padding:"2px 6px",color:"var(--text)"}}>{T("resetGap")}</button>}
      </div>)}
    </div>);
  };

  const SPanel=({side,st,dur})=>{
    const active=activeTab===side;
    const audioTracks=st.filter(t=>t.audioBuffer);
    const tSr=resolveExportSr(audioTracks);
    const tBits=resolveExportBits(audioTracks);
    // Pre-compute waveform segments (stable between renders unless tracks/config change)
    const wfSegments=useMemo(()=>{
      const at=st.filter(t=>t.audioBuffer);
      if(!at.length) return [];
      const gains=at.map(()=>1.0);
      if(normalizeMode==="peak"){const tl=Math.pow(10,targetDb/20);at.forEach((t,i)=>{gains[i]=t.peak>0?tl/t.peak:1.0;});}
      else if(normalizeMode==="rms"){const avg=at.reduce((s,t)=>s+t.rms,0)/at.length;at.forEach((t,i)=>{gains[i]=t.rms>0?avg/t.rms:1.0;});}
      return at.map((t,i)=>({
        id:t.id, dur:t.duration, gain:gains[i],
        gap:i<at.length-1?getGap(t,at[i+1]):0,
        peaks:t.peaks||[], channels:t.channels
      }));
    },[st,normalizeMode,targetDb,smartGap,defaultGap]);
    const specSegments=useMemo(()=>{
      const at=st.filter(t=>t.audioBuffer);
      if(!at.length) return [];
      const gains=at.map(()=>1.0);
      if(normalizeMode==="peak"){const tl=Math.pow(10,targetDb/20);at.forEach((t,i)=>{gains[i]=t.peak>0?tl/t.peak:1.0;});}
      else if(normalizeMode==="rms"){const avg=at.reduce((s,t)=>s+t.rms,0)/at.length;at.forEach((t,i)=>{gains[i]=t.rms>0?avg/t.rms:1.0;});}
      return at.map((t,i)=>({
        id:t.id,
        dur:t.duration,
        gain:gains[i],
        gap:i<at.length-1?getGap(t,at[i+1]):0,
        spectrogram:t.spectrogram||null,
      }));
    },[st,normalizeMode,targetDb,smartGap,defaultGap]);
    return(<div onDragOver={e=>{e.preventDefault();setDragOverSide(side);}} onDragLeave={()=>setDragOverSide(null)} onDrop={e=>handleDrop(e,side)}
      style={{flex:1,display:active?"flex":"none",flexDirection:"column",gap:8,minHeight:200,
        border:dragOverSide===side?`2px dashed var(--side-${side.toLowerCase()})`:"2px solid transparent",transition:"border-color 0.2s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{flex:1}}><CapBar used={dur} total={sideSec} eff={effectiveSec} side={side}/></div>
        {audioTracks.length>0&&<div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:12}}>
          <span style={{fontSize:11,color:"var(--text-dim)"}}>→ {tSr/1000}kHz / {tBits}bit</span>
          <div style={{display:"flex",gap:4}}>
            <button onClick={()=>setSidePreviewMode("waveform")} style={segBtn(sidePreviewMode==="waveform")}>{T("previewWave")}</button>
            <button onClick={()=>setSidePreviewMode("spectrogram")} style={segBtn(sidePreviewMode==="spectrogram")}>{T("previewSpectrogram")}</button>
          </div>
        </div>}
      </div>
      <TimeLine st={st} total={sideSec} eff={effectiveSec} side={side}/>
      {sidePreviewMode==="waveform"?<SideWaveform segments={wfSegments}/>:<SideSpectrogram segments={specSegments}/>}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:0}}>
        {st.length===0?(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",
            border:"1px dashed var(--border)",borderRadius:6,minHeight:120,
            color:"var(--text-dim)",fontSize:13,flexDirection:"column",gap:6}}>
            <span style={{fontSize:24,opacity:0.3}}>📼</span>
            <span>{T("dropHere")}</span>
            <span style={{fontSize:10,opacity:0.6}}>{T("dropHint")}</span>
          </div>
        ):st.map((tr,i)=><TRow key={tr.id} track={tr} index={i} st={st} targetSr={tSr} targetBits={tBits}/>)}
      </div>
    </div>);
  };

  const aHas=sideA.some(t=>t.audioBuffer), bHas=sideB.some(t=>t.audioBuffer);

  return(
    <div style={{"--bg":th.bg,"--bg-card":th.bgCard,"--bg-deep":th.bgDeep,"--bg-hover":"#F0EDEA",
      "--text":"#2D2D38","--text-dim":"#706B78","--accent":th.accent,"--accent-dim":th.accentDim,
      "--accent-contrast":accentContrast,"--accent-ink":accentInk,
      "--border":th.border,"--danger":"#C45C5C","--warning":warningColor,
      "--side-a":sideColors.sideA,"--side-b":sideColors.sideB,
      "--font-mono":"'JetBrains Mono','SF Mono','Fira Code',monospace",
      "--font-body":"'Noto Sans SC','Noto Sans JP','Hiragino Sans','Microsoft YaHei',sans-serif",
      fontFamily:"var(--font-body)",color:"var(--text)",background:"var(--bg)",
      minHeight:"100vh",padding:"20px 24px",boxSizing:"border-box",position:"relative"}}>

      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,
        background:"var(--bg-card)",border:"1px solid var(--accent)",borderRadius:8,
        padding:"10px 20px",fontSize:12,color:"var(--accent)",maxWidth:"90vw",
        boxShadow:"0 4px 20px rgba(0,0,0,0.08)",animation:"fadeIn 0.2s ease"}}>{toast}</div>}

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,borderBottom:"1px solid var(--border)",paddingBottom:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200}}>
          <h1 style={{fontSize:14,fontWeight:400,margin:0,letterSpacing:"0.02em",lineHeight:1.4}}>
            <span style={{color:"var(--accent)"}}>◉ </span>
            <span style={{fontSize:20,fontWeight:600,color:"var(--accent)"}}>S</span><span style={{fontSize:11,opacity:0.55}}>equential</span>{" "}
            <span style={{fontSize:20,fontWeight:600,color:"var(--accent)"}}>I</span><span style={{fontSize:11,opacity:0.55}}>nterleaved</span>{" "}
            <span style={{fontSize:20,fontWeight:600,color:"var(--accent)"}}>D</span><span style={{fontSize:11,opacity:0.55}}>ubbing</span>{" "}
            <span style={{fontSize:20,fontWeight:600,color:"var(--accent)"}}>E</span><span style={{fontSize:11,opacity:0.55}}>ngine</span>
          </h1>
          <div style={{fontSize:12,color:"var(--text-dim)",marginTop:3,fontStyle:"italic",opacity:0.75}}>{T("appTagline")}</div>
        </div>
        <span style={{fontSize:10,color:"var(--text-dim)"}}>{T("appVersion")}</span>
        <div style={{display:"flex",gap:2,alignItems:"center"}}>
          {Object.entries(LANGS).map(([k,l])=>(
            <button key={k} onClick={()=>setLang(k)} style={{...btnTab,fontSize:12,padding:"5px 10px",minWidth:36,textAlign:"center",
              background:lang===k?"var(--accent)":"var(--bg-card)",color:lang===k?"var(--accent-contrast)":"var(--text-dim)"}}>{l.label}</button>
          ))}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowThemePicker(p=>!p)} style={{...btnTab,fontSize:12,padding:"5px 10px",
              background:showThemePicker?"var(--accent)":"var(--bg-card)",
              color:showThemePicker?"var(--accent-contrast)":"var(--text-dim)"}} title={T("theme")}>
              <IconPalette size={16}/>
            </button>
            {showThemePicker&&<div onClick={()=>setShowThemePicker(false)} style={{position:"fixed",inset:0,zIndex:50}}/>}
            {showThemePicker&&<div style={{position:"absolute",right:0,top:"100%",marginTop:6,zIndex:51,
              background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 6px",
              boxShadow:"0 8px 28px rgba(0,0,0,0.12)",width:220,maxHeight:"70vh",overflowY:"auto"}}>
              {(()=>{
                let lastGrp="";
                return THEME_ORDER.map(k=>{
                  const t=THEMES[k];
                  const sep=t.group&&t.group!==lastGrp;
                  lastGrp=t.group;
                  return(<div key={k}>
                    {sep&&<div style={{borderTop:"1px solid var(--border)",margin:"4px 6px"}}/>}
                    <button onClick={()=>{setTheme(k);setShowThemePicker(false);}}
                      style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"6px 10px",
                        border:"none",borderRadius:6,cursor:"pointer",fontSize:13,
                        background:theme===k?"var(--accent-dim)":"transparent",
                        color:theme===k?"var(--accent-ink)":"var(--text)"}}>
                      <span style={{width:14,height:14,borderRadius:"50%",background:t.accent,flexShrink:0,
                        border:theme===k?"2px solid var(--accent-ink)":"2px solid transparent"}}/>
                      <span style={{flex:1,textAlign:"left"}}>{themeName(k, lang)}</span>
                      {theme===k&&<span style={{fontSize:10}}>✓</span>}
                    </button>
                  </div>);
                });
              })()}
            </div>}
          </div>
          <button onClick={()=>setShowHelp(true)} style={{...btnTab,fontSize:12,padding:"5px 10px",background:"var(--bg-card)",color:"var(--text-dim)"}} title={T("help")}>
            <IconHelp size={16}/>
          </button>
          <button onClick={()=>setShowAbout(true)} style={{...btnTab,fontSize:12,padding:"5px 10px",background:"var(--bg-card)",color:"var(--text-dim)"}} title={T("about")}>
            <IconInfo size={16}/>
          </button>
        </div>
      </div>

      {/* Config */}
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
        {/* Row 1: Tape physical params */}
        <div style={{display:"flex",gap:20,alignItems:"flex-start",padding:"12px 16px",background:"var(--bg-card)",borderRadius:8,border:"1px solid var(--border)",flexWrap:"wrap"}}>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={lb}>{T("tapeSpec")}</label>
            <div style={{display:"flex",gap:3}}>
              {Object.entries(TAPE_PRESETS).map(([k,p])=>(
                <button key={k} onClick={()=>setTapePreset(k)} style={{...btnTab,
                  background:tapePreset===k?"var(--accent)":"var(--bg-deep)",color:tapePreset===k?"var(--accent-contrast)":"var(--text)"}}>{p.label}</button>
              ))}
              <button onClick={()=>setTapePreset("CUSTOM")} style={{...btnTab,
                background:tapePreset==="CUSTOM"?"var(--accent)":"var(--bg-deep)",color:tapePreset==="CUSTOM"?"var(--accent-contrast)":"var(--text)"}}>{T("tapeCustom")}</button>
            </div>
            {tapePreset==="CUSTOM"&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
              <input type="number" value={customMin} onChange={e=>setCustomMin(Number(e.target.value))} min={1} max={120} style={{...inpSm,width:52}}/>
              <span style={{fontSize:12,color:"var(--text-dim)"}}>{T("minPerSide")}</span>
            </div>}
          </div>

          <div style={{width:1,height:40,background:"var(--border)",alignSelf:"center",flexShrink:0}}/>

          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
              <label style={lb}>{T("tapeType")}</label>
              <span style={{fontSize:11,color:"var(--text-dim)"}}>{TAPE_TYPES[tapeType].desc} · {T("recLevel")} {TAPE_TYPES[tapeType].peakDb}dB · {T("tapeTypeNote")}</span>
            </div>
            <div style={{display:"flex",gap:3}}>
              {Object.entries(TAPE_TYPES).map(([k,tp])=>{
                const tapeColor=tapeTypeColors[k];
                return(
                <button key={k} onClick={()=>{setTapeType(k);setTargetDb(tp.peakDb);}} style={{...btnTab,
                  background:tapeType===k?tapeColor:"var(--bg-deep)",
                  color:tapeType===k?getContrastColor(tapeColor):tapeColor,
                  border:`1px solid ${tapeColor}`,
                  boxShadow:tapeType===k?"inset 0 0 0 1px rgba(255,255,255,0.18)":"none"}}>{tp.label.split(" ")[0]} {tp.label.split(" ")[1]}</button>
              );})}
            </div>
          </div>
        </div>

        {/* Row 2: Audio processing params */}
        <div style={{display:"flex",gap:16,alignItems:"center",padding:"10px 16px",background:"var(--bg-card)",borderRadius:8,border:"1px solid var(--border)",flexWrap:"wrap"}}>
          {/* Gap */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{...lb,margin:0}}>{T("defaultGap")}</label>
            <input type="range" min={0} max={10} step={0.5} value={defaultGap} onChange={e=>setDefaultGap(Number(e.target.value))} style={{width:72,accentColor:"var(--accent)"}}/>
            <span style={{fontSize:12,minWidth:32}}>{defaultGap.toFixed(1)}s</span>
          </div>

          <div style={{width:1,height:24,background:"var(--border)",alignSelf:"center",flexShrink:0}}/>

          {/* Smart gap toggle */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{...lb,margin:0}}>{T("smartGap")}</label>
            <button onClick={()=>setSmartGap(!smartGap)} style={toggleStyle(smartGap)}>{smartGap?"ON":"OFF"}</button>
          </div>

          <div style={{width:1,height:24,background:"var(--border)",alignSelf:"center",flexShrink:0}}/>

          {/* Normalize */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{...lb,margin:0}}>{T("normalize")}</label>
            <div style={{display:"flex",gap:2}}>
              {[["off","normOff"],["peak","normPeak"],["rms","normRms"]].map(([v,k])=>(
                <button key={v} onClick={()=>setNormalizeMode(v)} style={{...btnTab,fontSize:12,padding:"4px 10px",
                  background:normalizeMode===v?"var(--accent-dim)":"var(--bg-deep)",color:normalizeMode===v?"var(--accent-ink)":"var(--text)"}}>{T(k)}</button>
              ))}
            </div>
          </div>

          <div style={{width:1,height:24,background:"var(--border)",alignSelf:"center",flexShrink:0}}/>

          {/* Tail fill */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{...lb,margin:0}}>{T("tailFill")}</label>
            <button onClick={()=>setFillTail(!fillTail)} style={toggleStyle(fillTail)}>{fillTail?"ON":"OFF"}</button>
          </div>

          <div style={{width:1,height:24,background:"var(--border)",alignSelf:"center",flexShrink:0}}/>

          {/* Tail margin */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{...lb,margin:0}}>{T("tailMargin")}</label>
            <input type="number" value={tailMargin} onChange={e=>setTailMargin(Math.max(0,Number(e.target.value)))} min={0} max={10} step={0.5} style={{...inpSm,width:52}}/>
            <span style={{fontSize:12,color:"var(--text-dim)"}}>min</span>
          </div>

          <div style={{flexBasis:"100%",height:0}}/>

          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <label style={{...lb,margin:0}}>{T("sampleRate")}</label>
              <div style={{display:"flex",gap:2}}>
                {[["auto","Auto"],["44100","44.1k"],["48000","48k"]].map(([v,label])=>{
                  const val=v==="auto"?"auto":Number(v);
                  return <button key={v} onClick={()=>setExportSr(val)} style={{...btnTab,fontSize:12,padding:"5px 10px",
                    background:exportSr===val?"var(--accent-dim)":"var(--bg-deep)",color:exportSr===val?"var(--accent-ink)":"var(--text)"}}>{label}</button>;
                })}
              </div>
            </div>
            <div style={{width:1,height:20,background:"var(--border)",alignSelf:"center",flexShrink:0}}/>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <label style={{...lb,margin:0}}>{T("bitDepth")}</label>
              <div style={{display:"flex",gap:2}}>
                {[["auto","Auto"],["16","16bit"],["24","24bit"]].map(([v,label])=>{
                  const val=v==="auto"?"auto":Number(v);
                  return <button key={v} onClick={()=>setExportBits(val)} style={{...btnTab,fontSize:12,padding:"5px 10px",
                    background:exportBits===val?"var(--accent-dim)":"var(--bg-deep)",color:exportBits===val?"var(--accent-ink)":"var(--text)"}}>{label}</button>;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="actionBar" style={{marginBottom:12}}>
        <input ref={fileRef} type="file" multiple accept="audio/*" style={{display:"none"}}
          onChange={e=>{if(e.target.files.length>0)loadFiles(Array.from(e.target.files),activeTab);e.target.value="";}}/>
        <input ref={plRef} type="file" accept=".json" style={{display:"none"}} onChange={importPL}/>
        <div className="actionBarMain">
          <button onClick={()=>fileRef.current?.click()} style={btnP} disabled={processing}><IconAdd size={16} /> {T("addFiles")} → SIDE {activeTab}</button>
          <button onClick={autoDistribute} style={btnS} disabled={processing||!tracks.length}><IconAutoAwesome size={16} /> {T("autoDistribute")}</button>
          <button onClick={()=>plRef.current?.click()} style={btnS} disabled={processing}><IconFileOpen size={16} /> {T("importPlaylist")}</button>
          <button onClick={exportPL} style={btnS} disabled={processing||!tracks.length}><IconSave size={16} /> {T("exportPlaylist")}</button>
          <button onClick={()=>{if(tracks.some(t=>t.side===activeTab))setTracks(p=>p.filter(t=>t.side!==activeTab));}} style={{...btnS,display:"flex",alignItems:"center",gap:4}} disabled={processing||!tracks.some(t=>t.side===activeTab)}><IconClearSide size={14}/>{T("clearSide")}</button>
          <button onClick={()=>{if(tracks.length>0&&window.confirm(T("clearAll")+"?"))setTracks([]);}} style={{...btnS,display:"flex",alignItems:"center",gap:4}} disabled={processing||!tracks.length}><IconClearAll size={14}/>{T("clearAll")}</button>
        </div>
        <div className="actionBarPlayback">
          {playing?
            <button onClick={stopPlayback} style={{...btnE,borderColor:"var(--danger)",color:"var(--danger)"}}><IconStop size={16} /> {T("stop")}</button>
          :<>
            <button onClick={()=>playSide("A")} style={{...btnE,borderColor:"var(--side-a)"}} disabled={processing||!aHas}><IconPlay size={16} /> A {T("play")}</button>
            <button onClick={()=>playSide("B")} style={{...btnE,borderColor:"var(--side-b)"}} disabled={processing||!bHas}><IconPlay size={16} /> B {T("play")}</button>
          </>}
          <button onClick={()=>expSide("A")} style={{...btnE,borderColor:"var(--side-a)"}} disabled={processing||playing||!aHas}><IconExport size={16} /> A {T("exportSide")}</button>
          <button onClick={()=>expSide("B")} style={{...btnE,borderColor:"var(--side-b)"}} disabled={processing||playing||!bHas}><IconExport size={16} /> B {T("exportSide")}</button>
        </div>
      </div>

      {/* Player */}
      {playing&&<Player
        playing={playing} paused={paused} playingSide={playingSide}
        playingIdxRef={playingIdxRef} playPosRef={playPosRef}
        playToken={playbackView.token}
        schedule={playbackView.schedule} totalDur={playbackView.totalDur}
        meterMode={meterMode} setMeterMode={setMeterMode}
        simMode={simMode} setSimMode={setSimMode}
        togglePause={togglePause} stopPlayback={stopPlayback}
        skipTrack={skipTrack} seekTo={seekTo}
        analyserL={analyserRef.current.L} analyserR={analyserRef.current.R}
        T={T} fmtTime={fmtTime}
      />}

      {processing&&<div style={{padding:"8px 12px",marginBottom:12,background:"var(--bg-deep)",borderRadius:6,
        fontSize:13,color:"var(--accent-ink)",display:"flex",alignItems:"center",gap:8}}>
        <span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>◌</span>
        <span>{procMsg}</span>
      </div>}

      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:8}}>
        {["A","B"].map(s=>{
          const st=s==="A"?sideA:sideB, dur=s==="A"?durA:durB, hardOver=dur>sideSec, softOver=!hardOver&&dur>effectiveSec;
          const badgeColor=hardOver?"var(--danger)":softOver?"var(--warning)":"var(--text-dim)";
          return(<button key={s} onClick={()=>setActiveTab(s)} onDragOver={e=>{e.preventDefault();setActiveTab(s);}}
            style={{flex:1,padding:"10px 16px",
              background:activeTab===s?"var(--bg-card)":"transparent",
              color:activeTab===s?`var(--side-${s.toLowerCase()})`:"var(--text-dim)",
              border:"none",borderBottom:activeTab===s?`2px solid var(--side-${s.toLowerCase()})`:"2px solid var(--border)",
              cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:"var(--font-body)",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 0.2s"}}>
            <span style={{fontSize:13,letterSpacing:"0.1em"}}>SIDE {s}</span>
            <span style={{fontSize:12,color:badgeColor,
              background:"var(--bg-deep)",padding:"2px 6px",borderRadius:3}}>
              {st.length}{T("tracks")} · {fmtTime(dur)}
            </span>
          </button>);
        })}
      </div>

      <div style={{minHeight:300}}>
        <SPanel side="A" st={sideA} dur={durA}/>
        <SPanel side="B" st={sideB} dur={durB}/>
      </div>

      {tracks.length>0&&<div style={{position:"sticky",bottom:0,zIndex:10,padding:"10px 20px",
        background:"var(--bg)",borderTop:"1px solid var(--border)",
        fontSize:12,color:"var(--text)",opacity:0.8,display:"flex",gap:16,flexWrap:"wrap"}}>
        <span>{T("total")} {tracks.length}{T("tracks")}</span>
        <span>A: {fmtTime(durA)} / {fmtTime(effectiveSec)}</span>
        <span>B: {fmtTime(durB)} / {fmtTime(effectiveSec)}</span>
        <span>{T("tape")}: {tapePreset==="CUSTOM"?`${customMin*2}min`:TAPE_PRESETS[tapePreset].label}</span>
        <span>{T("type")}: {TAPE_TYPES[tapeType].label}</span>
        {tailMargin>0&&<span>{T("tailMargin")}: {tailMargin}min</span>}
        <span>{T("smartGap")}: {smartGap?"ON":"OFF"}</span>
        <span>{T("normalize")}: {normalizeMode==="off"?"OFF":normalizeMode==="peak"?T("normPeak"):T("normRms")}</span>
        <span>WAV: {exportSr==="auto"?"Auto":exportSr/1000+"kHz"}/{exportBits==="auto"?"Auto":exportBits+"bit"}</span>
        <span style={{color:ffmpegStatus==="ready"?"#82B891":ffmpegStatus==="unavailable"?"var(--danger)":"var(--text-dim)"}}>
          ffmpeg: {ffmpegStatus==="ready"?"✓":ffmpegStatus==="loading"?"…":ffmpegStatus==="unavailable"?"✕":"standby"}
        </span>
      </div>}

      {/* Help Modal */}
      {showHelp&&<div onClick={()=>setShowHelp(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
        <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg)",borderRadius:12,maxWidth:560,width:"min(560px, calc(100vw - 32px))",maxHeight:"80vh",overflow:"hidden",
          border:"1px solid var(--border)",boxShadow:"0 8px 32px rgba(0,0,0,0.12)",fontSize:14,lineHeight:1.8,color:"var(--text)",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px 14px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
            <span style={{fontSize:16,color:"var(--accent-ink)"}}>
              {lang==="ja"?"S.I.D.E ヘルプ":lang==="en"?"S.I.D.E Help":"S.I.D.E 帮助"}
            </span>
            <button onClick={()=>setShowHelp(false)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"var(--text-dim)"}}>✕</button>
          </div>
          <div className="modalScroll" style={{padding:"18px 24px 22px",overflowY:"auto",overflowX:"hidden",minHeight:0}}>
          {lang==="zh-CN"?<div style={{display:"flex",flexDirection:"column",gap:14}}>
            <p><b>S</b>equential <b>I</b>nterleaved <b>D</b>ubbing <b>E</b>ngine<br/>
            将数字音频文件编排到磁带的 A/B 面，导出可直接录入卡座的 WAV 文件。</p>
            <div style={{fontSize:12,color:"var(--text-dim)",display:"flex",flexDirection:"column",gap:10}}>
            <p><b>{"// "}配置</b><br/>
            选择磁带规格（C-46 / C-60 / C-90 / C-120 / 自定义）和磁带类型（Type I / II / IV）。<br/>
            磁带类型影响录音电平参考值……用于响度归一化的目标。</p>
            <p><b>{"// "}操作</b><br/>
            先确认当前 SIDE，再点「添加文件」或直接把音频拖进来。这样就好。<br/>
            支持格式：MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A。<br/>
            FLAC / AIFF 原始参数会先从文件头读取；需要时再走 ffmpeg.wasm 转 WAV 供浏览器解码。<br/>
            拖动可以重排顺序；↑↓ 微调；→A / →B 直接切到另一面。</p>
            <p><b>{"// "}编排</b><br/>
            「自动分面」会按时长重新分配，优先保持两面容量平衡。<br/>
            曲间间隔可以手动写入；开启「智能检测」后，会扣除前后已有静音。<br/>
            采样率 / 位深按每一面单独解析，轨道列表里会标出升降采样方向。</p>
            <p><b>{"// "}采样率 / 位深</b><br/>
            每面独立解析。Auto 采样率 = 该面音轨的最高采样率。<br/>
            Auto 位深 = 含无损格式（FLAC/WAV/AIFF）→ 24bit，否则 → 16bit。<br/>
            原始采样率 / 位深来自源文件头，不会被 ffmpeg 的解码中间文件覆盖。<br/>
            升降采样与位深变化都会在曲目详情里标注方向和目标值。</p>
            <p><b>{"// "}试听</b><br/>
            试听按整面时间线播放，曲间间隔、归一化增益、尾部静音都会算进去。<br/>
            进度条和曲目节点都能跳转；暂停 / 继续 / 上下曲在下方控制区。<br/>
            模拟循环：OFF → TYPE I → TYPE II → TYPE IV → VINYL。仅作用于试听。<br/>
            电平表支持 VFD / VU / FFT / WAVE 四种显示模式。<br/>
            播放路径：AudioBuffer (32-bit float) → AudioContext（系统原生采样率）。</p>
            <p><b>{"// "}导出</b><br/>
            导出为 WAV 文件……直接连接卡座线路输入录制。<br/>
            降采样或位深转换的音轨会在导出前弹出确认提示。<br/>
            尾部填充：自动补齐静音到磁带标称长度。</p>
            <p><b>{"// "}歌单</b><br/>
            支持 JSON 格式歌单的导出和导入。<br/>
            导入歌单为占位模式……重新添加同名音频文件时自动匹配。</p>
            </div>
            <p style={{fontSize:11,color:"var(--text-dim)",textAlign:"right",marginTop:4}}>
              ……把声音编译进磁带里。 {RINA_SMILE}<br/>
              <span style={{fontSize:10}}>{T("appVersion")}</span>
            </p>
          </div>
          :lang==="ja"?<div style={{display:"flex",flexDirection:"column",gap:14}}>
            <p><b>S</b>equential <b>I</b>nterleaved <b>D</b>ubbing <b>E</b>ngine<br/>
            デジタル音源をカセットテープの A/B 面に配置し、デッキ入力用 WAV ファイルを書き出すツール。</p>
            <div style={{fontSize:12,color:"var(--text-dim)",display:"flex",flexDirection:"column",gap:10}}>
            <p><b>{"// "}設定</b><br/>
            テープ規格（C-46 / C-60 / C-90 / C-120 / カスタム）と種類（Type I / II / IV）を選択。<br/>
            テープ種類は録音レベル基準値に影響……ラウドネス正規化のターゲットとして使用。</p>
            <p><b>{"// "}操作</b><br/>
            まず現在の SIDE を確認してから、「ファイル追加」かドラッグ＆ドロップ。これで大丈夫。<br/>
            対応：MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A。<br/>
            FLAC / AIFF はまず元ファイルのパラメータを読み取り、必要時のみ ffmpeg.wasm で WAV 化してデコード。<br/>
            ドラッグで並べ替え、↑↓で微調整、→A / →B で面を移動。</p>
            <p><b>{"// "}配置</b><br/>
            「自動振り分け」は長さを見て A/B 面を再配置し、容量バランスを揃える。<br/>
            曲間ギャップは手動入力可能。スマートギャップ有効時は既存の無音を差し引く。<br/>
            サンプルレート / ビット深度は面ごとに決まり、各トラックに変換方向を表示。</p>
            <p><b>{"// "}サンプルレート / ビット深度</b><br/>
            面ごとに個別解決。Auto SR = その面の最高サンプルレート。<br/>
            Auto ビット深度 = ロスレス有り → 24bit、なし → 16bit。<br/>
            元の SR / ビット深度はソースファイルヘッダ基準で、ffmpeg の中間 WAV では上書きしない。</p>
            <p><b>{"// "}試聴</b><br/>
            試聴は面全体のタイムライン再生。ギャップ、正規化ゲイン、末尾無音も反映。<br/>
            シークバーと曲境界ノードでジャンプ可能。一時停止 / 再開 / 前後スキップ対応。<br/>
            シミュレーションは OFF → TYPE I → TYPE II → TYPE IV → VINYL の順で循環。試聴専用。<br/>
            メーターは VFD / VU / FFT / WAVE の4モード。<br/>
            再生経路：AudioBuffer (32-bit float) → AudioContext (ネイティブSR)。</p>
            <p><b>{"// "}書出し</b><br/>
            WAV 出力……デッキのライン入力に直結して録音。<br/>
            ダウンサンプルやビット深度変換が必要なトラックは確認ダイアログ表示。</p>
            <p><b>{"// "}プレイリスト</b><br/>
            JSON 形式で書出し・読込。読込はプレースホルダモード……同名ファイル再追加で自動マッチ。</p>
            </div>
            <p style={{fontSize:11,color:"var(--text-dim)",textAlign:"right",marginTop:4}}>
              ……音をテープにコンパイルする。 {RINA_SMILE}<br/>
              <span style={{fontSize:10}}>{T("appVersion")}</span>
            </p>
          </div>
          :<div style={{display:"flex",flexDirection:"column",gap:14}}>
            <p><b>S</b>equential <b>I</b>nterleaved <b>D</b>ubbing <b>E</b>ngine<br/>
            Arrange digital audio files onto cassette tape sides A/B and export deck-ready WAV files.</p>
            <div style={{fontSize:12,color:"var(--text-dim)",display:"flex",flexDirection:"column",gap:10}}>
            <p><b>{"// "}Configuration</b><br/>
            Select tape spec (C-46 / C-60 / C-90 / C-120 / Custom) and type (Type I / II / IV).<br/>
            Tape type sets the recording level reference used as the normalization target.</p>
            <p><b>{"// "}Operation</b><br/>
            Confirm the current SIDE first, then use "Add Files" or drag audio in. That is the whole flow.<br/>
            Supported: MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A.<br/>
            FLAC / AIFF keep source metadata from the file header first, then use ffmpeg.wasm WAV transcode only when decode fallback is needed.<br/>
            Drag to reorder, use ↑↓ for fine moves, and →A / →B to switch sides.</p>
            <p><b>{"// "}Arrangement</b><br/>
            "Auto Distribute" reallocates tracks by duration to keep side usage balanced.<br/>
            Track gaps can be entered manually, or derived by subtracting existing head/tail silence.<br/>
            Sample rate and bit depth are resolved per side, with conversion direction shown per track.</p>
            <p><b>{"// "}Sample Rate / Bit Depth</b><br/>
            Resolved independently per side. Auto SR = highest SR among the side's tracks.<br/>
            Auto bit depth = 24 if any lossless source, 16 otherwise.<br/>
            Source SR / bit depth come from the original file header, not the ffmpeg intermediate WAV.<br/>
            Resampling and bit-depth conversion direction are shown per track when they differ from target.</p>
            <p><b>{"// "}Preview</b><br/>
            Preview follows the full side timeline, including gaps, normalization gain, and tail silence.<br/>
            Use the seekbar or track markers to jump. Pause / resume / prev-next are in the transport row.<br/>
            Simulation cycles OFF → TYPE I → TYPE II → TYPE IV → VINYL, and affects preview only.<br/>
            Meter modes: VFD / VU / FFT / WAVE.<br/>
            Audio path: AudioBuffer (32-bit float) → AudioContext (system native SR).</p>
            <p><b>{"// "}Export</b><br/>
            Exports WAV — connect directly to your deck's line input.<br/>
            Downsampled or bit-depth-converted tracks trigger a confirmation dialog before export.<br/>
            Tail fill: pads silence to the tape's rated length.</p>
            <p><b>{"// "}Playlists</b><br/>
            Export/import as JSON. Imported playlists are placeholder-only — re-add audio files with matching filenames to auto-hydrate.</p>
            </div>
            <p style={{fontSize:11,color:"var(--text-dim)",textAlign:"right",marginTop:4}}>
              …compile your sound into tape. {RINA_SMILE}<br/>
              <span style={{fontSize:10}}>{T("appVersion")}</span>
            </p>
          </div>}
          </div>
        </div>
      </div>}

      {/* About Modal */}
      {showAbout&&<div onClick={()=>setShowAbout(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
        <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg)",borderRadius:12,width:"fit-content",maxWidth:"calc(100vw - 32px)",maxHeight:"80vh",overflow:"hidden",
          border:"1px solid var(--border)",boxShadow:"0 8px 32px rgba(0,0,0,0.12)",fontSize:14,lineHeight:1.9,color:"var(--text)",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px 14px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
            <span style={{fontSize:16,color:"var(--accent-ink)"}}>About</span>
            <button onClick={()=>setShowAbout(false)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"var(--text-dim)"}}>✕</button>
          </div>
          <div className="modalScroll" style={{padding:"18px 24px 22px",overflowY:"auto",overflowX:"hidden",minHeight:0}}>
            <div>Sequential Interleaved Dubbing Engine</div>
            <div>Developed by 天使天才天王寺璃奈</div>
            <div>With Claude Opus 4.6 Extended & GPT 5.4 (reasoning high, summaries auto)</div>
            <div>{APP_VERSION}</div>
            <a href={APP_GITHUB} target="_blank" rel="noreferrer" style={{color:"var(--accent-ink)",textDecoration:"none"}}>
              {`Github: ${APP_GITHUB}`}
            </a>
          </div>
        </div>
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
        button:disabled{opacity:0.35;cursor:not-allowed}button:not(:disabled):hover{filter:brightness(0.95)}
      `}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────
const lb={fontSize:13,color:"var(--text)",letterSpacing:"0.04em",textTransform:"uppercase",fontWeight:400};
const btnTab={padding:"7px 14px",border:"1px solid var(--border)",borderRadius:5,cursor:"pointer",fontSize:14,fontFamily:"inherit",transition:"all 0.15s",fontWeight:400};
const btnSm={background:"transparent",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-dim)",cursor:"pointer",fontSize:12,padding:"3px 8px",transition:"all 0.15s"};
const inpSm={background:"var(--bg-deep)",border:"1px solid var(--border)",borderRadius:4,color:"var(--text)",fontSize:14,padding:"5px 9px",outline:"none"};
const btnP={padding:"10px 20px",background:"var(--accent)",color:"var(--accent-contrast)",border:"none",borderRadius:6,cursor:"pointer",fontSize:14,fontWeight:400,fontFamily:"inherit",transition:"all 0.15s"};
const btnS={padding:"10px 20px",background:"var(--bg-card)",color:"var(--text)",border:"1px solid var(--border)",borderRadius:6,cursor:"pointer",fontSize:14,fontFamily:"inherit",transition:"all 0.15s"};
const btnE={padding:"10px 20px",background:"var(--bg-deep)",color:"var(--text)",border:"1px solid var(--border)",borderRadius:6,cursor:"pointer",fontSize:14,transition:"all 0.15s"};
const segBtn=(on)=>({padding:"4px 10px",background:on?"var(--accent-dim)":"var(--bg-deep)",color:on?"var(--accent-ink)":"var(--text-dim)",border:"1px solid var(--border)",borderRadius:999,cursor:"pointer",fontSize:11,fontFamily:"inherit",transition:"all 0.15s"});
const toggleStyle=(on)=>({padding:"5px 16px",borderRadius:12,border:"none",cursor:"pointer",
  fontSize:12,fontWeight:600,transition:"all 0.2s",letterSpacing:"0.05em",
  background:on?"var(--accent)":"var(--bg-deep)",color:on?"var(--accent-contrast)":"var(--text-dim)"});
