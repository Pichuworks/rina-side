import { CONFIDENCE_MIN_USABLE } from "./constants.js";

export function buildUsableMaskFromConfidence(confidence, minConfidence = CONFIDENCE_MIN_USABLE) {
  return confidence.map((value) => Number.isFinite(value) && value >= minConfidence);
}

export function mergeUsableMasks(...masks) {
  if (!masks.length) return [];
  const length = masks[0].length;
  return Array.from({ length }, (_, index) => masks.every((mask) => Boolean(mask[index])));
}
