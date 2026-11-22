import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatInputSchema, operatorAllowed } from "@/lib/pam-chat";

export const reflectWithPam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => chatInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!operatorAllowed(context.userId, process.env["PAM_OPERATOR_IDS"])) return { ok: false as const, message: "Operator access is not configured for this account." };
    if (process.env["PAM_OLLAMA_ENABLED"] !== "1") return { ok: false as const, message: "Local PAM runtime is disabled on this host. Deploy and enable it on the sovereign server." };
    if (!data.evidence.chainOk) return { ok: false as const, message: "Chain integrity fault — history preserved. Reflection refused." };
    try {
      const { queryLocalPam } = await import("@/lib/pam-chat.server");
      const reply = await queryLocalPam(data);
      return { ok: true as const, reply, model: "pam-core", source: "Local Ollama · unsigned AI reflection" };
    } catch {
      return { ok: false as const, message: "Local PAM did not return a valid bounded reflection within 120 seconds. Check Ollama on the sovereign host. Evidence is unchanged." };
    }
  });