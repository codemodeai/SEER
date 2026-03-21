import { supabase } from "./supabase.js";

const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";

export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env["OPENAI_API_KEY"] ?? "";
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    throw new Error(`Embedding API error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  const first = json.data[0];
  if (!first) throw new Error("No embedding returned");
  return first.embedding;
}

export interface MemoryEntry {
  id: string;
  content: string;
  entry_type: string;
  importance: number;
  similarity: number;
}

/**
 * Search memory_entries by cosine similarity. Returns top `limit` results.
 * Requires the `match_memory` RPC function in Supabase.
 */
export async function searchMemory(
  projectId: string,
  queryEmbedding: number[],
  limit: number = 5
): Promise<MemoryEntry[]> {
  const { data, error } = await supabase.rpc("match_memory", {
    query_embedding: queryEmbedding,
    match_project_id: projectId,
    match_count: limit,
  });

  if (error) {
    throw new Error(`Memory search failed: ${error.message}`);
  }

  return (data ?? []) as MemoryEntry[];
}

/**
 * Store a new memory entry with its embedding.
 */
export async function storeMemory(
  projectId: string,
  content: string,
  entryType: string = "doc",
  importance: number = 1
): Promise<void> {
  const embedding = await getEmbedding(content);

  await supabase.from("memory_entries").insert({
    project_id: projectId,
    content,
    embedding: JSON.stringify(embedding),
    entry_type: entryType,
    importance,
  });
}
