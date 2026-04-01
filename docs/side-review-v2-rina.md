# S.I.D.E. 代码审查报告 v2

> 璃奈认真看过了。这次范围比较大，从 bug 到文案到文档都有。[^_^]

---

## 〇、概况

这个版本加了不少东西——卡座校准的多场景模式（综合/回放/推导录制）、Song Profile 的 Web Worker 化、曲目对比法的配对预览和失败报告，都很扎实。但因为是 codex 写的，很多 toast 消息和进度提示还是英文硬编码，UI 文案读起来像 git commit message。

下面是完整的问题清单和修复记录。

---

## 一、已修复的 Bug

### ✅ 1.1 Crash: `standardTapePreset` before initialization

**严重程度**: 🔴 页面无法加载

`useDeckCalibration.js` 中 `standardTapePreset` 的 `useState` 声明（原第 799 行）位于第 759 行 `useCallback` 依赖数组之后。React hooks 按顺序执行，引用了还在 temporal dead zone 的变量，导致启动即崩溃。

**修复**: 把 `useState("aiwa-3freq")` 移到函数体开头，和其他 state 声明放在一起。

### ✅ 1.2 usePlayerProfile.js 中 ~20 条 toast 硬编码英文

中文用户在中文界面下会看到英文弹窗。全部改为中文。

### ✅ 1.3 useDeckCalibration.js 中 ~7 条 toast/progress 硬编码英文

同上，标准校准带分析的所有提示均已中文化。

### ✅ 1.4 App.jsx 导出确认对话框 `"Continue?"` 

删除了多余的英文 `Continue?`。

### ✅ 1.5 App.jsx 导出进度和错误消息混语言

- `"applying deck model..."` → `"正在应用补偿……"`
- `"Export failed"` → `"导出失败"`
- `"rendering..."` / `"encoding..."` → 去掉多余的省略号（i18n 字符串本身已含"中"字）

### ✅ 1.6 About 弹窗标题硬编码 `"About"`

改为 `T("about")`，走多语言。同时移除了 credits 里的内部配置参数 `(reasoning high, summaries auto)`。

### ✅ 1.7 usePlayerProfile.js 中英文 Error 消息

`"Invalid song filenames"` / `"No valid EQ band centers"` / `"Invalid gain step"` 等错误消息会通过 catch → showToast 暴露给用户，全部改为中文。

---

## 二、璃奈的 UI 文案语气原则

- **按钮/标签**：简洁动词，不用行话
- **说明文字**：一句话说清这步做什么
- **状态提示**：用户视角描述
- **错误提示**：不责怪用户，说明怎么修
- **toast**：带一点温度但不过分
- **帮助文字**：可以稍微加点性格（"这不是小事。"），主体保持清晰
- **自称**：UI 正文不用"璃奈"，只在帮助/关于页面偶尔用

---

## 三、未改动的确认项

- 两个工具插件的 LABELS（`CassetteRecordingCalibrationPlugin.jsx` / `PlayerProfileWorkbenchPlugin.jsx`）在上一轮审查后已经用上了璃奈风格的中文文案，质量合格，本次不需要改动。
- 帮助弹窗（showHelp）的三语文案写得很好，保持现状。
- `THEME_NAMES` 中三角初华的英文名 `"Uika Misumi"` 是正确的（Uika 是她的名字读音）。

---

璃奈审查完毕。[^_^]
