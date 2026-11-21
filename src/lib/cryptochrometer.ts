import { buildVector, type AxisKey } from "@/lib/mmr-vectors";

// Independent adaptation of the recovered phase/freshness rules, not a copy
// of the unavailable witness server or a signed-observation verifier.
export const OBSERVATION_PROFILE = "NEXINUS_CRYPTOCHROMETER_OBSERVATION/v1";
export const OBSERVATION_LIMIT = 1_000_000;
export type AmbientPhase = "DAY" | "TWILIGHT" | "NIGHT";
export type PeerObservation = { id: string; pinned: boolean; handshakeAgeSeconds: number | null };
export type AmbientObservation = {
  schema: typeof OBSERVATION_PROFILE;
  observedAt: string;
  source: string;
  boundary: "WG_SNAPSHOT_PROTOCOL_60S";
  peers: PeerObservation[];
  phase?: AmbientPhase;
};
export type AmbientReading = {
  status: "AVAILABLE_UNSIGNED" | "MALFORMED" | "UNSUPPORTED_PROFILE" | "UNAVAILABLE" | "STALE";
  detail: string;
  ratio: number | null;
  phase: AmbientPhase | null;
  heldPhase: AmbientPhase | null;
  pinned: number;
  reachable: number;
};

export function classifyPhase(reachable: number, pinned: number): AmbientPhase {
  if (!Number.isSafeInteger(reachable) || !Number.isSafeInteger(pinned) || reachable < 0 || pinned < 0 || reachable > pinned)
    throw new Error("Invalid pinned/protocol-reachable counts.");
  if (pinned === 0 || reachable / pinned < 0.25) return "NIGHT";
  return reachable / pinned >= 0.5 ? "DAY" : "TWILIGHT";
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Only peer evidence supplies the denominator/numerator; claimed phase is
 * displayed separately and never used as a measurement or fleet authority. */
export function readAmbientObservation(raw: string, now: number): AmbientReading {
  const fail = (status: AmbientReading["status"], detail: string): AmbientReading =>
    ({ status, detail, ratio: null, phase: null, heldPhase: null, pinned: 0, reachable: 0 });
  if (!raw.trim()) return fail("UNAVAILABLE", "No Quantus observation imported.");
  if (raw.length > OBSERVATION_LIMIT) return fail("MALFORMED", "Observation exceeds the 1 MB local limit.");
  let input: unknown;
  try { input = JSON.parse(raw); } catch { return fail("MALFORMED", "Observation is not valid JSON."); }
  if (!record(input)) return fail("MALFORMED", "Observation must be an object.");
  if (input["schema"] !== OBSERVATION_PROFILE) return fail("UNSUPPORTED_PROFILE", "Unsupported observation profile.");
  if (input["boundary"] !== "WG_SNAPSHOT_PROTOCOL_60S")
    return fail("UNAVAILABLE", "No usable protocol snapshot: " + String(input["boundary"] ?? "boundary absent"));
  if (typeof input["source"] !== "string" || !input["source"].trim() || typeof input["observedAt"] !== "string")
    return fail("MALFORMED", "Source and UTC observation time are required.");
  const timeText = input["observedAt"];
  const timestamp = Date.parse(timeText);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(timeText) || !Number.isFinite(timestamp) || !Number.isFinite(now) || timestamp > now)
    return fail("MALFORMED", "Invalid or future observation time.");
  if (now - timestamp > 30_000) return fail("STALE", "Observation exceeds the 30-second snapshot window.");
  const peers = input["peers"];
  if (!Array.isArray(peers) || peers.length > 10_000) return fail("MALFORMED", "Peer evidence is required.");
  const seen = new Set<string>();
  let pinned = 0, reachable = 0;
  for (const peer of peers) {
    if (!record(peer) || typeof peer["id"] !== "string" || !peer["id"].trim() || seen.has(peer["id"]) || typeof peer["pinned"] !== "boolean")
      return fail("MALFORMED", "Invalid or duplicate peer identity.");
    seen.add(peer["id"]);
    const age = peer["handshakeAgeSeconds"];
    if (age !== null && (typeof age !== "number" || !Number.isFinite(age) || age < 0))
      return fail("MALFORMED", "Handshake age must be a nonnegative number or null.");
    if (peer["pinned"]) {
      pinned++;
      // Imported ages continue to age; reimporting old JSON cannot revive them.
      if (typeof age === "number" && age + (now - timestamp) / 1000 <= 60) reachable++;
    }
  }
  const claimed = input["phase"];
  if (claimed !== undefined && claimed !== "DAY" && claimed !== "TWILIGHT" && claimed !== "NIGHT")
    return fail("MALFORMED", "Invalid held phase.");
  // If counts are provided, they must agree at the original observation time.
  const originalReachable = peers.filter((peer: Record<string, unknown>) => peer["pinned"] === true && typeof peer["handshakeAgeSeconds"] === "number" && peer["handshakeAgeSeconds"] <= 60).length;
  if ((input["pinned"] !== undefined && input["pinned"] !== pinned) || (input["protocolReachable"] !== undefined && input["protocolReachable"] !== originalReachable))
    return fail("MALFORMED", "Declared counts conflict with peer evidence.");
  return { status: "AVAILABLE_UNSIGNED", detail: "Imported Quantus observation · unsigned · fleet authority unverified.",
    ratio: pinned ? reachable / pinned : 0, phase: classifyPhase(reachable, pinned), heldPhase: claimed ?? null, pinned, reachable };
}

/** The ambient instrument contributes only to EARTH, not to local ledger,
 * key custody, Ore scores, or the other six independently sourced axes. */
export function projectAmbient(raw: Record<AxisKey, number>, reading: AmbientReading) {
  return buildVector({ ...raw, earth: reading.ratio ?? 0 });
}