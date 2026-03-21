import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { getEmbedding, searchMemory } from "../lib/embeddings.js";

export async function seer_memory(
  query: string,
  apiKey: string,
  projectId?: string
): Promise<string> {
  // 1. Validate
  const user = await authenticateUser(apiKey);
  if (!user) {
    return JSON.stringify({ error: "Invalid SEER key. Visit seer.ai" });
  }

  // 2. Plan gate — memory requires Pro+
  if (user.plan === "free" || user.plan === "starter") {
    return JSON.stringify({
      error: "Context memory requires Pro plan or above. Upgrade at seer.ai/upgrade",
    });
  }

  // 3. Resolve project — use provided ID or find the user's active project
  let resolvedProjectId = projectId;
  if (!resolvedProjectId) {
    const { data } = await supabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (!data) {
      return JSON.stringify({
        error: "No active project found. Create a project first.",
      });
    }
    resolvedProjectId = data.id as string;
  }

  // 4. Embed query and search
  let embedding: number[];
  try {
    embedding = await getEmbedding(query);
  } catch (err) {
    return JSON.stringify({
      error: "Embedding generation failed.",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }

  try {
    const results = await searchMemory(resolvedProjectId, embedding, 5);

    return JSON.stringify({
      query,
      project_id: resolvedProjectId,
      results: results.map((r) => ({
        content: r.content,
        type: r.entry_type,
        relevance: Math.round(r.similarity * 100) / 100,
      })),
      count: results.length,
    });
  } catch (err) {
    return JSON.stringify({
      error: "Memory search failed.",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
