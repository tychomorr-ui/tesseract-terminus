import { describe, expect, it } from "vitest";
import type { Envelope } from "@/data/truth-ledger";
import { recordedNextMoves } from "./manifestation-queue";

describe("recorded PAM next moves", () => {
  it("does not invent a queue on an empty device", () => {
    expect(recordedNextMoves([])).toEqual([]);
  });
  it("keeps the latest five recorded moves without changing their evidence", () => {
    const entries: Envelope[] = Array.from({ length: 7 }, (_, i) => ({
      v: "pam.envelope/v0", ts: i, lane: "Core", request: `request ${i}`,
      reflection: "recorded reflection", truths: [], next_move: `move ${i}`,
      drift: null, cid: `cid-${i}`, prev_cid: null,
    }));
    expect(recordedNextMoves(entries).map((e) => e.next_move)).toEqual([
      "move 6", "move 5", "move 4", "move 3", "move 2",
    ]);
    expect(recordedNextMoves(entries)[0]).toBe(entries[6]);
  });
});