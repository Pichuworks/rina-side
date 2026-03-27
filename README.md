# SIDE — Sequential Interleaved Dubbing Engine

> ……把声音编译进磁带里。

Browser-based tool for preparing digital audio for cassette tape recording.

## Features

- **Tape presets**: C-46/60/90/120/Custom, Type I/II/IV
- **Track management**: Drag-drop, cross-side move, auto-distribute
- **Smart gaps**: Head/tail silence detection
- **Loudness normalization**: Peak/RMS, reflected in waveform
- **Export**: WAV at auto/44.1k/48k, 16/24-bit
- **4 visualizations**: VFD peak, VU needle, FFT spectrum (segmented), waveform
- **Sound simulation**: Tape (saturation+hiss+rolloff) / Vinyl (warmth+crackle)
- **13 character themes**: Based on official 応援色 from MyGO / Ave Mujica / Liella / Nijigasaki
- **Per-side static waveform**: Audition-style overview
- **Playlist I/O**: JSON with auto-match
- **i18n**: zh-CN / ja / en

## Quick Start

```bash
npm install && npm run dev
```

## Deploy

```bash
npm run build  # dist/ → Cloudflare Pages
```

## Credits

```
ver 0.3 · by 天王寺璃奈
```
