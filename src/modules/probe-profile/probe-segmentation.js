export function extractStereoChannels(audioBuffer, targetSampleRate, resampleLinear) {
  const channels = Math.max(1, audioBuffer.numberOfChannels || 1);
  const leftIn = audioBuffer.getChannelData(0);
  const rightIn = audioBuffer.getChannelData(Math.min(1, channels - 1));
  const left = audioBuffer.sampleRate === targetSampleRate ? leftIn.slice() : resampleLinear(leftIn, audioBuffer.sampleRate, targetSampleRate);
  const right = audioBuffer.sampleRate === targetSampleRate ? rightIn.slice() : resampleLinear(rightIn, audioBuffer.sampleRate, targetSampleRate);
  return { left, right, sampleRate: targetSampleRate };
}

export function sliceProbeSegments(stereoSignal, manifest, syncOffsetSamples) {
  const { left, right } = stereoSignal;
  return manifest.segments.reduce((acc, segment) => {
    const relativeStart = segment.start - manifest.segments[0].start;
    const start = syncOffsetSamples + relativeStart;
    const end = start + segment.length;
    acc[segment.id] = {
      left: left.slice(start, end),
      right: right.slice(start, end),
      start,
      end,
      mode: segment.mode || "dual",
      kind: segment.kind,
    };
    return acc;
  }, {});
}
