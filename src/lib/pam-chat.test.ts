import { describe, expect, it, vi } from "vitest";
import { chatInputSchema, makeOllamaBody, operatorAllowed, parseChatReply, type ChatInput } from "./pam-chat";
import { queryLocalPam } from "./pam-chat.server";

const input: ChatInput = { prompt: "Explain the recorded ledger", history: [], evidence: { chainOk: true, truths: [{ id: "t-1", statement: "No remote evidence recorded" }], envelopes: [] } };
const reply = { reflection: "Request mirrored against t-1", lane: "Core", truths: ["t-1"], explanation: "No remote evidence is recorded.", next: "Review the existing local ledger." };

describe("PAM local coprocessor boundaries", () => {
  it("uses pam-core with repeatability settings, never a different model", () => {
    const body = makeOllamaBody(input, []);
    expect(body.model).toBe("pam-core");
    expect(body.options).toEqual({ temperature: 0, seed: 42, num_ctx: 8192, num_predict: 1024 });
  });
  it("requires an explicit operator identity and denies absent configuration", () => {
    expect(operatorAllowed("operator", undefined)).toBe(false);
    expect(operatorAllowed("other", "operator")).toBe(false);
    expect(operatorAllowed("operator", "operator")).toBe(true);
  });
  it("refuses broken chains before contacting Ollama", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(queryLocalPam({ ...input, evidence: { ...input.evidence, chainOk: false } }, fetcher)).rejects.toThrow("Chain integrity fault");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects invented truth citations", () => {
    expect(() => parseChatReply(JSON.stringify({ ...reply, truths: ["invented"] }), ["t-1"])).toThrow("Unrecorded truth");
  });
  it("rejects multiple-line next moves and extra executable fields", () => {
    expect(() => parseChatReply(JSON.stringify({ ...reply, next: "First move\nSecond move" }), ["t-1"])).toThrow();
    expect(() => parseChatReply(JSON.stringify({ ...reply, tool: "appendLedger" }), ["t-1"])).toThrow();
  });
  it("permits explicitly unledgered output without inventing evidence", () => {
    expect(parseChatReply(JSON.stringify({ ...reply, truths: ["unledgered"] }), []).truths).toEqual(["unledgered"]);
  });
  it("queries only fixed loopback and preserves input evidence", async () => {
    const before = JSON.stringify(input);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ done: true, message: { content: JSON.stringify(reply) } })));
    expect(await queryLocalPam(input, fetcher)).toEqual(reply);
    expect(fetcher.mock.calls[0]?.[0]).toBe("http://127.0.0.1:11434/api/chat");
    expect(JSON.stringify(input)).toBe(before);
    const sent = fetcher.mock.calls[0]?.[1];
    expect(sent?.redirect).toBe("manual");
    expect(sent?.body).toContain("UNSIGNED LOCAL CONTEXT");
  });
  it("refuses oversized, incomplete, or malformed responses", async () => {
    for (const text of ["x".repeat(65_537), JSON.stringify({ done: false, message: { content: JSON.stringify(reply) } }), "not-json"]) {
      await expect(queryLocalPam(input, vi.fn<typeof fetch>().mockResolvedValue(new Response(text)))).rejects.toThrow();
    }
  });
  it("does not follow redirect responses", async () => {
    await expect(queryLocalPam(input, vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 302, headers: { Location: "https://example.com" } })))).rejects.toThrow("Local runtime unavailable");
  });
  it("bounds caller evidence, prompts and history", () => {
    expect(() => chatInputSchema.parse({ ...input, prompt: "x".repeat(3001) })).toThrow();
    expect(() => chatInputSchema.parse({ ...input, history: Array.from({ length: 13 }, () => ({ role: "user", content: "x" })) })).toThrow();
    expect(() => chatInputSchema.parse({ ...input, evidence: { ...input.evidence, truths: Array.from({ length: 17 }, () => ({ id: "t", statement: "x" })) } })).toThrow();
  });
});