import {
  compileEqAToB, compileEqAToFlat, compileEqAToTarget,
  computeFullResolutionDelta, computeFullResolutionFlat, computeFullResolutionTarget,
} from "../modules/eq-compiler/compile-a-to-b.js";

self.onmessage = (event) => {
  const { command, profileA, profileB, targetCurve } = event.data;
  try {
    let result;
    switch (command) {
      case "compileAtoB":       result = compileEqAToB(profileA, profileB); break;
      case "compileFlat":       result = compileEqAToFlat(profileA); break;
      case "compileTarget":     result = compileEqAToTarget(profileA, targetCurve); break;
      case "compileFullRes":    result = computeFullResolutionDelta(profileA, profileB); break;
      case "compileFullResFlat": result = computeFullResolutionFlat(profileA); break;
      case "compileFullResTarget": result = computeFullResolutionTarget(profileA, targetCurve); break;
      default: throw new Error("Unknown command: " + command);
    }
    self.postMessage({ ok: true, result });
  } catch (err) {
    self.postMessage({ ok: false, error: err.message || String(err) });
  }
};
