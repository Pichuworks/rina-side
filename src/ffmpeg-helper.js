// ── ffmpeg.wasm helper ───────────────────────────────────────
// Lazy-loads ffmpeg.wasm only when native Web Audio decoding fails.
// Uses the multi-threaded build (requires COOP/COEP headers).

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpegInstance = null;
let loadPromise = null;

const BASE_URL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';

async function getFFmpeg(onLog) {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ff = new FFmpeg();
    if (onLog) ff.on('log', ({ message }) => onLog(message));

    await ff.load({
      coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.worker.js`, 'text/javascript'),
    });

    ffmpegInstance = ff;
    return ff;
  })();

  return loadPromise;
}

/**
 * Transcode an audio file to WAV using ffmpeg.wasm.
 * @param {File} file — the input audio file
 * @param {function} onLog — optional log callback
 * @returns {ArrayBuffer} — WAV data ready for decodeAudioData
 */
export async function transcodeToWav(file, onLog) {
  const ff = await getFFmpeg(onLog);
  const inputName = 'input' + getExt(file.name);
  const outputName = 'output.wav';

  await ff.writeFile(inputName, await fetchFile(file));
  await ff.exec(['-i', inputName, '-ar', '44100', '-ac', '2', '-f', 'wav', outputName]);

  const data = await ff.readFile(outputName);
  // Cleanup
  await ff.deleteFile(inputName).catch(() => {});
  await ff.deleteFile(outputName).catch(() => {});

  return data.buffer;
}

/**
 * Check if SharedArrayBuffer is available (required for multi-thread ffmpeg.wasm).
 */
export function isSharedArrayBufferAvailable() {
  return typeof SharedArrayBuffer !== 'undefined';
}

function getExt(filename) {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

// File extensions that browsers typically can't decode natively
const NEEDS_FFMPEG = new Set(['.flac', '.aiff', '.aif', '.ape', '.wv', '.dsd', '.dsf', '.dff', '.wma', '.opus']);

/**
 * Check if a file likely needs ffmpeg for decoding.
 */
export function likelyNeedsTranscode(filename) {
  return NEEDS_FFMPEG.has(getExt(filename));
}
