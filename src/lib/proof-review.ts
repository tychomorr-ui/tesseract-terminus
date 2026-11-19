import { isReference, verifyEnvelope } from "@/lib/signed-envelope";
import { ATMOS_HEALTH, ATMOS_MANIFEST, isProofObject, PROOF_MAX_LENGTH, reviewAtmos } from "@/lib/atmos-proof";

export type ProofReview = {
  verdict: "MALFORMED" | "UNSUPPORTED_PROFILE" | "KEY_MISMATCH" | "UNVERIFIED" | "LOCAL_SIGNED_REMOTE_UNVERIFIED";
  detail: string;
};

/** Offline only. The envelope's outer node field is not signed by this profile. */
export function reviewProof(raw: string, expectedKey: string, at = Date.now(), manifestRaw = ""): ProofReview {
  if (raw.length > PROOF_MAX_LENGTH) return { verdict: "MALFORMED", detail: "Envelope exceeds the local review limit." };
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return { verdict: "MALFORMED", detail: "Invalid JSON." }; }
  if (!isProofObject(body))
    return { verdict: "MALFORMED", detail: "Expected a signed envelope object." };
  if (body.schema === ATMOS_MANIFEST || body.schema === ATMOS_HEALTH) return reviewAtmos(body, expectedKey, manifestRaw);
  if (!isReference(body)) return { verdict: "UNSUPPORTED_PROFILE", detail: "Supported profiles: ARCHANGEL/v0 reference, ATMOS signed node manifest v1, and ATMOS signed health v1." };
  if (!/^[0-9a-f]{64}$/i.test(expectedKey.trim()))
    return { verdict: "UNVERIFIED", detail: "An independently obtained 32-byte public key is required; the envelope's embedded key is not authority." };
  if (typeof body.pub === "string" && body.pub.toLowerCase() !== expectedKey.trim().toLowerCase())
    return { verdict: "KEY_MISMATCH", detail: "Embedded signing key differs from the supplied comparison key." };
  const result = verifyEnvelope(body, expectedKey.trim(), at, "offline");
  if (result.state !== "measured") return { verdict: "UNVERIFIED", detail: "detail" in result ? result.detail : "Signature check did not complete." };
  return { verdict: "LOCAL_SIGNED_REMOTE_UNVERIFIED", detail: "Signature, payload fingerprint and freshness checked against the supplied key. Endpoint identity, artifact authority and fleet health are not established; the outer node field is not signature-bound." };
}