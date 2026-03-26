import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { transcodeToWav, likelyNeedsTranscode, isSharedArrayBufferAvailable } from "./ffmpeg-helper.js";
import { IconAdd, IconAutoAwesome, IconFileOpen, IconSave, IconPlay, IconPause, IconStop, IconSkipPrev, IconSkipNext, IconDownload, IconHelp } from "./Icons.jsx";
import Player from "./Player.jsx";
import SideWaveform from "./SideWaveform.jsx";

// ═══════════════════════════════════════════════════════════════
// SIDE — Sequential Interleaved Dubbing Engine
// 阿佐谷202室 磁带転写ツール
// ver 0.3 — build 2026.03
// by 天使天才天王寺璃奈 (Angel, Genius, Tennoji Rina)
// ═══════════════════════════════════════════════════════════════

// ── i18n ─────────────────────────────────────────────────────
const LANGS = { "zh-CN": { label: "简中" }, ja: { label: "日本語" }, en: { label: "EN" } };

const I18N = {
  appTitle:        { "zh-CN": "SIDE — 磁带转录引擎", ja: "SIDE — 磁帯転写エンジン", en: "SIDE — Cassette Dubbing Engine" },
  appSubtitle:     { "zh-CN": "阿佐谷202室 · 磁带转录工具", ja: "阿佐ヶ谷202号室 · 磁帯転写ツール", en: "Asagaya Room 202 · Cassette Transcription Tool" },
  appVersion:      { "zh-CN": "ver 0.3 · build 2026.03 · by 天使天才天王寺璃奈", ja: "ver 0.3 · build 2026.03 · by 天使天才天王寺璃奈", en: "ver 0.3 · build 2026.03 · by Angel, Genius, Tennoji Rina" },
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
  stubLabel:              { "zh-CN": "占位曲目", ja: "プレースホルダ", en: "placeholder" },
  clearSide:              { "zh-CN": "清空当前面", ja: "この面をクリア", en: "Clear this side" },
  clearAll:               { "zh-CN": "清空全部", ja: "全てクリア", en: "Clear all" },
  resampleWarn:           { "zh-CN": "以下音轨将被降采样", ja: "以下のトラックはダウンサンプリングされます", en: "The following tracks will be downsampled" },
  prevTrack:              { "zh-CN": "上一曲", ja: "前の曲", en: "Previous" },
  nextTrack:              { "zh-CN": "下一曲", ja: "次の曲", en: "Next" },
  playlistImportError:    { "zh-CN": "歌单文件解析失败", ja: "プレイリスト解析エラー", en: "Failed to parse playlist" },
  effectiveCapacity:      { "zh-CN": "有效容量", ja: "実効容量", en: "Effective capacity" },
};

function t(key, lang) { const e = I18N[key]; return e ? (e[lang] || e["zh-CN"] || key) : key; }
const RINA_SMILE = "[^_^]";

// ── Constants ────────────────────────────────────────────────
const TAPE_PRESETS = {
  C46: { label: "C-46", sideMinutes: 23 }, C60: { label: "C-60", sideMinutes: 30 },
  C90: { label: "C-90", sideMinutes: 45 }, C120: { label: "C-120", sideMinutes: 60 },
};
const TAPE_TYPES = {
  TYPE_I:  { label: "Type I (Normal)", color: "#8B7355", peakDb: -3, desc: "TDK D, Maxell UR" },
  TYPE_II: { label: "Type II (Chrome)", color: "#4A9B8E", peakDb: -1, desc: "TDK SA, Maxell XLII" },
  TYPE_IV: { label: "Type IV (Metal)", color: "#7B6B8A", peakDb: 0, desc: "TDK MA, Maxell MX" },
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
// Pre-downsample AudioBuffer to N min/max peak pairs per channel — O(samples) once at load
function downsamplePeaks(ab, N=2048){
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
function fmtTime(s){if(!s||s<0)return"0:00";return`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;}
function fmtTimeMs(s){if(!s||s<0)return"0:00.0";return`${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,"0")}`;}
let _id=0; const uid=()=>`t_${++_id}_${Date.now()}`;

// ═══════════════════════════════════════════════════════════════
export default function CassetteTool() {
  const [lang,setLang] = useState("zh-CN");
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
  const playingIdxRef = useRef(-1);
  const playPosRef = useRef(0);
  const playRef = useRef({sources:[],startTime:0,raf:null,ctx:null});
  const meterRef = useRef({el:null,peakL:0,peakR:0,decayL:0,decayR:0});
  const analyserRef = useRef({L:null,R:null});
  const [meterMode,setMeterMode] = useState("vfd"); // vfd | vu | spectrum | waveform
  const [processing,setProcessing] = useState(false);
  const [procMsg,setProcMsg] = useState("");
  const [expProg,setExpProg] = useState(null);
  const [dragOverSide,setDragOverSide] = useState(null);
  const [dragItem,setDragItem] = useState(null);
  const [activeTab,setActiveTab] = useState("A");
  const [toast,setToast] = useState(null);
  const [showHelp,setShowHelp] = useState(false);
  const [ffmpegStatus,setFfmpegStatus] = useState("idle"); // idle | loading | ready | unavailable

  const acRef = useRef(null);
  const fileRef = useRef(null);
  const plRef = useRef(null);

  const showToast = useCallback((m,d=4000)=>{setToast(m);setTimeout(()=>setToast(null),d);},[]);
  const getAC = useCallback(()=>{if(!acRef.current) acRef.current=new(window.AudioContext||window.webkitAudioContext)();return acRef.current;},[]);

  const sideMin = tapePreset==="CUSTOM"?customMin:TAPE_PRESETS[tapePreset].sideMinutes;
  const sideSec = sideMin * 60;
  const effectiveSec = Math.max(0, sideSec - tailMargin * 60);

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
      try{
        if(likelyNeedsTranscode(f.name)){
          throw new Error("format likely unsupported natively, try ffmpeg");
        }
        const buf=await f.arrayBuffer();
        ab=await ctx.decodeAudioData(buf);
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
      const peaks=downsamplePeaks(ab,2048);
      const audioMeta={audioBuffer:ab,duration:ab.duration,sampleRate:ab.sampleRate,
        channels:ab.numberOfChannels,headSilence:sil.headSilence,tailSilence:sil.tailSilence,
        peakDb:toDb(pk),rmsDb:toDb(rms),peak:pk,rms,format:ext,peaks};
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
        sampleRate:t.sampleRate,channels:t.channels,peakDb:t.peakDb,rmsDb:t.rmsDb,
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
        duration:t.duration||0,sampleRate:t.sampleRate||44100,channels:t.channels||2,audioBuffer:null,
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

  const stopPlayback = useCallback(()=>{
    playGenRef.current++;
    const p=playRef.current;
    p.sources.forEach(s=>{s.onended=null;try{s.stop();}catch(e){}});
    p.sources=[];
    if(p.raf) cancelAnimationFrame(p.raf);
    p.raf=null;p.pausedAt=null;
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
      schedule.push({name:tr.name,start:offset,dur:tr.duration,idx:i,buffer:tr.audioBuffer,gain:gains[i]});
      offset+=tr.duration;
      if(i<st.length-1) offset+=getGap(tr,st[i+1]);
    });
    return {schedule,totalDur:offset,trackCount:st.length};
  },[tracks,normalizeMode,targetDb,getGap]);

  // Start playback from a given position (seconds)
  const playFromPos = useCallback((side,fromPos)=>{
    const p=playRef.current;
    p.sources.forEach(s=>{s.onended=null;});
    p.sources.forEach(s=>{try{s.stop();}catch(e){}});
    p.sources=[];
    if(p.raf) cancelAnimationFrame(p.raf);

    const gen=++playGenRef.current;
    const ctx=getAC();
    // Resume if suspended (from pause)
    if(ctx.state==="suspended") ctx.resume();
    const {schedule,totalDur}=buildSchedule(side);
    if(!schedule.length){stopPlayback();return;}

    // Analyser chain for metering: masterGain → splitter → [analyserL, analyserR]
    const masterGain=ctx.createGain();masterGain.gain.value=1.0;
    masterGain.connect(ctx.destination);
    const splitter=ctx.createChannelSplitter(2);
    masterGain.connect(splitter);
    const analyserL=ctx.createAnalyser();analyserL.fftSize=1024;analyserL.smoothingTimeConstant=0.8;
    const analyserR=ctx.createAnalyser();analyserR.fftSize=1024;analyserR.smoothingTimeConstant=0.8;
    splitter.connect(analyserL,0);splitter.connect(analyserR,1);
    const bufL=new Float32Array(analyserL.fftSize);
    const bufR=new Float32Array(analyserR.fftSize);

    const sources=[];
    const now=ctx.currentTime;

    schedule.forEach(s=>{
      const trackEnd=s.start+s.dur;
      if(trackEnd<=fromPos) return;
      const src=ctx.createBufferSource();
      src.buffer=s.buffer;
      const gn=ctx.createGain();gn.gain.value=s.gain;
      src.connect(gn);gn.connect(masterGain);
      if(fromPos>s.start){
        const skipSec=fromPos-s.start;
        src.start(now,skipSec,s.dur-skipSec);
      } else {
        src.start(now+(s.start-fromPos));
      }
      sources.push(src);
    });

    if(!sources.length){stopPlayback();return;}
    sources[sources.length-1].onended=()=>{
      if(playGenRef.current===gen) stopPlayback();
    };

    const startTime=now-fromPos;
    analyserRef.current={L:analyserL,R:analyserR};
    playRef.current={sources,startTime,raf:null,ctx,schedule,totalDur,analyserL,analyserR,masterGain,splitter};
    setPlaying(true);setPlayingSide(side);setPaused(false);
    playingIdxRef.current=0;playPosRef.current=fromPos;

    const tick=()=>{
      if(playGenRef.current!==gen) return;
      const elapsed=ctx.currentTime-startTime;
      playPosRef.current=Math.max(0,Math.min(elapsed,totalDur));
      const cur=[...schedule].reverse().find(s=>elapsed>=s.start);
      if(cur) playingIdxRef.current=cur.idx;
      if(elapsed<totalDur) playRef.current.raf=requestAnimationFrame(tick);
    };
    playRef.current.raf=requestAnimationFrame(tick);
  },[getAC,buildSchedule,stopPlayback]);

  const playSide = useCallback((side)=>{
    setPlayingSide(side);playingIdxRef.current=0;playPosRef.current=0;
    playFromPos(side,0);
  },[playFromPos]);

  const seekTo = useCallback((pos)=>{
    if(!playingSide) return;
    playFromPos(playingSide,Math.max(0,pos));
  },[playingSide,playFromPos]);

  const skipTrack = useCallback((dir)=>{
    if(!playingSide) return;
    const schedule=playRef.current.schedule||[];
    const curIdx=playingIdxRef.current;
    const newIdx=Math.max(0,Math.min(schedule.length-1,curIdx+dir));
    playFromPos(playingSide,schedule[newIdx]?.start||0);
  },[playingSide,playFromPos]);

  // Cleanup on unmount
  useEffect(()=>()=>stopPlayback(),[stopPlayback]);

  // ── Sub-components ───────────────────────────────────────
  const CapBar=({used,total,eff,side})=>{
    // Three zones: <=eff (ok), eff<x<=total (soft warning), >total (hard exceeded)
    const hardOver=used>total, softOver=!hardOver&&used>eff;
    const barBase=total; // bar always scaled to physical tape length
    const pct=Math.min((used/barBase)*100,100);
    const effPct=(eff/barBase)*100;
    const rem=eff-used;
    const barColor=hardOver?"var(--danger)":softOver?"var(--warning)":pct>(effPct*0.9)?"var(--warning)":`var(--side-${side.toLowerCase()})`;
    const statusColor=hardOver?"var(--danger)":softOver?"var(--warning)":"var(--text-dim)";
    const statusText=hardOver?`${T("exceeded")} ${fmtTime(used-total)}`:softOver?`⚠ +${fmtTime(used-eff)} (${T("remaining")} ${fmtTime(total-used)})`:`${T("remaining")} ${fmtTime(rem)}`;
    return(<div style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4,color:"var(--text)"}}>
        <span>SIDE {side} — {fmtTime(used)} / {fmtTime(eff)}{tailMargin>0&&<span style={{opacity:0.5}}> (tape {fmtTime(total)})</span>}</span>
        <span style={{color:statusColor}}>{statusText}</span>
      </div>
      <div style={{height:6,background:"var(--bg-deep)",borderRadius:3,overflow:"hidden",position:"relative"}}>
        <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:barColor,borderRadius:3,transition:"width 0.3s,background 0.3s"}}/>
        {tailMargin>0&&<div style={{position:"absolute",left:`${effPct}%`,top:0,bottom:0,width:1,background:"var(--warning)",opacity:0.6}}/>}
      </div>
    </div>);
  };

  const TimeLine=({st,total,side})=>{
    if(!st.length) return <div style={{height:40,background:"var(--bg-deep)",borderRadius:6,border:"1px solid var(--border)"}} />;
    const segs=[];let off=0;
    st.forEach((tr,i)=>{
      segs.push({type:"t",track:tr,start:off,dur:tr.duration});off+=tr.duration;
      if(i<st.length-1){const g=getGap(tr,st[i+1]);segs.push({type:"g",start:off,dur:g});off+=g;}
    });
    const dt=Math.max(off,total);
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
      {off>total&&<div style={{position:"absolute",left:`${(total/dt)*100}%`,top:0,bottom:0,width:2,background:"var(--danger)",zIndex:5}}/>}
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
    return(<div onDragOver={e=>{e.preventDefault();setDragOverSide(side);}} onDragLeave={()=>setDragOverSide(null)} onDrop={e=>handleDrop(e,side)}
      style={{flex:1,display:active?"flex":"none",flexDirection:"column",gap:8,minHeight:200,
        border:dragOverSide===side?`2px dashed var(--side-${side.toLowerCase()})`:"2px solid transparent",transition:"border-color 0.2s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{flex:1}}><CapBar used={dur} total={sideSec} eff={effectiveSec} side={side}/></div>
        {audioTracks.length>0&&<span style={{fontSize:11,color:"var(--text-dim)",flexShrink:0,marginLeft:12}}>
          → {tSr/1000}kHz / {tBits}bit
        </span>}
      </div>
      <TimeLine st={st} total={effectiveSec} side={side}/>
      {/* Static waveform overview — memoized, only redraws on track/config change */}
      <SideWaveform segments={wfSegments}/>
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
    <div style={{"--bg":"#F5F3F0","--bg-card":"#FFFFFF","--bg-deep":"#EBE8E4","--bg-hover":"#F0EDEA",
      "--text":"#2D2D38","--text-dim":"#706B78","--accent":"#D4859A","--accent-dim":"#F2D6DE",
      "--border":"#D5D0CA","--danger":"#C45C5C","--warning":"#B89840",
      "--side-a":"#7BA3C9","--side-b":"#82B891",
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
              background:lang===k?"var(--accent)":"var(--bg-card)",color:lang===k?"var(--bg)":"var(--text-dim)"}}>{l.label}</button>
          ))}
          <button onClick={()=>setShowHelp(true)} style={{...btnTab,fontSize:12,padding:"5px 10px",background:"var(--bg-card)",color:"var(--text-dim)"}} title="Help">
            <IconHelp size={16}/>
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
                  background:tapePreset===k?"var(--accent)":"var(--bg-deep)",color:tapePreset===k?"#fff":"var(--text)"}}>{p.label}</button>
              ))}
              <button onClick={()=>setTapePreset("CUSTOM")} style={{...btnTab,
                background:tapePreset==="CUSTOM"?"var(--accent)":"var(--bg-deep)",color:tapePreset==="CUSTOM"?"#fff":"var(--text)"}}>{T("tapeCustom")}</button>
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
              {Object.entries(TAPE_TYPES).map(([k,tp])=>(
                <button key={k} onClick={()=>{setTapeType(k);setTargetDb(tp.peakDb);}} style={{...btnTab,
                  background:tapeType===k?tp.color:"var(--bg-deep)",color:tapeType===k?"#fff":"var(--text)"}}>{tp.label.split(" ")[0]} {tp.label.split(" ")[1]}</button>
              ))}
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

          <span style={{color:"var(--border)"}}>·</span>

          {/* Smart gap toggle */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{...lb,margin:0}}>{T("smartGap")}</label>
            <button onClick={()=>setSmartGap(!smartGap)} style={toggleStyle(smartGap)}>{smartGap?"ON":"OFF"}</button>
          </div>

          <span style={{color:"var(--border)"}}>·</span>

          {/* Normalize */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{...lb,margin:0}}>{T("normalize")}</label>
            <div style={{display:"flex",gap:2}}>
              {[["off","normOff"],["peak","normPeak"],["rms","normRms"]].map(([v,k])=>(
                <button key={v} onClick={()=>setNormalizeMode(v)} style={{...btnTab,fontSize:12,padding:"4px 10px",
                  background:normalizeMode===v?"var(--accent-dim)":"var(--bg-deep)",color:normalizeMode===v?"var(--accent)":"var(--text)"}}>{T(k)}</button>
              ))}
            </div>
          </div>

          <span style={{color:"var(--border)"}}>·</span>

          {/* Tail fill */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{...lb,margin:0}}>{T("tailFill")}</label>
            <button onClick={()=>setFillTail(!fillTail)} style={toggleStyle(fillTail)}>{fillTail?"ON":"OFF"}</button>
          </div>

          <span style={{color:"var(--border)"}}>·</span>

          {/* Tail margin */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{...lb,margin:0}}>{T("tailMargin")}</label>
            <input type="number" value={tailMargin} onChange={e=>setTailMargin(Math.max(0,Number(e.target.value)))} min={0} max={10} step={0.5} style={{...inpSm,width:52}}/>
            <span style={{fontSize:12,color:"var(--text-dim)"}}>min</span>
          </div>

          <span style={{color:"var(--border)"}}>·</span>

          {/* Sample rate */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{...lb,margin:0}}>{T("sampleRate")}</label>
            <div style={{display:"flex",gap:2}}>
              {[["auto","Auto"],["44100","44.1k"],["48000","48k"]].map(([v,label])=>{
                const val=v==="auto"?"auto":Number(v);
                return <button key={v} onClick={()=>setExportSr(val)} style={{...btnTab,fontSize:12,padding:"5px 10px",
                  background:exportSr===val?"var(--accent-dim)":"var(--bg-deep)",color:exportSr===val?"var(--accent)":"var(--text)"}}>{label}</button>;
              })}
            </div>
          </div>

          {/* Bit depth */}
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <label style={{...lb,margin:0}}>{T("bitDepth")}</label>
            <div style={{display:"flex",gap:2}}>
              {[["auto","Auto"],["16","16bit"],["24","24bit"]].map(([v,label])=>{
                const val=v==="auto"?"auto":Number(v);
                return <button key={v} onClick={()=>setExportBits(val)} style={{...btnTab,fontSize:12,padding:"5px 10px",
                  background:exportBits===val?"var(--accent-dim)":"var(--bg-deep)",color:exportBits===val?"var(--accent)":"var(--text)"}}>{label}</button>;
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input ref={fileRef} type="file" multiple accept="audio/*" style={{display:"none"}}
          onChange={e=>{if(e.target.files.length>0)loadFiles(Array.from(e.target.files),activeTab);e.target.value="";}}/>
        <input ref={plRef} type="file" accept=".json" style={{display:"none"}} onChange={importPL}/>
        <button onClick={()=>fileRef.current?.click()} style={btnP} disabled={processing}><IconAdd size={16} /> {T("addFiles")} → SIDE {activeTab}</button>
        <button onClick={autoDistribute} style={btnS} disabled={processing||!tracks.length}><IconAutoAwesome size={16} /> {T("autoDistribute")}</button>
        <button onClick={()=>plRef.current?.click()} style={btnS} disabled={processing}><IconFileOpen size={16} /> {T("importPlaylist")}</button>
        <button onClick={exportPL} style={btnS} disabled={processing||!tracks.length}><IconSave size={16} /> {T("exportPlaylist")}</button>
        <button onClick={()=>{if(tracks.some(t=>t.side===activeTab))setTracks(p=>p.filter(t=>t.side!==activeTab));}} style={btnS} disabled={processing||!tracks.some(t=>t.side===activeTab)}>{T("clearSide")}</button>
        <button onClick={()=>{if(tracks.length>0&&window.confirm(T("clearAll")+"?"))setTracks([]);}} style={btnS} disabled={processing||!tracks.length}>{T("clearAll")}</button>
        <div style={{flex:1}}/>
        {/* Play / Export */}
        {playing?
          <button onClick={stopPlayback} style={{...btnE,borderColor:"var(--danger)",color:"var(--danger)"}}><IconStop size={16} /> {T("stop")}</button>
        :<>
          <button onClick={()=>playSide("A")} style={{...btnE,borderColor:"var(--side-a)"}} disabled={processing||!aHas}><IconPlay size={16} /> A {T("play")}</button>
          <button onClick={()=>playSide("B")} style={{...btnE,borderColor:"var(--side-b)"}} disabled={processing||!bHas}><IconPlay size={16} /> B {T("play")}</button>
        </>}
        <button onClick={()=>expSide("A")} style={{...btnE,borderColor:"var(--side-a)"}} disabled={processing||playing||!aHas}><IconDownload size={16} /> A {T("exportSide")}</button>
        <button onClick={()=>expSide("B")} style={{...btnE,borderColor:"var(--side-b)"}} disabled={processing||playing||!bHas}><IconDownload size={16} /> B {T("exportSide")}</button>
      </div>

      {/* Player */}
      {playing&&<Player
        playing={playing} paused={paused} playingSide={playingSide}
        playingIdxRef={playingIdxRef} playPosRef={playPosRef}
        schedule={playRef.current.schedule} totalDur={playRef.current.totalDur||0}
        meterMode={meterMode} setMeterMode={setMeterMode}
        togglePause={togglePause} stopPlayback={stopPlayback}
        skipTrack={skipTrack} seekTo={seekTo}
        analyserL={analyserRef.current.L} analyserR={analyserRef.current.R}
        T={T} fmtTime={fmtTime}
      />}

      {processing&&<div style={{padding:"8px 12px",marginBottom:12,background:"var(--bg-deep)",borderRadius:6,
        fontSize:13,color:"var(--accent)",display:"flex",alignItems:"center",gap:8}}>
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
      {showHelp&&<div onClick={()=>setShowHelp(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg)",borderRadius:12,padding:"24px 28px",maxWidth:560,maxHeight:"80vh",overflowY:"auto",
          border:"1px solid var(--border)",boxShadow:"0 8px 32px rgba(0,0,0,0.12)",fontSize:14,lineHeight:1.8,color:"var(--text)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <span style={{fontSize:16,color:"var(--accent)"}}>
              {lang==="ja"?"SIDE ヘルプ":lang==="en"?"SIDE Help":"SIDE 帮助"}
            </span>
            <button onClick={()=>setShowHelp(false)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"var(--text-dim)"}}>✕</button>
          </div>
          {lang==="zh-CN"?<div style={{display:"flex",flexDirection:"column",gap:14}}>
            <p><b>SIDE</b> — Sequential Interleaved Dubbing Engine<br/>
            将数字音频文件编排到磁带的 A/B 面，导出可直接录入卡座的 WAV 文件。</p>
            <div style={{fontSize:12,color:"var(--text-dim)",display:"flex",flexDirection:"column",gap:10}}>
            <p><b>{"// "}配置</b><br/>
            选择磁带规格（C-46 / C-60 / C-90 / C-120 / 自定义）和磁带类型（Type I / II / IV）。<br/>
            磁带类型影响录音电平参考值……用于响度归一化的目标。</p>
            <p><b>{"// "}添加音频</b><br/>
            点击「添加文件」或直接拖放音频到页面。<br/>
            支持格式：MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A。<br/>
            FLAC 和 AIFF 解码需要 ffmpeg.wasm……首次使用时自动加载。<br/>
            需要浏览器支持 SharedArrayBuffer（COOP/COEP 头）。</p>
            <p><b>{"// "}曲目管理</b><br/>
            拖动排序……上下箭头移动……→B / →A 跨面移动。<br/>
            「自动分面」使用首次适应递减装箱算法……兼顾容量平衡。<br/>
            曲间间隔：手动设定或开启「智能检测」（分析首尾静音自动计算）。</p>
            <p><b>{"// "}采样率 / 位深</b><br/>
            每面独立解析。Auto 采样率 = 该面音轨的最高采样率。<br/>
            Auto 位深 = 含无损格式（FLAC/WAV/AIFF）→ 24bit，否则 → 16bit。<br/>
            升降采样在曲目详情里会标注方向和目标值。</p>
            <p><b>{"// "}试听</b><br/>
            按整面顺序播放……含曲间间隔和归一化增益。<br/>
            进度条可点击跳转。支持暂停 / 继续 / 上下曲。<br/>
            电平表支持 VFD 段式 / VU 指针两种模式……点击右上角切换。<br/>
            播放路径：AudioBuffer (32-bit float) → AudioContext (系统原生采样率)。</p>
            <p><b>{"// "}导出</b><br/>
            导出为 WAV 文件……直接连接卡座线路输入录制。<br/>
            降采样音轨会在导出前弹出确认提示。<br/>
            尾部填充：自动补齐静音到磁带标称长度。</p>
            <p><b>{"// "}歌单</b><br/>
            支持 JSON 格式歌单的导出和导入。<br/>
            导入歌单为占位模式……重新添加同名音频文件时自动匹配。</p>
            </div>
            <p style={{fontSize:11,color:"var(--text-dim)",textAlign:"right",marginTop:4}}>
              ……把声音编译进磁带里。 {RINA_SMILE}<br/>
              <span style={{fontSize:10}}>ver 0.3 · by Tennoji Rina</span>
            </p>
          </div>
          :lang==="ja"?<div style={{display:"flex",flexDirection:"column",gap:14}}>
            <p><b>SIDE</b> — Sequential Interleaved Dubbing Engine<br/>
            デジタル音源をカセットテープの A/B 面に配置し、デッキ入力用 WAV ファイルを書き出すツール。</p>
            <div style={{fontSize:12,color:"var(--text-dim)",display:"flex",flexDirection:"column",gap:10}}>
            <p><b>{"// "}設定</b><br/>
            テープ規格（C-46 / C-60 / C-90 / C-120 / カスタム）と種類（Type I / II / IV）を選択。<br/>
            テープ種類は録音レベル基準値に影響……ラウドネス正規化のターゲットとして使用。</p>
            <p><b>{"// "}オーディオ追加</b><br/>
            「ファイル追加」ボタンまたはドラッグ＆ドロップ。<br/>
            対応：MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A。<br/>
            FLAC・AIFF は ffmpeg.wasm で変換……初回時に自動ロード。</p>
            <p><b>{"// "}トラック管理</b><br/>
            ドラッグ並替……矢印で移動……→B / →A で面切替。<br/>
            「自動振り分け」はファーストフィット減少法で容量バランスを最適化。<br/>
            曲間ギャップ：手動設定 or スマートギャップ検出（先頭/末尾の無音を解析）。</p>
            <p><b>{"// "}サンプルレート / ビット深度</b><br/>
            面ごとに個別解決。Auto SR = その面の最高サンプルレート。<br/>
            Auto ビット深度 = ロスレス有り → 24bit、なし → 16bit。</p>
            <p><b>{"// "}試聴</b><br/>
            面ごとに全曲順序再生……ギャップ・正規化ゲイン反映。<br/>
            シークバーでジャンプ。一時停止 / 再開 / 前後スキップ。<br/>
            メーター：VFDセグメント / VUニードル切替。<br/>
            再生経路：AudioBuffer (32-bit float) → AudioContext (ネイティブSR)。</p>
            <p><b>{"// "}書出し</b><br/>
            WAV 出力……デッキのライン入力に直結して録音。<br/>
            ダウンサンプルが必要なトラックは確認ダイアログ表示。</p>
            <p><b>{"// "}プレイリスト</b><br/>
            JSON 形式で書出し・読込。読込はプレースホルダモード……同名ファイル再追加で自動マッチ。</p>
            </div>
            <p style={{fontSize:11,color:"var(--text-dim)",textAlign:"right",marginTop:4}}>
              ……音をテープにコンパイルする。 {RINA_SMILE}<br/>
              <span style={{fontSize:10}}>ver 0.3 · by Tennoji Rina</span>
            </p>
          </div>
          :<div style={{display:"flex",flexDirection:"column",gap:14}}>
            <p><b>SIDE</b> — Sequential Interleaved Dubbing Engine<br/>
            Arrange digital audio files onto cassette tape sides A/B and export deck-ready WAV files.</p>
            <div style={{fontSize:12,color:"var(--text-dim)",display:"flex",flexDirection:"column",gap:10}}>
            <p><b>{"// "}Configuration</b><br/>
            Select tape spec (C-46 / C-60 / C-90 / C-120 / Custom) and type (Type I / II / IV).<br/>
            Tape type sets the recording level reference used as the normalization target.</p>
            <p><b>{"// "}Adding Audio</b><br/>
            Click "Add Files" or drag and drop onto the page.<br/>
            Supported: MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A.<br/>
            FLAC and AIFF require ffmpeg.wasm — auto-loaded on first use (needs SharedArrayBuffer).</p>
            <p><b>{"// "}Track Management</b><br/>
            Drag to reorder. Arrow buttons to move. →B / →A to switch sides.<br/>
            "Auto Distribute" uses first-fit-decreasing bin packing for balanced allocation.<br/>
            Track gaps: manual or smart detection (analyzes head/tail silence).</p>
            <p><b>{"// "}Sample Rate / Bit Depth</b><br/>
            Resolved independently per side. Auto SR = highest SR among the side's tracks.<br/>
            Auto bit depth = 24 if any lossless source, 16 otherwise.<br/>
            Resampling direction shown per track when SR differs from target.</p>
            <p><b>{"// "}Preview</b><br/>
            Plays the full side sequentially with gaps and normalization gain applied.<br/>
            Click seekbar to jump. Pause / resume / skip prev-next.<br/>
            Meter: toggle VFD segments / VU needle via the label in the top-right corner.<br/>
            Audio path: AudioBuffer (32-bit float) → AudioContext (system native SR).</p>
            <p><b>{"// "}Export</b><br/>
            Exports WAV — connect directly to your deck's line input.<br/>
            Downsampled tracks trigger a confirmation dialog before export.<br/>
            Tail fill: pads silence to the tape's rated length.</p>
            <p><b>{"// "}Playlists</b><br/>
            Export/import as JSON. Imported playlists are placeholder-only — re-add audio files with matching filenames to auto-hydrate.</p>
            </div>
            <p style={{fontSize:11,color:"var(--text-dim)",textAlign:"right",marginTop:4}}>
              …compile your sound into tape. {RINA_SMILE}<br/>
              <span style={{fontSize:10}}>ver 0.3 · by Tennoji Rina</span>
            </p>
          </div>}
        </div>
      </div>}

      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--bg-deep)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
        input[type="number"]{-moz-appearance:textfield}input[type="number"]::-webkit-inner-spin-button{opacity:0.5}
        button:disabled{opacity:0.35;cursor:not-allowed}button:not(:disabled):hover{filter:brightness(0.95)}
      `}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────
const fg={display:"flex",flexDirection:"column",gap:4};
const lb={fontSize:13,color:"var(--text)",letterSpacing:"0.04em",textTransform:"uppercase",fontWeight:400};
const btnTab={padding:"7px 14px",border:"1px solid var(--border)",borderRadius:5,cursor:"pointer",fontSize:14,fontFamily:"inherit",transition:"all 0.15s",fontWeight:400};
const btnSm={background:"transparent",border:"1px solid var(--border)",borderRadius:3,color:"var(--text-dim)",cursor:"pointer",fontSize:12,padding:"3px 8px",transition:"all 0.15s"};
const inpSm={background:"var(--bg-deep)",border:"1px solid var(--border)",borderRadius:4,color:"var(--text)",fontSize:14,padding:"5px 9px",outline:"none"};
const btnP={padding:"10px 20px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontSize:14,fontWeight:400,fontFamily:"inherit",transition:"all 0.15s"};
const btnS={padding:"10px 20px",background:"var(--bg-card)",color:"var(--text)",border:"1px solid var(--border)",borderRadius:6,cursor:"pointer",fontSize:14,fontFamily:"inherit",transition:"all 0.15s"};
const btnE={padding:"10px 20px",background:"var(--bg-deep)",color:"var(--text)",border:"1px solid var(--border)",borderRadius:6,cursor:"pointer",fontSize:14,transition:"all 0.15s"};
const toggleStyle=(on)=>({padding:"5px 16px",borderRadius:12,border:"none",cursor:"pointer",
  fontSize:12,fontWeight:600,transition:"all 0.2s",letterSpacing:"0.05em",
  background:on?"var(--accent)":"var(--bg-deep)",color:on?"#fff":"var(--text-dim)"});
