import { describe, it, expect } from "vitest";
import { NODES } from "@/data/nodes";
import { triadDeclarations } from "./quantotalus";

describe("triadDeclarations", () => {
  it("uses only the three canonical endpoint declarations", () => {
    expect(triadDeclarations().map(({ host }) => host)).toEqual([
      "tesseract.manus.space", "rootgate.manus.space", "truthtalk.xinus.one",
    ]);
  });
  it("does not infer a host when its declaration is absent", () => {
    expect(triadDeclarations(NODES.filter(({ id }) => id !== "root-gate"))[1].host).toBeNull();
  });
  it("does not choose between conflicting declarations", () => {
    const conflicting = NODES.map((node) => ({ ...node, host: "conflicting.invalid" }));
    expect(triadDeclarations([...NODES, ...conflicting]).every(({ host }) => host === null)).toBe(true);
  });
});
