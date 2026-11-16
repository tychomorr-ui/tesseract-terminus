import opsRaw from "./terminus-ops.json";

export type OpsEntry = {
  ts: string;
  level: "CMD" | "INFO" | "WARN" | "STANDBY" | string;
  subsystem: string;
  command: string;
  result: string;
  sessionId: string;
};

export const OPS_LOG: OpsEntry[] = opsRaw as OpsEntry[];

// Current operator declarations, not historical artifact gateway claims.
export const DECLARED_GATEWAYS = [
  { host: "rootgate.manus.space", url: "https://rootgate.manus.space" },
  { host: "tesseract.manus.space", url: "https://tesseract.manus.space" },
  { host: "truthtalk.xinus.one", url: "https://truthtalk.xinus.one" },
] as const;

export const OPS_ARTIFACT_NAME = "terminus-ops-2026-06-25.json";
