import { createServerFn } from "@tanstack/react-start";
import { NODES } from "@/data/nodes";

export type HostProbe = {
  id: string;
  host: string;
  /** REACHABLE = the host answered over HTTP(S). DOWN = no answer within the timeout. */
  state: "REACHABLE" | "DOWN";
  /** Scheme + status that answered, when any. */
  via: string | null;
  status: number | null;
  reason: string | null;
  ms: number;
  checkedAt: string;
};

async function hit(url: string): Promise<{ status: number } | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { accept: "*/*" },
      signal: AbortSignal.timeout(6000),
    });
    return { status: res.status };
  } catch {
    return null;
  }
}

async function probeHost(id: string, host: string): Promise<HostProbe> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  // Canonical hostname declarations require HTTPS; never fall back to plain HTTP.
  const answer = await hit(`https://${host}/`);
  const via = answer ? "https" : null;
  return {
    id,
    host,
    state: answer ? "REACHABLE" : "DOWN",
    via: answer ? `${via} ${answer.status}` : null,
    status: answer?.status ?? null,
    reason: answer ? null : "no_answer_within_6s",
    ms: Date.now() - started,
    checkedAt,
  };
}

/** Real server-side reachability probe for every operator-held host. */
export const probeNodeHosts = createServerFn({ method: "GET" }).handler(
  async (): Promise<HostProbe[]> =>
    Promise.all(
      NODES.flatMap((n) => n.host ? [probeHost(n.id, n.host)] : []),
    ),
);
