import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { logSeerCall } from "../lib/logger.js";
import { appendSuggestInstruction } from "../lib/suggest.js";
import { checkMfa, getMfaBlockMessage } from "../lib/mfa.js";

const SESSION_READ_INSTRUCTION = `SEER INSTRUCTION — Read and capture this session to .seer_memory.md

Read your full conversation above. Summarise what was done and write to .seer_memory.md.

Write the following structure — append to the file if it already exists, do not overwrite:

## 5. Session Log
[${new Date().toISOString().slice(0, 16)}Z] SESSION READ — non-seer session captured
  Built: [list what was built or changed]
  Decided: [list any decisions made, or "none"]
  Completed: [what is now done end-to-end]
  Next: [most logical next step]

Also update these sections if they exist:

## 2. Current Status
last_completed: [most recent completed task from this session]
next_action: [next logical step]

## 4. Open Tasks
- Mark any completed tasks with [x]
- Add any new tasks discovered as [ ]

Rules:
- If this was a trivial session (just greetings, small questions, nothing built), write:
  [TIMESTAMP] SESSION READ — nothing significant to capture
    Session contained only questions and brief answers.
    No tasks completed. No decisions made. Memory file unchanged.
  And respond: "Session read complete — nothing significant to capture from this session. Your memory file is unchanged."
- Otherwise respond: "Session captured. [brief summary of what was written]. Your memory file is up to date."
- Be concise. Each "Built" or "Decided" item should be one line.`;

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
  const result = appendSuggestInstruction(SESSION_READ_INSTRUCTION, "seer_session_read", "session read", user.suggestion_skin ?? "default");
  return mfa.nudge ? result + mfa.nudge : result;
}
