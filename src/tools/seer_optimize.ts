import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { callHaiku, estimateTokens } from "../lib/haiku.js";
import { logSeerCall } from "../lib/logger.js";

function systemPromptForModel(model: string): string {
  const modelHint =
    model === "gpt"
      ? "Target: OpenAI GPT. "
      : model === "gemini"
        ? "Target: Google Gemini. "
        : "";
  return `${modelHint}You are SEER, an AI prompt optimizer. Rewrite the user's prompt to be clearer, more specific, and more effective for the target AI model.

Rules:
- Remove filler words, redundancy, and vagueness
- Add specificity: mention exact technologies, output formats, constraints
- For long prompts: compress while preserving intent — use fewer tokens
- For short prompts (under 10 words): expand with precise intent, context, and structure to make them actionable
- Always produce a higher-quality prompt than the original

Return ONLY JSON: { "optimized": "...", "token_reduction_pct": 0-100, "quality_score": 0.0-1.0, "explanation": "one line on what you improved" }`;
}

export async function seer_optimize(
  prompt: string,
  model: string,
  apiKey: string,
  surface: string = "unknown"
): Promise<string> {
  // 1. Validate
  const user = await authenticateUser(apiKey);
  if (!user) {
    return JSON.stringify({ error: "Invalid SEER key. Visit seer.ai" });
  }

  // 2. Check limit
  const limit = PLAN_LIMITS[user.plan] ?? 0;
  if (user.usage_this_month >= limit) {
    return JSON.stringify({
      error: `Limit reached. Upgrade at seer.ai/upgrade`,
    });
  }

  // 3. Increment usage
  await supabase
    .from("users")
    .update({ usage_this_month: user.usage_this_month + 1 })
    .eq("id", user.id);

  // 4. Call Haiku
  let resultText: string;
  try {
    resultText = await callHaiku({
      systemPrompt: systemPromptForModel(model),
      userInput: prompt,
    });
  } catch (err) {
    return JSON.stringify({
      error: "Optimization failed.",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }

  // 5. Compute token stats
  const rawTokens = estimateTokens(prompt);
  let optimizedTokens = rawTokens;
  try {
    const parsed = JSON.parse(resultText);
    if (parsed.optimized) {
      optimizedTokens = estimateTokens(parsed.optimized);
    }
  } catch {
    // non-JSON response
  }

  const tokensSaved = Math.max(0, rawTokens - optimizedTokens);
  const pctSaved =
    rawTokens > 0 && optimizedTokens < rawTokens
      ? Math.round((1 - optimizedTokens / rawTokens) * 100)
      : 0;

  // 6. Log
  await logSeerCall({
    user_id: user.id,
    raw_input: prompt,
    raw_tokens: rawTokens,
    optimized_tokens: optimizedTokens,
    tokens_saved: tokensSaved,
    pct_saved: pctSaved,
    tool_used: "seer_optimize",
    surface,
  });

  // 7. Return
  try {
    const parsed = JSON.parse(resultText);
    return JSON.stringify({
      ...parsed,
      target_model: model,
      tokens_before: rawTokens,
      tokens_after: optimizedTokens,
      tokens_saved: tokensSaved,
      pct_saved: pctSaved,
    });
  } catch {
    return resultText;
  }
}
