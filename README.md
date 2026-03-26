# SIDE — Sequential Interleaved Dubbing Engine

> ……把声音编译进磁带里。

Browser-based tool for preparing digital audio files for cassette tape recording. Arranges tracks onto SIDE A / SIDE B respecting tape capacity, then exports a single WAV file per side — ready to feed into your deck's line input.

## Features

- **Tape presets**: C-46 / C-60 / C-90 / C-120 / Custom, Type I / II / IV with recording level reference
- **Track management**: Drag-drop reorder, cross-side move, auto-distribute (bin-packing)
- **Smart gap detection**: Analyzes head/tail silence per track, computes optimal inter-track gaps
- **Loudness normalization**: Peak / RMS / Off, reflected in static waveform preview
- **Export**: WAV with selectable sample rate (Auto / 44.1k / 48k) and bit depth (Auto / 16 / 24)
- **Preview playback**: Full-side sequential playback with gaps and normalization applied
  - VFD peak meter (24-segment, color-coded)
  - VU needle meter (Rina-themed)
  - Real-time FFT spectrum (16-band segmented grid)
  - Real-time waveform oscilloscope (L/R filled)
  - Seek bar with track boundary dots
- **Per-side static waveform**: Audition-style L/R overview with normalization and gap visualization
- **Playlist I/O**: JSON export/import with auto-match by filename
- **Format detection**: Colored tags per format (FLAC, WAV, MP3, AAC, OGG, etc.)
- **Resample indicators**: Per-track arrows showing up/down sample direction
- **i18n**: 简体中文 / 日本語 / English
- **Offline-capable**: Self-hosted fonts, no runtime dependencies except Google Fonts for CJK

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Drop audio files onto the page.

## Build & Deploy

```bash
npm run build   # outputs to dist/
```

Deploy `dist/` to any static host. For **Cloudflare Pages**: connect repo, build command `npm run build`, output dir `dist`, and **leave Deploy command empty** (Pages will publish the build output automatically).

> Do not run `npx wrangler deploy` in a Pages build. `wrangler deploy` is for **Workers**, and in non-interactive CI it may try to scaffold a Vite Worker project (`@cloudflare/vite-plugin`) and fail on peer deps (for example when the repo is pinned to Vite 5).

The `public/_headers` file provides required COOP/COEP headers for SharedArrayBuffer (needed by ffmpeg.wasm for FLAC/AIFF support).

## Audio Quality

- **Playback**: AudioContext outputs at system native sample rate in 32-bit float. Quality is comparable to foobar2000 in shared mode.
- **Export**: OfflineAudioContext renders at the target sample rate. Auto SR picks the highest SR among the side's tracks (no unnecessary resampling). 24-bit WAV encoding preserves full dynamic range for tape recording.
- **Decoding**: Web Audio API native decode for MP3/WAV/OGG/AAC. ffmpeg.wasm fallback for FLAC/AIFF.

## Tech Stack

React 18, Vite 5, Web Audio API, ffmpeg.wasm (lazy-loaded), Canvas 2D. No UI framework. Inline styles with CSS custom properties for theming.

## Theme

"Rina paper-white" — designed for 天王寺璃奈 (Tennoji Rina).

- Background: `#F5F3F0`
- Accent: `#D4859A` (Rina pink)
- VFD cyan: `#90C7D7`
- Amber: `#DFA026`

## License

MIT
