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
