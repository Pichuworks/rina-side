/**
 * curve-analyzer.js
 *
 * Pure math analysis of frequency response curves.
 * Takes frequenciesHz + dB arrays, returns structured descriptors.
 */

const BANDS = [
  { id: "sub_bass",   label: "超低频", labelJa: "超低域",   labelEn: "Sub-bass",   lo: 20,   hi: 60 },
  { id: "bass",       label: "低频",   labelJa: "低域",     labelEn: "Bass",       lo: 60,   hi: 250 },
  { id: "low_mid",    label: "中低频", labelJa: "中低域",   labelEn: "Low-mid",    lo: 250,  hi: 500 },
  { id: "mid",        label: "中频",   labelJa: "中域",     labelEn: "Mid",        lo: 500,  hi: 2000 },
  { id: "upper_mid",  label: "中高频", labelJa: "中高域",   labelEn: "Upper-mid",  lo: 2000, hi: 4000 },
  { id: "presence",   label: "临场感", labelJa: "プレゼンス", labelEn: "Presence", lo: 4000, hi: 8000 },
  { id: "brilliance", label: "高频",   labelJa: "高域",     labelEn: "Brilliance", lo: 8000, hi: 16000 },
  { id: "air",        label: "超高频", labelJa: "超高域",   labelEn: "Air",        lo: 16000, hi: 20000 },
];

function indicesInRange(freqs, lo, hi) {
  const out = [];
  for (let i = 0; i < freqs.length; i++) {
    if (freqs[i] >= lo && freqs[i] <= hi) out.push(i);
  }
  return out;
}

function avgDb(db, indices) {
  if (!indices.length) return 0;
  let sum = 0;
  for (const i of indices) sum += db[i] ?? 0;
  return sum / indices.length;
}

function maxAbsDb(db, indices) {
  let max = 0;
  for (const i of indices) {
    const v = Math.abs(db[i] ?? 0);
    if (v > max) max = v;
  }
  return max;
}

/**
 * Analyze a single channel's frequency response.
 */
export function analyseChannel(freqs, db) {
  if (!freqs?.length || !db?.length) return null;

  // Mid-range anchor (500-2kHz average)
  const midIndices = indicesInRange(freqs, 500, 2000);
  const midAvg = avgDb(db, midIndices);

  // Relative to mid average
  const relDb = db.map((v) => (v ?? 0) - midAvg);

  // Per-band analysis
  const bands = BANDS.map((band) => {
    const idx = indicesInRange(freqs, band.lo, band.hi);
    const avg = avgDb(relDb, idx);
    const peak = maxAbsDb(relDb, idx);
    return { ...band, avg: Number(avg.toFixed(1)), peak: Number(peak.toFixed(1)), count: idx.length };
  }).filter((b) => b.count > 0);

  // Overall tilt: average of bass region vs average of brilliance region
  const bassAvg = avgDb(relDb, indicesInRange(freqs, 60, 250));
  const highAvg = avgDb(relDb, indicesInRange(freqs, 8000, 16000));
  const tilt = bassAvg - highAvg; // positive = warm, negative = bright

  // Find HF rolloff point (-3dB from mid reference)
  let rolloffHz = null;
  for (let i = freqs.length - 1; i >= 0; i--) {
    if (relDb[i] >= -3) { rolloffHz = Math.round(freqs[i]); break; }
  }

  // Find notable peaks/dips (> 3dB deviation from neighbors)
  const anomalies = [];
  for (let i = 2; i < freqs.length - 2; i++) {
    const local = (relDb[i - 2] + relDb[i - 1] + relDb[i + 1] + relDb[i + 2]) / 4;
    const diff = relDb[i] - local;
    if (Math.abs(diff) > 3) {
      anomalies.push({
        freqHz: Math.round(freqs[i]),
        deviationDb: Number(diff.toFixed(1)),
        type: diff > 0 ? "peak" : "dip",
      });
    }
  }

  // Overall flatness (RMS deviation from mid reference)
  const fullIndices = indicesInRange(freqs, 60, 16000);
  let rmsSum = 0;
  for (const i of fullIndices) rmsSum += relDb[i] * relDb[i];
  const flatnessRms = Math.sqrt(rmsSum / Math.max(1, fullIndices.length));

  return {
    midAvg: Number(midAvg.toFixed(1)),
    bands,
    tilt: Number(tilt.toFixed(1)),
    tiltLabel: tilt > 2 ? "warm" : tilt < -2 ? "bright" : tilt > 0.8 ? "slightly_warm" : tilt < -0.8 ? "slightly_bright" : "neutral",
    rolloffHz,
    anomalies: anomalies.slice(0, 5), // top 5
    flatnessRms: Number(flatnessRms.toFixed(2)),
    flatnessLabel: flatnessRms < 1.5 ? "very_flat" : flatnessRms < 3 ? "flat" : flatnessRms < 5 ? "colored" : "very_colored",
  };
}

/**
 * Analyze L/R channel difference.
 */
export function analyseStereoBalance(freqs, dbL, dbR) {
  if (!freqs?.length || !dbL?.length || !dbR?.length) return null;
  const fullIndices = indicesInRange(freqs, 60, 16000);
  let maxDiff = 0;
  let maxDiffFreq = 0;
  let sumDiffSq = 0;
  for (const i of fullIndices) {
    const diff = Math.abs((dbL[i] ?? 0) - (dbR[i] ?? 0));
    sumDiffSq += diff * diff;
    if (diff > maxDiff) { maxDiff = diff; maxDiffFreq = Math.round(freqs[i]); }
  }
  const rmsDiff = Math.sqrt(sumDiffSq / Math.max(1, fullIndices.length));
  return {
    rmsDiff: Number(rmsDiff.toFixed(2)),
    maxDiff: Number(maxDiff.toFixed(1)),
    maxDiffFreq,
    label: rmsDiff < 0.5 ? "excellent" : rmsDiff < 1.0 ? "good" : rmsDiff < 2.0 ? "moderate" : "poor",
  };
}

/**
 * Analyze transport diagnostics.
 */
export function analyseTransport(transport) {
  if (!transport) return null;
  const speedPct = Math.abs(transport.speedErrorPercent || 0);
  const wfRms = transport.wowFlutterPercentRms || 0;
  return {
    speedErrorPercent: Number(speedPct.toFixed(3)),
    speedLabel: speedPct < 0.1 ? "excellent" : speedPct < 0.3 ? "good" : speedPct < 1.0 ? "moderate" : "poor",
    speedFast: (transport.speedErrorPercent || 0) > 0,
    wfRms: Number(wfRms.toFixed(3)),
    wfLabel: wfRms < 0.05 ? "excellent" : wfRms < 0.1 ? "good" : wfRms < 0.2 ? "moderate" : "poor",
  };
}

/**
 * Analyze EQ compile result.
 */
export function analyseEqResult(compileResult) {
  if (!compileResult?.ok) return null;
  const fitScore = compileResult.fitScore ?? 0;
  const steps = (compileResult.eqSteps || []).filter((s) => s.value !== 0);
  const maxBoost = steps.reduce((m, s) => Math.max(m, s.value), 0);
  const maxCut = steps.reduce((m, s) => Math.min(m, s.value), 0);
  return {
    fitScore: Number(fitScore.toFixed(3)),
    fitLabel: fitScore >= 0.9 ? "excellent" : fitScore >= 0.8 ? "good" : fitScore >= 0.65 ? "moderate" : "poor",
    activeSteps: steps.length,
    totalSteps: (compileResult.eqSteps || []).length,
    maxBoost,
    maxCut,
    usableBandHz: compileResult.usableBandHz || null,
  };
}

export { BANDS };

// ── Tag system ───────────────────────────────────────────────

const TAG_DEFS = [
  // Error/failure tags
  { id: "fail",         label: { "zh-CN": "失败", ja: "失敗", en: "FAIL" },           color: "#dc3545", priority: 100 },
  // Excellence
  { id: "reference",    label: { "zh-CN": "参考级", ja: "リファレンス", en: "REF" },     color: "#28a745", priority: 90 },
  // Transport problems
  { id: "wf_high",      label: { "zh-CN": "抖晃高", ja: "W/F高", en: "W/F HIGH" },     color: "#dc3545", priority: 85 },
  { id: "speed_off",    label: { "zh-CN": "速度偏差", ja: "速度ずれ", en: "SPEED" },    color: "#e8a040", priority: 80 },
  // Channel issues
  { id: "ch_imbalance", label: { "zh-CN": "声道偏差", ja: "ch偏差", en: "CH DIFF" },    color: "#e8a040", priority: 78 },
  // Tonal character
  { id: "warm",         label: { "zh-CN": "暖", ja: "ウォーム", en: "WARM" },           color: "#e87040", priority: 60 },
  { id: "sl_warm",      label: { "zh-CN": "略暖", ja: "やや暖", en: "SL.WARM" },       color: "#d4956a", priority: 55 },
  { id: "neutral",      label: { "zh-CN": "中性", ja: "中立", en: "NEUTRAL" },          color: "#888", priority: 50 },
  { id: "sl_bright",    label: { "zh-CN": "略亮", ja: "やや明", en: "SL.BRIGHT" },     color: "#5b9bd5", priority: 55 },
  { id: "bright",       label: { "zh-CN": "亮", ja: "ブライト", en: "BRIGHT" },         color: "#4080e8", priority: 60 },
  // Frequency character
  { id: "bass_full",    label: { "zh-CN": "低频饱满", ja: "低域豊か", en: "BASS+" },    color: "#c87030", priority: 45 },
  { id: "bass_thin",    label: { "zh-CN": "低频偏薄", ja: "低域薄", en: "BASS−" },     color: "#6090c0", priority: 45 },
  { id: "hf_good",      label: { "zh-CN": "高频延伸", ja: "高域◎", en: "HF EXT" },     color: "#28a745", priority: 40 },
  { id: "hf_narrow",    label: { "zh-CN": "高频窄", ja: "高域狭", en: "HF NAR" },      color: "#e8a040", priority: 42 },
  // Transport good
  { id: "transport_ok", label: { "zh-CN": "走带稳", ja: "走行◎", en: "STABLE" },       color: "#28a745", priority: 35 },
  { id: "ch_good",      label: { "zh-CN": "声道均衡", ja: "ch良好", en: "CH OK" },      color: "#28a745", priority: 30 },
  // Flatness
  { id: "flat",         label: { "zh-CN": "平坦", ja: "フラット", en: "FLAT" },         color: "#28a745", priority: 38 },
  { id: "colored",      label: { "zh-CN": "染色", ja: "色付き", en: "COLORED" },        color: "#e8a040", priority: 38 },
  // EQ fit
  { id: "fit_good",     label: { "zh-CN": "拟合好", ja: "適合◎", en: "FIT OK" },       color: "#28a745", priority: 70 },
  { id: "fit_poor",     label: { "zh-CN": "拟合差", ja: "適合✕", en: "FIT LOW" },      color: "#dc3545", priority: 75 },
];

const TAG_MAP = new Map(TAG_DEFS.map((t) => [t.id, t]));

export function generateTags(analysis, { transport, balance, eqResult, error } = {}) {
  const tags = [];
  const add = (id) => { const def = TAG_MAP.get(id); if (def) tags.push(def); };

  if (error) { add("fail"); return tags.slice(0, 5); }

  if (analysis) {
    // Reference grade
    if (analysis.flatnessRms < 1.0 && analysis.rolloffHz && analysis.rolloffHz >= 16000) add("reference");
    // Tilt
    if (analysis.tiltLabel === "warm") add("warm");
    else if (analysis.tiltLabel === "slightly_warm") add("sl_warm");
    else if (analysis.tiltLabel === "bright") add("bright");
    else if (analysis.tiltLabel === "slightly_bright") add("sl_bright");
    else add("neutral");
    // Bass
    const bass = analysis.bands.find((b) => b.id === "bass");
    if (bass && bass.avg > 2) add("bass_full");
    else if (bass && bass.avg < -2) add("bass_thin");
    // HF
    if (analysis.rolloffHz) {
      if (analysis.rolloffHz >= 18000) add("hf_good");
      else if (analysis.rolloffHz < 12000) add("hf_narrow");
    }
    // Flatness
    if (analysis.flatnessRms < 2) add("flat");
    else if (analysis.flatnessRms > 4) add("colored");
  }

  if (transport) {
    if (transport.wfRms > 0.2) add("wf_high");
    else if (transport.wfLabel === "excellent" || transport.wfLabel === "good") add("transport_ok");
    if (transport.speedErrorPercent > 0.5) add("speed_off");
  }

  if (balance) {
    if (balance.rmsDiff > 1.5) add("ch_imbalance");
    else if (balance.label === "excellent" || balance.label === "good") add("ch_good");
  }

  if (eqResult) {
    if (eqResult.fitLabel === "excellent" || eqResult.fitLabel === "good") add("fit_good");
    else if (eqResult.fitLabel === "poor") add("fit_poor");
  }

  // Sort by priority descending, take top 5
  tags.sort((a, b) => b.priority - a.priority);
  return tags.slice(0, 5);
}
