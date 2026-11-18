import { NODES, type SovereignNode } from "@/data/nodes";

const TRIAD_IDS = ["tesseract-terminus", "root-gate", "truth-talk"] as const;

/** Project declarations only; registry entries do not include signed health evidence. */
export function triadDeclarations(nodes: readonly SovereignNode[] = NODES) {
  return TRIAD_IDS.map((id) => {
    const matches = nodes.filter((node) => node.id === id);
    const node = matches.length === 1 ? matches[0] : undefined;
    return { id, name: node?.name ?? id, host: node?.host ?? null };
  });
}
