export interface ReopenResult {
  shouldReopen: boolean;
  taskName?: string;
  reopenPrompt?: string;
}

export function detectReopen(
  input: string,
  completedTasks: string[]
): ReopenResult {
  if (!completedTasks.length) return { shouldReopen: false };

  const inputLower = input.toLowerCase();
  const inputWords = inputLower.split(/\s+/).filter((w) => w.length > 2);

  for (const task of completedTasks) {
    const taskLower = task.toLowerCase();
    const taskWords = taskLower.split(/\s+/).filter((w) => w.length > 2);

    // Require clear match: 3+ word overlap or exact substring match
    const overlap = taskWords.filter((w) => inputWords.includes(w));

    if (overlap.length >= 3 || inputLower.includes(taskLower)) {
      const date = new Date().toISOString().slice(0, 10);
      const reason = input.slice(0, 80);

      return {
        shouldReopen: true,
        taskName: task,
        reopenPrompt: `SEER \u00b7 re-open detected
"${task}" is marked complete \u2014 re-opening it for changes. [Press Enter to continue / n to cancel]

If continuing, update .seer_memory.md:
1. Change \`- [x] ${task}\` to \`- [ ] ${task} (re-opened: ${reason} \u2014 ${date})\`
2. Add to Session Log: \`[${new Date().toISOString().slice(0, 16)}Z] RE-OPENED: ${task} \u2014 reason: ${reason}\`
3. All subsequent work in this session logs under this task.`,
      };
    }
  }

  return { shouldReopen: false };
}
