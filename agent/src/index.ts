/**
 * SEER Local Agent — Entry Point
 *
 * Lifecycle:
 *   - Starts when the Tauri Desktop App launches it as a sidecar
 *   - Stays alive while the app is open
 *   - Shuts down cleanly when Tauri terminates the sidecar (SIGTERM / stdin close)
 *
 * On startup:
 *   1. Crash recovery — restore settings.json if previous run left it switched
 *   2. Prune expired cache entries
 *   3. Validate session (API key from Tauri via env or first IPC message)
 *   4. Start network monitor
 *   5. Check for agent updates
 *   6. Listen for IPC messages from Desktop App
 */

import { ipc } from "./ipc.js";
import { crashRecovery, restoreModel } from "./model-switch.js";
import { pruneExpired, getCached, setCached, invalidateAll } from "./cache.js";
import { validateSession } from "./auth.js";
import { fetchInstruction } from "./mcp-client.js";
import { executeInstruction } from "./executor.js";
import { connectTool } from "./mcp-config.js";
import { startNetworkMonitor, stopNetworkMonitor, getIsOnline } from "./network.js";
import { checkForUpdates } from "./updater.js";
import { startRelay, stopRelay, broadcastResult, markTaskRunning, markTaskFailed } from "./relay.js";
import type { IPCMessage, TaskPayload, ConnectToolPayload, AgentSession } from "./types.js";

// ── Startup ────────────────────────────────────────────────────────────────

const recovered = crashRecovery();
if (recovered) {
  process.stderr.write("[seer-agent] Crash recovery: restored settings.json\n");
}

pruneExpired();
startNetworkMonitor();
checkForUpdates();

// Session is initialized when the Desktop App sends the first "ping" with credentials,
// or via SEER_API_KEY env var (set by Tauri from OS keychain on launch).
let session: AgentSession | null = null;

const envApiKey = process.env["SEER_API_KEY"];
if (envApiKey) {
  validateSession(envApiKey)
    .then((s) => {
      session = s;
      // Start Supabase Realtime relay so complement devices can send tasks to this primary
      startRelay(s, async (task) => {
        const msgId = `relay-${task.id}`;
        await markTaskRunning(task.id);
        ipc.sendProgress(msgId, `Received relay task from ${task.source_device ?? "complement"}…`);

        const taskContext = task.project_name
          ? `[Project: ${task.project_name}] ${task.task_text}`
          : task.task_text;

        let instruction = getCached(taskContext);
        if (!instruction && getIsOnline()) {
          try {
            instruction = await fetchInstruction(taskContext, s.apiKey);
            setCached(taskContext, instruction);
          } catch (err) {
            await markTaskFailed(task.id, (err as Error).message);
            return;
          }
        }

        if (!instruction) {
          await markTaskFailed(task.id, "Offline and no cached instruction");
          return;
        }

        try {
          const result = await executeInstruction(msgId, task.task_text, instruction);
          const nextSteps = instruction.steps.slice(0, 3);
          await broadcastResult(s.userId, task.id, result.output, nextSteps);
        } catch (err) {
          await markTaskFailed(task.id, (err as Error).message);
        }
      });
    })
    .catch((err: Error) => {
      process.stderr.write(`[seer-agent] Session validation failed: ${err.message}\n`);
    });
}

// ── IPC Message Handler ────────────────────────────────────────────────────

ipc.on("message", async (msg: IPCMessage) => {
  const { id, type, payload } = msg;

  switch (type) {
    case "ping": {
      // Desktop App sends ping on startup with credentials if not in env
      const { apiKey } = payload as { apiKey: string };
      if (!session && apiKey) {
        try {
          session = await validateSession(apiKey);
          // Start relay now that we have a session
          startRelay(session, async (task) => {
            const msgId = `relay-${task.id}`;
            await markTaskRunning(task.id);
            const taskContext = task.project_name
              ? `[Project: ${task.project_name}] ${task.task_text}`
              : task.task_text;
            let instruction = getCached(taskContext);
            if (!instruction && getIsOnline()) {
              try { instruction = await fetchInstruction(taskContext, session!.apiKey); if (instruction) setCached(taskContext, instruction); }
              catch (err) { await markTaskFailed(task.id, (err as Error).message); return; }
            }
            if (!instruction) { await markTaskFailed(task.id, "Offline, no cache"); return; }
            try {
              const result = await executeInstruction(msgId, task.task_text, instruction);
              await broadcastResult(session!.userId, task.id, result.output, instruction.steps.slice(0, 3));
            } catch (err) { await markTaskFailed(task.id, (err as Error).message); }
          });
        } catch (err) {
          ipc.sendError(id, `Authentication failed: ${(err as Error).message}`);
          return;
        }
      }
      ipc.send({ id, type: "pong", payload: { version: process.env["AGENT_VERSION"] ?? "1.0.0" } });
      break;
    }

    case "task": {
      if (!session) {
        ipc.sendError(id, "Agent not authenticated. Please log in.");
        return;
      }

      const { text, projectName } = payload as TaskPayload;
      const taskContext = projectName ? `[Project: ${projectName}] ${text}` : text;

      ipc.sendProgress(id, "Checking instruction cache…");

      let instruction = getCached(taskContext);

      if (instruction) {
        ipc.sendProgress(id, "Cache hit — skipping MCP call.");
      } else if (getIsOnline()) {
        ipc.sendProgress(id, "Fetching instruction from SEER MCP…");
        try {
          instruction = await fetchInstruction(taskContext, session.apiKey);
          setCached(taskContext, instruction);
        } catch (err) {
          ipc.sendError(id, `MCP error: ${(err as Error).message}`);
          return;
        }
      } else {
        ipc.sendError(id, "Offline and no cached instruction for this task. Try again when online.");
        return;
      }

      try {
        const result = await executeInstruction(id, text, instruction);
        // Generate guided next steps (simplified — full implementation calls MCP)
        const nextSteps = instruction.steps.length > 0
          ? instruction.steps.slice(0, 3)
          : ["Review the output above", "Run seer doctor to verify setup", "Push your changes"];
        ipc.sendOutput(id, result.output, nextSteps);
      } catch (err) {
        ipc.sendError(id, `Execution error: ${(err as Error).message}`);
      }
      break;
    }

    case "cancel": {
      // Cancel is best-effort — executor doesn't yet support mid-stream cancellation
      ipc.sendProgress(id, "Cancel requested. Current step will finish.");
      break;
    }

    case "status": {
      ipc.sendStatus(id, {
        online: getIsOnline(),
        authenticated: session !== null,
        plan: session?.plan ?? null,
        email: session?.email ?? null,
        version: process.env["AGENT_VERSION"] ?? "1.0.0",
      });
      break;
    }

    case "restore-model": {
      try {
        restoreModel();
        ipc.send({ id, type: "status", payload: { restored: true } });
      } catch (err) {
        ipc.sendError(id, `Restore failed: ${(err as Error).message}`);
      }
      break;
    }

    case "connect-tool": {
      if (!session) {
        ipc.sendError(id, "Agent not authenticated.");
        return;
      }
      const { tool, apiKey } = payload as ConnectToolPayload;
      try {
        const written = connectTool(tool, apiKey);
        ipc.send({ id, type: "status", payload: { connected: tool, configPath: written } });
      } catch (err) {
        ipc.sendError(id, `Failed to connect ${String((payload as ConnectToolPayload).tool)}: ${(err as Error).message}`);
      }
      break;
    }

    case "invalidate-cache": {
      invalidateAll();
      ipc.send({ id, type: "status", payload: { cacheCleared: true } });
      break;
    }

    default:
      ipc.sendError(id, `Unknown message type: ${String(type)}`);
  }
});

// ── Shutdown ────────────────────────────────────────────────────────────────

function shutdown(): void {
  stopNetworkMonitor();
  stopRelay();
  restoreModel();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
