import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";

export async function seer_status(apiKey: string): Promise<string> {
  const user = await authenticateUser(apiKey);
  if (!user) {
    return JSON.stringify({ error: "Invalid SEER key. Visit seer.ai" });
  }

  const limit = PLAN_LIMITS[user.plan] ?? 0;
  const remaining = Math.max(0, limit - user.usage_this_month);

  return JSON.stringify({
    version: "1.2.0",
    plan: user.plan,
    usage_this_month: user.usage_this_month,
    limit: limit === Infinity ? "unlimited" : limit,
    remaining: limit === Infinity ? "unlimited" : remaining,
    ai_preference: user.ai_preference,
    updates_url: "https://seermcp.com/dashboard/updates",
    suggestions: [
      "Try: seer build the login page",
      "Try: seer optimize my last prompt",
      "Try: seer workflow for setting up CI/CD",
    ],
  });
}
