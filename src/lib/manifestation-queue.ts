import type { Envelope } from "@/data/truth-ledger";

/** Recorded intentions only: no execution or completion status is inferred. */
export function recordedNextMoves(envelopes: Envelope[]) {
  return envelopes.filter((entry) => typeof entry?.next_move === "string" &&
    entry.next_move.trim() && Number.isFinite(entry.ts) && typeof entry.cid === "string")
    .slice(-5).reverse();
}