/**
 * Claude Executor.
 * Spawns the Claude CLI with the prepared instruction, streams stdout back via IPC,
 * detects [STEP N COMPLETE] labels for multi-step pipelines, and restores the model on finish.
 */

import { spawn } from "child_process";
import { ipc } from "./ipc.js";
import { switchModel, restoreModel } from "./model-switch.js";
import type { MCPInstruction } from "./types.js";

const STEP_COMPLETE_RE = /\[STEP\s+(\d+)\s+COMPLETE\]/i;

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

    const child = spawn("claude", ["-p", fullPrompt], {
      shell: false,
      env: process.env,
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
