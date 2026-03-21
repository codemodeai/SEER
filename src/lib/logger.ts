import { supabase } from "./supabase.js";

export interface LogEntry {
  user_id: string;
  project_id?: string;
  raw_input: string;
  raw_tokens: number;
  optimized_tokens: number;
  tokens_saved: number;
  pct_saved: number;
  tool_used: string;
  surface: string;
}

export async function logSeerCall(entry: LogEntry): Promise<void> {
  await supabase.from("seer_logs").insert({
    ...entry,
    timestamp: new Date().toISOString(),
  });
}
