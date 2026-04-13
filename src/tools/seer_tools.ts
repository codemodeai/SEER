import { authenticateUser, PLAN_LIMITS } from "../lib/auth.js";

export async function seer_tools(apiKey: string): Promise<string> {
  const user = await authenticateUser(apiKey);
  if (!user) {
    return "**Error:** Invalid SEER key. Visit https://seermcp.com to get your key.";
  }

  const plan = user.plan;
  const limit = PLAN_LIMITS[plan] ?? 0;
  const remaining = Math.max(0, limit - user.usage_this_month);

  // Tool definitions with plan gating
  const tools = [
    {
      name: "seer run",
      usage: "`seer <anything>`",
      description: "Compress and optimize any prompt via Haiku AI",
      cost: "1 call",
      plans: ["free", "starter", "pro", "agency"],
    },
    {
      name: "seer optimize",
      usage: "`seer optimize <prompt>`",
      description: "Model-specific prompt optimization (Claude, GPT, Gemini)",
      cost: "1 call",
      plans: ["free", "starter", "pro", "agency"],
    },
    {
      name: "seer workflow",
      usage: "`seer workflow <goal>`",
      description: "Break a goal into 3-7 sequential executable steps",
      cost: "1 call",
      plans: ["starter", "pro", "agency"],
    },
    {
      name: "seer memory",
      usage: "`seer memory <query>`",
      description: "Semantic search across project memory via embeddings",
      cost: "1 call",
      plans: ["pro", "agency"],
    },
    {
      name: "seer status",
      usage: "`seer status`",
      description: "Show plan, usage, remaining calls, and version info",
      cost: "Free",
      plans: ["free", "starter", "pro", "agency"],
    },
    {
      name: "seer tools",
      usage: "`seer tools`",
      description: "Show this tools and features list",
      cost: "Free",
      plans: ["free", "starter", "pro", "agency"],
    },
    {
      name: "seer continue",
      usage: "`seer continue` / `seer resume`",
      description: "Resume from where you left off — reads online aspect memory",
      cost: "1 call",
      plans: ["free", "starter", "pro", "agency"],
    },
    {
      name: "seer recall",
      usage: "`seer what did I do` / `seer recall` / `seer recap`",
      description: "Natural language recall from project memory",
      cost: "1 call",
      plans: ["free", "starter", "pro", "agency"],
    },
    {
      name: "seer session read",
      usage: "`seer session read` / `seer save session`",
      description: "Capture non-seer session work into online aspect memory",
      cost: "1 call",
      plans: ["free", "starter", "pro", "agency"],
    },
    {
      name: "seer memory run",
      usage: "`seer memory run`",
      description: "Initialize online aspect memory for a new project",
      cost: "1 call",
      plans: ["free", "starter", "pro", "agency"],
    },
    {
      name: "seer space",
      usage: "`seer space <action>`",
      description: "Founder's Space — manage tasks, credentials, docs, notes, projects from terminal",
      cost: "1 call",
      plans: ["starter", "pro", "agency"],
    },
    {
      name: "seer record credentials",
      usage: "`seer record credentials`",
      description: "Scan project files (.env, configs) for credentials and batch-save to Founder's Space",
      cost: "1 call",
      plans: ["starter", "pro", "agency"],
    },
  ];

  // Features
  const features = [
    {
      name: "Auto-log",
      description: "Every seer command auto-appends to online session_log aspect",
      status: "Active",
    },
    {
      name: "Auto-suggest",
      description: "3-5 contextual next-step suggestions after every command",
      status: "Active",
    },
    {
      name: "Smart nudge",
      description: "Suggests `seer session read` when important work is detected",
      status: "Active",
    },
    {
      name: "Re-open detection",
      description: "Detects when you reference a completed task and offers to re-open it",
      status: "Active (Pro+)",
    },
    {
      name: "Memory context injection",
      description: "Injects relevant project memory into prompt optimization",
      status: "Active (Pro+)",
    },
    {
      name: "Input/output security",
      description: "Sanitizes inputs and scans outputs for injection and data leaks",
      status: "Active",
    },
    {
      name: "Rate limiting",
      description: "60 requests/minute per IP and API key",
      status: "Active",
    },
  ];

  // Build output
  let output = `**SEER Tools & Features** — v1.2.0\n`;
  output += `Plan: **${plan.charAt(0).toUpperCase() + plan.slice(1)}** | Usage: ${user.usage_this_month}/${limit === Infinity ? "unlimited" : limit} | Remaining: ${remaining === Infinity ? "unlimited" : remaining}\n\n`;

  output += `### Tools\n\n`;
  output += `| Tool | Usage | Cost | Status |\n`;
  output += `|------|-------|------|--------|\n`;

  for (const tool of tools) {
    const available = tool.plans.includes(plan);
    const status = available ? "Available" : `Requires ${tool.plans[0].charAt(0).toUpperCase() + tool.plans[0].slice(1)}+`;
    output += `| **${tool.name}** | ${tool.usage} | ${tool.cost} | ${status} |\n`;
  }

  output += `\n### Features\n\n`;
  output += `| Feature | Description | Status |\n`;
  output += `|---------|-------------|--------|\n`;

  for (const feature of features) {
    output += `| **${feature.name}** | ${feature.description} | ${feature.status} |\n`;
  }

  output += `\n### Quick Reference\n`;
  output += `- Prompt compression: \`seer build a login page\`\n`;
  output += `- Resume session: \`seer continue\`\n`;
  output += `- Check history: \`seer what did I do\`\n`;
  output += `- Break down goal: \`seer workflow deploy to production\`\n`;
  output += `- Initialize memory: \`seer memory run\`\n`;
  output += `- Save session: \`seer session read\`\n`;
  output += `- Record credentials: \`seer record credentials\`\n`;

  return output;
}
