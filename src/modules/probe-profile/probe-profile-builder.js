import { resampleLinear } from "../../deck-calibration.js";
import { createDefaultAnchor, normalizeStereoResponseByAnchor } from "../player-profile/anchor.js";
import { PROFILE_TYPE, PROFILE_VERSION, WORKBENCH_ERROR } from "../player-profile/constants.js";
import { buildUsableMaskFromConfidence } from "../player-profile/usable-mask.js";
import { validateCanonicalProfile } from "../player-profile/validator.js";
import { generateProbeSequence } from "./probe-spec.js";
import { sliceProbeSegments, extractStereoChannels } from "./probe-segmentation.js";
import { findProbeSync } from "./probe-sync.js";
import { estimateProbeTransfer } from "./probe-transfer.js";

export function buildProbeProfile(referenceProbe, recordedProbe, manifest, options = {}) {
  const generated = generateProbeSequence(manifest);
  const stereoRecorded = extractStereoChannels(recordedProbe, generated.manifest.sampleRate, resampleLinear);
  const syncInfo = findProbeSync(stereoRecorded.left, generated.sync);
  const segments = sliceProbeSegments(stereoRecorded, generated.manifest, syncInfo.offsetSamples);
  if (!segments["l-only-ess"] || !segments["r-only-ess"]) {
    const error = new Error("Probe ESS segments are missing");
    error.code = WORKBENCH_ERROR.PROBE_SEGMENT_MISSING;
    throw error;
  }
  const transfer = estimateProbeTransfer(generated.referenceSweep, segments, generated.manifest);
  const anchor = createDefaultAnchor();
  const responseDb = normalizeStereoResponseByAnchor(transfer.frequencyGridHz, transfer.responseDb, anchor);
  const profile = {
    type: PROFILE_TYPE,
    version: PROFILE_VERSION,
    name: options.name || "Probe Profile",
    createdAt: new Date().toISOString(),
    sourceType: "probe",
    generator: "SIDE",
    frequencyGridHz: transfer.frequencyGridHz,
    responseDb,
    confidence: transfer.confidence,
    usableMask: {
      L: buildUsableMaskFromConfidence(transfer.confidence.L),
      R: buildUsableMaskFromConfidence(transfer.confidence.R),
    },
    anchor,
    sourceMeta: {
      kind: generated.manifest.kind,
      sampleRate: generated.manifest.sampleRate,
      segments: generated.manifest.segments.map((segment) => segment.id),
      syncScore: syncInfo.score,
    },
    eqModel: null,
    validation: {},
  };
  return validateCanonicalProfile(profile);
}
