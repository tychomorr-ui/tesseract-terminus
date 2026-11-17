import { isReference, verifyEnvelope } from "@/lib/signed-envelope";

export type ProofReview = {
  verdict: "MALFORMED" | "UNSUPPORTED_PROFILE" | "KEY_MISMATCH" | "UNVERIFIED" | "LOCAL_SIGNED_REMOTE_UNVERIFIED";
  detail: string;
};

/** Offline only. The envelope's outer node field is not signed by this profile. */
export function reviewProof(raw: string, expectedKey: string, at = Date.now()): ProofReview {
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return { verdict: "MALFORMED", detail: "Invalid JSON." }; }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { verdict: "MALFORMED", detail: "Expected a signed envelope object." };
  if (!isReference(body)) return { verdict: "UNSUPPORTED_PROFILE", detail: "Only the existing ARCHANGEL/v0 reference profile is supported. ATMOS source and signing rules are not supplied." };
  if (!/^[0-9a-f]{64}$/i.test(expectedKey.trim()))
    return { verdict: "UNVERIFIED", detail: "An independently obtained 32-byte public key is required; the envelope's embedded key is not authority." };
  if (typeof body.pub === "string" && body.pub.toLowerCase() !== expectedKey.trim().toLowerCase())
    return { verdict: "KEY_MISMATCH", detail: "Embedded signing key differs from the supplied comparison key." };
  const result = verifyEnvelope(body, expectedKey.trim(), at, "offline");
  if (result.state !== "measured") return { verdict: "UNVERIFIED", detail: result.detail };
  return { verdict: "LOCAL_SIGNED_REMOTE_UNVERIFIED", detail: "Signature, payload fingerprint and freshness checked against the supplied key. Endpoint identity, artifact authority and fleet health are not established; the outer node field is not signature-bound." };
}