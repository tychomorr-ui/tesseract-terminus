import { describe, expect, it } from "vitest";
import { classifyPhase, OBSERVATION_PROFILE, projectAmbient, readAmbientObservation } from "./cryptochrometer";

const now = Date.parse("2026-11-21T01:29:00Z");
const observation = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  schema: OBSERVATION_PROFILE, source: "offline-test-input", observedAt: new Date(now).toISOString(),
  boundary: "WG_SNAPSHOT_PROTOCOL_60S", peers: [
    { id: "a", pinned: true, handshakeAgeSeconds: 0 },
    { id: "b", pinned: true, handshakeAgeSeconds: null },
    { id: "unbound", pinned: false, handshakeAgeSeconds: 0 },
  ], ...overrides,
});
describe("Cryptochrometer offline phase evidence", () => {
  it("classifies DAY at exactly one half", () => { expect(classifyPhase(2, 4)).toBe("DAY"); });
  it("classifies TWILIGHT at exactly one quarter", () => { expect(classifyPhase(1, 4)).toBe("TWILIGHT"); });
  it("classifies NIGHT below one quarter and without pins", () => { expect(classifyPhase(1, 5)).toBe("NIGHT"); expect(classifyPhase(0, 0)).toBe("NIGHT"); });
  it("rejects impossible counts", () => { expect(() => classifyPhase(2, 1)).toThrow(); expect(() => classifyPhase(-1, 2)).toThrow(); expect(() => classifyPhase(0.5, 2)).toThrow(); });
  it("counts only pinned peers and remains unsigned", () => { expect(readAmbientObservation(observation(), now)).toMatchObject({ ratio: 0.5, pinned: 2, reachable: 1, phase: "DAY", status: "AVAILABLE_UNSIGNED" }); });
  it("accepts snapshot age 30 seconds and rejects beyond it", () => { expect(readAmbientObservation(observation(), now + 30_000).ratio).toBe(0.5); expect(readAmbientObservation(observation(), now + 30_001).status).toBe("STALE"); });
  it("ages handshake evidence through the inclusive 60-second limit", () => {
    const raw = observation({ peers: [{ id: "a", pinned: true, handshakeAgeSeconds: 60 }] });
    expect(readAmbientObservation(raw, now).ratio).toBe(1);
    expect(readAmbientObservation(raw, now + 1).ratio).toBe(0);
  });
  it("rejects negative handshake age and duplicate peers", () => {
    expect(readAmbientObservation(observation({ peers: [{ id: "a", pinned: true, handshakeAgeSeconds: -1 }] }), now).status).toBe("MALFORMED");
    const peer = { id: "a", pinned: true, handshakeAgeSeconds: 0 };
    expect(readAmbientObservation(observation({ peers: [peer, peer] }), now).status).toBe("MALFORMED");
  });
  it("never substitutes a held phase for the measured ratio", () => { expect(readAmbientObservation(observation({ phase: "NIGHT" }), now)).toMatchObject({ ratio: 0.5, phase: "DAY", heldPhase: "NIGHT" }); });
  it("rejects conflicting summary counts", () => { expect(readAmbientObservation(observation({ protocolReachable: 2 }), now).status).toBe("MALFORMED"); });
  it("returns unavailable for missing/unreadable/stale snapshot boundaries", () => {
    for (const boundary of ["NO_PEER_SNAPSHOT", "SNAPSHOT_UNREADABLE", "SNAPSHOT_STALE"]) expect(readAmbientObservation(observation({ boundary }), now).ratio).toBeNull();
    expect(readAmbientObservation("", now).ratio).toBeNull();
  });
  it("rejects unsupported, malformed, and future observations", () => {
    expect(readAmbientObservation("{", now).status).toBe("MALFORMED");
    expect(readAmbientObservation(observation({ schema: "v9" }), now).status).toBe("UNSUPPORTED_PROFILE");
    expect(readAmbientObservation(observation(), now - 1).status).toBe("MALFORMED");
  });
  it("projects the actual ambient ratio into EARTH without changing the six local axes", () => {
    const local = { ore: 0.2, sudo: 0.3, chain: 0.4, earth: 0, pam: 0.5, kether: 1, axis: 0.4 };
    expect(projectAmbient(local, readAmbientObservation(observation(), now)).components).toEqual({ ...local, earth: 0.5 });
    expect(projectAmbient(local, readAmbientObservation(observation(), now + 30_001)).components.earth).toBe(0);
  });
});