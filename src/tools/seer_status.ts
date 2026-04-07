import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { formatStatusResult } from "../lib/formatter.js";
import { appendSuggestInstruction } from "../lib/suggest.js";

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

export async function seer_status(apiKey: string): Promise<string> {
  const user = await authenticateUser(apiKey);
  if (!user) {
    return "**Error:** Invalid SEER key. Visit https://seermcp.com to get your key.";
  }

  const limit = PLAN_LIMITS[user.plan] ?? 0;
  const remaining = Math.max(0, limit - user.usage_this_month);

  const result = formatStatusResult({
    version: "1.2.0",
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

  // Append Founder's Space alerts (overdue tasks, expiring docs)
  const fsAlerts = await getFoundersSpaceAlerts(user.id, user.fs_access);

  return appendSuggestInstruction(result + fsAlerts, "seer_status", "status", user.suggestion_skin ?? "default", user.auto_suggest);
}
