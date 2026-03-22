/**
 * Format SEER tool responses as clean markdown for Claude UI.
 * Raw JSON is still embedded at the bottom for Claude to parse programmatically.
 */

interface SeerRunResult {
  optimized?: string;
  steps?: string[];
  note?: string;
  context_used?: boolean;
  _meta?: {
    raw_tokens: number;
    optimized_tokens: number;
    tokens_saved: number;
    pct_saved: number;
    usage: string;
  };
}

interface SeerOptimizeResult {
  optimized?: string;
  token_reduction_pct?: number;
  quality_score?: number;
  explanation?: string;
  target_model?: string;
  tokens_before?: number;
  tokens_after?: number;
  tokens_saved?: number;
  pct_saved?: number;
}

interface WorkflowStep {
  step?: number;
  title?: string;
  context?: string;
  prompt?: string;
}

interface SeerWorkflowResult {
  goal?: string;
  steps?: WorkflowStep[];
  _meta?: {
    total_steps: number;
    usage: string;
  };
}

export function formatRunResult(parsed: SeerRunResult): string {
  const lines: string[] = [];

  lines.push("## ⚡ SEER Optimized Prompt\n");

  if (parsed.optimized) {
    lines.push(parsed.optimized);
    lines.push("");
  }

  if (parsed.steps && parsed.steps.length > 0) {
    lines.push("### Steps");
    parsed.steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
    lines.push("");
  }

  if (parsed.note) {
    lines.push(`> ${parsed.note}`);
    lines.push("");
  }

  if (parsed._meta) {
    const m = parsed._meta;
    lines.push(`---`);
    lines.push(`Tokens: ${m.raw_tokens} → ${m.optimized_tokens} (saved ${m.tokens_saved}, -${m.pct_saved}%) | Usage: ${m.usage}`);
  }

  return lines.join("\n");
}

export function formatOptimizeResult(parsed: SeerOptimizeResult): string {
  const lines: string[] = [];

  lines.push("## ⚡ SEER Optimized Prompt\n");

  if (parsed.optimized) {
    lines.push(parsed.optimized);
    lines.push("");
  }

  if (parsed.explanation) {
    lines.push(`> ${parsed.explanation}`);
    lines.push("");
  }

  const details: string[] = [];
  if (parsed.target_model) details.push(`Model: ${parsed.target_model}`);
  if (parsed.quality_score != null) details.push(`Quality: ${parsed.quality_score}`);
  if (parsed.tokens_before != null && parsed.tokens_after != null) {
    details.push(`Tokens: ${parsed.tokens_before} → ${parsed.tokens_after} (saved ${parsed.tokens_saved ?? 0}, -${parsed.pct_saved ?? 0}%)`);
  }

  if (details.length > 0) {
    lines.push("---");
    lines.push(details.join(" | "));
  }

  return lines.join("\n");
}

export function formatWorkflowResult(parsed: SeerWorkflowResult): string {
  const lines: string[] = [];

  lines.push("## ⚡ SEER Workflow\n");

  if (parsed.goal) {
    lines.push(`**Goal:** ${parsed.goal}\n`);
  }

  if (parsed.steps && parsed.steps.length > 0) {
    parsed.steps.forEach((step) => {
      lines.push(`### Step ${step.step ?? ""}: ${step.title ?? ""}`);
      if (step.context) {
        lines.push(`${step.context}\n`);
      }
      if (step.prompt) {
        lines.push("```");
        lines.push(step.prompt);
        lines.push("```\n");
      }
    });
  }

  if (parsed._meta) {
    lines.push("---");
    lines.push(`${parsed._meta.total_steps} steps | Usage: ${parsed._meta.usage}`);
  }

  return lines.join("\n");
}

export function formatStatusResult(data: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push("## SEER Status\n");
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Plan | ${String(data.plan ?? "—")} |`);
  lines.push(`| Usage | ${data.usage_this_month} / ${data.limit} |`);
  lines.push(`| Remaining | ${data.remaining} |`);
  lines.push(`| AI Preference | ${String(data.ai_preference ?? "—")} |`);
  lines.push(`| Version | ${String(data.version ?? "—")} |`);
  lines.push("");

  if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
    lines.push("**Try:**");
    (data.suggestions as string[]).forEach((s) => {
      lines.push(`- ${s}`);
    });
  }

  return lines.join("\n");
}
