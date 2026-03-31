import { FIT_SCORE_PASS, FIT_SCORE_WARN } from "../player-profile/constants.js";

export function computeWeightedRmse(target, predicted, weights, mask) {
  let sum = 0;
  let weightSum = 0;
  for (let i = 0; i < target.length; i++) {
    if (!mask[i]) continue;
    const weight = Math.max(0, weights[i] ?? 0);
    const error = (predicted[i] ?? 0) - (target[i] ?? 0);
    sum += (error * error) * weight;
    weightSum += weight;
  }
  return weightSum > 0 ? Math.sqrt(sum / weightSum) : Infinity;
}

export function computeFitScore(target, predicted, weights, mask) {
  const rmse = computeWeightedRmse(target, predicted, weights, mask);
  if (!Number.isFinite(rmse)) return 0;
  return Math.max(0, Math.min(1, 1 - (rmse / 6)));
}

export function fitScoreStatus(score) {
  if (score >= FIT_SCORE_PASS) return "pass";
  if (score >= FIT_SCORE_WARN) return "warn";
  return "fail";
}
