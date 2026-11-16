import { describe, expect, it } from "vitest";
import { computeRegistry } from "./blade-readiness";

describe("replacement endpoint evidence", () => {
  it("does not promote historical probe claims to current fleet readiness", () => {
    expect(computeRegistry().filter((row) => row.state === "READY")).toEqual([]);
    expect(computeRegistry().find((row) => row.blade.n === "13")?.node).toBeUndefined();
  });
});