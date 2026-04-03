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
import { detectMarkDone } from "../lib/mark-done.js";
import { checkTeamConflict } from "../lib/conflict-detect.js";
import { seer_tools } from "./seer_tools.js";

// --- Pattern matchers for zero-cost features (no Haiku call) ---

const TOOLS_PATTERN = /^(tools|show tools|list tools|features|show features|what can you do|help)$/i;

const CONTINUE_PATTERNS = /^(continue|resume|pick up|where was i|where did i leave off|what's next|whats next)$/i;

const CALLBACK_MEMORY_PATTERNS = /^(what did i do|what have i done|recall|recap|history|show memory|show session|what was my last task|what happened|summary|what did we do|what was i working on|last session|previous session|show progress|what's done|whats done|show tasks|open tasks|what's left|whats left|remaining tasks)$/i;

const CONTINUE_INSTRUCTION = `SEER INSTRUCTION — Resume from where you left off

Read .seer_memory.md from the project root. Then present a concise resume brief:

1. **Last session:** What was last completed (from "## 2. Current Status" → last_completed)
2. **Next action:** The planned next step (from "## 2. Current Status" → next_action)
3. **Open tasks:** List uncompleted [ ] tasks from "## 4. Open Tasks" (max 5)
4. **Recent log:** Last 3 entries from "## 5. Session Log"

Format your response as:

---
**SEER — Session Resume**

**Last completed:** [last_completed value]
**Planned next:** [next_action value]

**Open tasks:**
- [ ] task 1
- [ ] task 2
...

**Recent activity:**
- [log entry 1]
- [log entry 2]
- [log entry 3]

Ready to continue. What would you like to work on?

---

Rules:
- If .seer_memory.md does NOT exist, respond: "No memory file found. Run \`seer memory run\` first to initialize project memory."
- Be concise — this is a quick resume, not a full report
- After presenting the brief, wait for the user's next instruction`;

function buildCallbackInstruction(query: string): string {
  const timestamp = new Date().toISOString().slice(0, 16) + "Z";
  return `SEER INSTRUCTION — Answer from project memory (callback recall)

The user asked: "${query}"

Read .seer_memory.md from the project root. Search ALL sections to answer the user's question:

- "## 2. Current Status" — for last completed work, next planned action, current phase
- "## 4. Open Tasks" — for completed [x] and pending [ ] tasks
- "## 5. Session Log" — for chronological history of what was done and when
- "## 1. Project Overview" — for project name, goal, stack
- "## 3. Architecture Decisions" — for technical decisions

Respond naturally and concisely based on what the memory file contains. Examples:
- "what did I do" → summarize recent Session Log entries
- "recall" / "recap" → give a full status overview
- "what's left" / "open tasks" → list uncompleted [ ] tasks
- "last session" → summarize the most recent Session Log entry
- "show progress" → show completed [x] vs remaining [ ] tasks

Rules:
- If .seer_memory.md does NOT exist, respond: "No memory file found. Run \`seer memory run\` first to initialize project memory."
- Answer ONLY from what's in the memory file — do not guess or infer beyond its contents
- Be concise and direct

After answering, also update .seer_memory.md:
1. Append under "## 5. Session Log": [${timestamp}] seer_callback_memory — ${query}
2. Update "## 2. Current Status" → last_updated to ${timestamp}`;
}

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
    const continueResult = appendSuggestInstruction(CONTINUE_INSTRUCTION, "seer_continue", trimmedInput, user.suggestion_skin, user.auto_suggest);
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
    const instruction = buildCallbackInstruction(trimmedInput);
    const callbackResult = appendSuggestInstruction(instruction, "seer_callback_memory", trimmedInput, user.suggestion_skin, user.auto_suggest);
    return conflict.warning + usageWarning + (mfa.nudge ? callbackResult + mfa.nudge : callbackResult);
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
    const reopen = detectReopen(input, completedTasks);
    if (reopen.shouldReopen) {
      return reopen.reopenPrompt!;
    }
  }

  // 5. Call Haiku using SEER's own key
  const useContext = contextSnippet.length > 0;
  let resultText: string;
  try {
    resultText = await callHaiku({
      systemPrompt: useContext ? SYSTEM_PROMPT_WITH_CONTEXT : SYSTEM_PROMPT,
      userInput: useContext ? input + contextSnippet : input,
    });
  } catch (err) {
    return JSON.stringify({
      error: "Optimization failed. Please try again.",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
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
    const markDone = detectMarkDone(input, openTasks);
    if (markDone.shouldPrompt && markDone.markDoneInstruction) {
      finalResult += markDone.markDoneInstruction;
    }
  }

  return appendMemoryLog(conflict.warning + usageWarning + finalResult, "seer_run", input, user.suggestion_skin, user.auto_suggest, apiKey);
}
