/**
 * Agent IPC bridge for the Desktop App frontend.
 * Communicates with the SEER Local Agent sidecar via Tauri's shell plugin.
 */

import { Child, Command } from "@tauri-apps/plugin-shell";

let agentChild: Child | null = null;
type MessageHandler = (msg: AgentResponse) => void;
const handlers = new Map<string, MessageHandler>();
const globalHandlers: MessageHandler[] = [];

export interface AgentResponse {
  id: string;
  type: string;
  payload: unknown;
}

export async function startAgent(apiKey: string): Promise<void> {
  if (agentChild) {
    console.log("[agent] already running");
    return;
  }

  console.log("[agent] spawning sidecar...");
  // Tauri sidecar name matches binaries/seer-agent-{target-triple}.exe
  const cmd = Command.sidecar("binaries/seer-agent", [], {
    env: {
      SEER_API_KEY: apiKey,
      SEER_MCP_BASE: "https://www.seermcp.com",
      SUPABASE_URL: import.meta.env["VITE_SUPABASE_URL"] as string,
      SUPABASE_ANON_KEY: import.meta.env["VITE_SUPABASE_ANON_KEY"] as string,
      SUPABASE_SERVICE_ROLE_KEY: import.meta.env["VITE_SUPABASE_SERVICE_KEY"] as string,
    },
  });

  cmd.stdout.on("data", (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const msg = JSON.parse(trimmed) as AgentResponse;
      const handler = handlers.get(msg.id);
      if (handler) handler(msg);
      for (const h of globalHandlers) h(msg);
    } catch {
      console.log("[agent:stdout]", trimmed);
    }
  });

  cmd.stderr.on("data", (line: string) => {
    const trimmed = line.trim();
    if (trimmed) console.warn("[agent:stderr]", trimmed);
  });

  cmd.on("error", (err) => {
    console.error("[agent] command error:", err);
  });

  cmd.on("close", (payload) => {
    console.warn("[agent] process closed:", payload);
    agentChild = null;
  });

  try {
    agentChild = await cmd.spawn();
    console.log("[agent] spawned with PID", agentChild.pid);
  } catch (e) {
    console.error("[agent] spawn failed:", e);
    throw e;
  }
}

export function onAgentMessage(handler: MessageHandler): () => void {
  globalHandlers.push(handler);
  return () => {
    const idx = globalHandlers.indexOf(handler);
    if (idx >= 0) globalHandlers.splice(idx, 1);
  };
}

let msgCounter = 0;

export function sendToAgent(
  type: string,
  payload: unknown,
  onResponse?: MessageHandler
): string {
  const id = `msg-${++msgCounter}`;
  if (onResponse) {
    handlers.set(id, (msg) => {
      onResponse(msg);
      // Remove handler after terminal message types
      if (msg.type === "output" || msg.type === "error") {
        handlers.delete(id);
      }
    });
  }

  if (agentChild) {
    agentChild.write(JSON.stringify({ id, type, payload }) + "\n");
  }
  return id;
}

export async function stopAgent(): Promise<void> {
  if (agentChild) {
    await agentChild.kill();
    agentChild = null;
  }
}
