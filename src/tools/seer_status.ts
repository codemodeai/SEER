import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { formatStatusResult } from "../lib/formatter.js";
import { appendSuggestInstruction } from "../lib/suggest.js";

export async function seer_status(apiKey: string): Promise<string> {
  const user = await authenticateUser(apiKey);
  if (!user) {
    return "**Error:** Invalid SEER key. Visit https://seermcp.com to get your key.";
  }

  const limit = PLAN_LIMITS[user.plan] ?? 0;
  const remaining = Math.max(0, limit - user.usage_this_month);

  const result = formatStatusResult({
    version: "1.2.0",
    plan: user.plan,
    usage_this_month: user.usage_this_month,
    limit: limit === Infinity ? "unlimited" : limit,
    remaining: limit === Infinity ? "unlimited" : remaining,
    ai_preference: user.ai_preference,
    updates_url: "https://seermcp.com/dashboard/updates",
    suggestions: [
      "seer build the login page",
      "seer optimize my last prompt",
      "seer workflow for setting up CI/CD",
    ],
  });

  return appendSuggestInstruction(result, "seer_status", "status", user.suggestion_skin ?? "default");
}
