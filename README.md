# SIDE — Sequential Interleaved Dubbing Engine

> ……把声音编译进磁带里。

Browser-based tool for preparing digital audio for cassette tape recording.  
Arrange tracks onto Sides A and B, preview with medium simulation, then export deck-ready WAV.

## Features

**Core**
- Tape presets: C-46 / C-60 / C-90 / C-120 / Custom, Type I / II / IV
- Track management: drag-and-drop reorder, cross-side move (→A / →B), ↑↓ nudge
- Smart gap detection: subtracts existing head/tail silence to compute optimal track spacing
- Auto-distribute: balances A/B side fill by track duration
- Loudness normalization: Peak or RMS, target level derived from tape type
- Tail padding: silence-fills to tape rated length
- Per-side SR and bit-depth resolution with per-track conversion indicators
- Export: WAV at Auto / 44.1k / 48k, 16 or 24-bit

**Preview**
- Full-side timeline playback with gaps, gain, and padding applied
- Seekbar + track boundary markers, pause / resume / prev / next
- Meter: VFD peak · VU needle · FFT spectrum (segmented) · Waveform
- Per-side static waveform overview (downsampled peak pairs)
- Per-side FFT spectrogram (log frequency axis, level-mapped color)

**Medium simulation** *(preview only — does not affect exported WAV)*
- Simulation: Type I / II / IV tape or Vinyl frequency response
- Deck: Portable / 2-head / 3-head transport characteristics
- Tone: Neutral / Cool / Warm spectral tilt
- Tube: Subtle harmonic coloring and high-frequency rounding
- Era (vinyl): Modern / Classic / Vintage / Effect wear and roll-off
- Crackle (vinyl): Low / Mid / High density click/pop surface noise

**Other**
- Playlist I/O: JSON export and import with filename-based auto-hydration
- ffmpeg.wasm fallback for FLAC / AIFF / OPUS and other formats browsers can't decode natively
- Source SR / bit-depth preserved from file headers (not overwritten by ffmpeg intermediate WAV)
- 17 character themes based on official 応援色: MyGO / Ave Mujica / Liella / Nijigasaki / crisiris
- i18n: 简体中文 / 日本語 / English

## Quick Start
```bash
npm install
npm run dev
```

## Deploy
```bash
npm run build   # outputs to dist/
# deploy dist/ to Cloudflare Pages (or any static host)
```

## Credits
```
ver 0.9 Release Candidate II
by 天使天才天王寺璃奈
with Claude Opus 4.6 & GPT 5.4
```