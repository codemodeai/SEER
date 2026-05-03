/**
 * memory_fetch_aspects — return the requested fields for a list of node ids.
 *
 * Default fields: ['label', 'summary'] — keeps prompts cheap.
 * Pass fields: ['aspects'] (or include it in the list) to get the full per-node
 * structured payload. Caller is responsible for keeping the total payload below
 * the prompt token budget.
 */

import { authenticateUser } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";

type Field =
  | "label"
  | "summary"
  | "type"
  | "layer"
  | "status"
  | "parent_id"
  | "doc_anchor"
  | "aspects"
  | "properties";

interface FetchArgs {
  nodeIds: string[];
  fields?: Field[];
}

const DEFAULT_FIELDS: Field[] = ["label", "summary"];
const HARD_CAP_NODES = 8;

export async function memory_fetch_aspects(
  rawArgs: string,
  apiKey: string,
): Promise<string> {
  const user = await authenticateUser(apiKey);
  if (!user) return JSON.stringify({ error: "Invalid SEER key. Visit seer.ai" });

  let args: FetchArgs;
  try {
    args = JSON.parse(rawArgs) as FetchArgs;
  } catch {
    return JSON.stringify({ error: "memory_fetch_aspects expects a JSON string." });
  }

  const ids = (args.nodeIds ?? []).slice(0, HARD_CAP_NODES);
  if (ids.length === 0) return JSON.stringify({ ok: true, nodes: [] });

  const fields = (args.fields ?? DEFAULT_FIELDS).filter((f): f is Field => !!f);
  const select = ["id", "project_id", ...fields].join(", ");

  const { data, error } = await supabase
    .from("nodes")
    .select(select)
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) {
    return JSON.stringify({ error: "fetch failed.", detail: error.message });
  }

  return JSON.stringify({ ok: true, nodes: data ?? [] });
}
