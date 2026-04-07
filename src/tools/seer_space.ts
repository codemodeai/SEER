import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";
import { supabase } from "../lib/supabase.js";
import { encrypt } from "../lib/encryption.js";
import { logSeerCall } from "../lib/logger.js";
import { buildUsageWarning } from "../lib/formatter.js";
import { appendMemoryLog } from "../lib/memory-log.js";
import { checkMfa, getMfaBlockMessage } from "../lib/mfa.js";
import { checkTeamConflict } from "../lib/conflict-detect.js";

// --- Action parser ---

interface ParsedAction {
  action: string;
  args: string;
  projectFlag: string | null;
  teamFlag: boolean;
}

function parseSpaceInput(input: string): ParsedAction {
  let cleaned = input;

  // Extract --team flag
  const teamFlag = /--team\b/i.test(cleaned);
  cleaned = cleaned.replace(/--team\b/gi, "").trim();

  // Extract --project flag
  let projectFlag: string | null = null;
  const projectMatch = cleaned.match(/--project\s+"([^"]+)"|--project\s+(\S+)/i);
  if (projectMatch) {
    projectFlag = projectMatch[1] ?? projectMatch[2];
    cleaned = cleaned.replace(projectMatch[0], "").trim();
  }

  // Match known actions
  const actionMap: Record<string, string> = {
    "add task": "add_task",
    "tasks": "tasks",
    "save key": "save_key",
    "key": "key",
    "docs": "docs",
    "note": "note",
    "projects": "projects",
    "new project": "new_project",
  };

  const lower = cleaned.toLowerCase();
  for (const [pattern, action] of Object.entries(actionMap)) {
    if (lower.startsWith(pattern)) {
      const args = cleaned.slice(pattern.length).trim();
      return { action, args, projectFlag, teamFlag };
    }
  }

  return { action: "unknown", args: cleaned, projectFlag, teamFlag };
}

// --- Resolve project by name ---
async function resolveProject(userId: string, name: string | null): Promise<string | null> {
  if (!name) return null;
  const { data } = await supabase
    .from("fs_projects")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .limit(1)
    .single();
  return data?.id ?? null;
}

// --- Resolve user's agency_id ---
async function resolveAgencyId(userId: string): Promise<string | null> {
  // Check if user owns an agency
  const { data: ownedAgency } = await supabase
    .from("agencies")
    .select("id")
    .eq("owner_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();

  if (ownedAgency) return ownedAgency.id;

  // Check agency membership
  const { data: membership } = await supabase
    .from("agency_users")
    .select("agency_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  return membership?.agency_id ?? null;
}

// --- Check if user is agency owner/admin ---
async function isAgencyAdmin(userId: string, agencyId: string): Promise<boolean> {
  // Owner check
  const { data: agency } = await supabase
    .from("agencies")
    .select("id")
    .eq("id", agencyId)
    .eq("owner_id", userId)
    .limit(1)
    .single();

  if (agency) return true;

  // Admin role check
  const { data: membership } = await supabase
    .from("agency_users")
    .select("role")
    .eq("user_id", userId)
    .eq("agency_id", agencyId)
    .limit(1)
    .single();

  return membership?.role === "admin";
}

// --- Action handlers ---

async function handleAddTask(userId: string, args: string, projectId: string | null, agencyId: string | null): Promise<string> {
  let title = args;
  let dueDate: string | null = null;

  const dueMatch = args.match(/--due\s+(\d{4}-\d{2}-\d{2})/);
  if (dueMatch) {
    dueDate = dueMatch[1];
    title = args.replace(dueMatch[0], "").trim();
  }

  if (!title) return "Error: Task title is required. Usage: `seer space add task Build login page --project myapp [--team]`";

  title = title.replace(/^["']|["']$/g, "");

  const { data, error } = await supabase
    .from("fs_tasks")
    .insert({
      user_id: userId,
      title,
      project_id: projectId,
      due_date: dueDate,
      status: "open",
      created_via: "mcp",
      agency_id: agencyId,
    })
    .select("id, title, status, due_date")
    .single();

  if (error) return `Error: Failed to create task — ${error.message}`;

  let result = `Task created: **${data.title}** (${data.status})`;
  if (data.due_date) result += ` | Due: ${data.due_date}`;
  if (agencyId) result += ` | Shared with team`;
  return result;
}

async function handleTasks(userId: string, projectId: string | null, agencyId: string | null): Promise<string> {
  let query = supabase
    .from("fs_tasks")
    .select("id, title, status, due_date, created_via, created_at, project_id, fs_projects(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (agencyId) {
    query = query.eq("agency_id", agencyId);
  } else {
    query = query.eq("user_id", userId).filter("agency_id", "is", null);
  }

  if (projectId) query = query.eq("project_id", projectId);

  const { data: tasks, error } = await query;
  if (error) return `Error: Failed to fetch tasks — ${error.message}`;
  if (!tasks || tasks.length === 0) {
    return agencyId
      ? "No team tasks found. Create one with `seer space add task <title> --team`."
      : "No tasks found. Create one with `seer space add task <title>`.";
  }

  const statusGroups: Record<string, typeof tasks> = { open: [], in_progress: [], blocked: [], done: [] };
  for (const t of tasks) {
    const s = t.status as string;
    if (statusGroups[s]) statusGroups[s].push(t);
  }

  let output = agencyId ? "**Founder's Space — Team Tasks**\n\n" : "**Founder's Space — Tasks**\n\n";
  for (const [status, items] of Object.entries(statusGroups)) {
    if (items.length === 0) continue;
    const label = status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
    output += `**${label}** (${items.length})\n`;
    for (const t of items) {
      const proj = (t as Record<string, unknown>).fs_projects as { name: string } | null;
      const projName = proj?.name ? ` [${proj.name}]` : "";
      const due = t.due_date ? ` | Due: ${t.due_date}` : "";
      const overdue = t.due_date && new Date(t.due_date + "T00:00:00") < new Date() && t.status !== "done" ? " **OVERDUE**" : "";
      output += `- ${t.title}${projName}${due}${overdue}\n`;
    }
    output += "\n";
  }

  return output.trim();
}

async function handleSaveKey(userId: string, args: string, projectId: string | null, agencyId: string | null, isAdmin: boolean): Promise<string> {
  if (agencyId && !isAdmin) {
    return "Error: Only agency owner/admin can create shared credentials.";
  }

  let environment = "production";
  let cleanArgs = args;

  const envMatch = args.match(/--env\s+(development|staging|production)/i);
  if (envMatch) {
    environment = envMatch[1].toLowerCase();
    cleanArgs = args.replace(envMatch[0], "").trim();
  }

  let label: string;
  let value: string;

  const eqIdx = cleanArgs.indexOf("=");
  if (eqIdx > 0) {
    label = cleanArgs.slice(0, eqIdx).trim();
    value = cleanArgs.slice(eqIdx + 1).trim();
  } else {
    const parts = cleanArgs.split(/\s+/, 2);
    label = parts[0] ?? "";
    value = parts[1] ?? "";
  }

  value = value.replace(/^["']|["']$/g, "");

  if (!label || !value) {
    return "Error: Usage: `seer space save key LABEL=value --project myapp --env production [--team]`";
  }

  const encrypted = encrypt(value);

  const { error } = await supabase
    .from("fs_credentials")
    .insert({
      user_id: userId,
      label,
      value_encrypted: encrypted.encrypted,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      project_id: projectId,
      environment,
      agency_id: agencyId,
    });

  if (error) return `Error: Failed to save credential — ${error.message}`;

  let result = `Credential saved: **${label}** (${environment})${projectId ? "" : " — no project assigned"}`;
  if (agencyId) result += ` | Shared with team`;
  result += `\n\nNote: Credential values are AES-256-GCM encrypted and NEVER returned to the terminal.`;
  return result;
}

async function handleKey(userId: string, args: string, projectId: string | null, agencyId: string | null): Promise<string> {
  const label = args.trim().replace(/^["']|["']$/g, "");
  if (!label) return "Error: Usage: `seer space key STRIPE_KEY --project myapp [--team]`";

  let query = supabase
    .from("fs_credentials")
    .select("id, label, environment, created_at, last_used_at")
    .ilike("label", label)
    .limit(1)
    .single();

  if (agencyId) {
    query = supabase.from("fs_credentials").select("id, label, environment, created_at, last_used_at").eq("agency_id", agencyId).ilike("label", label).limit(1).single();
  } else {
    query = supabase.from("fs_credentials").select("id, label, environment, created_at, last_used_at").eq("user_id", userId).filter("agency_id", "is", null).ilike("label", label).limit(1).single();
  }

  if (projectId) {
    if (agencyId) {
      query = supabase.from("fs_credentials").select("id, label, environment, created_at, last_used_at").eq("agency_id", agencyId).eq("project_id", projectId).ilike("label", label).limit(1).single();
    } else {
      query = supabase.from("fs_credentials").select("id, label, environment, created_at, last_used_at").eq("user_id", userId).filter("agency_id", "is", null).eq("project_id", projectId).ilike("label", label).limit(1).single();
    }
  }

  const { data, error } = await query;

  if (error || !data) return `Credential **${label}** not found${agencyId ? " in team vault" : ""}.`;

  await supabase.from("fs_credentials").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  const scope = agencyId ? " (team)" : "";
  return `Credential **${data.label}** exists${scope} (${data.environment}) — saved ${new Date(data.created_at).toLocaleDateString()}\n\nFor security, credential values are NEVER returned to the terminal. View in dashboard: seermcp.com/dashboard/founders-space`;
}

async function handleDocs(userId: string, projectId: string | null, agencyId: string | null): Promise<string> {
  let query = supabase
    .from("fs_documents")
    .select("id, filename, doc_type, expiry_date, file_size, created_at, project_id, fs_projects(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (agencyId) {
    query = query.eq("agency_id", agencyId);
  } else {
    query = query.eq("user_id", userId).filter("agency_id", "is", null);
  }

  if (projectId) query = query.eq("project_id", projectId);

  const { data: docs, error } = await query;
  if (error) return `Error: Failed to fetch documents — ${error.message}`;
  if (!docs || docs.length === 0) {
    return agencyId
      ? "No team documents found. Upload via dashboard: seermcp.com/dashboard/founders-space"
      : "No documents found. Upload via dashboard: seermcp.com/dashboard/founders-space";
  }

  const now = new Date();
  let output = agencyId ? "**Founder's Space — Team Documents**\n\n" : "**Founder's Space — Documents**\n\n";
  output += `| File | Type | Size | Expiry |\n`;
  output += `|------|------|------|--------|\n`;

  for (const d of docs) {
    const proj = (d as Record<string, unknown>).fs_projects as { name: string } | null;
    const projName = proj?.name ? ` [${proj.name}]` : "";
    const sizeKb = Math.round((d.file_size ?? 0) / 1024);
    let expiry = "—";
    if (d.expiry_date) {
      const exp = new Date(d.expiry_date + "T00:00:00");
      const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) expiry = "**EXPIRED**";
      else if (daysLeft <= 30) expiry = `${daysLeft}d left`;
      else expiry = d.expiry_date;
    }
    output += `| ${d.filename}${projName} | ${d.doc_type} | ${sizeKb}KB | ${expiry} |\n`;
  }

  output += `\nUpload new documents via dashboard: seermcp.com/dashboard/founders-space`;
  return output;
}

async function handleNote(userId: string, args: string, projectId: string | null, agencyId: string | null): Promise<string> {
  const body = args.replace(/^["']|["']$/g, "").trim();
  if (!body) return "Error: Usage: `seer space note Your note text here --project myapp [--team]`";

  const { data, error } = await supabase
    .from("fs_notes")
    .insert({
      user_id: userId,
      body,
      project_id: projectId,
      agency_id: agencyId,
    })
    .select("id, created_at")
    .single();

  if (error) return `Error: Failed to save note — ${error.message}`;

  let result = `Note saved at ${new Date(data.created_at).toLocaleString()}${projectId ? "" : " — no project assigned"}`;
  if (agencyId) result += ` | Shared with team`;
  return result;
}

async function handleProjects(userId: string): Promise<string> {
  const { data: projects, error } = await supabase
    .from("fs_projects")
    .select("id, name, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return `Error: Failed to fetch projects — ${error.message}`;
  if (!projects || projects.length === 0) return "No projects found. Create one with `seer space new project <name>`.";

  let output = "**Founder's Space — Projects**\n\n";
  for (const p of projects) {
    output += `- **${p.name}** (created ${new Date(p.created_at).toLocaleDateString()})\n`;
  }
  return output;
}

async function handleNewProject(userId: string, args: string): Promise<string> {
  const name = args.replace(/^["']|["']$/g, "").trim();
  if (!name) return "Error: Usage: `seer space new project My App Name`";

  const { data, error } = await supabase
    .from("fs_projects")
    .insert({ user_id: userId, name })
    .select("id, name")
    .single();

  if (error) return `Error: Failed to create project — ${error.message}`;

  return `Project created: **${data.name}**\n\nUse \`--project ${data.name}\` with other commands to scope to this project.`;
}

// --- Main tool handler ---

export async function seer_space(
  input: string,
  apiKey: string,
  surface: string = "unknown"
): Promise<string> {
  // 1. Authenticate
  const user = await authenticateUser(apiKey);
  if (!user) {
    return "**Error:** Invalid SEER key. Visit https://seermcp.com to get your key.";
  }

  // 2. Check fs_access
  if (!user.fs_access) {
    const addon = user.plan === "starter"
      ? "Add it for $1/mo: seermcp.com/dashboard/founders-space"
      : user.plan === "free"
        ? "Available on Starter ($8/mo + $1/mo addon), Pro ($19/mo, included), or Agency ($39/mo, included)."
        : "Your plan includes it — contact support to enable.";
    return `**Founder's Space is not enabled.**\n\n${addon}`;
  }

  // 3. MFA check
  const mfa = await checkMfa(user);
  if (mfa.blocked) return getMfaBlockMessage();

  // 4. Team conflict check
  const conflict = await checkTeamConflict(user, input);

  // 5. Check usage limit
  const limit = PLAN_LIMITS[user.plan] ?? 0;
  if (user.usage_this_month >= limit) {
    return `**Error:** Limit reached (${user.usage_this_month}/${limit}). Upgrade at seermcp.com/dashboard/billing`;
  }

  // 6. Increment usage
  await supabase
    .from("users")
    .update({ usage_this_month: user.usage_this_month + 1 })
    .eq("id", user.id);

  // 7. Parse action
  const { action, args, projectFlag, teamFlag } = parseSpaceInput(input);

  // 8. Resolve project
  const projectId = await resolveProject(user.id, projectFlag);

  // 9. Resolve team context
  let agencyId: string | null = null;
  let isAdmin = false;
  if (teamFlag) {
    if (user.plan !== "agency") {
      return "**Error:** `--team` flag requires an Agency plan. Upgrade at seermcp.com/dashboard/billing";
    }
    agencyId = await resolveAgencyId(user.id);
    if (!agencyId) {
      return "**Error:** You are not part of an agency. The `--team` flag requires agency membership.";
    }
    isAdmin = await isAgencyAdmin(user.id, agencyId);
  }

  // 10. Execute action
  let result: string;
  switch (action) {
    case "add_task":
      result = await handleAddTask(user.id, args, projectId, agencyId);
      break;
    case "tasks":
      result = await handleTasks(user.id, projectId, agencyId);
      break;
    case "save_key":
      result = await handleSaveKey(user.id, args, projectId, agencyId, isAdmin);
      break;
    case "key":
      result = await handleKey(user.id, args, projectId, agencyId);
      break;
    case "docs":
      result = await handleDocs(user.id, projectId, agencyId);
      break;
    case "note":
      result = await handleNote(user.id, args, projectId, agencyId);
      break;
    case "projects":
      result = await handleProjects(user.id);
      break;
    case "new_project":
      result = await handleNewProject(user.id, args);
      break;
    default:
      result = `**Unknown action.** Available commands:\n
- \`seer space add task <title> [--due YYYY-MM-DD] [--project name] [--team]\`
- \`seer space tasks [--project name] [--team]\`
- \`seer space save key LABEL=value [--env production] [--project name] [--team]\`
- \`seer space key <LABEL> [--project name] [--team]\`
- \`seer space docs [--project name] [--team]\`
- \`seer space note <text> [--project name] [--team]\`
- \`seer space projects\`
- \`seer space new project <name>\`

Use \`--team\` to share items with your agency team (Agency plan only).`;
      break;
  }

  // 11. Log
  await logSeerCall({
    user_id: user.id,
    raw_input: `space ${input}`,
    raw_tokens: 0,
    optimized_tokens: 0,
    tokens_saved: 0,
    pct_saved: 0,
    tool_used: "seer_space",
    surface,
  });

  // 12. Format with usage warning
  const usageWarning = buildUsageWarning(user.plan, user.usage_this_month + 1, limit);
  let finalResult = conflict.warning + usageWarning + result;

  if (mfa.nudge) finalResult += mfa.nudge;

  return appendMemoryLog(finalResult, "seer_space", `space ${input}`, user.suggestion_skin, user.auto_suggest, apiKey);
}
