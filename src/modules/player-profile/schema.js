import { PROFILE_TYPE, PROFILE_VERSION } from "./constants.js";

export const CANONICAL_PROFILE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "side.player-listening-profile.schema.json",
  title: "Canonical Player Listening Profile",
  type: "object",
  required: [
    "type",
    "version",
    "name",
    "createdAt",
    "sourceType",
    "generator",
    "frequencyGridHz",
    "responseDb",
    "confidence",
    "usableMask",
    "anchor",
    "sourceMeta",
  ],
  properties: {
    type: { const: PROFILE_TYPE },
    version: { const: PROFILE_VERSION },
  },
};

export const EQ_MODEL_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "side.eq-model.schema.json",
  title: "EQ Execution Model",
  type: "object",
  required: ["kind", "bands", "preferredSolveMode"],
};
