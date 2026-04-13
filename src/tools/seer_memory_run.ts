import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { logSeerCall } from "../lib/logger.js";
import { buildUsageWarning } from "../lib/formatter.js";
import { appendSuggestInstruction } from "../lib/suggest.js";
import { checkMfa, getMfaBlockMessage } from "../lib/mfa.js";
import { checkTeamConflict } from "../lib/conflict-detect.js";

const API_BASE = process.env["SEER_WEB_URL"] ?? "https://seermcp.com";

function buildMemoryRunInstruction(apiKey: string): string {
  return `switch to sonnet now. this entire response uses sonnet only.

SEER INSTRUCTION — Initialize project memory (6 aspect files)

Do NOT create any local file. SEER memory is online-only. All 6 aspect files live in Supabase — never on disk.

STEP 1 — Scan the project silently:
- Read package.json (or pyproject.toml / go.mod / Cargo.toml if present)
- Read README / README.md if present
- List top-level directories only (src, app, lib, api, web, etc.) — do NOT recurse deeply
- Skim recent git log (last 20 commits): \`git log --oneline -n 20\`
- Identify stack, goals, key architectural patterns, and recent work

STEP 2 — Derive the canonical PROJECT_NAME:
- Prefer \`package.json\` "name" field
- Fall back to current directory name (last segment of pwd)
- Sanitize: lowercase, replace spaces with hyphens
- You will reuse this name in every upsert below.

STEP 3 — Build content for each of the 6 aspect files. Be accurate; only write what you can confirm.

1) project_overview  — Stack, goals, core context, tech decisions (short — 10-15 lines max)
2) architecture     — Schema, services, API contracts, code structure
3) features         — Feature specs, status (built / in-progress / planned), pending work
4) decisions        — Key architectural decisions with WHY and approximate date
5) errors_fixes     — What broke and how it was fixed. Leave as "(none recorded yet)" if no visible history.
6) session_log      — Start with one entry: \`[<current ISO timestamp>] MEMORY INITIALIZED — project scanned\`

STEP 4 — Upsert each aspect via the memory-aspect API. Run these SIX curl commands sequentially. Replace PROJECT_NAME_HERE with the name from step 2 and CONTENT_HERE with each aspect's content.

for ASPECT in project_overview architecture features decisions errors_fixes session_log; do
  curl -s -X POST "${API_BASE}/api/seer/memory-aspect" \\
    -H "Content-Type: application/json" \\
    -d "$(jq -n \\
      --arg name "PROJECT_NAME_HERE" \\
      --arg aspect "$ASPECT" \\
      --arg content "CONTENT_FOR_$ASPECT" \\
      '{project_name: $name, aspect: $aspect, content: $content, mode: "replace", api_key: "${apiKey}"}')"
done

Write the actual bash loop inline with each aspect's real content — do not use the placeholder loop above literally. Call the endpoint once per aspect.

STEP 5 — Also create a Founder's Space project for credentials/tasks linkage:
\`seer space new project PROJECT_NAME_HERE\`
(If the project already exists, ignore the error.)

STEP 6 — Respond to the user with exactly:
"SEER memory initialized online — 6 aspect files populated for **PROJECT_NAME_HERE**. Use \`seer resume\` after /clear to reload, or \`seer memory\` to inspect."

Rules:
- NEVER write .seer_memory.md or any local memory file. Online only.
- Do NOT invent features or decisions — only record what's visible in the code.
- Keep each aspect under 10KB. Use concise bullet lists.
- Do NOT include secrets, API keys, or .env values in any aspect content.`;
}

export async function seer_memory_run(
  apiKey: string,
  surface: string = "unknown"
): Promise<string> {
  const user = await authenticateUser(apiKey);
  if (!user) {
    return JSON.stringify({ error: "Invalid SEER key. Visit seer.ai" });
  }

  const mfa = await checkMfa(user);
  if (mfa.blocked) {
    return getMfaBlockMessage();
  }

  const conflict = await checkTeamConflict(user, "memory run");

  const limit = PLAN_LIMITS[user.plan] ?? 0;
  if (user.usage_this_month >= limit) {
    return JSON.stringify({ error: `Limit reached (${user.usage_this_month}/${limit}). Upgrade at seer.ai/upgrade` });
  }

  await supabase
    .from("users")
    .update({ usage_this_month: user.usage_this_month + 1 })
    .eq("id", user.id);

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

  const usageWarning = buildUsageWarning(user.plan, user.usage_this_month + 1, limit);
  const instruction = buildMemoryRunInstruction(apiKey);
  const result = appendSuggestInstruction(
    instruction,
    "seer_memory_run",
    "memory run",
    user.suggestion_skin ?? "default",
    user.auto_suggest,
    apiKey
  );
  return conflict.warning + usageWarning + (mfa.nudge ? result + mfa.nudge : result);
}
