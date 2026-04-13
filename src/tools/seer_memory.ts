import { authenticateUser } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { checkMfa, getMfaBlockMessage } from "../lib/mfa.js";
import {
  listAspects,
  loadAspects,
  writeAspect,
  resolveScope,
  ASPECT_LABELS,
  ALL_ASPECTS,
  type AspectType,
} from "../lib/aspect-memory.js";

// Subcommand flags — match spec table 43.
const ASPECT_FLAGS: Record<string, AspectType> = {
  "--overview": "project_overview",
  "--architecture": "architecture",
  "--features": "features",
  "--decisions": "decisions",
  "--errors": "errors_fixes",
  "--log": "session_log",
};

interface ParsedMemoryCommand {
  mode: "list" | "view" | "update";
  aspect?: AspectType;
  project?: string;
  content?: string;
  appendMode?: boolean;
}

function parseMemoryCommand(query: string): ParsedMemoryCommand {
  const raw = query.trim();

  // update --<file> 'content'  |  update --<file> --append 'content'
  const updateMatch = raw.match(/^update\s+(--\w+)(?:\s+(--append))?\s+['"]?([\s\S]+?)['"]?$/i);
  if (updateMatch) {
    const flag = updateMatch[1].toLowerCase();
    const aspect = ASPECT_FLAGS[flag];
    if (aspect) {
      return {
        mode: "update",
        aspect,
        appendMode: !!updateMatch[2],
        content: updateMatch[3].trim(),
      };
    }
  }

  // --<file>  → view one aspect
  const flagMatch = raw.match(/^(--\w+)(?:\s+--project\s+(\S+))?$/i);
  if (flagMatch) {
    const aspect = ASPECT_FLAGS[flagMatch[1].toLowerCase()];
    if (aspect) {
      return { mode: "view", aspect, project: flagMatch[2] };
    }
  }

  // --project NAME   → list for a specific project
  const projectMatch = raw.match(/^--project\s+(\S+)$/i);
  if (projectMatch) {
    return { mode: "list", project: projectMatch[1] };
  }

  return { mode: "list" };
}

async function resolveProjectName(userId: string, explicit?: string): Promise<string | null> {
  if (explicit) return explicit;

  const { data } = await supabase
    .from("fs_projects")
    .select("name")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.name ?? null;
}

function formatList(
  project: string,
  scope: string,
  items: Array<{ aspect_type: AspectType; size_bytes: number; updated_at: string | null; version: number; present: boolean }>
): string {
  const lines: string[] = [];
  lines.push(`[SEER MEMORY] ${project} · ${scope}`);
  lines.push("");
  for (const item of items) {
    const label = ASPECT_LABELS[item.aspect_type].padEnd(18);
    if (!item.present) {
      lines.push(`  ${label} EMPTY   — run seer memory run to initialize`);
      continue;
    }
    const sizeKb = (item.size_bytes / 1024).toFixed(1);
    const ts = item.updated_at ? new Date(item.updated_at).toISOString().slice(0, 16).replace("T", " ") : "—";
    lines.push(`  ${label} ${sizeKb.padStart(6)}kb · v${item.version} · ${ts}`);
  }
  lines.push("");
  lines.push("View one: seer memory --overview | --architecture | --features | --decisions | --errors | --log");
  lines.push("Update:   seer memory update --<aspect> '<content>'");
  return lines.join("\n");
}

function formatAspectView(aspect: AspectType, content: string, project: string): string {
  const label = ASPECT_LABELS[aspect];
  if (!content.trim()) {
    return `[SEER MEMORY · ${label}] ${project}\n\n(empty) — populate with: seer memory update --${aspect === "errors_fixes" ? "errors" : aspect === "project_overview" ? "overview" : aspect === "session_log" ? "log" : aspect} '<content>'`;
  }
  // Truncate session_log to last 10 entries per spec.
  if (aspect === "session_log") {
    const lines = content.split("\n").filter(l => l.trim());
    const last = lines.slice(-10).join("\n");
    return `[SEER MEMORY · ${label}] ${project}\n\n${last}`;
  }
  return `[SEER MEMORY · ${label}] ${project}\n\n${content}`;
}

export async function seer_memory(
  query: string,
  apiKey: string,
  _projectId?: string
): Promise<string> {
  const user = await authenticateUser(apiKey);
  if (!user) {
    return JSON.stringify({ error: "Invalid SEER key. Visit seer.ai" });
  }

  const mfa = await checkMfa(user);
  if (mfa.blocked) {
    return getMfaBlockMessage();
  }

  // Plan gate — memory requires Pro+
  if (user.plan === "free" || user.plan === "starter") {
    return JSON.stringify({
      error: "Project memory requires Pro plan or above. Upgrade at seer.ai/upgrade",
    });
  }

  const parsed = parseMemoryCommand(query);
  const scope = await resolveScope(user.id);
  const projectName = await resolveProjectName(user.id, parsed.project);

  if (!projectName) {
    return "[SEER MEMORY] No active project found. Run `seer memory run` to initialize your project memory.";
  }

  try {
    if (parsed.mode === "list") {
      const items = await listAspects(scope, projectName);
      return formatList(projectName, scope.agencyId ? "agency" : "personal", items);
    }

    if (parsed.mode === "view" && parsed.aspect) {
      const rows = await loadAspects(scope, projectName, [parsed.aspect]);
      const row = rows[0];
      return formatAspectView(parsed.aspect, row?.content ?? "", projectName);
    }

    if (parsed.mode === "update" && parsed.aspect && parsed.content) {
      const result = await writeAspect(
        scope,
        projectName,
        parsed.aspect,
        parsed.content,
        parsed.appendMode ? "append" : "replace"
      );
      return `[SEER MEMORY] ${ASPECT_LABELS[parsed.aspect]} ${result.action} · v${result.version}`;
    }

    return "[SEER MEMORY] Unknown command. Try: seer memory | seer memory --<aspect> | seer memory update --<aspect> '<content>'";
  } catch (err) {
    return JSON.stringify({
      error: "Memory operation failed.",
      detail: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
