import { createFileRoute, Link } from "@tanstack/react-router";
import { BLADES } from "@/data/blades";
import { BladeStandby } from "@/components/blades/BladeStandby";
import { triadDeclarations } from "@/lib/quantotalus";

const BLADE = BLADES.find((b) => b.n === "12");
if (!BLADE) throw new Error("QUANTOTALUS blade is not registered");

export const Route = createFileRoute("/quantotalus")({
  head: () => ({ meta: [
      { property: "og:title", content: `${BLADE.name} · Blade ${BLADE.n}` },
      { property: "og:description", content: BLADE.tagline },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },{ title: `${BLADE.name} · Blade ${BLADE.n}` }, { name: "description", content: BLADE.tagline }] }),
  component: () => (
    <BladeStandby blade={BLADE}>
      <section className="space-y-4 border-t border-border pt-6" aria-labelledby="triad-heading">
        <h2 id="triad-heading" className="font-display text-xl text-gold">Canonical triad</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {triadDeclarations().map(({ id, name, host }) => (
            <li key={id} className="min-w-0 space-y-2 rounded border border-border p-4">
              <p className="text-sm text-foreground">{name}</p>
              <p className="break-all font-mono text-xs text-muted-foreground">{host ?? "No unique declaration"}</p>
              <p className="text-xs text-warning">{host ? "DECLARED · SIGNED HEALTH UNVERIFIED" : "DECLARATION UNAVAILABLE"}</p>
            </li>
          ))}
        </ul>
        <Link to="/proof-fulcrum" className="inline-block text-sm text-gold underline underline-offset-4">
          Open offline evidence review
        </Link>
      </section>
    </BladeStandby>
  ),
});
