# S.I.D.E. 工具插件审查报告

> 璃奈酱收到了！认真看过代码了哦 [^_^]

---

## 一、卡座录制校准 (Deck Recording Calibration)

### 1.1 "校准信号带 / 一键校准" 描述块是否还有必要？

**结论：应该删除这个描述块，或把它折叠进操作路径提示里。**

目前界面上同时存在四层文字描述同一件事：

| 层级 | 内容 | 问题 |
|------|------|------|
| 工具说明 | "录一条校准带……" | ✅ 保留，这是工具的总览 |
| "校准信号带 / 一键校准" | "导出一条包含扫频和 3150 Hz……" | ❌ 和 workflowDesc 重复 |
| workflowDesc | "校准本卡座：导出校准信号→……" | ❌ 和操作路径重复 |
| 操作路径 | "准备一盘空白带……" | ✅ 这是实际 step-by-step |

用户进入工具后，**连续读四段说几乎同样的事情**的文字才能看到操作按钮。需要合并。

建议结构：
```
工具说明 (desc) — 一句话：这个工具做什么
↓
场景选择 (self / test) — 点选后展开
↓
对应场景的操作步骤 (helpSelf / helpTest) — 精简版
↓
操作按钮
```

`focusTitle`/`focusDesc`/`workflowTitle`/`workflowDesc` 这四个 key 可以直接删除。

### 1.2 术语和流程改动

**核心问题：混合了实现术语和用户动作。**

| 当前术语 | 问题 | 建议 |
|---------|------|------|
| "校准信号带" (programTitle) | 用户不理解"信号带"指什么 | → "步骤 1：录制校准带" |
| "一键校准" (focusTitle) | 实际上是三步（导出→录制→回采），不是一键 | → 删除这个概念 |
| "回录文件" / "回采结果" | 两个词指同一件事 | 统一为 "回放录音" |
| "基线" (manifest) | 听起来像统计术语 | → "参考基准" 或 "校准基准" |
| "生成结果" | 太模糊 | → "开始分析" |
| "保存校准 Profile" | 中英混搭 | → "保存校准档案" |
| "导入回录文件" / "开始网页录音" | 按钮并列但含义层级不同 | 应该分组 |

**操作路径也需要改写。** 当前是大段文字，应该改成编号步骤。

### 1.3 建议的 i18n 重写（璃奈语气，zh-CN）

```
descTitle: "工具说明"
desc: "给卡座做一次体检！录一条校准带，就能知道它的频率响应和走带稳定性。检测结果可以生成补偿档案，也可以把这盒带拿去测别的机器。"

scenarioSelf: "校准这台卡座"
scenarioSelfDesc: "导出校准信号 → 录到空白带 → 用同一台卡座回放 → 分析结果"

scenarioTest: "用校准带测其它机器"
scenarioTestDesc: "加载之前保存的基准数据，导入其它机器的回放录音"

helpTitle: "怎么操作呢"
helpSelf: "① 准备一盘空白带\n② 点「导出校准信号」，录到空白带上\n③ 用同一台卡座回放这盒带\n④ 点「导入回放录音」（或用浏览器录音）\n⑤ 点「开始分析」\n⑥ 拿到结果后，可以保存校准档案或者基准数据"
helpTest: "① 切换到「用校准带测其它机器」\n② 加载之前保存的基准数据\n③ 在另一台机器上回放这盒校准带\n④ 导入回放录音\n⑤ 点「开始分析」"

exportProgram: "导出校准信号"
importCapture: "导入回放录音"
startRecord: "浏览器录音"
stopRecord: "停止录音"
analyseNow: "开始分析"
saveProfile: "保存校准档案"
saveManifest: "保存基准数据"
loadManifest: "加载基准数据"
clearManifest: "清除基准数据"

manifestMissing: "还没有基准数据"
manifestReady: "基准数据已就绪"
captureMissing: "还没有回放录音"
captureReady: "回放录音已就绪"
recordingBusy: "录音中……"
```

---

## 二、播放器频响 & EQ 匹配 (Player Profile Workbench)

### 2.1 整体结构问题

这个工具界面上有 **四个独立功能区**，每个都有自己的操作流程，全部堆在一个长页面里。用户初次进入时，根本不知道从哪里开始。

```
当前结构（一字排开）：
┌─ Probe Profile ─┐
├─ Song Profile ──┤
├─ A 的 EQ Model ─┤  ← 用户：这是什么？A 是谁？
└─ A 模拟 B 编译器 ┘
```

**核心 UX 问题：**

1. **场景不明确**——用户有五种使用场景（你列出的 1-5），但界面是按"内部模块"组织的，不是按使用场景。
2. **术语鸿沟**——Probe Profile / Song Profile / EQ Model / 编译器，这些是工程师的心理模型，不是用户的。
3. **"A" 和 "B" 没有上下文**——用户第一次看到 "A 的 EQ Model" 时，不知道 A 指什么。需要在开头定义 "A = 你要调的播放器" "B = 你想模仿的目标"。

### 2.2 建议的场景化重构

把四个模块收起来，改成以用户目标为入口的导引流程：

```
╔══════════════════════════════════════════╗
║  播放器听感测量 & EQ 匹配               ║
║  测量播放器的频率响应，调整 EQ 让它      ║
║  听起来更好，或模仿另一台设备的声音。    ║
╚══════════════════════════════════════════╝

你想做什么？
┌──────────────────────┐  ┌──────────────────────┐
│ 📐 测量一台设备       │  │ 🔄 让 A 模仿 B       │
│ 用测试信号或曲目对比  │  │ 已有两台设备的数据    │
│ 来获取频响数据        │  │ 自动算出 EQ 参数      │
└──────────────────────┘  └──────────────────────┘
┌──────────────────────┐
│ 📊 调平一台设备       │
│ 已有一台设备的数据    │
│ 生成 EQ 让它趋向平直  │
└──────────────────────┘
```

选择之后再展开对应的操作步骤面板。

### 2.3 标题和说明

当前：
```
播放器频响 & EQ 匹配
测量播放器的频率响应，让 A 的声音尽可能接近 B。
```

问题：
- 标题用了 "&" 连接两个不同的事（测量 + 匹配），容易困惑
- 只提到了 A→B，没提到"调平"这个场景

建议改成：
```
工具说明：
测量播放器的频率响应，然后——让它趋向平直，或者模仿另一台设备的声音。
```

### 2.4 "Probe" / "Song" 这两个术语

| 当前 | 问题 | 建议（zh-CN） |
|------|------|-------------|
| Probe Profile | "Probe"对中文用户不直观 | → "测试信号法" |
| Song Profile | 听起来像音乐推荐 | → "曲目对比法" |
| "画像名称" | 日语直译（プロファイル→画像？） | → "测量结果名称" |
| "导出标准探针" | 探针？ | → "导出测试信号" |
| "导入探针回录" | | → "导入测试信号的回放录音" |

### 2.5 配对规则说明

当前的 `xxx.1.ext / xxx.2.ext` 规则说明过于技术化。建议：

```
文件命名规则：
每首歌需要两个文件，文件名相同但后缀不同：
  · 原曲文件名加 .1，例如 yesterday.1.wav
  · 内录文件名加 .2，例如 yesterday.2.wav
一起选中所有文件，拖进来就行。系统会自动配对。
```

### 2.6 建议的 i18n 重写（璃奈语气，zh-CN）

```
title: "播放器听感测量 & EQ 匹配"
desc: "测量播放器的频率响应，然后——让它趋向平直，或者模仿另一台设备的声音。"

probeTitle: "测试信号法"
probeDesc: "用标准测试信号来精确测量。精度最高，但需要专门录一次。"
exportProbe: "导出测试信号"
importProbeCapture: "导入回放录音"
generateProbeProfile: "生成测量结果"
saveProbeProfile: "保存测量结果"
probeCapture: "回放录音"
probeProfileName: "测量结果名称"

songTitle: "曲目对比法"
songDesc: "用现有曲目的原曲和内录来对比测量。不需要额外录测试信号，有一首歌就够了。"
importSongFiles: "导入曲目文件"
generateSongProfile: "生成测量结果"
saveSongProfile: "保存测量结果"
songProfileName: "测量结果名称"
refCount: "原曲"
recCount: "内录"
pairCount: "已配对"
pairError: "配对状态"

pairingRule: "文件命名规则"
pairingRuleText: "每首歌准备两个文件：原曲文件名加 .1（如 song.1.wav），内录文件名加 .2（如 song.2.wav）。全部选中导入，系统自动配对。"
exactNameHint: "有文件没配上对、或者文件名格式不对的话，就没法生成了哦。"

eqTitle: "设备 EQ 建模"
eqDesc: "告诉系统你的设备能调哪些频段、每档多少 dB，它就能帮你算出最优 EQ。"
useProbeAsBase: "用测试信号法的结果"
useSongAsBase: "用曲目对比法的结果"
importBaseProfile: "导入已有测量结果"
buildEqProfile: "生成 EQ 模型"
saveEqProfile: "保存 EQ 模型"
eqBaseProfile: "基础频响"
eqAdjustableProfile: "EQ 模型"
eqBandPreset: "频段预设"
eqAutoQHint: "频段宽度已内置，不需要填 Q 值。"

compilerTitle: "EQ 匹配"
compilerDesc: "有了两台设备的频响数据，系统能自动算出——调哪些频段、调多少格，就能让 A 听起来像 B。"
targetMode: "目标"
targetProfile: "模仿另一台设备"
targetFlat: "趋向平直"
compileNow: "计算 EQ"
compileNowFlat: "计算趋平 EQ"
loadCompileProfile: "加载到试听"
exportLoadProfile: "导出补偿档案"
```

---

## 三、性能问题：Song Profile 处理大量文件时 UI 冻结

### 3.1 根本原因

`buildProgramProfile()` 在**主线程上同步执行**所有计算。对于每一对曲目：

```
extractProgramStereo()     — 可能触发 resampleLinear（如果 SR ≠ 48kHz）
alignProgramPair()         — RMS 包络 + 归一化互相关（searchRadius ≤ 200 帧）
trimAlignedStereo()        — Float32Array.slice()
analyseProgramTransfer()   — Goertzel 分析，这是大头
```

Goertzel 分析的复杂度：

```
频率网格: 20Hz–20kHz, 24 pts/octave ≈ 240 个频率点
帧大小: 4096 samples, hop: 1024
一首 3 分钟 48kHz 的歌: (48000 × 180) / 1024 ≈ 8,437 帧
每帧: 240 频率 × 4096 次乘加 (Goertzel)
每声道: ~240 × 8437 ≈ 200 万次 Goertzel 调用
每曲目对: ×2 声道 ×2(ref+rec) = ×4

16 组曲目 = 16 × 4 × 2M ≈ 1.28 亿次 Goertzel 运算
```

全部在一个 `for (const pair of normalizedPairs)` 循环里同步完成，没有任何 yield 点。**浏览器主线程完全阻塞**。

### 3.2 修复方案

**方案 A：逐曲目 yield + 进度回调（最小改动）**

把 `buildProgramProfile` 改为 async，每处理完一个曲目对就 `await` 一个 microtask 让出主线程：

```js
// program-profile-builder.js
export async function buildProgramProfile(trackPairs, options = {}, onProgress) {
  const normalizedPairs = normalizeTrackPairs(trackPairs);
  const validAnalyses = [];
  
  for (let i = 0; i < normalizedPairs.length; i++) {
    const pair = normalizedPairs[i];
    
    // 通知进度
    onProgress?.({
      phase: "analyzing",
      current: i + 1,
      total: normalizedPairs.length,
      title: pair.title,
    });
    
    // yield 主线程 —— 让浏览器有机会重绘 + 处理输入事件
    await new Promise(r => setTimeout(r, 0));
    
    const referenceStereo = extractProgramStereo(pair.referenceBuffer);
    const recordedStereo = extractProgramStereo(pair.recordedBuffer);
    const alignment = alignProgramPair(referenceStereo, recordedStereo);
    const trimmed = trimAlignedStereo(referenceStereo, recordedStereo, alignment.sampleOffset);
    const analysis = analyseProgramTransfer(
      { ...trimmed.reference, sampleRate: referenceStereo.sampleRate },
      { ...trimmed.recorded, sampleRate: recordedStereo.sampleRate },
    );
    validAnalyses.push({ ...analysis, title: pair.title, alignmentScore: alignment.alignmentScore });
  }
  
  onProgress?.({ phase: "aggregating" });
  await new Promise(r => setTimeout(r, 0));
  
  const aggregated = aggregateProgramTracks(validAnalyses);
  // ... 构建 profile 并返回
}
```

**方案 B：Web Worker（理想方案，改动大）**

把 `analyseProgramTransfer` 移入 Worker。`program-transfer.js` 不依赖 DOM，可以直接在 Worker 里运行。主线程通过 `postMessage` 传递 Float32Array（用 Transferable 避免拷贝），Worker 回传分析结果。

```
主线程                          Worker
  |-- postMessage(pair) -------->|
  |                              |-- extractStereo
  |                              |-- align
  |                              |-- analyse
  |<-- postMessage(result) ------|
  |-- 更新进度条
  |-- postMessage(next pair) --->|
  ...
```

**建议：先做方案 A**（半小时能搞定），体验立刻改善。后续再考虑方案 B 做真正的并行。

### 3.3 UI 侧：进度显示

在 `usePlayerProfile.js` 的 `buildPlayerSongProfile` 中接入进度：

```js
const buildPlayerSongProfile = useCallback(async (name) => {
  if (!songPairing.pairs.length || songPairing.error) {
    showToast(songPairing.error || "No valid song pairs", 5000);
    return;
  }
  setProcessing(true);
  try {
    const profile = await buildProgramProfile(
      songPairing.pairs, 
      { name: name || "Song Profile" },
      (progress) => {
        if (progress.phase === "analyzing") {
          setProcMsg(`分析中 [${progress.current}/${progress.total}] ${progress.title}`);
        } else if (progress.phase === "aggregating") {
          setProcMsg("正在汇总结果……");
        }
      }
    );
    setPlayerSongProfile(profile);
    showToast("Song profile generated");
  } catch (err) {
    showToast(`Song profile failed: ${err.message}`, 5000);
  } finally {
    setProcessing(false);
    setProcMsg("");
  }
}, [showToast, songPairing, setProcessing, setProcMsg]);
```

---

## 四、Song Profile 配对计算失败但无提示

### 4.1 当前代码的问题

`buildPlayerSongProfile` 里有 try/catch，但 toast 只显示 `err.message`。而 `buildProgramProfile` 内部的错误（比如 `alignProgramPair` 抛 `PROGRAM_ALIGN_FAILED`）被捕获后只变成一行 toast，**没有告诉用户哪一对失败了、为什么失败**。

更严重的是：如果 `songPairing` 计算结果的 `pairs` 为空但 `error` 也为空（理论上不该发生但 edge case 可能），`buildPlayerSongProfile` 会在第一行就 return 掉，**既不 toast 也不报错**。

### 4.2 修复建议

**A. 在配对阶段就给出详细反馈：**

`importSongFiles` 完成后，如果 `songPairing.error` 非空，应该立刻显示错误详情，不要等用户点"生成"才发现。

```js
// 在 importSongFiles 的 finally 之前：
if (songPairing.error) {
  showToast(`配对失败：${songPairing.error}`, 8000);
}
```

但这里有个时序问题：`songPairing` 是 `useMemo`，依赖 `songReferenceTracks` 和 `songRecordedTracks`。在 `importSongFiles` 的 `setSongReferenceTracks(references)` 执行后、React 重新渲染前，`songPairing` 还是旧值。

解决办法：在 `useEffect` 里监听 `songPairing` 变化时检查：

```js
useEffect(() => {
  setSongPairingDetails(songPairing.details || null);
  if (songPairing.error && (songReferenceTracks.length || songRecordedTracks.length)) {
    showToast(`配对问题：${songPairing.error}`, 8000);
  }
}, [songPairing, songReferenceTracks.length, songRecordedTracks.length, showToast]);
```

**B. 在分析阶段的逐曲目报告：**

`buildProgramProfile` 的 for 循环中，如果某一对 `alignProgramPair` 失败，当前会直接 throw 导致整个流程中断。应该改为 try/catch 单对错误，跳过失败对，最后汇报哪些成功、哪些失败：

```js
for (let i = 0; i < normalizedPairs.length; i++) {
  const pair = normalizedPairs[i];
  try {
    // ... 分析流程
    validAnalyses.push({ ... });
  } catch (err) {
    failedPairs.push({ title: pair.title, error: err.message || err.code });
    onProgress?.({ phase: "skip", title: pair.title, error: err.message });
  }
}

if (!validAnalyses.length) {
  throw new Error(`所有 ${normalizedPairs.length} 对曲目分析均失败`);
}
```

然后在 UI 层显示：

```
分析完成：12/16 对成功，4 对失败
失败曲目：yesterday (对齐失败), imagine (对齐失败), ...
```

**C. 配对验证的 debug 输出：**

在 `songPairPreview` 区域，当有 `songPairError` 时，当前虽然有 `pairDetails` 面板，但信息太简略。建议增加每个文件的解析结果预览：

```
文件名               → 解析结果
yesterday.1.wav      → ✅ 原曲 "yesterday"
yesterday.2.wav      → ✅ 内录 "yesterday"  → 配对成功
imagine.wav          → ❌ 文件名不符合 .1/.2 规则
```

---

## 五、完整 i18n 改写示意：璃奈的语气

璃奈的语言风格：正式但温柔，偶尔可爱，技术内容该精确就精确，但措辞选择避免冷硬的工程术语，用"明亮的说明书语气"。自称用 "璃奈" 只在 About 出现。UI 文字不需要 kawaii 过头，但可以在 tooltip / 帮助文字 / toast 里加一点点温度。

关键原则：
- **按钮文字**：简洁动词，不用术语（"导出测试信号" 而非 "导出标准探针"）
- **说明文字**：一句话说清楚这一步做什么、为什么要做
- **状态文字**：用户视角描述（"还没有回放录音" 而非 "回采结果未载入"）
- **错误文字**：不责怪用户，说明怎么修（"文件名格式不对，需要 .1 和 .2 后缀哦" 而非 "Invalid filenames"）
- **toast**：带一点温度但不过分（"测量结果已保存" 而非 "Profile saved" / "保存成功!!!"）

### zh-CN 字符串表对照（选摘）

| key | 当前 | 建议 |
|-----|------|------|
| toolSignalOutput | 校准信号输出 | 校准信号输出 (不变) |
| toolSignalOutputDesc | "输出参考信号，用于调节……" | "输出参考信号，帮你调好卡座的录音电平和 BIAS。选好信号类型、点「开始输出」，然后看着卡座的电平表调节就行。" |
| toolRecordFailed | 网页录音失败 | 浏览器录音没有成功……要不再试一次？ |
| noCalibrationProfile | 未加载 | 暂无 |
| calibrationProfileLoaded | 校准 Profile 已加载 | 校准档案已加载 |
| playlistImportNoAudio | 歌单已加载（含占位曲目）…… | 歌单加载好了。有些曲目还没有音频文件——把对应的音频文件拖进来，系统会自动按文件名匹配上。 |

---

## 六、实施优先级

| 优先级 | 内容 | 工作量 |
|--------|------|--------|
| 🔴 P0 | Song Profile 性能修复（方案 A：async + yield） | 1-2h |
| 🔴 P0 | Song Profile 配对/分析错误的详细反馈 | 1-2h |
| 🟡 P1 | 两个工具的 i18n 重写（zh-CN 先行） | 3-4h |
| 🟡 P1 | 删除重复描述块（卡座校准的 focus/workflow） | 0.5h |
| 🟢 P2 | 播放器工具的场景化导引重构 | 4-6h |
| 🟢 P2 | ja / en locale 跟进 | 2-3h |
| ⚪ P3 | Web Worker 并行分析（方案 B） | 4-6h |

---

璃奈审查完毕。如果要开始改代码的话，从 P0 开始——先让分析不卡死、错误能看到，然后再美化文案。

[^_^]
