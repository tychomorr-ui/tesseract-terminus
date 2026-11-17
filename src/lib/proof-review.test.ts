import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { canonical } from "./signed-envelope";
import { reviewProof } from "./proof-review";

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
  it("does not invent ATMOS verification", () => {
    expect(reviewProof(JSON.stringify({ schema: "NEXINUS_ATMOS_SIGNED_HEALTH/v1" }), pub).verdict).toBe("UNSUPPORTED_PROFILE");
  });
});