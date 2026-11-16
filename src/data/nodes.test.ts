import { describe, expect, it } from "vitest";
import { NODES } from "./nodes";

describe("canonical sovereign endpoints", () => {
  it("contains only the three operator-declared endpoints", () => {
    expect(NODES.map((n) => n.host)).toEqual([
      "rootgate.manus.space", "tesseract.manus.space", "truthtalk.xinus.one",
    ]);
    expect(NODES.every((n) => n.tier === "doctrine" && !n.ipv6 && !n.spec)).toBe(true);
    expect(NODES.map((n) => n.probe)).toEqual(NODES.map((n) => ({
      kind: "no-cors-head", url: `https://${n.host}/`,
    })));
  });
});