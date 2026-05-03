/**
 * memory_expand — full aspect blob for one node, on-demand.
 *
 * Claude calls this when the label+summary surfaced by memory_select_nodes
 * isn't enough to act on. Pay-per-need: keeps the default prompt small and
 * lets the model opt into more context only when it would actually help.
 */

import { authenticateUser } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";

interface ExpandArgs {
  nodeId: string;
  includeChildren?: boolean;
}

export async function memory_expand(
  rawArgs: string,
  apiKey: string,
): Promise<string> {
  const user = await authenticateUser(apiKey);
  if (!user) return JSON.stringify({ error: "Invalid SEER key. Visit seer.ai" });

  let args: ExpandArgs;
  try {
    args = JSON.parse(rawArgs) as ExpandArgs;
  } catch {
    return JSON.stringify({ error: "memory_expand expects a JSON string." });
  }

  const id = (args.nodeId ?? "").trim();
  if (!id) return JSON.stringify({ error: "nodeId is required." });

  const { data: node, error } = await supabase
    .from("nodes")
    .select("id, project_id, parent_id, type, label, summary, status, layer, doc_anchor, aspects, properties, drift_status, unplanned, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return JSON.stringify({ error: "expand failed.", detail: error.message });
  if (!node) return JSON.stringify({ error: "node not found." });

  let children: unknown[] = [];
  if (args.includeChildren) {
    const { data: kids } = await supabase
      .from("nodes")
      .select("id, type, label, summary, status, order_index")
      .eq("parent_id", id)
      .eq("user_id", user.id)
      .order("order_index", { ascending: true });
    children = kids ?? [];
  }

  return JSON.stringify({ ok: true, node, children });
}
