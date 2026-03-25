// Feature-completion "mark done?" prompt.
// When a seer command's input closely matches an open [ ] task in .seer_memory.md,
// appends an instruction for Claude to prompt the user to mark it done.
// Detection runs server-side using keyword overlap (same approach as reopen.ts).

export interface MarkDoneResult {
  shouldPrompt: boolean;
  taskName?: string;
  markDoneInstruction?: string;
}

/**
 * Detect if the user's input matches an open (uncompleted) task.
 * Returns a prompt instruction if there's a match.
 */
export function detectMarkDone(
  input: string,
  openTasks: string[]
): MarkDoneResult {
  if (!openTasks.length) return { shouldPrompt: false };

  const inputLower = input.toLowerCase();
  const inputWords = inputLower.split(/\s+/).filter((w) => w.length > 2);

  for (const task of openTasks) {
    const taskLower = task.toLowerCase();
    const taskWords = taskLower.split(/\s+/).filter((w) => w.length > 2);

    // Require clear match: 3+ word overlap or substring match
    const overlap = taskWords.filter((w) => inputWords.includes(w));

    if (overlap.length >= 3 || inputLower.includes(taskLower)) {
      const timestamp = new Date().toISOString().slice(0, 16) + "Z";

      return {
        shouldPrompt: true,
        taskName: task,
        markDoneInstruction: `
---
SEER MARK-DONE — After ALL work above is complete, check if the task was fully accomplished.

The user's request matches this open task in .seer_memory.md:
**"${task}"**

If you believe the task was completed successfully in this response:
1. Ask the user: "It looks like **${task}** is done. Mark it complete? (y/n)"
2. If the user confirms (y/yes), update .seer_memory.md:
   - Change \`- [ ] ${task}\` to \`- [x] ${task}\`
   - Append to "## 5. Session Log": \`[${timestamp}] COMPLETED: ${task}\`
   - Update "## 2. Current Status" → last_completed to: ${task}
3. If the user declines, do nothing — the task stays open.

If the work was NOT fully completed (partial, encountered errors, etc.), skip this prompt entirely.`,
      };
    }
  }

  return { shouldPrompt: false };
}
