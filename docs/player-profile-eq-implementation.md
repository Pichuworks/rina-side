# 播放器 Profile 与 A->B EQ 编译 实施文档

## 1. 文档目标

本文档定义一套唯一、可直接落代码的实现规范，用于完成以下闭环：

1. 生成 `probe profile`
2. 生成 `program profile`
3. 生成或挂载设备 `eqModel`
4. 导入 `A_profile` 和 `B_profile`
5. 直接输出 `A 模拟 B` 所需的可执行 EQ

本文档是后续代码生成的唯一事实来源。实现时不允许再发明第二套 profile 格式、第二套 song mode 逻辑、第二套 compiler 输入输出。

## 2. 产品合同

### 2.1 用户侧合同

最终用户有两类工作流。

工作流 A：生成 profile

1. 通过标准探针生成 `probe profile`
2. 或通过歌曲原曲与对应内录生成 `program profile`
3. 对可被调节的设备 A，额外生成 `eqModel`

工作流 B：直接求解 A 模拟 B 的 EQ

1. 导入 `A_profile`
2. 导入 `B_profile`
3. 系统自动输出 `EQ(A -> B)`，无其它手动步骤

### 2.2 系统侧合同

输入：

- `A_profile`
- `B_profile`

输出：

- 一组可直接施加于 A 的 EQ 参数
- 预测修正后频响曲线
- 拟合残差
- 可信度与失败原因

硬约束：

- 如果 `A_profile` 不包含合法 `eqModel`，直接失败
- 如果 `A_profile` 与 `B_profile` 不可比较，直接失败
- 如果 `program profile` 置信度或覆盖不足，直接失败
- 不允许输出伪确定性结果

## 3. 范围与边界

### 3.1 本期必须实现

- `probe profile` 生成
- `program profile` 生成
- `eqModel` 生成或挂载
- profile 规范化与校验
- `A -> B` delta 曲线求解
- delta 曲线到 A 的 EQ 执行模型拟合
- linked-stereo 输出

### 3.2 本期明确不实现

- 动态 EQ 建模
- 非线性失真补偿
- 串扰校正执行器
- 空间声场重建
- 头相关或双耳感知模型
- 自动从麦克风房间测量推导房间校正 house curve
- 多设备链路联合拟合

### 3.3 本期允许保留为元数据或诊断，不进入主求解

- `H_LR` / `H_RL`
- THD / IMD
- 噪声底
- wow/flutter
- 运输机构速度偏差

## 4. 统一术语

- `probe profile`：由标准探针已知输入与内录输出生成的高置信度线性频谱画像
- `program profile`：由原曲与对应播放器内录的成对曲目集合生成的节目画像
- `eqModel`：描述 A 设备可执行 EQ 空间的模型
- `eqBasis`：某设备每个 band 每一步对频响造成的真实影响曲线
- `canonical profile`：全系统唯一允许进入 compiler 的 profile 结构
- `compiler`：`A_profile + B_profile -> EQ(A -> B)` 的求解器
- `anchor`：用于把响应曲线归一到共同参考电平的定义
- `usableMask`：某个频点是否允许进入求解
- `confidence`：某个频点结果是否可信

## 5. 全局不变量

以下规则在所有模块中必须保持成立：

1. 全系统只允许一个 canonical profile 结构
2. probe 与 program 最终必须输出完全同构 JSON
3. 全系统只允许一个标准频率网格定义
4. 全系统只允许一个默认 anchor 定义
5. song mode 的正式输入模型是 `trackPairs[]`
6. `trackPairs.length >= 1`
7. 单首歌是 song mode 的合法特例，不允许单独创建另一套单曲工作流
8. compiler 只接受已通过 validator 的 canonical profile
9. 没有 `eqModel` 的 profile 不能作为 A 进入 compiler
10. 失败时必须中止，不能给“尽量算一个”的补丁结果

## 6. 推荐文件结构

以下是建议新增文件结构。实现时应尽量按此组织，避免所有逻辑继续堆进 `src/App.jsx`。

```text
src/
  modules/
    player-profile/
      constants.js
      frequency-grid.js
      anchor.js
      schema.js
      validator.js
      normalizer.js
      response-curve.js
      confidence.js
      usable-mask.js
      stereo-policy.js
      io.js
    probe-profile/
      probe-spec.js
      probe-generator.js
      probe-sync.js
      probe-segmentation.js
      probe-transfer.js
      probe-profile-builder.js
    program-profile/
      track-pairing.js
      program-alignment.js
      program-transfer.js
      program-aggregation.js
      program-profile-builder.js
    eq-model/
      eq-model-schema.js
      eq-model-builder.js
      eq-basis-measurement.js
      eq-basis-normalizer.js
    eq-compiler/
      delta-builder.js
      solve-graphic-fixed.js
      solve-graphic-basis.js
      solve-parametric.js
      compile-a-to-b.js
      fit-score.js
    ui/
      ProfileWorkbench.jsx
      ProbeProfilePanel.jsx
      ProgramProfilePanel.jsx
      EqModelPanel.jsx
      ProfileCompilerPanel.jsx
      ProfileChart.jsx
      EqResultTable.jsx
```

## 7. 频率网格与 anchor

### 7.1 标准频率网格

全系统统一使用同一个对数频率网格。首版建议：

- `minHz = 20`
- `maxHz = 20000`
- `pointsPerOctave = 24`

频率网格生成规则：

```js
function buildFrequencyGridHz(minHz = 20, maxHz = 20000, pointsPerOctave = 24) {
  const out = [];
  let f = minHz;
  const ratio = Math.pow(2, 1 / pointsPerOctave);
  while (f <= maxHz * 1.000001) {
    out.push(Number(f.toFixed(6)));
    f *= ratio;
  }
  return out;
}
```

约束：

- 所有 profile 最终都要插值到此网格
- `eqBasis` 也必须投影到此网格

### 7.2 默认 anchor

首版固定：

- `anchor.type = "midband-average"`
- `anchor.rangeHz = [500, 2000]`

含义：

- 在 `500..2000 Hz` 区间取平均值
- 将该平均值减去，使该区间零均值

目的：

- 消除整体音量差
- 让不同来源的 profile 可以直接相减

## 8. Canonical Profile JSON Schema

以下 schema 是实现级要求。实现时可直接作为运行时 validator 的基础。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "side.player-listening-profile.schema.json",
  "title": "Canonical Player Listening Profile",
  "type": "object",
  "required": [
    "type",
    "version",
    "name",
    "createdAt",
    "sourceType",
    "generator",
    "frequencyGridHz",
    "responseDb",
    "confidence",
    "usableMask",
    "anchor",
    "sourceMeta"
  ],
  "properties": {
    "type": {
      "const": "side.player-listening-profile"
    },
    "version": {
      "type": "integer",
      "const": 1
    },
    "name": {
      "type": "string",
      "minLength": 1
    },
    "createdAt": {
      "type": "string",
      "format": "date-time"
    },
    "sourceType": {
      "type": "string",
      "enum": ["probe", "program"]
    },
    "generator": {
      "type": "string",
      "minLength": 1
    },
    "frequencyGridHz": {
      "type": "array",
      "minItems": 32,
      "items": {
        "type": "number",
        "exclusiveMinimum": 0
      }
    },
    "responseDb": {
      "type": "object",
      "required": ["L", "R"],
      "properties": {
        "L": { "$ref": "#/$defs/numberArray" },
        "R": { "$ref": "#/$defs/numberArray" }
      }
    },
    "confidence": {
      "type": "object",
      "required": ["L", "R"],
      "properties": {
        "L": { "$ref": "#/$defs/confidenceArray" },
        "R": { "$ref": "#/$defs/confidenceArray" }
      }
    },
    "usableMask": {
      "type": "object",
      "required": ["L", "R"],
      "properties": {
        "L": { "$ref": "#/$defs/boolArray" },
        "R": { "$ref": "#/$defs/boolArray" }
      }
    },
    "anchor": {
      "type": "object",
      "required": ["type", "rangeHz"],
      "properties": {
        "type": {
          "const": "midband-average"
        },
        "rangeHz": {
          "type": "array",
          "prefixItems": [
            { "type": "number", "exclusiveMinimum": 0 },
            { "type": "number", "exclusiveMinimum": 0 }
          ],
          "minItems": 2,
          "maxItems": 2
        }
      }
    },
    "sourceMeta": {
      "type": "object"
    },
    "eqModel": {
      "type": ["object", "null"]
    },
    "validation": {
      "type": "object"
    }
  },
  "$defs": {
    "numberArray": {
      "type": "array",
      "items": { "type": "number" }
    },
    "confidenceArray": {
      "type": "array",
      "items": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      }
    },
    "boolArray": {
      "type": "array",
      "items": { "type": "boolean" }
    }
  }
}
```

### 8.1 运行时额外校验

除了 JSON Schema，还必须做这些运行时约束：

1. `frequencyGridHz` 严格递增
2. `responseDb/confidence/usableMask` 的每个数组长度必须与 `frequencyGridHz.length` 相同
3. `anchor.rangeHz[0] < anchor.rangeHz[1]`
4. `sourceType = probe` 时，`sourceMeta.kind === "probe-v1"`
5. `sourceType = program` 时，`sourceMeta.kind === "program-v1"`
6. 若 `eqModel != null`，则必须通过 `EqModel` 校验

## 9. EqModel JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "side.eq-model.schema.json",
  "title": "EQ Execution Model",
  "type": "object",
  "required": ["kind", "bands", "preferredSolveMode"],
  "properties": {
    "kind": {
      "type": "string",
      "enum": [
        "graphic-fixed-band",
        "graphic-measured-basis",
        "parametric",
        "fir-convolution"
      ]
    },
    "bands": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": [
          "id",
          "centerHz",
          "filterType",
          "gainStepDb",
          "minStep",
          "maxStep",
          "integerOnly"
        ],
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "centerHz": { "type": "number", "exclusiveMinimum": 0 },
          "filterType": {
            "type": "string",
            "enum": ["peak", "low-shelf", "high-shelf"]
          },
          "q": {
            "type": ["number", "null"],
            "exclusiveMinimum": 0
          },
          "gainStepDb": {
            "type": "number",
            "exclusiveMinimum": 0
          },
          "minStep": { "type": "integer" },
          "maxStep": { "type": "integer" },
          "integerOnly": { "type": "boolean" }
        }
      }
    },
    "basis": {
      "type": ["array", "null"],
      "items": {
        "type": "object",
        "required": ["bandId", "frequencyGridHz", "effectDbPerStep"],
        "properties": {
          "bandId": { "type": "string" },
          "frequencyGridHz": {
            "type": "array",
            "items": { "type": "number", "exclusiveMinimum": 0 }
          },
          "effectDbPerStep": {
            "type": "array",
            "items": { "type": "number" }
          }
        }
      }
    },
    "preferredSolveMode": {
      "type": "string",
      "enum": ["integer", "continuous"]
    }
  }
}
```

### 9.1 EqModel 运行时约束

1. `bands` 中 `id` 唯一
2. 若 `kind = graphic-measured-basis`，`basis` 必须存在且与 `bands` 一一对应
3. 若 `kind = graphic-fixed-band`，`basis` 可以为空
4. 若 `kind = fir-convolution`，`bands` 允许包含单个伪 band，占位表示支持直接 FIR
5. `minStep <= 0 <= maxStep`
6. 若 `integerOnly = true`，solver 输出必须是整数

## 10. 模块接口定义

以下接口使用 JS + JSDoc 风格描述。实现不要求迁移到 TypeScript，但函数签名必须遵守。

### 10.1 基础类型

```js
/**
 * @typedef {Object} CanonicalProfile
 * @property {"side.player-listening-profile"} type
 * @property {1} version
 * @property {string} name
 * @property {string} createdAt
 * @property {"probe"|"program"} sourceType
 * @property {string} generator
 * @property {number[]} frequencyGridHz
 * @property {{L:number[], R:number[]}} responseDb
 * @property {{L:number[], R:number[]}} confidence
 * @property {{L:boolean[], R:boolean[]}} usableMask
 * @property {{type:"midband-average", rangeHz:[number, number]}} anchor
 * @property {Object} sourceMeta
 * @property {EqModel|null} eqModel
 * @property {Object} validation
 */

/**
 * @typedef {Object} EqBand
 * @property {string} id
 * @property {number} centerHz
 * @property {"peak"|"low-shelf"|"high-shelf"} filterType
 * @property {number|null} q
 * @property {number} gainStepDb
 * @property {number} minStep
 * @property {number} maxStep
 * @property {boolean} integerOnly
 */

/**
 * @typedef {Object} EqBasis
 * @property {string} bandId
 * @property {number[]} frequencyGridHz
 * @property {number[]} effectDbPerStep
 */

/**
 * @typedef {Object} EqModel
 * @property {"graphic-fixed-band"|"graphic-measured-basis"|"parametric"|"fir-convolution"} kind
 * @property {EqBand[]} bands
 * @property {EqBasis[]|null} basis
 * @property {"integer"|"continuous"} preferredSolveMode
 */
```

### 10.2 Validator

```js
/**
 * @param {unknown} raw
 * @returns {CanonicalProfile}
 * @throws {Error}
 */
export function validateCanonicalProfile(raw) {}

/**
 * @param {unknown} raw
 * @returns {EqModel}
 * @throws {Error}
 */
export function validateEqModel(raw) {}
```

### 10.3 Normalizer

```js
/**
 * @param {CanonicalProfile} profile
 * @param {number[]} targetGridHz
 * @returns {CanonicalProfile}
 */
export function normalizeProfileToGrid(profile, targetGridHz) {}

/**
 * @param {CanonicalProfile} profile
 * @returns {CanonicalProfile}
 */
export function normalizeProfileAnchor(profile) {}
```

### 10.4 Probe 生成

```js
/**
 * @typedef {Object} ProbeManifest
 * @property {"probe-v1"} kind
 * @property {number} sampleRate
 * @property {string[]} segments
 */

/**
 * @param {AudioBuffer} referenceProbe
 * @param {AudioBuffer} recordedProbe
 * @param {ProbeManifest} manifest
 * @param {{name:string}} options
 * @returns {CanonicalProfile}
 */
export function buildProbeProfile(referenceProbe, recordedProbe, manifest, options) {}
```

### 10.5 Program 生成

```js
/**
 * @typedef {Object} TrackPair
 * @property {string} id
 * @property {string} title
 * @property {AudioBuffer} referenceBuffer
 * @property {AudioBuffer} recordedBuffer
 */

/**
 * @param {TrackPair[]} trackPairs
 * @param {{name:string}} options
 * @returns {CanonicalProfile}
 */
export function buildProgramProfile(trackPairs, options) {}
```

### 10.6 EqModel 生成

```js
/**
 * @param {{
 *   name:string,
 *   bands: EqBand[]
 * }} input
 * @returns {EqModel}
 */
export function buildFixedBandEqModel(input) {}

/**
 * @param {{
 *   name:string,
 *   bands: EqBand[],
 *   baseProfile: CanonicalProfile,
 *   steppedProfiles: CanonicalProfile[],
 *   stepCount: number
 * }} input
 * @returns {EqModel}
 */
export function buildMeasuredBasisEqModel(input) {}
```

### 10.7 Compiler

```js
/**
 * @typedef {Object} CompiledEqResult
 * @property {boolean} ok
 * @property {string|null} errorCode
 * @property {string|null} message
 * @property {{bandId:string, value:number}[]} eqSteps
 * @property {number[]} frequencyGridHz
 * @property {number[]} targetDeltaDb
 * @property {number[]} predictedEqDb
 * @property {number[]} residualDb
 * @property {number} fitScore
 * @property {[number, number]|null} usableBandHz
 */

/**
 * @param {CanonicalProfile} profileA
 * @param {CanonicalProfile} profileB
 * @returns {CompiledEqResult}
 */
export function compileEqAToB(profileA, profileB) {}
```

## 11. Probe Profile Generator 设计

### 11.1 目标

从标准探针和对应回录生成高置信度 `probe profile`。

### 11.2 输入

- 标准探针音频
- 标准探针 manifest
- 播放器回录音频

### 11.3 探针规范

首版固定探针 `probe-v1`：

1. `sync`
2. `dual-mono-ess`
3. `l-only-ess`
4. `r-only-ess`

ESS 参数建议：

- sampleRate: `48000`
- startHz: `20`
- endHz: `20000`
- durationSec: `16.0`
- preSilenceSec: `0.3`
- postSilenceSec: `0.3`

### 11.4 Probe 分析算法

#### 步骤 1：输入预处理

- 解码成 `AudioBuffer`
- 若 sample rate 不同，重采样到 `48000`
- 保留立体声

#### 步骤 2：同步定位

使用 sync 段定位整个探针起点。

要求：

- 采用相关性搜索
- 返回 `bestOffsetSamples`
- 返回 `syncScore`

若 `syncScore < PROBE_SYNC_MIN_SCORE`，失败。

建议常量：

```js
export const PROBE_SYNC_MIN_SCORE = 0.65;
```

#### 步骤 3：分段切片

根据 manifest 中的段顺序和长度切出：

- dual-mono 段
- L-only 段
- R-only 段

#### 步骤 4：声道主响应估计

首版只构建主对角响应：

- `H_LL(f)` 来自 L-only 段
- `H_RR(f)` 来自 R-only 段

dual-mono 段用于：

- 检查整体一致性
- 检查同步和左右共同频谱稳定性

实现规则：

- 对已知输入与输出做频域比值估计
- 对结果插值到标准频率网格

#### 步骤 5：平滑

固定使用对数频率邻域平滑。

建议规则：

- `1/6 octave` 平滑

#### 步骤 6：anchor 归一化

- 在 `500..2000 Hz` 取均值
- 整条曲线减去该均值

#### 步骤 7：confidence 估计

每个频点 `confidence` 由以下因子相乘得到：

- `syncConfidence`
- `inputEnergyConfidence`
- `outputEnergyConfidence`
- `localStabilityConfidence`
- `clipPenalty`

统一约束到 `0..1`。

#### 步骤 8：usableMask 生成

规则：

- `confidence < 0.35` -> false
- 超出设备有效带宽 -> false
- 输出过低接近噪声底 -> false

#### 步骤 9：输出 profile

`sourceMeta` 格式固定：

```json
{
  "kind": "probe-v1",
  "sampleRate": 48000,
  "segments": ["sync", "dual-mono-ess", "l-only-ess", "r-only-ess"],
  "syncScore": 0.93
}
```

## 12. Program Profile Generator 设计

### 12.1 目标

从 `trackPairs[]` 生成可与 probe profile 共用的 `program profile`。

### 12.2 输入模型

song mode 的正式输入模型是：

```js
/**
 * @typedef {Object} TrackPair
 * @property {string} id
 * @property {string} title
 * @property {AudioBuffer} referenceBuffer
 * @property {AudioBuffer} recordedBuffer
 */
```

硬规则：

- `trackPairs.length >= 1`
- 单首歌是合法输入
- 多首歌与单首歌必须走同一条 pipeline
- 不允许单独写一套单首专用 song mode

### 12.3 单曲处理流程

对每个 `TrackPair`：

#### 步骤 1：输入预处理

- 重采样到 `48000`
- 保留立体声

#### 步骤 2：粗对齐

- 通过包络相关或频谱相关找整体延迟
- 返回 `coarseOffset`

#### 步骤 3：细对齐

- 在粗对齐附近做局部搜索
- 返回 `fineOffset`
- 返回 `alignmentScore`

如果 `alignmentScore < PROGRAM_ALIGN_MIN_SCORE`，该曲判定无效。

建议：

```js
export const PROGRAM_ALIGN_MIN_SCORE = 0.55;
```

#### 步骤 4：时频域传函估计

每首歌按短时窗处理：

- frame size: `4096`
- hop size: `1024`
- window: Hann

对每一帧、每一频带：

- 若原曲能量不足，跳过
- 若比值极不稳定，跳过
- 记录 `Y/X` 的幅度差

首版只估计幅频，不估计相位。

#### 步骤 5：轨道级聚合

得到：

- `trackResponseDb.L/R`
- `trackConfidence.L/R`
- `trackCoverage.L/R`

### 12.4 多曲聚合

对于 `trackPairs[]` 中所有有效曲目：

- 将每首结果投到标准频率网格
- 频点级加权平均
- 权重 = 覆盖度 * 对齐分数 * 频点置信度

单首歌情况下：

- 仍走完全相同的聚合逻辑
- 只是聚合集合大小为 1

### 12.5 单首歌可接受规则

单首歌可以生成正式 `program profile`，但必须满足：

1. 有效覆盖频段达到阈值
2. 主要频带置信度足够
3. 曲内时频估计方差不过大

建议阈值：

- 覆盖度 `>= 0.75`
- 中频置信度均值 `>= 0.70`
- usable band 至少覆盖 `60..12000 Hz`

若不达标，直接失败。

### 12.6 Program sourceMeta

```json
{
  "kind": "program-v1",
  "trackCount": 3,
  "validTrackCount": 3,
  "titles": ["Track A", "Track B", "Track C"],
  "coverageScore": 0.88,
  "holdoutTrackCount": 0
}
```

### 12.7 Program 失败条件

- `trackPairs.length < 1`
- 参考与回录无法配对
- 有效曲目数为 0
- 单首歌但覆盖不足
- 多首歌但曲间方差极大无法定义稳定画像

## 13. EQ Model Generator 设计

### 13.1 目标

让 A 设备 profile 携带完整的可执行 EQ 空间。

### 13.2 路径一：固定 band schema

输入：

- band 列表
- filter 类型
- Q
- 每步 dB
- 上下限
- 是否整数

适用：

- 已知设备只能按固定频段调节
- 尚未做 measured basis 标定

输出：

- `eqModel.kind = "graphic-fixed-band"`

### 13.3 路径二：measured basis

输入：

- 基线 profile `R0`
- 每个 band 单独 `+s` 步后的 profile `Ri`
- 对应 band 元信息

计算：

`Bi(f) = (Ri(f) - R0(f)) / s`

输出：

- `eqModel.kind = "graphic-measured-basis"`
- `basis[i].effectDbPerStep`

### 13.4 路径三：parametric

适用：

- A 支持参数均衡器

输出：

- `eqModel.kind = "parametric"`

### 13.5 measured basis 规则

1. 所有 `Ri` 必须与 `R0` 用同一 profile 流程生成
2. 所有 `Ri` 必须只改变一个 band
3. `stepCount > 0`
4. 所得 basis 必须归一到标准频率网格

## 14. Profile Normalizer / Validator 设计

### 14.1 目标

确保所有进入 compiler 的 profile 都已经：

- 合法
- 可比
- 频率网格一致
- anchor 一致

### 14.2 处理步骤

1. JSON Schema 校验
2. 运行时结构校验
3. 重采样到标准频率网格
4. 重做 anchor 归一化
5. 校验 `eqModel`
6. 输出规范化 profile

### 14.3 接口

```js
/**
 * @param {unknown} raw
 * @returns {CanonicalProfile}
 */
export function loadAndNormalizeProfile(raw) {}
```

### 14.4 错误码

```js
export const PROFILE_ERROR = {
  INVALID_JSON: "INVALID_JSON",
  INVALID_SCHEMA: "INVALID_SCHEMA",
  INVALID_GRID: "INVALID_GRID",
  INVALID_ANCHOR: "INVALID_ANCHOR",
  INVALID_EQ_MODEL: "INVALID_EQ_MODEL",
  MISSING_EQ_MODEL: "MISSING_EQ_MODEL"
};
```

## 15. Compiler 设计

### 15.1 目标

将 `A_profile` 与 `B_profile` 编译成 `EQ(A -> B)`。

### 15.2 linked-stereo 规则

首版只支持 linked-stereo。

定义：

- `P_A_M(f) = weightedMean(P_A_L(f), P_A_R(f))`
- `P_B_M(f) = weightedMean(P_B_L(f), P_B_R(f))`

求：

- `Delta_M(f) = P_B_M(f) - P_A_M(f)`

权重：

- 左右声道各自 confidence

### 15.3 usableMask 交集

只有在以下条件同时满足时某频点参与求解：

- `A.usableMask.L/R` 对应可用
- `B.usableMask.L/R` 对应可用
- `A.confidence/B.confidence` 都高于阈值

### 15.4 graphic-measured-basis 求解

目标：

找到整数向量 `g`，使：

`sum_i(g_i * B_i(f))` 接近 `Delta_M(f)`

约束：

- `g_i in [minStep_i, maxStep_i]`
- `g_i` 必须为整数

建议策略：

1. 先连续最小二乘求近似
2. 再做整数舍入
3. 再做局部邻域搜索修正

原因：

- 浏览器内实现成本低
- 首版不必上复杂整数规划器

### 15.5 graphic-fixed-band 求解

当没有 measured basis 时：

- 用理论 band shape 构造 `B_i(f)`
- 求解方式同上

### 15.6 parametric 求解

首版简化：

- 固定中心频率与 Q
- 只解各 band gain

不在首版支持自动移动频率与自动扫 Q。

### 15.7 输出结构

```json
{
  "ok": true,
  "errorCode": null,
  "message": null,
  "eqSteps": [
    { "bandId": "31", "value": 2 },
    { "bandId": "63", "value": -1 }
  ],
  "frequencyGridHz": [],
  "targetDeltaDb": [],
  "predictedEqDb": [],
  "residualDb": [],
  "fitScore": 0.91,
  "usableBandHz": [40, 14000]
}
```

### 15.8 fitScore 规则

建议定义：

- 对共同 usable band 上的加权均方误差做归一
- 映射到 `0..1`
- 越接近 1 越好

建议阈值：

- `fitScore >= 0.80`：通过
- `0.65 <= fitScore < 0.80`：警告
- `< 0.65`：失败

## 16. UI 状态机

### 16.1 Profile Workbench 页面

分三块：

1. Probe Profile
2. Program Profile
3. EQ Model

### 16.2 Probe Profile 页面状态

状态：

- `idle`
- `reference-loaded`
- `recording-loaded`
- `ready`
- `processing`
- `success`
- `error`

转移：

- `idle -> reference-loaded`
- `reference-loaded -> ready`
- `ready -> processing`
- `processing -> success | error`

### 16.3 Program Profile 页面状态

状态：

- `idle`
- `pairs-partial`
- `pairs-ready`
- `processing`
- `success`
- `error`

规则：

- `trackPairs.length >= 1` 且每对都有原曲和回录时进入 `pairs-ready`

### 16.4 Compiler 页面状态

状态：

- `idle`
- `a-loaded`
- `b-loaded`
- `ready`
- `compiling`
- `success`
- `error`

规则：

- 只要 A/B 都导入且通过 validator，自动进入 `ready`
- 用户点击“生成 EQ”后进入 `compiling`

## 17. 页面组件输入输出

### 17.1 ProbeProfilePanel

Props：

```js
{
  onExportProfile(profile),
  decodeExternalAudioFile(file)
}
```

内部状态：

- `referenceProbe`
- `probeManifest`
- `recordedProbe`
- `resultProfile`
- `processing`
- `errorMessage`

### 17.2 ProgramProfilePanel

Props：

```js
{
  onExportProfile(profile),
  decodeExternalAudioFile(file)
}
```

内部状态：

- `trackPairs`
- `resultProfile`
- `processing`
- `errorMessage`

### 17.3 EqModelPanel

Props：

```js
{
  onExportEqModel(eqModel)
}
```

内部状态：

- `deviceName`
- `bandDefs`
- `baseProfile`
- `steppedProfiles`
- `resultEqModel`

### 17.4 ProfileCompilerPanel

Props：

```js
{
  onCompile(profileA, profileB)
}
```

内部状态：

- `profileA`
- `profileB`
- `result`
- `processing`
- `errorMessage`

## 18. 常量建议

```js
export const STANDARD_SAMPLE_RATE = 48000;
export const DEFAULT_GRID_MIN_HZ = 20;
export const DEFAULT_GRID_MAX_HZ = 20000;
export const DEFAULT_POINTS_PER_OCTAVE = 24;
export const DEFAULT_ANCHOR_RANGE_HZ = [500, 2000];
export const PROBE_SYNC_MIN_SCORE = 0.65;
export const PROGRAM_ALIGN_MIN_SCORE = 0.55;
export const CONFIDENCE_MIN_USABLE = 0.35;
export const FIT_SCORE_PASS = 0.80;
export const FIT_SCORE_WARN = 0.65;
```

## 19. 错误码定义

```js
export const WORKBENCH_ERROR = {
  PROBE_SYNC_FAILED: "PROBE_SYNC_FAILED",
  PROBE_SEGMENT_MISSING: "PROBE_SEGMENT_MISSING",
  PROBE_BANDWIDTH_TOO_NARROW: "PROBE_BANDWIDTH_TOO_NARROW",
  PROGRAM_NO_TRACK_PAIRS: "PROGRAM_NO_TRACK_PAIRS",
  PROGRAM_ALIGN_FAILED: "PROGRAM_ALIGN_FAILED",
  PROGRAM_INSUFFICIENT_COVERAGE: "PROGRAM_INSUFFICIENT_COVERAGE",
  PROGRAM_NO_VALID_TRACKS: "PROGRAM_NO_VALID_TRACKS",
  EQ_MODEL_INVALID_BANDS: "EQ_MODEL_INVALID_BANDS",
  EQ_MODEL_INVALID_BASIS: "EQ_MODEL_INVALID_BASIS",
  COMPILER_MISSING_EQ_MODEL: "COMPILER_MISSING_EQ_MODEL",
  COMPILER_INCOMPATIBLE_PROFILES: "COMPILER_INCOMPATIBLE_PROFILES",
  COMPILER_FIT_TOO_LOW: "COMPILER_FIT_TOO_LOW"
};
```

## 20. 与现有代码的映射

可复用：

- [src/deck-calibration.js](/D:/Code/rina-side/src/deck-calibration.js)
  的参考信号生成、sync 定位、扫频分析思路
- [src/calibration-profile.js](/D:/Code/rina-side/src/calibration-profile.js)
  的频率插值、卷积 impulse 生成
- [src/App.jsx](/D:/Code/rina-side/src/App.jsx)
  的文件导入、录音、离线处理框架

必须替换或拆出：

- [src/deck-calibration.js:142](/D:/Code/rina-side/src/deck-calibration.js#L142)
  当前 `monoFromAudioBuffer()` 不能再作为新工具的主路径
- [src/deck-calibration.js:353](/D:/Code/rina-side/src/deck-calibration.js#L353)
  当前 L/R 共用 correction 的逻辑不能复用到新 profile
- [src/App.jsx](/D:/Code/rina-side/src/App.jsx)
  不能继续单文件承载新工具全链路，必须模块化拆出

## 21. 实施顺序

### Phase 1：Schema 与基础模块

交付：

- `frequency-grid.js`
- `anchor.js`
- `schema.js`
- `validator.js`
- `normalizer.js`

验收：

- 任意 profile JSON 能被明确判定合法或非法

### Phase 2：Probe Generator

交付：

- `probe-spec.js`
- `probe-sync.js`
- `probe-transfer.js`
- `probe-profile-builder.js`

验收：

- 标准探针与回录可稳定导出 `probe profile`

### Phase 3：EqModel Generator

交付：

- fixed-band 构建
- measured-basis 构建

验收：

- 可得到合法 `eqModel`

### Phase 4：Program Generator

交付：

- `trackPairs[]` song pipeline
- 单曲与多曲统一聚合

验收：

- `N >= 1` 时同一条代码路径可运行
- 单首达标可导出 `program profile`

### Phase 5：Compiler

交付：

- delta builder
- graphic solver
- compile result

验收：

- 导入两个 profile 后可直接得出结果或失败

### Phase 6：UI 集成

交付：

- workbench 页面
- compiler 页面

验收：

- 用户能完成 profile 生成与 A->B EQ 求解全流程

## 22. 最小可行测试集

### 22.1 单元测试

- 频率网格生成
- anchor 归一化
- schema 校验
- eqModel 校验
- program 单曲聚合
- graphic basis 求解器

### 22.2 集成测试

- probe 音频 -> probe profile
- 单首歌 -> program profile
- 多首歌 -> program profile
- A probe + eqModel 与 B program -> compiler

### 22.3 回归测试

- 非法 profile 拒绝
- 缺失 eqModel 拒绝
- fit score 低于阈值拒绝

## 23. 最终验收标准

1. 系统中只有一个 canonical profile 格式
2. probe 与 program 输出完全同构
3. song mode 正式输入为 `trackPairs[]`
4. 单首歌可生成正式 `program profile`，但必须通过覆盖与稳定性阈值
5. 多首歌不走第二套逻辑，仍然使用同一 `trackPairs[]` pipeline
6. A 作为被调设备时必须带 `eqModel`
7. compiler 对不合法输入直接失败
8. compiler 输出的 EQ 必须满足 A 的步进与上下限
9. UI 层用户只需导入两个 profile 即可得到结果或明确失败
10. 整条链路不依赖兼容性补丁或隐式降级

## 24. 下一步生成代码时的执行原则

1. 先落基础 schema 与 validator，再落算法
2. 先拆模块，再接 UI，不允许继续把新逻辑堆进 `App.jsx`
3. 先保证 canonical profile 全链路打通，再做图表和表现优化
4. 先做 `graphic-measured-basis` 和 `graphic-fixed-band`，后做 parametric 细化
5. 所有新模块必须围绕本文档定义的输入输出编写

这是后续代码生成的直接依据。
