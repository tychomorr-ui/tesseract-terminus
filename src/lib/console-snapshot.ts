import { valueToCid } from "@/lib/cid";
import { oreLoads, traceLedger } from "@/lib/ore";
import { verifySample } from "@/lib/btc-substrate";
import { NODES } from "@/data/nodes";

export const SNAPSHOT_KEYS = {
  pam: "nexinus.pam.envelopes.v1",
  ore: "nexinus.ore.ledger.v1",
  substrate: "nexinus.sudo.samples.v1",
  chain: "nexinus.terminus.truth-chain.v1",
} as const;
export type SnapshotRecords = Record<keyof typeof SNAPSHOT_KEYS, string | null>;

function readArray(raw: string | null): unknown[] | null {
  try { const parsed: unknown = JSON.parse(raw ?? "[]"); return Array.isArray(parsed) ? parsed : null; }
  catch { return null; }
}

/** Preserve original bytes, including malformed history; never export private keys. */
export async function buildConsoleSnapshot(records: SnapshotRecords) {
  const pam = readArray(records.pam);
  let pamFault: number | null = pam ? null : 0;
  let prev: string | null = null;
  if (pam) for (let i = 0; i < pam.length; i++) {
    try {
      const entry = pam[i];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("shape");
      const { cid, ...body } = entry as Record<string, unknown>;
      if (body.prev_cid !== prev || typeof cid !== "string" || await valueToCid(body) !== cid) throw new Error("integrity");
      prev = cid;
    } catch { pamFault = i; break; }
  }
  const ore = readArray(records.ore);
  const substrate = readArray(records.substrate);
  const chain = readArray(records.chain);
  const loads = ore ? oreLoads(ore) : null;
  const manifest = {
    v: "terminus.local-snapshot/v1",
    boundary: "UNSIGNED_LOCAL_SNAPSHOT_NOT_FLEET_VERIFICATION",
    declarations: NODES.map(({ id, host }) => ({ id, host: host ?? null })),
    records,
    checks: {
      pam: { count: pam?.length ?? null, breakAt: pamFault, headCid: pamFault === null ? prev : null },
      ore: { count: ore?.length ?? null, loads, traces: ore ? traceLedger(ore) : null },
      substrate: { count: substrate?.length ?? null, rejected: substrate ? substrate.filter((s) => !verifySample(s)).length : null },
      chain: { count: chain?.length ?? null, verification: "ENROLLMENT_RECORDS_ONLY" },
    },
  };
  return { manifest, cid: await valueToCid(manifest) };
}

export async function captureConsoleSnapshot() {
  const capture = (): SnapshotRecords => ({
    pam: window.localStorage.getItem(SNAPSHOT_KEYS.pam), ore: window.localStorage.getItem(SNAPSHOT_KEYS.ore),
    substrate: window.localStorage.getItem(SNAPSHOT_KEYS.substrate), chain: window.localStorage.getItem(SNAPSHOT_KEYS.chain),
  });
  const records = capture();
  const snapshot = await buildConsoleSnapshot(records);
  if (JSON.stringify(records) !== JSON.stringify(capture())) throw new Error("Local records changed during export. Retry after reviewing the new state.");
  return snapshot;
}