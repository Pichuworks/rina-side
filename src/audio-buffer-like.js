import { transcodeToWav } from "./ffmpeg-helper.js";

function createBufferLike(channels, sampleRate) {
  const safeChannels = channels?.length ? channels : [new Float32Array(0)];
  const length = safeChannels[0]?.length || 0;
  return {
    numberOfChannels: safeChannels.length,
    sampleRate,
    length,
    duration: sampleRate > 0 ? length / sampleRate : 0,
    getChannelData(channel) {
      return safeChannels[channel] || safeChannels[0];
    },
  };
}

export function parsePcmWavBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 44) return null;
  const readAscii = (offset, length) => String.fromCharCode(...bytes.slice(offset, offset + length));
  if (readAscii(0, 4) !== "RIFF" || readAscii(8, 4) !== "WAVE") return null;

  const view = new DataView(buffer);
  let offset = 12;
  let fmt = null;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (chunkId === "fmt ") {
      fmt = {
        audioFormat: view.getUint16(chunkStart, true),
        numChannels: view.getUint16(chunkStart + 2, true),
        sampleRate: view.getUint32(chunkStart + 4, true),
        blockAlign: view.getUint16(chunkStart + 12, true),
        bitsPerSample: view.getUint16(chunkStart + 14, true),
      };
    } else if (chunkId === "data") {
      dataOffset = chunkStart;
      dataSize = chunkSize;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (!fmt || dataOffset < 0 || !fmt.sampleRate || !fmt.numChannels || !fmt.blockAlign) return null;

  const frameCount = Math.floor(dataSize / fmt.blockAlign);
  const channels = Array.from({ length: fmt.numChannels }, () => new Float32Array(frameCount));
  const bytesPerSample = Math.max(1, fmt.bitsPerSample >> 3);
  let ptr = dataOffset;

  for (let i = 0; i < frameCount; i++) {
    for (let ch = 0; ch < channels.length; ch++) {
      let sample = 0;
      if (fmt.audioFormat === 1 && fmt.bitsPerSample === 8) {
        sample = (view.getUint8(ptr) - 128) / 128;
      } else if (fmt.audioFormat === 1 && fmt.bitsPerSample === 16) {
        sample = view.getInt16(ptr, true) / 32768;
      } else if (fmt.audioFormat === 1 && fmt.bitsPerSample === 24) {
        const b0 = view.getUint8(ptr);
        const b1 = view.getUint8(ptr + 1);
        const b2 = view.getUint8(ptr + 2);
        let value = b0 | (b1 << 8) | (b2 << 16);
        if (value & 0x800000) value |= 0xff000000;
        sample = value / 8388608;
      } else if (fmt.audioFormat === 1 && fmt.bitsPerSample === 32) {
        sample = view.getInt32(ptr, true) / 2147483648;
      } else if (fmt.audioFormat === 3 && fmt.bitsPerSample === 32) {
        sample = view.getFloat32(ptr, true);
      } else {
        return null;
      }
      channels[ch][i] = sample;
      ptr += bytesPerSample;
    }
  }

  return createBufferLike(channels, fmt.sampleRate);
}

export async function decodeAudioFileToBufferLike(file, {
  fileBuffer = null,
  ffmpegStatus = null,
  setFfmpegStatus = null,
  setProcMsg = null,
} = {}) {
  const sourceBuffer = fileBuffer || await file.arrayBuffer();
  const direct = parsePcmWavBuffer(sourceBuffer);
  if (direct) return direct;

  if (setProcMsg) setProcMsg(`ffmpeg: ${file.name}`);
  if (ffmpegStatus === "idle" && setFfmpegStatus) setFfmpegStatus("loading");

  let wavBuffer;
  try {
    wavBuffer = await transcodeToWav(file, (msg) => {
      if (setProcMsg) setProcMsg(`ffmpeg: ${msg}`);
    });
    if (setFfmpegStatus) setFfmpegStatus("ready");
  } catch (error) {
    if (setFfmpegStatus) {
      if (String(error?.message || "").includes("SharedArrayBuffer")) setFfmpegStatus("unavailable");
      else if (ffmpegStatus === "loading") setFfmpegStatus("idle");
    }
    throw error;
  }

  const transcoded = parsePcmWavBuffer(wavBuffer);
  if (!transcoded) {
    throw new Error(`无法解析 ffmpeg 输出的 WAV: ${file.name}`);
  }
  return transcoded;
}

export function createAudioBufferFromBufferLike(ctx, bufferLike) {
  const buffer = ctx.createBuffer(bufferLike.numberOfChannels, bufferLike.length, bufferLike.sampleRate);
  for (let channel = 0; channel < bufferLike.numberOfChannels; channel++) {
    buffer.copyToChannel(bufferLike.getChannelData(channel), channel);
  }
  return buffer;
}
