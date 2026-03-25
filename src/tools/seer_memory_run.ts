import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { logSeerCall } from "../lib/logger.js";
import { appendSuggestInstruction } from "../lib/suggest.js";
import { checkMfa, getMfaBlockMessage } from "../lib/mfa.js";

const MEMORY_RUN_INSTRUCTION = `SEER INSTRUCTION — Create .seer_memory.md for this project

Read the project structure, key files, and recent git history. Then create a file called .seer_memory.md in the project root with this exact structure:

\`\`\`markdown
# SEER Project Memory — auto-managed by SEER. Do not edit manually.

## 1. Project Overview
name: [project name from package.json or directory name]
goal: [one-line description of what this project does — infer from README, code, or structure]
stack: [main languages, frameworks, services — e.g. TypeScript / Next.js / Supabase / Vercel]

## 2. Current Status
last_updated: [current ISO timestamp]
phase: [infer from code maturity — e.g. "Build — early", "Build — mid", "Pre-launch", "Production"]
last_completed: [most recent meaningful work visible in git log or code]
next_action: [most logical next step based on TODOs, open issues, or incomplete code]

## 3. Architecture Decisions
- [list 3-5 key architectural decisions visible from the code — e.g. "Remote HTTP MCP on Vercel (not stdio)", "Supabase for auth + database", "Haiku for AI calls"]

## 4. Open Tasks
- [ ] [task 1 — infer from TODOs, incomplete features, or obvious next steps]
- [ ] [task 2]
- [ ] [task 3]

## 5. Session Log
[current ISO timestamp] MEMORY INITIALIZED — project scanned and memory file created

## 6. Integrity
hash: (post-launch — not yet implemented)
\`\`\`

Rules:
- Read package.json, README, src/ structure, and recent git log to fill in the details
- Be accurate — only write what you can confirm from the code
- Keep each field concise — one line per item
- Open Tasks should reflect real incomplete work, not guesses
- If a .gitignore exists, check if .seer_memory.md is listed. If NOT, print a one-line warning: "Note: .seer_memory.md is not in .gitignore. Add it if you want to keep it private, or leave it for team sharing via git."
- After creating the file, respond: "SEER memory initialized. Your project memory is now active. Use \`seer continue\` at the start of any session to resume from where you left off."`;

export async function seer_memory_run(
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
    raw_input: "seer memory run",
    raw_tokens: 0,
    optimized_tokens: 0,
    tokens_saved: 0,
    pct_saved: 0,
    tool_used: "seer_memory_run",
    surface,
  });

  // 5. Return instruction for Claude to execute
  const result = appendSuggestInstruction(MEMORY_RUN_INSTRUCTION, "seer_memory_run", "memory run", user.suggestion_skin ?? "default", user.auto_suggest);
  return mfa.nudge ? result + mfa.nudge : result;
}
