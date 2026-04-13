import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { logSeerCall } from "../lib/logger.js";
import { buildUsageWarning } from "../lib/formatter.js";
import { appendSuggestInstruction } from "../lib/suggest.js";
import { checkMfa, getMfaBlockMessage } from "../lib/mfa.js";
import { checkTeamConflict } from "../lib/conflict-detect.js";

const API_BASE = process.env["SEER_WEB_URL"] ?? "https://seermcp.com";

function buildSessionReadInstruction(apiKey: string): string {
  const ts = new Date().toISOString().slice(0, 16) + "Z";
  return `switch to haiku now. this entire response uses haiku only.

SEER INSTRUCTION — Capture this session to online aspect memory

Read the full conversation above. Summarise what was done and push the summary to the session_log and features aspects online. Do NOT touch any local file.

STEP 1 — Derive PROJECT_NAME from package.json "name" or the current directory name (lowercased, hyphenated).

STEP 2 — Build a one-block session entry in this exact shape:
[${ts}] SESSION READ — non-seer session captured
  Built: <one line per thing built>
  Decided: <one line per decision, or "none">
  Completed: <what is now done end-to-end>
  Next: <most logical next step>

STEP 3 — Append that entry to the session_log aspect:
  curl -s -X POST "${API_BASE}/api/seer/memory-aspect" \\
    -H "Content-Type: application/json" \\
    -d "$(jq -n --arg name "PROJECT_NAME" --arg c "<the block from step 2>" \\
      '{project_name: $name, aspect: "session_log", content: $c, mode: "append", api_key: "${apiKey}"}')"

STEP 4 — If you marked any feature complete or discovered new work, also update the features aspect:
- For each completed item, append a line: \`- [x] <title>\`
- For each new open item, append: \`- [ ] <title>\`
  curl -s -X POST "${API_BASE}/api/seer/memory-aspect" \\
    -H "Content-Type: application/json" \\
    -d "$(jq -n --arg name "PROJECT_NAME" --arg c "<new lines>" \\
      '{project_name: $name, aspect: "features", content: $c, mode: "append", api_key: "${apiKey}"}')"

Rules:
- If this was a trivial session (just greetings, small questions, nothing built), push ONLY this to session_log and respond: "Session read — nothing significant to capture."
  [${ts}] SESSION READ — nothing significant to capture
- Otherwise respond: "Session captured to online memory — <1-line summary>."
- Be concise. Each bullet is one line max.`;
}

export async function seer_session_read(
  apiKey: string,
  surface: string = "unknown"
): Promise<string> {
  // 1. Validate user
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
  const conflict = await checkTeamConflict(user, "session read");

  // 2. Check plan limit
  const limit = PLAN_LIMITS[user.plan] ?? 0;
  if (user.usage_this_month >= limit) {
    return JSON.stringify({ error: `Limit reached (${user.usage_this_month}/${limit}). Upgrade at seer.ai/upgrade` });
  }

  // 3. Increment usage — 1 call
  await supabase
    .from("users")
    .update({ usage_this_month: user.usage_this_month + 1 })
    .eq("id", user.id);

  // 4. Log the call
  await logSeerCall({
    user_id: user.id,
    raw_input: "seer session read",
    raw_tokens: 0,
    optimized_tokens: 0,
    tokens_saved: 0,
    pct_saved: 0,
    tool_used: "seer_session_read",
    surface,
  });

  // 5. Return the instruction for Claude to execute
  const usageWarning = buildUsageWarning(user.plan, user.usage_this_month + 1, limit);
  const result = appendSuggestInstruction(buildSessionReadInstruction(apiKey), "seer_session_read", "session read", user.suggestion_skin ?? "default", user.auto_suggest, apiKey);
  return conflict.warning + usageWarning + (mfa.nudge ? result + mfa.nudge : result);
}
