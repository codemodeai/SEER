/**
 * memory_select_nodes — pick the most relevant graph nodes for a request.
 *
 * Two paths, gated by plan tier (see lib/plan-router.ts):
 *  - sql_first   (Starter/Free): Postgres full-text rank on label+summary; embedding
 *                fallback only when fewer than 3 hits.
 *  - always_embed (Pro/Agency):  one embedding call per request, vector search.
 *
 * Output is intentionally compact — label + summary only by default — so the
 * agent can ship it straight into a Claude prompt without bloating tokens.
 * Caller fetches full aspects on demand via memory_fetch_aspects / memory_expand.
 */

import { authenticateUser } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { selectionMode } from "../lib/plan-router.js";
import { getEmbedding } from "../lib/embeddings.js";

interface SelectArgs {
  request: string;
  projectId?: string;       // omit for cross-project (e.g. plan-mode suggestions)
  limit?: number;           // hard-capped to 8
}

interface NodeHit {
  nodeId: string;
  projectId: string;
  label: string;
  summary: string | null;
  score: number;
  reason: "fts" | "embedding";
}

const HARD_CAP = 8;
const SQL_MIN_HITS_BEFORE_FALLBACK = 3;

export async function memory_select_nodes(
  rawArgs: string,
  apiKey: string,
): Promise<string> {
  const user = await authenticateUser(apiKey);
  if (!user) {
    return JSON.stringify({ error: "Invalid SEER key. Visit seer.ai" });
  }

  let args: SelectArgs;
  try {
    args = JSON.parse(rawArgs) as SelectArgs;
  } catch {
    return JSON.stringify({ error: "memory_select_nodes expects a JSON string." });
  }

  const request = (args.request ?? "").trim();
  if (!request) return JSON.stringify({ error: "request is required." });

  const limit = Math.min(args.limit ?? 5, HARD_CAP);
  const mode = selectionMode(user);

  try {
    if (mode === "sql_first") {
      const fts = await searchFts(user.id, request, args.projectId, limit);
      if (fts.length >= SQL_MIN_HITS_BEFORE_FALLBACK) {
        return JSON.stringify({ ok: true, mode: "sql_first", hits: fts });
      }
      const embed = await searchByEmbedding(user.id, request, args.projectId, limit);
      const merged = mergeHits(fts, embed, limit);
      return JSON.stringify({ ok: true, mode: "sql_first+embed", hits: merged });
    }

    const embed = await searchByEmbedding(user.id, request, args.projectId, limit);
    return JSON.stringify({ ok: true, mode: "always_embed", hits: embed });
  } catch (err) {
    return JSON.stringify({
      error: "memory_select_nodes failed.",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

async function searchFts(
  userId: string,
  request: string,
  projectId: string | undefined,
  limit: number,
): Promise<NodeHit[]> {
  const { data, error } = await supabase.rpc("search_user_nodes_text", {
    query_text: request,
    match_user_id: userId,
    match_project_id: projectId ?? null,
    match_count: limit,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{
    id: string;
    project_id: string;
    label: string;
    summary: string | null;
    rank: number;
  }>).map((r) => ({
    nodeId: r.id,
    projectId: r.project_id,
    label: r.label,
    summary: r.summary,
    score: r.rank,
    reason: "fts" as const,
  }));
}

async function searchByEmbedding(
  userId: string,
  request: string,
  projectId: string | undefined,
  limit: number,
): Promise<NodeHit[]> {
  if (!process.env["OPENAI_API_KEY"]) return [];
  const vec = await getEmbedding(request);

  if (projectId) {
    const { data, error } = await supabase.rpc("match_plan_nodes", {
      query_embedding: vec,
      match_project_id: projectId,
      match_count: limit,
    });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string; label: string; similarity: number }>;
    return rows.map((r) => ({
      nodeId: r.id,
      projectId,
      label: r.label,
      summary: null,
      score: r.similarity,
      reason: "embedding" as const,
    }));
  }

  const { data, error } = await supabase.rpc("match_user_nodes", {
    query_embedding: vec,
    match_user_id: userId,
    match_count: limit,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{
    id: string;
    project_id: string;
    label: string;
    summary: string | null;
    similarity: number;
  }>).map((r) => ({
    nodeId: r.id,
    projectId: r.project_id,
    label: r.label,
    summary: r.summary,
    score: r.similarity,
    reason: "embedding" as const,
  }));
}

function mergeHits(a: NodeHit[], b: NodeHit[], limit: number): NodeHit[] {
  const seen = new Set<string>();
  const out: NodeHit[] = [];
  for (const h of [...a, ...b]) {
    if (seen.has(h.nodeId)) continue;
    seen.add(h.nodeId);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}
