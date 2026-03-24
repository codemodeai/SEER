// Auto-suggestion instruction appended to seer tool responses.
// After Claude finishes executing the seer command, it presents
// 3-5 contextual next-step suggestions the user can select.
// Zero Haiku cost — Claude generates suggestions using user's own API key.

export function appendSuggestInstruction(toolResult: string, toolName: string, userInput: string): string {
  const instruction = `

---
SEER AUTO-SUGGEST — After you finish ALL work from the above instructions, present next-step suggestions.

Based on what you just completed for "${toolName}" with input "${userInput.length > 100 ? userInput.slice(0, 100) + "…" : userInput}", generate 3-5 contextual suggestions for what the user might want to do next.

Display them in this EXACT format:

---
**What's next?** Pick one or type your own:

1. \`seer <suggestion 1>\`
2. \`seer <suggestion 2>\`
3. \`seer <suggestion 3>\`
4. \`seer <suggestion 4>\`
5. \`seer <suggestion 5>\`

---

Rules for generating suggestions:
- Each suggestion must start with "seer " so the user can copy-paste it directly
- Make suggestions contextual — based on what was just built/changed/optimized
- Include a mix: next logical step, testing, edge cases, related feature, cleanup/refactor
- Keep each suggestion under 12 words after "seer "
- If the task was a build/feature: suggest testing, styling, error handling, related features
- If the task was a fix: suggest verifying the fix, regression testing, related fixes
- If the task was optimization: suggest further optimization, benchmarking, applying to similar code
- Do NOT suggest "seer status" or "seer session read" — those are utility commands
- Present this AFTER all work is complete, not before`;

  return toolResult + instruction;
}
