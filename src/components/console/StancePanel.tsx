import { useEffect, useState } from "react";
import { loadEnvelopes, verifyChain, type Envelope } from "@/data/truth-ledger";
import { recordedNextMoves } from "@/lib/manifestation-queue";

export function StancePanel() {
  return (
    <aside className="rounded border border-border bg-card/40 p-5">
      <div className="text-[0.7rem] uppercase tracking-[0.22em] text-gold">STANCE</div>
      <ul className="mt-3 space-y-1.5 font-mono text-[0.72rem] text-foreground/85">
        <li>▸ local-first records</li>
        <li>▸ declarations are not measurements</li>
        <li>▸ signatures are not service authority</li>
        <li>▸ real data or honest standby</li>
      </ul>

      <div className="mt-5 text-[0.7rem] uppercase tracking-[0.22em] text-gold">PAM</div>
      <p className="mt-2 text-[0.72rem] text-muted-foreground">
        Local CID-chained reflections · broken history preserved · restamping refused
      </p>

      <div className="mt-5 text-[0.7rem] uppercase tracking-[0.22em] text-gold">SIGNED FLEET STATUS</div>
      <p className="mt-2 text-[0.72rem] text-warning">
        OPERATOR EVIDENCE REQUIRED · not part of the local console release
      </p>
    </aside>
  );
}

export function ManifestationQueue() {
  const [entries, setEntries] = useState<Envelope[]>([]);
  const [integrity, setIntegrity] = useState("CHECKING");
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const before = JSON.stringify(loadEnvelopes());
      const result = await verifyChain();
      if (!active) return;
      const current = loadEnvelopes();
      setEntries(recordedNextMoves(current));
      setIntegrity(before !== JSON.stringify(current) ? "CHANGED · RECHECK REQUIRED" :
        result.ok ? "LOCAL CHAIN CHECKED" : "INTEGRITY FAULT · HISTORY PRESERVED");
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    window.addEventListener("storage", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("storage", refresh); };
  }, []);
  return (
    <aside className="rounded border border-border bg-card/40 p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[0.7rem] uppercase tracking-[0.22em] text-gold">
          PAM · recorded next moves
        </div>
        <span className="rounded border border-border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
          {entries.length} recorded
        </span>
      </div>
      <p className="mt-3 text-[0.72rem] text-muted-foreground">
        {integrity} · execution unverified
      </p>
      {entries.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">No PAM next moves recorded on this device.</p> :
        <ol className="mt-3 space-y-3">
          {entries.map((entry, i) => <li key={`${entry.cid}-${i}`} className="border-t border-border pt-2">
            <div className="font-mono text-[0.65rem] text-muted-foreground">{entry.lane} · {new Date(entry.ts).toISOString()}</div>
            <p className="mt-1 break-words text-xs text-foreground">{entry.next_move}</p>
            <div className="mt-1 break-all font-mono text-[0.6rem] text-muted-foreground">{entry.cid}</div>
          </li>)}
        </ol>}
    </aside>
  );
}
