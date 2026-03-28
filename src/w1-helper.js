import aesjs from "aes-js";

const W1_MAGIC_HEADER = "CTENFDAM";
const W1_CORE_KEY_HEX = "687A4852416D736F356B496E62617857";
const W1_META_KEY_HEX = "2331346C6A6B5F215C5D2630553C2728";
const AES_BLOCK_SIZE = 16;

const textDecoder = new TextDecoder();

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function xorBytes(bytes, mask) {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ mask;
  return out;
}

function bytesToUtf8(bytes) {
  return textDecoder.decode(bytes);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function decryptAesEcb(cipherBytes, keyBytes) {
  if (cipherBytes.length % AES_BLOCK_SIZE !== 0) {
    throw new Error("Invalid AES-ECB payload length");
  }

  const ecb = new aesjs.ModeOfOperation.ecb(keyBytes);
  const plain = ecb.decrypt(cipherBytes);
  return aesjs.padding.pkcs7.strip(plain);
}

function buildW1KeyBox(keyData) {
  const box = new Uint8Array(256);
  for (let i = 0; i < 256; i++) box[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (box[i] + j + keyData[i % keyData.length]) & 0xff;
    [box[i], box[j]] = [box[j], box[i]];
  }

  const keyBox = new Uint8Array(256);
  for (let idx = 0; idx < 256; idx++) {
    const i = (idx + 1) & 0xff;
    const si = box[i];
    const sj = box[(i + si) & 0xff];
    keyBox[idx] = box[(si + sj) & 0xff];
  }
  return keyBox;
}

function decryptW1Audio(audioBytes, keyBox) {
  const out = new Uint8Array(audioBytes.length);
  for (let i = 0; i < audioBytes.length; i++) out[i] = audioBytes[i] ^ keyBox[i & 0xff];
  return out;
}

function inferAudioExt(audioBytes, fallbackExt = "") {
  const ext = fallbackExt.replace(/^\./, "").toLowerCase();
  if (audioBytes.length >= 4) {
    const a = audioBytes[0];
    const b = audioBytes[1];
    const c = audioBytes[2];
    const d = audioBytes[3];
    if (a === 0x66 && b === 0x4c && c === 0x61 && d === 0x43) return "flac";
    if (a === 0x49 && b === 0x44 && c === 0x33) return "mp3";
    if (a === 0x4f && b === 0x67 && c === 0x67 && d === 0x53) return "ogg";
    if (a === 0x52 && b === 0x49 && c === 0x46 && d === 0x46) return "wav";
    if (a === 0xff && (b & 0xe0) === 0xe0) return "mp3";
  }
  if (audioBytes.length >= 12) {
    const boxType = bytesToUtf8(audioBytes.slice(4, 8));
    if (boxType === "ftyp") {
      const brand = bytesToUtf8(audioBytes.slice(8, 12)).trim().toLowerCase();
      if (brand.includes("m4a") || brand.includes("mp4")) return "m4a";
    }
  }
  return ext || "mp3";
}

function getMimeType(ext) {
  switch (ext) {
    case "flac": return "audio/flac";
    case "wav": return "audio/wav";
    case "ogg": return "audio/ogg";
    case "aac": return "audio/aac";
    case "m4a": return "audio/mp4";
    case "mp3":
    default:
      return "audio/mpeg";
  }
}

function safeParseW1Meta(jsonText) {
  try {
    const labelIndex = jsonText.indexOf(":");
    if (labelIndex < 0) return null;
    const label = jsonText.slice(0, labelIndex);
    const payload = JSON.parse(jsonText.slice(labelIndex + 1));
    return label === "dj" ? payload?.mainMusic || null : payload;
  } catch {
    return null;
  }
}

export function isW1File(filename) {
  return /\.ncm$/i.test(filename || "");
}

export async function extractW1Audio(file) {
  const raw = await file.arrayBuffer();
  const view = new DataView(raw);
  const header = bytesToUtf8(new Uint8Array(raw, 0, Math.min(8, raw.byteLength)));

  if (header !== W1_MAGIC_HEADER) {
    throw new Error("Invalid W1 header");
  }

  const coreKey = hexToBytes(W1_CORE_KEY_HEX);
  const metaKey = hexToBytes(W1_META_KEY_HEX);

  let offset = 10;
  const keyLen = view.getUint32(offset, true);
  offset += 4;

  const keyCipher = xorBytes(new Uint8Array(raw, offset, keyLen), 0x64);
  offset += keyLen;

  const keyPlain = decryptAesEcb(keyCipher, coreKey);
  const keyData = keyPlain.slice(17);
  if (!keyData.length) throw new Error("Invalid W1 audio key");

  const keyBox = buildW1KeyBox(keyData);

  const metaLen = view.getUint32(offset, true);
  offset += 4;

  let meta = null;
  if (metaLen > 0) {
    const metaCipher = xorBytes(new Uint8Array(raw, offset, metaLen), 0x63);
    offset += metaLen;

    const metaBase64 = bytesToUtf8(metaCipher.slice(22));
    const metaPlain = decryptAesEcb(base64ToBytes(metaBase64), metaKey);
    meta = safeParseW1Meta(bytesToUtf8(metaPlain));
  }

  const coverFrameLength = view.getUint32(offset + 5, true);
  offset += 13 + coverFrameLength;

  const decryptedAudio = decryptW1Audio(new Uint8Array(raw, offset), keyBox);
  const ext = inferAudioExt(decryptedAudio, meta?.format || "");
  const baseName = file.name.replace(/\.ncm$/i, "");
  const finalName = `${baseName}.${ext}`;
  const audioBuffer = decryptedAudio.buffer.slice(
    decryptedAudio.byteOffset,
    decryptedAudio.byteOffset + decryptedAudio.byteLength
  );

  return {
    meta,
    ext,
    audioBuffer,
    file: new File([audioBuffer], finalName, { type: getMimeType(ext) }),
  };
}
