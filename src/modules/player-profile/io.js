import { loadAndNormalizeProfile } from "./normalizer.js";

export function parseProfileJson(text) {
  return JSON.parse(text);
}

export function serializeProfileJson(profile) {
  return JSON.stringify(profile, null, 2);
}

export function parseAndNormalizeProfileJson(text) {
  return loadAndNormalizeProfile(parseProfileJson(text));
}
