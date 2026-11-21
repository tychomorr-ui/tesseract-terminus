import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { OBSERVATION_LIMIT, projectAmbient, readAmbientObservation } from "@/lib/cryptochrometer";
import { loadOre, oreLoads } from "@/lib/ore";
import { loadSamples, type BtcSample } from "@/lib/btc-substrate";
import { loadChain } from "@/data/truth-chain";
import { valueToCid } from "@/lib/cid";
import { coherence as mmrCoherence, type AxisKey } from "@/lib/mmr-vectors";
import { SriYantraOverlay } from "@/components/SriYantraOverlay";
import { loadEnvelopes, verifyChain } from "@/data/truth-ledger";
import { loadOperatorKeys } from "@/lib/sovereign-keys";

export const Route = createFileRoute("/seventh-dimension")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Seventh Dimension · Unification Surface" },
      { name: "description", content: "Seventh Dimension projects local sovereign records and imported Quantus Cryptochrometer ambient phase observations without claiming signed fleet authority." },
      { property: "og:title", content: "Seventh Dimension · Nexinus Terminus" },
      { property: "og:description", content: "Offline Quantus phase ratios and a recomputable unsigned local snapshot; signed fleet status remains operator evidence required." },
    ],
  }),
  component: SeventhDimensionPage,
});

const AXES = [
  { id: "ore", label: "ORE", glyph: "⛬", desc: "intellectual byproduct" },
  { id: "sudo", label: "TRS", glyph: "◈", desc: "chain substrate" },
  { id: "chain", label: "CHAIN", glyph: "◇", desc: "truth links" },
  { id: "earth", label: "EARTH", glyph: "⬡", desc: "Quantus ambient observation" },
  { id: "pam", label: "PAM", glyph: "♕", desc: "lane discipline" },
  { id: "kether", label: "KETHER", glyph: "⊕", desc: "operator key" },
  { id: "axis", label: "AXIS", glyph: "◬", desc: "the unifier" },
] as const;

function SeventhDimensionPage() {
  const [sample, setSample] = useState<BtcSample | null>(null);
  const [oreCount, setOreCount] = useState(0);
  const [oreDou, setOreDou] = useState(0);
  const [chainLen, setChainLen] = useState(0);
  const [unityCid, setUnityCid] = useState<string>("");
  const [unityRederived, setUnityRederived] = useState<string>("");
  const [now, setNow] = useState(0);
  const [draft, setDraft] = useState("");
  const [observation, setObservation] = useState("");
  const [importError, setImportError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const ambient = useMemo(() => readAmbientObservation(observation, now), [observation, now]);
  const [rot, setRot] = useState(0);
  const [pamCount, setPamCount] = useState(0);
  const [keyPresent, setKeyPresent] = useState(false);

  useEffect(() => {
    const ore = loadOre();
    const loads = oreLoads(ore);
    setOreCount(loads.verified);
    setOreDou(loads.motherLoad);
    void verifyChain().then((result) => setPamCount(result.ok ? loadEnvelopes().length : 0));
    setKeyPresent(Boolean(loadOperatorKeys()));
    setChainLen(loadChain().length);
    const last = loadSamples().slice(-1)[0];
    if (last) setSample(last);
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    // 8-fold resonance: rotation advances by 360/8 = 45° each beat, smoothed.
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : setInterval(() => setRot((x) => (x + 0.6) % 360), 40);
    return () => { clearInterval(t); if (r !== null) clearInterval(r); };
  }, []);


  // Unity CID: hash the cross-axis snapshot. Recomputable, verifiable.
  useEffect(() => {
    const snapshot = {
      v: "7d.unity/v1",
      ore: { count: oreCount, dou: +oreDou.toFixed(2) },
      sudo: sample ? {
        block: sample.block.height,
        oreIndex: +sample.oreIndex.toFixed(4),
        priceUsd: sample.priceUsd,
      } : null,
      chain: { links: chainLen },
      earth: { observation: observation || null, reading: ambient, authority: "UNSIGNED_REMOTE_UNVERIFIED" },
      pam: { verifiedEnvelopes: pamCount },
      kether: { localKeyPresent: keyPresent },
    };
    // Truth Mirror: compute the CID twice — once as the primary witness,
    // once as an independent re-derivation. Any drift between them means
    // the CID pipeline is non-deterministic in this browser and the
    // certificate must NOT display VALIDATED.
    let current = true;
    void Promise.all([valueToCid(snapshot), valueToCid(snapshot)]).then(([cid, mirror]) => {
      if (current) { setUnityCid(cid); setUnityRederived(mirror); }
    });
    return () => { current = false; };
  }, [oreCount, oreDou, sample, chainLen, pamCount, keyPresent, observation, ambient]);

  const unityMirror: "validated" | "drift" | "computing" =
    !unityCid || !unityRederived
      ? "computing"
      : unityCid === unityRederived
        ? "validated"
        : "drift";

  // Heptagram vertex projection.
  const r = 140;
  const cx = 175, cy = 175;
  const vertices = AXES.map((_, i) => {
    const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  // Heptagram star: connect every (n+3) vertex.
  const star = vertices.map((v, i) => {
    const next = vertices[(i + 3) % vertices.length];
    return `M${v.x.toFixed(1)} ${v.y.toFixed(1)} L${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }).join(" ");
  const ring = vertices.map((v, i) => `${i === 0 ? "M" : "L"}${v.x.toFixed(1)} ${v.y.toFixed(1)}`).join(" ") + " Z";

  const phase = ambient.ratio === null ? -1 : 3;
  const pulse8 = Math.round((ambient.ratio ?? 0) * 8);

  const oreActivity = Math.min(1, oreCount / 20);
  const sudoActivity = sample ? Math.min(1, sample.pressure / 20) : 0;
  const chainActivity = Math.min(1, chainLen / 7);

  const mmr = useMemo(() => {
    const raw: Record<AxisKey, number> = {
      ore: oreActivity,
      sudo: sudoActivity,
      chain: chainActivity,
      earth: 0,
      pam: Math.min(1, pamCount / 7),
      kether: keyPresent ? 1 : 0,
      axis: Math.max(oreActivity, sudoActivity, chainActivity),
    };
    return projectAmbient(raw, ambient);
  }, [oreActivity, sudoActivity, chainActivity, pamCount, keyPresent, ambient]);
  const coh = mmrCoherence(mmr);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-10 font-mono">
      <header className="border-b border-border pb-6">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl text-primary">◬</span>
          <span className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">7D //</span>
          <span className="min-w-0 break-all font-display text-base text-foreground">SEVENTH_DIMENSION · UNIFICATION_SURFACE</span>
        </div>
        <h1 className="mt-3 text-sm uppercase tracking-[0.18em] text-primary">one axis · seven projections</h1>
        <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
          the seventh-dimensional projection collapses ore (operator byproduct), truth substrate (chain substrate read),
          truth-chain links, Quantus ambient observations, pam lane discipline, and local key presence onto a single
          recomputable witness. nothing here is novel state — it is the existing local sovereign field, seen as one.
        </p>
        <div className="mt-4 flex flex-wrap gap-px border border-border bg-border">
          <Cell k="unity cid" v={unityCid ? unityCid.slice(0, 14) + "…" : "computing"} />
          <Cell k="ambient phase" v={ambient.phase ?? "UNAVAILABLE"} />
          <Cell k="axes" v="7" />
          <Cell k="ambient ratio" v={ambient.ratio === null ? "—" : `${(ambient.ratio * 100).toFixed(1)}% · UNSIGNED`} />
          <Cell k="local projection" v={`${(coh * 100).toFixed(1)}%`} />
          <Cell k="fleet authority" v="OPERATOR EVIDENCE REQUIRED" />
        </div>
        <TruthChainOrgBanner cid={unityCid} />
      </header>

      <section className="grid gap-px border border-border bg-border md:grid-cols-[1fr_1.2fr]">
        <div className="bg-background/30 p-6">
          <Label a="HEPTAGRAM" b="LOCAL + UNSIGNED AMBIENT PROJECTION" />
          <svg viewBox="0 0 350 350" className="mt-4 w-full">
            <SriYantraOverlay coherence={coh} cx={cx} cy={cy} r={r} />
            <g transform={`rotate(${rot.toFixed(2)} ${cx} ${cy})`} style={{ transformOrigin: `${cx}px ${cy}px` }}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="1" />
              {/* counter-rotating phantom ring — duality */}
              <g transform={`rotate(${(-rot * 1.618).toFixed(2)} ${cx} ${cy})`}>
                <circle cx={cx} cy={cy} r={r - 10} fill="none" stroke="var(--primary)" strokeWidth="0.5" opacity="0.25" strokeDasharray="2 6" />
              </g>
              <path d={ring} fill="none" stroke="var(--border)" strokeWidth="1" />
              <path d={star} fill="none" stroke="var(--primary)" strokeWidth="1.2" opacity={0.55 + 0.35 * (pulse8 / 8)} />
              {vertices.map((v, i) => {
                const isActive = i === phase;
                return (
                  <g key={i}>
                    <circle cx={v.x} cy={v.y} r={isActive ? 8 + pulse8 * 0.4 : 4}
                      fill={isActive ? "var(--primary)" : "var(--background)"}
                      stroke="var(--primary)" strokeWidth="1.5"
                      opacity={isActive ? 1 : 0.6 + 0.4 * (pulse8 / 8)} />
                    {/* counter-rotate text so labels stay readable */}
                    <g transform={`rotate(${(-rot).toFixed(2)} ${v.x} ${v.y})`}>
                      <text x={v.x} y={v.y - 16} textAnchor="middle"
                        fill={isActive ? "var(--primary)" : "var(--foreground)"}
                        style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 2 }}>
                        {AXES[i].glyph} {AXES[i].label}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
            <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--primary)"
              style={{ fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: 4 }}>◬</text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--muted-foreground)"
              style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: 2 }}>UNITY · 8</text>
          </svg>
        </div>

        <div className="space-y-px bg-border">
          <AxisRow glyph="⛬" name="ORE" desc="verified local estimates" v={`${oreCount} verified claims · ${oreDou.toFixed(0)} grade`} activity={oreActivity} href="/digital-ore" />
          <AxisRow glyph="◈" name="TRS" desc="bitcoin substrate read" v={sample ? `block ${sample.block.height.toLocaleString()} · ore=${sample.oreIndex.toFixed(2)}` : "awaiting sample"} activity={sudoActivity} href="/sudo-coin" />
          <AxisRow glyph="◇" name="CHAIN" desc="truth-chain links enrolled" v={`${chainLen} link${chainLen === 1 ? "" : "s"}`} activity={chainActivity} href="/fleet" />
          <AxisRow glyph="⬡" name="EARTH" desc="Quantus · unsigned ambient phase" v={ambient.ratio === null ? "OPERATOR EVIDENCE REQUIRED" : `${ambient.phase} · ${ambient.reachable}/${ambient.pinned} pinned · ${(ambient.ratio * 100).toFixed(1)}%`} activity={ambient.ratio ?? 0} href="/seventh-dimension" />
          <AxisRow glyph="♕" name="PAM" desc="lane discipline ledger" v={`${pamCount} intact local envelopes`} activity={Math.min(1, pamCount / 7)} href="/pam" />
          <AxisRow glyph="⊕" name="KETHER" desc="local key presence · not custody proof" v={keyPresent ? "local key present" : "no local key"} activity={keyPresent ? 1 : 0} href="/gateway" />
          <AxisRow glyph="◬" name="AXIS" desc="the unifier" v="this surface" activity={Math.max(oreActivity, sudoActivity, chainActivity)} href="/seventh-dimension" />
        </div>
      </section>

      <section className="border border-primary/40 bg-background/40 p-6">
        <Label a="UNITY CERTIFICATE" b="recomputable · operator-owned" />
        <p className="mt-2 max-w-3xl text-xs text-foreground/85">
          A single CIDv1 (dag-json · sha-256) over the cross-axis snapshot. Any observer with the same local state regenerates the same CID. No vendor in the loop.
        </p>
        <div className="mt-4 border border-border bg-background/60 p-4 font-mono text-xs break-all text-primary">
          {unityCid || "computing…"}
        </div>
        <div className="mt-3 grid gap-px border border-border bg-border sm:grid-cols-4">
          <Cell k="ore claims" v={String(oreCount)} />
          <Cell k="mother load · grade" v={oreDou.toFixed(0)} />
          <Cell k="trs block" v={sample?.block.height.toLocaleString() ?? "—"} />
          <Cell k="chain links" v={String(chainLen)} />
        </div>
        <div
          className={`mt-3 border px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] ${
            unityMirror === "validated"
              ? "border-primary/60 text-primary"
              : unityMirror === "drift"
                ? "border-destructive/60 text-destructive"
                : "border-border text-muted-foreground"
          }`}
          title={unityRederived ? `re-derived ${unityRederived}` : "awaiting re-derivation"}
        >
          {unityMirror === "validated"
             ? "⌬ LOCAL SNAPSHOT CID · UNSIGNED"
            : unityMirror === "drift"
              ? `⚠ TRUTH MIRROR DRIFT · ${unityCid} ≠ ${unityRederived}`
              : "○ COMPUTING RE-DERIVATION…"}
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6" aria-labelledby="ambient-heading">
        <h2 id="ambient-heading" className="font-display text-lg text-primary">QUANTUS · CRYPTOCHROMETER</h2>
        <p className="text-xs text-warning">SIGNED FLEET STATUS · OPERATOR EVIDENCE REQUIRED · not part of the local console release</p>
        <label className="block space-y-2 text-xs text-foreground">Observation JSON
          <Textarea aria-label="Quantus observation JSON" value={draft} onChange={(e) => { setDraft(e.target.value); setImportError(""); }} className="min-h-40 font-mono text-xs" spellCheck={false} />
        </label>
        <input type="file" ref={file} accept=".json,application/json" className="hidden" aria-label="Import Quantus observation file" onChange={async (e) => {
          const selected = e.target.files?.[0]; if (!selected) return;
          setImportError("");
          try {
            if (selected.size > OBSERVATION_LIMIT) throw new Error("Observation exceeds the 1 MB local limit.");
            const raw = await selected.text(); setDraft(raw); setNow(Date.now()); setObservation(raw);
          } catch (error) { setImportError(error instanceof Error ? error.message : "Could not read observation."); }
          e.target.value = "";
        }} />
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => file.current?.click()}><FileUp />Import JSON</Button>
          <Button disabled={!draft.trim()} onClick={() => { setNow(Date.now()); setObservation(draft); }}><ScanLine />Read observation</Button>
          <Button variant="outline" disabled={!draft && !observation} onClick={() => { setDraft(""); setObservation(""); setImportError(""); }}><X />Clear</Button>
        </div>
        <div role="status" className="space-y-2 border-l-2 border-warning pl-4">
          <p className="font-mono text-xs text-warning">{ambient.status}</p>
          <p className="text-xs text-muted-foreground">{ambient.detail}</p>
          {ambient.ratio !== null && <div className="flex flex-wrap gap-4 text-xs text-warning">
            <span>Instantaneous phase: {ambient.phase}</span>
            <span>Held phase: {ambient.heldPhase ?? "not supplied"}</span>
            <span>Protocol ratio: {ambient.reachable}/{ambient.pinned} · {(ambient.ratio * 100).toFixed(1)}%</span>
          </div>}
        </div>
        {importError && <p role="alert" className="text-xs text-destructive">{importError}</p>}
        <p className="text-xs text-warning">Offline import · no live Quantus source bound · unsigned observation, not verified fleet or planetary evidence.</p>
      </section>


      <section className="border border-border bg-background/30 p-6">
        <Label a="DOCTRINE" b="X. UNIFICATION" />
        <p className="mt-3 text-sm leading-relaxed text-foreground/85">
          The seventh dimension is not a new place. It is the seventh way of looking at what was already here:
          ore that you refined, substrate that the chain was always emitting, links that your operator key signed,
          ambient ratios reported by the witness, lanes that pam held, and local kether key presence.
          Unification is a hash, not a merger. The CID above is the only structure required for the seven to be one.
        </p>
        <div className="mt-4 border-t border-border pt-3 text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">
          RATIFIED BY TYCHOMORR · KETHER_GATE · 7D UNIFICATION SURFACE · v1.0.0
        </div>
      </section>
    </div>
  );
}

function Label({ a, b }: { a: string; b: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[0.62rem] uppercase tracking-[0.22em]">
      <span className="text-primary">{a}</span><span className="text-border">//</span><span className="text-foreground">{b}</span>
    </div>
  );
}
function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-background/60 px-4 py-2">
      <span className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">{k}</span>
      <span className="ml-2 font-mono text-foreground">{v}</span>
    </div>
  );
}
function AxisRow({ glyph, name, desc, v, activity, href }: {
  glyph: string; name: string; desc: string; v: string; activity: number; href: string;
}) {
  return (
    <Link to={href} className="block bg-background/40 p-4 hover:bg-background/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xl text-primary">{glyph}</span>
          <div>
            <div className="font-display text-sm text-foreground">{name}</div>
            <div className="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">{desc}</div>
          </div>
        </div>
        <div className="text-right text-xs text-foreground/85">{v}</div>
      </div>
      <div className="mt-2 h-1 w-full bg-border">
        <div className="h-full bg-primary" style={{ width: `${Math.round(activity * 100)}%` }} />
      </div>
    </Link>
  );
}

function TruthChainOrgBanner({ cid }: { cid: string }) {
  return (
    <div className="mt-4 border border-primary/40 bg-primary/5 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[0.62rem] uppercase tracking-[0.22em] text-primary">
          LOCAL SNAPSHOT · NOT DEPLOYMENT EVIDENCE
        </span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">
          unity {cid ? cid.slice(0, 22) + "…" : "computing"}
        </span>
      </div>
      <p className="mt-1 text-foreground/80">
        The CID fingerprints this local snapshot; it does not verify node signatures, ownership, or market value.
      </p>
    </div>
  );
}

