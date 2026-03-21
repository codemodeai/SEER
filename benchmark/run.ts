import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

// ─── Config ──────────────────────────────────────────────
const SEER_API_URL = "https://mcp.seermcp.com/mcp";
const SEER_API_KEY = process.env["SEER_API_KEY"] ?? "";
const ANTHROPIC_API_KEY = process.env["ANTHROPIC_API_KEY"] ?? "";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

if (!SEER_API_KEY) {
  console.error("❌ Set SEER_API_KEY environment variable");
  process.exit(1);
}
const SKIP_RESPONSE_TEST = !ANTHROPIC_API_KEY;
if (SKIP_RESPONSE_TEST) {
  console.log("⚠️  ANTHROPIC_API_KEY not set — skipping response token comparison (prompt optimization only)");
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── Types ───────────────────────────────────────────────
interface TestPrompt {
  id: string;
  category: string;
  prompt: string;
}

interface BenchmarkResult {
  id: string;
  category: string;
  original_prompt: string;
  optimized_prompt: string;
  original_tokens: number;
  optimized_tokens: number;
  prompt_savings_pct: number;
  original_response_tokens: number;
  optimized_response_tokens: number;
  response_savings_pct: number;
  total_original: number;
  total_optimized: number;
  total_savings_pct: number;
  seer_meta: Record<string, unknown>;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────
function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.3);
}

async function callSeerOptimize(prompt: string): Promise<{ optimized: string; meta: Record<string, unknown> }> {
  // Initialize MCP connection
  await fetch(SEER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${SEER_API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "seer-benchmark", version: "1.0.0" },
      },
    }),
  });

  // Call seer_optimize tool
  const res = await fetch(SEER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${SEER_API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "seer_optimize",
        arguments: { prompt, model: "claude" },
      },
    }),
  });

  const data = (await res.json()) as {
    result?: { content?: Array<{ text?: string }> };
  };
  const text = data?.result?.content?.[0]?.text ?? "{}";

  // Parse response (handle markdown code fences)
  const stripped = text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(stripped);
    return { optimized: parsed.optimized ?? prompt, meta: parsed };
  } catch {
    try {
      const parsed = JSON.parse(text);
      return { optimized: parsed.optimized ?? prompt, meta: parsed };
    } catch {
      return { optimized: prompt, meta: { error: "parse_failed", raw: text } };
    }
  }
}

async function getClaudeResponseTokens(prompt: string): Promise<number> {
  const res = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return res.usage.output_tokens;
}

function printBar(label: string, value: number, max: number, width: number = 40): string {
  const filled = Math.round((value / max) * width);
  const bar = "█".repeat(Math.min(filled, width)) + "░".repeat(Math.max(0, width - filled));
  return `${label.padEnd(12)} ${bar} ${value}`;
}

// ─── Main ────────────────────────────────────────────────
async function main() {
  const promptsPath = path.join(import.meta.dirname ?? __dirname, "prompts.json");
  const prompts: TestPrompt[] = JSON.parse(fs.readFileSync(promptsPath, "utf-8"));

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║           SEER BENCHMARK — Prompt Optimization          ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`  Server:  ${SEER_API_URL}`);
  console.log(`  Model:   ${CLAUDE_MODEL}`);
  console.log(`  Prompts: ${prompts.length}`);
  console.log("");

  const results: BenchmarkResult[] = [];
  let totalOrigPromptTokens = 0;
  let totalOptPromptTokens = 0;
  let totalOrigRespTokens = 0;
  let totalOptRespTokens = 0;

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    const progress = `[${(i + 1).toString().padStart(2)}/${prompts.length}]`;
    process.stdout.write(`  ${progress} ${p.id.padEnd(25)} `);

    try {
      // Step 1: Optimize with SEER
      const { optimized, meta } = await callSeerOptimize(p.prompt);
      const origTokens = estimateTokens(p.prompt);
      const optTokens = estimateTokens(optimized);
      const promptSavings = origTokens > 0 ? Math.round((1 - optTokens / origTokens) * 100) : 0;

      // Step 2: Send both to Claude, measure response tokens (if API key available)
      let origRespTokens = 0;
      let optRespTokens = 0;
      if (!SKIP_RESPONSE_TEST) {
        [origRespTokens, optRespTokens] = await Promise.all([
          getClaudeResponseTokens(p.prompt),
          getClaudeResponseTokens(optimized),
        ]);
      }

      const totalOrig = origTokens + origRespTokens;
      const totalOpt = optTokens + optRespTokens;
      const totalSavings = totalOrig > 0 ? Math.round((1 - totalOpt / totalOrig) * 100) : 0;

      totalOrigPromptTokens += origTokens;
      totalOptPromptTokens += optTokens;
      totalOrigRespTokens += origRespTokens;
      totalOptRespTokens += optRespTokens;

      const result: BenchmarkResult = {
        id: p.id,
        category: p.category,
        original_prompt: p.prompt,
        optimized_prompt: optimized,
        original_tokens: origTokens,
        optimized_tokens: optTokens,
        prompt_savings_pct: promptSavings,
        original_response_tokens: origRespTokens,
        optimized_response_tokens: optRespTokens,
        response_savings_pct: origRespTokens > 0 ? Math.round((1 - optRespTokens / origRespTokens) * 100) : 0,
        total_original: totalOrig,
        total_optimized: totalOpt,
        total_savings_pct: totalSavings,
        seer_meta: meta,
      };

      results.push(result);

      const savingsColor = totalSavings > 0 ? "\x1b[32m" : totalSavings < 0 ? "\x1b[31m" : "\x1b[33m";
      console.log(
        `prompt: ${origTokens}→${optTokens} (${promptSavings > 0 ? "-" : "+"}${Math.abs(promptSavings)}%)  ` +
          `response: ${origRespTokens}→${optRespTokens}  ` +
          `${savingsColor}total: ${totalSavings > 0 ? "-" : "+"}${Math.abs(totalSavings)}%\x1b[0m`
      );
    } catch (err) {
      console.log(`\x1b[31mERROR: ${err instanceof Error ? err.message : "Unknown"}\x1b[0m`);
      results.push({
        id: p.id,
        category: p.category,
        original_prompt: p.prompt,
        optimized_prompt: "",
        original_tokens: 0,
        optimized_tokens: 0,
        prompt_savings_pct: 0,
        original_response_tokens: 0,
        optimized_response_tokens: 0,
        response_savings_pct: 0,
        total_original: 0,
        total_optimized: 0,
        total_savings_pct: 0,
        seer_meta: {},
        error: err instanceof Error ? err.message : "Unknown",
      });
    }
  }

  // ─── Summary ─────────────────────────────────────────
  const successResults = results.filter((r) => !r.error);
  const totalOrigAll = totalOrigPromptTokens + totalOrigRespTokens;
  const totalOptAll = totalOptPromptTokens + totalOptRespTokens;
  const overallSavings = totalOrigAll > 0 ? Math.round((1 - totalOptAll / totalOrigAll) * 100) : 0;

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                    BENCHMARK RESULTS                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("  PROMPT TOKENS:");
  console.log(`    ${printBar("Original", totalOrigPromptTokens, Math.max(totalOrigPromptTokens, totalOptPromptTokens))}`);
  console.log(`    ${printBar("Optimized", totalOptPromptTokens, Math.max(totalOrigPromptTokens, totalOptPromptTokens))}`);
  const promptPct = totalOrigPromptTokens > 0 ? Math.round((1 - totalOptPromptTokens / totalOrigPromptTokens) * 100) : 0;
  console.log(`    Savings: ${promptPct}%\n`);

  console.log("  RESPONSE TOKENS (Claude output):");
  console.log(`    ${printBar("Original", totalOrigRespTokens, Math.max(totalOrigRespTokens, totalOptRespTokens))}`);
  console.log(`    ${printBar("Optimized", totalOptRespTokens, Math.max(totalOrigRespTokens, totalOptRespTokens))}`);
  const respPct = totalOrigRespTokens > 0 ? Math.round((1 - totalOptRespTokens / totalOrigRespTokens) * 100) : 0;
  console.log(`    Savings: ${respPct}%\n`);

  console.log("  TOTAL (prompt + response):");
  console.log(`    ${printBar("Original", totalOrigAll, Math.max(totalOrigAll, totalOptAll))}`);
  console.log(`    ${printBar("Optimized", totalOptAll, Math.max(totalOrigAll, totalOptAll))}`);
  console.log(`    \x1b[1mOverall Savings: ${overallSavings}%\x1b[0m\n`);

  // By category
  console.log("  BY CATEGORY:");
  const categories = [...new Set(successResults.map((r) => r.category))];
  for (const cat of categories) {
    const catResults = successResults.filter((r) => r.category === cat);
    const catOrigTotal = catResults.reduce((s, r) => s + r.total_original, 0);
    const catOptTotal = catResults.reduce((s, r) => s + r.total_optimized, 0);
    const catSavings = catOrigTotal > 0 ? Math.round((1 - catOptTotal / catOrigTotal) * 100) : 0;
    const color = catSavings > 0 ? "\x1b[32m" : "\x1b[31m";
    console.log(`    ${cat.padEnd(22)} ${color}${catSavings > 0 ? "-" : "+"}${Math.abs(catSavings)}%\x1b[0m  (${catResults.length} prompts)`);
  }

  // Top 5 best optimizations
  console.log("\n  TOP 5 BEST OPTIMIZATIONS:");
  const sorted = [...successResults].sort((a, b) => b.total_savings_pct - a.total_savings_pct);
  for (const r of sorted.slice(0, 5)) {
    console.log(`    \x1b[32m-${r.total_savings_pct}%\x1b[0m  ${r.id}`);
  }

  // Bottom 5 (worst/negative)
  console.log("\n  BOTTOM 5 (needs improvement):");
  for (const r of sorted.slice(-5).reverse()) {
    const color = r.total_savings_pct < 0 ? "\x1b[31m" : "\x1b[33m";
    console.log(`    ${color}${r.total_savings_pct > 0 ? "-" : "+"}${Math.abs(r.total_savings_pct)}%\x1b[0m  ${r.id}`);
  }

  console.log(`\n  Tests: ${successResults.length}/${prompts.length} passed`);
  console.log(`  Errors: ${results.filter((r) => r.error).length}\n`);

  // Save detailed results
  const outPath = path.join(import.meta.dirname ?? __dirname, "results.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        config: { server: SEER_API_URL, model: CLAUDE_MODEL, prompts_count: prompts.length },
        summary: {
          prompt_tokens: { original: totalOrigPromptTokens, optimized: totalOptPromptTokens, savings_pct: promptPct },
          response_tokens: { original: totalOrigRespTokens, optimized: totalOptRespTokens, savings_pct: respPct },
          total: { original: totalOrigAll, optimized: totalOptAll, savings_pct: overallSavings },
        },
        results,
      },
      null,
      2
    )
  );
  console.log(`  Detailed results saved to: ${outPath}\n`);
}

main().catch(console.error);
