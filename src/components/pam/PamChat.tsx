import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { activeTruths, loadEnvelopes, verifyChain } from "@/data/truth-ledger";
import { reflectWithPam } from "@/utils/pam-chat.functions";
import type { ChatReply } from "@/lib/pam-chat";

type Turn = { prompt: string; reply: ChatReply };

export function PamChat({ origin }: { origin: "/pam" | "/reflective-intel" }) {
  const run = useServerFn(reflectWithPam);
  const [userId, setUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      generation.current += 1;
      setUserId(session?.user.id ?? null); setChecked(true); setTurns([]); setError(null);
    });
    return () => { generation.current += 1; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => { if (turns.length) end.current?.scrollIntoView({ block: "nearest", behavior: "auto" }); }, [turns]);

  async function send() {
    if (busy.current || !userId || !prompt.trim()) return;
    busy.current = true; setPending(true); setError(null);
    const epoch = generation.current;
    const request = prompt.trim();
    try {
      const chain = await verifyChain();
      if (!chain.ok) { setError("Chain integrity fault — history preserved. Reflection refused."); return; }
      const result = await run({ data: {
        prompt: request,
        history: turns.slice(-6).flatMap((turn) => [{ role: "user" as const, content: turn.prompt }, { role: "assistant" as const, content: JSON.stringify(turn.reply).slice(0, 6000) }]),
        evidence: {
          chainOk: chain.ok,
          truths: activeTruths().slice(-16).map((truth) => ({ id: truth.id.slice(0, 80), statement: truth.statement.slice(0, 1000) })),
          envelopes: loadEnvelopes().slice(-6).map((e) => ({ cid: e.cid, lane: e.lane, reflection: e.reflection.slice(0, 1000), next_move: e.next_move.slice(0, 1000), drift: e.drift?.slice(0, 500) ?? null })),
        },
      } });
      if (epoch !== generation.current) return;
      if (result.ok) { setTurns((current) => [...current, { prompt: request, reply: result.reply }]); setPrompt(""); }
      else setError(result.message);
    } catch { if (epoch === generation.current) setError("PAM connection unavailable. Sign in again or check the sovereign runtime. Evidence is unchanged."); }
    finally { busy.current = false; setPending(false); }
  }

  return <section aria-label="PAM local reflection" className="min-w-0 space-y-4 border-y border-gold/40 py-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h2 className="font-display text-xl text-gold">PAM · SOURCE&amp;TRUTH</h2>
        <p className="font-mono text-xs text-muted-foreground">XinUS · local reflection coprocessor · pam-core</p>
      </div>
      <Button variant="ghost" size="icon" title="Clear conversation" aria-label="Clear conversation" disabled={pending || !turns.length} onClick={() => { setTurns([]); setError(null); }}><RotateCcw /></Button>
    </div>
    <p className="text-xs text-warning">Unsigned AI reflection · no ledger writes · not fleet verification</p>
    {!checked ? <p className="text-sm text-muted-foreground">Checking session…</p> : !userId ? <Button asChild variant="outline"><Link to="/auth" search={{ next: origin }}>Sign in to PAM</Link></Button> : <>
      <div role="log" aria-label="PAM conversation" aria-live="polite" className="max-h-[32rem] space-y-5 overflow-y-auto">
        {!turns.length && <p className="py-3 text-sm text-muted-foreground">Awaiting operator request.</p>}
        {turns.map((turn, index) => <div key={index} className="space-y-3 border-b border-border pb-5 text-sm leading-relaxed">
          <p className="whitespace-pre-wrap break-words text-foreground"><span className="font-mono text-xs text-muted-foreground">OPERATOR · </span>{turn.prompt}</p>
          <dl className="space-y-2 break-words">
            <div><dt className="font-mono text-xs text-gold">[reflection]</dt><dd>{turn.reply.reflection}</dd></div>
            <div><dt className="font-mono text-xs text-gold">[lane]</dt><dd>{turn.reply.lane}</dd></div>
            <div><dt className="font-mono text-xs text-gold">[truths]</dt><dd>{turn.reply.truths.join(", ")}</dd></div>
            <div><dt className="font-mono text-xs text-muted-foreground">[explanation · unsigned]</dt><dd className="whitespace-pre-wrap">{turn.reply.explanation}</dd></div>
            <div><dt className="font-mono text-xs text-gold">[next]</dt><dd>{turn.reply.next}</dd></div>
          </dl>
        </div>)}
        <div ref={end} />
      </div>
      {error && <p role="alert" className="text-sm text-warning">{error}</p>}
      <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <textarea aria-label="Operator message to PAM" placeholder="Operator request…" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={3000} disabled={pending} className="h-24 min-w-0 flex-1 resize-y rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        <Button type="submit" size="icon" variant="outline" title="Send to local PAM" aria-label="Send to local PAM" disabled={pending || !prompt.trim()}>{pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <ArrowUp />}</Button>
      </form>
      <div className="flex flex-wrap justify-between gap-2 font-mono text-[0.65rem] text-muted-foreground">
        <span>{pending ? "Reflecting · up to 120 seconds" : `${prompt.length}/3000`}</span>
        <span className="break-all">Operator ID: {userId}</span>
      </div>
    </>}
  </section>;
}