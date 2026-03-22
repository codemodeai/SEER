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

  if (parsed.optimized) {
    lines.push(`EXECUTE THIS:\n${parsed.optimized}`);
  }

  if (parsed.steps && parsed.steps.length > 0) {
    lines.push("");
    lines.push("FOLLOW THESE STEPS:");
    parsed.steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
  }

  if (parsed.note) {
    lines.push(`\n(${parsed.note})`);
  }

  if (parsed._meta) {
    const m = parsed._meta;
    lines.push(`\n[${m.raw_tokens}→${m.optimized_tokens} tokens | -${m.pct_saved}% | ${m.usage}]`);
  }

  return lines.join("\n");
}

export function formatOptimizeResult(parsed: SeerOptimizeResult): string {
  const lines: string[] = [];

  if (parsed.optimized) {
    lines.push(`OPTIMIZED PROMPT:\n${parsed.optimized}`);
  }

  if (parsed.explanation) {
    lines.push(`\n(${parsed.explanation})`);
  }

  const details: string[] = [];
  if (parsed.target_model) details.push(parsed.target_model);
  if (parsed.quality_score != null) details.push(`quality:${parsed.quality_score}`);
  if (parsed.tokens_before != null && parsed.tokens_after != null) {
    details.push(`${parsed.tokens_before}→${parsed.tokens_after} tokens | -${parsed.pct_saved ?? 0}%`);
  }

  if (details.length > 0) {
    lines.push(`[${details.join(" | ")}]`);
  }

  return lines.join("\n");
}

export function formatWorkflowResult(parsed: SeerWorkflowResult): string {
  const lines: string[] = [];

  if (parsed.goal) {
    lines.push(`GOAL: ${parsed.goal}\n`);
  }

  if (parsed.steps && parsed.steps.length > 0) {
    lines.push("EXECUTE THESE STEPS IN ORDER:");
    parsed.steps.forEach((step) => {
      lines.push(`\nStep ${step.step}: ${step.title}`);
      if (step.context) lines.push(step.context);
      if (step.prompt) lines.push(`→ ${step.prompt}`);
    });
  }

  if (parsed._meta) {
    lines.push(`\n[${parsed._meta.total_steps} steps | ${parsed._meta.usage}]`);
  }

  return lines.join("\n");
}

export function formatStatusResult(data: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push(`SEER v${data.version} | Plan: ${data.plan} | Usage: ${data.usage_this_month}/${data.limit} | Remaining: ${data.remaining} | AI: ${data.ai_preference}`);

  if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
    lines.push(`Try: ${(data.suggestions as string[]).join(" | ")}`);
  }

  return lines.join("\n");
}
