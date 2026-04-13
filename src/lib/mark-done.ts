// Feature-completion "mark done?" prompt.
// When a seer command's input closely matches an open [ ] task in the features aspect,
// appends an instruction for Claude to prompt the user to mark it done.

const API_BASE = process.env["SEER_WEB_URL"] ?? "https://www.seermcp.com";

export interface MarkDoneResult {
  shouldPrompt: boolean;
  taskName?: string;
  markDoneInstruction?: string;
}

export function detectMarkDone(
  input: string,
  openTasks: string[],
  apiKey: string = ""
): MarkDoneResult {
  if (!openTasks.length) return { shouldPrompt: false };

  const inputLower = input.toLowerCase();
  const inputWords = inputLower.split(/\s+/).filter((w) => w.length > 2);

  for (const task of openTasks) {
    const taskLower = task.toLowerCase();
    const taskWords = taskLower.split(/\s+/).filter((w) => w.length > 2);

    const overlap = taskWords.filter((w) => inputWords.includes(w));

    if (overlap.length >= 3 || inputLower.includes(taskLower)) {
      const timestamp = new Date().toISOString().slice(0, 16) + "Z";

      return {
        shouldPrompt: true,
        taskName: task,
        markDoneInstruction: `
---
SEER MARK-DONE — After ALL work above is complete, check if the task was fully accomplished.

The user's request matches this open task in the features aspect:
**"${task}"**

If you believe the task was completed successfully in this response:
1. Ask the user: "It looks like **${task}** is done. Mark it complete? (y/n)"
2. If the user confirms (y/yes), update online memory. Derive PROJECT_NAME from package.json "name" or directory name, then:

   Flip the task in features aspect — fetch, replace \`- [ ] ${task}\` with \`- [x] ${task}\`, replace-mode upsert:
   curl -s -X POST "${API_BASE}/api/seer/memory-aspect" \\
     -H "Content-Type: application/json" \\
     -d "$(jq -n --arg name "PROJECT_NAME" --arg c "<full updated features content>" \\
       '{project_name: $name, aspect: "features", content: $c, mode: "replace", api_key: "${apiKey}"}')"

   Append to session_log:
   curl -s -X POST "${API_BASE}/api/seer/memory-aspect" \\
     -H "Content-Type: application/json" \\
     -d "$(jq -n --arg name "PROJECT_NAME" --arg c "[${timestamp}] COMPLETED: ${task}" \\
       '{project_name: $name, aspect: "session_log", content: $c, mode: "append", api_key: "${apiKey}"}')"

3. If the user declines, do nothing — the task stays open.

If the work was NOT fully completed (partial, encountered errors, etc.), skip this prompt entirely.`,
      };
    }
  }

  return { shouldPrompt: false };
}
