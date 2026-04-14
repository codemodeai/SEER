import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { callHaiku, estimateTokens, parseHaikuJson } from "../lib/haiku.js";
import { logSeerCall } from "../lib/logger.js";
import { getEmbedding, searchMemory } from "../lib/embeddings.js";
import { formatRunResult, buildUsageWarning } from "../lib/formatter.js";
import { SECURITY_ANCHOR } from "../lib/security.js";
import { checkNudge } from "../lib/nudge.js";
import { detectReopen } from "../lib/reopen.js";
import { appendMemoryLog } from "../lib/memory-log.js";
import { appendSuggestInstruction } from "../lib/suggest.js";
import { checkMfa, getMfaBlockMessage } from "../lib/mfa.js";
import { scanOutput, logSecurityIncident } from "../lib/security.js";
import { detectMarkDone } from "../lib/mark-done.js";
import { checkTeamConflict } from "../lib/conflict-detect.js";
import { detectCredentials } from "../lib/credential-detect.js";
import { scoreComplexity } from "../lib/complexity.js";
import { seer_tools } from "./seer_tools.js";
import { seer_space } from "./seer_space.js";

const API_BASE = process.env["SEER_WEB_URL"] ?? "https://www.seermcp.com";

// --- Pattern matchers for zero-cost features (no Haiku call) ---

const TOOLS_PATTERN = /^(tools|show tools|list tools|features|show features|what can you do|help)$/i;

const SPACE_PATTERN = /^space\s+(.+)/i;

const CONTINUE_PATTERNS = /^(continue|resume|pick up|where was i|where did i leave off|what's next|whats next)$/i;

const CALLBACK_MEMORY_PATTERNS = /^(what did i do|what have i done|recall|recap|history|show memory|show session|what was my last task|what happened|summary|what did we do|what was i working on|last session|previous session|show progress|what's done|whats done|show tasks|open tasks|what's left|whats left|remaining tasks)$/i;

const RECORD_CREDENTIALS_PATTERN = /^record\s*cred(ential)?s?$/i;

const DOCTOR_PATTERN = /^doctor(\s+--fix)?$/i;

function buildContinueInstruction(apiKey: string): string {
  return `switch to haiku now. this entire response uses haiku only.

SEER INSTRUCTION — Resume from where you left off (online aspect memory)

1. Derive PROJECT_NAME from package.json "name" or current directory name (lowercased, hyphenated).

2. Fetch the project_overview, features, and session_log aspects from online memory:
   curl -s "${API_BASE}/api/seer/memory-aspect?project=PROJECT_NAME&aspects=project_overview,features,session_log" \\
     -H "Authorization: Bearer ${apiKey}"

3. If the API returns empty aspects or an error, respond EXACTLY:
   "No project memory found. Run \`seer memory run\` to initialize."
   and stop.

4. From the response, present a concise resume brief in this format:

---
**SEER — Session Resume**

**Project:** [project name from project_overview]
**Last activity:** [most recent session_log entry]

**Open tasks (from features aspect):**
- [ ] task 1
- [ ] task 2
...

**Recent activity (last 3 session_log entries):**
- [entry 1]
- [entry 2]
- [entry 3]

Ready to continue. What would you like to work on?

---

Rules:
- Be concise — this is a quick resume, not a full report.
- Only include \`- [ ]\` tasks (not \`[x]\`) in the Open tasks section. Max 5.
- Do not invent content not present in the API response.
- After the brief, wait for the user's next instruction.`;
}

function buildCallbackInstruction(query: string, apiKey: string): string {
  return `switch to haiku now. this entire response uses haiku only.

SEER INSTRUCTION — Answer from project memory (online aspect recall)

The user asked: "${query}"

1. Derive PROJECT_NAME from package.json "name" or directory name.
2. Fetch all 6 aspects for the project:
   curl -s "${API_BASE}/api/seer/memory-aspect?project=PROJECT_NAME" \\
     -H "Authorization: Bearer ${apiKey}"
3. If the response is empty or errors, respond: "No project memory found. Run \`seer memory run\` to initialize." and stop.

4. Answer based ONLY on the aspect content returned. Examples:
- "what did I do" / "recall" / "recap" → summarize recent session_log entries
- "what's left" / "open tasks" → list \`- [ ]\` lines from features aspect
- "last session" → summarize most recent session_log entry
- "show progress" → count \`[x]\` vs \`[ ]\` in features aspect

Rules:
- Be concise and direct.
- Do NOT guess or infer beyond what the API returned.
- The session_log append for this call will be handled automatically downstream — do not write it yourself.`;
}

// --- Doctor instruction (health check on SEER setup) ---

function buildDoctorInstruction(apiKey: string, fixMode: boolean, user: { id: string; email: string; plan: string; usage_this_month: number; mfa_verified: boolean; fs_access: boolean; auto_suggest: boolean; suggestion_skin: string }): string {
  const limit = PLAN_LIMITS[user.plan] ?? 0;
  const limitStr = limit === Infinity ? "unlimited" : String(limit);
  const isAgency = user.plan === "agency";

  return `switch to haiku now. this entire response uses haiku only.

SEER INSTRUCTION — Health check on SEER setup${fixMode ? " (--fix mode)" : ""}

Run every check below. For each check, report a status icon and one-line result.
Icons: ✅ = pass, ⚠️ = warning, ❌ = fail

**Pre-loaded values (from server — do NOT re-check these):**
- API key: valid ✅
- Email: ${user.email}
- Plan: ${user.plan}
- Usage: ${user.usage_this_month}/${limitStr}
- MFA: ${user.mfa_verified ? "verified ✅" : "not verified ⚠️"}
- Founder's Space: ${user.fs_access ? "enabled ✅" : "not enabled ⚠️"}
- Auto-suggest: ${user.auto_suggest ? "on" : "off"}
- Suggestion skin: ${user.suggestion_skin}

**Checks to run (you must execute these):**

1. **Project detection** — Check if package.json exists. Read the "name" field. If missing, ❌.

2. **Project memory** — Fetch aspects:
   curl -s "${API_BASE}/api/seer/memory-aspect?project=PROJECT_NAME&aspects=project_overview,features,session_log" \\
     -H "Authorization: Bearer ${apiKey}"
   - If all 3 aspects have content: ✅
   - If some are empty: ⚠️ (list which ones)
   - If API errors or none exist: ❌

3. **Git status** — Run \`git status --short\` and \`git log origin/main..HEAD --oneline 2>/dev/null\`
   - Clean working tree + no unpushed: ✅
   - Uncommitted changes: ⚠️ (count files)
   - Unpushed commits: ⚠️ (count commits)

4. **Environment files** — Check for .env, .env.local, .env.production
   - If .env exists: ✅
   - If .env but not in .gitignore: ❌ (security risk)
   - If no .env: ⚠️

5. **SEER API connectivity** — Run:
   curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/api/seer/memory-aspect?project=_healthcheck&aspects=project_overview" \\
     -H "Authorization: Bearer ${apiKey}"
   - HTTP 200: ✅
   - Any other status: ❌

6. **Founder's Space** — ${user.fs_access ? `Check if user has any credentials or tasks saved:
   curl -s "${API_BASE}/api/founders-space/credentials" \\
     -H "Authorization: Bearer ${apiKey}"
   - Has saved items: ✅
   - Empty but accessible: ⚠️ (no credentials saved yet)
   - Error: ❌` : "Not enabled ⚠️ — available as addon"}

${isAgency ? `7. **Agency team** — Check agency membership:
   curl -s "${API_BASE}/api/agency/members" \\
     -H "Authorization: Bearer ${apiKey}"
   - Team members found: ✅ (show count)
   - No members: ⚠️
   - Error: ❌

8. **Webhooks** — Check webhook configuration:
   curl -s "${API_BASE}/api/agency/webhooks" \\
     -H "Authorization: Bearer ${apiKey}"
   - Webhooks configured: ✅ (show count)
   - No webhooks: ⚠️ (optional feature)
   - Error: ❌` : ""}

**Output format:**

---
**🩺 SEER Doctor — Health Check**

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | API Key | ✅ | Valid, ${user.plan} plan |
| 2 | Usage | ${user.usage_this_month >= (limit === Infinity ? Infinity : limit * 0.9) ? "⚠️" : "✅"} | ${user.usage_this_month}/${limitStr} calls used |
| 3 | MFA | ${user.mfa_verified ? "✅" : "⚠️"} | ${user.mfa_verified ? "Verified" : "Not verified"} |
| 4 | Project | [result] | [detail] |
| 5 | Memory | [result] | [detail] |
| 6 | Git | [result] | [detail] |
| 7 | Env files | [result] | [detail] |
| 8 | API connection | [result] | [detail] |
| 9 | Founder's Space | [result] | [detail] |
${isAgency ? "| 10 | Agency team | [result] | [detail] |\n| 11 | Webhooks | [result] | [detail] |" : ""}

**Score: [N]/${isAgency ? "11" : "9"} passed** | [M] warnings | [K] failures

---

${fixMode ? `**--fix mode: For every ⚠️ or ❌, output the exact command to fix it.**

Fix format — one per issue, no explanations:

---
**🔧 SEER Doctor — Fixes**

[For each issue:]
**[Check name]** — [one-line problem]
\\\`\\\`\\\`
[exact command to run]
\\\`\\\`\\\`

---

Fix commands reference:
- Memory not initialized → \`seer memory run\`
- MFA not verified → \`seer mfa setup\`
- .env not in .gitignore → \`echo ".env*" >> .gitignore\`
- Uncommitted changes → \`git add -A && git commit -m "commit message"\`
- Unpushed commits → \`git push origin main\`
- Founder's Space not enabled → "Enable at seermcp.com/dashboard/founders-space"
- No credentials saved → \`seer record credentials\`
- No webhooks → "Configure at seermcp.com/dashboard/agency/webhooks"
` : ""}

Rules:
- Run ALL checks — do not skip any.
- Be concise. One-line per check result.
- Do NOT invent data. Only report what the checks actually return.
- After the table, wait for user's next instruction.`;
}

// --- Record credentials instruction (scans project files for credentials → saves to Founder's Space) ---

const RECORD_CREDENTIALS_INSTRUCTION = `SEER INSTRUCTION — Scan project files for credentials and save them to Founder's Space

You will scan the user's project for credential files, extract all credentials, and batch-save them to the encrypted Founder's Space vault.

**STEP 1 — Find credential files**

Use the Glob tool to find these files in the project root:
- \`.env\`, \`.env.local\`, \`.env.development\`, \`.env.production\`, \`.env.staging\`, \`.env.test\`
- \`.env.example\` (skip this — it usually has placeholder values)
- Any file matching \`*.env\`, \`.env.*\` (except \`.env.example\`, \`.env.sample\`, \`.env.template\`)
- \`docker-compose.yml\`, \`docker-compose.yaml\` (may contain environment variables)

**STEP 2 — Read and extract credentials**

For each file found, read its contents and extract key=value pairs where the key suggests a credential:
- Keys containing: API_KEY, SECRET, TOKEN, PASSWORD, PASS, PWD, AUTH, CREDENTIAL, ACCESS_KEY, PRIVATE_KEY, CLIENT_SECRET, APP_SECRET, WEBHOOK_SECRET, SIGNING_SECRET, ENCRYPTION_KEY, DATABASE_URL, REDIS_URL, MONGODB_URI, CONNECTION_STRING
- Provider-specific values: \`sk_live_\`, \`sk_test_\`, \`pk_live_\`, \`AKIA\`, \`sk-\`, \`ghp_\`, \`github_pat_\`, \`SG.\`, \`re_\`, \`rzp_\`, \`AIza\`, \`eyJhbGci\`
- Connection strings: \`mongodb://\`, \`postgres://\`, \`mysql://\`, \`redis://\`, \`amqp://\`

**Skip these:**
- Empty values, placeholder values (\`your_key_here\`, \`xxx\`, \`changeme\`, \`TODO\`, \`REPLACE_ME\`, \`<your-key>\`)
- Comments (lines starting with #)
- SEER's own API key (\`sk-seer-*\`)
- Keys that are clearly non-sensitive: \`NODE_ENV\`, \`PORT\`, \`HOST\`, \`NEXT_PUBLIC_*\` (unless they contain a real secret value)

**STEP 3 — Detect environment**

For each credential, determine the environment:
- If from \`.env.production\` → production
- If from \`.env.development\` or \`.env.local\` → development
- If from \`.env.staging\` → staging
- If value starts with \`sk_test_\`, \`rzp_test_\`, \`pk_test_\` → development
- Default → production

**STEP 4 — Present findings and confirm**

Display to the user:

---
**🔐 SEER — Credential Scan Results**

Found **[N]** credentials across **[M]** files:

| # | Label | Environment | Source File |
|---|-------|-------------|-------------|
| 1 | STRIPE_SECRET_KEY | production | .env |
| 2 | DATABASE_URL | development | .env.local |
| ... | ... | ... | ... |

**Save all [N] credentials to Founder's Space?** (AES-256-GCM encrypted)
- Type **yes** to save all
- Type the numbers to save specific ones (e.g., "1, 3, 5")
- Type **no** to cancel

> Credentials will be auto-assigned to your most recent Founder's Space project.
> Values are encrypted and NEVER displayed in the terminal after saving.

---

**STEP 5 — Save on confirmation**

When the user confirms:
- For "yes" / "all" / "save" / "go ahead": save ALL found credentials
- For specific numbers: save only those credentials
- For "no" / "cancel" / "skip": cancel and do nothing

To save each credential, call the seer_run MCP tool with input:
\`space save key LABEL=value --env [environment]\`

Save them one by one. After all saves complete, display:

---
**✅ Saved [N] credentials to Founder's Space**

All credentials are AES-256-GCM encrypted. View and manage them at:
seermcp.com/dashboard/founders-space

---

**Rules:**
- NEVER display credential values in full — mask them (show first 4 + last 4 chars, e.g., \`sk_l...xY9z\`)
- If no credential files are found, say: "No credential files found in this project. Create a \`.env\` file or use \`seer space save key LABEL=value\` to save credentials manually."
- If no credentials are found in the files, say: "Found credential files but no secrets detected. All values appear to be placeholders or non-sensitive."
- Do NOT save the same credential twice — if a label already exists in Founder's Space, skip it and note "(already saved)"
- After saving, wait for user's next instruction`;

// --- System prompts for Haiku compression ---

const SYSTEM_PROMPT = `You are SEER, a prompt compressor. Rewrite the prompt to be shorter and more precise. NEVER make it longer.

Rules:
- Remove ALL filler words, pleasantries, and redundancy
- Use concise technical language
- Keep the SAME intent — do not add new requirements
- Short prompts stay short — just make them more precise
- The output MUST have FEWER words than the input

Return ONLY JSON: { "optimized": "...", "steps": ["step1", "step2", ...], "note": "..." }
${SECURITY_ANCHOR}`;

const SYSTEM_PROMPT_WITH_CONTEXT = `You are SEER, a prompt compressor with project context. Rewrite the prompt to be shorter and more precise. NEVER make it longer.

Rules:
- Remove ALL filler words, pleasantries, and redundancy
- Use concise technical language — leverage project context for precision
- Keep the SAME intent — do not add new requirements
- The output MUST have FEWER words than the input

Return ONLY JSON: { "optimized": "...", "steps": ["step1", "step2", ...], "note": "...", "context_used": true }
${SECURITY_ANCHOR}`;

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

  const trimmedInput = input.trim();

  // 1b. Route "seer tools" — zero Haiku cost, no usage increment
  if (TOOLS_PATTERN.test(trimmedInput)) {
    return seer_tools(apiKey);
  }

  // 1b2. Route "seer space ..." — delegate to seer_space tool
  const spaceMatch = SPACE_PATTERN.exec(trimmedInput);
  if (spaceMatch) {
    return seer_space(spaceMatch[1], apiKey, surface);
  }

  // 1c. MFA enforcement — one-time auth, soft nudge every 5, hard block at 20
  const mfa = await checkMfa(user);
  if (mfa.blocked) {
    return getMfaBlockMessage();
  }

  // 1c2. Team conflict detection — instant server-side check
  const conflict = await checkTeamConflict(user, trimmedInput);

  // 1d. Route "seer continue" — 1 call, no Haiku cost
  if (CONTINUE_PATTERNS.test(trimmedInput)) {
    const limit = PLAN_LIMITS[user.plan] ?? 0;
    if (user.usage_this_month >= limit) {
      return JSON.stringify({ error: `Limit reached (${user.usage_this_month}/${limit}). Upgrade at seer.ai/upgrade` });
    }
    await supabase.from("users").update({ usage_this_month: user.usage_this_month + 1 }).eq("id", user.id);
    await logSeerCall({
      user_id: user.id,
      raw_input: trimmedInput,
      raw_tokens: 0,
      optimized_tokens: 0,
      tokens_saved: 0,
      pct_saved: 0,
      tool_used: "seer_continue",
      surface,
    });
    const usageWarning = buildUsageWarning(user.plan, user.usage_this_month + 1, limit);
    const continueResult = appendSuggestInstruction(buildContinueInstruction(apiKey), "seer_continue", trimmedInput, user.suggestion_skin, user.auto_suggest, apiKey);
    return conflict.warning + usageWarning + (mfa.nudge ? continueResult + mfa.nudge : continueResult);
  }

  // 1e. Route callback memory recall — 1 call, no Haiku cost
  if (CALLBACK_MEMORY_PATTERNS.test(trimmedInput)) {
    const limit = PLAN_LIMITS[user.plan] ?? 0;
    if (user.usage_this_month >= limit) {
      return JSON.stringify({ error: `Limit reached (${user.usage_this_month}/${limit}). Upgrade at seer.ai/upgrade` });
    }
    await supabase.from("users").update({ usage_this_month: user.usage_this_month + 1 }).eq("id", user.id);
    await logSeerCall({
      user_id: user.id,
      raw_input: trimmedInput,
      raw_tokens: 0,
      optimized_tokens: 0,
      tokens_saved: 0,
      pct_saved: 0,
      tool_used: "seer_callback_memory",
      surface,
    });
    const usageWarning = buildUsageWarning(user.plan, user.usage_this_month + 1, limit);
    const instruction = buildCallbackInstruction(trimmedInput, apiKey);
    const callbackResult = appendSuggestInstruction(instruction, "seer_callback_memory", trimmedInput, user.suggestion_skin, user.auto_suggest, apiKey);
    return conflict.warning + usageWarning + (mfa.nudge ? callbackResult + mfa.nudge : callbackResult);
  }

  // 1f. Route "seer record credentials" — 1 call, no Haiku cost
  if (RECORD_CREDENTIALS_PATTERN.test(trimmedInput)) {
    const limit = PLAN_LIMITS[user.plan] ?? 0;
    if (user.usage_this_month >= limit) {
      return JSON.stringify({ error: `Limit reached (${user.usage_this_month}/${limit}). Upgrade at seer.ai/upgrade` });
    }

    // Check fs_access — requires Founder's Space
    if (!user.fs_access) {
      const addon = user.plan === "starter"
        ? "Add it for $1/mo: seermcp.com/dashboard/founders-space"
        : user.plan === "free"
          ? "Available on Starter ($8/mo + $1/mo addon), Pro ($19/mo, included), or Agency ($39/mo, included)."
          : "Your plan includes it — contact support to enable.";
      return `**Error:** Founder's Space is required for credential recording.\n\n${addon}`;
    }

    await supabase.from("users").update({ usage_this_month: user.usage_this_month + 1 }).eq("id", user.id);
    await logSeerCall({
      user_id: user.id,
      raw_input: trimmedInput,
      raw_tokens: 0,
      optimized_tokens: 0,
      tokens_saved: 0,
      pct_saved: 0,
      tool_used: "seer_record_credentials",
      surface,
    });
    const usageWarning = buildUsageWarning(user.plan, user.usage_this_month + 1, limit);
    const recordResult = appendSuggestInstruction(RECORD_CREDENTIALS_INSTRUCTION, "seer_record_credentials", trimmedInput, user.suggestion_skin, user.auto_suggest, apiKey);
    return appendMemoryLog(conflict.warning + usageWarning + (mfa.nudge ? recordResult + mfa.nudge : recordResult), "seer_record_credentials", trimmedInput, user.suggestion_skin, user.auto_suggest, apiKey);
  }

  // 1g. Route "seer doctor" / "seer doctor --fix" — 1 call, no Haiku cost
  const doctorMatch = DOCTOR_PATTERN.exec(trimmedInput);
  if (doctorMatch) {
    const limit = PLAN_LIMITS[user.plan] ?? 0;
    if (user.usage_this_month >= limit) {
      return JSON.stringify({ error: `Limit reached (${user.usage_this_month}/${limit}). Upgrade at seer.ai/upgrade` });
    }

    const fixMode = !!doctorMatch[1]; // --fix flag present
    await supabase.from("users").update({ usage_this_month: user.usage_this_month + 1 }).eq("id", user.id);
    await logSeerCall({
      user_id: user.id,
      raw_input: trimmedInput,
      raw_tokens: 0,
      optimized_tokens: 0,
      tokens_saved: 0,
      pct_saved: 0,
      tool_used: "seer_doctor",
      surface,
    });
    const usageWarning = buildUsageWarning(user.plan, user.usage_this_month + 1, limit);
    const doctorInstruction = buildDoctorInstruction(apiKey, fixMode, user);
    const doctorResult = appendSuggestInstruction(doctorInstruction, "seer_doctor", trimmedInput, user.suggestion_skin, user.auto_suggest, apiKey);
    return conflict.warning + usageWarning + (mfa.nudge ? doctorResult + mfa.nudge : doctorResult);
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
  let completedTasks: string[] = [];
  let openTasks: string[] = [];
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

          // Extract completed tasks for re-open detection
          // Extract open tasks for mark-done detection
          for (const m of memories) {
            const completedMatches = m.content.match(/- \[x\] (.+)/gi);
            if (completedMatches) {
              completedTasks.push(
                ...completedMatches.map((match) => match.replace(/- \[x\] /i, "").trim())
              );
            }
            const openMatches = m.content.match(/- \[ \] (.+)/gi);
            if (openMatches) {
              openTasks.push(
                ...openMatches.map((match) => match.replace(/- \[ \] /i, "").trim())
              );
            }
          }
        }
      }
    } catch {
      // Memory injection is best-effort — don't block the call
    }
  }

  // 4b. Re-open detection — check if input touches a completed task
  if (completedTasks.length > 0) {
    const reopen = detectReopen(input, completedTasks, apiKey);
    if (reopen.shouldReopen) {
      return reopen.reopenPrompt!;
    }
  }

  // 4c. Smart Token Allocation — score complexity and assign dynamic token budget
  const complexity = scoreComplexity(input);

  // 5. Call Haiku using SEER's own key with dynamic token budget
  const useContext = contextSnippet.length > 0;
  let resultText: string;
  try {
    resultText = await callHaiku({
      systemPrompt: useContext ? SYSTEM_PROMPT_WITH_CONTEXT : SYSTEM_PROMPT,
      userInput: useContext ? input + contextSnippet : input,
      maxTokens: complexity.maxTokens,
    });
  } catch (err) {
    return JSON.stringify({
      error: "Optimization failed. Please try again.",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }

  // 5a. Scan Haiku output for dangerous content (before appending trusted SEER instructions)
  const outputCheck = scanOutput(resultText);
  if (!outputCheck.safe) {
    await logSecurityIncident({
      event_type: "output_danger",
      source: "mcp",
      user_id: user.id,
      metadata: { tool: "seer_run", threat: outputCheck.threat },
    });
    return JSON.stringify({ error: "Request could not be processed." });
  }

  // 5. Parse result and compute token savings
  const rawTokens = estimateTokens(input);
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

  // 7. Return formatted result
  const usageWarning = buildUsageWarning(user.plan, user.usage_this_month + 1, limit);
  let finalResult: string;
  if (parsed) {
    finalResult = formatRunResult({
      ...parsed,
      _meta: {
        raw_tokens: rawTokens,
        optimized_tokens: optimizedTokens,
        tokens_saved: tokensSaved,
        pct_saved: pctSaved,
        usage: `${user.usage_this_month + 1}/${limit === Infinity ? "unlimited" : limit}`,
        complexity_score: complexity.score,
        token_budget: complexity.maxTokens,
        complexity_signals: complexity.signals,
      },
    });
  } else {
    finalResult = resultText;
  }

  // 8. Smart keyword nudge — suggest seer session read if not using seer
  try {
    const nudge = await checkNudge(input, user.id, user.last_nudge_at);
    if (nudge.shouldNudge && nudge.nudgeText) {
      finalResult += "\n\n" + nudge.nudgeText;
    }
  } catch {
    // Nudge is best-effort
  }

  // 9. Append MFA nudge if applicable
  if (mfa.nudge) {
    finalResult += mfa.nudge;
  }

  // 10. Feature-completion "mark done?" prompt
  if (openTasks.length > 0) {
    const markDone = detectMarkDone(input, openTasks, apiKey);
    if (markDone.shouldPrompt && markDone.markDoneInstruction) {
      finalResult += markDone.markDoneInstruction;
    }
  }

  // 11. Credential auto-detection — suggest saving to Seer Space
  const credDetect = detectCredentials(input);
  if (credDetect.found) {
    finalResult += credDetect.suggestion;
  }

  return appendMemoryLog(conflict.warning + usageWarning + finalResult, "seer_run", input, user.suggestion_skin, user.auto_suggest, apiKey);
}
