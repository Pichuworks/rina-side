# CLAUDE.md — SIDE Project Guide

## Structure

```
src/
├── main.jsx              # Entry
├── App.jsx               # Main (~1190 lines) — config, tracks, audio, export, themes
├── Player.jsx            # Playback deck (~310 lines) — transport, meters, sim toggle
├── SideWaveform.jsx      # Static waveform (memo, pre-downsampled peaks)
├── Icons.jsx             # Inline SVG icons
└── ffmpeg-helper.js      # ffmpeg.wasm lazy loader
```

## Performance model

During playback: **zero React re-renders**. `playPos`/`playingIdx` are refs. Player.jsx updates DOM directly via RAF.

SideWaveform uses `downsamplePeaks(2048)` computed at load time → drawing cost ~0.1ms.

## Audio pipeline

```
Load:  File → decode → AudioBuffer → peaks/analysis → track state
Play:  AudioBuffer → GainNode → [tape/vinyl sim] → output + analysers
Export: OfflineAudioContext → encodeWAV → download
```

## Theme system

13 character themes with verified official 応援色:

| Key | Character | Accent | Source |
|-----|-----------|--------|--------|
| default | Default | #D4859A | Project Rina pink |
| rina | 天王寺璃奈 | #D4859A | Niji ペーパーホワイト→project pink |
| keke | 唐可可 | #49BDF0 | Liella パステルブルー |
| tomori | 高松灯 | #77BBDD | MyGO official site |
| raana | 要乐奈 | #77DD77 | MyGO official site |
| soyo | 长崎爽世 | #DDAA11 | MyGO official site (#FFBB12 adjusted) |
| anon | 千早爱音 | #FF8899 | MyGO official site |
| taki | 椎名立希 | #7777AA | MyGO official site |
| sakiko | 丰川祥子 | #7799CC | Ave Mujica palette |
| mutsumi | 若叶睦 | #779977 | Ave Mujica palette |
| nyamu | 祐天寺若麦 | #AA4477 | Ave Mujica palette (confirmed) |
| hatsuka | 三角初华 | #BB9955 | Ave Mujica palette |
| uika | 八幡海铃 | #335566 | Ave Mujica palette |

Each theme defines: accent, bg, bgCard, bgDeep, border, accentDim, sideA, sideB.

## Tape/Vinyl simulation

Tape: WaveShaper(tanh) → Lowpass(11kHz) + BandpassNoise(hiss)
Vinyl: LowShelf(+2dB) → Lowpass(14kHz) + HighpassNoise(crackle)
Preview only — export is always clean.
