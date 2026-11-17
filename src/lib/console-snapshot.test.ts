import { describe, expect, it } from "vitest";
import { buildConsoleSnapshot, type SnapshotRecords } from "./console-snapshot";
import { valueToCid } from "./cid";
import { buildClaim } from "./ore";

const empty: SnapshotRecords = { pam: null, ore: null, substrate: null, chain: null };
describe("local snapshot export", () => {
  it("preserves malformed PAM bytes and reports the fault without restamping", async () => {
    const result = await buildConsoleSnapshot({ ...empty, pam: "{broken history" });
    expect(result.manifest.records.pam).toBe("{broken history");
    expect(result.manifest.checks.pam.breakAt).toBe(0);
    expect(result.manifest.checks.pam.headCid).toBe(null);
  });
  it("rejects altered Ore grade from exported loads", async () => {
    const claim = buildClaim("Distinct intellectual byproduct with original recorded evidence", "directive", []);
    if (!claim) throw new Error("fixture did not refine");
    const result = await buildConsoleSnapshot({ ...empty, ore: JSON.stringify([{ ...claim, grade: claim.grade + 1 }]) });
    expect(result.manifest.checks.ore.loads?.motherLoad).toBe(0);
    expect(result.manifest.checks.ore.loads?.excluded).toBe(1);
  });
  it("reports short substrate stamps without laundering the records", async () => {
    const raw = JSON.stringify([{ fingerprint: "abcd", block: { hash: "ab".repeat(32) }, mempool: {} }]);
    const result = await buildConsoleSnapshot({ ...empty, substrate: raw });
    expect(result.manifest.checks.substrate.rejected).toBe(1);
    expect(result.manifest.records.substrate).toBe(raw);
  });
  it("produces a recomputable unsigned snapshot using only canonical endpoint declarations", async () => {
    const result = await buildConsoleSnapshot(empty);
    expect(result.cid).toBe(await valueToCid(result.manifest));
    expect(result.manifest.boundary).toBe("UNSIGNED_LOCAL_SNAPSHOT_NOT_FLEET_VERIFICATION");
    expect(result.manifest.declarations.map((n) => n.host)).toEqual(["rootgate.manus.space", "tesseract.manus.space", "truthtalk.xinus.one"]);
  });
});