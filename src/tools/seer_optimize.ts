import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { callHaiku, estimateTokens, parseHaikuJson } from "../lib/haiku.js";
import { logSeerCall } from "../lib/logger.js";
import { formatOptimizeResult, buildUsageWarning } from "../lib/formatter.js";
import { SECURITY_ANCHOR } from "../lib/security.js";
import { appendMemoryLog } from "../lib/memory-log.js";
import { checkMfa, getMfaBlockMessage } from "../lib/mfa.js";
import { checkTeamConflict } from "../lib/conflict-detect.js";

function systemPromptForModel(model: string): string {
  const modelHint =
    model === "gpt"
      ? "Target: OpenAI GPT. "
      : model === "gemini"
        ? "Target: Google Gemini. "
        : "";
  return `${modelHint}You are SEER, a prompt compressor. Rewrite the prompt to be shorter and more precise. NEVER make it longer.

Rules:
- Remove ALL filler words, pleasantries, and redundancy
- Use concise technical language
- Keep the SAME intent — do not add new requirements or expand scope
- Short prompts stay short — just sharpen the wording
- The output MUST have FEWER words than the input

Return ONLY JSON: { "optimized": "...", "token_reduction_pct": 0-100, "quality_score": 0.0-1.0, "explanation": "one line on what you removed/compressed" }
${SECURITY_ANCHOR}`;
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

  // 1b. MFA enforcement
  const mfa = await checkMfa(user);
  if (mfa.blocked) {
    return getMfaBlockMessage();
  }

  // 1c. Team conflict detection
  const conflict = await checkTeamConflict(user, prompt);

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
  const parsed = parseHaikuJson(resultText);

  if (parsed?.optimized) {
    optimizedTokens = estimateTokens(parsed.optimized as string);
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

  // 7. Return formatted
  const usageWarning = buildUsageWarning(user.plan, user.usage_this_month + 1, limit);
  if (parsed) {
    const result = formatOptimizeResult({
      ...parsed,
      target_model: model,
      tokens_before: rawTokens,
      tokens_after: optimizedTokens,
      tokens_saved: tokensSaved,
      pct_saved: pctSaved,
    });
    const finalResult = mfa.nudge ? result + mfa.nudge : result;
    return appendMemoryLog(conflict.warning + usageWarning + finalResult, "seer_optimize", prompt, user.suggestion_skin, user.auto_suggest, apiKey);
  }
  const finalResult = mfa.nudge ? resultText + mfa.nudge : resultText;
  return appendMemoryLog(conflict.warning + usageWarning + finalResult, "seer_optimize", prompt, "default", true, apiKey);
}
