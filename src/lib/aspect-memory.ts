// Structured aspect-memory — replaces flat .seer_memory.md.
// Six aspect files per project, stored in project_memory_files (Supabase).
// SEER loads only relevant aspects per task type.

import crypto from "crypto";
import { supabase } from "./supabase.js";

export type AspectType =
  | "project_overview"
  | "architecture"
  | "features"
  | "decisions"
  | "errors_fixes"
  | "session_log";

export const ALL_ASPECTS: AspectType[] = [
  "project_overview",
  "architecture",
  "features",
  "decisions",
  "errors_fixes",
  "session_log",
];

// Task-type → aspect files to load (per spec table 13).
export type TaskType =
  | "simple_build"
  | "feature_build"
  | "security"
  | "bug_fix"
  | "research"
  | "payment_auth"
  | "full_feature"
  | "resume";

export function getAspectsForTask(task: TaskType): AspectType[] {
  switch (task) {
    case "simple_build": return ["architecture"];
    case "feature_build": return ["features", "architecture"];
    case "security": return ["architecture", "errors_fixes", "decisions"];
    case "bug_fix": return ["errors_fixes", "architecture"];
    case "research": return ["decisions", "project_overview"];
    case "payment_auth": return ["architecture", "decisions", "errors_fixes"];
    case "full_feature": return ["project_overview", "architecture", "features", "decisions", "errors_fixes"];
    case "resume": return ["project_overview", "architecture", "decisions", "errors_fixes"];
  }
}

export interface AspectRow {
  aspect_type: AspectType;
  content: string;
  updated_at: string;
  size_bytes: number;
  version: number;
}

type CacheKey = string;
interface CacheEntry { rows: AspectRow[]; expiresAt: number; }

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<CacheKey, CacheEntry>();

function cacheKey(scope: { userId: string; agencyId: string | null }, projectName: string): CacheKey {
  return `${scope.agencyId ?? `u:${scope.userId}`}::${projectName}`;
}

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

export function invalidateAspectCache(scope: { userId: string; agencyId: string | null }, projectName: string) {
  cache.delete(cacheKey(scope, projectName));
}

export async function loadAspects(
  scope: { userId: string; agencyId: string | null },
  projectName: string,
  aspects: AspectType[] = ALL_ASPECTS
): Promise<AspectRow[]> {
  const key = cacheKey(scope, projectName);
  const cached = cache.get(key);
  const now = Date.now();

  let rows: AspectRow[];
  if (cached && cached.expiresAt > now) {
    rows = cached.rows;
  } else {
    const query = supabase
      .from("project_memory_files")
      .select("aspect_type, content, updated_at, size_bytes, version")
      .eq("project_name", projectName);

    const { data, error } = scope.agencyId
      ? await query.eq("agency_id", scope.agencyId)
      : await query.eq("user_id", scope.userId).is("agency_id", null);

    if (error) throw new Error(`Load aspects failed: ${error.message}`);
    rows = (data ?? []) as AspectRow[];
    cache.set(key, { rows, expiresAt: now + CACHE_TTL_MS });
  }

  return rows.filter(r => aspects.includes(r.aspect_type));
}

export async function writeAspect(
  scope: { userId: string; agencyId: string | null; updatedBy: string },
  projectName: string,
  aspect: AspectType,
  content: string,
  mode: "replace" | "append" = "replace"
): Promise<{ action: "created" | "updated" | "unchanged"; version: number }> {
  const query = supabase
    .from("project_memory_files")
    .select("id, version, content, content_hash")
    .eq("project_name", projectName)
    .eq("aspect_type", aspect);

  const { data: existing } = scope.agencyId
    ? await query.eq("agency_id", scope.agencyId).maybeSingle()
    : await query.eq("user_id", scope.userId).is("agency_id", null).maybeSingle();

  let finalContent = content;
  if (mode === "append" && existing?.content) {
    finalContent = existing.content.trimEnd() + "\n" + content.trimStart();
  }

  // Session log rolling window: keep last 500 entries / 30 days.
  if (aspect === "session_log") {
    finalContent = trimSessionLog(finalContent);
  }

  const contentHash = sha256(finalContent);

  if (existing) {
    if (existing.content_hash === contentHash) {
      return { action: "unchanged", version: existing.version };
    }
    const newVersion = existing.version + 1;
    const { error } = await supabase
      .from("project_memory_files")
      .update({
        content: finalContent,
        content_hash: contentHash,
        version: newVersion,
        updated_by: scope.updatedBy,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Write aspect failed: ${error.message}`);
    invalidateAspectCache(scope, projectName);
    return { action: "updated", version: newVersion };
  }

  const { error } = await supabase.from("project_memory_files").insert({
    user_id: scope.userId,
    agency_id: scope.agencyId,
    project_name: projectName,
    aspect_type: aspect,
    content: finalContent,
    content_hash: contentHash,
    version: 1,
    updated_by: scope.updatedBy,
  });
  if (error) throw new Error(`Insert aspect failed: ${error.message}`);
  invalidateAspectCache(scope, projectName);
  return { action: "created", version: 1 };
}

// Rolling 30-day / 500-entry cap for session_log.
function trimSessionLog(content: string): string {
  const lines = content.split("\n").filter(l => l.trim().length > 0);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const kept = lines.filter(line => {
    const match = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:]+Z?)\]/);
    if (!match) return true;
    const t = Date.parse(match[1]);
    return isNaN(t) ? true : t >= thirtyDaysAgo;
  });

  const capped = kept.slice(-500);
  return capped.join("\n");
}

export interface AspectSummary {
  aspect_type: AspectType;
  size_bytes: number;
  updated_at: string | null;
  version: number;
  present: boolean;
}

export async function listAspects(
  scope: { userId: string; agencyId: string | null },
  projectName: string
): Promise<AspectSummary[]> {
  const rows = await loadAspects(scope, projectName, ALL_ASPECTS);
  const byType = new Map(rows.map(r => [r.aspect_type, r]));
  return ALL_ASPECTS.map(t => {
    const row = byType.get(t);
    return {
      aspect_type: t,
      size_bytes: row?.size_bytes ?? 0,
      updated_at: row?.updated_at ?? null,
      version: row?.version ?? 0,
      present: !!row,
    };
  });
}

export async function resolveScope(userId: string): Promise<{ userId: string; agencyId: string | null; updatedBy: string }> {
  // Prefer agency scope if the user belongs to one (member or owner).
  const { data: membership } = await supabase
    .from("agency_users")
    .select("agency_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membership?.agency_id) {
    return { userId, agencyId: membership.agency_id, updatedBy: userId };
  }

  const { data: owned } = await supabase
    .from("agencies")
    .select("id")
    .eq("owner_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (owned?.id) {
    return { userId, agencyId: owned.id, updatedBy: userId };
  }

  return { userId, agencyId: null, updatedBy: userId };
}

export const ASPECT_LABELS: Record<AspectType, string> = {
  project_overview: "Project Overview",
  architecture: "Architecture",
  features: "Features",
  decisions: "Decisions",
  errors_fixes: "Errors & Fixes",
  session_log: "Session Log",
};
