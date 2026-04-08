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

const SHARED_RULES = `Rules for generating suggestions:
- Each suggestion must start with "seer " so the user can copy-paste it directly
- PRIORITIZE open tasks from .seer_memory.md — at least 1 suggestion should come from the open task list or next_action
- Remaining suggestions should be contextual to what was just built/changed
- Keep each suggestion under 12 words after "seer "
- If the task was a build/feature: suggest testing, related open tasks, edge cases
- If the task was a fix: suggest verifying, regression testing, next open task
- Do NOT suggest already-completed tasks (marked [x] in memory)
- Do NOT suggest "seer status", "seer session read", or "seer memory run"
- If .seer_memory.md doesn't exist, generate suggestions purely from what was just done
- Present this AFTER all work is complete, not before
- CRITICAL: If the Session Log shows the user deviated from the plan (entries with "PLAN-ADAPT:" or "(user-directed)" tasks), adapt suggestions to the user's ACTUAL trajectory — do not blindly follow the old plan
- Blend remaining open tasks WITH the user's recent direction: at least 1 suggestion should continue what the user chose to work on, and at least 1 should reference a remaining open task (if any exist)
- NEVER stop suggesting just because the user deviated from the plan — always generate suggestions
- If all open tasks seem stale (user has been working on unrelated things for 3+ recent session log entries), generate suggestions based purely on recent session log activity`;

function defaultSkin(): string {
  return `
---
SEER AUTO-SUGGEST — After you finish ALL work from the above instructions, present next-step suggestions.

STEP 1: Read .seer_memory.md from the project root (if it exists). Pay attention to:
- "## 4. Open Tasks" — uncompleted [ ] tasks are high-priority suggestions
- "## 2. Current Status" → next_action — this is the planned next step
- "## 5. Session Log" — recent work AND any "PLAN-ADAPT:" entries that show the user went off-plan

STEP 2: Check for plan deviation. If the Session Log contains "PLAN-ADAPT:" entries or "## 4. Open Tasks" contains "(user-directed)" items, the user has gone off-plan. Weight your suggestions toward the user's actual recent work direction, not the original plan order.

STEP 3: Based on BOTH what you just completed AND the memory file context (adjusted for any deviations), generate 3-5 suggestions.

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

function compactSkin(): string {
  return `
---
SEER AUTO-SUGGEST — After ALL work is complete, show 3 quick suggestions.

Read .seer_memory.md (if it exists) for open tasks, next_action, and session log. If session log shows plan deviations (PLAN-ADAPT entries), prioritize the user's actual direction over the old plan. Generate 3 suggestions.

Display in this EXACT format:

---
**Next:** \`seer <1>\` | \`seer <2>\` | \`seer <3>\`

---

${SHARED_RULES}`;
}

function focusedSkin(): string {
  return `
---
SEER AUTO-SUGGEST — After ALL work is complete, show the single best next step.

Read .seer_memory.md (if it exists) for open tasks, next_action, and session log. If session log shows plan deviations (PLAN-ADAPT entries), pick the ONE highest-priority suggestion based on what the user is ACTUALLY working on, not the original plan.

Display in this EXACT format:

---
**Next:** \`seer <suggestion>\`

---

${SHARED_RULES}`;
}

export function appendSuggestInstruction(
  toolResult: string,
  toolName: string,
  userInput: string,
  skin: SuggestionSkin = "default",
  autoSuggest: boolean = true
): string {
  // Skip suggestions entirely when user has disabled auto-suggest
  if (!autoSuggest) {
    return toolResult;
  }

  let instruction: string;
  switch (skin) {
    case "compact":
      instruction = compactSkin();
      break;
    case "focused":
      instruction = focusedSkin();
      break;
    default:
      instruction = defaultSkin();
      break;
  }

  return toolResult + instruction;
}
