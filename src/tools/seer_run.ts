import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { callHaiku, estimateTokens } from "../lib/haiku.js";
import { logSeerCall } from "../lib/logger.js";
import { getEmbedding, searchMemory } from "../lib/embeddings.js";

const SYSTEM_PROMPT = `You are SEER, an AI prompt optimizer. Your job is to rewrite the user's prompt to be clearer, more specific, and more effective for an AI model — while using FEWER tokens.

Rules:
- Remove filler words, redundancy, and vagueness
- Add specificity: mention exact technologies, formats, constraints
- Structure with clear sections if the task is complex
- The optimized prompt MUST be shorter in token count than the original when possible
- For very short prompts (under 10 words), expand them with precise intent and context to make them actionable — this is optimization by clarity, not just compression

Return ONLY JSON: { "optimized": "...", "steps": ["step1", "step2", ...], "note": "one line explaining what you improved" }`;

const SYSTEM_PROMPT_WITH_CONTEXT = `You are SEER, an AI prompt optimizer with project context. Rewrite the user's prompt to be clearer, more specific, and more effective — using FEWER tokens where possible.

Rules:
- Remove filler words, redundancy, and vagueness
- Leverage the provided project context to add relevant specifics
- Structure with clear sections if the task is complex
- The optimized prompt MUST be shorter in token count than the original when possible
- For very short prompts, expand with precise intent using project context

Return ONLY JSON: { "optimized": "...", "steps": ["step1", "step2", ...], "note": "...", "context_used": true }`;

export async function seer_run(
  input: string,
  apiKey: string,
  surface: string = "unknown"
): Promise<string> {
  // 1. Validate user
  const user = await authenticateUser(apiKey);
  if (!user) {
    return JSON.stringify({ error: "Invalid SEER key. Visit seer.ai" });
  }

  // 2. Check plan limit
  const limit = PLAN_LIMITS[user.plan] ?? 0;
  if (user.usage_this_month >= limit) {
    const upgrade =
      user.plan === "starter" ? "Pro ($49/mo)" : "Agency ($99/mo)";
    return JSON.stringify({
      error: `Limit reached (${user.usage_this_month}/${limit}). Upgrade to ${upgrade} at seer.ai/upgrade`,
    });
  }

  // 3. Increment usage BEFORE calling Haiku
  await supabase
    .from("users")
    .update({ usage_this_month: user.usage_this_month + 1 })
    .eq("id", user.id);

  // 4. Inject memory context for Pro+ users
  let contextSnippet = "";
  const hasPro = user.plan === "pro" || user.plan === "agency";
  if (hasPro) {
    try {
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (project) {
        const embedding = await getEmbedding(input);
        const memories = await searchMemory(project.id as string, embedding, 3);
        if (memories.length > 0) {
          contextSnippet =
            "\n\nProject context:\n" +
            memories.map((m) => `- ${m.content}`).join("\n");
        }
      }
    } catch {
      // Memory injection is best-effort — don't block the call
    }
  }

  // 5. Call Haiku using SEER's own key
  const useContext = contextSnippet.length > 0;
  let resultText: string;
  try {
    resultText = await callHaiku({
      systemPrompt: useContext ? SYSTEM_PROMPT_WITH_CONTEXT : SYSTEM_PROMPT,
      userInput: useContext ? input + contextSnippet : input,
    });
  } catch (err) {
    return JSON.stringify({
      error: "Optimization failed. Please try again.",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }

  // 5. Parse result and compute token savings
  const rawTokens = estimateTokens(input);
  let optimizedTokens = rawTokens;
  let optimizedText = "";
  try {
    const parsed = JSON.parse(resultText);
    if (parsed.optimized) {
      optimizedText = parsed.optimized;
      optimizedTokens = estimateTokens(optimizedText);
    }
  } catch {
    // If Haiku returned non-JSON, use raw result
  }

  // For short prompts that get expanded for clarity, the savings are in quality not compression
  // We measure effectiveness: if expanded, show the clarity improvement instead of negative savings
  const tokensSaved = Math.max(0, rawTokens - optimizedTokens);
  const pctSaved =
    rawTokens > 0 && optimizedTokens < rawTokens
      ? Math.round((1 - optimizedTokens / rawTokens) * 100)
      : 0;

  // 6. Log to dashboard DB
  await logSeerCall({
    user_id: user.id,
    raw_input: input,
    raw_tokens: rawTokens,
    optimized_tokens: optimizedTokens,
    tokens_saved: tokensSaved,
    pct_saved: pctSaved,
    tool_used: "seer_run",
    surface,
  });

  // 7. Return enriched result
  try {
    const parsed = JSON.parse(resultText);
    return JSON.stringify({
      ...parsed,
      _meta: {
        raw_tokens: rawTokens,
        optimized_tokens: optimizedTokens,
        tokens_saved: tokensSaved,
        pct_saved: pctSaved,
        usage: `${user.usage_this_month + 1}/${limit === Infinity ? "unlimited" : limit}`,
      },
    });
  } catch {
    return resultText;
  }
}
