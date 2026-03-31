import { mergeUsableMasks } from "../player-profile/usable-mask.js";
import { toLinkedStereoCurve } from "../player-profile/stereo-policy.js";

export function buildDeltaAToB(profileA, profileB) {
  const linkedA = toLinkedStereoCurve(profileA.responseDb, profileA.confidence, profileA.usableMask);
  const linkedB = toLinkedStereoCurve(profileB.responseDb, profileB.confidence, profileB.usableMask);
  const usableMask = mergeUsableMasks(linkedA.usableMask, linkedB.usableMask);
  const confidence = linkedA.confidence.map((value, index) => (value * (linkedB.confidence[index] ?? 0)));
  const deltaDb = linkedA.curveDb.map((value, index) => (linkedB.curveDb[index] ?? 0) - value);
  return {
    frequencyGridHz: [...profileA.frequencyGridHz],
    deltaDb,
    confidence,
    usableMask,
  };
}
