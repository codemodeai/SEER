/**
 * Claude Executor.
 * Spawns the Claude CLI with the prepared instruction, streams stdout back via IPC,
 * detects [STEP N COMPLETE] labels for multi-step pipelines, and restores the model on finish.
 */

import { spawn } from "child_process";
import { accessSync } from "fs";
import { homedir } from "os";
import { ipc } from "./ipc.js";
import { switchModel, restoreModel } from "./model-switch.js";
import type { MCPInstruction } from "./types.js";

const STEP_COMPLETE_RE = /\[STEP\s+(\d+)\s+COMPLETE\]/i;

// Full-system access. The agent is the trusted execution layer for SEER — giving
// Claude CLI every drive root + skipping interactive permission prompts lets it
// operate anywhere the OS itself allows. Guardrails (deny list, audit log) live
// one layer above this spawn, not here.
const ALL_DRIVES = process.platform === "win32"
  ? ["C:\\", "D:\\", "E:\\", "F:\\"].filter((d) => {
      try { accessSync(d); return true; } catch { return false; }
    })
  : ["/"];

function buildClaudeArgs(prompt: string): string[] {
  const addDirs = ALL_DRIVES.flatMap((d) => ["--add-dir", d]);
  return [
    ...addDirs,
    "--dangerously-skip-permissions",
    "-p",
    prompt,
  ];
}

export interface ExecutionResult {
  output: string;
  completedStep?: number;
}

export async function executeInstruction(
  taskId: string,
  taskText: string,
  instruction: MCPInstruction
): Promise<ExecutionResult> {
  switchModel(instruction.model);
  ipc.sendProgress(taskId, `Model set to ${instruction.model}. Executing…`);

  return new Promise((resolve, reject) => {
    const fullPrompt = instruction.instruction
      ? `${instruction.instruction}\n\nUser task: ${taskText}`
      : taskText;

    const child = spawn("claude", buildClaudeArgs(fullPrompt), {
      shell: false,
      env: process.env,
      cwd: homedir(),
    });

    let output = "";
    let completedStep: number | undefined;

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      ipc.sendProgress(taskId, chunk);

      const match = STEP_COMPLETE_RE.exec(chunk);
      if (match) {
        completedStep = parseInt(match[1] ?? "0", 10);
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      ipc.sendProgress(taskId, `[stderr] ${chunk}`);
    });

    child.on("close", (code) => {
      restoreModel();
      if (code === 0 || output.length > 0) {
        resolve({ output, completedStep });
      } else {
        reject(new Error(`Claude exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      restoreModel();
      reject(err);
    });
  });
}
