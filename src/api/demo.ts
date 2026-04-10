import type { VercelRequest, VercelResponse } from "@vercel/node";
import { callHaiku, estimateTokens, parseHaikuJson } from "../lib/haiku.js";
import { SECURITY_ANCHOR } from "../lib/security.js";

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

const OPTIMIZE_PROMPT = `You are SEER, a prompt compressor. Rewrite the prompt to be shorter and more precise. NEVER make it longer.

Rules:
- Remove ALL filler words, pleasantries, and redundancy
- Use concise technical language
- Keep the SAME intent — do not add new requirements
- Short prompts stay short — just make them more precise
- The output MUST have FEWER words than the input

Return ONLY JSON: { "optimized": "...", "steps": ["step1", "step2", "step3", "step4", "step5"], "note": "..." }

IMPORTANT: Always include exactly 5 actionable steps in the "steps" array.
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

    const resultText = await callHaiku({
      systemPrompt: OPTIMIZE_PROMPT,
      userInput: prompt,
    });

    const parsed = parseHaikuJson(resultText);

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
