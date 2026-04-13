// Auto-suggestion instruction appended to seer tool responses.
// After Claude finishes executing the seer command, it presents
// contextual next-step suggestions the user can select.
// Zero Haiku cost — Claude generates suggestions using user's own API key.
//
// Skins:
//   default  — 3-5 suggestions with full context reading (original)
//   compact  — 3 suggestions, minimal formatting, one-liner block
//   focused  — 1 top-priority suggestion only

export type SuggestionSkin = "default" | "compact" | "focused";

const API_BASE = process.env["SEER_WEB_URL"] ?? "https://seermcp.com";

const SHARED_RULES = `Rules for generating suggestions:
- Each suggestion must start with "seer " so the user can copy-paste it directly
- PRIORITIZE open tasks from the features aspect (\`- [ ]\` lines) — at least 1 suggestion should come from those
- Remaining suggestions should be contextual to what was just built/changed
- Keep each suggestion under 12 words after "seer "
- If the task was a build/feature: suggest testing, related open tasks, edge cases
- If the task was a fix: suggest verifying, regression testing, next open task
- Do NOT suggest already-completed tasks (\`- [x]\` entries)
- Do NOT suggest "seer status", "seer session read", or "seer memory run"
- If the memory API returns empty or errors, generate suggestions purely from what was just done
- Present this AFTER all work is complete, not before
- CRITICAL: If the session_log aspect shows "PLAN-ADAPT:" entries, adapt suggestions to the user's ACTUAL trajectory — do not blindly follow the old plan
- Blend remaining open tasks WITH the user's recent direction: at least 1 suggestion should continue what the user chose to work on, and at least 1 should reference a remaining open task (if any exist)
- NEVER stop suggesting just because the user deviated from the plan — always generate suggestions`;

function buildMemoryFetchSteps(apiKey: string): string {
  return `STEP A — Derive PROJECT_NAME from package.json "name" or directory name.
STEP B — Fetch features + session_log aspects:
   curl -s "${API_BASE}/api/seer/memory-aspect?project=PROJECT_NAME&aspects=features,session_log" \\
     -H "Authorization: Bearer ${apiKey}"
STEP C — Parse the response:
   - Open tasks = \`- [ ]\` lines from the features aspect
   - PLAN-ADAPT deviations = any session_log lines containing "PLAN-ADAPT:"
   - If API errors or aspects are empty, skip parsing and suggest purely from the current task.`;
}

function defaultSkin(apiKey: string): string {
  return `
---
SEER AUTO-SUGGEST — After you finish ALL work from the above instructions, present next-step suggestions.

${buildMemoryFetchSteps(apiKey)}

STEP D — Based on what you just completed PLUS the memory context (adjusted for deviations), generate 3-5 suggestions.

Display them in this EXACT format:

---
**What's next?** Pick one or type your own:

1. \`seer <suggestion 1>\`
2. \`seer <suggestion 2>\`
3. \`seer <suggestion 3>\`
4. \`seer <suggestion 4>\`
5. \`seer <suggestion 5>\`

---

${SHARED_RULES}`;
}

function compactSkin(apiKey: string): string {
  return `
---
SEER AUTO-SUGGEST — After ALL work is complete, show 3 quick suggestions.

${buildMemoryFetchSteps(apiKey)}

Display in this EXACT format:

---
**Next:** \`seer <1>\` | \`seer <2>\` | \`seer <3>\`

---

${SHARED_RULES}`;
}

function focusedSkin(apiKey: string): string {
  return `
---
SEER AUTO-SUGGEST — After ALL work is complete, show the single best next step.

${buildMemoryFetchSteps(apiKey)}

Display in this EXACT format:

---
**Next:** \`seer <suggestion>\`

---

${SHARED_RULES}`;
}

export function appendSuggestInstruction(
  toolResult: string,
  _toolName: string,
  _userInput: string,
  skin: SuggestionSkin = "default",
  autoSuggest: boolean = true,
  apiKey: string = ""
): string {
  if (!autoSuggest) {
    return toolResult;
  }

  let instruction: string;
  switch (skin) {
    case "compact":
      instruction = compactSkin(apiKey);
      break;
    case "focused":
      instruction = focusedSkin(apiKey);
      break;
    default:
      instruction = defaultSkin(apiKey);
      break;
  }

  return toolResult + instruction;
}
