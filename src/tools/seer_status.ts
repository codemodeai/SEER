import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { formatStatusResult } from "../lib/formatter.js";
import { appendSuggestInstruction } from "../lib/suggest.js";

// --- Founder's Space alerts (overdue tasks, expiring docs) ---

async function getFoundersSpaceAlerts(userId: string, hasFsAccess: boolean): Promise<string> {
  if (!hasFsAccess) return "";

  const alerts: string[] = [];
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Overdue tasks
  const { data: overdueTasks } = await supabase
    .from("fs_tasks")
    .select("title, due_date, status")
    .eq("user_id", userId)
    .neq("status", "done")
    .not("due_date", "is", null)
    .lt("due_date", now.toISOString().split("T")[0])
    .limit(5);

  if (overdueTasks && overdueTasks.length > 0) {
    alerts.push(`**Overdue Tasks (${overdueTasks.length}):**`);
    for (const t of overdueTasks) {
      alerts.push(`  - ${t.title} (due ${t.due_date})`);
    }
  }

  // Expiring documents (within 30 days)
  const { data: expiringDocs } = await supabase
    .from("fs_documents")
    .select("filename, doc_type, expiry_date")
    .eq("user_id", userId)
    .not("expiry_date", "is", null)
    .lte("expiry_date", thirtyDaysFromNow.toISOString().split("T")[0])
    .limit(5);

  if (expiringDocs && expiringDocs.length > 0) {
    const expired = expiringDocs.filter((d) => new Date(d.expiry_date + "T00:00:00") < now);
    const expiringSoon = expiringDocs.filter((d) => new Date(d.expiry_date + "T00:00:00") >= now);

    if (expired.length > 0) {
      alerts.push(`**Expired Documents (${expired.length}):**`);
      for (const d of expired) {
        alerts.push(`  - ${d.filename} (${d.doc_type}, expired ${d.expiry_date})`);
      }
    }
    if (expiringSoon.length > 0) {
      alerts.push(`**Expiring Soon (${expiringSoon.length}):**`);
      for (const d of expiringSoon) {
        const daysLeft = Math.ceil((new Date(d.expiry_date + "T00:00:00").getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        alerts.push(`  - ${d.filename} (${d.doc_type}, ${daysLeft}d left)`);
      }
    }
  }

  return alerts.length > 0 ? "\n\n**Founder's Space Alerts:**\n" + alerts.join("\n") : "";
}

// --- Spec §14: Aspect freshness ---

function formatTimeSince(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type FreshnessLevel = "fresh" | "aging" | "stale";

function freshnessLevel(isoDate: string): FreshnessLevel {
  const hours = (Date.now() - new Date(isoDate).getTime()) / 3_600_000;
  if (hours < 24) return "fresh";
  if (hours < 72) return "aging";
  return "stale";
}

function freshnessIcon(level: FreshnessLevel): string {
  if (level === "fresh") return "green";
  if (level === "aging") return "yellow";
  return "red";
}

async function getAspectFreshness(userId: string): Promise<string> {
  // Get all projects for this user and their aspect freshness
  const { data: aspects } = await supabase
    .from("project_memory_files")
    .select("project_name, aspect_type, updated_at, size_bytes")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (!aspects || aspects.length === 0) {
    return "\n\n**Memory:** No project memory initialized. Run `seer memory run` to start.";
  }

  // Group by project
  const projects = new Map<string, typeof aspects>();
  for (const a of aspects) {
    const list = projects.get(a.project_name) ?? [];
    list.push(a);
    projects.set(a.project_name, list);
  }

  const lines: string[] = ["\n\n**Project Memory:**"];

  for (const [project, files] of projects) {
    const totalSize = files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
    const latestUpdate = files[0]?.updated_at ?? "";
    const level = latestUpdate ? freshnessLevel(latestUpdate) : "stale";
    const timeSince = latestUpdate ? formatTimeSince(latestUpdate) : "never";

    lines.push(`  **${project}** — ${files.length} aspects, ${(totalSize / 1024).toFixed(1)}KB, updated ${timeSince} [${freshnessIcon(level)}]`);

    // Show stale aspects as warnings
    const staleAspects = files.filter((f) => freshnessLevel(f.updated_at) === "stale");
    if (staleAspects.length > 0) {
      const staleNames = staleAspects.map((f) => f.aspect_type).join(", ");
      lines.push(`    Stale: ${staleNames} — run \`seer memory run\` to refresh`);
    }
  }

  return lines.join("\n");
}

// --- Spec §14: Open tasks from features aspect ---

async function getOpenTasksSummary(userId: string): Promise<string> {
  const { data: features } = await supabase
    .from("project_memory_files")
    .select("project_name, content")
    .eq("user_id", userId)
    .eq("aspect_type", "features")
    .limit(3);

  if (!features || features.length === 0) return "";

  const lines: string[] = [];

  for (const f of features) {
    const openTasks = (f.content?.match(/^- \[ \] .+$/gm) ?? []);
    const doneTasks = (f.content?.match(/^- \[x\] .+$/gm) ?? []);
    if (openTasks.length > 0) {
      lines.push(`  **${f.project_name}:** ${openTasks.length} open, ${doneTasks.length} done`);
    }
  }

  return lines.length > 0 ? "\n\n**Open Tasks:**\n" + lines.join("\n") : "";
}

// --- Spec §14: Insights tip ---

function getInsightsTip(usageThisMonth: number, plan: string): string {
  if (plan === "free") return "";
  if (usageThisMonth > 10) {
    return "\n\n**Tip:** Run `seer insights` to get AI-powered analysis of your work patterns and suggestions.";
  }
  return "";
}

// --- Spec §14: Active features summary ---

function getActiveFeatures(plan: string): string {
  const features: string[] = ["prompt optimization", "mode switch", "complexity scoring"];
  if (plan !== "free") features.push("workflow", "memory", "session read");
  if (plan === "pro" || plan === "agency") features.push("embeddings", "priority engine");
  if (plan === "agency") features.push("team portal", "shared memory", "webhooks");

  return `\n**Active:** ${features.join(", ")}`;
}

// --- Main ---

export async function seer_status(apiKey: string): Promise<string> {
  const user = await authenticateUser(apiKey);
  if (!user) {
    return "**Error:** Invalid SEER key. Visit https://seermcp.com to get your key.";
  }

  const limit = PLAN_LIMITS[user.plan] ?? 0;
  const remaining = Math.max(0, limit - user.usage_this_month);

  const result = formatStatusResult({
    version: "1.3.0",
    email: user.email,
    plan: user.plan,
    usage_this_month: user.usage_this_month,
    limit: limit === Infinity ? "unlimited" : limit,
    remaining: limit === Infinity ? "unlimited" : remaining,
    ai_preference: user.ai_preference,
    updates_url: "https://seermcp.com/dashboard/updates",
    suggestions: [
      "seer build the login page",
      "seer optimize my last prompt",
      "seer workflow for setting up CI/CD",
    ],
  });

  // Spec §14 additions — all fetched in parallel
  const [fsAlerts, aspectFreshness, openTasks] = await Promise.all([
    getFoundersSpaceAlerts(user.id, user.fs_access),
    getAspectFreshness(user.id),
    getOpenTasksSummary(user.id),
  ]);

  const activeFeatures = getActiveFeatures(user.plan);
  const insightsTip = getInsightsTip(user.usage_this_month, user.plan);

  const fullResult = result + activeFeatures + aspectFreshness + openTasks + fsAlerts + insightsTip;

  return appendSuggestInstruction(fullResult, "seer_status", "status", user.suggestion_skin ?? "default", user.auto_suggest, apiKey);
}
