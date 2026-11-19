import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonical } from "./signed-envelope";
import { reviewProof } from "./proof-review";
import fixture from "./fixtures/atmos-archangel.signed.json";
import { ATMOS_HEALTH, PROOF_MAX_LENGTH } from "./atmos-proof";
import { createPrivateKey, sign } from "node:crypto";

describe("offline review boundaries", () => {
  const seed = new Uint8Array(32).fill(7);
  const pub = bytesToHex(ed25519.getPublicKey(seed));
  function envelope() {
    const ts = Math.floor(Date.now() / 1000);
    const payload = { status: "ok" };
    const payload_cid = bytesToHex(sha256(utf8ToBytes(canonical(payload))));
    return { v: "ARCHANGEL/v0", node: "root-gate", ts, payload, payload_cid, pub,
      sig: bytesToHex(ed25519.sign(utf8ToBytes(`${payload_cid}|${ts}`), seed)) };
  }
  it("does not promote a valid local signature to fleet verification", () => {
    expect(reviewProof(JSON.stringify(envelope()), pub).verdict).toBe("LOCAL_SIGNED_REMOTE_UNVERIFIED");
  });
  it("does not establish endpoint identity through the unsigned node field", () => {
    expect(reviewProof(JSON.stringify({ ...envelope(), node: "impostor" }), pub).verdict).toBe("LOCAL_SIGNED_REMOTE_UNVERIFIED");
  });
  it("refuses embedded-key self authority", () => {
    expect(reviewProof(JSON.stringify(envelope()), "").verdict).toBe("UNVERIFIED");
  });
  it("rejects a different comparison key", () => {
    expect(reviewProof(JSON.stringify(envelope()), "ab".repeat(32)).verdict).toBe("KEY_MISMATCH");
  });
  it("rejects altered payload bytes", () => {
    expect(reviewProof(JSON.stringify({ ...envelope(), payload: { status: "down" } }), pub).verdict).toBe("UNVERIFIED");
  });
  it("rejects an unsupported ATMOS profile", () => {
    expect(reviewProof(JSON.stringify({ schema: "NEXINUS_ATMOS_SIGNED_HEALTH_OBSERVATION/v1" }), pub).verdict).toBe("UNSUPPORTED_PROFILE");
  });
});

describe("offline ATMOS wire comparison", () => {
  const fingerprint = "5a7d0be5747b2a61bbe4a5d95772ae50a469688e85d40028b501c893dea2013a";
  const review = (proof: object, expected = fingerprint, manifest = "") => reviewProof(JSON.stringify(proof), expected, Date.now(), manifest).verdict;
  const seed = new Uint8Array(32).fill(23);
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
  const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), ed25519.getPublicKey(seed)]);
  const localFingerprint = bytesToHex(sha256(der));
  const artifact = "cd".repeat(32);
  const wire = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
  const signed = (value: object) => sign(null, Buffer.from(wire(value)), key).toString("base64");
  const manifestPayload = {
    schema: fixture.schema, nodeId: "TEST",
    identity: { algorithm: "Ed25519", publicKeyPem: `-----BEGIN PUBLIC KEY-----\n${der.toString("base64")}\n-----END PUBLIC KEY-----\n`, identityHash: localFingerprint },
    hashes: { publicKeyFingerprintSha256: localFingerprint, artifactSha256: artifact },
  };
  const payloadHash = bytesToHex(sha256(utf8ToBytes(wire(manifestPayload))));
  const manifest = JSON.stringify({ ...manifestPayload, payloadHash, signature: signed(manifestPayload) });
  const health = { schema: ATMOS_HEALTH, nodeId: "TEST", status: "ok", manifestCid: `sha256:${payloadHash}`, codeHash: `sha256:${artifact}`, uptime: 10 };
  const reviewHealth = (payload: typeof health, signature = signed(payload), companion = manifest) =>
    review({ ...payload, serviceSignature: signature }, localFingerprint, companion);

  it("accepts the original upstream manifest only as local evidence", () => {
    expect(review(fixture)).toBe("LOCAL_SIGNED_REMOTE_UNVERIFIED");
  });
  it("does not accept a manifest’s embedded key as authority", () => {
    expect(review(fixture, "")).toBe("UNVERIFIED");
  });
  it("rejects a different comparison fingerprint", () => {
    expect(review(fixture, "ab".repeat(32))).toBe("KEY_MISMATCH");
  });
  it("rejects tampered manifest payloads", () => {
    expect(review({ ...fixture, displayName: "Different" })).toBe("UNVERIFIED");
  });
  it("rejects a rearranged manifest signature", () => {
    expect(review({ ...fixture, signature: `A${fixture.signature.slice(1)}` })).toBe("UNVERIFIED");
  });
  it("rejects input over the local limit", () => {
    expect(reviewProof(" ".repeat(PROOF_MAX_LENGTH + 1), fingerprint).verdict).toBe("MALFORMED");
  });
  it("correlates valid health and manifest signatures without verifying a fleet", () => {
    expect(reviewHealth(health)).toBe("LOCAL_SIGNED_REMOTE_UNVERIFIED");
  });
  it("requires the companion signed manifest", () => {
    expect(reviewHealth(health, signed(health), "")).toBe("UNVERIFIED");
  });
  it("rejects valid signatures for a different manifest hash", () => {
    expect(reviewHealth({ ...health, manifestCid: `sha256:${"ab".repeat(32)}` })).toBe("UNVERIFIED");
  });
  it("rejects valid signatures for a different artifact hash", () => {
    expect(reviewHealth({ ...health, codeHash: `sha256:${"ab".repeat(32)}` })).toBe("UNVERIFIED");
  });
  it("rejects a signed node identifier that disagrees with the companion", () => {
    expect(reviewHealth({ ...health, nodeId: "OTHER" })).toBe("UNVERIFIED");
  });
  it("rejects a changed health payload even if its binding fields still match", () => {
    expect(reviewHealth({ ...health, uptime: 11 }, signed(health))).toBe("UNVERIFIED");
  });
});