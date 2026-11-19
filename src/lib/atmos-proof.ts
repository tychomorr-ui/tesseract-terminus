import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

// ATMOS wire rules adapted from atmos-canonical.mjs and healthMatches in
// https://github.com/tychomorr-ui/atmos-verifier/tree/b0b28145c2cefb64c8b14136fbe4d56c0a268c1a
// Copyright (c) 2026 Tyler Morris (MIT; see LICENSE).
export const ATMOS_MANIFEST = "NEXINUS_ATMOS_SIGNED_NODE_MANIFEST/v1";
export const ATMOS_HEALTH = "NEXINUS_ATMOS_SIGNED_HEALTH/v1";
export const PROOF_MAX_LENGTH = 1_000_000;

type JsonObject = Record<string, unknown>;
export type AtmosReview = {
  verdict: "MALFORMED" | "UNVERIFIED" | "KEY_MISMATCH" | "LOCAL_SIGNED_REMOTE_UNVERIFIED";
  detail: string;
};

export function isProofObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const HEX = /^[a-f0-9]{64}$/;
const ED25519_SPKI = "302a300506032b6570032100";
const digest = (bytes: Uint8Array) => bytesToHex(sha256(bytes));

function sorted(value: unknown, depth = 0): unknown {
  if (depth > 64 || (typeof value === "number" && !Number.isFinite(value))) throw new Error();
  if (Array.isArray(value)) return value.map((item) => sorted(item, depth + 1));
  if (isProofObject(value)) {
    // Match the reference's localeCompare on its default en-US runtime,
    // independently of the reviewer’s browser locale.
    return Object.fromEntries(Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b, "en-US"))
      .map(([key, item]) => [key, sorted(item, depth + 1)]));
  }
  return value;
}

const wireBytes = (payload: JsonObject) => utf8ToBytes(JSON.stringify(sorted(payload)));

function base64(value: unknown, length: number): Uint8Array {
  if (typeof value !== "string" || value.length !== 4 * Math.ceil(length / 3) || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error();
  const raw = atob(value);
  if (raw.length !== length || btoa(raw) !== value) throw new Error();
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function manifestKey(identity: JsonObject): Uint8Array {
  if (identity.algorithm !== "Ed25519" || typeof identity.publicKeyPem !== "string") throw new Error();
  const pem = /^-----BEGIN PUBLIC KEY-----\r?\n([A-Za-z0-9+/=\r\n]+)\r?\n-----END PUBLIC KEY-----$/.exec(identity.publicKeyPem.trim());
  if (!pem?.[1]) throw new Error();
  const der = base64(pem[1].replace(/[\r\n]/g, ""), 44);
  if (!bytesToHex(der).startsWith(ED25519_SPKI)) throw new Error();
  return der;
}

export function reviewAtmos(body: JsonObject, comparison: string, manifestRaw: string): AtmosReview {
  const health = body.schema === ATMOS_HEALTH;
  const malformed = (detail: string): AtmosReview => ({ verdict: "MALFORMED", detail });
  const unverified = (detail: string): AtmosReview => ({ verdict: "UNVERIFIED", detail });
  let manifest: unknown = body;
  if (health) {
    if (!manifestRaw.trim()) return unverified("Signed health requires its companion ATMOS signed manifest.");
    if (manifestRaw.length > PROOF_MAX_LENGTH) return malformed("Companion manifest exceeds the local review limit.");
    try { manifest = JSON.parse(manifestRaw); } catch { return malformed("Invalid companion manifest JSON."); }
  }
  if (!isProofObject(manifest) || manifest.schema !== ATMOS_MANIFEST || !isProofObject(manifest.identity) || !isProofObject(manifest.hashes))
    return malformed("Expected an ATMOS signed node manifest with identity and hashes.");
  const { signature, payloadHash, ...payload } = manifest;
  if (typeof payloadHash !== "string" || !HEX.test(payloadHash)) return malformed("Invalid ATMOS manifest payload hash.");

  const expected = comparison.trim().toLowerCase();
  if (!HEX.test(expected)) return unverified("An independently obtained SHA-256 SPKI fingerprint is required; the manifest’s own key is not authority.");

  try {
    const der = manifestKey(manifest.identity);
    const fingerprint = digest(der);
    const key = der.subarray(12);
    if (fingerprint !== expected) return { verdict: "KEY_MISMATCH", detail: "Manifest key differs from the supplied comparison fingerprint." };
    if (manifest.identity.identityHash !== fingerprint || manifest.hashes.publicKeyFingerprintSha256 !== fingerprint)
      return unverified("Manifest identity hashes do not match the signing key.");
    const bytes = wireBytes(payload);
    if (digest(bytes) !== payloadHash) return unverified("ATMOS manifest payload hash does not match.");
    if (!ed25519.verify(base64(signature, 64), bytes, key, { zip215: false })) return unverified("ATMOS manifest signature is invalid.");

    if (health) {
      if (body.status !== "ok" || body.manifestCid !== `sha256:${payloadHash}`)
        return unverified("Signed health does not report ok against the supplied manifest hash.");
      if (Object.hasOwn(body, "nodeId") && body.nodeId !== manifest.nodeId)
        return unverified("Signed health names a different node than the manifest.");
      const artifact = manifest.hashes.artifactSha256;
      if (typeof artifact !== "string" || !HEX.test(artifact) || body.codeHash !== `sha256:${artifact}`)
        return unverified("Signed health does not match the artifact hash claimed in the manifest.");
      const { serviceSignature, ...healthPayload } = body;
      if (!ed25519.verify(base64(serviceSignature, 64), wireBytes(healthPayload), key, { zip215: false }))
        return unverified("ATMOS health signature is invalid.");
    }
  } catch {
    return unverified("Malformed ATMOS key, signature, or signed payload.");
  }

  return { verdict: "LOCAL_SIGNED_REMOTE_UNVERIFIED", detail: health
    ? "Both signatures match the comparison fingerprint; signed health matches the manifest and its claimed artifact hash. Freshness, endpoint identity, artifact authority, and fleet health are not established."
    : "Manifest signature and payload hash match the comparison fingerprint. Endpoint identity, artifact authority, and fleet health are not established." };
}