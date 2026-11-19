import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Download, FileUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { reviewProof, type ProofReview } from "@/lib/proof-review";
import { captureConsoleSnapshot } from "@/lib/console-snapshot";
import { PROOF_MAX_LENGTH } from "@/lib/atmos-proof";

export const Route = createFileRoute("/proof-fulcrum")({
  head: () => ({ meta: [
      { property: "og:title", content: "Proof Fulcrum · Terminus Offline Evidence" },
      { property: "og:description", content: "Offline ARCHANGEL and ATMOS evidence review and unsigned console snapshot export. Fleet authority remains unverified." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },{ title: "Proof Fulcrum · Terminus Offline Evidence" }, { name: "description", content: "Review ARCHANGEL/v0 envelopes, ATMOS signed manifests and ATMOS signed health offline, and export original local console records." }] }),
  component: ProofFulcrum,
});

function ProofFulcrum() {
  const [raw, setRaw] = useState("");
  const [key, setKey] = useState("");
  const [manifest, setManifest] = useState("");
  const [result, setResult] = useState<ProofReview | null>(null);
  const [cid, setCid] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const reset = () => { setResult(null); setError(""); };
  async function exportSnapshot() {
    setPending(true); setError(""); setCid("");
    try {
      const snapshot = await captureConsoleSnapshot();
      const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = "terminus-local-snapshot.json"; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCid(snapshot.cid);
    } catch (e) { setError(e instanceof Error ? e.message : "Snapshot export failed."); }
    finally { setPending(false); }
  }
  return <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
    <header className="space-y-3 border-b border-border pb-6">
      <p className="font-mono text-xs text-gold">◇ BLADE 13 · LOCAL EVIDENCE</p>
      <h1 className="font-display text-3xl text-foreground">PROOF FULCRUM</h1>
      <p className="text-sm text-warning">SIGNED FLEET STATUS · OPERATOR EVIDENCE REQUIRED · not part of the local console release</p>
    </header>
    <section className="space-y-4" aria-labelledby="review-heading">
      <h2 id="review-heading" className="font-display text-xl text-gold">Offline signature review</h2>
      <p className="text-xs text-muted-foreground">Archangel · ARCHANGEL/v0 envelopes, ATMOS v1 manifests and signed health</p>
      <label className="block space-y-2 text-sm">Signed envelope
        <Textarea aria-label="Signed envelope" value={raw} onChange={(e) => { setRaw(e.target.value); reset(); }} className="min-h-48 font-mono text-xs" spellCheck={false} />
      </label>
      <label className="block space-y-2 text-sm">Independent comparison · ARCHANGEL Ed25519 public key or ATMOS SHA-256 SPKI fingerprint (hex)
        <Input aria-label="Comparison public key" value={key} onChange={(e) => { setKey(e.target.value); reset(); }} className="font-mono text-xs" spellCheck={false} />
      </label>
      <details className="space-y-2 text-sm">
        <summary className="cursor-pointer">Companion manifest · required for ATMOS signed health only</summary>
        <Textarea aria-label="Companion signed manifest" value={manifest} onChange={(e) => { setManifest(e.target.value); reset(); }} className="min-h-32 font-mono text-xs" spellCheck={false} />
      </details>
      <input type="file" accept=".json,application/json" ref={file} className="hidden" aria-label="Import envelope file" onChange={async (e) => {
        const selected = e.target.files?.[0]; if (!selected) return;
        reset();
        if (selected.size > PROOF_MAX_LENGTH) { setError("Envelope exceeds the 1 MB local review limit."); e.target.value = ""; return; }
        try { setRaw(await selected.text()); } catch { setError("Could not read the envelope file."); }
        e.target.value = "";
      }} />
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => file.current?.click()}><FileUp />Import JSON</Button>
        <Button disabled={!raw.trim()} onClick={() => setResult(reviewProof(raw, key, Date.now(), manifest))}><ShieldCheck />Review signature</Button>
      </div>
      {result && <div role="status" className="space-y-2 border-l-2 border-warning pl-4">
        <p className="break-all font-mono text-sm text-warning">{result.verdict}</p>
        <p className="text-sm text-muted-foreground">{result.detail}</p>
      </div>}
      <p className="text-xs text-warning">Offline comparison only. Neither a matching signature nor a Quantus witness receipt establishes fleet authority.</p>
    </section>
    <section className="space-y-4 border-t border-border pt-6" aria-labelledby="snapshot-heading">
      <h2 id="snapshot-heading" className="font-display text-xl text-gold">Console snapshot</h2>
      <p className="text-sm text-muted-foreground">PAM · Digital Ore · Truth Substrate · local enrollment records. Original records and integrity faults retained. No private keys. No signature.</p>
      <Button variant="outline" disabled={pending} onClick={() => void exportSnapshot()}><Download />{pending ? "Exporting…" : "Export local snapshot"}</Button>
      {cid && <div role="status" className="space-y-2"><p className="text-xs text-warning">UNSIGNED LOCAL SNAPSHOT · NOT FLEET VERIFICATION</p><p className="break-all font-mono text-xs text-foreground">{cid}</p></div>}
    </section>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
