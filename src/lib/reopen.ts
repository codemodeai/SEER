const API_BASE = process.env["SEER_WEB_URL"] ?? "https://www.seermcp.com";

export interface ReopenResult {
  shouldReopen: boolean;
  taskName?: string;
  reopenPrompt?: string;
}

export function detectReopen(
  input: string,
  completedTasks: string[],
  apiKey: string = ""
): ReopenResult {
  if (!completedTasks.length) return { shouldReopen: false };

  const inputLower = input.toLowerCase();
  const inputWords = inputLower.split(/\s+/).filter((w) => w.length > 2);

  for (const task of completedTasks) {
    const taskLower = task.toLowerCase();
    const taskWords = taskLower.split(/\s+/).filter((w) => w.length > 2);

    const overlap = taskWords.filter((w) => inputWords.includes(w));

    if (overlap.length >= 3 || inputLower.includes(taskLower)) {
      const date = new Date().toISOString().slice(0, 10);
      const reason = input.slice(0, 80);
      const ts = new Date().toISOString().slice(0, 16) + "Z";

      return {
        shouldReopen: true,
        taskName: task,
        reopenPrompt: `SEER \u00b7 re-open detected
"${task}" is marked complete \u2014 re-opening it for changes. [Press Enter to continue / n to cancel]

If continuing, update online memory. Derive PROJECT_NAME from package.json "name" or directory name, then:

1. Flip the task in the features aspect — rewrite \`- [x] ${task}\` to \`- [ ] ${task} (re-opened: ${reason} \u2014 ${date})\` and replace-upsert the full features content:
   curl -s -X POST "${API_BASE}/api/seer/memory-aspect" \\
     -H "Content-Type: application/json" \\
     -d "$(jq -n --arg name "PROJECT_NAME" --arg c "<updated features content>" \\
       '{project_name: $name, aspect: "features", content: $c, mode: "replace", api_key: "${apiKey}"}')"

2. Append to session_log:
   curl -s -X POST "${API_BASE}/api/seer/memory-aspect" \\
     -H "Content-Type: application/json" \\
     -d "$(jq -n --arg name "PROJECT_NAME" --arg c "[${ts}] RE-OPENED: ${task} \u2014 reason: ${reason}" \\
       '{project_name: $name, aspect: "session_log", content: $c, mode: "append", api_key: "${apiKey}"}')"

3. All subsequent work in this session logs under this task.`,
      };
    }
  }

  return { shouldReopen: false };
}
