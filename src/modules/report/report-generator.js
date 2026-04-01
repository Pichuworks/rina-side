/**
 * report-generator.js
 *
 * Takes structured analysis from curve-analyzer and produces
 * human-readable reports in Rina's voice.
 *
 * Each generator returns { summary: string, full: string }.
 * Summary is 1-2 lines for inline display.
 * Full is the complete report for the expanded modal / export.
 */

import {
  analyseChannel,
  analyseStereoBalance,
  analyseTransport,
  analyseEqResult,
  analyseClarity,
  generateTags,
} from "./curve-analyzer.js";

// ── Text helpers ─────────────────────────────────────────────

const TILT_TEXT = {
  "zh-CN": { warm: "偏暖", slightly_warm: "略偏暖", neutral: "中性", slightly_bright: "略偏亮", bright: "偏亮" },
  ja: { warm: "ウォーム", slightly_warm: "やや暖色", neutral: "中立", slightly_bright: "やや明るめ", bright: "ブライト" },
  en: { warm: "warm", slightly_warm: "slightly warm", neutral: "neutral", slightly_bright: "slightly bright", bright: "bright" },
};

const FLAT_TEXT = {
  "zh-CN": { very_flat: "非常平坦", flat: "比较平坦", colored: "有一定染色", very_colored: "染色明显" },
  ja: { very_flat: "とてもフラット", flat: "おおむねフラット", colored: "色付きあり", very_colored: "色付きが顕著" },
  en: { very_flat: "very flat", flat: "fairly flat", colored: "noticeably colored", very_colored: "heavily colored" },
};

const BALANCE_TEXT = {
  "zh-CN": { excellent: "非常好", good: "良好", moderate: "有差异", poor: "差异较大" },
  ja: { excellent: "非常に良好", good: "良好", moderate: "差あり", poor: "差が大きい" },
  en: { excellent: "excellent", good: "good", moderate: "moderate difference", poor: "significant difference" },
};

const SPEED_TEXT = {
  "zh-CN": { excellent: "非常准", good: "良好", moderate: "有偏差", poor: "偏差较大" },
  ja: { excellent: "非常に正確", good: "良好", moderate: "ずれあり", poor: "ずれが大きい" },
  en: { excellent: "excellent", good: "good", moderate: "some deviation", poor: "significant deviation" },
};

const WF_TEXT = {
  "zh-CN": { excellent: "非常稳", good: "良好", moderate: "有抖动", poor: "抖动明显" },
  ja: { excellent: "非常に安定", good: "良好", moderate: "揺れあり", poor: "揺れが大きい" },
  en: { excellent: "excellent", good: "good", moderate: "some flutter", poor: "notable flutter" },
};

const FIT_TEXT = {
  "zh-CN": { excellent: "拟合很好", good: "拟合良好", moderate: "拟合一般", poor: "拟合较差" },
  ja: { excellent: "適合度◎", good: "適合度○", moderate: "適合度△", poor: "適合度✕" },
  en: { excellent: "excellent fit", good: "good fit", moderate: "moderate fit", poor: "poor fit" },
};

function hz(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}kHz` : `${v}Hz`;
}

function sign(v) {
  return v > 0 ? `+${v}` : `${v}`;
}

function pickValidationTone(toneMap) {
  return (toneMap || []).find((point) => point.role === "validate") || null;
}

function pickHotTone(toneMap) {
  const points = [...(toneMap || [])];
  if (!points.length) return null;
  points.sort((a, b) => (b.inputDb || 0) - (a.inputDb || 0));
  return points[0];
}

// ── Report: Deck Calibration ─────────────────────────────────

export function generateDeckCalibrationReport(responseAnalysis, transportAnalysis, lang = "zh-CN") {
  if (!responseAnalysis?.frequenciesHz?.length) return null;

  const freqs = responseAnalysis.frequenciesHz;
  const chL = responseAnalysis.channels?.L;
  const chR = responseAnalysis.channels?.R;
  const measuredL = chL?.measuredDb?.length ? chL.measuredDb : chL?.correctionDb?.map((value) => -value);
  const measuredR = chR?.measuredDb?.length ? chR.measuredDb : chR?.correctionDb?.map((value) => -value);
  const aL = measuredL ? analyseChannel(freqs, measuredL) : null;
  const aR = measuredR ? analyseChannel(freqs, measuredR) : null;
  const bal = measuredL && measuredR ? analyseStereoBalance(freqs, measuredL, measuredR, 100, 8000) : null;
  const balHf = measuredL && measuredR ? analyseStereoBalance(freqs, measuredL, measuredR, 8000, 16000) : null;
  const clarity = analyseClarity(responseAnalysis);
  const tr = analyseTransport(transportAnalysis);
  const transportIsRelative = transportAnalysis?.transportReferenceMode === "writer-relative";
  const toneMapL = responseAnalysis.dynamicModel?.toneMap?.L || [];
  const toneMapR = responseAnalysis.dynamicModel?.toneMap?.R || [];
  const validationToneL = pickValidationTone(toneMapL);
  const validationToneR = pickValidationTone(toneMapR);
  const hotToneL = pickHotTone(toneMapL);
  const hotToneR = pickHotTone(toneMapR);
  // Use L channel as primary for summary
  const a = aL || aR;
  if (!a) return null;

  if (lang === "zh-CN") {
    const lines = [];
    lines.push(`## 卡座校准报告`);
    lines.push(``);
    lines.push(`### 测量说明`);
    lines.push(`这份结果反映的是 **录制 + 回放整条链路** 的综合特性（校准信号 → 磁头录制 → 磁带 → 磁头回放 → 输出）。录制端和回放端的偏差混在一起，无法从单次自录自放中分离。`);
    lines.push(``);
    lines.push(`**如何单独测录制特性：**`);
    lines.push(`方法 A（有标准校准带）：先用标准校准带（如 ABEX/TDK 测试带）回放，测出本机的回放偏差。然后从自录自放结果中减去回放偏差 = 录制特性。`);
    lines.push(`方法 B（有两台机器）：同一盒带在本机录制，分别在本机和另一台已知回放特性的机器上回放。两次结果的差值 = 两台机器的回放差异。结合自录自放结果即可分离。`);
    lines.push(`方法 C（只有一台机器）：用 SIDE 导出校准信号录到带上（= 录制链路的输出），然后把这盒带拿到任何一台有 LINE OUT 的设备回放、内录回电脑。如果那台设备的回放特性已知或近似平坦（例如高端三磁头卡座经过方位角校准），那么内录结果 ≈ 本机的录制特性。`);
    lines.push(``);
    lines.push(`**如何单独测回放特性：**`);
    lines.push(`用一盒已知特性的标准校准带（不经过本机录制）直接在本机回放并分析。标准带的规格是已知的，测到的偏差就是本机的回放偏差。`);
    lines.push(``);
    lines.push(`### 综合频响特性`);
    lines.push(`整体频响 ${FLAT_TEXT["zh-CN"][a.flatnessLabel]}（RMS 偏差 ${a.flatnessRms} dB），音色取向 ${TILT_TEXT["zh-CN"][a.tiltLabel]}。`);
    if (a.rolloffHz) lines.push(`高频 -3dB 点在 ${hz(a.rolloffHz)} 附近。${a.rolloffHz >= 15000 ? "高频延伸良好——录制端和回放端的高频损失都不大。" : a.rolloffHz >= 12000 ? "高频有一定衰减。可能是磁头磨损、方位角偏差、磁带类型限制、或 BIAS 设定偏高（录制端过度消磁高频）中的一种或多种原因。" : "高频衰减比较明显。建议检查磁头状态和 BIAS 设置。"}`);

    const notable = a.bands.filter((b) => Math.abs(b.avg) > 1.5);
    if (notable.length) {
      lines.push(`频段详情：${notable.map((b) => `${b.label} ${sign(b.avg)} dB`).join("，")}。`);
    }

    if (a.anomalies.length) {
      lines.push(`异常点：${a.anomalies.map((p) => `${hz(p.freqHz)} ${p.type === "peak" ? "凸起" : "凹陷"} ${sign(p.deviationDb)} dB`).join("，")}。`);
    }

    if (bal) {
      lines.push(``);
      lines.push(`### 声道平衡`);
      lines.push(`主体频段（100Hz – 8kHz）左右声道一致性${BALANCE_TEXT["zh-CN"][bal.label]}（RMS 差异 ${bal.rmsDiff} dB，最大差异 ${bal.maxDiff} dB @ ${hz(bal.maxDiffFreq)}）。`);
      if (balHf && balHf.rmsDiff > bal.rmsDiff + 1) {
        lines.push(`高频尾端（8kHz – 16kHz）左右差异更明显（RMS ${balHf.rmsDiff} dB，最大 ${balHf.maxDiff} dB @ ${hz(balHf.maxDiffFreq)}）。这会让图上最右侧分叉比较大，但不一定等于中频结像也同样严重偏移。`);
      }
      if (bal.rmsDiff > 1.5) lines.push(`主体频段左右差异偏大——在自录自放场景下，这可能来自录制磁头或回放磁头的方位角偏差、声道间串扰、或两者兼有。`);
    }

    if (clarity || validationToneL || validationToneR) {
      lines.push(``);
      lines.push(`### 清晰度`);
      lines.push(`这盘带的清晰度判断：${clarity?.label === "clear" ? "偏清晰" : clarity?.label === "soft" ? "偏糊" : "中等"}。`);
      if (clarity?.summary) {
        lines.push(`残余群时延离散 ${clarity.summary.groupDelayResidualRmsMs?.toFixed?.(3) || "0.000"} ms RMS，瞬态展宽 ${clarity.summary.transientSpreadMs?.toFixed?.(3) || "0.000"} ms。`);
        if (clarity.summary.gainCompressionDb != null || clarity.summary.hfCollapseDb != null) {
          lines.push(`压缩 / 饱和迹象：1kHz 增益压缩 ${clarity.summary.gainCompressionDb?.toFixed?.(2) || "0.00"} dB，高电平高频额外塌陷 ${clarity.summary.hfCollapseDb?.toFixed?.(2) || "0.00"} dB。`);
        }
      }
      if (validationToneL || validationToneR || hotToneL || hotToneR) {
        lines.push(`1kHz 失真：验证电平 L ${validationToneL?.thdPercent?.toFixed?.(2) || "0.00"}% / R ${validationToneR?.thdPercent?.toFixed?.(2) || "0.00"}%；最高电平 L ${hotToneL?.thdPercent?.toFixed?.(2) || "0.00"}% / R ${hotToneR?.thdPercent?.toFixed?.(2) || "0.00"}%。`);
      }
      lines.push(`这些指标越差，通常越容易听成“发糊、边缘变软、层次被抹平”；它们能帮助判断清晰度趋势，但仍不等于主观解析度分数。`);
    }

    if (tr) {
      lines.push(``);
      lines.push(`### 走带稳定性`);
      if (transportIsRelative) {
        lines.push(`相对写入机参考的速度偏差 ${tr.speedErrorPercent}%（${SPEED_TEXT["zh-CN"][tr.speedLabel]}${tr.speedFast ? "，相对更快" : "，相对更慢"}），Wow/Flutter ${tr.wfRms}% RMS（${WF_TEXT["zh-CN"][tr.wfLabel]}）。`);
        lines.push(`注意：这里的速度结果是相对写入这盘测试带的那台机器，不是相对理想标准速度的绝对校准值。`);
      } else {
        lines.push(`速度偏差 ${tr.speedErrorPercent}%（${SPEED_TEXT["zh-CN"][tr.speedLabel]}${tr.speedFast ? "，偏快" : "，偏慢"}），Wow/Flutter ${tr.wfRms}% RMS（${WF_TEXT["zh-CN"][tr.wfLabel]}）。`);
      }
      lines.push(`注意：自录自放或测试带对比得到的 W/F 数值都包含参考链路本身的影响，不能直接当成单程机构的绝对 W/F。`);
      if (tr.wfLabel === "excellent" || tr.wfLabel === "good") {
        lines.push(`即便是叠加值也很低，说明走带机构状态不错。`);
      }
    }

    lines.push(``);
    lines.push(`### 璃奈的总结`);
    const verdict = [];
    if (a.flatnessLabel === "very_flat" || a.flatnessLabel === "flat") verdict.push("综合频响表现很好");
    else verdict.push("综合频响有一定个性");
    if (tr && (tr.wfLabel === "excellent" || tr.wfLabel === "good")) verdict.push("走带很稳");
    if (bal && (bal.label === "excellent" || bal.label === "good")) verdict.push("声道平衡也不错");
    lines.push(`${verdict.join("，")}。${a.tiltLabel === "warm" || a.tiltLabel === "slightly_warm" ? "录出来的声音会带一点暖意——可能是磁头特性或磁带饱和带来的自然染色。" : a.tiltLabel === "bright" || a.tiltLabel === "slightly_bright" ? "整体偏亮——高频通路状况不错，但录制人声类内容时可以关注一下齿音。" : "中性取向，录制链路的染色很小。"}`);
    lines.push(`加载校准档案后，SIDE 会在试听和导出时补偿这条链路的综合偏差。如果只想补偿回放端（例如在其它卡座上播放），需要单独测量那台卡座的回放特性。`);

    const transportSummary = tr
      ? (transportIsRelative ? `，相对参考 W/F ${tr.wfRms}%` : `，W/F ${tr.wfRms}%`)
      : "";
    const summary = `${TILT_TEXT["zh-CN"][a.tiltLabel]}（录放综合），${FLAT_TEXT["zh-CN"][a.flatnessLabel]}${a.rolloffHz ? `，HF -3dB @ ${hz(a.rolloffHz)}` : ""}${transportSummary}`;
    const tags = generateTags(a, { transport: tr, balance: bal, clarity });
    return { summary, full: lines.join("\n"), tags };
  }

  // ── English fallback ────────────────────────────────────────
  const lines = [];
  lines.push(`## Deck Calibration Report`);
  lines.push(``);
  lines.push(`### Frequency Response`);
  lines.push(`Overall response is ${FLAT_TEXT.en[a.flatnessLabel]} (RMS deviation ${a.flatnessRms} dB), tonal character is ${TILT_TEXT.en[a.tiltLabel]}.`);
  if (a.rolloffHz) lines.push(`HF -3dB point around ${hz(a.rolloffHz)}.`);

  if (bal) {
    lines.push(``);
    lines.push(`### Channel Balance`);
    lines.push(`Core band (100 Hz – 8 kHz) L/R consistency: ${BALANCE_TEXT.en[bal.label]} (RMS diff ${bal.rmsDiff} dB, max ${bal.maxDiff} dB @ ${hz(bal.maxDiffFreq)}).`);
    if (balHf && balHf.rmsDiff > bal.rmsDiff + 1) {
      lines.push(`HF tail (8 kHz – 16 kHz) diverges more strongly (RMS ${balHf.rmsDiff} dB, max ${balHf.maxDiff} dB @ ${hz(balHf.maxDiffFreq)}), so the far-right end of the graph can split noticeably without implying the same amount of image shift through the core band.`);
    }
  }
  if (clarity || validationToneL || validationToneR) {
    lines.push(``);
    lines.push(`### Clarity`);
    lines.push(`Clarity verdict for this tape: ${clarity?.label === "clear" ? "fairly clear" : clarity?.label === "soft" ? "somewhat soft" : "middle of the road"}.`);
    if (clarity?.summary) {
      lines.push(`Residual group-delay spread ${clarity.summary.groupDelayResidualRmsMs?.toFixed?.(3) || "0.000"} ms RMS, transient spread ${clarity.summary.transientSpreadMs?.toFixed?.(3) || "0.000"} ms.`);
      if (clarity.summary.gainCompressionDb != null || clarity.summary.hfCollapseDb != null) {
        lines.push(`Compression / saturation signs: 1 kHz gain compression ${clarity.summary.gainCompressionDb?.toFixed?.(2) || "0.00"} dB, extra HF collapse at hot level ${clarity.summary.hfCollapseDb?.toFixed?.(2) || "0.00"} dB.`);
      }
    }
    if (validationToneL || validationToneR || hotToneL || hotToneR) {
      lines.push(`1 kHz distortion: validation level L ${validationToneL?.thdPercent?.toFixed?.(2) || "0.00"}% / R ${validationToneR?.thdPercent?.toFixed?.(2) || "0.00"}%; hottest level L ${hotToneL?.thdPercent?.toFixed?.(2) || "0.00"}% / R ${hotToneR?.thdPercent?.toFixed?.(2) || "0.00"}%.`);
    }
    lines.push(`Worse values here usually correlate with blur, softened leading edges, and loss of separation, but they are still proxies rather than a subjective “resolution score.”`);
  }
  if (tr) {
    lines.push(``);
    lines.push(`### Transport`);
    if (transportIsRelative) {
      lines.push(`Relative speed offset vs. the writer-deck reference is ${tr.speedErrorPercent}% (${SPEED_TEXT.en[tr.speedLabel]}), W/F ${tr.wfRms}% RMS (${WF_TEXT.en[tr.wfLabel]}).`);
      lines.push(`This is a writer-relative comparison, not an absolute speed calibration against an ideal standard.`);
    } else {
      lines.push(`Speed error ${tr.speedErrorPercent}% (${SPEED_TEXT.en[tr.speedLabel]}), W/F ${tr.wfRms}% RMS (${WF_TEXT.en[tr.wfLabel]}).`);
    }
    lines.push(`The reported wow/flutter still includes the reference path, so it should not be read as a single-pass absolute W/F value.`);
  }

  lines.push(``);
  lines.push(`### Summary`);
  lines.push(`${TILT_TEXT.en[a.tiltLabel].charAt(0).toUpperCase() + TILT_TEXT.en[a.tiltLabel].slice(1)} character, ${FLAT_TEXT.en[a.flatnessLabel]}. Loading the calibration profile will compensate for these deviations.`);

  const summary = `${TILT_TEXT.en[a.tiltLabel]}, ${FLAT_TEXT.en[a.flatnessLabel]}${a.rolloffHz ? `, HF -3dB @ ${hz(a.rolloffHz)}` : ""}${tr ? (transportIsRelative ? `, relative-ref W/F ${tr.wfRms}%` : `, W/F ${tr.wfRms}%`) : ""}`;
  const tags = generateTags(a, { transport: tr, balance: bal, clarity });
  return { summary, full: lines.join("\n"), tags };
}

// ── Report: Player Profile ───────────────────────────────────

export function generatePlayerProfileReport(profile, label, lang = "zh-CN") {
  if (!profile?.frequencyGridHz?.length || !profile?.responseDb) return null;

  const freqs = profile.frequencyGridHz;
  const aL = analyseChannel(freqs, profile.responseDb.L);
  const aR = analyseChannel(freqs, profile.responseDb.R);
  const bal = analyseStereoBalance(freqs, profile.responseDb.L, profile.responseDb.R);
  const a = aL || aR;
  if (!a) return null;

  if (lang === "zh-CN") {
    const lines = [];
    lines.push(`## 播放器听感报告：${label || profile.name || "未命名"}`);
    lines.push(``);
    lines.push(`### 声音特征`);
    lines.push(`音色取向 ${TILT_TEXT["zh-CN"][a.tiltLabel]}，频响 ${FLAT_TEXT["zh-CN"][a.flatnessLabel]}。`);

    if (a.rolloffHz) lines.push(`高频延伸到 ${hz(a.rolloffHz)} 左右。${a.rolloffHz >= 18000 ? "很优秀。" : a.rolloffHz >= 14000 ? "正常水平。" : "偏窄，会损失一些空气感。"}`);

    const character = [];
    const bass = a.bands.find((b) => b.id === "bass");
    const mid = a.bands.find((b) => b.id === "mid");
    const pres = a.bands.find((b) => b.id === "presence");
    const brill = a.bands.find((b) => b.id === "brilliance");

    if (bass && bass.avg > 1.5) character.push("低频饱满");
    else if (bass && bass.avg < -1.5) character.push("低频偏薄");
    if (pres && pres.avg > 1.5) character.push("人声突出");
    else if (pres && pres.avg < -1.5) character.push("人声偏远");
    if (brill && brill.avg > 1.5) character.push("细节丰富");
    else if (brill && brill.avg < -1.5) character.push("高频柔和");

    if (character.length) {
      lines.push(`听感关键词：${character.join("、")}。`);
    }

    lines.push(``);
    lines.push(`### 璃奈的印象`);
    if (a.tiltLabel === "warm" || a.tiltLabel === "slightly_warm") {
      lines.push(`这台播放器的声音偏暖——低频有一定量感，高频不会太刺。适合听爵士、古典、人声等暖色调的内容。如果用来听电子音乐或者需要很高解析力的录音，可能会觉得少了点锐度。`);
    } else if (a.tiltLabel === "bright" || a.tiltLabel === "slightly_bright") {
      lines.push(`这台播放器的声音偏亮——细节突出，高频有存在感。适合听需要高解析力的录音，比如弦乐、原声乐器。但长时间听一些录音质量一般的内容，耳朵可能会有点累。`);
    } else {
      lines.push(`这台播放器比较中性——不会明显偏暖也不会偏亮，尽量忠实还原录音本身。是一个比较安全的选择。`);
    }

    if (bal) {
      lines.push(``);
      if (bal.label === "poor" || bal.label === "moderate") {
        lines.push(`左右声道一致性${BALANCE_TEXT["zh-CN"][bal.label]}（最大差异 ${bal.maxDiff} dB @ ${hz(bal.maxDiffFreq)}），结像可能会有一点偏移。`);
      }
    }

    const summary = `${TILT_TEXT["zh-CN"][a.tiltLabel]}取向${character.length ? "，" + character.join("、") : ""}${a.rolloffHz ? `，HF → ${hz(a.rolloffHz)}` : ""}`;
    const tags = generateTags(a, { balance: bal });
    return { summary, full: lines.join("\n"), tags };
  }

  // English fallback
  const lines = [];
  lines.push(`## Player Profile Report: ${label || profile.name || "Unnamed"}`);
  lines.push(``);
  lines.push(`Tonal character: ${TILT_TEXT.en[a.tiltLabel]}, response is ${FLAT_TEXT.en[a.flatnessLabel]}.`);
  if (a.rolloffHz) lines.push(`HF extension to about ${hz(a.rolloffHz)}.`);
  const summary = `${TILT_TEXT.en[a.tiltLabel]}, ${FLAT_TEXT.en[a.flatnessLabel]}${a.rolloffHz ? `, HF → ${hz(a.rolloffHz)}` : ""}`;
  const tags = generateTags(a, { balance: bal });
  return { summary, full: lines.join("\n"), tags };
}

// ── Report: EQ Compile ───────────────────────────────────────

export function generateEqCompileReport(compileResult, profileAName, profileBName, lang = "zh-CN") {
  if (!compileResult) return null;
  const eq = analyseEqResult(compileResult);
  if (!eq) {
    const failTags = generateTags(null, { error: true });
    if (lang === "zh-CN") return { summary: "计算未成功", full: `EQ 计算失败：${compileResult.message || compileResult.errorCode || "未知错误"}`, tags: failTags };
    return { summary: "Compile failed", full: `EQ compile failed: ${compileResult.message || compileResult.errorCode || "unknown"}`, tags: failTags };
  }

  if (lang === "zh-CN") {
    const lines = [];
    const targetLabel = compileResult.targetMode === "flat" ? "平直" : (profileBName || "目标");
    lines.push(`## EQ 匹配报告`);
    lines.push(`${profileAName || "设备 A"} → ${targetLabel}`);
    lines.push(``);
    lines.push(`### 匹配质量`);
    lines.push(`拟合分数 ${eq.fitScore}（${FIT_TEXT["zh-CN"][eq.fitLabel]}），使用了 ${eq.activeSteps}/${eq.totalSteps} 个 EQ 频段。`);
    if (eq.usableBandHz) lines.push(`有效频段范围 ${hz(eq.usableBandHz[0])} – ${hz(eq.usableBandHz[1])}。`);
    if (eq.maxBoost > 0 || eq.maxCut < 0) {
      lines.push(`最大提升 ${sign(eq.maxBoost)} 档，最大衰减 ${sign(eq.maxCut)} 档。`);
    }

    lines.push(``);
    lines.push(`### 璃奈的建议`);
    if (eq.fitLabel === "excellent" || eq.fitLabel === "good") {
      lines.push(`匹配效果不错——应用这组 EQ 之后，${profileAName || "设备 A"} 的听感会明显接近${compileResult.targetMode === "flat" ? "平直曲线" : targetLabel}。`);
      if (eq.activeSteps <= 3) lines.push(`只用了几个频段就搞定了，说明两台设备本来就比较接近。`);
    } else if (eq.fitLabel === "moderate") {
      lines.push(`匹配效果一般——可以改善一部分差异，但受限于 EQ 频段数量和精度，还是会有可感知的残差。试试全分辨率补偿档案，效果会更好。`);
    } else {
      lines.push(`拟合不太理想——两台设备的差异可能超出了这套 EQ 的补偿能力。建议使用全分辨率补偿档案（不受频段限制）。`);
    }

    const summary = `${FIT_TEXT["zh-CN"][eq.fitLabel]}（${eq.fitScore}），${eq.activeSteps} 个频段`;
    const tags = generateTags(null, { eqResult: eq });
    return { summary, full: lines.join("\n"), tags };
  }

  // English fallback
  const targetLabel = compileResult.targetMode === "flat" ? "flat" : (profileBName || "target");
  const lines = [];
  lines.push(`## EQ Matching Report`);
  lines.push(`${profileAName || "Device A"} → ${targetLabel}`);
  lines.push(``);
  lines.push(`Fit score ${eq.fitScore} (${FIT_TEXT.en[eq.fitLabel]}), ${eq.activeSteps}/${eq.totalSteps} bands active.`);
  const summary = `${FIT_TEXT.en[eq.fitLabel]} (${eq.fitScore}), ${eq.activeSteps} bands`;
  const tags = generateTags(null, { eqResult: eq });
  return { summary, full: lines.join("\n"), tags };
}

// ── Report: Full-resolution correction ───────────────────────

export function generateFullResCorrectionReport(profileA, profileB, correctionProfile, lang = "zh-CN") {
  if (!correctionProfile?.channels?.L?.correctionDb) return null;

  const freqs = correctionProfile.channels.L.frequenciesHz;
  const corrL = correctionProfile.channels.L.correctionDb;
  const corrR = correctionProfile.channels.R.correctionDb;
  const a = analyseChannel(freqs, corrL);
  if (!a) return null;

  const nameA = profileA?.name || "设备 A";
  const nameB = profileB?.name || (correctionProfile.name?.includes("Flat") ? "平直" : "目标");

  if (lang === "zh-CN") {
    const lines = [];
    lines.push(`## 全分辨率补偿报告`);
    lines.push(`${nameA} → ${nameB}`);
    lines.push(``);
    lines.push(`### 补偿内容`);

    const notable = a.bands.filter((b) => Math.abs(b.avg) > 1);
    if (notable.length) {
      lines.push(`主要调整：${notable.map((b) => `${b.label} ${sign(b.avg)} dB`).join("，")}。`);
    } else {
      lines.push(`整体调整幅度较小，两台设备的频响已经比较接近。`);
    }

    lines.push(``);
    lines.push(`### 实际效果`);
    lines.push(`加载这份档案后，导出的音频会烧入补偿 EQ。当 ${nameA} 播放这个音频时，听众耳朵里接收到的频响 ≈ ${nameB} 的听感。`);
    if (a.tiltLabel === "warm" || a.tiltLabel === "slightly_warm") {
      lines.push(`补偿方向偏暖——说明 ${nameA} 原本偏亮/偏薄，补偿后会变得更饱满。`);
    } else if (a.tiltLabel === "bright" || a.tiltLabel === "slightly_bright") {
      lines.push(`补偿方向偏亮——说明 ${nameA} 原本偏暖/偏闷，补偿后高频会更清晰。`);
    }

    const summary = `${nameA}→${nameB}，${notable.length ? notable.map((b) => `${b.label} ${sign(b.avg)}`).join(" / ") : "整体微调"}`;
    const tags = generateTags(a);
    return { summary, full: lines.join("\n"), tags };
  }

  const lines = [];
  lines.push(`## Full-Resolution Correction Report`);
  lines.push(`${nameA} → ${nameB}`);
  const summary = `${nameA}→${nameB}, correction applied`;
  const tags = generateTags(a);
  return { summary, full: lines.join("\n"), tags };
}
