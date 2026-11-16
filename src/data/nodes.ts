export type Tier = "measured" | "attested" | "doctrine";

export type ClusterId = "alpha" | "beta";

export type Probe =
  | { kind: "cors-json"; url: string; okField?: string; ipfsFallback?: IpfsFallback }
  | { kind: "no-cors-head"; url: string; ipfsFallback?: IpfsFallback }
  | { kind: "signed-status"; url: string; edPubHex?: string; ipfsFallback?: IpfsFallback }
  | { kind: "ipfs-signed-status"; cid: string; edPubHex: string; gateways?: string[] };

export type IpfsFallback = {
  cid: string;
  edPubHex: string;
  gateways?: string[];
};

export type SovereignNode = {
  id: string;
  name: string;
  provider: string;
  region: string;
  role: string;
  tier: Tier;
  declared: string;
  facts: string[];
  truth: string;
  cluster_id?: ClusterId;
  cluster_role?: "anchor" | "vertex";
  probe?: Probe;
  /** Operator-declared canonical hostname. Reachability is not ownership proof. */
  host?: string;
  ipv6?: string;
  /** Declared machine size, as reported by the hosting console. */
  spec?: string;
};

// Default public IPFS gateways used when a node's probe/fallback doesn't list its own.
export const DEFAULT_IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
];

// Operator-declared canonical endpoints. No machine, region, ownership,
// signing-key or health claim is inferred from a domain declaration.
export const NODES: SovereignNode[] = [
  {
    id: "root-gate",
    name: "Root-Gate",
    provider: "Operator-declared endpoint",
    region: "Not independently verified",
    role: "Sovereign control-plane endpoint",
    tier: "doctrine",
    declared: "DECLARED · signature unverified",
    cluster_id: "alpha",
    cluster_role: "anchor",
    host: "rootgate.manus.space",
    facts: ["Canonical endpoint declared by the operator; no signing key supplied."],
    truth: "HTTPS reachability is not signed fleet status. OPERATOR EVIDENCE REQUIRED.",
    probe: { kind: "no-cors-head", url: "https://rootgate.manus.space/" },
  },
  {
    id: "tesseract-terminus",
    name: "Tesseract-Terminus",
    provider: "Operator-declared endpoint",
    region: "Not independently verified",
    role: "Sovereign console endpoint",
    tier: "doctrine",
    declared: "DECLARED · signature unverified",
    cluster_id: "alpha",
    cluster_role: "vertex",
    host: "tesseract.manus.space",
    facts: ["Canonical endpoint declared by the operator; no signing key supplied."],
    truth: "HTTPS reachability is not signed fleet status. OPERATOR EVIDENCE REQUIRED.",
    probe: { kind: "no-cors-head", url: "https://tesseract.manus.space/" },
  },
  {
    id: "truth-talk",
    name: "Truth-Talk",
    provider: "Operator-declared endpoint",
    region: "Not independently verified",
    role: "Sovereign messaging endpoint",
    tier: "doctrine",
    declared: "DECLARED · signature unverified",
    cluster_id: "alpha",
    cluster_role: "vertex",
    host: "truthtalk.xinus.one",
    facts: ["Canonical endpoint declared by the operator; no signing key supplied."],
    truth: "HTTPS reachability is not signed fleet status. OPERATOR EVIDENCE REQUIRED.",
    probe: { kind: "no-cors-head", url: "https://truthtalk.xinus.one/" },
  },
];

/** Human-readable target for a probe (URL or ipfs://CID). */
export function probeTarget(p: Probe | undefined | null): string {
  if (!p) return "";
  if (p.kind === "ipfs-signed-status") return `ipfs://${p.cid}`;
  return p.url;
}
