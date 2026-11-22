import { BLADES } from "@/data/blades";
import { makeOllamaBody, parseChatReply, type ChatInput } from "./pam-chat";

// Fixed loopback destination. Neither prompts nor browser settings select URLs.
export async function queryLocalPam(input: ChatInput, fetcher: typeof fetch = fetch) {
  const body = makeOllamaBody(input, BLADES.map(({ name, route, status, tagline, blocker }) => ({ name, route, status, tagline, blocker })));
  const response = await fetcher("http://127.0.0.1:11434/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok || !response.body) throw new Error("Local runtime unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65_536) throw new Error("Runtime response exceeds bound");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || typeof parsed !== "object" || !("message" in parsed) || !("done" in parsed) || parsed.done !== true) throw new Error("Incomplete runtime response");
  const message = parsed.message;
  if (!message || typeof message !== "object" || !("content" in message) || typeof message.content !== "string") throw new Error("Invalid runtime response");
  return parseChatReply(message.content, input.evidence.truths.map((truth) => truth.id));
}