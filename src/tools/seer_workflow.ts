import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { callHaiku, estimateTokens } from "../lib/haiku.js";
import { logSeerCall } from "../lib/logger.js";
import { formatWorkflowResult } from "../lib/formatter.js";
import { SECURITY_ANCHOR, scanWorkflowStep, logSecurityIncident } from "../lib/security.js";
import { appendMemoryLog } from "../lib/memory-log.js";
import { checkMfa, getMfaBlockMessage } from "../lib/mfa.js";

const SYSTEM_PROMPT = `Decompose this goal into 3-7 sequential steps. Return ONLY JSON: { "goal": "...", "steps": [{ "step": 1, "title": "...", "context": "...", "prompt": "..." }] }. Each step's "prompt" should be a focused, executable instruction that Claude Code can run directly.
${SECURITY_ANCHOR}`;

export async function seer_workflow(
  goal: string,
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

  // 2. Plan check — workflow requires starter+
  if (user.plan === "free") {
    return JSON.stringify({
      error: "Workflow generator requires Starter plan or above. Upgrade at seer.ai/upgrade",
    });
  }

  // 3. Limit check
  const limit = PLAN_LIMITS[user.plan] ?? 0;
  if (user.usage_this_month >= limit) {
    return JSON.stringify({
      error: `Limit reached (${user.usage_this_month}/${limit}). Upgrade at seer.ai/upgrade`,
    });
  }

  // 4. Increment usage
  await supabase
    .from("users")
    .update({ usage_this_month: user.usage_this_month + 1 })
    .eq("id", user.id);

  // 5. Call Haiku
  let resultText: string;
  try {
    resultText = await callHaiku({
      systemPrompt: SYSTEM_PROMPT,
      userInput: goal,
    });
  } catch (err) {
    return JSON.stringify({
      error: "Workflow generation failed.",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }

  // 6. Scan workflow steps for dangerous content + token stats
  const rawTokens = estimateTokens(goal);
  let optimizedTokens = 0;
  try {
    const parsed = JSON.parse(resultText);
    if (Array.isArray(parsed.steps)) {
      // Check each step prompt for dangerous patterns
      const hasDanger = parsed.steps.some(
        (s: { prompt?: string }) => s.prompt && scanWorkflowStep(s.prompt)
      );
      if (hasDanger) {
        await logSecurityIncident({
          event_type: "workflow_danger",
          source: "mcp",
          user_id: user.id,
          payload_snippet: goal,
        });
        return JSON.stringify({ error: "Processing failed." });
      }

      // Sum tokens across all step prompts
      optimizedTokens = parsed.steps.reduce(
        (sum: number, s: { prompt?: string }) =>
          sum + estimateTokens(s.prompt ?? ""),
        0
      );
    }
  } catch {
    optimizedTokens = estimateTokens(resultText);
  }

  // 7. Log
  await logSeerCall({
    user_id: user.id,
    raw_input: goal,
    raw_tokens: rawTokens,
    optimized_tokens: optimizedTokens,
    tokens_saved: rawTokens - optimizedTokens,
    pct_saved: rawTokens > 0 ? Math.round((1 - optimizedTokens / rawTokens) * 100) : 0,
    tool_used: "seer_workflow",
    surface,
  });

  // 8. Return formatted
  try {
    const parsed = JSON.parse(resultText);
    const result = formatWorkflowResult({
      ...parsed,
      _meta: {
        total_steps: Array.isArray(parsed.steps) ? parsed.steps.length : 0,
        usage: `${user.usage_this_month + 1}/${limit === Infinity ? "unlimited" : limit}`,
      },
    });
    const finalResult = mfa.nudge ? result + mfa.nudge : result;
    return appendMemoryLog(finalResult, "seer_workflow", goal, user.suggestion_skin, user.auto_suggest, apiKey);
  } catch {
    const finalResult = mfa.nudge ? resultText + mfa.nudge : resultText;
    return appendMemoryLog(finalResult, "seer_workflow", goal, user.suggestion_skin, user.auto_suggest, apiKey);
  }
}
