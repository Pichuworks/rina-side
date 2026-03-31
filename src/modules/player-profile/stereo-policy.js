import { weightedAverage } from "./response-curve.js";

export function toLinkedStereoCurve(responseDb, confidence, usableMask) {
  const length = Math.min(
    responseDb?.L?.length || 0,
    responseDb?.R?.length || 0,
    confidence?.L?.length || 0,
    confidence?.R?.length || 0,
  );
  const curve = new Array(length).fill(0);
  const weights = new Array(length).fill(0);
  const mask = new Array(length).fill(false);
  for (let i = 0; i < length; i++) {
    const leftEnabled = usableMask?.L?.[i] !== false;
    const rightEnabled = usableMask?.R?.[i] !== false;
    const leftWeight = leftEnabled ? (confidence.L[i] ?? 0) : 0;
    const rightWeight = rightEnabled ? (confidence.R[i] ?? 0) : 0;
    curve[i] = weightedAverage([responseDb.L[i] ?? 0, responseDb.R[i] ?? 0], [leftWeight, rightWeight]);
    weights[i] = weightedAverage([leftWeight, rightWeight], [1, 1]);
    mask[i] = leftEnabled || rightEnabled;
  }
  return { curveDb: curve, confidence: weights, usableMask: mask };
}
