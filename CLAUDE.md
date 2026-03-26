# CLAUDE.md — SIDE Project Guide

## Structure

```
src/
├── main.jsx              # Entry
├── App.jsx               # Main (~1200 lines) — config, tracks, audio, export, themes
├── Player.jsx            # Playback deck (~310 lines) — transport, meters, sim toggle
├── SideWaveform.jsx      # Static waveform (memo, pre-downsampled peaks)
├── Icons.jsx             # Inline SVG icons
└── ffmpeg-helper.js      # ffmpeg.wasm lazy loader
```

## Performance model

During playback: **zero React re-renders**. `playPos`/`playingIdx` are refs. Player.jsx updates DOM directly.

SideWaveform uses `downsamplePeaks(2048)` at load time → drawing ~0.1ms.

## Theme system

12 character themes. Default = 天王寺璃奈 (no separate entry).
SIDE A/B colors auto-derived from accent via hue rotation (150°) + desaturation.

| Key     | Character  | Accent  | Source                                          |
| ------- | ---------- | ------- | ----------------------------------------------- |
| default | 天王寺璃奈 | #D4859A | Project pink, bg=#E8ECF2 (ペーパーホワイト基調) |
| keke    | 唐可可     | #49BDF0 | Liella パステルブルー                           |
| tomori  | 高松灯     | #77BBDD | MyGO公式                                        |
| raana   | 要乐奈     | #77DD77 | MyGO公式                                        |
| soyo    | 长崎爽世   | #FFDD88 | moegirl                                         |
| anon    | 千早爱音   | #FF8899 | MyGO公式                                        |
| taki    | 椎名立希   | #7777AA | MyGO公式                                        |
| sakiko  | 丰川祥子   | #7799CC | Ave Mujica                                      |
| mutsumi | 若叶睦     | #779977 | Ave Mujica                                      |
| nyamu   | 祐天寺若麦 | #AA4477 | Ave Mujica                                      |
| hatsuka | 三角初华   | #BB9955 | Ave Mujica                                      |
| uika    | 八幡海铃   | #335566 | Ave Mujica                                      |

## Audio pipeline

```
Load:  File header parse (sampleRate / channels / bitDepth) → native decode or ffmpeg WAV transcode → AudioBuffer → peaks/analysis → track
Play:  AudioBuffer → GainNode → [preview sim: TYPE I / TYPE II / TYPE IV / VINYL] → output + analysers
Export: OfflineAudioContext → encodeWAV → download
```

Notes:
- ffmpeg is decode-only fallback; it must not overwrite source metadata used by UI/export decisions.
- Preview simulation is never baked into export.

## Tape/Vinyl simulation

Tape: TYPE I / II / IV each use distinct EQ + saturation + hiss profiles.
Vinyl: EQ + bandwidth limit + surface noise + crackle + rumble + wow/flutter.
Preview only — export always clean.
