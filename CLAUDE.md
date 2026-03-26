# CLAUDE.md — SIDE Project Guide

## What is this?

**SIDE** (Sequential Interleaved Dubbing Engine) — browser-based cassette tape transcription tool. Takes digital audio → arranges into SIDE A/B playlists → exports WAV per side for recording onto a cassette deck.

## Tech Stack

React 18 + Vite 5, plain JSX (no TypeScript). Web Audio API for decode/playback/metering/offline-render. ffmpeg.wasm for FLAC/AIFF. All styles inline JS objects. No UI framework, no state management library.

## Structure

```
src/
├── main.jsx              # Entry point
├── App.jsx               # Main component (~1050 lines) — config, tracks, export, playlist I/O
├── Player.jsx            # Playback deck — transport, VFD/VU/spectrum/waveform meters
├── SideWaveform.jsx      # Static per-side waveform overview (React.memo, useEffect canvas)
├── Icons.jsx             # Inline SVG icon components (no icon font dependency)
└── ffmpeg-helper.js      # ffmpeg.wasm lazy loader for FLAC/AIFF
public/
├── _headers              # Cloudflare COOP/COEP for SharedArrayBuffer
├── favicon.svg           # Cassette tape icon in Rina pink
└── fonts/                # Self-hosted JetBrains Mono woff2
```

## Running

```bash
npm install
npm run dev     # localhost:5173, COOP/COEP via vite plugin
npm run build   # dist/ for Cloudflare Pages
```

## Architecture

### Component hierarchy
```
App (state, config, tracks, export logic)
├── Player (playback UI, receives analyserL/R refs from App)
│   ├── VFDMeter (24-segment peak meter, direct DOM manipulation)
│   ├── VUMeter (SVG needle meter, Rina-themed)
│   ├── Spectrum canvas (16-band × 12-row segmented FFT)
│   └── Waveform canvas (L/R filled oscilloscope)
├── SideWaveform (static per-side overview, React.memo)
├── SPanel × 2 (SIDE A/B track lists)
│   ├── CapBar (capacity progress bar)
│   ├── TimeLine (visual track layout)
│   └── TRow × N (individual track rows)
└── Help Modal (i18n: zh-CN/ja/en)
```

### Audio pipeline
```
File → [Web Audio decode | ffmpeg.wasm] → AudioBuffer (32-bit float, in JS heap)
  → peak/RMS analysis, silence detection → stored in tracks[] state

Playback:  AudioBuffer → GainNode → masterGain → ChannelSplitter
             → [AnalyserL, AnalyserR]  (read by Player.jsx RAF loop)
             → AudioContext.destination  (system native SR, 32-bit float)

Export:    AudioBuffers → OfflineAudioContext (auto/44.1k/48k SR)
             → encodeWAV (16/24 bit) → Blob → download
```

### Performance-critical patterns

- **SideWaveform**: Module-level `React.memo` component. Receives pre-computed `segments` array (computed via `useMemo` in SPanel). Only redraws when segment metadata changes (track IDs, durations, gains, gaps). AudioBuffer references are stable — no copying.

- **Player meter loop**: Own `useEffect` + `requestAnimationFrame` in Player.jsx. Updates VFD segments and VU needles via `data-ch` / `data-vu` DOM queries — no React state for 60fps updates. Pauses RAF when `paused=true`.

- **Playback decoupling**: `playRef.current.schedule` is a snapshot taken at play start. Track editing during playback doesn't affect the playing schedule — changes apply on next play.

## Key conventions

- All colors as hex constants, not CSS variables, in canvas contexts (canvas 2d can't resolve CSS vars)
- Rina board expressions (`[^_^]`) stored as string constants (`RINA_SMILE`) to avoid JSX parse issues
- Font stack: `'Noto Sans SC','Noto Sans JP','Hiragino Sans','Microsoft YaHei',system-ui,sans-serif` (body), `'JetBrains Mono'` (mono, self-hosted)
- i18n: `I18N` object at top of App.jsx, `T("key")` accessor, 3 langs: zh-CN/ja/en
- Export sample rate/bit depth: "auto" resolves per-side (max SR, lossless→24bit)

## Common tasks

### Add a new meter/visualization mode
1. Add mode string to `METER_MODES` array in Player.jsx
2. Add label to `MODE_LABEL`
3. Add canvas ref if needed
4. Add rendering branch in the `tick()` RAF loop
5. Add JSX branch in the visualization panel

### Add a new track metadata field
1. Add to track object in `loadFiles()`
2. Add to playlist export (`exportPL`) and import (`importPL`) 
3. Add to `TRow` display
4. If affects waveform: add to `wfSegments` useMemo deps in SPanel

### Modify export behavior
1. Update `expSide()` in App.jsx
2. If new option: add state, add to config UI row 2, add to playlist I/O, add to footer status bar
