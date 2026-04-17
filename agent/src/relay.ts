/**
 * Supabase Realtime Relay.
 * Primary device subscribes to its channel and receives tasks queued by complement devices.
 * Results are broadcast back to the complement channel so the complement sees output.
 *
 * Channel naming:
 *   Primary listens:    seer:user:{userId}:primary
 *   Complement listens: seer:user:{userId}:complement
 */

import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { ipc } from "./ipc.js";
import type { AgentSession } from "./types.js";

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "";
const SUPABASE_ANON_KEY = process.env["SUPABASE_ANON_KEY"] ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let primaryChannel: RealtimeChannel | null = null;

export interface QueuedTask {
  id: string;
  task_text: string;
  project_name: string | null;
  source_device: string | null;
  user_id: string;
  status: string;
}

type OnTaskCallback = (task: QueuedTask) => void;

export function startRelay(session: AgentSession, onTask: OnTaskCallback): void {
  if (primaryChannel) return;

  primaryChannel = supabase
    .channel(`seer:user:${session.userId}:primary`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "queued_tasks",
        filter: `user_id=eq.${session.userId}`,
      },
      (payload) => {
        const task = payload.new as QueuedTask;
        if (task.status === "pending") {
          onTask(task);
        }
      }
    )
    .subscribe();
}

export async function broadcastResult(
  userId: string,
  taskId: string,
  result: string,
  nextSteps: string[]
): Promise<void> {
  // Update queued_tasks record so complement polling also sees the result
  await supabase
    .from("queued_tasks")
    .update({ status: "done", result: JSON.stringify({ output: result, nextSteps }) })
    .eq("id", taskId);

  // Also broadcast via Realtime for instant delivery
  await supabase.channel(`seer:user:${userId}:complement`).send({
    type: "broadcast",
    event: "task-result",
    payload: { taskId, output: result, nextSteps },
  });
}

export async function markTaskRunning(taskId: string): Promise<void> {
  await supabase.from("queued_tasks").update({ status: "running" }).eq("id", taskId);
}

export async function markTaskFailed(taskId: string, error: string): Promise<void> {
  await supabase.from("queued_tasks").update({ status: "failed", error }).eq("id", taskId);
}

export function stopRelay(): void {
  if (primaryChannel) {
    supabase.removeChannel(primaryChannel);
    primaryChannel = null;
  }
}
