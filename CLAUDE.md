# SIDE — Claude Development Notes

Sequential Interleaved Dubbing Engine  
Cassette tape preparation tool. Browser-only, no backend.

## Stack

- React 18 (via Vite)
- Web Audio API — AudioContext, OfflineAudioContext, AudioBuffer
- ffmpeg.wasm (`@ffmpeg/core-mt`) — lazy-loaded fallback decoder, requires COOP/COEP headers
- Cloudflare Pages deployment (`npm run build` → `dist/`)

## Project Structure
```
src/
  App.jsx          — main component: core state, UI, audio pipeline, themes
  i18n.js          — all user-facing strings, t() helper, APP_VERSION
  Player.jsx       — preview transport (timeline, seekbar, meter modes)
  SideWaveform.jsx — static per-side waveform canvas (pre-downsampled peak pairs)
  SideSpectrogram.jsx — per-side FFT spectrogram canvas (log-freq, level-mapped)
  Icons.jsx        — inline SVG icon components, no external font dependency
  ffmpeg-helper.js — lazy ffmpeg.wasm loader, WAV transcode, format detection
  w1-helper.js     — Web Audio utility functions
  calibration-profile.js — calibration profile I/O
  deck-calibration.js — signal generation, sync detection, response/transport analysis
  hooks/
    useSignalOutput.js    — calibration signal output state + callbacks
    useDeckCalibration.js — deck recording calibration state + callbacks
    usePlayerProfile.js   — player profile & EQ matching state + callbacks
  tool-plugins/
    index.js       — plugin registry
    CassetteRecordingCalibrationPlugin.jsx — deck calibration UI (self-contained LABELS)
    PlayerProfileWorkbenchPlugin.jsx — player profile & EQ matching UI (self-contained LABELS)
  modules/
    player-profile/ — player frequency response profiling
    probe-profile/  — probe-based measurement
    program-profile/ — song-based measurement (track pairing, alignment, transfer)
    eq-model/       — EQ model schema and measurement
    eq-compiler/    — A→B EQ compilation (delta, solve, fit)
```

## Architecture

### i18n
All user-facing strings are in `i18n.js`. Access via `T("key")` inside the main component
(bound to current `lang` state). Tool plugins use their own self-contained `LABELS` objects
instead of the global `T()` — each plugin resolves labels via `LABELS[lang] || LABELS.en`.

Help modal content is hardcoded JSX per locale (not in `I18N`) — search for `showHelp` to find it.

### Tool hooks
Tool-related state and logic is extracted into three custom hooks in `src/hooks/`:

| Hook | Owns | Receives |
|------|------|----------|
| `useSignalOutput` | calibration side, signal type, running state, start/stop/resolve | `getAC`, `stopPlaybackRef`, `tracks`, `buildPreviewGains`, `targetDb`, `showTools` |
| `useDeckCalibration` | manifest, capture, recording, analysis state + all callbacks | `T`, `showToast`, `downloadBlob`, `encodeWAV`, `decodeExternalAudioFile`, `setProcessing`, `setProcMsg`, `showTools` |
| `usePlayerProfile` | probe/song/EQ/compiler state + all callbacks | `showToast`, `downloadBlob`, `encodeWAV`, `decodeExternalAudioFile`, `setProcessing`, `setProcMsg`, `onLoadCalibrationProfile` |

The main component passes shared functions into hooks as parameters. Hooks return state values
and callbacks that the main component forwards to tool plugins as props.

`loadCompileResultProfile` (in usePlayerProfile) needs to write to the main component's calibration
profile state — this is handled via an `onLoadCalibrationProfile` callback passed from the parent.

## Audio Pipeline

**Loading**
1. Try `AudioContext.decodeAudioData()` directly
2. If format likely needs transcode (FLAC / AIFF / OPUS etc.), or if step 1 fails → `ffmpeg.wasm` → WAV → retry decode
3. Source SR and bit depth are read from file headers **before** ffmpeg transcode, so they reflect the original file

**Preview playback**
- `AudioBuffer` (32-bit float) scheduled via `AudioContext` at system native SR
- Medium simulation applied via Web Audio nodes (BiquadFilter, WaveShaperNode, gain staging)
- Simulation is preview-only — no effect on export

**Export**
- `OfflineAudioContext` at target SR
- Normalization applied as gain before render
- Output encoded to WAV (16 or 24-bit interleaved PCM) in-browser
- Tail silence padded to tape rated length

## Themes

Defined in `THEMES` object in `App.jsx`. Each entry:
```js
key: {
  accent,       // required — primary color, drives auto-derived colors
  bg,           // page background
  bgCard,       // card/panel background
  bgDeep,       // inset/deep background
  border,       // border color
  accentDim,    // muted accent (backgrounds, selections)
  // optional overrides:
  sideA,        // Side A indicator color (default: accent)
  sideB,        // Side B indicator color (default: auto-derived from accent)
  accentInk,    // text on accent-colored surfaces (default: auto-derived)
  warning,      // warning color (default: auto-derived)
  group,        // group label for separator in theme picker
}
```

Theme display order and names are in `THEME_ORDER` and `THEME_NAMES`.  
Current groups: `""` (default) · `liella` · `ngo` · `mygo` · `mujica` · `sumimi` · `crisiris`

## i18n

All user-facing strings are in `src/i18n.js` (extracted from App.jsx).  
Three locales: `zh-CN` · `ja` · `en`  
Access via `T("key")` inside the main component. Tool plugins use self-contained `LABELS` — see Architecture section above.

## Key State

| State | Type | Description |
|---|---|---|
| `sides` | `{ A: Track[], B: Track[] }` | all loaded tracks, split by side |
| `tapePreset` | string | `C-46` / `C-60` / `C-90` / `C-120` / `CUSTOM` |
| `tapeType` | string | `TYPE_I` / `TYPE_II` / `TYPE_IV` |
| `normMode` | string | `PEAK` / `RMS` / `OFF` |
| `simState` | string | `OFF` / `TAPE_I` / `TAPE_II` / `TAPE_IV` / `VINYL` |
| `deckState` | string | `OFF` / `PORTABLE` / `2HEAD` / `3HEAD` |
| `toneState` | string | `DEFAULT` / `COOL` / `WARM` |
| `tubeState` | string | `OFF` / `ON` |
| `vinylEra` | string | `MODERN` / `CLASSIC` / `VINTAGE` / `EFFECT` |
| `crackleState` | string | `OFF` / `LOW` / `MID` / `HIGH` |
| `theme` | string | key into `THEMES` |
| `lang` | string | `zh-CN` / `ja` / `en` |

## Notes

- `SideWaveform` and `SideSpectrogram` are `memo`-wrapped canvas components. They re-render only when their `depKey` (derived from segment metadata) changes.
- ffmpeg.wasm requires `SharedArrayBuffer`, which requires COOP/COEP headers. Cloudflare Pages: set these in `_headers` or `wrangler.toml`.
- The `PEAK_N = 4096` constant in `SideWaveform.jsx` must match the `downsamplePeaks()` call in `App.jsx`.
- Playlist JSON contains track metadata and side assignments but not audio data. Re-adding audio files with matching filenames auto-hydrates stub tracks.