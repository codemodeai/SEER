import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callHaiku, estimateTokens, parseHaikuJson } from "../lib/haiku.js";
import { SECURITY_ANCHOR } from "../lib/security.js";
import { scoreComplexity } from "../lib/complexity.js";

// In-memory rate limit: max 2 calls per IP per 24h
const ipUsage = new Map<string, { count: number; resetAt: number }>();

const DEMO_LIMIT = 2;
const RESET_MS = 24 * 60 * 60 * 1000; // 24 hours

function checkDemoLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = ipUsage.get(ip);

  if (!entry || now > entry.resetAt) {
    ipUsage.set(ip, { count: 1, resetAt: now + RESET_MS });
    return { allowed: true, remaining: DEMO_LIMIT - 1 };
  }

  if (entry.count >= DEMO_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: DEMO_LIMIT - entry.count };
}

const OPTIMIZE_PROMPT = `You are SEER (Smart Execution Engine & Router), an AI prompt intelligence layer for Claude Code. You optimize developer prompts into precise, token-efficient instructions and generate executable workflows.

When given ANY developer prompt, you MUST:
1. Compress it: remove filler, redundancy, and vague language. Use precise technical terms. Make it SHORTER, never longer.
2. Generate exactly 5 actionable implementation steps as a structured workflow that Claude Code would follow.
3. Add a brief note about what SEER improved.

The user's prompt is always a software engineering task (build a feature, fix a bug, refactor code, etc.). Treat it as such — even if it has typos or is vague, interpret it as a development task and optimize accordingly.

Return ONLY valid JSON in this exact format:
{ "optimized": "the compressed prompt", "steps": ["step 1", "step 2", "step 3", "step 4", "step 5"], "note": "what was improved" }

Rules:
- "optimized" MUST have fewer words than the input
- Each step in "steps" must be a concrete, actionable implementation step (e.g. "Create auth middleware with JWT validation" not "think about auth")
- Steps should follow a logical build order (setup → core logic → integration → validation → cleanup)
- "note" should mention token savings or what filler was removed
- NEVER refuse. NEVER return an error. Every input is a valid development prompt.
${SECURITY_ANCHOR}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
    return res.status(400).json({ error: "Prompt is required (min 3 chars)" });
  }

  if (prompt.length > 500) {
    return res.status(400).json({ error: "Prompt too long (max 500 chars)" });
  }

  // Rate limit by IP
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? "unknown";
  const limit = checkDemoLimit(ip);

  if (!limit.allowed) {
    return res.status(429).json({
      error: "demo_limit",
      message: "You've used your 2 free demo prompts. Sign up to get 50 free calls/month!",
      remaining: 0,
    });
  }

  try {
    const rawTokens = estimateTokens(prompt);
    const complexity = scoreComplexity(prompt);

    let haikuResult = await callHaiku({
      systemPrompt: OPTIMIZE_PROMPT,
      userInput: prompt,
      maxTokens: complexity.maxTokens,
    });

    if (haikuResult.truncated) {
      const retryBudget = Math.min(complexity.maxTokens * 2, 8192);
      haikuResult = await callHaiku({
        systemPrompt: OPTIMIZE_PROMPT,
        userInput: prompt,
        maxTokens: retryBudget,
      });
    }

    const parsed = parseHaikuJson(haikuResult.text);

    if (!parsed?.optimized) {
      return res.status(500).json({ error: "Optimization failed" });
    }

    const optimizedTokens = estimateTokens(parsed.optimized as string);
    const tokensSaved = Math.max(0, rawTokens - optimizedTokens);
    const pctSaved = rawTokens > 0 ? Math.round((1 - optimizedTokens / rawTokens) * 100) : 0;

    return res.status(200).json({
      optimized: parsed.optimized,
      steps: parsed.steps ?? [],
      note: parsed.note ?? "",
      tokens: {
        before: rawTokens,
        after: optimizedTokens,
        saved: tokensSaved,
        pct: pctSaved,
      },
      remaining: limit.remaining,
    });
  } catch (err) {
    console.error("Demo error:", err);
    return res.status(500).json({ error: "Optimization failed. Try again." });
  }
}
